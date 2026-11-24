
const HOST = window.location.hostname || "localhost";

const API = {
  auth: `http://${HOST}:8014`,
  vehicle: `http://${HOST}:8005`,
  reservation: `http://${HOST}:8002`
};

const state = {
  token: sessionStorage.getItem("client_token"),
  user: null,
  vehicles: [],
  selectedVehicle: null
};

const $ = (selector) => document.querySelector(selector);

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function showMessage(message, type = "success") {
  const element = $("#message");
  element.textContent = message;
  element.className = `message ${type}`;
  element.classList.remove("hidden");
  element.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideMessage() {
  $("#message").classList.add("hidden");
}

async function apiRequest(service, path, options = {}) {
  const headers = new Headers(options.headers || {});

  if (state.token) {
    headers.set("Authorization", `Bearer ${state.token}`);
  }

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response;

  try {
    response = await fetch(`${API[service]}${path}`, {
      ...options,
      headers
    });
  } catch {
    throw new Error(
      `Impossible de contacter le service ${service}. Vérifiez que Docker est démarré.`
    );
  }

  const data = response.status === 204
    ? null
    : await response.json().catch(() => null);

  if (!response.ok) {
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map(item => item.msg).join(", ")
      : detail;

    throw new Error(message || `Erreur HTTP ${response.status}`);
  }

  return data;
}

/* Affichage des espaces */

function showAuth() {
  $("#auth-section").classList.remove("hidden");
  $("#client-section").classList.add("hidden");
  $("#logout-button").classList.add("hidden");
}

function showClient() {
  $("#auth-section").classList.add("hidden");
  $("#client-section").classList.remove("hidden");
  $("#logout-button").classList.remove("hidden");

  $("#client-name").textContent = state.user.nom;

  chargerVehicules();
  chargerReservations();
}

/* Inscription */

$("#register-form").addEventListener("submit", async event => {
  event.preventDefault();
  hideMessage();

  const button = event.submitter;
  button.disabled = true;

  const donnees = {
    nom: $("#register-name").value.trim(),
    email: $("#register-email").value.trim(),
    mot_de_passe: $("#register-password").value,
    telephone: $("#register-phone").value.trim() || null,
    adresse: $("#register-address").value.trim()
  };

  try {
    await apiRequest("auth", "/auth/inscription", {
      method: "POST",
      body: JSON.stringify(donnees)
    });

    $("#login-email").value = donnees.email;
    $("#login-password").value = "";
    $("#register-form").reset();

    showMessage(
      "Votre compte a été créé. Connectez-vous maintenant avec votre adresse e-mail et votre mot de passe."
    );

    $("#login-email").focus();

  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    button.disabled = false;
  }
});

/* Connexion */

$("#login-form").addEventListener("submit", async event => {
  event.preventDefault();
  hideMessage();

  const button = event.submitter;
  button.disabled = true;

  try {
    const result = await apiRequest("auth", "/auth/token", {
      method: "POST",
      body: JSON.stringify({
        email: $("#login-email").value.trim(),
        mot_de_passe: $("#login-password").value
      })
    });

    state.token = result.access_token;
    sessionStorage.setItem("client_token", state.token);

    state.user = await apiRequest("auth", "/auth/me");

    if (state.user.role !== "CLIENT") {
      throw new Error("Cet espace est réservé aux clients.");
    }

    $("#login-form").reset();
    showClient();
    showMessage("Connexion réussie. Bienvenue chez PARC AUTO !");

  } catch (error) {
    state.token = null;
    state.user = null;
    sessionStorage.removeItem("client_token");
    showAuth();
    showMessage(error.message, "error");
  } finally {
    button.disabled = false;
  }
});

/* Déconnexion */

$("#logout-button").addEventListener("click", () => {
  state.token = null;
  state.user = null;
  state.selectedVehicle = null;

  sessionStorage.removeItem("client_token");

  $("#booking-section").classList.add("hidden");
  showAuth();
  showMessage("Vous êtes déconnecté.");
});

/* Catalogue des véhicules */

async function chargerVehicules() {
  const container = $("#vehicle-list");
  container.innerHTML = '<p class="muted">Chargement des véhicules...</p>';

  try {
    const resultat = await apiRequest("vehicle", "/vehicules");

    state.vehicles = Array.isArray(resultat)
      ? resultat
      : (resultat?.value || []);

    const disponibles = state.vehicles.filter(
      vehicule => vehicule.statut === "DISPONIBLE"
    );

    if (disponibles.length === 0) {
      container.innerHTML =
        '<p class="muted">Aucun véhicule disponible pour le moment.</p>';
      return;
    }

    container.innerHTML = disponibles.map(vehicule => {
      const nom = `${vehicule.marque || ""} ${vehicule.modele || ""}`.trim();
      const prix = Number(vehicule.prix_par_jour);

      const photo = vehicule.image_url
        ? new URL(vehicule.image_url, API.vehicle).href
        : "";

      return `
        <article class="vehicle-card">
          ${
            photo
              ? `<img src="${escapeHTML(photo)}"
                    alt="${escapeHTML(nom)}"
                    onerror="this.outerHTML='<div class=&quot;vehicle-placeholder&quot;>🚗</div>'">`
              : '<div class="vehicle-placeholder">🚗</div>'
          }
          <div class="vehicle-info">
            <h3>${escapeHTML(nom || "Véhicule")}</h3>
            <p class="price">
              ${Number.isFinite(prix) ? prix.toLocaleString("fr-FR") : "Prix non renseigné"} DH / jour
            </p>
            <p class="muted">Disponible</p>
            <button class="button button-primary choose-vehicle"
              type="button" data-id="${escapeHTML(vehicule.id)}">
              Choisir ce véhicule
            </button>
          </div>
        </article>
      `;
    }).join("");

    container.querySelectorAll(".choose-vehicle").forEach(button => {
      button.addEventListener("click", () => {
        choisirVehicule(button.dataset.id);
      });
    });

    const params = new URLSearchParams(window.location.search);
    const vehicleId = params.get("vehicule_id");

    if (vehicleId) {
      choisirVehicule(vehicleId);
    }

  } catch (error) {
    container.innerHTML = `<p class="muted">${escapeHTML(error.message)}</p>`;
  }
}

/* Sélection du véhicule */

function choisirVehicule(id) {
  const vehicule = state.vehicles.find(
    item => String(item.id) === String(id)
  );

  if (!vehicule || vehicule.statut !== "DISPONIBLE") {
    showMessage("Ce véhicule n'est plus disponible.", "error");
    return;
  }

  state.selectedVehicle = vehicule;

  const nom = `${vehicule.marque || ""} ${vehicule.modele || ""}`.trim();
  const prix = Number(vehicule.prix_par_jour);

  $("#selected-vehicle-name").textContent = nom;
  $("#selected-vehicle-price").textContent =
    `${Number.isFinite(prix) ? prix.toLocaleString("fr-FR") : "Prix non renseigné"} DH / jour`;

  $("#booking-section").classList.remove("hidden");
  $("#booking-section").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

$("#cancel-selection").addEventListener("click", () => {
  state.selectedVehicle = null;
  $("#booking-section").classList.add("hidden");
  $("#booking-form").reset();
});

/* Création d'une réservation */

$("#booking-form").addEventListener("submit", async event => {
  event.preventDefault();
  hideMessage();

  if (!state.user || !state.selectedVehicle) {
    showMessage("Connectez-vous et choisissez un véhicule.", "error");
    return;
  }

  const dateDebut = $("#date-start").value;
  const dateFin = $("#date-end").value;

  if (!dateDebut || !dateFin || dateDebut >= dateFin) {
    showMessage("La date de fin doit être postérieure à la date de début.", "error");
    return;
  }

  const button = event.submitter;
  button.disabled = true;

  try {
    const reservation = await apiRequest("reservation", "/reservations", {
      method: "POST",
      body: JSON.stringify({
        client_id: state.user.id,
        vehicule_id: state.selectedVehicle.id,
        date_debut: dateDebut,
        date_fin: dateFin
      })
    });

    $("#booking-form").reset();
    $("#booking-section").classList.add("hidden");
    state.selectedVehicle = null;

    showMessage(
      `Réservation créée avec succès ! Numéro : ${reservation.id}. Statut : ${reservation.statut}.`
    );

    await chargerReservations();
    await chargerVehicules();

  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    button.disabled = false;
  }
});

/* Liste des réservations du client */

async function chargerReservations() {
  const container = $("#reservation-list");
  container.innerHTML = '<p class="muted">Chargement...</p>';

  try {
    const resultat = await apiRequest("reservation", "/reservations");

    const liste = Array.isArray(resultat)
      ? resultat
      : (resultat?.value || []);

    const mesReservations = liste.filter(
      reservation => Number(reservation.client_id) === Number(state.user.id)
    );

    if (mesReservations.length === 0) {
      container.innerHTML =
        '<p class="muted">Vous n’avez pas encore de réservation.</p>';
      return;
    }

    container.innerHTML = mesReservations.map(reservation => {
      const montant = reservation.prix_total ?? reservation.montant_estime ?? 0;
      const statut = reservation.statut || "INCONNU";

      return `
        <article class="reservation-card">
          <div>
            <h3>Réservation n° ${escapeHTML(reservation.id)}</h3>
            <p>Véhicule n° ${escapeHTML(reservation.vehicule_id)}</p>
            <p>Du ${escapeHTML(reservation.date_debut)}
               au ${escapeHTML(reservation.date_fin)}</p>
            <p><strong>Montant : ${escapeHTML(montant)} DH</strong></p>
            <span class="status">${escapeHTML(statut)}</span>
          </div>
          <div class="reservation-actions">
            ${
              statut === "EN_ATTENTE"
                ? `<button class="button button-primary pay-reservation"
                     data-id="${escapeHTML(reservation.id)}">
                     Simuler le paiement
                   </button>`
                : ""
            }
            ${
              ["EN_ATTENTE", "CONFIRMEE"].includes(statut)
                ? `<button class="button button-outline cancel-reservation"
                     data-id="${escapeHTML(reservation.id)}">
                     Annuler
                   </button>`
                : ""
            }
          </div>
        </article>
      `;
    }).join("");

    container.querySelectorAll(".pay-reservation").forEach(button => {
      button.addEventListener("click", () => payerReservation(button.dataset.id));
    });

    container.querySelectorAll(".cancel-reservation").forEach(button => {
      button.addEventListener("click", () => annulerReservation(button.dataset.id));
    });

  } catch (error) {
    container.innerHTML = `<p class="muted">${escapeHTML(error.message)}</p>`;
  }
}

/* Paiement de démonstration */

async function payerReservation(id) {
  if (!confirm("Confirmer la simulation du paiement ?")) return;

  try {
    await apiRequest("reservation", `/reservations/${id}/paiement`, {
      method: "POST",
      body: JSON.stringify({ paiement_reussi: true })
    });

    showMessage("Paiement simulé avec succès.");
    await chargerReservations();
    await chargerVehicules();

  } catch (error) {
    showMessage(error.message, "error");
  }
}

/* Annulation */

async function annulerReservation(id) {
  if (!confirm("Voulez-vous vraiment annuler cette réservation ?")) return;

  try {
    await apiRequest("reservation", `/reservations/${id}/annulation`, {
      method: "PUT"
    });

    showMessage("Réservation annulée.");
    await chargerReservations();
    await chargerVehicules();

  } catch (error) {
    showMessage(error.message, "error");
  }
}

$("#refresh-reservations").addEventListener("click", chargerReservations);

/* Initialisation */

async function initialiser() {
  const today = new Date().toISOString().split("T")[0];
  $("#date-start").min = today;
  $("#date-end").min = today;

  if (!state.token) {
    showAuth();
    return;
  }

  try {
    state.user = await apiRequest("auth", "/auth/me");

    if (state.user.role !== "CLIENT") {
      throw new Error("Cet espace est réservé aux clients.");
    }

    showClient();

  } catch {
    state.token = null;
    state.user = null;
    sessionStorage.removeItem("client_token");
    showAuth();
  }
}

initialiser();
