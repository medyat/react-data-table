// More ⋯ menüsü (05 §3): yalnızca uygulamanın verdiği eylemler ve ayarlar; Refresh `R`, Auto-refresh anahtarı.
// Export › CSV / Excel (D46); içe aktarma bu sürümde yok (R1).
import { Menu } from '@base-ui/react/menu'
import { DotsThreeIcon } from '@phosphor-icons/react'
import { useDataTableContext } from '../provider'
import { DtMenu, DtMenuItem, DtMenuSeparator } from '../ui/menu'

export function MoreMenu({
  exportLabel,
  onExport,
  onRefresh,
  onPrint,
  autoRefresh,
  autoRefreshOn,
  onAutoRefresh,
}: {
  /** "Export 100 rows" / "Export 3 selected rows"; verilmezse Export yok. */
  exportLabel?: string
  onExport: (format: 'csv' | 'xlsx') => void
  onRefresh?: () => void
  onPrint?: () => void
  /** Uygulama `autoRefresh` saniyesi verdiyse anahtar görünür. */
  autoRefresh: boolean
  autoRefreshOn: boolean
  onAutoRefresh: (on: boolean) => void
}) {
  const { i18n } = useDataTableContext()
  return (
    <DtMenu
      className="dt-more-menu"
      trigger={
        <button
          type="button"
          className="dt-btn dt-btn-icon"
          aria-label={i18n.t('toolbar.more')}
          data-dt-tip={i18n.t('toolbar.more')}
        >
          <DotsThreeIcon size={16} weight="bold" aria-hidden="true" />
        </button>
      }
    >
      {exportLabel && (
        <Menu.SubmenuRoot>
          <Menu.SubmenuTrigger className="dt-menu-item">{exportLabel}</Menu.SubmenuTrigger>
          <Menu.Portal>
            <Menu.Positioner className="dt-positioner" sideOffset={4}>
              <Menu.Popup className="dt-menu">
                <DtMenuItem onSelect={() => onExport('csv')}>{i18n.t('toolbar.csv')}</DtMenuItem>
                <DtMenuItem onSelect={() => onExport('xlsx')}>{i18n.t('toolbar.xlsx')}</DtMenuItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.SubmenuRoot>
      )}
      {onPrint && <DtMenuItem onSelect={onPrint}>{i18n.t('toolbar.print')}</DtMenuItem>}
      {(exportLabel || onPrint) && (onRefresh || autoRefresh) && <DtMenuSeparator />}
      {onRefresh && (
        <DtMenuItem onSelect={onRefresh}>
          {i18n.t('toolbar.refresh')}
          <kbd className="dt-kbd">R</kbd>
        </DtMenuItem>
      )}
      {autoRefresh && (
        <Menu.CheckboxItem
          className="dt-menu-item"
          checked={autoRefreshOn}
          onCheckedChange={(v) => onAutoRefresh(v)}
          closeOnClick
        >
          {i18n.t('toolbar.autoRefresh')}
          <span
            className="dt-switch dt-pop-end"
            data-state={autoRefreshOn ? 'checked' : 'unchecked'}
            aria-hidden="true"
          >
            <span className="dt-switch-thumb" />
          </span>
        </Menu.CheckboxItem>
      )}
    </DtMenu>
  )
}
