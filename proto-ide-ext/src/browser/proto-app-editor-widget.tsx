import * as React from '@theia/core/shared/react';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { NavigatableWidget } from '@theia/core/lib/browser/navigatable-types';
import { Saveable, SaveableSource } from '@theia/core/lib/browser/saveable';
import { ConfirmDialog } from '@theia/core/lib/browser/dialogs';
import { Emitter, Event, MessageService } from '@theia/core/lib/common';
import URI from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import {
    ComponentDeclaration, FolderNode, InstanceNode, PropertyDeclaration, PropertyType, PropertyValue, PROPERTY_TYPES,
    ProtoApplication, TreeNode, coerceValue, effectiveValue, findNode, findParent, initialDefault, instancesOf, moveNode,
    newId, nodePath, parseApplication, removeNode, removePropertyFromInstances, renamePropertyInInstances, serializeApplication,
    uniqueName, walk
} from '../common/proto-model';

export const ProtoAppEditorOptions = Symbol('ProtoAppEditorOptions');
export interface ProtoAppEditorOptions {
    uri: string;
}

type Selection = { kind: 'component', id: string } | { kind: 'node', id: string } | undefined;

const DND_NODE = 'application/x-proto-node';
const DND_COMPONENT = 'application/x-proto-component';

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
    string: 'Texte', number: 'Nombre', boolean: 'Booléen', enum: 'Énumération'
};

@injectable()
export class ProtoAppEditorWidget extends ReactWidget implements NavigatableWidget, SaveableSource {

    static readonly ID = 'proto-app-editor';

    @inject(ProtoAppEditorOptions) protected readonly options: ProtoAppEditorOptions;
    @inject(FileService) protected readonly fileService: FileService;
    @inject(MessageService) protected readonly messageService: MessageService;

    readonly saveable: Saveable = this.createSaveable();

    protected uri: URI;
    protected app: ProtoApplication | undefined;
    protected loadError: string | undefined;
    protected selection: Selection;
    protected readonly expanded = new Set<string>(['root']);
    protected instanceComponentId: string | undefined;
    protected dropTargetId: string | undefined;

    protected _dirty = false;
    protected readonly onDirtyChangedEmitter = new Emitter<void>();
    protected readonly onContentChangedEmitter = new Emitter<void>();

    @postConstruct()
    protected init(): void {
        this.uri = new URI(this.options.uri);
        this.id = `${ProtoAppEditorWidget.ID}:${this.options.uri}`;
        this.title.label = this.uri.path.base;
        this.title.caption = this.uri.path.fsPath();
        this.title.iconClass = 'codicon codicon-symbol-structure';
        this.title.closable = true;
        this.addClass('proto-app-editor');
        this.node.tabIndex = -1;
        this.toDispose.pushAll([this.onDirtyChangedEmitter, this.onContentChangedEmitter]);
        this.load();
    }

    // ------------------------------------------------------------------ NavigatableWidget

    getResourceUri(): URI | undefined {
        return this.uri;
    }

    createMoveToUri(resourceUri: URI): URI | undefined {
        return resourceUri;
    }

    // ------------------------------------------------------------------ Lecture / enregistrement

    protected async load(): Promise<void> {
        try {
            const content = await this.fileService.read(this.uri);
            this.app = parseApplication(content.value, this.uri.path.name);
            this.loadError = undefined;
            this.setDirty(false);
        } catch (e) {
            this.app = undefined;
            this.loadError = e instanceof Error ? e.message : String(e);
        }
        this.update();
    }

    async save(): Promise<void> {
        if (!this.app) {
            return;
        }
        await this.fileService.write(this.uri, serializeApplication(this.app));
        this.setDirty(false);
        this.update();
    }

    protected createSaveable(): Saveable {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const widget = this;
        return {
            get dirty(): boolean { return widget._dirty; },
            get onDirtyChanged(): Event<void> { return widget.onDirtyChangedEmitter.event; },
            get onContentChanged(): Event<void> { return widget.onContentChangedEmitter.event; },
            save: () => widget.save(),
            revert: () => widget.load(),
            createSnapshot: () => ({ value: widget.app ? serializeApplication(widget.app) : '' }),
            applySnapshot: (snapshot: object) => {
                const value = Saveable.Snapshot.read(snapshot as Saveable.Snapshot) ?? '';
                widget.app = parseApplication(value, widget.uri.path.name);
                widget.setDirty(true);
                widget.update();
            }
        };
    }

    protected setDirty(dirty: boolean): void {
        if (this._dirty !== dirty) {
            this._dirty = dirty;
            this.onDirtyChangedEmitter.fire();
        }
    }

    /** Applique une modification au modèle puis rafraîchit la vue. */
    protected mutate(change: (app: ProtoApplication) => void): void {
        if (!this.app) {
            return;
        }
        change(this.app);
        this.setDirty(true);
        this.onContentChangedEmitter.fire();
        this.update();
    }

    protected override onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.node.focus();
    }

    // ------------------------------------------------------------------ Actions

    protected select(selection: Selection): void {
        this.selection = selection;
        this.update();
    }

    protected component(id: string | undefined): ComponentDeclaration | undefined {
        return this.app?.components.find(c => c.id === id);
    }

    /** Dossier cible pour une insertion : dossier sélectionné, parent de l'instance sélectionnée, ou racine. */
    protected targetFolder(app: ProtoApplication): FolderNode {
        if (this.selection?.kind === 'node') {
            const node = findNode(app.root, this.selection.id);
            if (node?.kind === 'folder') {
                return node;
            }
            if (node) {
                return findParent(app.root, node.id) ?? app.root;
            }
        }
        return app.root;
    }

    protected addComponent = (): void => this.mutate(app => {
        const name = uniqueName('Composant', app.components.map(c => c.name));
        const cmp: ComponentDeclaration = { id: newId('cmp'), name, properties: [] };
        app.components.push(cmp);
        this.selection = { kind: 'component', id: cmp.id };
    });

    protected async deleteComponent(cmp: ComponentDeclaration): Promise<void> {
        const app = this.app!;
        const instances = instancesOf(app.root, cmp.id);
        const confirmed = await new ConfirmDialog({
            title: 'Supprimer le composant',
            msg: instances.length
                ? `Le composant "${cmp.name}" est utilisé par ${instances.length} instance(s), qui seront également supprimées. Continuer ?`
                : `Supprimer le composant "${cmp.name}" ?`,
            ok: 'Supprimer',
            cancel: 'Annuler'
        }).open();
        if (!confirmed) {
            return;
        }
        this.mutate(a => {
            instances.forEach(i => removeNode(a.root, i.id));
            a.components = a.components.filter(c => c.id !== cmp.id);
            this.selection = undefined;
        });
    }

    protected addFolder = (): void => this.mutate(app => {
        const parent = this.targetFolder(app);
        const folder: FolderNode = {
            kind: 'folder', id: newId('dir'), children: [],
            name: uniqueName('dossier', parent.children.map(c => c.name))
        };
        parent.children.push(folder);
        this.expanded.add(parent.id);
        this.selection = { kind: 'node', id: folder.id };
    });

    protected addInstance(componentId: string | undefined, parentId?: string): void {
        const cmp = this.component(componentId);
        if (!cmp) {
            this.messageService.warn('Déclarez puis choisissez d\'abord un composant à instancier.');
            return;
        }
        this.mutate(app => {
            const found = parentId ? findNode(app.root, parentId) : undefined;
            const parent = found?.kind === 'folder' ? found : this.targetFolder(app);
            const instance: InstanceNode = {
                kind: 'instance', id: newId('inst'), componentId: cmp.id, values: {},
                name: uniqueName(lowerFirst(cmp.name), parent.children.map(c => c.name))
            };
            parent.children.push(instance);
            this.expanded.add(parent.id);
            this.selection = { kind: 'node', id: instance.id };
        });
    }

    protected async deleteNode(nodeId: string): Promise<void> {
        const app = this.app!;
        const node = findNode(app.root, nodeId);
        if (!node || node.id === app.root.id) {
            return;
        }
        if (node.kind === 'folder' && node.children.length) {
            const count = [...walk(node)].length - 1;
            const confirmed = await new ConfirmDialog({
                title: 'Supprimer le dossier',
                msg: `Le dossier "${node.name}" contient ${count} élément(s). Tout supprimer ?`,
                ok: 'Supprimer',
                cancel: 'Annuler'
            }).open();
            if (!confirmed) {
                return;
            }
        }
        this.mutate(a => {
            const parent = findParent(a.root, nodeId);
            removeNode(a.root, nodeId);
            this.selection = parent ? { kind: 'node', id: parent.id } : undefined;
        });
    }

    protected toggle(id: string): void {
        if (this.expanded.has(id)) {
            this.expanded.delete(id);
        } else {
            this.expanded.add(id);
        }
        this.update();
    }

    /** Valide un nom : non vide et unique parmi `siblings`. Affiche un avertissement sinon. */
    protected validName(name: string, siblings: string[], what: string): boolean {
        if (!name.trim()) {
            this.messageService.warn(`Le nom ${what} ne peut pas être vide.`);
            return false;
        }
        if (siblings.includes(name)) {
            this.messageService.warn(`Le nom "${name}" est déjà utilisé.`);
            return false;
        }
        if (/[\/\\]/.test(name)) {
            this.messageService.warn('Les caractères "/" et "\\" ne sont pas autorisés.');
            return false;
        }
        return true;
    }

    // ------------------------------------------------------------------ Rendu

    protected render(): React.ReactNode {
        if (this.loadError) {
            return <div className='proto-message proto-error'>
                <h3>Impossible de lire l'application</h3>
                <p>{this.loadError}</p>
                <button className='theia-button' onClick={() => this.load()}>Réessayer</button>
            </div>;
        }
        const app = this.app;
        if (!app) {
            return <div className='proto-message'>Chargement…</div>;
        }
        const instanceCount = [...walk(app.root)].filter(n => n.kind === 'instance').length;
        return <div className='proto-editor'>
            <header className='proto-header'>
                <span className='codicon codicon-symbol-structure' />
                <CommitInput className='proto-app-name' value={app.name} title='Nom de l&apos;application'
                    onCommit={v => !!v.trim() && (this.mutate(a => { a.name = v; a.root.name = v; }), true)} />
                <span className='proto-stats'>{app.components.length} composant(s) · {instanceCount} instance(s)</span>
                <span className='proto-spacer' />
                {this._dirty && <span className='proto-dirty'>● modifié</span>}
                <button className='theia-button' disabled={!this._dirty} title='Enregistrer (Ctrl+S)'
                    onClick={() => this.save()}>Enregistrer</button>
            </header>
            <div className='proto-columns'>
                {this.renderComponents(app)}
                {this.renderTree(app)}
                {this.renderDetails(app)}
            </div>
        </div>;
    }

    // --- Colonne 1 : déclarations de composants

    protected renderComponents(app: ProtoApplication): React.ReactNode {
        return <section className='proto-panel'>
            <div className='proto-panel-title'>
                <span>Composants</span>
                <button className='proto-icon-button codicon codicon-add' title='Déclarer un composant' onClick={this.addComponent} />
            </div>
            <div className='proto-panel-body'>
                {app.components.length === 0 && <div className='proto-hint'>Aucun composant. Cliquez sur + pour en déclarer un.</div>}
                {app.components.map(cmp => {
                    const selected = this.selection?.kind === 'component' && this.selection.id === cmp.id;
                    return <div key={cmp.id} className={`proto-row ${selected ? 'selected' : ''}`} draggable
                        title='Glissez dans l&apos;arborescence pour créer une instance'
                        onDragStart={e => { e.dataTransfer.setData(DND_COMPONENT, cmp.id); e.dataTransfer.effectAllowed = 'copy'; }}
                        onClick={() => this.select({ kind: 'component', id: cmp.id })}>
                        <span className='codicon codicon-symbol-class proto-cmp-icon' />
                        <span className='proto-row-label'>{cmp.name}</span>
                        <span className='proto-badge' title='propriétés / instances'>
                            {cmp.properties.length} · {instancesOf(app.root, cmp.id).length}
                        </span>
                    </div>;
                })}
            </div>
        </section>;
    }

    // --- Colonne 2 : arborescence d'instances

    protected renderTree(app: ProtoApplication): React.ReactNode {
        const selectedNode = this.selection?.kind === 'node' ? findNode(app.root, this.selection.id) : undefined;
        const instanceCmp = this.component(this.instanceComponentId) ?? app.components[0];
        return <section className='proto-panel proto-tree-panel'>
            <div className='proto-panel-title'>
                <span>Arborescence</span>
                <button className='proto-icon-button codicon codicon-new-folder' title='Nouveau (sous-)répertoire' onClick={this.addFolder} />
                <button className='proto-icon-button codicon codicon-trash' title='Supprimer (Suppr)'
                    disabled={!selectedNode || selectedNode.id === app.root.id}
                    onClick={() => selectedNode && this.deleteNode(selectedNode.id)} />
            </div>
            <div className='proto-toolbar'>
                <select className='theia-select' value={instanceCmp?.id ?? ''} disabled={!app.components.length}
                    onChange={e => { this.instanceComponentId = e.target.value; this.update(); }}>
                    {!app.components.length && <option value=''>— aucun composant —</option>}
                    {app.components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button className='theia-button secondary' disabled={!instanceCmp}
                    onClick={() => this.addInstance(instanceCmp?.id)}>+ Instance</button>
            </div>
            <div className='proto-panel-body proto-tree' tabIndex={0} onKeyDown={e => this.onTreeKey(e, app)}>
                {this.renderNode(app, app.root, 0)}
            </div>
        </section>;
    }

    protected onTreeKey(e: React.KeyboardEvent, app: ProtoApplication): void {
        if (e.key === 'Delete' && this.selection?.kind === 'node' && this.selection.id !== app.root.id) {
            e.preventDefault();
            this.deleteNode(this.selection.id);
        }
    }

    protected renderNode(app: ProtoApplication, node: TreeNode, depth: number): React.ReactNode {
        const selected = this.selection?.kind === 'node' && this.selection.id === node.id;
        const isFolder = node.kind === 'folder';
        const expanded = isFolder && this.expanded.has(node.id);
        const isRoot = node.id === app.root.id;
        const cmp = node.kind === 'instance' ? this.component(node.componentId) : undefined;
        const icon = isFolder ? (isRoot ? 'codicon-root-folder' : expanded ? 'codicon-folder-opened' : 'codicon-folder')
            : 'codicon-symbol-field';
        const classes = ['proto-row', selected ? 'selected' : '', this.dropTargetId === node.id ? 'drop-target' : ''].join(' ');

        const dropHandlers = isFolder ? {
            onDragOver: (e: React.DragEvent) => {
                if (e.dataTransfer.types.includes(DND_NODE) || e.dataTransfer.types.includes(DND_COMPONENT)) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (this.dropTargetId !== node.id) {
                        this.dropTargetId = node.id;
                        this.update();
                    }
                }
            },
            onDragLeave: () => { if (this.dropTargetId === node.id) { this.dropTargetId = undefined; this.update(); } },
            onDrop: (e: React.DragEvent) => {
                e.preventDefault();
                e.stopPropagation();
                this.dropTargetId = undefined;
                const nodeId = e.dataTransfer.getData(DND_NODE);
                const componentId = e.dataTransfer.getData(DND_COMPONENT);
                if (componentId) {
                    this.addInstance(componentId, node.id);
                } else if (nodeId) {
                    let moved = false;
                    this.mutate(a => { moved = moveNode(a.root, nodeId, node.id); });
                    if (moved) {
                        this.expanded.add(node.id);
                        this.update();
                    }
                } else {
                    this.update();
                }
            }
        } : {};

        return <React.Fragment key={node.id}>
            <div className={classes} style={{ paddingLeft: 6 + depth * 14 }}
                draggable={!isRoot}
                onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData(DND_NODE, node.id); e.dataTransfer.effectAllowed = 'move'; }}
                onDragEnd={() => { if (this.dropTargetId) { this.dropTargetId = undefined; this.update(); } }}
                onClick={() => this.select({ kind: 'node', id: node.id })}
                onDoubleClick={() => isFolder && this.toggle(node.id)}
                {...dropHandlers}>
                <span className={`proto-twisty codicon ${isFolder && node.children.length ? (expanded ? 'codicon-chevron-down' : 'codicon-chevron-right') : ''}`}
                    onClick={e => { e.stopPropagation(); if (isFolder) { this.toggle(node.id); } }} />
                <span className={`codicon ${icon} ${isFolder ? 'proto-folder-icon' : 'proto-inst-icon'}`} />
                <span className='proto-row-label'>{node.name}</span>
                {node.kind === 'instance' &&
                    <span className={`proto-row-detail ${cmp ? '' : 'proto-missing'}`}>{cmp ? cmp.name : 'composant introuvable'}</span>}
            </div>
            {expanded && node.kind === 'folder' && node.children.map(child => this.renderNode(app, child, depth + 1))}
        </React.Fragment>;
    }

    // --- Colonne 3 : propriétés de l'élément sélectionné

    protected renderDetails(app: ProtoApplication): React.ReactNode {
        let body: React.ReactNode = <div className='proto-hint'>Sélectionnez un composant ou un élément de l'arborescence.</div>;
        let title = 'Propriétés';
        if (this.selection?.kind === 'component') {
            const cmp = this.component(this.selection.id);
            if (cmp) {
                title = `Composant « ${cmp.name} »`;
                body = this.renderComponentDetails(app, cmp);
            }
        } else if (this.selection?.kind === 'node') {
            const node = findNode(app.root, this.selection.id);
            if (node?.kind === 'folder') {
                title = node.id === app.root.id ? 'Racine' : `Répertoire « ${node.name} »`;
                body = this.renderFolderDetails(app, node);
            } else if (node?.kind === 'instance') {
                title = `Instance « ${node.name} »`;
                body = this.renderInstanceDetails(app, node);
            }
        }
        return <section className='proto-panel proto-details'>
            <div className='proto-panel-title'><span>{title}</span></div>
            <div className='proto-panel-body proto-form'>{body}</div>
        </section>;
    }

    protected renderComponentDetails(app: ProtoApplication, cmp: ComponentDeclaration): React.ReactNode {
        const otherNames = app.components.filter(c => c.id !== cmp.id).map(c => c.name);
        return <>
            <label className='proto-field'>
                <span>Nom</span>
                <CommitInput key={cmp.id} value={cmp.name}
                    onCommit={v => this.validName(v, otherNames, 'du composant') && (this.mutate(() => { cmp.name = v; }), true)} />
            </label>
            <label className='proto-field'>
                <span>Description</span>
                <textarea className='theia-input' rows={2} value={cmp.description ?? ''}
                    onChange={e => this.mutate(() => { cmp.description = e.target.value || undefined; })} />
            </label>

            <div className='proto-subtitle'>
                <span>Propriétés déclarées</span>
                <button className='theia-button secondary' onClick={() => this.mutate(() => {
                    cmp.properties.push({
                        name: uniqueName('propriete', cmp.properties.map(p => p.name)),
                        type: 'string', defaultValue: ''
                    });
                })}>+ Propriété</button>
            </div>
            {cmp.properties.length === 0
                ? <div className='proto-hint'>Aucune propriété.</div>
                : <table className='proto-props-table'>
                    <thead><tr><th>Nom</th><th>Type</th><th>Valeur par défaut</th><th /></tr></thead>
                    <tbody>{cmp.properties.map((p, i) => this.renderPropertyDeclaration(app, cmp, p, i))}</tbody>
                </table>}

            <div className='proto-actions'>
                <button className='theia-button secondary' onClick={() => this.addInstance(cmp.id)}>Instancier</button>
                <button className='theia-button proto-danger' onClick={() => this.deleteComponent(cmp)}>Supprimer le composant</button>
            </div>
        </>;
    }

    protected renderPropertyDeclaration(app: ProtoApplication, cmp: ComponentDeclaration, prop: PropertyDeclaration, index: number): React.ReactNode {
        const others = cmp.properties.filter(p => p !== prop).map(p => p.name);
        const move = (delta: number) => this.mutate(() => {
            const [p] = cmp.properties.splice(index, 1);
            cmp.properties.splice(index + delta, 0, p);
        });
        return <React.Fragment key={`${cmp.id}:${index}`}>
            <tr>
                <td>
                    <CommitInput value={prop.name} onCommit={v => {
                        if (v === prop.name) { return true; }
                        if (!this.validName(v, others, 'de la propriété')) { return false; }
                        this.mutate(a => { renamePropertyInInstances(a.root, cmp.id, prop.name, v); prop.name = v; });
                        return true;
                    }} />
                </td>
                <td>
                    <select className='theia-select' value={prop.type} onChange={e => this.mutate(a => {
                        prop.type = e.target.value as PropertyType;
                        if (prop.type === 'enum' && !prop.options?.length) {
                            prop.options = ['option1', 'option2'];
                        }
                        if (prop.type !== 'enum') {
                            delete prop.options;
                        }
                        prop.defaultValue = coerceValue(prop, prop.defaultValue === '' ? initialDefault(prop.type, prop.options) : prop.defaultValue);
                        coerceInstanceValues(a, cmp, prop);
                    })}>
                        {PROPERTY_TYPES.map(t => <option key={t} value={t}>{PROPERTY_TYPE_LABELS[t]}</option>)}
                    </select>
                </td>
                <td>
                    <ValueEditor prop={prop} value={prop.defaultValue}
                        onChange={v => this.mutate(() => { prop.defaultValue = v; })} />
                </td>
                <td className='proto-row-buttons'>
                    <button className='proto-icon-button codicon codicon-arrow-up' title='Monter' disabled={index === 0} onClick={() => move(-1)} />
                    <button className='proto-icon-button codicon codicon-arrow-down' title='Descendre'
                        disabled={index === cmp.properties.length - 1} onClick={() => move(1)} />
                    <button className='proto-icon-button codicon codicon-close' title='Supprimer la propriété' onClick={() => this.mutate(a => {
                        cmp.properties.splice(index, 1);
                        removePropertyFromInstances(a.root, cmp.id, prop.name);
                    })} />
                </td>
            </tr>
            {prop.type === 'enum' && <tr className='proto-enum-row'>
                <td colSpan={4}>
                    <label className='proto-inline-field'>
                        <span>Valeurs possibles (séparées par des virgules)</span>
                        <CommitInput value={(prop.options ?? []).join(', ')} onCommit={v => {
                            const options = [...new Set(v.split(',').map(s => s.trim()).filter(s => s))];
                            if (!options.length) {
                                this.messageService.warn('Une énumération doit avoir au moins une valeur.');
                                return false;
                            }
                            this.mutate(a => {
                                prop.options = options;
                                prop.defaultValue = coerceValue(prop, prop.defaultValue);
                                coerceInstanceValues(a, cmp, prop);
                            });
                            return true;
                        }} />
                    </label>
                </td>
            </tr>}
        </React.Fragment>;
    }

    protected renderFolderDetails(app: ProtoApplication, folder: FolderNode): React.ReactNode {
        const isRoot = folder.id === app.root.id;
        const parent = findParent(app.root, folder.id);
        const siblings = (parent?.children ?? []).filter(c => c.id !== folder.id).map(c => c.name);
        const descendants = [...walk(folder)].slice(1);
        return <>
            {!isRoot && <label className='proto-field'>
                <span>Nom</span>
                <CommitInput key={folder.id} value={folder.name}
                    onCommit={v => this.validName(v, siblings, 'du répertoire') && (this.mutate(() => { folder.name = v; }), true)} />
            </label>}
            <div className='proto-field'><span>Chemin</span><code>/{nodePath(app.root, folder.id)}</code></div>
            <div className='proto-field'>
                <span>Contenu</span>
                <span>{descendants.filter(n => n.kind === 'folder').length} sous-répertoire(s), {descendants.filter(n => n.kind === 'instance').length} instance(s)</span>
            </div>
            <div className='proto-actions'>
                <button className='theia-button secondary' onClick={this.addFolder}>+ Sous-répertoire</button>
                {!isRoot && <button className='theia-button proto-danger' onClick={() => this.deleteNode(folder.id)}>Supprimer</button>}
            </div>
        </>;
    }

    protected renderInstanceDetails(app: ProtoApplication, instance: InstanceNode): React.ReactNode {
        const cmp = this.component(instance.componentId);
        const parent = findParent(app.root, instance.id);
        const siblings = (parent?.children ?? []).filter(c => c.id !== instance.id).map(c => c.name);
        return <>
            <label className='proto-field'>
                <span>Nom</span>
                <CommitInput key={instance.id} value={instance.name}
                    onCommit={v => this.validName(v, siblings, 'de l\'instance') && (this.mutate(() => { instance.name = v; }), true)} />
            </label>
            <div className='proto-field'><span>Chemin</span><code>/{nodePath(app.root, instance.id)}</code></div>
            <label className='proto-field'>
                <span>Composant</span>
                <select className='theia-select' value={cmp ? cmp.id : ''} onChange={e => this.mutate(() => {
                    instance.componentId = e.target.value;
                    instance.values = {};
                })}>
                    {!cmp && <option value=''>— introuvable ({instance.componentId}) —</option>}
                    {app.components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </label>
            {cmp && <>
                <div className='proto-subtitle'><span>Valeurs des propriétés</span></div>
                {cmp.properties.length === 0 && <div className='proto-hint'>Le composant « {cmp.name} » ne déclare aucune propriété.</div>}
                {cmp.properties.map(prop => {
                    const { value, isDefault } = effectiveValue(instance, prop);
                    return <div key={prop.name} className='proto-field proto-value-field'>
                        <span title={PROPERTY_TYPE_LABELS[prop.type]}>{prop.name}</span>
                        <ValueEditor prop={prop} value={value} className={isDefault ? 'proto-default-value' : ''}
                            onChange={v => this.mutate(() => { instance.values[prop.name] = v; })} />
                        <button className='proto-icon-button codicon codicon-discard' disabled={isDefault}
                            title={isDefault ? 'Valeur par défaut' : 'Revenir à la valeur par défaut'}
                            onClick={() => this.mutate(() => { delete instance.values[prop.name]; })} />
                    </div>;
                })}
            </>}
            <div className='proto-actions'>
                {cmp && <button className='theia-button secondary' onClick={() => this.select({ kind: 'component', id: cmp.id })}>Voir le composant</button>}
                <button className='theia-button proto-danger' onClick={() => this.deleteNode(instance.id)}>Supprimer</button>
            </div>
        </>;
    }
}

function lowerFirst(s: string): string {
    return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function coerceInstanceValues(app: ProtoApplication, cmp: ComponentDeclaration, prop: PropertyDeclaration): void {
    for (const inst of instancesOf(app.root, cmp.id)) {
        if (Object.prototype.hasOwnProperty.call(inst.values, prop.name)) {
            inst.values[prop.name] = coerceValue(prop, inst.values[prop.name]);
        }
    }
}

// ---------------------------------------------------------------------------
// Petits composants React
// ---------------------------------------------------------------------------

interface CommitInputProps {
    value: string;
    /** Retourne false pour refuser la valeur (l'ancienne valeur est restaurée). */
    onCommit: (value: string) => boolean;
    className?: string;
    title?: string;
}

/** Champ texte validé à la perte de focus ou sur Entrée (Échap annule). */
function CommitInput(props: CommitInputProps): React.ReactElement {
    const [draft, setDraft] = React.useState(props.value);
    React.useEffect(() => setDraft(props.value), [props.value]);
    const commit = () => {
        const v = draft.trim();
        if (v === props.value) {
            setDraft(props.value);
        } else if (!props.onCommit(v)) {
            setDraft(props.value);
        }
    };
    return <input className={`theia-input ${props.className ?? ''}`} title={props.title} value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
            if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
            if (e.key === 'Escape') { setDraft(props.value); }
        }} />;
}

interface ValueEditorProps {
    prop: PropertyDeclaration;
    value: PropertyValue;
    onChange: (value: PropertyValue) => void;
    className?: string;
}

/** Éditeur de valeur adapté au type de la propriété. */
function ValueEditor({ prop, value, onChange, className }: ValueEditorProps): React.ReactElement {
    switch (prop.type) {
        case 'boolean':
            return <input type='checkbox' className={className} checked={value === true} onChange={e => onChange(e.target.checked)} />;
        case 'number':
            return <input type='number' className={`theia-input ${className ?? ''}`} value={String(value)}
                onChange={e => onChange(e.target.value === '' ? 0 : coerceValue(prop, e.target.value))} />;
        case 'enum':
            return <select className={`theia-select ${className ?? ''}`} value={String(value)} onChange={e => onChange(e.target.value)}>
                {(prop.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>;
        default:
            return <input type='text' className={`theia-input ${className ?? ''}`} value={String(value)} onChange={e => onChange(e.target.value)} />;
    }
}
