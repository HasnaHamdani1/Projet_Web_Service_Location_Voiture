import { afterEach, describe, expect, it } from 'vitest'
import { authApi, TOKEN_KEY } from '../services/api'

/** Lance la chaîne des intercepteurs de requête d'axios et renvoie l'en-tête Authorization obtenu. */
async function authorizationEnvoye(headers = {}) {
  let config = { headers: { ...headers } }
  for (const { fulfilled } of authApi.interceptors.request.handlers.filter(Boolean)) {
    config = await fulfilled(config)
  }
  return config.headers.Authorization
}

describe('Jeton envoyé aux API', () => {
  afterEach(() => localStorage.clear())

  it('utilise la session enregistrée quand aucun jeton n’est fourni', async () => {
    localStorage.setItem(TOKEN_KEY, 'jeton-client')
    expect(await authorizationEnvoye()).toBe('Bearer jeton-client')
  })

  it('garde le jeton admin transmis par le tableau de bord, même si un client est connecté', async () => {
    localStorage.setItem(TOKEN_KEY, 'jeton-client')
    expect(await authorizationEnvoye({ Authorization: 'Bearer jeton-admin' })).toBe('Bearer jeton-admin')
  })
})
