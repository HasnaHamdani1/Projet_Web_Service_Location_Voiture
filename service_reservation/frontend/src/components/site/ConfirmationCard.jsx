import { CalendarDays, CarFront, Check, Mail, TriangleAlert, User } from 'lucide-react'
import { CheckPill } from '../ui/Badge'
import { formatMoney, formatPeriodLong, formatTime, plural } from '../../utils/format'

function Column({ icon: Icon, label, title, sub }) {
  return (
    <div className="min-w-0 py-4 sm:px-6 sm:py-0 sm:first:pl-0">
      <p className="label-caps flex items-center gap-2"><Icon className="h-4 w-4 text-ink-soft" aria-hidden /> {label}</p>
      <p className="mt-3 truncate text-[15px] font-bold">{title}</p>
      <p className="mt-0.5 truncate text-[13px] text-ink-muted">{sub}</p>
    </div>
  )
}

/** Écran F004 vu par le client : réservation confirmée après paiement. */
export function ConfirmationCard({ reservation: r }) {
  const emailFailed = r.historique?.some((e) => e.type === 'EMAIL_FAILED') && !r.historique?.some((e) => e.type === 'EMAIL_SENT')
  const v = r.vehicule
  return (
    <section className="card mx-auto max-w-[810px] px-5 pb-8 pt-8 sm:px-7">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 animate-scale-in items-center justify-center rounded-full bg-success-soft text-success">
          <Check className="h-7 w-7" strokeWidth={2.5} aria-hidden />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight sm:text-[28px]">Votre réservation est confirmée</h1>
        <p className="mt-2 text-sm text-ink-muted">Réservation n° <span className="font-semibold text-ink">{r.numero}</span></p>
        {emailFailed ? (
          <p role="alert" className="mx-auto mt-3 flex max-w-md items-center justify-center gap-2 text-sm text-pending-text">
            <TriangleAlert className="h-4 w-4" aria-hidden /> L'e-mail de confirmation n'a pas pu partir : gardez ce numéro.
          </p>
        ) : (
          <p className="mx-auto mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-field px-5 py-2 text-xs text-ink-soft">
            <Mail className="h-4 w-4 shrink-0" aria-hidden /> <span className="truncate">Confirmation envoyée à {r.client.email}</span>
          </p>
        )}
      </div>

      <div className="mt-7 grid divide-y divide-line rounded-xl bg-[#F7F8FA] px-5 py-1 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 sm:py-5">
        <Column icon={User} label="Conducteur" title={r.client.nom_complet || r.client.nom || `Client #${r.client_id}`} sub={r.client.telephone || r.client.email} />
        <Column icon={CarFront} label="Véhicule" title={v.libelle} sub={[v.immatriculation, v.categorie].filter(Boolean).join(' · ')} />
        <Column icon={CalendarDays} label="Période" title={formatPeriodLong(r.debut, r.fin)} sub={`Départ ${formatTime(r.debut)} · ${plural(r.duree_jours, 'jour')}`} />
      </div>

      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-ink-muted">Montant payé TTC</p>
          <p className="mt-1 text-[32px] font-extrabold leading-none tracking-tight">{formatMoney(r.montant_total, r.devise)}</p>
          <p className="mt-2 text-xs text-ink-muted">Dont TVA (20 %) : {formatMoney(r.montant_tva, r.devise)} · Dépôt de garantie au départ : {formatMoney(r.depot_garantie, r.devise)}</p>
        </div>
        <CheckPill tone="success">Confirmée</CheckPill>
      </div>
      <p className="mt-6 rounded-xl border border-line px-4 py-3 text-[13px] text-ink-soft">
        Au départ, présentez votre permis de conduire, une pièce d'identité et ce numéro de réservation.
      </p>
    </section>
  )
}
