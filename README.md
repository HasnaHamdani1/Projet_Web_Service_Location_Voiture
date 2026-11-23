# LocationVoiture – PARC AUTO

Distributed car-rental application (G9). **Everyone runs the whole platform on their own machine from this repository**: no Tailscale and no teammate's PC is needed. The services talk to each other through their REST APIs on the Docker network and share **one** MySQL database, `db_location_voitures`.

## Start

1. Copy `.env.example` to `.env` and replace `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD` (letters and digits only) and `JWT_SECRET` (long random string).
2. From the repository root:

   ```powershell
   docker compose down -v        # only to restart from an empty database
   docker compose up --build
   docker compose exec service_auth python -m service_auth.create_admin   # first administrator
   ```

3. Open:

   | What | Address | Owner |
   |---|---|---|
   | Booking site (customers) + agency area `/admin` | http://localhost:3002 | Maryam |
   | Common frontend, fleet dashboard `/admin/login.html`, Contract pages `/Contrat/` | http://localhost:3000 | Leila, Sara |
   | Vehicle API | http://localhost:8005/docs | Leila |
   | Reservation API | http://localhost:8002/docs | Maryam |
   | Contract API | http://localhost:8003/docs | Sara |
   | Authentication API | http://localhost:8004/docs | Leila |
   | Return API | http://localhost:8006/docs | Hasna |

   | Return frontend (React) | http://localhost:5173 | Hasna |

Agency access to reservations: log in on http://localhost:3000/admin/login.html, then click **Réservations** in the menu (the admin token is passed to the booking site in `#jeton=…`).

Browser pages find the APIs on the same machine as the page (`frontend/server.py` writes `config.js`), so the same platform also works when opened from another computer (classroom network) with a single address to share. Set `AUTH_API_URL`, `VEHICLE_API_URL`… only to point elsewhere.

## REST links between services

| Caller → service | Route | Purpose |
|---|---|---|
| Reservation → Vehicle | `GET /vehicules`, `GET /vehicules/{id}` | catalogue, price, status, photo |
| Booking site → Auth | `POST /auth/inscription`, `/auth/token`, `GET /auth/me` | customer and admin accounts |
| Contract → Reservation | `GET /reservations/{id}` (header `X-API-Key`) | create a contract from a confirmed booking |
| Return → Contract | `GET /contrats/{id}`, `PUT /contrats/{id}/statut` `{"statut":"CLOTURE"}` | close the contract |
| Return → Vehicle | `PUT /vehicules/{id}/statut` | vehicle back to `DISPONIBLE` or `MAINTENANCE` |

Database initialization on an empty volume: dump `Base_de_données/db_location_voitures.sql`, Contract migrations 002-005, Reservation 006, Vehicle 007 (`database/migrations`). Scripts run only on an empty data directory; for an existing volume, apply the missing migrations once or run `docker compose down -v`.

## Shared database and service discovery

The database connection is provided through `DATABASE_URL`. Each service uses the same MySQL instance and owns writes to its tables. Reservation calls Vehicle at `http://service_vehicule:8000`; Contract calls Reservation at `http://service_reservation:8000`. The browser frontend calls the published host ports. Do not use `localhost` for container-to-container calls.

Compose pins MySQL to 8.4.13, an official 8.4 LTS image. The official MySQL image and MySQL documentation distinguish the stable LTS track from the Innovation track: [official image tags](https://hub.docker.com/_/mysql?tab=tags), [MySQL release tracks](https://dev.mysql.com/doc/refman/8.4/en/mysql-releases.html).
