# Service Contrat

Service REST Python/FastAPI responsible for creating and managing rental contracts. It uses the shared MySQL database and reads reservation details through the Reservation API.

## First feature slice: create and consult

- An administrator creates a contract by reservation ID. The service fetches the reservation and copies its customer, vehicle, dates, and total amount. The reservation must have status `CONFIRMEE`.
- New contracts start with the schema-defined status `EN_ATTENTE`.
- An administrator records the deposit once, before validation; the amount and UTC recording time are retained on the contract. Validation is rejected until the deposit is recorded.
- Clients can list and retrieve only their own contracts; administrators can list all contracts.
- Contract validation is an administrator action. After the client and administrator have signed the printed contract, the administrator confirms completion in the application; the service re-fetches the reservation, confirms it is still `CONFIRMEE` and matches the contract snapshot, then changes the status to `VALIDE`.
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
- `POST /contrats/{contrat_id}/validation` - administrator records confirmation that both paper signatures are complete and validates a pending contract.
- `POST /contrats/{contrat_id}/cloture` - administrator closes a validated contract.
- `POST /contrats/{contrat_id}/prolongations` - administrator extends through Reservation; requires `Idempotency-Key` UUID and body `{"nouvelle_date_fin":"YYYY-MM-DD"}`.
- `GET /contrats/{contrat_id}/prolongations` - list extension annexes visible to the caller.

The Contract interface is served by this same container at `/`. FastAPI OpenAPI docs are available at `/docs`.

## Configuration

Configure the shared environment in the repository-root `.env` by copying `.env.example` and replacing its placeholders. Compose reads that root file; this service does not use a separate `service_contrat/.env` file. Do not commit real credentials. The Contract service requires:

- `DATABASE_URL`: SQLAlchemy MySQL connection string for the shared database, for example `mysql+pymysql://location_app:replace_me@mysql:3306/db_location_voitures` (replace the dummy credentials in your local `.env`).
- `RESERVATION_SERVICE_URL`: Reservation base URL; in Compose this should be `http://service_reservation:8000`.
- `JWT_SECRET`: the HS256 secret shared with the token issuer.
- `RESERVATION_SERVICE_TIMEOUT_SECONDS`: upstream timeout (defaults to 5 seconds).
- `CORS_ORIGINS`: comma-separated browser origins allowed to call this API; set this to the deployed frontend origin(s).

Protected routes expect a bearer JWT with claims `sub` (positive numeric user ID encoded as a string), `role` (`CLIENT` or `ADMINISTRATEUR`), and `exp`. The token issuer and every service must agree on this format and secret. The service does not issue tokens.

## Database

The ORM maps the shared schema's `contrats` table and camelCase columns (`numeroContrat`, `dateGeneration`, `periodePrise`, `periodeFin`, and `montantTotal`). Compose initializes a new MySQL volume from `Base_de_données/db_location_voitures.sql`, then applies migrations `002` through `006`. Migration `006` adds the client and vehicle snapshots required by the Contract API. Migration `001_create_contrat.sql` belongs to the retired singular-table schema and must not be applied to this database. The service does not run `create_all()` or alter the schema at startup.

The extension endpoint depends on `POST /reservations/{id}/prolongations` with atomic conflict checking and idempotency support. Until Reservation implements that endpoint, extension requests cannot complete and return an upstream error. The other API services still have ORM mappings for the retired singular-table schema; coordinate their migration before using the new Compose database for the whole application.

## Run with the project stack

From the repository root, copy `.env.example` to `.env`, replace the placeholder credentials and JWT secret, then start the stack:

```powershell
docker compose up --build
```

The Contract interface is published at `http://localhost:8003/`; its API and OpenAPI page are at `http://localhost:8003/docs`. This single container serves both the Contract frontend and backend. The browser calls Authentication, Vehicle, and Reservation through their published host ports. To create the first administrator, run `docker compose exec service_auth python -m service_auth.create_admin`.

Compose initializes migration scripts only when creating an empty MySQL data volume. For an existing volume, apply any unapplied migrations using the team's agreed migration procedure before deploying the updated service.

## Build or run the Contract service alone

Build from the repository root so Docker can copy the service directory:

```powershell
docker build -f service_contrat/Dockerfile -t service_contrat .
```

The container runs as the unprivileged `appuser` account and includes the Contract UI assets. For local non-Compose execution, install `service_contrat/requirements.txt` and provide reachable `DATABASE_URL`, `RESERVATION_SERVICE_URL`, and `JWT_SECRET` values. The Compose hostname `mysql` is only resolvable from containers on the project network.

Run the local API from the repository root with:

```powershell
uvicorn service_contrat.main:app --reload
```
