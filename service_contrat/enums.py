from enum import Enum


class ContractStatus(str, Enum):
    EN_ATTENTE = "EN_ATTENTE"
    VALIDE = "VALIDE"
    CLOTURE = "CLOTURE"


class UserRole(str, Enum):
    CLIENT = "CLIENT"
    ADMINISTRATEUR = "ADMINISTRATEUR"
