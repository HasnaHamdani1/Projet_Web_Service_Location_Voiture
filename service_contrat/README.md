# Service Contrat

API FastAPI de création et de suivi des contrats de location. La prolongation n'est pas incluse.

## Routes principales

- `POST /contrats` : administrateur, crée un contrat depuis une réservation confirmée (`{"reservation_id": 123}`).
- `GET /contrats` et `GET /contrats/{id}` : lecture authentifiée, limitée aux contrats du client ou à l'administrateur.
- `POST /contrats/{id}/caution` : administrateur, enregistre `{"montant_caution": 500.00}`.
- `POST /contrats/{id}/validation` : le client propriétaire valide après saisie de la caution.
- `POST /contrats/{id}/cloture` : administrateur clôture un contrat validé.
- `GET /health` : contrôle de disponibilité.

Les routes métier attendent `Authorization: Bearer ...`, jeton émis par le service Auth.

Variables : `DATABASE_URL`, `JWT_SECRET`, `RESERVATION_SERVICE_URL`, `RESERVATION_SERVICE_TIMEOUT_SECONDS` et `CORS_ORIGINS`.

Les colonnes de caution, validation et clôture nécessitent les migrations SQL dans `migrations/`. Vérifier le dump, le nom de base et les chemins de migrations de `compose.yaml` avant de lancer Compose.

Depuis la racine du dépôt : `python -m uvicorn service_contrat.main:app --reload --port 8003`.
