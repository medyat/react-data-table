// Display popover'ı (05 §3, §5; T3-06, T4-04/05): Density · Vertical grid lines · Columns › · Saved for you only + Reset.
// Columns › dialog'u açar (D45); dialog ve @dnd-kit ilk açılışta yüklenir, sonra bağlı kalır (odak dönüşü). Sort › yok:
// sıralama header'dan.
import { Popover } from '@base-ui/react/popover'
import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { CaretRightIcon, SlidersHorizontalIcon } from '@phosphor-icons/react'
import { lazy, Suspense, useRef, useState } from 'react'
import type { Density } from '../../types/core'
import type { ColumnsDraft, PanelColumn } from '../columns/use-column-layout'
import { useDataTableContext } from '../provider'
import { DtSwitch } from '../ui/switch'

// lazy() generic bileşenin tip parametresini düşürür; satır tipi dialog'a aynen geçer.
const ColumnsDialog = lazy(() => import('./columns-dialog')) as unknown as typeof import('./columns-dialog').default
const DENSITIES: Density[] = ['comfortable', 'standard', 'compact']

export function DisplayPopover<Row extends object>({
  density,
  onDensity,
  verticalLines,
  onVerticalLines,
  columns,
  counts,
  onColumnsSave,
  persistent,
  onReset,
  iconOnly,
}: {
  density: Density
  onDensity: (d: Density) => void
  verticalLines: boolean
  onVerticalLines: (on: boolean) => void
  columns: Array<PanelColumn<Row>>
  counts: { shown: number; total: number }
  onColumnsSave: (draft: ColumnsDraft) => void
  /** Tercih deposu varsa "Saved for you only". */
  persistent: boolean
  onReset: () => void
  iconOnly?: boolean
}) {
  const { i18n } = useDataTableContext()
  const [open, setOpen] = useState(false)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [columnsUsed, setColumnsUsed] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const openColumns = () => {
    setOpen(false)
    setColumnsUsed(true)
    setColumnsOpen(true)
  }

  return (
    <>
      <Popover.Root open={open} onOpenChange={(o) => setOpen(o)}>
        <Popover.Trigger
          ref={trigger}
          className={iconOnly ? 'dt-btn has-icon dt-btn-icon' : 'dt-btn has-icon'}
          aria-label={i18n.t('toolbar.display')}
          data-dt-tip={iconOnly ? i18n.t('toolbar.display') : undefined}
        >
          <SlidersHorizontalIcon size={16} aria-hidden="true" />
          {!iconOnly && <span>{i18n.t('toolbar.display')}</span>}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner className="dt-positioner" align="end" sideOffset={4}>
            <Popover.Popup className="dt-pop dt-display">
              <div className="dt-pop-label">{i18n.t('display.density')}</div>
              <ToggleGroup
                className="dt-seg dt-seg-sm dt-display-density"
                value={[density]}
                onValueChange={(v) => v[0] && onDensity(v[0] as Density)}
              >
                {DENSITIES.map((d) => (
                  <Toggle key={d} className="dt-seg-item" value={d} data-state={d === density ? 'on' : 'off'}>
                    {i18n.t(`display.${d}`)}
                  </Toggle>
                ))}
              </ToggleGroup>
              <label className="dt-pop-item">
                {i18n.t('display.verticalLines')}
                <DtSwitch className="dt-pop-end" checked={verticalLines} onChange={onVerticalLines} />
              </label>
              <div className="dt-pop-sep" />
              <button type="button" className="dt-pop-item" onClick={openColumns}>
                {i18n.t('display.columns')}
                <span className="dt-pop-value">{i18n.t('columns.shownOf', counts)}</span>
                <CaretRightIcon size={14} aria-hidden="true" />
              </button>
              <div className="dt-pop-foot">
                <span>{persistent ? i18n.t('display.savedForYou') : ''}</span>
                <button type="button" className="dt-pop-action" onClick={onReset}>
                  {i18n.t('common.reset')}
                </button>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      {columnsUsed && (
        <Suspense fallback={null}>
          <ColumnsDialog
            open={columnsOpen}
            onOpenChange={setColumnsOpen}
            columns={columns}
            onSave={onColumnsSave}
            finalFocus={trigger}
          />
        </Suspense>
      )}
    </>
  )
}
