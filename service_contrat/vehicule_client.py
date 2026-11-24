"""Appel au service Véhicule : le véhicule passe en LOUE à la création du contrat.

PUT /vehicules/{id}/statut avec la clé X-API-Key donnée par le service Véhicule
(VEHICULE_SERVICE_API_KEYS=contrats:<clé> chez Leila, CONTRAT_VEHICULE_API_KEY ici).
Un échec est journalisé sans annuler le contrat déjà enregistré.
"""
import logging
import os

import httpx

logger = logging.getLogger("service_contrat.vehicule")


def marquer_loue(vehicule_id) -> bool:
    if not vehicule_id:
        return False
    base = os.getenv("VEHICLE_SERVICE_URL", "http://127.0.0.1:8005").rstrip("/")
    try:
        reponse = httpx.put(f"{base}/vehicules/{vehicule_id}/statut", json={"statut": "LOUE"},
                            headers={"X-API-Key": os.getenv("CONTRAT_VEHICULE_API_KEY", "")}, timeout=5)
    except httpx.RequestError as exc:
        logger.error("Véhicule %s non passé en LOUE : %s", vehicule_id, exc)
        return False
    if reponse.is_error:
        logger.error("Véhicule %s non passé en LOUE : HTTP %s %s", vehicule_id, reponse.status_code, reponse.text[:200])
        return False
    return True
