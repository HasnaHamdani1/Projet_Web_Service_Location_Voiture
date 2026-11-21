import { chargerFragment } from "./charger-fragment.js";
import {
  calculerIndicateursContrats,
  preparerPageContrats,
} from "../contrats-liste-modele.js";

const libelleStatut = statut => ({
  EN_ATTENTE: "En attente",
  VALIDE: "Validé",
  CLOTURE: "Clôturé",
  ANNULE: "Annulé",
  ANNULEE: "Annulée",
}[statut] || statut || "Inconnu");

const formatDate = valeur => {
  if (!valeur) return "—";
  const date = new Date(`${valeur}T00:00:00`);
  return Number.isNaN(date.getTime()) ? valeur : date.toLocaleDateString("fr-FR");
};

const definirTexte = (parent, selecteur, valeur) => {
  parent.querySelector(selecteur).textContent = valeur ?? "—";
};

export async function afficherListeContrats(conteneur, contrats, vehicules = []) {
  const taillePage = 6;
  let pageActuelle = 1;
  let recherche = "";
  let statutChoisi = "";

  await chargerFragment(conteneur, "liste-contrats.html");

  const indicateurs = calculerIndicateursContrats(contrats);
  conteneur.querySelectorAll("[data-kpi-month]").forEach(element => {
    element.textContent = indicateurs.moisLibelle;
  });
  definirTexte(conteneur, "[data-kpi-month-count]", indicateurs.contratsCeMois);
  definirTexte(conteneur, "[data-kpi-pending-count]", indicateurs.enAttente);
  definirTexte(conteneur, "[data-kpi-valid-count]", indicateurs.valides);
  conteneur.querySelector("[data-kpi-month-bar]").style.width =
    `${Math.round(indicateurs.contratsCeMois * 100 / indicateurs.maximum)}%`;
  conteneur.querySelector("[data-kpi-pending-bar]").style.width =
    `${Math.round(indicateurs.enAttente * 100 / indicateurs.maximum)}%`;
  conteneur.querySelector("[data-kpi-valid-bar]").style.width =
    `${Math.round(indicateurs.valides * 100 / indicateurs.maximum)}%`;

  const filtreStatut = conteneur.querySelector("#filtre-statut");
  indicateurs.statuts.forEach(statut => {
    const option = document.createElement("option");
    option.value = statut;
    option.textContent = libelleStatut(statut);
    filtreStatut.append(option);
  });

  function afficherPage() {
    const resultat = preparerPageContrats({
      contrats,
      vehicules,
      recherche,
      statut: statutChoisi,
      page: pageActuelle,
      taille: taillePage,
    });
    pageActuelle = resultat.pageCourante;

    const tableZone = conteneur.querySelector("#table-contrats");
    const tbody = tableZone.querySelector("#lignes-contrats");
    const modeleLigne = conteneur.querySelector("#modele-ligne-contrat");
    const lignes = document.createDocumentFragment();

    resultat.lignes.forEach(({ contrat, vehicule, vehiculeTexte, client }) => {
      const ligne = modeleLigne.content.cloneNode(true);
      definirTexte(ligne, '[data-champ="numero"]', contrat.numero_contrat);
      definirTexte(ligne, '[data-champ="client"]', client);
      definirTexte(ligne, '[data-champ="immatriculation"]', vehiculeTexte);
      definirTexte(ligne, '[data-champ="vehicule"]', vehicule
        ? `${vehicule.marque || ""} ${vehicule.modele || ""}`.trim()
        : "");
      ligne.querySelector('[data-champ="vehicule"]').hidden = !vehicule;
      definirTexte(ligne, '[data-champ="date-debut"]', formatDate(contrat.periode_prise));
      definirTexte(ligne, '[data-champ="date-fin"]', formatDate(contrat.periode_fin));
      definirTexte(ligne, '[data-champ="montant"]', Number(contrat.montant_total || 0).toFixed(2));

      const badge = ligne.querySelector('[data-champ="statut"]');
      badge.textContent = libelleStatut(contrat.statut);
      const statutClasse = String(contrat.statut || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
      badge.classList.add(`status-${statutClasse}`);

      const boutonDetail = ligne.querySelector('[data-action="detail"]');
      boutonDetail.dataset.detail = String(Number(contrat.id));
      boutonDetail.addEventListener("click", () => afficherDetail(contrat));
      lignes.append(ligne);
    });

    tbody.replaceChildren(lignes);
    tableZone.querySelector(".table-wrap").hidden = resultat.lignes.length === 0;
    tableZone.querySelector(".empty-state").hidden = resultat.lignes.length > 0;

    definirTexte(conteneur, "#pagination-resume",
      `Affichage de ${resultat.premiereLigne} à ${resultat.derniereLigne} sur ${resultat.totalFiltres} contrats`);
    definirTexte(conteneur, "#page-actuelle", resultat.pageCourante);
    definirTexte(conteneur, "#nombre-pages", resultat.nombrePages);

    const boutonPrecedent = conteneur.querySelector('[data-page="precedente"]');
    const boutonSuivant = conteneur.querySelector('[data-page="suivante"]');
    boutonPrecedent.disabled = pageActuelle <= 1;
    boutonSuivant.disabled = pageActuelle >= resultat.nombrePages;
  }

  function afficherDetail(contrat) {
    const dialogue = conteneur.querySelector("#detail-contrat");
    definirTexte(dialogue, '[data-detail="numero"]', contrat.numero_contrat);
    definirTexte(dialogue, '[data-detail="reservation"]', `#${Number(contrat.reservation_id)}`);
    definirTexte(dialogue, '[data-detail="periode"]',
      `${formatDate(contrat.periode_prise)} → ${formatDate(contrat.periode_fin)}`);
    definirTexte(dialogue, '[data-detail="montant"]',
      `${Number(contrat.montant_total || 0).toFixed(2)} MAD`);
    definirTexte(dialogue, '[data-detail="caution"]', contrat.montant_caution == null
      ? "Non enregistrée"
      : `${Number(contrat.montant_caution).toFixed(2)} MAD`);
    definirTexte(dialogue, '[data-detail="statut"]', libelleStatut(contrat.statut));
    dialogue.showModal();
  }

  conteneur.querySelector("#recherche-contrat").addEventListener("input", event => {
    recherche = event.currentTarget.value.trim().toLowerCase();
    pageActuelle = 1;
    afficherPage();
  });
  filtreStatut.addEventListener("change", () => {
    statutChoisi = filtreStatut.value;
    pageActuelle = 1;
    afficherPage();
  });
  conteneur.querySelector('[data-page="precedente"]').addEventListener("click", () => {
    if (pageActuelle > 1) { pageActuelle--; afficherPage(); }
  });
  conteneur.querySelector('[data-page="suivante"]').addEventListener("click", () => {
    pageActuelle++;
    afficherPage();
  });
  conteneur.querySelector("#fermer-detail-contrat").addEventListener("click", () =>
    conteneur.querySelector("#detail-contrat").close());

  afficherPage();
}
