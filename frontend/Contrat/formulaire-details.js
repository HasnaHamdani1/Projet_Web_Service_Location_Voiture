import {
  dateCourte, element, enregistrerBrouillon, lireBrouillon, montant,
} from "./commun.js";

const brouillon = lireBrouillon();
if (!brouillon?.reservation) {
  location.replace("formulaire-identification.html");
} else {
  const { reservation, caution, numero } = brouillon;
  element("numero").value = numero;
  element("immatriculation").value = reservation.immatriculation;
  element("client").value = reservation.client;
  element("debut").value = dateCourte(reservation.debut);
  element("fin").value = dateCourte(reservation.fin);
  element("jours").value = Number.isFinite(reservation.jours) ? String(reservation.jours) : "—";
  element("prix").value = montant(reservation.tarif, reservation.devise);
  element("total").value = montant(reservation.montant, reservation.devise);
  if (caution) {
    element("caution").value = caution.montant;
    element("mode").value = caution.mode;
    element("statut-caution").value = caution.statut;
    element("conditions").value = caution.conditions;
  }

  const form = element("details");
  function sauvegarderSaisie() {
    brouillon.caution = {
      montant: element("caution").value,
      mode: element("mode").value,
      statut: element("statut-caution").value,
      conditions: element("conditions").value.trim(),
    };
    enregistrerBrouillon(brouillon);
  }
  form.addEventListener("input", sauvegarderSaisie);
  form.addEventListener("change", sauvegarderSaisie);
  form.addEventListener("submit", evenement => {
    evenement.preventDefault();
    sauvegarderSaisie();
    location.assign("formulaire-validation.html");
  });
}
