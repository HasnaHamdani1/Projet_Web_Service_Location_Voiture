import clsx from 'clsx'
import { Skeleton } from '../ui/Feedback'

const TONES = {
  dark: { bar: 'bg-ink', icon: 'bg-field text-ink' },
  orange: { bar: 'bg-pending', icon: 'bg-pending-soft text-pending' },
  blue: { bar: 'bg-brand', icon: 'bg-brand-soft text-brand' },
}

/** Carte indicateur F001 : libellé en capitales, grand nombre, sous-texte, barre de progression */
export function KpiCard({ label, value, caption, progress = 0, tone = 'dark', icon: Icon, loading }) {
  const t = TONES[tone]
  return (
    <section className="card flex flex-col px-5 pb-5 pt-5" aria-label={label}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="label-caps leading-snug">{label}</h2>
        {Icon && (
          <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', t.icon)}>
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
        )}
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-1 h-9 w-16" />
          <Skeleton className="mt-3 h-3 w-40" />
        </>
      ) : (
        <>
          <p className="-mt-1 text-[32px] font-extrabold leading-none tracking-tight">{value}</p>
          <p className="mt-3 text-xs text-ink-muted">{caption}</p>
        </>
      )}
      <div className="mt-4 h-[3px] w-full overflow-hidden rounded-full bg-[#ECEDF0]" role="presentation">
        <div className={clsx('h-full rounded-full transition-[width] duration-700 ease-out', t.bar)} style={{ width: `${loading ? 0 : Math.min(100, Math.max(0, progress))}%` }} />
      </div>
    </section>
  )
}
