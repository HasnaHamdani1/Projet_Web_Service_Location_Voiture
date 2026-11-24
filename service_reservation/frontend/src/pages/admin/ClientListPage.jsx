import { Info, Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CountBadge } from '../../components/ui/Badge'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback'
import { Breadcrumb, PageHeader, Pagination } from '../../components/ui/Navigation'
import { useAsync, useDebounce, useDocumentTitle } from '../../hooks'
import { clientService } from '../../services/reservationService'
import { getErrorMessage } from '../../utils/errors'
import { initials } from '../../utils/format'

const SIZE = 15

/** Clients (comptes du service d'authentification, lecture seule) */
export default function ClientListPage() {
  useDocumentTitle('Clients')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const q = useDebounce(search.trim(), 300)
  const list = useAsync(() => clientService.list({ search: q || undefined }), [q])
  const all = list.data || []
  const pages = Math.max(1, Math.ceil(all.length / SIZE))
  const items = useMemo(() => all.slice((page - 1) * SIZE, page * SIZE), [all, page])

  return (
    <>
      <Breadcrumb items={[{ label: 'Clients' }]} />
      <PageHeader title="Clients" subtitle="Comptes clients gérés par le service d'authentification." />
      <p className="mb-5 flex items-start gap-2 rounded-xl bg-brand-soft/70 px-4 py-3 text-[13px] text-ink-soft">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
        Les clients créent leur compte depuis l'espace client (inscription). Cette liste est en lecture seule.
      </p>

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h2 className="flex items-center gap-3 text-lg font-bold">Tous les clients <CountBadge>{list.data ? all.length : '…'}</CountBadge></h2>
          <div className="relative sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <label htmlFor="client-search" className="sr-only">Rechercher un client</label>
            <input id="client-search" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Nom, e-mail, téléphone…" className="field-base h-10 pl-9" />
          </div>
        </div>
        {list.error ? (
          <ErrorState message={getErrorMessage(list.error)} onRetry={list.reload} />
        ) : list.loading && !list.data ? (
          <div className="space-y-3 px-6 pb-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : all.length === 0 ? (
          <EmptyState icon={Users} title="Aucun client trouvé" description={q ? 'Essayez une autre recherche.' : 'Aucun compte client pour le moment.'} />
        ) : (
          <>
            <ul className="divide-y divide-line border-t border-line">
              {items.map((c) => (
                <li key={c.id}>
                  <Link to={`/admin/clients/${c.id}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[#FAFBFC] sm:px-6">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">{initials(c.nom)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{c.nom}</span>
                      <span className="block truncate text-xs text-ink-muted sm:hidden">{c.email}</span>
                    </span>
                    <span className="hidden w-64 truncate text-sm text-ink-soft sm:block">{c.email}</span>
                    <span className="hidden w-36 text-sm text-ink-soft md:block">{c.telephone || '—'}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination page={page} pages={pages} total={all.length} size={SIZE} onChange={setPage} noun="clients" />
          </>
        )}
      </section>
    </>
  )
}
