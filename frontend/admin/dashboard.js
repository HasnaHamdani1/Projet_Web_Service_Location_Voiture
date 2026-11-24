const HOST = window.location.hostname;
const API_VEHICULES = `http://${HOST}:8005/vehicules`;

const erreurBox = document.getElementById("dashboard-error");

function afficher(id, valeur) {
    const element = document.getElementById(id);
    if (element) element.textContent = valeur;
}

function afficherBarre(id, valeur, total) {
    const element = document.getElementById(id);
    if (!element) return;

    const pourcentage = total > 0 ? (valeur / total) * 100 : 0;
    element.style.width = `${pourcentage}%`;
}

async function chargerVehicules() {
    try {
        const reponse = await fetch(API_VEHICULES);

        if (!reponse.ok) {
            throw new Error(`Erreur HTTP ${reponse.status}`);
        }

        const liste = await reponse.json();

        if (!Array.isArray(liste)) {
            throw new Error("Format de données invalide");
        }

        const total = liste.length;
        const disponibles = liste.filter(v => v.statut === "DISPONIBLE").length;
        const loues = liste.filter(v => v.statut === "LOUE").length;
        const maintenance = liste.filter(v => v.statut === "MAINTENANCE").length;
        const reserves = liste.filter(v => v.statut === "RESERVE").length;

        afficher("total-vehicles", total);
        afficher("available-vehicles", disponibles);
        afficher("rented-vehicles", loues);
        afficher("maintenance-vehicles", maintenance);

        afficher("fleet-total", total);
        afficher("fleet-available", disponibles);
        afficher("fleet-rented", loues);
        afficher("fleet-maintenance", maintenance);
        afficher("fleet-reserved", reserves);

        afficherBarre("bar-available", disponibles, total);
        afficherBarre("bar-rented", loues, total);
        afficherBarre("bar-maintenance", maintenance, total);
        afficherBarre("bar-reserved", reserves, total);

    } catch (erreur) {
        erreurBox.hidden = false;
        erreurBox.textContent =
            "Impossible de charger les véhicules : " + erreur.message;
    }
}

chargerVehicules();
