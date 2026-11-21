# Frontend du service Contrat

Ce dossier regroupe les fichiers propres à l'interface Contrat :

- `api.js` : appels aux routes du service Contrat ;
- `contrats.js` : contrôleur et enchaînement des écrans ;
- `contrats-liste-modele.js` : calcul des indicateurs et préparation des données
  filtrées/paginées de la liste, sans manipulation du DOM ;
- `contrats.css` : styles de l'espace Contrats ;
- `interfaces/` : un fichier HTML pour la structure de chaque interface et un fichier
  JavaScript associé pour afficher les données et gérer les interactions. `contrats.css`
  conserve leur présentation.

Les règles métier qui créent, valident ou clôturent un contrat restent dans le backend
`service_contrat`. Le modèle de liste du frontend sert uniquement à préparer les données
pour l'affichage ; il ne remplace pas ces règles métier.

## Intégration dans le frontend partagé

Le projet utilise une application frontend commune. Le fichier racine `frontend/app.js`
initialise le contrôleur Contrat et lui transmet les fonctions communes de requête,
notification et l'état de session. `frontend/index.html` fournit le conteneur
`#contract-list`, les boutons de la page et charge `Contrat/contrats.css`.

Pour ouvrir rapidement l'espace Contrat avec Live Server, lancer
`frontend/Contrat/index.html`. Ce point d'entrée redirige vers l'application partagée
et, après connexion administrateur, place l'écran sur la liste des contrats. Les écrans
HTML dans `interfaces/` restent des fragments chargés par `charger-fragment.js` ; ils
ne sont pas destinés à être ouverts individuellement.

Avec Live Server, `frontend/config.example.js` fournit les adresses locales par défaut.
Elles supposent que les API tournent sur le même ordinateur. Si les API tournent sur une
autre machine, il faut remplacer `localhost` par son adresse joignable.

Pour intégrer ce module dans une autre copie du frontend, conserver ces points
d'intégration dans les fichiers racine. Il n'est pas nécessaire de déplacer les
fichiers Auth, Véhicule ou Réservation dans ce dossier.
