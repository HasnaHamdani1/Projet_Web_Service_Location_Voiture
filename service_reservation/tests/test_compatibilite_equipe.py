"""Le contrat d'équipe (TEAM_SYNC §3.2.1) est respecté : le service Contrat et le frontend commun
continuent de fonctionner sans modification."""
from .conftest import CLAIRE, H_SERVICE, corps, creer, jour

CHAMPS_HISTORIQUES = {"id", "client_id", "vehicule_id", "date_debut", "date_fin", "prix_total", "statut"}


def test_creation_par_un_client_forme_historique(client, h_claire):
    r = client.post("/reservations", json=corps(), headers=h_claire)
    assert r.status_code == 201
    body = r.json()
    assert body["message"] == "Réservation créée avec succès"
    res = body["reservation"]  # le frontend lit result.reservation.id
    assert CHAMPS_HISTORIQUES <= res.keys()
    assert res["client_id"] == CLAIRE  # pris dans le jeton
    assert res["statut"] == "EN_ATTENTE"
    assert res["date_debut"] == jour(10) and res["date_fin"] == jour(13)
    assert res["prix_total"] == 153.0


def test_lecture_canonique_sans_jeton_pour_contrat(client, h_claire):
    """service_contrat/reservation_client.py appelle GET /reservations/{id} sans authentification."""
    rid = creer(client, h_claire)["id"]
    r = client.get(f"/reservations/{rid}")
    assert r.status_code == 200
    body = r.json()
    assert CHAMPS_HISTORIQUES <= body.keys()
    assert body["prix_total"] == 153.0 and body["statut"] == "EN_ATTENTE"
    assert client.get("/reservations/99999").status_code == 404


def test_liste_est_un_tableau_par_defaut_et_paginee_sur_demande(client, h_claire):
    creer(client, h_claire, debut=1, fin=2)
    creer(client, h_claire, debut=3, fin=4)
    liste = client.get("/reservations").json()
    assert isinstance(liste, list) and len(liste) == 2  # lister_reservations() de Contrat exige une liste
    assert CHAMPS_HISTORIQUES <= liste[0].keys()
    page = client.get("/reservations", params={"page": 1, "size": 1}).json()
    assert page["total"] == 2 and page["pages"] == 2 and len(page["items"]) == 1


def test_paiement_simule(client, h_claire):
    rid = creer(client, h_claire)["id"]
    refuse = client.post(f"/reservations/{rid}/paiement", json={"paiement_reussi": False}, headers=h_claire)
    assert refuse.status_code == 200 and refuse.json()["message"] == "Paiement refusé"
    assert refuse.json()["statut"] == "EN_ATTENTE"
    ok = client.post(f"/reservations/{rid}/paiement", json={"paiement_reussi": True}, headers=h_claire)
    assert ok.status_code == 200 and ok.json()["reservation"]["statut"] == "CONFIRMEE"
    again = client.post(f"/reservations/{rid}/paiement", json={"paiement_reussi": True}, headers=h_claire)
    assert again.status_code == 422


def test_annulation_sans_corps(client, h_claire):
    rid = creer(client, h_claire)["id"]
    r = client.put(f"/reservations/{rid}/annulation", headers=h_claire)
    assert r.status_code == 200 and r.json()["reservation"]["statut"] == "ANNULEE"
    assert client.put(f"/reservations/{rid}/annulation", headers=h_claire).status_code == 422


def test_annulation_impossible_apres_le_debut(client, h_claire):
    rid = creer(client, h_claire, debut=0, fin=2)["id"]
    r = client.put(f"/reservations/{rid}/annulation", headers=h_claire)
    assert r.status_code == 422 and r.json()["code"] == "deja_commencee"


def test_format_erreur_detail_lisible_par_les_frontends(client, h_claire):
    r = client.post("/reservations", json=corps(debut=-1, fin=2), headers=h_claire)
    body = r.json()
    assert r.status_code == 422
    assert isinstance(body["detail"], str)  # le frontend affiche data.detail
    assert body["erreurs"][0]["champ"] == "date_debut"


def test_reservations_confirmees_pour_contrat(client, h_claire, h_admin):
    a = creer(client, h_claire, debut=1, fin=2)["id"]
    creer(client, h_claire, debut=3, fin=4)
    client.post(f"/reservations/{a}/paiement", json={"paiement_reussi": True}, headers=h_claire)
    r = client.get("/reservations/confirmees", headers=H_SERVICE).json()
    assert [x["id"] for x in r] == [a]


def test_lecture_publique_desactivable(client, h_claire, monkeypatch):
    from service_reservation.config import settings

    monkeypatch.setattr(settings, "LECTURE_PUBLIQUE", False)
    assert client.get("/reservations").status_code == 401
    assert client.get("/reservations", headers=H_SERVICE).status_code == 200
    assert client.get("/reservations", headers=h_claire).status_code == 200
    # Le devis et le catalogue restent publics même quand la lecture publique est coupée
    assert client.post("/reservations/devis", json={"vehicule_id": 1, "date_debut": jour(10),
                                                    "date_fin": jour(13)}).status_code == 200
    assert client.get("/catalogue/vehicules").status_code == 200
