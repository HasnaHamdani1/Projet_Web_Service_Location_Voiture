import { creerApiContrats } from "./api.js";
import { afficherListeContrats } from "./interfaces/liste-contrats.js";
import { ouvrirFormulaireIdentification } from "./interfaces/formulaire-identification.js";
import { ouvrirFormulaireDetails } from "./interfaces/formulaire-details.js";
import { ouvrirFormulaireValidation } from "./interfaces/formulaire-validation.js";

/** Contrôleur de la liste et du formulaire de création. */
export function creerGestionContrats({ request, notify, obtenirVehicules }) {
  const api = creerApiContrats(request);

  async function chargerListe() {
    const list = document.querySelector("#contract-list");
    try {
      const [contrats, vehicules] = await Promise.all([api.lister(), obtenirVehicules()]);
      await afficherListeContrats(list, contrats, vehicules);
    } catch (error) {
      const message = document.createElement("div");
      message.className = "empty-state";
      message.textContent = error.message;
      list.replaceChildren(message);
    }
  }

  async function ouvrirNouveauContrat(options = {}) {
    try {
      const [reservations, contrats, vehicules] = await Promise.all([
        request("reservation", "/reservations"),
        api.lister(),
        obtenirVehicules(),
      ]);
      await ouvrirFormulaireIdentification(
        reservations,
        contrats,
        vehicules,
        (brouillon, reservation, vehicule) => ouvrirFormulaireDetails(
          brouillon,
          reservation,
          vehicule,
          () => ouvrirNouveauContrat({
            reservationId: Number(reservation.id),
            contrat: brouillon,
          }),
          contratMisAJour => ouvrirFormulaireValidation(
            contratMisAJour,
            reservation,
            vehicule,
            contrat => api.finaliser(contrat),
            chargerListe,
          ).catch(error => notify(error.message, true)),
          chargerListe,
        ).catch(error => notify(error.message, true)),
        options.reservationId,
        options.contrat,
      );
    } catch (error) {
      notify(error.message, true);
    }
  }

  return { chargerListe, ouvrirNouveauContrat };
}
