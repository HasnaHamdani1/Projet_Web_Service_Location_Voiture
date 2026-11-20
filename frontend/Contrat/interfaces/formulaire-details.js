const echapper = valeur =>
  String(valeur ?? "").replace(/[&<>"']/g, caractere => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[caractere]));

const dateFr = valeur => {
  if (!valeur) return "—";
  const date = new Date(`${valeur}T00:00:00`);
  return Number.isNaN(date.getTime()) ? valeur : date.toLocaleDateString("fr-FR");
};

export function ouvrirFormulaireDetails(contrat, reservation, vehicule, enregistrerCaution, revenirIdentification, continuerValidation, retourListe) {
  const boite = document.createElement("dialog");
  boite.className = "contract-wizard contract-details-wizard";
  boite.setAttribute("aria-label", "Formulaire de détails du contrat");

  const debut = reservation?.date_debut || contrat.periode_prise;
  const fin = reservation?.date_fin || contrat.periode_fin;
  const jours = debut && fin
    ? Math.max(1, Math.round((new Date(`${fin}T00:00:00`) - new Date(`${debut}T00:00:00`)) / 86400000))
    : 0;

  boite.innerHTML = `
    <div class="contract-wizard-header">
      <button class="contract-wizard-close" type="button" aria-label="Fermer">×</button>
    </div>
    <div class="contract-steps" aria-label="Étape 2 sur 3">
      <div class="contract-step"><b>1</b><span><strong>Réservation</strong><small>Identification</small></span></div>
      <div class="contract-step active"><b>2</b><span><strong>Détails &amp; caution</strong><small>Montant et conditions</small></span></div>
      <div class="contract-step"><b>3</b><span><strong>Validation</strong><small>Impression &amp; signatures</small></span></div>
    </div>

    <section class="contract-form-section">
      <h3><span>▤</span> Informations du contrat</h3>
      <div class="details-fields">
        <label>Numéro de contrat<input value="${echapper(contrat.numero_contrat)}" disabled></label>
        <label>Immatriculation<input value="${echapper(vehicule?.immatriculation || `Véhicule #${reservation?.vehicule_id ?? "—"}`)}" disabled></label>
        <label>Client<input value="${reservation?.client_id ? `Client #${Number(reservation.client_id)}` : "—"}" disabled></label>
        <label>Date de prise<input value="${echapper(dateFr(debut))}" disabled></label>
        <label>Date de fin<input value="${echapper(dateFr(fin))}" disabled></label>
        <label>Nombre de jours<input value="${jours} jour${jours > 1 ? "s" : ""}" disabled></label>
        <label>Prix par jour (MAD)<input value="${Number(vehicule?.prix_par_jour || 0).toFixed(2)} DH" disabled></label>
        <label>Montant total (MAD)<input class="contract-total" value="${Number(contrat.montant_total || 0).toFixed(2)} DH" disabled></label>
      </div>
    </section>

    <form class="contract-identification-form deposit-form">
      <section class="contract-form-section">
        <h3><span>♢</span> Caution</h3>
        <div class="deposit-fields">
          <label>Montant de la caution (MAD)
            <input name="montant_caution" type="number" min="0.01" step="0.01" placeholder="Ex. 500,00" required>
          </label>
          <label>Mode d’encaissement
            <select name="mode_encaissement"><option>Carte bancaire</option><option>Espèces</option><option>Chèque</option><option>Virement</option></select>
          </label>
          <label>Statut de la caution
            <select name="statut_caution"><option>Reçue</option><option>À recevoir</option></select>
          </label>
        </div>
        <label class="contract-conditions">Conditions particulières
          <textarea name="conditions" rows="3">Kilométrage illimité. Conducteur additionnel non autorisé.</textarea>
        </label>
      </section>
      <p class="contract-form-error" role="alert" hidden></p>
      <footer class="contract-wizard-actions">
        <button class="contract-reset" type="button">← Retour</button>
        <button class="button button-primary" type="submit">➜ Suivant</button>
      </footer>
    </form>
  `;

  document.body.append(boite);
  const form = boite.querySelector(".deposit-form");
  const boutonSuivant = form.querySelector('[type="submit"]');
  let actionRetour = false;
  let actionContinuer = false;
  const fermer = () => { boite.close(); };
  boite.querySelector(".contract-wizard-close").addEventListener("click", fermer);
  form.querySelector('[type="button"]').addEventListener("click", () => {
    actionRetour = true;
    fermer();
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const montant = Number(new FormData(form).get("montant_caution"));
    if (!Number.isFinite(montant) || montant <= 0) return;
    boutonSuivant.disabled = true;
    boutonSuivant.textContent = "Préparation…";
    try {
      Object.assign(contrat, await enregistrerCaution(contrat, montant));
      actionContinuer = true;
      boite.close();
    } catch (error) {
      boutonSuivant.disabled = false;
      boutonSuivant.textContent = "➜ Suivant";
      const message = form.querySelector(".contract-form-error");
      message.textContent = error.message || "Impossible d’enregistrer la caution.";
      message.hidden = false;
    }
  });
  boite.addEventListener("click", event => { if (event.target === boite) fermer(); });
  boite.addEventListener("close", () => {
    boite.remove();
    if (actionRetour) revenirIdentification?.();
    else if (actionContinuer) continuerValidation?.(contrat);
    else retourListe?.();
  }, { once: true });
  boite.showModal();
}
