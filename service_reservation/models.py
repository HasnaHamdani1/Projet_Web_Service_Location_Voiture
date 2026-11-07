
from sqlalchemy import BigInteger, Column, Date, Float, Integer, String

from .database import Base


class Reservation(Base):
    __tablename__ = "reservation"

    id = Column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        index=True,
        autoincrement=True,
    )

    client_id = Column(BigInteger, nullable=False)
    vehicule_id = Column(BigInteger, nullable=False)

    date_debut = Column(Date, nullable=False)
    date_fin = Column(Date, nullable=False)

    prix_total = Column("montant_estime", Float, nullable=False)

    statut = Column(String, default="EN_ATTENTE", nullable=False)
