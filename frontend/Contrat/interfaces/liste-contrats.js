const echapper = valeur =>
  String(valeur ?? "").replace(/[&<>"']/g, caractere => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[caractere]));

const libelleStatut = statut => ({
  EN_ATTENTE: "En attente",
  VALIDE: "Validé",
  CLOTURE: "Clôturé",
  ANNULE: "Annulé",
  ANNULEE: "Annulée"
}[statut] || statut || "Inconnu");

const dateLisible = valeur => valeur || "—";

export function afficherListeContrats(conteneur, contrats, vehicules = []) {
  const pageTaille = 6;
  let pageActuelle = 1;
  let recherche = "";
  let statutChoisi = "";

  const ceMois = new Date().toISOString().slice(0, 7);
  const contratsCeMois = contrats.filter(c =>
    String(c.date_generation || "").startsWith(ceMois)
  ).length;
  const enAttente = contrats.filter(c => c.statut === "EN_ATTENTE").length;
  const valides = contrats.filter(c => c.statut === "VALIDE").length;
  const moisLibelle = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date());
  const maximum = Math.max(1, contratsCeMois, enAttente, valides);

  const statuts = [...new Set(contrats.map(c => c.statut).filter(Boolean))];

  conteneur.innerHTML = `
    <div class="contract-toolbar">
      <label class="contract-search">
        <span aria-hidden="true">⌕</span>
        <input id="recherche-contrat" type="search"
          aria-label="Rechercher un contrat"
          placeholder="Rechercher par N° de contrat, client, immatriculation…">
      </label>
      <label class="contract-filter">
        <span aria-hidden="true">☷</span>
        <select id="filtre-statut" aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          ${statuts.map(s => `<option value="${echapper(s)}">${echapper(libelleStatut(s))}</option>`).join("")}
        </select>
      </label>
    </div>

    <div class="contract-kpis">
      <article class="contract-kpi">
        <div class="contract-kpi-top"><span class="contract-kpi-icon">▤</span><small>${echapper(moisLibelle)}</small></div>
        <span class="contract-kpi-label">Total contrats ce mois</span><strong>${contratsCeMois}</strong>
        <span class="contract-kpi-bar"><i style="width:${Math.round(contratsCeMois * 100 / maximum)}%"></i></span>
      </article>
      <article class="contract-kpi">
        <div class="contract-kpi-top"><span class="contract-kpi-icon">◷</span><small>${echapper(moisLibelle)}</small></div>
        <span class="contract-kpi-label">Contrats en attente</span><strong>${enAttente}</strong>
        <span class="contract-kpi-bar pending"><i style="width:${Math.round(enAttente * 100 / maximum)}%"></i></span>
      </article>
      <article class="contract-kpi">
        <div class="contract-kpi-top"><span class="contract-kpi-icon">✓</span><small>${echapper(moisLibelle)}</small></div>
        <span class="contract-kpi-label">Contrats validés</span><strong>${valides}</strong>
        <span class="contract-kpi-bar valid"><i style="width:${Math.round(valides * 100 / maximum)}%"></i></span>
      </article>
    </div>

    <div id="table-contrats"></div>
    <div id="pagination-contrats" class="contract-pagination"></div>

    <dialog id="detail-contrat" class="contract-dialog">
      <div id="contenu-detail-contrat"></div>
      <button id="fermer-detail-contrat" class="mini-button" type="button">Fermer</button>
    </dialog>
  `;

  const champRecherche = conteneur.querySelector("#recherche-contrat");
  const filtreStatut = conteneur.querySelector("#filtre-statut");

  function afficherPage() {
    const filtres = contrats.filter(contrat => {
      const reservation = contrat.reservation || {};
      const vehiculeId = reservation.vehicule_id ?? contrat.vehicule_id;
      const vehicule = vehicules.find(v => Number(v.id) === Number(vehiculeId));
      const texteRecherche = [
        contrat.numero_contrat,
        reservation.client_id,
        contrat.reservation_id,
        vehicule?.immatriculation
      ].join(" ").toLowerCase();

      return texteRecherche.includes(recherche) &&
        (!statutChoisi || contrat.statut === statutChoisi);
    });

    const nombrePages = Math.max(1, Math.ceil(filtres.length / pageTaille));
    pageActuelle = Math.min(pageActuelle, nombrePages);
    const debut = (pageActuelle - 1) * pageTaille;
    const page = filtres.slice(debut, debut + pageTaille);

    const table = conteneur.querySelector("#table-contrats");

    if (!page.length) {
      table.innerHTML = `<div class="empty-state">Aucun contrat ne correspond à la recherche.</div>`;
    } else {
      table.innerHTML = `
        <div class="table-wrap">
          <table class="contracts-table">
            <thead>
              <tr>
                <th>N° contrat</th><th>Client</th><th>Immatriculation & véhicule</th>
                <th>Période (début — fin)</th><th>Montant total</th><th>Statut</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${page.map(contrat => {
                const reservation = contrat.reservation || {};
                const vehiculeId = reservation.vehicule_id ?? contrat.vehicule_id;
                const vehicule = vehicules.find(v => Number(v.id) === Number(vehiculeId));
                const client = reservation.client_id
                  ? `Client #${reservation.client_id}` : "—";
                const formatDate = value => {
                  if (!value) return "—";
                  const parsed = new Date(`${value}T00:00:00`);
                  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("fr-FR");
                };
                const vehiculeTexte = vehicule?.immatriculation || (vehiculeId ? `Véhicule #${vehiculeId}` : "—");

                return `
                  <tr>
                    <td class="contract-number">${echapper(contrat.numero_contrat)}</td>
                    <td>${echapper(client)}</td>
                    <td><span class="contract-plate">${echapper(vehiculeTexte)}</span>${vehicule ? `<small class="contract-vehicle-name">${echapper(vehicule.marque)} ${echapper(vehicule.modele)}</small>` : ""}</td>
                    <td>${echapper(formatDate(contrat.periode_prise))} → ${echapper(formatDate(contrat.periode_fin))}</td>
                    <td>${Number(contrat.montant_total || 0).toFixed(2)} DH</td>
                    <td><span class="status status-${echapper(String(contrat.statut || "").toLowerCase())}">${echapper(libelleStatut(contrat.statut))}</span></td>
                    <td><button class="contract-view-button" data-detail="${Number(contrat.id)}" aria-label="Consulter le contrat">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>
                    </button></td>
                  </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>`;
    }

    const pagination = conteneur.querySelector("#pagination-contrats");
    const premiereLigne = filtres.length ? debut + 1 : 0;
    const derniereLigne = Math.min(debut + pageTaille, filtres.length);
    pagination.innerHTML = `
      <span>Affichage de ${premiereLigne} à ${derniereLigne} sur ${filtres.length} contrats</span>
      <div class="contract-page-actions">
        <button class="mini-button" data-page="precedente" ${pageActuelle <= 1 ? "disabled" : ""}>Précédent</button>
        <span class="contract-page-number">${pageActuelle}</span>
        <span>…</span>
        <span class="contract-page-total">${nombrePages}</span>
        <button class="mini-button" data-page="suivante" ${pageActuelle >= nombrePages ? "disabled" : ""}>Suivant</button>
      </div>
    `;

    pagination.querySelector('[data-page="precedente"]').onclick = () => {
      if (pageActuelle > 1) { pageActuelle--; afficherPage(); }
    };
    pagination.querySelector('[data-page="suivante"]').onclick = () => {
      if (pageActuelle < nombrePages) { pageActuelle++; afficherPage(); }
    };

    table.querySelectorAll("[data-detail]").forEach(bouton => {
      bouton.onclick = () => afficherDetail(Number(bouton.dataset.detail));
    });
  }

  function afficherDetail(id) {
    const contrat = contrats.find(c => Number(c.id) === id);
    if (!contrat) return;

    conteneur.querySelector("#contenu-detail-contrat").innerHTML = `
      <h2>Détail du contrat</h2>
      <p><strong>Numéro :</strong> ${echapper(contrat.numero_contrat)}</p>
      <p><strong>Réservation :</strong> #${Number(contrat.reservation_id)}</p>
      <p><strong>Période :</strong> ${echapper(dateLisible(contrat.periode_prise))} → ${echapper(dateLisible(contrat.periode_fin))}</p>
      <p><strong>Montant :</strong> ${Number(contrat.montant_total || 0).toFixed(2)} MAD</p>
      <p><strong>Caution :</strong> ${contrat.montant_caution == null ? "Non enregistrée" : `${Number(contrat.montant_caution).toFixed(2)} MAD`}</p>
      <p><strong>Statut :</strong> ${echapper(libelleStatut(contrat.statut))}</p>
    `;
    conteneur.querySelector("#detail-contrat").showModal();
  }

  champRecherche.addEventListener("input", () => {
    recherche = champRecherche.value.trim().toLowerCase();
    pageActuelle = 1;
    afficherPage();
  });

  filtreStatut.addEventListener("change", () => {
    statutChoisi = filtreStatut.value;
    pageActuelle = 1;
    afficherPage();
  });

  conteneur.querySelector("#fermer-detail-contrat").onclick = () =>
    conteneur.querySelector("#detail-contrat").close();

  afficherPage();
}
