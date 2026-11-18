
import requests
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from enums import EtatVehicule
from models import Retour
from config import (
    RESERVATION_API_URL,
    CONTRAT_API_URL,
    VEHICULE_API_URL
)


class RetourService:

    def __init__(
        self,
        reservation_api_url: str,
        contrat_api_url: str,
        vehicule_api_url: str
    ):
        self.reservation_api_url = reservation_api_url.rstrip("/")
        self.contrat_api_url = contrat_api_url.rstrip("/")
        self.vehicule_api_url = vehicule_api_url.rstrip("/")

    # 1. Récupérer les informations de la réservation à partir du contrat
    def recupererDetailsReservationParContrat(
        self,
        contrat_id: int
    ) -> dict:

        try:
            response_contrat = requests.get(
                f"{self.contrat_api_url}/contrats/{contrat_id}",
                timeout=5
            )
            response_contrat.raise_for_status()
            contrat_data = response_contrat.json()

        except requests.exceptions.HTTPError as e:
            if e.response is not None and e.response.status_code == 404:
                raise ValueError("Contrat introuvable.")
            raise RuntimeError(f"Erreur du service Contrat : {e}")

        except requests.exceptions.RequestException as e:
            raise RuntimeError(
                f"Erreur de communication avec le service Contrat : {e}"
            )

        reservation_id = contrat_data.get("reservation_id")

        if not reservation_id:
            raise ValueError(
                "ID de réservation introuvable dans le contrat."
            )

        try:
            response_resa = requests.get(
                f"{self.reservation_api_url}/reservations/{reservation_id}",
                timeout=5
            )
            response_resa.raise_for_status()
            reservation_data = response_resa.json()

        except requests.exceptions.HTTPError as e:
            if e.response is not None and e.response.status_code == 404:
                raise ValueError("Réservation introuvable.")
            raise RuntimeError(f"Erreur du service Réservation : {e}")

        except requests.exceptions.RequestException as e:
            raise RuntimeError(
                f"Erreur de communication avec le service Réservation : {e}"
            )

        return reservation_data

    # 2. Vérifier le retard
    def verifierRetard(
        self,
        dateRetour: date,
        dateFin: date
    ) -> tuple[bool, int]:

        if dateRetour <= dateFin:
            return False, 0

        dureeRetard = (dateRetour - dateFin).days

        return True, dureeRetard

    # 3. Calculer le montant du retard
    def calculerMontantRetard(
        self,
        contrat_id: int,
        dureeRetardJours: int
    ) -> Decimal:

        if dureeRetardJours < 0:
            raise ValueError(
                "La durée du retard ne peut pas être négative."
            )

        if dureeRetardJours == 0:
            return Decimal("0.00")

        reservation_data = self.recupererDetailsReservationParContrat(
            contrat_id
        )

        montant = reservation_data.get("montantEstime")

        if montant is None:
            raise ValueError(
                "Montant estimé introuvable dans la réservation."
            )

        montantEstime = Decimal(str(montant))

        if montantEstime < Decimal("0.00"):
            raise ValueError(
                "Le montant estimé ne peut pas être négatif."
            )

        # Formule : 2 × montant estimé × nombre de jours de retard
        montantRetard = (
            Decimal("2") * montantEstime * dureeRetardJours
        )

        return montantRetard.quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP
        )

    # 4. Vérifier et affecter l'état du véhicule
    def verifierEtat(
        self,
        retour: Retour,
        etatVehicule: str
    ) -> EtatVehicule:

        try:
            etat = EtatVehicule(etatVehicule)
        except ValueError:
            raise ValueError("État du véhicule invalide.")

        retour.etatVehicule = etat

        return etat

    # 5. Enregistrer les dommages constatés
    def enregistrerDommage(
        self,
        retour: Retour,
        dommage: str,
        montantDommage: Decimal
    ) -> Retour:

        if retour.etatVehicule == EtatVehicule.BON:
            raise ValueError(
                "Impossible d'enregistrer un dommage si le véhicule est en bon état."
            )

        if not dommage or not dommage.strip():
            raise ValueError(
                "La description du dommage est obligatoire."
            )

        montantDommage = Decimal(str(montantDommage))

        if montantDommage < Decimal("0.00"):
            raise ValueError(
                "Le montant du dommage ne peut pas être négatif."
            )

        retour.dommage = dommage.strip()

        retour.montantDommage = montantDommage.quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP
        )

        return retour

    # 6. Finaliser le retour en clôturant le contrat
    def finaliserRetour(
        self,
        contrat_id: int
    ) -> dict:

        try:
            response = requests.put(
                f"{self.contrat_api_url}/contrats/{contrat_id}/statut",
                json={"statut": "CLOTURE"},
                timeout=5
            )

            response.raise_for_status()

            if response.content:
                return response.json()

            return {
                "message": "Contrat clôturé avec succès."
            }

        except requests.exceptions.RequestException as e:
            raise RuntimeError(
                f"Erreur lors de la clôture du contrat : {e}"
            )

    # 7. Mettre à jour le statut du véhicule après son retour
    def mettreAJourStatutVehicule(
        self,
        contrat_id: int,
        etatVehicule: str
    ) -> dict:

        try:
            etat = EtatVehicule(etatVehicule)
        except ValueError:
            raise ValueError("État du véhicule invalide.")

        # Déterminer le statut selon l'état constaté
        if etat == EtatVehicule.BON:
            nouveauStatut = "DISPONIBLE"
        else:
            nouveauStatut = "MAINTENANCE"

        # Récupérer le véhicule associé au contrat
        reservation_data = self.recupererDetailsReservationParContrat(
            contrat_id
        )

        vehicule_id = reservation_data.get("vehicule_id")

        if not vehicule_id:
            raise ValueError(
                "ID du véhicule introuvable dans la réservation."
            )

        # Appeler le microservice Véhicule
        try:
            response = requests.put(
                f"{self.vehicule_api_url}/vehicules/{vehicule_id}/statut",
                json={"statut": nouveauStatut},
                timeout=5
            )

            response.raise_for_status()

            if response.content:
                return response.json()

            return {
                "message": "Statut du véhicule mis à jour avec succès.",
                "nouveauStatut": nouveauStatut
            }

        except requests.exceptions.RequestException as e:
            raise RuntimeError(
                f"Erreur lors de la mise à jour du véhicule : {e}"
            )


# Initialisation du service Retour
retour_service = RetourService(
    reservation_api_url=RESERVATION_API_URL,
    contrat_api_url=CONTRAT_API_URL,
    vehicule_api_url=VEHICULE_API_URL
)
