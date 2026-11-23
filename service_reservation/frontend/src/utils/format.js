// Formatage FR (montants, dates) conforme aux maquettes : « 153,00 € », « 18 → 21 nov. 2026 »

const moneyFmt = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatMoney(value, currency = '€') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  // Intl utilise une espace fine insécable : on la normalise pour un rendu homogène
  return `${moneyFmt.format(Number(value)).replace(/ /g, ' ')} ${currency}`
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/** Les dates de période (debut/fin) sont des heures locales d'agence sans fuseau : on les lit telles quelles. */
export function parseLocal(iso) {
  if (!iso) return null
  if (iso instanceof Date) return iso
  const hasTz = /([zZ]|[+-]\d{2}:?\d{2})$/.test(iso)
  return hasTz ? new Date(iso) : new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
}

const pad = (n) => String(n).padStart(2, '0')

export const formatTime = (iso) => {
  const d = parseLocal(iso)
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : ''
}

/** 18 novembre 2026 */
export const formatDateLong = (iso) => {
  const d = parseLocal(iso)
  return d ? `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}` : ''
}

/** 13 nov. 2026 */
export const formatDateShort = (iso) => {
  const d = parseLocal(iso)
  return d ? `${d.getDate()} ${MOIS_COURTS[d.getMonth()]} ${d.getFullYear()}` : ''
}

/** 18/11/2026 */
export const formatDateNumeric = (iso) => {
  const d = parseLocal(iso)
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : ''
}

/** « 18 → 21 nov. 2026 » (même mois) ou « 28 nov. → 2 déc. 2026 » */
export function formatPeriodShort(debut, fin) {
  const a = parseLocal(debut)
  const b = parseLocal(fin)
  if (!a || !b) return ''
  if (a.getFullYear() !== b.getFullYear()) return `${formatDateShort(a)} → ${formatDateShort(b)}`
  if (a.getMonth() !== b.getMonth())
    return `${a.getDate()} ${MOIS_COURTS[a.getMonth()]} → ${b.getDate()} ${MOIS_COURTS[b.getMonth()]} ${b.getFullYear()}`
  return `${a.getDate()} → ${b.getDate()} ${MOIS_COURTS[b.getMonth()]} ${b.getFullYear()}`
}

/** « 18 → 21 novembre 2026 » */
export function formatPeriodLong(debut, fin) {
  const a = parseLocal(debut)
  const b = parseLocal(fin)
  if (!a || !b) return ''
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear())
    return `${a.getDate()} → ${b.getDate()} ${MOIS[b.getMonth()]} ${b.getFullYear()}`
  return `${formatDateLong(a)} → ${formatDateLong(b)}`
}

/** « Créée le 13 novembre 2026 à 10:42 » (horodatage serveur avec fuseau → heure locale du navigateur) */
export const formatDateTimeLong = (iso) => {
  const d = parseLocal(iso)
  return d ? `${formatDateLong(d)} à ${formatTime(d)}` : ''
}

/** « 13 nov. 2026 · 10:42 » */
export const formatDateTimeShort = (iso) => {
  const d = parseLocal(iso)
  return d ? `${formatDateShort(d)} · ${formatTime(d)}` : ''
}

export const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`

export function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number)
  const label = MOIS[m - 1]
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} ${y}`
}

export function currentMonth(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

/** 12 derniers mois, du plus récent au plus ancien : [{value:'2026-11', label:'Novembre 2026'}, …] */
export function lastMonths(count = 12, from = new Date()) {
  const out = []
  for (let i = 0; i < count; i += 1) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1)
    const value = currentMonth(d)
    out.push({ value, label: monthLabel(value) })
  }
  return out
}

export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

/** Nombre de jours entre deux dates ISO (AAAA-MM-JJ), comme le backend (RG05) */
export function daysBetween(start, end) {
  if (!start || !end) return 0
  const a = new Date(`${start}T00:00:00`)
  const b = new Date(`${end}T00:00:00`)
  return Math.round((b - a) / 86400000)
}

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')

/** URL d'une photo du service Véhicule (`/uploads/x.jpg`) vue depuis le navigateur. */
export function vehicleImageUrl(path) {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  const base = (import.meta.env.VITE_VEHICLE_ASSETS_URL || '/api/vehicule').replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

/** Paramètres de période de l'URL (?date_debut=…&date_fin=…) */
export function periodFromParams(params) {
  return {
    date_debut: params.get('date_debut') || '',
    date_fin: params.get('date_fin') || '',
    heure_debut: params.get('heure_debut') || '09:00',
    heure_fin: params.get('heure_fin') || '09:00',
  }
}

export function periodQuery({ date_debut, date_fin, heure_debut, heure_fin }) {
  const q = new URLSearchParams()
  if (date_debut) q.set('date_debut', date_debut)
  if (date_fin) q.set('date_fin', date_fin)
  if (heure_debut && heure_debut !== '09:00') q.set('heure_debut', heure_debut)
  if (heure_fin && heure_fin !== '09:00') q.set('heure_fin', heure_fin)
  const s = q.toString()
  return s ? `?${s}` : ''
}

/** Tableau de bord administrateur du frontend commun (connexion de l'agence). */
export function adminDashboardUrl() {
  return import.meta.env.VITE_ADMIN_DASHBOARD_URL || `${window.location.protocol}//${window.location.hostname}:3000/admin/login.html`
}
