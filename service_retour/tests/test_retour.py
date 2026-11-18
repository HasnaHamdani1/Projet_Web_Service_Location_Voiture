import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from datetime import date
from decimal import Decimal

from retour_service import RetourService
from models import Retour
from enums import EtatVehicule

@pytest.fixture
def service():
    return RetourService()


@pytest.fixture
def retour():
    return Retour(
        dateRetour=date(2026, 11, 11),
        etatVehicule=EtatVehicule.BON,
        contrat_id=201,
        administrateur_id=1
    )


# ==========================================
# Tests de recupererMontantEstime()
# ==========================================

def test_recuperer_montant_estime(service):
    montant = service.recupererMontantEstime(201)

    assert montant == Decimal("1400.0")


def test_recuperer_montant_contrat_inexistant(service):
    with pytest.raises(ValueError, match="Contrat introuvable"):
        service.recupererMontantEstime(999)


# ==========================================
# Tests de verifierRetard()
# ==========================================

def test_retour_avant_date_fin(service):
    resultat = service.verifierRetard(
        date(2026, 11, 7),
        date(2026, 11, 8)
    )

    assert resultat == (False, 0)


def test_retour_a_date_fin(service):
    resultat = service.verifierRetard(
        date(2026, 11, 8),
        date(2026, 11, 8)
    )

    assert resultat == (False, 0)


def test_retour_apres_date_fin(service):
    resultat = service.verifierRetard(
        date(2026, 11, 11),
        date(2026, 11, 8)
    )

    assert resultat == (True, 3)


# ==========================================
# Tests de calculerMontantRetard()
# ==========================================

def test_calculer_montant_retard(service):
    montant = service.calculerMontantRetard(201, 3)

    assert montant == Decimal("8400.00")


def test_calculer_montant_retard_sans_retard(service):
    montant = service.calculerMontantRetard(201, 0)

    assert montant == Decimal("0.00")


def test_calculer_montant_retard_duree_negative(service):
    with pytest.raises(ValueError):
        service.calculerMontantRetard(201, -2)


# ==========================================
# Tests de verifierEtat()
# ==========================================

def test_verifier_etat_valide(service, retour):
    resultat = service.verifierEtat(
        retour,
        "LEGER_DOMMAGE"
    )

    assert resultat == EtatVehicule.LEGER_DOMMAGE
    assert retour.etatVehicule == EtatVehicule.LEGER_DOMMAGE


def test_verifier_etat_invalide(service, retour):
    with pytest.raises(ValueError, match="Ã‰tat du vÃ©hicule invalide"):
        service.verifierEtat(retour, "MAUVAIS_ETAT")


# ==========================================
# Tests de enregistrerDommage()
# ==========================================

def test_enregistrer_dommage(service, retour):
    retour.etatVehicule = EtatVehicule.LEGER_DOMMAGE

    service.enregistrerDommage(
        retour,
        "Rayure sur la portiÃ¨re droite",
        Decimal("500.00")
    )

    assert retour.dommage == "Rayure sur la portiÃ¨re droite"
    assert retour.montantDommage == Decimal("500.00")


def test_enregistrer_dommage_vehicule_bon(service, retour):
    with pytest.raises(ValueError, match="Impossible d'enregistrer un dommage"):
        service.enregistrerDommage(
            retour,
            "Rayure",
            Decimal("500.00")
        )


def test_enregistrer_dommage_description_vide(service, retour):
    retour.etatVehicule = EtatVehicule.LEGER_DOMMAGE

    with pytest.raises(ValueError, match="description du dommage"):
        service.enregistrerDommage(
            retour,
            "   ",
            Decimal("500.00")
        )

def test_enregistrer_dommage_montant_negatif(service, retour):
    retour.etatVehicule = EtatVehicule.LEGER_DOMMAGE

    with pytest.raises(ValueError, match="montant du dommage"):
        service.enregistrerDommage(
            retour,
            "Rayure",
            Decimal("-100.00")
        )
