import os

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from . import metier_contrat, models, reservation_client
from .auth import require_admin_contrats, require_admin_contrats_ou_service
from .database import Base, engine, get_db
from .schemas import (
    CautionCreate,
    ContratCreate,
    ContratDetail,
    ContratFinalisation,
    ContratRead,
    ContratStatutUpdate,
)

app = FastAPI(title="Service Contrat", description="Création et suivi des contrats de location.", version="1.0.0")
origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "").split(",") if origin.strip()]
# CORS_ORIGINS + pages Contrat servies par le frontend commun (3000) ou Live Server (5500), sur n'importe quelle machine
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_origin_regex=r"https?://[^/]+:(3000|5500)",
                   allow_credentials=False, allow_methods=["GET", "POST", "PUT", "OPTIONS"],
                   allow_headers=["Authorization", "Content-Type"])

Base.metadata.create_all(bind=engine)


def _charger_contrat(db: Session, contrat_id: int):
    contrat = db.query(models.Contrat).filter(models.Contrat.id == contrat_id).first()
    if contrat is None:
        raise HTTPException(status_code=404, detail="Contrat introuvable")
    return contrat


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
def creer_contrat(demande: ContratCreate, db: Session = Depends(get_db),
                  admin: dict = Depends(require_admin_contrats)):
    return metier_contrat.creer_contrat(db, demande.reservation_id, admin["id"])


@app.get("/contrats", response_model=list[ContratDetail])
def lister_contrats(statut: str | None = Query(default=None, pattern="^(EN_ATTENTE|VALIDE|CLOTURE)$"),
                    db: Session = Depends(get_db)):
    query = db.query(models.Contrat)
    if statut:
        query = query.filter(models.Contrat.statut == statut)
    result = []
    for contrat in query.order_by(models.Contrat.id.desc()).all():
        reservation = reservation_client.obtenir_reservation(contrat.reservation_id)
        result.append({**ContratRead.model_validate(contrat).model_dump(), "reservation": reservation})
    return result


@app.get("/contrats/{contrat_id}", response_model=ContratDetail)
def lire_contrat(contrat_id: int, db: Session = Depends(get_db)):
    contrat = _charger_contrat(db, contrat_id)
    reservation = reservation_client.obtenir_reservation(contrat.reservation_id)
    return {**ContratRead.model_validate(contrat).model_dump(), "reservation": reservation}


@app.get("/contrats/numero/{numero_contrat}", response_model=ContratDetail)
def lire_par_numero(numero_contrat: str, db: Session = Depends(get_db)):
    contrat = db.query(models.Contrat).filter(models.Contrat.numero_contrat == numero_contrat).first()
    if contrat is None:
        raise HTTPException(status_code=404, detail="Contrat introuvable")
    reservation = reservation_client.obtenir_reservation(contrat.reservation_id)
    return {**ContratRead.model_validate(contrat).model_dump(), "reservation": reservation}


@app.post("/contrats/{contrat_id}/caution", response_model=ContratRead)
def enregistrer_caution(contrat_id: int, demande: CautionCreate, db: Session = Depends(get_db),
                        _admin: dict = Depends(require_admin_contrats)):
    contrat = _charger_contrat(db, contrat_id)
    return metier_contrat.ajouter_caution(db, contrat, demande.montant_caution)


@app.post("/contrats/{contrat_id}/validation", response_model=ContratRead)
def valider(contrat_id: int, db: Session = Depends(get_db), _admin: dict = Depends(require_admin_contrats)):
    contrat = _charger_contrat(db, contrat_id)
    return metier_contrat.valider_contrat(db, contrat)


@app.post("/contrats/finalisation", response_model=ContratRead, status_code=201)
def finaliser_contrat(
    confirmation: ContratFinalisation,
    db: Session = Depends(get_db),
    admin: dict = Depends(require_admin_contrats),
):
    """Crée et valide le contrat à la dernière étape, après confirmation des signatures."""
    if confirmation.signatures_confirmees is not True:
        raise HTTPException(status_code=400, detail="La confirmation des signatures est obligatoire")
    return metier_contrat.creer_contrat_valide(
        db,
        confirmation,
        admin["id"],
    )


@app.put("/contrats/{contrat_id}/statut", response_model=ContratRead)
def modifier_statut(contrat_id: int, demande: ContratStatutUpdate, db: Session = Depends(get_db),
                    _acteur: dict = Depends(require_admin_contrats_ou_service)):
    contrat = _charger_contrat(db, contrat_id)
    return metier_contrat.cloturer_contrat(db, contrat)
