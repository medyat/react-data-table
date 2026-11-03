// Onay dialog'u (brief §5.7, handoff 02 §6, 08): `alertdialog`, 460 px, ilk odak güvenli düğme (Cancel), yıkıcı düğme kırmızı.
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { useRef } from 'react'
import { useDataTableContext } from '../provider'

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  body?: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
}) {
  const { i18n } = useDataTableContext()
  const cancel = useRef<HTMLButtonElement>(null)
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => onOpenChange(o)}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="dt-scrim" />
        <AlertDialog.Popup className="dt-dialog dt-dialog-confirm" initialFocus={cancel}>
          <AlertDialog.Title className="dt-dialog-title">{title}</AlertDialog.Title>
          {body && <AlertDialog.Description className="dt-dialog-body">{body}</AlertDialog.Description>}
          <div className="dt-dialog-actions">
            <AlertDialog.Close ref={cancel} className="dt-btn">
              {i18n.t('common.cancel')}
            </AlertDialog.Close>
            <button
              type="button"
              className={danger ? 'dt-btn dt-btn-danger' : 'dt-btn dt-btn-primary'}
              onClick={() => {
                onConfirm()
                onOpenChange(false)
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
