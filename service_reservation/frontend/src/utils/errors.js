// Erreurs du service Réservation : {"detail": "...", "code": "...", "erreurs": [{"champ", "message"}]}
// (format FastAPI conservé par l'équipe ; `detail` peut aussi être la liste de validation FastAPI)

export function getErrorMessage(error, fallback = 'Une erreur est survenue. Réessayez.') {
  if (!error) return fallback
  if (error.message && !error.response && !error.code) return error.message
  if (error.code === 'ERR_NETWORK') return 'Impossible de joindre le serveur. Vérifiez que les services sont démarrés.'
  const data = error.response?.data
  if (typeof data?.detail === 'string') return data.detail
  if (Array.isArray(data?.erreurs) && data.erreurs.length) return data.erreurs.map((e) => e.message).join(' · ')
  if (Array.isArray(data?.detail)) return data.detail.map((d) => d.msg).join(' · ')
  return error.message || fallback
}

export function getErrorCode(error) {
  return error?.response?.data?.code
}

/** [{field, message}] pour les erreurs rattachées à un champ du formulaire */
export function getFieldErrors(error) {
  const erreurs = error?.response?.data?.erreurs
  return Array.isArray(erreurs) ? erreurs.filter((e) => e?.champ).map((e) => ({ field: e.champ, message: e.message })) : []
}

export function applyFieldErrors(error, setError, knownFields) {
  let applied = false
  getFieldErrors(error).forEach(({ field, message }) => {
    if (!knownFields || knownFields.includes(field)) {
      setError(field, { type: 'server', message })
      applied = true
    }
  })
  return applied
}
