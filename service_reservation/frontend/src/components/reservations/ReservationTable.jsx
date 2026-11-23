import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import clsx from 'clsx'
import { CheckCircle2, Eye, MoreHorizontal, XCircle } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { formatMoney, formatPeriodShort } from '../../utils/format'
import { StatusBadge } from '../ui/Badge'
import { Skeleton } from '../ui/Feedback'

function RowMenu({ r, onConfirm, onCancel }) {
  const navigate = useNavigate()
  const pending = r.statut === 'EN_ATTENTE'
  const items = [
    { label: 'Voir le détail', icon: Eye, onClick: () => navigate(`/admin/reservations/${r.id}`) },
    pending && { label: 'Confirmer (payée)', icon: CheckCircle2, onClick: () => onConfirm(r), className: 'text-brand' },
    r.statut !== 'ANNULEE' && { label: 'Annuler', icon: XCircle, onClick: () => onCancel(r), className: 'text-danger-text' },
  ].filter(Boolean)
  return (
    <Menu>
      <MenuButton className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-field hover:text-ink data-[open]:bg-field" aria-label={`Actions pour ${r.numero}`}>
        <MoreHorizontal className="h-5 w-5" />
      </MenuButton>
      <MenuItems anchor={{ to: 'bottom end', gap: 4 }} className="z-40 w-48 rounded-xl bg-white p-1.5 shadow-pop ring-1 ring-black/5 focus:outline-none">
        {items.map(({ label, icon: Icon, onClick, className }) => (
          <MenuItem key={label}>
            <button type="button" onClick={onClick}
              className={clsx('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink data-[focus]:bg-field', className)}>
              <Icon className="h-4 w-4" aria-hidden /> {label}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  )
}

const HEAD = ['N° réservation', 'Client', 'Véhicule', 'Période', 'Statut', 'Montant']

/** Tableau « Toutes les réservations » (F001) — version cartes sur mobile */
export function ReservationTable({ items, loading, onConfirm, onCancel, hideClient = false }) {
  const cols = hideClient ? HEAD.filter((h) => h !== 'Client') : HEAD
  if (loading) {
    return (
      <div className="px-5 pb-4" aria-busy="true" aria-label="Chargement des réservations">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-line py-4 last:border-0">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="hidden h-4 w-28 md:block" />
            <Skeleton className="h-6 w-20 rounded-md" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <>
      {/* Tableau (≥ md) */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F7F8FA]">
              {cols.map((h) => (
                <th key={h} scope="col" className="label-caps whitespace-nowrap px-5 py-3 text-left first:pl-6">
                  {h}
                </th>
              ))}
              <th scope="col" className="w-14 px-5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-b border-line transition-colors last:border-0 hover:bg-[#FAFBFC]">
                <td className="whitespace-nowrap px-5 py-3.5 pl-6">
                  <Link to={`/admin/reservations/${r.id}`} className="font-semibold text-brand hover:underline">
                    {r.numero}
                  </Link>
                </td>
                {!hideClient && (
                  <td className="whitespace-nowrap px-5 py-3.5 font-medium">
                    <Link to={`/admin/clients/${r.client_id}`} className="hover:text-brand">{r.client_nom || `Client #${r.client_id}`}</Link>
                  </td>
                )}
                <td className="px-5 py-3.5">
                  <p className="font-semibold leading-tight">{r.vehicule_libelle || `Véhicule #${r.vehicule_id}`}</p>
                  <p className="mt-0.5 text-[11px] text-ink-muted">{r.vehicule_immatriculation}</p>
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-ink-muted">{formatPeriodShort(r.date_debut, r.date_fin)}</td>
                <td className="px-5 py-3.5">
                  <StatusBadge statut={r.statut} />
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 font-bold">{formatMoney(r.montant_total, r.devise)}</td>
                <td className="px-5 py-3.5 text-right">
                  <RowMenu r={r} onConfirm={onConfirm} onCancel={onCancel} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cartes (mobile) */}
      <ul className="divide-y divide-line md:hidden">
        {items.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <Link to={`/admin/reservations/${r.id}`} className="font-semibold text-brand">
                  {r.numero}
                </Link>
                <StatusBadge statut={r.statut} />
              </div>
              {!hideClient && <p className="mt-1.5 text-sm font-medium">{r.client_nom || `Client #${r.client_id}`}</p>}
              <p className="text-sm text-ink-soft">
                {r.vehicule_libelle || `Véhicule #${r.vehicule_id}`} <span className="text-xs text-ink-muted">· {r.vehicule_immatriculation}</span>
              </p>
              <div className="mt-1.5 flex items-center justify-between text-sm">
                <span className="text-ink-muted">{formatPeriodShort(r.date_debut, r.date_fin)}</span>
                <span className="font-bold">{formatMoney(r.montant_total, r.devise)}</span>
              </div>
            </div>
            <RowMenu r={r} onConfirm={onConfirm} onCancel={onCancel} />
          </li>
        ))}
      </ul>
    </>
  )
}
