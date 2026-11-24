# LocationVoiture – PARC AUTO

Distributed car-rental application (G9). The services talk to each other only through their REST APIs and share **one** MySQL database, `db_location_voitures`. Two ways to run it, no Tailscale:

- **Whole platform on one PC** (branch `main`, `compose.yaml`): see *Start* below.
- **One service per PC** (each member runs her own service, everybody uses the database hosted on Hasna's PC): `compose.leila.yaml`, `compose.maryam.yaml`, `compose.sara.yaml`, `compose.hasna.yaml`, step by step in [docs/MULTI_PC.md](docs/MULTI_PC.md).

## Branches

| Branch | Owner | Content |
|---|---|---|
| `main` | team | complete platform (all services merged), launched with `compose.yaml` |
| `fonctionnalite/admin-frontend` | Leila | Vehicle API (root `main.py`…), Authentication API (`service_auth/`), common frontend (`frontend/`: home page, customer area, administration) |
| `branch_maryam` | Maryam | Reservation API (`service_reservation/`) |
| `service-contrat` | Sara | Contract API (`service_contrat/`) and Contract pages (`frontend/Contrat/`) |
| `branch_hasna` | Hasna | Return API (`service_retour/`), Return frontend (`frontend/Retour/`), shared database dump (`Base_de_données/`) |

## Start

1. Copy `.env.example` to `.env` and replace `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD` (letters and digits only) and `JWT_SECRET` (long random string).
2. From the repository root:

   ```powershell
   docker compose down -v        # only to restart from an empty database
   docker compose up --build
   docker compose exec service_auth python -m service_auth.create_admin   # one administrator per service (run 4 times)
   ```

3. Open:

   | What | Address | Owner |
   |---|---|---|
   | Home page and catalogue | http://localhost:3000 | Leila |
   | Customer area (sign-up, booking, simulated payment, my bookings) | http://localhost:3000/client.html | Leila (uses the Reservation API) |
   | Administration (`/admin/login.html`): dashboard, vehicles, reservations, contracts, returns | http://localhost:3000/admin/login.html | Leila, Sara |
   | Vehicle API | http://localhost:8005/docs | Leila |
   | Reservation API | http://localhost:8002/docs | Maryam |
   | Contract API | http://localhost:8003/docs | Sara |
   | Authentication API | http://localhost:8004/docs | Leila |
   | Return API | http://localhost:8006/docs | Hasna |
   | Return frontend (React) | http://localhost:5173 | Hasna |

Agency reservations page (`/admin/reservations.html`): list with monthly counters, search and status filter, counter confirmation of a payment, cancellation with a reason, CSV export. It calls the Reservation API with the administrator's token.

Browser pages find the APIs on the same machine as the page (`frontend/server.py` writes `config.js`), so the same platform also works when opened from another computer (classroom network) with a single address to share. Set `AUTH_API_URL`, `VEHICLE_API_URL`… only to point elsewhere.

## Administrators and rights per service

Each administrator manages **one** service, chosen when the account is created (`create_admin` asks for it, stored in table `administrateur_services`, migration 008): `VEHICULE` (Leila), `RESERVATION` (Maryam), `CONTRAT` (Sara), `RETOUR` (Hasna). The token issued by the Authentication service carries this `service` claim and `GET /auth/me` returns it.

- Every administrator sees the **Dashboard** and the menu of **their own service** only. Opening another service's page sends them back to the dashboard.
- Every API **refuses (403)** a write action by an administrator of another service: Vehicle (add, edit, photo, delete), Reservation (counter confirmation, cancellation, CSV export, customer records), Contract (create, deposit, validation, closing), Return (record, edit, delete). Reading stays open.
- Service-to-service calls use an `X-API-Key`: Contract → Reservation (`RESERVATION_SERVICE_API_KEYS` / `CONTRAT_RESERVATION_API_KEY`), Return → Contract (`CONTRAT_SERVICE_API_KEYS` / `RETOUR_CONTRAT_API_KEY`), Reservation, Contract and Return → Vehicle (`VEHICULE_SERVICE_API_KEYS` / `RESERVATION_VEHICULE_API_KEY`, `CONTRAT_VEHICULE_API_KEY`, `RETOUR_VEHICULE_API_KEY`).
- The Return interface (port 5173) receives the administrator's token from the dashboard menu (`#jeton=…`, removed from the address at once).

## Vehicle and contract life cycle

| Step | Service that calls the Vehicle API (`PUT /vehicules/{id}/statut`, `X-API-Key`) | Vehicle status | Contract status |
|---|---|---|---|
| Vehicle added by Leila | – | `DISPONIBLE` | – |
| Customer books (only a `DISPONIBLE` vehicle can be booked) | Reservation | `RESERVE` | – |
| Booking cancelled (and no other active booking) | Reservation | `DISPONIBLE` | – |
| Contract created by Sara | Contract | `LOUE` | `VALIDE` |
| Return recorded by Hasna | Return | `DISPONIBLE` (`MAINTENANCE` if major damage) | `CLOTURE` |

The Return service updates the vehicle and closes the contract **before** saving the return: if a call fails, nothing is saved and the return can be recorded again.

## REST links between services

| Caller → service | Route | Purpose |
|---|---|---|
| Reservation → Vehicle | `GET /vehicules`, `GET /vehicules/{id}`, `PUT /vehicules/{id}/statut` (header `X-API-Key`) | catalogue, price, status `RESERVE` / `DISPONIBLE` |
| Contract → Vehicle | `PUT /vehicules/{id}/statut` (header `X-API-Key`) | status `LOUE` when the contract is created |
| Customer area → Auth | `POST /auth/inscription`, `/auth/token`, `GET /auth/me` | customer and admin accounts |
| Customer area / admin pages → Reservation | `POST /reservations`, `GET /reservations`, `POST /reservations/{id}/paiement`, `PUT /reservations/{id}/annulation`, `PATCH /reservations/{id}/statut`, `GET /reservations/export.csv` | bookings (price computed by the server) |
| Contract → Reservation | `GET /reservations/{id}` (header `X-API-Key`) | create a contract from a confirmed booking |
| Return → Contract | `GET /contrats/{id}`, `PUT /contrats/{id}/statut` `{"statut":"CLOTURE"}` (header `X-API-Key`) | close the contract |
| Return → Vehicle | `PUT /vehicules/{id}/statut` (header `X-API-Key`) | vehicle back to `DISPONIBLE` or `MAINTENANCE` |

Database initialization on an empty volume: dump `Base_de_données/db_location_voitures.sql`, Contract migrations 002-005, Reservation 006, Vehicle 007 and Authentication 008 (`database/migrations`). Scripts run only on an empty data directory; for an existing volume, apply the missing migrations once or run `docker compose down -v`.

## Shared database and service discovery

The database connection is provided through `DATABASE_URL`. Each service uses the same MySQL instance and owns writes to its tables. With `compose.yaml`, Reservation calls Vehicle at `http://service_vehicule:8000` and Contract calls Reservation at `http://service_reservation:8000`; the browser frontend calls the published host ports. In multi-PC mode the same variables hold the other PCs' addresses (`IP_LEILA`, `IP_MARYAM`, `IP_SARA`, `IP_HASNA` in `.env`). Never write an IP address in the code.

Compose pins MySQL to 8.4.13, an official 8.4 LTS image. The official MySQL image and MySQL documentation distinguish the stable LTS track from the Innovation track: [official image tags](https://hub.docker.com/_/mysql?tab=tags), [MySQL release tracks](https://dev.mysql.com/doc/refman/8.4/en/mysql-releases.html).
