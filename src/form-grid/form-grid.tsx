// FormGrid (R34, docs/form-grid.md): formun içindeki satırları Excel gibi düzenleyen ızgara. Veri uygulamanın;
// seçim, düzenleme ve geri al hücre motorunda (core/sheet). Izgara kendi içinde dikey kaymaz, sayfayla kayar;
// başlık ve alt çubuk yapışkan, yatay kaydırma kendi çizdiğimiz çubukla (§4).
import { WarningCircleIcon } from '@phosphor-icons/react'
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
import { decimalPlaces, isEmptyValue } from '../core/cells/format'
import { RemoteLabels } from '../core/cells/remote-labels'
import { cellFillStyle, renderCellContent, type RenderEnv } from '../core/cells/render-cell'
import { alignOf, isNumericType } from '../core/cells/specs'
import { useColumnLayout, type LayoutColumn } from '../core/columns/use-column-layout'
import { getFormat, type Format } from '../core/format'
import { HeaderCell } from '../core/grid/header-cell'
import { pinClasses, pinStyle } from '../core/grid/pin'
import { RowMenu } from '../core/grid/row-menu'
import { withFill } from '../core/grid/row'
import { DelegatedTooltip } from '../core/grid/tooltip'
import type { I18n } from '../core/i18n'
import { mac } from '../core/interaction/kbd'
import { useDataTableContext } from '../core/provider'
import { CellEditor } from '../core/sheet/cell-editor'
import { ScrollBar, useHorizontalScroll } from '../core/sheet/h-scroll'
import { mapErrors } from '../core/sheet/errors'
import { collectIssues, nextError } from '../core/sheet/issues'
import { applyIntent, keyIntent } from '../core/sheet/keyboard'
import { CELL, createSheetStore, type SheetStore } from '../core/sheet/store'
import { summarize } from '../core/sheet/summary'
import { scrollParent, usePageRows } from '../core/sheet/use-page-rows'
import type { Issue } from '../core/sheet/validate'

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
  issue,
  onPicked,
}: {
  store: SheetStore<Row>
  col: LayoutColumn<Row>
  index: number
  colIndex: number
  row: Row | undefined
  env: RenderEnv
  issue: Issue | undefined
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
    issue && `is-${issue.level}`,
    // İlk satırın balonu yapışkan başlığın altında kalmasın.
    issue && index === 0 && 'is-tip-below',
    ...pinClasses(col),
  ]
  const tipId = issue ? `dt-fg-tip-${store.rowId(index)}-${colIndex}` : undefined
  const style: CSSProperties = { ...pinStyle(col), ...(row ? cellFillStyle(def, value) : undefined) }
  const edit = state & CELL.editing ? store.editing() : null
  return (
    <div
      className={cls.filter(Boolean).join(' ')}
      style={style}
      role="gridcell"
      aria-selected={state & (CELL.selected | CELL.active) ? true : undefined}
      aria-readonly={editable ? undefined : true}
      aria-required={row && typeof def.required === 'function' && def.required(row) ? true : undefined}
      aria-invalid={issue?.level === 'error' ? true : undefined}
      aria-describedby={tipId}
      tabIndex={state & CELL.active ? 0 : -1}
      data-row={index}
      data-col={colIndex}
    >
      {edit ? (
        <CellEditor
          def={def}
          row={row}
          rows={store.rows()}
          labels={env.labels}
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
        row && <span className="dt-cell-content">{content(def, row, value, env)}</span>
      )}
      {issue && (
        <span id={tipId} className={`dt-cell-tip is-${issue.level}`} role="tooltip">
          {issue.message}
          {issue.suggest && editable && (
            <button
              type="button"
              className="dt-cell-tip-btn"
              tabIndex={-1}
              onClick={() => store.set({ row: index, col: colIndex }, issue.suggest!.value)}
            >
              {env.i18n.t('sheet.useOption', { option: issue.suggest.label })}
            </button>
          )}
        </span>
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
  errors,
  newRow,
  maxRows,
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
  const defs = shown.map((c) => c.def as ColumnDef<Row>)
  const [labels] = useState(() => new RemoteLabels())
  store.sync({
    rows,
    columns: defs,
    onRowsChange,
    getRowId,
    newRow,
    maxRows,
    optionOf: (def, value) => {
      if (isEmptyValue(value)) return undefined
      if (def.type === 'select') return def.options.find((o) => String(o.value) === String(value))
      if (def.type === 'ajax') return labels.option(def.id, def.remote, value as string | number)
    },
  })
  // Her çizimde veriden: 1000 × 30'da tek geçiş, hücre başına tip denetimi (form-grid.md §5–6).
  const issues = collectIssues({
    rows,
    columns: defs,
    errors: mapErrors(
      errors ?? {},
      defs.map((d) => d.id),
    ),
    read: store.read,
    isNew: store.isNew,
    i18n: ctx.i18n,
  })

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

  // F8 / ⇧F8 ve alt çubuktaki "hata — git": sıradaki hatalı hücre aktif olur, odak onu izler (kaydırarak).
  const goToError = (dir: 1 | -1) => {
    const to = nextError(issues.order, store.active(), dir)
    if (!to) return
    store.focus(to)
    focusActive()
  }

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
    // Açık liste / takvim Enter'ı önce kendisi kullanır; Tab her zaman onaylar. Hücre listesinde (combobox) Esc
    // düzenlemeyi iptal eder (form-grid.md §8); takvim kullanıcının açtığı katmandır, Esc önce onu kapatır.
    const target = e.target as HTMLElement
    const list = e.key === 'Escape' && target.getAttribute('role') === 'combobox'
    const widget = e.defaultPrevented || (!list && target.getAttribute('aria-expanded') === 'true')
    if (ed && widget && e.key !== 'Tab') return
    // Portaldaki içerik React ağacında ızgaranın altında: takvimin tuşları ızgaraya ait değil, uzun metin kutusununki ait.
    if (!root.current?.contains(target) && !target.closest('.dt-text-pop')) return
    const def = ed ? (shown[ed.pos.col]?.def as ColumnDef<Row> | undefined) : undefined
    const intent = keyIntent(e, { editing: !!ed, multiline: def?.type === 'text', mac })
    if (!intent) return
    if (intent.type === 'error') {
      e.preventDefault()
      goToError(intent.dir)
      return
    }
    const pageSize = Math.max(1, Math.floor((window.innerHeight - metrics.head - metrics.foot) / (metrics.row + 1)) - 1)
    if (applyIntent(store, intent, { pageSize })) e.preventDefault()
  }

  const rowEl = (index: number, start: number) => {
    const row = store.rows()[index]
    const blank = !row
    const rowIssues = issues.cells.get(index)
    const rowError = issues.rows.get(index)?.join('\n')
    let hasError = !!rowError
    for (const i of rowIssues?.values() ?? []) if (i.level === 'error') hasError = true
    return (
      <div
        key={blank ? '__blank' : (store.rowId(index) ?? index)}
        className={blank ? 'dt-row is-blank' : 'dt-row'}
        role="row"
        aria-rowindex={index + 2}
        style={{ transform: `translateY(${start}px)` }}
      >
        <div className="dt-cell dt-gutter is-pinned-start" style={{ left: 0 }} role="rowheader" data-dt-tip={rowError}>
          {hasError && (
            <WarningCircleIcon
              size={13}
              weight="fill"
              className="dt-mark is-error"
              role="img"
              aria-label={ctx.i18n.t('sheet.hasErrors')}
            />
          )}
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
            issue={rowIssues?.get(col.id)}
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
          {issues.errorRows > 0 && (
            <button type="button" className="dt-status-errors" onClick={() => goToError(1)}>
              <span className="dt-mark is-error" aria-hidden="true" />
              {ctx.i18n.t('sheet.errorsGoTo', { count: issues.errorRows })}
            </button>
          )}
          <SelectionSummary store={store} columns={defs} fmt={env.fmt} i18n={ctx.i18n} />
        </div>
      </div>
      <DelegatedTooltip root={root} />
    </div>
  )
}

/** Boş hücrede `placeholder` soluk yazılır; değer değildir (form-grid.md §3.2). */
function content<Row extends object>(def: ColumnDef<Row>, row: Row, value: unknown, env: RenderEnv) {
  const hint = isEmptyValue(value) ? def.placeholder?.(row) : null
  return hint ? <span className="dt-cell-placeholder">{hint}</span> : renderCellContent(def, row, value, env)
}

/**
 * Alt çubuğun seçim özeti (form-grid.md §4): iki ve daha çok hücre seçiliyken. Seçimi kendisi dinler; ok tuşunda
 * ızgara yeniden çizilmez. Değerler veriden, sayılar seçimdeki sütunların en çok hanesiyle biçimlenir.
 */
function SelectionSummary<Row extends object>({
  store,
  columns,
  fmt,
  i18n,
}: {
  store: SheetStore<Row>
  columns: ReadonlyArray<ColumnDef<Row>>
  fmt: Format
  i18n: I18n
}) {
  const key = useSyncExternalStore(store.subscribe, () => {
    const r = store.range()
    return r && (r.bottom > r.top || r.right > r.left) ? `${r.top}:${r.bottom}:${r.left}:${r.right}` : ''
  })
  if (!key) return null
  const [top, bottom, left, right] = key.split(':').map(Number) as [number, number, number, number]
  const cells: Array<readonly [unknown, boolean]> = []
  let dp = 0
  for (let c = left; c <= right; c++) {
    const def = columns[c]
    if (!def) continue
    const numeric = isNumericType(def.type)
    if (numeric) dp = Math.max(dp, decimalPlaces(def as ColumnDef))
    for (let r = top; r <= Math.min(bottom, store.rows().length - 1); r++) cells.push([store.read(r, def), numeric])
  }
  const s = summarize(cells)
  const num = (v: string) => fmt.decimal(v, dp)
  return (
    <span className="dt-status-summary" aria-label={i18n.t('sheet.selectionSummary')}>
      <span>
        {i18n.t('sheet.agg.count')}
        <b>{fmt.int(s.count)}</b>
      </span>
      {s.numbers && (
        <>
          <span>
            {i18n.t('sheet.agg.sum')}
            <b>{num(s.numbers.sum)}</b>
          </span>
          <span>
            {i18n.t('sheet.agg.avg')}
            <b>{fmt.decimal(s.numbers.average, Math.max(dp, 2))}</b>
          </span>
          <span>
            {i18n.t('sheet.agg.min')}
            <b>{num(s.numbers.min)}</b>
          </span>
          <span>
            {i18n.t('sheet.agg.max')}
            <b>{num(s.numbers.max)}</b>
          </span>
        </>
      )}
    </span>
  )
}
