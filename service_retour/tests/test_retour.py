import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
import requests
from datetime import date
from decimal import Decimal

from retour_service import RetourService
from models import Retour
from enums import EtatVehicule

@pytest.fixture
def service():
    return RetourService(contrat_api_url="http://contrat.test", vehicule_api_url="http://vehicule.test")


@pytest.fixture
def retour():
    return Retour(
        dateRetour=date(2026, 11, 11),
        etatVehicule=EtatVehicule.BON,
        contrat_id=201,
        administrateur_id=1
    )


# ==========================================
# Faux service Contrat (aucun appel réseau pendant les tests)
# ==========================================

class _FausseReponse:
    def __init__(self, statut, donnees=None):
        self.status_code = statut
        self._donnees = donnees

    def json(self):
        return self._donnees

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.exceptions.HTTPError(response=self)


# Contrat 201 : 7 jours (du 1er au 8 novembre) pour 9 800 MAD, soit 1 400 MAD par jour
CONTRATS = {
    201: {
        "id": 201,
        "numero_contrat": "CTR-2026-TEST",
        "periode_prise": "2026-11-01",
        "periode_fin": "2026-11-08",
        "montant_total": "9800.00",
        "reservation": {"id": 12, "vehicule_id": 4},
    }
}


@pytest.fixture(autouse=True)
def faux_service_contrat(monkeypatch):
    def faux_get(url, timeout=5, **_):
        contrat_id = int(url.rstrip("/").rsplit("/", 1)[-1])
        if contrat_id in CONTRATS:
            return _FausseReponse(200, CONTRATS[contrat_id])
        return _FausseReponse(404, {"detail": "Contrat introuvable"})

    monkeypatch.setattr(requests, "get", faux_get)


# ==========================================
# Tests de recupererDetailsReservationParContrat()
# ==========================================

def test_recuperer_prix_par_jour(service):
    details = service.recupererDetailsReservationParContrat(201)

    assert Decimal(details["montantEstime"]) == Decimal("1400.00")
    assert details["vehicule_id"] == 4


def test_recuperer_montant_contrat_inexistant(service):
    with pytest.raises(ValueError, match="Contrat introuvable"):
        service.recupererDetailsReservationParContrat(999)


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
    with pytest.raises(ValueError, match="État du véhicule invalide"):
        service.verifierEtat(retour, "MAUVAIS_ETAT")


# ==========================================
# Tests de enregistrerDommage()
# ==========================================

def test_enregistrer_dommage(service, retour):
    retour.etatVehicule = EtatVehicule.LEGER_DOMMAGE

    service.enregistrerDommage(
        retour,
        "Rayure sur la portière droite",
        Decimal("500.00")
    )

    assert retour.dommage == "Rayure sur la portière droite"
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
