import clsx from 'clsx'
import { Info } from 'lucide-react'
import { formatMoney } from '../../utils/format'
import { Skeleton } from '../ui/Feedback'

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

/**
 * Détail du montant (récapitulatif F002, « Détail du montant » F003).
 * `amounts` : { duree_jours, tarif_journalier, tarif_assistance, montant_location, montant_assistance, montant_total, montant_tva, depot_garantie }
 */
export function AmountDetail({ amounts, assistance, loading, devise = '€', note }) {
  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="mt-6 h-8 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }
  const a = amounts
  return (
    <div aria-live="polite">
      <Row label={`Location · ${a.duree_jours} × ${formatMoney(a.tarif_journalier, devise)}`} value={formatMoney(a.montant_location, devise)} />
      {assistance && (
        <Row label={`Assistance · ${a.duree_jours} × ${formatMoney(a.tarif_assistance, devise)}`} value={formatMoney(a.montant_assistance, devise)} />
      )}
      {a.montant_prolongations > 0 && <Row label="Prolongation(s)" value={formatMoney(a.montant_prolongations, devise)} />}
      <div className="my-4 border-t border-line" />
      <div className="flex items-center justify-between gap-4">
        <span className="text-[15px] font-bold">Total TTC</span>
        <span className="text-[28px] font-extrabold tracking-tight">{formatMoney(a.montant_total, devise)}</span>
      </div>
      <p className="mt-1 text-[11px] text-ink-muted">Dont TVA (20 %) : {formatMoney(a.montant_tva, devise)}</p>
      <div className="mt-4 flex items-center justify-between rounded-xl bg-[#F4F5F7] px-4 py-3.5 text-sm">
        <span className="text-ink-muted">Dépôt de garantie</span>
        <span className="font-bold">{formatMoney(a.depot_garantie, devise)}</span>
      </div>
      {note && <p className="mt-4 text-xs text-ink-muted">{note}</p>}
    </div>
  )
}

export function BeforeConfirmBox({ email, className }) {
  return (
    <aside className={clsx('rounded-card bg-brand-soft/70 p-5', className)} aria-label="Avant de confirmer">
      <p className="flex items-center gap-2 text-sm font-semibold text-brand">
        <Info className="h-[18px] w-[18px]" aria-hidden /> Avant de confirmer
      </p>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
        La disponibilité du véhicule sera vérifiée.
        <br />
        Un e-mail récapitulatif sera envoyé au client{email ? <> (<span className="font-medium">{email}</span>)</> : ''}.
      </p>
    </aside>
  )
}
