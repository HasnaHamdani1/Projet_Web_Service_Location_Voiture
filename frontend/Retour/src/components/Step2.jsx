import React from 'react';
import { formatEuro } from '../services/retourService';

const ETATS = ['Bon état', 'Léger dommage', 'Dommage important', 'Dommage carrosserie', 'À inspecter'];

export default function Step2({ data, setData, onBack, onNext }) {
  const dateAff = data.dateRetour ? new Date(data.dateRetour).toLocaleDateString('fr-FR') : '';
  const retardAff = data.retard === 0 ? "À l'heure" : `${data.retard} jour${data.retard > 1 ? 's' : ''} de retard`;
  const aDommage = data.etat !== 'Bon état';

  return (
    <form onSubmit={(e) => { e.preventDefault(); onNext(); }}>
      <div className="grille-2">
        <label className="champ"><span className="champ-label">Numéro de contrat</span><input value={data.contrat} readOnly /></label>
        <label className="champ"><span className="champ-label">Immatriculation</span><input value={data.immat} readOnly /></label>
      </div>

      <div className="grille-3">
        <label className="champ"><span className="champ-label">Date de retour constatée</span><input value={dateAff} readOnly /></label>
        <label className="champ"><span className="champ-label">Retard constaté</span><input value={retardAff} readOnly /></label>
        <label className="champ"><span className="champ-label">Montant de pénalité (€)</span><input value={formatEuro(data.penalite)} readOnly /></label>
      </div>

      <label className="champ">
        <span className="champ-label">État du véhicule</span>
        <select value={data.etat} onChange={(e) => setData({ ...data, etat: e.target.value })}>
          {ETATS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>

      <label className="champ">
        <span className="champ-label">Description de dommage constaté</span>
        <textarea
          rows="4"
          value={data.description}
          onChange={(e) => setData({ ...data, description: e.target.value })}
          placeholder={aDommage ? 'Décrivez le dommage (emplacement, gravité, taille…)' : 'Aucun dommage à signaler'}
        />
      </label>

      <div className="actions">
        <button type="button" className="btn btn-outline" onClick={onBack}>← Retour</button>
        <button type="submit" className="btn btn-primary">Suivant →</button>
      </div>
    </form>
  );
}