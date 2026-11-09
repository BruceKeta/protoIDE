/**
 * Modèle d'une application ProtoIDE (fichier *.protoapp, JSON).
 *
 *  - `components` : déclarations de composants (types) avec leurs propriétés.
 *  - `root`       : arborescence de répertoires / sous-répertoires contenant
 *                   des instances de composants.
 */

export const PROTO_APP_EXTENSION = '.protoapp';
export const PROTO_APP_FORMAT_VERSION = 1;

export type PropertyType = 'string' | 'number' | 'boolean' | 'enum';
export const PROPERTY_TYPES: PropertyType[] = ['string', 'number', 'boolean', 'enum'];

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
    values: { [propertyName: string]: PropertyValue };
}

export type TreeNode = FolderNode | InstanceNode;

export interface ProtoApplication {
    formatVersion: number;
    name: string;
    components: ComponentDeclaration[];
    root: FolderNode;
}

// ---------------------------------------------------------------------------
// Création / sérialisation
// ---------------------------------------------------------------------------

export function newId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyApplication(name: string): ProtoApplication {
    return {
        formatVersion: PROTO_APP_FORMAT_VERSION,
        name,
        components: [],
        root: { kind: 'folder', id: 'root', name, children: [] }
    };
}

export function serializeApplication(app: ProtoApplication): string {
    return JSON.stringify(app, undefined, 2) + '\n';
}

export class ProtoParseError extends Error { }

/** Lit et valide le contenu d'un fichier .protoapp. Un fichier vide donne une application vide. */
export function parseApplication(content: string, fallbackName: string): ProtoApplication {
    if (!content.trim()) {
        return createEmptyApplication(fallbackName);
    }
    let raw: unknown;
    try {
        raw = JSON.parse(content);
    } catch (e) {
        throw new ProtoParseError(`JSON invalide : ${(e as Error).message}`);
    }
    if (!isObject(raw)) {
        throw new ProtoParseError('Le document doit être un objet JSON.');
    }
    const name = typeof raw.name === 'string' ? raw.name : fallbackName;
    const components = Array.isArray(raw.components) ? raw.components.map(parseComponent) : [];
    const root = isObject(raw.root) ? parseFolder(raw.root, 'root') : createEmptyApplication(name).root;
    root.id = 'root';
    return { formatVersion: PROTO_APP_FORMAT_VERSION, name, components, root };
}

function isObject(v: unknown): v is Record<string, any> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseComponent(raw: unknown, index: number): ComponentDeclaration {
    if (!isObject(raw) || typeof raw.name !== 'string') {
        throw new ProtoParseError(`Composant n°${index + 1} invalide (champ "name" manquant).`);
    }
    return {
        id: typeof raw.id === 'string' ? raw.id : newId('cmp'),
        name: raw.name,
        description: typeof raw.description === 'string' ? raw.description : undefined,
        properties: Array.isArray(raw.properties) ? raw.properties.map((p, i) => parseProperty(p, i, raw.name)) : []
    };
}

function parseProperty(raw: unknown, index: number, componentName: string): PropertyDeclaration {
    if (!isObject(raw) || typeof raw.name !== 'string') {
        throw new ProtoParseError(`Propriété n°${index + 1} du composant "${componentName}" invalide.`);
    }
    const type: PropertyType = PROPERTY_TYPES.includes(raw.type) ? raw.type : 'string';
    const options = type === 'enum' && Array.isArray(raw.options) ? raw.options.map(String) : undefined;
    const prop: PropertyDeclaration = { name: raw.name, type, defaultValue: '', options };
    prop.defaultValue = raw.defaultValue !== undefined ? coerceValue(prop, raw.defaultValue) : initialDefault(type, options);
    if (typeof raw.description === 'string') {
        prop.description = raw.description;
    }
    return prop;
}

function parseNode(raw: unknown): TreeNode {
    if (!isObject(raw)) {
        throw new ProtoParseError('Nœud d\'arborescence invalide.');
    }
    if (raw.kind === 'folder') {
        return parseFolder(raw, newId('dir'));
    }
    if (raw.kind === 'instance') {
        const values: InstanceNode['values'] = {};
        if (isObject(raw.values)) {
            for (const [k, v] of Object.entries(raw.values)) {
                if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
                    values[k] = v;
                }
            }
        }
        return {
            kind: 'instance',
            id: typeof raw.id === 'string' ? raw.id : newId('inst'),
            name: typeof raw.name === 'string' ? raw.name : 'instance',
            componentId: String(raw.componentId ?? ''),
            values
        };
    }
    throw new ProtoParseError(`Type de nœud inconnu : "${raw.kind}".`);
}

function parseFolder(raw: Record<string, any>, defaultId: string): FolderNode {
    return {
        kind: 'folder',
        id: typeof raw.id === 'string' ? raw.id : defaultId,
        name: typeof raw.name === 'string' ? raw.name : 'dossier',
        children: Array.isArray(raw.children) ? raw.children.map(parseNode) : []
    };
}

// ---------------------------------------------------------------------------
// Valeurs de propriétés
// ---------------------------------------------------------------------------

export function initialDefault(type: PropertyType, options?: string[]): PropertyValue {
    switch (type) {
        case 'number': return 0;
        case 'boolean': return false;
        case 'enum': return options?.[0] ?? '';
        default: return '';
    }
}

/** Convertit une valeur quelconque vers le type de la propriété. */
export function coerceValue(prop: PropertyDeclaration, value: unknown): PropertyValue {
    switch (prop.type) {
        case 'number': {
            const n = typeof value === 'number' ? value : parseFloat(String(value));
            return isNaN(n) ? 0 : n;
        }
        case 'boolean':
            return value === true || value === 'true';
        case 'enum': {
            const s = String(value ?? '');
            const options = prop.options ?? [];
            return options.includes(s) ? s : (options[0] ?? '');
        }
        default:
            return String(value ?? '');
    }
}

/** Valeur effective d'une propriété pour une instance (valeur saisie ou valeur par défaut). */
export function effectiveValue(instance: InstanceNode, prop: PropertyDeclaration): { value: PropertyValue, isDefault: boolean } {
    if (Object.prototype.hasOwnProperty.call(instance.values, prop.name)) {
        return { value: coerceValue(prop, instance.values[prop.name]), isDefault: false };
    }
    return { value: prop.defaultValue, isDefault: true };
}

// ---------------------------------------------------------------------------
// Parcours / manipulation de l'arborescence
// ---------------------------------------------------------------------------

export function* walk(node: TreeNode): IterableIterator<TreeNode> {
    yield node;
    if (node.kind === 'folder') {
        for (const child of node.children) {
            yield* walk(child);
        }
    }
}

export function findNode(root: FolderNode, id: string): TreeNode | undefined {
    for (const n of walk(root)) {
        if (n.id === id) {
            return n;
        }
    }
    return undefined;
}

export function findParent(root: FolderNode, id: string): FolderNode | undefined {
    for (const n of walk(root)) {
        if (n.kind === 'folder' && n.children.some(c => c.id === id)) {
            return n;
        }
    }
    return undefined;
}

/** Chemin lisible d'un nœud : "dossier/sous-dossier/instance". */
export function nodePath(root: FolderNode, id: string): string {
    const names: string[] = [];
    let current = findNode(root, id);
    while (current && current.id !== root.id) {
        names.unshift(current.name);
        current = findParent(root, current.id);
    }
    return names.join('/');
}

export function instancesOf(root: FolderNode, componentId: string): InstanceNode[] {
    return [...walk(root)].filter((n): n is InstanceNode => n.kind === 'instance' && n.componentId === componentId);
}

/** Vrai si `candidateId` est `ancestorId` lui-même ou l'un de ses descendants. */
export function isSelfOrDescendant(root: FolderNode, ancestorId: string, candidateId: string): boolean {
    const ancestor = findNode(root, ancestorId);
    return !!ancestor && [...walk(ancestor)].some(n => n.id === candidateId);
}

/** Déplace un nœud dans un autre dossier. Retourne false si le déplacement est impossible. */
export function moveNode(root: FolderNode, nodeId: string, targetFolderId: string): boolean {
    if (nodeId === root.id || isSelfOrDescendant(root, nodeId, targetFolderId)) {
        return false;
    }
    const target = findNode(root, targetFolderId);
    const parent = findParent(root, nodeId);
    if (!target || target.kind !== 'folder' || !parent || parent.id === target.id) {
        return false;
    }
    const index = parent.children.findIndex(c => c.id === nodeId);
    const [node] = parent.children.splice(index, 1);
    target.children.push(node);
    return true;
}

export function removeNode(root: FolderNode, nodeId: string): boolean {
    const parent = findParent(root, nodeId);
    if (!parent) {
        return false;
    }
    parent.children = parent.children.filter(c => c.id !== nodeId);
    return true;
}

/** Nom unique parmi des frères : "Bouton", "Bouton2", "Bouton3"... */
export function uniqueName(base: string, existing: string[]): string {
    if (!existing.includes(base)) {
        return base;
    }
    let i = 2;
    while (existing.includes(`${base}${i}`)) {
        i++;
    }
    return `${base}${i}`;
}

/** Répercute le renommage d'une propriété sur toutes les instances du composant. */
export function renamePropertyInInstances(root: FolderNode, componentId: string, oldName: string, newName: string): void {
    for (const inst of instancesOf(root, componentId)) {
        if (Object.prototype.hasOwnProperty.call(inst.values, oldName)) {
            inst.values[newName] = inst.values[oldName];
            delete inst.values[oldName];
        }
    }
}

/** Supprime la valeur d'une propriété dans toutes les instances du composant. */
export function removePropertyFromInstances(root: FolderNode, componentId: string, name: string): void {
    for (const inst of instancesOf(root, componentId)) {
        delete inst.values[name];
    }
}
