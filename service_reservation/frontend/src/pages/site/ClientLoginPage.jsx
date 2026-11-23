import { Lock, LogIn, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { FieldError, IconInput, PasswordInput } from '../../components/ui/IconInput'
import { ROLE_CLIENT, useAuth } from '../../context/AuthContext'
import { useDocumentTitle } from '../../hooks'
import { getErrorMessage } from '../../utils/errors'

/** Seules les adresses internes au site sont acceptées comme retour (pas de redirection ouverte). */
export function safeReturn(value, fallback = '/mes-reservations') {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/admin') ? value : fallback
}

export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="mx-auto flex max-w-[480px] flex-col px-4 py-12">
      <div className="card px-6 py-8 sm:px-10">
        <h1 className="text-center text-[28px] font-extrabold tracking-tight">{title}</h1>
        <p className="mt-1 text-center text-ink-soft">{subtitle}</p>
        {children}
      </div>
      {footer && <p className="mt-5 text-center text-sm text-ink-soft">{footer}</p>}
    </div>
  )
}

export default function ClientLoginPage() {
  useDocumentTitle('Connexion')
  const { login, isClient, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const retour = safeReturn(params.get('retour'))
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ defaultValues: { email: '', password: '' } })

  if (isClient) return <Navigate to={retour} replace />
  if (isAdmin) return <Navigate to="/admin/reservations" replace />

  const onSubmit = async ({ email, password }) => {
    setServerError('')
    try {
      await login(email.trim(), password, ROLE_CLIENT)
      navigate(retour, { replace: true })
    } catch (err) {
      setServerError(getErrorMessage(err, 'Connexion impossible.'))
    }
  }

  return (
    <AuthShell title="Connexion" subtitle="Accédez à vos réservations et terminez votre location."
      footer={<>Pas encore de compte ? <Link to={`/inscription?retour=${encodeURIComponent(retour)}`} className="link font-semibold">Créer un compte</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="sr-only">Adresse e-mail</label>
          <IconInput id="email" type="email" icon={Mail} placeholder="Adresse e-mail" autoComplete="username" autoFocus
            error={errors.email} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-err' : undefined}
            {...register('email', { required: "L'adresse e-mail est obligatoire" })} />
          <FieldError id="email-err" error={errors.email} />
        </div>
        <div>
          <label htmlFor="password" className="sr-only">Mot de passe</label>
          <PasswordInput id="password" icon={Lock} placeholder="Mot de passe" autoComplete="current-password"
            error={errors.password} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-err' : undefined}
            {...register('password', { required: 'Le mot de passe est obligatoire' })} />
          <FieldError id="password-err" error={errors.password} />
        </div>
        {serverError && <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm font-medium text-danger-text">{serverError}</p>}
        <Button type="submit" size="lg" icon={LogIn} loading={isSubmitting} className="h-14 w-full rounded-xl text-base">Se connecter</Button>
      </form>
    </AuthShell>
  )
}
