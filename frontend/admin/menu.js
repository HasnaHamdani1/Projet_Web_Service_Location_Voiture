// Menu et droits des pages d'administration de PARC AUTO (pages admin et pages Contrat).
// Chaque administrateur gère UN service (claim « service » du jeton de service_auth) :
//   VEHICULE (Leila), RESERVATION (Maryam), CONTRAT (Sara), RETOUR (Hasna).
// Il voit le Dashboard et le menu de son service seulement ; les API refusent de toute façon (403)
// les actions d'un administrateur d'un autre service.
// Adresses : /config.js (frontend/server.py), sinon même machine que la page. Aucune IP écrite ici.
(function () {
    const config = window.APP_CONFIG || {};
    const origine = `${location.protocol}//${location.hostname}`;
    const jeton = sessionStorage.getItem("adminToken");

    if (!jeton) {
        location.replace("/admin/login.html");
        return;
    }

    // Service requis par chaque entrée du menu (Dashboard : tous les administrateurs)
    const SERVICE_DU_MODULE = {
        vehicules: "VEHICULE",
        reservations: "RESERVATION",
        contrats: "CONTRAT",
        retours: "RETOUR",
    };

    const adresses = {
        dashboard: () => "/admin/dashboard.html",
        vehicules: () => "/admin/admin.html",
        reservations: () => "/admin/reservations.html",
        contrats: () => "/Contrat/index.html",
        // Interface Retours (React, autre port) : le jeton est transmis dans l'ancre, jamais envoyé au serveur
        retours: () => `${config.retour || `${origine}:5173`}/#jeton=${encodeURIComponent(jeton)}`,
    };

    function serviceDuJeton() {
        try {
            const charge = JSON.parse(atob(jeton.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
            return charge.service || null;
        } catch {
            return null;
        }
    }

    function appliquer(service) {
        document.querySelectorAll("[data-module]").forEach((lien) => {
            const module = lien.dataset.module;
            if (adresses[module]) lien.href = adresses[module]();
            const requis = SERVICE_DU_MODULE[module];
            const visible = !requis || requis === service;
            const cible = lien.closest("li") || lien;
            cible.hidden = !visible;
            cible.style.display = visible ? "" : "none";
        });
        // Page d'un autre service : retour au Dashboard
        const requisPage = document.body?.dataset.service;
        if (requisPage && requisPage !== service) {
            location.replace("/admin/dashboard.html?acces=refuse");
        }
    }

    // 1. Affichage immédiat d'après le jeton (pas de clignotement du menu)
    appliquer(serviceDuJeton());

    // 2. Vérification auprès du service Auth : jeton expiré ou invalide → reconnexion
    const auth = config.auth || `${origine}:8004`;
    fetch(`${auth}/auth/me`, { headers: { Authorization: `Bearer ${jeton}` } })
        .then((reponse) => (reponse.ok ? reponse.json() : Promise.reject(reponse.status)))
        .then((profil) => {
            if (profil.role !== "ADMINISTRATEUR") throw new Error("role");
            appliquer(profil.service);
            document.querySelectorAll("[data-admin-nom]").forEach((el) => { el.textContent = profil.nom; });
        })
        .catch((erreur) => {
            // Service Auth injoignable : on garde l'affichage d'après le jeton
            if (erreur instanceof TypeError) return;
            sessionStorage.removeItem("adminToken");
            location.replace("/admin/login.html");
        });
})();
