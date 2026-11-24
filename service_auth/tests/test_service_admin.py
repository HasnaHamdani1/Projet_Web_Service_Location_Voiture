"""Le jeton et /auth/me d'un administrateur indiquent le service qu'il gère (périmètre de ses droits)."""
import os

import jwt
from fastapi.testclient import TestClient

os.environ["DATABASE_URL"] = "sqlite:///./test_auth.db"
os.environ["JWT_SECRET"] = SECRET = "secret-de-test-service-auth-0123456789"

from service_auth.database import Base, SessionLocal, engine  # noqa: E402
from service_auth.main import app  # noqa: E402
from service_auth.models import Administrateur, AdministrateurService, Client, Utilisateur  # noqa: E402
from service_auth.security import hash_password  # noqa: E402

MDP = "MotDePasseTest2026"


def setup_module():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        for i, (email, service) in enumerate([("leila@test.ma", "VEHICULE"), ("maryam@test.ma", "RESERVATION")], 1):
            db.add(Utilisateur(id=i, nom=email, email=email, mot_de_passe=hash_password(MDP), role="ADMINISTRATEUR"))
            db.flush()
            db.add(Administrateur(id=i))
            db.flush()
            db.add(AdministrateurService(administrateur_id=i, service=service))
        db.add(Utilisateur(id=3, nom="Client", email="client@test.ma", mot_de_passe=hash_password(MDP), role="CLIENT"))
        db.flush()
        db.add(Client(id=3, adresse="Agadir"))
        db.commit()


def teardown_module():
    engine.dispose()
    os.remove("test_auth.db")


def test_jeton_et_profil_contiennent_le_service():
    client = TestClient(app)
    for email, service in [("leila@test.ma", "VEHICULE"), ("maryam@test.ma", "RESERVATION")]:
        r = client.post("/auth/token", json={"email": email, "mot_de_passe": MDP})
        assert r.status_code == 200, r.text
        token = r.json()["access_token"]
        assert jwt.decode(token, SECRET, algorithms=["HS256"])["service"] == service
        profil = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
        assert profil["role"] == "ADMINISTRATEUR" and profil["service"] == service


def test_client_sans_service():
    client = TestClient(app)
    token = client.post("/auth/token", json={"email": "client@test.ma", "mot_de_passe": MDP}).json()["access_token"]
    assert "service" not in jwt.decode(token, SECRET, algorithms=["HS256"])
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["service"] is None
