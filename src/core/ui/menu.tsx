// Paketin menü dili (handoff 02-ortak): Base UI Menu + `dt-menu` sınıfları. Vue'daki reka DropdownMenu'nün karşılığı;
// Base UI de vurgulu ve pasif öğeyi `data-highlighted` / `data-disabled` ile işaretler, ui.css aynen geçerli.
import { Menu } from '@base-ui/react/menu'
import type { ReactElement, ReactNode } from 'react'

export function DtMenu({
  trigger,
  children,
  open,
  onOpenChange,
  className,
  finalFocus,
  align = 'end',
}: {
  /** Tetikleyici öğe (düğme); Base UI ona aria ve olay işleyicilerini ekler. */
  trigger: ReactElement
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  /** false: kapanınca odak tetikleyiciye dönmez (ör. menü bir editör açtıysa); fonksiyon kapanışta karar verir. */
  finalFocus?: boolean | (() => boolean)
  align?: 'start' | 'end'
}) {
  return (
    <Menu.Root open={open} onOpenChange={onOpenChange ? (o) => onOpenChange(o) : undefined}>
      <Menu.Trigger render={trigger} />
      <Menu.Portal>
        <Menu.Positioner className="dt-positioner" align={align} sideOffset={align === 'start' ? 6 : 4}>
          <Menu.Popup className={className ? `dt-menu ${className}` : 'dt-menu'} finalFocus={finalFocus}>
            {children}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

export function DtMenuItem({
  children,
  onSelect,
  disabled,
  destructive,
  selected,
}: {
  children: ReactNode
  onSelect: () => void
  disabled?: boolean
  destructive?: boolean
  selected?: boolean
}) {
  const cls = ['dt-menu-item', destructive && 'is-destructive', selected && 'is-selected']
  return (
    <Menu.Item className={cls.filter(Boolean).join(' ')} disabled={disabled} onClick={onSelect}>
      {children}
    </Menu.Item>
  )
}

export const DtMenuSeparator = () => <Menu.Separator className="dt-menu-sep" />

export const DtMenuLabel = ({ children }: { children: ReactNode }) => (
  <Menu.Group>
    <Menu.GroupLabel className="dt-menu-label">{children}</Menu.GroupLabel>
  </Menu.Group>
)
