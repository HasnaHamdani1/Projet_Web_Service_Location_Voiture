import { authApi, reservationApi as api } from './api'

/** Catalogue public : véhicules du service Véhicule + disponibilité (aucune connexion requise). */
export const catalogueService = {
  list: (params) => api.get('/catalogue/vehicules', { params }).then((r) => r.data),
  get: (id, params) => api.get(`/catalogue/vehicules/${id}`, { params }).then((r) => r.data),
  quote: (data) => api.post('/reservations/devis', data).then((r) => r.data),
}

/** Espace client (jeton CLIENT) : réserver, payer, annuler, consulter ses réservations. */
export const clientReservationService = {
  create: (data) => api.post('/reservations', data).then((r) => r.data.reservation),
  mine: (params) => api.get('/reservations', { params: { page: 1, size: 20, ...params } }).then((r) => r.data),
  get: (id) => api.get(`/reservations/${id}`).then((r) => r.data),
  pay: (id, ok = true) => api.post(`/reservations/${id}/paiement`, { paiement_reussi: ok }).then((r) => r.data),
  cancel: (id, motif) => api.put(`/reservations/${id}/annulation`, motif ? { motif } : undefined).then((r) => r.data.reservation),
}

/** Espace administrateur (jeton ADMINISTRATEUR) : gestion et consultation uniquement. */
export const reservationService = {
  list: (params) => api.get('/reservations', { params: { page: 1, size: 10, ...params } }).then((r) => r.data),
  stats: (mois) => api.get('/reservations/stats', { params: { mois } }).then((r) => r.data),
  get: (id) => api.get(`/reservations/${id}`).then((r) => r.data),
  confirm: (id) => api.patch(`/reservations/${id}/statut`, { statut: 'CONFIRMEE' }).then((r) => r.data.reservation),
  cancel: (id, motif) => api.patch(`/reservations/${id}/statut`, { statut: 'ANNULEE', motif }).then((r) => r.data.reservation),
  exportCsv: (params) => api.get('/reservations/export.csv', { params, responseType: 'blob' }).then((r) => r.data),
}

/** Clients : données du service d'authentification, lecture seule (administrateur). */
export const clientService = {
  list: (params) => api.get('/clients', { params }).then((r) => r.data),
  get: (id) => api.get(`/clients/${id}`).then((r) => r.data),
}

/** Service d'authentification de l'équipe (service_auth). */
export const authService = {
  login: (email, mot_de_passe) => authApi.post('/auth/token', { email, mot_de_passe }).then((r) => r.data),
  me: (token) => authApi.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.data),
  register: (data) => authApi.post('/auth/inscription', data).then((r) => r.data),
}
