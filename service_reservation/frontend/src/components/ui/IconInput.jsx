import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useState } from 'react'

/** Champ large avec icône (écrans de connexion / inscription, charte F014). */
export const IconInput = forwardRef(function IconInput({ icon: Icon, error, right, ...props }, ref) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink" aria-hidden />
      <input
        ref={ref}
        {...props}
        className={`h-14 w-full rounded-xl border bg-white pl-12 pr-12 text-[15px] text-ink placeholder:text-ink-muted focus:outline-none focus:ring-4 ${
          error ? 'border-danger focus:ring-danger-soft' : 'border-[#D7DEEA] focus:border-brand focus:ring-brand-soft'
        }`}
      />
      {right}
    </div>
  )
})

/** Mot de passe avec bouton afficher / masquer. */
export const PasswordInput = forwardRef(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false)
  return (
    <IconInput
      ref={ref}
      {...props}
      type={show ? 'text' : 'password'}
      right={
        <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink hover:bg-field"
          aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      }
    />
  )
})

export function FieldError({ id, error }) {
  return error ? <p id={id} className="mt-1.5 text-xs font-medium text-danger-text">{error.message}</p> : null
}
