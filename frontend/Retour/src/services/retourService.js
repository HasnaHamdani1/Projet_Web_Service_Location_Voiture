
const API_URL = 'http://127.0.0.1:8000';

// ==========================================
// 1. Récupérer la liste des retours depuis MySQL
// ==========================================
export async function getRetours() {
  const response = await fetch(`${API_URL}/retours/liste`);

  if (!response.ok) {
    throw new Error(
      `Erreur lors du chargement des retours : ${response.status}`
    );
  }

  return await response.json();
}

// ==========================================
// 2. Récupérer un retour par numéro de contrat
// ==========================================
export async function getRetourByContrat(contrat) {
  const retours = await getRetours();

  return retours.find(
    (r) =>
      r.contrat?.toLowerCase() === contrat.trim().toLowerCase()
  ) || null;
}

// ==========================================
// 3. Formater les montants en dirhams marocains
// ==========================================
export function formatEuro(montant) {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD'
  }).format(Number(montant) || 0);
}

// ==========================================
// 4. Formater les dates provenant de MySQL
// ==========================================
export function formatDateHeure(iso) {
  if (!iso) return null;

  const date = new Date(`${String(iso).substring(0, 10)}T00:00:00`);

  return date.toLocaleDateString('fr-FR');
}
