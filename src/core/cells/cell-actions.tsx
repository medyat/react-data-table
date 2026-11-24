// Hücre aksiyonları overlay'i (03 · actions, T7): sağ kenarda ≤ 2 düğme, fazlası ⋯ menüsünde; metin yerleşimi değişmez.
// Menü öğesinin kendi `menu`'su alt menü olur (form-grid.md §3.3, pano F4a). `run` hücreyi (`anchor`) ve FormGrid'de
// `setValue`'yu alır.
import { Menu } from '@base-ui/react/menu'
import { CaretRightIcon, DotsThreeIcon } from '@phosphor-icons/react'
import { useRef } from 'react'
import type { CellAction, CellActionContext, CellActionItem } from '../../types/columns'
import { useDataTableContext } from '../provider'
import { DtMenu, DtMenuItem } from '../ui/menu'

const disabledOf = <Row,>(a: CellActionItem<Row>, row: Row): string | boolean => a.disabled?.(row) ?? false

/** Menü öğeleri; alt menüsü olan öğe Base UI submenu'süyle açılır. */
function CellActionItems<Row>({
  items,
  row,
  ctx,
}: {
  items: Array<CellActionItem<Row>>
  row: Row
  ctx: () => CellActionContext
}) {
  return items
    .filter((m) => m.when?.(row) ?? true)
    .map((m) => {
      const Icon = m.icon
      const off = disabledOf(m, row)
      if (m.menu?.length)
        return (
          <Menu.SubmenuRoot key={m.id}>
            <Menu.SubmenuTrigger className="dt-menu-item" disabled={!!off}>
              {Icon && <Icon size={16} className="dt-menu-icon" aria-hidden="true" />}
              <span className="dt-menu-text">{m.label}</span>
              <CaretRightIcon size={12} className="dt-menu-kbd" aria-hidden="true" />
            </Menu.SubmenuTrigger>
            <Menu.Portal>
              <Menu.Positioner className="dt-positioner" sideOffset={4}>
                <Menu.Popup className="dt-menu dt-menu-cell dt-sheet-layer" finalFocus={false}>
                  <CellActionItems items={m.menu} row={row} ctx={ctx} />
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.SubmenuRoot>
        )
      return (
        <DtMenuItem
          key={m.id}
          destructive={m.destructive}
          disabled={!!off}
          twoLine={typeof off === 'string'}
          onSelect={() => !off && void m.run?.(row, ctx())}
        >
          {Icon && <Icon size={16} className="dt-menu-icon" aria-hidden="true" />}
          <span className="dt-menu-text">
            <span>{m.label}</span>
            {typeof off === 'string' && <span className="dt-menu-sub">{off}</span>}
          </span>
        </DtMenuItem>
      )
    })
}

export function CellActions<Row extends object>({
  actions,
  row,
  setValue,
}: {
  actions: Array<CellAction<Row>>
  row: Row
  /** FormGrid: hücreye yazar (geri al'a girer). */
  setValue?: (value: unknown) => void
}) {
  const { i18n } = useDataTableContext()
  const self = useRef<HTMLSpanElement>(null)
  const visible = actions.filter((a) => a.when?.(row) ?? true)
  if (!visible.length) return null
  const always = visible.some((a) => a.reveal === 'always')
  // 2'den çoksa: ilk aksiyon + ⋯ (kalanlar menüde). Tek aksiyonun kendi `menu`'sü ⋯ olarak çizilir.
  const buttons = visible.length > 2 ? visible.slice(0, 1) : visible
  const overflow = visible.length > 2 ? visible.slice(1) : []
  const ctx = (): CellActionContext => ({ anchor: self.current?.closest<HTMLElement>('.dt-cell') ?? null, setValue })

  const tipOf = (a: CellAction<Row>): string => {
    const d = disabledOf(a, row)
    return typeof d === 'string' ? `${a.label} — ${d}` : a.label
  }

  return (
    <span ref={self} className={always ? 'dt-cell-actions is-always' : 'dt-cell-actions'}>
      {buttons.map((a) => {
        const Icon = a.icon
        const cls = a.destructive ? 'dt-cell-action is-destructive' : 'dt-cell-action'
        if (a.menu?.length)
          return (
            <DtMenu
              key={a.id}
              className="dt-menu-cell"
              trigger={
                <button type="button" className={cls} aria-label={a.label} data-dt-tip={a.label}>
                  <Icon size={14} aria-hidden="true" />
                </button>
              }
            >
              <CellActionItems items={a.menu} row={row} ctx={ctx} />
            </DtMenu>
          )
        return (
          <button
            key={a.id}
            type="button"
            className={cls}
            aria-label={a.label}
            aria-disabled={disabledOf(a, row) ? 'true' : undefined}
            data-dt-tip={tipOf(a)}
            onClick={() => !disabledOf(a, row) && void a.run?.(row, ctx())}
          >
            <Icon size={14} aria-hidden="true" />
          </button>
        )
      })}
      {overflow.length > 0 && (
        <DtMenu
          className="dt-menu-cell"
          trigger={
            <button
              type="button"
              className="dt-cell-action"
              aria-label={i18n.t('common.more')}
              data-dt-tip={i18n.t('common.more')}
            >
              <DotsThreeIcon size={14} weight="bold" aria-hidden="true" />
            </button>
          }
        >
          <CellActionItems items={overflow} row={row} ctx={ctx} />
        </DtMenu>
      )}
    </span>
  )
}

/** ⌥↵ (form-grid.md §8): hücrenin bütün aksiyonları tek menüde, hücreye bağlı. */
export function CellActionMenu<Row>({
  actions,
  row,
  anchor,
  setValue,
  onClose,
}: {
  actions: Array<CellAction<Row>>
  row: Row
  anchor: HTMLElement
  setValue: (value: unknown) => void
  onClose: () => void
}) {
  return (
    <Menu.Root open onOpenChange={(open) => !open && onClose()}>
      <Menu.Portal>
        <Menu.Positioner className="dt-positioner" anchor={anchor} align="end" sideOffset={2}>
          <Menu.Popup className="dt-menu dt-menu-cell dt-sheet-layer" finalFocus={false}>
            <CellActionItems items={actions} row={row} ctx={() => ({ anchor, setValue })} />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
