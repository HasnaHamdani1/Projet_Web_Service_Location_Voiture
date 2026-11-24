import clsx from 'clsx'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { Fragment } from 'react'
import { Link } from 'react-router-dom'

/** Fil d'Ariane « Réservations › Liste des réservations » */
export function Breadcrumb({ items }) {
  return (
    <nav aria-label="Fil d'Ariane" className="mb-4 text-[13px]">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={item.label} className="flex items-center gap-2">
              {item.to && !last ? (
                <Link to={item.to} className="text-ink-muted transition-colors hover:text-ink">
                  {item.label}
                </Link>
              ) : (
                <span className={last ? 'font-semibold text-ink' : 'text-ink-muted'} aria-current={last ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight className="h-3.5 w-3.5 text-ink-faint" aria-hidden />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

const STEPS = ['Informations', 'Vérification', 'Confirmation']
export const ETAPES_CLIENT = ['Choix du véhicule', 'Vérification', 'Paiement']

/** Indicateur d'étapes 1-Informations / 2-Vérification / 3-Confirmation */
export function Stepper({ current, steps = STEPS }) {
  return (
    <div className="card mb-5 px-4 py-4 sm:px-6">
      <ol className="flex items-center" aria-label="Étapes de la réservation">
        {steps.map((label, i) => {
          const step = i + 1
          const done = step < current || current > steps.length
          const active = step === current
          return (
            <Fragment key={label}>
              <li className="flex shrink-0 items-center gap-3" aria-current={active ? 'step' : undefined}>
                <span
                  className={clsx(
                    'flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold transition-colors',
                    done || active ? 'bg-brand text-white' : 'bg-field text-ink-soft',
                  )}
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : step}
                </span>
                <span className={clsx('hidden text-sm sm:inline', done || active ? 'font-semibold text-brand' : 'font-medium text-ink-soft')}>
                  {label}
                </span>
                <span className="sr-only">{done ? ' (terminée)' : active ? ' (en cours)' : ''}</span>
              </li>
              {step < steps.length && (
                <li aria-hidden className={clsx('mx-3 h-px flex-1 sm:mx-8', done ? 'bg-brand' : 'bg-[#DADDE2]')} />
              )}
            </Fragment>
          )
        })}
      </ol>
    </div>
  )
}

export function Pagination({ page, pages, total, size, onChange, noun = 'réservations' }) {
  if (!total) return null
  const from = (page - 1) * size + 1
  const to = Math.min(page * size, total)
  const nums = []
  for (let p = 1; p <= pages; p += 1) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p)
    else if (nums[nums.length - 1] !== '…') nums.push('…')
  }
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-5 py-4 sm:flex-row">
      <p className="text-xs text-ink-muted">
        Affichage de {from} à {to} sur {total} {noun}
      </p>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-ink-soft hover:bg-field disabled:cursor-not-allowed disabled:opacity-40">
          <ChevronLeft className="h-4 w-4" aria-hidden /> Précédent
        </button>
        {nums.map((n, i) =>
          n === '…' ? (
            <span key={`e${i}`} className="px-1.5 text-xs text-ink-faint">…</span>
          ) : (
            <button key={n} type="button" onClick={() => onChange(n)} aria-current={n === page ? 'page' : undefined}
              className={clsx('h-8 min-w-[32px] rounded-lg px-2 text-xs font-semibold', n === page ? 'bg-ink text-white' : 'text-ink-soft hover:bg-field')}>
              {n}
            </button>
          ),
        )}
        <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)}
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-ink-soft hover:bg-field disabled:cursor-not-allowed disabled:opacity-40">
          Suivant <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </nav>
    </div>
  )
}
