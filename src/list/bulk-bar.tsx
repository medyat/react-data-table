// Bulk bar (05 §6, handoff 03 §7, T5-01/03/04): [sayaç] │ aksiyonlar (en fazla 3 `inBar`) │ ⋯ (kalanlar, yıkıcı en altta) │ ×.
// Telefonda bar'da en fazla 2 aksiyon, kalanlar "More" alt sayfasında.
// Yüzer (varsayılan: kartın altında ortada, 64 px, düzeni kaydırmaz) ya da araç çubuğunun yerine. `run(rows)` beklenmez (D20).
// `options` verilen aksiyon seçenek ister: bar'da düğmesi menü açar, ⋯ içinde alt menü, telefonda alt sayfada satırlar.
import { Menu } from '@base-ui/react/menu'
import { CaretDownIcon, DotsThreeIcon, XIcon } from '@phosphor-icons/react'
import { Fragment, useState, type ReactNode } from 'react'
import { useDataTableContext } from '../core/provider'
import { BottomSheet } from '../core/ui/bottom-sheet'
import { DtMenu, DtMenuItem, DtMenuSeparator } from '../core/ui/menu'
import type { BulkAction, BulkOption } from '../types/list'

export function BulkBar<Row extends object>({
  rows,
  actions,
  variant,
  onClear,
  phone,
  children,
}: {
  rows: Row[]
  actions: Array<BulkAction<Row>>
  variant: 'floating' | 'toolbar'
  onClear: () => void
  phone?: boolean
  /** `bulkActions` yerine uygulamanın içeriği. */
  children?: ReactNode
}) {
  const { i18n } = useDataTableContext()
  const [moreOpen, setMoreOpen] = useState(false)
  // `when(rows)` false olan ne bar'da ne menüde (D36); menüde yıkıcılar en altta, ayırıcıdan sonra.
  const shown = actions.filter((a) => !a.when || a.when(rows))
  const inBar = shown.filter((a) => a.inBar).slice(0, phone ? 2 : 3)
  const others = shown.filter((a) => !inBar.includes(a))
  const rest = [...others.filter((a) => !a.destructive), ...others.filter((a) => a.destructive)]
  const firstDestructive = rest.findIndex((a) => a.destructive)
  const disabledOf = (a: BulkAction<Row>): boolean | string => a.disabled?.(rows) ?? false
  /** Tooltip / ikinci satır: `disabled` gerekçesi varsa o, yoksa `description` (D36). */
  const tipOf = (a: BulkAction<Row>): string | undefined => {
    const d = disabledOf(a)
    return typeof d === 'string' ? d : a.description
  }
  const run = (a: BulkAction<Row>, option?: BulkOption) => {
    setMoreOpen(false)
    if (!disabledOf(a)) void (option ? a.run(rows, option) : a.run(rows))
  }
  const optionItems = (a: BulkAction<Row>) =>
    a.options!.map((o) => (
      <DtMenuItem key={o.id} onSelect={() => run(a, o)}>
        {o.color && <span className="dt-bulk-dot" style={{ background: o.color }} aria-hidden="true" />}
        <span className="dt-menu-text">{o.label}</span>
      </DtMenuItem>
    ))
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
    <div
      className={phone ? `dt-bulk is-${variant} is-phone` : `dt-bulk is-${variant}`}
      role="toolbar"
      aria-label={i18n.t('bulk.aria')}
    >
      {variant === 'toolbar' && clear('dt-btn dt-btn-icon')}
      <span className="dt-bulk-count" role="status">
        {i18n.t('selection.selected', { count: rows.length })}
      </span>
      <span className="dt-bulk-sep" aria-hidden="true" />
      {children ?? (
        <>
          {inBar.map((a) => {
            const Icon = a.icon
            const button = (
              <button
                key={a.id}
                type="button"
                className={a.destructive ? `${btn} is-destructive` : btn}
                disabled={!!disabledOf(a)}
                data-dt-tip={tipOf(a)}
                onClick={a.options ? undefined : () => run(a)}
              >
                {Icon && <Icon size={phone ? 18 : 16} aria-hidden="true" />}
                <span>{a.label}</span>
                {a.options && <CaretDownIcon size={12} aria-hidden="true" />}
              </button>
            )
            return a.options ? (
              <DtMenu
                key={a.id}
                className="dt-bulk-menu"
                align="start"
                side={variant === 'floating' ? 'top' : undefined}
                offset={variant === 'floating' ? 12 : 4}
                trigger={button}
              >
                {optionItems(a)}
              </DtMenu>
            ) : (
              button
            )
          })}
          {rest.length > 0 && phone && (
            <BottomSheet
              open={moreOpen}
              onOpenChange={setMoreOpen}
              title={i18n.t('bulk.moreAria')}
              hideTitle
              trigger={
                <button type="button" className="dt-bulk-btn dt-bulk-more" aria-label={i18n.t('bulk.moreAria')}>
                  <DotsThreeIcon size={18} weight="bold" aria-hidden="true" />
                  <span>{i18n.t('common.more')}</span>
                </button>
              }
            >
              <div className="dt-bsheet-label">{i18n.t('selection.selected', { count: rows.length })}</div>
              {rest.map((a, i) => {
                const tip = tipOf(a)
                return (
                  <Fragment key={a.id}>
                    {i > 0 && i === firstDestructive && <div className="dt-bsheet-sep" />}
                    {a.options ? (
                      <>
                        <div className="dt-bsheet-label">{a.label}</div>
                        {a.options.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            className="dt-bsheet-row"
                            disabled={!!disabledOf(a)}
                            onClick={() => run(a, o)}
                          >
                            {o.color && (
                              <span className="dt-bulk-dot" style={{ background: o.color }} aria-hidden="true" />
                            )}
                            <span className="dt-menu-text">{o.label}</span>
                          </button>
                        ))}
                      </>
                    ) : (
                      <button
                        type="button"
                        className={a.destructive ? 'dt-bsheet-row is-destructive' : 'dt-bsheet-row'}
                        disabled={!!disabledOf(a)}
                        onClick={() => run(a)}
                      >
                        {a.icon && <a.icon size={18} aria-hidden="true" />}
                        <span className="dt-menu-text">
                          <span>{a.label}</span>
                          {tip && <span className="dt-menu-sub">{tip}</span>}
                        </span>
                      </button>
                    )}
                  </Fragment>
                )
              })}
            </BottomSheet>
          )}
          {rest.length > 0 && !phone && (
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
                    {i > 0 && i === firstDestructive && <DtMenuSeparator />}
                    {a.options ? (
                      <Menu.SubmenuRoot>
                        <Menu.SubmenuTrigger
                          className={a.destructive ? 'dt-menu-item is-destructive' : 'dt-menu-item'}
                          disabled={!!disabledOf(a)}
                        >
                          {a.icon && <a.icon size={16} aria-hidden="true" />}
                          <span className="dt-menu-text">
                            <span>{a.label}</span>
                            {tip && <span className="dt-menu-sub">{tip}</span>}
                          </span>
                        </Menu.SubmenuTrigger>
                        <Menu.Portal>
                          <Menu.Positioner className="dt-positioner" sideOffset={4}>
                            <Menu.Popup className="dt-menu dt-bulk-menu">{optionItems(a)}</Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.SubmenuRoot>
                    ) : (
                      <DtMenuItem
                        destructive={a.destructive}
                        twoLine={!!tip}
                        disabled={!!disabledOf(a)}
                        onSelect={() => run(a)}
                      >
                        {a.icon && <a.icon size={16} aria-hidden="true" />}
                        <span className="dt-menu-text">
                          <span>{a.label}</span>
                          {tip && <span className="dt-menu-sub">{tip}</span>}
                        </span>
                      </DtMenuItem>
                    )}
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
