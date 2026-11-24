import { CalendarDays, CircleCheck, Clock3, Download, Globe, ListFilter, Search, SearchX, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { KpiCard } from '../../components/reservations/KpiCard'
import { ReservationTable } from '../../components/reservations/ReservationTable'
import { useReservationActions } from '../../components/reservations/useReservationActions'
import { CountBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorState } from '../../components/ui/Feedback'
import { FilterSelect } from '../../components/ui/FilterSelect'
import { Breadcrumb, PageHeader, Pagination } from '../../components/ui/Navigation'
import { useAsync, useDebounce, useDocumentTitle, useHotkey } from '../../hooks'
import { reservationService } from '../../services/reservationService'
import { getErrorMessage } from '../../utils/errors'
import { currentMonth, lastMonths, monthLabel } from '../../utils/format'

const PAGE_SIZE = 10
const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'CONFIRMEE', label: 'Confirmée' },
  { value: 'ANNULEE', label: 'Annulée' },
]
const ALL_MONTHS = 'tous'

/** F001 – Liste des réservations */
export default function ReservationListPage() {
  useDocumentTitle('Réservations')
  const [params, setParams] = useSearchParams()
  const thisMonth = currentMonth()
  const statut = params.get('statut') || ''
  const mois = params.get('mois') || thisMonth
  const page = Number(params.get('page') || 1)
  const [search, setSearch] = useState(params.get('q') || '')
  const debouncedSearch = useDebounce(search.trim(), 300)
  const searchRef = useRef(null)

  useHotkey('k', useCallback(() => searchRef.current?.focus(), []))

  const update = useCallback(
    (patch) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
        if (!('page' in patch)) next.delete('page')
        return next
      }, { replace: true })
    },
    [setParams],
  )

  // La recherche est synchronisée dans l'URL (retour arrière conservé)
  useEffect(() => {
    if ((params.get('q') || '') !== debouncedSearch) update({ q: debouncedSearch })
  }, [debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  const statsMonth = mois === ALL_MONTHS ? thisMonth : mois
  const stats = useAsync(() => reservationService.stats(statsMonth), [statsMonth])
  const list = useAsync(
    () =>
      reservationService.list({
        page,
        size: PAGE_SIZE,
        statut: statut || undefined,
        mois: mois === ALL_MONTHS ? undefined : mois,
        search: debouncedSearch || undefined,
      }),
    [page, statut, mois, debouncedSearch],
  )

  const refresh = () => {
    list.reload()
    stats.reload()
  }
  const { askConfirm, askCancel, dialogs } = useReservationActions({ onChanged: refresh })

  const [exporting, setExporting] = useState(false)
  const exporter = async () => {
    setExporting(true)
    try {
      const blob = await reservationService.exportCsv({
        statut: statut || undefined,
        mois: mois === ALL_MONTHS ? undefined : mois,
        search: debouncedSearch || undefined,
      })
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), { href: url, download: `reservations-${mois === ALL_MONTHS ? 'toutes' : mois}.csv` })
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Export impossible.'))
    } finally {
      setExporting(false)
    }
  }

  const monthOptions = useMemo(() => [...lastMonths(12), { value: ALL_MONTHS, label: 'Tous les mois' }], [])
  const s = stats.data
  const isCurrent = statsMonth === thisMonth
  const monthSuffix = isCurrent ? 'ce mois' : `– ${monthLabel(statsMonth).toLowerCase()}`
  const hasFilters = !!(statut || debouncedSearch || mois !== thisMonth)
  const pct = (n) => (s?.total_mois ? (n * 100) / s.total_mois : 0)

  return (
    <>
      <Breadcrumb items={[{ label: 'Réservations', to: '/admin/reservations' }, { label: 'Liste des réservations' }]} />
      <PageHeader
        title="Gestion des réservations"
        subtitle="Réservations effectuées par les clients sur le site : suivi, confirmation des paiements à l'agence et annulations."
        actions={
          <Button variant="outline" icon={Download} loading={exporting} onClick={exporter} className="px-5">
            Exporter (CSV)
          </Button>
        }
      />

      {/* Recherche ⌘K */}
      <div className="card mb-5 flex h-[52px] items-center gap-3 px-5 focus-within:ring-2 focus-within:ring-brand-soft">
        <Search className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
        <label htmlFor="search" className="sr-only">Rechercher une réservation</label>
        <input
          id="search"
          ref={searchRef}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setSearch('')}
          placeholder="Rechercher par N° de réservation, client, immatriculation…"
          className="h-full min-w-0 flex-1 bg-transparent text-sm placeholder:text-ink-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {search ? (
          <button type="button" onClick={() => setSearch('')} className="rounded p-1 text-ink-muted hover:bg-field" aria-label="Effacer la recherche">
            <X className="h-4 w-4" />
          </button>
        ) : (
          <kbd className="hidden text-xs font-medium text-ink-muted sm:block" aria-label="Raccourci Commande K">⌘ K</kbd>
        )}
      </div>

      {/* Indicateurs du mois */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <KpiCard
          label={`Total réservations ${monthSuffix}`}
          value={s?.total_mois ?? '—'}
          caption={s ? `${s.variation >= 0 ? '+' : ''}${s.variation} par rapport au mois dernier` : ''}
          progress={pct((s?.en_attente || 0) + (s?.confirmees || 0))}
          tone="dark"
          icon={CalendarDays}
          loading={stats.loading && !s}
        />
        <KpiCard
          label="En attente de paiement"
          value={s?.en_attente ?? '—'}
          caption="À confirmer au comptoir ou à annuler"
          progress={pct(s?.en_attente || 0)}
          tone="orange"
          icon={Clock3}
          loading={stats.loading && !s}
        />
        <KpiCard
          label="Réservations confirmées"
          value={s?.confirmees ?? '—'}
          caption={s ? `${s.taux_confirmation} % des réservations du mois` : ''}
          progress={s?.taux_confirmation || 0}
          tone="blue"
          icon={CircleCheck}
          loading={stats.loading && !s}
        />
      </div>

      {/* Tableau */}
      <section className="card overflow-hidden" aria-labelledby="titre-table">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h2 id="titre-table" className="flex items-center gap-3 text-lg font-bold">
            Toutes les réservations <CountBadge>{list.data?.total ?? '…'}</CountBadge>
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <FilterSelect label="Filtrer par statut" icon={ListFilter} value={statut} options={STATUS_OPTIONS} onChange={(v) => update({ statut: v })} />
            <FilterSelect label="Filtrer par mois" icon={CalendarDays} value={mois} options={monthOptions}
              onChange={(v) => update({ mois: v === thisMonth ? '' : v })} className="sm:min-w-[190px]" />
          </div>
        </div>

        {list.error ? (
          <ErrorState message={getErrorMessage(list.error)} onRetry={list.reload} />
        ) : !list.loading && list.data?.items.length === 0 ? (
          hasFilters ? (
            <EmptyState icon={SearchX} title="Aucune réservation ne correspond à vos critères"
              description="Modifiez la recherche ou les filtres pour élargir les résultats."
              action={<Button variant="secondary" onClick={() => { setSearch(''); setParams({}, { replace: true }) }}>Réinitialiser les filtres</Button>} />
          ) : (
            <EmptyState icon={CalendarDays} title="Aucune réservation ce mois-ci"
              description="Les réservations faites par les clients sur le site apparaîtront ici."
              action={<Button variant="secondary" icon={Globe} to="/">Voir le site client</Button>} />
          )
        ) : (
          <>
            <ReservationTable items={list.data?.items || []} loading={list.loading && !list.data} onConfirm={askConfirm} onCancel={askCancel} />
            {list.data && (
              <Pagination page={list.data.page} pages={list.data.pages} total={list.data.total} size={list.data.size}
                onChange={(p) => update({ page: String(p) })} />
            )}
          </>
        )}
      </section>
      {dialogs}
    </>
  )
}
