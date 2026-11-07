
from sqlalchemy import BigInteger, Column, Float, Integer, String
from database import Base


class Vehicule(Base):
    __tablename__ = "vehicule"

    id = Column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        index=True,
        autoincrement=True,
    )
    immatriculation = Column(String, unique=True, nullable=False)
    marque = Column(String, nullable=False)
    modele = Column(String, nullable=False)
    annee = Column(Integer, nullable=False)
    prix_par_jour = Column(Float, nullable=False)
    statut = Column(String, default="DISPONIBLE", nullable=False)
