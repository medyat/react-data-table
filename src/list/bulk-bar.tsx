// Bulk bar (05 §6, handoff 03 §7, T5-01/03/04): [sayaç] │ aksiyonlar (en fazla 3 `inBar`) │ ⋯ (kalanlar, yıkıcı en altta) │ ×.
// Yüzer (varsayılan: kartın altında ortada, 64 px, düzeni kaydırmaz) ya da araç çubuğunun yerine. `run(rows)` beklenmez (D20).
import { DotsThreeIcon, XIcon } from '@phosphor-icons/react'
import { Fragment, type ReactNode } from 'react'
import { useDataTableContext } from '../core/provider'
import { DtMenu, DtMenuItem, DtMenuSeparator } from '../core/ui/menu'
import type { BulkAction } from '../types/list'

export function BulkBar<Row extends object>({
  rows,
  actions,
  variant,
  onClear,
  children,
}: {
  rows: Row[]
  actions: Array<BulkAction<Row>>
  variant: 'floating' | 'toolbar'
  onClear: () => void
  /** `bulkActions` yerine uygulamanın içeriği. */
  children?: ReactNode
}) {
  const { i18n } = useDataTableContext()
  // `when(rows)` false olan ne bar'da ne menüde (D36); menüde yıkıcılar en altta, ayırıcıdan sonra.
  const shown = actions.filter((a) => !a.when || a.when(rows))
  const inBar = shown.filter((a) => a.inBar).slice(0, 3)
  const others = shown.filter((a) => !inBar.includes(a))
  const rest = [...others.filter((a) => !a.destructive), ...others.filter((a) => a.destructive)]
  const firstDestructive = rest.findIndex((a) => a.destructive)
  const disabledOf = (a: BulkAction<Row>): boolean | string => a.disabled?.(rows) ?? false
  /** Tooltip / ikinci satır: `disabled` gerekçesi varsa o, yoksa `description` (D36). */
  const tipOf = (a: BulkAction<Row>): string | undefined => {
    const d = disabledOf(a)
    return typeof d === 'string' ? d : a.description
  }
  const run = (a: BulkAction<Row>) => {
    if (!disabledOf(a)) void a.run(rows)
  }
  const btn = variant === 'toolbar' ? 'dt-btn has-icon' : 'dt-bulk-btn'
  const clear = (cls: string) => (
    <button
      type="button"
      className={cls}
      aria-label={i18n.t('selection.clear')}
      data-dt-tip={i18n.t('selection.clear')}
      onClick={onClear}
    >
      <XIcon size={16} aria-hidden="true" />
    </button>
  )

  return (
    <div className={`dt-bulk is-${variant}`} role="toolbar" aria-label={i18n.t('bulk.aria')}>
      {variant === 'toolbar' && clear('dt-btn dt-btn-icon')}
      <span className="dt-bulk-count" role="status">
        {i18n.t('selection.selected', { count: rows.length })}
      </span>
      <span className="dt-bulk-sep" aria-hidden="true" />
      {children ?? (
        <>
          {inBar.map((a) => {
            const Icon = a.icon
            return (
              <button
                key={a.id}
                type="button"
                className={a.destructive ? `${btn} is-destructive` : btn}
                disabled={!!disabledOf(a)}
                data-dt-tip={tipOf(a)}
                onClick={() => run(a)}
              >
                {Icon && <Icon size={16} aria-hidden="true" />}
                <span>{a.label}</span>
              </button>
            )
          })}
          {rest.length > 0 && (
            <DtMenu
              className="dt-bulk-menu"
              align="start"
              side={variant === 'floating' ? 'top' : undefined}
              offset={variant === 'floating' ? 12 : 4}
              trigger={
                <button
                  type="button"
                  className={variant === 'toolbar' ? `${btn} dt-bulk-more dt-btn-icon` : `${btn} dt-bulk-more`}
                  aria-label={i18n.t('bulk.moreAria')}
                >
                  <DotsThreeIcon size={16} weight="bold" aria-hidden="true" />
                </button>
              }
            >
              {rest.map((a, i) => {
                const tip = tipOf(a)
                return (
                  <Fragment key={a.id}>
                    {i === firstDestructive && <DtMenuSeparator />}
                    <DtMenuItem
                      destructive={a.destructive}
                      twoLine={!!tip}
                      disabled={!!disabledOf(a)}
                      onSelect={() => run(a)}
                    >
                      <span className="dt-menu-text">
                        <span>{a.label}</span>
                        {tip && <span className="dt-menu-sub">{tip}</span>}
                      </span>
                    </DtMenuItem>
                  </Fragment>
                )
              })}
            </DtMenu>
          )}
        </>
      )}
      {variant === 'floating' && (
        <>
          <span className="dt-bulk-sep" aria-hidden="true" />
          {clear('dt-bulk-btn dt-bulk-icon')}
        </>
      )}
    </div>
  )
}
