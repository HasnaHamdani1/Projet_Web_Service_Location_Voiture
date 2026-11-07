from datetime import date
from decimal import Decimal
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from .auth import Principal, get_current_principal, require_admin
from .database import get_db
from .enums import ContractStatus, UserRole
from .models import Contract
from .reservation_client import get_reservation
from .schemas import ContractCreate, ContractRead


app = FastAPI(
    title="Service Contrat",
    description=(
        "API REST pour créer un contrat à partir d'une réservation confirmée "
        "et le consulter selon le rôle de l'utilisateur."
    ),
    version="1.0.0",
)


def trouver_contrat(db: Session, contrat_id: int) -> Contract:
    contrat = db.query(Contract).filter(Contract.id == contrat_id).first()
    if contrat is None:
        raise HTTPException(status_code=404, detail="Contrat introuvable")
    return contrat


@app.get("/", tags=["service"])
def accueil():
    return {"message": "Bienvenue dans le service Contrat"}


@app.get("/health", tags=["service"])
def health(db: Session = Depends(get_db)):
    try:
        db.connection().exec_driver_sql("SELECT 1")
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La base de données est indisponible",
        ) from exc
    return {"status": "ok", "service": "contrat"}


@app.post(
    "/contrats",
    response_model=ContractRead,
    status_code=status.HTTP_201_CREATED,
    tags=["contrats"],
)
def creer_contrat(
    demande: ContractCreate,
    db: Session = Depends(get_db),
    _administrateur: Principal = Depends(require_admin),
):
    reservation = get_reservation(demande.reservation_id)

    if reservation.statut != "CONFIRMEE":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un contrat peut être créé uniquement pour une réservation confirmée",
        )

    existe = (
        db.query(Contract)
        .filter(Contract.reservation_id == reservation.id)
        .first()
    )
    if existe is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un contrat existe déjà pour cette réservation",
        )

    date_du_jour = date.today()
    contrat = Contract(
        numero_contrat=f"CTR-{date_du_jour:%Y%m%d}-{uuid4().hex[:8].upper()}",
        date_generation=date_du_jour,
        statut=ContractStatus.EN_ATTENTE,
        periode_prise=reservation.date_debut,
        periode_fin=reservation.date_fin,
        montant_total=float(Decimal(reservation.prix_total)),
        reservation_id=reservation.id,
        client_id=reservation.client_id,
        vehicule_id=reservation.vehicule_id,
    )
    db.add(contrat)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        # A second request may have won the race after the duplicate pre-check.
        error_code = getattr(exc.orig, "args", (None,))[0]
        if error_code == 1062:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "La réservation possède déjà un contrat ou le numéro "
                    "de contrat est déjà utilisé"
                ),
            ) from exc
        raise

    db.refresh(contrat)
    return contrat


@app.get("/contrats", response_model=list[ContractRead], tags=["contrats"])
def lister_contrats(
    reservation_id: int | None = Query(default=None, gt=0),
    client_id: int | None = Query(default=None, gt=0),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
):
    requete = db.query(Contract)
    if principal.role == UserRole.CLIENT:
        if client_id is not None and client_id != principal.user_id:
            raise HTTPException(status_code=403, detail="Accès interdit")
        requete = requete.filter(Contract.client_id == principal.user_id)
    elif client_id is not None:
        requete = requete.filter(Contract.client_id == client_id)

    if reservation_id is not None:
        requete = requete.filter(Contract.reservation_id == reservation_id)

    return (
        requete.order_by(Contract.date_generation.desc(), Contract.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@app.get(
    "/contrats/{contrat_id}", response_model=ContractRead, tags=["contrats"]
)
def consulter_contrat(
    contrat_id: int,
    db: Session = Depends(get_db),
    principal: Principal = Depends(get_current_principal),
):
    contrat = trouver_contrat(db, contrat_id)
    if (
        principal.role == UserRole.CLIENT
        and contrat.client_id != principal.user_id
    ):
        # Do not disclose whether another customer's contract exists.
        raise HTTPException(status_code=404, detail="Contrat introuvable")
    return contrat
