// Header hücresi (05 §4 · Header, T4): etiket düğmesi, birim, sıralama oku, raptiye, ⋯ sütun menüsü, resize tutamacı.
// Klavye (08 §3): ↵/Space sırala, ⇧F10 menü, ⇧←/→ ±16 px, ⌥⇧←/→ taşı. Filtre işareti Faz 3a'da eklenir.
import { ArrowUpIcon, DotsThreeIcon, PushPinIcon } from '@phosphor-icons/react'
import { useId, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent, type TouchEvent } from 'react'
import { alignOf, isNumericType, typeLabelKey } from '../cells/specs'
import type { ColumnLayoutApi, LayoutColumn } from '../columns/use-column-layout'
import { MOVE_KBD } from '../interaction/kbd'
import { useDataTableContext } from '../provider'
import { DtMenu, DtMenuItem, DtMenuLabel, DtMenuSeparator } from '../ui/menu'
import { pinStyle } from './pin'

export interface HeaderSort {
  dir: 'asc' | 'desc'
  /** Çoklu sıralamada öncelik (1 tabanlı); tek sıralamada null. */
  index: number | null
}

export function HeaderCell<Row extends object>({
  column,
  layout,
  onMoved,
  sort,
  onSort,
  onSortSet,
}: {
  column: LayoutColumn<Row>
  layout: ColumnLayoutApi<Row>
  /** Taşınan başlığın odağı korunur: ızgara yeni yerindeki etiketi odaklar. */
  onMoved: (id: string) => void
  sort?: HeaderSort
  /** Verilmezse sütun sıralanamaz. */
  onSort?: (additive: boolean) => void
  onSortSet?: (dir: 'asc' | 'desc' | null) => void
}) {
  const { i18n } = useDataTableContext()
  const def = column.def
  const numeric = isNumericType(def.type)
  const unit = typeof def.unit === 'string' ? def.unit : undefined
  // D33: açıklama tooltip'te ikinci satır, ekran okuyucuya aria-describedby; düğme metnine girmez.
  const descId = useId()
  const tip = def.description ? `${def.header}\n${def.description}` : def.header
  const [menuOpen, setMenuOpen] = useState(false)
  // Yalnızca sürüklenen sütunun başlığı yeniden çizilir; diğerleri sabit -1 okur.
  const resizing = useSyncExternalStore(layout.subscribeSizing, () => {
    const r = layout.resizing()
    return r?.id === column.id ? r.size : -1
  })

  const move = (delta: -1 | 1) => {
    layout.move(column.id, delta)
    onMoved(column.id)
  }

  const onResizeStart = (e: MouseEvent | TouchEvent) => {
    // Sürükleme başlarken çizilen genişlik modele yazılır: minmax sütun ilk harekette zıplamasın.
    const cell = e.currentTarget.parentElement!
    layout.setWidth(column.id, cell.getBoundingClientRect().width)
    column.resizeHandler(e)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const k = e.key
    if (k === 'Enter' || k === ' ') {
      if (onSort) {
        e.preventDefault()
        onSort(e.shiftKey)
      }
      return
    }
    if ((k === 'F10' && e.shiftKey) || k === 'ContextMenu') {
      e.preventDefault()
      setMenuOpen(true)
      return
    }
    if ((k === 'ArrowLeft' || k === 'ArrowRight') && e.shiftKey) {
      e.preventDefault()
      const left = k === 'ArrowLeft'
      if (e.altKey) move(left ? -1 : 1)
      else layout.setWidth(column.id, layout.widthOf(column.id) + (left ? -16 : 16))
    }
  }

  // ARIA tek sıralama sütunu tanır: çoklu sıralamada yalnızca birincil (04 §6).
  const primarySort = sort && (sort.index ?? 1) === 1 ? sort.dir : undefined
  const ariaSort = primarySort === 'asc' ? 'ascending' : primarySort === 'desc' ? 'descending' : undefined
  const arrow = <ArrowUpIcon size={12} className={sort?.dir === 'desc' ? 'is-desc' : undefined} />
  const index = sort?.index && <span className="dt-head-sort-index">{sort.index}</span>
  const sortMark = (
    <span className="dt-head-sort" aria-hidden="true">
      {numeric ? (
        <>
          {index}
          {arrow}
        </>
      ) : (
        <>
          {arrow}
          {index}
        </>
      )}
    </span>
  )

  const cls = [
    'dt-head-cell',
    `is-${alignOf(def)}`,
    numeric && 'is-numeric',
    sort && 'is-sorted',
    column.pinned === 'start' && 'is-pinned-start',
    column.pinned === 'end' && 'is-pinned-end',
    column.pinEdge && 'is-pin-edge',
    resizing >= 0 && 'is-resizing',
    menuOpen && 'is-menu-open',
  ]

  return (
    <div
      className={cls.filter(Boolean).join(' ')}
      style={pinStyle(column)}
      role="columnheader"
      aria-sort={ariaSort}
      data-col={column.id}
      onContextMenu={(e) => {
        e.preventDefault()
        setMenuOpen(true)
      }}
    >
      <button
        type="button"
        className={onSort ? 'dt-head-label' : 'dt-head-label is-static'}
        aria-disabled={onSort ? undefined : 'true'}
        data-dt-tip={tip}
        aria-describedby={def.description ? descId : undefined}
        onClick={(e) => onSort?.(e.shiftKey)}
        onKeyDown={onKeyDown}
      >
        {/* Sayısal sütunda ok metnin solunda: sağa yaslı başlıkta metin kenara oturur. */}
        {sort && numeric && sortMark}
        <span className="dt-head-text">{def.header}</span>
        {unit && <span className="dt-head-unit">{unit}</span>}
        {sort && !numeric && sortMark}
        {column.pinned && <PushPinIcon size={12} className="dt-head-pin" aria-hidden="true" />}
      </button>
      {def.description && (
        <span id={descId} className="dt-sr-only">
          {def.description}
        </span>
      )}
      <DtMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        className="dt-col-menu"
        trigger={
          <button
            type="button"
            className="dt-head-icon dt-head-menu"
            aria-label={i18n.t('header.optionsAria', { column: def.header })}
          >
            <DotsThreeIcon size={16} weight="bold" aria-hidden="true" />
          </button>
        }
      >
        <DtMenuLabel>{i18n.t(typeLabelKey(def.type))}</DtMenuLabel>
        {onSortSet && (
          <>
            <DtMenuItem onSelect={() => onSortSet('asc')}>{i18n.t('header.sortAsc')}</DtMenuItem>
            <DtMenuItem onSelect={() => onSortSet('desc')}>{i18n.t('header.sortDesc')}</DtMenuItem>
            <DtMenuItem disabled={!sort} onSelect={() => onSortSet(null)}>
              {i18n.t('header.clearSort')}
            </DtMenuItem>
            <DtMenuSeparator />
          </>
        )}
        <DtMenuItem onSelect={() => move(-1)}>
          {i18n.t('header.moveLeft')}
          <kbd className="dt-kbd">{MOVE_KBD.left}</kbd>
        </DtMenuItem>
        <DtMenuItem onSelect={() => move(1)}>
          {i18n.t('header.moveRight')}
          <kbd className="dt-kbd">{MOVE_KBD.right}</kbd>
        </DtMenuItem>
        <DtMenuSeparator />
        <DtMenuItem disabled={!!column.pinned || !column.canHide} onSelect={() => layout.setVisible(column.id, false)}>
          {i18n.t('header.hide')}
        </DtMenuItem>
      </DtMenu>
      <span className="dt-head-sep" aria-hidden="true" />
      <span className="dt-resize" aria-hidden="true" onMouseDown={onResizeStart} onTouchStart={onResizeStart}>
        {resizing >= 0 && <span className="dt-resize-badge">{Math.round(resizing)} px</span>}
      </span>
    </div>
  )
}
