// More ⋯ menüsü (05 §3): üstte ekranın eylemleri (R25: düğmeye sığmayanlar ve `menu` olanlar), sonra paketin
// yerleşikleri; Refresh `R`, Auto-refresh anahtarı.
// Export › CSV / Excel (D46); içe aktarma bu sürümde yok (R1).
import { Menu } from '@base-ui/react/menu'
import { CheckIcon, DotsThreeIcon } from '@phosphor-icons/react'
import { useId } from 'react'
import type { ToolbarAction } from '../../types/list'
import { useDataTableContext } from '../provider'
import { DtMenu, DtMenuItem, DtMenuSeparator } from '../ui/menu'

export function MoreMenu({
  actions = [],
  exportHint,
  onExport,
  onRefresh,
  onPrint,
  autoRefresh,
  autoRefreshOn,
  onAutoRefresh,
}: {
  actions?: ToolbarAction[]
  /** Export'un altındaki satır: "100 satır dışa aktarılır"; verilmezse Export yok. */
  exportHint?: string
  onExport: (format: 'csv' | 'xlsx') => void
  onRefresh?: () => void
  onPrint?: () => void
  /** Uygulama `autoRefresh` saniyesi verdiyse anahtar görünür. */
  autoRefresh: boolean
  autoRefreshOn: boolean
  onAutoRefresh: (on: boolean) => void
}) {
  const { i18n } = useDataTableContext()
  const hintId = useId()
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
      {actions.map((a) => {
        const Icon = a.icon
        const content = (
          <>
            {Icon && <Icon size={16} aria-hidden="true" />}
            {a.label}
          </>
        )
        return a.checked === undefined ? (
          <DtMenuItem key={a.id} onSelect={a.run}>
            {content}
          </DtMenuItem>
        ) : (
          <Menu.CheckboxItem
            key={a.id}
            className="dt-menu-item"
            checked={a.checked}
            onCheckedChange={a.run}
            closeOnClick
          >
            {content}
            <Menu.CheckboxItemIndicator className="dt-pop-end">
              <CheckIcon size={16} aria-hidden="true" />
            </Menu.CheckboxItemIndicator>
          </Menu.CheckboxItem>
        )
      })}
      {actions.length > 0 && (exportHint || onPrint || onRefresh || autoRefresh) && <DtMenuSeparator />}
      {exportHint && (
        <Menu.SubmenuRoot>
          <Menu.SubmenuTrigger className="dt-menu-item" aria-label={i18n.t('sheet.export')} aria-describedby={hintId}>
            <span className="dt-item-lines">
              {i18n.t('sheet.export')}
              <span id={hintId} className="dt-item-hint">
                {exportHint}
              </span>
            </span>
          </Menu.SubmenuTrigger>
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
      {(exportHint || onPrint) && (onRefresh || autoRefresh) && <DtMenuSeparator />}
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
