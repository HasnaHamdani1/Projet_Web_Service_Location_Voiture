# Service Contrat

API FastAPI de création et de suivi des contrats de location. La prolongation n'est pas incluse.

## Routes principales

- `GET /contrats`, `GET /contrats/{id}` et `GET /contrats/numero/{numero_contrat}` listent ou consultent les contrats. La liste accepte le filtre `statut`.
- `POST /contrats/finalisation` crée et valide le contrat en une seule étape. Le corps contient `reservation_id`, `numero_contrat`, une `montant_caution` positive et `signatures_confirmees: true`. La réservation doit être confirmée et un doublon est refusé.
- La finalisation accepte aussi `mode_encaissement` (`CARTE`, `ESPECES`, `CHEQUE`, `VIREMENT`), `statut_caution` (`RECUE`, `A_RECEVOIR`) et `conditions_particulieres` (1 000 caractères maximum). Ces champs sont facultatifs et sont renvoyés à la consultation.
- `POST /contrats`, `POST /contrats/{id}/caution` et `POST /contrats/{id}/validation` permettent de créer un contrat en attente, d'enregistrer sa caution et de le valider séparément.
- `PUT /contrats/{id}/statut` reçoit `{"statut": "CLOTURE"}` pour la collaboration avec le service Retour. Il renvoie le contrat avec `statut: "CLOTURE"` et `date_cloture` si le contrat était validé. Un contrat qui ne peut pas être clôturé renvoie `409`.
- `GET /health` : contrôle de disponibilité.

Les routes Contrat ne demandent pas de jeton. L'administrateur enregistré à la création est la référence en base donnée par `CONTRAT_DEFAULT_ADMIN_ID` (par défaut `1`). Avec MySQL, cet identifiant doit exister dans la table `administrateurs`.

## Lancer le service

Variables utilisées : `DATABASE_URL`, `RESERVATION_SERVICE_URL`, `RESERVATION_SERVICE_TIMEOUT_SECONDS`, `CONTRAT_DEFAULT_ADMIN_ID` et `CORS_ORIGINS`. Autorisez l'origine du frontend dans `CORS_ORIGINS` pour ses appels depuis le navigateur.

Depuis la racine du dépôt, avec la configuration ci-dessus et le service Réservation disponible :

```sh
python -m pip install -r service_contrat/requirements.txt
python -m uvicorn service_contrat.main:app --port 8003
```

Pour une installation MySQL neuve, charger `Base_de_données/db_location_voitures.sql`, puis appliquer les migrations Contrat `002` à `005` dans l'ordre. Dans la configuration Compose partagée, remplacer l'ancien montage `005_create_prolongation.sql` par `005_add_deposit_details.sql`. Tous les services doivent viser la même base et utiliser un modèle compatible avec le dump.

Pour une base MySQL existante déjà migrée jusqu'à `004`, un administrateur de la base doit appliquer `005_add_deposit_details.sql` une seule fois, sur la base utilisée par le service, avant de démarrer cette version. Les contrats existants restent lisibles et leurs nouveaux champs valent `NULL`.

## Vérifier le service

```sh
python -m pip install pytest
python -m pytest service_contrat/tests -q
```

Les tests utilisent SQLite en mémoire et simulent les réponses du service Réservation.
