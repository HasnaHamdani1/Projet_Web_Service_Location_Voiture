"""Service Véhicule : lecture publique, écriture réservée à l'administrateur du service Véhicule,
changement de statut aussi permis au service Retour avec sa clé X-API-Key."""
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["DATABASE_URL"] = "sqlite:///./test_vehicules.db"
os.environ["JWT_SECRET"] = SECRET = "secret-de-test-service-vehicule-0123456789"
os.environ["VEHICULE_SERVICE_API_KEYS"] = "retours:cle-retours-test"

from main import app  # noqa: E402

client = TestClient(app)


def jeton(service, role="ADMINISTRATEUR", user_id=1):
    claims = {"sub": str(user_id), "role": role, "exp": datetime.now(timezone.utc) + timedelta(minutes=10)}
    if service:
        claims["service"] = service
    return {"Authorization": f"Bearer {jwt.encode(claims, SECRET, algorithm='HS256')}"}


VEHICULE = {"immatriculation": "TEST-1", "marque": "Dacia", "modele": "Logan", "annee": 2023,
            "prix_par_jour": 300, "statut": "DISPONIBLE"}


def test_droits_par_service():
    # Écriture refusée sans jeton, à un client et aux admins des autres services
    assert client.post("/vehicules", json=VEHICULE).status_code == 401
    assert client.post("/vehicules", json=VEHICULE, headers=jeton(None, role="CLIENT")).status_code == 403
    for service in ("RESERVATION", "CONTRAT", "RETOUR"):
        assert client.post("/vehicules", json=VEHICULE, headers=jeton(service)).status_code == 403, service

    # L'administrateur Véhicule ajoute ; l'administrateur enregistré est celui du jeton
    r = client.post("/vehicules", json={**VEHICULE, "administrateur_id": 99}, headers=jeton("VEHICULE", user_id=7))
    assert r.status_code == 201, r.text
    vid = r.json()["id"]
    assert r.json()["administrateur_id"] == 7

    # Lecture publique
    assert client.get("/vehicules").status_code == 200

    # Statut : admin d'un autre service refusé, service Retour accepté avec sa clé, mauvaise clé refusée
    url = f"/vehicules/{vid}/statut"
    assert client.put(url, json={"statut": "MAINTENANCE"}, headers=jeton("CONTRAT")).status_code == 403
    assert client.put(url, json={"statut": "MAINTENANCE"}, headers={"X-API-Key": "mauvaise"}).status_code == 401
    assert client.put(url, json={"statut": "DISPONIBLE"}, headers={"X-API-Key": "cle-retours-test"}).status_code == 200

    # Suppression : seulement l'administrateur Véhicule
    assert client.delete(f"/vehicules/{vid}", headers=jeton("RETOUR")).status_code == 403
    assert client.delete(f"/vehicules/{vid}", headers=jeton("VEHICULE")).status_code in (200, 204)
