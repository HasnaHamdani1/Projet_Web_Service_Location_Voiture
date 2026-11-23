import { ArrowRight, BadgeCheck, CalendarCheck, CarFront, CreditCard, Headset, RotateCcw, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { defaultPeriod, SearchBar } from '../../components/site/SearchBar'
import { VehicleCard } from '../../components/site/VehicleCard'
import { VehicleImage } from '../../components/site/VehicleImage'
import { Button } from '../../components/ui/Button'
import { ErrorState, Skeleton } from '../../components/ui/Feedback'
import { useAsync, useDocumentTitle } from '../../hooks'
import { catalogueService } from '../../services/reservationService'
import { getErrorMessage } from '../../utils/errors'
import { periodQuery } from '../../utils/format'

const ETAPES = [
  { icon: Search, titre: 'Choisissez vos dates', texte: 'Indiquez la période : seuls les véhicules libres sont mis en avant, avec le prix total.' },
  { icon: CarFront, titre: 'Réservez en ligne', texte: 'Choisissez votre véhicule, ajoutez l’assistance renforcée si besoin et vérifiez le récapitulatif.' },
  { icon: CreditCard, titre: 'Payez et roulez', texte: 'Payez en ligne ou à l’agence. Votre confirmation arrive par e-mail avec votre numéro de réservation.' },
]

const ATOUTS = [
  { icon: BadgeCheck, titre: 'Prix clair', texte: 'Total TTC affiché avant de réserver, TVA comprise.' },
  { icon: RotateCcw, titre: 'Annulation en ligne', texte: 'Annulez vous-même depuis votre espace, jusqu’au jour du départ.' },
  { icon: Headset, titre: 'Assistance renforcée', texte: 'Option à 6,00 € par jour pour rouler l’esprit tranquille.' },
  { icon: CalendarCheck, titre: 'Disponibilité garantie', texte: 'Un véhicule réservé ne peut pas être attribué à quelqu’un d’autre.' },
]

export default function HomePage() {
  useDocumentTitle('Location de voitures')
  const navigate = useNavigate()
  const offres = useAsync(() => catalogueService.list({ tri: 'prix_asc' }), [])
  const vedette = (offres.data || []).slice(0, 3)
  const hero = offres.data?.[0]

  return (
    <>
      {/* ---------- Héros + recherche ---------- */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-[#F7F8FA]">
        <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-soft blur-3xl" aria-hidden />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-10 px-4 pb-10 pt-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
          <div className="animate-fade-in">
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" /> Réservation 100 % en ligne
            </p>
            <h1 className="mt-4 text-[38px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[52px]">
              La bonne voiture,<br /><span className="text-brand">aux bonnes dates.</span>
            </h1>
            <p className="mt-4 max-w-lg text-lg text-ink-soft">
              Comparez les véhicules disponibles, voyez le prix total tout de suite et réservez en quelques clics.
            </p>
          </div>
          <div className="hidden lg:block">
            <VehicleImage vehicle={hero || { id: 0 }} className="aspect-[16/10] shadow-pop" rounded="rounded-[28px]" />
          </div>
        </div>
        <div className="relative mx-auto max-w-[1200px] px-4 pb-12 sm:px-6">
          <SearchBar value={defaultPeriod()} onSearch={(p) => navigate(`/vehicules${periodQuery(p)}`)} submitLabel="Voir les véhicules" />
        </div>
      </section>

      {/* ---------- Véhicules à la une ---------- */}
      <section className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[28px] font-extrabold tracking-tight">Nos véhicules</h2>
            <p className="mt-1 text-ink-muted">Les tarifs les plus doux du moment, mis à jour depuis notre parc.</p>
          </div>
          <Button variant="secondary" to="/vehicules" iconRight={ArrowRight} className="hidden sm:inline-flex">Tout le catalogue</Button>
        </div>
        {offres.error ? (
          <div className="card"><ErrorState title="Catalogue indisponible" message={getErrorMessage(offres.error)} onRetry={offres.reload} /></div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {offres.loading && !offres.data
              ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[340px] rounded-card" />)
              : vedette.map((o) => <VehicleCard key={o.id} offer={o} />)}
          </div>
        )}
      </section>

      {/* ---------- Comment ça marche ---------- */}
      <section id="comment-ca-marche" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 py-10 sm:px-6">
        <h2 className="text-[28px] font-extrabold tracking-tight">Comment ça marche ?</h2>
        <ol className="mt-6 grid gap-5 md:grid-cols-3">
          {ETAPES.map(({ icon: Icon, titre, texte }, i) => (
            <li key={titre} className="card p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white"><Icon className="h-5 w-5" aria-hidden /></span>
                <span className="text-sm font-semibold text-ink-muted">Étape {i + 1}</span>
              </div>
              <h3 className="mt-4 text-lg font-bold">{titre}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{texte}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Atouts ---------- */}
      <section className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">
        <div className="grid gap-4 rounded-[28px] bg-ink p-6 text-white sm:grid-cols-2 sm:p-10 lg:grid-cols-4">
          {ATOUTS.map(({ icon: Icon, titre, texte }) => (
            <div key={titre}>
              <Icon className="h-6 w-6 text-[#9EBDF5]" aria-hidden />
              <p className="mt-3 font-semibold">{titre}</p>
              <p className="mt-1 text-sm text-white/70">{texte}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
