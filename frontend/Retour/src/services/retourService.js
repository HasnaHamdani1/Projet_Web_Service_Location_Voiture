const API_URL = 'http://100.108.179.81:8000';

// Extraire un message lisible des erreurs FastAPI
async function lireErreur(response, defaut) {
  const corps = await response.json().catch(() => null);
  const detail = corps?.detail;

  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => `${(d.loc || []).slice(1).join('.')} : ${d.msg}`)
      .join(' ; ');
  }
  return `${defaut} (${response.status})`;
}

// 1. Liste des retours
export async function getRetours() {
  const response = await fetch(`${API_URL}/retours/liste`);
  if (!response.ok) {
    throw new Error(await lireErreur(response, 'Erreur lors du chargement des retours'));
  }
  return await response.json();
}

// 2. Aperçu : contrat, retard et montant du retard calculés par le backend
//    (avant l'enregistrement, rien n'est écrit en base)
export async function getApercuRetour(numero, dateRetour) {
  const params = new URLSearchParams({
    numero: numero.trim(),
    date_retour: dateRetour,
  });
  const response = await fetch(`${API_URL}/retours/apercu?${params}`);
  if (!response.ok) {
    throw new Error(await lireErreur(response, 'Contrat introuvable'));
  }
  return await response.json();
  // { contrat_id, dateFin, enRetard, dureeRetardJours, montantRetard }
}

// 3. Enregistrer UN retour = UNE ligne dans `retours`
//    Le backend calcule retard et pénalité, puis met à jour véhicule et contrat.
const ETAT_API = {
  'Bon état': 'BON',
  'Léger dommage': 'LEGER_DOMMAGE',
  'Dommage important': 'DOMMAGE_IMPORTANT',
};

export async function creerRetour(data) {
  const bon = data.etat === 'Bon état';

  const payload = {
    contrat_id: Number(data.contratId),
    administrateur_id: Number(data.administrateurId),
    dateRetour: data.dateRetour,
    etatVehicule: ETAT_API[data.etat],
    dommage: bon ? null : (data.description || '').trim(),
    montantDommage: bon ? 0 : Number(data.montantDommage) || 0,
  };

  const response = await fetch(`${API_URL}/retours/traiter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await lireErreur(response, "Erreur lors de l'enregistrement"));
  }
  return await response.json();
}

// 4. Supprimer un retour
export async function supprimerRetour(id) {
  const response = await fetch(`${API_URL}/retours/${id}`, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(await lireErreur(response, 'Erreur lors de la suppression'));
  }
}

// 5. Formatage
export function formatEuro(montant) {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD'
  }).format(Number(montant) || 0);
}

export function formatDateHeure(iso) {
  if (!iso) return null;
  const date = new Date(`${String(iso).substring(0, 10)}T00:00:00`);
  return date.toLocaleDateString('fr-FR');
}