"""Règles métier du service Réservation (F001–F004 + prolongation pour le service Contrat)."""
from __future__ import annotations

import logging
from datetime import date, datetime, time
from decimal import Decimal
from math import ceil

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from . import horloge
from .config import settings
from .erreurs import Conflit, Interdit, Introuvable, RegleMetier
from .fournisseurs import Client, FournisseurClients, FournisseurVehicules, Vehicule
from .models import (
    LIBELLES_STATUT,
    STATUTS_ACTIFS,
    Reservation,
    ReservationCompteur,
    ReservationDetails,
    ReservationEmail,
    ReservationEvenement,
    ReservationProlongation,
    ReservationVerrou,
    utcnow,
)
from .notifications import Expediteur, email_confirmation
from .securite import Acteur
from .tarification import Devis, arrondi, calculer_devis, nombre_jours, tva_incluse

logger = logging.getLogger("service_reservation.service")

STATUTS_INDISPONIBLES = {"MAINTENANCE"}


def _heure(h: time | None) -> time:
    if h:
        return h.replace(second=0, microsecond=0)
    hh, mm = settings.HEURE_PAR_DEFAUT.split(":")
    return time(int(hh), int(mm))


class ServiceReservation:
    def __init__(self, db: Session, vehicules: FournisseurVehicules, clients: FournisseurClients,
                 expediteur: Expediteur):
        self.db = db
        self.vehicules = vehicules
        self.clients = clients
        self.expediteur = expediteur

    # ======================================================================= lectures
    def _charger(self, reservation_id: int, verrou: bool = False) -> Reservation:
        stmt = select(Reservation).options(selectinload(Reservation.evenements)).where(Reservation.id == reservation_id)
        if verrou:
            stmt = stmt.with_for_update(of=Reservation)
        r = self.db.scalars(stmt).unique().first()
        if not r:
            raise Introuvable("Réservation introuvable")
        return r

    def _controler_acces(self, r: Reservation, acteur: Acteur | None) -> None:
        """Un client ne voit et n'agit que sur ses propres réservations."""
        if acteur and acteur.est_client and r.client_id != acteur.id:
            raise Introuvable("Réservation introuvable")

    def obtenir(self, reservation_id: int, acteur: Acteur | None) -> Reservation:
        r = self._charger(reservation_id)
        self._controler_acces(r, acteur)
        return r

    def obtenir_par_numero(self, numero: str, acteur: Acteur | None) -> Reservation:
        rid = self.db.scalar(select(ReservationDetails.reservation_id)
                             .where(ReservationDetails.numero == numero.upper()))
        if rid is None:
            # Réservations antérieures sans détail : numéro déduit RES-AAAA-<id>
            try:
                rid = int(numero.rsplit("-", 1)[-1])
            except ValueError as exc:
                raise Introuvable("Réservation introuvable") from exc
        r = self.obtenir(rid, acteur)
        if self.numero(r) != numero.upper():
            raise Introuvable("Réservation introuvable")
        return r

    def _filtrer(self, *, recherche, statut, mois, client_id, vehicule_id, acteur):
        stmt = select(Reservation).outerjoin(ReservationDetails)
        if acteur and acteur.est_client:
            stmt = stmt.where(Reservation.client_id == acteur.id)
        if recherche:
            terme = f"%{recherche.strip()}%"
            conditions = [
                ReservationDetails.numero.ilike(terme),
                ReservationDetails.client_nom.ilike(terme),
                ReservationDetails.client_email.ilike(terme),
                ReservationDetails.vehicule_immatriculation.ilike(terme),
                ReservationDetails.vehicule_marque.ilike(terme),
                ReservationDetails.vehicule_modele.ilike(terme),
            ]
            if recherche.strip().isdigit():
                conditions.append(Reservation.id == int(recherche.strip()))
            stmt = stmt.where(or_(*conditions))
        if statut:
            stmt = stmt.where(Reservation.statut == statut)
        if mois:
            try:
                debut, fin = horloge.bornes_mois(*horloge.lire_mois(mois))
            except ValueError as exc:
                raise RegleMetier(str(exc), champ="mois") from exc
            stmt = stmt.where(Reservation.date_reservation >= debut, Reservation.date_reservation < fin)
        if client_id:
            stmt = stmt.where(Reservation.client_id == client_id)
        if vehicule_id:
            stmt = stmt.where(Reservation.vehicule_id == vehicule_id)
        return stmt.order_by(Reservation.id.desc())

    def lister(self, *, page: int | None, size: int, acteur: Acteur | None, **filtres):
        stmt = self._filtrer(acteur=acteur, **filtres)
        if page is None:  # forme historique : liste complète
            return list(self.db.scalars(stmt).unique()), None
        total = self.db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
        items = list(self.db.scalars(stmt.offset((page - 1) * size).limit(size)).unique())
        return items, {"total": total, "page": page, "size": size, "pages": max(1, ceil(total / size))}

    def stats(self, mois: str | None, acteur: Acteur | None) -> dict:
        try:
            a, m = horloge.lire_mois(mois)
        except ValueError as exc:
            raise RegleMetier(str(exc), champ="mois") from exc
        pa, pm = (a - 1, 12) if m == 1 else (a, m - 1)

        def compter(annee, mois_):
            debut, fin = horloge.bornes_mois(annee, mois_)
            stmt = (select(Reservation.statut, func.count()).where(
                Reservation.date_reservation >= debut, Reservation.date_reservation < fin)
                .group_by(Reservation.statut))
            if acteur and acteur.est_client:
                stmt = stmt.where(Reservation.client_id == acteur.id)
            return {s: n for s, n in self.db.execute(stmt)}

        cur, prev = compter(a, m), compter(pa, pm)
        total, total_prev = sum(cur.values()), sum(prev.values())
        conf = cur.get("CONFIRMEE", 0)
        return {
            "mois": f"{a:04d}-{m:02d}", "total_mois": total, "total_mois_precedent": total_prev,
            "variation": total - total_prev, "en_attente": cur.get("EN_ATTENTE", 0), "confirmees": conf,
            "annulees": cur.get("ANNULEE", 0), "taux_confirmation": round(conf * 100 / total) if total else 0,
        }

    # ======================================================================= disponibilité
    def conflits(self, vehicule_id: int, debut: date, fin: date, exclure: int | None = None) -> list[Reservation]:
        """Réservations actives qui chevauchent [debut, fin) — début inclus, fin exclue (TEAM_SYNC §3.3)."""
        stmt = select(Reservation).where(
            Reservation.vehicule_id == vehicule_id,
            Reservation.statut.in_(STATUTS_ACTIFS),
            Reservation.date_debut < fin,
            Reservation.date_fin > debut,
        )
        if exclure:
            stmt = stmt.where(Reservation.id != exclure)
        return list(self.db.scalars(stmt).unique())

    def _vehicules_occupes(self, debut: date, fin: date, exclure: int | None = None) -> set[int]:
        stmt = select(Reservation.vehicule_id).where(
            Reservation.statut.in_(STATUTS_ACTIFS), Reservation.date_debut < fin, Reservation.date_fin > debut)
        if exclure:
            stmt = stmt.where(Reservation.id != exclure)
        return {vid for (vid,) in self.db.execute(stmt)}

    def vehicules_disponibles(self, debut: date, fin: date, exclure: int | None = None) -> list[Vehicule]:
        occupes = self._vehicules_occupes(debut, fin, exclure)
        return [v for v in self.vehicules.lister() if v.statut not in STATUTS_INDISPONIBLES and v.id not in occupes]

    # ======================================================================= catalogue public (site client)
    @staticmethod
    def _offre(v: Vehicule, jours: int | None, disponible: bool | None) -> dict:
        return {**v.en_dict(), "reservable": v.statut not in STATUTS_INDISPONIBLES, "disponible": disponible,
                "duree_jours": jours, "prix_estime": float(arrondi(v.prix_jour * jours)) if jours else None}

    def catalogue(self, *, debut: date | None, fin: date | None, recherche: str | None = None,
                  marque: str | None = None, prix_max: Decimal | None = None, tri: str = "prix_asc",
                  disponibles_seulement: bool = False) -> list[dict]:
        """Véhicules du service Véhicule proposés à la location (hors maintenance), avec la disponibilité
        et le prix estimé sur la période demandée."""
        jours = nombre_jours(debut, fin) if debut and fin else None
        occupes = self._vehicules_occupes(debut, fin) if jours else set()
        terme = (recherche or "").strip().lower()
        offres = []
        for v in self.vehicules.lister():
            if v.statut in STATUTS_INDISPONIBLES:
                continue
            if terme and terme not in f"{v.marque} {v.modele} {v.categorie or ''}".lower():
                continue
            if marque and v.marque.lower() != marque.strip().lower():
                continue
            if prix_max is not None and v.prix_jour > prix_max:
                continue
            disponible = (v.id not in occupes) if jours else None
            if disponibles_seulement and disponible is False:
                continue
            offres.append(self._offre(v, jours, disponible))
        cles = {
            "prix_asc": lambda o: (o["prix_par_jour"], o["libelle"]),
            "prix_desc": lambda o: (-o["prix_par_jour"], o["libelle"]),
            "nom": lambda o: o["libelle"].lower(),
        }
        offres.sort(key=cles.get(tri, cles["prix_asc"]))
        # les véhicules libres d'abord quand une période est choisie
        if jours:
            offres.sort(key=lambda o: not o["disponible"])
        return offres

    def vehicule_public(self, vehicule_id: int, debut: date | None, fin: date | None) -> dict:
        v = self.vehicules.obtenir(vehicule_id)
        if not v:
            raise Introuvable("Véhicule introuvable")
        jours = nombre_jours(debut, fin) if debut and fin else None
        disponible = (not self.conflits(v.id, debut, fin)) if jours else None
        # Périodes déjà prises (aucune donnée client) pour griser le calendrier
        periodes = self.db.execute(
            select(Reservation.date_debut, Reservation.date_fin).where(
                Reservation.vehicule_id == v.id, Reservation.statut.in_(STATUTS_ACTIFS),
                Reservation.date_fin > horloge.aujourdhui()).order_by(Reservation.date_debut)).all()
        return {**self._offre(v, jours, disponible),
                "periodes_reservees": [{"date_debut": d1, "date_fin": d2} for d1, d2 in periodes]}

    def disponibilite(self, vehicule_id: int, debut: date, fin: date, exclure: int | None = None) -> dict:
        c = self.conflits(vehicule_id, debut, fin, exclure)
        return {"vehicule_id": vehicule_id, "disponible": not c, "conflits": [self.numero(r) for r in c]}

    def _assurer_ligne(self, modele, pk, **valeurs) -> None:
        """Crée la ligne si besoin dans une transaction séparée, validée tout de suite.
        Ainsi le SELECT … FOR UPDATE de la transaction principale porte toujours sur une ligne
        existante (pas de verrou d'insertion concurrent, donc pas d'interblocage MySQL)."""
        if self.db.get(modele, pk):
            return
        try:
            with self.db.get_bind().connect() as conn:
                colonnes = {modele.__mapper__.attrs[k].columns[0].name: v for k, v in valeurs.items()}
                conn.execute(modele.__table__.insert().values(colonnes))
                conn.commit()
        except IntegrityError:
            pass  # créée entre-temps par une autre requête

    def _verrouiller_vehicule(self, vehicule_id: int) -> None:
        """Sérialise les réservations d'un même véhicule jusqu'à la fin de la transaction.
        (MySQL n'a pas de contrainte d'exclusion : sans ce verrou, deux requêtes simultanées
        pourraient toutes deux constater l'absence de conflit puis réserver.)"""
        self._assurer_ligne(ReservationVerrou, vehicule_id, vehicule_id=vehicule_id)
        self.db.execute(select(ReservationVerrou.vehicule_id)
                        .where(ReservationVerrou.vehicule_id == vehicule_id).with_for_update())

    def _numero_suivant(self, annee: int) -> str:
        self._assurer_ligne(ReservationCompteur, annee, annee=annee, dernier_numero=0)
        compteur = self.db.scalars(select(ReservationCompteur).where(ReservationCompteur.annee == annee)
                                   .with_for_update().execution_options(populate_existing=True)).one()
        compteur.dernier_numero += 1
        return f"RES-{annee}-{compteur.dernier_numero:03d}"

    @staticmethod
    def numero(r: Reservation) -> str:
        return r.details.numero if r.details else f"RES-{r.date_reservation.year}-{r.id:03d}"

    # ======================================================================= devis
    def _vehicule_reservable(self, vehicule_id: int) -> Vehicule:
        v = self.vehicules.obtenir(vehicule_id)
        if not v:
            raise RegleMetier("Véhicule introuvable", champ="vehicule_id")
        if v.statut in STATUTS_INDISPONIBLES:
            raise RegleMetier("Ce véhicule est en maintenance et ne peut pas être réservé.", champ="vehicule_id")
        if v.prix_jour <= 0:
            raise RegleMetier("Le tarif journalier de ce véhicule n'est pas défini.", champ="vehicule_id")
        return v

    def devis(self, vehicule_id: int, debut: date, fin: date, assistance: bool) -> Devis:
        v = self._vehicule_reservable(vehicule_id)
        return calculer_devis(nombre_jours(debut, fin), v.prix_jour, assistance)

    # ======================================================================= création / modification
    def _client(self, client_id: int) -> Client:
        c = self.clients.obtenir(client_id)
        if not c:
            raise RegleMetier("Client introuvable", champ="client_id")
        return c

    def _valider_periode(self, debut: date) -> None:
        if debut < horloge.aujourdhui():
            raise RegleMetier("La date de début ne peut pas être dans le passé", champ="date_debut")

    def _assurer_disponible(self, vehicule_id: int, debut: date, fin: date, exclure: int | None) -> None:
        c = self.conflits(vehicule_id, debut, fin, exclure)
        if c:
            raise Conflit(
                f"Ce véhicule est déjà réservé pour cette période ({', '.join(self.numero(r) for r in c)}).",
                champ="vehicule_id", code="vehicule_indisponible",
            )

    @staticmethod
    def _appliquer(r: Reservation, d: ReservationDetails, data, v: Vehicule, c: Client, q: Devis) -> None:
        r.client_id, r.vehicule_id = c.id, v.id
        r.date_debut, r.date_fin = data.date_debut, data.date_fin
        r.prix_total = q.montant_total
        d.heure_debut, d.heure_fin = _heure(data.heure_debut), _heure(data.heure_fin)
        d.duree_jours, d.assistance = q.duree_jours, data.assistance
        d.tarif_journalier, d.tarif_assistance = q.tarif_journalier, q.tarif_assistance
        d.montant_location, d.montant_assistance = q.montant_location, q.montant_assistance
        d.montant_prolongations = Decimal("0.00")
        d.montant_tva, d.depot_garantie, d.devise = q.montant_tva, q.depot_garantie, q.devise
        d.vehicule_marque, d.vehicule_modele = v.marque, v.modele
        d.vehicule_immatriculation = v.immatriculation
        d.vehicule_categorie, d.vehicule_boite, d.vehicule_carburant = v.categorie, v.boite, v.carburant
        d.client_nom, d.client_email, d.client_telephone = c.nom, c.email, c.telephone

    def _evenement(self, r: Reservation, type_: str, message: str, auteur: str | None) -> None:
        r.evenements.append(ReservationEvenement(type=type_, message=message[:255], auteur=auteur))

    def _valider_ecriture(self) -> None:
        try:
            self.db.flush()
            self.db.commit()
        except IntegrityError as exc:
            self.db.rollback()
            msg = str(exc.orig).lower()
            if "fk_reservation_client" in msg:
                raise RegleMetier("Client inconnu dans la base partagée.", champ="client_id") from exc
            if "fk_reservation_vehicule" in msg:
                raise RegleMetier("Véhicule inconnu dans la table vehicules de la base partagée.",
                                  champ="vehicule_id") from exc
            raise

    def creer(self, data, acteur: Acteur) -> Reservation:
        """Réservation en ligne par un client connecté, pour son propre compte (client_id = jeton)."""
        if not acteur.est_client:
            raise Interdit("Les réservations sont effectuées par les clients depuis le site de réservation.")
        if data.client_id and data.client_id != acteur.id:
            raise Interdit("Un client ne peut réserver que pour son propre compte.")
        self._valider_periode(data.date_debut)
        c = self._client(acteur.id)
        v = self._vehicule_reservable(data.vehicule_id)
        q = calculer_devis(nombre_jours(data.date_debut, data.date_fin), v.prix_jour, data.assistance)

        self._verrouiller_vehicule(v.id)
        self._assurer_disponible(v.id, data.date_debut, data.date_fin, None)
        aujourd = horloge.aujourdhui()
        r = Reservation(date_reservation=aujourd, statut="EN_ATTENTE")
        d = ReservationDetails(numero=self._numero_suivant(aujourd.year), cree_par=c.nom)
        r.details = d
        self._appliquer(r, d, data, v, c, q)
        self._evenement(r, "CREATED", "Réservation effectuée en ligne", c.nom)
        self.db.add(r)
        self._valider_ecriture()
        logger.info("Réservation %s créée", d.numero)
        return self._charger(r.id)

    def _auteur(self, r: Reservation, acteur: Acteur) -> str:
        """Nom lisible pour l'historique (le jeton ne contient que l'identifiant)."""
        if acteur.est_client and r.details and r.details.client_nom:
            return r.details.client_nom
        if acteur.id is not None:
            nom = self.clients.nom_utilisateur(acteur.id)
            if nom:
                return nom
        return acteur.nom

    # ======================================================================= statuts
    def confirmer(self, reservation_id: int, acteur: Acteur, motif_evenement: str = "Réservation confirmée") -> Reservation:
        r = self._charger(reservation_id, verrou=True)
        self._controler_acces(r, acteur)
        if r.statut != "EN_ATTENTE":
            raise RegleMetier("Seules les réservations en attente peuvent être confirmées.", code="statut_invalide")
        r.statut = "CONFIRMEE"
        if r.details:
            r.details.date_confirmation = utcnow()
        self._evenement(r, "CONFIRMED", motif_evenement, self._auteur(r, acteur))
        self._valider_ecriture()
        self._envoyer_confirmation(r)
        return self._charger(r.id)

    def payer(self, reservation_id: int, reussi: bool, acteur: Acteur) -> tuple[Reservation, bool]:
        r = self._charger(reservation_id)
        self._controler_acces(r, acteur)
        if r.statut != "EN_ATTENTE":
            raise RegleMetier("Seules les réservations en attente peuvent être payées.", code="statut_invalide")
        if not reussi:
            self._evenement(r, "PAYMENT_REFUSED", "Paiement refusé", self._auteur(r, acteur))
            self._valider_ecriture()
            return self._charger(r.id), False
        return self.confirmer(reservation_id, acteur, "Paiement accepté – réservation confirmée"), True

    def annuler(self, reservation_id: int, motif: str | None, acteur: Acteur) -> Reservation:
        r = self._charger(reservation_id, verrou=True)
        self._controler_acces(r, acteur)
        if r.statut == "ANNULEE":
            raise RegleMetier("Cette réservation est déjà annulée.", code="statut_invalide")
        if horloge.aujourdhui() >= r.date_debut:
            raise RegleMetier("Impossible d'annuler une réservation ayant commencé.", code="deja_commencee")
        r.statut = "ANNULEE"
        motif = (motif or "").strip() or None
        if r.details:
            r.details.date_annulation = utcnow()
            r.details.motif_annulation = motif
        self._evenement(r, "CANCELLED", "Réservation annulée" + (f" : {motif}" if motif else ""),
                        self._auteur(r, acteur))
        self._valider_ecriture()
        return self._charger(r.id)

    def _envoyer_confirmation(self, r: Reservation) -> None:
        donnees = self.serialiser(r)
        email = donnees["client"]["email"]
        if not email:
            return
        sujet, texte = email_confirmation({**donnees, "date_debut_obj": r.date_debut, "date_fin_obj": r.date_fin})
        try:
            self.expediteur.envoyer(email, sujet, texte)
            self.db.add(ReservationEmail(reservation_id=r.id, destinataire=email, sujet=sujet, statut="ENVOYE"))
            self._evenement(r, "EMAIL_SENT", f"E-mail de confirmation envoyé à {email}", "Système")
        except Exception as exc:  # noqa: BLE001 — l'échec d'e-mail n'annule pas la confirmation
            logger.exception("Échec d'envoi de l'e-mail pour %s", self.numero(r))
            self.db.add(ReservationEmail(reservation_id=r.id, destinataire=email, sujet=sujet, statut="ECHEC",
                                         erreur=str(exc)[:2000]))
            self._evenement(r, "EMAIL_FAILED", f"Échec de l'envoi de l'e-mail à {email}", "Système")
        self.db.commit()

    # ======================================================================= prolongation (Contrat)
    def prolonger(self, reservation_id: int, nouvelle_fin: date, cle: str, acteur: Acteur) -> ReservationProlongation:
        """TEAM_SYNC §3.2.1 : vérification atomique + idempotence par clé."""
        deja = self.db.scalar(select(ReservationProlongation).where(ReservationProlongation.cle_idempotence == cle))
        if deja:
            if deja.reservation_id != reservation_id or deja.date_fin != nouvelle_fin:
                raise Conflit("Cette clé d'idempotence a déjà servi pour une autre demande.",
                              code="cle_idempotence_reutilisee")
            return deja

        r = self._charger(reservation_id, verrou=True)
        if r.statut != "CONFIRMEE":
            raise Conflit("Seule une réservation confirmée peut être prolongée.", code="statut_invalide")
        ancienne_fin = r.date_fin
        if nouvelle_fin <= ancienne_fin:
            raise RegleMetier("La nouvelle date de fin doit être postérieure à la date de fin actuelle.",
                              champ="nouvelle_date_fin")
        self._verrouiller_vehicule(r.vehicule_id)
        c = self.conflits(r.vehicule_id, ancienne_fin, nouvelle_fin, exclure=r.id)
        if c:
            raise Conflit(f"Le véhicule est déjà réservé sur la période demandée "
                          f"({', '.join(self.numero(x) for x in c)}).", code="vehicule_indisponible")

        jours = nombre_jours(ancienne_fin, nouvelle_fin)
        d = r.details
        tarif = d.tarif_journalier if d else arrondi(r.prix_total / max(1, nombre_jours(r.date_debut, r.date_fin)))
        par_jour = tarif + (d.tarif_assistance if d and d.assistance else Decimal(0))
        supplement = arrondi(par_jour * jours)

        r.date_fin = nouvelle_fin
        r.prix_total = arrondi(r.prix_total + supplement)
        if d:
            d.duree_jours = nombre_jours(r.date_debut, nouvelle_fin)
            d.montant_prolongations = arrondi(d.montant_prolongations + supplement)
            d.montant_tva = tva_incluse(r.prix_total)
        p = ReservationProlongation(
            reservation_id=r.id, cle_idempotence=cle, date_fin_precedente=ancienne_fin, date_fin=nouvelle_fin,
            jours_supplementaires=jours, montant_supplementaire=supplement, demande_par=acteur.nom,
        )
        self.db.add(p)
        self._evenement(r, "EXTENDED", f"Prolongation jusqu'au {nouvelle_fin.isoformat()} (+{jours} j)", acteur.nom)
        try:
            self.db.flush()
            self.db.commit()
        except IntegrityError:
            # même clé envoyée en parallèle : on renvoie le résultat déjà enregistré
            self.db.rollback()
            deja = self.db.scalar(select(ReservationProlongation)
                                  .where(ReservationProlongation.cle_idempotence == cle))
            if deja:
                return deja
            raise
        return p

    # ======================================================================= sérialisation
    def serialiser_resume(self, r: Reservation) -> dict:
        d = r.details
        return {
            "id": r.id, "client_id": r.client_id, "vehicule_id": r.vehicule_id,
            "date_debut": r.date_debut, "date_fin": r.date_fin, "prix_total": float(r.prix_total),
            "statut": r.statut, "numero": self.numero(r), "statut_label": LIBELLES_STATUT.get(r.statut, r.statut),
            "date_reservation": r.date_reservation,
            "client_nom": d.client_nom if d else None,
            "vehicule_libelle": f"{d.vehicule_marque} {d.vehicule_modele}" if d else None,
            "vehicule_immatriculation": d.vehicule_immatriculation if d else None,
            "duree_jours": d.duree_jours if d else nombre_jours(r.date_debut, r.date_fin),
            "montant_total": float(r.prix_total), "devise": d.devise if d else settings.DEVISE,
        }

    def serialiser(self, r: Reservation) -> dict:
        base = self.serialiser_resume(r)
        d = r.details
        h_debut = d.heure_debut if d else _heure(None)
        h_fin = d.heure_fin if d else _heure(None)
        jours = base["duree_jours"]
        total = Decimal(str(r.prix_total))
        tarif = d.tarif_journalier if d else arrondi(total / max(1, jours))
        return {
            **base,
            "debut": datetime.combine(r.date_debut, h_debut),
            "fin": datetime.combine(r.date_fin, h_fin),
            "heure_debut": h_debut.strftime("%H:%M"),
            "heure_fin": h_fin.strftime("%H:%M"),
            "client": {
                "id": r.client_id, "nom": d.client_nom if d else None, "nom_complet": d.client_nom if d else None,
                "email": d.client_email if d else None, "telephone": d.client_telephone if d else None,
            },
            "vehicule": {
                "id": r.vehicule_id,
                "marque": d.vehicule_marque if d else "", "modele": d.vehicule_modele if d else "",
                "libelle": base["vehicule_libelle"] or f"Véhicule #{r.vehicule_id}",
                "immatriculation": d.vehicule_immatriculation if d else "",
                "categorie": d.vehicule_categorie if d else None, "boite": d.vehicule_boite if d else None,
                "carburant": d.vehicule_carburant if d else None,
            },
            "assistance": d.assistance if d else False,
            "tarif_journalier": float(tarif),
            "tarif_assistance": float(d.tarif_assistance if d else settings.ASSISTANCE_DAILY_FEE),
            "montant_location": float(d.montant_location if d else total),
            "montant_assistance": float(d.montant_assistance if d else 0),
            "montant_prolongations": float(d.montant_prolongations if d else 0),
            "montant_tva": float(d.montant_tva if d else tva_incluse(total)),
            "depot_garantie": float(d.depot_garantie if d else settings.SECURITY_DEPOSIT),
            "motif_annulation": d.motif_annulation if d else None,
            "cree_par": d.cree_par if d else None,
            "created_at": d.date_creation if d else None,
            "confirmed_at": d.date_confirmation if d else None,
            "cancelled_at": d.date_annulation if d else None,
            "historique": [
                {"id": e.id, "type": e.type, "message": e.message, "auteur": e.auteur, "date": e.date_evenement}
                for e in r.evenements
            ],
            "actions": {
                "peut_payer": r.statut == "EN_ATTENTE",
                "peut_confirmer": r.statut == "EN_ATTENTE",
                "peut_annuler": r.statut in STATUTS_ACTIFS and horloge.aujourdhui() < r.date_debut,
            },
        }

    def lignes_export(self, items: list[Reservation]) -> list[list[str]]:
        entete = ["Numéro", "Date de réservation", "Statut", "Client", "E-mail", "Téléphone", "Véhicule",
                  "Immatriculation", "Départ", "Retour", "Jours", "Assistance", "Montant TTC", "Devise"]
        lignes = [entete]
        for r in items:
            d = self.serialiser(r)
            lignes.append([
                d["numero"], d["date_reservation"].isoformat(), d["statut_label"], d["client"]["nom"] or "",
                d["client"]["email"] or "", d["client"]["telephone"] or "", d["vehicule"]["libelle"],
                d["vehicule"]["immatriculation"], f"{r.date_debut.isoformat()} {d['heure_debut']}",
                f"{r.date_fin.isoformat()} {d['heure_fin']}", str(d["duree_jours"]),
                "Oui" if d["assistance"] else "Non", f"{d['prix_total']:.2f}".replace(".", ","), d["devise"],
            ])
        return lignes

    @staticmethod
    def donnees_evenement(r: Reservation) -> dict:
        return {"id": r.id, "numero": ServiceReservation.numero(r), "statut": r.statut, "client_id": r.client_id,
                "vehicule_id": r.vehicule_id, "date_debut": r.date_debut.isoformat(),
                "date_fin": r.date_fin.isoformat(), "prix_total": float(r.prix_total)}
