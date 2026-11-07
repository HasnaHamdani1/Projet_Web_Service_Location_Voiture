import os
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError

from .enums import UserRole


bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    user_id: int
    role: UserRole


def get_current_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Principal:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentification requise",
            headers={"WWW-Authenticate": "Bearer"},
        )

    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La validation JWT n'est pas configurée",
        )

    try:
        claims = jwt.decode(
            credentials.credentials,
            secret,
            algorithms=["HS256"],
            options={"require": ["exp", "sub", "role"]},
        )
        user_id = int(claims["sub"])
        role = UserRole(claims["role"])
        if user_id <= 0:
            raise ValueError("sub must be a positive integer")
    except (InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Jeton invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    return Principal(user_id=user_id, role=role)


def require_admin(
    principal: Principal = Depends(get_current_principal),
) -> Principal:
    if principal.role != UserRole.ADMINISTRATEUR:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé à l'administrateur",
        )
    return principal


def require_client(
    principal: Principal = Depends(get_current_principal),
) -> Principal:
    if principal.role != UserRole.CLIENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Action réservée au client",
        )
    return principal
