"""Pure business rules for the Contract service.

These checks deliberately do not depend on FastAPI, SQLAlchemy, or MySQL so
they can be tested as unit tests without starting the REST API.
"""

from decimal import Decimal, InvalidOperation
from enum import Enum

from .enums import ContractStatus


class RegleMetierContratError(ValueError):
    """Raised when a Contract operation violates a business rule."""


def _status_value(status: ContractStatus | str) -> str:
    return status.value if isinstance(status, Enum) else str(status)


def _positive_amount(amount: Decimal | float | int | None) -> bool:
    if amount is None:
        return False
    try:
        value = Decimal(str(amount))
        return value.is_finite() and value > 0
    except (InvalidOperation, ValueError):
        return False


class ReglesMetierContrat:
    """Validations métier communes aux opérations du contrat."""

    @staticmethod
    def verifier_reservation_confirmee(statut_reservation: str) -> None:
        if statut_reservation != "CONFIRMEE":
            raise RegleMetierContratError(
                "Un contrat peut être créé uniquement pour une réservation confirmée"
            )

    @staticmethod
    def verifier_caution_enregistrable(
        statut_contrat: ContractStatus | str,
        caution_existante: Decimal | float | int | None,
    ) -> None:
        if _status_value(statut_contrat) != ContractStatus.EN_ATTENTE.value:
            raise RegleMetierContratError(
                "La caution doit être enregistrée avant la validation"
            )
        if caution_existante is not None:
            raise RegleMetierContratError("Une caution est déjà enregistrée")

    @staticmethod
    def verifier_validation_possible(
        statut_contrat: ContractStatus | str,
        montant_caution: Decimal | float | int | None,
    ) -> None:
        if _status_value(statut_contrat) != ContractStatus.EN_ATTENTE.value:
            raise RegleMetierContratError(
                "Seul un contrat en attente peut être validé"
            )
        if not _positive_amount(montant_caution):
            raise RegleMetierContratError(
                "La caution doit être enregistrée avant la validation du contrat"
            )

    @staticmethod
    def verifier_cloture_possible(statut_contrat: ContractStatus | str) -> None:
        if _status_value(statut_contrat) != ContractStatus.VALIDE.value:
            raise RegleMetierContratError(
                "Seul un contrat validé peut être clôturé"
            )
