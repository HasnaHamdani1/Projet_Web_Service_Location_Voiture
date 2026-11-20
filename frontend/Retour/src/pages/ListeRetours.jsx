import React, { useEffect, useMemo, useState } from 'react';
import { getRetours, supprimerRetour, formatDateHeure } from '../services/retourService';
import '../styles/ListeRetours.css';

const PAR_PAGE = 6;

// Déterminer la classe CSS selon l'état du véhicule
function etatClass(etat) {
  switch (etat) {
    case 'Bon état':
      return 'etat-ok';
    case 'Léger dommage':
      return 'etat-warn';
    case 'À inspecter':
      return 'etat-neutral';
    case 'Dommage important':
      return 'etat-danger';
    default:
      return 'etat-neutral';
  }
}

// Afficher le retard
function Ecart({ retard }) {
  const jours = Number(retard) || 0;

  if (jours <= 0) {
    return <span className="pill pill-ok">✔ À l'heure</span>;
  }

  const cls = jours === 1 ? 'pill-warn' : 'pill-danger';

  return (
    <span className={`pill ${cls}`}>
      {jours >= 3 ? '⚠️' : '⏱️'} +{jours} jour{jours > 1 ? 's' : ''}
    </span>
  );
}

export default function ListeRetours({ onNouveau }) {
  const [retours, setRetours] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [version, setVersion] = useState(0); // incrémenté pour recharger la liste
  const [info, setInfo] = useState('');

  // Suppression
  const [suppression, setSuppression] = useState(null); // retour à supprimer
  const [erreurSuppr, setErreurSuppr] = useState('');
  const [enCours, setEnCours] = useState(false);

  // Charger les retours depuis l'API FastAPI
  useEffect(() => {
    let actif = true;

    async function chargerRetours() {
      try {
        setChargement(true);
        setErreur('');

        const donnees = await getRetours();

        if (!Array.isArray(donnees)) {
          throw new Error('Le format des données retournées est invalide.');
        }

        if (actif) {
          setRetours(donnees);
        }
      } catch (error) {
        console.error('Erreur de chargement des retours :', error);

        if (actif) {
          setErreur(error.message || 'Impossible de charger les retours.');
        }
      } finally {
        if (actif) {
          setChargement(false);
        }
      }
    }

    chargerRetours();

    return () => {
      actif = false;
    };
  }, [version]);

  // Fermer la fenêtre de confirmation avec Échap
  useEffect(() => {
    const surTouche = (e) => {
      if (e.key === 'Escape' && !enCours) setSuppression(null);
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [enCours]);

  // Confirmer la suppression
  const confirmerSuppression = async () => {
    setErreurSuppr('');
    setEnCours(true);

    try {
      await supprimerRetour(suppression.id);
      setSuppression(null);
      setInfo('Retour supprimé.');
      setTimeout(() => setInfo(''), 3500);
      setVersion((v) => v + 1); // recharge la liste
    } catch (e) {
      setErreurSuppr(e.message);
    } finally {
      setEnCours(false);
    }
  };

  // Recherche par contrat, immatriculation ou véhicule
  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();

    if (!q) return retours;

    return retours.filter((r) =>
      [r.contrat, r.immat, r.vehicule].some((v) =>
        String(v ?? '').toLowerCase().includes(q)
      )
    );
  }, [retours, recherche]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtres.length / PAR_PAGE));
  const pageCourante = Math.min(page, totalPages);
  const debut = (pageCourante - 1) * PAR_PAGE;
  const visibles = filtres.slice(debut, debut + PAR_PAGE);

  return (
    <div className="liste">

      <div className="breadcrumb">
        Restitutions &gt; <strong>Liste des retours</strong>
      </div>

      <div className="liste-header">
        <h1>Gestion des retours de véhicules</h1>

        <button className="btn btn-primary" onClick={onNouveau}>
          ⊕ Nouveau retour
        </button>
      </div>

      {info && <div className="info-banner" role="status">✔ {info}</div>}

      {/* Barre de recherche */}
      <div className="search-bar">
        <input
          type="search"
          placeholder="Rechercher par N° de contrat, immatriculation, véhicule…"
          value={recherche}
          onChange={(e) => {
            setRecherche(e.target.value);
            setPage(1);
          }}
          aria-label="Rechercher un retour"
        />
      </div>

      {/* Tableau des retours */}
      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>N° contrat</th>
                <th>Immatriculation &amp; véhicule</th>
                <th>Retour prévu</th>
                <th>Retour effectif</th>
                <th>Écart / retard</th>
                <th>État véhicule</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>

              {/* Chargement */}
              {chargement && (
                <tr>
                  <td colSpan="7" className="vide">
                    Chargement des retours...
                  </td>
                </tr>
              )}

              {/* Erreur */}
              {!chargement && erreur && (
                <tr>
                  <td colSpan="7" className="vide">
                    {erreur}
                  </td>
                </tr>
              )}

              {/* Aucun résultat */}
              {!chargement && !erreur && visibles.length === 0 && (
                <tr>
                  <td colSpan="7" className="vide">
                    {recherche
                      ? `Aucun retour ne correspond à « ${recherche} ».`
                      : 'Aucun retour enregistré.'}
                  </td>
                </tr>
              )}

              {/* Affichage des retours */}
              {!chargement && !erreur && visibles.map((r) => (
                <tr key={r.id}>

                  <td className="contrat">
                    {r.contrat}
                  </td>

                  <td>
                    <div className="vehicule">
                      <span className="plaque">FR</span>

                      <div>
                        <strong>{r.immat}</strong>
                        <small>{r.vehicule}</small>
                      </div>
                    </div>
                  </td>

                  <td>
                    {formatDateHeure(r.prevu)}
                  </td>

                  <td>
                    {r.effectif
                      ? formatDateHeure(r.effectif)
                      : (
                        <span className="non-restitue">
                          Non restitué
                        </span>
                      )}
                  </td>

                  <td>
                    <Ecart retard={r.retard} />
                  </td>

                  <td>
                    <span className={`etat ${etatClass(r.etat)}`}>
                      ● {r.etat}
                    </span>
                  </td>

                  <td>
                    <div className="actions-cell">
                      <button
                        type="button"
                        className="btn-action btn-supprimer"
                        onClick={() => { setErreurSuppr(''); setSuppression(r); }}
                      >
                        🗑️ Supprimer
                      </button>
                    </div>
                  </td>

                </tr>
              ))}

            </tbody>
          </table>
        </div>

        {/* Pied du tableau et pagination */}
        <div className="table-footer">

          <span>
            Affichage de{' '}
            <b>{filtres.length > 0 ? debut + 1 : 0}</b>
            {' '}à{' '}
            <b>{debut + visibles.length}</b>
            {' '}sur{' '}
            <b>{filtres.length}</b> retours
          </span>

          <div className="pagination">

            <button
              disabled={pageCourante === 1}
              onClick={() => setPage(pageCourante - 1)}
            >
              ‹ Précédent
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                className={n === pageCourante ? 'on' : ''}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}

            <button
              disabled={pageCourante === totalPages}
              onClick={() => setPage(pageCourante + 1)}
            >
              Suivant ›
            </button>

          </div>
        </div>
      </div>

      {/* ===== Fenêtre : confirmer la suppression ===== */}
      {suppression && (
        <div className="modal-fond" onClick={() => !enCours && setSuppression(null)}>
          <div
            className="modal-boite"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titre-suppr"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="titre-suppr">Supprimer ce retour ?</h2>
            <p className="modal-sous">
              Le retour du contrat <b>{suppression.contrat}</b> ({suppression.immat}) sera
              définitivement supprimé. Cette action est irréversible.
            </p>

            {erreurSuppr && <p className="modal-erreur" role="alert">{erreurSuppr}</p>}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSuppression(null)}
                disabled={enCours}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmerSuppression}
                disabled={enCours}
              >
                {enCours ? 'Suppression…' : '🗑️ Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}