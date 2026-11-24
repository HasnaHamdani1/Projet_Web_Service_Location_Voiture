import clsx from 'clsx'
import { ArrowRight, CalendarCheck, CarFront, CreditCard } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { VehicleImage } from '../../components/site/VehicleImage'
import { StatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback'
import { Pagination } from '../../components/ui/Navigation'
import { useAuth } from '../../context/AuthContext'
import { useAsync, useDocumentTitle } from '../../hooks'
import { catalogueService, clientReservationService } from '../../services/reservationService'
import { getErrorMessage } from '../../utils/errors'
import { formatDateShort, formatMoney, formatPeriodShort, plural } from '../../utils/format'

const FILTRES = [
  { value: '', label: 'Toutes' },
  { value: 'EN_ATTENTE', label: 'À payer' },
  { value: 'CONFIRMEE', label: 'Confirmées' },
  { value: 'ANNULEE', label: 'Annulées' },
]

/** Espace client : historique de ses réservations (le serveur filtre sur le client du jeton). */
export default function MyReservationsPage() {
  useDocumentTitle('Mes réservations')
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const statut = params.get('statut') || ''
  const page = Number(params.get('page')) || 1
  const list = useAsync(() => clientReservationService.mine({ statut: statut || undefined, page, size: 8 }), [statut, page])
  // Photos : le résumé de réservation ne porte que l'id du véhicule → on s'appuie sur le catalogue public
  const catalogue = useAsync(() => catalogueService.list({}), [])
  const images = useMemo(() => Object.fromEntries((catalogue.data || []).map((v) => [v.id, v.image_url])), [catalogue.data])

  const go = (patch) => setParams((prev) => {
    const next = new URLSearchParams(prev)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, String(v)) : next.delete(k)))
    return next
  })
  const data = list.data

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-extrabold tracking-tight">Mes réservations</h1>
          <p className="mt-1 text-ink-muted">Bonjour {user.nom.split(' ')[0]}, retrouvez ici toutes vos locations.</p>
        </div>
        <Button icon={CarFront} to="/vehicules">Nouvelle location</Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Filtrer par statut">
        {FILTRES.map((f) => (
          <button key={f.value} type="button" role="tab" aria-selected={statut === f.value} onClick={() => go({ statut: f.value, page: '' })}
            className={clsx('rounded-full px-4 py-2 text-sm font-semibold transition-colors',
              statut === f.value ? 'bg-ink text-white' : 'bg-white text-ink-soft ring-1 ring-line hover:bg-field')}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4" aria-live="polite" aria-busy={list.loading}>
        {list.error ? (
          <div className="card"><ErrorState message={getErrorMessage(list.error)} onRetry={list.reload} /></div>
        ) : !data ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[136px] rounded-card" />)
        ) : data.items.length === 0 ? (
          <div className="card">
            <EmptyState icon={CalendarCheck} title={statut ? 'Aucune réservation dans cette catégorie' : 'Aucune réservation pour le moment'}
              description="Choisissez un véhicule et vos dates : la réservation apparaîtra ici."
              action={<Button to="/vehicules" iconRight={ArrowRight}>Voir les véhicules</Button>} />
          </div>
        ) : (
          data.items.map((r) => (
            <article key={r.id} className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
              <VehicleImage vehicle={{ id: r.vehicule_id, marque: '', modele: r.vehicule_libelle, image_url: images[r.vehicule_id] }}
                className="aspect-[16/10] w-full shrink-0 sm:h-24 sm:w-36" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-[17px] font-bold">{r.vehicule_libelle || `Véhicule #${r.vehicule_id}`}</h2>
                  <StatusBadge statut={r.statut} />
                </div>
                <p className="mt-1 text-sm text-ink-soft">{formatPeriodShort(r.date_debut, r.date_fin)} · {plural(r.duree_jours, 'jour')}</p>
                <p className="mt-1 text-xs text-ink-muted">N° {r.numero} · réservée le {formatDateShort(r.date_reservation)}</p>
              </div>
              <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                <p className="text-lg font-extrabold">{formatMoney(r.montant_total, r.devise)}</p>
                <div className="flex gap-2">
                  {r.statut === 'EN_ATTENTE' && (
                    <Button size="sm" icon={CreditCard} to={`/mes-reservations/${r.id}/paiement`}>Payer</Button>
                  )}
                  <Link to={`/mes-reservations/${r.id}`} className="inline-flex h-9 items-center rounded-[10px] border border-line px-3.5 text-sm font-semibold hover:bg-field">Détails</Link>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
      {data && data.pages > 1 && (
        <div className="card mt-4"><Pagination page={data.page} pages={data.pages} total={data.total} size={data.size} onChange={(p) => go({ page: p })} /></div>
      )}
    </div>
  )
}
