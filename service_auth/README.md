# Service Authentification

FastAPI service for customer registration, credential verification, and issuing HS256 JWT access tokens used by the Contract API.

## Endpoints

- `GET /health` - database health check.
- `POST /auth/inscription` - register a customer. Passwords must contain at least 12 characters and are stored as salted scrypt hashes.
- `POST /auth/token` - verify email/password and issue a bearer token.
- `GET /auth/me` - return the current token owner's profile.

There is no public administrator registration. Create the initial administrator interactively after Compose is running:

```powershell
docker compose exec service_auth python -m service_auth.create_admin
```

## Token contract

Tokens use `HS256` and contain `sub` as a positive user ID string, `role` as `CLIENT` or `ADMINISTRATEUR`, and `exp`. `JWT_SECRET` and `JWT_TTL_MINUTES` are configured through the shared root `.env`. The Contract service uses the same secret and claim names.

## Database and Compose

The service uses the shared MySQL `utilisateur`, `client`, and `administrateur` tables from `db_location_vehicules.sql`. It does not create or migrate shared tables at startup. Compose builds this API from `service_auth/Dockerfile` and exposes it on host port 8004.
