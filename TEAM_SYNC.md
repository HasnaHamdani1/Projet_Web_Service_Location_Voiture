# Team Architecture and Integration Agreement

This document records the project decisions and the conventions that every service owner needs to follow. It separates decisions already agreed or present in the repository from proposed defaults that the team still needs to confirm. Update the decision table when the team resolves an open item so this remains the shared reference.

## 1. Decisions already agreed

- **Architecture:** distributed REST services, coordinated with Docker Compose.
- **Database:** MySQL, shared by the services.
- **API style:** REST.
- **Contract service implementation:** Python (confirmed by the Contract service owner).
- **Git commits:** commit messages to GitHub are written in French.

The existing Vehicle and Reservation APIs are also implemented in Python with FastAPI and SQLAlchemy. Recommendation: use the same stack for new services unless the whole team agrees otherwise.

## 2. Current repository facts

These describe the files as they currently exist; they are not all deployment-ready yet.

- Vehicle API code is at the repository root (`main.py`, `models.py`, `database.py`). It has CRUD routes under `/vehicules` and the statuses `DISPONIBLE`, `RESERVE`, `LOUE`, and `MAINTENANCE`.
- Reservation API is in `service_reservation/`. It has `GET /reservations/{reservation_id}`, `POST /reservations`, `POST /reservations/{reservation_id}/paiement`, and `PUT /reservations/{reservation_id}/annulation`.
- The Reservation GET response currently exposes `id`, `client_id`, `vehicule_id`, `date_debut`, `date_fin`, `prix_total`, and `statut`. It returns 404 when the reservation does not exist. The GET response is an unwrapped record; the create route currently returns the record inside a `reservation` object.
- Successful simulated payment changes Reservation status to `CONFIRMEE`. The service also uses `EN_ATTENTE` and `ANNULEE`.
- The SQL dump defines Contract statuses `EN_ATTENTE`, `VALIDE`, and `CLOTURE`, defaulting to `EN_ATTENTE`. It has unique keys for `numero_contrat` and `reservation_id`.
- The SQL dump permits Reservation statuses `EN_ATTENTE`, `CONFIRMEE`, `ANNULEE`, and `PAYEE`. `PAYEE` is not used by the current Reservation API code.
- The SQL dump defines Return condition values `BON`, `LEGER_DOMMAGE`, and `DOMMAGE_IMPORTANT`.
- Both current Python services still configure SQLite, not the agreed shared MySQL. Their ORM table names are plural (`vehicules`, `reservations`), while the SQL dump uses singular names (`vehicule`, `reservation`). The SQL dump also uses `montant_estime`, while the Reservation API/model exposes `prix_total`.
- The current Vehicle and Reservation application startup creates tables with `Base.metadata.create_all`; both still configure SQLite. The repository now has a Contract service on the feature branch, including its own Dockerfile and migrations. There is still no root Compose file, Return service, or frontend. The SQL dump identifies MariaDB 10.4 as its source; the team has agreed MySQL, so choose the actual database image/version explicitly rather than assuming they are interchangeable deployment choices.

## 3. Rules to share across all service owners

### 3.1 Service boundaries and ownership

Recommended ownership for the shared database:

| Service | Owns and writes |
|---|---|
| Vehicle (`service_vehicule`) | `vehicule` records and vehicle status |
| Reservation (`service_reservation`) | `reservation` records and payment/cancellation state |
| Contract (`service_contrat`) | `contrat` records and contract lifecycle |
| Return (`service_retour`) | `retour` records and return/damage assessment |
| Authentication (service or agreed shared component) | `utilisateur`, `client`, and `administrateur` records |

Each service is the authority for its own records. Even with one shared MySQL database, a service should use another service's REST API for that service's business data rather than reading or writing its tables directly. Keep cross-service IDs as references. Agree explicitly whether the shared schema will enforce cross-service foreign keys; if it does, migration changes must be coordinated.

### 3.2 API language, paths, fields, and response shapes

The current APIs use French paths and field names. Recommended default: preserve that convention across services to avoid breaking the existing code. Do not mix translations for the same concept (for example, `vehicule_id` in one API and `vehicleId` in another).

Treat the Reservation GET endpoint as the current Contract integration interface:

```http
GET /reservations/{reservation_id}
```

```json
{
  "id": 123,
  "client_id": 45,
  "vehicule_id": 8,
  "date_debut": "2026-12-01",
  "date_fin": "2026-12-04",
  "prix_total": 1200.0,
  "statut": "CONFIRMEE"
}
```

This is illustrative of the current model; add explicit Pydantic response schemas so the shape is guaranteed and documented. A missing reservation returns 404. For Contract creation, accept a `reservation_id`, fetch this endpoint, and use the returned details; do not accept a caller-supplied price or customer/vehicle values that could disagree with Reservation.

Standardize errors: use 400/422 for invalid input, 401 for missing or invalid authentication, 403 for insufficient role, 404 for missing records, 409 for duplicate/conflicting state, and 503 when a required service is unavailable. Agree on one JSON error shape and apply it consistently. Keep the current French route style unless the team chooses and migrates to a versioned prefix together.

### 3.2.1 REST route agreement

The routes below distinguish **implemented in the repository** from **proposed for team adoption**. Existing paths are the compatibility baseline. New routes should use the same French names, JSON field names, and ISO date format. Unless the team decides to add `/api/v1` everywhere in one coordinated change, keep paths unprefixed as they are now.

| Service | Method and path | Purpose / request | Current status |
|---|---|---|---|
| Vehicle | `GET /vehicules` | List vehicles | Implemented |
| Vehicle | `GET /vehicules/{vehicule_id}` | Get one vehicle | Implemented |
| Vehicle | `POST /vehicules` | Create vehicle | Implemented |
| Vehicle | `PUT /vehicules/{vehicule_id}` | Replace vehicle data | Implemented |
| Vehicle | `DELETE /vehicules/{vehicule_id}` | Delete vehicle | Implemented |
| Reservation | `GET /reservations/{reservation_id}` | Canonical reservation read used by Contract | Implemented |
| Reservation | `POST /reservations` | Create reservation | Implemented |
| Reservation | `POST /reservations/{reservation_id}/paiement` | Simulate payment; successful result sets `CONFIRMEE` | Implemented |
| Reservation | `PUT /reservations/{reservation_id}/annulation` | Cancel an eligible reservation | Implemented |
| Contract | `POST /contrats` | Admin creates from `{"reservation_id": 123}` | Implemented on Contract branch |
| Contract | `GET /contrats` | List contracts, scoped to client or admin | Implemented on Contract branch |
| Contract | `GET /contrats/{contrat_id}` | Get contract by ID, ownership-scoped | Implemented on Contract branch |
| Contract | `GET /contrats/numero/{numero_contrat}` | Get contract by unique number, ownership-scoped | Implemented on Contract branch |
| Contract | `POST /contrats/{contrat_id}/caution` | Admin records `{"montant_caution": 500.00}` before signature | Implemented on Contract branch |
| Contract | `POST /contrats/{contrat_id}/validation` | Owning client signs/validates; status becomes `VALIDE` | Implemented on Contract branch |
| Contract | `POST /contrats/{contrat_id}/cloture` | Admin closes validated contract after return | Implemented on Contract branch |
| Contract | `POST /contrats/{contrat_id}/prolongations` | Admin extends a validated contract and stores an annex | Implemented on Contract branch; requires Reservation support below |
| Contract | `GET /contrats/{contrat_id}/prolongations` | List extension annexes, ownership-scoped | Implemented on Contract branch |

**Reservation read response** is a direct JSON object, not wrapped in a `reservation` property:

```json
{
  "id": 123,
  "client_id": 45,
  "vehicule_id": 8,
  "date_debut": "2026-12-01",
  "date_fin": "2026-12-04",
  "prix_total": 1200.0,
  "statut": "CONFIRMEE"
}
```

`GET /reservations/{reservation_id}` returns 404 when absent. Contract creation and signature use this API as the source of truth; Contract must not read Reservation tables directly or trust caller-supplied reservation details.

**Common response/error rules (proposed):** successful reads and state changes return the resource JSON directly; creates return 201; invalid requests return 422 (or 400 where existing code already does); missing resources return 404; state conflicts and duplicates return 409; auth errors return 401/403; unavailable upstream services return 503. Keep FastAPI's `{"detail": "..."}` error body until a shared error schema is adopted. Define explicit Pydantic response models for each endpoint so these shapes appear in OpenAPI.

#### Extension workflow proposal

Extensions cannot safely be implemented by Contract alone: only Reservation owns date availability and overlapping-booking rules. Adopt this two-service contract before enabling the proposed Contract extension route:

1. Admin calls `POST /contrats/{contrat_id}/prolongations` with `{"nouvelle_date_fin": "YYYY-MM-DD"}`. Contract verifies the base contract is `VALIDE` and the requested end is later than its current effective end.
2. Contract calls Reservation internally: `POST /reservations/{reservation_id}/prolongations` with the new end date and an `Idempotency-Key` UUID.
3. Reservation atomically checks the reservation is `CONFIRMEE`, checks conflicts for the extension period, recalculates the amount, updates its owned reservation data, and returns the same result for retries of the same idempotency key. Return 409 if unavailable or invalid.
4. Reservation returns `reservation_id`, `date_fin_precedente`, `date_fin`, `montant_supplementaire`, and a unique `prolongation_id`. Contract stores an append-only annex referencing that ID and returns 201 with the annex. The original validated contract terms remain unchanged.
5. If Contract persistence fails after Reservation succeeds, retry with the same `Idempotency-Key`; Reservation must return the original result so Contract can finish persisting the annex without extending twice.

The Contract side now follows this proposed interface, but the Reservation endpoint is still **not implemented or ratified**. Reservation needs to implement its endpoint and idempotency storage before end-to-end extension works. No service may approve an extension using only a read-only availability check, because another booking could win the race.

### 3.3 Shared data types and business meaning

- **IDs:** use integer IDs consistently in JSON. SQL `BIGINT` IDs are suitable; Python `int` can represent them.
- **Dates:** use ISO 8601 date values (`YYYY-MM-DD`) for rental dates. Treat a rental period as start-inclusive and end-exclusive, matching the current overlap check and day calculation (`date_fin - date_debut`).
- **Money:** the current code uses Python `float` and the SQL dump uses `DOUBLE`. Recommended before MySQL integration: use a fixed-precision decimal type in MySQL and Python `Decimal`; agree one project currency and return it consistently (or include a currency field). Never silently mix currencies.
- **Shared enums:** use the exact status spelling and capitalization listed below. Do not create near-duplicates such as `PAYEE` and `CONFIRMEE` for the same business meaning.

### 3.4 Statuses and allowed transitions

Use the existing values as the baseline. The team must confirm the Reservation `PAYEE` mismatch before connecting to MySQL.

| Entity | Current values | Recommended rule / transition |
|---|---|---|
| Vehicle | `DISPONIBLE`, `RESERVE`, `LOUE`, `MAINTENANCE` | Keep these exact values. Only the responsible service/action may make valid transitions. |
| Reservation | Code: `EN_ATTENTE`, `CONFIRMEE`, `ANNULEE`; SQL additionally allows `PAYEE` | Recommended: `EN_ATTENTE` → `CONFIRMEE` on successful simulated payment; `EN_ATTENTE` or eligible `CONFIRMEE` → `ANNULEE` before rental start. Remove `PAYEE` from the canonical enum unless the team defines it as a distinct state. |
| Contract | SQL: `EN_ATTENTE`, `VALIDE`, `CLOTURE` | Create as `EN_ATTENTE` only from a confirmed Reservation; validate `EN_ATTENTE` → `VALIDE`; close `VALIDE` → `CLOTURE`. No backward transitions. After validation, contract terms are immutable; closure may change lifecycle status. |
| Return | Condition: `BON`, `LEGER_DOMMAGE`, `DOMMAGE_IMPORTANT`; fields also include late flag/days/charges | Agree which service records return completion and calls Contract to close it; agree how return condition determines the next Vehicle status and any damage/late charge. |

The Contract schema currently allows a null `reservation_id`, although the business rule requires a contract to come from a reservation. Recommended: make it `NOT NULL`, retain the unique constraint, and keep `numero_contrat` unique. A duplicate contract request should return 409 rather than create another contract.

### 3.5 Authentication and authorization

The project brief requires JWT authentication and client/admin roles, but the current code does not implement them. Agree who issues tokens, the role claim names, how services validate tokens, and which actions require each role. Recommended minimum: admin manages vehicles and creates/validates contracts; a client can access only their own reservations and sign their contract; return processing is admin-only. Keep secrets in environment variables, never in Git.

### 3.6 MySQL schema and migrations

Before switching services from SQLite, agree on one canonical MySQL schema and migration owner/process. Resolve these existing mismatches together:

1. Singular SQL table names (`vehicule`, `reservation`) vs plural ORM names (`vehicules`, `reservations`). Recommended: use the SQL dump's singular names as the starting point and update ORM mappings, or formally update the schema and all mappings in one change.
2. SQL `montant_estime` vs Reservation API/model `prix_total`. Recommended: keep `prix_total` as the REST field and settle one database column name in the canonical migration.
3. SQL dump source reports MariaDB; deployment requirement says MySQL. Choose and pin one MySQL image/version and verify the schema against it.

Use versioned migrations rather than relying on each service's `create_all()` at startup in deployment. Each service may own its migrations, but the team must define one ordered migration process in Compose and CI.

### 3.7 Docker Compose and service discovery

- Keep one root `compose.yaml` that starts the database and all services needed for the app.
- Give Compose services stable names, for example `mysql`, `service_vehicule`, `service_reservation`, `service_contrat`, `service_retour`, and `frontend`.
- Services call each other using Compose DNS names and environment-configured base URLs, for example `http://service_reservation:8000`; never hard-code `127.0.0.1` for container-to-container calls.
- Agree the container ports, host-published ports, and which component is exposed publicly. Use health checks and wait for MySQL readiness before migrations/services start.
- Keep credentials in an ignored local `.env`; commit only `.env.example` with placeholders. Persist MySQL data with a named volume.
- Give every service a health endpoint, such as `/health`, and document local startup and shutdown commands.

### 3.8 Documentation, tests, and collaboration

- FastAPI's OpenAPI docs should reflect the agreed paths, request/response schemas, status codes, and authentication requirements.
- Each owner tests their service's business rules; the team maintains integration checks that start Compose and exercise service-to-service paths, especially Reservation → Contract and Return → Contract/Vehicle.
- Use the same lint/format conventions and Python version if the team adopts Python/FastAPI for every service. Keep service dependencies in that service's requirements file.
- Write all Git commit messages in French, including the subject and any body. Keep them concise and describe the change, for example: `Ajouter le service de contrat` or `Corriger le calcul du montant`.
- The Contract service is being implemented to expect JWT claims `sub` (numeric user ID encoded as a string), `role` (`CLIENT` or `ADMINISTRATEUR`), and `exp`, signed with `HS256`. The authentication owner must confirm or align with this token contract before integration.
- Assign an owner for `compose.yaml`, the canonical schema/migrations, and the root README. Service owners should notify the team before changing a shared API field, enum, table, or environment variable.

## 4. Target repository layout

Keep services at the repository root, alongside the existing `service_reservation/` directory:

```text
LocationVoiture/
├── compose.yaml
├── .env.example
├── README.md
├── database/
│   └── migrations/
├── service_vehicule/
│   ├── app/
│   ├── Dockerfile
│   └── requirements.txt
├── service_reservation/
│   ├── app/
│   ├── Dockerfile
│   └── requirements.txt
├── service_contrat/
│   ├── app/
│   ├── Dockerfile
│   └── requirements.txt
├── service_retour/
│   ├── app/
│   ├── Dockerfile
│   └── requirements.txt
├── service_auth/              # or document the agreed auth owner
├── frontend/
└── tests/
    └── integration/
```

This is a target, not the current repository layout. The Vehicle code is still at the root, and the other listed deployment components are not present yet.

## 5. Decisions for the next team sync

Record an owner and decision for each item:

1. Confirm the canonical Reservation paid/confirmed status (`CONFIRMEE` recommended) and whether `PAYEE` is removed or given a separate meaning.
2. Choose the exact MySQL image/version and agree the canonical table/column names; reconcile ORM mappings with `db_location_vehicules.sql`.
3. Confirm team-wide Python/FastAPI/SQLAlchemy use (the existing services use it; the Contract owner has chosen Python).
4. Choose project currency and adopt fixed-precision money storage.
5. Confirm authentication owner, JWT role claims, and route permissions.
6. Confirm the proposed Reservation/Contract extension workflow, deposit policy, and how Return triggers Contract closure.
7. Assign owners for Compose, schema migrations, frontend, integration tests, and root documentation.
8. Ratify the common REST paths, response/error shapes, and Reservation extension idempotency contract in section 3.2.1.

Once these are confirmed, update this file and implement against these shared contracts. Changes to API fields, statuses, or schema should be coordinated before merging.
