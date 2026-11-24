"""Prolongation (contrat avec le service Contrat), concurrence et appel du service Véhicule."""
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

import httpx
import pytest

from service_reservation.database import SessionLocal
from service_reservation.erreurs import Conflit, ServiceIndisponible
from service_reservation.fournisseurs import VehiculesHttp, fournisseur_clients
from service_reservation.schemas import ReservationCreate
from service_reservation.securite import Acteur
from service_reservation.service import ServiceReservation

from .conftest import CLAIRE, EST_MYSQL, H_SERVICE, THOMAS, FauxExpediteur, FauxVehicules, corps, creer, jour


def _confirmee(client, h_admin, **kw):
    r = creer(client, h_admin, client_id=CLAIRE, **kw)
    client.patch(f"/reservations/{r['id']}/statut", json={"statut": "CONFIRMEE"}, headers=h_admin)
    return r


def _prolonger(client, rid, fin, cle=None, headers=H_SERVICE):
    h = {**headers, "Idempotency-Key": cle or str(uuid.uuid4())}
    return client.post(f"/reservations/{rid}/prolongations", json={"nouvelle_date_fin": fin}, headers=h)


# ----------------------------------------------------------------- prolongation (TEAM_SYNC §3.2.1)
def test_prolongation_par_le_service_contrat(client, h_admin):
    r = _confirmee(client, h_admin, debut=10, fin=13)  # 153,00 avec assistance
    p = _prolonger(client, r["id"], jour(15), cle="cle-prolongation-1")
    assert p.status_code == 201
    body = p.json()
    assert body["date_fin_precedente"] == jour(13) and body["date_fin"] == jour(15)
    assert body["jours_supplementaires"] == 2
    assert body["montant_supplementaire"] == 102.0  # 2 × (45 + 6)
    assert body["prix_total"] == 255.0
    d = client.get(f"/reservations/{r['id']}").json()
    assert d["date_fin"] == jour(15) and d["prix_total"] == 255.0 and d["duree_jours"] == 5
    assert d["historique"][-1]["type"] == "EXTENDED"


def test_prolongation_idempotente(client, h_admin):
    r = _confirmee(client, h_admin, debut=10, fin=13)
    a = _prolonger(client, r["id"], jour(15), cle="meme-cle-0001").json()
    b = _prolonger(client, r["id"], jour(15), cle="meme-cle-0001").json()
    assert a == b  # rejouée : même résultat, pas de double prolongation
    assert client.get(f"/reservations/{r['id']}").json()["prix_total"] == 255.0
    autre = _prolonger(client, r["id"], jour(16), cle="meme-cle-0001")
    assert autre.status_code == 409 and autre.json()["code"] == "cle_idempotence_reutilisee"


def test_prolongation_refusee(client, h_admin, h_claire):
    attente = creer(client, h_admin, client_id=CLAIRE, debut=10, fin=13)
    assert _prolonger(client, attente["id"], jour(15)).status_code == 409  # pas confirmée
    r = _confirmee(client, h_admin, debut=20, fin=23)
    creer(client, h_admin, client_id=THOMAS, debut=24, fin=26)
    conflit = _prolonger(client, r["id"], jour(25))
    assert conflit.status_code == 409 and conflit.json()["code"] == "vehicule_indisponible"
    assert _prolonger(client, r["id"], jour(23)).status_code == 422  # pas postérieure
    assert _prolonger(client, r["id"], jour(24), headers=h_claire).status_code == 403
    assert _prolonger(client, r["id"], jour(24), headers=h_admin).status_code == 201
    sans_cle = client.post(f"/reservations/{r['id']}/prolongations", json={"nouvelle_date_fin": jour(30)},
                           headers=H_SERVICE)
    assert sans_cle.status_code == 422


# ----------------------------------------------------------------- concurrence
@pytest.mark.skipif(not EST_MYSQL, reason="nécessite MySQL/MariaDB (TEST_DATABASE_URL)")
def test_dix_reservations_simultanees_une_seule_reussit():
    debut = date.today() + timedelta(days=40)
    data = ReservationCreate(client_id=CLAIRE, vehicule_id=1, date_debut=debut, date_fin=debut + timedelta(days=3))
    cliente = Acteur(id=CLAIRE, role="CLIENT", nom="Client #2")

    def tentative(_):
        db = SessionLocal()
        try:
            ServiceReservation(db, FauxVehicules(), fournisseur_clients(db), FauxExpediteur()).creer(data, cliente)
            return "ok"
        except Conflit:
            return "conflit"
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=10) as pool:
        resultats = list(pool.map(tentative, range(10)))
    assert resultats.count("ok") == 1 and resultats.count("conflit") == 9


@pytest.mark.skipif(not EST_MYSQL, reason="nécessite MySQL/MariaDB (TEST_DATABASE_URL)")
def test_numeros_uniques_en_parallele():
    clients = [Acteur(id=CLAIRE, role="CLIENT", nom="Client #2"), Acteur(id=THOMAS, role="CLIENT", nom="Client #3")]

    def tentative(i):
        debut = date.today() + timedelta(days=50 + i * 3)
        data = ReservationCreate(vehicule_id=1 + i % 2, date_debut=debut, date_fin=debut + timedelta(days=2))
        db = SessionLocal()
        try:
            r = ServiceReservation(db, FauxVehicules(), fournisseur_clients(db), FauxExpediteur()).creer(data, clients[i % 2])
            return r.details.numero
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=8) as pool:
        numeros = list(pool.map(tentative, range(8)))
    assert len(set(numeros)) == 8


# ----------------------------------------------------------------- service Véhicule (HTTP)
def _http(handler) -> VehiculesHttp:
    return VehiculesHttp(base_url="http://service_vehicule:8000", client=httpx.Client(transport=httpx.MockTransport(handler)))


def test_lecture_du_service_vehicule_actuel():
    def handler(request):
        assert request.url.path == "/vehicules"
        return httpx.Response(200, json=[{"id": 7, "immatriculation": "12345-A-6", "marque": "Dacia",
                                          "modele": "Logan", "prix_par_jour": 300.0, "statut": "DISPONIBLE",
                                          "image_url": "/uploads/7.jpg"}])

    [v] = _http(handler).lister()
    assert (v.id, v.libelle, float(v.prix_jour), v.image_url) == (7, "Dacia Logan", 300.0, "/uploads/7.jpg")


def test_service_vehicule_absent_ou_en_erreur():
    assert _http(lambda r: httpx.Response(404)).obtenir(1) is None
    with pytest.raises(ServiceIndisponible):
        _http(lambda r: httpx.Response(500)).lister()

    def coupe(request):
        raise httpx.ConnectError("refusé")

    with pytest.raises(ServiceIndisponible):
        _http(coupe).obtenir(1)


def test_service_vehicule_indisponible_renvoie_503(client, h_claire):
    from service_reservation.main import app
    from service_reservation.routes import service

    def _svc():
        db = SessionLocal()
        try:
            yield ServiceReservation(db, _http(lambda r: httpx.Response(500)), fournisseur_clients(db),
                                     FauxExpediteur())
        finally:
            db.close()

    app.dependency_overrides[service] = _svc
    r = client.post("/reservations", json=corps(), headers=h_claire)
    assert r.status_code == 503 and "Véhicule" in r.json()["detail"]
