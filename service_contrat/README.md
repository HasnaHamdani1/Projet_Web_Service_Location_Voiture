# Service Contrat

Service REST Python/FastAPI responsible for creating and managing rental contracts. It uses the shared MySQL database and reads reservation details through the Reservation API.

## First feature slice: create and consult

- An administrator creates a contract by reservation ID. The service fetches the reservation and copies its customer, vehicle, dates, and total amount. The reservation must have status `CONFIRMEE`.
- New contracts start with the schema-defined status `EN_ATTENTE`.
- An administrator records the deposit once, before client validation; the amount and UTC recording time are retained on the contract. Validation is rejected until the deposit is recorded.
- Clients can list and retrieve only their own contracts; administrators can list all contracts.
- Before validation, the service re-fetches the reservation and confirms it is still `CONFIRMEE` and matches the contract snapshot. The owning client can then validate/sign, changing its status to `VALIDE`.
- Validation records `date_validation` in UTC for traceability.
- An administrator closes a validated contract after return, changing its status to `CLOTURE`. Return-service authentication still needs to be aligned before that service calls this endpoint directly.
- Closure records `date_cloture` in UTC for auditability.
- An administrator can append an extension annex to a validated contract. The signed contract dates remain unchanged; Reservation must atomically check and apply the extension.
- Lifecycle actions log contract/actor IDs and status-changing events without logging personal or deposit amounts.
- The database unique key on `reservation_id` prevents duplicate contracts, including concurrent creation requests.
- There is no contract-term update endpoint. After validation, only the lifecycle status can change.

## API

- `GET /health` - database-backed health check.
- `GET /contrats` - list contracts visible to the authenticated user; administrators can filter by `client_id` or `reservation_id`.
- `GET /contrats/{contrat_id}` - retrieve a contract (clients can retrieve only their own).
- `GET /contrats/numero/{numero_contrat}` - retrieve a contract by its unique reference (clients can retrieve only their own).
- `POST /contrats` - administrator creates from `{"reservation_id": 123}`; returns `201` and the contract.
- `POST /contrats/{contrat_id}/caution` - administrator records `{"montant_caution": 500.00}` while the contract is pending.
- `POST /contrats/{contrat_id}/validation` - owning client validates/signs a pending contract.
- `POST /contrats/{contrat_id}/cloture` - administrator closes a validated contract.
- `POST /contrats/{contrat_id}/prolongations` - administrator extends through Reservation; requires `Idempotency-Key` UUID and body `{"nouvelle_date_fin":"YYYY-MM-DD"}`.
- `GET /contrats/{contrat_id}/prolongations` - list extension annexes visible to the caller.

FastAPI OpenAPI docs are available at `/docs` when the service is running.

## Configuration

Copy `.env.example` values into the root Compose environment (do not commit a real `.env`). The service requires:

- `DATABASE_URL`: SQLAlchemy MySQL connection string for the shared database, for example `mysql+pymysql://<user>:<password>@mysql:3306/db_location_vehicules`.
- `RESERVATION_SERVICE_URL`: Reservation base URL; in Compose this should be `http://service_reservation:8000`.
- `JWT_SECRET`: the HS256 secret shared with the token issuer.
- `RESERVATION_SERVICE_TIMEOUT_SECONDS`: upstream timeout (defaults to 5 seconds).

Protected routes expect a bearer JWT with claims `sub` (positive numeric user ID encoded as a string), `role` (`CLIENT` or `ADMINISTRATEUR`), and `exp`. The token issuer and every service must agree on this format and secret. The service does not issue tokens.

## Database

The ORM maps the existing shared schema's singular `contrat` table and its fields. Apply `migrations/001_create_contrat.sql` only if the central schema has not already created that table, then apply migrations `002` through `005`. The service never runs `create_all()` or changes shared schema automatically. The existing dump permits nullable `reservation_id`; this API always sets it, and the team should migrate the column to `NOT NULL` when coordinating the shared schema.

The extension endpoint depends on `POST /reservations/{id}/prolongations` with atomic conflict checking and idempotency support. Until Reservation implements that endpoint, extension requests cannot complete and return an upstream error.

## Run

Build from the repository root so Docker can copy the service directory:

```powershell
docker build -f service_contrat/Dockerfile -t service_contrat .
```

In a local Python environment, install `requirements.txt`, set the environment variables above, then run:

```powershell
uvicorn service_contrat.main:app --reload
```
