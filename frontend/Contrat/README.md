# Frontend du service Contrat

Ce dossier regroupe les fichiers propres à l'interface Contrat :

- `api.js` : appels aux routes du service Contrat ;
- `contrats.js` : contrôleur et enchaînement des écrans ;
- `contrats.css` : styles de l'espace Contrats ;
- `interfaces/` : un fichier HTML pour la structure de chaque interface et un fichier
  JavaScript associé pour charger les données, réagir aux actions et gérer le parcours.
  `contrats.css` conserve leur présentation.

## Intégration dans le frontend partagé

Le projet utilise une application frontend commune. Le fichier racine `frontend/app.js`
initialise le contrôleur Contrat et lui transmet les fonctions communes de requête,
notification et l'état de session. `frontend/index.html` fournit le conteneur
`#contract-list`, les boutons de la page et charge `Contrat/contrats.css`.

Pour intégrer ce module dans une autre copie du frontend, conserver ces points
d'intégration dans les fichiers racine. Il n'est pas nécessaire de déplacer les
fichiers Auth, Véhicule ou Réservation dans ce dossier.
