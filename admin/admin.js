
const API_VEHICULES = "http://127.0.0.1:8000";

// Vérifier la connexion administrateur
if (!sessionStorage.getItem("adminToken")) {
    window.location.replace("login.html");
}

const STATUTS = [
    "DISPONIBLE",
    "RESERVE",
    "LOUE",
    "MAINTENANCE"
];

const modal = document.getElementById("vehicle-modal");
const form = document.getElementById("vehicle-form");
const tableau = document.getElementById("vehicle-table-body");
const toast = document.getElementById("toast");
const saveButton = document.getElementById("save-vehicle-btn");

let vehiculeEnCours = null;
let toastTimer = null;

// Échapper les caractères HTML
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

// Notifications
function afficherNotification(message, type = "success") {
    toast.textContent = message;
    toast.className = type === "error"
        ? "toast error show"
        : "toast show";

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

// Communication avec l'API et authentification JWT
async function requeteAPI(url, methode = "GET", donnees = null) {

    const token = sessionStorage.getItem("adminToken");

    const options = {
        method: methode,
        headers: {
            "Content-Type": "application/json"
        }
    };

    if (token) {
        options.headers.Authorization = `Bearer ${token}`;
    }

    if (donnees !== null) {
        options.body = JSON.stringify(donnees);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
        let message = "Une erreur est survenue.";

        try {
            const resultat = await response.json();
            message = resultat.detail || message;
        } catch {
            // Réponse non JSON
        }

        if (response.status === 401) {
            sessionStorage.removeItem("adminToken");
            window.location.replace("login.html");
        }

        throw new Error(message);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

// Ouvrir le formulaire d'ajout
function ouvrirFormulaireAjout() {

    vehiculeEnCours = null;
    form.reset();

    document.getElementById("modal-title").textContent =
        "Ajouter un véhicule";

    saveButton.textContent = "Enregistrer";

    document.getElementById("statut").value = "DISPONIBLE";

    modal.hidden = false;

    document.getElementById("immatriculation").focus();
}

// Ouvrir le formulaire de modification
async function ouvrirFormulaireModification(id) {

    try {
        const vehicule = await requeteAPI(
            `${API_VEHICULES}/vehicules/${id}`
        );

        vehiculeEnCours = id;

        document.getElementById("modal-title").textContent =
            "Modifier le véhicule";

        saveButton.textContent = "Enregistrer les modifications";

        document.getElementById("immatriculation").value =
            vehicule.immatriculation;

        document.getElementById("marque").value =
            vehicule.marque;

        document.getElementById("modele").value =
            vehicule.modele;

        document.getElementById("prix_par_jour").value =
            vehicule.prix_par_jour;

        document.getElementById("statut").value =
            vehicule.statut;

        modal.hidden = false;

        document.getElementById("immatriculation").focus();

    } catch (erreur) {
        afficherNotification(erreur.message, "error");
    }
}

// Fermer le formulaire
function fermerModal() {

    modal.hidden = true;
    form.reset();
    vehiculeEnCours = null;
}

// Ajouter ou modifier un véhicule
async function enregistrerVehicule(event) {

    event.preventDefault();

    if (!form.reportValidity()) return;

    const donnees = {
        immatriculation: document
            .getElementById("immatriculation").value.trim(),

        marque: document
            .getElementById("marque").value.trim(),

        modele: document
            .getElementById("modele").value.trim(),

        prix_par_jour: Number(
            document.getElementById("prix_par_jour").value
        ),

        statut: document
            .getElementById("statut").value
    };

    if (
        !donnees.immatriculation ||
        !donnees.marque ||
        !donnees.modele ||
        !Number.isFinite(donnees.prix_par_jour) ||
        donnees.prix_par_jour <= 0 ||
        !STATUTS.includes(donnees.statut)
    ) {
        afficherNotification(
            "Veuillez vérifier les informations saisies.",
            "error"
        );
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Enregistrement...";

    try {

        if (vehiculeEnCours === null) {

            await requeteAPI(
                `${API_VEHICULES}/vehicules`,
                "POST",
                donnees
            );

            fermerModal();

            afficherNotification(
                "Le véhicule a été ajouté avec succès !"
            );

        } else {

            await requeteAPI(
                `${API_VEHICULES}/vehicules/${vehiculeEnCours}`,
                "PUT",
                donnees
            );

            fermerModal();

            afficherNotification(
                "Le véhicule a été modifié avec succès !"
            );
        }

        await chargerVehicules();

    } catch (erreur) {

        afficherNotification(erreur.message, "error");

    } finally {

        saveButton.disabled = false;

        saveButton.textContent =
            vehiculeEnCours === null
                ? "Enregistrer"
                : "Enregistrer les modifications";
    }
}

// Supprimer un véhicule
async function supprimerVehicule(id) {

    const confirmation = confirm(
        `Voulez-vous vraiment supprimer le véhicule n° ${id} ?`
    );

    if (!confirmation) return;

    try {

        await requeteAPI(
            `${API_VEHICULES}/vehicules/${id}`,
            "DELETE"
        );

        afficherNotification(
            "Le véhicule a été supprimé avec succès !"
        );

        await chargerVehicules();

    } catch (erreur) {

        afficherNotification(erreur.message, "error");
    }
}

// Charger les véhicules et les statistiques
async function chargerVehicules() {

    const loading = document.getElementById("loading-message");
    const error = document.getElementById("error-message");
    const empty = document.getElementById("empty-message");

    loading.textContent = "Chargement des véhicules...";
    error.textContent = "";
    empty.hidden = true;

    try {

        const vehicules = await requeteAPI(
            `${API_VEHICULES}/vehicules`
        );

        tableau.innerHTML = "";

        let disponibles = 0;
        let loues = 0;
        let maintenance = 0;

        vehicules.forEach(vehicule => {

            const statut = vehicule.statut;

            if (statut === "DISPONIBLE") disponibles++;
            if (statut === "LOUE") loues++;
            if (statut === "MAINTENANCE") maintenance++;

            let classeStatut = "status-other";

            if (statut === "DISPONIBLE") {
                classeStatut = "status-available";
            } else if (statut === "LOUE") {
                classeStatut = "status-rented";
            } else if (statut === "MAINTENANCE") {
                classeStatut = "status-maintenance";
            } else if (statut === "RESERVE") {
                classeStatut = "status-reserved";
            }

            const ligne = document.createElement("tr");

            ligne.innerHTML = `
                <td>${escapeHTML(vehicule.id)}</td>

                <td>
                    <strong>
                        ${escapeHTML(vehicule.marque)}
                        ${escapeHTML(vehicule.modele)}
                    </strong>
                </td>

                <td>${escapeHTML(vehicule.immatriculation)}</td>

                <td>${escapeHTML(vehicule.prix_par_jour)} DH</td>

                <td>
                    <span class="status ${classeStatut}">
                        ${escapeHTML(statut)}
                    </span>
                </td>

                <td class="vehicle-actions">

                    <button type="button"
                        class="edit-btn"
                        data-action="edit"
                        data-id="${Number(vehicule.id)}">
                        Modifier
                    </button>

                    <button type="button"
                        class="delete-btn"
                        data-action="delete"
                        data-id="${Number(vehicule.id)}">
                        Supprimer
                    </button>

                </td>
            `;

            tableau.appendChild(ligne);
        });

        document.getElementById("total-vehicles").textContent =
            vehicules.length;

        document.getElementById("available-vehicles").textContent =
            disponibles;

        document.getElementById("rented-vehicles").textContent =
            loues;

        document.getElementById("maintenance-vehicles").textContent =
            maintenance;

        empty.hidden = vehicules.length !== 0;

        loading.textContent = "";

    } catch (erreur) {

        loading.textContent = "";
        error.textContent = erreur.message;

        afficherNotification(erreur.message, "error");

        console.error(erreur);
    }
}

// Événements des boutons
document.getElementById("add-vehicle-btn")
    .addEventListener("click", ouvrirFormulaireAjout);

document.getElementById("close-modal-btn")
    .addEventListener("click", fermerModal);

document.getElementById("cancel-modal-btn")
    .addEventListener("click", fermerModal);

modal.addEventListener("click", event => {

    if (event.target === modal) {
        fermerModal();
    }
});

document.addEventListener("keydown", event => {

    if (event.key === "Escape" && !modal.hidden) {
        fermerModal();
    }
});

form.addEventListener("submit", enregistrerVehicule);

// Actions Modifier et Supprimer
tableau.addEventListener("click", event => {

    const bouton = event.target.closest("button[data-action]");

    if (!bouton) return;

    const id = Number(bouton.dataset.id);

    if (!Number.isInteger(id) || id <= 0) return;

    if (bouton.dataset.action === "edit") {
        ouvrirFormulaireModification(id);
    }

    if (bouton.dataset.action === "delete") {
        supprimerVehicule(id);
    }
});

// Déconnexion si le bouton existe dans le HTML
const logoutButton = document.getElementById("logout-btn");

if (logoutButton) {
    logoutButton.addEventListener("click", () => {
        sessionStorage.removeItem("adminToken");
        window.location.replace("login.html");
    });
}

// Chargement initial
chargerVehicules();
