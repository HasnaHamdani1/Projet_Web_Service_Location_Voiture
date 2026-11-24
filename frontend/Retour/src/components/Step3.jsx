import React from 'react';
import { formatEuro } from '../services/retourService';

const STATUTS_CONTRAT = ['Clôturé', 'Clôturé avec litige', 'En cours'];
const STATUTS_VEHICULE = ['Disponible', 'En réparation / Indisponible', 'À inspecter'];

export default function Step3({ data, setData, onBack, onSubmit }) {
  const total = data.penalite + (Number(data.montantDommage) || 0);
  const maj = (champ) => (e) => setData({ ...data, [champ]: e.target.value });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <h3 className="section-titre">🪪 1. Identifiants du dossier</h3>
      <div className="grille-2">
        <label className="champ"><span className="champ-label">Numéro de contrat</span><input value={data.contrat} readOnly /></label>
        <label className="champ"><span className="champ-label">Immatriculation</span><input value={data.immat} readOnly /></label>
      </div>

      <h3 className="section-titre">⚠️ 2. Dommages &amp; pénalités finales</h3>
      <div className="grille-2">
        <label className="champ">
          <span className="champ-label">Montant du dommage (€)</span>
          <input type="number" min="0" step="0.01" value={data.montantDommage}
            onChange={(e) => setData({ ...data, montantDommage: e.target.value })} />
        </label>
        <label className="champ">
          <span className="champ-label">Total à facturer (€)</span>
          <input className="total" value={formatEuro(total)} readOnly />
          <small className="aide">Pénalité de retard ({formatEuro(data.penalite)}) + dommage</small>
        </label>
      </div>

      <h3 className="section-titre">☑️ 3. Statuts du retour</h3>
      <div className="grille-2">
        <label className="champ">
          <span className="champ-label">Statut du contrat</span>
          <select value={data.statutContrat} onChange={maj('statutContrat')}>
            {STATUTS_CONTRAT.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="champ">
          <span className="champ-label">Statut du véhicule</span>
          <select value={data.statutVehicule} onChange={maj('statutVehicule')}>
            {STATUTS_VEHICULE.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <div className="actions">
        <button type="button" className="btn btn-secondary" onClick={onBack}>← Retour</button>
        <button type="submit" className="btn btn-primary">✔ Valider et clôturer le retour</button>
      </div>
    </form>
  );
}