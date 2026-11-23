import React from 'react';
import '../styles/Sidebar.css';

const ADMIN_URL =
  import.meta.env.VITE_ADMIN_URL ||
  `http://${window.location.hostname}:5500/frontend/admin`;

const MENU = [
  { id: 'dashboard',    label: 'Dashboard',    icon: '▦',  href: `${ADMIN_URL}/dashboard.html` },
  { id: 'vehicules',    label: 'Véhicules',    icon: '🚗', href: `${ADMIN_URL}/admin.html` },
  { id: 'reservations', label: 'Réservations', icon: '📅' },
  { id: 'contrats',     label: 'Contrats',     icon: '📄' },
  { id: 'retours',      label: 'Retours',      icon: '⬅️' },
  { id: 'parametres',   label: 'Paramètres',   icon: '⚙️' },
];

export default function Sidebar({ activeTab = 'retours', setActiveTab = () => {} }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">🚗</span>
        <div>
          <h2>PARC AUTO</h2>
          <span className="badge-connecte">● Connecté</span>
        </div>
      </div>

      <ul className="sidebar-menu">
        {MENU.map(({ id, label, icon, href }) => (
          <li
            key={id}
            className={activeTab === id ? 'active' : ''}
            onClick={href ? undefined : () => setActiveTab(id)}
          >
            {href ? (
              <a href={href} className="sidebar-link"><span>{icon}</span> {label}</a>
            ) : (
              <><span>{icon}</span> {label}</>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}