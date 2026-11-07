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

function showSignedIn() {
  $("#auth-section").hidden = true;
  $("#app-section").hidden = false;
  $("#logout-button").hidden = false;
  $("#welcome-title").textContent = `Bonjour ${state.user.nom}`;
  $("#role-badge").textContent = state.user.role === "ADMINISTRATEUR" ? "Administrateur" : "Client";
  $("#admin-reservations").hidden = state.user.role !== "ADMINISTRATEUR";
  $("#my-reservations").hidden = state.user.role !== "CLIENT";
  loadVehicles();
  loadContracts();
  renderMyReservations();
  if (state.user.role === "ADMINISTRATEUR") loadAdminReservations();
}

async function loadProfile() {
  state.user = await request("auth", "/auth/me");
  showSignedIn();
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
    if (!contracts.length) { list.innerHTML = "<div class='empty-state'>Aucun contrat à afficher.</div>"; return; }
    list.innerHTML = contracts.map(contract => `<article class="contract-card">
      <div class="card-top"><div><h3 class="card-title">${escapeHtml(contract.numero_contrat)}</h3><p class="card-detail">Véhicule #${Number(contract.vehicule_id)} · Réservation #${Number(contract.reservation_id)}</p><p class="card-detail">${escapeHtml(contract.periode_prise)} → ${escapeHtml(contract.periode_fin)}</p><p class="card-detail">Montant : ${Number(contract.montant_total).toFixed(2)}${contract.montant_caution == null ? " · Caution non enregistrée" : ` · Caution : ${Number(contract.montant_caution).toFixed(2)}`}</p></div>${statusBadge(contract.statut)}</div>
      <div class="card-actions">${state.user.role === "ADMINISTRATEUR" && contract.statut === "EN_ATTENTE" && contract.montant_caution == null ? `<form data-deposit="${Number(contract.id)}"><input class="amount-input" name="montant_caution" type="number" min="0.01" step="0.01" placeholder="Caution" required><button class="mini-button" type="submit">Enregistrer</button></form>` : ""}${state.user.role === "CLIENT" && contract.statut === "EN_ATTENTE" && contract.montant_caution != null ? `<button class="mini-button" data-sign="${Number(contract.id)}">Signer et valider</button>` : ""}</div>
    </article>`).join("");
    list.querySelectorAll("form[data-deposit]").forEach(form => form.addEventListener("submit", recordDeposit));
    list.querySelectorAll("[data-sign]").forEach(button => button.addEventListener("click", validateContract));
  } catch (error) { list.innerHTML = `<div class='empty-state'>${escapeHtml(error.message)}</div>`; }
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
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("created_reservations");
  state.reservations = [];
  $("#app-section").hidden = true;
  $("#auth-section").hidden = false;
  $("#logout-button").hidden = true;
});
$("#refresh-contracts").addEventListener("click", loadContracts);
$("#refresh-reservations").addEventListener("click", loadAdminReservations);

checkHealth();
if (state.token) loadProfile().catch(() => { sessionStorage.removeItem("access_token"); state.token = null; });
