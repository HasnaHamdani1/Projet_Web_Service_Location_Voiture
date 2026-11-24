
// Adresse du service Véhicule : config.js (frontend/server.py), même machine que la page par défaut
const API_VEHICULES = `${window.APP_CONFIG?.vehicle || `${location.protocol}//${location.hostname}:8005`}/vehicules`;
const API_BASE = new URL(API_VEHICULES).origin;

const STATUTS = [
    "DISPONIBLE",
    "RESERVE",
    "LOUE",
    "MAINTENANCE"
];

let vehiculeEnCours = null;
let vehicules = [];
let urlApercuTemporaire = null;

const formulaire = document.getElementById("vehicle-form");
const modal = document.getElementById("vehicle-modal");
const corpsTableau = document.getElementById("vehicle-table-body");
const boutonEnregistrer = document.getElementById("save-vehicle-btn");

const champImage = document.getElementById("image");
const conteneurApercu = document.getElementById("image-preview-container");
const imageApercu = document.getElementById("image-preview");


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


// Identifiant de l'administrateur connecté (champ "sub" du jeton du service Auth)
function idAdministrateur() {
    try {
        const jeton = sessionStorage.getItem("adminToken");
        const payload = JSON.parse(atob(jeton.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        return Number(payload.sub);
    } catch {
        return null;
    }
}


// Communication avec l'API
async function requeteAPI(url, methode = "GET", donnees = null) {
    const options = {
        method: methode,
        // Jeton de l'administrateur : le service Véhicule réserve l'écriture à son administrateur
        headers: { Authorization: `Bearer ${sessionStorage.getItem("adminToken") || ""}` }
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


// Envoyer la photo au service véhicule
async function envoyerPhotoVehicule(id, fichier) {
    const formulaireImage = new FormData();

    formulaireImage.append("image", fichier);

    const response = await fetch(
        `${API_VEHICULES}/${id}/image`,
        {
            method: "POST",
            headers: { Authorization: `Bearer ${sessionStorage.getItem("adminToken") || ""}` },
            body: formulaireImage
        }
    );

    if (!response.ok) {
        let message = "Impossible d'envoyer la photo.";

        try {
            const resultat = await response.json();
            message = resultat.detail || message;
        } catch {
            // Réponse non JSON
        }

        throw new Error(message);
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


// Gérer l'aperçu de la photo
function afficherApercuPhoto(url) {
    if (!conteneurApercu || !imageApercu) {
        return;
    }

    imageApercu.src = url;
    conteneurApercu.hidden = false;
}


function effacerApercuPhoto() {
    if (urlApercuTemporaire) {
        URL.revokeObjectURL(urlApercuTemporaire);
        urlApercuTemporaire = null;
    }

    if (imageApercu) {
        imageApercu.src = "";
    }

    if (conteneurApercu) {
        conteneurApercu.hidden = true;
    }

    if (champImage) {
        champImage.value = "";
    }
}


// Vérifier et afficher la photo sélectionnée
if (champImage) {
    champImage.addEventListener("change", () => {
        const fichier = champImage.files[0];

        if (!fichier) {
            return;
        }

        const typesAutorises = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!typesAutorises.includes(fichier.type)) {
            afficherNotification(
                "Format non autorisé. Utilisez JPG, PNG ou WEBP."
            );

            champImage.value = "";
            return;
        }

        if (fichier.size > 5 * 1024 * 1024) {
            afficherNotification(
                "La taille maximale de la photo est de 5 Mo."
            );

            champImage.value = "";
            return;
        }

        if (urlApercuTemporaire) {
            URL.revokeObjectURL(urlApercuTemporaire);
        }

        urlApercuTemporaire = URL.createObjectURL(fichier);

        afficherApercuPhoto(urlApercuTemporaire);
    });
}


// Ouvrir le formulaire pour ajouter
function ouvrirFormulaireAjout() {
    vehiculeEnCours = null;

    formulaire.reset();
    effacerApercuPhoto();
    effacerErreur();

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

        formulaire.reset();
        effacerApercuPhoto();

        document.getElementById("immatriculation").value =
            vehicule.immatriculation;

        document.getElementById("marque").value =
            vehicule.marque;

        document.getElementById("modele").value =
            vehicule.modele;

        document.getElementById("annee").value =
            vehicule.annee ?? "";

        document.getElementById("prix_par_jour").value =
            vehicule.prix_par_jour;

        document.getElementById("statut").value =
            vehicule.statut;

        // Afficher l'ancienne photo si elle existe
        if (vehicule.image_url) {
            const urlPhoto = new URL(
                vehicule.image_url,
                API_BASE
            ).href;

            afficherApercuPhoto(urlPhoto);
        }

        document.getElementById("modal-title").textContent =
            "Modifier un véhicule";

        boutonEnregistrer.textContent =
            "Enregistrer les modifications";

        modal.hidden = false;

    } catch (erreur) {
        afficherNotification(erreur.message);
    }
}


// Fermer le formulaire
function fermerModal() {
    modal.hidden = true;
    formulaire.reset();

    effacerApercuPhoto();

    vehiculeEnCours = null;

    boutonEnregistrer.textContent = "Enregistrer";
}


// Enregistrer un véhicule : ajout ou modification
async function enregistrerVehicule(event) {
    event.preventDefault();

    const prix = Number(
        document.getElementById("prix_par_jour").value
    );

    const donnees = {
        immatriculation: document.getElementById("immatriculation").value.trim(),
        marque: document.getElementById("marque").value.trim(),
        modele: document.getElementById("modele").value.trim(),
        annee: Number(document.getElementById("annee").value),
        prix_par_jour: prix,
        statut: document.getElementById("statut").value
    };

    const fichierImage = champImage
        ? champImage.files[0]
        : null;

    if (
        !donnees.immatriculation ||
        !donnees.marque ||
        !donnees.modele
    ) {
        afficherNotification("Veuillez remplir tous les champs.");
        return;
    }

    if (!Number.isInteger(donnees.annee) || donnees.annee < 1950 || donnees.annee > 2100) {
        afficherNotification("Indiquez une année valide (ex : 2023).");
        return;
    }

    if (!Number.isFinite(prix) || prix <= 0) {
        afficherNotification("Le prix doit être supérieur à zéro.");
        return;
    }

    if (fichierImage) {
        const typesAutorises = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!typesAutorises.includes(fichierImage.type)) {
            afficherNotification("Format de photo non autorisé.");
            return;
        }

        if (fichierImage.size > 5 * 1024 * 1024) {
            afficherNotification("La photo ne doit pas dépasser 5 Mo.");
            return;
        }
    }

    const idAModifier = vehiculeEnCours;

    boutonEnregistrer.disabled = true;
    boutonEnregistrer.textContent = "Enregistrement...";

    try {
        let vehiculeEnregistre;

        if (idAModifier !== null) {

            // Modifier les informations du véhicule
            vehiculeEnregistre = await requeteAPI(
                `${API_VEHICULES}/${idAModifier}`,
                "PUT",
                donnees
            );

        } else {

            // Ajouter un nouveau véhicule (administrateur connecté = id du jeton)
            vehiculeEnregistre = await requeteAPI(
                API_VEHICULES,
                "POST",
                { ...donnees, administrateur_id: idAdministrateur() }
            );
        }

        // Envoyer la photo si une nouvelle photo est sélectionnée
        if (fichierImage) {
            await envoyerPhotoVehicule(
                vehiculeEnregistre.id,
                fichierImage
            );
        }

        afficherNotification(
            idAModifier !== null
                ? "Véhicule modifié avec succès."
                : "Véhicule ajouté avec succès."
        );

        fermerModal();

        await chargerVehicules();

    } catch (erreur) {
        afficherNotification(erreur.message);

        // Actualiser la liste même si l'envoi de la photo échoue :
        // le véhicule peut déjà avoir été enregistré.
        await chargerVehicules();

    } finally {
        boutonEnregistrer.disabled = false;

        boutonEnregistrer.textContent =
            idAModifier !== null
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

        // Construire l'adresse complète de la photo
        const urlPhoto = vehicule.image_url
            ? new URL(vehicule.image_url, API_BASE).href
            : null;

        const affichagePhoto = urlPhoto
            ? `
                <img
                    src="${echapperHTML(urlPhoto)}"
                    alt="Photo de ${echapperHTML(vehicule.marque)} ${echapperHTML(vehicule.modele)}"
                    style="width: 65px; height: 45px; object-fit: cover; border-radius: 6px; margin-right: 8px; vertical-align: middle;"
                >
            `
            : `
                <span style="color: #999; font-size: 12px;">
                    Aucune photo
                </span>
            `;

        ligne.innerHTML = `
            <td>${echapperHTML(vehicule.id)}</td>

            <td>
                ${affichagePhoto}
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


// Mettre à jour les statistiques si les éléments existent
function mettreAJourStatistiques(liste) {
    const total = document.getElementById("total-vehicles");
    const disponibles = document.getElementById("available-vehicles");
    const loues = document.getElementById("rented-vehicles");
    const maintenance = document.getElementById("maintenance-vehicles");

    if (total) {
        total.textContent = liste.length;
    }

    if (disponibles) {
        disponibles.textContent =
            liste.filter(v => v.statut === "DISPONIBLE").length;
    }

    if (loues) {
        loues.textContent =
            liste.filter(v => v.statut === "LOUE").length;
    }

    if (maintenance) {
        maintenance.textContent =
            liste.filter(v => v.statut === "MAINTENANCE").length;
    }
}


// Charger les véhicules depuis l'API
async function chargerVehicules() {
    const messageChargement =
        document.getElementById("loading-message");

    try {
        effacerErreur();

        messageChargement.textContent =
            "Chargement des véhicules...";

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

        

