"""Calcul du prix (fonctions pures).

Durée = date_fin − date_debut en jours (période début incluse, fin exclue — TEAM_SYNC §3.3).
Location = durée × tarif ; Assistance = durée × 6,00 si cochée ; Total TTC = somme ;
TVA incluse = Total × 20/120 ; dépôt de garantie affiché à part (500,00).
"""
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from .config import settings

CENT = Decimal("0.01")


def arrondi(valeur) -> Decimal:
    return Decimal(str(valeur)).quantize(CENT, rounding=ROUND_HALF_UP)


def nombre_jours(date_debut: date, date_fin: date) -> int:
    return (date_fin - date_debut).days


@dataclass(frozen=True)
class Devis:
    duree_jours: int
    tarif_journalier: Decimal
    tarif_assistance: Decimal
    montant_location: Decimal
    montant_assistance: Decimal
    montant_total: Decimal
    montant_tva: Decimal
    taux_tva: Decimal
    depot_garantie: Decimal
    devise: str

    def en_dict(self) -> dict:
        return {k: (float(v) if isinstance(v, Decimal) else v) for k, v in self.__dict__.items()}


def tva_incluse(total: Decimal) -> Decimal:
    taux = settings.VAT_RATE
    return arrondi(total * taux / (Decimal(1) + taux))


def calculer_devis(duree_jours: int, tarif_journalier: Decimal, assistance: bool) -> Devis:
    if duree_jours <= 0:
        raise ValueError("La durée de location doit être d'au moins 1 jour")
    tarif = arrondi(tarif_journalier)
    tarif_assist = arrondi(settings.ASSISTANCE_DAILY_FEE)
    location = arrondi(tarif * duree_jours)
    assist = arrondi(tarif_assist * duree_jours) if assistance else arrondi(0)
    total = arrondi(location + assist)
    return Devis(
        duree_jours=duree_jours,
        tarif_journalier=tarif,
        tarif_assistance=tarif_assist,
        montant_location=location,
        montant_assistance=assist,
        montant_total=total,
        montant_tva=tva_incluse(total),
        taux_tva=settings.VAT_RATE,
        depot_garantie=arrondi(settings.SECURITY_DEPOSIT),
        devise=settings.DEVISE,
    )
