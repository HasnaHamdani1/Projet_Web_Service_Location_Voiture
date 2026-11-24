import { Lock, MapPin, Mail, Phone, User, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { FieldError, IconInput, PasswordInput } from '../../components/ui/IconInput'
import { useAuth } from '../../context/AuthContext'
import { useDocumentTitle } from '../../hooks'
import { getErrorMessage } from '../../utils/errors'
import { AuthShell, safeReturn } from './ClientLoginPage'

/** Inscription d'un client : compte créé dans service_auth (tables utilisateurs + clients). */
export default function RegisterPage() {
  useDocumentTitle('Créer un compte')
  const { register: inscrire, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const retour = safeReturn(params.get('retour'), '/vehicules')
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, getValues, setError, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { nom: '', email: '', telephone: '', adresse: '', mot_de_passe: '', confirmation: '' },
  })

  if (isAuthenticated) return <Navigate to={retour} replace />

  const onSubmit = async ({ confirmation, ...data }) => {
    setServerError('')
    try {
      await inscrire({ ...data, nom: data.nom.trim(), email: data.email.trim(), telephone: data.telephone.trim() || null, adresse: data.adresse.trim() })
      toast.success('Compte créé, bienvenue !')
      navigate(retour, { replace: true })
    } catch (err) {
      if (err?.response?.status === 409) setError('email', { type: 'server', message: getErrorMessage(err) })
      else setServerError(getErrorMessage(err, 'Inscription impossible.'))
    }
  }

  const champ = (name, { password, ...props }, rules) => {
    const Input = password ? PasswordInput : IconInput
    return (
      <div>
        <label htmlFor={name} className="sr-only">{props.placeholder}</label>
        <Input {...props} id={name} error={errors[name]} aria-invalid={!!errors[name]}
          aria-describedby={errors[name] ? `${name}-err` : undefined} {...register(name, rules)} />
        <FieldError id={`${name}-err`} error={errors[name]} />
      </div>
    )
  }

  return (
    <AuthShell title="Créer un compte" subtitle="Quelques informations pour réserver en ligne."
      footer={<>Déjà inscrit·e ? <Link to={`/connexion?retour=${encodeURIComponent(retour)}`} className="link font-semibold">Se connecter</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-4">
        {champ('nom', { icon: User, placeholder: 'Nom complet', autoComplete: 'name', autoFocus: true },
          { required: 'Le nom est obligatoire', validate: (v) => v.trim().length > 0 || 'Le nom est obligatoire', maxLength: { value: 100, message: '100 caractères maximum' } })}
        {champ('email', { icon: Mail, type: 'email', placeholder: 'Adresse e-mail', autoComplete: 'email' },
          { required: "L'adresse e-mail est obligatoire", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Adresse e-mail invalide' } })}
        {champ('telephone', { icon: Phone, type: 'tel', placeholder: 'Téléphone (facultatif)', autoComplete: 'tel' },
          { maxLength: { value: 30, message: '30 caractères maximum' } })}
        {champ('adresse', { icon: MapPin, placeholder: 'Adresse postale', autoComplete: 'street-address' },
          { required: "L'adresse est obligatoire", validate: (v) => v.trim().length > 0 || "L'adresse est obligatoire", maxLength: { value: 255, message: '255 caractères maximum' } })}
        {champ('mot_de_passe', { icon: Lock, password: true, placeholder: 'Mot de passe (12 caractères minimum)', autoComplete: 'new-password' },
          { required: 'Le mot de passe est obligatoire', minLength: { value: 12, message: '12 caractères minimum' }, maxLength: { value: 128, message: '128 caractères maximum' } })}
        {champ('confirmation', { icon: Lock, password: true, placeholder: 'Confirmer le mot de passe', autoComplete: 'new-password' },
          { required: 'Confirmez le mot de passe', validate: (v) => v === getValues('mot_de_passe') || 'Les mots de passe ne correspondent pas' })}
        {serverError && <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm font-medium text-danger-text">{serverError}</p>}
        <Button type="submit" size="lg" icon={UserPlus} loading={isSubmitting} className="h-14 w-full rounded-xl text-base">Créer mon compte</Button>
      </form>
    </AuthShell>
  )
}
