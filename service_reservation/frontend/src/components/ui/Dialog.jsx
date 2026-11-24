import { Dialog as HDialog, DialogPanel, DialogTitle } from '@headlessui/react'
import clsx from 'clsx'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from './Button'

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' }
  return (
    <HDialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-ink/30 backdrop-blur-[2px] transition-opacity" aria-hidden />
      <div className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <DialogPanel className={clsx('w-full animate-fade-in rounded-t-2xl bg-white shadow-pop sm:rounded-2xl', widths[size])}>
          <div className="flex items-start justify-between gap-4 px-6 pt-6">
            <div>
              <DialogTitle className="text-lg font-bold text-ink">{title}</DialogTitle>
              {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className="-mr-2 -mt-1 rounded-lg p-2 text-ink-muted hover:bg-field" aria-label="Fermer">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-6 py-5">{children}</div>
          {footer && <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">{footer}</div>}
        </DialogPanel>
      </div>
    </HDialog>
  )
}

/** Boîte de confirmation d'action (évite les opérations accidentelles) */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmer', tone = 'primary', loading, children }) {
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Retour
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        {tone === 'danger' && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger-text">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </div>
        )}
        <div className="flex-1 text-sm text-ink-soft">
          {message}
          {children}
        </div>
      </div>
    </Modal>
  )
}
