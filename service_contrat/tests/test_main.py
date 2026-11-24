from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

import jwt

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

ORIGINE_FRONTEND = "http://127.0.0.1:5500"
SECRET_TEST = "secret-de-test-service-contrat-0123456789"
CLE_RETOUR = "cle-retours-test"


def jeton(service: str | None, role: str = "ADMINISTRATEUR", user_id: int = 1) -> dict:
    claims = {"sub": str(user_id), "role": role, "exp": datetime.now(timezone.utc) + timedelta(minutes=30)}
    if service:
        claims["service"] = service
    return {"Authorization": f"Bearer {jwt.encode(claims, SECRET_TEST, algorithm='HS256')}"}

# L'application initialise sa base dès l'import.
with patch.dict("os.environ", {"DATABASE_URL": "sqlite://", "CORS_ORIGINS": ORIGINE_FRONTEND}):
    from service_contrat import main
    from service_contrat.database import Base, get_db


@pytest.fixture
def client_test(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET_TEST)
    monkeypatch.setenv("CONTRAT_SERVICE_API_KEYS", f"retours:{CLE_RETOUR}")
    moteur = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=moteur)
    sessions = sessionmaker(bind=moteur)

    def obtenir_session():
        with sessions() as session:
            yield session

    main.app.dependency_overrides[get_db] = obtenir_session
    try:
        with TestClient(main.app) as client:
            # Par défaut : administrateur du service Contrat (Sara)
            client.headers.update(jeton("CONTRAT"))
            yield client
    finally:
        main.app.dependency_overrides.pop(get_db, None)
        moteur.dispose()


@pytest.fixture
def reservation_confirmee(monkeypatch):
    reservation = {
        "id": 1,
        "client_id": 3,
        "vehicule_id": 1,
        "date_debut": "2026-11-25",
        "date_fin": "2026-11-28",
        "prix_total": 750.00,
        "statut": "CONFIRMEE",
    }
    monkeypatch.setattr(main.reservation_client, "obtenir_reservation", lambda _: dict(reservation))
    return reservation


@pytest.fixture
def demande_finalisation():
    return {
        "reservation_id": 1,
        "numero_contrat": "CTR-2026-ABCD1234",
        "montant_caution": "500.00",
        "signatures_confirmees": True,
    }


def creer_contrat(client_test):
    return client_test.post("/contrats", json={"reservation_id": 1})


def test_sante_du_service(client_test):
    reponse = client_test.get("/health")
    assert reponse.status_code == 200
    assert reponse.json() == {"status": "ok", "service": "contrat"}


def test_creation_sans_jeton_depuis_une_reservation_confirmee(client_test, reservation_confirmee):
    reponse = creer_contrat(client_test)
    assert reponse.status_code == 201
    assert reponse.json()["reservation_id"] == 1
    assert reponse.json()["statut"] == "EN_ATTENTE"
    assert reponse.json()["montant_total"] == "750.00"


def test_creation_refusee_si_la_reservation_n_est_pas_confirmee(client_test, reservation_confirmee):
    reservation_confirmee["statut"] = "EN_ATTENTE"
    assert creer_contrat(client_test).status_code == 409


def test_une_reservation_ne_peut_creer_qu_un_seul_contrat(client_test, reservation_confirmee):
    assert creer_contrat(client_test).status_code == 201
    assert creer_contrat(client_test).status_code == 409


def test_validation_refusee_avant_l_enregistrement_de_la_caution(client_test, reservation_confirmee):
    creation = creer_contrat(client_test)
    assert creation.status_code == 201
    contrat_id = creation.json()["id"]
    assert client_test.post(f"/contrats/{contrat_id}/validation").status_code == 409


def test_caution_puis_validation_du_contrat_en_attente(client_test, reservation_confirmee):
    creation = creer_contrat(client_test)
    assert creation.status_code == 201
    contrat_id = creation.json()["id"]
    caution = client_test.post(f"/contrats/{contrat_id}/caution", json={"montant_caution": 500.00})
    assert caution.status_code == 200
    assert Decimal(caution.json()["montant_caution"]) == Decimal("500.00")

    validation = client_test.post(f"/contrats/{contrat_id}/validation")
    assert validation.status_code == 200
    assert validation.json()["statut"] == "VALIDE"
    assert validation.json()["date_validation"] is not None


def test_finalisation_persiste_le_contrat_et_refuse_un_doublon(
    client_test, reservation_confirmee, demande_finalisation,
):
    reponse = client_test.post("/contrats/finalisation", json=demande_finalisation)
    assert reponse.status_code == 201
    contrat = reponse.json()
    assert contrat["statut"] == "VALIDE"
    assert contrat["date_validation"] is not None
    assert contrat["montant_caution"] == "500.00"

    seconde_demande = {**demande_finalisation, "numero_contrat": "CTR-2026-ABCD5678"}
    assert client_test.post("/contrats/finalisation", json=seconde_demande).status_code == 409
    liste = client_test.get("/contrats", params={"statut": "VALIDE"})
    assert liste.status_code == 200
    assert liste.json() == [{**contrat, "reservation": reservation_confirmee}]


def test_finalisation_enregistre_les_details_de_la_caution(
    client_test, reservation_confirmee, demande_finalisation,
):
    details = {
        "mode_encaissement": "ESPECES",
        "statut_caution": "A_RECEVOIR",
        "conditions_particulieres": "Restitution du véhicule avant 18 h.",
    }
    creation = client_test.post("/contrats/finalisation", json={**demande_finalisation, **details})
    assert creation.status_code == 201
    lecture = client_test.get(f"/contrats/{creation.json()['id']}")
    assert lecture.status_code == 200
    assert {champ: lecture.json()[champ] for champ in details} == details


def test_finalisation_reprend_un_contrat_en_attente(
    client_test, reservation_confirmee, demande_finalisation,
):
    creation = creer_contrat(client_test)
    assert creation.status_code == 201
    brouillon = creation.json()
    demande_finalisation["numero_contrat"] = brouillon["numero_contrat"]
    reponse = client_test.post("/contrats/finalisation", json=demande_finalisation)
    assert reponse.status_code == 201
    assert reponse.json()["id"] == brouillon["id"]
    assert reponse.json()["statut"] == "VALIDE"


@pytest.mark.parametrize("champ,valeur", [
    ("signatures_confirmees", False),
    ("montant_caution", "0.00"),
    ("mode_encaissement", "AUTRE"),
    ("statut_caution", "AUTRE"),
    ("conditions_particulieres", "x" * 1001),
])
def test_finalisation_invalide_ne_cree_pas_de_contrat(
    client_test, reservation_confirmee, demande_finalisation, champ, valeur,
):
    demande_finalisation[champ] = valeur
    reponse = client_test.post("/contrats/finalisation", json=demande_finalisation)
    assert reponse.status_code == 422
    assert client_test.get("/contrats").json() == []


def test_cloture_depuis_le_service_retour(client_test, reservation_confirmee, demande_finalisation):
    creation = client_test.post("/contrats/finalisation", json=demande_finalisation)
    assert creation.status_code == 201
    url = f"/contrats/{creation.json()['id']}"
    cloture = client_test.put(f"{url}/statut", json={"statut": "CLOTURE"})
    assert cloture.status_code == 200
    assert cloture.json()["statut"] == "CLOTURE"
    assert cloture.json()["date_cloture"] is not None
    assert client_test.get(url).json()["statut"] == "CLOTURE"


def test_cloture_refusee_pour_un_contrat_en_attente(client_test, reservation_confirmee):
    creation = creer_contrat(client_test)
    assert creation.status_code == 201
    url = f"/contrats/{creation.json()['id']}/statut"
    assert client_test.put(url, json={"statut": "CLOTURE"}).status_code == 409


def test_requete_cors_autorise_le_put_de_cloture(client_test):
    reponse = client_test.options("/contrats/1/statut", headers={
        "Origin": ORIGINE_FRONTEND,
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "content-type",
    })
    assert reponse.status_code == 200
    assert reponse.headers["Access-Control-Allow-Origin"] == ORIGINE_FRONTEND


def test_ecriture_refusee_sans_jeton_ou_a_un_admin_d_un_autre_service(client_test, reservation_confirmee):
    sans_jeton = {"Authorization": ""}
    assert client_test.post("/contrats", json={"reservation_id": 1}, headers=sans_jeton).status_code == 401
    for service in ("VEHICULE", "RESERVATION", "RETOUR"):
        reponse = client_test.post("/contrats", json={"reservation_id": 1}, headers=jeton(service))
        assert reponse.status_code == 403, service
    assert client_test.post("/contrats", json={"reservation_id": 1}, headers=jeton(None, role="CLIENT")).status_code == 403
    # La lecture reste ouverte (service Retour, pages Contrat, tableau de bord)
    assert client_test.get("/contrats", headers=sans_jeton).status_code == 200


def test_cloture_par_le_service_retour_avec_sa_cle(client_test, reservation_confirmee, demande_finalisation):
    contrat = client_test.post("/contrats/finalisation", json=demande_finalisation).json()
    url = f"/contrats/{contrat['id']}/statut"
    sans_jeton = {"Authorization": ""}
    assert client_test.put(url, json={"statut": "CLOTURE"}, headers={**sans_jeton, "X-API-Key": "mauvaise"}).status_code == 401
    reponse = client_test.put(url, json={"statut": "CLOTURE"}, headers={**sans_jeton, "X-API-Key": CLE_RETOUR})
    assert reponse.status_code == 200
    assert reponse.json()["statut"] == "CLOTURE"
