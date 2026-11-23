import clsx from 'clsx'
import { ArrowRight, CarFront, CircleCheck, Clock3, XCircle } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { AmountDetail } from '../../components/reservations/PriceSummary'
import { useReservationActions } from '../../components/reservations/useReservationActions'
import { CheckPill } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ErrorState, PageLoader } from '../../components/ui/Feedback'
import { Breadcrumb, PageHeader } from '../../components/ui/Navigation'
import { useAsync, useDocumentTitle } from '../../hooks'
import { reservationService } from '../../services/reservationService'
import { getErrorMessage } from '../../utils/errors'
import { formatDateLong, formatDateTimeLong, formatDateTimeShort, formatTime, plural } from '../../utils/format'

const BANNERS = {
  EN_ATTENTE: {
    icon: Clock3,
    title: 'En attente de paiement',
    text: "Le client n'a pas encore payé en ligne. Confirmez quand il règle au comptoir, ou annulez.",
    className: 'bg-pending-soft text-pending-text',
  },
  CONFIRMEE: {
    icon: CircleCheck,
    title: 'Réservation confirmée',
    text: 'Payée : le véhicule est réservé pour cette période et le client a reçu un e-mail récapitulatif.',
    className: 'bg-brand-soft text-brand',
  },
  ANNULEE: {
    icon: XCircle,
    title: 'Réservation annulée',
    text: 'Le véhicule a été libéré pour cette période.',
    className: 'bg-danger-soft text-danger-text',
  },
}

const EVENT_DOT = {
  CREATED: 'bg-brand',
  UPDATED: 'bg-ink-faint',
  CONFIRMED: 'bg-brand',
  EMAIL_SENT: 'bg-success',
  EMAIL_FAILED: 'bg-danger',
  CANCELLED: 'bg-danger',
  PAYMENT_REFUSED: 'bg-danger',
  EXTENDED: 'bg-brand',
}

function Card({ title, action, children, className }) {
  return (
    <section className={clsx('card p-5 sm:p-6', className)}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Info({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="label-caps">{label}</p>
      <p className="mt-1.5 break-words text-[15px] font-medium text-ink">{children}</p>
    </div>
  )
}

/** F003 – Consultation et gestion d'une réservation faite sur le site (aucune modification des données client). */
export default function ReservationDetailPage() {
  const { id } = useParams()
  const { data: r, loading, error, reload, setData } = useAsync(() => reservationService.get(id), [id])
  const { askConfirm, askCancel, dialogs } = useReservationActions({ onChanged: setData })
  useDocumentTitle(r ? `Réservation ${r.numero}` : 'Réservation')

  if (loading && !r) return <PageLoader />
  if (error) return <ErrorState title="Réservation introuvable" message={getErrorMessage(error)} onRetry={reload} />

  const banner = BANNERS[r.statut]
  const BannerIcon = banner.icon
  const v = r.vehicule

  return (
    <>
      <Breadcrumb items={[{ label: 'Réservations', to: '/admin/reservations' }, { label: 'Détail de la réservation' }]} />
      <PageHeader
        title={`Réservation n° ${r.numero}`}
        subtitle={r.created_at ? `Réservée en ligne le ${formatDateTimeLong(r.created_at)}${r.cree_par ? ` par ${r.cree_par}` : ''}` : `Réservée le ${formatDateLong(r.date_reservation)}`}
      />

      <div role="status" className={clsx('mb-5 flex flex-col gap-1 rounded-xl px-5 py-4 text-sm sm:flex-row sm:items-center sm:gap-14', banner.className)}>
        <span className="flex items-center gap-2.5 font-semibold">
          <BannerIcon className="h-[18px] w-[18px]" aria-hidden /> {banner.title}
        </span>
        <span className="text-ink-soft">
          {r.statut === 'ANNULEE' && r.motif_annulation ? `Motif : ${r.motif_annulation}` : banner.text}
        </span>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card title="Informations client" action={<Link to={`/admin/clients/${r.client.id}`} className="link text-xs">Voir la fiche client</Link>}>
            <div className="grid gap-5 sm:grid-cols-3">
              <Info label="Client">{r.client.nom_complet}</Info>
              <Info label="E-mail">{r.client.email}</Info>
              <Info label="Téléphone">{r.client.telephone}</Info>
            </div>
          </Card>

          <Card title="Période de location">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4">
              <Info label="Départ">
                {formatDateLong(r.debut)} · {formatTime(r.debut)}
              </Info>
              <ArrowRight className="mb-1 h-5 w-5 text-brand" aria-label="jusqu'au" />
              <Info label="Retour">
                {formatDateLong(r.fin)} · {formatTime(r.fin)}
              </Info>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-[13px]">
              <span className="text-ink-muted">Départ {formatTime(r.debut)} · retour {formatTime(r.fin)}</span>
              <span className="font-semibold text-brand">{plural(r.duree_jours, 'jour')} de location</span>
            </div>
          </Card>

          <Card title="Véhicule réservé">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-field">
                <CarFront className="h-6 w-6 text-ink-soft" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold">{v.libelle}</p>
                <p className="mt-0.5 text-[13px] text-ink-muted">{[v.immatriculation, v.categorie].filter(Boolean).join(' · ')}</p>
                {(v.boite || v.carburant) && <p className="text-xs text-ink-faint">{[v.boite, v.carburant].filter(Boolean).join(' · ')}</p>}
              </div>
              {r.statut === 'EN_ATTENTE' && <CheckPill>Disponible</CheckPill>}
              {r.statut === 'CONFIRMEE' && <CheckPill>Réservé</CheckPill>}
              {r.statut === 'ANNULEE' && <CheckPill tone="neutral">Libéré</CheckPill>}
            </div>
          </Card>

          {/* Actions F003 */}
          {(r.actions.peut_confirmer || r.actions.peut_annuler) && (
            <div className="card flex flex-col-reverse gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              {r.actions.peut_annuler ? (
                <Button variant="danger-ghost" icon={XCircle} onClick={() => askCancel(r)}>
                  Annuler la réservation
                </Button>
              ) : <span />}
              {r.actions.peut_confirmer && (
                <Button icon={CircleCheck} onClick={() => askConfirm(r)} className="px-6">
                  Confirmer (paiement reçu à l'agence)
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-5 lg:sticky lg:top-6">
          <Card title="Détail du montant">
            <AmountDetail amounts={r} assistance={r.assistance} devise={r.devise} note={r.statut === 'EN_ATTENTE' ? 'Non payée : paiement en ligne ou au comptoir le jour du départ.' : r.statut === 'CONFIRMEE' ? 'Réservation payée.' : undefined} />
          </Card>
          <Card title="Historique">
            <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line">
              {r.historique.map((e) => (
                <li key={e.id} className="relative flex gap-4 pl-0">
                  <span className={clsx('relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-white', EVENT_DOT[e.type] || 'bg-ink-faint')} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug">{e.message}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {formatDateTimeShort(e.date)}
                      {e.auteur && ` · ${e.auteur}`}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
      {dialogs}
    </>
  )
}
