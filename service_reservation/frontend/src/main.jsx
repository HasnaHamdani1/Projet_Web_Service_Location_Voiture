import '@fontsource-variable/inter'
import './styles/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './context/AuthContext'
import AppRoutes from './routes/AppRoutes'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" richColors closeButton toastOptions={{ style: { fontFamily: 'inherit' } }} />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
