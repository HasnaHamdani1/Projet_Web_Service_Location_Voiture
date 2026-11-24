"""Accès aux données des autres services, derrière des interfaces remplaçables.

- Véhicules : API REST du service Véhicule (VEHICLE_SERVICE_URL) — TEAM_SYNC §3.1.
- Clients   : appartiennent au service d'authentification. Tant qu'il n'expose pas de route de lecture
  des clients, lecture SEULE des tables `utilisateurs`/`clients` (CLIENT_PROVIDER=db, exception documentée
  dans TEAM_SYNC). Basculer sur CLIENT_PROVIDER=http dès que `GET /clients` existe côté Auth.
"""
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from .config import settings
from .erreurs import ServiceIndisponible

logger = logging.getLogger("service_reservation.fournisseurs")


# ----------------------------------------------------------------------------- véhicules
@dataclass(frozen=True)
class Vehicule:
    id: int
    immatriculation: str
    marque: str
    modele: str
    prix_jour: Decimal
    statut: str
    annee: int | None = None
    categorie: str | None = None
    boite: str | None = None
    carburant: str | None = None
    image_url: str | None = None

    @property
    def libelle(self) -> str:
        return f"{self.marque} {self.modele}".strip()

    def en_dict(self) -> dict[str, Any]:
        return {
            "id": self.id, "immatriculation": self.immatriculation, "marque": self.marque,
            "modele": self.modele, "libelle": self.libelle, "annee": self.annee,
            "categorie": self.categorie, "boite": self.boite, "carburant": self.carburant,
            "prix_par_jour": float(self.prix_jour), "statut": self.statut, "image_url": self.image_url,
        }


def _pick(data: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for k in keys:
        if data.get(k) is not None:
            return data[k]
    return default


def convertir_vehicule(data: dict[str, Any]) -> Vehicule:
    """Accepte les noms du service Véhicule actuel (prix_par_jour) et du schéma SQL (prixParJour)."""
    return Vehicule(
        id=int(_pick(data, "id")),
        immatriculation=str(_pick(data, "immatriculation", default="")),
        marque=str(_pick(data, "marque", default="")),
        modele=str(_pick(data, "modele", default="")),
        annee=_pick(data, "annee"),
        categorie=_pick(data, "categorie", "type"),
        boite=_pick(data, "boite", "transmission"),
        carburant=_pick(data, "carburant"),
        prix_jour=Decimal(str(_pick(data, "prix_par_jour", "prixParJour", "prix_jour", "prix", default="0"))),
        statut=str(_pick(data, "statut", default="DISPONIBLE")).upper(),
        image_url=_pick(data, "image_url", "imageUrl"),
    )


class FournisseurVehicules(ABC):
    @abstractmethod
    def lister(self) -> list[Vehicule]: ...

    @abstractmethod
    def obtenir(self, vehicule_id: int) -> Vehicule | None: ...

    def changer_statut(self, vehicule_id: int, statut: str) -> bool:
        """Met à jour le statut du véhicule (RESERVE, DISPONIBLE) ; False si le service Véhicule refuse."""
        return True


class VehiculesHttp(FournisseurVehicules):
    def __init__(self, base_url: str | None = None, client: httpx.Client | None = None):
        self.base_url = (base_url or settings.VEHICLE_SERVICE_URL).rstrip("/")
        self.client = client or httpx.Client(timeout=settings.VEHICLE_SERVICE_TIMEOUT)

    def _get(self, path: str) -> Any:
        try:
            resp = self.client.get(f"{self.base_url}{path}")
        except httpx.HTTPError as exc:
            logger.error("Service Véhicule injoignable : %s", exc)
            raise ServiceIndisponible("Le service Véhicule est indisponible.") from exc
        if resp.status_code == 404:
            return None
        if resp.is_error:
            raise ServiceIndisponible(f"Le service Véhicule a répondu {resp.status_code}.")
        return resp.json()

    def lister(self) -> list[Vehicule]:
        data = self._get("/vehicules") or []
        if isinstance(data, dict):
            data = _pick(data, "items", "content", "vehicules", default=[])
        return [convertir_vehicule(v) for v in data]

    def obtenir(self, vehicule_id: int) -> Vehicule | None:
        data = self._get(f"/vehicules/{vehicule_id}")
        return convertir_vehicule(data) if data else None

    def changer_statut(self, vehicule_id: int, statut: str) -> bool:
        """PUT /vehicules/{id}/statut avec la clé du service Réservation ; un échec est journalisé, pas bloquant."""
        try:
            resp = self.client.put(f"{self.base_url}/vehicules/{vehicule_id}/statut", json={"statut": statut},
                                   headers={"X-API-Key": settings.VEHICLE_SERVICE_API_KEY})
        except httpx.HTTPError as exc:
            logger.error("Statut du véhicule %s non mis à jour (%s) : %s", vehicule_id, statut, exc)
            return False
        if resp.is_error:
            logger.error("Statut du véhicule %s non mis à jour (%s) : HTTP %s %s", vehicule_id, statut,
                         resp.status_code, resp.text[:200])
            return False
        return True


# ----------------------------------------------------------------------------- clients
@dataclass(frozen=True)
class Client:
    id: int
    nom: str
    email: str | None
    telephone: str | None
    adresse: str | None = None

    def en_dict(self) -> dict[str, Any]:
        return {"id": self.id, "nom": self.nom, "nom_complet": self.nom, "email": self.email,
                "telephone": self.telephone, "adresse": self.adresse}


class FournisseurClients(ABC):
    @abstractmethod
    def lister(self, recherche: str | None = None) -> list[Client]: ...

    @abstractmethod
    def obtenir(self, client_id: int) -> Client | None: ...

    def nom_utilisateur(self, user_id: int) -> str | None:
        """Nom affiché d'un utilisateur (client ou administrateur) pour l'historique."""
        return None


class ClientsBase(FournisseurClients):
    """Lecture seule des tables `utilisateurs` + `clients` (aucune écriture)."""

    SQL = (
        "SELECT u.id, u.nom, u.email, u.telephone, c.adresse FROM clients c "
        "JOIN utilisateurs u ON u.id = c.id"
    )

    def __init__(self, db: Session):
        self.db = db

    def lister(self, recherche: str | None = None) -> list[Client]:
        sql, params = self.SQL, {}
        if recherche:
            sql += " WHERE u.nom LIKE :q OR u.email LIKE :q OR u.telephone LIKE :q"
            params["q"] = f"%{recherche.strip()}%"
        rows = self.db.execute(text(sql + " ORDER BY u.nom"), params).all()
        return [Client(*r) for r in rows]

    def obtenir(self, client_id: int) -> Client | None:
        row = self.db.execute(text(self.SQL + " WHERE c.id = :id"), {"id": client_id}).first()
        return Client(*row) if row else None

    def nom_utilisateur(self, user_id: int) -> str | None:
        return self.db.execute(text("SELECT nom FROM utilisateurs WHERE id = :id"), {"id": user_id}).scalar()


class ClientsHttp(FournisseurClients):
    """À utiliser quand service_auth exposera GET /clients et GET /clients/{id}."""

    def __init__(self, base_url: str | None = None, token: str | None = None, client: httpx.Client | None = None):
        self.base_url = (base_url or settings.AUTH_SERVICE_URL).rstrip("/")
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        self.client = client or httpx.Client(timeout=5.0, headers=headers)

    def _get(self, path: str, params: dict | None = None) -> Any:
        try:
            resp = self.client.get(f"{self.base_url}{path}", params=params)
        except httpx.HTTPError as exc:
            raise ServiceIndisponible("Le service d'authentification est indisponible.") from exc
        if resp.status_code == 404:
            return None
        if resp.is_error:
            raise ServiceIndisponible(f"Le service d'authentification a répondu {resp.status_code}.")
        return resp.json()

    @staticmethod
    def _convertir(d: dict) -> Client:
        return Client(id=int(d["id"]), nom=str(d.get("nom", "")), email=d.get("email"),
                      telephone=d.get("telephone"), adresse=d.get("adresse"))

    def lister(self, recherche: str | None = None) -> list[Client]:
        data = self._get("/clients", {"search": recherche} if recherche else None) or []
        if isinstance(data, dict):
            data = data.get("items", [])
        return [self._convertir(d) for d in data]

    def obtenir(self, client_id: int) -> Client | None:
        data = self._get(f"/clients/{client_id}")
        return self._convertir(data) if data else None


def fournisseur_clients(db: Session, token: str | None = None) -> FournisseurClients:
    return ClientsHttp(token=token) if settings.CLIENT_PROVIDER == "http" else ClientsBase(db)
