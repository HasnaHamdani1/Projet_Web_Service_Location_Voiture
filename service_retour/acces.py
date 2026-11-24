"""Contrôle d'accès du service Retour.

- Lecture (GET) : ouverte (tableau de bord, interface Retours).
- Écriture (enregistrer, traiter, modifier, supprimer un retour) : réservée à l'administrateur
  du service Retour (jeton de service_auth avec le claim service = RETOUR).
"""
import os

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError

SERVICE_RETOUR = "RETOUR"
bearer = HTTPBearer(auto_error=False)


def admin_retours(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
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
    if identite["role"] != "ADMINISTRATEUR" or identite["service"] != SERVICE_RETOUR:
        raise HTTPException(status_code=403, detail="Action réservée à l'administrateur du service Retour")
    return identite
