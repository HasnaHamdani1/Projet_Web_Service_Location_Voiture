// Liens du menu latéral vers les autres modules de PARC AUTO.
// Les adresses viennent de /config.js (frontend/server.py) : même machine que la page par défaut.
(function () {
    const config = window.APP_CONFIG || {};
    const origine = `${location.protocol}//${location.hostname}`;

    const adresses = {
        // Site de réservation (Maryam) : le jeton de l'admin connecté est transmis dans l'ancre,
        // jamais envoyé au serveur ; le site le vérifie auprès de GET /auth/me puis l'efface.
        reservations: () => {
            const jeton = sessionStorage.getItem("adminToken");
            const site = config.booking || `${origine}:3002`;
            return jeton
                ? `${site}/admin/reservations#jeton=${encodeURIComponent(jeton)}`
                : `${site}/admin/acces`;
        },
        contrats: () => "/Contrat/index.html",
        retours: () => config.retour || `${origine}:5173`,
    };

    document.querySelectorAll("[data-module]").forEach((lien) => {
        const adresse = adresses[lien.dataset.module];
        if (!adresse) return;
        lien.href = adresse();
        // Le jeton peut changer (reconnexion) : recalculer l'adresse au moment du clic
        lien.addEventListener("click", () => { lien.href = adresse(); });
    });
})();
