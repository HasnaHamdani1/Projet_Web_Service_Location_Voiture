import { ArrowRight, CalendarDays, Info, Pencil, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AmountDetail } from '../../components/reservations/PriceSummary'
import { VehicleImage } from '../../components/site/VehicleImage'
import { Button } from '../../components/ui/Button'
import { ErrorState, PageLoader } from '../../components/ui/Feedback'
import { ETAPES_CLIENT, Stepper } from '../../components/ui/Navigation'
import { useAuth } from '../../context/AuthContext'
import { useAsync, useDocumentTitle } from '../../hooks'
import { catalogueService, clientReservationService } from '../../services/reservationService'
import { getErrorCode, getErrorMessage } from '../../utils/errors'
import { formatDateLong, periodFromParams, periodQuery, plural } from '../../utils/format'

function Bloc({ title, icon: Icon, action, children }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Icon className="h-5 w-5 text-ink-muted" aria-hidden /> {title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Info2({ label, children }) {
  return <div className="min-w-0"><p className="label-caps">{label}</p><p className="mt-1.5 break-words font-medium">{children}</p></div>
}

/** Étape 2 du parcours client : vérification puis création de la réservation (EN_ATTENTE). */
export default function CheckoutPage() {
  useDocumentTitle('Vérifier ma réservation')
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const p = periodFromParams(params)
  const assistance = params.get('assistance') === '1'
  const [accepte, setAccepte] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')

  const data = useAsync(async () => {
    if (!p.date_debut || !p.date_fin) throw new Error('Période manquante : choisissez vos dates sur la fiche du véhicule.')
    const [vehicule, devis] = await Promise.all([
      catalogueService.get(id, { date_debut: p.date_debut, date_fin: p.date_fin }),
      catalogueService.quote({ vehicule_id: Number(id), date_debut: p.date_debut, date_fin: p.date_fin, assistance }),
    ])
    return { vehicule, devis }
  }, [id, p.date_debut, p.date_fin, assistance])

  const retourFiche = `/vehicules/${id}${periodQuery(p)}${periodQuery(p) ? '&' : '?'}assistance=${assistance ? 1 : 0}`

  if (data.loading && !data.data) return <PageLoader />
  if (data.error) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-10">
        <div className="card"><ErrorState title="Réservation impossible" message={getErrorMessage(data.error)} /></div>
        <p className="mt-4 text-center"><Link to={`/vehicules/${id}`} className="link">Revenir à la fiche du véhicule</Link></p>
      </div>
    )
  }
  const { vehicule: v, devis } = data.data
  const indisponible = v.disponible === false

  const confirmer = async () => {
    setErreur('')
    setEnvoi(true)
    try {
      const r = await clientReservationService.create({
        vehicule_id: Number(id), date_debut: p.date_debut, date_fin: p.date_fin,
        heure_debut: p.heure_debut, heure_fin: p.heure_fin, assistance,
      })
      toast.success(`Réservation ${r.numero} enregistrée`)
      navigate(`/mes-reservations/${r.id}/paiement`, { replace: true, state: { reservation: r } })
    } catch (err) {
      setErreur(getErrorCode(err) === 'vehicule_indisponible'
        ? "Ce véhicule vient d'être réservé sur ces dates par un autre client. Choisissez une autre période ou un autre véhicule."
        : getErrorMessage(err))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <h1 className="text-[30px] font-extrabold tracking-tight">Vérifiez votre réservation</h1>
      <p className="mt-1 text-ink-muted">Relisez les informations avant de confirmer. Le paiement se fait à l'étape suivante.</p>
      <div className="mt-6"><Stepper current={2} steps={ETAPES_CLIENT} /></div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Bloc title="Véhicule" icon={CalendarDays} action={<Link to={retourFiche} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"><Pencil className="h-3.5 w-3.5" aria-hidden /> Modifier</Link>}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <VehicleImage vehicle={v} className="aspect-[16/10] w-full sm:w-48" />
              <div className="grid flex-1 gap-4 sm:grid-cols-2">
                <Info2 label="Véhicule">{v.libelle}</Info2>
                <Info2 label="Durée">{plural(devis.duree_jours, 'jour')}</Info2>
                <Info2 label="Départ">{formatDateLong(p.date_debut)} · {p.heure_debut}</Info2>
                <Info2 label="Retour">{formatDateLong(p.date_fin)} · {p.heure_fin}</Info2>
              </div>
            </div>
          </Bloc>
          <Bloc title="Vos coordonnées" icon={UserRound}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Info2 label="Nom">{user.nom}</Info2>
              <Info2 label="E-mail">{user.email}</Info2>
              <Info2 label="Téléphone">{user.telephone || '—'}</Info2>
            </div>
            <p className="mt-4 text-xs text-ink-muted">La confirmation sera envoyée à cette adresse e-mail.</p>
          </Bloc>
          {indisponible && (
            <p role="alert" className="rounded-xl bg-danger-soft px-5 py-4 text-sm font-medium text-danger-text">
              Ce véhicule n'est plus disponible sur ces dates. <Link to={retourFiche} className="underline">Choisir d'autres dates</Link>
            </p>
          )}
          <label className="card flex cursor-pointer items-start gap-3 p-5 text-sm">
            <input type="checkbox" className="mt-0.5 h-[18px] w-[18px] accent-brand" checked={accepte} onChange={(e) => setAccepte(e.target.checked)} />
            <span>
              J'accepte les conditions de location : présentation du permis et d'une pièce d'identité au départ,
              dépôt de garantie de {devis.depot_garantie.toFixed(2).replace('.', ',')} {devis.devise} restitué au retour du véhicule,
              annulation possible en ligne jusqu'au jour du départ.
            </span>
          </label>
          {erreur && <p role="alert" className="rounded-xl bg-danger-soft px-5 py-4 text-sm font-medium text-danger-text">{erreur}</p>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" to={retourFiche}>Retour</Button>
            <Button iconRight={ArrowRight} loading={envoi} disabled={!accepte || indisponible} onClick={confirmer} className="px-6">
              Confirmer et passer au paiement
            </Button>
          </div>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24">
          <section className="card p-6">
            <h2 className="text-lg font-bold">Récapitulatif</h2>
            <p className="mt-3 border-b border-line pb-3 text-[17px] font-bold">{v.libelle}</p>
            <div className="mt-4"><AmountDetail amounts={devis} assistance={assistance} devise={devis.devise} /></div>
          </section>
          <p className="flex gap-2 rounded-card bg-brand-soft/70 p-5 text-[13px] text-ink-soft">
            <Info className="h-4 w-4 shrink-0 text-brand" aria-hidden />
            Le véhicule est bloqué pour vous dès la confirmation, en attente du paiement.
          </p>
        </aside>
      </div>
    </div>
  )
}
