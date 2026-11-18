import React from 'react';
import '../styles/Sidebar.css';

const MENU = [
  { id: 'vehicules',    label: 'Véhicules',    icon: '🚗' },
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
        {MENU.map(({ id, label, icon }) => (
          <li key={id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>
            <span>{icon}</span> {label}
          </li>
        ))}
      </ul>
    </aside>
  );
}