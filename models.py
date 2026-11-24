from sqlalchemy import BigInteger, Column, Enum, Integer, Numeric, String

from database import Base


class Vehicule(Base):
    """Table `vehicules` de la base unique (dump Base_de_données/db_location_voitures.sql)."""

    __tablename__ = "vehicules"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, index=True, autoincrement=True)
    immatriculation = Column(String(30), unique=True, nullable=False)
    marque = Column(String(100), nullable=False)
    modele = Column(String(100), nullable=False)
    annee = Column(Integer, nullable=False)
    # Attribut Python prix_par_jour (contrat JSON inchangé) ↔ colonne SQL prixParJour
    prix_par_jour = Column("prixParJour", Numeric(10, 2), nullable=False)
    statut = Column(Enum("DISPONIBLE", "RESERVE", "LOUE", "MAINTENANCE", name="statut_vehicule"),
                    nullable=False, default="DISPONIBLE")
    administrateur_id = Column(BigInteger().with_variant(Integer, "sqlite"), nullable=False)
    # Ajoutée par la migration 007_vehicules_image_url.sql
    image_url = Column(String(500), nullable=True)
