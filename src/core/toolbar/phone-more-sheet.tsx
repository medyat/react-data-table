// Telefon ⋯ alt sayfası (handoff 04 §6.4, T13-07): Display (Density › · Columns (dialog, D45) · Sort ›) · Print · Refresh ·
// Export › (D46) · Auto-refresh · "Saved for you only" + Reset. Masaüstündeki Display popover'ının ve ⋯ menüsünün yerini
// alır. Sort paneli yalnızca burada: masaüstünde sıralama header'dan.
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckIcon,
  DotsThreeIcon,
  XIcon,
} from '@phosphor-icons/react'
import { lazy, Suspense, useRef, useState } from 'react'
import type { Density } from '../../types/core'
import type { SortRule } from '../../types/query'
import type { ColumnsDraft, PanelColumn } from '../columns/use-column-layout'
import { useDataTableContext } from '../provider'
import { BottomSheet } from '../ui/bottom-sheet'
import { DtSwitch } from '../ui/switch'

const ColumnsDialog = lazy(() => import('./columns-dialog')) as unknown as typeof import('./columns-dialog').default
const DENSITIES: Density[] = ['comfortable', 'standard', 'compact']
const TITLES = {
  main: 'toolbar.more',
  density: 'display.density',
  sort: 'display.sort',
  export: 'sheet.export',
} as const
type Level = keyof typeof TITLES

export function PhoneMoreSheet<Row extends object>({
  density,
  onDensity,
  columns,
  counts,
  onColumnsSave,
  sort,
  onSort,
  persistent,
  onReset,
  exportLabel,
  onExport,
  onRefresh,
  onPrint,
  autoRefresh,
  autoRefreshOn,
  onAutoRefresh,
}: {
  density: Density
  onDensity: (d: Density) => void
  columns: Array<PanelColumn<Row>>
  counts: { shown: number; total: number }
  onColumnsSave: (draft: ColumnsDraft) => void
  sort: SortRule[]
  /** Yön değişimi, kaldırma, temizleme: yeni kural listesi (sayfa 1). */
  onSort: (sort: SortRule[]) => void
  persistent: boolean
  onReset: () => void
  exportLabel?: string
  onExport: (format: 'csv' | 'xlsx') => void
  onRefresh?: () => void
  onPrint?: () => void
  autoRefresh: boolean
  autoRefreshOn: boolean
  onAutoRefresh: (on: boolean) => void
}) {
  const { i18n } = useDataTableContext()
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState<Level>('main')
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [columnsUsed, setColumnsUsed] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const headerOf = (id: string) => columns.find((c) => c.id === id)?.def.header ?? id
  const lead = sort[0]
  const sortSummary = lead
    ? `${headerOf(lead.column)} ${lead.dir === 'asc' ? '↑' : '↓'}${sort.length > 1 ? ` +${sort.length - 1}` : ''}`
    : i18n.t('common.empty')
  const hasActions = !!(exportLabel || onPrint || onRefresh || autoRefresh)
  const setOpenAll = (o: boolean) => {
    setOpen(o)
    if (!o) setLevel('main')
  }
  const close = (fn: () => void) => {
    setOpenAll(false)
    fn()
  }

  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={setOpenAll}
        title={i18n.t(TITLES[level])}
        hideTitle={level === 'main'}
        className="dt-more-sheet"
        trigger={
          <button
            ref={trigger}
            type="button"
            className="dt-btn dt-btn-icon dt-more-trigger"
            aria-label={i18n.t('toolbar.more')}
          >
            <DotsThreeIcon size={20} weight="bold" aria-hidden="true" />
          </button>
        }
        headStart={
          level !== 'main' && (
            <button
              type="button"
              className="dt-bsheet-back"
              aria-label={i18n.t('common.back')}
              onClick={() => setLevel('main')}
            >
              <CaretLeftIcon size={20} aria-hidden="true" />
            </button>
          )
        }
      >
        {level === 'main' && (
          <>
            <div className="dt-bsheet-label">{i18n.t('toolbar.display')}</div>
            <button type="button" className="dt-bsheet-row" onClick={() => setLevel('density')}>
              {i18n.t('display.density')}
              <span className="dt-bsheet-value">{i18n.t(`display.${density}`)}</span>
              <CaretRightIcon size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="dt-bsheet-row"
              onClick={() =>
                close(() => {
                  setColumnsUsed(true)
                  setColumnsOpen(true)
                })
              }
            >
              {i18n.t('display.columns')}
              <span className="dt-bsheet-value">{i18n.t('columns.shownOf', counts)}</span>
              <CaretRightIcon size={16} aria-hidden="true" />
            </button>
            <button type="button" className="dt-bsheet-row" onClick={() => setLevel('sort')}>
              {i18n.t('display.sort')}
              <span className="dt-bsheet-value">{sortSummary}</span>
              <CaretRightIcon size={16} aria-hidden="true" />
            </button>
            {hasActions && <div className="dt-bsheet-sep" />}
            {exportLabel && (
              <button type="button" className="dt-bsheet-row" onClick={() => setLevel('export')}>
                {exportLabel}
                <CaretRightIcon size={16} className="dt-bsheet-end" aria-hidden="true" />
              </button>
            )}
            {onPrint && (
              <button type="button" className="dt-bsheet-row" onClick={() => close(onPrint)}>
                {i18n.t('toolbar.print')}
              </button>
            )}
            {onRefresh && (
              <button type="button" className="dt-bsheet-row" onClick={() => close(onRefresh)}>
                {i18n.t('toolbar.refresh')}
              </button>
            )}
            {autoRefresh && (
              <label className="dt-bsheet-row">
                {i18n.t('toolbar.autoRefresh')}
                <DtSwitch className="dt-bsheet-end" checked={autoRefreshOn} onChange={onAutoRefresh} />
              </label>
            )}
            <div className="dt-bsheet-note">
              <span>{persistent ? i18n.t('display.savedForYou') : ''}</span>
              <button type="button" className="dt-bsheet-action" onClick={onReset}>
                {i18n.t('common.reset')}
              </button>
            </div>
          </>
        )}

        {level === 'density' &&
          DENSITIES.map((d) => (
            <button
              key={d}
              type="button"
              className="dt-bsheet-row"
              onClick={() => {
                onDensity(d)
                setLevel('main')
              }}
            >
              {i18n.t(`display.${d}`)}
              {d === density && <CheckIcon size={18} className="dt-bsheet-end dt-bsheet-check" aria-hidden="true" />}
            </button>
          ))}

        {level === 'export' && (
          <>
            <button type="button" className="dt-bsheet-row" onClick={() => close(() => onExport('csv'))}>
              {i18n.t('toolbar.csv')}
            </button>
            <button type="button" className="dt-bsheet-row" onClick={() => close(() => onExport('xlsx'))}>
              {i18n.t('toolbar.xlsx')}
            </button>
          </>
        )}

        {level === 'sort' && (
          <>
            {sort.map((s, i) => {
              const Arrow = s.dir === 'asc' ? ArrowUpIcon : ArrowDownIcon
              return (
                <div key={s.column} className="dt-col-row dt-sort-row">
                  <span className="dt-head-sort-index">{i + 1}</span>
                  <span className="dt-col-name">{headerOf(s.column)}</span>
                  <button
                    type="button"
                    className="dt-btn dt-btn-xs has-icon"
                    onClick={() =>
                      onSort(
                        sort.map((r) => (r.column === s.column ? { ...r, dir: r.dir === 'asc' ? 'desc' : 'asc' } : r)),
                      )
                    }
                  >
                    <Arrow size={12} aria-hidden="true" />
                    {i18n.t(s.dir === 'asc' ? 'sr.asc' : 'sr.desc')}
                  </button>
                  <button
                    type="button"
                    className="dt-icon-btn-sm"
                    aria-label={i18n.t('header.clearSort')}
                    onClick={() => onSort(sort.filter((r) => r.column !== s.column))}
                  >
                    <XIcon size={14} aria-hidden="true" />
                  </button>
                </div>
              )
            })}
            <div className="dt-pop-foot">
              <span>{i18n.t('sort.addHint')}</span>
              <button type="button" className="dt-pop-action" disabled={!sort.length} onClick={() => onSort([])}>
                {i18n.t('header.clearSort')}
              </button>
            </div>
          </>
        )}
      </BottomSheet>
      {columnsUsed && (
        <Suspense fallback={null}>
          <ColumnsDialog
            open={columnsOpen}
            onOpenChange={setColumnsOpen}
            columns={columns}
            onSave={onColumnsSave}
            finalFocus={trigger}
            phone
          />
        </Suspense>
      )}
    </>
  )
}
