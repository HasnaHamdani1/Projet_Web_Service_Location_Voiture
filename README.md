# LocationVoiture

Distributed car-rental application. The current Compose stack runs the Vehicle, Reservation, and Contract APIs against one MySQL database.

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
   - MySQL is available to containers at `mysql:3306`; it is not published to the host.

Compose initializes a new MySQL volume from `db_location_vehicules.sql`, then applies Contract migrations 002-005. Initialization scripts run only when MySQL creates an empty data directory. Existing volumes need the unapplied migrations run manually before deploying a newer Contract service.

## Current scope and integration gaps

- The Compose stack includes the services currently present in the repository. Return, Authentication/token-issuing, and frontend services have not been added yet.
- Contract endpoints require JWTs signed with `JWT_SECRET`, with `sub` as a numeric user ID string and `role` as `CLIENT` or `ADMINISTRATEUR`. There is not yet an Auth API in this repository to issue those tokens.
- Contract extension annexes are implemented, but end-to-end extensions wait for the Reservation owner to implement `POST /reservations/{reservation_id}/prolongations` with atomic availability checks and idempotency, as specified in [TEAM_SYNC.md](TEAM_SYNC.md).
- Vehicle and Reservation retain SQLite defaults for direct local development. Compose supplies the shared MySQL `DATABASE_URL` to both services.
- The SQL dump was generated from MariaDB; the Compose stack uses the MySQL 8.4 LTS image. If the initialization import fails due to MariaDB-specific SQL, update the canonical schema/migrations rather than switching the Compose database silently.

## Shared database and service discovery

The database connection is provided through `DATABASE_URL`. Each service uses the same MySQL instance and owns writes to its tables. Reservation calls Vehicle at `http://service_vehicule:8000`; Contract calls Reservation at `http://service_reservation:8000`. Do not use `localhost` for container-to-container calls.

Compose pins MySQL to 8.4.13, an official 8.4 LTS image. The official MySQL image and MySQL documentation distinguish the stable LTS track from the Innovation track: [official image tags](https://hub.docker.com/_/mysql?tab=tags), [MySQL release tracks](https://dev.mysql.com/doc/refman/8.4/en/mysql-releases.html).
