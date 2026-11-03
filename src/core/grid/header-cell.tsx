// Header hücresi (05 §4 · Header, T4): etiket düğmesi, birim, raptiye, ⋯ sütun menüsü, resize tutamacı.
// Klavye (08 §3): ⇧F10 menü, ⇧←/→ ±16 px, ⌥⇧←/→ taşı. Sıralama ve filtre işareti Faz 2/3a'da eklenir.
import { DotsThreeIcon, PushPinIcon } from '@phosphor-icons/react'
import { useId, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent, type TouchEvent } from 'react'
import { alignOf, isNumericType, typeLabelKey } from '../cells/specs'
import type { ColumnLayoutApi, LayoutColumn } from '../columns/use-column-layout'
import { MOVE_KBD } from '../interaction/kbd'
import { useDataTableContext } from '../provider'
import { DtMenu, DtMenuItem, DtMenuLabel, DtMenuSeparator } from '../ui/menu'
import { pinStyle } from './pin'

export function HeaderCell<Row extends object>({
  column,
  layout,
  onMoved,
}: {
  column: LayoutColumn<Row>
  layout: ColumnLayoutApi<Row>
  /** Taşınan başlığın odağı korunur: ızgara yeni yerindeki etiketi odaklar. */
  onMoved: (id: string) => void
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

  const cls = [
    'dt-head-cell',
    `is-${alignOf(def)}`,
    numeric && 'is-numeric',
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
      data-col={column.id}
      onContextMenu={(e) => {
        e.preventDefault()
        setMenuOpen(true)
      }}
    >
      <button
        type="button"
        className="dt-head-label is-static"
        aria-disabled="true"
        data-dt-tip={tip}
        aria-describedby={def.description ? descId : undefined}
        onKeyDown={onKeyDown}
      >
        <span className="dt-head-text">{def.header}</span>
        {unit && <span className="dt-head-unit">{unit}</span>}
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
