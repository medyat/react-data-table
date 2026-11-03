// Filtre satırı (04 §4, D29): tek satır, çipler → Add filter; sağda Clear all sabit. Sığmayan çipler yatay kayar, sağ
// kenarda solma; düzenlenen / yeni eklenen çip görünür alana kaydırılır. Add filter kayan alanın dışında: çipler sığarken
// son çipin yanında, taşınca sağda. Sarma ve `+N more` yok (D2 çip sayısını sınırlar).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { ColumnDef } from '../../types/columns'
import type { RemoteLabels } from '../cells/remote-labels'
import { useDataTableContext } from '../provider'
import { FilterChip } from './filter-chip'
import type { Chip, Summary } from './model'

export function FilterBar({
  chips,
  defOf,
  editing,
  rows,
  labels,
  summaryOf,
  currenciesOf,
  add,
  onChange,
  onRemove,
  onEditing,
  onClearAll,
}: {
  chips: Chip[]
  defOf: (column: string) => ColumnDef
  editing: string | null
  rows: object[]
  labels: RemoteLabels
  summaryOf: (chip: Chip) => Summary
  currenciesOf: (def: ColumnDef) => string[]
  /** Add filter düğmesi (column picker tetikleyicisi). */
  add: ReactNode
  onChange: (chip: Chip) => void
  onRemove: (column: string) => void
  onEditing: (column: string | null) => void
  onClearAll: () => void
}) {
  const { i18n } = useDataTableContext()
  const row = useRef<HTMLDivElement>(null)
  /** Sütun id'sinde nokta olabilir: seçici yerine dataset karşılaştırması. */
  const chipEl = (column: string | undefined) =>
    column
      ? [...(row.current?.querySelectorAll<HTMLElement>('.dt-chip') ?? [])].find((el) => el.dataset.col === column)
      : undefined

  const [scrolledEnd, setScrolledEnd] = useState(false)
  const onScroll = () => {
    const el = row.current
    if (el) setScrolledEnd(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }
  useEffect(() => {
    const el = row.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(onScroll)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const target = editing ?? chips.at(-1)?.column
  useLayoutEffect(() => {
    onScroll()
    chipEl(target)?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' })
  }, [chips.length, target])

  // × sonrası odak sonraki çipe, yoksa Add filter'a (04 §3): çip DOM'dan çıktıktan sonra.
  const focusNext = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (focusNext.current === undefined) return
    const next = focusNext.current
    focusNext.current = undefined
    const el =
      chipEl(next ?? undefined)?.querySelector<HTMLElement>('.dt-chip-body') ??
      row.current?.parentElement?.querySelector<HTMLElement>('.dt-filter-add')
    el?.focus()
  })
  const remove = (column: string) => {
    const i = chips.findIndex((c) => c.column === column)
    focusNext.current = chips[i + 1]?.column ?? null
    onRemove(column)
  }

  return (
    <div className={scrolledEnd ? 'dt-filter-row is-scrolled-end' : 'dt-filter-row'}>
      <div ref={row} className="dt-chips" onScroll={onScroll}>
        {chips.map((c) => (
          <FilterChip
            key={c.column}
            chip={c}
            column={defOf(c.column)}
            editing={editing === c.column}
            summary={summaryOf(c)}
            rows={rows}
            labels={labels}
            currencies={currenciesOf(defOf(c.column))}
            onChange={onChange}
            onEditing={(open) => onEditing(open ? c.column : null)}
            onRemove={() => remove(c.column)}
          />
        ))}
      </div>
      {add}
      <button type="button" className="dt-btn dt-btn-ghost dt-filter-clear" onClick={onClearAll}>
        {i18n.t('filter.clearAll')}
      </button>
    </div>
  )
}
