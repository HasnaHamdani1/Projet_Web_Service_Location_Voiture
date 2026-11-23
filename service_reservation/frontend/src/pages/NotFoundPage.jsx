import { Compass } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/Feedback'
import { useDocumentTitle } from '../hooks'

export default function NotFoundPage({ admin = false }) {
  useDocumentTitle('Page introuvable')
  return (
    <div className={admin ? 'card mt-10' : 'mx-auto mt-10 max-w-[900px] px-4'}>
      <div className={admin ? '' : 'card'}>
        <EmptyState icon={Compass} title="Page introuvable" description="La page demandée n'existe pas ou a été déplacée."
          action={admin ? <Button to="/admin/reservations">Retour aux réservations</Button> : <Button to="/">Retour à l'accueil</Button>} />
      </div>
    </div>
  )
}
