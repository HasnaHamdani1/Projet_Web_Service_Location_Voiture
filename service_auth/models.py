from sqlalchemy import BigInteger, Column, ForeignKey, Integer, String

from .database import Base


class Utilisateur(Base):
    __tablename__ = "utilisateur"

    id = Column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    nom = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False, unique=True)
    mot_de_passe = Column(String(255), nullable=False)
    telephone = Column(String(30), nullable=True)


class Client(Base):
    __tablename__ = "client"

    id = Column(
        BigInteger,
        ForeignKey("utilisateur.id", ondelete="CASCADE"),
        primary_key=True,
    )
    adresse = Column(String(255), nullable=False)


class Administrateur(Base):
    __tablename__ = "administrateur"

    id = Column(
        BigInteger,
        ForeignKey("utilisateur.id", ondelete="CASCADE"),
        primary_key=True,
    )
