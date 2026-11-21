import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ListeRetours from './pages/ListeRetours';
import NouveauRetour from './pages/NouveauRetour';
import './styles/global.css';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('retours');
  const [page, setPage] = useState('liste'); // 'liste' | 'nouveau'

  const changeTab = (tab) => {
    setActiveTab(tab);
    if (tab === 'retours') setPage('liste');
  };

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
