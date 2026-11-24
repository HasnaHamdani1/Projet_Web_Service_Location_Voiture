from dotenv import load_dotenv
load_dotenv()

import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from acces import admin_vehicules, admin_vehicules_ou_service
from database import engine, Base, SessionLocal
from models import Vehicule
from pydantic import BaseModel, Field
from enum import Enum
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session


app = FastAPI(title="Service Véhicule")

# Autoriser le dashboard local à communiquer avec l'API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Dossier de stockage des photos
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Rendre les photos accessibles via l'API
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Base unique : le schéma MySQL est géré par les scripts SQL (dump + migrations), jamais au démarrage.
if engine.url.get_backend_name() == "sqlite":
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


# Modèle de validation pour l'ajout
class VehiculeCreate(BaseModel):
    immatriculation: str
    marque: str
    modele: str
    annee: int = Field(ge=1950, le=2100)
    prix_par_jour: float = Field(gt=0)
    statut: StatutVehicule = StatutVehicule.DISPONIBLE
    # Renseigné par le serveur avec l'administrateur connecté (jeton) ; la valeur envoyée est ignorée
    administrateur_id: int | None = Field(default=None, gt=0)


# Modèle de validation pour la modification
class VehiculeUpdate(BaseModel):
    immatriculation: str
    marque: str
    modele: str
    annee: int = Field(ge=1950, le=2100)
    prix_par_jour: float = Field(gt=0)
    statut: StatutVehicule


# Modèle de validation pour le changement de statut (service Retour)
class StatutUpdate(BaseModel):
    statut: StatutVehicule


# Accueil
@app.get("/")
def accueil():
    return {"message": "Bienvenue dans le Service Véhicule"}


# Vérifier la connexion à la base
@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.connection().exec_driver_sql("SELECT 1")
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Base de données indisponible"
        ) from exc

    return {"status": "ok", "service": "vehicule"}


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
    db: Session = Depends(get_db),
    admin: dict = Depends(admin_vehicules)
):
    vehicule_existant = db.query(Vehicule).filter(
        Vehicule.immatriculation == nouveau.immatriculation
    ).first()

    if vehicule_existant:
        raise HTTPException(
            status_code=400,
            detail="Cette immatriculation existe déjà"
        )

    vehicule = Vehicule(**{**nouveau.model_dump(), "administrateur_id": admin["id"]})

    db.add(vehicule)
    db.commit()
    db.refresh(vehicule)

    return vehicule


# Modifier un véhicule
@app.put("/vehicules/{vehicule_id}")
def modifier_vehicule(
    vehicule_id: int,
    donnees: VehiculeUpdate,
    db: Session = Depends(get_db),
    _admin: dict = Depends(admin_vehicules)
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


# Changer uniquement le statut (appelé par le service Retour après un retour)
@app.put("/vehicules/{vehicule_id}/statut")
def modifier_statut_vehicule(
    vehicule_id: int,
    donnees: StatutUpdate,
    db: Session = Depends(get_db),
    _acteur: dict = Depends(admin_vehicules_ou_service)
):
    vehicule = db.query(Vehicule).filter(
        Vehicule.id == vehicule_id
    ).first()

    if vehicule is None:
        raise HTTPException(
            status_code=404,
            detail="Véhicule introuvable"
        )

    vehicule.statut = donnees.statut.value
    db.commit()
    db.refresh(vehicule)

    return vehicule


# Ajouter ou remplacer la photo d'un véhicule
@app.post("/vehicules/{vehicule_id}/image")
async def ajouter_image_vehicule(
    vehicule_id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin: dict = Depends(admin_vehicules)
):
    vehicule = db.query(Vehicule).filter(
        Vehicule.id == vehicule_id
    ).first()

    if vehicule is None:
        raise HTTPException(
            status_code=404,
            detail="Véhicule introuvable"
        )

    types_autorises = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp"
    }

    if image.content_type not in types_autorises:
        raise HTTPException(
            status_code=400,
            detail="Format non autorisé. Utilisez JPG, PNG ou WEBP."
        )

    contenu = await image.read()

    if not contenu:
        raise HTTPException(status_code=400, detail="Image vide.")

    if len(contenu) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="La taille maximale de l'image est de 5 Mo."
        )

    extension = types_autorises[image.content_type]
    nom_fichier = f"{uuid.uuid4().hex}{extension}"
    chemin_fichier = UPLOAD_DIR / nom_fichier

    chemin_fichier.write_bytes(contenu)

    ancien_chemin = vehicule.image_url

    try:
        vehicule.image_url = f"/uploads/{nom_fichier}"
        db.commit()
        db.refresh(vehicule)
    except Exception:
        db.rollback()
        chemin_fichier.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail="Impossible d'enregistrer la photo."
        )

    # Supprimer l'ancienne photo après le remplacement réussi
    if ancien_chemin and ancien_chemin.startswith("/uploads/"):
        ancien_fichier = UPLOAD_DIR / ancien_chemin.split("/")[-1]
        if ancien_fichier != chemin_fichier:
            ancien_fichier.unlink(missing_ok=True)

    return {
        "message": "Photo enregistrée avec succès.",
        "image_url": vehicule.image_url
    }


# Supprimer un véhicule
@app.delete("/vehicules/{vehicule_id}")
def supprimer_vehicule(
    vehicule_id: int,
    db: Session = Depends(get_db),
    _admin: dict = Depends(admin_vehicules)
):
    vehicule = db.query(Vehicule).filter(
        Vehicule.id == vehicule_id
    ).first()

    if vehicule is None:
        raise HTTPException(
            status_code=404,
            detail="Véhicule introuvable"
        )

    identifiant = vehicule.id
    immatriculation = vehicule.immatriculation

    db.delete(vehicule)
    db.commit()

    return {
        "message": "Véhicule supprimé avec succès",
        "vehicule": {
            "id": identifiant,
            "immatriculation": immatriculation
        }
    }

