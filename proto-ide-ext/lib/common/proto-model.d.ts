/**
 * Modèle d'une application ProtoIDE (fichier *.protoapp, JSON).
 *
 *  - `components` : déclarations de composants (types) avec leurs propriétés.
 *  - `root`       : arborescence de répertoires / sous-répertoires contenant
 *                   des instances de composants.
 */
export declare const PROTO_APP_EXTENSION = ".protoapp";
export declare const PROTO_APP_FORMAT_VERSION = 1;
export type PropertyType = 'string' | 'number' | 'boolean' | 'enum';
export declare const PROPERTY_TYPES: PropertyType[];
export type PropertyValue = string | number | boolean;
export interface PropertyDeclaration {
    name: string;
    type: PropertyType;
    defaultValue: PropertyValue;
    /** Valeurs possibles, uniquement pour le type `enum`. */
    options?: string[];
    description?: string;
}
export interface ComponentDeclaration {
    id: string;
    name: string;
    description?: string;
    properties: PropertyDeclaration[];
}
export interface FolderNode {
    kind: 'folder';
    id: string;
    name: string;
    children: TreeNode[];
}
export interface InstanceNode {
    kind: 'instance';
    id: string;
    name: string;
    componentId: string;
    values: {
        [propertyName: string]: PropertyValue;
    };
}
export type TreeNode = FolderNode | InstanceNode;
export interface ProtoApplication {
    formatVersion: number;
    name: string;
    components: ComponentDeclaration[];
    root: FolderNode;
}
export declare function newId(prefix: string): string;
export declare function createEmptyApplication(name: string): ProtoApplication;
export declare function serializeApplication(app: ProtoApplication): string;
export declare class ProtoParseError extends Error {
}
/** Lit et valide le contenu d'un fichier .protoapp. Un fichier vide donne une application vide. */
export declare function parseApplication(content: string, fallbackName: string): ProtoApplication;
export declare function initialDefault(type: PropertyType, options?: string[]): PropertyValue;
/** Convertit une valeur quelconque vers le type de la propriété. */
export declare function coerceValue(prop: PropertyDeclaration, value: unknown): PropertyValue;
/** Valeur effective d'une propriété pour une instance (valeur saisie ou valeur par défaut). */
export declare function effectiveValue(instance: InstanceNode, prop: PropertyDeclaration): {
    value: PropertyValue;
    isDefault: boolean;
};
export declare function walk(node: TreeNode): IterableIterator<TreeNode>;
export declare function findNode(root: FolderNode, id: string): TreeNode | undefined;
export declare function findParent(root: FolderNode, id: string): FolderNode | undefined;
/** Chemin lisible d'un nœud : "dossier/sous-dossier/instance". */
export declare function nodePath(root: FolderNode, id: string): string;
export declare function instancesOf(root: FolderNode, componentId: string): InstanceNode[];
/** Vrai si `candidateId` est `ancestorId` lui-même ou l'un de ses descendants. */
export declare function isSelfOrDescendant(root: FolderNode, ancestorId: string, candidateId: string): boolean;
/** Déplace un nœud dans un autre dossier. Retourne false si le déplacement est impossible. */
export declare function moveNode(root: FolderNode, nodeId: string, targetFolderId: string): boolean;
export declare function removeNode(root: FolderNode, nodeId: string): boolean;
/** Nom unique parmi des frères : "Bouton", "Bouton2", "Bouton3"... */
export declare function uniqueName(base: string, existing: string[]): string;
/** Répercute le renommage d'une propriété sur toutes les instances du composant. */
export declare function renamePropertyInInstances(root: FolderNode, componentId: string, oldName: string, newName: string): void;
/** Supprime la valeur d'une propriété dans toutes les instances du composant. */
export declare function removePropertyFromInstances(root: FolderNode, componentId: string, name: string): void;
//# sourceMappingURL=proto-model.d.ts.map