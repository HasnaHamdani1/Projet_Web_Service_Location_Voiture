import axios from 'axios'

export const TOKEN_KEY = 'parcauto.reservation.token'
export const USER_KEY = 'parcauto.reservation.user'

function instance(baseURL) {
  const client = axios.create({ baseURL, timeout: 15000, headers: { 'Content-Type': 'application/json' } })
  client.interceptors.request.use((config) => {
    // Un jeton passé explicitement (ex. jeton admin transmis par le tableau de bord) n'est jamais
    // remplacé par la session déjà enregistrée dans ce navigateur (client, ou session expirée).
    const token = localStorage.getItem(TOKEN_KEY)
    if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`
    return config
  })
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const isLogin = error.config?.url?.includes('/auth/token')
      if (error.response?.status === 401 && !isLogin) window.dispatchEvent(new CustomEvent('auth:expired'))
      return Promise.reject(error)
    },
  )
  return client
}

/** API du service Réservation (relayée par Vite en dev, par nginx en Docker). */
export const reservationApi = instance(import.meta.env.VITE_RESERVATION_API_URL || '/api/reservation')
/** API du service d'authentification de l'équipe (service_auth). */
export const authApi = instance(import.meta.env.VITE_AUTH_API_URL || '/api/auth')

export default reservationApi
