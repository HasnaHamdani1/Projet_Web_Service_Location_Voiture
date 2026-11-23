"""Connexion à la base partagée (DATABASE_URL), une session par requête."""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


_options: dict = {"pool_pre_ping": True}
if settings.DATABASE_URL.startswith("sqlite"):
    _options["connect_args"] = {"check_same_thread": False}
else:
    _options["pool_recycle"] = 1800
    # Chaque lecture voit les dernières données validées : après avoir obtenu le verrou d'un véhicule,
    # la recherche de conflits voit bien la réservation que la requête concurrente vient d'enregistrer
    # (en REPEATABLE READ, InnoDB lirait l'instantané pris au début de la transaction).
    _options["isolation_level"] = "READ COMMITTED"

engine = create_engine(settings.DATABASE_URL, **_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
