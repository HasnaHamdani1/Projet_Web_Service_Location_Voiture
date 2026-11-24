"""Authentification commune à l'équipe (TEAM_SYNC §3.5).

Jetons HS256 émis par service_auth : `sub` = id utilisateur (chaîne), `role` = CLIENT | ADMINISTRATEUR, `exp`,
et pour un administrateur `service` = VEHICULE | RESERVATION | CONTRAT | RETOUR (service qu'il gère).
Tout administrateur peut consulter ; seul l'administrateur du service RESERVATION agit sur les réservations.
Les microservices peuvent aussi s'identifier par l'en-tête X-API-Key (SERVICE_API_KEYS).
"""
from dataclasses import dataclass

import jwt
from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings
from .erreurs import Interdit, NonAuthentifie, ServiceIndisponible

ADMIN = "ADMINISTRATEUR"
CLIENT = "CLIENT"
SERVICE = "SERVICE"
SERVICE_RESERVATION = "RESERVATION"

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Acteur:
    """Utilisateur ou service à l'origine d'une requête (None = appel anonyme en lecture publique)."""

    id: int | None
    role: str
    nom: str
    service: str | None = None  # administrateur : service qu'il gère

    @property
    def gere_les_reservations(self) -> bool:
        return self.role == ADMIN and self.service == SERVICE_RESERVATION

    @property
    def est_admin(self) -> bool:
        return self.role == ADMIN

    @property
    def est_client(self) -> bool:
        return self.role == CLIENT

    @property
    def est_service(self) -> bool:
        return self.role == SERVICE


def decoder_jeton(token: str) -> Acteur:
    if not settings.JWT_SECRET:
        raise ServiceIndisponible("Configuration JWT indisponible (JWT_SECRET).")
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        user_id = int(payload["sub"])
        role = str(payload["role"])
        service = payload.get("service")
    except jwt.ExpiredSignatureError as exc:
        raise NonAuthentifie("Session expirée, veuillez vous reconnecter.", code="jeton_expire") from exc
    except (jwt.InvalidTokenError, KeyError, ValueError, TypeError) as exc:
        raise NonAuthentifie("Jeton invalide ou expiré.") from exc
    if role not in (ADMIN, CLIENT):
        raise NonAuthentifie("Rôle non reconnu.")
    nom = "Administrateur" if role == ADMIN else "Client"
    return Acteur(id=user_id, role=role, nom=f"{nom} #{user_id}", service=str(service) if service else None)


def acteur_optionnel(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> Acteur | None:
    if x_api_key:
        nom = settings.service_keys.get(x_api_key)
        if not nom:
            raise NonAuthentifie("Clé API invalide.")
        return Acteur(id=None, role=SERVICE, nom=f"Service {nom}")
    if creds:
        return decoder_jeton(creds.credentials)
    return None


def acteur_requis(acteur: Acteur | None = Depends(acteur_optionnel)) -> Acteur:
    if acteur is None:
        raise NonAuthentifie("Authentification requise.")
    return acteur


def lecteur(acteur: Acteur | None = Depends(acteur_optionnel)) -> Acteur | None:
    """Lecture : anonyme accepté si LECTURE_PUBLIQUE (compatibilité avec le service Contrat actuel)."""
    if acteur is None and not settings.LECTURE_PUBLIQUE:
        raise NonAuthentifie("Authentification requise.")
    return acteur


def utilisateur(acteur: Acteur = Depends(acteur_requis)) -> Acteur:
    """Client ou administrateur connecté (pas un service)."""
    if acteur.est_service:
        raise Interdit("Action réservée aux utilisateurs connectés.")
    return acteur


def client_connecte(acteur: Acteur = Depends(acteur_requis)) -> Acteur:
    """Réservation en ligne : réservée aux comptes CLIENT (l'administrateur gère et consulte)."""
    if not acteur.est_client:
        raise Interdit("Les réservations sont effectuées par les clients depuis le site de réservation.")
    return acteur


def administrateur(acteur: Acteur = Depends(acteur_requis)) -> Acteur:
    if not acteur.est_admin:
        raise Interdit("Action réservée aux administrateurs.")
    return acteur


def administrateur_ou_service(acteur: Acteur = Depends(acteur_requis)) -> Acteur:
    if not (acteur.est_admin or acteur.est_service):
        raise Interdit("Action réservée aux administrateurs et aux services autorisés.")
    return acteur


def verifier_gestion_reservations(acteur: Acteur) -> None:
    """Un administrateur n'agit sur les réservations que s'il gère le service Réservation."""
    if acteur.est_admin and not acteur.gere_les_reservations:
        raise Interdit("Action réservée à l'administrateur du service Réservation.", code="service_non_autorise")


def admin_reservations(acteur: Acteur = Depends(administrateur)) -> Acteur:
    verifier_gestion_reservations(acteur)
    return acteur


def admin_reservations_ou_service(acteur: Acteur = Depends(administrateur_ou_service)) -> Acteur:
    verifier_gestion_reservations(acteur)
    return acteur
