"""Contrôle d'accès du service Véhicule.

- Lecture (GET) : publique (catalogue, autres services).
- Écriture : réservée à l'administrateur du service Véhicule (jeton de service_auth, claim service = VEHICULE).
- Changement de statut : aussi autorisé au service Retour, avec sa clé X-API-Key (VEHICULE_SERVICE_API_KEYS).
"""
import hmac
import os

import jwt
from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError

SERVICE = "VEHICULE"
bearer = HTTPBearer(auto_error=False)


def _cles_services() -> dict[str, str]:
    """VEHICULE_SERVICE_API_KEYS=retours:<clé>,… → {clé: nom du service appelant}."""
    cles = {}
    for paire in os.getenv("VEHICULE_SERVICE_API_KEYS", "").split(","):
        nom, _, cle = paire.strip().partition(":")
        if nom and cle:
            cles[cle.strip()] = nom.strip()
    return cles


def _administrateur(creds: HTTPAuthorizationCredentials | None) -> dict:
    if creds is None:
        raise HTTPException(status_code=401, detail="Connexion administrateur requise",
                            headers={"WWW-Authenticate": "Bearer"})
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise HTTPException(status_code=503, detail="Configuration JWT indisponible (JWT_SECRET)")
    try:
        claims = jwt.decode(creds.credentials, secret, algorithms=["HS256"])
        identite = {"id": int(claims["sub"]), "role": claims["role"], "service": claims.get("service")}
    except (InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Jeton invalide ou expiré",
                            headers={"WWW-Authenticate": "Bearer"}) from exc
    if identite["role"] != "ADMINISTRATEUR":
        raise HTTPException(status_code=403, detail="Action réservée aux administrateurs")
    return identite


def admin_vehicules(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    identite = _administrateur(creds)
    if identite["service"] != SERVICE:
        raise HTTPException(status_code=403, detail="Action réservée à l'administrateur du service Véhicule")
    return identite


def admin_vehicules_ou_service(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> dict:
    if x_api_key:
        for cle, nom in _cles_services().items():
            if hmac.compare_digest(x_api_key.encode(), cle.encode()):
                return {"id": None, "role": "SERVICE", "service": nom}
        raise HTTPException(status_code=401, detail="Clé API invalide")
    return admin_vehicules(creds)
