"""Tables du service Réservation.

- `reservations` : table partagée définie dans Base_de_données/db_location_voitures.sql (colonnes camelCase).
  Le service en est propriétaire (TEAM_SYNC §3.1) ; son schéma n'est PAS modifié ici.
- `reservation_*` : tables propres au service (détail des montants, numéro RES-AAAA-NNN, historique,
  prolongations idempotentes, verrous anti-double réservation). Créées par migrations/006_service_reservation.sql
  et, à défaut, au démarrage (CREATE TABLE IF NOT EXISTS).
"""
from datetime import date, datetime, time, timezone
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    """Horodatage UTC sans fuseau (DATETIME MySQL) ; l'API le renvoie avec le suffixe Z."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

Id = BigInteger().with_variant(Integer, "sqlite")
Money = Numeric(10, 2)


class Reservation(Base):
    """Table partagée `reservations` (schéma de l'équipe)."""

    __tablename__ = "reservations"

    id: Mapped[int] = mapped_column(Id, primary_key=True, autoincrement=True)
    date_reservation: Mapped[date] = mapped_column("dateReservation", Date, nullable=False)
    date_debut: Mapped[date] = mapped_column("dateDebut", Date, nullable=False)
    date_fin: Mapped[date] = mapped_column("dateFin", Date, nullable=False)
    statut: Mapped[str] = mapped_column(String(20), nullable=False, default="EN_ATTENTE")
    prix_total: Mapped[Decimal] = mapped_column("montantEstime", Money, nullable=False)
    client_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    vehicule_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    administrateur_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    details: Mapped["ReservationDetails | None"] = relationship(
        back_populates="reservation", uselist=False, lazy="joined", cascade="all, delete-orphan"
    )
    evenements: Mapped[list["ReservationEvenement"]] = relationship(
        back_populates="reservation",
        cascade="all, delete-orphan",
        order_by="[ReservationEvenement.date_evenement, ReservationEvenement.id]",
    )


class ReservationDetails(Base):
    """Informations propres au service (1 ligne par réservation)."""

    __tablename__ = "reservation_details"

    reservation_id: Mapped[int] = mapped_column(
        Id, ForeignKey("reservations.id", ondelete="CASCADE"), primary_key=True
    )
    numero: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    heure_debut: Mapped[time] = mapped_column("heureDebut", Time, nullable=False)
    heure_fin: Mapped[time] = mapped_column("heureFin", Time, nullable=False)
    duree_jours: Mapped[int] = mapped_column("dureeJours", Integer, nullable=False)
    assistance: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    tarif_journalier: Mapped[Decimal] = mapped_column("tarifJournalier", Money, nullable=False)
    tarif_assistance: Mapped[Decimal] = mapped_column("tarifAssistance", Money, nullable=False)
    montant_location: Mapped[Decimal] = mapped_column("montantLocation", Money, nullable=False)
    montant_assistance: Mapped[Decimal] = mapped_column("montantAssistance", Money, nullable=False)
    montant_prolongations: Mapped[Decimal] = mapped_column("montantProlongations", Money, nullable=False, default=0)
    montant_tva: Mapped[Decimal] = mapped_column("montantTva", Money, nullable=False)
    depot_garantie: Mapped[Decimal] = mapped_column("depotGarantie", Money, nullable=False)
    devise: Mapped[str] = mapped_column(String(10), nullable=False)
    # Instantanés au moment de la réservation (le tarif ne change plus ensuite)
    vehicule_marque: Mapped[str] = mapped_column("vehiculeMarque", String(100), nullable=False)
    vehicule_modele: Mapped[str] = mapped_column("vehiculeModele", String(100), nullable=False)
    vehicule_immatriculation: Mapped[str] = mapped_column("vehiculeImmatriculation", String(50), nullable=False)
    vehicule_categorie: Mapped[str | None] = mapped_column("vehiculeCategorie", String(50))
    vehicule_boite: Mapped[str | None] = mapped_column("vehiculeBoite", String(30))
    vehicule_carburant: Mapped[str | None] = mapped_column("vehiculeCarburant", String(30))
    client_nom: Mapped[str | None] = mapped_column("clientNom", String(100))
    client_email: Mapped[str | None] = mapped_column("clientEmail", String(150))
    client_telephone: Mapped[str | None] = mapped_column("clientTelephone", String(20))
    motif_annulation: Mapped[str | None] = mapped_column("motifAnnulation", String(500))
    cree_par: Mapped[str | None] = mapped_column("creePar", String(120))
    date_creation: Mapped[datetime] = mapped_column(
        "dateCreation", DateTime, default=utcnow, nullable=False
    )
    date_modification: Mapped[datetime] = mapped_column(
        "dateModification", DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )
    date_confirmation: Mapped[datetime | None] = mapped_column("dateConfirmation", DateTime)
    date_annulation: Mapped[datetime | None] = mapped_column("dateAnnulation", DateTime)

    reservation: Mapped[Reservation] = relationship(back_populates="details")


class ReservationEvenement(Base):
    """Historique horodaté (F003)."""

    __tablename__ = "reservation_evenements"

    id: Mapped[int] = mapped_column(Id, primary_key=True, autoincrement=True)
    reservation_id: Mapped[int] = mapped_column(
        Id, ForeignKey("reservations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    message: Mapped[str] = mapped_column(String(255), nullable=False)
    auteur: Mapped[str | None] = mapped_column(String(120))
    date_evenement: Mapped[datetime] = mapped_column(
        "dateEvenement", DateTime, default=utcnow, nullable=False
    )

    reservation: Mapped[Reservation] = relationship(back_populates="evenements")


class ReservationCompteur(Base):
    """Séquence annuelle des numéros RES-AAAA-NNN."""

    __tablename__ = "reservation_compteurs"

    annee: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    dernier_numero: Mapped[int] = mapped_column("dernierNumero", Integer, nullable=False, default=0)


class ReservationVerrou(Base):
    """Une ligne par véhicule, verrouillée (SELECT … FOR UPDATE) pendant chaque réservation :
    MySQL n'a pas de contrainte d'exclusion, ce verrou sérialise les réservations d'un même véhicule."""

    __tablename__ = "reservation_verrous"

    vehicule_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)


class ReservationProlongation(Base):
    """Prolongations demandées par le service Contrat (TEAM_SYNC §3.2.1), rejouables par clé d'idempotence."""

    __tablename__ = "reservation_prolongations"

    id: Mapped[int] = mapped_column(Id, primary_key=True, autoincrement=True)
    reservation_id: Mapped[int] = mapped_column(
        Id, ForeignKey("reservations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    cle_idempotence: Mapped[str] = mapped_column("cleIdempotence", String(100), unique=True, nullable=False)
    date_fin_precedente: Mapped[date] = mapped_column("dateFinPrecedente", Date, nullable=False)
    date_fin: Mapped[date] = mapped_column("dateFin", Date, nullable=False)
    jours_supplementaires: Mapped[int] = mapped_column("joursSupplementaires", Integer, nullable=False)
    montant_supplementaire: Mapped[Decimal] = mapped_column("montantSupplementaire", Money, nullable=False)
    demande_par: Mapped[str | None] = mapped_column("demandePar", String(120))
    date_creation: Mapped[datetime] = mapped_column(
        "dateCreation", DateTime, default=utcnow, nullable=False
    )


class ReservationEmail(Base):
    __tablename__ = "reservation_emails"

    id: Mapped[int] = mapped_column(Id, primary_key=True, autoincrement=True)
    reservation_id: Mapped[int | None] = mapped_column(
        Id, ForeignKey("reservations.id", ondelete="SET NULL"), index=True
    )
    destinataire: Mapped[str] = mapped_column(String(150), nullable=False)
    sujet: Mapped[str] = mapped_column(String(255), nullable=False)
    statut: Mapped[str] = mapped_column(String(20), nullable=False)
    erreur: Mapped[str | None] = mapped_column(Text)
    date_envoi: Mapped[datetime] = mapped_column(
        "dateEnvoi", DateTime, default=utcnow, nullable=False
    )


TABLES_PROPRES = [
    ReservationDetails.__table__,
    ReservationEvenement.__table__,
    ReservationCompteur.__table__,
    ReservationVerrou.__table__,
    ReservationProlongation.__table__,
    ReservationEmail.__table__,
]

STATUTS = ("EN_ATTENTE", "CONFIRMEE", "ANNULEE")
STATUTS_ACTIFS = ("EN_ATTENTE", "CONFIRMEE")
LIBELLES_STATUT = {"EN_ATTENTE": "En attente", "CONFIRMEE": "Confirmée", "ANNULEE": "Annulée"}
