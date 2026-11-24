import clsx from 'clsx'
import { AlertTriangle, Inbox, RotateCw } from 'lucide-react'

export function Spinner({ className }) {
  return (
    <svg className={clsx('animate-spin', className || 'h-5 w-5')} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function Skeleton({ className }) {
  return <div className={clsx('animate-pulse rounded-md bg-[#ECEEF1]', className)} aria-hidden />
}

export function PageLoader({ label = 'Chargement…' }) {
  return (
    <div role="status" className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-ink-muted">
      <Spinner className="h-7 w-7 text-brand" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center animate-fade-in">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-field text-ink-muted">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ title = 'Chargement impossible', message, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger-text">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <p className="text-[15px] font-semibold">{title}</p>
      {message && <p className="mt-1 max-w-md text-sm text-ink-muted">{message}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline">
          <RotateCw className="h-4 w-4" aria-hidden /> Réessayer
        </button>
      )}
    </div>
  )
}
