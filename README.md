# LocationVoiture

Distributed car-rental application. The current Compose stack runs Vehicle, Reservation, Contract (with its frontend), and Authentication against one MySQL database.

## Start the available services

1. Copy `.env.example` to `.env` and replace the example MySQL passwords and JWT secret. Use URL-safe characters in `MYSQL_PASSWORD`, because Compose builds the SQLAlchemy URL from it.
2. From the repository root, run:

   ```powershell
   docker compose up --build
   ```

3. Available local API endpoints:

   - Vehicle: `http://localhost:8001/docs`
   - Reservation: `http://localhost:8002/docs`
   - Contract: `http://localhost:8003/docs`
   - Authentication: `http://localhost:8004/docs`
   - Contract frontend: `http://localhost:8003/`
   - MySQL is available to containers at `mysql:3306`; it is not published to the host.

Compose initializes a new MySQL volume from `Base_de_données/db_location_voitures.sql`, then applies Contract migrations 002-006. The volume is named `mysql_data_location_voitures` so the previous local database volume is left intact. Initialization scripts run only when MySQL creates an empty data directory. Existing volumes need the unapplied migrations run manually before deploying a newer Contract service.

## Current scope and integration gaps

- The Compose stack includes the services currently present in the repository. The Return service is not yet present; its implementation is assigned to its owner.
- The Contract frontend supports login and contract workflows. It is served from the Contract container; Authentication, Vehicle, and Reservation remain separate APIs. The Reservation API has no client-specific reservation-list endpoint, so reservations created elsewhere may not be listed for the current client.
- Contract endpoints require JWTs signed with `JWT_SECRET`, with `sub` as a numeric user ID string and `role` as `CLIENT` or `ADMINISTRATEUR`. The Auth API issues this format. Register customers at `POST /auth/inscription` and obtain tokens at `POST /auth/token`. Create the first administrator interactively with `docker compose exec service_auth python -m service_auth.create_admin`.
- Contract extension annexes are implemented, but end-to-end extensions wait for the Reservation owner to implement `POST /reservations/{reservation_id}/prolongations` with atomic availability checks and idempotency, as specified in [TEAM_SYNC.md](TEAM_SYNC.md).
- Vehicle and Reservation retain SQLite defaults for direct local development. Compose supplies the shared MySQL `DATABASE_URL` to both services.
- The SQL dump was generated from MariaDB; the Compose stack uses the MySQL 8.4 LTS image. If the initialization import fails due to MariaDB-specific SQL, update the canonical schema/migrations rather than switching the Compose database silently.
- The new shared dump uses plural table names and camelCase columns. Contract and Authentication have been mapped to it; Vehicle and Reservation still need their ORM mappings and required insert fields aligned before the complete Compose stack can run against this database.

## Shared database and service discovery

The database connection is provided through `DATABASE_URL`. Each service uses the same MySQL instance and owns writes to its tables. Reservation calls Vehicle at `http://service_vehicule:8000`; Contract calls Reservation at `http://service_reservation:8000`. The browser frontend calls the published host ports. Do not use `localhost` for container-to-container calls.

Compose pins MySQL to 8.4.13, an official 8.4 LTS image. The official MySQL image and MySQL documentation distinguish the stable LTS track from the Innovation track: [official image tags](https://hub.docker.com/_/mysql?tab=tags), [MySQL release tracks](https://dev.mysql.com/doc/refman/8.4/en/mysql-releases.html).
