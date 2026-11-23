import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { TOKEN_KEY, USER_KEY } from '../services/api'
import { authService } from '../services/reservationService'

const AuthContext = createContext(null)

export const ROLE_ADMIN = 'ADMINISTRATEUR'
export const ROLE_CLIENT = 'CLIENT'

function readUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY))
  } catch {
    return null
  }
}

export class AccessError extends Error {}

/**
 * Session unique (jeton de service_auth). Le rôle décide de l'espace :
 * CLIENT → site de réservation, ADMINISTRATEUR → gestion et consultation.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (localStorage.getItem(TOKEN_KEY) ? readUser() : null))

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  /** Connexion ; `role` = rôle exigé par l'espace (refus si le compte n'a pas ce rôle). */
  const login = useCallback(async (email, password, role) => {
    const { access_token: token } = await authService.login(email, password)
    const profile = await authService.me(token)
    if (role && profile.role !== role) {
      throw new AccessError(
        role === ROLE_ADMIN
          ? "Cet espace est réservé aux administrateurs de l'agence."
          : 'Ce compte est un compte administrateur : utilisez l’espace administration.',
      )
    }
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(profile))
    setUser(profile)
    return profile
  }, [])

  /** Inscription d'un client (service_auth) puis connexion automatique. */
  const register = useCallback(
    async (data) => {
      await authService.register(data)
      return login(data.email, data.mot_de_passe, ROLE_CLIENT)
    },
    [login],
  )

  useEffect(() => {
    const onExpired = () => {
      if (localStorage.getItem(TOKEN_KEY)) toast.error('Votre session a expiré, veuillez vous reconnecter.')
      logout()
    }
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [logout])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isClient: user?.role === ROLE_CLIENT,
      isAdmin: user?.role === ROLE_ADMIN,
      login,
      register,
      logout,
    }),
    [user, login, register, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
