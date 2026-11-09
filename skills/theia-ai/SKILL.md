---
name: theia-ai
description: Ajoute un assistant IA (chat + outils) à une application basée sur Eclipse Theia, via le framework Theia AI (@theia/ai-*). Utiliser quand on veut qu'une IA puisse chercher, créer, modifier, supprimer ou renommer les objets métier d'une extension Theia depuis le chat.
argument-hint: "[objets métier ou demandes typiques à couvrir]"
---

# Ajouter une IA à une application Theia (Theia AI)

Objectif : un agent de chat (`@MonAgent`) qui agit sur le modèle métier de l'application **via des outils** (`ToolProvider`), en passant par les widgets ouverts pour conserver dirty / Ctrl+S / revert / rafraîchissement.

Précisions de l'utilisateur : $ARGUMENTS

Travailler en 4 phases. **Ne rien modifier avant la validation de la phase 2.**

---

## Phase 1 — Analyser l'application

1. Lire `package.json` racine et ceux des extensions/apps : version exacte de `@theia/core` (tous les `@theia/ai-*` devront avoir **la même version**), cible (`browser` / `electron`), gestionnaire (yarn/npm), scripts de build.
2. Vérifier que les paquets existent pour cette version : `npm view @theia/ai-core@<version> version`. Theia AI n'existe qu'à partir de ~1.54 ; si plus ancien, le signaler et s'arrêter.
3. Identifier le **modèle métier** : types (interfaces), fonctions de manipulation, format de fichier.
4. Identifier **où vit l'état** : widget éditeur (ReactWidget, Saveable…), service singleton, fichier. Repérer la méthode centrale de modification (ex. `mutate()`, `update()`, `setDirty`) et les règles métier cachées dans les handlers UI (cascades, noms uniques, confirmations).
5. Repérer le module frontend (`ContainerModule`) et les contributions existantes.

## Phase 2 — Concevoir les outils (à faire valider)

Méthode :
1. **Objets × verbes** : lister chaque type d'objet du modèle et le croiser avec chercher / ajouter / modifier (renommer inclus) / supprimer / déplacer.
2. **Regrouper** :
   - un seul outil de **recherche** transverse (tous types d'objets, texte ou regex) ;
   - un outil de **vue d'ensemble** qui renvoie ids, chemins lisibles et valeurs (le modèle doit « voir » avant d'agir) ;
   - « modifier » et « renommer » dans le même outil (champs optionnels) ;
   - opérations **en lot** quand une demande typique imposerait des dizaines d'appels.
3. **Granularité** : un outil ≈ une action que l'utilisateur ferait dans l'UI. Ni un outil par champ, ni un `apply_json_patch` générique qui contourne les règles métier.
4. **Tester sur des phrases réelles** : écrire 5 à 8 demandes typiques et la séquence d'appels qui y répond ; ajouter les outils manquants.

Présenter à l'utilisateur : tableau des outils (nom, rôle, paramètres), table des phrases testées, outils destructifs (confirmation), choix du fournisseur de modèle (`@theia/ai-anthropic`, `@theia/ai-openai`, `@theia/ai-ollama`, `@theia/ai-google`…). **Attendre son accord.**

## Phase 3 — Implémenter

### 3.1 Dépendances
Ajouter, à la version exacte de `@theia/core` :
- extension : `@theia/ai-core`, `@theia/ai-chat`
- application (browser-app / electron-app) : `@theia/ai-core`, `@theia/ai-chat`, `@theia/ai-chat-ui`, le fournisseur choisi (et `@theia/ai-ide` seulement si l'utilisateur veut aussi les agents génériques).
Puis installer (`yarn` / `npm install`).

### 3.2 Rendre l'état pilotable
- Dans le widget/service qui porte l'état : exposer `getModel()` (lecture) et `applyChange(fn)` qui délègue à la méthode centrale de modification (dirty + événement de contenu + `update()`).
- **Extraire les règles métier** des handlers UI vers des fonctions pures du modèle (`common/`), appelées par l'UI **et** par les outils. Les dialogues de confirmation restent dans l'UI ; côté IA, la confirmation est celle de Theia.

### 3.3 Service d'accès
Un service `@injectable()` singleton qui retrouve la cible : widget actif (`ApplicationShell.currentWidget` / `activeWidget`) sinon dernier widget du bon type (`WidgetManager.getWidgets(ID)`). Méthodes `read(fn)` et `write(fn)` qui lèvent une erreur claire si aucun document n'est ouvert.

### 3.4 Outils
Un fichier par groupe (`browser/ai/…-tools.ts`). Forme d'un outil :

```ts
import { injectable, inject } from '@theia/core/shared/inversify';
import { ToolProvider, ToolRequest } from '@theia/ai-core';

@injectable()
export class RenameNodeTool implements ToolProvider {
    static readonly ID = 'myapp_rename_node';
    @inject(MyAppAccessService) protected readonly access: MyAppAccessService;

    getTool(): ToolRequest {
        return {
            id: RenameNodeTool.ID,
            name: RenameNodeTool.ID,
            providerName: 'myapp',
            description: 'Renomme un nœud. `node` = id ou chemin "a/b/c". Utiliser myapp_search avant pour trouver l\'id.',
            parameters: {
                type: 'object',
                properties: {
                    node: { type: 'string', description: 'id ou chemin du nœud' },
                    newName: { type: 'string', description: 'nouveau nom' }
                },
                required: ['node', 'newName']
            },
            // confirmAlwaysAllow: true,   // pour les outils destructifs
            handler: async (argString: string) => {
                try {
                    const { node, newName } = JSON.parse(argString);
                    return this.access.write(model => renameNode(model, node, newName)); // renvoie un résumé
                } catch (e) {
                    return `Erreur : ${e instanceof Error ? e.message : e}`;
                }
            }
        };
    }
}
```

Règles :
- noms `snake_case` préfixés par l'application ; description qui dit **quand** l'utiliser ;
- accepter id **ou** chemin lisible ; valider et convertir les valeurs selon le type ;
- retourner un texte/objet court décrivant ce qui a changé, ou une erreur explicite (jamais d'exception non capturée) ;
- résultats de recherche/overview compacts (ids, chemins, types) pour économiser les tokens.

### 3.5 Agent
```ts
import { injectable } from '@theia/core/shared/inversify';
import { AbstractStreamParsingChatAgent } from '@theia/ai-chat/lib/common/chat-agents';
import { LanguageModelRequirement } from '@theia/ai-core';

@injectable()
export class MyAppChatAgent extends AbstractStreamParsingChatAgent {
    id = 'MyApp';
    name = 'MyApp';
    description = 'Cherche et modifie les éléments de l\'application ouverte.';
    languageModelRequirements: LanguageModelRequirement[] = [{ purpose: 'chat', identifier: 'default/universal' }];
    protected defaultLanguageModelPurpose = 'chat';
    protected override systemPromptId = 'myapp-system';
    override prompts = [{ id: 'myapp-system', defaultVariant: { id: 'myapp-system-default', template: SYSTEM_PROMPT } }];
    override functions = [/* ids de tous les outils */];
}
```
Le `SYSTEM_PROMPT` : rôle, description concise du modèle de données, règles (toujours chercher/consulter l'overview avant de modifier, ne jamais inventer d'id, confirmer les suppressions de masse, résumer ce qui a été fait, rappeler d'enregistrer), et la liste des outils référencés par `~{tool_id}` (une ligne chacun).

### 3.6 Câblage (module frontend)
```ts
import { bindToolProvider } from '@theia/ai-core/lib/common';
import { ChatAgent } from '@theia/ai-chat/lib/common';
import { Agent } from '@theia/ai-core/lib/common';

bind(MyAppAccessService).toSelf().inSingletonScope();
bindToolProvider(RenameNodeTool, bind);           // … un par outil
bind(MyAppChatAgent).toSelf().inSingletonScope();
bind(Agent).toService(MyAppChatAgent);
bind(ChatAgent).toService(MyAppChatAgent);
```
Facultatif : une commande « Demander à l'IA » qui ouvre la vue chat avec `@MyApp` pré-rempli. Le panneau de chat lui-même est fourni par `@theia/ai-chat-ui`.

**Vérifier chaque import et signature dans `node_modules/@theia/ai-core|ai-chat/src`** après installation : l'API évolue entre versions. Ne pas deviner.

## Phase 4 — Construire et vérifier

1. Compiler l'extension puis l'application ; corriger toutes les erreurs TypeScript.
2. Lancer l'application si possible et vérifier : l'agent apparaît dans le chat, un outil de lecture répond, une modification passe le document en « modifié », Ctrl+S enregistre, revert annule.
3. Indiquer à l'utilisateur comment activer l'IA (Préférences → AI Features → *Enable AI*), saisir la clé API du fournisseur, et choisir le modèle de l'agent dans la configuration des agents.
4. Mettre à jour le README (section « Assistant IA » : prérequis, exemples de demandes, liste des outils).
5. Résumer : fichiers créés/modifiés, ce qui a été vérifié et ce qui ne l'a pas été.

## Pièges connus
- Versions `@theia/ai-*` différentes de `@theia/core` → doublons inversify, erreurs au démarrage.
- Outil qui écrit directement le fichier pendant qu'un éditeur est ouvert → conflit, perte de modifications. Toujours passer par le widget.
- Logique métier restée dans les handlers React → l'IA casse les invariants (cascades, unicité des noms).
- Oublier `functions` / `~{…}` dans le prompt → l'outil existe mais n'est jamais proposé au modèle.
- Outil qui lève une exception → le tour de chat échoue ; toujours renvoyer un message d'erreur.
