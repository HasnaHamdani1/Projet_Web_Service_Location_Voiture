import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ListeRetours from './pages/ListeRetours';
import NouveauRetour from './pages/NouveauRetour';
import { ADMIN_URL, estAdminRetour } from './services/session';
import './styles/global.css';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('retours');
  const [page, setPage] = useState('liste'); // 'liste' | 'nouveau'

  const changeTab = (tab) => {
    setActiveTab(tab);
    if (tab === 'retours') setPage('liste');
  };

  // Espace réservé à l'administrateur du service Retour (jeton transmis par le tableau de bord)
  if (!estAdminRetour()) {
    return (
      <main className="app-main" style={{ maxWidth: 560, margin: '80px auto', textAlign: 'center' }}>
        <h1>Espace Retours</h1>
        <p>
          Cet espace est réservé à l'administrateur du service Retour. Connectez-vous dans le
          tableau de bord, puis ouvrez <strong>Retours</strong> dans le menu.
        </p>
        <p><a className="btn btn-primary" href={`${ADMIN_URL}/login.html`}>Ouvrir le tableau de bord</a></p>
      </main>
    );
  }

  return (
    <div className="app">
      <Sidebar activeTab={activeTab} setActiveTab={changeTab} />
      <main className="app-main">
        {activeTab !== 'retours' ? (
          <p className="placeholder">Section « {activeTab} » à venir.</p>
        ) : page === 'liste' ? (
          <ListeRetours onNouveau={() => setPage('nouveau')} />
        ) : (
          <NouveauRetour onTermine={() => setPage('liste')} onAnnuler={() => setPage('liste')} />
        )}
      </main>
    </div>
  );
}
