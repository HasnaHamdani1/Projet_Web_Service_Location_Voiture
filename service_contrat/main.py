import os

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from . import metier_contrat, models, reservation_client
from .auth import current_user, require_admin
from .database import Base, engine, get_db
from .schemas import CautionCreate, ContratCreate, ContratDetail, ContratFinalisation, ContratRead

app = FastAPI(title="Service Contrat", description="Création et suivi des contrats de location.", version="1.0.0")
origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "").split(",") if origin.strip()]
if origins:
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False,
                       allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["Authorization", "Content-Type"])

Base.metadata.create_all(bind=engine)


def _charger_contrat(db: Session, contrat_id: int):
    contrat = db.query(models.Contrat).filter(models.Contrat.id == contrat_id).first()
    if contrat is None:
        raise HTTPException(status_code=404, detail="Contrat introuvable")
    return contrat


def _autoriser_lecture(contrat: models.Contrat, identity: dict) -> dict:
    reservation = reservation_client.obtenir_reservation(contrat.reservation_id)
    if identity["role"] != "ADMINISTRATEUR" and reservation.get("client_id") != identity["id"]:
        raise HTTPException(status_code=403, detail="Ce contrat ne vous appartient pas")
    return reservation


@app.get("/")
def accueil():
    return {"message": "Bienvenue dans le service Contrat"}


@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.connection().exec_driver_sql("SELECT 1")
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Base de données indisponible") from exc
    return {"status": "ok", "service": "contrat"}


@app.post("/contrats", response_model=ContratRead, status_code=201)
def creer_contrat(demande: ContratCreate, identity: dict = Depends(require_admin), db: Session = Depends(get_db)):
    return metier_contrat.creer_contrat(db, demande.reservation_id, identity["id"])


@app.get("/contrats", response_model=list[ContratDetail])
def lister_contrats(statut: str | None = Query(default=None, pattern="^(EN_ATTENTE|VALIDE|CLOTURE)$"),
                    identity: dict = Depends(current_user), db: Session = Depends(get_db)):
    query = db.query(models.Contrat)
    if statut:
        query = query.filter(models.Contrat.statut == statut)
    if identity["role"] == "CLIENT":
        reservations_client = reservation_client.lister_reservations()
        reservation_ids = [
            int(reservation["id"])
            for reservation in reservations_client
            if int(reservation.get("client_id", -1)) == identity["id"]
        ]
        if not reservation_ids:
            return []
        query = query.filter(models.Contrat.reservation_id.in_(reservation_ids))
    result = []
    for contrat in query.order_by(models.Contrat.id.desc()).all():
        reservation = _autoriser_lecture(contrat, identity)
        result.append({**ContratRead.model_validate(contrat).model_dump(), "reservation": reservation})
    return result


@app.get("/contrats/{contrat_id}", response_model=ContratDetail)
def lire_contrat(contrat_id: int, identity: dict = Depends(current_user), db: Session = Depends(get_db)):
    contrat = _charger_contrat(db, contrat_id)
    reservation = _autoriser_lecture(contrat, identity)
    return {**ContratRead.model_validate(contrat).model_dump(), "reservation": reservation}


@app.get("/contrats/numero/{numero_contrat}", response_model=ContratDetail)
def lire_par_numero(numero_contrat: str, identity: dict = Depends(current_user), db: Session = Depends(get_db)):
    contrat = db.query(models.Contrat).filter(models.Contrat.numero_contrat == numero_contrat).first()
    if contrat is None:
        raise HTTPException(status_code=404, detail="Contrat introuvable")
    reservation = _autoriser_lecture(contrat, identity)
    return {**ContratRead.model_validate(contrat).model_dump(), "reservation": reservation}


@app.post("/contrats/{contrat_id}/caution", response_model=ContratRead)
def enregistrer_caution(contrat_id: int, demande: CautionCreate,
                        identity: dict = Depends(require_admin), db: Session = Depends(get_db)):
    contrat = _charger_contrat(db, contrat_id)
    return metier_contrat.ajouter_caution(db, contrat, demande.montant_caution)


@app.post("/contrats/{contrat_id}/validation", response_model=ContratRead)
def valider(contrat_id: int, identity: dict = Depends(current_user), db: Session = Depends(get_db)):
    contrat = _charger_contrat(db, contrat_id)
    _autoriser_lecture(contrat, identity)
    if identity["role"] != "CLIENT":
        raise HTTPException(status_code=403, detail="La validation est réservée au client")
    return metier_contrat.valider_contrat(db, contrat)


@app.post("/contrats/finalisation", response_model=ContratRead, status_code=201)
def finaliser_contrat(
    confirmation: ContratFinalisation,
    identity: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Crée et valide le contrat à la dernière étape, après confirmation des signatures."""
    if confirmation.signatures_confirmees is not True:
        raise HTTPException(status_code=400, detail="La confirmation des signatures est obligatoire")
    return metier_contrat.creer_contrat_valide(
        db,
        confirmation.reservation_id,
        identity["id"],
        confirmation.numero_contrat,
        confirmation.montant_caution,
    )


@app.post("/contrats/{contrat_id}/cloture", response_model=ContratRead)
def cloturer(contrat_id: int, identity: dict = Depends(require_admin), db: Session = Depends(get_db)):
    contrat = _charger_contrat(db, contrat_id)
    return metier_contrat.cloturer_contrat(db, contrat)
