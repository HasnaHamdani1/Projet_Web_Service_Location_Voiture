import { chargerFragment } from "./charger-fragment.js";

const afficherDate = valeur => {
  if (!valeur) return "—";
  const date = new Date(`${valeur}T00:00:00`);
  return Number.isNaN(date.getTime()) ? valeur : date.toLocaleDateString("fr-FR");
};

const nouveauNumeroContrat = () => {
  const octets = crypto.getRandomValues(new Uint8Array(4));
  const suffixe = [...octets].map(octet => octet.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `CTR-${new Date().getFullYear()}-${suffixe}`;
};

/** Affiche F006 : la réservation reste en brouillon jusqu'à la dernière étape. */
export async function ouvrirFormulaireIdentification(
  reservations,
  contrats,
  vehicules,
  continuerDetails,
  reservationPreselectionneeId = null,
  brouillonExistant = null,
) {
  const dejaUtilisees = new Set(contrats.map(contrat => Number(contrat.reservation_id)));
  const brouillonsExistants = new Map(contrats
    .filter(contrat => contrat.statut === "EN_ATTENTE")
    .map(contrat => [Number(contrat.reservation_id), contrat]));
  const confirmables = reservations.filter(reservation =>
    ["CONFIRMEE", "CONFIRMÉE"].includes(String(reservation.statut).toUpperCase()) &&
    (!dejaUtilisees.has(Number(reservation.id)) ||
      Number(reservation.id) === Number(reservationPreselectionneeId) ||
      Number(reservation.id) === Number(brouillonExistant?.reservation_id) ||
      brouillonsExistants.has(Number(reservation.id)))
  );

  const boite = document.createElement("dialog");
  boite.className = "contract-wizard";
  boite.setAttribute("aria-label", "Formulaire d’identification du contrat");
  await chargerFragment(boite, "formulaire-identification.html");

  const form = boite.querySelector("form");
  const select = form.elements.reservation_id;
  const submit = form.querySelector('[type="submit"]');
  select.options[0].textContent = confirmables.length
    ? "Choisir une réservation confirmée"
    : "Aucune réservation confirmée disponible";
  select.disabled = confirmables.length === 0;

  for (const reservation of confirmables) {
    const option = document.createElement("option");
    option.value = String(Number(reservation.id));
    option.textContent = `RES-${String(reservation.id).padStart(4, "0")}`;
    option.selected = Number(reservation.id) === Number(reservationPreselectionneeId);
    select.append(option);
  }

  const mettreAJourResume = () => {
    const reservation = confirmables.find(item => Number(item.id) === Number(select.value));
    const vehicule = reservation
      ? vehicules.find(item => Number(item.id) === Number(reservation.vehicule_id))
      : null;
    form.querySelector('[data-summary="client"]').value = reservation?.client_id
      ? `Client #${reservation.client_id}` : "Sélectionnez une réservation";
    form.querySelector('[data-summary="vehicle"]').value = vehicule?.immatriculation ||
      (reservation ? `Véhicule #${reservation.vehicule_id}` : "—");
    form.querySelector('[data-summary="start"]').value = afficherDate(reservation?.date_debut);
    form.querySelector('[data-summary="end"]').value = afficherDate(reservation?.date_fin);
    form.querySelector('[data-summary="vehicle-name"]').textContent = reservation
      ? `${vehicule?.marque || "Véhicule"} ${vehicule?.modele || `#${reservation.vehicule_id}`}`
      : "Véhicule";
    submit.disabled = !reservation;
  };

  select.addEventListener("change", mettreAJourResume);
  if (reservationPreselectionneeId) mettreAJourResume();
  form.addEventListener("submit", event => {
    event.preventDefault();
    const reservationId = Number(select.value);
    if (!reservationId) return;
    submit.disabled = true;
    submit.textContent = "Préparation…";
    const reservation = confirmables.find(item => Number(item.id) === reservationId);
    const vehicule = vehicules.find(item => Number(item.id) === Number(reservation?.vehicule_id));
    const brouillonSelectionne = Number(brouillonExistant?.reservation_id) === reservationId
      ? brouillonExistant : brouillonsExistants.get(reservationId);
    const contrat = brouillonSelectionne || {
      numero_contrat: nouveauNumeroContrat(),
      date_generation: new Date().toISOString().slice(0, 10),
      statut: "BROUILLON",
      periode_prise: reservation?.date_debut,
      periode_fin: reservation?.date_fin,
      montant_total: reservation?.prix_total,
      reservation_id: reservationId,
      administrateur_id: null,
      montant_caution: null,
      date_validation: null,
      date_cloture: null,
    };
    boite.addEventListener("close", () => {
      boite.remove();
      continuerDetails?.(contrat, reservation, vehicule);
    }, { once: true });
    boite.close();
  });

  boite.querySelector(".contract-wizard-close").addEventListener("click", () => boite.close());
  boite.addEventListener("click", event => { if (event.target === boite) boite.close(); });
  boite.addEventListener("close", () => boite.remove(), { once: true });
  document.body.append(boite);
  boite.showModal();
}
