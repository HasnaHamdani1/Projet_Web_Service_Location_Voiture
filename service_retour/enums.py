
from enum import Enum


class EtatVehicule(str, Enum):
    BON = "BON"
    LEGER_DOMMAGE = "LEGER_DOMMAGE"
    DOMMAGE_IMPORTANT = "DOMMAGE_IMPORTANT"


class StatutVehicule(str, Enum):
    DISPONIBLE = "DISPONIBLE"
    RESERVE = "RESERVE"
    LOUE = "LOUE"
    MAINTENANCE = "MAINTENANCE"


class StatutContrat(str, Enum):
    EN_ATTENTE = "EN_ATTENTE"
    VALIDE = "VALIDE"
    CLOTURE = "CLOTURE"
