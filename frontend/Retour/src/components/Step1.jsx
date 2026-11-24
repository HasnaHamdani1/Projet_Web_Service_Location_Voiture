import React, { useState } from 'react';

export default function Step1({ data, setData, onNext, initial }) {
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);
  const maj = (champ) => (e) => setData({ ...data, [champ]: e.target.value });

  const soumettre = async (ev) => {
    ev.preventDefault();
    setErreur('');
    if (!data.contrat.trim() || !data.immat.trim() || !data.dateRetour) {
      setErreur('Renseignez le numéro de contrat, l\'immatriculation et la date de retour.');
      return;
    }
    setChargement(true);
    const retour = await getRetourByContrat(data.contrat);
    setChargement(false);
    if (!retour) return setErreur(`Aucun contrat « ${data.contrat} » trouvé. Vérifiez le numéro.`);
    if (retour.immat.toLowerCase() !== data.immat.trim().toLowerCase())
      return setErreur(`L'immatriculation ne correspond pas au contrat ${retour.contrat}.`);

    const retard = calculerRetard(retour.prevu, data.dateRetour);
    setData({
      ...data,
      contrat: retour.contrat, immat: retour.immat, vehicule: retour.vehicule, prevu: retour.prevu,
      retard, penalite: calculerPenalite(retard),
    });
    onNext();
  };

  return (
    <form onSubmit={soumettre} noValidate>
      <h3 className="section-titre">🪪 Identifiants clés</h3>
      <div className="grille-2">
        <label className="champ">
          <span className="champ-label">Numéro de contrat <em>Obligatoire</em></span>
          <input value={data.contrat} onChange={maj('contrat')} placeholder="CTR-8492-FR" />
        </label>
        <label className="champ">
          <span className="champ-label">Immatriculation <em>Obligatoire</em></span>
          <input value={data.immat} onChange={maj('immat')} placeholder="FG-418-XY" />
        </label>
      </div>

      <hr />
      <h3 className="section-titre">📅 Dates de restitution</h3>
      <label className="champ champ-moitie">
        <span className="champ-label">Date de retour effective / constatée</span>
        <input type="date" value={data.dateRetour} onChange={maj('dateRetour')} />
      </label>

      {erreur && <p className="erreur" role="alert">{erreur}</p>}

      <div className="actions">
        <button type="button" className="btn btn-secondary" onClick={() => { setData(initial); setErreur(''); }}>↻ Réinitialiser</button>
        <button type="submit" className="btn btn-primary" disabled={chargement}>Entrer / Valider →</button>
      </div>
    </form>
  );
}