import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
const AdminLoginPage = lazy(() => import('../pages/admin/AdminLoginPage'))
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

function RequireAdmin({ children }) {
  const { isAdmin } = useAuth()
  const location = useLocation()
  if (!isAdmin) return <Navigate to="/admin/connexion" replace state={{ from: location }} />
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

        <Route path="admin/connexion" element={<AdminLoginPage />} />
        <Route path="admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
          <Route index element={<Navigate to="reservations" replace />} />
          <Route path="reservations" element={<ReservationListPage />} />
          <Route path="reservations/:id" element={<ReservationDetailPage />} />
          <Route path="clients" element={<ClientListPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />
          <Route path="*" element={<NotFoundPage admin />} />
        </Route>
        {/* anciennes adresses de l'espace de gestion */}
        <Route path="login" element={<Navigate to="/admin/connexion" replace />} />
        <Route path="reservations/*" element={<Navigate to="/admin/reservations" replace />} />
      </Routes>
    </Suspense>
  )
}
