import { Menu as HMenu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import clsx from 'clsx'
import { CalendarCheck, Car, ChevronDown, LayoutDashboard, LogOut, Menu, User, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { initials } from '../utils/format'

export function Logo({ to = '/' }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="PARC AUTO – accueil">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-white">
        <Car className="h-5 w-5" aria-hidden />
      </span>
      <span className="leading-none">
        <span className="block text-[15px] font-extrabold tracking-tight">PARC AUTO</span>
        <span className="text-[11px] font-semibold text-brand">Location de voitures</span>
      </span>
    </Link>
  )
}

const LIENS = [
  { to: '/', label: 'Accueil', end: true },
  { to: '/vehicules', label: 'Nos véhicules' },
  { to: '/#comment-ca-marche', label: 'Comment ça marche', hash: true },
]

function AccountMenu() {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <HMenu>
      <MenuButton className="inline-flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3 text-sm font-semibold hover:bg-field">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">{initials(user.nom)}</span>
        <span className="hidden max-w-[140px] truncate sm:inline">{user.nom}</span>
        <ChevronDown className="h-4 w-4 text-ink-muted" aria-hidden />
      </MenuButton>
      <MenuItems anchor={{ to: 'bottom end', gap: 8 }} className="z-50 w-60 rounded-xl bg-white p-1.5 shadow-pop ring-1 ring-black/5 focus:outline-none">
        <div className="px-3 py-2 text-xs text-ink-muted">Connecté·e en tant que<br /><span className="font-semibold text-ink">{user.email}</span></div>
        {isAdmin ? (
          <MenuItem>
            <Link to="/admin/reservations" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium data-[focus]:bg-field">
              <LayoutDashboard className="h-4 w-4" aria-hidden /> Espace administration
            </Link>
          </MenuItem>
        ) : (
          <MenuItem>
            <Link to="/mes-reservations" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium data-[focus]:bg-field">
              <CalendarCheck className="h-4 w-4" aria-hidden /> Mes réservations
            </Link>
          </MenuItem>
        )}
        <MenuItem>
          <button type="button" onClick={() => { logout(); navigate('/') }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-danger-text data-[focus]:bg-danger-soft">
            <LogOut className="h-4 w-4" aria-hidden /> Se déconnecter
          </button>
        </MenuItem>
      </MenuItems>
    </HMenu>
  )
}

/** Gabarit du site public de réservation. */
export default function SiteLayout() {
  const { isAuthenticated, isClient } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [location.pathname, location.hash])
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
    else window.scrollTo(0, 0)
  }, [location.pathname, location.hash])

  const navCls = ({ isActive }) =>
    clsx('rounded-lg px-3 py-2 text-sm font-semibold transition-colors', isActive ? 'text-brand' : 'text-ink-soft hover:text-ink')

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA]">
      <a href="#contenu" className="sr-only z-50 rounded bg-white px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Aller au contenu</a>
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation principale">
            {LIENS.map((l) => l.hash
              ? <Link key={l.label} to={l.to} className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft hover:text-ink">{l.label}</Link>
              : <NavLink key={l.label} to={l.to} end={l.end} className={navCls}>{l.label}</NavLink>)}
            {isClient && <NavLink to="/mes-reservations" className={navCls}>Mes réservations</NavLink>}
          </nav>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <AccountMenu />
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link to={`/connexion?retour=${encodeURIComponent(location.pathname + location.search)}`}
                  className="rounded-[10px] px-3.5 py-2 text-sm font-semibold text-ink-soft hover:bg-field hover:text-ink">Connexion</Link>
                <Link to="/inscription" className="rounded-[10px] bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink-soft">Créer un compte</Link>
              </div>
            )}
            <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-lg p-2 hover:bg-field md:hidden" aria-label="Menu" aria-expanded={open}>
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-line bg-white px-4 py-3 md:hidden" aria-label="Navigation mobile">
            {LIENS.map((l) => <Link key={l.label} to={l.to} className="block rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-field">{l.label}</Link>)}
            {isClient && <Link to="/mes-reservations" className="block rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-field">Mes réservations</Link>}
            {!isAuthenticated && (
              <div className="mt-2 flex gap-2 border-t border-line pt-3">
                <Link to="/connexion" className="flex-1 rounded-[10px] border border-line py-2.5 text-center text-sm font-semibold">Connexion</Link>
                <Link to="/inscription" className="flex-1 rounded-[10px] bg-ink py-2.5 text-center text-sm font-semibold text-white">Créer un compte</Link>
              </div>
            )}
          </nav>
        )}
      </header>

      <main id="contenu" className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-line bg-white">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-sm text-ink-muted">Réservez votre véhicule en ligne, payez en toute simplicité et retrouvez vos réservations à tout moment.</p>
          </div>
          <div className="text-sm">
            <p className="font-semibold">Location</p>
            <ul className="mt-3 space-y-2 text-ink-muted">
              <li><Link to="/vehicules" className="hover:text-ink">Nos véhicules</Link></li>
              <li><Link to="/mes-reservations" className="hover:text-ink">Mes réservations</Link></li>
              <li><Link to="/#comment-ca-marche" className="hover:text-ink">Comment ça marche</Link></li>
            </ul>
          </div>
          <div className="text-sm">
            <p className="font-semibold">Compte</p>
            <ul className="mt-3 space-y-2 text-ink-muted">
              <li><Link to="/inscription" className="hover:text-ink">Créer un compte</Link></li>
              <li><Link to="/connexion" className="hover:text-ink">Connexion</Link></li>
              <li><Link to="/admin/connexion" className="inline-flex items-center gap-1.5 hover:text-ink"><User className="h-3.5 w-3.5" aria-hidden /> Espace agence</Link></li>
            </ul>
          </div>
        </div>
        <p className="border-t border-line py-4 text-center text-xs text-ink-muted">PARC AUTO © {new Date().getFullYear()} – Projet Web Services, Master IL (groupe G9)</p>
      </footer>
    </div>
  )
}
