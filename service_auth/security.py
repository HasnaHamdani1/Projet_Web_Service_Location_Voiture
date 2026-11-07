import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, status


SCRYPT_N = 2**14
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_LENGTH = 64


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=SCRYPT_N,
        r=SCRYPT_R,
        p=SCRYPT_P,
        dklen=SCRYPT_LENGTH,
    )
    salt_text = base64.urlsafe_b64encode(salt).decode("ascii").rstrip("=")
    digest_text = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt_text}${digest_text}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, n, r, p, salt_text, digest_text = encoded.split("$", 5)
        if algorithm != "scrypt":
            return False
        if (int(n), int(r), int(p)) != (SCRYPT_N, SCRYPT_R, SCRYPT_P):
            return False
        salt = base64.urlsafe_b64decode(salt_text + "=" * (-len(salt_text) % 4))
        expected = base64.urlsafe_b64decode(
            digest_text + "=" * (-len(digest_text) % 4)
        )
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=SCRYPT_N,
            r=SCRYPT_R,
            p=SCRYPT_P,
            dklen=len(expected),
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int, role: str) -> tuple[str, int]:
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La signature JWT n'est pas configurée",
        )
    try:
        ttl_minutes = int(os.getenv("JWT_TTL_MINUTES", "60"))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="JWT_TTL_MINUTES doit être un entier",
        ) from exc
    if not 1 <= ttl_minutes <= 1440:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="JWT_TTL_MINUTES doit être compris entre 1 et 1440",
        )
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=ttl_minutes)
    token = jwt.encode(
        {
            "sub": str(user_id),
            "role": role,
            "iat": now,
            "exp": expires,
        },
        secret,
        algorithm="HS256",
    )
    return token, ttl_minutes * 60
