import { chargerFragment } from "./charger-fragment.js";

const dateFr = valeur => {
  if (!valeur) return "—";
  const date = new Date(`${valeur}T00:00:00`);
  return Number.isNaN(date.getTime()) ? valeur : date.toLocaleDateString("fr-FR");
};

export async function ouvrirFormulaireDetails(
  contrat,
  reservation,
  vehicule,
  enregistrerCaution,
  revenirIdentification,
  continuerValidation,
  retourListe,
) {
  const boite = document.createElement("dialog");
  boite.className = "contract-wizard contract-details-wizard";
  boite.setAttribute("aria-label", "Formulaire de détails du contrat");
  await chargerFragment(boite, "formulaire-details.html");

  const debut = reservation?.date_debut || contrat.periode_prise;
  const fin = reservation?.date_fin || contrat.periode_fin;
  const jours = debut && fin
    ? Math.max(1, Math.round((new Date(`${fin}T00:00:00`) - new Date(`${debut}T00:00:00`)) / 86400000))
    : 0;
  const valeurs = {
    numero: contrat.numero_contrat,
    immatriculation: vehicule?.immatriculation || `Véhicule #${reservation?.vehicule_id ?? "—"}`,
    client: reservation?.client_id ? `Client #${Number(reservation.client_id)}` : "—",
    debut: dateFr(debut),
    fin: dateFr(fin),
    jours: `${jours} jour${jours > 1 ? "s" : ""}`,
    prix: `${Number(vehicule?.prix_par_jour || 0).toFixed(2)} DH`,
    total: `${Number(contrat.montant_total || 0).toFixed(2)} DH`,
  };
  for (const [nom, valeur] of Object.entries(valeurs)) {
    boite.querySelector(`[data-contract="${nom}"]`).value = valeur;
  }

  document.body.append(boite);
  const form = boite.querySelector(".deposit-form");
  const boutonSuivant = form.querySelector('[type="submit"]');
  let actionRetour = false;
  let actionContinuer = false;
  const fermer = () => boite.close();
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
