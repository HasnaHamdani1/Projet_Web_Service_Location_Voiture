import { ArrowDownUp, CarFront, Search, SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SearchBar } from '../../components/site/SearchBar'
import { VehicleCard } from '../../components/site/VehicleCard'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback'
import { FilterSelect } from '../../components/ui/FilterSelect'
import { useAsync, useDebounce, useDocumentTitle } from '../../hooks'
import { catalogueService } from '../../services/reservationService'
import { getErrorMessage } from '../../utils/errors'
import { formatDateShort, formatMoney, periodFromParams, plural } from '../../utils/format'

const TRIS = [
  { value: 'prix_asc', label: 'Prix croissant' },
  { value: 'prix_desc', label: 'Prix décroissant' },
  { value: 'nom', label: 'Nom (A → Z)' },
]

/** Catalogue public : véhicules du service Véhicule, disponibilité sur la période choisie. */
export default function CataloguePage() {
  useDocumentTitle('Nos véhicules')
  const [params, setParams] = useSearchParams()
  const period = periodFromParams(params)
  const hasPeriod = !!(period.date_debut && period.date_fin)
  const marque = params.get('marque') || ''
  const tri = params.get('tri') || 'prix_asc'
  const prixMax = params.get('prix_max') || ''
  const disponibles = params.get('disponibles') === '1'
  const [recherche, setRecherche] = useState(params.get('q') || '')
  const [filtresOuverts, setFiltresOuverts] = useState(false)
  const q = useDebounce(recherche.trim(), 300)

  const update = (patch) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
      return next
    }, { replace: true })

  const offres = useAsync(
    () => catalogueService.list({
      date_debut: period.date_debut || undefined,
      date_fin: period.date_fin || undefined,
      recherche: q || undefined,
      marque: marque || undefined,
      prix_max: prixMax || undefined,
      tri,
      disponibles: hasPeriod && disponibles ? true : undefined,
    }),
    [period.date_debut, period.date_fin, q, marque, prixMax, tri, disponibles],
  )

  // Marques proposées : liste complète (sans filtre de marque) pour ne pas « perdre » les options
  const toutes = useAsync(() => catalogueService.list({}), [])
  const marques = useMemo(() => {
    const set = new Set((toutes.data || []).map((o) => o.marque))
    return [{ value: '', label: 'Toutes les marques' }, ...[...set].sort().map((m) => ({ value: m, label: m }))]
  }, [toutes.data])
  const prixMaxCatalogue = Math.max(100, ...(toutes.data || []).map((o) => Math.ceil(o.prix_par_jour)))

  const items = offres.data || []
  const libres = items.filter((o) => o.disponible).length
  const resetFilters = () => { setRecherche(''); update({ marque: '', prix_max: '', disponibles: '', q: '' }) }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <h1 className="text-[30px] font-extrabold tracking-tight">Nos véhicules</h1>
      <p className="mt-1 text-ink-muted">
        {hasPeriod
          ? `Du ${formatDateShort(period.date_debut)} au ${formatDateShort(period.date_fin)} · ${plural(libres, 'véhicule')} disponible${libres > 1 ? 's' : ''}`
          : 'Choisissez vos dates pour voir les véhicules libres et le prix total.'}
      </p>

      <div className="mt-5">
        <SearchBar compact value={hasPeriod ? period : undefined} submitLabel="Mettre à jour"
          onSearch={(p) => update({ ...p, heure_debut: p.heure_debut !== '09:00' ? p.heure_debut : '', heure_fin: p.heure_fin !== '09:00' ? p.heure_fin : '' })} />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* ---------- Filtres ---------- */}
        <aside id="filtres" className={`card space-y-5 p-5 lg:sticky lg:top-24 lg:block ${filtresOuverts ? 'block' : 'hidden'}`} aria-label="Filtres">
          <p className="flex items-center gap-2 text-sm font-bold"><SlidersHorizontal className="h-4 w-4" aria-hidden /> Filtres</p>
          <div>
            <label htmlFor="recherche" className="mb-1.5 block text-[13px] font-medium text-ink-soft">Rechercher</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
              <input id="recherche" type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)}
                placeholder="Marque, modèle…" className="field-base h-10 pl-9" />
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink-soft">Marque</p>
            <FilterSelect label="Marque" value={marque} options={marques} onChange={(v) => update({ marque: v })} className="w-full [&>button]:w-full" />
          </div>
          <div>
            <label htmlFor="prix" className="mb-1.5 flex justify-between text-[13px] font-medium text-ink-soft">
              Prix maximum / jour <span className="font-semibold text-ink">{prixMax ? formatMoney(prixMax) : 'Tous'}</span>
            </label>
            <input id="prix" type="range" min={20} max={prixMaxCatalogue} step={5} value={prixMax || prixMaxCatalogue}
              onChange={(e) => update({ prix_max: Number(e.target.value) >= prixMaxCatalogue ? '' : e.target.value })}
              className="w-full accent-brand" />
          </div>
          <label className={`flex items-center gap-3 text-sm font-medium ${hasPeriod ? '' : 'opacity-50'}`}>
            <input type="checkbox" className="h-[18px] w-[18px] accent-brand" disabled={!hasPeriod} checked={disponibles}
              onChange={(e) => update({ disponibles: e.target.checked ? '1' : '' })} />
            Disponibles uniquement
          </label>
          <button type="button" onClick={resetFilters} className="text-xs font-semibold text-brand hover:underline">Réinitialiser les filtres</button>
        </aside>

        {/* ---------- Résultats ---------- */}
        <section aria-live="polite" aria-busy={offres.loading}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setFiltresOuverts((v) => !v)} aria-expanded={filtresOuverts} aria-controls="filtres"
                className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-white px-3 text-sm font-semibold ring-1 ring-line lg:hidden">
                <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filtres
              </button>
              <p className="hidden text-sm text-ink-muted sm:block">{offres.data ? plural(items.length, 'véhicule') : 'Chargement…'}</p>
            </div>
            <FilterSelect label="Trier" icon={ArrowDownUp} value={tri} options={TRIS} onChange={(v) => update({ tri: v === 'prix_asc' ? '' : v })} />
          </div>
          {offres.error ? (
            <div className="card"><ErrorState title="Catalogue indisponible" message={getErrorMessage(offres.error)} onRetry={offres.reload} /></div>
          ) : offres.loading && !offres.data ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[330px] rounded-card" />)}</div>
          ) : items.length === 0 ? (
            <div className="card">
              <EmptyState icon={CarFront} title="Aucun véhicule ne correspond"
                description={hasPeriod && disponibles ? 'Tous les véhicules sont pris sur ces dates : essayez une autre période.' : 'Modifiez vos filtres pour élargir la recherche.'}
                action={<Button variant="secondary" onClick={resetFilters}>Réinitialiser les filtres</Button>} />
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((o) => <VehicleCard key={o.id} offer={o} period={hasPeriod ? period : undefined} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
