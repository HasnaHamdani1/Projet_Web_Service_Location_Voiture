import { chargerFragment } from "./charger-fragment.js";

const dateFr = valeur => {
  if (!valeur) return "—";
  const date = new Date(`${valeur}T00:00:00`);
  return Number.isNaN(date.getTime()) ? valeur : date.toLocaleDateString("fr-FR");
};

const afficher = (boite, nom, valeur) => {
  boite.querySelector(`[data-contract="${nom}"]`).textContent = String(valeur ?? "—");
};

export async function ouvrirFormulaireValidation(
  contrat,
  reservation,
  vehicule,
  finaliserContrat,
  retourListe,
) {
  const boite = document.createElement("dialog");
  boite.className = "contract-wizard contract-validation-wizard";
  boite.setAttribute("aria-label", "Validation et signatures du contrat");
  await chargerFragment(boite, "formulaire-validation.html");

  const clientId = reservation?.client_id;
  afficher(boite, "client-reference", clientId ? `#${clientId}` : "—");
  afficher(boite, "vehicule", `${vehicule?.marque || "Véhicule"} ${vehicule?.modele || ""}`.trim());
  afficher(boite, "immatriculation", vehicule?.immatriculation || `Véhicule #${reservation?.vehicule_id ?? "—"}`);
  afficher(boite, "debut", dateFr(contrat.periode_prise));
  afficher(boite, "fin", dateFr(contrat.periode_fin));
  afficher(boite, "total", `${Number(contrat.montant_total || 0).toFixed(2)} MAD`);
  afficher(boite, "caution", contrat.montant_caution == null
    ? "À enregistrer" : `${Number(contrat.montant_caution).toFixed(2)} MAD`);

  document.body.append(boite);
  const fermer = () => boite.close();
  boite.querySelector(".contract-wizard-close").addEventListener("click", fermer);
  boite.querySelector(".contract-wizard-actions > .contract-reset").addEventListener("click", fermer);
  const confirmationSignatures = boite.querySelector("[data-signatures]");
  const boutonTerminer = boite.querySelector("[data-finish]");
  boite.querySelector("[data-print]").addEventListener("click", () => {
    const ancienTitre = document.title;
    document.title = `Contrat_${contrat.numero_contrat}`;
    window.addEventListener("afterprint", () => { document.title = ancienTitre; }, { once: true });
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
