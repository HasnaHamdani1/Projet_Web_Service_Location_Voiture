from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .enums import ContractStatus


class ContractCreate(BaseModel):
    reservation_id: int = Field(gt=0)


class DepositCreate(BaseModel):
    montant_caution: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


class ReservationSnapshot(BaseModel):
    """The stable subset of the current Reservation GET response we consume."""

    model_config = ConfigDict(extra="ignore")

    id: int = Field(gt=0)
    client_id: int = Field(gt=0)
    vehicule_id: int = Field(gt=0)
    date_debut: date
    date_fin: date
    prix_total: Decimal = Field(gt=0)
    statut: str

    @model_validator(mode="after")
    def check_period(self):
        if self.date_debut >= self.date_fin:
            raise ValueError("date_fin must be after date_debut")
        return self


class ContractRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    numero_contrat: str
    date_generation: date
    statut: ContractStatus
    date_validation: datetime | None
    montant_caution: float | None
    date_enregistrement_caution: datetime | None
    date_cloture: datetime | None
    periode_prise: date
    periode_fin: date
    montant_total: float
    reservation_id: int | None
    client_id: int
    vehicule_id: int
