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

Configure the shared environment in the repository-root `.env` by copying `.env.example` and replacing its placeholders. Compose reads that root file; this service does not use a separate `service_contrat/.env` file. Do not commit real credentials. The Contract service requires:

- `DATABASE_URL`: SQLAlchemy MySQL connection string for the shared database, for example `mysql+pymysql://location_app:replace_me@mysql:3306/db_location_vehicules` (replace the dummy credentials in your local `.env`).
- `RESERVATION_SERVICE_URL`: Reservation base URL; in Compose this should be `http://service_reservation:8000`.
- `JWT_SECRET`: the HS256 secret shared with the token issuer.
- `RESERVATION_SERVICE_TIMEOUT_SECONDS`: upstream timeout (defaults to 5 seconds).
- `CORS_ORIGINS`: comma-separated browser origins allowed to call this API; set this to the deployed frontend origin(s).

Protected routes expect a bearer JWT with claims `sub` (positive numeric user ID encoded as a string), `role` (`CLIENT` or `ADMINISTRATEUR`), and `exp`. The token issuer and every service must agree on this format and secret. The service does not issue tokens.

## Database

The ORM maps the shared schema's singular `contrat` table and its fields. The root Compose setup initializes a new MySQL volume from `db_location_vehicules.sql` (which already creates this table), then applies migrations `002` through `005`. It does not run migration `001_create_contrat.sql`; do not apply that `CREATE TABLE` migration on top of the base dump. The service never runs `create_all()` or changes the shared schema automatically. The dump permits nullable `reservation_id`, although this API always sets it; making the column `NOT NULL` remains a coordinated schema migration.

The extension endpoint depends on `POST /reservations/{id}/prolongations` with atomic conflict checking and idempotency support. Until Reservation implements that endpoint, extension requests cannot complete and return an upstream error.

## Run with the project stack

From the repository root, copy `.env.example` to `.env`, replace the placeholder credentials and JWT secret, then start the stack:

```powershell
docker compose up --build
```

The Contract API is published at `http://localhost:8003` and its OpenAPI page is at `http://localhost:8003/docs`. To create the first administrator, run `docker compose exec service_auth python -m service_auth.create_admin`.

Compose initializes migration scripts only when creating an empty MySQL data volume. For an existing volume, apply any unapplied migrations using the team's agreed migration procedure before deploying the updated service.

## Build or run the Contract service alone

Build from the repository root so Docker can copy the service directory:

```powershell
docker build -f service_contrat/Dockerfile -t service_contrat .
```

The container runs as the unprivileged `appuser` account. For local non-Compose execution, install `service_contrat/requirements.txt` and provide reachable `DATABASE_URL`, `RESERVATION_SERVICE_URL`, and `JWT_SECRET` values. The Compose hostname `mysql` is only resolvable from containers on the project network.

Run the local API from the repository root with:

```powershell
uvicorn service_contrat.main:app --reload
```
