import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .auth import Principal, get_current_principal, require_admin
from .database import get_db
from .enums import ContractStatus, UserRole
from .main_helpers import trouver_contrat
from .models import Contract, ContractExtension
from .reservation_client import extend_reservation
from .schemas import ExtensionCreate, ExtensionRead


logger = logging.getLogger("service_contrat")
router = APIRouter(tags=["prolongations"])


def trouver_contrat(db: Session, contrat_id: int) -> Contract:
    contrat = db.query(Contract).filter(Contract.id == contrat_id).first()
    if contrat is None:
        raise HTTPException(404, "Contrat introuvable")
    return contrat


@router.post(
    "/contrats/{contrat_id}/prolongations",
    response_model=ExtensionRead,
    status_code=status.HTTP_201_CREATED,
)
def creer_prolongation(
    contrat_id: int,
    demande: ExtensionCreate,
    idempotency_key: str = Header(alias="Idempotency-Key", min_length=36, max_length=36),
    db: Session = Depends(get_db),
    administrateur: Principal = Depends(require_admin),
):
    try:
        cle = str(UUID(idempotency_key))
    except ValueError as exc:
        raise HTTPException(422, "Idempotency-Key doit être un UUID valide") from exc

    existante = (
        db.query(ContractExtension)
        .filter(ContractExtension.idempotency_key == cle)
        .first()
    )
    if existante:
        if existante.contrat_id != contrat_id or existante.date_fin != demande.nouvelle_date_fin:
            raise HTTPException(409, "Clé d'idempotence déjà utilisée pour une autre demande")
        return existante

    contrat = trouver_contrat(db, contrat_id)
    if contrat.statut != ContractStatus.VALIDE or contrat.reservation_id is None:
        raise HTTPException(409, "Seul un contrat validé lié à une réservation peut être prolongé")

    derniere = (
        db.query(ContractExtension)
        .filter(ContractExtension.contrat_id == contrat_id)
        .order_by(ContractExtension.date_fin.desc())
        .first()
    )
    fin_actuelle = derniere.date_fin if derniere else contrat.periode_fin
    if demande.nouvelle_date_fin <= fin_actuelle:
        raise HTTPException(422, "La nouvelle date doit être postérieure à la fin actuelle")

    resultat = extend_reservation(
        contrat.reservation_id, demande.nouvelle_date_fin.isoformat(), cle
    )
    if (
        resultat.date_fin_precedente != fin_actuelle
        or resultat.date_fin != demande.nouvelle_date_fin
    ):
        raise HTTPException(502, "La période retournée par Réservation ne correspond pas à la demande")

    prolongation = ContractExtension(
        contrat_id=contrat_id,
        reservation_prolongation_id=resultat.prolongation_id,
        idempotency_key=cle,
        date_fin_precedente=resultat.date_fin_precedente,
        date_fin=resultat.date_fin,
        montant_supplementaire=float(resultat.montant_supplementaire),
        date_creation=datetime.now(timezone.utc).replace(tzinfo=None),
    )
    db.add(prolongation)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        existante = (
            db.query(ContractExtension)
            .filter(ContractExtension.idempotency_key == cle)
            .first()
        )
        if existante:
            return existante
        raise HTTPException(409, "La prolongation existe déjà ou entre en conflit") from exc

    db.refresh(prolongation)
    logger.info(
        "contract_extended contract_id=%s extension_id=%s actor_user_id=%s",
        contrat_id,
        prolongation.id,
        administrateur.user_id,
    )
    return prolongation


@router.get(
    "/contrats/{contrat_id}/prolongations",
    response_model=list[ExtensionRead],
)
def lister_prolongations(
    contrat_id: int,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
):
    contrat = trouver_contrat(db, contrat_id)
    if principal.role == UserRole.CLIENT and contrat.client_id != principal.user_id:
        raise HTTPException(404, "Contrat introuvable")
    return (
        db.query(ContractExtension)
        .filter(ContractExtension.contrat_id == contrat_id)
        .order_by(ContractExtension.date_fin.asc())
        .all()
    )
