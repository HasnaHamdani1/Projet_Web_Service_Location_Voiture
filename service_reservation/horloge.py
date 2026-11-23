"""Date du jour et bornes de mois dans le fuseau de l'agence."""
from datetime import date, datetime, timezone
from functools import lru_cache
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .config import settings


@lru_cache
def fuseau():
    try:
        return ZoneInfo(settings.APP_TIMEZONE)
    except ZoneInfoNotFoundError:
        return timezone.utc


def maintenant() -> datetime:
    return datetime.now(timezone.utc).astimezone(fuseau())


def aujourdhui() -> date:
    return maintenant().date()


def lire_mois(valeur: str | None) -> tuple[int, int]:
    if not valeur:
        n = maintenant()
        return n.year, n.month
    try:
        a, m = (int(x) for x in valeur.split("-"))
        if not 1 <= m <= 12:
            raise ValueError
        return a, m
    except ValueError as exc:
        raise ValueError("Format de mois attendu : AAAA-MM") from exc


def bornes_mois(annee: int, mois: int) -> tuple[date, date]:
    """[1er du mois, 1er du mois suivant) — appliqué à dateReservation."""
    return date(annee, mois, 1), date(annee + (mois == 12), mois % 12 + 1, 1)
