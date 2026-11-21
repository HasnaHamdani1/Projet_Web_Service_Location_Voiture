const API_VEHICULES = "http://100.106.223.93:8005/vehicules";
const API_RETOURS = "http://127.0.0.1:8000/retours/liste";

const erreurBox = document.getElementById("dashboard-error");

function afficher(id, valeur) {
    document.getElementById(id).textContent = valeur;
}

function ajouterErreur(message) {
    erreurBox.hidden = false;
    erreurBox.textContent += (erreurBox.textContent ? " " : "") + message;
}

async function chargerVehicules() {
    const reponse = await fetch(API_VEHICULES);
    if (!reponse.ok) throw new Error(`Erreur HTTP ${reponse.status}`);
    const liste = await reponse.json();

    afficher("total-vehicles", liste.length);
    afficher("available-vehicles", liste.filter(v => v.statut === "DISPONIBLE").length);
    afficher("rented-vehicles", liste.filter(v => v.statut === "LOUE").length);
    afficher("maintenance-vehicles", liste.filter(v => v.statut === "MAINTENANCE").length);
}

async function chargerRetours() {
    const reponse = await fetch(API_RETOURS);
    if (!reponse.ok) throw new Error(`Erreur HTTP ${reponse.status}`);
    const liste = await reponse.json();

    afficher("total-retours", liste.length);
    afficher("retours-heure", liste.filter(r => Number(r.retard) === 0).length);
    afficher("retours-retard", liste.filter(r => Number(r.retard) > 0).length);
    afficher("retours-dommage", liste.filter(r => r.etat && r.etat !== "Bon état").length);
}

chargerVehicules().catch(e => ajouterErreur("Véhicules indisponibles : " + e.message + "."));
chargerRetours().catch(e => ajouterErreur("Retours indisponibles : " + e.message + "."));