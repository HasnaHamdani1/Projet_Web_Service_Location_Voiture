"""Erreurs métier et format des réponses d'erreur.

Format conforme à TEAM_SYNC §3.2 (« garder {"detail": "..."} de FastAPI ») :
    {"detail": "Message lisible", "code": "vehicule_indisponible", "erreurs": [{"champ": "vehicule_id", "message": "..."}]}
Les erreurs de validation gardent la liste `detail` standard de FastAPI et ajoutent `erreurs`.
"""
import logging

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("service_reservation.erreurs")


class ErreurMetier(Exception):
    status_code = 400
    code = "requete_invalide"

    def __init__(self, message: str, champ: str | None = None, code: str | None = None):
        super().__init__(message)
        self.message = message
        self.champ = champ
        if code:
            self.code = code


class Introuvable(ErreurMetier):
    status_code = 404
    code = "introuvable"


class Conflit(ErreurMetier):
    status_code = 409
    code = "conflit"


class RegleMetier(ErreurMetier):
    status_code = 422
    code = "regle_metier"


class NonAuthentifie(ErreurMetier):
    status_code = 401
    code = "non_authentifie"


class Interdit(ErreurMetier):
    status_code = 403
    code = "interdit"


class ServiceIndisponible(ErreurMetier):
    status_code = 503
    code = "service_indisponible"


def corps(message: str, code: str, champ: str | None = None) -> dict:
    return {
        "detail": message,
        "code": code,
        "erreurs": [{"champ": champ, "message": message}] if champ else [],
    }


def installer_gestionnaires(app: FastAPI) -> None:
    @app.exception_handler(ErreurMetier)
    async def _metier(_: Request, exc: ErreurMetier):
        headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
        return JSONResponse(status_code=exc.status_code, content=corps(exc.message, exc.code, exc.champ),
                            headers=headers)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        erreurs = []
        for err in exc.errors():
            loc = [str(p) for p in err.get("loc", []) if p not in ("body", "query", "path", "header")]
            msg = err.get("msg", "Valeur invalide")
            if msg.startswith("Value error, "):
                msg = msg[len("Value error, "):]
            erreurs.append({"champ": loc[-1] if loc else None, "message": msg})
        return JSONResponse(
            status_code=422,
            content={"detail": jsonable_encoder(exc.errors(), custom_encoder={Exception: str}),
                     "code": "validation", "erreurs": erreurs},
        )

    @app.exception_handler(Exception)
    async def _inattendue(request: Request, exc: Exception):
        logger.exception("Erreur non gérée sur %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content=corps("Erreur interne du service Réservation.", "erreur_interne"))
