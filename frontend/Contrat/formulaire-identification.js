import { listerContrats, listerReservations, listerVehicules } from "./api.js";
import {
  afficherMessage, dateCourte, effacerBrouillon, element, enregistrerBrouillon,
  genererNumero, lireBrouillon, normaliserReservation,
} from "./commun.js";

const select = element("reservation");
const suivant = element("suivant");
const url = new URL(location.href);
if (url.searchParams.has("nouveau")) {
  effacerBrouillon();
  url.searchParams.delete("nouveau");
  history.replaceState(null, "", url);
}
let brouillon = lireBrouillon();
let choix = [];

function reservationSelectionnee() {
  return choix.find(reservation => reservation.id === Number(select.value));
}

function afficherSelection() {
  const reservation = reservationSelectionnee();
  element("numero").value = reservation ? brouillon.numero : "";
  element("client").value = reservation?.client ?? "";
  element("immatriculation").value = reservation?.immatriculation ?? "";
  element("debut").value = reservation ? dateCourte(reservation.debut) : "";
  element("fin").value = reservation ? dateCourte(reservation.fin) : "";
  element("vehicule").textContent = reservation?.vehicule ?? "";
  element("vehicule-resume").hidden = !reservation;
  suivant.disabled = !reservation;
}

function mettreAJourSelection() {
  const reservation = reservationSelectionnee();
  if (reservation) {
    brouillon = brouillon?.reservation.id === reservation.id
      ? { ...brouillon, reservation }
      : { reservation, numero: genererNumero() };
    enregistrerBrouillon(brouillon);
  } else {
    brouillon = null;
    effacerBrouillon();
  }
  afficherSelection();
}

try {
  const [reservations, contrats, vehicules] = await Promise.all([
    listerReservations(), listerContrats(), listerVehicules(),
  ]);
  if (!Array.isArray(contrats)) throw new Error("Impossible de vérifier les contrats existants.");
  const prises = new Set(contrats.map(contrat => Number(contrat.reservation_id)));
  choix = reservations
    .map(reservation => normaliserReservation(reservation, vehicules))
    .filter(reservation => reservation.statut === "CONFIRMEE" && !prises.has(reservation.id) && reservation.id > 0)
    .sort((a, b) => b.id - a.id);
  select.replaceChildren(new Option(
    choix.length ? "Choisir une réservation confirmée" : "Aucune réservation confirmée disponible",
    "",
  ));
  choix.forEach(reservation => select.add(new Option(reservation.numero + " · " + reservation.client, reservation.id)));
  select.disabled = !choix.length;
  select.value = String(brouillon?.reservation.id ?? "");
  mettreAJourSelection();
  if (!choix.length) afficherMessage("message", "Une réservation confirmée devient disponible ici tant qu’aucun contrat ne lui est associé.");
} catch (erreur) {
  select.replaceChildren(new Option("Réservations indisponibles", ""));
  afficherMessage("message", erreur.message, true);
}

select.addEventListener("change", mettreAJourSelection);
element("identification").addEventListener("submit", evenement => {
  evenement.preventDefault();
  if (reservationSelectionnee()) location.assign("formulaire-details.html");
});
