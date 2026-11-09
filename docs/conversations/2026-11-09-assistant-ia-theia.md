# Ajouter un assistant IA à ProtoIDE (Theia AI)

Conversation avec Claude Code, 7 au 9 novembre 2026. Les messages de l'utilisateur sont reproduits tels quels ; les réponses sont reprises sans les appels d'outils intermédiaires (lecture du code, vérification de l'API de `@theia/ai-*` 1.76 dans les paquets npm).

Résultat concret : la skill [`.claude/skills/theia-ai/SKILL.md`](../../.claude/skills/theia-ai/SKILL.md), invocable par `/theia-ai`. Aucune modification du code de l'application n'a encore été faite.

---

## 1. Comment ajouter un chat IA ?

> **Utilisateur :** Comment ajouter un chat IA qui me permettrait par exemple de chercher/modifier/ajouter/supprimer/renommer des composants, instances ou propriété ?

### La bonne voie : Theia AI

Le projet tourne sur Theia 1.76, qui fournit déjà un framework de chat IA. Pas besoin de coder une interface de chat : on ajoute des paquets et on déclare **un agent** et **des outils**.

- `@theia/ai-core` et `@theia/ai-chat` : agents, outils, prompts
- `@theia/ai-chat-ui` : le panneau de chat
- `@theia/ai-anthropic` (ou `ai-openai`, `ai-ollama` pour un modèle local) : le fournisseur de modèle. La clé API se saisit dans les Préférences.

Le modèle ne modifie pas le JSON lui-même. Il appelle vos outils, et c'est votre code qui applique les changements.

### Architecture

```
Chat (@ProtoIDE "renomme tous les boutons en btnX")
   └─ ProtoChatAgent ── prompt système + liste d'outils
         └─ ToolProviders (proto_search, proto_rename, …)
               └─ ProtoAppService → widget .protoapp actif → widget.mutate(...)
```

**Le point clé : les outils passent par `mutate()` du widget ouvert**, sans écrire dans le fichier. On garde ainsi le point de modification sur l'onglet, Ctrl+S pour enregistrer, « Revert » pour annuler ce qu'a fait l'IA, et le rafraîchissement de l'affichage. Les règles existantes (renommer une propriété met à jour les instances, supprimer un composant supprime ses instances) s'appliquent aussi à l'IA.

1. **Rendre le widget pilotable** : dans `proto-app-editor-widget.tsx`, rendre publics `getApp()` et `applyChange(fn)` (qui appelle `mutate`). Extraire la logique métier des handlers UI vers des fonctions pures dans `proto-model.ts`, appelées par l'UI et par l'IA. Les `ConfirmDialog` restent côté UI ; côté IA, c'est la confirmation d'outil de Theia.
2. **`ProtoAppService`** : trouve l'éditeur `.protoapp` actif, ou à défaut le dernier ouvert (`ApplicationShell` / `WidgetManager.getWidgets(ProtoAppEditorWidget.ID)`).
3. **Les outils** : `ToolRequest { id, name, description, parameters (JSON Schema), handler(argString) }`, enregistrés avec `bindToolProvider`.

| Outil | Rôle |
|---|---|
| `proto_get_overview` | composants, propriétés et arbre avec leurs ids et chemins |
| `proto_search` | recherche par nom, type, composant ou valeur (texte ou regex) |
| `proto_add_component` / `proto_update_component` / `proto_delete_component` | ajouter, renommer, changer la description, supprimer un composant |
| `proto_add_property` / `proto_update_property` / `proto_delete_property` | ajouter ou modifier une propriété, avec répercussion sur les instances |
| `proto_add_folder` / `proto_add_instance` | créer un dossier ou une instance, avec un nom unique |
| `proto_rename_node` / `proto_move_node` / `proto_delete_node` | renommer, déplacer, supprimer un nœud |
| `proto_set_values` | modifier les valeurs d'instances, ou les remettre par défaut |

Pour les suppressions : `confirmAlwaysAllow: true`, l'utilisateur valide chaque suppression dans le chat.

```ts
@injectable()
export class RenameNodeTool implements ToolProvider {
    @inject(ProtoAppService) protected readonly apps: ProtoAppService;
    getTool(): ToolRequest {
        return {
            id: 'proto_rename_node', name: 'proto_rename_node', providerName: 'proto-ide',
            description: 'Renomme un dossier ou une instance (par id ou chemin "ecrans/connexion/champLogin").',
            parameters: { type: 'object', properties: {
                node: { type: 'string' }, newName: { type: 'string' } }, required: ['node', 'newName'] },
            handler: async args => {
                const { node, newName } = JSON.parse(args);
                return this.apps.withActiveApp(app => renameNode(app, node, newName));
            }
        };
    }
}
```

4. **L'agent** : `ProtoChatAgent extends AbstractStreamParsingChatAgent`, `id = 'ProtoIDE'`, prompt système en français qui décrit le modèle de données et référence les outils avec `~{proto_search}`, etc. Il doit toujours consulter `proto_get_overview` ou `proto_search` avant de modifier. Enregistré avec `bind(ChatAgent).toService(...)`.
5. **Câblage** : dépendances `@theia/ai-*@1.76.0` dans `proto-ide-ext` et `browser-app`, bindings dans `proto-ide-frontend-module.ts`, puis `yarn` et `yarn build`.

Exemple d'usage : *« @ProtoIDE ajoute une propriété couleur (enum rouge/vert) au Bouton et mets-la à vert sur boutonValider »*.

**Autre option écartée** : un serveur MCP, utilisable depuis Claude Code ou Claude Desktop. Il écrirait directement dans les fichiers, sans l'éditeur ouvert : on perdrait le point de modification et le retour arrière.

---

## 2. Le principe, simplement

> **Utilisateur :** il faut utiliser Theia AI. Avant de faire les modif explique moi simplement le principe et en particulier ce qu'il faut définir dans les widget/command ou autre

Avec Theia AI, on n'écrit **ni interface de chat ni appel au modèle**. On fournit trois choses :

1. **Des outils** : ce que l'IA a le droit de faire dans l'éditeur.
2. **Un agent** : un prompt qui lui explique son rôle et la liste des outils.
3. **Un accès au modèle** : un service qui donne aux outils l'application `.protoapp` ouverte.

```
Vous : "@ProtoIDE renomme champLogin en champIdentifiant"
  ▼
Theia AI envoie au modèle : prompt de l'agent + description des outils + votre message
  ▼
Le modèle : "appelle proto_search({texte:'champLogin'})"
  ▼
Theia exécute votre outil, renvoie le résultat au modèle
  ▼
Le modèle : "appelle proto_rename_node({node:'inst-login', newName:'champIdentifiant'})"
  ▼
Votre outil modifie le modèle via le widget → l'onglet passe en "modifié"
  ▼
Le modèle : "C'est fait." → affiché dans le chat
```

Le modèle **ne touche jamais au fichier** : il choisit un outil et ses arguments, votre code fait la modification.

| Élément | À faire |
|---|---|
| Widget éditeur | Ajouter `getApp()` et `applyChange()` publics (passent par `mutate()`) |
| `proto-model.ts` | Y sortir les opérations métier, partagées par l'interface et l'IA |
| `ProtoAppService` | Nouveau : trouve l'éditeur actif ; erreur claire si aucun fichier ouvert |
| Outils (`ToolProvider`) | Nouveaux : nom, description (lue par le modèle), paramètres JSON Schema, handler qui renvoie un résultat texte |
| Agent (`ChatAgent`) | Nouveau : id `ProtoIDE`, prompt système, liste des outils, type de modèle « chat » |
| Commandes/menus | Rien d'obligatoire : le chat est fourni par `@theia/ai-chat-ui` (option : commande « Demander à l'IA ») |
| Module frontend | Enregistrer service, outils (`bindToolProvider`) et agent |
| `package.json` | Ajouter les paquets `@theia/ai-*` 1.76.0 ; clé API dans Préférences → AI |

---

## 3. Comment savoir quels outils sont nécessaires ?

> **Utilisateur :** comment savoir quels sont les outils nécessaires

Les outils se déduisent du **modèle de données** et de **ce que l'utilisateur fait déjà à la main**.

**Étape 1 — Lister les objets du modèle** : composant, propriété, nœud (dossier ou instance), valeur d'instance.

**Étape 2 — Croiser objets et verbes** :

| | Chercher | Ajouter | Modifier / renommer | Supprimer |
|---|---|---|---|---|
| Composant | ✔ | ✔ | ✔ | ✔ |
| Propriété | ✔ | ✔ | ✔ | ✔ |
| Dossier / instance | ✔ | ✔ | ✔ (+ déplacer) | ✔ |
| Valeur d'instance | ✔ | — | ✔ (+ remettre par défaut) | — |

**Étape 3 — Regrouper** :
1. une seule recherche pour tout ;
2. un outil de vue d'ensemble (l'équivalent de « regarder l'écran ») ;
3. « modifier » et « renommer » dans le même outil, champs optionnels.

```
Lecture        proto_get_overview, proto_search
Composants     proto_add_component, proto_update_component, proto_delete_component
Propriétés     proto_add_property, proto_update_property, proto_delete_property
Arborescence   proto_add_folder, proto_add_instance, proto_update_node (nom + déplacement), proto_delete_node
Valeurs        proto_set_values (plusieurs instances d'un coup, ou remise par défaut)
```

**Étape 4 — Vérifier avec de vraies phrases** :

| Demande | Appels | OK ? |
|---|---|---|
| « Renomme champLogin en champIdentifiant » | search → update_node | ✔ |
| « Ajoute une propriété couleur (rouge/vert) au Bouton » | search → add_property | ✔ |
| « Mets tous les boutons du dossier connexion en style lien » | search → set_values (plusieurs) | ✔ |
| « Crée un écran profil avec 2 champs et un bouton » | add_folder → add_instance ×3 → set_values | ✔ |
| « Quelles instances n'utilisent que des valeurs par défaut ? » | get_overview, puis raisonnement | ✔ si l'overview indique les défauts |
| « Duplique le dossier connexion » | ✘ | outil manquant : `proto_duplicate_node` ? |

**Niveau de détail** :
- trop fin (un outil par champ) : beaucoup d'appels, plus d'erreurs ;
- trop gros (`apply_json_patch`) : le modèle doit maîtriser le format et contourne les règles métier ;
- bon niveau : un outil ≈ une action que l'utilisateur ferait dans l'interface.

---

## 4. Créer un prompt custom réutilisable

> **Utilisateur :** creer un prompt custom qui permet d'ajouter une IA dans une application basée sur Theia

Création de la skill Claude Code `theia-ai`, d'abord dans `C:\Users\Christophe\.claude\skills\theia-ai\SKILL.md`. Les exemples de code (imports, `bindToolProvider`, `ToolRequest`, `AbstractStreamParsingChatAgent`, identifiant de modèle `default/universal`) ont été comparés aux sources de `@theia/ai-*` 1.76.

Utilisation :
```
/theia-ai composants, propriétés, instances : chercher, ajouter, modifier, supprimer, renommer
```

Déroulement en 4 phases :
1. **Analyse** : version de Theia, modèle de données, emplacement de l'état et sa méthode de modification, règles métier cachées dans l'interface.
2. **Conception des outils** : méthode objets × verbes, regroupement, granularité, test sur phrases réelles. **Arrêt pour validation** avant toute modification.
3. **Implémentation** : dépendances, `getModel()` / `applyChange()`, service d'accès, outils, agent avec prompt `~{outil}`, câblage.
4. **Vérification** : compilation, lancement, activation de l'IA et clé API, mise à jour du README.

Plus une section « Pièges connus » (versions différentes, écriture directe dans le fichier, outil oublié dans le prompt…).

---

## 5. Copie dans le dépôt

> **Utilisateur :** copy le skil dans ce repo

Skill copiée dans [`.claude/skills/theia-ai/SKILL.md`](../../.claude/skills/theia-ai/SKILL.md), versionnée avec le projet. La copie utilisateur existe toujours ; les deux ne sont pas synchronisées.

---

## 6. Enregistrement

> **Utilisateur :** enregistre ce thread dans ce repo

Ce fichier.

## Prochaine étape

Lancer `/theia-ai` dans ce dépôt, valider la liste d'outils proposée et choisir le fournisseur de modèle (Anthropic, OpenAI ou Ollama).
