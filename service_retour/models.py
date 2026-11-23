
from sqlalchemy import (
    Column,
    BigInteger,
    Date,
    Enum,
    Boolean,
    Integer,
    Numeric,
    String
)

from database import Base
from enums import EtatVehicule


class Retour(Base):
    __tablename__ = "retours"

    id = Column(
        BigInteger,
        primary_key=True,
        autoincrement=True
    )

    dateRetour = Column(Date, nullable=False)

    etatVehicule = Column(
        Enum(EtatVehicule),
        nullable=False
    )

    enRetard = Column(
        Boolean,
        nullable=False,
        default=False
    )

    dureeRetardJours = Column(
        Integer,
        nullable=False,
        default=0
    )

    montantRetard = Column(
        Numeric(10, 2),
        nullable=False,
        default=0.00
    )

    dommage = Column(
        String(255),
        nullable=True
    )

    montantDommage = Column(
        Numeric(10, 2),
        nullable=False,
        default=0.00
    )

    contrat_id = Column(
        BigInteger,
        nullable=False,
        unique=True
    )

    administrateur_id = Column(
        BigInteger,
        nullable=False
    )
