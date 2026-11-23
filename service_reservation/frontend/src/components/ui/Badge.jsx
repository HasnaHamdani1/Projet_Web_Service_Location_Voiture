import clsx from 'clsx'
import { Check } from 'lucide-react'

export const STATUS = {
  EN_ATTENTE: { label: 'En attente', className: 'bg-pending-soft text-pending-text', dot: 'bg-pending' },
  CONFIRMEE: { label: 'Confirmée', className: 'bg-brand-soft text-brand', dot: 'bg-brand' },
  ANNULEE: { label: 'Annulée', className: 'bg-danger-soft text-danger-text', dot: 'bg-danger' },
}

/** Badge de statut du tableau F001 : pastille + libellé (orange / bleu / rouge) */
export function StatusBadge({ statut, className }) {
  const s = STATUS[statut] || { label: statut, className: 'bg-field text-ink-soft', dot: 'bg-ink-faint' }
  return (
    <span className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium', s.className, className)}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', s.dot)} aria-hidden />
      {s.label}
    </span>
  )
}

/** Pilule « ✓ Confirmée » / « ✓ Disponible » des écrans F003/F004 */
export function CheckPill({ children, tone = 'brand', className }) {
  const tones = {
    brand: 'bg-brand-soft text-brand',
    success: 'bg-success-soft text-success',
    danger: 'bg-danger-soft text-danger-text',
    neutral: 'bg-field text-ink-soft',
  }
  return (
    <span className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold', tones[tone], className)}>
      {tone !== 'danger' && tone !== 'neutral' && <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />}
      {children}
    </span>
  )
}

export function CountBadge({ children }) {
  return <span className="inline-flex min-w-[28px] items-center justify-center rounded-md bg-field px-2 py-0.5 text-xs font-semibold text-ink-soft">{children}</span>
}
