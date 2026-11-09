"use strict";
/**
 * Modèle d'une application ProtoIDE (fichier *.protoapp, JSON).
 *
 *  - `components` : déclarations de composants (types) avec leurs propriétés.
 *  - `root`       : arborescence de répertoires / sous-répertoires contenant
 *                   des instances de composants.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.removePropertyFromInstances = exports.renamePropertyInInstances = exports.uniqueName = exports.removeNode = exports.moveNode = exports.isSelfOrDescendant = exports.instancesOf = exports.nodePath = exports.findParent = exports.findNode = exports.walk = exports.effectiveValue = exports.coerceValue = exports.initialDefault = exports.parseApplication = exports.ProtoParseError = exports.serializeApplication = exports.createEmptyApplication = exports.newId = exports.PROPERTY_TYPES = exports.PROTO_APP_FORMAT_VERSION = exports.PROTO_APP_EXTENSION = void 0;
exports.PROTO_APP_EXTENSION = '.protoapp';
exports.PROTO_APP_FORMAT_VERSION = 1;
exports.PROPERTY_TYPES = ['string', 'number', 'boolean', 'enum'];
// ---------------------------------------------------------------------------
// Création / sérialisation
// ---------------------------------------------------------------------------
function newId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
exports.newId = newId;
function createEmptyApplication(name) {
    return {
        formatVersion: exports.PROTO_APP_FORMAT_VERSION,
        name,
        components: [],
        root: { kind: 'folder', id: 'root', name, children: [] }
    };
}
exports.createEmptyApplication = createEmptyApplication;
function serializeApplication(app) {
    return JSON.stringify(app, undefined, 2) + '\n';
}
exports.serializeApplication = serializeApplication;
class ProtoParseError extends Error {
}
exports.ProtoParseError = ProtoParseError;
/** Lit et valide le contenu d'un fichier .protoapp. Un fichier vide donne une application vide. */
function parseApplication(content, fallbackName) {
    if (!content.trim()) {
        return createEmptyApplication(fallbackName);
    }
    let raw;
    try {
        raw = JSON.parse(content);
    }
    catch (e) {
        throw new ProtoParseError(`JSON invalide : ${e.message}`);
    }
    if (!isObject(raw)) {
        throw new ProtoParseError('Le document doit être un objet JSON.');
    }
    const name = typeof raw.name === 'string' ? raw.name : fallbackName;
    const components = Array.isArray(raw.components) ? raw.components.map(parseComponent) : [];
    const root = isObject(raw.root) ? parseFolder(raw.root, 'root') : createEmptyApplication(name).root;
    root.id = 'root';
    return { formatVersion: exports.PROTO_APP_FORMAT_VERSION, name, components, root };
}
exports.parseApplication = parseApplication;
function isObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function parseComponent(raw, index) {
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
function parseProperty(raw, index, componentName) {
    if (!isObject(raw) || typeof raw.name !== 'string') {
        throw new ProtoParseError(`Propriété n°${index + 1} du composant "${componentName}" invalide.`);
    }
    const type = exports.PROPERTY_TYPES.includes(raw.type) ? raw.type : 'string';
    const options = type === 'enum' && Array.isArray(raw.options) ? raw.options.map(String) : undefined;
    const prop = { name: raw.name, type, defaultValue: '', options };
    prop.defaultValue = raw.defaultValue !== undefined ? coerceValue(prop, raw.defaultValue) : initialDefault(type, options);
    if (typeof raw.description === 'string') {
        prop.description = raw.description;
    }
    return prop;
}
function parseNode(raw) {
    var _a;
    if (!isObject(raw)) {
        throw new ProtoParseError('Nœud d\'arborescence invalide.');
    }
    if (raw.kind === 'folder') {
        return parseFolder(raw, newId('dir'));
    }
    if (raw.kind === 'instance') {
        const values = {};
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
            componentId: String((_a = raw.componentId) !== null && _a !== void 0 ? _a : ''),
            values
        };
    }
    throw new ProtoParseError(`Type de nœud inconnu : "${raw.kind}".`);
}
function parseFolder(raw, defaultId) {
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
function initialDefault(type, options) {
    var _a;
    switch (type) {
        case 'number': return 0;
        case 'boolean': return false;
        case 'enum': return (_a = options === null || options === void 0 ? void 0 : options[0]) !== null && _a !== void 0 ? _a : '';
        default: return '';
    }
}
exports.initialDefault = initialDefault;
/** Convertit une valeur quelconque vers le type de la propriété. */
function coerceValue(prop, value) {
    var _a, _b;
    switch (prop.type) {
        case 'number': {
            const n = typeof value === 'number' ? value : parseFloat(String(value));
            return isNaN(n) ? 0 : n;
        }
        case 'boolean':
            return value === true || value === 'true';
        case 'enum': {
            const s = String(value !== null && value !== void 0 ? value : '');
            const options = (_a = prop.options) !== null && _a !== void 0 ? _a : [];
            return options.includes(s) ? s : ((_b = options[0]) !== null && _b !== void 0 ? _b : '');
        }
        default:
            return String(value !== null && value !== void 0 ? value : '');
    }
}
exports.coerceValue = coerceValue;
/** Valeur effective d'une propriété pour une instance (valeur saisie ou valeur par défaut). */
function effectiveValue(instance, prop) {
    if (Object.prototype.hasOwnProperty.call(instance.values, prop.name)) {
        return { value: coerceValue(prop, instance.values[prop.name]), isDefault: false };
    }
    return { value: prop.defaultValue, isDefault: true };
}
exports.effectiveValue = effectiveValue;
// ---------------------------------------------------------------------------
// Parcours / manipulation de l'arborescence
// ---------------------------------------------------------------------------
function* walk(node) {
    yield node;
    if (node.kind === 'folder') {
        for (const child of node.children) {
            yield* walk(child);
        }
    }
}
exports.walk = walk;
function findNode(root, id) {
    for (const n of walk(root)) {
        if (n.id === id) {
            return n;
        }
    }
    return undefined;
}
exports.findNode = findNode;
function findParent(root, id) {
    for (const n of walk(root)) {
        if (n.kind === 'folder' && n.children.some(c => c.id === id)) {
            return n;
        }
    }
    return undefined;
}
exports.findParent = findParent;
/** Chemin lisible d'un nœud : "dossier/sous-dossier/instance". */
function nodePath(root, id) {
    const names = [];
    let current = findNode(root, id);
    while (current && current.id !== root.id) {
        names.unshift(current.name);
        current = findParent(root, current.id);
    }
    return names.join('/');
}
exports.nodePath = nodePath;
function instancesOf(root, componentId) {
    return [...walk(root)].filter((n) => n.kind === 'instance' && n.componentId === componentId);
}
exports.instancesOf = instancesOf;
/** Vrai si `candidateId` est `ancestorId` lui-même ou l'un de ses descendants. */
function isSelfOrDescendant(root, ancestorId, candidateId) {
    const ancestor = findNode(root, ancestorId);
    return !!ancestor && [...walk(ancestor)].some(n => n.id === candidateId);
}
exports.isSelfOrDescendant = isSelfOrDescendant;
/** Déplace un nœud dans un autre dossier. Retourne false si le déplacement est impossible. */
function moveNode(root, nodeId, targetFolderId) {
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
exports.moveNode = moveNode;
function removeNode(root, nodeId) {
    const parent = findParent(root, nodeId);
    if (!parent) {
        return false;
    }
    parent.children = parent.children.filter(c => c.id !== nodeId);
    return true;
}
exports.removeNode = removeNode;
/** Nom unique parmi des frères : "Bouton", "Bouton2", "Bouton3"... */
function uniqueName(base, existing) {
    if (!existing.includes(base)) {
        return base;
    }
    let i = 2;
    while (existing.includes(`${base}${i}`)) {
        i++;
    }
    return `${base}${i}`;
}
exports.uniqueName = uniqueName;
/** Répercute le renommage d'une propriété sur toutes les instances du composant. */
function renamePropertyInInstances(root, componentId, oldName, newName) {
    for (const inst of instancesOf(root, componentId)) {
        if (Object.prototype.hasOwnProperty.call(inst.values, oldName)) {
            inst.values[newName] = inst.values[oldName];
            delete inst.values[oldName];
        }
    }
}
exports.renamePropertyInInstances = renamePropertyInInstances;
/** Supprime la valeur d'une propriété dans toutes les instances du composant. */
function removePropertyFromInstances(root, componentId, name) {
    for (const inst of instancesOf(root, componentId)) {
        delete inst.values[name];
    }
}
exports.removePropertyFromInstances = removePropertyFromInstances;
//# sourceMappingURL=proto-model.js.map