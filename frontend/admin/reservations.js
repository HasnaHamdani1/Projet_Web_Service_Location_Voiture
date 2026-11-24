const API_RESERVATIONS = `http://${window.location.hostname}:8002/reservations`;

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

function afficherReservations() {
    const recherche = searchInput.value.trim().toLowerCase();
    const statut = statusFilter.value;

    const filtrees = reservations.filter(r => {
        const correspondRecherche = [
            r.id, r.client_id, r.vehicule_id
        ].some(v => String(v ?? "").toLowerCase().includes(recherche));

        const correspondStatut = !statut || r.statut === statut;
        return correspondRecherche && correspondStatut;
    });

    document.getElementById("results-count").textContent =
        `${filtrees.length} réservation(s) affichée(s) sur ${reservations.length}`;

    if (filtrees.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="table-message">
            Aucune réservation ne correspond à votre recherche.
        </td></tr>`;
        return;
    }

    tbody.innerHTML = filtrees.map(r => `
        <tr>
            <td class="reservation-id">#${r.id}</td>
            <td>Client #${r.client_id}</td>
            <td>Véhicule #${r.vehicule_id}</td>
            <td>${formaterDate(r.date_debut)}</td>
            <td>${formaterDate(r.date_fin)}</td>
            <td>${Number(r.prix_total ?? 0).toLocaleString("fr-FR")} DH</td>
            <td>${afficherStatut(r.statut)}</td>
        </tr>
    `).join("");
}

async function chargerReservations() {
    errorBox.hidden = true;
    tbody.innerHTML = `<tr><td colspan="7" class="table-message">Chargement des réservations...</td></tr>`;

    try {
        const reponse = await fetch(API_RESERVATIONS);

        if (!reponse.ok) {
            throw new Error(`Erreur HTTP ${reponse.status}`);
        }

        const donnees = await reponse.json();

        if (!Array.isArray(donnees)) {
            throw new Error("Format de réponse API inattendu");
        }

        reservations = donnees;
        afficherStatistiques(reservations);
        afficherReservations();

    } catch (erreur) {
        tbody.innerHTML = `<tr><td colspan="7" class="table-message">
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

chargerReservations();
