/**
 * Prépare les données utilisées par l'écran de liste.
 * Ce module ne touche pas au DOM et ne remplace pas les règles métier du backend.
 */
export function calculerIndicateursContrats(contrats, dateReference = new Date()) {
  const mois = `${dateReference.getFullYear()}-${String(dateReference.getMonth() + 1).padStart(2, "0")}`;
  const contratsCeMois = contrats.filter(contrat =>
    String(contrat.date_generation || "").startsWith(mois)
  ).length;
  const enAttente = contrats.filter(contrat => contrat.statut === "EN_ATTENTE").length;
  const valides = contrats.filter(contrat => contrat.statut === "VALIDE").length;

  return {
    contratsCeMois,
    enAttente,
    valides,
    moisLibelle: new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
    }).format(dateReference),
    maximum: Math.max(1, contratsCeMois, enAttente, valides),
    statuts: [...new Set(contrats.map(contrat => contrat.statut).filter(Boolean))],
  };
}

/** Filtre, enrichit et pagine les contrats pour les transmettre à l'interface. */
export function preparerPageContrats({
  contrats,
  vehicules = [],
  recherche = "",
  statut = "",
  page = 1,
  taille = 6,
}) {
  const filtres = contrats
    .map(contrat => {
      const reservation = contrat.reservation || {};
      const vehiculeId = reservation.vehicule_id ?? contrat.vehicule_id;
      const vehicule = vehicules.find(item => Number(item.id) === Number(vehiculeId));
      const texteRecherche = [
        contrat.numero_contrat,
        reservation.client_id,
        contrat.reservation_id,
        vehicule?.immatriculation,
      ].join(" ").toLowerCase();

      return { contrat, reservation, vehiculeId, vehicule, texteRecherche };
    })
    .filter(item => item.texteRecherche.includes(recherche) &&
      (!statut || item.contrat.statut === statut));

  const nombrePages = Math.max(1, Math.ceil(filtres.length / taille));
  const pageCourante = Math.min(Math.max(1, page), nombrePages);
  const debut = (pageCourante - 1) * taille;

  return {
    lignes: filtres.slice(debut, debut + taille).map(item => ({
      ...item,
      client: item.reservation.client_id
        ? `Client #${item.reservation.client_id}`
        : "—",
      vehiculeTexte: item.vehicule?.immatriculation ||
        (item.vehiculeId ? `Véhicule #${item.vehiculeId}` : "—"),
    })),
    totalFiltres: filtres.length,
    nombrePages,
    pageCourante,
    premiereLigne: filtres.length ? debut + 1 : 0,
    derniereLigne: Math.min(debut + taille, filtres.length),
  };
}
