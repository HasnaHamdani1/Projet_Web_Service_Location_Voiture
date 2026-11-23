import { consulterContrat, listerContrats, listerVehicules } from "./api.js";
import {
  afficherMessage, dateCourte, element, libellesCaution, libellesMode, libellesStatut,
  lireConfirmation, montant, normaliserReservation, remplirFiche,
} from "./commun.js";

const taillePage = 6;
const lignes = element("lignes");
const pagination = element("pagination");
const detail = element("detail");
let contrats = [];
let vehicules = new Map();
let page = 1;
let requeteDetail = 0;

function normaliserTexte(texte) {
  return String(texte ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function creerBouton(texte, action, classe = "button") {
  const bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = classe;
  bouton.textContent = texte;
  bouton.addEventListener("click", action);
  return bouton;
}

function afficherIndicateurs() {
  const maintenant = new Date();
  const mois = maintenant.getFullYear() + "-" + String(maintenant.getMonth() + 1).padStart(2, "0");
  const contratsDuMois = contrats.filter(contrat => contrat.date_generation?.startsWith(mois));
  const total = contratsDuMois.length;
  const chiffres = {
    "total-mois": total,
    "total-attente": contratsDuMois.filter(contrat => contrat.statut === "EN_ATTENTE").length,
    "total-valides": contratsDuMois.filter(contrat => contrat.statut === "VALIDE").length,
  };
  const moisAffiche = new Intl.DateTimeFormat("fr-MA", { month: "long", year: "numeric" }).format(maintenant);
  for (const [id, nombre] of Object.entries(chiffres)) {
    const compteur = element(id);
    compteur.textContent = nombre;
    const carte = compteur.closest(".stat");
    carte.querySelector(".mois").textContent = moisAffiche;
    carte.style.setProperty("--remplissage", (total ? nombre * 100 / total : 0) + "%");
  }
}

async function afficherDetail(id) {
  const operation = ++requeteDetail;
  element("donnees-detail").replaceChildren();
  afficherMessage("message-detail", "Chargement du détail…");
  detail.showModal();
  try {
    const contrat = await consulterContrat(id);
    if (operation !== requeteDetail || !detail.open) return;
    const reservation = normaliserReservation(contrat.reservation, vehicules);
    afficherMessage("message-detail", "");
    remplirFiche("donnees-detail", [
      ["N° contrat", contrat.numero_contrat], ["Statut", libellesStatut[contrat.statut]],
      ["Client", reservation.client], ["Véhicule", reservation.vehicule],
      ["Immatriculation", reservation.immatriculation],
      ["Période", dateCourte(contrat.periode_prise) + " → " + dateCourte(contrat.periode_fin)],
      ["Montant total", montant(contrat.montant_total, reservation.devise)],
      ["Caution", montant(contrat.montant_caution, reservation.devise)],
      ["Mode d’encaissement", libellesMode[contrat.mode_encaissement]],
      ["Statut de la caution", libellesCaution[contrat.statut_caution]],
      ["Date de validation", dateCourte(contrat.date_validation)],
      ["Date de clôture", dateCourte(contrat.date_cloture)],
      ["Conditions particulières", contrat.conditions_particulieres],
    ]);
  } catch (erreur) {
    if (operation === requeteDetail && detail.open) afficherMessage("message-detail", erreur.message, true);
  }
}

function cellule(ligne, contenu, classe) {
  const cellule = ligne.insertCell();
  if (classe) cellule.className = classe;
  if (contenu instanceof Node) cellule.append(contenu);
  else cellule.textContent = contenu;
  return cellule;
}

function afficherLigne(contrat, reservation) {
  const ligne = lignes.insertRow();
  cellule(ligne, creerBouton(contrat.numero_contrat, () => afficherDetail(contrat.id), "number-link"));
  cellule(ligne, reservation.client);
  const vehicule = cellule(ligne, reservation.immatriculation, "plate");
  const modele = document.createElement("small");
  modele.textContent = reservation.vehicule;
  vehicule.append(modele);
  cellule(ligne, dateCourte(contrat.periode_prise) + " → " + dateCourte(contrat.periode_fin));
  cellule(ligne, montant(contrat.montant_total, reservation.devise), "amount");
  const badge = document.createElement("span");
  badge.className = "badge " + (contrat.statut === "VALIDE" ? "confirmed" : contrat.statut === "EN_ATTENTE" ? "pending" : "closed");
  badge.textContent = libellesStatut[contrat.statut] ?? contrat.statut;
  cellule(ligne, badge);
  const action = creerBouton("Voir", () => afficherDetail(contrat.id), "button compact");
  action.setAttribute("aria-label", "Voir le contrat " + contrat.numero_contrat);
  cellule(ligne, action);
}

function rendrePagination(pages, total, premier, dernier) {
  element("compteur").textContent = total ? "Affichage de " + premier + " à " + dernier + " sur " + total : "0 contrat";
  pagination.replaceChildren();
  if (pages <= 1) return;
  const changer = numero => { page = numero; afficherListe(); };
  const precedent = creerBouton("Précédent", () => changer(page - 1), "button compact");
  precedent.disabled = page === 1;
  pagination.append(precedent);
  const numeros = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter(numero => numero >= 1 && numero <= pages).sort((a, b) => a - b);
  numeros.forEach((numero, indice) => {
    if (indice > 0 && numero - numeros[indice - 1] > 1) pagination.append("…");
    const bouton = creerBouton(numero, () => changer(numero), "button compact");
    if (numero === page) bouton.setAttribute("aria-current", "page");
    pagination.append(bouton);
  });
  const suivant = creerBouton("Suivant", () => changer(page + 1), "button compact");
  suivant.disabled = page === pages;
  pagination.append(suivant);
}

function afficherListe() {
  const recherche = normaliserTexte(element("recherche").value).trim();
  const statut = element("statut").value;
  const filtres = contrats
    .filter(contrat => !statut || contrat.statut === statut)
    .map(contrat => ({ contrat, reservation: normaliserReservation(contrat.reservation, vehicules) }))
    .filter(({ contrat, reservation }) => normaliserTexte([
      contrat.numero_contrat, reservation.client, reservation.immatriculation, reservation.vehicule,
    ].join(" ")).includes(recherche));

  const pages = Math.max(1, Math.ceil(filtres.length / taillePage));
  page = Math.min(page, pages);
  const debut = (page - 1) * taillePage;
  lignes.replaceChildren();
  filtres.slice(debut, debut + taillePage).forEach(({ contrat, reservation }) => afficherLigne(contrat, reservation));
  if (!filtres.length) {
    const vide = cellule(lignes.insertRow(), "Aucun contrat à afficher.", "empty");
    vide.colSpan = 7;
  }
  rendrePagination(pages, filtres.length, debut + 1, Math.min(debut + taillePage, filtres.length));
}

const numero = lireConfirmation();
if (numero) afficherMessage("confirmation", "Contrat " + numero + " enregistré et validé.");
try {
  [contrats, vehicules] = await Promise.all([listerContrats(), listerVehicules()]);
  if (!Array.isArray(contrats)) throw new Error("La liste des contrats est illisible.");
  contrats.sort((a, b) => b.id - a.id);
  afficherIndicateurs();
  afficherMessage("message", "");
  afficherListe();
  element("recherche").addEventListener("input", () => { page = 1; afficherListe(); });
  element("statut").addEventListener("change", () => { page = 1; afficherListe(); });
} catch (erreur) {
  afficherMessage("message", erreur.message, true);
}
