"""Fixtures : base de test créée à partir du schéma officiel de l'équipe.

- TEST_DATABASE_URL=mysql+pymysql://…/db_reservation_test → schéma chargé depuis
  Base_de_données/db_location_voitures.sql (tests au plus près de la production, concurrence incluse).
- Sans variable : SQLite en mémoire-fichier (rapide, aucun serveur requis ; test de concurrence ignoré).
"""
import os
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
URL = os.environ.get("TEST_DATABASE_URL", f"sqlite:///{Path(__file__).parent / 'test.db'}")
os.environ["DATABASE_URL"] = URL
os.environ["JWT_SECRET"] = "secret-de-test-0123456789abcdef0123456789"
os.environ["SERVICE_API_KEYS"] = "contrats:cle-contrats-test"
os.environ["LECTURE_PUBLIQUE"] = "true"
os.environ["EMAIL_BACKEND"] = "console"
os.environ["CLIENT_PROVIDER"] = "db"
os.environ["EVENT_WEBHOOK_URLS"] = ""

import jwt  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

EST_MYSQL = URL.startswith("mysql")


def _preparer_mysql() -> None:
    nom_base = URL.rsplit("/", 1)[-1].split("?")[0]
    serveur = create_engine(URL.rsplit("/", 1)[0] + "/")
    with serveur.begin() as c:
        c.execute(text(f"DROP DATABASE IF EXISTS `{nom_base}`"))
        c.execute(text(f"CREATE DATABASE `{nom_base}` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci"))
    sql = (RACINE / "Base_de_données" / "db_location_voitures.sql").read_text(encoding="utf-8")
    sql = "\n".join(l for l in sql.splitlines() if not l.startswith("--"))
    # le fichier crée/choisit db_location_voitures : on retire ces deux instructions
    sql = re.sub(r"CREATE DATABASE[^;]*;", "", sql, flags=re.I)
    sql = re.sub(r"^\s*USE [^;]*;", "", sql, flags=re.I | re.M)
    eng = create_engine(URL)
    with eng.begin() as c:
        for instruction in (s.strip() for s in sql.split(";\n")):
            if instruction and instruction != "COMMIT":
                c.exec_driver_sql(instruction)
    eng.dispose()


if EST_MYSQL:
    _preparer_mysql()
else:
    Path(URL.replace("sqlite:///", "")).unlink(missing_ok=True)

from service_reservation.database import SessionLocal, engine  # noqa: E402
from service_reservation.fournisseurs import FournisseurVehicules, Vehicule, convertir_vehicule  # noqa: E402
from service_reservation.main import app  # noqa: E402
from service_reservation.notifications import Expediteur  # noqa: E402
from service_reservation.routes import fournisseur_vehicules, service  # noqa: E402
from service_reservation.service import ServiceReservation  # noqa: E402
from service_reservation.fournisseurs import fournisseur_clients  # noqa: E402

if not EST_MYSQL:
    # tables des autres services nécessaires aux tests (schéma minimal équivalent)
    with engine.begin() as c:
        c.exec_driver_sql("CREATE TABLE IF NOT EXISTS utilisateurs (id INTEGER PRIMARY KEY, nom TEXT, email TEXT, "
                          "motDePasse TEXT, telephone TEXT, role TEXT)")
        c.exec_driver_sql("CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY, adresse TEXT)")
        c.exec_driver_sql("CREATE TABLE IF NOT EXISTS administrateurs (id INTEGER PRIMARY KEY)")
        c.exec_driver_sql("CREATE TABLE IF NOT EXISTS vehicules (id INTEGER PRIMARY KEY, immatriculation TEXT, "
                          "marque TEXT, modele TEXT, annee INT, prixParJour NUMERIC, statut TEXT, "
                          "administrateur_id INT)")
        c.exec_driver_sql("CREATE TABLE IF NOT EXISTS contrats (id INTEGER PRIMARY KEY, reservation_id INT)")

VEHICULES = [
    {"id": 1, "immatriculation": "AB-123-CD", "marque": "Peugeot", "modele": "208", "annee": 2023,
     "prix_par_jour": 45.0, "statut": "DISPONIBLE", "categorie": "Citadine", "boite": "Manuelle",
     "carburant": "Essence"},
    {"id": 2, "immatriculation": "EF-456-GH", "marque": "Renault", "modele": "Clio", "annee": 2022,
     "prix_par_jour": 45.0, "statut": "DISPONIBLE"},
    {"id": 3, "immatriculation": "GH-567-IJ", "marque": "Renault", "modele": "Mégane", "annee": 2022,
     "prix_par_jour": 52.0, "statut": "MAINTENANCE"},
]
ADMIN, CLAIRE, THOMAS = 1, 2, 3


class FauxVehicules(FournisseurVehicules):
    """Remplace l'appel HTTP au service Véhicule (mêmes données que la table vehicules).

    Les changements de statut demandés sont enregistrés dans STATUTS_DEMANDES ; le statut lu reste
    celui de VEHICULES, sauf s'il est forcé dans STATUTS_FORCES (tests du cycle du véhicule)."""

    def lister(self) -> list[Vehicule]:
        return [self._avec_statut(v) for v in VEHICULES]

    def obtenir(self, vehicule_id: int):
        return next((self._avec_statut(v) for v in VEHICULES if v["id"] == vehicule_id), None)

    @staticmethod
    def _avec_statut(v):
        return convertir_vehicule({**v, "statut": STATUTS_FORCES.get(v["id"], v["statut"])})

    def changer_statut(self, vehicule_id, statut):
        STATUTS_DEMANDES.append((vehicule_id, statut))
        return True


STATUTS_DEMANDES: list = []
STATUTS_FORCES: dict = {}


class FauxExpediteur(Expediteur):
    def __init__(self):
        self.envoyes, self.echec = [], False

    def envoyer(self, destinataire, sujet, texte):
        if self.echec:
            raise ConnectionError("SMTP indisponible")
        self.envoyes.append({"to": destinataire, "sujet": sujet, "texte": texte})


def _vider():
    tables = ["reservation_emails", "reservation_prolongations", "reservation_evenements", "reservation_details",
              "reservation_compteurs", "reservation_verrous", "contrats", "reservations", "vehicules", "clients",
              "administrateurs", "utilisateurs"]
    with engine.begin() as c:
        if EST_MYSQL:
            c.exec_driver_sql("SET FOREIGN_KEY_CHECKS=0")
        for t in tables:
            c.exec_driver_sql(f"DELETE FROM {t}")
        if EST_MYSQL:
            c.exec_driver_sql("SET FOREIGN_KEY_CHECKS=1")


def _peupler():
    with engine.begin() as c:
        for uid, nom, email, tel, role in [
            (ADMIN, "Administrateur Agence", "admin@parcauto.ma", "0600000000", "ADMINISTRATEUR"),
            (CLAIRE, "Claire Martin", "claire.martin@exemple.fr", "0612345678", "CLIENT"),
            (THOMAS, "Thomas Bernard", "thomas.bernard@exemple.fr", "0623456789", "CLIENT"),
        ]:
            c.execute(text("INSERT INTO utilisateurs (id, nom, email, motDePasse, telephone, role) "
                           "VALUES (:i, :n, :e, 'x', :t, :r)"), {"i": uid, "n": nom, "e": email, "t": tel, "r": role})
        c.execute(text("INSERT INTO administrateurs (id) VALUES (1)"))
        c.execute(text("INSERT INTO clients (id, adresse) VALUES (2, 'Agadir'), (3, 'Paris')"))
        for v in VEHICULES:
            c.execute(text("INSERT INTO vehicules (id, immatriculation, marque, modele, annee, prixParJour, statut, "
                           "administrateur_id) VALUES (:id, :im, :ma, :mo, :an, :px, :st, 1)"),
                      {"id": v["id"], "im": v["immatriculation"], "ma": v["marque"], "mo": v["modele"],
                       "an": v["annee"], "px": v["prix_par_jour"], "st": v["statut"]})


@pytest.fixture(autouse=True)
def donnees():
    _vider()
    _peupler()
    yield


@pytest.fixture
def expediteur_test():
    return FauxExpediteur()


@pytest.fixture
def client(expediteur_test):
    STATUTS_DEMANDES.clear()
    STATUTS_FORCES.clear()
    def _svc():
        db = SessionLocal()
        try:
            yield ServiceReservation(db, FauxVehicules(), fournisseur_clients(db), expediteur_test)
        finally:
            db.close()

    app.dependency_overrides[service] = _svc
    app.dependency_overrides[fournisseur_vehicules] = FauxVehicules
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def jeton(user_id: int, role: str, minutes: int = 30, service: str | None = None) -> dict:
    claims = {"sub": str(user_id), "role": role, "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes)}
    if service:
        claims["service"] = service  # administrateur : service qu'il gère (service_auth)
    tok = jwt.encode(claims, os.environ["JWT_SECRET"], algorithm="HS256")
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture
def h_admin():
    """Administrateur du service Réservation (Maryam)."""
    return jeton(ADMIN, "ADMINISTRATEUR", service="RESERVATION")


@pytest.fixture
def h_admin_vehicules():
    """Administrateur d'un autre service (Véhicule) : consulte mais n'agit pas sur les réservations."""
    return jeton(ADMIN, "ADMINISTRATEUR", service="VEHICULE")


@pytest.fixture
def h_claire():
    return jeton(CLAIRE, "CLIENT")


@pytest.fixture
def h_thomas():
    return jeton(THOMAS, "CLIENT")


H_SERVICE = {"X-API-Key": "cle-contrats-test"}


def jour(n: int) -> str:
    return (date.today() + timedelta(days=n)).isoformat()


def corps(debut=10, fin=13, vehicule=1, client_id=None, assistance=True, **extra):
    d = {"vehicule_id": vehicule, "date_debut": jour(debut), "date_fin": jour(fin), "assistance": assistance, **extra}
    if client_id:
        d["client_id"] = client_id
    return d


def creer(client, headers, client_id=None, **kw):
    """Réservation en ligne : toujours faite avec un jeton CLIENT (celui de client_id s'il est donné)."""
    if client_id:
        headers = jeton(client_id, "CLIENT")
    r = client.post("/reservations", json=corps(client_id=client_id, **kw), headers=headers)
    assert r.status_code == 201, r.text
    return r.json()["reservation"]
