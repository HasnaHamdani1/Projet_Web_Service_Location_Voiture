import os

import jwt
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from .database import get_db
from .models import Administrateur, Client, Utilisateur
from .schemas import ClientRegistration, LoginRequest, TokenResponse, UserRead
from .security import create_access_token, hash_password, verify_password


app = FastAPI(
    title="Service Authentification",
    description="Inscription client, authentification et émission de jetons JWT.",
    version="1.0.0",
)
origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]
if origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

bearer_scheme = HTTPBearer(auto_error=False)


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
):
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authentification requise",
            headers={"WWW-Authenticate": "Bearer"},
        )
    secret = os.getenv("JWT_SECRET")
    if not secret:
        raise HTTPException(status_code=503, detail="La validation JWT n'est pas configurée")
    try:
        claims = jwt.decode(
            credentials.credentials,
            secret,
            algorithms=["HS256"],
            options={"require": ["sub", "role", "exp"]},
        )
        user_id = int(claims["sub"])
        role = claims["role"]
        if user_id <= 0 or role not in {"CLIENT", "ADMINISTRATEUR"}:
            raise ValueError("Invalid subject or role")
    except (InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=401,
            detail="Jeton invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return {"id": user_id, "role": role}


@app.get("/")
def accueil():
    return {"message": "Bienvenue dans le service Authentification"}


@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.connection().exec_driver_sql("SELECT 1")
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Base de données indisponible") from exc
    return {"status": "ok", "service": "auth"}


@app.post("/auth/inscription", response_model=UserRead, status_code=201)
def inscrire_client(
    demande: ClientRegistration,
    db: Session = Depends(get_db),
):
    email = str(demande.email).strip().casefold()
    utilisateur = Utilisateur(
        nom=demande.nom.strip(),
        email=email,
        mot_de_passe=hash_password(demande.mot_de_passe),
        telephone=demande.telephone,
    )
    db.add(utilisateur)
    try:
        db.flush()
        db.add(Client(id=utilisateur.id, adresse=demande.adresse.strip()))
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Cette adresse e-mail existe déjà") from exc
    db.refresh(utilisateur)
    return {
        "id": utilisateur.id,
        "nom": utilisateur.nom,
        "email": utilisateur.email,
        "telephone": utilisateur.telephone,
        "role": "CLIENT",
    }


@app.post("/auth/token", response_model=TokenResponse)
def obtenir_jeton(
    demande: LoginRequest,
    db: Session = Depends(get_db),
):
    email = str(demande.email).strip().casefold()
    utilisateur = (
        db.query(Utilisateur)
        .filter(func.lower(Utilisateur.email) == email)
        .first()
    )
    if utilisateur is None or not verify_password(
        demande.mot_de_passe, utilisateur.mot_de_passe
    ):
        raise HTTPException(
            status_code=401,
            detail="E-mail ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if db.query(Administrateur.id).filter(Administrateur.id == utilisateur.id).first():
        role = "ADMINISTRATEUR"
    elif db.query(Client.id).filter(Client.id == utilisateur.id).first():
        role = "CLIENT"
    else:
        raise HTTPException(status_code=403, detail="Aucun rôle actif pour cet utilisateur")

    token, expires_in = create_access_token(utilisateur.id, role)
    return TokenResponse(access_token=token, expires_in=expires_in)


@app.get("/auth/me")
def lire_mon_profil(
    identity: dict = Depends(current_user),
    db: Session = Depends(get_db),
):
    utilisateur = db.query(Utilisateur).filter(Utilisateur.id == identity["id"]).first()
    if utilisateur is None:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    return {
        "id": utilisateur.id,
        "nom": utilisateur.nom,
        "email": utilisateur.email,
        "telephone": utilisateur.telephone,
        "role": identity["role"],
    }
