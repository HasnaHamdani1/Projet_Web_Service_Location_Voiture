"""Règles métier F001–F004, droits d'accès et conflits de réservation."""
import re
from decimal import Decimal

import pytest
from sqlalchemy import text

from service_reservation.database import engine
from service_reservation.tarification import calculer_devis

from .conftest import ADMIN, CLAIRE, H_SERVICE, THOMAS, corps, creer, jeton, jour


# ----------------------------------------------------------------- tarification
def test_exemple_maquette_153():
    q = calculer_devis(3, Decimal("45.00"), True)
    assert (q.montant_location, q.montant_assistance, q.montant_total, q.montant_tva) == (
        Decimal("135.00"), Decimal("18.00"), Decimal("153.00"), Decimal("25.50"))
    assert q.depot_garantie == Decimal("500.00")


def test_tarif_sans_assistance_et_arrondi():
    assert calculer_devis(3, Decimal("45"), False).montant_tva == Decimal("22.50")
    assert calculer_devis(1, Decimal("38"), False).montant_tva == Decimal("6.33")
    with pytest.raises(ValueError):
        calculer_devis(0, Decimal("45"), False)


# ----------------------------------------------------------------- création
def test_detail_complet_et_numerotation(client, h_admin):
    a = creer(client, h_admin, client_id=CLAIRE, debut=1, fin=2)
    b = creer(client, h_admin, client_id=THOMAS, debut=3, fin=4)
    assert re.fullmatch(r"RES-\d{4}-\d{3}", a["numero"])
    assert int(b["numero"][-3:]) == int(a["numero"][-3:]) + 1
    d = client.get(f"/reservations/{a['id']}").json()
    assert d["client"]["nom"] == "Claire Martin" and d["client"]["email"] == "claire.martin@exemple.fr"
    assert d["vehicule"]["libelle"] == "Peugeot 208" and d["vehicule"]["categorie"] == "Citadine"
    assert d["heure_debut"] == "09:00" and d["debut"].endswith("T09:00:00")
    assert [e["type"] for e in d["historique"]] == ["CREATED"]
    assert d["historique"][0]["date"].endswith("Z")
    assert d["actions"] == {"peut_payer": True, "peut_confirmer": True, "peut_annuler": True}


def test_heures_personnalisees(client, h_admin):
    r = creer(client, h_admin, client_id=CLAIRE, heure_debut="14:30", heure_fin="10:00")
    assert (r["heure_debut"], r["heure_fin"]) == ("14:30", "10:00")


@pytest.mark.parametrize("debut,fin,champ", [(-1, 2, "date_debut"), (5, 5, "date_fin"), (6, 5, "date_fin")])
def test_dates_invalides(client, h_claire, debut, fin, champ):
    r = client.post("/reservations", json=corps(debut, fin), headers=h_claire)
    assert r.status_code == 422
    assert r.json()["erreurs"][0]["champ"] == champ


def test_champs_obligatoires(client, h_claire):
    r = client.post("/reservations", json={}, headers=h_claire)
    assert r.status_code == 422
    assert {"vehicule_id", "date_debut", "date_fin"} <= {e["champ"] for e in r.json()["erreurs"]}


def test_l_administrateur_ne_cree_ni_ne_modifie(client, h_admin, h_claire):
    """Version site client : l'administrateur gère et consulte seulement."""
    r = client.post("/reservations", json=corps(client_id=CLAIRE), headers=h_admin)
    assert r.status_code == 403 and "site de réservation" in r.json()["detail"]
    rid = creer(client, h_claire)["id"]
    assert client.put(f"/reservations/{rid}", json=corps(), headers=h_admin).status_code == 405


def test_client_ou_vehicule_inconnu_et_maintenance(client, h_claire):
    r = client.post("/reservations", json=corps(), headers=jeton(999, "CLIENT"))
    assert r.status_code == 422 and r.json()["erreurs"][0]["champ"] == "client_id"
    r = client.post("/reservations", json=corps(vehicule=999), headers=h_claire)
    assert r.status_code == 422 and r.json()["erreurs"][0]["champ"] == "vehicule_id"
    r = client.post("/reservations", json=corps(vehicule=3), headers=h_claire)
    assert r.status_code == 422 and "maintenance" in r.json()["detail"]


# ----------------------------------------------------------------- droits
def test_authentification_requise_pour_ecrire(client):
    assert client.post("/reservations", json=corps()).status_code == 401
    assert client.post("/reservations", json=corps(), headers={"Authorization": "Bearer faux"}).status_code == 401
    expire = jeton(CLAIRE, "CLIENT", minutes=-1)
    r = client.post("/reservations", json=corps(), headers=expire)
    assert r.status_code == 401 and r.json()["code"] == "jeton_expire"
    assert client.post("/reservations", json=corps(), headers=H_SERVICE).status_code == 403


def test_client_cloisonne(client, h_claire, h_thomas):
    rid = creer(client, h_claire)["id"]
    assert client.post("/reservations", json=corps(client_id=CLAIRE, debut=20, fin=21),
                       headers=h_thomas).status_code == 403
    assert client.get(f"/reservations/{rid}", headers=h_thomas).status_code == 404
    assert client.get("/reservations", headers=h_thomas).json() == []
    assert client.post(f"/reservations/{rid}/paiement", json={"paiement_reussi": True},
                       headers=h_thomas).status_code == 404
    assert client.put(f"/reservations/{rid}/annulation", headers=h_thomas).status_code == 404


def test_actions_reservees_aux_administrateurs(client, h_claire, h_admin):
    rid = creer(client, h_claire)["id"]
    assert client.patch(f"/reservations/{rid}/statut", json={"statut": "CONFIRMEE"},
                        headers=h_claire).status_code == 403
    assert client.get("/reservations/export.csv", headers=h_claire).status_code == 403
    assert client.get("/clients", headers=h_claire).status_code == 403
    assert len(client.get("/clients", headers=h_admin).json()) == 2


# ----------------------------------------------------------------- conflits
def test_chevauchement_refuse_409(client, h_admin):
    a = creer(client, h_admin, client_id=CLAIRE, debut=10, fin=13)
    h_thomas = jeton(THOMAS, "CLIENT")
    r = client.post("/reservations", json=corps(12, 15), headers=h_thomas)
    assert r.status_code == 409 and r.json()["code"] == "vehicule_indisponible"
    assert a["numero"] in r.json()["detail"]
    assert client.post("/reservations", json=corps(11, 12), headers=h_thomas).status_code == 409


def test_periodes_adjacentes_et_autre_vehicule(client, h_admin):
    creer(client, h_admin, client_id=CLAIRE, debut=10, fin=13)
    creer(client, h_admin, client_id=THOMAS, debut=13, fin=15)  # fin exclue
    creer(client, h_admin, client_id=THOMAS, debut=10, fin=13, vehicule=2)


def test_annulation_libere_le_vehicule(client, h_admin):
    a = creer(client, h_admin, client_id=CLAIRE)
    client.put(f"/reservations/{a['id']}/annulation", json={"motif": "Changement de dates"}, headers=h_admin)
    creer(client, h_admin, client_id=THOMAS)
    d = client.get(f"/reservations/{a['id']}").json()
    assert d["motif_annulation"] == "Changement de dates"
    assert d["historique"][-1]["message"] == "Réservation annulée : Changement de dates"


# ----------------------------------------------------------------- modification / statuts
def test_noms_lisibles_dans_l_historique(client, h_admin):
    a = creer(client, None, client_id=CLAIRE)
    client.patch(f"/reservations/{a['id']}/statut", json={"statut": "CONFIRMEE"}, headers=h_admin)
    h = client.get(f"/reservations/{a['id']}").json()["historique"]
    assert (h[0]["message"], h[0]["auteur"]) == ("Réservation effectuée en ligne", "Claire Martin")
    assert h[1]["auteur"] == "Administrateur Agence"


def test_confirmation_admin_email_et_verrouillage(client, h_admin, expediteur_test):
    a = creer(client, h_admin, client_id=CLAIRE)
    r = client.patch(f"/reservations/{a['id']}/statut", json={"statut": "CONFIRMEE"}, headers=h_admin)
    assert r.status_code == 200
    res = r.json()["reservation"]
    assert res["statut"] == "CONFIRMEE" and res["confirmed_at"]
    assert [e["type"] for e in res["historique"]] == ["CREATED", "CONFIRMED", "EMAIL_SENT"]
    assert expediteur_test.envoyes[0]["to"] == "claire.martin@exemple.fr"
    assert "153,00 €" in expediteur_test.envoyes[0]["texte"]
    again = client.patch(f"/reservations/{a['id']}/statut", json={"statut": "CONFIRMEE"}, headers=h_admin)
    assert again.status_code == 422


def test_echec_email_ne_bloque_pas(client, h_admin, expediteur_test):
    expediteur_test.echec = True
    a = creer(client, h_admin, client_id=CLAIRE)
    r = client.patch(f"/reservations/{a['id']}/statut", json={"statut": "CONFIRMEE"}, headers=h_admin)
    assert r.json()["reservation"]["statut"] == "CONFIRMEE"
    assert r.json()["reservation"]["historique"][-1]["type"] == "EMAIL_FAILED"


# ----------------------------------------------------------------- liste & indicateurs
def test_recherche_filtres_indicateurs(client, h_admin):
    a = creer(client, h_admin, client_id=CLAIRE, debut=1, fin=2)
    creer(client, h_admin, client_id=THOMAS, debut=3, fin=4)
    c = creer(client, h_admin, client_id=THOMAS, debut=1, fin=2, vehicule=2)
    client.patch(f"/reservations/{a['id']}/statut", json={"statut": "CONFIRMEE"}, headers=h_admin)
    client.put(f"/reservations/{c['id']}/annulation", headers=h_admin)

    def q(**p):
        return client.get("/reservations", params=p, headers=h_admin).json()

    assert len(q(search="bernard")) == 2
    assert [x["id"] for x in q(search=a["numero"])] == [a["id"]]
    assert len(q(search="EF-456")) == 1
    assert len(q(statut="CONFIRMEE")) == 1
    assert q(mois="2000-01") == []
    assert q(client_id=THOMAS, page=1, size=10)["total"] == 2
    s = client.get("/reservations/stats", headers=h_admin).json()
    assert (s["total_mois"], s["en_attente"], s["confirmees"], s["annulees"]) == (3, 1, 1, 1)
    assert s["taux_confirmation"] == 33
    assert client.get("/reservations", params={"mois": "2026-13"}).status_code == 422


def test_numero_et_reservation_existante_sans_detail(client, h_admin):
    """Une réservation créée avant ce service (table reservations seule) reste lisible."""
    with engine.begin() as cx:
        cx.execute(text("INSERT INTO reservations (id, dateReservation, dateDebut, dateFin, statut, montantEstime, "
                        "client_id, vehicule_id) VALUES (500, :d, :d1, :d2, 'CONFIRMEE', 270, 2, 1)"),
                   {"d": jour(0), "d1": jour(30), "d2": jour(36)})
    d = client.get("/reservations/500").json()
    assert d["prix_total"] == 270.0 and d["duree_jours"] == 6 and d["tarif_journalier"] == 45.0
    assert d["numero"].endswith("-500")
    assert client.get(f"/reservations/numero/{d['numero']}").json()["id"] == 500
    a = creer(client, h_admin, client_id=CLAIRE)
    assert client.get(f"/reservations/numero/{a['numero'].lower()}").json()["id"] == a["id"]


# ----------------------------------------------------------------- disponibilités & devis
def test_disponibilites(client, h_admin):
    a = creer(client, h_admin, client_id=CLAIRE, debut=10, fin=13)
    ids = [v["id"] for v in client.get("/disponibilites/vehicules",
                                       params={"date_debut": jour(11), "date_fin": jour(12)}).json()]
    assert ids == [2]  # 1 réservé, 3 en maintenance
    ids = [v["id"] for v in client.get("/disponibilites/vehicules", params={
        "date_debut": jour(11), "date_fin": jour(12), "exclude_reservation_id": a["id"]}).json()]
    assert 1 in ids
    occupe = client.get("/disponibilites/vehicules/1", params={"date_debut": jour(12), "date_fin": jour(14)}).json()
    assert occupe == {"vehicule_id": 1, "disponible": False, "conflits": [a["numero"]]}


def test_devis_public(client):
    r = client.post("/reservations/devis", json={"vehicule_id": 1, "date_debut": jour(10), "date_fin": jour(13),
                                                  "assistance": True}).json()
    assert (r["montant_total"], r["montant_tva"], r["duree_jours"]) == (153.0, 25.5, 3)


def test_cycle_du_vehicule_reserve_puis_libere(client, h_claire):
    """Réservation → le service Véhicule passe le véhicule en RESERVE ; annulation → DISPONIBLE."""
    from .conftest import STATUTS_DEMANDES, STATUTS_FORCES

    r = creer(client, h_claire, debut=10, fin=13)
    assert STATUTS_DEMANDES == [(1, "RESERVE")]

    STATUTS_FORCES[1] = "RESERVE"  # état renvoyé désormais par le service Véhicule
    rep = client.put(f"/reservations/{r['id']}/annulation", headers=h_claire)
    assert rep.status_code == 200
    assert STATUTS_DEMANDES[-1] == (1, "DISPONIBLE")


def test_reservation_refusee_si_le_vehicule_n_est_pas_disponible(client, h_claire):
    from .conftest import STATUTS_FORCES

    for statut in ("RESERVE", "LOUE"):
        STATUTS_FORCES[1] = statut
        rep = client.post("/reservations", json=corps(debut=10, fin=13), headers=h_claire)
        assert rep.status_code == 409, statut
        assert rep.json()["code"] == "vehicule_indisponible"
