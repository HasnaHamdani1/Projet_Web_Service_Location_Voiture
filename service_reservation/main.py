
import httpx
import os
from datetime import date
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from .database import engine, SessionLocal, Base
from . import models


# Création des tables dans la base de données
Base.metadata.create_all(bind=engine)


# Initialisation de l'application FastAPI
app = FastAPI(
    title="Service de Réservation",
    description="API REST pour gérer les réservations de voitures",
    version="1.0.0"
)


# Schéma pour recevoir les informations d'une réservation
class ReservationCreate(BaseModel):
    client_id: int
    vehicule_id: int
    date_debut: date
    date_fin: date


# Schéma pour le paiement simulé
class PaiementRequest(BaseModel):
    paiement_reussi: bool


# Gestion de la connexion à la base de données
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Communication avec le service Véhicule
def obtenir_vehicule(vehicule_id: int):
    vehicle_service_url = os.getenv(
        "VEHICLE_SERVICE_URL", "http://127.0.0.1:8000"
    ).rstrip("/")
    url = f"{vehicle_service_url}/vehicules/{vehicule_id}"

    try:
        response = httpx.get(url, timeout=5.0)

        if response.status_code == 404:
            return None

        response.raise_for_status()
        return response.json()

    except httpx.RequestError:
        raise HTTPException(
            status_code=503,
            detail="Le service Véhicule est indisponible"
        )


# Vérification de la disponibilité du véhicule
def verifier_disponibilite(
    vehicule_id: int,
    date_debut: date,
    date_fin: date,
    db: Session
):
    # Vérifier que le véhicule existe
    vehicule = obtenir_vehicule(vehicule_id)

    if vehicule is None:
        raise HTTPException(
            status_code=404,
            detail="Véhicule introuvable"
        )

    # Vérifier le statut du véhicule
    if vehicule["statut"] != "DISPONIBLE":
        raise HTTPException(
            status_code=400,
            detail="Ce véhicule n'est pas disponible"
        )

    # Vérifier que la date de début n'est pas dans le passé
    if date_debut < date.today():
        raise HTTPException(
            status_code=400,
            detail="La date de début ne peut pas être dans le passé"
        )

    # Vérifier la cohérence des dates
    if date_debut >= date_fin:
        raise HTTPException(
            status_code=400,
            detail="La date de fin doit être après la date de début"
        )

    # Vérifier les conflits avec les réservations existantes
    conflit = db.query(models.Reservation).filter(
        models.Reservation.vehicule_id == vehicule_id,
        models.Reservation.statut.in_(["EN_ATTENTE", "CONFIRMEE"]),
        models.Reservation.date_debut < date_fin,
        models.Reservation.date_fin > date_debut
    ).first()

    if conflit:
        raise HTTPException(
            status_code=400,
            detail="Ce véhicule est déjà réservé pour cette période"
        )

    return vehicule


# Route d'accueil
@app.get("/")
def accueil():
    return {
        "message": "Bienvenue dans le service de réservation"
    }


@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.connection().exec_driver_sql("SELECT 1")
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Base de données indisponible") from exc
    return {"status": "ok", "service": "reservation"}


# Lister toutes les réservations
@app.get("/reservations")
def lister_reservations(db: Session = Depends(get_db)):
    return db.query(models.Reservation).all()


# Consulter une réservation par son identifiant
@app.get("/reservations/{reservation_id}")
def consulter_reservation(
    reservation_id: int,
    db: Session = Depends(get_db)
):
    reservation = db.query(models.Reservation).filter(
        models.Reservation.id == reservation_id
    ).first()

    if reservation is None:
        raise HTTPException(
            status_code=404,
            detail="Réservation introuvable"
        )

    return reservation


# Tester la communication avec le service Véhicule
@app.get("/test-vehicule/{vehicule_id}")
def tester_vehicule(vehicule_id: int):
    vehicule = obtenir_vehicule(vehicule_id)

    if vehicule is None:
        raise HTTPException(
            status_code=404,
            detail="Véhicule introuvable"
        )

    return vehicule


# Créer une réservation
@app.post("/reservations")
def creer_reservation(
    reservation: ReservationCreate,
    db: Session = Depends(get_db)
):
    # Vérifier le véhicule et sa disponibilité
    vehicule = verifier_disponibilite(
        reservation.vehicule_id,
        reservation.date_debut,
        reservation.date_fin,
        db
    )

    # Calculer le nombre de jours
    nombre_jours = (
        reservation.date_fin - reservation.date_debut
    ).days

    # Calculer le prix total
    prix_total = nombre_jours * vehicule["prix_par_jour"]

    # Créer la réservation
    nouvelle_reservation = models.Reservation(
        client_id=reservation.client_id,
        vehicule_id=reservation.vehicule_id,
        date_debut=reservation.date_debut,
        date_fin=reservation.date_fin,
        prix_total=prix_total,
        statut="EN_ATTENTE"
    )

    db.add(nouvelle_reservation)
    db.commit()
    db.refresh(nouvelle_reservation)

    return {
        "message": "Réservation créée avec succès",
        "reservation": nouvelle_reservation
    }


# Paiement simulé et confirmation
@app.post("/reservations/{reservation_id}/paiement")
def effectuer_paiement(
    reservation_id: int,
    paiement: PaiementRequest,
    db: Session = Depends(get_db)
):
    # Rechercher la réservation
    reservation = db.query(models.Reservation).filter(
        models.Reservation.id == reservation_id
    ).first()

    if reservation is None:
        raise HTTPException(
            status_code=404,
            detail="Réservation introuvable"
        )

    # Seules les réservations en attente peuvent être payées
    if reservation.statut != "EN_ATTENTE":
        raise HTTPException(
            status_code=400,
            detail="Seules les réservations en attente peuvent être payées"
        )

    # Simuler le paiement
    if paiement.paiement_reussi:
        reservation.statut = "CONFIRMEE"
        db.commit()
        db.refresh(reservation)

        return {
            "message": "Paiement effectué avec succès",
            "reservation": reservation
        }

    else:
        return {
            "message": "Paiement refusé",
            "reservation_id": reservation.id,
            "statut": reservation.statut
        }


# Annulation de réservation
@app.put("/reservations/{reservation_id}/annulation")
def annuler_reservation(
    reservation_id: int,
    db: Session = Depends(get_db)
):
    # Rechercher la réservation
    reservation = db.query(models.Reservation).filter(
        models.Reservation.id == reservation_id
    ).first()

    # Vérifier son existence
    if reservation is None:
        raise HTTPException(
            status_code=404,
            detail="Réservation introuvable"
        )

    # Vérifier si elle est déjà annulée
    if reservation.statut == "ANNULEE":
        raise HTTPException(
            status_code=400,
            detail="Cette réservation est déjà annulée"
        )

    # Vérifier les statuts autorisés pour l'annulation
    if reservation.statut not in ["EN_ATTENTE", "CONFIRMEE"]:
        raise HTTPException(
            status_code=400,
            detail="Cette réservation ne peut pas être annulée"
        )

    # Vérifier que la réservation n'a pas commencé
    if date.today() >= reservation.date_debut:
        raise HTTPException(
            status_code=400,
            detail="Impossible d'annuler une réservation ayant commencé"
        )

    # Modifier le statut
    reservation.statut = "ANNULEE"

    db.commit()
    db.refresh(reservation)

    return {
        "message": "Réservation annulée avec succès",
        "reservation": reservation
    }
