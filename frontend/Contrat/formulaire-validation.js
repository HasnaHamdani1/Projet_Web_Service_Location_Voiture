import { finaliserContrat } from "./api.js";
import {
  afficherMessage, confirmerCreation, dateCourte, effacerBrouillon, element,
  libellesCaution, libellesMode, lireBrouillon, montant, remplirFiche,
} from "./commun.js";

const brouillon = lireBrouillon();
if (!brouillon?.reservation) {
  location.replace("formulaire-identification.html");
} else if (!brouillon.caution || !(Number(brouillon.caution.montant) > 0) || !brouillon.caution.mode || !brouillon.caution.statut) {
  location.replace("formulaire-details.html");
} else {
  const { reservation, numero, caution } = brouillon;
  const dateEdition = new Date();
  const dateTexte = new Intl.DateTimeFormat("fr-MA", { dateStyle: "short", timeStyle: "short" }).format(dateEdition);
  const periode = dateCourte(reservation.debut) + " → " + dateCourte(reservation.fin);
  const vehicule = reservation.immatriculation === "—"
    ? reservation.vehicule : reservation.immatriculation + " · " + reservation.vehicule;
  const total = montant(reservation.montant, reservation.devise);
  const libelleCaution = montant(caution.montant, reservation.devise) + " · " + libellesCaution[caution.statut];
  remplirFiche("recapitulatif", [
    ["N° contrat", numero], ["Client", reservation.client], ["Véhicule", vehicule],
    ["Période", periode], ["Montant total", total], ["Caution", libelleCaution],
  ]);
  remplirFiche("donnees-impression", [
    ["Client", reservation.client], ["Agence de location", "Parc Auto"],
    ...(reservation.email ? [["E-mail du client", reservation.email]] : []),
    ...(reservation.telephone ? [["Téléphone du client", reservation.telephone]] : []),
    ["Véhicule", vehicule], ["Période", periode],
    ["Montant total", total], ["Caution", libelleCaution],
    ["Mode d’encaissement", libellesMode[caution.mode]],
    ...(caution.conditions ? [["Conditions particulières", caution.conditions]] : []),
  ]);
  element("impression-numero").textContent = numero;
  for (const id of ["date-edition", "impression-date"]) {
    element(id).dateTime = dateEdition.toISOString();
    element(id).textContent = dateTexte;
  }

  const confirmer = element("signatures");
  const terminer = element("terminer");
  let enCours = false;

  element("imprimer").addEventListener("click", () => window.print());
  confirmer.addEventListener("change", () => { terminer.disabled = enCours || !confirmer.checked; });
  terminer.disabled = !confirmer.checked;
  element("validation").addEventListener("submit", async evenement => {
    evenement.preventDefault();
    if (enCours || !confirmer.checked) return;
    enCours = true;
    terminer.disabled = true;
    terminer.textContent = "Enregistrement…";
    afficherMessage("message", "");
    try {
      const contrat = await finaliserContrat(brouillon);
      confirmerCreation(contrat.numero_contrat);
      effacerBrouillon();
      location.replace("index.html");
    } catch (erreur) {
      afficherMessage("message", erreur.message, true);
      enCours = false;
      terminer.disabled = !confirmer.checked;
      terminer.textContent = "✓ Terminer";
    }
  });
}
