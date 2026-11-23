"""Schémas Pydantic (entrées validées et réponses documentées dans OpenAPI).

Compatibilité (TEAM_SYNC §3.2.1) : toute réservation renvoyée contient TOUJOURS les champs historiques
`id, client_id, vehicule_id, date_debut, date_fin, prix_total, statut` lus par le service Contrat
et le frontend commun. Les autres champs sont des ajouts.
"""
from datetime import date, datetime, time
from typing import Annotated, Generic, Literal, TypeVar

from pydantic import BaseModel, Field, PlainSerializer, ValidationInfo, field_validator

T = TypeVar("T")

Montant = Annotated[float, Field(description="Montant arrondi au centime")]
HorodatageUTC = Annotated[
    datetime,
    PlainSerializer(lambda d: d.replace(microsecond=0).isoformat() + "Z", return_type=str, when_used="json"),
]


class _Periode(BaseModel):
    date_debut: date = Field(description="Premier jour de location (AAAA-MM-JJ)")
    date_fin: date = Field(description="Jour du retour, exclu du calcul (AAAA-MM-JJ)")

    @field_validator("date_fin")
    @classmethod
    def _fin_apres_debut(cls, v: date, info: ValidationInfo) -> date:
        debut = info.data.get("date_debut")
        if debut and v <= debut:
            raise ValueError("La date de fin doit être strictement postérieure à la date de début")
        return v


class ReservationCreate(_Periode):
    client_id: int | None = Field(default=None, gt=0, description="Facultatif : le client est celui du jeton "
                                  "(refus 403 si une autre valeur est envoyée)")
    vehicule_id: int = Field(gt=0)
    heure_debut: time | None = Field(default=None, description="Heure de départ (affichage), 09:00 par défaut")
    heure_fin: time | None = Field(default=None, description="Heure de retour (affichage), 09:00 par défaut")
    assistance: bool = False


class DevisRequest(_Periode):
    vehicule_id: int = Field(gt=0)
    assistance: bool = False


class PaiementRequest(BaseModel):
    paiement_reussi: bool


class AnnulationRequest(BaseModel):
    motif: str | None = Field(default=None, max_length=500)


class StatutRequest(BaseModel):
    statut: Literal["CONFIRMEE", "ANNULEE"]
    motif: str | None = Field(default=None, max_length=500)


class ProlongationRequest(BaseModel):
    nouvelle_date_fin: date


# --------------------------------------------------------------------------- réponses
class ClientOut(BaseModel):
    id: int
    nom: str | None
    nom_complet: str | None
    email: str | None
    telephone: str | None


class VehiculeOut(BaseModel):
    id: int
    marque: str
    modele: str
    libelle: str
    immatriculation: str
    categorie: str | None = None
    boite: str | None = None
    carburant: str | None = None


class EvenementOut(BaseModel):
    id: int
    type: str
    message: str
    auteur: str | None
    date: HorodatageUTC


class ReservationResume(BaseModel):
    # --- champs historiques (contrat d'équipe) ---
    id: int
    client_id: int
    vehicule_id: int
    date_debut: date
    date_fin: date
    prix_total: Montant
    statut: str
    # --- ajouts ---
    numero: str
    statut_label: str
    date_reservation: date
    client_nom: str | None
    vehicule_libelle: str | None
    vehicule_immatriculation: str | None
    duree_jours: int
    montant_total: Montant
    devise: str


class ReservationOut(ReservationResume):
    debut: datetime = Field(description="date_debut + heure_debut (heure locale de l'agence)")
    fin: datetime
    heure_debut: str
    heure_fin: str
    client: ClientOut
    vehicule: VehiculeOut
    assistance: bool
    tarif_journalier: Montant
    tarif_assistance: Montant
    montant_location: Montant
    montant_assistance: Montant
    montant_prolongations: Montant
    montant_tva: Montant
    depot_garantie: Montant
    motif_annulation: str | None
    cree_par: str | None
    created_at: HorodatageUTC | None
    confirmed_at: HorodatageUTC | None
    cancelled_at: HorodatageUTC | None
    historique: list[EvenementOut]
    actions: dict[str, bool]


class ReponseReservation(BaseModel):
    """Enveloppe des actions (création, paiement, annulation) : forme historique `{message, reservation}`."""

    message: str
    reservation: ReservationOut


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int
    pages: int


class StatsOut(BaseModel):
    mois: str
    total_mois: int
    total_mois_precedent: int
    variation: int
    en_attente: int
    confirmees: int
    annulees: int
    taux_confirmation: int


class DevisOut(BaseModel):
    duree_jours: int
    tarif_journalier: Montant
    tarif_assistance: Montant
    montant_location: Montant
    montant_assistance: Montant
    montant_total: Montant
    montant_tva: Montant
    taux_tva: float
    depot_garantie: Montant
    devise: str


class DisponibiliteOut(BaseModel):
    vehicule_id: int
    disponible: bool
    conflits: list[str]


class ProlongationOut(BaseModel):
    """Contrat TEAM_SYNC §3.2.1 étape 4."""

    prolongation_id: int
    reservation_id: int
    date_fin_precedente: date
    date_fin: date
    jours_supplementaires: int
    montant_supplementaire: Montant
    prix_total: Montant


class VehiculeDisponibleOut(BaseModel):
    id: int
    immatriculation: str
    marque: str
    modele: str
    libelle: str
    annee: int | None
    categorie: str | None
    boite: str | None
    carburant: str | None
    prix_par_jour: float
    statut: str
    image_url: str | None


class PeriodeOut(BaseModel):
    date_debut: date
    date_fin: date


class OffreVehiculeOut(VehiculeDisponibleOut):
    """Véhicule du catalogue public (site client)."""

    reservable: bool
    disponible: bool | None = Field(description="null tant qu'aucune période n'est choisie")
    duree_jours: int | None
    prix_estime: float | None = Field(description="Location sur la période, hors options")


class VehiculePublicOut(OffreVehiculeOut):
    periodes_reservees: list[PeriodeOut]
