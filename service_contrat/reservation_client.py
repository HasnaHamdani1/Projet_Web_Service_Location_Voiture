import os

import httpx
from fastapi import HTTPException


def _base_url() -> str:
    return os.getenv("RESERVATION_SERVICE_URL", "http://127.0.0.1:8002").rstrip("/")


def obtenir_reservation(reservation_id: int) -> dict:
    timeout = float(os.getenv("RESERVATION_SERVICE_TIMEOUT_SECONDS", "5"))
    try:
        response = httpx.get(f"{_base_url()}/reservations/{reservation_id}", timeout=timeout)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail="Le service Réservation est indisponible") from exc
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Réservation introuvable")
    if response.is_error:
        raise HTTPException(status_code=503, detail="Le service Réservation a renvoyé une erreur")
    try:
        return response.json()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail="Réponse invalide du service Réservation") from exc


def lister_reservations() -> list[dict]:
    timeout = float(os.getenv("RESERVATION_SERVICE_TIMEOUT_SECONDS", "5"))
    try:
        response = httpx.get(f"{_base_url()}/reservations", timeout=timeout)
        response.raise_for_status()
        data = response.json()
    except (httpx.RequestError, httpx.HTTPStatusError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="Impossible de consulter les réservations") from exc
    if not isinstance(data, list):
        raise HTTPException(status_code=503, detail="Réponse invalide du service Réservation")
    return data
