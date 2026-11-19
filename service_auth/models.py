from sqlalchemy import BigInteger, Column, ForeignKey, Integer, String

from .database import Base


class Utilisateur(Base):
    __tablename__ = "utilisateurs"

    id = Column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    nom = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False, unique=True)
    mot_de_passe = Column("motDePasse", String(255), nullable=False)
    telephone = Column(String(20), nullable=True)
    role = Column(String(20), nullable=False)


class Client(Base):
    __tablename__ = "clients"

    id = Column(
        BigInteger,
        ForeignKey("utilisateurs.id", ondelete="CASCADE"),
        primary_key=True,
    )
    adresse = Column(String(255), nullable=True)


class Administrateur(Base):
    __tablename__ = "administrateurs"

    id = Column(
        BigInteger,
        ForeignKey("utilisateurs.id", ondelete="CASCADE"),
        primary_key=True,
    )
