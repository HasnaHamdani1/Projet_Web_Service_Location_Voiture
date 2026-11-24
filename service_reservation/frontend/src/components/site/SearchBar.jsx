import clsx from 'clsx'
import { CalendarDays, Clock3, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { addDays, daysBetween, plural, toISODate } from '../../utils/format'
import { Button } from '../ui/Button'

export function defaultPeriod() {
  const today = new Date()
  return {
    date_debut: toISODate(addDays(today, 1)),
    date_fin: toISODate(addDays(today, 4)),
    heure_debut: '09:00',
    heure_fin: '09:00',
  }
}

function Cell({ icon: Icon, label, children, className }) {
  return (
    <label className={clsx('flex min-w-0 flex-1 flex-col gap-1 rounded-xl px-3 py-2.5 transition-colors sm:px-4 sm:py-3 focus-within:bg-field hover:bg-field', className)}>
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
        <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
      </span>
      {children}
    </label>
  )
}

const inputCls = 'w-full bg-transparent text-[15px] font-semibold text-ink focus:outline-none'

/** Recherche par période (accueil et catalogue). */
export function SearchBar({ value, onSearch, compact = false, submitLabel = 'Rechercher' }) {
  const [p, setP] = useState(value?.date_debut ? value : defaultPeriod())
  const [error, setError] = useState('')
  useEffect(() => {
    if (value?.date_debut) setP(value)
  }, [value?.date_debut, value?.date_fin, value?.heure_debut, value?.heure_fin]) // eslint-disable-line react-hooks/exhaustive-deps

  const today = toISODate(new Date())
  const jours = daysBetween(p.date_debut, p.date_fin)
  const set = (k) => (e) => {
    setError('')
    setP((old) => ({ ...old, [k]: e.target.value }))
  }

  const submit = (e) => {
    e.preventDefault()
    if (!p.date_debut || !p.date_fin) return setError('Choisissez les dates de départ et de retour.')
    if (p.date_debut < today) return setError('La date de départ ne peut pas être dans le passé.')
    if (p.date_fin <= p.date_debut) return setError('La date de retour doit être après la date de départ.')
    onSearch(p)
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Rechercher un véhicule"
      className={clsx('rounded-2xl bg-white p-2 shadow-pop ring-1 ring-black/5', compact && 'shadow-card ring-line')}>
      <div className="grid grid-cols-[1.4fr_1fr] gap-1 md:flex md:flex-row md:items-stretch">
        <Cell icon={CalendarDays} label="Départ">
          <input type="date" aria-label="Date de départ" min={today} value={p.date_debut} onChange={set('date_debut')} className={inputCls} />
        </Cell>
        <Cell icon={Clock3} label="Heure" className="md:max-w-[150px]">
          <input type="time" aria-label="Heure de départ" step={900} value={p.heure_debut} onChange={set('heure_debut')} className={inputCls} />
        </Cell>
        <div className="mx-1 hidden w-px self-stretch bg-line md:block" aria-hidden />
        <Cell icon={CalendarDays} label="Retour">
          <input type="date" aria-label="Date de retour" min={p.date_debut || today} value={p.date_fin} onChange={set('date_fin')} className={inputCls} />
        </Cell>
        <Cell icon={Clock3} label="Heure" className="md:max-w-[150px]">
          <input type="time" aria-label="Heure de retour" step={900} value={p.heure_fin} onChange={set('heure_fin')} className={inputCls} />
        </Cell>
        <Button type="submit" icon={Search} size="lg" className="col-span-2 m-1 h-auto min-h-[52px] rounded-xl px-6">
          {submitLabel}
        </Button>
      </div>
      <p className={clsx('px-4 pb-1 pt-1.5 text-xs', error ? 'font-medium text-danger-text' : 'text-ink-muted')} role={error ? 'alert' : undefined} aria-live="polite">
        {error || (jours > 0 ? `Durée de location : ${plural(jours, 'jour')}` : ' ')}
      </p>
    </form>
  )
}
