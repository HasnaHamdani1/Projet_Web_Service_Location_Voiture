import { ArrowLeft, Car, LayoutDashboard, ShieldCheck } from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useDocumentTitle } from '../../hooks'
import { adminDashboardUrl } from '../../utils/format'

/**
 * Espace agence sans écran de connexion propre : l'administrateur se connecte dans le tableau
 * de bord de Leila (service_auth) puis ouvre « Réservations », qui transmet son jeton ici.
 */
export default function AdminAccessPage() {
  useDocumentTitle('Espace agence')
  const { isAdmin } = useAuth()
  const { state } = useLocation()
  if (isAdmin) return <Navigate to="/admin/reservations" replace />

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] px-4">
      <div className="card w-full max-w-[520px] px-6 py-10 text-center sm:px-10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-white"><Car className="h-7 w-7" aria-hidden /></span>
        <h1 className="mt-5 text-[26px] font-extrabold tracking-tight">Espace agence – Réservations</h1>
        <p className="mt-2 text-ink-soft">
          La connexion de l'agence se fait dans le tableau de bord administrateur.
          Connectez-vous, puis ouvrez <strong>Réservations</strong> dans le menu : vous arriverez ici déjà connecté·e.
        </p>
        {state?.refus && (
          <p role="alert" className="mt-5 rounded-lg bg-danger-soft px-4 py-3 text-sm font-medium text-danger-text">
            Accès refusé : la session transmise a expiré ou n'appartient pas à un administrateur. Reconnectez-vous dans le tableau de bord.
          </p>
        )}
        <a href={adminDashboardUrl()} className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 font-semibold text-white hover:bg-brand-hover">
          <LayoutDashboard className="h-5 w-5" aria-hidden /> Ouvrir le tableau de bord administrateur
        </a>
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-ink-muted"><ShieldCheck className="h-4 w-4 text-success" aria-hidden /> Session vérifiée auprès du service d'authentification de l'équipe.</p>
        <Link to="/" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Retour au site de réservation
        </Link>
      </div>
    </div>
  )
}
