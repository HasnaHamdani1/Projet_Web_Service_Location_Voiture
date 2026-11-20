
const API_VEHICULES = "http://100.106.223.93:8005/vehicules";
const STATUTS = [
    "DISPONIBLE",
    "RESERVE",
    "LOUE",
    "MAINTENANCE"
];

let vehiculeEnCours = null;
let vehicules = [];

const formulaire = document.getElementById("vehicle-form");
const modal = document.getElementById("vehicle-modal");
const corpsTableau = document.getElementById("vehicle-table-body");
const boutonEnregistrer = document.getElementById("save-vehicle-btn");


// Échapper les caractères spéciaux avant insertion HTML
function echapperHTML(valeur) {
    return String(valeur ?? "").replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[caractere]);
}


// Communication avec l'API, sans authentification
async function requeteAPI(url, methode = "GET", donnees = null) {
    const options = {
        method: methode,
        headers: {}
    };

    if (donnees !== null) {
        options.headers["Content-Type"] = "application/json";
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

        throw new Error(message);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}


// Afficher une notification
function afficherNotification(message) {
    const toast = document.getElementById("toast");

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}


// Afficher ou masquer un message
function afficherErreur(message) {
    document.getElementById("error-message").textContent = message;
}

function effacerErreur() {
    afficherErreur("");
}


// Ouvrir le formulaire pour ajouter
function ouvrirFormulaireAjout() {
    vehiculeEnCours = null;

    formulaire.reset();

    document.getElementById("modal-title").textContent =
        "Ajouter un véhicule";

    boutonEnregistrer.textContent = "Enregistrer";

    document.getElementById("statut").value = "DISPONIBLE";

    modal.hidden = false;

    document.getElementById("immatriculation").focus();
}


// Ouvrir le formulaire pour modifier
async function ouvrirFormulaireModification(id) {
    try {
        effacerErreur();

        const vehicule = await requeteAPI(`${API_VEHICULES}/${id}`);

        vehiculeEnCours = id;

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

        document.getElementById("modal-title").textContent =
            "Modifier un véhicule";

        boutonEnregistrer.textContent = "Enregistrer les modifications";

        modal.hidden = false;

    } catch (erreur) {
        afficherNotification(erreur.message);
    }
}


// Fermer le formulaire
function fermerModal() {
    modal.hidden = true;
    formulaire.reset();
    vehiculeEnCours = null;
    boutonEnregistrer.textContent = "Enregistrer";
}


// Enregistrer un véhicule : ajout ou modification
async function enregistrerVehicule(event) {
    event.preventDefault();

 
    const prix = Number(document.getElementById("prix_par_jour").value);

    const donnees = {
        immatriculation: document.getElementById("immatriculation").value.trim(),
        marque: document.getElementById("marque").value.trim(),
        modele: document.getElementById("modele").value.trim(),
        prix_par_jour: prix,
        statut: document.getElementById("statut").value
    };

    if (
        !donnees.immatriculation ||
        !donnees.marque ||
        !donnees.modele
    ) {
        afficherNotification("Veuillez remplir tous les champs.");
        return;
    }

   

    if (!Number.isFinite(prix) || prix <= 0) {
        afficherNotification("Le prix doit être supérieur à zéro.");
        return;
    }

    const idAModifier = vehiculeEnCours;

    boutonEnregistrer.disabled = true;
    boutonEnregistrer.textContent = "Enregistrement...";

    try {
        if (idAModifier !== null) {
            await requeteAPI(
                `${API_VEHICULES}/${idAModifier}`,
                "PUT",
                donnees
            );

            afficherNotification("Véhicule modifié avec succès.");
        } else {
            await requeteAPI(
                API_VEHICULES,
                "POST",
                donnees
            );

            afficherNotification("Véhicule ajouté avec succès.");
        }

        fermerModal();
        await chargerVehicules();

    } catch (erreur) {
        afficherNotification(erreur.message);

    } finally {
        boutonEnregistrer.disabled = false;
        boutonEnregistrer.textContent =
            vehiculeEnCours !== null
                ? "Enregistrer les modifications"
                : "Enregistrer";
    }
}


// Supprimer un véhicule
async function supprimerVehicule(id) {
    const confirmation = confirm(
        "Voulez-vous vraiment supprimer ce véhicule ?"
    );

    if (!confirmation) {
        return;
    }

    try {
        await requeteAPI(`${API_VEHICULES}/${id}`, "DELETE");

        afficherNotification("Véhicule supprimé avec succès.");

        await chargerVehicules();

    } catch (erreur) {
        afficherNotification(erreur.message);
    }
}


// Afficher les véhicules dans le tableau
function afficherVehicules(liste) {
    corpsTableau.innerHTML = "";

    const messageVide = document.getElementById("empty-message");

    if (liste.length === 0) {
        messageVide.hidden = false;
        return;
    }

    messageVide.hidden = true;

    liste.forEach(vehicule => {
        const ligne = document.createElement("tr");

        const statut = STATUTS.includes(vehicule.statut)
            ? vehicule.statut
            : "DISPONIBLE";

        ligne.innerHTML = `
            <td>${echapperHTML(vehicule.id)}</td>

            <td>
                <strong>
                    ${echapperHTML(vehicule.marque)}
                    ${echapperHTML(vehicule.modele)}
                </strong>
            </td>

            

            <td>${echapperHTML(vehicule.immatriculation)}</td>

            <td>${echapperHTML(vehicule.prix_par_jour)} DH</td>

            <td>
                <span class="status-badge status-${statut.toLowerCase()}">
                    ${echapperHTML(statut)}
                </span>
            </td>

            <td>
                <button type="button"
                    class="secondary-btn"
                    data-action="edit"
                    data-id="${Number(vehicule.id)}">
                    Modifier
                </button>

                <button type="button"
                    class="secondary-btn"
                    data-action="delete"
                    data-id="${Number(vehicule.id)}">
                    Supprimer
                </button>
            </td>
        `;

        corpsTableau.appendChild(ligne);
    });
}


// Mettre à jour les statistiques
function mettreAJourStatistiques(liste) {
    document.getElementById("total-vehicles").textContent =
        liste.length;

    document.getElementById("available-vehicles").textContent =
        liste.filter(v => v.statut === "DISPONIBLE").length;

    document.getElementById("rented-vehicles").textContent =
        liste.filter(v => v.statut === "LOUE").length;

    document.getElementById("maintenance-vehicles").textContent =
        liste.filter(v => v.statut === "MAINTENANCE").length;
}


// Charger les véhicules depuis l'API
async function chargerVehicules() {
    const messageChargement =
        document.getElementById("loading-message");

    try {
        effacerErreur();

        messageChargement.textContent = "Chargement des véhicules...";

        vehicules = await requeteAPI(API_VEHICULES);

        afficherVehicules(vehicules);
        mettreAJourStatistiques(vehicules);

    } catch (erreur) {
        afficherErreur(
            "Impossible de charger les véhicules : " + erreur.message
        );

    } finally {
        messageChargement.textContent = "";
    }
}


// Boutons et événements
document.getElementById("add-vehicle-btn")
    .addEventListener("click", ouvrirFormulaireAjout);

document.getElementById("close-modal-btn")
    .addEventListener("click", fermerModal);

document.getElementById("cancel-modal-btn")
    .addEventListener("click", fermerModal);

formulaire.addEventListener("submit", enregistrerVehicule);


// Actions Modifier et Supprimer dans le tableau
corpsTableau.addEventListener("click", event => {
    const bouton = event.target.closest("button[data-action]");

    if (!bouton) {
        return;
    }

    const id = Number(bouton.dataset.id);

    if (bouton.dataset.action === "edit") {
        ouvrirFormulaireModification(id);
    }

    if (bouton.dataset.action === "delete") {
        supprimerVehicule(id);
    }
});


// Fermer le modal en cliquant à l'extérieur
modal.addEventListener("click", event => {
    if (event.target === modal) {
        fermerModal();
    }
});


// Chargement initial du dashboard
chargerVehicules();

