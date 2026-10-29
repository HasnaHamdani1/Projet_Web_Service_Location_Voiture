
from sqlalchemy import Column, Integer, String, Float
from database import Base


class Vehicule(Base):
    __tablename__ = "vehicules"

    id = Column(Integer, primary_key=True, index=True)
    immatriculation = Column(String, unique=True, nullable=False)
    marque = Column(String, nullable=False)
    modele = Column(String, nullable=False)
    prix_par_jour = Column(Float, nullable=False)
    statut = Column(String, default="DISPONIBLE", nullable=False)
