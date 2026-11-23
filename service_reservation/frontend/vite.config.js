import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    // Sous-chemin de déploiement (ex. "/reservations/" derrière la passerelle PARC AUTO)
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      // En développement : relais vers les services de l'équipe (ports de compose.yaml)
      proxy: {
        '/api/reservation': {
          target: env.VITE_PROXY_RESERVATION || 'http://localhost:8002',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/reservation/, ''),
        },
        '/api/auth': {
          target: env.VITE_PROXY_AUTH || 'http://localhost:8004',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/auth/, ''),
        },
        // Catalogue et photos du service Véhicule (Leila) : /api/vehicule/uploads/… → /uploads/…
        '/api/vehicule': {
          target: env.VITE_PROXY_VEHICULE || 'http://localhost:8001',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/vehicule/, ''),
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
      css: false,
    },
  }
})
