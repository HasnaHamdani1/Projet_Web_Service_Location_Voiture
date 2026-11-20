const apiBase = window.APP_CONFIG;
const state = {token: sessionStorage.getItem("access_token"), user: null, vehicles: [], reservations: JSON.parse(sessionStorage.getItem("created_reservations") || "[]")};
const $ = (selector, root = document) => root.querySelector(selector);
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));

async function request(service, path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (state.token) headers.set("Authorization", `Bearer ${state.token}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let response;
  try {
    response = await fetch(`${apiBase[service]}${path}`, {...options, headers});
  } catch {
    throw new Error("Service inaccessible. Vérifiez que Compose est démarré et que les API sont disponibles.");
  }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.detail || `Erreur HTTP ${response.status}`);
  return data;
}

function notify(message, isError = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove("show"), 3600);
}

function setMessage(selector, message, kind = "") {
  const node = $(selector);
  node.textContent = message;
  node.className = `form-message ${kind}`;
}

function statusBadge(value) {
  return `<span class="status status-${escapeHtml(value)}">${escapeHtml(value)}</span>`;
}

async function checkHealth() {
  const nodes = ["auth", "vehicle", "reservation", "contract"];
  const statuses = await Promise.all(nodes.map(async service => {
    try { await fetch(`${apiBase[service]}/health`, {signal: AbortSignal.timeout(2200)}); return true; }
    catch { return false; }
  }));
  const good = statuses.every(Boolean);
  const badge = $("#connection-status");
  badge.className = `connection ${good ? "online" : "offline"}`;
  badge.innerHTML = `<i></i>${good ? "Services connectés" : "Certains services sont indisponibles"}`;
}

async function showSignedIn() {
  $("#auth-section").hidden = true;
  $("#app-section").hidden = false;
  $("#logout-button").hidden = false;
  $("#welcome-title").textContent = `Bonjour ${state.user.nom}`;
  const estAdministrateur = state.user.role === "ADMINISTRATEUR";
  document.body.classList.toggle("admin-contract-mode", estAdministrateur);
  $("#role-badge").textContent = estAdministrateur ? "Administrateur" : "Client";
  $("#app-section").classList.toggle("admin-view", estAdministrateur);
  $("#admin-sidebar").hidden = !estAdministrateur;
  $("#admin-reservations").hidden = true;
  $("#vehicules").hidden = estAdministrateur;
  $("#my-reservations").hidden = state.user.role !== "CLIENT";
  await loadVehicles();
  await loadContracts();
  renderMyReservations();
}

async function loadProfile() {
  state.user = await request("auth", "/auth/me");
  await showSignedIn();
}

async function loadVehicles() {
  const grid = $("#vehicle-grid");
  grid.innerHTML = "<div class='loading-card'>Chargement des véhicules…</div>";
  try {
    state.vehicles = await request("vehicle", "/vehicules");
    renderVehicles();
  } catch (error) {
    grid.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

function renderVehicles() {
  const grid = $("#vehicle-grid");
  if (!state.vehicles.length) { grid.innerHTML = "<div class='empty-state'>Aucun véhicule disponible.</div>"; return; }
  grid.innerHTML = state.vehicles.map(car => {
    const available = car.statut === "DISPONIBLE";
    return `<article class="vehicle-card">
      <div class="vehicle-visual"><span class="vehicle-number">${escapeHtml(car.immatriculation)}</span><span class="wheel wheel-one"></span><span class="wheel wheel-two"></span></div>
      <div class="vehicle-body"><div class="vehicle-meta"><div><h3 class="vehicle-name">${escapeHtml(car.marque)} ${escapeHtml(car.modele)}</h3><span class="vehicle-year">${escapeHtml(car.annee || "")}</span></div><span class="vehicle-price">${Number(car.prix_par_jour).toFixed(2)} / jour</span></div>
      ${available ? `<form class="vehicle-booking" data-book="${Number(car.id)}"><label>Début<input name="date_debut" type="date" min="${todayISO()}" required></label><label>Fin<input name="date_fin" type="date" min="${todayISO()}" required></label><button class="button button-primary" type="submit">Réserver</button></form>` : `<div class="vehicle-disabled">${escapeHtml(car.statut || "Indisponible")}</div>`}
      </div></article>`;
  }).join("");
  grid.querySelectorAll("form[data-book]").forEach(form => form.addEventListener("submit", createReservation));
}

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

async function createReservation(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  if (values.date_fin <= values.date_debut) return notify("La date de fin doit suivre la date de début.", true);
  const button = $("button[type=submit]", form);
  button.disabled = true;
  try {
    const result = await request("reservation", "/reservations", {
      method: "POST",
      body: JSON.stringify({client_id: state.user.id, vehicule_id: Number(form.dataset.book), ...values}),
    });
    state.reservations.unshift(result.reservation);
    sessionStorage.setItem("created_reservations", JSON.stringify(state.reservations));
    renderMyReservations();
    notify(`Réservation #${result.reservation.id} créée. Simulez le paiement pour la confirmer.`);
  } catch (error) {
    notify(error.message, true);
  } finally { button.disabled = false; }
}

function renderMyReservations() {
  const list = $("#my-reservation-list");
  if (!state.reservations.length) { list.innerHTML = "<div class='empty-state'>Vos nouvelles réservations apparaîtront ici.</div>"; return; }
  list.innerHTML = state.reservations.map(reservation => `<article class="reservation-card">
    <div class="card-top"><div><h3 class="card-title">Réservation #${Number(reservation.id)}</h3><p class="card-detail">${escapeHtml(reservation.date_debut)} → ${escapeHtml(reservation.date_fin)}</p><p class="card-detail">Total : ${Number(reservation.prix_total).toFixed(2)}</p></div>${statusBadge(reservation.statut)}</div>
    <div class="card-actions">${reservation.statut === "EN_ATTENTE" ? `<button class="mini-button" data-pay="${Number(reservation.id)}">Confirmer le paiement simulé</button>` : ""}</div>
  </article>`).join("");
  list.querySelectorAll("[data-pay]").forEach(button => button.addEventListener("click", payReservation));
}

async function payReservation(event) {
  const button = event.currentTarget;
  const id = Number(button.dataset.pay);
  button.disabled = true;
  try {
    const result = await request("reservation", `/reservations/${id}/paiement`, {method: "POST", body: JSON.stringify({paiement_reussi: true})});
    const index = state.reservations.findIndex(item => Number(item.id) === id);
    if (index >= 0) state.reservations[index] = result.reservation;
    sessionStorage.setItem("created_reservations", JSON.stringify(state.reservations));
    renderMyReservations();
    notify("Paiement simulé confirmé.");
  } catch (error) { notify(error.message, true); button.disabled = false; }
}

async function loadAdminReservations() {
  const list = $("#reservation-list");
  try {
    const reservations = await request("reservation", "/reservations");
    if (!reservations.length) { list.innerHTML = "<p class='empty-state'>Aucune réservation.</p>"; return; }
    list.innerHTML = `<table><thead><tr><th>ID</th><th>Client</th><th>Véhicule</th><th>Période</th><th>Montant</th><th>Statut</th><th>Action</th></tr></thead><tbody>${reservations.map(row => `<tr><td>#${Number(row.id)}</td><td>${Number(row.client_id)}</td><td>${Number(row.vehicule_id)}</td><td>${escapeHtml(row.date_debut)} → ${escapeHtml(row.date_fin)}</td><td>${Number(row.prix_total).toFixed(2)}</td><td>${statusBadge(row.statut)}</td><td>${row.statut === "CONFIRMEE" ? `<button class="mini-button" data-create-contract="${Number(row.id)}">Créer contrat</button>` : "—"}</td></tr>`).join("")}</tbody></table>`;
    list.querySelectorAll("[data-create-contract]").forEach(button => button.addEventListener("click", createContract));
  } catch (error) { list.innerHTML = `<p class='empty-state'>${escapeHtml(error.message)}</p>`; }
}

async function createContract(event) {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await request("contract", "/contrats", {method: "POST", body: JSON.stringify({reservation_id: Number(button.dataset.createContract)})});
    notify("Contrat créé en attente. Enregistrez la caution avant la signature.");
    await loadContracts();
  } catch (error) { notify(error.message, true); button.disabled = false; }
}

async function loadContracts() {
  const list = $("#contract-list");

  try {
    const contracts = await request("contract", "/contrats");

    const { afficherListeContrats } =
      await import("./Contrat/interfaces/liste-contrats.js");

    afficherListeContrats(list, contracts, state.vehicles);
  } catch (error) {
    list.innerHTML =
      `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

async function recordDeposit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const amount = Number(new FormData(form).get("montant_caution"));
  try {
    await request("contract", `/contrats/${form.dataset.deposit}/caution`, {method: "POST", body: JSON.stringify({montant_caution: amount})});
    notify("Caution enregistrée.");
    loadContracts();
  } catch (error) { notify(error.message, true); }
}

async function validateContract(event) {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await request("contract", `/contrats/${button.dataset.sign}/validation`, {method: "POST"});
    notify("Contrat signé et validé.");
    loadContracts();
  } catch (error) { notify(error.message, true); button.disabled = false; }
}

$("#login-form").addEventListener("submit", async event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const token = await request("auth", "/auth/token", {method: "POST", body: JSON.stringify(values)});
    state.token = token.access_token;
    sessionStorage.setItem("access_token", state.token);
    await loadProfile();
  } catch (error) { setMessage("#login-message", error.message, "error"); }
});

$("#register-form").addEventListener("submit", async event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(event.currentTarget));
  try {
    await request("auth", "/auth/inscription", {method: "POST", body: JSON.stringify(values)});
    setMessage("#register-message", "Compte créé. Vous pouvez vous connecter.", "success");
    $("#login-form [name=email]").value = values.email;
    $("#login-form [name=mot_de_passe]").focus();
  } catch (error) { setMessage("#register-message", error.message, "error"); }
});

$("#logout-button").addEventListener("click", () => {
  state.token = null;
  state.user = null;
  document.body.classList.remove("admin-contract-mode");
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("created_reservations");
  state.reservations = [];
  $("#app-section").hidden = true;
  $("#auth-section").hidden = false;
  $("#logout-button").hidden = true;
});
$("#refresh-contracts").addEventListener("click", loadContracts);
$("#refresh-reservations").addEventListener("click", loadAdminReservations);
$("#new-contract-button").addEventListener("click", ouvrirNouveauContrat);

async function ouvrirNouveauContrat(options = {}) {
  try {
    const [reservations, contrats] = await Promise.all([
      request("reservation", "/reservations"),
      request("contract", "/contrats"),
    ]);
    const { ouvrirFormulaireIdentification } =
      await import("./Contrat/interfaces/formulaire-identification.js");

    ouvrirFormulaireIdentification(reservations, contrats, state.vehicles, async reservationId => {
      return await request("contract", "/contrats", {
        method: "POST",
        body: JSON.stringify({ reservation_id: reservationId }),
      });
    }, async (contrat, reservation) => {
      const { ouvrirFormulaireDetails } =
        await import("./Contrat/interfaces/formulaire-details.js");
      const vehicule = state.vehicles.find(item => Number(item.id) === Number(reservation?.vehicule_id));
      ouvrirFormulaireDetails(contrat, reservation, vehicule, async (contratId, montant) => {
        await request("contract", `/contrats/${contratId}/caution`, {
          method: "POST",
          body: JSON.stringify({ montant_caution: montant }),
        });
        notify("Caution enregistrée.");
      }, () => ouvrirNouveauContrat({
        reservationId: Number(reservation.id),
        contrat,
      }), loadContracts);
    }, options.reservationId, options.contrat);
  } catch (error) {
    notify(error.message, true);
  }
}

checkHealth();
if (state.token) loadProfile().catch(() => { sessionStorage.removeItem("access_token"); state.token = null; });
