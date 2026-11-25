// FormGrid sağ tık menüsü (form-grid.md §8, pano "Belge satır tablosu" · ContextMenu): üstte hücre grubu (başlıkta
// hücre ve atlanan kilitli hücre sayısı), "Seç ›", altta satır grubu (⋯ ile aynı öğeler). Menü tuşu ve ⇧F10
// tarayıcının `contextmenu` olayıyla açar. Kapanınca odak aktif hücreye döner.
import { ContextMenu } from '@base-ui/react/context-menu'
import { Menu } from '@base-ui/react/menu'
import {
  ArrowDownIcon,
  BackspaceIcon,
  CaretRightIcon,
  ClipboardTextIcon,
  ColumnsIcon,
  CopyIcon,
  RowsIcon,
  ScissorsIcon,
  SquareIcon,
  TableIcon,
} from '@phosphor-icons/react'
import { useState, type ReactElement } from 'react'
import type { IconComponent } from '../types/columns'
import type { RowAction } from '../types/list'
import type { I18n, MessageParams } from '../core/i18n'
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

/** Menü açılışında seçimden okunur. */
export interface GridMenuInfo<Row> {
  cells: number
  /** Seçimdeki kilitli hücreler: Kes, Temizle, Doldur onları atlar; hepsi kilitliyse pasif. */
  locked: number
  /** Tek satır seçiliyse ⌘D üstteki satırı getirir; açıklama ona göre. */
  single: boolean
  /** Aktif satır; boş satırda yok, satır grubu çizilmez. */
  row: Row | undefined
  rowActions: Array<RowAction<Row>>
}

export interface GridMenuCommands<Row> {
  /** Gösterimde (R41) yazan komutlar verilmez, menüde çizilmez. */
  cut?: () => void
  copy: () => void
  paste?: () => void
  fill?: () => void
  clear?: () => void
  selectRow: () => void
  selectColumn: () => void
  selectAll: () => void
  info: () => GridMenuInfo<Row>
  onClose: () => void
}

function Item({
  icon: Ico,
  label,
  sub,
  kbd,
  disabled,
  destructive,
  run,
}: {
  icon?: IconComponent
  label: string
  sub?: string
  kbd?: string
  disabled?: boolean
  destructive?: boolean
  run: () => void
}) {
  return (
    <DtMenuItem disabled={disabled} destructive={destructive} twoLine={!!sub} onSelect={run}>
      {Ico && <Ico size={16} className="dt-menu-icon" aria-hidden="true" />}
      <span className="dt-menu-text">
        <span>{label}</span>
        {sub && <span className="dt-menu-sub">{sub}</span>}
      </span>
      {kbd && <kbd className="dt-menu-kbd">{kbd}</kbd>}
    </DtMenuItem>
  )
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
  const t = (key: string, o?: MessageParams) => i18n.t(`sheet.menu.${key}`, o)
  // Açık durumu burada: açılınca yeniden çizilir, seçim o anki hâlinden okunur (sağ tık önce seçimi değiştirir).
  const [open, setOpen] = useState(false)
  const info = open ? c.info() : null
  const allLocked = !!info && info.locked === info.cells
  const row = info?.row
  const shown = row ? info.rowActions.filter((a) => !a.when || a.when(row)) : []
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
          <Menu.Popup className="dt-menu dt-grid-menu dt-sheet-layer" finalFocus={false}>
            {info && (
              <>
                {/* Satır işlemleri üstte: menü çoğu zaman satıra bir şey yapmak için açılır. Gruplar yalnız çizgiyle ayrılır. */}
                {row &&
                  shown.map((a) => {
                    const off = a.disabled?.(row)
                    return (
                      <Item
                        key={a.id}
                        icon={a.icon}
                        label={a.label}
                        sub={typeof off === 'string' ? off : a.description}
                        kbd={a.shortcut}
                        destructive={a.destructive}
                        disabled={!!off}
                        run={() => !off && void a.run(row)}
                      />
                    )
                  })}
                {row && shown.length > 0 && <DtMenuSeparator />}
                {c.cut && <Item icon={ScissorsIcon} label={t('cut')} kbd={CUT_KBD} disabled={allLocked} run={c.cut} />}
                <Item icon={CopyIcon} label={t('copy')} kbd={COPY_KBD} run={c.copy} />
                {c.paste && <Item icon={ClipboardTextIcon} label={t('paste')} kbd={PASTE_KBD} run={c.paste} />}
                {c.clear && (
                  <Item icon={BackspaceIcon} label={t('clear')} kbd={CLEAR_KBD} disabled={allLocked} run={c.clear} />
                )}
                {c.fill && (
                  <Item
                    icon={ArrowDownIcon}
                    label={t('fillDown')}
                    sub={t(info.single ? 'fillDownAbove' : 'fillDownFirst')}
                    kbd={FILL_KBD}
                    disabled={allLocked}
                    run={c.fill}
                  />
                )}
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger className="dt-menu-item">
                    <TableIcon size={16} className="dt-menu-icon" aria-hidden="true" />
                    <span className="dt-menu-text">{t('select')}</span>
                    <CaretRightIcon size={16} className="dt-menu-caret" aria-hidden="true" />
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner className="dt-positioner" sideOffset={4}>
                      <Menu.Popup className="dt-menu dt-grid-menu dt-sheet-layer" finalFocus={false}>
                        <Item icon={RowsIcon} label={t('selectRow')} kbd={ROW_KBD} run={c.selectRow} />
                        <Item icon={ColumnsIcon} label={t('selectColumn')} kbd={COLUMN_KBD} run={c.selectColumn} />
                        <Item icon={SquareIcon} label={t('selectAll')} kbd={ALL_KBD} run={c.selectAll} />
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </ContextMenu.Root>
  )
}
