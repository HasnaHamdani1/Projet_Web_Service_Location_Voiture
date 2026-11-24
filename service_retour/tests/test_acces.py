import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
"""Droits par service : seul l'administrateur du service Retour enregistre, modifie ou supprime un retour."""
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite://")
SECRET = "secret-de-test-service-retour-0123456789"

from main import app  # noqa: E402

client = TestClient(app)
CORPS = {"contrat_id": 1, "administrateur_id": 1, "dateRetour": "2026-12-01", "etatVehicule": "BON"}


def jeton(service, role="ADMINISTRATEUR"):
    claims = {"sub": "1", "role": role, "exp": datetime.now(timezone.utc) + timedelta(minutes=10)}
    if service:
        claims["service"] = service
    return {"Authorization": f"Bearer {jwt.encode(claims, SECRET, algorithm='HS256')}"}


def test_ecriture_refusee_sans_jeton(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    assert client.post("/retours/traiter", json=CORPS).status_code == 401
    assert client.delete("/retours/1").status_code == 401


def test_ecriture_refusee_aux_admins_des_autres_services(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", SECRET)
    for service in ("VEHICULE", "RESERVATION", "CONTRAT"):
        assert client.post("/retours/traiter", json=CORPS, headers=jeton(service)).status_code == 403, service
        assert client.put("/retours/1", json={}, headers=jeton(service)).status_code == 403, service
    assert client.post("/retours", json=CORPS, headers=jeton(None, role="CLIENT")).status_code == 403
