import os

import jwt
from fastapi import Depends, HTTPException
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
