"""Service Réservation – PARC AUTO (lancement : uvicorn service_reservation.main:app)."""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .config import settings
from .database import Base, engine
from .erreurs import installer_gestionnaires
from .models import TABLES_PROPRES, Reservation
from .routes import router

logging.basicConfig(level=settings.LOG_LEVEL, format="%(asctime)s %(levelname)s %(name)s %(message)s")


def initialiser_tables() -> None:
    """Crée les tables propres au service si elles manquent (volume MySQL existant).
    La table partagée `reservations` n'est créée que pour SQLite (développement isolé)."""
    tables = list(TABLES_PROPRES)
    if engine.dialect.name == "sqlite":
        tables.insert(0, Reservation.__table__)
    Base.metadata.create_all(bind=engine, tables=tables, checkfirst=True)


initialiser_tables()

app = FastAPI(
    title="Service de Réservation – PARC AUTO",
    version="2.0.0",
    description=(
        "Réservations de véhicules (F001–F004). Authentification : jeton de `service_auth` "
        "(`Authorization: Bearer …`, rôles CLIENT / ADMINISTRATEUR) ou `X-API-Key` pour les services."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX or None,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-API-Key"],
    expose_headers=["X-Total-Count", "X-Total-Pages", "Content-Disposition"],
)

installer_gestionnaires(app)
app.include_router(router)


@app.get("/", tags=["Supervision"])
def accueil():
    return {"message": "Bienvenue dans le service de réservation"}


@app.get("/health", tags=["Supervision"])
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        from fastapi import HTTPException

        raise HTTPException(status_code=503, detail="Base de données indisponible") from exc
    return {"status": "ok", "service": "reservation"}
