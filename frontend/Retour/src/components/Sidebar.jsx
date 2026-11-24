import { useEffect, useState } from 'react';
import '../styles/Sidebar.css';

import { ADMIN_URL, deconnecter, profilAdmin } from '../services/session';

// L'administrateur Retour voit le Dashboard (commun) et son service seulement
const MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: '▦', href: `${ADMIN_URL}/dashboard.html` },
  { id: 'retours', label: 'Retours', icon: '↩' },
];

function initiales(nom) {
  return nom.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0].toUpperCase()).join('') || 'A';
}

export default function Sidebar({ activeTab = 'retours', setActiveTab = () => {} }) {
  const [nom, setNom] = useState('Administrateur');

  useEffect(() => {
    profilAdmin().then((profil) => setNom(profil.nom)).catch(() => {});
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon" aria-hidden="true">🚗</span>
        <div>
          <h2>PARC AUTO</h2>
          <span className="badge-connecte">Espace agence</span>
        </div>
      </div>

      <ul className="sidebar-menu">
        {MENU.map(({ id, label, icon, href }) => (
          <li key={id} className={activeTab === id ? 'active' : ''}>
            {href ? (
              <a href={href} className="sidebar-link"><span aria-hidden="true">{icon}</span> {label}</a>
            ) : (
              <button type="button" className="sidebar-link" onClick={() => setActiveTab(id)}>
                <span aria-hidden="true">{icon}</span> {label}
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="pa-admin">
        <div className="pa-admin-identite">
          <span className="pa-admin-initiales" aria-hidden="true">{initiales(nom)}</span>
          <div>
            <p className="pa-admin-nom">{nom}</p>
            <p className="pa-admin-service">Service Retours</p>
          </div>
        </div>
        <button type="button" className="pa-deconnexion" onClick={deconnecter}>Se déconnecter</button>
      </div>
    </aside>
  );
}
