import { ArrowLeft, Car, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { FieldError, IconInput, PasswordInput } from '../../components/ui/IconInput'
import { ROLE_ADMIN, useAuth } from '../../context/AuthContext'
import { useDocumentTitle } from '../../hooks'
import { getErrorMessage } from '../../utils/errors'

/** Connexion à l'espace agence (charte F014) : réservée aux comptes ADMINISTRATEUR de service_auth. */
export default function AdminLoginPage() {
  useDocumentTitle('Connexion agence')
  const { login, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { email: '', password: '' } })

  if (isAdmin) return <Navigate to="/admin/reservations" replace />

  const onSubmit = async ({ email, password }) => {
    setServerError('')
    try {
      await login(email.trim(), password, ROLE_ADMIN)
      const from = location.state?.from?.pathname
      navigate(from?.startsWith('/admin') ? from : '/admin/reservations', { replace: true })
    } catch (err) {
      setServerError(getErrorMessage(err, 'Connexion impossible.'))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F3F6FC] p-4 sm:p-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-[#DCE6F7] bg-white shadow-pop md:grid-cols-2">
        {/* Panneau de présentation */}
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#EEF3FD] via-[#E6EEFC] to-[#D9E6FB] p-10 md:flex md:flex-col">
          <div className="absolute -bottom-40 -left-24 h-96 w-[34rem] rounded-[50%] bg-gradient-to-tr from-[#A9C6F6] to-transparent opacity-70" aria-hidden />
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink text-white">
              <Car className="h-7 w-7" aria-hidden />
            </div>
            <div className="leading-tight">
              <p className="text-xl font-extrabold tracking-tight">PARC AUTO</p>
              <p className="flex items-center gap-1.5 font-semibold text-brand">
                <span className="h-2 w-2 rounded-full bg-brand" /> Location de voitures
              </p>
            </div>
          </div>
          <div className="relative mt-auto mb-auto pt-16">
            <p className="text-[44px] font-extrabold leading-[1.05] tracking-tight">
              Gestion des
              <br />
              <span className="text-brand">Réservations</span>
            </p>
            <p className="mt-5 max-w-xs text-lg leading-snug text-ink-soft">Suivez et gérez les réservations effectuées par vos clients sur le site.</p>
          </div>
        </div>

        {/* Formulaire */}
        <div className="flex flex-col justify-center px-6 py-10 sm:px-12">
          <ShieldCheck className="mx-auto h-16 w-16 text-brand" strokeWidth={1.75} aria-hidden />
          <h1 className="mt-4 text-center text-[28px] font-extrabold tracking-tight">Connexion</h1>
          <p className="mt-1 text-center text-ink-soft">Espace agence – compte administrateur</p>

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
            {serverError && (
              <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm font-medium text-danger-text animate-fade-in">{serverError}</p>
            )}
            <Button type="submit" size="lg" icon={LogIn} loading={isSubmitting} className="h-14 w-full rounded-xl text-base">
              Se connecter
            </Button>
          </form>
          <p className="mt-8 border-t border-line pt-6 text-center text-sm text-ink-soft">
            <Link to="/" className="inline-flex items-center gap-1.5 font-semibold hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden /> Retour au site de réservation</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
