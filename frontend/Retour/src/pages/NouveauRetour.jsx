import React, { useEffect, useState } from 'react';
import {
  creerRetour,
  getApercuRetour,
  formatEuro,
  formatDateHeure,
} from '../services/retourService';
import '../styles/NouveauRetour.css';
import { idAdmin } from '../services/session';

const ETATS = ['Bon état', 'Léger dommage', 'Dommage important'];

const INITIAL = {
  numeroContrat: '',
  administrateurId: String(idAdmin() || ''), // administrateur connecté (jeton)
  dateRetour: '',
  etat: 'Bon état',
  description: '',
  montantDommage: '',
};

export default function NouveauRetour({ onTermine, onAnnuler }) {
  const [form, setForm] = useState(INITIAL);
  const [apercu, setApercu] = useState(null);       // retard calculé par le backend
  const [calcul, setCalcul] = useState(false);
  const [erreurApercu, setErreurApercu] = useState('');
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState(null);   // retour enregistré

  const aDommage = form.etat !== 'Bon état';
  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  // Calcul automatique du retard dès que le contrat et la date sont remplis
  useEffect(() => {
    setApercu(null);
    setErreurApercu('');

    if (!form.numeroContrat.trim() || !form.dateRetour) return;

    let annule = false;
    const minuteur = setTimeout(async () => {
      setCalcul(true);
      try {
        const donnees = await getApercuRetour(form.numeroContrat, form.dateRetour);
        if (!annule) setApercu(donnees);
      } catch (e) {
        if (!annule) setErreurApercu(e.message);
      } finally {
        if (!annule) setCalcul(false);
      }
    }, 500);

    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, [form.numeroContrat, form.dateRetour]);

  const montantRetard = apercu ? Number(apercu.montantRetard) || 0 : 0;
  const montantDommage = aDommage ? Number(form.montantDommage) || 0 : 0;

  const reinitialiser = () => {
    setForm(INITIAL);
    setErreur('');
  };

  const soumettre = async (ev) => {
    ev.preventDefault();
    setErreur('');

    if (!form.numeroContrat.trim() || !form.administrateurId || !form.dateRetour) {
      return setErreur(
        "Renseignez le numéro de contrat, l'administrateur et la date de retour."
      );
    }
    if (!apercu) {
      return setErreur(erreurApercu || 'Attendez le calcul du retard.');
    }
    if (aDommage && !form.description.trim()) {
      return setErreur('La description du dommage est obligatoire.');
    }

    setEnvoi(true);
    try {
      const retour = await creerRetour({ ...form, contratId: apercu.contrat_id });
      setResultat(retour);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  };

  // ===== Écran de confirmation après enregistrement =====
  if (resultat) {
    const retard = Number(resultat.dureeRetardJours) || 0;
    const penalite = Number(resultat.montantRetard) || 0;
    const dommage = Number(resultat.montantDommage) || 0;

    return (
      <div className="nouveau compact">
        <div className="nouveau-header">
          <div>
            <h1>✔ Retour enregistré</h1>
            <p className="sous-titre">
              Le retour a été enregistré, le contrat clôturé et le statut du véhicule mis à jour.
            </p>
          </div>
        </div>

        <div className="form-card">
          <div className="grille-4">
            <label className="champ">
              <span className="champ-label">Date de retour</span>
              <input readOnly value={formatDateHeure(resultat.dateRetour) || ''} />
            </label>
            <label className="champ">
              <span className="champ-label">Retard constaté</span>
              <input
                readOnly
                value={retard === 0 ? "À l'heure" : `${retard} jour${retard > 1 ? 's' : ''} de retard`}
              />
            </label>
            <label className="champ">
              <span className="champ-label">Montant du retard</span>
              <input readOnly value={formatEuro(penalite)} />
            </label>
            <label className="champ">
              <span className="champ-label">Montant du dommage</span>
              <input readOnly value={formatEuro(dommage)} />
            </label>
          </div>

          <div className="grille-4">
            <label className="champ champ-large">
              <span className="champ-label">Total à facturer</span>
              <input className="total" readOnly value={formatEuro(penalite + dommage)} />
            </label>
          </div>

          <div className="actions">
            <span />
            <button type="button" className="btn btn-primary" onClick={onTermine}>
              Retour à la liste →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== Formulaire =====
  const indice = calcul
    ? 'Calcul en cours…'
    : !apercu && !erreurApercu
    ? 'Saisissez le contrat et la date de retour pour calculer'
    : '';

  return (
    <div className="nouveau compact">
      <div className="breadcrumb">
        <button className="link" onClick={onAnnuler}>Restitutions</button> &gt;{' '}
        <span className="current">Nouveau retour de véhicule</span>
      </div>

      <div className="nouveau-header">
        <div>
          <h1>Nouveau retour de véhicule</h1>
          <p className="sous-titre">
            Le retard et son montant sont calculés automatiquement.
          </p>
        </div>
      </div>

      <div className="form-card">
        <form onSubmit={soumettre} noValidate>

          {/* ===== Ligne 1 : contrat, date, état ===== */}
          <div className="grille-4">
            <label className="champ">
              <span className="champ-label">Numéro de contrat <em>*</em></span>
              <input
                value={form.numeroContrat}
                onChange={maj('numeroContrat')}
                placeholder="CTR-2026-008"
              />
            </label>
            <label className="champ">
              <span className="champ-label">ID administrateur <em>*</em></span>
              <input
                type="number" min="1"
                value={form.administrateurId}
                onChange={maj('administrateurId')}
              />
            </label>
            <label className="champ">
              <span className="champ-label">Date de retour <em>*</em></span>
              <input type="date" value={form.dateRetour} onChange={maj('dateRetour')} />
            </label>
            <label className="champ">
              <span className="champ-label">État du véhicule</span>
              <select value={form.etat} onChange={maj('etat')}>
                {ETATS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>

          {/* ===== Ligne 2 : retard (calculé) ===== */}
          <p className="mini-titre">⏱️ Retard <span>{indice}</span></p>
          <div className="grille-4">
            <label className="champ">
              <span className="champ-label">En retard ?</span>
              <input readOnly value={apercu ? (apercu.enRetard ? 'Oui' : 'Non') : '—'} />
            </label>
            <label className="champ">
              <span className="champ-label">Jours de retard</span>
              <input readOnly value={apercu ? apercu.dureeRetardJours : '—'} />
            </label>
            <label className="champ">
              <span className="champ-label">Montant du retard</span>
              <input readOnly value={apercu ? formatEuro(apercu.montantRetard) : '—'} />
            </label>
            <label className="champ">
              <span className="champ-label">Fin de location prévue</span>
              <input readOnly value={apercu ? (formatDateHeure(apercu.dateFin) || '—') : '—'} />
            </label>
          </div>
          {!calcul && erreurApercu && <p className="erreur" role="alert">{erreurApercu}</p>}

          {/* ===== Ligne 3 : dommage et total ===== */}
          <p className="mini-titre">🚗 Dommage</p>
          <div className="grille-dommage">
            <label className="champ">
              <span className="champ-label">
                Description du dommage {aDommage && <em>*</em>}
              </span>
              <textarea
                rows="3"
                value={aDommage ? form.description : ''}
                onChange={maj('description')}
                disabled={!aDommage}
                placeholder={
                  aDommage
                    ? 'Emplacement, gravité, taille…'
                    : 'Aucun dommage (changez l’état du véhicule pour en saisir un)'
                }
              />
            </label>
            <label className="champ">
              <span className="champ-label">Montant du dommage (MAD)</span>
              <input
                type="number" min="0" step="0.01"
                value={aDommage ? form.montantDommage : ''}
                onChange={maj('montantDommage')}
                disabled={!aDommage}
                placeholder="0.00"
              />
            </label>
            <label className="champ">
              <span className="champ-label">Total à facturer</span>
              <input className="total" readOnly value={formatEuro(montantRetard + montantDommage)} />
            </label>
          </div>

          {erreur && <p className="erreur" role="alert">{erreur}</p>}

          <div className="actions">
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={onAnnuler}>
                Annuler
              </button>
              <button type="button" className="btn btn-secondary" onClick={reinitialiser}>
                ↻ Réinitialiser
              </button>
            </div>
            <button type="submit" className="btn btn-primary" disabled={envoi || calcul}>
              {envoi ? 'Enregistrement…' : '✔ Enregistrer le retour'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}