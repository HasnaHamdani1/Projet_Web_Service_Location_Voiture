// Menu latéral des pages d'administration de PARC AUTO.
// Les adresses viennent de /config.js (frontend/server.py) : variables du compose,
// sinon même machine que la page. Aucune adresse IP n'est écrite ici.
(function () {
    const config = window.APP_CONFIG || {};
    const origine = `${location.protocol}//${location.hostname}`;

    const adresses = {
        // Interface Retours (React, Hasna) : sur le PC de Hasna en mode multi-PC
        retours: () => config.retour || `${origine}:5173`,
        contrats: () => "/Contrat/index.html",
    };

    document.querySelectorAll("[data-module]").forEach((lien) => {
        const adresse = adresses[lien.dataset.module];
        if (adresse) lien.href = adresse();
    });
})();

// Jeton admin expiré ou invalide (base réinitialisée, secret changé, durée dépassée) :
// on l'efface et on revient à la connexion.
(function () {
    const jeton = sessionStorage.getItem("adminToken");
    if (!jeton) {
        location.replace("login.html");
        return;
    }
    const auth = (window.APP_CONFIG || {}).auth || `${location.protocol}//${location.hostname}:8004`;
    fetch(`${auth}/auth/me`, { headers: { Authorization: `Bearer ${jeton}` } })
        .then((reponse) => (reponse.ok ? reponse.json() : Promise.reject(reponse.status)))
        .then((profil) => {
            if (profil.role !== "ADMINISTRATEUR") throw new Error("role");
        })
        .catch((erreur) => {
            // Service Auth injoignable : on ne déconnecte pas pour autant
            if (erreur instanceof TypeError) return;
            sessionStorage.removeItem("adminToken");
            location.replace("login.html");
        });
})();
