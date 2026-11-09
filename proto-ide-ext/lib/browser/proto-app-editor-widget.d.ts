/// <reference types="react" />
import * as React from '@theia/core/shared/react';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { NavigatableWidget } from '@theia/core/lib/browser/navigatable-types';
import { Saveable, SaveableSource } from '@theia/core/lib/browser/saveable';
import { Emitter, MessageService } from '@theia/core/lib/common';
import URI from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { ComponentDeclaration, FolderNode, InstanceNode, PropertyDeclaration, ProtoApplication, TreeNode } from '../common/proto-model';
export declare const ProtoAppEditorOptions: unique symbol;
export interface ProtoAppEditorOptions {
    uri: string;
}
type Selection = {
    kind: 'component';
    id: string;
} | {
    kind: 'node';
    id: string;
} | undefined;
export declare class ProtoAppEditorWidget extends ReactWidget implements NavigatableWidget, SaveableSource {
    static readonly ID = "proto-app-editor";
    protected readonly options: ProtoAppEditorOptions;
    protected readonly fileService: FileService;
    protected readonly messageService: MessageService;
    readonly saveable: Saveable;
    protected uri: URI;
    protected app: ProtoApplication | undefined;
    protected loadError: string | undefined;
    protected selection: Selection;
    protected readonly expanded: Set<string>;
    protected instanceComponentId: string | undefined;
    protected dropTargetId: string | undefined;
    protected _dirty: boolean;
    protected readonly onDirtyChangedEmitter: Emitter<void>;
    protected readonly onContentChangedEmitter: Emitter<void>;
    protected init(): void;
    getResourceUri(): URI | undefined;
    createMoveToUri(resourceUri: URI): URI | undefined;
    protected load(): Promise<void>;
    save(): Promise<void>;
    protected createSaveable(): Saveable;
    protected setDirty(dirty: boolean): void;
    /** Applique une modification au modèle puis rafraîchit la vue. */
    protected mutate(change: (app: ProtoApplication) => void): void;
    protected onActivateRequest(msg: Message): void;
    protected select(selection: Selection): void;
    protected component(id: string | undefined): ComponentDeclaration | undefined;
    /** Dossier cible pour une insertion : dossier sélectionné, parent de l'instance sélectionnée, ou racine. */
    protected targetFolder(app: ProtoApplication): FolderNode;
    protected addComponent: () => void;
    protected deleteComponent(cmp: ComponentDeclaration): Promise<void>;
    protected addFolder: () => void;
    protected addInstance(componentId: string | undefined, parentId?: string): void;
    protected deleteNode(nodeId: string): Promise<void>;
    protected toggle(id: string): void;
    /** Valide un nom : non vide et unique parmi `siblings`. Affiche un avertissement sinon. */
    protected validName(name: string, siblings: string[], what: string): boolean;
    protected render(): React.ReactNode;
    protected renderComponents(app: ProtoApplication): React.ReactNode;
    protected renderTree(app: ProtoApplication): React.ReactNode;
    protected onTreeKey(e: React.KeyboardEvent, app: ProtoApplication): void;
    protected renderNode(app: ProtoApplication, node: TreeNode, depth: number): React.ReactNode;
    protected renderDetails(app: ProtoApplication): React.ReactNode;
    protected renderComponentDetails(app: ProtoApplication, cmp: ComponentDeclaration): React.ReactNode;
    protected renderPropertyDeclaration(app: ProtoApplication, cmp: ComponentDeclaration, prop: PropertyDeclaration, index: number): React.ReactNode;
    protected renderFolderDetails(app: ProtoApplication, folder: FolderNode): React.ReactNode;
    protected renderInstanceDetails(app: ProtoApplication, instance: InstanceNode): React.ReactNode;
}
export {};
//# sourceMappingURL=proto-app-editor-widget.d.ts.map