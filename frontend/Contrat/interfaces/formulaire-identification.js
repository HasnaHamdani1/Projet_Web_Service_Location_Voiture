const echapper = valeur =>
  String(valeur ?? "").replace(/[&<>"']/g, caractere => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[caractere]));

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

/** Affiche l'étape F006 et conserve la réservation en brouillon, sans écriture en base. */
export function ouvrirFormulaireIdentification(reservations, contrats, vehicules, continuerDetails, reservationPreselectionneeId = null, brouillonExistant = null) {
  const dejaUtilisees = new Set(contrats.map(contrat => Number(contrat.reservation_id)));
  const brouillonsExistants = new Map(contrats
    .filter(contrat => contrat.statut === "EN_ATTENTE")
    .map(contrat => [Number(contrat.reservation_id), contrat]));
  const confirmables = reservations.filter(reservation =>
    ["CONFIRMEE", "CONFIRMÉE"].includes(String(reservation.statut).toUpperCase()) &&
    (!dejaUtilisees.has(Number(reservation.id)) || Number(reservation.id) === Number(reservationPreselectionneeId) || Number(reservation.id) === Number(brouillonExistant?.reservation_id) || brouillonsExistants.has(Number(reservation.id)))
  );

  const boite = document.createElement("dialog");
  boite.className = "contract-wizard";
  boite.setAttribute("aria-label", "Formulaire d’identification du contrat");
  boite.innerHTML = `
    <div class="contract-wizard-header">
      <button class="contract-wizard-close" type="button" aria-label="Fermer">×</button>
    </div>

    <div class="contract-steps" aria-label="Étape 1 sur 3">
      <div class="contract-step active"><b>1</b><span><strong>Réservation</strong><small>Identification</small></span></div>
      <div class="contract-step"><b>2</b><span><strong>Détails &amp; caution</strong><small>Montant et conditions</small></span></div>
      <div class="contract-step"><b>3</b><span><strong>Validation</strong><small>Impression &amp; signatures</small></span></div>
    </div>

    <form class="contract-identification-form">
      <section class="contract-form-section">
        <h3><span>▣</span> Identifiants clés</h3>
        <div class="contract-form-fields">
          <label>Numéro de réservation <em>Obligatoire</em>
            <select name="reservation_id" required ${confirmables.length ? "" : "disabled"}>
              <option value="">${confirmables.length ? "Choisir une réservation confirmée" : "Aucune réservation confirmée disponible"}</option>
              ${confirmables.map(reservation => `<option value="${Number(reservation.id)}" ${Number(reservation.id) === Number(reservationPreselectionneeId) ? "selected" : ""}>RES-${String(reservation.id).padStart(4, "0")}</option>`).join("")}
            </select>
          </label>
          <label>Numéro de contrat
            <input value="Attribué automatiquement à la création" disabled>
          </label>
        </div>
      </section>

      <section class="contract-form-section reservation-summary" aria-live="polite">
        <h3><span>▤</span> Résumé de la réservation</h3>
        <div class="reservation-summary-fields">
          <label>Client<input data-summary="client" value="Sélectionnez une réservation" disabled></label>
          <label>Immatriculation<input data-summary="vehicle" value="—" disabled></label>
          <label>Date de début<input data-summary="start" value="—" disabled></label>
          <label>Date de fin<input data-summary="end" value="—" disabled></label>
        </div>
        <div class="reservation-summary-footer">
          <strong><span aria-hidden="true">▰</span> <span data-summary="vehicle-name">Véhicule</span></strong>
          <span class="confirmed-pill"><i></i> Réservation confirmée</span>
        </div>
      </section>

      <p class="contract-form-error" role="alert" hidden></p>
      <footer class="contract-wizard-actions">
        <button class="button button-primary" type="submit" disabled>➜ Créer et continuer</button>
      </footer>
    </form>
  `;

  document.body.append(boite);
  const form = boite.querySelector("form");
  const select = form.elements.reservation_id;
  const submit = form.querySelector('[type="submit"]');

  const mettreAJourResume = () => {
    const reservation = confirmables.find(item => Number(item.id) === Number(select.value));
    const vehicule = reservation
      ? vehicules.find(item => Number(item.id) === Number(reservation.vehicule_id))
      : null;
    form.querySelector('[data-summary="client"]').value = reservation?.client_id
      ? `Client #${reservation.client_id}` : "Sélectionnez une réservation";
    form.querySelector('[data-summary="vehicle"]').value = vehicule?.immatriculation || (reservation ? `Véhicule #${reservation.vehicule_id}` : "—");
    form.querySelector('[data-summary="start"]').value = afficherDate(reservation?.date_debut);
    form.querySelector('[data-summary="end"]').value = afficherDate(reservation?.date_fin);
    form.querySelector('[data-summary="vehicle-name"]').textContent = reservation
      ? `${vehicule?.marque || "Véhicule"} ${vehicule?.modele || `#${reservation.vehicule_id}`}`
      : "Véhicule";
    submit.disabled = !reservation;
  };

  select.addEventListener("change", mettreAJourResume);
  form.addEventListener("reset", () => requestAnimationFrame(mettreAJourResume));
  if (reservationPreselectionneeId) mettreAJourResume();
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const reservationId = Number(select.value);
    if (!reservationId) return;
    submit.disabled = true;
    submit.textContent = "Préparation…";
    try {
      const reservation = confirmables.find(item => Number(item.id) === reservationId);
      const vehicule = vehicules.find(item => Number(item.id) === Number(reservation?.vehicule_id));
      const contrat = brouillonExistant || brouillonsExistants.get(reservationId) || {
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
    } catch (error) {
      submit.disabled = false;
      submit.textContent = "➜ Créer et continuer";
      const message = form.querySelector(".contract-form-error");
      message.textContent = error.message || "La création du contrat a échoué.";
      message.hidden = false;
    }
  });
  boite.querySelector(".contract-wizard-close").addEventListener("click", () => boite.close());
  boite.addEventListener("click", event => {
    if (event.target === boite) boite.close();
  });
  boite.addEventListener("close", () => boite.remove(), { once: true });
  boite.showModal();
}
