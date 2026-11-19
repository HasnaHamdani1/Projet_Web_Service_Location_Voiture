const apiBase = window.APP_CONFIG;
const state = {token: sessionStorage.getItem("access_token"), user: null, vehicles: [], adminReservations: [], contracts: [], extensions: {}, contractMeta: JSON.parse(sessionStorage.getItem("contract_meta") || "{}"), contractSearch: "", contractStatus: "TOUS", contractPage: 1, wizardReservation: null, wizardContract: null, extensionContract: null};
const CONTRACTS_PER_PAGE = 6;
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
  const nodes = ["auth", "contract"];
  const statuses = await Promise.all(nodes.map(async service => {
    try { const response = await fetch(`${apiBase[service]}/health`, {signal: AbortSignal.timeout(2200)}); return response.ok; }
    catch { return false; }
  }));
  const good = statuses.every(Boolean);
  const badge = $("#connection-status");
  badge.className = `connection ${good ? "online" : "offline"}`;
  badge.innerHTML = `<i></i>${good ? "Connecté" : "Indisponible"}`;
}

function showSignedIn() {
  document.body.classList.add("is-authenticated");
  $("#auth-section").hidden = true;
  $("#app-section").hidden = false;
  $("#logout-button").hidden = false;
  $("#role-badge").textContent = state.user.role === "ADMINISTRATEUR" ? "AD" : "CL";
  $("#role-badge").title = state.user.role === "ADMINISTRATEUR" ? "Administrateur" : "Client";
  $("#new-contract").hidden = state.user.role !== "ADMINISTRATEUR";
  loadVehicleDirectory();
  loadContracts();
}

async function loadProfile() {
  state.user = await request("auth", "/auth/me");
  showSignedIn();
}

async function loadVehicleDirectory() {
  try {
    state.vehicles = await request("vehicle", "/vehicules");
    renderContracts();
  } catch { state.vehicles = []; }
}

async function loadContracts() {
  const list = $("#contract-list");
  try {
    const contracts = await request("contract", "/contrats?limit=100");
    state.contracts = contracts;
    const extensions = await Promise.all(contracts.map(async contract => {
      try { return [contract.id, await request("contract", `/contrats/${contract.id}/prolongations`)]; }
      catch { return [contract.id, []]; }
    }));
    state.extensions = Object.fromEntries(extensions);
    updateContractKpis();
    renderContracts();
  } catch (error) { list.innerHTML = `<div class='empty-state'>${escapeHtml(error.message)}</div>`; }
}

function effectiveContractStatus(contract) {
  return (state.extensions[contract.id] || []).length && contract.statut !== "CLOTURE" ? "PROLONGE" : contract.statut;
}

function contractVehicleLabel(contract) {
  const car = state.vehicles.find(item => Number(item.id) === Number(contract.vehicule_id));
  return car ? `${car.immatriculation} · ${car.marque} ${car.modele}` : `Véhicule #${contract.vehicule_id}`;
}

function updateContractKpis() {
  const now = new Date();
  const monthLabel = new Intl.DateTimeFormat("fr-FR", {month: "long", year: "numeric"}).format(now);
  $("#kpi-month-label").textContent = monthLabel;
  $("#kpi-month-label-pending").textContent = monthLabel;
  $("#kpi-month-label-extension").textContent = monthLabel;
  const contractsThisMonth = state.contracts.filter(contract => {
    const date = new Date(`${contract.date_generation}T00:00:00`);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }).length;
  const pending = state.contracts.filter(contract => contract.statut === "EN_ATTENTE").length;
  const extensions = state.contracts.filter(contract => (state.extensions[contract.id] || []).length && contract.statut !== "CLOTURE").length;
  $("#kpi-contracts-month").textContent = contractsThisMonth;
  $("#kpi-contracts-pending").textContent = pending;
  $("#kpi-contracts-extensions").textContent = extensions;
  const total = Math.max(contractsThisMonth, pending, extensions, 1);
  $("#kpi-month-progress").style.width = `${contractsThisMonth ? Math.max(12, contractsThisMonth / total * 100) : 0}%`;
  $("#kpi-pending-progress").style.width = `${pending ? Math.max(12, pending / total * 100) : 0}%`;
  $("#kpi-extension-progress").style.width = `${extensions ? Math.max(12, extensions / total * 100) : 0}%`;
}

function renderContracts() {
  const list = $("#contract-list");
  const pagination = $("#contract-pagination");
  const query = state.contractSearch.trim().toLocaleLowerCase("fr");
  const filtered = state.contracts.filter(contract => {
    const status = effectiveContractStatus(contract);
    const searchable = [contract.numero_contrat, contract.client_id, contractVehicleLabel(contract), contract.vehicule_id].join(" ").toLocaleLowerCase("fr");
    return (!query || searchable.includes(query)) && (state.contractStatus === "TOUS" || status === state.contractStatus);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / CONTRACTS_PER_PAGE));
  state.contractPage = Math.min(state.contractPage, pageCount);
  const start = (state.contractPage - 1) * CONTRACTS_PER_PAGE;
  const rows = filtered.slice(start, start + CONTRACTS_PER_PAGE);
  const tableRows = rows.length ? rows.map(contract => {
    const id = Number(contract.id);
    const status = effectiveContractStatus(contract);
    const vehicle = state.vehicles.find(item => Number(item.id) === Number(contract.vehicule_id));
    const registration = vehicle?.immatriculation || `Véhicule #${Number(contract.vehicule_id)}`;
    const vehicleName = vehicle ? `${vehicle.marque} ${vehicle.modele}` : "Détails du véhicule indisponibles";
    return `<tr><td><a class="contract-number" href="#contract-${id}" data-contract-detail="${id}">${escapeHtml(contract.numero_contrat)}</a></td><td><strong>Client #${Number(contract.client_id)}</strong></td><td><span class="registration"><span class="flag-mark">FR</span>${escapeHtml(registration)}</span><span class="table-muted vehicle-description">${escapeHtml(vehicleName)}</span></td><td>${displayDate(contract.periode_prise)} <span class="period-arrow">→</span> ${displayDate(contract.periode_fin)}</td><td><strong>${Number(contract.montant_total).toFixed(2)} DH</strong></td><td>${statusBadge(status)}</td><td><button class="icon-action" data-contract-detail="${id}" aria-label="Consulter le contrat ${escapeHtml(contract.numero_contrat)}" title="Consulter"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg></button></td></tr>`;
  }).join("") : `<tr><td colspan="7" class="table-empty">${state.contracts.length ? "Aucun contrat ne correspond à ces critères." : "Aucun contrat à afficher pour le moment."}</td></tr>`;
  list.innerHTML = `<table class="contract-table"><thead><tr><th>N° contrat</th><th>Client</th><th>Immatriculation & véhicule</th><th>Période (début — fin)</th><th>Montant total</th><th>Statut</th><th>Actions</th></tr></thead><tbody>${tableRows}</tbody></table>`;
  list.querySelectorAll("[data-contract-detail]").forEach(button => button.addEventListener("click", event => { event.preventDefault(); showContractDetails(Number(button.dataset.contractDetail)); }));
  pagination.hidden = filtered.length <= CONTRACTS_PER_PAGE;
  pagination.innerHTML = `<span>Affichage de ${filtered.length ? start + 1 : 0} à ${Math.min(start + CONTRACTS_PER_PAGE, filtered.length)} sur ${filtered.length} contrats</span><div><button class="mini-button" data-contract-page="${state.contractPage - 1}" ${state.contractPage <= 1 ? "disabled" : ""}>Précédent</button><span class="page-number">${state.contractPage} / ${pageCount}</span><button class="mini-button" data-contract-page="${state.contractPage + 1}" ${state.contractPage >= pageCount ? "disabled" : ""}>Suivant</button></div>`;
  pagination.querySelectorAll("[data-contract-page]").forEach(button => button.addEventListener("click", () => { state.contractPage = Number(button.dataset.contractPage); renderContracts(); }));
}

function displayDate(value) {
  if (!value) return "—";
  const date = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.valueOf()) ? String(value) : new Intl.DateTimeFormat("fr-FR").format(date);
}

function periodDays(start, end) {
  return Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000));
}

function reservationSummary(reservation) {
  if (!reservation) return "<div class='empty-state'>Sélectionnez une réservation pour afficher son récapitulatif.</div>";
  const car = state.vehicles.find(item => Number(item.id) === Number(reservation.vehicule_id));
  return `<div class="summary-heading"><span class="summary-check">✓</span><div><strong>Réservation #${Number(reservation.id)}</strong><span>${statusBadge(reservation.statut)}</span></div></div><div class="summary-grid"><div><span>Client</span><strong>Client #${Number(reservation.client_id)}</strong></div><div><span>Véhicule</span><strong>${escapeHtml(car ? `${car.immatriculation} · ${car.marque} ${car.modele}` : `Véhicule #${reservation.vehicule_id}`)}</strong></div><div><span>Début</span><strong>${displayDate(reservation.date_debut)}</strong></div><div><span>Fin</span><strong>${displayDate(reservation.date_fin)}</strong></div></div>`;
}

async function openContractWizard(preselectedId = null) {
  if (state.user?.role !== "ADMINISTRATEUR") return notify("Seul un administrateur peut établir un contrat.", true);
  state.wizardReservation = null;
  state.wizardContract = null;
  $("#contract-reservation-select").disabled = false;
  $("#reset-contract-wizard").disabled = false;
  $("#contract-step-one-next").textContent = "Créer et continuer";
  $("#contract-deposit-form").reset();
  $("#contract-deposit-form").elements.montant_caution.disabled = false;
  $("#contract-deposit-form").querySelector("button[type=submit]").textContent = "Continuer vers la validation";
  $("#contract-reservation-summary").innerHTML = "<div class='empty-state'>Sélectionnez une réservation pour afficher son récapitulatif.</div>";
  $("#contract-reservation-select").innerHTML = "<option value=''>Chargement des réservations confirmées…</option>";
  $("#contract-step-one-next").disabled = true;
  showContractStep(1);
  $("#contract-dialog").showModal();
  try {
    const reservations = await request("reservation", "/reservations");
    state.adminReservations = reservations;
    const confirmed = reservations.filter(item => item.statut === "CONFIRMEE");
    $("#contract-reservation-select").innerHTML = `<option value="">Choisir une réservation confirmée</option>${confirmed.map(item => `<option value="${Number(item.id)}">Réservation #${Number(item.id)} · Client #${Number(item.client_id)} · ${displayDate(item.date_debut)} – ${displayDate(item.date_fin)}</option>`).join("")}`;
    if (!confirmed.length) $("#contract-reservation-summary").innerHTML = "<div class='empty-state'>Aucune réservation confirmée n’est disponible.</div>";
    if (preselectedId && confirmed.some(item => Number(item.id) === preselectedId)) {
      $("#contract-reservation-select").value = String(preselectedId);
      selectContractReservation(preselectedId);
    }
  } catch (error) {
    $("#contract-reservation-select").innerHTML = "<option value=''>Réservations indisponibles</option>";
    $("#contract-reservation-summary").innerHTML = `<div class='empty-state'>${escapeHtml(error.message)}</div>`;
  }
}

function selectContractReservation(reservationId) {
  state.wizardReservation = state.adminReservations.find(item => Number(item.id) === Number(reservationId)) || null;
  if (!state.wizardReservation) {
    // F006 performs a fresh read so the wizard does not depend on the admin table having been opened first.
    request("reservation", `/reservations/${Number(reservationId)}`).then(reservation => {
      state.wizardReservation = reservation;
      $("#contract-reservation-summary").innerHTML = reservationSummary(reservation);
      $("#contract-step-one-next").disabled = reservation.statut !== "CONFIRMEE";
    }).catch(error => {
      $("#contract-reservation-summary").innerHTML = `<div class='empty-state'>${escapeHtml(error.message)}</div>`;
      $("#contract-step-one-next").disabled = true;
    });
    return;
  }
  $("#contract-reservation-summary").innerHTML = reservationSummary(state.wizardReservation);
  $("#contract-step-one-next").disabled = state.wizardReservation.statut !== "CONFIRMEE";
}

function showContractStep(step) {
  document.querySelectorAll("[data-workflow-step]").forEach(section => { section.hidden = Number(section.dataset.workflowStep) !== step; });
  document.querySelectorAll("[data-step-indicator]").forEach(item => {
    const itemStep = Number(item.dataset.stepIndicator);
    item.classList.toggle("is-current", itemStep === step);
    item.classList.toggle("is-complete", itemStep < step);
  });
}

async function createWizardContract() {
  if (state.wizardContract) {
    showContractStep(2);
    return;
  }
  if (!state.wizardReservation) return notify("Sélectionnez une réservation confirmée.", true);
  const button = $("#contract-step-one-next");
  button.disabled = true;
  try {
    state.wizardContract = await request("contract", "/contrats", {method: "POST", body: JSON.stringify({reservation_id: Number(state.wizardReservation.id)})});
    $("#contract-reservation-select").disabled = true;
    $("#reset-contract-wizard").disabled = true;
    button.textContent = "Continuer";
    button.disabled = false;
    const contract = state.wizardContract;
    const days = periodDays(contract.periode_prise, contract.periode_fin);
    const car = state.vehicles.find(item => Number(item.id) === Number(contract.vehicule_id));
    const dailyPrice = car ? Number(car.prix_par_jour) : (days ? Number(contract.montant_total) / days : 0);
    $("#wizard-contract-number").textContent = contract.numero_contrat;
    $("#contract-details-summary").innerHTML = `<div><span>Client</span><strong>Client #${Number(contract.client_id)}</strong></div><div><span>Véhicule</span><strong>${escapeHtml(contractVehicleLabel(contract))}</strong></div><div><span>Date de prise</span><strong>${displayDate(contract.periode_prise)}</strong></div><div><span>Date de fin</span><strong>${displayDate(contract.periode_fin)}</strong></div><div><span>Nombre de jours</span><strong>${days}</strong></div><div><span>Prix par jour</span><strong>${dailyPrice.toFixed(2)} MAD</strong></div><div class="detail-total"><span>Montant total</span><strong>${Number(contract.montant_total).toFixed(2)} MAD</strong></div>`;
    state.contractMeta[contract.id] = {mode_caution: "", statut_caution: "", conditions: "", motif_prolongation: []};
    showContractStep(2);
  } catch (error) {
    notify(error.message, true);
    button.disabled = false;
  }
}

function resumeContractWizard(contractId) {
  const contract = state.contracts.find(item => Number(item.id) === contractId);
  if (!contract || state.user?.role !== "ADMINISTRATEUR") return;
  state.wizardContract = contract;
  state.wizardReservation = null;
  const depositForm = $("#contract-deposit-form");
  const meta = state.contractMeta[contract.id] || {};
  depositForm.reset();
  depositForm.elements.montant_caution.disabled = contract.montant_caution != null;
  if (contract.montant_caution != null) depositForm.elements.montant_caution.value = contract.montant_caution;
  depositForm.elements.mode_caution.value = meta.mode_caution || "";
  depositForm.elements.statut_caution.value = meta.statut_caution || "";
  depositForm.elements.conditions.value = meta.conditions || "";
  $("#wizard-contract-number").textContent = contract.numero_contrat;
  const days = periodDays(contract.periode_prise, contract.periode_fin);
  const car = state.vehicles.find(item => Number(item.id) === Number(contract.vehicule_id));
  const dailyPrice = car ? Number(car.prix_par_jour) : (days ? Number(contract.montant_total) / days : 0);
  $("#contract-details-summary").innerHTML = `<div><span>Client</span><strong>Client #${Number(contract.client_id)}</strong></div><div><span>Véhicule</span><strong>${escapeHtml(contractVehicleLabel(contract))}</strong></div><div><span>Date de prise</span><strong>${displayDate(contract.periode_prise)}</strong></div><div><span>Date de fin</span><strong>${displayDate(contract.periode_fin)}</strong></div><div><span>Nombre de jours</span><strong>${days}</strong></div><div><span>Prix par jour</span><strong>${dailyPrice.toFixed(2)} MAD</strong></div><div class="detail-total"><span>Montant total</span><strong>${Number(contract.montant_total).toFixed(2)} MAD</strong></div>`;
  $("#contract-dialog").showModal();
  if (contract.montant_caution == null) {
    $("#contract-reservation-select").disabled = true;
    $("#reset-contract-wizard").disabled = true;
    $("#contract-deposit-form").elements.montant_caution.disabled = false;
    $("#contract-deposit-form").elements.montant_caution.value = "";
    $("#contract-deposit-form").querySelector("button[type=submit]").textContent = "Enregistrer la caution";
    $("#contract-deposit-form").querySelector("button[type=submit]").disabled = false;
    showContractStep(2);
  } else {
    $("#contract-deposit-form").querySelector("button[type=submit]").textContent = "Continuer";
    $("#contract-deposit-form").querySelector("button[type=submit]").disabled = false;
    $("#contract-final-summary").innerHTML = contractSummaryMarkup(contract, state.contractMeta[contract.id] || {});
    $("#contract-edition-date").textContent = new Intl.DateTimeFormat("fr-FR", {dateStyle: "short", timeStyle: "short"}).format(new Date());
    $("#contract-print-confirmed").checked = false;
    updateValidationAvailability();
    showContractStep(3);
  }
}

async function saveWizardDeposit(event) {
  event.preventDefault();
  const contract = state.wizardContract;
  if (!contract) return notify("Le contrat n’a pas été créé.", true);
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const button = $("button[type=submit]", form);
  button.disabled = true;
  try {
    if (state.wizardContract.montant_caution == null) {
      state.wizardContract = await request("contract", `/contrats/${contract.id}/caution`, {method: "POST", body: JSON.stringify({montant_caution: Number(values.montant_caution)})});
      form.elements.montant_caution.value = state.wizardContract.montant_caution;
      form.elements.montant_caution.disabled = true;
    }
    state.contractMeta[contract.id] = {mode_caution: values.mode_caution, statut_caution: values.statut_caution, conditions: values.conditions, motif_prolongation: []};
    sessionStorage.setItem("contract_meta", JSON.stringify(state.contractMeta));
    button.disabled = false;
    button.textContent = "Continuer";
    const editedAt = new Date();
    $("#contract-edition-date").textContent = new Intl.DateTimeFormat("fr-FR", {dateStyle: "short", timeStyle: "short"}).format(editedAt);
    $("#contract-final-summary").innerHTML = contractSummaryMarkup(state.wizardContract, state.contractMeta[contract.id]);
    $("#contract-print-confirmed").checked = false;
    updateValidationAvailability();
    showContractStep(3);
  } catch (error) {
    notify(error.message, true);
    button.disabled = false;
  }
}

function contractSummaryMarkup(contract, meta = {}) {
  return `<div class="summary-grid"><div><span>N° contrat</span><strong>${escapeHtml(contract.numero_contrat)}</strong></div><div><span>Client</span><strong>Client #${Number(contract.client_id)}</strong></div><div><span>Véhicule</span><strong>${escapeHtml(contractVehicleLabel(contract))}</strong></div><div><span>Période</span><strong>${displayDate(contract.periode_prise)} → ${displayDate(contract.periode_fin)}</strong></div><div><span>Montant total</span><strong>${Number(contract.montant_total).toFixed(2)} MAD</strong></div><div><span>Caution</span><strong>${contract.montant_caution == null ? "Non enregistrée" : `${Number(contract.montant_caution).toFixed(2)} MAD · ${escapeHtml(meta.statut_caution || "Enregistrée")}`}</strong></div>${meta.mode_caution ? `<div><span>Mode d’encaissement</span><strong>${escapeHtml(meta.mode_caution)}</strong></div>` : ""}${meta.conditions ? `<div class="summary-wide"><span>Conditions particulières</span><strong>${escapeHtml(meta.conditions)}</strong></div>` : ""}<div><span>Statut actuel</span><strong>${escapeHtml(effectiveContractStatus(contract))}</strong></div></div>`;
}

function updateValidationAvailability() {
  const received = state.contractMeta[state.wizardContract?.id]?.statut_caution === "RECUE";
  $("#contract-validation-hint").hidden = received;
  $("#validate-contract-wizard").disabled = !received || !$("#contract-print-confirmed").checked;
}

function showContractDetails(contractId) {
  const contract = state.contracts.find(item => Number(item.id) === contractId);
  if (!contract) return notify("Contrat introuvable. Actualisez la liste.", true);
  const extensions = state.extensions[contractId] || [];
  const meta = state.contractMeta[contractId] || {};
  const actions = [`<button class="button button-outline" data-print="${contractId}">Imprimer</button>`];
  if (state.user.role === "ADMINISTRATEUR" && contract.statut === "EN_ATTENTE") actions.push(`<button class="button button-primary" data-resume="${contractId}">Reprendre la préparation</button>`);
  if (state.user.role === "ADMINISTRATEUR" && contract.statut === "VALIDE") actions.push(`<button class="button button-outline" data-extend="${contractId}">Prolonger</button><button class="button button-primary" data-close="${contractId}">Clôturer</button>`);
  $("#contract-detail-content").innerHTML = `${contractSummaryMarkup(contract, meta)}<h3 class="history-title">Historique des prolongations</h3>${extensions.length ? `<ol class="extension-history">${extensions.map(item => { const reason = (meta.motif_prolongation || []).find(entry => entry.date_fin === item.date_fin)?.motif; return `<li><strong>${displayDate(item.date_fin_precedente)} → ${displayDate(item.date_fin)}</strong><span>+${Number(item.montant_supplementaire).toFixed(2)} MAD · ${displayDate(item.date_creation)}</span>${reason ? `<em>Motif : ${escapeHtml(reason)}</em>` : ""}</li>`; }).join("")}</ol>` : "<p class='empty-state'>Aucune prolongation enregistrée.</p>"}<div class="detail-actions">${actions.join("")}</div>`;
  $("#contract-detail-content").querySelectorAll("[data-print]").forEach(button => button.addEventListener("click", printContract));
  $("#contract-detail-content").querySelectorAll("[data-resume]").forEach(button => button.addEventListener("click", () => { $("#contract-detail-dialog").close(); resumeContractWizard(contractId); }));
  $("#contract-detail-content").querySelectorAll("[data-extend]").forEach(button => button.addEventListener("click", () => { $("#contract-detail-dialog").close(); openExtensionDialog(contractId); }));
  $("#contract-detail-content").querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", closeContract));
  $("#contract-detail-dialog").showModal();
}

function openExtensionDialog(contractId) {
  const contract = state.contracts.find(item => Number(item.id) === contractId);
  if (!contract || contract.statut !== "VALIDE") return notify("Seul un contrat validé peut être prolongé.", true);
  state.extensionContract = contract;
  const extensions = [...(state.extensions[contractId] || [])].sort((a, b) => String(a.date_fin).localeCompare(String(b.date_fin)));
  const currentEnd = extensions.length ? extensions.at(-1).date_fin : contract.periode_fin;
  const addedTotal = extensions.reduce((total, item) => total + Number(item.montant_supplementaire), 0);
  const currentTotal = Number(contract.montant_total) + addedTotal;
  const duration = periodDays(contract.periode_prise, contract.periode_fin);
  const dailyRate = duration ? Number(contract.montant_total) / duration : 0;
  $("#extension-current-summary").innerHTML = `<div class="summary-grid"><div><span>Contrat</span><strong>${escapeHtml(contract.numero_contrat)}</strong></div><div><span>Véhicule</span><strong>${escapeHtml(contractVehicleLabel(contract))}</strong></div><div><span>Fin actuelle</span><strong>${displayDate(currentEnd)}</strong></div><div><span>Montant actuel</span><strong>${currentTotal.toFixed(2)} MAD</strong></div></div>`;
  const input = $("#extension-form [name=nouvelle_date_fin]");
  input.min = currentEnd;
  input.value = "";
  $("#extension-form").dataset.currentEnd = currentEnd;
  $("#extension-form").dataset.currentTotal = String(currentTotal);
  $("#extension-form").dataset.dailyRate = String(dailyRate);
  $("#extension-days").textContent = "—";
  $("#extension-extra").textContent = "—";
  $("#extension-total").textContent = `${currentTotal.toFixed(2)} MAD`;
  $("#confirm-extension").disabled = true;
  $("#extension-dialog").showModal();
}

function updateExtensionPreview() {
  const form = $("#extension-form");
  const dateValue = form.elements.nouvelle_date_fin.value;
  const days = dateValue ? periodDays(form.dataset.currentEnd, dateValue) : 0;
  const dailyRate = Number(form.dataset.dailyRate || 0);
  const currentTotal = Number(form.dataset.currentTotal || 0);
  const extra = days * dailyRate;
  $("#extension-days").textContent = days || "—";
  $("#extension-extra").textContent = days ? `${extra.toFixed(2)} MAD` : "—";
  $("#extension-total").textContent = `${(currentTotal + extra).toFixed(2)} MAD`;
  $("#confirm-extension").disabled = days < 1;
}

async function confirmExtension(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const contract = state.extensionContract;
  const newEnd = form.elements.nouvelle_date_fin.value;
  if (!contract || !newEnd || periodDays(form.dataset.currentEnd, newEnd) < 1) return notify("Choisissez une date strictement postérieure à la fin actuelle.", true);
  const button = $("#confirm-extension");
  button.disabled = true;
  try {
    const key = crypto.randomUUID();
    const result = await request("contract", `/contrats/${contract.id}/prolongations`, {method: "POST", headers: {"Idempotency-Key": key}, body: JSON.stringify({nouvelle_date_fin: newEnd})});
    state.contractMeta[contract.id] ||= {motif_prolongation: []};
    state.contractMeta[contract.id].motif_prolongation ||= [];
    if (form.elements.motif.value.trim()) state.contractMeta[contract.id].motif_prolongation.push({date_fin: newEnd, motif: form.elements.motif.value.trim()});
    sessionStorage.setItem("contract_meta", JSON.stringify(state.contractMeta));
    notify(`Prolongation enregistrée · supplément ${Number(result.montant_supplementaire).toFixed(2)} MAD.`);
    $("#extension-dialog").close();
    await loadContracts();
  } catch (error) {
    notify(error.message, true);
    button.disabled = false;
  }
}

function printContract(event) {
  const contractId = Number(event.currentTarget.dataset.print);
  const contract = state.contracts.find(item => Number(item.id) === contractId);
  if (!contract) return notify("Contrat introuvable. Actualisez la liste.", true);

  printContractDocument(contract);
}

function printContractDocument(contract) {

  const printWindow = window.open("", "_blank", "width=900,height=750");
  if (!printWindow) return notify("Autorisez les fenêtres popup pour imprimer le contrat.", true);

  const money = value => value == null ? "—" : `${Number(value).toFixed(2)} MAD`;
  printWindow.document.write(`<!doctype html>
    <html lang="fr"><head><meta charset="utf-8"><title>Contrat ${escapeHtml(contract.numero_contrat)}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#172b3a;max-width:800px;margin:36px auto;padding:0 28px;line-height:1.5}
      h1{text-align:center;font-size:24px;margin:0 0 6px} .subtitle{text-align:center;color:#526d82;margin:0 0 28px}
      h2{font-size:16px;border-bottom:1px solid #cbd5df;padding-bottom:6px;margin-top:24px}
      table{width:100%;border-collapse:collapse} td{padding:9px;border-bottom:1px solid #dbe3ea} td:first-child{font-weight:bold;width:38%}
      .signatures{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:55px}.signature{min-height:150px;border:1px solid #9fb3c8;padding:14px}
      .line{margin-top:75px;border-top:1px solid #526d82;padding-top:6px;font-size:12px;color:#526d82}
      .notice{margin-top:24px;font-size:12px;color:#526d82}
      @media print{body{margin:15mm auto;padding:0}.signatures{break-inside:avoid}}
    </style></head><body>
    <h1>Contrat de location de véhicule</h1><p class="subtitle">${escapeHtml(contract.numero_contrat)}</p>
    <h2>Informations du contrat</h2><table>
      <tr><td>Date d’établissement</td><td>${escapeHtml(contract.date_generation)}</td></tr>
      <tr><td>Réservation</td><td>#${Number(contract.reservation_id)}</td></tr>
      <tr><td>Client</td><td>#${Number(contract.client_id)}</td></tr>
      <tr><td>Véhicule</td><td>#${Number(contract.vehicule_id)}</td></tr>
      <tr><td>Période</td><td>${escapeHtml(contract.periode_prise)} au ${escapeHtml(contract.periode_fin)}</td></tr>
      <tr><td>Montant total</td><td>${money(contract.montant_total)}</td></tr>
      <tr><td>Caution</td><td>${money(contract.montant_caution)}</td></tr>
      ${state.contractMeta[contract.id]?.mode_caution ? `<tr><td>Mode d’encaissement</td><td>${escapeHtml(state.contractMeta[contract.id].mode_caution)}</td></tr>` : ""}
      ${state.contractMeta[contract.id]?.conditions ? `<tr><td>Conditions particulières</td><td>${escapeHtml(state.contractMeta[contract.id].conditions)}</td></tr>` : ""}
      <tr><td>Statut</td><td>${escapeHtml(contract.statut)}</td></tr>
    </table>
    <p class="notice">Les parties signent manuellement le présent document après vérification des informations.</p>
    <div class="signatures">
      <div class="signature"><strong>Le client</strong><div class="line">Nom, date et signature</div></div>
      <div class="signature"><strong>Le représentant de l’agence</strong><div class="line">Nom, date et signature</div></div>
    </div>
    </body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
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
  if (!window.confirm("Confirmez-vous que le client et vous-même avez signé le contrat imprimé ? Le statut passera à VALIDE.")) {
    button.disabled = false;
    return;
  }
  try {
    await request("contract", `/contrats/${button.dataset.sign}/validation`, {method: "POST"});
    notify("Signatures papier confirmées par l’administrateur ; contrat validé.");
    loadContracts();
  } catch (error) { notify(error.message, true); button.disabled = false; }
}

async function validateWizardContract() {
  if (!$("#contract-print-confirmed").checked) return notify("Confirmez l’impression et la remise des deux exemplaires.", true);
  const contract = state.wizardContract;
  if (!contract) return notify("Contrat introuvable.", true);
  if (state.contractMeta[contract.id]?.statut_caution !== "RECUE") return notify("La caution doit être marquée comme reçue avant la validation.", true);
  const button = $("#validate-contract-wizard");
  button.disabled = true;
  try {
    await request("contract", `/contrats/${contract.id}/validation`, {method: "POST"});
    notify("Contrat validé. Ses informations sont désormais verrouillées.");
    $("#contract-dialog").close();
    await loadContracts();
  } catch (error) {
    notify(error.message, true);
    button.disabled = false;
  }
}

async function closeContract(event) {
  const button = event.currentTarget;
  const id = Number(button.dataset.close);
  const confirmed = window.confirm("Confirmez-vous que le véhicule a été retourné et que son état a été vérifié ? Cette action clôturera le contrat.");
  if (!confirmed) return;
  button.disabled = true;
  try {
    await request("contract", `/contrats/${id}/cloture`, {method: "POST"});
    notify("Contrat clôturé.");
    $("#contract-detail-dialog").close();
    await loadContracts();
  } catch (error) {
    notify(error.message, true);
    button.disabled = false;
  }
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

$("#logout-button").addEventListener("click", () => {
  state.token = null;
  state.user = null;
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("contract_meta");
  state.contractMeta = {};
  $("#app-section").hidden = true;
  $("#auth-section").hidden = false;
  document.body.classList.remove("is-authenticated", "sidebar-collapsed");
  $("#logout-button").hidden = true;
});
$("#new-contract").addEventListener("click", () => openContractWizard());
$(".sidebar-collapse").addEventListener("click", event => {
  const collapsed = document.body.classList.toggle("sidebar-collapsed");
  event.currentTarget.textContent = collapsed ? "‹" : "›";
  event.currentTarget.setAttribute("aria-label", collapsed ? "Développer la navigation" : "Réduire la navigation");
});
document.querySelectorAll("[data-module-nav]").forEach(button => button.addEventListener("click", () => {
  notify(`La rubrique ${button.dataset.moduleNav} n’est pas incluse dans l’espace Contrats.`);
}));
$("#contract-reservation-select").addEventListener("change", event => {
  const id = Number(event.currentTarget.value);
  if (!id) {
    state.wizardReservation = null;
    $("#contract-reservation-summary").innerHTML = "<div class='empty-state'>Sélectionnez une réservation pour afficher son récapitulatif.</div>";
    $("#contract-step-one-next").disabled = true;
    return;
  }
  selectContractReservation(id);
});
$("#contract-step-one-next").addEventListener("click", createWizardContract);
$("#contract-deposit-form").addEventListener("submit", saveWizardDeposit);
document.querySelectorAll("[data-contract-back]").forEach(button => button.addEventListener("click", () => showContractStep(Number(button.dataset.contractBack))));
$("#contract-print-confirmed").addEventListener("change", updateValidationAvailability);
$("#print-contract-wizard").addEventListener("click", () => {
  if (state.wizardContract) printContractDocument(state.wizardContract);
});
$("#validate-contract-wizard").addEventListener("click", validateWizardContract);
$("#reset-contract-wizard").addEventListener("click", () => {
  state.wizardReservation = null;
  $("#contract-reservation-select").value = "";
  $("#contract-reservation-summary").innerHTML = "<div class='empty-state'>Sélectionnez une réservation pour afficher son récapitulatif.</div>";
  $("#contract-step-one-next").disabled = true;
});
$("#contract-search").addEventListener("input", event => { state.contractSearch = event.currentTarget.value; state.contractPage = 1; renderContracts(); });
$("#contract-status-filter").addEventListener("change", event => { state.contractStatus = event.currentTarget.value; state.contractPage = 1; renderContracts(); });
$("#extension-form").addEventListener("input", updateExtensionPreview);
$("#extension-form").addEventListener("submit", confirmExtension);
document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => document.getElementById(button.dataset.closeDialog).close()));
$("#refresh-contracts").addEventListener("click", loadContracts);

checkHealth();
if (state.token) loadProfile().catch(() => { sessionStorage.removeItem("access_token"); state.token = null; });
