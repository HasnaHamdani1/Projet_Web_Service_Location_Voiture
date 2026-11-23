import clsx from 'clsx'
import { ArrowRight, Check, CircleSlash } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatMoney, periodQuery, plural } from '../../utils/format'
import { VehicleImage } from './VehicleImage'

/** Carte du catalogue : photo, prix par jour, total et disponibilité sur la période choisie. */
export function VehicleCard({ offer, period }) {
  const query = periodQuery(period || {})
  const unavailable = offer.disponible === false
  const specs = [offer.categorie, offer.boite, offer.carburant, offer.annee].filter(Boolean)
  return (
    <article className={clsx('card group flex flex-col overflow-hidden transition-shadow hover:shadow-pop', unavailable && 'opacity-80')}>
      <Link to={`/vehicules/${offer.id}${query}`} className="relative block" tabIndex={-1} aria-hidden>
        <VehicleImage vehicle={offer} className="aspect-[16/10]" rounded="rounded-none" />
        {offer.disponible === true && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-success shadow-sm">
            <Check className="h-3.5 w-3.5" aria-hidden /> Disponible
          </span>
        )}
        {unavailable && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-ink-soft shadow-sm">
            <CircleSlash className="h-3.5 w-3.5" aria-hidden /> Déjà réservé sur ces dates
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[17px] font-bold">
              <Link to={`/vehicules/${offer.id}${query}`} className="hover:text-brand">{offer.libelle}</Link>
            </h3>
            <p className="mt-0.5 truncate text-xs text-ink-muted">{specs.length ? specs.join(' · ') : 'Véhicule de location'}</p>
          </div>
          <p className="shrink-0 text-right">
            <span className="text-lg font-extrabold">{formatMoney(offer.prix_par_jour, offer.devise)}</span>
            <span className="block text-[11px] text-ink-muted">par jour</span>
          </p>
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <p className="text-sm text-ink-muted">
            {offer.prix_estime != null ? (
              <>
                <span className="block text-[11px] uppercase tracking-wide">Total {plural(offer.duree_jours, 'jour')}</span>
                <span className="font-bold text-ink">{formatMoney(offer.prix_estime, offer.devise)}</span>
              </>
            ) : (
              <span className="text-xs">Choisissez vos dates pour voir le total</span>
            )}
          </p>
          <Link to={`/vehicules/${offer.id}${query}`}
            className={clsx('inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] px-4 text-sm font-semibold transition-colors',
              unavailable ? 'bg-field text-ink-soft hover:bg-[#E4E6EA]' : 'bg-brand text-white hover:bg-brand-hover')}>
            {unavailable ? 'Voir les dates' : 'Réserver'} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  )
}
