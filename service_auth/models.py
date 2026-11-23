
from sqlalchemy import BigInteger, Column, String
from .database import Base


class Utilisateur(Base):
    __tablename__ = "utilisateurs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    nom = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)

    # Le nom de la colonne MySQL est motDePasse.
    mot_de_passe = Column("motDePasse", String(255), nullable=False)

    telephone = Column(String(20), nullable=True)
    role = Column(String(30), nullable=False)


class Administrateur(Base):
    __tablename__ = "administrateurs"

    id = Column(
        BigInteger,
        primary_key=True,
        nullable=False,
    )


class Client(Base):
    __tablename__ = "clients"

    id = Column(
        BigInteger,
        primary_key=True,
        nullable=False,
    )
    adresse = Column(String(255), nullable=True)
