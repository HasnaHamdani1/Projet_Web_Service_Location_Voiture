import hmac
import os

import jwt
from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError

bearer_scheme = HTTPBearer(auto_error=False)


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentification requise", headers={"WWW-Authenticate": "Bearer"})
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise HTTPException(status_code=503, detail="La validation JWT n'est pas configurée")
    try:
        claims = jwt.decode(credentials.credentials, secret, algorithms=["HS256"], options={"require": ["sub", "role", "exp"]})
        user_id = int(claims["sub"])
        role = claims["role"]
        if user_id <= 0 or role not in {"CLIENT", "ADMINISTRATEUR"}:
            raise ValueError("Claims invalides")
    except (InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Jeton invalide ou expiré", headers={"WWW-Authenticate": "Bearer"}) from exc
    return {"id": user_id, "role": role}


def require_admin(identity: dict = Depends(current_user)):
    if identity["role"] != "ADMINISTRATEUR":
        raise HTTPException(status_code=403, detail="Accès réservé à un administrateur")
    return identity


# ---------------------------------------------------------------------------
# Droits par service : tout administrateur consulte, seul l'administrateur du service
# Contrat (claim service = CONTRAT du jeton de service_auth) crée, valide ou clôture un contrat.
# Le service Retour clôture aussi un contrat, avec sa clé X-API-Key (CONTRAT_SERVICE_API_KEYS).
SERVICE_CONTRAT = "CONTRAT"


def _service_du_jeton(credentials: HTTPAuthorizationCredentials | None) -> str | None:
    try:
        return jwt.decode(credentials.credentials, os.getenv("JWT_SECRET", ""), algorithms=["HS256"]).get("service")
    except (InvalidTokenError, AttributeError):
        return None


def require_admin_contrats(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    identity: dict = Depends(require_admin),
):
    if _service_du_jeton(credentials) != SERVICE_CONTRAT:
        raise HTTPException(status_code=403, detail="Action réservée à l'administrateur du service Contrat")
    return identity


def _cles_services() -> dict[str, str]:
    cles = {}
    for paire in os.getenv("CONTRAT_SERVICE_API_KEYS", "").split(","):
        nom, _, cle = paire.strip().partition(":")
        if nom and cle:
            cles[cle.strip()] = nom.strip()
    return cles


def require_admin_contrats_ou_service(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
):
    if x_api_key:
        for cle, nom in _cles_services().items():
            if hmac.compare_digest(x_api_key.encode(), cle.encode()):
                return {"id": None, "role": "SERVICE", "service": nom}
        raise HTTPException(status_code=401, detail="Clé API invalide")
    identity = current_user(credentials)
    return require_admin_contrats(credentials, require_admin(identity))
