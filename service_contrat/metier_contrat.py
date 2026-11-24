from datetime import date
from decimal import Decimal
import secrets

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import models, reservation_client
from .schemas import ContratFinalisation


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


def creer_contrat_valide(db: Session, confirmation: ContratFinalisation, administrateur_id: int):
    """Crée et valide le contrat en une seule transaction après signature du document."""
    reservation_id = confirmation.reservation_id
    reservation = reservation_client.obtenir_reservation(reservation_id)
    if reservation.get("statut") != "CONFIRMEE":
        raise HTTPException(status_code=409, detail="Seule une réservation confirmée peut donner lieu à un contrat")
    contrat_existant = db.query(models.Contrat).filter_by(reservation_id=reservation_id).first()
    if contrat_existant and contrat_existant.statut != "EN_ATTENTE":
        raise HTTPException(status_code=409, detail="Un contrat existe déjà pour cette réservation")
    try:
        aujourd_hui = date.today()
        if contrat_existant:
            # Permet de terminer un brouillon créé par l'ancienne version du parcours.
            contrat = contrat_existant
        else:
            contrat = models.Contrat(
                numero_contrat=confirmation.numero_contrat, date_generation=aujourd_hui,
                periode_prise=date.fromisoformat(str(reservation["date_debut"])),
                periode_fin=date.fromisoformat(str(reservation["date_fin"])),
                montant_total=Decimal(str(reservation["prix_total"])), reservation_id=reservation_id,
                administrateur_id=administrateur_id,
            )
            db.add(contrat)
        contrat.statut = "VALIDE"
        contrat.date_validation = aujourd_hui
        contrat.montant_caution = confirmation.montant_caution
        for champ in ("mode_encaissement", "statut_caution", "conditions_particulieres"):
            if champ in confirmation.model_fields_set:
                setattr(contrat, champ, getattr(confirmation, champ))
        db.commit()
        db.refresh(contrat)
        return contrat
    except (KeyError, TypeError, ValueError) as exc:
        db.rollback()
        raise HTTPException(status_code=503, detail="La réponse de réservation ne respecte pas le format attendu") from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Un contrat existe déjà pour cette réservation ou ce numéro") from exc


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
