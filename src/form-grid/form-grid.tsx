// FormGrid (R34, docs/form-grid.md): formun içindeki satırları Excel gibi düzenleyen ızgara. Veri uygulamanın;
// seçim, düzenleme ve geri al hücre motorunda (core/sheet). Izgara kendi içinde dikey kaymaz, sayfayla kayar;
// başlık ve alt çubuk yapışkan, yatay kaydırma kendi çizdiğimiz çubukla (§4).
import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import type { ColumnDef } from '../types/columns'
import type { FormGridProps } from '../types/form-grid'
import { RemoteLabels } from '../core/cells/remote-labels'
import { cellFillStyle, renderCellContent, type RenderEnv } from '../core/cells/render-cell'
import { alignOf, isNumericType } from '../core/cells/specs'
import { useColumnLayout, type LayoutColumn } from '../core/columns/use-column-layout'
import { getFormat } from '../core/format'
import { HeaderCell } from '../core/grid/header-cell'
import { pinClasses, pinStyle } from '../core/grid/pin'
import { RowMenu } from '../core/grid/row-menu'
import { withFill } from '../core/grid/row'
import { mac } from '../core/interaction/kbd'
import { useDataTableContext } from '../core/provider'
import { CellEditor } from '../core/sheet/cell-editor'
import { ScrollBar, useHorizontalScroll } from '../core/sheet/h-scroll'
import { applyIntent, keyIntent } from '../core/sheet/keyboard'
import { CELL, createSheetStore, type SheetStore } from '../core/sheet/store'
import { scrollParent, usePageRows } from '../core/sheet/use-page-rows'

// Satır no sütunu (handoff 06 §5): 56 px; ⋯ sütunu dolgu 8 + düğme + 8.
const GUTTER_W = 56
const FALLBACK_ROW_H = 36
const FALLBACK_HEAD_H = 36
const FALLBACK_FOOT_H = 48

function GridCell<Row extends object>({
  store,
  col,
  index,
  colIndex,
  row,
  env,
  onPicked,
}: {
  store: SheetStore<Row>
  col: LayoutColumn<Row>
  index: number
  colIndex: number
  row: Row | undefined
  env: RenderEnv
  /** Listeden / takvimden seçim onaylandı: odak portaldaydı, aktif hücreye döner. */
  onPicked: () => void
}) {
  // Hücre yalnız kendi bayrağını dinler (§5): ok tuşunda yalnız iki hücre yeniden çizilir.
  const state = useSyncExternalStore(store.subscribe, () => store.cellState(index, colIndex))
  const def = col.def
  const value = row ? (def.accessor ? def.accessor(row) : store.read(index, def)) : null
  const editable = store.canEdit(index, colIndex)
  const cls = [
    'dt-cell',
    `is-${alignOf(def)}`,
    isNumericType(def.type) && 'is-numeric',
    !editable && 'is-readonly',
    state & CELL.active && 'is-active',
    state & CELL.editing && 'is-editing',
    state & CELL.selected && 'is-selected',
    state & CELL.top && 'is-edge-t',
    state & CELL.bottom && 'is-edge-b',
    state & CELL.left && 'is-edge-l',
    state & CELL.right && 'is-edge-r',
    ...pinClasses(col),
  ]
  const style: CSSProperties = { ...pinStyle(col), ...(row ? cellFillStyle(def, value) : undefined) }
  const edit = state & CELL.editing ? store.editing() : null
  return (
    <div
      className={cls.filter(Boolean).join(' ')}
      style={style}
      role="gridcell"
      aria-selected={state & (CELL.selected | CELL.active) ? true : undefined}
      aria-readonly={editable ? undefined : true}
      tabIndex={state & CELL.active ? 0 : -1}
      data-row={index}
      data-col={colIndex}
    >
      {edit ? (
        <CellEditor
          def={def}
          row={row}
          text={edit.text}
          value={edit.draft}
          onDraft={(v, text) => store.setDraft(v, text)}
          onPick={(v, down) => {
            store.setDraft(v)
            store.commit()
            if (down) store.move('down')
            onPicked()
          }}
        />
      ) : (
        row && <span className="dt-cell-content">{renderCellContent(def, row, value, env)}</span>
      )}
    </div>
  )
}

export function FormGrid<Row extends object>({
  rows,
  onRowsChange,
  columns,
  label,
  getRowId,
  rowActions = [],
  density = 'compact',
}: FormGridProps<Row>) {
  const ctx = useDataTableContext()
  const root = useRef<HTMLDivElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [store] = useState(() => createSheetStore({ rows, columns, onRowsChange, getRowId }))
  // Birinci sütun ve satır no solda sabit (§4); kullanıcı sütun düzenini değiştirmez.
  const layout = useColumnLayout({
    columns,
    layout: { pinned: { left: columns[0] ? [columns[0].id as string] : [], right: [] } },
  })
  const shown = layout.columns
  store.sync({ rows, columns: shown.map((c) => c.def as ColumnDef<Row>), onRowsChange, getRowId })

  const [labels] = useState(() => new RemoteLabels())
  const labelsVersion = useSyncExternalStore(labels.subscribe, labels.getVersion)
  const env: RenderEnv & { labelsVersion: number } = {
    fmt: getFormat(ctx.locale),
    i18n: ctx.i18n,
    today: new Date(),
    labels,
    density,
    coarse: false,
    labelsVersion,
  }

  const [metrics, setMetrics] = useState({ row: FALLBACK_ROW_H, head: FALLBACK_HEAD_H, foot: FALLBACK_FOOT_H })
  const menuW = rowActions.length ? 'calc(16px + var(--dt-control-h-sm))' : '0px'
  const startW = () => GUTTER_W + layout.start.reduce((w, c) => w + layout.widthOf(c.id), 0)
  const hs = useHorizontalScroll([body, head], () => ({
    start: startW(),
    end: root.current?.querySelector<HTMLElement>('.dt-head .dt-cell-menu')?.offsetWidth ?? 0,
  }))

  const count = store.rowCount()
  const virtual = usePageRows({
    count,
    bodyRef: body,
    itemHeight: metrics.row + 1,
    headHeight: metrics.head,
    footHeight: metrics.foot,
    keepIndex: () => store.active()?.row ?? -1,
  })

  // Genişlikler ve sabit ofsetler React dışında (use-column-layout · subscribeSizing), liste ızgarasıyla aynı.
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const write = () => {
      el.style.setProperty('--cols', [`${GUTTER_W}px`, layout.cols(), menuW].join(' '))
      el.style.setProperty('--dt-min-w', `calc(${layout.minWidth() + GUTTER_W}px + ${menuW})`)
      for (const [name, value] of Object.entries(layout.offsets()))
        el.style.setProperty(
          name,
          layout.start.some((c) => c.offsetVar === name) ? `${parseFloat(value) + GUTTER_W}px` : value,
        )
    }
    write()
    return layout.subscribeSizing(write)
  }, [layout, menuW])

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const css = getComputedStyle(el)
    const row = parseFloat(css.getPropertyValue('--dt-row-h'))
    const next = {
      row: Number.isFinite(row) ? row : FALLBACK_ROW_H,
      head: head.current?.offsetHeight || FALLBACK_HEAD_H,
      foot: el.querySelector<HTMLElement>('.dt-fg-foot')?.offsetHeight || FALLBACK_FOOT_H,
    }
    setMetrics((p) => (p.row === next.row && p.head === next.head && p.foot === next.foot ? p : next))
  }, [density])

  // Yapışan başlık ve alt çubuk tablonun ucunda değilken köşeleri düzdür: yuvarlak köşenin dışından altından geçen
  // satırlar görünmesin. Kaydırmada React çizilmez, yalnız kökün iki özniteliği yazılır.
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const parent = scrollParent(el)
    const update = () => {
      const r = el.getBoundingClientRect()
      const h = head.current?.getBoundingClientRect()
      const f = el.querySelector<HTMLElement>('.dt-fg-foot')?.getBoundingClientRect()
      el.toggleAttribute('data-head-stuck', !!h && h.top > r.top + 1)
      el.toggleAttribute('data-foot-stuck', !!f && f.bottom < r.bottom - 1)
    }
    update()
    parent.addEventListener('scroll', update, { passive: true })
    addEventListener('resize', update)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    ro?.observe(el)
    return () => {
      parent.removeEventListener('scroll', update)
      removeEventListener('resize', update)
      ro?.disconnect()
    }
  }, [])

  // Aktif hücre değişince odak ona taşınır (odak ızgaradaysa). Çizilmemiş satıra gidince önce oraya kaydırılır; kayarken
  // eski odaklı hücre DOM'dan çıkar ve odak body'ye düşer, bu yüzden "odak ızgaradaydı" bilgisi kaydırmadan önce alınır.
  useLayoutEffect(() => {
    let pending = false
    const follow = (owned = false) => {
      const a = store.active()
      const el = root.current
      // Uzun metin kutusu portalda: odak oradayken de ızgaradadır.
      const inside = el?.contains(document.activeElement) || document.activeElement?.closest('.dt-text-pop')
      if (!a || !el || store.editing() || !(owned || inside)) return
      const cell = el.querySelector<HTMLElement>(`.dt-cell[data-row="${a.row}"][data-col="${a.col}"]`)
      if (cell) {
        if (document.activeElement !== cell) cell.focus()
      } else if (!pending) {
        pending = true
        virtual.scrollTo(a.row)
        requestAnimationFrame(() => {
          pending = false
          follow(true)
        })
      }
    }
    return store.subscribe(() => follow())
  }, [store, virtual])

  // Izgara dışına tık onaylar (blur ile onay yok, Vue 07 §5); portallı liste ve takvim (`dt-sheet-layer`) dışarı sayılmaz.
  // Odak önce bırakılır: yoksa onaydan sonra odak hücreye döner ve tıklanan alan odağı alamaz.
  useLayoutEffect(() => {
    const onDown = (e: globalThis.PointerEvent) => {
      const t = e.target as Element | null
      if (!store.editing() || root.current?.contains(t) || t?.closest('.dt-sheet-layer')) return
      ;(document.activeElement as HTMLElement | null)?.blur()
      store.commit()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [store])

  const focusActive = () =>
    requestAnimationFrame(() => {
      const a = store.active()
      if (a) root.current?.querySelector<HTMLElement>(`.dt-cell[data-row="${a.row}"][data-col="${a.col}"]`)?.focus()
    })

  const posOf = (target: EventTarget | null) => {
    const cell = (target as HTMLElement | null)?.closest<HTMLElement>('.dt-cell[data-row][data-col]')
    return cell ? { row: Number(cell.dataset.row), col: Number(cell.dataset.col) } : null
  }
  const dragging = useRef(false)
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    // Editörün kendi içine tık düzenlemeyi kapatmaz.
    if ((e.target as HTMLElement).closest('.is-editing')) return
    const pos = posOf(e.target)
    if (!pos) return
    store.focus(pos, e.shiftKey)
    dragging.current = true
  }
  const onPointerOver = (e: PointerEvent) => {
    if (!dragging.current || !(e.buttons & 1)) {
      dragging.current = false
      return
    }
    const pos = posOf(e.target)
    if (pos) store.focus(pos, true)
  }
  // Uzun metindeki ⤢ düzenlenebilir hücrede kutuyu açar; kilitli hücrede balonu kalır.
  const onClick = (e: MouseEvent) => {
    const pos = (e.target as HTMLElement).closest('.dt-text-expand') && posOf(e.target)
    if (!pos || store.editing()) return
    store.focus(pos)
    store.startEdit()
  }
  // Çift tık düzenler; boolean'da çevirir (düzenleme modu yok).
  const onDoubleClick = (e: MouseEvent) => {
    const pos = posOf(e.target)
    if (!pos || store.editing()) return
    store.focus(pos)
    if (!store.startEdit()) store.toggle()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    // Yalnız hücrenin kendisinde: ⋯ düğmesi ve başlık kendi tuşlarını kullanır.
    if (!posOf(e.target) && !store.editing()) return
    const ed = store.editing()
    // Açık liste / takvim Enter ve Esc'i önce kendisi kullanır; ikinci Esc düzenlemeyi iptal eder (Vue 07 §5). Tab her
    // zaman onaylar.
    const target = e.target as HTMLElement
    const widget = e.defaultPrevented || target.getAttribute('aria-expanded') === 'true'
    if (ed && widget && e.key !== 'Tab') return
    // Portaldaki içerik React ağacında ızgaranın altında: takvimin tuşları ızgaraya ait değil, uzun metin kutusununki ait.
    if (!root.current?.contains(target) && !target.closest('.dt-text-pop')) return
    const def = ed ? (shown[ed.pos.col]?.def as ColumnDef<Row> | undefined) : undefined
    const intent = keyIntent(e, { editing: !!ed, multiline: def?.type === 'text', mac })
    if (!intent) return
    const pageSize = Math.max(1, Math.floor((window.innerHeight - metrics.head - metrics.foot) / (metrics.row + 1)) - 1)
    if (applyIntent(store, intent, { pageSize })) e.preventDefault()
  }

  const rowEl = (index: number, start: number) => {
    const row = store.rows()[index]
    const blank = !row
    return (
      <div
        key={blank ? '__blank' : (store.rowId(index) ?? index)}
        className={blank ? 'dt-row is-blank' : 'dt-row'}
        role="row"
        aria-rowindex={index + 2}
        style={{ transform: `translateY(${start}px)` }}
      >
        <div className="dt-cell dt-gutter is-pinned-start" style={{ left: 0 }} role="rowheader">
          {!blank && <span className="dt-gutter-no">{index + 1}</span>}
        </div>
        {withFill(shown, (col, c) => (
          <GridCell
            key={col.id}
            store={store}
            col={col}
            index={index}
            colIndex={c}
            row={row}
            env={env}
            onPicked={focusActive}
          />
        ))}
        {rowActions.length > 0 && (
          <div className="dt-cell dt-cell-menu is-pinned-end is-pin-edge" style={{ right: 0 }} role="gridcell">
            {row && <RowMenu row={row} label={String(index + 1)} actions={rowActions} reserve onOpen={() => {}} />}
          </div>
        )}
      </div>
    )
  }

  const cls = [
    'dt dt-grid dt-sheet-grid dt-form-grid',
    hs.scrolled.start && 'is-scrolled-start',
    hs.scrolled.end && 'is-scrolled-end',
  ]
  return (
    <div
      ref={root}
      className={cls.filter(Boolean).join(' ')}
      role="grid"
      aria-label={label}
      aria-rowcount={count + 1}
      aria-colcount={shown.length + 1 + (rowActions.length ? 1 : 0)}
      data-density={density}
      onPointerDown={onPointerDown}
      onPointerOver={onPointerOver}
      onKeyDown={onKeyDown}
      onDoubleClick={onDoubleClick}
      onClick={onClick}
    >
      <div ref={head} className="dt-fg-head">
        <div className="dt-head" role="row" aria-rowindex={1}>
          <div className="dt-head-cell dt-gutter is-pinned-start" style={{ left: 0 }} role="columnheader">
            #
          </div>
          {withFill(shown, (col) => (
            <HeaderCell key={col.id} column={col} layout={layout} onMoved={() => {}} menu={false} />
          ))}
          {rowActions.length > 0 && (
            <div
              className="dt-head-cell dt-cell-menu is-pinned-end is-pin-edge"
              style={{ right: 0 }}
              role="columnheader"
            />
          )}
        </div>
      </div>
      <div ref={body} className="dt-fg-body">
        <div className="dt-body" role="rowgroup" style={{ height: virtual.total }}>
          {virtual.items.map((item) => rowEl(item.index, item.start))}
        </div>
      </div>
      <div className="dt-fg-foot">
        <ScrollBar metrics={hs.metrics} onScroll={hs.scrollTo} />
        <div className="dt-status" role="status" aria-label={ctx.i18n.t('sheet.statusAria')}>
          <span className="dt-status-rows">{ctx.i18n.t('sheet.rows', { count: rows.length })}</span>
        </div>
      </div>
    </div>
  )
}
