
from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict

from enums import EtatVehicule


class RetourCreate(BaseModel):
    dateRetour: date
    etatVehicule: EtatVehicule
    contrat_id: int = Field(gt=0)
    administrateur_id: int = Field(gt=0)

    enRetard: bool = False
    dureeRetardJours: int = Field(default=0, ge=0)
    montantRetard: Decimal = Field(default=Decimal("0.00"), ge=0)

    dommage: Optional[str] = None
    montantDommage: Decimal = Field(default=Decimal("0.00"), ge=0)


class RetourUpdate(BaseModel):
    dateRetour: Optional[date] = None
    etatVehicule: Optional[EtatVehicule] = None
    enRetard: Optional[bool] = None
    dureeRetardJours: Optional[int] = Field(default=None, ge=0)
    montantRetard: Optional[Decimal] = Field(default=None, ge=0)
    dommage: Optional[str] = None
    montantDommage: Optional[Decimal] = Field(default=None, ge=0)


class RetourResponse(BaseModel):
    id: int
    dateRetour: date
    etatVehicule: EtatVehicule
    enRetard: bool
    dureeRetardJours: int
    montantRetard: Decimal
    dommage: Optional[str]
    montantDommage: Decimal
    contrat_id: int
    administrateur_id: int

    model_config = ConfigDict(from_attributes=True)
