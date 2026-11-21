const echapper = valeur =>
  String(valeur ?? "").replace(/[&<>"']/g, caractere => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[caractere]));

const dateFr = valeur => {
  if (!valeur) return "—";
  const date = new Date(`${valeur}T00:00:00`);
  return Number.isNaN(date.getTime()) ? valeur : date.toLocaleDateString("fr-FR");
};

export function ouvrirFormulaireValidation(contrat, reservation, vehicule, client, administrateur, finaliserContrat, retourListe) {
  const boite = document.createElement("dialog");
  boite.className = "contract-wizard contract-validation-wizard";
  boite.setAttribute("aria-label", "Validation et signatures du contrat");

  boite.innerHTML = `
    <div class="contract-wizard-header">
      <button class="contract-wizard-close" type="button" aria-label="Fermer">×</button>
    </div>
    <div class="contract-steps" aria-label="Étape 3 sur 3">
      <div class="contract-step"><b>1</b><span><strong>Réservation</strong><small>Identification</small></span></div>
      <div class="contract-step"><b>2</b><span><strong>Détails &amp; caution</strong><small>Montant et conditions</small></span></div>
      <div class="contract-step active"><b>3</b><span><strong>Validation</strong><small>Impression &amp; signatures</small></span></div>
    </div>
    <article class="contract-pdf-document">
      <header class="pdf-document-heading">
        <div class="pdf-brand"><span>P</span><strong>PARC AUTO</strong></div>
        <div class="pdf-document-title"><p>CONTRAT DE LOCATION DE VÉHICULE</p></div>
      </header>
      <section class="pdf-section">
        <h3>1. Identification des parties</h3>
        <div class="pdf-two-columns">
          <div><h4>Le client</h4><p><b>Nom :</b> ${echapper(client?.nom || `Client #${Number(reservation?.client_id || 0)}`)}</p><p><b>E-mail :</b> ${echapper(client?.email || "—")}</p><p><b>Téléphone :</b> ${echapper(client?.telephone || "—")}</p></div>
          <div><h4>L’agence de location</h4><p><b>Agence :</b> Parc Auto</p></div>
        </div>
      </section>
      <section class="pdf-section">
        <h3>2. Véhicule et période de location</h3>
        <div class="validation-summary">
          <div><small>Véhicule</small><strong>${echapper(`${vehicule?.marque || "Véhicule"} ${vehicule?.modele || ""}`.trim())}</strong></div>
          <div><small>Immatriculation</small><strong>${echapper(vehicule?.immatriculation || `Véhicule #${reservation?.vehicule_id ?? "—"}`)}</strong></div>
          <div><small>Date de prise</small><strong>${echapper(dateFr(contrat.periode_prise))}</strong></div>
          <div><small>Date de fin</small><strong>${echapper(dateFr(contrat.periode_fin))}</strong></div>
          <div><small>Montant total</small><strong>${Number(contrat.montant_total || 0).toFixed(2)} MAD</strong></div>
          <div><small>Caution</small><strong>${contrat.montant_caution == null ? "À enregistrer" : `${Number(contrat.montant_caution).toFixed(2)} MAD`}</strong></div>
        </div>
      </section>
      <section class="pdf-section pdf-signatures">
        <h3>3. Signatures</h3>
        <p>Les parties déclarent avoir pris connaissance des informations de location indiquées dans le présent contrat.</p>
        <div class="signature-blocks">
          <div><strong>Signature du client</strong><span></span><small>Date : ____________________</small></div>
          <div><strong>Signature du représentant de l’agence</strong><span></span><small>Date : ____________________</small></div>
        </div>
      </section>
    </article>
    <section class="contract-finish-panel">
      <button class="button button-outline" type="button" data-print>▣ Imprimer le contrat</button>
      <label class="signature-confirmation">
        <input type="checkbox" data-signatures>
        <span class="signature-confirmation-icon" aria-hidden="true">✓</span>
        <span>Je confirme que le contrat a été imprimé et signé par le client et le représentant de l’agence.</span>
      </label>
    </section>
    <p class="contract-form-error" role="alert" hidden></p>
    <footer class="contract-wizard-actions">
      <button class="contract-reset" type="button">← Retour à la liste</button>
      <div class="validation-actions">
        <button class="button button-primary" type="button" data-finish disabled>Terminer</button>
      </div>
    </footer>
  `;

  document.body.append(boite);
  const fermer = () => boite.close();
  boite.querySelector(".contract-wizard-close").addEventListener("click", fermer);
  boite.querySelector(".contract-wizard-actions > .contract-reset").addEventListener("click", fermer);
  const confirmationSignatures = boite.querySelector("[data-signatures]");
  const boutonTerminer = boite.querySelector("[data-finish]");
  boite.querySelector("[data-print]").addEventListener("click", () => {
    const ancienTitre = document.title;
    document.title = `Contrat_${contrat.numero_contrat}`;
    window.addEventListener("afterprint", () => {
      document.title = ancienTitre;
    }, { once: true });
    window.print();
  });
  confirmationSignatures.addEventListener("change", () => {
    boutonTerminer.disabled = !confirmationSignatures.checked;
  });
  boutonTerminer.addEventListener("click", async () => {
    if (!confirmationSignatures.checked) return;
    boutonTerminer.disabled = true;
    boutonTerminer.textContent = "Finalisation…";
    try {
      Object.assign(contrat, await finaliserContrat(contrat));
      boite.close();
      retourListe?.();
    } catch (error) {
      boutonTerminer.disabled = false;
      boutonTerminer.textContent = "Terminer";
      const message = boite.querySelector(".contract-form-error");
      message.textContent = error.message || "La finalisation du contrat a échoué.";
      message.hidden = false;
    }
  });
  boite.addEventListener("click", event => { if (event.target === boite) fermer(); });
  boite.addEventListener("close", () => boite.remove(), { once: true });
  boite.showModal();
}
