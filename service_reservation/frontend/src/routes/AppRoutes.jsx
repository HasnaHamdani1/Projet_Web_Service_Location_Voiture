import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { PageLoader } from '../components/ui/Feedback'
import { useAuth } from '../context/AuthContext'
import AdminLayout from '../layouts/AdminLayout'
import SiteLayout from '../layouts/SiteLayout'

// Site public de réservation (clients)
const HomePage = lazy(() => import('../pages/site/HomePage'))
const CataloguePage = lazy(() => import('../pages/site/CataloguePage'))
const VehiclePage = lazy(() => import('../pages/site/VehiclePage'))
const CheckoutPage = lazy(() => import('../pages/site/CheckoutPage'))
const PaymentPage = lazy(() => import('../pages/site/PaymentPage'))
const MyReservationsPage = lazy(() => import('../pages/site/MyReservationsPage'))
const MyReservationDetailPage = lazy(() => import('../pages/site/MyReservationDetailPage'))
const ClientLoginPage = lazy(() => import('../pages/site/ClientLoginPage'))
const RegisterPage = lazy(() => import('../pages/site/RegisterPage'))
// Espace agence : gestion et consultation
const AdminAccessPage = lazy(() => import('../pages/admin/AdminAccessPage'))
const ReservationListPage = lazy(() => import('../pages/admin/ReservationListPage'))
const ReservationDetailPage = lazy(() => import('../pages/admin/ReservationDetailPage'))
const ClientListPage = lazy(() => import('../pages/admin/ClientListPage'))
const ClientDetailPage = lazy(() => import('../pages/admin/ClientDetailPage'))
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'))

/** Client connecté obligatoire ; sinon connexion puis retour à la page demandée. */
function RequireClient({ children }) {
  const { isClient, isAdmin } = useAuth()
  const location = useLocation()
  if (isAdmin) return <Navigate to="/admin/reservations" replace />
  if (!isClient) return <Navigate to={`/connexion?retour=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return children
}

/**
 * Espace agence : jeton transmis par le tableau de bord de Leila dans l'ancre de l'adresse
 * (…/admin/reservations#jeton=…). L'ancre n'est jamais envoyée au serveur et on l'efface aussitôt.
 */
function RequireAdmin({ children }) {
  const { isAdmin, loginWithToken } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const jeton = new URLSearchParams(location.hash.slice(1)).get('jeton')
  const [etat, setEtat] = useState(jeton ? 'verification' : 'pret')

  useEffect(() => {
    if (!jeton) return
    const cible = location.pathname + location.search
    window.history.replaceState(null, '', cible)
    loginWithToken(jeton)
      .then(() => { setEtat('pret'); navigate(cible, { replace: true }) })
      .catch(() => setEtat('refus'))
  }, [jeton]) // eslint-disable-line react-hooks/exhaustive-deps

  if (etat === 'verification') return <PageLoader />
  if (etat === 'refus') return <Navigate to="/admin/acces" replace state={{ refus: true }} />
  if (!isAdmin) return <Navigate to="/admin/acces" replace />
  return children
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<HomePage />} />
          <Route path="vehicules" element={<CataloguePage />} />
          <Route path="vehicules/:id" element={<VehiclePage />} />
          <Route path="connexion" element={<ClientLoginPage />} />
          <Route path="inscription" element={<RegisterPage />} />
          <Route path="reserver/:id" element={<RequireClient><CheckoutPage /></RequireClient>} />
          <Route path="mes-reservations" element={<RequireClient><MyReservationsPage /></RequireClient>} />
          <Route path="mes-reservations/:id" element={<RequireClient><MyReservationDetailPage /></RequireClient>} />
          <Route path="mes-reservations/:id/paiement" element={<RequireClient><PaymentPage /></RequireClient>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="admin/acces" element={<AdminAccessPage />} />
        <Route path="admin/connexion" element={<Navigate to="/admin/acces" replace />} />
        <Route path="admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index element={<Navigate to="reservations" replace />} />
          <Route path="reservations" element={<ReservationListPage />} />
          <Route path="reservations/:id" element={<ReservationDetailPage />} />
          <Route path="clients" element={<ClientListPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />
          <Route path="*" element={<NotFoundPage admin />} />
        </Route>
        {/* anciennes adresses de l'espace de gestion */}
        <Route path="login" element={<Navigate to="/admin/acces" replace />} />
        <Route path="reservations/*" element={<Navigate to="/admin/reservations" replace />} />
      </Routes>
    </Suspense>
  )
}
