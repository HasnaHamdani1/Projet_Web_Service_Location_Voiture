import os

import httpx
from fastapi import HTTPException
from pydantic import ValidationError

from .schemas import ReservationSnapshot


def get_reservation(reservation_id: int) -> ReservationSnapshot:
    base_url = os.getenv(
        "RESERVATION_SERVICE_URL", "http://service_reservation:8000"
    ).rstrip("/")
    timeout = float(os.getenv("RESERVATION_SERVICE_TIMEOUT_SECONDS", "5"))

    try:
        response = httpx.get(
            f"{base_url}/reservations/{reservation_id}", timeout=timeout
        )
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=503, detail="Le service Réservation ne répond pas à temps"
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503, detail="Le service Réservation est indisponible"
        ) from exc

    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Réservation introuvable")
    if response.status_code >= 500:
        raise HTTPException(
            status_code=503, detail="Le service Réservation est indisponible"
        )
    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail="Réponse inattendue du service Réservation",
        )

    try:
        reservation = ReservationSnapshot.model_validate(response.json())
    except (ValueError, ValidationError) as exc:
        raise HTTPException(
            status_code=502,
            detail="La réponse du service Réservation est invalide",
        ) from exc

    if reservation.id != reservation_id:
        raise HTTPException(
            status_code=502,
            detail="L'identifiant retourné ne correspond pas à la réservation demandée",
        )

    return reservation
