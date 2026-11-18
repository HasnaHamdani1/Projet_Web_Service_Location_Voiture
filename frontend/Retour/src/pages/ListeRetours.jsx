
import React, { useEffect, useMemo, useState } from 'react';
import { getRetours, formatDateHeure } from '../services/retourService';
import '../styles/ListeRetours.css';

const PAR_PAGE = 6;

// Déterminer la classe CSS selon l'état du véhicule
function etatClass(etat) {
  if (etat === 'Bon état') return 'etat-ok';
  if (etat === 'Léger dommage') return 'etat-warn';
  if (etat === 'À inspecter') return 'etat-neutral';
  return 'etat-danger';
}

// Afficher le retard
function Ecart({ retard }) {
  if (retard === 0) {
    return <span className="pill pill-ok">✔ À l'heure</span>;
  }

  const cls = retard === 1 ? 'pill-warn' : 'pill-danger';

  return (
    <span className={`pill ${cls}`}>
      {retard >= 3 ? '⚠️' : '⏱️'} +{retard} jour{retard > 1 ? 's' : ''}
    </span>
  );
}

export default function ListeRetours({ onNouveau }) {
  const [retours, setRetours] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [page, setPage] = useState(1);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  // Charger les retours depuis FastAPI
  useEffect(() => {
    async function chargerRetours() {
      try {
        setChargement(true);
        setErreur('');

        const donnees = await getRetours();
        setRetours(donnees);
      } catch (error) {
        console.error('Erreur de chargement :', error);
        setErreur(error.message || 'Impossible de charger les retours.');
      } finally {
        setChargement(false);
      }
    }

    chargerRetours();
  }, []);

  // Recherche par contrat, immatriculation ou véhicule
  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();

    if (!q) return retours;

    return retours.filter((r) =>
      [r.contrat, r.immat, r.vehicule].some(
        (v) => String(v ?? '').toLowerCase().includes(q)
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
              </tr>
            </thead>

            <tbody>

              {/* Chargement */}
              {chargement && (
                <tr>
                  <td colSpan="6" className="vide">
                    Chargement des retours...
                  </td>
                </tr>
              )}

              {/* Erreur */}
              {!chargement && erreur && (
                <tr>
                  <td colSpan="6" className="vide">
                    {erreur}
                  </td>
                </tr>
              )}

              {/* Aucun résultat */}
              {!chargement && !erreur && visibles.length === 0 && (
                <tr>
                  <td colSpan="6" className="vide">
                    Aucun retour ne correspond à « {recherche} ».
                  </td>
                </tr>
              )}

              {/* Affichage des données récupérées depuis MySQL */}
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
                      : <span className="non-restitue">Non restitué</span>}
                  </td>

                  <td>
                    <Ecart retard={r.retard} />
                  </td>

                  <td>
                    <span className={`etat ${etatClass(r.etat)}`}>
                      ● {r.etat}
                    </span>
                  </td>

                </tr>
              ))}

            </tbody>
          </table>
        </div>

        {/* Pied du tableau et pagination */}
        <div className="table-footer">

          <span>
            Affichage de <b>{filtres.length ? debut + 1 : 0}</b> à{' '}
            <b>{debut + visibles.length}</b> sur{' '}
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
    </div>
  );
}
