
const API_URL = "http://127.0.0.1:8000";

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

    const donnees = {
        username: document.getElementById("username").value.trim(),
        password: document.getElementById("password").value
    };

    try {
        const response = await fetch(`${API_URL}/admin/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(donnees)
        });

        const resultat = await response.json();

        if (!response.ok) {
            throw new Error(
                resultat.detail || "Impossible de se connecter."
            );
        }

        sessionStorage.setItem(
            "adminToken",
            resultat.access_token
        );

        window.location.replace("admin.html");

    } catch (erreur) {
        errorMessage.textContent = erreur.message;
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Se connecter";
    }
});
