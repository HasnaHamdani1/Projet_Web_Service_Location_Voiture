
from fastapi import FastAPI, HTTPException, Depends
from database import engine, Base, SessionLocal
from models import Vehicule
from pydantic import BaseModel, Field
from enum import Enum
from sqlalchemy.orm import Session


app = FastAPI(title="Service Véhicule")

Base.metadata.create_all(bind=engine)


# Connexion à la base de données
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Statuts autorisés
class StatutVehicule(str, Enum):
    DISPONIBLE = "DISPONIBLE"
    RESERVE = "RESERVE"
    LOUE = "LOUE"
    MAINTENANCE = "MAINTENANCE"


# Modèles de validation
class VehiculeCreate(BaseModel):
    immatriculation: str
    marque: str
    modele: str
    prix_par_jour: float = Field(gt=0)
    statut: StatutVehicule = StatutVehicule.DISPONIBLE


class VehiculeUpdate(BaseModel):
    immatriculation: str
    marque: str
    modele: str
    prix_par_jour: float = Field(gt=0)
    statut: StatutVehicule


# Accueil
@app.get("/")
def accueil():
    return {"message": "Bienvenue dans le Service Véhicule"}


# Récupérer tous les véhicules
@app.get("/vehicules")
def get_vehicules(db: Session = Depends(get_db)):
    return db.query(Vehicule).all()


# Récupérer un véhicule par son identifiant
@app.get("/vehicules/{vehicule_id}")
def obtenir_vehicule(
    vehicule_id: int,
    db: Session = Depends(get_db)
):
    vehicule = db.query(Vehicule).filter(
        Vehicule.id == vehicule_id
    ).first()

    if vehicule is None:
        raise HTTPException(
            status_code=404,
            detail="Véhicule introuvable"
        )

    return vehicule


# Ajouter un véhicule
@app.post("/vehicules", status_code=201)
def ajouter_vehicule(
    nouveau: VehiculeCreate,
    db: Session = Depends(get_db)
):
    vehicule_existant = db.query(Vehicule).filter(
        Vehicule.immatriculation == nouveau.immatriculation
    ).first()

    if vehicule_existant:
        raise HTTPException(
            status_code=400,
            detail="Cette immatriculation existe déjà"
        )

    vehicule = Vehicule(**nouveau.model_dump())

    db.add(vehicule)
    db.commit()
    db.refresh(vehicule)

    return vehicule


# Modifier un véhicule
@app.put("/vehicules/{vehicule_id}")
def modifier_vehicule(
    vehicule_id: int,
    donnees: VehiculeUpdate,
    db: Session = Depends(get_db)
):
    vehicule = db.query(Vehicule).filter(
        Vehicule.id == vehicule_id
    ).first()

    if vehicule is None:
        raise HTTPException(
            status_code=404,
            detail="Véhicule introuvable"
        )

    autre = db.query(Vehicule).filter(
        Vehicule.immatriculation == donnees.immatriculation,
        Vehicule.id != vehicule_id
    ).first()

    if autre:
        raise HTTPException(
            status_code=400,
            detail="Cette immatriculation existe déjà"
        )

    for champ, valeur in donnees.model_dump().items():
        setattr(vehicule, champ, valeur)

    db.commit()
    db.refresh(vehicule)

    return vehicule


# Supprimer un véhicule
@app.delete("/vehicules/{vehicule_id}")
def supprimer_vehicule(
    vehicule_id: int,
    db: Session = Depends(get_db)
):
    vehicule = db.query(Vehicule).filter(
        Vehicule.id == vehicule_id
    ).first()

    if vehicule is None:
        raise HTTPException(
            status_code=404,
            detail="Véhicule introuvable"
        )

    db.delete(vehicule)
    db.commit()

    return {
        "message": "Véhicule supprimé avec succès",
        "vehicule": {
            "id": vehicule.id,
            "immatriculation": vehicule.immatriculation
        }
    }
