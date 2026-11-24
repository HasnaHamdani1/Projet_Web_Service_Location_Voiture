from sqlalchemy import BigInteger, Column, Date, Integer, Numeric, String

from .database import Base


class Contrat(Base):
    __tablename__ = "contrats"

    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    numero_contrat = Column("numeroContrat", String(50), nullable=False, unique=True, index=True)
    date_generation = Column("dateGeneration", Date, nullable=False)
    statut = Column(String(20), nullable=False, default="EN_ATTENTE")
    periode_prise = Column("periodePrise", Date, nullable=False)
    periode_fin = Column("periodeFin", Date, nullable=False)
    montant_total = Column("montantTotal", Numeric(10, 2), nullable=False)
    reservation_id = Column(BigInteger, nullable=False, unique=True, index=True)
    administrateur_id = Column(BigInteger, nullable=False)
    montant_caution = Column("montantCaution", Numeric(10, 2), nullable=True)
    mode_encaissement = Column("modeEncaissement", String(20), nullable=True)
    statut_caution = Column("statutCaution", String(20), nullable=True)
    conditions_particulieres = Column("conditionsParticulieres", String(1000), nullable=True)
    date_validation = Column("dateValidation", Date, nullable=True)
    date_cloture = Column("dateCloture", Date, nullable=True)
