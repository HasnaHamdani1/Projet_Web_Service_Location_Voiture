import { creerApiContrats } from "./api.js";
import { afficherListeContrats } from "./interfaces/liste-contrats.js";
import { ouvrirFormulaireIdentification } from "./interfaces/formulaire-identification.js";
import { ouvrirFormulaireDetails } from "./interfaces/formulaire-details.js";
import { ouvrirFormulaireValidation } from "./interfaces/formulaire-validation.js";

/** Contrôleur de l'espace Contrats, intégré à l'application frontend partagée. */
export function creerGestionContrats({ request, notify, escapeHtml, state }) {
  const api = creerApiContrats(request);

  async function chargerListe() {
    const list = document.querySelector("#contract-list");
    try {
      const contrats = await api.lister();
      await afficherListeContrats(list, contrats, state.vehicles);
    } catch (error) {
      list.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
  }

  async function creerDepuisReservation(reservationId) {
    try {
      await api.creer(reservationId);
      notify("Contrat créé en attente. Enregistrez la caution avant la signature.");
      await chargerListe();
    } catch (error) {
      notify(error.message, true);
    }
  }

  async function enregistrerCaution(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const montant = Number(new FormData(form).get("montant_caution"));
    try {
      await api.enregistrerCaution(form.dataset.deposit, montant);
      notify("Caution enregistrée.");
      await chargerListe();
    } catch (error) {
      notify(error.message, true);
    }
  }

  async function validerContrat(event) {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await api.valider(button.dataset.sign);
      notify("Contrat signé et validé.");
      await chargerListe();
    } catch (error) {
      notify(error.message, true);
      button.disabled = false;
    }
  }

  async function ouvrirNouveauContrat(options = {}) {
    try {
      const [reservations, contrats] = await Promise.all([
        request("reservation", "/reservations"),
        api.lister(),
      ]);
      await ouvrirFormulaireIdentification(
        reservations,
        contrats,
        state.vehicles,
        (brouillon, reservation, vehicule) => ouvrirFormulaireDetails(
          brouillon,
          reservation,
          vehicule,
          async (contrat, montant) => ({ ...contrat, montant_caution: montant }),
          () => ouvrirNouveauContrat({
            reservationId: Number(reservation.id),
            contrat: brouillon,
          }),
          async contratMisAJour => {
            let client = null;
            try {
              client = await request("auth", `/auth/clients/${Number(reservation.client_id)}`);
            } catch (error) {
              notify(`Nom du client indisponible : ${error.message}`, true);
            }
            await ouvrirFormulaireValidation(
              contratMisAJour,
              reservation,
              vehicule,
              client,
              state.user,
              contrat => api.finaliser(contrat),
              chargerListe,
            );
          },
          chargerListe,
        ),
        options.reservationId,
        options.contrat,
      );
    } catch (error) {
      notify(error.message, true);
    }
  }

  return { chargerListe, creerDepuisReservation, ouvrirNouveauContrat };
}
