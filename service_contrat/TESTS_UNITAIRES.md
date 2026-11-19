# Tests unitaires du service Contrat

## Étapes du travail demandé

### 1. Choisir la classe métier

Dans l'état initial, les règles métier étaient écrites dans les fonctions des routes FastAPI; la classe `Contract` est un modèle SQLAlchemy, pas une classe de règles métier. La classe `ReglesMetierContrat`, dans `metier_contrat.py`, regroupe maintenant les règles utilisées par les routes. Cela donne une classe métier identifiable à tester.

### 2. Choisir les méthodes

Les tests couvrent quatre méthodes de cette classe :

- `verifier_reservation_confirmee` : seuls les contrats issus d'une réservation confirmée sont acceptés.
- `verifier_caution_enregistrable` : la caution s'enregistre une seule fois sur un contrat en attente.
- `verifier_validation_possible` : le contrat doit être en attente et avoir une caution finie strictement positive.
- `verifier_cloture_possible` : seul un contrat validé peut être clôturé.

Les routes traduisent les erreurs de règle métier en réponses HTTP 409.

### 3. Prévoir les cas

Les tests comprennent des cas normaux (réservation confirmée, caution enregistrable, validation avec caution, clôture d'un contrat validé), des cas limites (caution déjà saisie, caution nulle ou infinie) et des cas d'erreur (réservation non confirmée, clôture d'un contrat en attente).

### 4. Exécuter les tests dans VS Code

1. Ouvrir le dossier racine `LocationVoiture` dans VS Code.
2. Sélectionner l'interpréteur Python du projet avec **Python: Select Interpreter** dans la palette de commandes.
3. Ouvrir un terminal intégré à la racine du projet.
4. Lancer la commande :

   ```powershell
   python -m unittest discover -s service_contrat/tests -v
   ```

5. Vérifier les lignes `... ok` et le résumé `Ran 9 tests` puis `OK`. Un échec affiche le test et l'assertion concernés.

On peut aussi ouvrir `service_contrat/tests/test_metier_contrat.py`, sélectionner **Run Test** au-dessus de la classe, ou utiliser la vue **Testing** de VS Code avec la découverte `unittest`.

### 5. Résultats et correction

Le test sur la caution infinie a d'abord échoué : la règle considérait `Infinity` comme un montant positif. La méthode métier a été corrigée pour exiger un montant fini et strictement supérieur à zéro. Après correction, la suite complète doit passer.

## Périmètre des outils

- **Python / unittest** : exécute les tests unitaires ci-dessus sans démarrer FastAPI, Docker ou MySQL.
- **VS Code** : édite le service, découvre les tests et affiche les résultats.
- **Docker Compose** : démarre les API et MySQL pour les vérifications d'intégration. Après avoir configuré le `.env` racine, lancer `docker compose up --build` depuis la racine.
- **Postman** : envoie des requêtes HTTP aux API démarrées par Compose, par exemple `GET http://localhost:8003/health`. Postman vérifie les routes REST et leurs réponses; ce n'est pas un outil de test unitaire métier.

L'accès Docker n'est pas requis pour le devoir de tests unitaires. La suite de tests utilise uniquement Python et ses modules intégrés.
