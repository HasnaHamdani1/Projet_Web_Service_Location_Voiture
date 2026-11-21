/** Fonctions d'accès aux routes du service Contrat. */
export function creerApiContrats(request) {
  return {
    lister: () => request("contract", "/contrats"),
    creer: reservationId => request("contract", "/contrats", {
      method: "POST",
      body: JSON.stringify({ reservation_id: Number(reservationId) }),
    }),
    enregistrerCaution: (contratId, montant) => request(
      "contract",
      `/contrats/${Number(contratId)}/caution`,
      { method: "POST", body: JSON.stringify({ montant_caution: Number(montant) }) },
    ),
    valider: contratId => request(
      "contract",
      `/contrats/${Number(contratId)}/validation`,
      { method: "POST" },
    ),
    finaliser: contrat => request("contract", "/contrats/finalisation", {
      method: "POST",
      body: JSON.stringify({
        reservation_id: Number(contrat.reservation_id),
        numero_contrat: contrat.numero_contrat,
        montant_caution: Number(contrat.montant_caution),
        signatures_confirmees: true,
      }),
    }),
  };
}
