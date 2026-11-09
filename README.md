# ProtoIDE

IDE basé sur Eclipse Theia 1.76 qui permet de déclarer des composants avec leurs propriétés, et d'instancier ces composants dans une arborescence de répertoires et sous-répertoires. L'application est lue et enregistrée dans un fichier `*.protoapp` (JSON).

## Démarrage

```bash
yarn            # installation
yarn build      # compile l'extension puis l'application
yarn start      # http://127.0.0.1:3000 (ouvre ./sample-workspace)
```

Ouvrez ensuite `demo.protoapp` dans l'explorateur de fichiers.

## Utilisation

- **Fichier > Nouveau > Nouvelle application ProtoIDE…** : crée un fichier `.protoapp`.
- **Fichier > Ouvrir une application ProtoIDE…**, ou un double-clic sur un `.protoapp` : ouvre l'éditeur.
- **Ctrl+S** : enregistre. Le point de modification est affiché sur l'onglet, et l'IDE demande confirmation si vous fermez avec des modifications non enregistrées.

L'éditeur comporte trois panneaux :

1. **Composants** : déclaration des composants (bouton +). Sélectionnez-en un pour éditer son nom, sa description et ses propriétés. Une propriété a un nom, un type (texte, nombre, booléen, énumération) et une valeur par défaut.
2. **Arborescence** : répertoires et sous-répertoires avec leurs instances.
   - Le bouton dossier crée un sous-répertoire dans le dossier sélectionné.
   - « + Instance » instancie le composant choisi.
   - Un glisser-déposer d'un composant vers un dossier crée une instance.
   - Un glisser-déposer d'un nœud vers un dossier le déplace.
   - La touche Suppr supprime l'élément sélectionné.
3. **Propriétés** : édition de l'élément sélectionné. Pour une instance, les valeurs restées par défaut sont affichées en italique, et le bouton ↺ rétablit la valeur par défaut.

Quand on renomme une propriété, change son type ou la supprime, la modification est répercutée sur toutes les instances du composant.

## Structure

- `proto-ide-ext/` : l'extension Theia.
  - `src/common/proto-model.ts` : le format de fichier, sa lecture et sa validation, et les opérations sur l'arborescence.
  - `src/browser/proto-app-editor-widget.tsx` : l'éditeur (React), qui implémente `Saveable`.
  - `src/browser/proto-app-open-handler.ts` : associe les fichiers `.protoapp` à l'éditeur.
  - `src/browser/proto-ide-contribution.ts` : les commandes et les menus.
- `browser-app/` : l'application Theia (cible navigateur).
- `sample-workspace/demo.protoapp` : un exemple.
