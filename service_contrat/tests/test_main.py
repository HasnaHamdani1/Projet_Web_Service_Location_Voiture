# La configuration est définie avant l'import de l'application pour
# empêcher les tests de se connecter à la base MySQL du projet.
import os

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET"] = "secret-temporaire-pour-les-tests"

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from service_contrat import main
from service_contrat.database import Base, get_db


def creer_jeton(utilisateur_id: int, role: str) -> str:
    """Crée un jeton temporaire pour les tests."""
    contenu = {
        "sub": str(utilisateur_id),
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
    }
    return jwt.encode(
        contenu,
        os.environ["JWT_SECRET"],
        algorithm="HS256",
    )


JETON_ADMIN = creer_jeton(1, "ADMINISTRATEUR")
JETON_CLIENT = creer_jeton(3, "CLIENT")


@pytest.fixture
def client_test(monkeypatch):
    """Fournit un client HTTP et une base SQLite isolée pour chaque test."""
    moteur_test = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=moteur_test)
    sessions_test = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=moteur_test,
    )

    def obtenir_session_test():
        session = sessions_test()
        try:
            yield session
        finally:
            session.close()

    main.app.dependency_overrides[get_db] = obtenir_session_test

    try:
        with TestClient(main.app) as client:
            yield client
    finally:
        main.app.dependency_overrides.pop(get_db, None)
        Base.metadata.drop_all(bind=moteur_test)
        moteur_test.dispose()


@pytest.fixture
def reservation_confirmee(monkeypatch):
    """Simule une réservation confirmée retournée par le service Réservation."""
    reservation = {
        "id": 1,
        "client_id": 3,
        "vehicule_id": 1,
        "date_debut": "2026-11-25",
        "date_fin": "2026-11-28",
        "prix_total": 750.00,
        "statut": "CONFIRMEE",
    }

    monkeypatch.setattr(
        main.reservation_client,
        "obtenir_reservation",
        lambda reservation_id: dict(reservation),
    )
    return reservation


def creer_contrat(client_test):
    """Crée un contrat de test avec le jeton administrateur."""
    return client_test.post(
        "/contrats",
        json={"reservation_id": 1},
        headers={"Authorization": f"Bearer {JETON_ADMIN}"},
    )


def test_sante_du_service(client_test):
    reponse = client_test.get("/health")

    assert reponse.status_code == 200
    assert reponse.json() == {"status": "ok", "service": "contrat"}


def test_creation_d_un_contrat_depuis_une_reservation_confirmee(
    client_test,
    reservation_confirmee,
):
    reponse = creer_contrat(client_test)

    assert reponse.status_code == 201
    assert reponse.json()["reservation_id"] == 1
    assert reponse.json()["statut"] == "EN_ATTENTE"
    assert reponse.json()["montant_total"] == "750.00"


def test_creation_refusee_si_la_reservation_n_est_pas_confirmee(
    client_test,
    reservation_confirmee,
):
    reservation_confirmee["statut"] = "EN_ATTENTE"

    reponse = creer_contrat(client_test)

    assert reponse.status_code == 409


def test_creation_refusee_sans_jeton_administrateur(
    client_test,
    reservation_confirmee,
):
    reponse = client_test.post(
        "/contrats",
        json={"reservation_id": 1},
    )

    assert reponse.status_code == 401


def test_une_reservation_ne_peut_creer_qu_un_seul_contrat(
    client_test,
    reservation_confirmee,
):
    premiere_reponse = creer_contrat(client_test)
    deuxieme_reponse = creer_contrat(client_test)

    assert premiere_reponse.status_code == 201
    assert deuxieme_reponse.status_code == 409


def test_validation_refusee_avant_l_enregistrement_de_la_caution(
    client_test,
    reservation_confirmee,
):
    creation = creer_contrat(client_test)
    contrat_id = creation.json()["id"]

    reponse = client_test.post(
        f"/contrats/{contrat_id}/validation",
        headers={"Authorization": f"Bearer {JETON_CLIENT}"},
    )

    assert reponse.status_code == 409


def test_caution_puis_validation_par_le_client(
    client_test,
    reservation_confirmee,
):
    creation = creer_contrat(client_test)
    contrat_id = creation.json()["id"]

    reponse_caution = client_test.post(
        f"/contrats/{contrat_id}/caution",
        json={"montant_caution": 500.00},
        headers={"Authorization": f"Bearer {JETON_ADMIN}"},
    )

    assert reponse_caution.status_code == 200
    assert Decimal(reponse_caution.json()["montant_caution"]) == Decimal("500.00")

    reponse_validation = client_test.post(
        f"/contrats/{contrat_id}/validation",
        headers={"Authorization": f"Bearer {JETON_CLIENT}"},
    )

    assert reponse_validation.status_code == 200
    assert reponse_validation.json()["statut"] == "VALIDE"
    assert reponse_validation.json()["date_validation"] is not None


def test_un_administrateur_ne_peut_pas_valider_a_la_place_du_client(
    client_test,
    reservation_confirmee,
):
    creation = creer_contrat(client_test)
    contrat_id = creation.json()["id"]

    client_test.post(
        f"/contrats/{contrat_id}/caution",
        json={"montant_caution": 500.00},
        headers={"Authorization": f"Bearer {JETON_ADMIN}"},
    )

    reponse = client_test.post(
        f"/contrats/{contrat_id}/validation",
        headers={"Authorization": f"Bearer {JETON_ADMIN}"},
    )

    assert reponse.status_code == 403