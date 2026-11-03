// Hücre aksiyonları overlay'i (03 · actions, T7): sağ kenarda ≤ 2 düğme, fazlası ⋯ menüsünde; metin yerleşimi değişmez.
import { DotsThreeIcon } from '@phosphor-icons/react'
import type { CellAction } from '../../types/columns'
import { useDataTableContext } from '../provider'
import { DtMenu, DtMenuItem } from '../ui/menu'

type Item<Row> = Omit<CellAction<Row>, 'reveal' | 'menu'> & { menu?: Array<Omit<CellAction<Row>, 'reveal' | 'menu'>> }

export function CellActions<Row extends object>({ actions, row }: { actions: Array<CellAction<Row>>; row: Row }) {
  const { i18n } = useDataTableContext()
  const visible = actions.filter((a) => a.when?.(row) ?? true)
  if (!visible.length) return null
  const always = visible.some((a) => a.reveal === 'always')
  // 2'den çoksa: ilk aksiyon + ⋯ (kalanlar menüde). Tek aksiyonun kendi `menu`'sü ⋯ olarak çizilir.
  const buttons: Array<Item<Row>> = visible.length > 2 ? visible.slice(0, 1) : visible
  const overflow: Array<Item<Row>> = visible.length > 2 ? visible.slice(1) : []

  const disabledOf = (a: Item<Row>): string | boolean => a.disabled?.(row) ?? false
  const tipOf = (a: Item<Row>): string => {
    const d = disabledOf(a)
    return typeof d === 'string' ? `${a.label} — ${d}` : a.label
  }
  const run = (a: Item<Row>) => {
    if (!disabledOf(a)) void a.run?.(row)
  }
  const menuItems = (items: Array<Item<Row>>) =>
    items.map((m) => {
      const Icon = m.icon
      return (
        <DtMenuItem key={m.id} destructive={m.destructive} disabled={!!disabledOf(m)} onSelect={() => run(m)}>
          <Icon size={16} aria-hidden="true" />
          {m.label}
        </DtMenuItem>
      )
    })

  return (
    <span className={always ? 'dt-cell-actions is-always' : 'dt-cell-actions'}>
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
              {menuItems(a.menu)}
            </DtMenu>
          )
        return (
          <button
            key={a.id}
            type="button"
            className={cls}
            aria-label={a.label}
            aria-disabled={disabledOf(a) ? 'true' : undefined}
            data-dt-tip={tipOf(a)}
            onClick={() => run(a)}
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
          {menuItems(overflow)}
        </DtMenu>
      )}
    </span>
  )
}
