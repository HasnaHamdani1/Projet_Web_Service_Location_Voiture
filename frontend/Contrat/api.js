// Adresses de développement. Une URL peut aussi pointer vers la passerelle de l’équipe.
// Par défaut : même machine que la page (config.js du frontend commun, sinon hôte de la page).
const origine = `${location.protocol}//${location.hostname}`;
const cfg = window.APP_CONFIG || {};
const configuration = {
  contrats: cfg.contract || `${origine}:8003`,
  reservations: `${cfg.reservation || `${origine}:8002`}/reservations`,
  vehicules: `${cfg.vehicle || `${origine}:8005`}/vehicules`,
};

async function requete(url, options = {}) {
  const headers = { Accept: "application/json" };
  if (options.body) headers["Content-Type"] = "application/json";
  let reponse;
  try {
    reponse = await fetch(url, { ...options, headers, signal: options.signal || AbortSignal.timeout(15000) });
  } catch {
    throw new Error("Impossible de joindre " + url + ". Vérifie que le service tourne et que Live Server est autorisé.");
  }

  const data = await reponse.json().catch(() => null);
  if (!reponse.ok) {
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map(erreur => (erreur.loc?.at(-1) || "champ") + " " + erreur.msg).join(" · ")
      : detail;
    throw new Error(message || "Le service a répondu avec le code " + reponse.status + ".");
  }
  return data;
}

export function listerContrats() {
  return requete(configuration.contrats + "/contrats");
}

export function consulterContrat(id) {
  return requete(configuration.contrats + "/contrats/" + encodeURIComponent(id));
}

export async function listerReservations() {
  const url = new URL(configuration.reservations, window.location.href);
  const data = await requete(url);
  if (Array.isArray(data)) return data;
  if (!Array.isArray(data?.items)) throw new Error("La liste des réservations est illisible.");
  const reservations = [...data.items];
  for (let page = Number(data.page || 1) + 1; page <= Number(data.pages); page++) {
    url.searchParams.set("page", page);
    const suite = await requete(url);
    if (!Array.isArray(suite?.items)) throw new Error("Une page de réservations est illisible.");
    reservations.push(...suite.items);
  }
  return reservations;
}

export async function listerVehicules() {
  try {
    const data = await requete(configuration.vehicules, { signal: AbortSignal.timeout(3000) });
    return new Map((Array.isArray(data) ? data : data?.items || []).map(vehicule => [
      Number(vehicule.id), vehicule,
    ]));
  } catch {
    return new Map();
  }
}

export function finaliserContrat(brouillon) {
  return requete(configuration.contrats + "/contrats/finalisation", {
    method: "POST",
    body: JSON.stringify({
      reservation_id: brouillon.reservation.id,
      numero_contrat: brouillon.numero,
      montant_caution: brouillon.caution.montant,
      mode_encaissement: brouillon.caution.mode,
      statut_caution: brouillon.caution.statut,
      conditions_particulieres: brouillon.caution.conditions || null,
      signatures_confirmees: true,
    }),
  });
}
