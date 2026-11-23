"""Routes REST du service Réservation.

Routes historiques (contrat d'équipe, TEAM_SYNC §3.2.1) — chemins et formes conservés :
    GET  /reservations                      liste (tableau JSON ; paginée seulement si ?page= est fourni)
    GET  /reservations/{id}                 lecture canonique utilisée par le service Contrat
    POST /reservations                      création → {"message", "reservation"} (201)
    POST /reservations/{id}/paiement        paiement simulé → CONFIRMEE
    PUT  /reservations/{id}/annulation      annulation
    POST /reservations/{id}/prolongations   prolongation demandée par Contrat (en-tête Idempotency-Key)

Rôles : le CLIENT réserve en ligne (site de réservation) ; l'ADMINISTRATEUR gère et consulte
(confirmer, annuler, rechercher, exporter) mais ne crée ni ne modifie de réservation.
"""
import csv
import io
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Body, Depends, Header, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from .database import get_db
from .erreurs import RegleMetier
from .fournisseurs import FournisseurVehicules, VehiculesHttp, fournisseur_clients
from .notifications import expediteur, publier
from .schemas import (
    AnnulationRequest,
    ClientOut,
    DevisOut,
    DevisRequest,
    DisponibiliteOut,
    EvenementOut,
    Page,
    PaiementRequest,
    ProlongationOut,
    ProlongationRequest,
    ReponseReservation,
    ReservationCreate,
    ReservationOut,
    ReservationResume,
    StatsOut,
    StatutRequest,
    OffreVehiculeOut,
    VehiculeDisponibleOut,
    VehiculePublicOut,
)
from .securite import Acteur, administrateur, administrateur_ou_service, client_connecte, lecteur, utilisateur
from .service import ServiceReservation

router = APIRouter()
STATUT = "^(EN_ATTENTE|CONFIRMEE|ANNULEE)$"


def fournisseur_vehicules() -> FournisseurVehicules:
    return VehiculesHttp()


def service(db: Session = Depends(get_db),
            vehicules: FournisseurVehicules = Depends(fournisseur_vehicules)) -> ServiceReservation:
    return ServiceReservation(db, vehicules, fournisseur_clients(db), expediteur())


# ============================================================================ réservations
@router.get(
    "/reservations",
    response_model=list[ReservationResume] | Page[ReservationResume],
    tags=["Réservations"],
    summary="F001 – Lister les réservations",
    description="Sans `page` : tableau JSON complet (forme historique utilisée par Contrat). "
                "Avec `page` : objet paginé `{items, total, page, size, pages}`. "
                "Un client connecté ne voit que ses réservations.",
)
def lister(
    search: str | None = Query(None, max_length=100, description="N°, client, immatriculation, modèle"),
    statut: str | None = Query(None, pattern=STATUT),
    mois: str | None = Query(None, pattern=r"^\d{4}-\d{2}$", description="Mois de réservation AAAA-MM"),
    client_id: int | None = Query(None, gt=0),
    vehicule_id: int | None = Query(None, gt=0),
    page: int | None = Query(None, ge=1),
    size: int = Query(10, ge=1, le=100),
    acteur: Acteur | None = Depends(lecteur),
    svc: ServiceReservation = Depends(service),
):
    items, meta = svc.lister(page=page, size=size, acteur=acteur, recherche=search, statut=statut, mois=mois,
                             client_id=client_id, vehicule_id=vehicule_id)
    resumes = [svc.serialiser_resume(r) for r in items]
    return resumes if meta is None else {"items": resumes, **meta}


@router.get("/reservations/stats", response_model=StatsOut, tags=["Réservations"],
            summary="F001 – Indicateurs du mois")
def stats(mois: str | None = Query(None, pattern=r"^\d{4}-\d{2}$"),
          acteur: Acteur | None = Depends(lecteur), svc: ServiceReservation = Depends(service)):
    return svc.stats(mois, acteur)


@router.get("/reservations/confirmees", response_model=list[ReservationResume], tags=["Intégration"],
            summary="Réservations confirmées (service Contrat)")
def confirmees(acteur: Acteur | None = Depends(lecteur), svc: ServiceReservation = Depends(service)):
    items, _ = svc.lister(page=None, size=0, acteur=acteur, recherche=None, statut="CONFIRMEE", mois=None,
                          client_id=None, vehicule_id=None)
    return [svc.serialiser_resume(r) for r in items]


@router.post("/reservations/devis", response_model=DevisOut, tags=["Réservations"],
             summary="F002 – Calculer le prix sans enregistrer")
def devis(body: DevisRequest, _: Acteur | None = Depends(lecteur), svc: ServiceReservation = Depends(service)):
    return svc.devis(body.vehicule_id, body.date_debut, body.date_fin, body.assistance).en_dict()


@router.get("/reservations/export.csv", tags=["Réservations"], response_class=StreamingResponse,
            summary="Export CSV des réservations filtrées (administrateur)")
def exporter(search: str | None = Query(None, max_length=100), statut: str | None = Query(None, pattern=STATUT),
             mois: str | None = Query(None, pattern=r"^\d{4}-\d{2}$"), acteur: Acteur = Depends(administrateur),
             svc: ServiceReservation = Depends(service)):
    items, _ = svc.lister(page=None, size=0, acteur=acteur, recherche=search, statut=statut, mois=mois,
                          client_id=None, vehicule_id=None)
    tampon = io.StringIO()
    tampon.write("\ufeff")  # BOM : Excel ouvre correctement les accents
    csv.writer(tampon, delimiter=";").writerows(svc.lignes_export(items))
    nom = f"reservations-{mois or 'toutes'}.csv"
    return StreamingResponse(iter([tampon.getvalue()]), media_type="text/csv; charset=utf-8",
                             headers={"Content-Disposition": f'attachment; filename="{nom}"'})


@router.get("/reservations/numero/{numero}", response_model=ReservationOut, tags=["Intégration"],
            summary="Détail par numéro RES-AAAA-NNN")
def par_numero(numero: str, acteur: Acteur | None = Depends(lecteur), svc: ServiceReservation = Depends(service)):
    return svc.serialiser(svc.obtenir_par_numero(numero, acteur))


@router.post("/reservations", response_model=ReponseReservation, status_code=201, tags=["Réservations"],
             summary="Réserver en ligne (client connecté) – statut EN_ATTENTE jusqu'au paiement")
def creer(body: ReservationCreate, bg: BackgroundTasks, acteur: Acteur = Depends(client_connecte),
          svc: ServiceReservation = Depends(service)):
    r = svc.creer(body, acteur)
    bg.add_task(publier, "reservation.created", svc.donnees_evenement(r))
    return {"message": "Réservation créée avec succès", "reservation": svc.serialiser(r)}


@router.get("/reservations/{reservation_id}", response_model=ReservationOut, tags=["Réservations"],
            summary="F003 – Lecture canonique (utilisée par Contrat)")
def lire(reservation_id: int, acteur: Acteur | None = Depends(lecteur), svc: ServiceReservation = Depends(service)):
    return svc.serialiser(svc.obtenir(reservation_id, acteur))


@router.post("/reservations/{reservation_id}/paiement", tags=["Réservations"],
             summary="Paiement simulé : succès → CONFIRMEE (client propriétaire ou administrateur)")
def payer(reservation_id: int, body: PaiementRequest, bg: BackgroundTasks,
          acteur: Acteur = Depends(utilisateur), svc: ServiceReservation = Depends(service)):
    r, ok = svc.payer(reservation_id, body.paiement_reussi, acteur)
    if ok:
        bg.add_task(publier, "reservation.confirmed", svc.donnees_evenement(r))
        return {"message": "Paiement effectué avec succès", "reservation": svc.serialiser(r)}
    return {"message": "Paiement refusé", "reservation_id": r.id, "statut": r.statut,
            "reservation": svc.serialiser(r)}


@router.patch("/reservations/{reservation_id}/statut", response_model=ReponseReservation, tags=["Réservations"],
              summary="F003 → F004 – Confirmer ou annuler (administrateur, paiement à l'agence)")
def changer_statut(reservation_id: int, body: StatutRequest, bg: BackgroundTasks,
                   acteur: Acteur = Depends(administrateur), svc: ServiceReservation = Depends(service)):
    if body.statut == "CONFIRMEE":
        r = svc.confirmer(reservation_id, acteur)
        bg.add_task(publier, "reservation.confirmed", svc.donnees_evenement(r))
        return {"message": "Réservation confirmée", "reservation": svc.serialiser(r)}
    r = svc.annuler(reservation_id, body.motif, acteur)
    bg.add_task(publier, "reservation.cancelled", svc.donnees_evenement(r))
    return {"message": "Réservation annulée avec succès", "reservation": svc.serialiser(r)}


@router.put("/reservations/{reservation_id}/annulation", response_model=ReponseReservation, tags=["Réservations"],
            summary="Annuler (client propriétaire ou administrateur, avant le début)")
def annuler(reservation_id: int, bg: BackgroundTasks, body: AnnulationRequest | None = Body(default=None),
            acteur: Acteur = Depends(utilisateur), svc: ServiceReservation = Depends(service)):
    r = svc.annuler(reservation_id, body.motif if body else None, acteur)
    bg.add_task(publier, "reservation.cancelled", svc.donnees_evenement(r))
    return {"message": "Réservation annulée avec succès", "reservation": svc.serialiser(r)}


@router.post("/reservations/{reservation_id}/prolongations", response_model=ProlongationOut, status_code=201,
             tags=["Intégration"], summary="Prolonger une réservation confirmée (service Contrat)",
             description="Vérification atomique de la disponibilité + idempotence : la même `Idempotency-Key` "
                         "renvoie toujours le même résultat sans prolonger deux fois (TEAM_SYNC §3.2.1).")
def prolonger(reservation_id: int, body: ProlongationRequest, bg: BackgroundTasks,
              idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=8, max_length=100),
              acteur: Acteur = Depends(administrateur_ou_service), svc: ServiceReservation = Depends(service)):
    p = svc.prolonger(reservation_id, body.nouvelle_date_fin, idempotency_key, acteur)
    r = svc.obtenir(reservation_id, None)
    bg.add_task(publier, "reservation.extended", svc.donnees_evenement(r))
    return {"prolongation_id": p.id, "reservation_id": p.reservation_id,
            "date_fin_precedente": p.date_fin_precedente, "date_fin": p.date_fin,
            "jours_supplementaires": p.jours_supplementaires,
            "montant_supplementaire": float(p.montant_supplementaire), "prix_total": float(r.prix_total)}


@router.get("/reservations/{reservation_id}/historique", response_model=list[EvenementOut], tags=["Réservations"])
def historique(reservation_id: int, acteur: Acteur | None = Depends(lecteur),
               svc: ServiceReservation = Depends(service)):
    return svc.serialiser(svc.obtenir(reservation_id, acteur))["historique"]


def _periode(date_debut: date, date_fin: date) -> tuple[date, date]:
    if date_fin <= date_debut:
        raise RegleMetier("La date de fin doit être strictement postérieure à la date de début", champ="date_fin")
    return date_debut, date_fin


# ============================================================================ catalogue public (site client)
@router.get("/catalogue/vehicules", response_model=list[OffreVehiculeOut], tags=["Catalogue"],
            summary="Véhicules proposés à la location (source : service Véhicule), sans authentification",
            description="Avec `date_debut` et `date_fin` : disponibilité et prix estimé sur la période.")
def catalogue(
    date_debut: date | None = None,
    date_fin: date | None = None,
    recherche: str | None = Query(None, max_length=100),
    marque: str | None = Query(None, max_length=100),
    prix_max: Decimal | None = Query(None, gt=0),
    tri: str = Query("prix_asc", pattern="^(prix_asc|prix_desc|nom)$"),
    disponibles: bool = Query(False, description="Masquer les véhicules déjà réservés sur la période"),
    svc: ServiceReservation = Depends(service),
):
    if (date_debut is None) != (date_fin is None):
        raise RegleMetier("Indiquez la date de départ et la date de retour.", champ="date_fin")
    if date_debut and date_fin:
        _periode(date_debut, date_fin)
    return svc.catalogue(debut=date_debut, fin=date_fin, recherche=recherche, marque=marque, prix_max=prix_max,
                         tri=tri, disponibles_seulement=disponibles)


@router.get("/catalogue/vehicules/{vehicule_id}", response_model=VehiculePublicOut, tags=["Catalogue"],
            summary="Fiche véhicule : disponibilité sur la période et périodes déjà réservées")
def fiche_vehicule(vehicule_id: int, date_debut: date | None = None, date_fin: date | None = None,
                   svc: ServiceReservation = Depends(service)):
    if date_debut and date_fin:
        _periode(date_debut, date_fin)
    return svc.vehicule_public(vehicule_id, date_debut if date_fin else None, date_fin if date_debut else None)


# ============================================================================ disponibilités
@router.get("/disponibilites/vehicules", response_model=list[VehiculeDisponibleOut], tags=["Disponibilités"],
            summary="F002 – Véhicules libres sur une période")
def vehicules_libres(date_debut: date, date_fin: date,
                     exclude_reservation_id: int | None = Query(None, gt=0),
                     _: Acteur | None = Depends(lecteur), svc: ServiceReservation = Depends(service)):
    debut, fin = _periode(date_debut, date_fin)
    return [v.en_dict() for v in svc.vehicules_disponibles(debut, fin, exclude_reservation_id)]


@router.get("/disponibilites/vehicules/{vehicule_id}", response_model=DisponibiliteOut, tags=["Disponibilités"],
            summary="Disponibilité d'un véhicule sur une période")
def disponibilite(vehicule_id: int, date_debut: date, date_fin: date,
                  exclude_reservation_id: int | None = Query(None, gt=0),
                  _: Acteur | None = Depends(lecteur), svc: ServiceReservation = Depends(service)):
    debut, fin = _periode(date_debut, date_fin)
    return svc.disponibilite(vehicule_id, debut, fin, exclude_reservation_id)


# ============================================================================ clients (lecture)
@router.get("/clients", response_model=list[ClientOut], tags=["Clients"],
            summary="Clients (données du service d'authentification, lecture seule)")
def clients(search: str | None = Query(None, max_length=100), _: Acteur = Depends(administrateur),
            db: Session = Depends(get_db)):
    return [c.en_dict() for c in fournisseur_clients(db).lister(search)]


@router.get("/clients/{client_id}", response_model=ClientOut, tags=["Clients"])
def client(client_id: int, acteur: Acteur = Depends(utilisateur), db: Session = Depends(get_db)):
    from .erreurs import Introuvable

    if acteur.est_client and acteur.id != client_id:
        raise Introuvable("Client introuvable")
    c = fournisseur_clients(db).obtenir(client_id)
    if not c:
        raise Introuvable("Client introuvable")
    return c.en_dict()
