import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import { forwardRef, useId } from 'react'

/** Libellé + contrôle + message d'erreur, avec liaisons ARIA (WCAG 2.1 AA) */
export function Field({ label, required, error, hint, children, className, labelAction, id: idProp }) {
  const autoId = useId()
  const id = idProp || autoId
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(' ') || undefined
  return (
    <div className={clsx('min-w-0', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium text-ink-soft">
          {label}
          {required && <span aria-hidden> *</span>}
          {required && <span className="sr-only"> (obligatoire)</span>}
        </label>
        {labelAction}
      </div>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-danger-text animate-fade-in">
          {error}
        </p>
      )}
    </div>
  )
}

export const Input = forwardRef(function Input({ className, invalid, icon: Icon, ...props }, ref) {
  return (
    <div className="relative">
      <input ref={ref} className={clsx('field-base', invalid && 'field-error', Icon && 'pr-10', className)} {...props} />
      {Icon && <Icon className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-muted" aria-hidden />}
    </div>
  )
})

export const Select = forwardRef(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={clsx('field-base cursor-pointer appearance-none pr-10', invalid && 'field-error', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-muted" aria-hidden />
    </div>
  )
})

export const Textarea = forwardRef(function Textarea({ className, invalid, ...props }, ref) {
  return <textarea ref={ref} className={clsx('field-base h-auto min-h-[96px] py-3', invalid && 'field-error', className)} {...props} />
})

export const Checkbox = forwardRef(function Checkbox({ label, className, ...props }, ref) {
  return (
    <label className={clsx('inline-flex cursor-pointer items-center gap-3 text-sm font-medium text-ink', className)}>
      <input ref={ref} type="checkbox" className="h-[18px] w-[18px] cursor-pointer rounded accent-brand" {...props} />
      {label}
    </label>
  )
})

/** Valeur en lecture seule présentée comme un champ (tarif journalier, e-mail repris) */
export function ReadonlyValue({ id, children, className }) {
  return (
    <div id={id} aria-readonly="true" className={clsx('flex h-11 items-center rounded-lg bg-field px-3.5 text-sm text-ink', className)}>
      {children}
    </div>
  )
}
