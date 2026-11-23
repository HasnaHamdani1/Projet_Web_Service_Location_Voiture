import { ArrowLeft, CalendarDays, CreditCard, Printer, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AmountDetail } from '../../components/reservations/PriceSummary'
import { VehicleImage } from '../../components/site/VehicleImage'
import { StatusBadge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Dialog'
import { ErrorState, PageLoader } from '../../components/ui/Feedback'
import { Field, Textarea } from '../../components/ui/Field'
import { useAsync, useDocumentTitle } from '../../hooks'
import { catalogueService, clientReservationService } from '../../services/reservationService'
import { getErrorMessage } from '../../utils/errors'
import { formatDateLong, formatDateTimeShort, plural } from '../../utils/format'

const SUIVI = { CREATED: 'Réservation effectuée', CONFIRMED: 'Réservation confirmée', CANCELLED: 'Réservation annulée',
  PAYMENT_REFUSED: 'Paiement refusé', EMAIL_SENT: 'E-mail de confirmation envoyé', EXTENDED: 'Location prolongée' }

const MESSAGE_STATUT = {
  EN_ATTENTE: { cls: 'bg-pending-soft text-pending-text', text: 'En attente de paiement : le véhicule est bloqué pour vous. Payez en ligne ou au comptoir le jour du départ.' },
  CONFIRMEE: { cls: 'bg-brand-soft text-brand', text: 'Réservation confirmée : présentez votre permis et une pièce d’identité au départ.' },
  ANNULEE: { cls: 'bg-danger-soft text-danger-text', text: 'Cette réservation a été annulée.' },
}

function Info({ label, children }) {
  return <div><dt className="label-caps">{label}</dt><dd className="mt-1.5 font-medium">{children}</dd></div>
}

export default function MyReservationDetailPage() {
  const { id } = useParams()
  const { data: r, loading, error, reload, setData } = useAsync(() => clientReservationService.get(id), [id])
  const vehicule = useAsync(() => catalogueService.get(r.vehicule_id), [r?.vehicule_id], { enabled: !!r })
  const [annuler, setAnnuler] = useState(false)
  const [motif, setMotif] = useState('')
  const [envoi, setEnvoi] = useState(false)
  useDocumentTitle(r ? `Réservation ${r.numero}` : 'Ma réservation')

  if (loading && !r) return <PageLoader />
  if (error) return <div className="mx-auto max-w-[900px] px-4 py-10"><div className="card"><ErrorState message={getErrorMessage(error)} onRetry={reload} /></div></div>

  const confirmerAnnulation = async () => {
    setEnvoi(true)
    try {
      setData(await clientReservationService.cancel(r.id, motif.trim() || undefined))
      toast.success('Réservation annulée')
      setAnnuler(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setEnvoi(false)
    }
  }

  const v = r.vehicule
  const statut = MESSAGE_STATUT[r.statut]
  const suivi = (r.historique || []).filter((e) => SUIVI[e.type])

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <Link to="/mes-reservations" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink print:hidden">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Mes réservations
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] font-extrabold tracking-tight">Réservation {r.numero}</h1>
            <StatusBadge statut={r.statut} />
          </div>
          <p className="mt-1 text-sm text-ink-muted">Effectuée le {formatDateLong(r.date_reservation)}</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Imprimer</Button>
          {r.actions.peut_annuler && <Button variant="danger" icon={XCircle} onClick={() => setAnnuler(true)}>Annuler</Button>}
          {r.actions.peut_payer && <Button icon={CreditCard} to={`/mes-reservations/${r.id}/paiement`} state={{ reservation: r }}>Payer</Button>}
        </div>
      </div>

      <p className={`mt-5 rounded-xl px-5 py-3.5 text-sm font-medium ${statut.cls}`}>
        {statut.text}
        {r.statut === 'ANNULEE' && r.motif_annulation ? ` Motif : ${r.motif_annulation}` : ''}
      </p>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="card flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
            <VehicleImage vehicle={{ ...v, image_url: vehicule.data?.image_url }} className="aspect-[16/10] w-full sm:w-56" />
            <dl className="grid flex-1 gap-4 sm:grid-cols-2">
              <Info label="Véhicule">{v.libelle}</Info>
              <Info label="Immatriculation">{v.immatriculation}</Info>
              <Info label="Départ">{formatDateLong(r.date_debut)} · {r.heure_debut}</Info>
              <Info label="Retour">{formatDateLong(r.date_fin)} · {r.heure_fin}</Info>
              <Info label="Durée">{plural(r.duree_jours, 'jour')}</Info>
              <Info label="Assistance renforcée">{r.assistance ? 'Incluse' : 'Non'}</Info>
            </dl>
          </section>
          <section className="card p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays className="h-5 w-5 text-ink-muted" aria-hidden /> Suivi</h2>
            <ol className="mt-4 space-y-4 border-l-2 border-line pl-5">
              {suivi.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand ring-2 ring-brand-soft" aria-hidden />
                  <p className="text-sm font-semibold">{SUIVI[e.type]}</p>
                  <p className="text-xs text-ink-muted">{formatDateTimeShort(e.date)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="card p-6">
          <h2 className="text-lg font-bold">Montant</h2>
          <div className="mt-4"><AmountDetail amounts={r} assistance={r.assistance} devise={r.devise} /></div>
        </aside>
      </div>

      <ConfirmDialog open={annuler} onClose={() => setAnnuler(false)} onConfirm={confirmerAnnulation} loading={envoi} tone="danger"
        title="Annuler cette réservation ?" confirmLabel="Annuler la réservation"
        message={`Le véhicule ${v.libelle} sera libéré pour ces dates. Cette action est définitive.`}>
        <Field label="Motif (facultatif)">{(a) => <Textarea {...a} rows={3} maxLength={500} value={motif} onChange={(e) => setMotif(e.target.value)} />}</Field>
      </ConfirmDialog>
    </div>
  )
}
