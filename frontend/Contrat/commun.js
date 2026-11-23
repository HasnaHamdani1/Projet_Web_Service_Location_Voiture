const cleBrouillon = "parcAuto.contrat.brouillon";
const cleConfirmation = "parcAuto.contrat.confirmation";

const statutConnexion = document.querySelector(".rail-status");
if (statutConnexion && sessionStorage.getItem("adminToken")) {
  statutConnexion.hidden = false;
}

export const element = id => document.getElementById(id);

export function lireBrouillon() {
  try {
    return JSON.parse(sessionStorage.getItem(cleBrouillon));
  } catch {
    return null;
  }
}

export function enregistrerBrouillon(brouillon) {
  sessionStorage.setItem(cleBrouillon, JSON.stringify(brouillon));
}

export function effacerBrouillon() {
  sessionStorage.removeItem(cleBrouillon);
}

export function confirmerCreation(numero) {
  sessionStorage.setItem(cleConfirmation, numero);
}

export function lireConfirmation() {
  const numero = sessionStorage.getItem(cleConfirmation);
  sessionStorage.removeItem(cleConfirmation);
  return numero;
}

export function genererNumero() {
  const octets = crypto.getRandomValues(new Uint8Array(4));
  const suffixe = Array.from(octets, octet => octet.toString(16).padStart(2, "0")).join("").toUpperCase();
  return "CTR-" + new Date().getFullYear() + "-" + suffixe;
}

export function dateCourte(valeur) {
  const morceaux = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valeur));
  return morceaux ? [morceaux[3], morceaux[2], morceaux[1]].join("/") : "—";
}

export function nombreJours(debut, fin) {
  return Math.round((Date.parse(String(fin).slice(0, 10)) - Date.parse(String(debut).slice(0, 10))) / 86400000);
}

export function normaliserReservation(reservation, vehicules = new Map()) {
  reservation ??= {};
  const clientId = reservation.client?.id ?? reservation.client_id;
  const vehiculeId = reservation.vehicule?.id ?? reservation.vehicule_id;
  const vehicule = reservation.vehicule ?? vehicules.get(Number(vehiculeId)) ?? {};
  const prenomNom = [reservation.client?.prenom, reservation.client?.nom].filter(Boolean).join(" ");
  const marqueModele = [vehicule.marque, vehicule.modele].filter(Boolean).join(" ");
  const debut = reservation.debut ?? reservation.date_debut;
  const fin = reservation.fin ?? reservation.date_fin;
  const jours = reservation.duree_jours ?? nombreJours(debut, fin);
  const montant = reservation.montant_total ?? reservation.prix_total;
  const tarif = reservation.tarif_journalier ?? vehicule.prix_par_jour
    ?? (reservation.prix_total != null && jours > 0 ? Number(reservation.prix_total) / jours : null);
  return {
    id: Number(reservation.id),
    numero: reservation.numero ?? reservation.numero_reservation ?? "RES-" + String(reservation.id).padStart(4, "0"),
    statut: reservation.statut,
    client: reservation.client?.nom_complet || reservation.client_nom || prenomNom || (clientId ? "Client #" + clientId : "—"),
    email: reservation.client?.email,
    telephone: reservation.client?.telephone,
    vehicule: vehicule.libelle || reservation.vehicule_libelle || marqueModele || (vehiculeId ? "Véhicule #" + vehiculeId : "—"),
    immatriculation: vehicule.immatriculation || reservation.vehicule_immatriculation || reservation.immatriculation || "—",
    debut,
    fin,
    jours,
    montant,
    tarif,
    devise: reservation.devise || "MAD",
  };
}

export function montant(valeur, devise = "MAD") {
  if (valeur == null || !Number.isFinite(Number(valeur))) return "—";
  const monnaie = devise === "€" ? "EUR" : devise === "DH" ? "MAD" : devise;
  if (/^[A-Z]{3}$/.test(monnaie)) {
    return new Intl.NumberFormat("fr-MA", { style: "currency", currency: monnaie }).format(Number(valeur));
  }
  return new Intl.NumberFormat("fr-MA", { maximumFractionDigits: 2 }).format(Number(valeur)) + " " + monnaie;
}

export const libellesStatut = { EN_ATTENTE: "En attente", VALIDE: "Validé", CLOTURE: "Clôturé" };
export const libellesMode = { CARTE: "Carte bancaire", ESPECES: "Espèces", CHEQUE: "Chèque", VIREMENT: "Virement" };
export const libellesCaution = { RECUE: "Reçue", A_RECEVOIR: "En attente" };

export function afficherMessage(id, texte, erreur = false) {
  const cible = element(id);
  cible.textContent = texte;
  cible.hidden = !texte;
  cible.classList.toggle("error", erreur);
}

export function remplirFiche(id, champs) {
  const liste = element(id);
  liste.replaceChildren();
  champs.forEach(([libelle, valeur]) => {
    const groupe = document.createElement("div");
    const titre = document.createElement("dt");
    const contenu = document.createElement("dd");
    titre.textContent = libelle;
    contenu.textContent = valeur ?? "—";
    groupe.append(titre, contenu);
    liste.append(groupe);
  });
}
