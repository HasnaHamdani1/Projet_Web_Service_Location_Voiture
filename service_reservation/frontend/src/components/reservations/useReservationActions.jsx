import { useState } from 'react'
import { toast } from 'sonner'
import { reservationService } from '../../services/reservationService'
import { getErrorMessage } from '../../utils/errors'
import { ConfirmDialog } from '../ui/Dialog'
import { Textarea } from '../ui/Field'

/**
 * Confirmation et annulation d'une réservation avec boîtes de dialogue,
 * partagées par la liste (menu « … ») et l'écran de vérification (F003).
 */
export function useReservationActions({ onChanged } = {}) {
  const [target, setTarget] = useState(null) // { action: 'confirm' | 'cancel', reservation }
  const [motif, setMotif] = useState('')
  const [loading, setLoading] = useState(false)

  const close = () => {
    if (loading) return
    setTarget(null)
    setMotif('')
  }

  const run = async () => {
    const { action, reservation } = target
    setLoading(true)
    try {
      if (action === 'confirm') {
        const updated = await reservationService.confirm(reservation.id)
        toast.success(`Réservation ${updated.numero} confirmée – e-mail envoyé au client`)
        setTarget(null)
        onChanged?.(updated)
      } else {
        const updated = await reservationService.cancel(reservation.id, motif.trim() || undefined)
        toast.success(`Réservation ${updated.numero} annulée`)
        setTarget(null)
        setMotif('')
        onChanged?.(updated)
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const dialogs = (
    <>
      <ConfirmDialog
        open={target?.action === 'confirm'}
        onClose={close}
        onConfirm={run}
        loading={loading}
        title="Confirmer la réservation ?"
        confirmLabel="Confirmer la réservation"
        message={
          <p>
            À utiliser lorsque le client a réglé au comptoir. La réservation{' '}
            <strong className="text-ink">{target?.reservation.numero}</strong> passera au statut{' '}
            <strong className="text-brand">Confirmée</strong> et un e-mail récapitulatif sera envoyé au client.
          </p>
        }
      />
      <ConfirmDialog
        open={target?.action === 'cancel'}
        onClose={close}
        onConfirm={run}
        loading={loading}
        tone="danger"
        title="Annuler la réservation ?"
        confirmLabel="Annuler la réservation"
        message={
          <p className="mb-4">
            La réservation <strong className="text-ink">{target?.reservation.numero}</strong> sera annulée et le véhicule libéré pour
            cette période. Cette action est définitive.
          </p>
        }
      >
        <label htmlFor="motif-annulation" className="mb-2 block text-[13px] font-medium text-ink-soft">
          Motif (facultatif)
        </label>
        <Textarea id="motif-annulation" value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={500}
          placeholder="Ex. non-présentation, demande du client par téléphone" className="min-h-[80px]" />
      </ConfirmDialog>
    </>
  )

  return {
    askConfirm: (reservation) => setTarget({ action: 'confirm', reservation }),
    askCancel: (reservation) => setTarget({ action: 'cancel', reservation }),
    dialogs,
  }
}
