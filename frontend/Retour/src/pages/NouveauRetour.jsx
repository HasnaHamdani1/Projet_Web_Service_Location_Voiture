import React, { useState } from 'react';
import Step1 from '../components/Step1';
import Step2 from '../components/Step2';
import Step3 from '../components/Step3';

import '../styles/NouveauRetour.css';

const INITIAL = {
  contrat: '', immat: '', vehicule: '', prevu: null, dateRetour: '',
  retard: 0, penalite: 0, etat: 'Bon état', description: '',
  montantDommage: 0, statutContrat: 'Clôturé', statutVehicule: 'Disponible',
};

const ETAPES = {
  1: { titre: "Formulaire d'identification du retour", sous: 'Renseignez le numéro de contrat et la date de retour du véhicule pour initialiser le dossier.', badge: 'Enregistrement', crumb: 'Nouveau retour de véhicule' },
  2: { titre: 'Formulaire de retour de véhicule', sous: "Renseignez les informations de restitution, le constat du retard et l'état général du véhicule.", badge: 'Retard & État', crumb: 'Retour de véhicule' },
  3: { titre: 'Formulaire de clôture et état des dommages', sous: 'Renseignez les dommages constatés, le montant associé et les statuts finaux pour sceller le dossier.', badge: 'Dommages & Clôture', crumb: 'Clôture & Constat des dommages' },
};

export default function NouveauRetour({ onTermine, onAnnuler }) {
  const [etape, setEtape] = useState(1);
  const [data, setData] = useState(INITIAL);
  const [erreur, setErreur] = useState('');
  const e = ETAPES[etape];

  const valider = async () => {
    try {
      const heure = new Date().toTimeString().slice(0, 5);
      await clotureRetour(data.contrat, {
        effectif: `${data.dateRetour}T${heure}`,
        retard: data.retard,
        etat: data.etat,
        penalite: data.penalite,
        description: data.description,
        montantDommage: data.montantDommage,
        statutContrat: data.statutContrat,
        statutVehicule: data.statutVehicule,
      });
      onTermine();
    } catch {
      setErreur("Impossible d'enregistrer le retour. Réessayez.");
    }
  };

  return (
    <div className="nouveau">
      <div className="breadcrumb">
        <button className="link" onClick={onAnnuler}>Restitutions</button> &gt; <span className="current">{e.crumb}</span>
      </div>
      <div className="nouveau-header">
        <div>
          <h1>{e.titre}</h1>
          <p className="sous-titre">{e.sous}</p>
        </div>
        <span className="badge-etape">● Étape {etape} sur 3 : {e.badge}</span>
      </div>

      <div className="form-card">
        {etape === 1 && <Step1 data={data} setData={setData} onNext={() => setEtape(2)} initial={INITIAL} />}
        {etape === 2 && <Step2 data={data} setData={setData} onBack={() => setEtape(1)} onNext={() => setEtape(3)} />}
        {etape === 3 && <Step3 data={data} setData={setData} onBack={() => setEtape(2)} onSubmit={valider} />}
        {erreur && <p className="erreur" role="alert">{erreur}</p>}
      </div>
    </div>
  );
}