// Telefonda popover'ın yerine alt sayfa (05 §11, handoff 04 §6): Base UI Dialog — scrim, odak hapsi, Esc, kapanınca odak
// tetikleyiciye. Tutamaç · başlık satırı (geri / başlık / metin düğmesi) · kayan gövde · alt düğme. Vue'daki `Layer`'ın sheet hâli;
// masaüstü popover'ları kendi bileşenlerinde kalır.
import { Dialog } from '@base-ui/react/dialog'
import type { ComponentProps, ReactElement, ReactNode } from 'react'

type Popup = ComponentProps<typeof Dialog.Popup>

export function BottomSheet({
  open,
  onOpenChange,
  trigger,
  title,
  hideTitle,
  className,
  headStart,
  headEnd,
  foot,
  initialFocus,
  finalFocus,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Tetikleyici öğe; yoksa sayfa dışarıdan açılır (Filters). */
  trigger?: ReactElement
  /** Erişilebilir ad; `hideTitle` ile yalnızca ekran okuyucuya. */
  title: string
  hideTitle?: boolean
  className?: string
  /** Başlığın solunda (geri düğmesi). */
  headStart?: ReactNode
  /** Başlığın sağında (Clear all / Clear). */
  headEnd?: ReactNode
  /** Alttaki birincil düğme alanı. */
  foot?: ReactNode
  initialFocus?: Popup['initialFocus']
  finalFocus?: Popup['finalFocus']
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => onOpenChange(o)}>
      {trigger && <Dialog.Trigger render={trigger} />}
      <Dialog.Portal>
        <Dialog.Backdrop className="dt-scrim" />
        <Dialog.Popup
          className={className ? `dt-bsheet ${className}` : 'dt-bsheet'}
          initialFocus={initialFocus}
          finalFocus={finalFocus}
        >
          <span className="dt-bsheet-handle" aria-hidden="true" />
          {hideTitle ? (
            <Dialog.Title className="dt-sr-only">{title}</Dialog.Title>
          ) : (
            <div className="dt-bsheet-head">
              {headStart}
              <Dialog.Title className="dt-bsheet-title">{title}</Dialog.Title>
              {headEnd}
            </div>
          )}
          <div className="dt-bsheet-body">{children}</div>
          {foot && <div className="dt-bsheet-foot">{foot}</div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
