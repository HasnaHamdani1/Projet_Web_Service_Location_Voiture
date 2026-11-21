
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

    immatriculation = Column(String(50), unique=True, nullable=False)
    marque = Column(String(100), nullable=False)
    modele = Column(String(100), nullable=False)
    prix_par_jour = Column(Float, nullable=False)
    statut = Column(String(30), default="DISPONIBLE", nullable=False)

    # Chemin de la photo du véhicule
    image_url = Column(String(500), nullable=True)

