import requests
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from enums import EtatVehicule
from models import Retour
from config import CONTRAT_API_URL, RETOUR_CONTRAT_API_KEY, RETOUR_VEHICULE_API_KEY, VEHICULE_API_URL


class RetourService:

    def __init__(self, contrat_api_url: str, vehicule_api_url: str):
        self.contrat_api_url = contrat_api_url.rstrip("/")
        self.vehicule_api_url = vehicule_api_url.rstrip("/")

    # ==========================================
    # 1. Service Contrat
    # ==========================================

    # 1a. Lire un contrat par son id
    def obtenirContrat(self, contrat_id: int) -> dict:
        try:
            r = requests.get(
                f"{self.contrat_api_url}/contrats/{contrat_id}",
                timeout=5
            )
            r.raise_for_status()
            return r.json()

        except requests.exceptions.HTTPError as e:
            if e.response is not None and e.response.status_code == 404:
                raise ValueError("Contrat introuvable.")
            raise RuntimeError(f"Erreur du service Contrat : {e}")

        except requests.exceptions.RequestException as e:
            raise RuntimeError(
                f"Erreur de communication avec le service Contrat : {e}"
            )

    # 1b. Lire tous les contrats
    def obtenirTousLesContrats(self) -> list:
        try:
            r = requests.get(f"{self.contrat_api_url}/contrats", timeout=5)
            r.raise_for_status()
            return r.json()

        except requests.exceptions.RequestException as e:
            raise RuntimeError(
                f"Erreur de communication avec le service Contrat : {e}"
            )

    # 1c. Trouver un contrat par son numéro (ex : CTR-2026-D7135CCE)
    def trouverContratParNumero(self, numero: str) -> dict:
        for c in self.obtenirTousLesContrats():
            if c.get("numero_contrat") == numero:
                return c
        raise ValueError(f"Contrat {numero} introuvable.")

    # 1d. Extraire les infos utiles directement du contrat
    def extraireReservation(self, contrat: dict) -> dict:
        date_fin = contrat.get("periode_fin")
        date_debut = contrat.get("periode_prise")

        if not date_fin or not date_debut:
            raise ValueError(
                "Dates de début ou de fin introuvables dans le contrat."
            )

        # Prix par jour = montant total / nombre de jours du contrat
        nb_jours = max(
            (
                date.fromisoformat(str(date_fin))
                - date.fromisoformat(str(date_debut))
            ).days,
            1
        )

        montant_total = contrat.get("montant_total")
        prix_jour = None

        if montant_total is not None:
            prix_jour = str(
                (Decimal(str(montant_total)) / nb_jours).quantize(
                    Decimal("0.01")
                )
            )

        # vehicule_id se trouve dans le sous-objet "reservation" du contrat
        resa = contrat.get("reservation") or {}

        return {
            "dateFin": date_fin,
            "montantEstime": prix_jour,   # prix PAR JOUR
            "vehicule_id": resa.get("vehicule_id"),
        }

    # 1e. Compatibilité : utilisée par /retours/traiter
    def recupererDetailsReservationParContrat(self, contrat_id: int) -> dict:
        return self.extraireReservation(self.obtenirContrat(contrat_id))

    # ==========================================
    # 2. Vérifier le retard
    # ==========================================
    def verifierRetard(
        self,
        dateRetour: date,
        dateFin: date
    ) -> tuple[bool, int]:

        if dateRetour <= dateFin:
            return False, 0

        dureeRetard = (dateRetour - dateFin).days

        return True, dureeRetard

    # ==========================================
    # 3. Calculer le montant du retard
    # ==========================================
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

        details = self.recupererDetailsReservationParContrat(contrat_id)

        montant = details.get("montantEstime")

        if montant is None:
            raise ValueError(
                "Montant estimé introuvable dans le contrat."
            )

        montantEstime = Decimal(str(montant))

        if montantEstime < Decimal("0.00"):
            raise ValueError(
                "Le montant estimé ne peut pas être négatif."
            )

        # Formule : 2 × prix par jour × nombre de jours de retard
        montantRetard = (
            Decimal("2") * montantEstime * dureeRetardJours
        )

        return montantRetard.quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP
        )

    # ==========================================
    # 4. Vérifier et affecter l'état du véhicule
    # ==========================================
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

    # ==========================================
    # 5. Enregistrer les dommages constatés
    # ==========================================
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

    # ==========================================
    # 6. Finaliser le retour en clôturant le contrat
    # ==========================================
        # 6. Finaliser le retour en clôturant le contrat
    def finaliserRetour(self, contrat_id: int) -> dict:

        url = f"{self.contrat_api_url}/contrats/{contrat_id}/statut"
        derniere_reponse = None

        try:
            # Route du service Contrat : PUT /contrats/{id}/statut {"statut": "CLOTURE"}
            for methode in (requests.put,):
                response = methode(url, json={"statut": "CLOTURE"}, timeout=5,
                                   headers={"X-API-Key": RETOUR_CONTRAT_API_KEY})

                if response.status_code == 405:      # mauvaise méthode
                    derniere_reponse = response
                    continue

                if response.status_code >= 400:
                    raise RuntimeError(
                        f"Service Contrat : {response.status_code} - "
                        f"{response.text[:200]}"
                    )

                if response.content:
                    return response.json()

                return {"message": "Contrat clôturé avec succès."}

            raise RuntimeError(
                "Service Contrat : aucune méthode (PUT, POST, PATCH) "
                f"acceptée sur {url} "
                f"({derniere_reponse.status_code if derniere_reponse is not None else '?'})"
            )

        except requests.exceptions.RequestException as e:
            raise RuntimeError(
                f"Erreur lors de la clôture du contrat : {e}"
            )

    # ==========================================
    # 7. Mettre à jour le statut du véhicule
    # ==========================================
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
        details = self.recupererDetailsReservationParContrat(contrat_id)

        vehicule_id = details.get("vehicule_id")

        if not vehicule_id:
            raise ValueError(
                "ID du véhicule introuvable dans le contrat."
            )

        # Appeler le microservice Véhicule
        try:
            response = requests.put(
                f"{self.vehicule_api_url}/vehicules/{vehicule_id}/statut",
                json={"statut": nouveauStatut},
                timeout=5,
                headers={"X-API-Key": RETOUR_VEHICULE_API_KEY}
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
    contrat_api_url=CONTRAT_API_URL,
    vehicule_api_url=VEHICULE_API_URL
)