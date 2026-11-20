from enum import Enum


class StatutContrat(str, Enum):
    EN_ATTENTE = "EN_ATTENTE"
    VALIDE = "VALIDE"
    CLOTURE = "CLOTURE"
