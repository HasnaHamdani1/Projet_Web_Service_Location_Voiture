
from sqlalchemy import Column, Integer, String, Float, Date

from .database import Base


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)

    client_id = Column(Integer, nullable=False)
    vehicule_id = Column(Integer, nullable=False)

    date_debut = Column(Date, nullable=False)
    date_fin = Column(Date, nullable=False)

    prix_total = Column(Float, nullable=False)

    statut = Column(String, default="EN_ATTENTE", nullable=False)
