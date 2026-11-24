// FormGrid sağ tık menüsü (form-grid.md §8): hücre grubu · "Seç ›" · satır grubu. ⋯ yalnız satır grubunu taşır.
// Klavyeden menü tuşu ve ⇧F10 tarayıcının `contextmenu` olayıyla açar. Kapanınca odak aktif hücreye döner.
import { ContextMenu } from '@base-ui/react/context-menu'
import { Menu } from '@base-ui/react/menu'
import { CaretRightIcon } from '@phosphor-icons/react'
import { useState, type ReactElement } from 'react'
import type { RowAction } from '../types/list'
import type { I18n } from '../core/i18n'
import {
  ALL_KBD,
  CLEAR_KBD,
  COLUMN_KBD,
  COPY_KBD,
  CUT_KBD,
  FILL_KBD,
  PASTE_KBD,
  ROW_KBD,
} from '../core/interaction/kbd'
import { DtMenuItem, DtMenuSeparator } from '../core/ui/menu'

export interface GridMenuCommands<Row> {
  cut: () => void
  copy: () => void
  paste: () => void
  fill: () => void
  clear: () => void
  selectRow: () => void
  selectColumn: () => void
  selectAll: () => void
  /** Açılışta okunur (sağ tık seçimi önce değiştirir): aktif satır (boş satırda yok) ve satır grubunun öğeleri. */
  row: () => Row | undefined
  rowActions: () => Array<RowAction<Row>>
  onClose: () => void
}

export function GridContextMenu<Row extends object>({
  trigger,
  i18n,
  commands: c,
}: {
  trigger: ReactElement
  i18n: I18n
  commands: GridMenuCommands<Row>
}) {
  const t = (key: string) => i18n.t(`sheet.menu.${key}`)
  const item = (label: string, kbd: string, run: () => void) => (
    <DtMenuItem onSelect={run}>
      {label}
      <kbd className="dt-kbd">{kbd}</kbd>
    </DtMenuItem>
  )
  // Açık durumu burada: açılınca yeniden çizilir, satır o anki seçimden okunur.
  const [open, setOpen] = useState(false)
  const row = open ? c.row() : undefined
  const shown = row ? c.rowActions().filter((a) => !a.when || a.when(row)) : []
  return (
    <ContextMenu.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) c.onClose()
      }}
    >
      <ContextMenu.Trigger render={trigger} />
      <Menu.Portal>
        <Menu.Positioner className="dt-positioner">
          <Menu.Popup className="dt-menu dt-sheet-layer" finalFocus={false}>
            {item(t('cut'), CUT_KBD, c.cut)}
            {item(t('copy'), COPY_KBD, c.copy)}
            {item(t('paste'), PASTE_KBD, c.paste)}
            {item(t('fillDown'), FILL_KBD, c.fill)}
            {item(t('clear'), CLEAR_KBD, c.clear)}
            <DtMenuSeparator />
            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger className="dt-menu-item">
                {t('select')}
                <CaretRightIcon size={14} className="dt-menu-caret" aria-hidden="true" />
              </Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner className="dt-positioner" sideOffset={4}>
                  <Menu.Popup className="dt-menu dt-sheet-layer" finalFocus={false}>
                    {item(t('selectRow'), ROW_KBD, c.selectRow)}
                    {item(t('selectColumn'), COLUMN_KBD, c.selectColumn)}
                    {item(t('selectAll'), ALL_KBD, c.selectAll)}
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>
            {row && shown.length > 0 && <DtMenuSeparator />}
            {row &&
              shown.map((a) => {
                const Icon = a.icon
                const off = a.disabled?.(row)
                return (
                  <DtMenuItem
                    key={a.id}
                    destructive={a.destructive}
                    disabled={!!off}
                    onSelect={() => !off && void a.run(row)}
                  >
                    {Icon && <Icon size={16} aria-hidden="true" />}
                    <span className="dt-menu-text">
                      <span>{a.label}</span>
                      {typeof off === 'string' && <span className="dt-menu-sub">{off}</span>}
                    </span>
                  </DtMenuItem>
                )
              })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </ContextMenu.Root>
  )
}
