from sqlalchemy import (
    BigInteger,
    Column,
    Date,
    DateTime,
    Enum as SqlEnum,
    Float,
    ForeignKey,
    Integer,
    String,
)

from .database import Base
from .enums import ContractStatus


class Contract(Base):
    """Contract record mapped to the shared schema's `contrats` table."""

    __tablename__ = "contrats"

    id = Column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    numero_contrat = Column("numeroContrat", String(50), nullable=False, unique=True)
    date_generation = Column("dateGeneration", Date, nullable=False)
    statut = Column(
        SqlEnum(
            ContractStatus,
            name="statut_contrat",
            native_enum=True,
            validate_strings=True,
        ),
        nullable=False,
        default=ContractStatus.EN_ATTENTE,
    )
    date_validation = Column(DateTime, nullable=True)
    montant_caution = Column(Float, nullable=True)
    date_enregistrement_caution = Column(DateTime, nullable=True)
    date_cloture = Column(DateTime, nullable=True)
    periode_prise = Column("periodePrise", Date, nullable=False)
    periode_fin = Column("periodeFin", Date, nullable=False)
    montant_total = Column("montantTotal", Float, nullable=False)
    reservation_id = Column(BigInteger, nullable=False, unique=True)
    administrateur_id = Column(BigInteger, nullable=False)
    # These two snapshot fields are added by migration 006. The base shared
    # schema omits them, but the Contract API uses them for ownership checks.
    client_id = Column(BigInteger, nullable=False)
    vehicule_id = Column(BigInteger, nullable=False)


class ContractExtension(Base):
    """Append-only extension annex; validated contract terms stay unchanged."""

    __tablename__ = "prolongations"

    id = Column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    contrat_id = Column(
        BigInteger,
        ForeignKey("contrats.id", name="fk_prolongations_contrat"),
        nullable=False,
        index=True,
    )
    reservation_prolongation_id = Column(BigInteger, nullable=False, unique=True)
    idempotency_key = Column(String(36), nullable=False, unique=True)
    date_fin_precedente = Column(Date, nullable=False)
    date_fin = Column(Date, nullable=False)
    montant_supplementaire = Column(Float, nullable=False)
    date_creation = Column(DateTime, nullable=False)
