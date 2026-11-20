from datetime import date
from decimal import Decimal
import secrets

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import models, reservation_client


def _numero_contrat() -> str:
    return f"CTR-{date.today():%Y}-{secrets.token_hex(4).upper()}"


def creer_contrat(db: Session, reservation_id: int, administrateur_id: int):
    reservation = reservation_client.obtenir_reservation(reservation_id)
    if reservation.get("statut") != "CONFIRMEE":
        raise HTTPException(status_code=409, detail="Seule une réservation confirmée peut donner lieu à un contrat")
    if db.query(models.Contrat).filter_by(reservation_id=reservation_id).first():
        raise HTTPException(status_code=409, detail="Un contrat existe déjà pour cette réservation")
    try:
        contrat = models.Contrat(
            numero_contrat=_numero_contrat(), date_generation=date.today(), statut="EN_ATTENTE",
            periode_prise=date.fromisoformat(str(reservation["date_debut"])),
            periode_fin=date.fromisoformat(str(reservation["date_fin"])),
            montant_total=Decimal(str(reservation["prix_total"])), reservation_id=reservation_id,
            administrateur_id=administrateur_id,
        )
        db.add(contrat)
        db.commit()
        db.refresh(contrat)
        return contrat
    except (KeyError, TypeError, ValueError) as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="La réponse de réservation ne respecte pas le format attendu") from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Un contrat existe déjà pour cette réservation") from exc


def ajouter_caution(db: Session, contrat: models.Contrat, montant: Decimal):
    if contrat.statut != "EN_ATTENTE":
        raise HTTPException(status_code=409, detail="La caution ne peut être modifiée qu'avant validation")
    contrat.montant_caution = montant
    db.commit()
    db.refresh(contrat)
    return contrat


def valider_contrat(db: Session, contrat: models.Contrat):
    if contrat.statut != "EN_ATTENTE":
        raise HTTPException(status_code=409, detail="Le contrat n'est pas en attente de validation")
    if contrat.montant_caution is None:
        raise HTTPException(status_code=409, detail="La caution doit être enregistrée avant la validation")
    contrat.statut = "VALIDE"
    contrat.date_validation = date.today()
    db.commit()
    db.refresh(contrat)
    return contrat


def cloturer_contrat(db: Session, contrat: models.Contrat):
    if contrat.statut != "VALIDE":
        raise HTTPException(status_code=409, detail="Seul un contrat validé peut être clôturé")
    contrat.statut = "CLOTURE"
    contrat.date_cloture = date.today()
    db.commit()
    db.refresh(contrat)
    return contrat
