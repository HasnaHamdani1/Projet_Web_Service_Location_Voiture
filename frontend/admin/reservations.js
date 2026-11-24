// Service Réservation : config.js (frontend/server.py), même machine que la page par défaut
const API_RESERVATIONS = `${window.APP_CONFIG?.reservation || `${location.protocol}//${location.hostname}:8002`}/reservations`;

// Jeton de l'administrateur connecté (login.html)
function entetes(json = false) {
    const h = { Authorization: `Bearer ${sessionStorage.getItem("adminToken") || ""}` };
    if (json) h["Content-Type"] = "application/json";
    return h;
}

async function appeler(url, options = {}) {
    const reponse = await fetch(url, options);
    if (reponse.status === 401) {
        sessionStorage.removeItem("adminToken");
        location.replace("login.html");
        throw new Error("Session expirée");
    }
    if (!reponse.ok) {
        const donnees = await reponse.json().catch(() => null);
        throw new Error(donnees?.detail || `Erreur HTTP ${reponse.status}`);
    }
    return reponse;
}

const tbody = document.getElementById("reservations-body");
const errorBox = document.getElementById("reservations-error");
const searchInput = document.getElementById("search-reservation");
const statusFilter = document.getElementById("status-filter");

let reservations = [];

function afficherStatistiques(liste) {
    document.getElementById("stat-total").textContent = liste.length;
    document.getElementById("stat-pending").textContent =
        liste.filter(r => r.statut === "EN_ATTENTE").length;
    document.getElementById("stat-confirmed").textContent =
        liste.filter(r => r.statut === "CONFIRMEE").length;
    document.getElementById("stat-cancelled").textContent =
        liste.filter(r => r.statut === "ANNULEE").length;
}

function formaterDate(date) {
    if (!date) return "—";
    const morceaux = String(date).split("-");
    if (morceaux.length !== 3) return date;
    return `${morceaux[2]}/${morceaux[1]}/${morceaux[0]}`;
}

function afficherStatut(statut) {
    const configurations = {
        EN_ATTENTE: ["En attente", "status-pending"],
        CONFIRMEE: ["Confirmée", "status-confirmed"],
        ANNULEE: ["Annulée", "status-cancelled"]
    };

    const config = configurations[statut] || [statut || "Inconnu", "status-other"];
    return `<span class="status ${config[1]}">${config[0]}</span>`;
}

function echapper(valeur) {
    return String(valeur ?? "").replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[c]);
}

// Actions de l'agence (règles du service Réservation) : confirmer un paiement reçu au comptoir,
// annuler avant le départ. L'agence ne crée ni ne modifie de réservation.
function boutonsActions(r) {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const boutons = [];
    if (r.statut === "EN_ATTENTE") {
        boutons.push(`<button class="action-button action-confirm" data-action="confirmer" data-id="${r.id}">Confirmer</button>`);
    }
    if (["EN_ATTENTE", "CONFIRMEE"].includes(r.statut) && String(r.date_debut) > aujourdhui) {
        boutons.push(`<button class="action-button action-cancel" data-action="annuler" data-id="${r.id}">Annuler</button>`);
    }
    return boutons.join("") || "—";
}

async function executerAction(action, id) {
    try {
        if (action === "confirmer") {
            if (!confirm("Confirmer cette réservation (paiement reçu à l'agence) ?")) return;
            await appeler(`${API_RESERVATIONS}/${id}/statut`, {
                method: "PATCH", headers: entetes(true), body: JSON.stringify({ statut: "CONFIRMEE" })
            });
        } else {
            const motif = prompt("Motif de l'annulation :");
            if (motif === null) return;
            await appeler(`${API_RESERVATIONS}/${id}/annulation`, {
                method: "PUT", headers: entetes(true), body: JSON.stringify({ motif: motif.trim() || null })
            });
        }
        await chargerReservations();
    } catch (erreur) {
        errorBox.textContent = erreur.message;
        errorBox.hidden = false;
    }
}

// Export CSV (UTF-8, séparateur ;) de la sélection affichée
async function exporterCsv() {
    try {
        const params = new URLSearchParams();
        if (statusFilter.value) params.set("statut", statusFilter.value);
        if (searchInput.value.trim()) params.set("search", searchInput.value.trim());
        const reponse = await appeler(`${API_RESERVATIONS}/export.csv?${params}`, { headers: entetes() });
        const lien = document.createElement("a");
        lien.href = URL.createObjectURL(await reponse.blob());
        lien.download = `reservations_${new Date().toISOString().slice(0, 10)}.csv`;
        lien.click();
        URL.revokeObjectURL(lien.href);
    } catch (erreur) {
        errorBox.textContent = "Export impossible : " + erreur.message;
        errorBox.hidden = false;
    }
}

function afficherReservations() {
    const recherche = searchInput.value.trim().toLowerCase();
    const statut = statusFilter.value;

    const filtrees = reservations.filter(r => {
        const correspondRecherche = [
            r.id, r.numero, r.client_id, r.client_nom, r.vehicule_id, r.vehicule_libelle
        ].some(v => String(v ?? "").toLowerCase().includes(recherche));

        const correspondStatut = !statut || r.statut === statut;
        return correspondRecherche && correspondStatut;
    });

    document.getElementById("results-count").textContent =
        `${filtrees.length} réservation(s) affichée(s) sur ${reservations.length}`;

    if (filtrees.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="table-message">
            Aucune réservation ne correspond à votre recherche.
        </td></tr>`;
        return;
    }

    tbody.innerHTML = filtrees.map(r => `
        <tr>
            <td class="reservation-id">${echapper(r.numero || `#${r.id}`)}</td>
            <td>${echapper(r.client_nom || `Client #${r.client_id}`)}</td>
            <td>${echapper(r.vehicule_libelle || `Véhicule #${r.vehicule_id}`)}</td>
            <td>${formaterDate(r.date_debut)}</td>
            <td>${formaterDate(r.date_fin)}</td>
            <td>${Number(r.prix_total ?? 0).toLocaleString("fr-FR")} DH</td>
            <td>${afficherStatut(r.statut)}</td>
            <td class="reservation-actions">${boutonsActions(r)}</td>
        </tr>
    `).join("");
}

async function chargerReservations() {
    errorBox.hidden = true;
    tbody.innerHTML = `<tr><td colspan="8" class="table-message">Chargement des réservations...</td></tr>`;

    try {
        const reponse = await appeler(API_RESERVATIONS, { headers: entetes() });

        const donnees = await reponse.json();

        if (!Array.isArray(donnees)) {
            throw new Error("Format de réponse API inattendu");
        }

        reservations = donnees;
        afficherStatistiques(reservations);
        afficherReservations();

    } catch (erreur) {
        tbody.innerHTML = `<tr><td colspan="8" class="table-message">
            Impossible de charger les réservations.
        </td></tr>`;
        errorBox.textContent =
            "Erreur de connexion au service Réservation : " + erreur.message;
        errorBox.hidden = false;
        document.getElementById("results-count").textContent = "Chargement impossible";
    }
}

searchInput.addEventListener("input", afficherReservations);
statusFilter.addEventListener("change", afficherReservations);
document.getElementById("refresh-button").addEventListener("click", chargerReservations);
document.getElementById("export-button").addEventListener("click", exporterCsv);
tbody.addEventListener("click", (event) => {
    const bouton = event.target.closest("[data-action]");
    if (bouton) executerAction(bouton.dataset.action, bouton.dataset.id);
});

chargerReservations();
