"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ProtoAppEditorWidget_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtoAppEditorWidget = exports.ProtoAppEditorOptions = void 0;
const React = require("@theia/core/shared/react");
const inversify_1 = require("@theia/core/shared/inversify");
const react_widget_1 = require("@theia/core/lib/browser/widgets/react-widget");
const saveable_1 = require("@theia/core/lib/browser/saveable");
const dialogs_1 = require("@theia/core/lib/browser/dialogs");
const common_1 = require("@theia/core/lib/common");
const uri_1 = require("@theia/core/lib/common/uri");
const file_service_1 = require("@theia/filesystem/lib/browser/file-service");
const proto_model_1 = require("../common/proto-model");
exports.ProtoAppEditorOptions = Symbol('ProtoAppEditorOptions');
const DND_NODE = 'application/x-proto-node';
const DND_COMPONENT = 'application/x-proto-component';
const PROPERTY_TYPE_LABELS = {
    string: 'Texte', number: 'Nombre', boolean: 'Booléen', enum: 'Énumération'
};
let ProtoAppEditorWidget = ProtoAppEditorWidget_1 = class ProtoAppEditorWidget extends react_widget_1.ReactWidget {
    constructor() {
        super(...arguments);
        this.saveable = this.createSaveable();
        this.expanded = new Set(['root']);
        this._dirty = false;
        this.onDirtyChangedEmitter = new common_1.Emitter();
        this.onContentChangedEmitter = new common_1.Emitter();
        this.addComponent = () => this.mutate(app => {
            const name = (0, proto_model_1.uniqueName)('Composant', app.components.map(c => c.name));
            const cmp = { id: (0, proto_model_1.newId)('cmp'), name, properties: [] };
            app.components.push(cmp);
            this.selection = { kind: 'component', id: cmp.id };
        });
        this.addFolder = () => this.mutate(app => {
            const parent = this.targetFolder(app);
            const folder = {
                kind: 'folder', id: (0, proto_model_1.newId)('dir'), children: [],
                name: (0, proto_model_1.uniqueName)('dossier', parent.children.map(c => c.name))
            };
            parent.children.push(folder);
            this.expanded.add(parent.id);
            this.selection = { kind: 'node', id: folder.id };
        });
    }
    init() {
        this.uri = new uri_1.default(this.options.uri);
        this.id = `${ProtoAppEditorWidget_1.ID}:${this.options.uri}`;
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
    getResourceUri() {
        return this.uri;
    }
    createMoveToUri(resourceUri) {
        return resourceUri;
    }
    // ------------------------------------------------------------------ Lecture / enregistrement
    async load() {
        try {
            const content = await this.fileService.read(this.uri);
            this.app = (0, proto_model_1.parseApplication)(content.value, this.uri.path.name);
            this.loadError = undefined;
            this.setDirty(false);
        }
        catch (e) {
            this.app = undefined;
            this.loadError = e instanceof Error ? e.message : String(e);
        }
        this.update();
    }
    async save() {
        if (!this.app) {
            return;
        }
        await this.fileService.write(this.uri, (0, proto_model_1.serializeApplication)(this.app));
        this.setDirty(false);
        this.update();
    }
    createSaveable() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const widget = this;
        return {
            get dirty() { return widget._dirty; },
            get onDirtyChanged() { return widget.onDirtyChangedEmitter.event; },
            get onContentChanged() { return widget.onContentChangedEmitter.event; },
            save: () => widget.save(),
            revert: () => widget.load(),
            createSnapshot: () => ({ value: widget.app ? (0, proto_model_1.serializeApplication)(widget.app) : '' }),
            applySnapshot: (snapshot) => {
                var _a;
                const value = (_a = saveable_1.Saveable.Snapshot.read(snapshot)) !== null && _a !== void 0 ? _a : '';
                widget.app = (0, proto_model_1.parseApplication)(value, widget.uri.path.name);
                widget.setDirty(true);
                widget.update();
            }
        };
    }
    setDirty(dirty) {
        if (this._dirty !== dirty) {
            this._dirty = dirty;
            this.onDirtyChangedEmitter.fire();
        }
    }
    /** Applique une modification au modèle puis rafraîchit la vue. */
    mutate(change) {
        if (!this.app) {
            return;
        }
        change(this.app);
        this.setDirty(true);
        this.onContentChangedEmitter.fire();
        this.update();
    }
    onActivateRequest(msg) {
        super.onActivateRequest(msg);
        this.node.focus();
    }
    // ------------------------------------------------------------------ Actions
    select(selection) {
        this.selection = selection;
        this.update();
    }
    component(id) {
        var _a;
        return (_a = this.app) === null || _a === void 0 ? void 0 : _a.components.find(c => c.id === id);
    }
    /** Dossier cible pour une insertion : dossier sélectionné, parent de l'instance sélectionnée, ou racine. */
    targetFolder(app) {
        var _a, _b;
        if (((_a = this.selection) === null || _a === void 0 ? void 0 : _a.kind) === 'node') {
            const node = (0, proto_model_1.findNode)(app.root, this.selection.id);
            if ((node === null || node === void 0 ? void 0 : node.kind) === 'folder') {
                return node;
            }
            if (node) {
                return (_b = (0, proto_model_1.findParent)(app.root, node.id)) !== null && _b !== void 0 ? _b : app.root;
            }
        }
        return app.root;
    }
    async deleteComponent(cmp) {
        const app = this.app;
        const instances = (0, proto_model_1.instancesOf)(app.root, cmp.id);
        const confirmed = await new dialogs_1.ConfirmDialog({
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
            instances.forEach(i => (0, proto_model_1.removeNode)(a.root, i.id));
            a.components = a.components.filter(c => c.id !== cmp.id);
            this.selection = undefined;
        });
    }
    addInstance(componentId, parentId) {
        const cmp = this.component(componentId);
        if (!cmp) {
            this.messageService.warn('Déclarez puis choisissez d\'abord un composant à instancier.');
            return;
        }
        this.mutate(app => {
            const found = parentId ? (0, proto_model_1.findNode)(app.root, parentId) : undefined;
            const parent = (found === null || found === void 0 ? void 0 : found.kind) === 'folder' ? found : this.targetFolder(app);
            const instance = {
                kind: 'instance', id: (0, proto_model_1.newId)('inst'), componentId: cmp.id, values: {},
                name: (0, proto_model_1.uniqueName)(lowerFirst(cmp.name), parent.children.map(c => c.name))
            };
            parent.children.push(instance);
            this.expanded.add(parent.id);
            this.selection = { kind: 'node', id: instance.id };
        });
    }
    async deleteNode(nodeId) {
        const app = this.app;
        const node = (0, proto_model_1.findNode)(app.root, nodeId);
        if (!node || node.id === app.root.id) {
            return;
        }
        if (node.kind === 'folder' && node.children.length) {
            const count = [...(0, proto_model_1.walk)(node)].length - 1;
            const confirmed = await new dialogs_1.ConfirmDialog({
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
            const parent = (0, proto_model_1.findParent)(a.root, nodeId);
            (0, proto_model_1.removeNode)(a.root, nodeId);
            this.selection = parent ? { kind: 'node', id: parent.id } : undefined;
        });
    }
    toggle(id) {
        if (this.expanded.has(id)) {
            this.expanded.delete(id);
        }
        else {
            this.expanded.add(id);
        }
        this.update();
    }
    /** Valide un nom : non vide et unique parmi `siblings`. Affiche un avertissement sinon. */
    validName(name, siblings, what) {
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
    render() {
        if (this.loadError) {
            return React.createElement("div", { className: 'proto-message proto-error' },
                React.createElement("h3", null, "Impossible de lire l'application"),
                React.createElement("p", null, this.loadError),
                React.createElement("button", { className: 'theia-button', onClick: () => this.load() }, "R\u00E9essayer"));
        }
        const app = this.app;
        if (!app) {
            return React.createElement("div", { className: 'proto-message' }, "Chargement\u2026");
        }
        const instanceCount = [...(0, proto_model_1.walk)(app.root)].filter(n => n.kind === 'instance').length;
        return React.createElement("div", { className: 'proto-editor' },
            React.createElement("header", { className: 'proto-header' },
                React.createElement("span", { className: 'codicon codicon-symbol-structure' }),
                React.createElement(CommitInput, { className: 'proto-app-name', value: app.name, title: 'Nom de l\'application', onCommit: v => !!v.trim() && (this.mutate(a => { a.name = v; a.root.name = v; }), true) }),
                React.createElement("span", { className: 'proto-stats' },
                    app.components.length,
                    " composant(s) \u00B7 ",
                    instanceCount,
                    " instance(s)"),
                React.createElement("span", { className: 'proto-spacer' }),
                this._dirty && React.createElement("span", { className: 'proto-dirty' }, "\u25CF modifi\u00E9"),
                React.createElement("button", { className: 'theia-button', disabled: !this._dirty, title: 'Enregistrer (Ctrl+S)', onClick: () => this.save() }, "Enregistrer")),
            React.createElement("div", { className: 'proto-columns' },
                this.renderComponents(app),
                this.renderTree(app),
                this.renderDetails(app)));
    }
    // --- Colonne 1 : déclarations de composants
    renderComponents(app) {
        return React.createElement("section", { className: 'proto-panel' },
            React.createElement("div", { className: 'proto-panel-title' },
                React.createElement("span", null, "Composants"),
                React.createElement("button", { className: 'proto-icon-button codicon codicon-add', title: 'D\u00E9clarer un composant', onClick: this.addComponent })),
            React.createElement("div", { className: 'proto-panel-body' },
                app.components.length === 0 && React.createElement("div", { className: 'proto-hint' }, "Aucun composant. Cliquez sur + pour en d\u00E9clarer un."),
                app.components.map(cmp => {
                    var _a;
                    const selected = ((_a = this.selection) === null || _a === void 0 ? void 0 : _a.kind) === 'component' && this.selection.id === cmp.id;
                    return React.createElement("div", { key: cmp.id, className: `proto-row ${selected ? 'selected' : ''}`, draggable: true, title: 'Glissez dans l\'arborescence pour cr\u00E9er une instance', onDragStart: e => { e.dataTransfer.setData(DND_COMPONENT, cmp.id); e.dataTransfer.effectAllowed = 'copy'; }, onClick: () => this.select({ kind: 'component', id: cmp.id }) },
                        React.createElement("span", { className: 'codicon codicon-symbol-class proto-cmp-icon' }),
                        React.createElement("span", { className: 'proto-row-label' }, cmp.name),
                        React.createElement("span", { className: 'proto-badge', title: 'propri\u00E9t\u00E9s / instances' },
                            cmp.properties.length,
                            " \u00B7 ",
                            (0, proto_model_1.instancesOf)(app.root, cmp.id).length));
                })));
    }
    // --- Colonne 2 : arborescence d'instances
    renderTree(app) {
        var _a, _b, _c;
        const selectedNode = ((_a = this.selection) === null || _a === void 0 ? void 0 : _a.kind) === 'node' ? (0, proto_model_1.findNode)(app.root, this.selection.id) : undefined;
        const instanceCmp = (_b = this.component(this.instanceComponentId)) !== null && _b !== void 0 ? _b : app.components[0];
        return React.createElement("section", { className: 'proto-panel proto-tree-panel' },
            React.createElement("div", { className: 'proto-panel-title' },
                React.createElement("span", null, "Arborescence"),
                React.createElement("button", { className: 'proto-icon-button codicon codicon-new-folder', title: 'Nouveau (sous-)r\u00E9pertoire', onClick: this.addFolder }),
                React.createElement("button", { className: 'proto-icon-button codicon codicon-trash', title: 'Supprimer (Suppr)', disabled: !selectedNode || selectedNode.id === app.root.id, onClick: () => selectedNode && this.deleteNode(selectedNode.id) })),
            React.createElement("div", { className: 'proto-toolbar' },
                React.createElement("select", { className: 'theia-select', value: (_c = instanceCmp === null || instanceCmp === void 0 ? void 0 : instanceCmp.id) !== null && _c !== void 0 ? _c : '', disabled: !app.components.length, onChange: e => { this.instanceComponentId = e.target.value; this.update(); } },
                    !app.components.length && React.createElement("option", { value: '' }, "\u2014 aucun composant \u2014"),
                    app.components.map(c => React.createElement("option", { key: c.id, value: c.id }, c.name))),
                React.createElement("button", { className: 'theia-button secondary', disabled: !instanceCmp, onClick: () => this.addInstance(instanceCmp === null || instanceCmp === void 0 ? void 0 : instanceCmp.id) }, "+ Instance")),
            React.createElement("div", { className: 'proto-panel-body proto-tree', tabIndex: 0, onKeyDown: e => this.onTreeKey(e, app) }, this.renderNode(app, app.root, 0)));
    }
    onTreeKey(e, app) {
        var _a;
        if (e.key === 'Delete' && ((_a = this.selection) === null || _a === void 0 ? void 0 : _a.kind) === 'node' && this.selection.id !== app.root.id) {
            e.preventDefault();
            this.deleteNode(this.selection.id);
        }
    }
    renderNode(app, node, depth) {
        var _a;
        const selected = ((_a = this.selection) === null || _a === void 0 ? void 0 : _a.kind) === 'node' && this.selection.id === node.id;
        const isFolder = node.kind === 'folder';
        const expanded = isFolder && this.expanded.has(node.id);
        const isRoot = node.id === app.root.id;
        const cmp = node.kind === 'instance' ? this.component(node.componentId) : undefined;
        const icon = isFolder ? (isRoot ? 'codicon-root-folder' : expanded ? 'codicon-folder-opened' : 'codicon-folder')
            : 'codicon-symbol-field';
        const classes = ['proto-row', selected ? 'selected' : '', this.dropTargetId === node.id ? 'drop-target' : ''].join(' ');
        const dropHandlers = isFolder ? {
            onDragOver: (e) => {
                if (e.dataTransfer.types.includes(DND_NODE) || e.dataTransfer.types.includes(DND_COMPONENT)) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (this.dropTargetId !== node.id) {
                        this.dropTargetId = node.id;
                        this.update();
                    }
                }
            },
            onDragLeave: () => { if (this.dropTargetId === node.id) {
                this.dropTargetId = undefined;
                this.update();
            } },
            onDrop: (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.dropTargetId = undefined;
                const nodeId = e.dataTransfer.getData(DND_NODE);
                const componentId = e.dataTransfer.getData(DND_COMPONENT);
                if (componentId) {
                    this.addInstance(componentId, node.id);
                }
                else if (nodeId) {
                    let moved = false;
                    this.mutate(a => { moved = (0, proto_model_1.moveNode)(a.root, nodeId, node.id); });
                    if (moved) {
                        this.expanded.add(node.id);
                        this.update();
                    }
                }
                else {
                    this.update();
                }
            }
        } : {};
        return React.createElement(React.Fragment, { key: node.id },
            React.createElement("div", { className: classes, style: { paddingLeft: 6 + depth * 14 }, draggable: !isRoot, onDragStart: e => { e.stopPropagation(); e.dataTransfer.setData(DND_NODE, node.id); e.dataTransfer.effectAllowed = 'move'; }, onDragEnd: () => { if (this.dropTargetId) {
                    this.dropTargetId = undefined;
                    this.update();
                } }, onClick: () => this.select({ kind: 'node', id: node.id }), onDoubleClick: () => isFolder && this.toggle(node.id), ...dropHandlers },
                React.createElement("span", { className: `proto-twisty codicon ${isFolder && node.children.length ? (expanded ? 'codicon-chevron-down' : 'codicon-chevron-right') : ''}`, onClick: e => { e.stopPropagation(); if (isFolder) {
                        this.toggle(node.id);
                    } } }),
                React.createElement("span", { className: `codicon ${icon} ${isFolder ? 'proto-folder-icon' : 'proto-inst-icon'}` }),
                React.createElement("span", { className: 'proto-row-label' }, node.name),
                node.kind === 'instance' &&
                    React.createElement("span", { className: `proto-row-detail ${cmp ? '' : 'proto-missing'}` }, cmp ? cmp.name : 'composant introuvable')),
            expanded && node.kind === 'folder' && node.children.map(child => this.renderNode(app, child, depth + 1)));
    }
    // --- Colonne 3 : propriétés de l'élément sélectionné
    renderDetails(app) {
        var _a, _b;
        let body = React.createElement("div", { className: 'proto-hint' }, "S\u00E9lectionnez un composant ou un \u00E9l\u00E9ment de l'arborescence.");
        let title = 'Propriétés';
        if (((_a = this.selection) === null || _a === void 0 ? void 0 : _a.kind) === 'component') {
            const cmp = this.component(this.selection.id);
            if (cmp) {
                title = `Composant « ${cmp.name} »`;
                body = this.renderComponentDetails(app, cmp);
            }
        }
        else if (((_b = this.selection) === null || _b === void 0 ? void 0 : _b.kind) === 'node') {
            const node = (0, proto_model_1.findNode)(app.root, this.selection.id);
            if ((node === null || node === void 0 ? void 0 : node.kind) === 'folder') {
                title = node.id === app.root.id ? 'Racine' : `Répertoire « ${node.name} »`;
                body = this.renderFolderDetails(app, node);
            }
            else if ((node === null || node === void 0 ? void 0 : node.kind) === 'instance') {
                title = `Instance « ${node.name} »`;
                body = this.renderInstanceDetails(app, node);
            }
        }
        return React.createElement("section", { className: 'proto-panel proto-details' },
            React.createElement("div", { className: 'proto-panel-title' },
                React.createElement("span", null, title)),
            React.createElement("div", { className: 'proto-panel-body proto-form' }, body));
    }
    renderComponentDetails(app, cmp) {
        var _a;
        const otherNames = app.components.filter(c => c.id !== cmp.id).map(c => c.name);
        return React.createElement(React.Fragment, null,
            React.createElement("label", { className: 'proto-field' },
                React.createElement("span", null, "Nom"),
                React.createElement(CommitInput, { key: cmp.id, value: cmp.name, onCommit: v => this.validName(v, otherNames, 'du composant') && (this.mutate(() => { cmp.name = v; }), true) })),
            React.createElement("label", { className: 'proto-field' },
                React.createElement("span", null, "Description"),
                React.createElement("textarea", { className: 'theia-input', rows: 2, value: (_a = cmp.description) !== null && _a !== void 0 ? _a : '', onChange: e => this.mutate(() => { cmp.description = e.target.value || undefined; }) })),
            React.createElement("div", { className: 'proto-subtitle' },
                React.createElement("span", null, "Propri\u00E9t\u00E9s d\u00E9clar\u00E9es"),
                React.createElement("button", { className: 'theia-button secondary', onClick: () => this.mutate(() => {
                        cmp.properties.push({
                            name: (0, proto_model_1.uniqueName)('propriete', cmp.properties.map(p => p.name)),
                            type: 'string', defaultValue: ''
                        });
                    }) }, "+ Propri\u00E9t\u00E9")),
            cmp.properties.length === 0
                ? React.createElement("div", { className: 'proto-hint' }, "Aucune propri\u00E9t\u00E9.")
                : React.createElement("table", { className: 'proto-props-table' },
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null, "Nom"),
                            React.createElement("th", null, "Type"),
                            React.createElement("th", null, "Valeur par d\u00E9faut"),
                            React.createElement("th", null))),
                    React.createElement("tbody", null, cmp.properties.map((p, i) => this.renderPropertyDeclaration(app, cmp, p, i)))),
            React.createElement("div", { className: 'proto-actions' },
                React.createElement("button", { className: 'theia-button secondary', onClick: () => this.addInstance(cmp.id) }, "Instancier"),
                React.createElement("button", { className: 'theia-button proto-danger', onClick: () => this.deleteComponent(cmp) }, "Supprimer le composant")));
    }
    renderPropertyDeclaration(app, cmp, prop, index) {
        var _a;
        const others = cmp.properties.filter(p => p !== prop).map(p => p.name);
        const move = (delta) => this.mutate(() => {
            const [p] = cmp.properties.splice(index, 1);
            cmp.properties.splice(index + delta, 0, p);
        });
        return React.createElement(React.Fragment, { key: `${cmp.id}:${index}` },
            React.createElement("tr", null,
                React.createElement("td", null,
                    React.createElement(CommitInput, { value: prop.name, onCommit: v => {
                            if (v === prop.name) {
                                return true;
                            }
                            if (!this.validName(v, others, 'de la propriété')) {
                                return false;
                            }
                            this.mutate(a => { (0, proto_model_1.renamePropertyInInstances)(a.root, cmp.id, prop.name, v); prop.name = v; });
                            return true;
                        } })),
                React.createElement("td", null,
                    React.createElement("select", { className: 'theia-select', value: prop.type, onChange: e => this.mutate(a => {
                            var _a;
                            prop.type = e.target.value;
                            if (prop.type === 'enum' && !((_a = prop.options) === null || _a === void 0 ? void 0 : _a.length)) {
                                prop.options = ['option1', 'option2'];
                            }
                            if (prop.type !== 'enum') {
                                delete prop.options;
                            }
                            prop.defaultValue = (0, proto_model_1.coerceValue)(prop, prop.defaultValue === '' ? (0, proto_model_1.initialDefault)(prop.type, prop.options) : prop.defaultValue);
                            coerceInstanceValues(a, cmp, prop);
                        }) }, proto_model_1.PROPERTY_TYPES.map(t => React.createElement("option", { key: t, value: t }, PROPERTY_TYPE_LABELS[t])))),
                React.createElement("td", null,
                    React.createElement(ValueEditor, { prop: prop, value: prop.defaultValue, onChange: v => this.mutate(() => { prop.defaultValue = v; }) })),
                React.createElement("td", { className: 'proto-row-buttons' },
                    React.createElement("button", { className: 'proto-icon-button codicon codicon-arrow-up', title: 'Monter', disabled: index === 0, onClick: () => move(-1) }),
                    React.createElement("button", { className: 'proto-icon-button codicon codicon-arrow-down', title: 'Descendre', disabled: index === cmp.properties.length - 1, onClick: () => move(1) }),
                    React.createElement("button", { className: 'proto-icon-button codicon codicon-close', title: 'Supprimer la propri\u00E9t\u00E9', onClick: () => this.mutate(a => {
                            cmp.properties.splice(index, 1);
                            (0, proto_model_1.removePropertyFromInstances)(a.root, cmp.id, prop.name);
                        }) }))),
            prop.type === 'enum' && React.createElement("tr", { className: 'proto-enum-row' },
                React.createElement("td", { colSpan: 4 },
                    React.createElement("label", { className: 'proto-inline-field' },
                        React.createElement("span", null, "Valeurs possibles (s\u00E9par\u00E9es par des virgules)"),
                        React.createElement(CommitInput, { value: ((_a = prop.options) !== null && _a !== void 0 ? _a : []).join(', '), onCommit: v => {
                                const options = [...new Set(v.split(',').map(s => s.trim()).filter(s => s))];
                                if (!options.length) {
                                    this.messageService.warn('Une énumération doit avoir au moins une valeur.');
                                    return false;
                                }
                                this.mutate(a => {
                                    prop.options = options;
                                    prop.defaultValue = (0, proto_model_1.coerceValue)(prop, prop.defaultValue);
                                    coerceInstanceValues(a, cmp, prop);
                                });
                                return true;
                            } })))));
    }
    renderFolderDetails(app, folder) {
        var _a;
        const isRoot = folder.id === app.root.id;
        const parent = (0, proto_model_1.findParent)(app.root, folder.id);
        const siblings = ((_a = parent === null || parent === void 0 ? void 0 : parent.children) !== null && _a !== void 0 ? _a : []).filter(c => c.id !== folder.id).map(c => c.name);
        const descendants = [...(0, proto_model_1.walk)(folder)].slice(1);
        return React.createElement(React.Fragment, null,
            !isRoot && React.createElement("label", { className: 'proto-field' },
                React.createElement("span", null, "Nom"),
                React.createElement(CommitInput, { key: folder.id, value: folder.name, onCommit: v => this.validName(v, siblings, 'du répertoire') && (this.mutate(() => { folder.name = v; }), true) })),
            React.createElement("div", { className: 'proto-field' },
                React.createElement("span", null, "Chemin"),
                React.createElement("code", null,
                    "/",
                    (0, proto_model_1.nodePath)(app.root, folder.id))),
            React.createElement("div", { className: 'proto-field' },
                React.createElement("span", null, "Contenu"),
                React.createElement("span", null,
                    descendants.filter(n => n.kind === 'folder').length,
                    " sous-r\u00E9pertoire(s), ",
                    descendants.filter(n => n.kind === 'instance').length,
                    " instance(s)")),
            React.createElement("div", { className: 'proto-actions' },
                React.createElement("button", { className: 'theia-button secondary', onClick: this.addFolder }, "+ Sous-r\u00E9pertoire"),
                !isRoot && React.createElement("button", { className: 'theia-button proto-danger', onClick: () => this.deleteNode(folder.id) }, "Supprimer")));
    }
    renderInstanceDetails(app, instance) {
        var _a;
        const cmp = this.component(instance.componentId);
        const parent = (0, proto_model_1.findParent)(app.root, instance.id);
        const siblings = ((_a = parent === null || parent === void 0 ? void 0 : parent.children) !== null && _a !== void 0 ? _a : []).filter(c => c.id !== instance.id).map(c => c.name);
        return React.createElement(React.Fragment, null,
            React.createElement("label", { className: 'proto-field' },
                React.createElement("span", null, "Nom"),
                React.createElement(CommitInput, { key: instance.id, value: instance.name, onCommit: v => this.validName(v, siblings, 'de l\'instance') && (this.mutate(() => { instance.name = v; }), true) })),
            React.createElement("div", { className: 'proto-field' },
                React.createElement("span", null, "Chemin"),
                React.createElement("code", null,
                    "/",
                    (0, proto_model_1.nodePath)(app.root, instance.id))),
            React.createElement("label", { className: 'proto-field' },
                React.createElement("span", null, "Composant"),
                React.createElement("select", { className: 'theia-select', value: cmp ? cmp.id : '', onChange: e => this.mutate(() => {
                        instance.componentId = e.target.value;
                        instance.values = {};
                    }) },
                    !cmp && React.createElement("option", { value: '' },
                        "\u2014 introuvable (",
                        instance.componentId,
                        ") \u2014"),
                    app.components.map(c => React.createElement("option", { key: c.id, value: c.id }, c.name)))),
            cmp && React.createElement(React.Fragment, null,
                React.createElement("div", { className: 'proto-subtitle' },
                    React.createElement("span", null, "Valeurs des propri\u00E9t\u00E9s")),
                cmp.properties.length === 0 && React.createElement("div", { className: 'proto-hint' },
                    "Le composant \u00AB ",
                    cmp.name,
                    " \u00BB ne d\u00E9clare aucune propri\u00E9t\u00E9."),
                cmp.properties.map(prop => {
                    const { value, isDefault } = (0, proto_model_1.effectiveValue)(instance, prop);
                    return React.createElement("div", { key: prop.name, className: 'proto-field proto-value-field' },
                        React.createElement("span", { title: PROPERTY_TYPE_LABELS[prop.type] }, prop.name),
                        React.createElement(ValueEditor, { prop: prop, value: value, className: isDefault ? 'proto-default-value' : '', onChange: v => this.mutate(() => { instance.values[prop.name] = v; }) }),
                        React.createElement("button", { className: 'proto-icon-button codicon codicon-discard', disabled: isDefault, title: isDefault ? 'Valeur par défaut' : 'Revenir à la valeur par défaut', onClick: () => this.mutate(() => { delete instance.values[prop.name]; }) }));
                })),
            React.createElement("div", { className: 'proto-actions' },
                cmp && React.createElement("button", { className: 'theia-button secondary', onClick: () => this.select({ kind: 'component', id: cmp.id }) }, "Voir le composant"),
                React.createElement("button", { className: 'theia-button proto-danger', onClick: () => this.deleteNode(instance.id) }, "Supprimer")));
    }
};
exports.ProtoAppEditorWidget = ProtoAppEditorWidget;
ProtoAppEditorWidget.ID = 'proto-app-editor';
__decorate([
    (0, inversify_1.inject)(exports.ProtoAppEditorOptions),
    __metadata("design:type", Object)
], ProtoAppEditorWidget.prototype, "options", void 0);
__decorate([
    (0, inversify_1.inject)(file_service_1.FileService),
    __metadata("design:type", file_service_1.FileService)
], ProtoAppEditorWidget.prototype, "fileService", void 0);
__decorate([
    (0, inversify_1.inject)(common_1.MessageService),
    __metadata("design:type", common_1.MessageService)
], ProtoAppEditorWidget.prototype, "messageService", void 0);
__decorate([
    (0, inversify_1.postConstruct)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProtoAppEditorWidget.prototype, "init", null);
exports.ProtoAppEditorWidget = ProtoAppEditorWidget = ProtoAppEditorWidget_1 = __decorate([
    (0, inversify_1.injectable)()
], ProtoAppEditorWidget);
function lowerFirst(s) {
    return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}
function coerceInstanceValues(app, cmp, prop) {
    for (const inst of (0, proto_model_1.instancesOf)(app.root, cmp.id)) {
        if (Object.prototype.hasOwnProperty.call(inst.values, prop.name)) {
            inst.values[prop.name] = (0, proto_model_1.coerceValue)(prop, inst.values[prop.name]);
        }
    }
}
/** Champ texte validé à la perte de focus ou sur Entrée (Échap annule). */
function CommitInput(props) {
    var _a;
    const [draft, setDraft] = React.useState(props.value);
    React.useEffect(() => setDraft(props.value), [props.value]);
    const commit = () => {
        const v = draft.trim();
        if (v === props.value) {
            setDraft(props.value);
        }
        else if (!props.onCommit(v)) {
            setDraft(props.value);
        }
    };
    return React.createElement("input", { className: `theia-input ${(_a = props.className) !== null && _a !== void 0 ? _a : ''}`, title: props.title, value: draft, onChange: e => setDraft(e.target.value), onBlur: commit, onKeyDown: e => {
            if (e.key === 'Enter') {
                e.target.blur();
            }
            if (e.key === 'Escape') {
                setDraft(props.value);
            }
        } });
}
/** Éditeur de valeur adapté au type de la propriété. */
function ValueEditor({ prop, value, onChange, className }) {
    var _a;
    switch (prop.type) {
        case 'boolean':
            return React.createElement("input", { type: 'checkbox', className: className, checked: value === true, onChange: e => onChange(e.target.checked) });
        case 'number':
            return React.createElement("input", { type: 'number', className: `theia-input ${className !== null && className !== void 0 ? className : ''}`, value: String(value), onChange: e => onChange(e.target.value === '' ? 0 : (0, proto_model_1.coerceValue)(prop, e.target.value)) });
        case 'enum':
            return React.createElement("select", { className: `theia-select ${className !== null && className !== void 0 ? className : ''}`, value: String(value), onChange: e => onChange(e.target.value) }, ((_a = prop.options) !== null && _a !== void 0 ? _a : []).map(o => React.createElement("option", { key: o, value: o }, o)));
        default:
            return React.createElement("input", { type: 'text', className: `theia-input ${className !== null && className !== void 0 ? className : ''}`, value: String(value), onChange: e => onChange(e.target.value) });
    }
}
//# sourceMappingURL=proto-app-editor-widget.js.map