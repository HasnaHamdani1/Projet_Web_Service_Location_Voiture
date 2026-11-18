
from datetime import date
from decimal import Decimal
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from database import get_db
from models import Retour
from schemas import RetourCreate, RetourUpdate, RetourResponse
from retour_service import retour_service


app = FastAPI(
    title="Microservice Gestion des Retours",
    description="API REST pour la gestion des retours de véhicules",
    version="1.0.0"
)

# ==========================================
# Configuration CORS - Communication React
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ==========================================
# 1. Route d'accueil
# ==========================================

@app.get("/")
def accueil():
    return {
        "message": "Microservice Retour opérationnel"
    }


# ==========================================
# 2. Vérifier la connexion à la base de données
# ==========================================

@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))

        return {
            "status": "OK",
            "database": "Connectée"
        }

    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Base de données indisponible"
        )


# ==========================================
# 3. Récupérer tous les retours
# ==========================================

@app.get("/retours", response_model=list[RetourResponse])
def obtenir_tous_les_retours(
    db: Session = Depends(get_db)
):

    retours = db.query(Retour).order_by(
        Retour.id.desc()
    ).all()

    return retours


# ==========================================
# Récupérer les retours avec les informations
# du contrat, de la réservation et du véhicule
# ==========================================

@app.get("/retours/liste")
def obtenir_liste_retours(db: Session = Depends(get_db)):

    requete = text("""
        SELECT
            r.id AS id,
            c.numeroContrat AS contrat,
            v.immatriculation AS immat,
            CONCAT(v.marque, ' ', v.modele) AS vehicule,
            res.dateFin AS prevu,
            r.dateRetour AS effectif,
            r.dureeRetardJours AS retard,
            r.etatVehicule AS etat
        FROM retours r
        INNER JOIN contrats c
            ON r.contrat_id = c.id
        INNER JOIN reservations res
            ON c.reservation_id = res.id
        INNER JOIN vehicules v
            ON res.vehicule_id = v.id
        ORDER BY r.id DESC
    """)

    resultats = db.execute(requete).mappings().all()

    liste = []

    for r in resultats:

        etats = {
            "BON": "Bon état",
            "LEGER_DOMMAGE": "Léger dommage",
            "DOMMAGE_IMPORTANT": "Dommage important"
        }

        liste.append({
            "id": r["id"],
            "contrat": r["contrat"],
            "immat": r["immat"],
            "vehicule": r["vehicule"],
            "prevu": r["prevu"],
            "effectif": r["effectif"],
            "retard": r["retard"],
            "etat": etats.get(str(r["etat"]), str(r["etat"]))
        })

    return liste

# ==========================================
# 4. Récupérer un retour par son identifiant
# ==========================================

@app.get("/retours/{retour_id}", response_model=RetourResponse)
def obtenir_retour(
    retour_id: int,
    db: Session = Depends(get_db)
):

    retour = db.query(Retour).filter(
        Retour.id == retour_id
    ).first()

    if retour is None:
        raise HTTPException(
            status_code=404,
            detail="Retour introuvable."
        )

    return retour


# ==========================================
# 5. Ajouter un nouveau retour (CRUD)
# ==========================================

@app.post(
    "/retours",
    response_model=RetourResponse,
    status_code=status.HTTP_201_CREATED
)
def ajouter_retour(
    retour_data: RetourCreate,
    db: Session = Depends(get_db)
):

    nouveau_retour = Retour(
        **retour_data.model_dump()
    )

    try:
        db.add(nouveau_retour)
        db.commit()
        db.refresh(nouveau_retour)

        return nouveau_retour

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Impossible d'ajouter le retour : "
                "contrat déjà associé à un retour "
                "ou référence inexistante."
            )
        )


# ==========================================
# 6. Traiter automatiquement un retour
# ==========================================

@app.post(
    "/retours/traiter",
    response_model=RetourResponse,
    status_code=status.HTTP_201_CREATED
)
def traiter_retour(
    retour_data: RetourCreate,
    db: Session = Depends(get_db)
):

    # Vérifier si un retour existe déjà pour ce contrat
    retour_existant = db.query(Retour).filter(
        Retour.contrat_id == retour_data.contrat_id
    ).first()

    if retour_existant is not None:
        raise HTTPException(
            status_code=409,
            detail="Un retour existe déjà pour ce contrat."
        )

    # 1. Récupérer les informations de la réservation
    try:
        reservation_data = (
            retour_service.recupererDetailsReservationParContrat(
                retour_data.contrat_id
            )
        )

    except ValueError as e:
        raise HTTPException(
            status_code=404,
            detail=str(e)
        )

    except RuntimeError as e:
        raise HTTPException(
            status_code=502,
            detail=str(e)
        )

    # 2. Récupérer la date de fin de réservation
    date_fin_data = reservation_data.get("dateFin")

    if not date_fin_data:
        raise HTTPException(
            status_code=502,
            detail="Date de fin introuvable dans la réservation."
        )

    try:
        if isinstance(date_fin_data, date):
            date_fin = date_fin_data
        else:
            date_fin = date.fromisoformat(str(date_fin_data))

    except ValueError:
        raise HTTPException(
            status_code=502,
            detail="Format de date de fin invalide."
        )

    # 3. Vérifier le retard
    en_retard, duree_retard = retour_service.verifierRetard(
        retour_data.dateRetour,
        date_fin
    )

    # 4. Calculer automatiquement le montant du retard
    try:
        montant_retard = retour_service.calculerMontantRetard(
            retour_data.contrat_id,
            duree_retard
        )

    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except RuntimeError as e:
        raise HTTPException(
            status_code=502,
            detail=str(e)
        )

    # 5. Créer l'objet Retour
    nouveau_retour = Retour(
        dateRetour=retour_data.dateRetour,
        etatVehicule=retour_data.etatVehicule,
        enRetard=en_retard,
        dureeRetardJours=duree_retard,
        montantRetard=montant_retard,
        dommage=None,
        montantDommage=Decimal("0.00"),
        contrat_id=retour_data.contrat_id,
        administrateur_id=retour_data.administrateur_id
    )

    # 6. Vérifier et affecter l'état du véhicule
    retour_service.verifierEtat(
        nouveau_retour,
        retour_data.etatVehicule.value
    )

    # 7. Enregistrer les dommages si le véhicule est endommagé
    if nouveau_retour.etatVehicule.value != "BON":

        try:
            retour_service.enregistrerDommage(
                nouveau_retour,
                retour_data.dommage,
                retour_data.montantDommage
            )

        except (ValueError, TypeError) as e:
            raise HTTPException(
                status_code=400,
                detail=str(e)
            )

    # 8. Enregistrer le retour dans la base de données
    try:
        db.add(nouveau_retour)
        db.commit()
        db.refresh(nouveau_retour)

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Impossible d'enregistrer le retour : "
                "contrat déjà associé à un retour "
                "ou référence inexistante."
            )
        )

    # 9. Mettre à jour le statut du véhicule
    try:
        retour_service.mettreAJourStatutVehicule(
            retour_data.contrat_id,
            retour_data.etatVehicule.value
        )

    except (ValueError, RuntimeError) as e:
        raise HTTPException(
            status_code=502,
            detail=(
                "Retour enregistré dans la base de données, "
                "mais la mise à jour du véhicule a échoué : "
                + str(e)
            )
        )

    # 10. Clôturer le contrat
    try:
        retour_service.finaliserRetour(
            retour_data.contrat_id
        )

    except RuntimeError as e:
        raise HTTPException(
            status_code=502,
            detail=(
                "Retour enregistré et statut du véhicule mis à jour, "
                "mais la clôture du contrat a échoué : "
                + str(e)
            )
        )

    return nouveau_retour


# ==========================================
# 7. Modifier un retour
# ==========================================

@app.put("/retours/{retour_id}", response_model=RetourResponse)
def modifier_retour(
    retour_id: int,
    retour_data: RetourUpdate,
    db: Session = Depends(get_db)
):

    retour = db.query(Retour).filter(
        Retour.id == retour_id
    ).first()

    if retour is None:
        raise HTTPException(
            status_code=404,
            detail="Retour introuvable."
        )

    donnees = retour_data.model_dump(
        exclude_unset=True
    )

    for champ, valeur in donnees.items():
        setattr(retour, champ, valeur)

    try:
        db.commit()
        db.refresh(retour)

        return retour

    except IntegrityError:
        db.rollback()

        raise HTTPException(
            status_code=400,
            detail="Modification impossible : données invalides."
        )


# ==========================================
# 8. Supprimer un retour
# ==========================================

@app.delete(
    "/retours/{retour_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def supprimer_retour(
    retour_id: int,
    db: Session = Depends(get_db)
):

    retour = db.query(Retour).filter(
        Retour.id == retour_id
    ).first()

    if retour is None:
        raise HTTPException(
            status_code=404,
            detail="Retour introuvable."
        )

    db.delete(retour)
    db.commit()

    return None
