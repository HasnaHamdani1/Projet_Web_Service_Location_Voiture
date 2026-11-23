"""E-mail de confirmation au client et événements (webhooks) vers les autres services."""
import logging
import smtplib
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Any

import httpx

from .config import settings

logger = logging.getLogger("service_reservation.notifications")

MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
        "septembre", "octobre", "novembre", "décembre"]


def date_fr(d) -> str:
    return f"{d.day} {MOIS[d.month - 1]} {d.year}"


def montant_fr(v, devise: str) -> str:
    return f"{v:,.2f}".replace(",", " ").replace(".", ",") + f" {devise}"


def email_confirmation(r: dict) -> tuple[str, str]:
    """`r` = réservation sérialisée (dict de l'API)."""
    dev = r["devise"]
    sujet = f"Confirmation de votre réservation {r['numero']} – PARC AUTO"
    lignes = [
        f"Bonjour {r['client']['nom']},",
        "",
        f"Votre réservation n° {r['numero']} est confirmée.",
        "",
        f"Véhicule : {r['vehicule']['libelle']} ({r['vehicule']['immatriculation']})",
        f"Départ   : {date_fr(r['date_debut_obj'])} à {r['heure_debut']}",
        f"Retour   : {date_fr(r['date_fin_obj'])} à {r['heure_fin']}",
        f"Durée    : {r['duree_jours']} jour(s)",
        "",
        f"Location : {r['duree_jours']} × {montant_fr(r['tarif_journalier'], dev)} = {montant_fr(r['montant_location'], dev)}",
    ]
    if r["assistance"]:
        lignes.append(f"Assistance renforcée : {montant_fr(r['montant_assistance'], dev)}")
    lignes += [
        f"Total TTC : {montant_fr(r['montant_total'], dev)} (dont TVA {montant_fr(r['montant_tva'], dev)})",
        f"Dépôt de garantie : {montant_fr(r['depot_garantie'], dev)}",
        "",
        "À bientôt,",
        "L'équipe PARC AUTO",
    ]
    return sujet, "\n".join(lignes)


class Expediteur(ABC):
    @abstractmethod
    def envoyer(self, destinataire: str, sujet: str, texte: str) -> None: ...


class ExpediteurConsole(Expediteur):
    def envoyer(self, destinataire: str, sujet: str, texte: str) -> None:
        logger.info("E-mail (console) à %s : %s\n%s", destinataire, sujet, texte)


class ExpediteurSmtp(Expediteur):
    def envoyer(self, destinataire: str, sujet: str, texte: str) -> None:
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = settings.EMAIL_FROM, destinataire, sujet
        msg.set_content(texte)
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if settings.SMTP_USER:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)


def expediteur() -> Expediteur:
    return ExpediteurSmtp() if settings.EMAIL_BACKEND == "smtp" else ExpediteurConsole()


def publier(evenement: str, donnees: dict[str, Any]) -> None:
    """Tâche de fond : un webhook en échec ne bloque jamais la requête."""
    payload = {"event": evenement, "occurred_at": datetime.now(timezone.utc).isoformat(),
               "source": "reservations", "data": donnees}
    logger.info("Événement %s (réservation %s)", evenement, donnees.get("numero"))
    for url in settings.webhook_urls:
        try:
            httpx.post(url, json=payload, timeout=5.0, headers={"X-Event-Type": evenement})
        except httpx.HTTPError as exc:
            logger.warning("Webhook %s en échec : %s", url, exc)
