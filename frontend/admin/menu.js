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

    const LIBELLE_SERVICE = {
        VEHICULE: "Service Véhicules",
        RESERVATION: "Service Réservations",
        CONTRAT: "Service Contrats",
        RETOUR: "Service Retours",
    };

    // Déconnexion : le jeton est effacé de ce navigateur, retour à la page d'accueil du site
    function deconnecter() {
        sessionStorage.removeItem("adminToken");
        location.href = "/";
    }

    // Carte de l'administrateur connecté en bas de la barre latérale, avec le bouton de déconnexion
    function carteAdmin() {
        const barre = document.querySelector("aside.sidebar, aside.rail");
        if (!barre || barre.querySelector(".pa-admin")) return;
        const carte = document.createElement("div");
        carte.className = "pa-admin";
        carte.innerHTML = `
            <div class="pa-admin-identite">
                <span class="pa-admin-initiales" aria-hidden="true">A</span>
                <div>
                    <p class="pa-admin-nom" data-admin-nom>Administrateur</p>
                    <p class="pa-admin-service" data-admin-service></p>
                </div>
            </div>
            <button type="button" class="pa-deconnexion">Se déconnecter</button>`;
        carte.querySelector(".pa-deconnexion").addEventListener("click", deconnecter);
        barre.appendChild(carte);
    }

    function afficherAdmin(nom, service) {
        if (nom) {
            document.querySelectorAll("[data-admin-nom]").forEach((el) => { el.textContent = nom; });
            const prenom = nom.split(/\s+/)[0];
            document.querySelectorAll("[data-admin-bienvenue]").forEach((el) => { el.textContent = `Bonjour ${prenom}`; });
            const initiales = nom.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0].toUpperCase()).join("");
            document.querySelectorAll(".pa-admin-initiales, .admin-avatar").forEach((el) => { el.textContent = initiales || "A"; });
        }
        document.querySelectorAll("[data-admin-service]").forEach((el) => {
            el.textContent = LIBELLE_SERVICE[service] || "Administrateur";
        });
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
    carteAdmin();
    appliquer(serviceDuJeton());
    afficherAdmin(null, serviceDuJeton());
    document.querySelectorAll("[data-action=deconnexion]").forEach((el) => {
        el.addEventListener("click", (evenement) => { evenement.preventDefault(); deconnecter(); });
    });

    // 2. Vérification auprès du service Auth : jeton expiré ou invalide → reconnexion
    const auth = config.auth || `${origine}:8004`;
    fetch(`${auth}/auth/me`, { headers: { Authorization: `Bearer ${jeton}` } })
        .then((reponse) => (reponse.ok ? reponse.json() : Promise.reject(reponse.status)))
        .then((profil) => {
            if (profil.role !== "ADMINISTRATEUR") throw new Error("role");
            appliquer(profil.service);
            afficherAdmin(profil.nom, profil.service);
        })
        .catch((erreur) => {
            // Service Auth injoignable : on garde l'affichage d'après le jeton
            if (erreur instanceof TypeError) return;
            sessionStorage.removeItem("adminToken");
            location.replace("/admin/login.html");
        });
})();
