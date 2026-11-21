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
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://100.108.179.81:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://100.108.179.81:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# Fonction utilitaire : date de fin du contrat
# ==========================================

def recuperer_date_fin(contrat_id: int) -> date:
    """Retourne la date de fin prévue (periode_fin) du contrat."""

    try:
        details = retour_service.recupererDetailsReservationParContrat(
            contrat_id
        )

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    date_fin_data = details.get("dateFin")

    if not date_fin_data:
        raise HTTPException(
            status_code=502,
            detail="Date de fin introuvable dans le contrat."
        )

    try:
        if isinstance(date_fin_data, date):
            return date_fin_data

        return date.fromisoformat(str(date_fin_data)[:10])

    except ValueError:
        raise HTTPException(
            status_code=502,
            detail="Format de date de fin invalide."
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
# 4. Liste des retours (infos contrat via le service Contrat)
#    Plus de JOIN SQL : les contrats sont dans un autre service
# ==========================================

@app.get("/retours/liste")
def obtenir_liste_retours(db: Session = Depends(get_db)):

    etats = {
        "BON": "Bon état",
        "LEGER_DOMMAGE": "Léger dommage",
        "DOMMAGE_IMPORTANT": "Dommage important"
    }

    # Un seul appel au service Contrat pour tous les retours
    try:
        contrats = {
            c["id"]: c
            for c in retour_service.obtenirTousLesContrats()
        }
    except RuntimeError:
        contrats = {}   # la liste s'affiche quand même

    liste = []

    for r in db.query(Retour).order_by(Retour.id.desc()).all():

        c = contrats.get(r.contrat_id, {})

        etat = (
            r.etatVehicule.value
            if hasattr(r.etatVehicule, "value")
            else str(r.etatVehicule)
        )

        liste.append({
            "id": r.id,
            "contrat": c.get("numero_contrat", str(r.contrat_id)),
            "immat": "-",          # à compléter avec le service Véhicule
            "vehicule": "-",
            "prevu": c.get("periode_fin"),
            "effectif": r.dateRetour,
            "retard": r.dureeRetardJours or 0,
            "etat": etats.get(etat, etat)
        })

    return liste


# ==========================================
# 5. Aperçu : vérifier le contrat, calculer retard et montant
#    (rien n'est écrit en base)
# ==========================================

@app.get("/retours/apercu")
def apercu_retour(
    numero: str,
    date_retour: date,
    db: Session = Depends(get_db)
):

    # 1. Le contrat existe-t-il dans le service Contrat ?
    try:
        contrat = retour_service.trouverContratParNumero(numero.strip())

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    contrat_id = contrat["id"]

    # 2. Le contrat est-il encore actif ?
    if contrat.get("date_cloture") or contrat.get("statut") != "VALIDE":
        raise HTTPException(
            status_code=409,
            detail=f"Ce contrat n'est pas actif (statut : {contrat.get('statut')})."
        )

    # 3. Un retour existe-t-il déjà pour ce contrat ?
    retour_existant = db.query(Retour).filter(
        Retour.contrat_id == contrat_id
    ).first()

    if retour_existant is not None:
        raise HTTPException(
            status_code=409,
            detail="Un retour existe déjà pour ce contrat."
        )

    # 4. Date de fin prévue, retard et montant du retard
    date_fin = recuperer_date_fin(contrat_id)

    en_retard, duree_retard = retour_service.verifierRetard(
        date_retour,
        date_fin
    )

    try:
        montant_retard = retour_service.calculerMontantRetard(
            contrat_id,
            duree_retard
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {
        "contrat_id": contrat_id,
        "numeroContrat": contrat["numero_contrat"],
        "dateFin": date_fin.isoformat(),
        "enRetard": en_retard,
        "dureeRetardJours": duree_retard,
        "montantRetard": float(montant_retard)
    }


# ==========================================
# 6. Récupérer un retour par son identifiant
# ==========================================

@app.get("/retours/{retour_id:int}", response_model=RetourResponse)
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
# 7. Ajouter un nouveau retour (CRUD)
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
# 8. Traiter automatiquement un retour
#    Ordre : enregistrer le retour -> clôturer le contrat
#            -> mettre à jour le véhicule
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

    # 1. Date de fin du contrat
    date_fin = recuperer_date_fin(retour_data.contrat_id)

    # 2. Vérifier le retard
    en_retard, duree_retard = retour_service.verifierRetard(
        retour_data.dateRetour,
        date_fin
    )

    # 3. Calculer automatiquement le montant du retard
    try:
        montant_retard = retour_service.calculerMontantRetard(
            retour_data.contrat_id,
            duree_retard
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    # 4. Créer l'objet Retour
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

    # 5. Vérifier et affecter l'état du véhicule
    try:
        retour_service.verifierEtat(
            nouveau_retour,
            retour_data.etatVehicule.value
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 6. Enregistrer les dommages si le véhicule est endommagé
    if nouveau_retour.etatVehicule.value != "BON":

        try:
            retour_service.enregistrerDommage(
                nouveau_retour,
                retour_data.dommage,
                retour_data.montantDommage
            )

        except (ValueError, TypeError) as e:
            raise HTTPException(status_code=400, detail=str(e))

    # 7. Enregistrer le retour dans la base de données
    try:
        db.add(nouveau_retour)
        db.commit()
        db.refresh(nouveau_retour)

    except IntegrityError as e:
        db.rollback()
        print("ERREUR INSERT RETOUR :", e.orig, flush=True)

        raise HTTPException(
            status_code=409,
            detail=(
                "Impossible d'enregistrer le retour : "
                "contrat déjà associé à un retour "
                "ou référence inexistante. "
                f"[Détail MySQL : {e.orig}]"
            )
        )

    # 8. Clôturer le contrat
    try:
        retour_service.finaliserRetour(retour_data.contrat_id)

    except RuntimeError as e:
        raise HTTPException(
            status_code=502,
            detail=(
                "Retour enregistré dans la base de données, "
                "mais la clôture du contrat a échoué : "
                + str(e)
            )
        )

    # 9. Vérifier et mettre à jour le statut du véhicule
    try:
        retour_service.mettreAJourStatutVehicule(
            retour_data.contrat_id,
            retour_data.etatVehicule.value
        )

    except (ValueError, RuntimeError) as e:
        raise HTTPException(
            status_code=502,
            detail=(
                "Retour enregistré et contrat clôturé, "
                "mais la mise à jour du véhicule a échoué : "
                + str(e)
            )
        )

    return nouveau_retour


# ==========================================
# 9. Modifier un retour
# ==========================================

@app.put("/retours/{retour_id:int}", response_model=RetourResponse)
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

    donnees = retour_data.model_dump(exclude_unset=True)

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
# 10. Supprimer un retour
# ==========================================

@app.delete(
    "/retours/{retour_id:int}",
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