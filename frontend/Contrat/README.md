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

## Ouvrir l'espace Contrats

Le serveur frontend Docker expose la page sur `http://localhost:3000/Contrat/`.
Avec Live Server, ouvrir directement `frontend/Contrat/index.html`.
La page charge les contrats sans connexion. Les fichiers HTML d'`interfaces/`
sont des fragments chargés depuis cette page.

Les API Véhicule, Réservation et Contrat utilisent le même nom d'hôte que la page,
aux ports 8001, 8002 et 8003. Pour Live Server, ajouter l'origine exacte de Live
Server (par exemple `http://127.0.0.1:5500`) à `CORS_ORIGINS` dans le fichier
`.env` local, puis recréer les conteneurs des trois API.
