
import os

import jwt
from jwt import InvalidTokenError

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from .database import SessionLocal
from .models import Utilisateur, Client, Administrateur
from .schemas import (
    ClientRegistration,
    LoginRequest,
    UserRead,
    TokenResponse,
)
from .security import (
    hash_password,
    verify_password,
    create_access_token,
)


app = FastAPI(title="Service Authentification")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer_scheme = HTTPBearer(auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def accueil():
    return {"message": "Bienvenue dans le Service Authentification"}


@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.connection().exec_driver_sql("SELECT 1")
        return {"status": "ok", "service": "auth"}
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Base de données indisponible",
        ) from exc


@app.post(
    "/auth/inscription",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
)
def inscription(
    donnees: ClientRegistration,
    db: Session = Depends(get_db),
):
    email = str(donnees.email).casefold()

    existant = db.query(Utilisateur).filter(
        Utilisateur.email == email
    ).first()

    if existant:
        raise HTTPException(
            status_code=409,
            detail="Cet e-mail est déjà utilisé.",
        )

    utilisateur = Utilisateur(
        nom=donnees.nom.strip(),
        email=email,
        mot_de_passe=hash_password(donnees.mot_de_passe),
        telephone=donnees.telephone,
        role="CLIENT",
    )

    try:
        db.add(utilisateur)
        db.flush()

        client = Client(
            id=utilisateur.id,
            adresse=donnees.adresse.strip(),
        )
        db.add(client)

        db.commit()
        db.refresh(utilisateur)

    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Impossible de créer ce compte.",
        ) from exc

    return utilisateur


@app.post(
    "/auth/token",
    response_model=TokenResponse,
)
def connexion(
    donnees: LoginRequest,
    db: Session = Depends(get_db),
):
    email = str(donnees.email).casefold()

    utilisateur = db.query(Utilisateur).filter(
        Utilisateur.email == email
    ).first()

    if (
        utilisateur is None
        or not verify_password(
            donnees.mot_de_passe,
            utilisateur.mot_de_passe,
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou mot de passe incorrect.",
        )

    token, expires_in = create_access_token(
        utilisateur.id,
        utilisateur.role,
    )

    return TokenResponse(
        access_token=token,
        expires_in=expires_in,
    )


@app.get("/auth/me", response_model=UserRead)
def profil(
    credentials: HTTPAuthorizationCredentials = Depends(
        bearer_scheme
    ),
    db: Session = Depends(get_db),
):
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authentification requise.",
        )

    secret = os.getenv("JWT_SECRET")

    if not secret:
        raise HTTPException(
            status_code=503,
            detail="Configuration JWT indisponible.",
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            secret,
            algorithms=["HS256"],
        )

        user_id = int(payload["sub"])

    except (InvalidTokenError, ValueError, KeyError, TypeError):
        raise HTTPException(
            status_code=401,
            detail="Jeton invalide ou expiré.",
        )

    utilisateur = db.query(Utilisateur).filter(
        Utilisateur.id == user_id
    ).first()

    if utilisateur is None:
        raise HTTPException(
            status_code=401,
            detail="Utilisateur introuvable.",
        )

    return utilisateur