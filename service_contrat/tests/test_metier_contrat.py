import unittest
from decimal import Decimal

from service_contrat.metier_contrat import (
    RegleMetierContratError,
    ReglesMetierContrat,
)
from service_contrat.enums import ContractStatus


class ReglesMetierContratTests(unittest.TestCase):
    def test_reservation_confirmee_permet_la_creation(self):
        """Cas normal : une réservation confirmée peut donner lieu à un contrat."""
        ReglesMetierContrat.verifier_reservation_confirmee("CONFIRMEE")

    def test_reservation_en_attente_est_refusee(self):
        """Cas d'erreur : une réservation non payée ne peut pas donner lieu à un contrat."""
        with self.assertRaisesRegex(RegleMetierContratError, "réservation confirmée"):
            ReglesMetierContrat.verifier_reservation_confirmee("EN_ATTENTE")

    def test_caution_absente_peut_etre_enregistree_sur_contrat_en_attente(self):
        """Cas normal : une caution absente peut être enregistrée avant signature."""
        ReglesMetierContrat.verifier_caution_enregistrable(
            ContractStatus.EN_ATTENTE, None
        )

    def test_caution_deja_enregistree_est_un_conflit(self):
        """Cas limite : la seconde tentative d'enregistrement est rejetée."""
        with self.assertRaisesRegex(RegleMetierContratError, "déjà enregistrée"):
            ReglesMetierContrat.verifier_caution_enregistrable(
                ContractStatus.EN_ATTENTE, Decimal("250.00")
            )

    def test_contrat_en_attente_avec_caution_positive_peut_etre_valide(self):
        ReglesMetierContrat.verifier_validation_possible(
            ContractStatus.EN_ATTENTE, Decimal("0.01")
        )

    def test_caution_nulle_ne_permet_pas_la_validation(self):
        """Cas limite : la caution doit être strictement supérieure à zéro."""
        with self.assertRaisesRegex(RegleMetierContratError, "caution doit être enregistrée"):
            ReglesMetierContrat.verifier_validation_possible(
                ContractStatus.EN_ATTENTE, Decimal("0.00")
            )

    def test_caution_infinie_ne_permet_pas_la_validation(self):
        """Cas limite : un montant non fini ne constitue pas une caution valide."""
        with self.assertRaisesRegex(RegleMetierContratError, "caution doit être enregistrée"):
            ReglesMetierContrat.verifier_validation_possible(
                ContractStatus.EN_ATTENTE, Decimal("Infinity")
            )

    def test_contrat_valide_peut_etre_cloture(self):
        ReglesMetierContrat.verifier_cloture_possible(ContractStatus.VALIDE)

    def test_contrat_en_attente_ne_peut_pas_etre_cloture(self):
        with self.assertRaisesRegex(RegleMetierContratError, "contrat validé"):
            ReglesMetierContrat.verifier_cloture_possible(ContractStatus.EN_ATTENTE)


if __name__ == "__main__":
    unittest.main()
