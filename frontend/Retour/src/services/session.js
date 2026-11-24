// Session de l'administrateur dans l'interface Retours.
// Le tableau de bord (frontend commun, port 3000) transmet le jeton dans l'ancre de l'adresse
// (…:5173/#jeton=…) : l'ancre n'est jamais envoyée au serveur, et on l'efface aussitôt.
const CLE = 'adminToken';

(function recupererJetonTransmis() {
  const jeton = new URLSearchParams(window.location.hash.slice(1)).get('jeton');
  if (jeton) {
    sessionStorage.setItem(CLE, jeton);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
})();

export const ADMIN_URL =
  import.meta.env.VITE_ADMIN_URL ||
  `${window.location.protocol}//${window.location.hostname}:3000/admin`;

export function jetonAdmin() {
  return sessionStorage.getItem(CLE);
}

function chargeUtile() {
  try {
    const jeton = jetonAdmin();
    const charge = JSON.parse(atob(jeton.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return charge.exp * 1000 > Date.now() ? charge : null;
  } catch {
    return null;
  }
}

// Seul l'administrateur du service Retour (Hasna) utilise cette interface
export function estAdminRetour() {
  const charge = chargeUtile();
  return Boolean(charge && charge.role === 'ADMINISTRATEUR' && charge.service === 'RETOUR');
}

export function idAdmin() {
  return Number(chargeUtile()?.sub) || null;
}

export function entetesAuth(extra = {}) {
  return { ...extra, Authorization: `Bearer ${jetonAdmin() || ''}` };
}

// Déconnexion : jeton effacé, retour à la page d'accueil du site (frontend commun)
export function deconnecter() {
  sessionStorage.removeItem(CLE);
  window.location.href = `${new URL(ADMIN_URL).origin}/`;
}

// Profil de l'administrateur (nom) auprès du service Auth, sur la même machine que le frontend commun
export async function profilAdmin() {
  const auth = import.meta.env.VITE_AUTH_API_URL || `${new URL(ADMIN_URL).protocol}//${new URL(ADMIN_URL).hostname}:8004`;
  const reponse = await fetch(`${auth}/auth/me`, { headers: entetesAuth() });
  if (!reponse.ok) throw new Error(`Auth ${reponse.status}`);
  return reponse.json();
}
