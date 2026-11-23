import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StatusBadge } from '../components/ui/Badge'
import { AuthProvider } from '../context/AuthContext'
import AdminLoginPage from '../pages/admin/AdminLoginPage'
import ReservationListPage from '../pages/admin/ReservationListPage'
import CataloguePage from '../pages/site/CataloguePage'
import CheckoutPage from '../pages/site/CheckoutPage'
import ClientLoginPage from '../pages/site/ClientLoginPage'
import MyReservationsPage from '../pages/site/MyReservationsPage'
import PaymentPage from '../pages/site/PaymentPage'
import RegisterPage from '../pages/site/RegisterPage'
import VehiclePage from '../pages/site/VehiclePage'
import AppRoutes from '../routes/AppRoutes'
import { TOKEN_KEY, USER_KEY } from '../services/api'
import { authService, catalogueService, clientReservationService, reservationService } from '../services/reservationService'
import { addDays, toISODate } from '../utils/format'

vi.mock('../services/reservationService', () => ({
  catalogueService: { list: vi.fn(), get: vi.fn(), quote: vi.fn() },
  clientReservationService: { create: vi.fn(), mine: vi.fn(), get: vi.fn(), pay: vi.fn(), cancel: vi.fn() },
  reservationService: { list: vi.fn(), stats: vi.fn(), get: vi.fn(), confirm: vi.fn(), cancel: vi.fn(), exportCsv: vi.fn() },
  clientService: { list: vi.fn(), get: vi.fn() },
  authService: { login: vi.fn(), me: vi.fn(), register: vi.fn() },
}))

const D1 = toISODate(addDays(new Date(), 10))
const D2 = toISODate(addDays(new Date(), 13))
const CLAIRE = { id: 2, nom: 'Claire Martin', email: 'claire@exemple.fr', telephone: '0600000000', role: 'CLIENT' }
const ADMIN = { id: 1, nom: 'Administrateur Agence', email: 'admin@parcauto.ma', role: 'ADMINISTRATEUR' }

const OFFRE = {
  id: 1, immatriculation: 'AB-123-CD', marque: 'Peugeot', modele: '208', libelle: 'Peugeot 208', annee: 2023,
  categorie: 'Citadine', boite: 'Manuelle', carburant: 'Essence', prix_par_jour: 45, statut: 'DISPONIBLE', image_url: null,
  reservable: true, disponible: null, duree_jours: null, prix_estime: null, devise: '€',
}
const DEVIS = {
  duree_jours: 3, tarif_journalier: 45, tarif_assistance: 6, montant_location: 135, montant_assistance: 0,
  montant_total: 135, montant_tva: 22.5, taux_tva: 0.2, depot_garantie: 500, devise: '€',
}
const ROW = {
  id: 62, numero: 'RES-2026-062', client_id: 2, client_nom: 'Claire Martin', vehicule_id: 1,
  vehicule_libelle: 'Peugeot 208', vehicule_immatriculation: 'AB-123-CD', date_debut: D1, date_reservation: toISODate(new Date()),
  date_fin: D2, duree_jours: 3, statut: 'EN_ATTENTE', statut_label: 'En attente', montant_total: 135, prix_total: 135, devise: '€',
}
const RESA = {
  ...ROW, debut: `${D1}T09:00:00`, fin: `${D2}T09:00:00`, heure_debut: '09:00', heure_fin: '09:00',
  client: { id: 2, nom: 'Claire Martin', nom_complet: 'Claire Martin', email: 'claire@exemple.fr', telephone: '0600000000' },
  vehicule: { id: 1, marque: 'Peugeot', modele: '208', libelle: 'Peugeot 208', immatriculation: 'AB-123-CD', categorie: 'Citadine' },
  assistance: false, tarif_journalier: 45, tarif_assistance: 6, montant_location: 135, montant_assistance: 0, montant_prolongations: 0,
  montant_tva: 22.5, depot_garantie: 500, motif_annulation: null, cree_par: 'Claire Martin', historique: [],
  actions: { peut_payer: true, peut_confirmer: true, peut_annuler: true },
}
const STATS = { mois: '2026-11', total_mois: 62, total_mois_precedent: 50, variation: 12, en_attente: 8, confirmees: 48, annulees: 6, taux_confirmation: 77 }

function Where() {
  const l = useLocation()
  return <p data-testid="where">{l.pathname + l.search}</p>
}

function renderAt(path, element, routePath) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          <Route path={routePath || path.split('?')[0]} element={element} />
          <Route path="*" element={<Where />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

function renderApp(path) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider><AppRoutes /><Where /></AuthProvider>
    </MemoryRouter>,
  )
}

const connecter = (user) => {
  localStorage.setItem(TOKEN_KEY, 'jeton-test')
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  catalogueService.list.mockResolvedValue([OFFRE])
})

describe('StatusBadge', () => {
  it.each([
    ['EN_ATTENTE', 'En attente'],
    ['CONFIRMEE', 'Confirmée'],
    ['ANNULEE', 'Annulée'],
  ])('%s → %s', (statut, label) => {
    render(<StatusBadge statut={statut} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})

// ------------------------------------------------------------------ site client
describe('Catalogue', () => {
  it('affiche la disponibilité et le total quand une période est choisie', async () => {
    catalogueService.list.mockResolvedValue([
      { ...OFFRE, disponible: true, duree_jours: 3, prix_estime: 135 },
      { ...OFFRE, id: 2, libelle: 'Renault Clio', marque: 'Renault', modele: 'Clio', disponible: false, duree_jours: 3, prix_estime: 120 },
    ])
    renderAt(`/vehicules?date_debut=${D1}&date_fin=${D2}`, <CataloguePage />)
    expect(await screen.findByText('Peugeot 208')).toBeInTheDocument()
    expect(screen.getByText('Disponible')).toBeInTheDocument()
    expect(screen.getByText('Déjà réservé sur ces dates')).toBeInTheDocument()
    expect(screen.getByText('135,00 €')).toBeInTheDocument()
    expect(catalogueService.list).toHaveBeenCalledWith(expect.objectContaining({ date_debut: D1, date_fin: D2, tri: 'prix_asc' }))
  })

  it('désactive « Disponibles uniquement » sans période', async () => {
    renderAt('/vehicules', <CataloguePage />)
    expect(await screen.findByText('Choisissez vos dates pour voir le total')).toBeInTheDocument()
    expect(screen.getByLabelText('Disponibles uniquement')).toBeDisabled()
  })
})

describe('Fiche véhicule', () => {
  it('envoie un visiteur vers la connexion avec retour à la réservation', async () => {
    catalogueService.get.mockResolvedValue({ ...OFFRE, disponible: true, duree_jours: 3, prix_estime: 135, periodes_reservees: [{ date_debut: '2026-12-24', date_fin: '2026-12-27' }] })
    catalogueService.quote.mockResolvedValue(DEVIS)
    renderAt(`/vehicules/1?date_debut=${D1}&date_fin=${D2}`, <VehiclePage />, '/vehicules/:id')
    expect(await screen.findByText('24 → 27 déc. 2026')).toBeInTheDocument()
    const bouton = await screen.findByRole('button', { name: 'Se connecter pour réserver' })
    await waitFor(() => expect(bouton).toBeEnabled())
    await userEvent.click(bouton)
    expect(screen.getByTestId('where').textContent).toBe(
      `/connexion?retour=${encodeURIComponent(`/reserver/1?date_debut=${D1}&date_fin=${D2}&assistance=0`)}`,
    )
  })

  it('bloque la réservation si le véhicule est déjà pris', async () => {
    connecter(CLAIRE)
    catalogueService.get.mockResolvedValue({ ...OFFRE, disponible: false, duree_jours: 3, prix_estime: 135, periodes_reservees: [] })
    renderAt(`/vehicules/1?date_debut=${D1}&date_fin=${D2}`, <VehiclePage />, '/vehicules/:id')
    expect(await screen.findByText(/Déjà réservé sur une partie de ces dates/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuer la réservation' })).toBeDisabled()
  })
})

describe('Réservation (client connecté)', () => {
  beforeEach(() => connecter(CLAIRE))

  it('exige l’acceptation des conditions puis crée la réservation', async () => {
    catalogueService.get.mockResolvedValue({ ...OFFRE, disponible: true, duree_jours: 3, prix_estime: 135, periodes_reservees: [] })
    catalogueService.quote.mockResolvedValue(DEVIS)
    clientReservationService.create.mockResolvedValue(RESA)
    renderAt(`/reserver/1?date_debut=${D1}&date_fin=${D2}&assistance=0`, <CheckoutPage />, '/reserver/:id')
    const confirmer = await screen.findByRole('button', { name: 'Confirmer et passer au paiement' })
    expect(confirmer).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(confirmer)
    await waitFor(() => expect(clientReservationService.create).toHaveBeenCalledWith({
      vehicule_id: 1, date_debut: D1, date_fin: D2, heure_debut: '09:00', heure_fin: '09:00', assistance: false,
    }))
    expect(await screen.findByTestId('where')).toHaveTextContent('/mes-reservations/62/paiement')
  })

  it('explique un conflit de réservation simultanée', async () => {
    catalogueService.get.mockResolvedValue({ ...OFFRE, disponible: true, duree_jours: 3, prix_estime: 135, periodes_reservees: [] })
    catalogueService.quote.mockResolvedValue(DEVIS)
    clientReservationService.create.mockRejectedValue({ response: { status: 409, data: { detail: 'Indisponible', code: 'vehicule_indisponible' } } })
    renderAt(`/reserver/1?date_debut=${D1}&date_fin=${D2}`, <CheckoutPage />, '/reserver/:id')
    await userEvent.click(await screen.findByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer et passer au paiement' }))
    expect(await screen.findByText(/vient d'être réservé sur ces dates par un autre client/)).toBeInTheDocument()
  })

  it('paiement simulé accepté → écran de confirmation', async () => {
    clientReservationService.get.mockResolvedValue(RESA)
    clientReservationService.pay.mockResolvedValue({ message: 'ok', reservation: { ...RESA, statut: 'CONFIRMEE', historique: [{ id: 1, type: 'EMAIL_SENT', message: '', auteur: 'Système', date: '2026-11-23T10:00:00Z' }] } })
    renderAt('/mes-reservations/62/paiement', <PaymentPage />, '/mes-reservations/:id/paiement')
    await userEvent.click(await screen.findByRole('button', { name: 'Payer 135,00 €' }))
    expect(clientReservationService.pay).toHaveBeenCalledWith(62, true)
    expect(await screen.findByText('Votre réservation est confirmée')).toBeInTheDocument()
    expect(screen.getByText('Confirmation envoyée à claire@exemple.fr')).toBeInTheDocument()
  })

  it('paiement refusé → la réservation reste en attente', async () => {
    clientReservationService.get.mockResolvedValue(RESA)
    clientReservationService.pay.mockResolvedValue({ message: 'Paiement refusé', reservation: RESA })
    renderAt('/mes-reservations/62/paiement', <PaymentPage />, '/mes-reservations/:id/paiement')
    await userEvent.click(await screen.findByRole('button', { name: 'Simuler un paiement refusé' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Paiement refusé')
    expect(clientReservationService.pay).toHaveBeenCalledWith(62, false)
  })

  it('liste mes réservations avec le bouton Payer pour celles en attente', async () => {
    clientReservationService.mine.mockResolvedValue({ items: [ROW, { ...ROW, id: 63, numero: 'RES-2026-063', statut: 'CONFIRMEE' }], total: 2, page: 1, size: 8, pages: 1 })
    renderAt('/mes-reservations', <MyReservationsPage />)
    expect(await screen.findByText(/RES-2026-062/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Payer' })).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Payer' })).toHaveAttribute('href', '/mes-reservations/62/paiement')
  })
})

describe('Comptes client', () => {
  it('connexion client puis retour vers la page demandée', async () => {
    authService.login.mockResolvedValue({ access_token: 'tok' })
    authService.me.mockResolvedValue(CLAIRE)
    renderAt(`/connexion?retour=${encodeURIComponent('/reserver/1?date_debut=x')}`, <ClientLoginPage />, '/connexion')
    await userEvent.type(screen.getByPlaceholderText('Adresse e-mail'), 'claire@exemple.fr')
    await userEvent.type(screen.getByPlaceholderText('Mot de passe'), 'mot-de-passe-test')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))
    expect(await screen.findByTestId('where')).toHaveTextContent('/reserver/1?date_debut=x')
    expect(localStorage.getItem(TOKEN_KEY)).toBe('tok')
  })

  it('refuse un compte administrateur et ignore un retour externe', async () => {
    authService.login.mockResolvedValue({ access_token: 'tok' })
    authService.me.mockResolvedValue(ADMIN)
    renderAt('/connexion?retour=//pirate.example', <ClientLoginPage />, '/connexion')
    await userEvent.type(screen.getByPlaceholderText('Adresse e-mail'), 'admin@parcauto.ma')
    await userEvent.type(screen.getByPlaceholderText('Mot de passe'), 'mot-de-passe-test')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('compte administrateur')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('inscription : contrôle du mot de passe puis envoi au service Auth', async () => {
    authService.register.mockResolvedValue({ id: 9 })
    authService.login.mockResolvedValue({ access_token: 'tok' })
    authService.me.mockResolvedValue({ ...CLAIRE, id: 9, nom: 'Nadia Alami' })
    renderAt('/inscription', <RegisterPage />)
    await userEvent.type(screen.getByPlaceholderText('Nom complet'), 'Nadia Alami')
    await userEvent.type(screen.getByPlaceholderText('Adresse e-mail'), 'nadia@exemple.ma')
    await userEvent.type(screen.getByPlaceholderText('Adresse postale'), '12 rue Hassan II, Agadir')
    await userEvent.type(screen.getByPlaceholderText('Mot de passe (12 caractères minimum)'), 'court')
    await userEvent.type(screen.getByPlaceholderText('Confirmer le mot de passe'), 'autre')
    await userEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))
    expect(await screen.findByText('12 caractères minimum')).toBeInTheDocument()
    expect(screen.getByText('Les mots de passe ne correspondent pas')).toBeInTheDocument()
    expect(authService.register).not.toHaveBeenCalled()

    await userEvent.clear(screen.getByPlaceholderText('Mot de passe (12 caractères minimum)'))
    await userEvent.type(screen.getByPlaceholderText('Mot de passe (12 caractères minimum)'), 'MotDePasse2026!')
    await userEvent.clear(screen.getByPlaceholderText('Confirmer le mot de passe'))
    await userEvent.type(screen.getByPlaceholderText('Confirmer le mot de passe'), 'MotDePasse2026!')
    await userEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }))
    await waitFor(() => expect(authService.register).toHaveBeenCalledWith({
      nom: 'Nadia Alami', email: 'nadia@exemple.ma', telephone: null, adresse: '12 rue Hassan II, Agadir', mot_de_passe: 'MotDePasse2026!',
    }))
    expect(await screen.findByTestId('where')).toHaveTextContent('/vehicules')
  })
})

// ------------------------------------------------------------------ espace agence
describe('Connexion agence', () => {
  it('signale les champs obligatoires sans appeler l’API', async () => {
    renderAt('/admin/connexion', <AdminLoginPage />)
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))
    expect(await screen.findByText("L'adresse e-mail est obligatoire")).toBeInTheDocument()
    expect(screen.getByText('Le mot de passe est obligatoire')).toBeInTheDocument()
    expect(authService.login).not.toHaveBeenCalled()
  })

  it('refuse un compte client', async () => {
    authService.login.mockResolvedValue({ access_token: 'tok' })
    authService.me.mockResolvedValue(CLAIRE)
    renderAt('/admin/connexion', <AdminLoginPage />)
    await userEvent.type(screen.getByPlaceholderText('Adresse e-mail'), 'claire@exemple.fr')
    await userEvent.type(screen.getByPlaceholderText('Mot de passe'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('réservé aux administrateurs')
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('permet d’afficher le mot de passe', async () => {
    renderAt('/admin/connexion', <AdminLoginPage />)
    const pwd = screen.getByPlaceholderText('Mot de passe')
    expect(pwd).toHaveAttribute('type', 'password')
    await userEvent.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }))
    expect(pwd).toHaveAttribute('type', 'text')
  })
})

describe('Gestion des réservations (F001)', () => {
  beforeEach(() => {
    connecter(ADMIN)
    reservationService.stats.mockResolvedValue(STATS)
  })

  it('consultation seulement : indicateurs, tableau, export, pas de création ni de modification', async () => {
    reservationService.list.mockResolvedValue({ items: [ROW], total: 1, page: 1, size: 10, pages: 1 })
    renderAt('/admin/reservations', <ReservationListPage />)
    expect((await screen.findAllByText('RES-2026-062')).length).toBeGreaterThan(0)
    expect(screen.getByText('+12 par rapport au mois dernier')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /nouvelle réservation/i })).toBeNull()
    expect(screen.getByRole('button', { name: /exporter/i })).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Actions pour RES-2026-062' })[0])
    expect(await screen.findByRole('menuitem', { name: /voir le détail/i })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /modifier/i })).toBeNull()
  })

  it('exporte la sélection en CSV', async () => {
    reservationService.list.mockResolvedValue({ items: [ROW], total: 1, page: 1, size: 10, pages: 1 })
    reservationService.exportCsv.mockResolvedValue(new Blob(['a;b']))
    URL.createObjectURL = vi.fn(() => 'blob:test')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderAt('/admin/reservations?statut=CONFIRMEE', <ReservationListPage />, '/admin/reservations')
    await userEvent.click(await screen.findByRole('button', { name: /exporter/i }))
    await waitFor(() => expect(reservationService.exportCsv).toHaveBeenCalledWith(expect.objectContaining({ statut: 'CONFIRMEE' })))
    expect(click).toHaveBeenCalled()
    click.mockRestore()
  })

  it('transmet la recherche à l’API (avec anti-rebond)', async () => {
    reservationService.list.mockResolvedValue({ items: [], total: 0, page: 1, size: 10, pages: 1 })
    renderAt('/admin/reservations', <ReservationListPage />)
    await userEvent.type(screen.getByLabelText('Rechercher une réservation'), 'AB-123')
    await waitFor(() => expect(reservationService.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'AB-123' })))
    expect(await screen.findByText('Aucune réservation ne correspond à vos critères')).toBeInTheDocument()
  })

  it('affiche un état d’erreur avec possibilité de réessayer', async () => {
    reservationService.list.mockRejectedValue({ code: 'ERR_NETWORK' })
    renderAt('/admin/reservations', <ReservationListPage />)
    expect(await screen.findByText('Impossible de joindre le serveur. Vérifiez que les services sont démarrés.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /réessayer/i })).toBeInTheDocument()
  })
})

describe('Accès par rôle', () => {
  it('un visiteur est envoyé vers la connexion client', async () => {
    renderApp('/mes-reservations')
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/connexion?retour=%2Fmes-reservations'))
  })

  it('un client ne peut pas ouvrir l’espace agence', async () => {
    connecter(CLAIRE)
    renderApp('/admin/reservations')
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/admin/connexion'))
  })

  it('un administrateur est renvoyé vers la gestion s’il ouvre l’espace client', async () => {
    connecter(ADMIN)
    reservationService.stats.mockResolvedValue(STATS)
    reservationService.list.mockResolvedValue({ items: [], total: 0, page: 1, size: 10, pages: 1 })
    renderApp('/mes-reservations')
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/admin/reservations'))
  })
})
