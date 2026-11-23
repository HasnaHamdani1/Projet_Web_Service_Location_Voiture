// Service Authentification (port publié par Docker Compose : 8004)
const API_AUTH = "http://localhost:8004";

const form = document.getElementById("login-form");
const errorMessage = document.getElementById("error-message");
const loginButton = document.getElementById("login-button");

// Si un jeton existe déjà, ouvrir directement le dashboard
if (sessionStorage.getItem("adminToken")) {
    window.location.replace("admin.html");
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    errorMessage.textContent = "";
    loginButton.disabled = true;
    loginButton.textContent = "Connexion...";

    // Le service Auth attend "email" et "mot_de_passe"
    const donnees = {
        email: document.getElementById("username").value.trim(),
        mot_de_passe: document.getElementById("password").value
    };

    try {
        const response = await fetch(`${API_AUTH}/auth/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(donnees)
        });

        const resultat = await response.json();

        if (!response.ok) {
            // En cas d'erreur 422 (validation), detail est une liste
            const detail = Array.isArray(resultat.detail)
                ? "E-mail ou mot de passe invalide."
                : resultat.detail;
            throw new Error(detail || "Impossible de se connecter.");
        }

        // Seul un administrateur peut accéder à cet espace
        const payload = JSON.parse(
            atob(resultat.access_token.split(".")[1]
                .replace(/-/g, "+").replace(/_/g, "/"))
        );

        if (payload.role !== "ADMINISTRATEUR") {
            throw new Error("Ce compte n'est pas un compte administrateur.");
        }

        sessionStorage.setItem("adminToken", resultat.access_token);
        window.location.replace("admin.html");

    } catch (erreur) {
        errorMessage.textContent =
            erreur instanceof TypeError
                ? "Service d'authentification injoignable (http://localhost:8004)."
                : erreur.message;
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Se connecter";
    }
});