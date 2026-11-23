import { CalendarDays, Mail, Phone } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ReservationTable } from '../../components/reservations/ReservationTable'
import { useReservationActions } from '../../components/reservations/useReservationActions'
import { CountBadge } from '../../components/ui/Badge'
import { EmptyState, ErrorState, PageLoader } from '../../components/ui/Feedback'
import { Breadcrumb, PageHeader, Pagination } from '../../components/ui/Navigation'
import { useAsync, useDocumentTitle } from '../../hooks'
import { clientService, reservationService } from '../../services/reservationService'
import { getErrorMessage } from '../../utils/errors'
import { initials } from '../../utils/format'

/** Fiche client (lien « Voir la fiche client » de F003) */
export default function ClientDetailPage() {
  const { id } = useParams()
  const [page, setPage] = useState(1)
  const client = useAsync(() => clientService.get(id), [id])
  const resas = useAsync(() => reservationService.list({ client_id: id, page, size: 10 }), [id, page])
  const confirmed = useAsync(() => reservationService.list({ client_id: id, statut: 'CONFIRMEE', size: 1 }), [id])
  const { askConfirm, askCancel, dialogs } = useReservationActions({ onChanged: () => { resas.reload(); confirmed.reload() } })
  useDocumentTitle(client.data?.nom || 'Fiche client')

  if (client.loading && !client.data) return <PageLoader />
  if (client.error) return <ErrorState title="Client introuvable" message={getErrorMessage(client.error)} onRetry={client.reload} />
  const c = client.data
  const items = resas.data?.items || []

  return (
    <>
      <Breadcrumb items={[{ label: 'Clients', to: '/admin/clients' }, { label: c.nom }]} />
      <PageHeader title={c.nom} subtitle={`Client n° ${c.id} · compte du site de réservation`} />

      <div className="mb-5 grid gap-4 md:grid-cols-[1.4fr_1fr_1fr]">
        <section className="card flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand">{initials(c.nom)}</span>
          <div className="min-w-0 space-y-1 text-sm">
            <p className="flex items-center gap-2 truncate"><Mail className="h-4 w-4 text-ink-muted" aria-hidden /> <a href={`mailto:${c.email}`} className="truncate hover:text-brand">{c.email}</a></p>
            <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-ink-muted" aria-hidden /> {c.telephone ? <a href={`tel:${c.telephone.replace(/\s/g, '')}`} className="hover:text-brand">{c.telephone}</a> : '—'}</p>
          </div>
        </section>
        <section className="card p-5">
          <p className="label-caps">Réservations</p>
          <p className="mt-2 text-[28px] font-extrabold leading-none">{resas.data?.total ?? '—'}</p>
        </section>
        <section className="card p-5">
          <p className="label-caps">Réservations confirmées</p>
          <p className="mt-2 text-[28px] font-extrabold leading-none">{confirmed.data?.total ?? '—'}</p>
        </section>
      </div>

      <section className="card overflow-hidden">
        <h2 className="flex items-center gap-3 px-6 py-4 text-lg font-bold">Historique des réservations <CountBadge>{resas.data?.total ?? '…'}</CountBadge></h2>
        {resas.error ? (
          <ErrorState message={getErrorMessage(resas.error)} onRetry={resas.reload} />
        ) : !resas.loading && items.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Aucune réservation pour ce client"
            description="Ce client n'a encore rien réservé sur le site." />
        ) : (
          <>
            <ReservationTable items={items} loading={resas.loading && !resas.data} onConfirm={askConfirm} onCancel={askCancel} hideClient />
            {resas.data && <Pagination page={resas.data.page} pages={resas.data.pages} total={resas.data.total} size={resas.data.size} onChange={setPage} />}
          </>
        )}
      </section>
      {dialogs}
    </>
  )
}
