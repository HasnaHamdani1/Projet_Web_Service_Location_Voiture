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
    """Contract record mapped to the shared schema's `contrat` table."""

    __tablename__ = "contrat"

    id = Column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    numero_contrat = Column(String(100), nullable=False, unique=True)
    date_generation = Column(Date, nullable=False)
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
    periode_prise = Column(Date, nullable=False)
    periode_fin = Column(Date, nullable=False)
    montant_total = Column(Float, nullable=False)
    # The current shared SQL dump allows NULL here. This service always writes
    # a reservation ID, and the team should make the column NOT NULL by migration.
    reservation_id = Column(
        BigInteger,
        ForeignKey("reservation.id", name="fk_contrat_reservation"),
        nullable=True,
        unique=True,
    )
    client_id = Column(
        BigInteger,
        ForeignKey("client.id", name="fk_contrat_client"),
        nullable=False,
    )
    vehicule_id = Column(
        BigInteger,
        ForeignKey("vehicule.id", name="fk_contrat_vehicule"),
        nullable=False,
    )
