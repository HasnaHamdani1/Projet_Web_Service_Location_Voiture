import clsx from 'clsx'
import { CalendarDays, Car, FileText, Globe, LogOut, Menu, Settings, Undo2, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { adminDashboardUrl, initials } from '../utils/format'

const env = import.meta.env

/**
 * Menu de l'espace agence. Les modules des autres membres du groupe sont des applications séparées :
 * leurs URL sont configurées par variables d'environnement (voir README).
 */
export const NAV = [
  { label: 'Véhicules', icon: Car, href: env.VITE_MODULE_VEHICULES_URL },
  { label: 'Réservations', icon: CalendarDays, to: '/admin/reservations' },
  { label: 'Clients', icon: Users, to: '/admin/clients' },
  { label: 'Contrats', icon: FileText, href: env.VITE_MODULE_CONTRATS_URL },
  { label: 'Retours', icon: Undo2, href: env.VITE_MODULE_RETOURS_URL },
  { label: 'Paramètres', icon: Settings, href: env.VITE_MODULE_PARAMETRES_URL },
  { label: 'Site client', icon: Globe, to: '/', end: true },
]

function Logo({ withText }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-white">
        <Car className="h-5 w-5" aria-hidden />
      </div>
      {withText && (
        <div className="leading-tight">
          <p className="text-[15px] font-extrabold tracking-tight">PARC AUTO</p>
          <p className="flex items-center gap-1 text-xs font-semibold text-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Location
          </p>
        </div>
      )}
    </div>
  )
}

function NavItems({ expanded, onNavigate }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {NAV.map(({ label, icon: Icon, to, href, end }) => {
        const base = clsx(
          'group relative flex h-11 items-center rounded-xl transition-colors',
          expanded ? 'gap-3 px-3' : 'w-11 justify-center',
        )
        const tooltip = !expanded && (
          <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-white opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {label}
            {!to && !href && ' · bientôt'}
          </span>
        )
        if (to) {
          return (
            <li key={label}>
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                aria-label={expanded ? undefined : label}
                className={({ isActive }) => clsx(base, isActive ? 'bg-brand text-white shadow-sm' : 'text-ink-muted hover:bg-field hover:text-ink')}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                {expanded && <span className="text-sm font-semibold">{label}</span>}
                {tooltip}
              </NavLink>
            </li>
          )
        }
        if (href) {
          return (
            <li key={label}>
              <a href={href} aria-label={expanded ? undefined : label} className={clsx(base, 'text-ink-muted hover:bg-field hover:text-ink')}>
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                {expanded && <span className="text-sm font-semibold">{label}</span>}
                {tooltip}
              </a>
            </li>
          )
        }
        return (
          <li key={label}>
            <span aria-disabled="true" aria-label={expanded ? undefined : `${label} (module non connecté)`} tabIndex={0}
              className={clsx(base, 'cursor-not-allowed text-ink-faint/70')}>
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              {expanded && <span className="text-sm font-medium">{label} <span className="text-xs">· bientôt</span></span>}
              {tooltip}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function UserBlock({ expanded }) {
  const { user, logout } = useAuth()
  return (
    <div className={clsx('flex items-center', expanded ? 'gap-3' : 'flex-col gap-2')}>
      <div title={`${user?.nom} (${user?.role})`}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">
        {initials(user?.nom || 'U')}
      </div>
      {expanded && (
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold">{user?.nom}</p>
          <p className="text-xs text-ink-muted">Administrateur</p>
        </div>
      )}
      <button type="button" onClick={() => { logout(); window.location.assign(adminDashboardUrl()) }} className="rounded-lg p-2 text-ink-muted hover:bg-field hover:text-danger-text" aria-label="Se déconnecter" title="Se déconnecter">
        <LogOut className="h-5 w-5" />
      </button>
    </div>
  )
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className="min-h-screen bg-page">
      <a href="#contenu" className="sr-only z-50 rounded bg-white px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Aller au contenu
      </a>

      {/* Barre latérale (ordinateur / tablette) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[76px] flex-col items-center border-r border-line bg-white py-5 md:flex" aria-label="Navigation principale">
        <Logo />
        <nav className="mt-10 flex-1">
          <NavItems expanded={false} />
        </nav>
        <UserBlock expanded={false} />
      </aside>

      {/* Barre supérieure (mobile) */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur md:hidden">
        <Logo withText />
        <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-field" aria-label="Ouvrir le menu" aria-expanded={open}>
          <Menu className="h-6 w-6" />
        </button>
      </header>

      {/* Tiroir mobile */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 flex w-72 animate-fade-in flex-col bg-white p-5 shadow-pop">
            <div className="flex items-center justify-between">
              <Logo withText />
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-field" aria-label="Fermer le menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-8 flex-1">
              <NavItems expanded onNavigate={() => setOpen(false)} />
            </nav>
            <UserBlock expanded />
          </div>
        </div>
      )}

      <main id="contenu" className="md:pl-[76px]">
        <div key={location.pathname} className="mx-auto w-full max-w-[1240px] animate-fade-in px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
