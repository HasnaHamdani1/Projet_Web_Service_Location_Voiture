"""Site client : catalogue public alimenté par le service Véhicule, fiche véhicule, export admin."""
import csv
import io

from .conftest import CLAIRE, THOMAS, creer, jour


def test_catalogue_sans_periode(client):
    r = client.get("/catalogue/vehicules")  # aucun jeton : site public
    assert r.status_code == 200
    offres = r.json()
    assert [o["id"] for o in offres] == [1, 2]  # Mégane en maintenance exclue, tri prix croissant
    assert offres[0]["disponible"] is None and offres[0]["prix_estime"] is None
    assert offres[0]["libelle"] == "Peugeot 208" and offres[0]["prix_par_jour"] == 45.0


def test_catalogue_avec_periode(client, h_claire):
    creer(client, h_claire, debut=10, fin=13, vehicule=1)
    offres = client.get("/catalogue/vehicules", params={"date_debut": jour(11), "date_fin": jour(14)}).json()
    par_id = {o["id"]: o for o in offres}
    assert par_id[1]["disponible"] is False and par_id[2]["disponible"] is True
    assert par_id[2]["duree_jours"] == 3 and par_id[2]["prix_estime"] == 135.0
    assert offres[0]["id"] == 2  # véhicules libres en premier
    libres = client.get("/catalogue/vehicules", params={"date_debut": jour(11), "date_fin": jour(14),
                                                        "disponibles": True}).json()
    assert [o["id"] for o in libres] == [2]


def test_catalogue_filtres_et_erreurs(client):
    assert [o["id"] for o in client.get("/catalogue/vehicules", params={"recherche": "clio"}).json()] == [2]
    assert [o["id"] for o in client.get("/catalogue/vehicules", params={"marque": "peugeot"}).json()] == [1]
    assert client.get("/catalogue/vehicules", params={"prix_max": 40}).json() == []
    assert client.get("/catalogue/vehicules", params={"date_debut": jour(3)}).status_code == 422
    assert client.get("/catalogue/vehicules", params={"date_debut": jour(3), "date_fin": jour(3)}).status_code == 422
    assert client.get("/catalogue/vehicules", params={"tri": "hasard"}).status_code == 422


def test_fiche_vehicule_et_periodes_reservees(client, h_claire):
    creer(client, h_claire, debut=10, fin=13, vehicule=1)
    f = client.get("/catalogue/vehicules/1", params={"date_debut": jour(12), "date_fin": jour(15)}).json()
    assert f["disponible"] is False and f["reservable"] is True
    assert f["periodes_reservees"] == [{"date_debut": jour(10), "date_fin": jour(13)}]
    assert "client" not in str(f)  # aucune donnée personnelle sur le site public
    assert client.get("/catalogue/vehicules/1", params={"date_debut": jour(13), "date_fin": jour(15)}
                      ).json()["disponible"] is True
    assert client.get("/catalogue/vehicules/3").json()["reservable"] is False  # maintenance
    assert client.get("/catalogue/vehicules/999").status_code == 404


def test_parcours_client_complet(client, h_claire):
    """Réserver → payer → retrouver dans « Mes réservations » → annuler une autre réservation."""
    r = creer(client, h_claire, debut=10, fin=13)
    assert r["statut"] == "EN_ATTENTE" and r["client"]["nom"] == "Claire Martin"
    ok = client.post(f"/reservations/{r['id']}/paiement", json={"paiement_reussi": True}, headers=h_claire)
    assert ok.json()["reservation"]["statut"] == "CONFIRMEE"
    autre = creer(client, h_claire, debut=20, fin=22, vehicule=2)
    client.put(f"/reservations/{autre['id']}/annulation", headers=h_claire)
    mes = client.get("/reservations", params={"page": 1, "size": 10}, headers=h_claire).json()
    assert {(x["numero"], x["statut"]) for x in mes["items"]} == {(r["numero"], "CONFIRMEE"),
                                                                    (autre["numero"], "ANNULEE")}


def test_export_csv_admin(client, h_admin):
    creer(client, None, client_id=CLAIRE, debut=1, fin=2)
    creer(client, None, client_id=THOMAS, debut=3, fin=5, vehicule=2)
    r = client.get("/reservations/export.csv", headers=h_admin)
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    texte = r.content.decode("utf-8")
    assert texte.startswith("﻿")
    lignes = list(csv.reader(io.StringIO(texte.lstrip("﻿")), delimiter=";"))
    assert lignes[0][:3] == ["Numéro", "Date de réservation", "Statut"]
    assert len(lignes) == 3 and {lignes[1][3], lignes[2][3]} == {"Claire Martin", "Thomas Bernard"}
    filtre = client.get("/reservations/export.csv", params={"search": "Thomas"}, headers=h_admin)
    assert len(filtre.content.decode("utf-8").strip().splitlines()) == 2
