from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ContratCreate(BaseModel):
    reservation_id: int = Field(gt=0)


class CautionCreate(BaseModel):
    montant_caution: Decimal = Field(ge=0, max_digits=10, decimal_places=2)


class ContratStatutUpdate(BaseModel):
    statut: Literal["CLOTURE"]


class ContratFinalisation(BaseModel):
    reservation_id: int = Field(gt=0)
    numero_contrat: str = Field(pattern=r"^CTR-\d{4}-[A-F0-9]{8}$")
    montant_caution: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    signatures_confirmees: Literal[True]


class ContratRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    numero_contrat: str
    date_generation: date
    statut: str
    periode_prise: date
    periode_fin: date
    montant_total: Decimal
    reservation_id: int
    administrateur_id: int
    montant_caution: Decimal | None = None
    date_validation: date | None = None
    date_cloture: date | None = None


class ContratDetail(ContratRead):
    reservation: dict
