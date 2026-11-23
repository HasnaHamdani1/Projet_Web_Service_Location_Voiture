import clsx from 'clsx'
import { Building2, CalendarCheck, CarFront, CreditCard, Lock, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AmountDetail } from '../../components/reservations/PriceSummary'
import { ConfirmationCard } from '../../components/site/ConfirmationCard'
import { VehicleImage } from '../../components/site/VehicleImage'
import { Button } from '../../components/ui/Button'
import { ErrorState, PageLoader } from '../../components/ui/Feedback'
import { ETAPES_CLIENT, Stepper } from '../../components/ui/Navigation'
import { useAsync, useDocumentTitle } from '../../hooks'
import { catalogueService, clientReservationService } from '../../services/reservationService'
import { getErrorMessage } from '../../utils/errors'
import { formatMoney, formatPeriodShort, plural } from '../../utils/format'

const MODES = [
  { id: 'en_ligne', icon: CreditCard, titre: 'Payer en ligne maintenant', texte: 'Confirmation immédiate de la réservation.' },
  { id: 'agence', icon: Building2, titre: "Payer à l'agence", texte: "La réservation reste en attente jusqu'au paiement au comptoir." },
]

/** Étape 3 du parcours client : paiement simulé (aucune donnée bancaire n'est saisie ni stockée). */
export default function PaymentPage() {
  const { id } = useParams()
  const { state } = useLocation()
  const res = useAsync(() => clientReservationService.get(id), [id], { enabled: !state?.reservation })
  const [r, setR] = useState(state?.reservation)
  const reservation = r || res.data
  const photo = useAsync(() => catalogueService.get(reservation.vehicule_id), [reservation?.vehicule_id], { enabled: !!reservation })
  const [mode, setMode] = useState('en_ligne')
  const [envoi, setEnvoi] = useState(null)
  const [refus, setRefus] = useState(false)
  useDocumentTitle(reservation?.statut === 'CONFIRMEE' ? 'Réservation confirmée' : 'Paiement')

  if (!reservation && res.loading) return <PageLoader />
  if (res.error) return <div className="mx-auto max-w-[900px] px-4 py-10"><div className="card"><ErrorState message={getErrorMessage(res.error)} onRetry={res.reload} /></div></div>
  if (reservation.statut === 'ANNULEE') return <Navigate to={`/mes-reservations/${id}`} replace />

  if (reservation.statut === 'CONFIRMEE') {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <Stepper current={4} steps={ETAPES_CLIENT} />
        <ConfirmationCard reservation={reservation} />
        <div className="mx-auto mt-6 flex max-w-[810px] flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="secondary" icon={CalendarCheck} to="/mes-reservations">Mes réservations</Button>
          <Button icon={CarFront} to="/vehicules">Réserver un autre véhicule</Button>
        </div>
      </div>
    )
  }

  const payer = async (ok) => {
    setEnvoi(ok ? 'ok' : 'ko')
    setRefus(false)
    try {
      const out = await clientReservationService.pay(reservation.id, ok)
      setR(out.reservation)
      if (out.reservation.statut === 'CONFIRMEE') toast.success('Paiement accepté : réservation confirmée')
      else setRefus(true)
    } catch (err) {
      toast.error(getErrorMessage(err))
      res.reload()
    } finally {
      setEnvoi(null)
    }
  }

  const v = reservation.vehicule
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <h1 className="text-[30px] font-extrabold tracking-tight">Paiement</h1>
      <p className="mt-1 text-ink-muted">Réservation n° <span className="font-semibold text-ink">{reservation.numero}</span> · en attente de paiement</p>
      <div className="mt-6"><Stepper current={3} steps={ETAPES_CLIENT} /></div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="card space-y-5 p-5 sm:p-6">
          <h2 className="text-lg font-bold">Mode de paiement</h2>
          <div role="radiogroup" aria-label="Mode de paiement" className="grid gap-3 sm:grid-cols-2">
            {MODES.map(({ id: m, icon: Icon, titre, texte }) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                className={clsx('flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors',
                  mode === m ? 'border-brand bg-brand-soft/50' : 'border-line hover:border-ink-faint')}>
                <Icon className={clsx('mt-0.5 h-5 w-5 shrink-0', mode === m ? 'text-brand' : 'text-ink-muted')} aria-hidden />
                <span><span className="block text-sm font-bold">{titre}</span><span className="mt-0.5 block text-xs text-ink-muted">{texte}</span></span>
              </button>
            ))}
          </div>

          {refus && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3.5 text-sm font-medium text-danger-text">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Paiement refusé. Votre réservation reste en attente : réessayez ou choisissez le paiement à l'agence.
            </p>
          )}

          {mode === 'en_ligne' ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-field px-4 py-4 text-sm text-ink-soft">
                <p className="flex items-center gap-2 font-semibold text-ink"><Lock className="h-4 w-4" aria-hidden /> Paiement de démonstration</p>
                <p className="mt-1">Projet pédagogique : le paiement est simulé, aucun numéro de carte n'est demandé ni enregistré.</p>
              </div>
              <Button size="lg" className="w-full" loading={envoi === 'ok'} disabled={!!envoi} onClick={() => payer(true)}>
                Payer {formatMoney(reservation.montant_total, reservation.devise)}
              </Button>
              <p className="text-center">
                <button type="button" onClick={() => payer(false)} disabled={!!envoi} className="text-xs font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline">
                  Simuler un paiement refusé
                </button>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-field px-4 py-4 text-sm text-ink-soft">
                Le véhicule reste bloqué pour vous. Réglez le montant au comptoir le jour du départ :
                l'agence confirmera alors votre réservation. Vous pouvez l'annuler en ligne jusqu'à cette date.
              </div>
              <Button size="lg" variant="secondary" className="w-full" to={`/mes-reservations/${reservation.id}`}>
                Terminer et voir ma réservation
              </Button>
            </div>
          )}
        </section>

        <aside className="card p-6 lg:sticky lg:top-24">
          <h2 className="text-lg font-bold">Récapitulatif</h2>
          <div className="mt-4 flex items-center gap-4 border-b border-line pb-4">
            <VehicleImage vehicle={{ ...v, image_url: photo.data?.image_url }} className="h-16 w-24 shrink-0" />
            <div className="min-w-0">
              <p className="truncate font-bold">{v.libelle}</p>
              <p className="text-xs text-ink-muted">{formatPeriodShort(reservation.debut, reservation.fin)} · {plural(reservation.duree_jours, 'jour')}</p>
            </div>
          </div>
          <div className="mt-4"><AmountDetail amounts={reservation} assistance={reservation.assistance} devise={reservation.devise} /></div>
        </aside>
      </div>
    </div>
  )
}
