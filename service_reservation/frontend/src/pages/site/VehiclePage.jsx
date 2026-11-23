import { ArrowLeft, CalendarX2, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AmountDetail } from '../../components/reservations/PriceSummary'
import { defaultPeriod } from '../../components/site/SearchBar'
import { VehicleImage } from '../../components/site/VehicleImage'
import { Button } from '../../components/ui/Button'
import { ErrorState, PageLoader } from '../../components/ui/Feedback'
import { Checkbox, Field, Input } from '../../components/ui/Field'
import { useAuth } from '../../context/AuthContext'
import { useAsync, useDebounce, useDocumentTitle } from '../../hooks'
import { catalogueService } from '../../services/reservationService'
import { getErrorMessage } from '../../utils/errors'
import { daysBetween, formatMoney, formatPeriodShort, periodFromParams, periodQuery, plural, toISODate } from '../../utils/format'

/** Fiche véhicule + encadré de réservation (prix calculé par le service Réservation). */
export default function VehiclePage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { isClient, isAdmin } = useAuth()
  const initial = periodFromParams(params)
  const [p, setP] = useState(initial.date_debut ? initial : defaultPeriod())
  const [assistance, setAssistance] = useState(params.get('assistance') === '1')
  const today = toISODate(new Date())
  const jours = daysBetween(p.date_debut, p.date_fin)
  const periodeOk = p.date_debut >= today && jours > 0
  const key = useDebounce(periodeOk ? `${p.date_debut}|${p.date_fin}` : '', 250)

  const fiche = useAsync(() => {
    const [date_debut, date_fin] = key ? key.split('|') : []
    return catalogueService.get(id, key ? { date_debut, date_fin } : {})
  }, [id, key])
  const v = fiche.data
  useDocumentTitle(v ? `${v.libelle} – location` : 'Véhicule')

  const devis = useAsync(() => {
    const [date_debut, date_fin] = key.split('|')
    return catalogueService.quote({ vehicule_id: Number(id), date_debut, date_fin, assistance })
  }, [id, key, assistance], { enabled: !!key && !!v?.reservable })

  useEffect(() => { if (!periodeOk) devis.setData(undefined) }, [periodeOk]) // eslint-disable-line react-hooks/exhaustive-deps

  if (fiche.loading && !v) return <PageLoader />
  if (fiche.error) return <div className="mx-auto max-w-[1200px] px-4 py-10"><div className="card"><ErrorState title="Véhicule introuvable" message={getErrorMessage(fiche.error)} /></div></div>

  const set = (k) => (e) => setP((old) => ({ ...old, [k]: e.target.value }))
  const cible = `/reserver/${id}${periodQuery(p)}${periodQuery(p) ? '&' : '?'}assistance=${assistance ? 1 : 0}`
  const peutReserver = v.reservable && periodeOk && v.disponible === true

  const reserver = () => {
    if (!isClient) navigate(`/connexion?retour=${encodeURIComponent(cible)}`)
    else navigate(cible)
  }

  let etat = null
  if (!v.reservable) etat = { tone: 'danger', icon: XCircle, text: 'Ce véhicule est en maintenance et ne peut pas être réservé pour le moment.' }
  else if (!periodeOk) etat = { tone: 'muted', icon: CalendarX2, text: p.date_debut && p.date_debut < today ? 'La date de départ ne peut pas être dans le passé.' : 'La date de retour doit être après la date de départ.' }
  else if (v.disponible === false) etat = { tone: 'danger', icon: XCircle, text: 'Déjà réservé sur une partie de ces dates. Choisissez une autre période.' }
  else if (v.disponible === true) etat = { tone: 'success', icon: CheckCircle2, text: `Disponible du ${formatPeriodShort(p.date_debut, p.date_fin)}` }
  const tones = { danger: 'bg-danger-soft text-danger-text', success: 'bg-success-soft text-success', muted: 'bg-field text-ink-soft' }
  const specs = [['Marque', v.marque], ['Modèle', v.modele], ['Immatriculation', v.immatriculation], ['Catégorie', v.categorie], ['Boîte', v.boite], ['Carburant', v.carburant], ['Année', v.annee]].filter(([, val]) => val)

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <Link to={`/vehicules${periodQuery(p)}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Retour aux véhicules
      </Link>

      <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          <VehicleImage vehicle={v} className="aspect-[16/9]" rounded="rounded-[24px]" />
          <section className="card p-6">
            <h1 className="text-[30px] font-extrabold tracking-tight">{v.libelle}</h1>
            <p className="mt-1 text-ink-muted"><span className="text-xl font-extrabold text-ink">{formatMoney(v.prix_par_jour, v.devise)}</span> / jour · TVA comprise</p>
            <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-3">
              {specs.map(([k, val]) => (
                <div key={k}><dt className="label-caps">{k}</dt><dd className="mt-1 font-medium">{val}</dd></div>
              ))}
            </dl>
          </section>
          <section className="card p-6">
            <h2 className="text-lg font-bold">Dates déjà réservées</h2>
            {v.periodes_reservees.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">Aucune réservation à venir : le véhicule est libre.</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {v.periodes_reservees.map((pr) => (
                  <li key={pr.date_debut} className="rounded-full bg-field px-3 py-1.5 text-xs font-semibold text-ink-soft">{formatPeriodShort(pr.date_debut, pr.date_fin)}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-ink-muted">Le jour du retour d'une réservation, le véhicule peut repartir avec un autre client.</p>
          </section>
        </div>

        {/* ---------- Encadré de réservation ---------- */}
        <aside className="card space-y-4 p-6 lg:sticky lg:top-24" aria-label="Réserver ce véhicule">
          <h2 className="text-lg font-bold">Réserver ce véhicule</h2>
          <div className="grid grid-cols-[1.4fr_1fr] gap-3">
            <Field label="Départ">{(a) => <Input {...a} type="date" min={today} value={p.date_debut} onChange={set('date_debut')} />}</Field>
            <Field label="Heure">{(a) => <Input {...a} type="time" step={900} value={p.heure_debut} onChange={set('heure_debut')} />}</Field>
            <Field label="Retour">{(a) => <Input {...a} type="date" min={p.date_debut || today} value={p.date_fin} onChange={set('date_fin')} />}</Field>
            <Field label="Heure">{(a) => <Input {...a} type="time" step={900} value={p.heure_fin} onChange={set('heure_fin')} />}</Field>
          </div>
          <p className="text-[13px] font-semibold text-brand">{jours > 0 ? `Durée de location : ${plural(jours, 'jour')}` : ' '}</p>
          {etat && (
            <p role="status" className={`flex items-start gap-2 rounded-xl px-3.5 py-3 text-sm font-medium ${tones[etat.tone]}`}>
              <etat.icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {etat.text}
            </p>
          )}
          <div className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
            <Checkbox label="Assistance renforcée" checked={assistance} onChange={(e) => setAssistance(e.target.checked)} />
            <span className="text-[13px] text-ink-muted">{devis.data ? `${formatMoney(devis.data.tarif_assistance, devis.data.devise)} / jour` : 'par jour'}</span>
          </div>
          {peutReserver && (
            <div className="border-t border-line pt-4">
              {devis.error
                ? <p className="text-sm text-danger-text">{getErrorMessage(devis.error)}</p>
                : <AmountDetail amounts={devis.data} assistance={assistance} loading={!devis.data || devis.loading} devise={devis.data?.devise} />}
            </div>
          )}
          {isAdmin ? (
            <p className="rounded-xl bg-field px-4 py-3 text-sm text-ink-soft">Vous êtes connecté·e en administrateur : les réservations sont faites par les clients.</p>
          ) : (
            <Button size="lg" className="w-full" disabled={!peutReserver} onClick={reserver}>
              {isClient ? 'Continuer la réservation' : 'Se connecter pour réserver'}
            </Button>
          )}
          <p className="flex items-center gap-2 text-xs text-ink-muted"><ShieldCheck className="h-4 w-4 text-success" aria-hidden /> Annulation en ligne possible jusqu'au jour du départ.</p>
        </aside>
      </div>
    </div>
  )
}
