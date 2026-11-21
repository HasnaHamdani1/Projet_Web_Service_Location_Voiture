import { creerGestionContrats } from "./contrats.js";

const ports = { vehicle: 8001, reservation: 8002, contract: 8003 };
const nomsServices = { vehicle: "Véhicule", reservation: "Réservation", contract: "Contrat" };

async function request(service, path, options = {}) {
  const apiUrl = new URL(window.location.origin);
  apiUrl.port = ports[service];
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");

  let response;
  try {
    response = await fetch(new URL(path, apiUrl), { ...options, headers });
  } catch {
    throw new Error(`Le service ${nomsServices[service]} est inaccessible.`);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    throw new Error(typeof detail === "string" ? detail : `Erreur du service ${nomsServices[service]} (${response.status}).`);
  }
  return data;
}

const toast = document.querySelector("#toast");
let masquerNotification;
function notify(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  clearTimeout(masquerNotification);
  masquerNotification = setTimeout(() => toast.classList.remove("show"), 3600);
}

const vehicules = request("vehicle", "/vehicules", { signal: AbortSignal.timeout(3000) })
  .then(data => Array.isArray(data) ? data : [])
  .catch(() => []);
const gestion = creerGestionContrats({ request, notify, obtenirVehicules: () => vehicules });
const boutonNouveau = document.querySelector("#new-contract-button");
boutonNouveau.addEventListener("click", async () => {
  boutonNouveau.disabled = true;
  try {
    await gestion.ouvrirNouveauContrat();
  } finally {
    boutonNouveau.disabled = false;
  }
});

gestion.chargerListe();
