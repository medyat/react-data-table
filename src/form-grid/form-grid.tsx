// FormGrid (R34, docs/form-grid.md): formun içindeki satırları Excel gibi düzenleyen ızgara. Veri uygulamanın;
// seçim, düzenleme ve geri al hücre motorunda (core/sheet). Izgara kendi içinde dikey kaymaz, sayfayla kayar;
// başlık ve alt çubuk yapışkan, yatay kaydırma kendi çizdiğimiz çubukla (§4).
import {
  CaretRightIcon,
  CopySimpleIcon,
  PasswordIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import {
  useDeferredValue,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ClipboardEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import type { CellAction, CellActionContext, ColumnDef, OptionDef } from '../types/columns'
import { generatePassword } from '../core/cells/password'
import type { RowAction } from '../types/list'
import type { FormGridProps } from '../types/form-grid'
import { decimalPlaces, isEmptyValue, minDecimalPlaces } from '../core/cells/format'
import { RemoteLabels } from '../core/cells/remote-labels'
import { CellActionMenu, CellActions } from '../core/cells/cell-actions'
import { cellFillStyle, renderCellContent, type RenderEnv } from '../core/cells/render-cell'
import { alignOf, isNumericType } from '../core/cells/specs'
import { useColumnLayout, type LayoutColumn } from '../core/columns/use-column-layout'
import { getFormat, type Format } from '../core/format'
import { HeaderCell } from '../core/grid/header-cell'
import { pinClasses, pinStyle } from '../core/grid/pin'
import { RowMenu } from '../core/grid/row-menu'
import { HeaderGroups, headStyle } from '../core/grid/header-groups'
import { actionsClasses, actionsStyle, withFill } from '../core/grid/row'
import { DelegatedTooltip } from '../core/grid/tooltip'
import type { I18n } from '../core/i18n'
import { mac, PASTE_KBD, REMOVE_KBD, ROW_EDIT_KBD } from '../core/interaction/kbd'
import { useDataTableContext } from '../core/provider'
import { CellEditor, useParseEnv } from '../core/sheet/cell-editor'
import { matrixFromClipboard, parseTsv, toHtml, toTsv } from '../core/sheet/clipboard'
import { GridContextMenu } from './grid-menu'
import { RowDialog } from './row-dialog'
import { plainText } from '../core/export/cells'
import { fold, parseInput } from '../core/sheet/parse'
import { startDragScroll } from '../core/sheet/drag-scroll'
import { ScrollBar, useHorizontalScroll } from '../core/sheet/h-scroll'
import { mapErrors } from '../core/sheet/errors'
import { collectIssues, nextError, type GridIssues } from '../core/sheet/issues'
import { CellTip } from './cell-tip'
import { applyIntent, keyIntent } from '../core/sheet/keyboard'
import { CELL, createSheetStore, type CellPos, type SheetStore } from '../core/sheet/store'
import { summarize } from '../core/sheet/summary'
import { scrollParent, usePageRows } from '../core/sheet/use-page-rows'
import type { Issue } from '../core/sheet/validate'

// Satır no sütunu (handoff 06 §5): 56 px; ⋯ sütunu dolgu 8 + düğme + 8.
const GUTTER_W = 56
const FALLBACK_ROW_H = 42
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
  found,
  onPicked,
  onWindow,
  showing,
  mark,
  onFillStart,
}: {
  onFillStart: (e: PointerEvent) => void
  /** DataSheet'in hücre işareti (`is-changed`, `is-new`). */
  mark?: string
  /** Gösterim (R41): hücreler kilitli görünmez, hepsi okunur. */
  showing: boolean
  store: SheetStore<Row>
  col: LayoutColumn<Row>
  index: number
  colIndex: number
  row: Row | undefined
  env: RenderEnv
  issue: Issue | undefined
  /** ⌘F eşleşmesi. */
  found: boolean
  /** Listeden / takvimden seçim onaylandı: odak portaldaydı, aktif hücreye döner. */
  onPicked: () => void
  /** Pencere sütununun kalemi. */
  onWindow: (pos: CellPos) => void
}) {
  // Hücre yalnız kendi bayrağını dinler (§5): ok tuşunda yalnız iki hücre yeniden çizilir.
  const state = useSyncExternalStore(store.subscribe, () => store.cellState(index, colIndex))
  const def = col.def
  const value = row ? (def.accessor ? def.accessor(row) : store.read(index, def)) : null
  const editable = store.canEdit(index, colIndex, row)
  const cls = [
    'dt-cell',
    `is-${alignOf(def)}`,
    isNumericType(def.type) && 'is-numeric',
    !editable && !showing && 'is-readonly',
    state & CELL.active && 'is-active',
    state & CELL.editing && 'is-editing',
    state & CELL.selected && 'is-selected',
    state & CELL.top && 'is-edge-t',
    state & CELL.bottom && 'is-edge-b',
    state & CELL.left && 'is-edge-l',
    state & CELL.right && 'is-edge-r',
    state & CELL.handle && 'has-handle',
    state & CELL.fill && 'is-fill',
    issue && `is-${issue.level}`,
    found && 'is-found',
    mark,
    // Tarih editörünün açıklaması ilk satırda alta açılır (hata balonu kökte, `CellTip`).
    state & CELL.editing && index === 0 && 'is-tip-below',
    ...pinClasses(col),
  ]
  const tipId = issue ? `dt-fg-tip-${store.rowId(index)}-${colIndex}` : undefined
  const style: CSSProperties = { ...pinStyle(col), ...(row ? cellFillStyle(def, value) : undefined) }
  const edit = state & CELL.editing ? store.editing() : null
  // Düğme yoksa yer de yok: düzenlerken (editör hücrenin tamamını alır) ve boş satırda.
  if (row && !edit) {
    Object.assign(style, actionsStyle(def))
    cls.push(...actionsClasses(def))
  }
  // Pencere türünde kalem paketindir (§7), uygulamanın aksiyonlarından önce.
  const actions: Array<CellAction<Row>> =
    def.editor?.window && editable
      ? [
          {
            id: 'window',
            label: env.i18n.t('sheet.edit'),
            icon: PencilSimpleIcon,
            run: () => onWindow({ row: index, col: colIndex }),
          },
          ...(def.actions ?? []),
        ]
      : (def.actions ?? [])
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
          onCreated={(v) => store.set({ row: index, col: colIndex }, v)}
        />
      ) : (
        <span className="dt-cell-content">
          {row ? (
            content(def, row, value, env)
          ) : (
            // Boş satıra yazınca satır doğar (form-grid.md §5).
            <span className="dt-cell-placeholder">{env.i18n.t('sheet.newRow')}</span>
          )}
        </span>
      )}
      {row && !edit && actions.length ? (
        <CellActions actions={actions} row={row} setValue={(v) => store.set({ row: index, col: colIndex }, v)} />
      ) : null}
      {state & CELL.handle ? <span className="dt-fill-handle" aria-hidden onPointerDown={onFillStart} /> : null}
      {issue && (
        // Ekran okuyucu için; görünen balon kökte (`CellTip`).
        <span id={tipId} className="dt-sr-only">
          {issue.message}
        </span>
      )}
    </div>
  )
}

/** DataSheet'in ızgarayı genişlettiği yerler (paket içi; FormGrid'in public API'sine girmez, data-sheet.md). */
export interface SheetGridExtras<Row extends object> {
  /** Uygulamanın kurduğu depo (DataSheet geçmişi ve odağı kendisi yönetir). */
  store?: SheetStore<Row>
  isNew?: (row: Row) => boolean
  /** Dışarıda hesaplanmış sorunlar: verilirse ızgara kendisi hesaplamaz (`errors` yok sayılır). */
  issues?: GridIssues
  cellMark?: (index: number, column: string) => string | undefined
  /** Kalıcı satır no (görünüm daraltılınca değişmez). */
  rowNo?: (index: number) => number
  rowMark?: (index: number) => 'changed' | 'new' | undefined
  /** Silme eyleminin adı; verilirse yıkıcı değildir ("Listeden çıkar", D12). */
  removeLabel?: (count: number) => string
  /** Uzak seçenek etiketleri (DataSheet içe aktarması eşleşen seçenekleri buraya yazar). */
  labels?: RemoteLabels
}

export function FormGrid<Row extends object>(props: FormGridProps<Row>) {
  return <SheetGrid {...props} />
}

export function SheetGrid<Row extends object>({
  rows,
  onRowsChange,
  columns: appColumns,
  label,
  getRowId,
  errors,
  newRow,
  maxRows,
  rowActions = [],
  search = true,
  rowDialog: dialog = true,
  density = 'standard',
  frame = true,
  readOnly = false,
  onRowOpen,
  rowHeight,
  store: external,
  labels: externalLabels,
  isNew,
  issues: given,
  cellMark,
  rowNo,
  rowMark,
  removeLabel,
}: FormGridProps<Row> & SheetGridExtras<Row>) {
  const ctx = useDataTableContext()
  // Paketin kendi hücre aksiyonları uygulamanınkilerden önce gelir.
  const columns = appColumns.map((def) =>
    def.type === 'password' && def.generate
      ? {
          ...def,
          actions: [
            {
              id: 'generate-password',
              label: ctx.i18n.t('sheet.generatePassword'),
              icon: PasswordIcon,
              run: (_row: Row, { setValue }: CellActionContext) => setValue?.(generatePassword()),
            },
            ...(def.actions ?? []),
          ],
        }
      : def,
  )
  const root = useRef<HTMLDivElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  // Gösterimde (R41) satır penceresi yok: satır uygulamanın detayında açılır (`onRowOpen`).
  const rowDialog = dialog && !readOnly
  const [store] = useState(
    () => external ?? createSheetStore({ rows, columns, onRowsChange: onRowsChange ?? (() => {}), getRowId, readOnly }),
  )
  // Birinci sütun ve satır no solda sabit (§4); kullanıcı sütun düzenini değiştirmez.
  const layout = useColumnLayout({
    columns,
    layout: { pinned: { left: columns[0] ? [columns[0].id as string] : [], right: [] } },
  })
  const shown = layout.columns
  const defs = shown.map((c) => c.def as ColumnDef<Row>)
  const [ownLabels] = useState(() => new RemoteLabels())
  const labels = externalLabels ?? ownLabels
  store.sync({
    rows,
    columns: defs,
    onRowsChange: onRowsChange ?? (() => {}),
    getRowId,
    newRow,
    maxRows,
    readOnly,
    isNew,
    optionOf: (def, value) => {
      if (isEmptyValue(value)) return undefined
      if (def.type === 'select') return def.options.find((o) => String(o.value) === String(value))
      if (def.type === 'ajax') return labels.option(def.id, def.remote, value as string | number)
    },
  })
  // Her çizimde veriden: 1000 × 30'da tek geçiş, hücre başına tip denetimi (form-grid.md §5–6).
  const issues =
    given ??
    collectIssues({
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

  // Balon üzerine gelinen, yoksa aktif hücrenin; düzenlenen hücrede yok (editör hücreyi kaplar).
  const [hovered, setHovered] = useState<CellPos | null>(null)
  const activeKey = useSyncExternalStore(store.subscribe, () => {
    const a = store.active()
    return a && !store.editing() ? `${a.row}:${a.col}` : ''
  })
  const tipAt =
    hovered ?? (activeKey ? { row: Number(activeKey.split(':')[0]), col: Number(activeKey.split(':')[1]) } : null)
  const tipIssue = tipAt ? issues.cells.get(tipAt.row)?.get(shown[tipAt.col]?.id ?? '') : undefined
  const tipEditing = store.editing()?.pos
  const onCellHover = (target: EventTarget | null) => {
    const p = posOf(target)
    const next = p && issues.cells.get(p.row)?.has(shown[p.col]?.id ?? '') ? p : null
    if (next?.row !== hovered?.row || next?.col !== hovered?.col) setHovered(next)
  }

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
  // ⋯ ve satır penceresinin kalemi (gösterimde aç düğmesi); aralarında 2 px (sheet.css `.dt-form-grid .dt-cell-menu`).
  // Gösterimde düğme yoksa sütun da yok.
  const buttons = readOnly ? Number(!!onRowOpen) + Number(rowActions.length > 0) : rowDialog ? 2 : 1
  const menuW = buttons ? `calc(16px + ${buttons} * var(--dt-control-h-sm) + ${buttons - 1} * 2px)` : null
  const startW = () => GUTTER_W + layout.start.reduce((w, c) => w + layout.widthOf(c.id), 0)
  const menuEnd = () => root.current?.querySelector<HTMLElement>('.dt-head .dt-cell-menu')?.offsetWidth ?? 0
  const hs = useHorizontalScroll([body, head], () => ({ start: startW(), end: menuEnd() }))

  const count = store.rowCount()
  const virtual = usePageRows({
    count,
    bodyRef: body,
    itemHeight: metrics.row + 1,
    headHeight: metrics.head,
    footHeight: metrics.foot,
    keepIndex: () => store.active()?.row ?? -1,
    measure: rowHeight === 'auto',
  })

  // Genişlikler ve sabit ofsetler React dışında (use-column-layout · subscribeSizing), liste ızgarasıyla aynı.
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const write = () => {
      el.style.setProperty('--cols', [`${GUTTER_W}px`, layout.cols(), menuW].filter(Boolean).join(' '))
      el.style.setProperty('--dt-min-w', `calc(${layout.minWidth() + GUTTER_W}px + ${menuW ?? '0px'})`)
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
      // Odaktaki hücrenin satırı silindiyse (⌘⌫, geri al) satır çizimden sonra kalkar ve odak body'ye düşer: bir sonraki
      // karede aktif hücreye döner.
      if (inside)
        requestAnimationFrame(() => {
          const now = store.active()
          if (document.activeElement !== document.body || !now) return
          el.querySelector<HTMLElement>(`.dt-cell[data-row="${now.row}"][data-col="${now.col}"]`)?.focus()
        })
      const cell = el.querySelector<HTMLElement>(`.dt-cell[data-row="${a.row}"][data-col="${a.col}"]`)
      // Arama kutusunda Enter: hücre görünür olur, odak kutuda kalır (sonraki Enter için).
      if (cell && document.activeElement?.closest('.dt-find'))
        cell.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      else if (cell) {
        // focus() hücre pencerede görünüyorsa kaydırmaz, yapışkan alt çubuğun örttüğünü bilmez (yeni satır onun
        // altında kalıyordu); scrollIntoView `scroll-margin`'e uyar.
        if (document.activeElement !== cell) cell.focus({ preventScroll: true })
        cell.scrollIntoView({ block: 'nearest', inline: 'nearest' })
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

  // Dokunmatik ekranda hücre içi düzenleme yok (form-grid.md §4); satır penceresi kapalıysa ızgara masaüstündeki gibi.
  const [touch] = useState(() => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)
  const phone = touch && rowDialog
  // Açık satır penceresi: satır sırası, `rows.length` yeni satır.
  const [rowAt, setRowAt] = useState<number | null>(null)
  // Açık pencere düzenleyici (§7): uygulamanın bileşeni çizildiği sürece açık.
  const [windowAt, setWindowAt] = useState<CellPos | null>(null)
  const openWindow = (pos: CellPos) => {
    if (!shown[pos.col]?.def.editor?.window || !store.rows()[pos.row] || !store.canEdit(pos.row, pos.col)) return false
    store.focus(pos)
    setWindowAt(pos)
    return true
  }
  const Win = windowAt ? shown[windowAt.col]?.def.editor?.window : undefined
  const closeWindow = () => {
    setWindowAt(null)
    focusActive()
  }
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

  // ⌘F (form-grid.md §8.1): görünen metinde arar, satır gizlemez. null: kutu kapalı.
  const [find, setFind] = useState<string | null>(null)
  // 1000×30'da tarama ~70 ms: kutu hemen yazar, eşleşmeler ertelenmiş değerle gelir.
  const deferred = useDeferredValue(find)
  const query = deferred ? fold(deferred, ctx.locale) : ''
  const found: CellPos[] = []
  if (query)
    for (let r = 0; r < rows.length; r++)
      for (let c = 0; c < defs.length; c++)
        if (fold(plainText(defs[c]!, rows[r]!, store.read(r, defs[c]!), env), ctx.locale).includes(query))
          found.push({ row: r, col: c })
  const foundKeys = new Set(found.map((p) => `${p.row}:${p.col}`))
  const goToMatch = (dir: 1 | -1) => {
    const to = nextError(found, store.active(), dir)
    if (to) store.focus(to)
  }
  const closeFind = () => {
    setFind(null)
    focusActive()
  }

  const posOf = (target: EventTarget | null) => {
    const cell = (target as HTMLElement | null)?.closest<HTMLElement>('.dt-cell[data-row][data-col]')
    return cell ? { row: Number(cell.dataset.row), col: Number(cell.dataset.col) } : null
  }
  const dragging = useRef(false)
  const dragInsets = () => ({ top: metrics.head, bottom: metrics.foot, start: startW(), end: menuEnd() })
  // Doldurma tutamacı (Vue 07 §8): aşağı sürüklenir, bırakınca doldurur; hücre seçimi başlamaz.
  const onFillStart = (e: PointerEvent) => {
    if (e.button !== 0 || !body.current) return
    e.stopPropagation()
    e.preventDefault()
    startDragScroll({
      body: body.current,
      insets: dragInsets,
      scrollX: hs.scrollTo,
      extend: (x, y) => {
        const at = posOf(document.elementFromPoint(x, y))
        if (at) store.previewFill(at.row)
      },
      onEnd: () => {
        store.endFill()
        focusActive()
      },
    })
  }
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    // Editörün kendi içine tık düzenlemeyi kapatmaz.
    if ((e.target as HTMLElement).closest('.is-editing')) return
    const pos = posOf(e.target)
    if (!pos) return
    store.focus(pos, e.shiftKey)
    dragging.current = true
    // Dokunmada sürükleme sayfayı kaydırır, seçim yapmaz.
    if (e.pointerType === 'touch' || !body.current) return
    let last = pos
    startDragScroll({
      body: body.current,
      insets: dragInsets,
      scrollX: hs.scrollTo,
      extend: (x, y) => {
        const at = posOf(document.elementFromPoint(x, y))
        if (!at || (at.row === last.row && at.col === last.col) || !dragging.current) return
        last = at
        store.focus(at, true)
      },
    })
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
    // Dokunmatik (pano 3a): hücreye yazılmaz, satıra dokunmak satır penceresini açar; hücrenin düğmeleri kendi işini görür.
    if (phone) {
      const at = !(e.target as HTMLElement).closest('button') && posOf(e.target)
      if (at) setRowAt(at.row)
      return
    }
    // Gösterimde dokunmatik ekranda seçim yerine satır açılır.
    if (touch && readOnly) {
      const at = !(e.target as HTMLElement).closest('button') && posOf(e.target)
      const row = at ? store.rows()[at.row] : undefined
      if (row) onRowOpen?.(row)
      return
    }
    if (store.editing() || e.shiftKey) return
    const pos = posOf(e.target)
    // Tık yalnız seçer, boş seçim hücresinde de (R39): liste çift tık, Enter ya da Space ile açılır.
    if (!pos || !(e.target as HTMLElement).closest('.dt-text-expand')) return
    store.focus(pos)
    store.startEdit()
  }
  // Çift tık düzenler; boolean'da çevirir (düzenleme modu yok).
  const onDoubleClick = (e: MouseEvent) => {
    if (phone) return
    const pos = posOf(e.target)
    if (!pos || store.editing()) return
    if (readOnly) {
      const row = store.rows()[pos.row]
      if (row) onRowOpen?.(row)
      return
    }
    if (openWindow(pos)) return
    store.focus(pos)
    if (!store.startEdit()) store.toggle()
  }
  // Pano (Vue 07 §7): kopyada görünen biçim (geri yapıştırılabilir), yapıştırmada sütunun çözümlemesi. Editör açıkken
  // olay editörün input'unundur.
  const parseEnv = useParseEnv()
  const [notice, setNotice] = useState<string | null>(null)
  // ⌥↵ ile açılan hücre aksiyon menüsü.
  const [actionMenu, setActionMenu] = useState<{ pos: CellPos; anchor: HTMLElement } | null>(null)
  const selection = () => {
    const r = store.range()
    const matrix: string[][] = []
    if (!r || store.editing()) return matrix
    for (let i = r.top; i <= Math.min(r.bottom, rows.length - 1); i++) {
      const line: string[] = []
      for (let c = r.left; c <= r.right; c++) {
        const def = defs[c]!
        const value = store.read(i, def)
        // `ajax` hücresi etiketini değil değerini (kimlik) taşır.
        line.push(
          def.type === 'ajax' ? (isEmptyValue(value) ? '' : String(value)) : plainText(def, rows[i]!, value, env),
        )
      }
      matrix.push(line)
    }
    return matrix
  }
  // Son kopyanın ham değerleri: aynı metin geri yapıştırılınca pencere sütununun nesnesi bütün gelir (§7). `ajax`
  // değeri de aynı sütuna kopyadan gelir: metin onun kimliğidir, `match` kodu arar, kimliği bulamaz.
  const copied = useRef<{ tsv: string; values: unknown[][]; ids: string[] } | null>(null)
  const remember = (matrix: string[][]) => {
    const r = store.range()!
    const tsv = toTsv(matrix)
    copied.current = {
      tsv,
      values: matrix.map((line, i) => line.map((_, j) => store.read(r.top + i, defs[r.left + j]!))),
      ids: defs.slice(r.left, r.right + 1).map((d) => d.id),
    }
    return tsv
  }
  // Pano satır sonlarını değiştirebilir (Windows \r\n, Excel sondaki satır sonu).
  const isOwn = (text: string) => text.replace(/\r\n?/g, '\n').replace(/\n$/, '') === copied.current?.tsv
  const onCopy = (e: ClipboardEvent, cut = false) => {
    const matrix = posOf(e.target) ? selection() : []
    if (!matrix.length) return
    e.preventDefault()
    e.clipboardData?.setData('text/plain', remember(matrix))
    e.clipboardData?.setData('text/html', toHtml(matrix))
    if (cut) store.clear()
  }
  const paste = async (matrix: string[][], own: boolean) => {
    const at = store.range()
    if (!at || !matrix.length) return
    // `ajax` sütununa gelen metinler (kod) uygulamanın `match`'iyle seçeneğe çevrilir; seçenek `onChange`'e de gider.
    const found = new Map<number, Map<string, OptionDef | null>>()
    const width = Math.max(...matrix.map((m) => m.length))
    for (let j = 0; j < width; j++) {
      const def = defs[at.left + j]
      if (def?.type !== 'ajax' || !def.remote.match) continue
      const texts = [...new Set(matrix.map((m) => m[j]?.trim() ?? '').filter(Boolean))]
      const map = new Map<string, OptionDef | null>()
      for (let k = 0; k < texts.length; k += 100) {
        const part = texts.slice(k, k + 100)
        const options = await def.remote.match(part, { signal: new AbortController().signal }).catch(() => [])
        part.forEach((t, n) => map.set(t, options[n] ?? null))
      }
      labels.seed(
        def.id,
        [...map.values()].filter((o): o is OptionDef => !!o),
      )
      found.set(at.left + j, map)
    }
    const { skipped } = store.paste(matrix, (def, text, i, j) => {
      if (def.editor?.window) return own ? copied.current!.values[i]?.[j] : undefined
      if (own && def.type === 'ajax' && copied.current!.ids[j] === def.id) return copied.current!.values[i]?.[j]
      const hit = found.get(defs.indexOf(def))?.get(text.trim())
      if (hit) return hit.value
      return def.type === 'ajax' ? text.trim() || null : parseInput(def as ColumnDef, text, parseEnv)
    })
    setNotice(skipped ? ctx.i18n.t('sheet.pasteSkipped', { count: skipped, max: maxRows ?? 0 }) : null)
    focusActive()
  }
  // Menüden pano: tarayıcı izin isteyebilir; reddedilirse bir şey olmaz (kısayollar izinsiz çalışır).
  const menuCopy = async (cut = false) => {
    const matrix = selection()
    if (!matrix.length) return
    const item = new ClipboardItem({
      'text/plain': new Blob([remember(matrix)], { type: 'text/plain' }),
      'text/html': new Blob([toHtml(matrix)], { type: 'text/html' }),
    })
    if (
      await navigator.clipboard.write([item]).then(
        () => true,
        () => false,
      )
    )
      if (cut) store.clear()
  }
  const menuPaste = async () => {
    const text = await navigator.clipboard.readText().catch(() => null)
    // İzin yoksa (ya da pano boşsa) kısayolu söyler: ⌘V her zaman çalışır.
    if (text) await paste(parseTsv(text), isOwn(text))
    else setNotice(ctx.i18n.t('sheet.pasteDenied', { kbd: PASTE_KBD }))
  }
  // Silme paketin eylemidir (form-grid.md §5): seçili satırlar birlikte; uygulamanın eylemleri üstünde.
  const removeAction: RowAction<Row> = {
    id: 'remove',
    label: '',
    icon: TrashIcon,
    shortcut: REMOVE_KBD,
    destructive: !removeLabel,
    // Menüden silinince odak menüdeydi; ⋯ düğmesi silinen satırla gider, Base UI odağı geri veremez.
    run: () => {
      store.removeRows()
      focusActive()
    },
  }
  const rowActionsFor = (count = removeCount(store, -1)): Array<RowAction<Row>> =>
    readOnly
      ? rowActions
      : [
          ...(rowDialog
            ? [
                {
                  id: 'edit',
                  label: ctx.i18n.t('sheet.menu.editRow'),
                  icon: PencilSimpleIcon,
                  shortcut: ROW_EDIT_KBD,
                  run: () => setRowAt(store.active()?.row ?? 0),
                },
              ]
            : []),
          // Paketin satır eylemleri (pano 1e): düzenle, çoğalt; uygulamanınkiler; en altta sil.
          {
            id: 'duplicate',
            label: ctx.i18n.t('sheet.menu.duplicateRows', { count }),
            icon: CopySimpleIcon,
            disabled: () => maxRows !== undefined && store.rows().length >= maxRows,
            run: () => {
              store.duplicate()
              focusActive()
            },
          },
          ...rowActions,
          { ...removeAction, label: removeLabel?.(count) ?? ctx.i18n.t('sheet.menu.removeRows', { count }) },
        ]
  // ⋯ ya da sağ tık seçimin dışındaysa önce oraya gider: menü tıklanan satır(lar) için.
  const focusFor = (pos: { row: number; col: number }) => {
    const r = store.range()
    if (!r || pos.row < r.top || pos.row > r.bottom || pos.col < r.left || pos.col > r.right) store.focus(pos)
  }
  const onPaste = (e: ClipboardEvent) => {
    if (store.editing() || !posOf(e.target)) return
    e.preventDefault()
    void paste(matrixFromClipboard(e.clipboardData), isOwn(e.clipboardData?.getData('text/plain') ?? ''))
  }

  const onKeyDown = (e: KeyboardEvent) => {
    setNotice(null)
    if (search && (mac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 'f' && posOf(e.target) && !store.editing()) {
      e.preventDefault()
      setFind((f) => f ?? '')
      requestAnimationFrame(() => root.current?.querySelector<HTMLInputElement>('.dt-find input')?.select())
      return
    }
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
    if (readOnly && intent.type === 'rowDialog') {
      const row = store.rows()[store.active()?.row ?? -1]
      if (row && onRowOpen) {
        e.preventDefault()
        onRowOpen(row)
      }
      return
    }
    if (rowDialog && (intent.type === 'rowDialog' || (phone && (intent.type === 'edit' || intent.type === 'type')))) {
      e.preventDefault()
      setRowAt(store.active()?.row ?? 0)
      return
    }
    if (intent.type === 'edit' && store.active() && openWindow(store.active()!)) {
      e.preventDefault()
      return
    }
    if (intent.type === 'menu') {
      const pos = store.active()
      if (!pos) return
      const acts = shown[pos.col]?.def.actions
      const cell = root.current?.querySelector<HTMLElement>(`.dt-cell[data-row="${pos.row}"][data-col="${pos.col}"]`)
      if (!acts?.length || !store.rows()[pos.row] || !cell) return
      e.preventDefault()
      setActionMenu({ pos, anchor: cell })
      return
    }
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
        ref={virtual.measureElement}
        data-index={index}
        className={blank ? 'dt-row is-blank' : 'dt-row'}
        role="row"
        aria-rowindex={index + 2}
        style={{ transform: `translateY(${start}px)` }}
      >
        <div className="dt-cell dt-gutter is-pinned-start" style={{ left: 0 }} role="rowheader" data-dt-tip={rowError}>
          {hasError ? (
            <WarningCircleIcon
              size={13}
              weight="fill"
              className="dt-mark is-error"
              role="img"
              aria-label={ctx.i18n.t('sheet.hasErrors')}
            />
          ) : (
            !blank && <GutterMark mark={rowMark?.(index)} i18n={ctx.i18n} />
          )}
          {!blank && <span className="dt-gutter-no">{rowNo?.(index) ?? index + 1}</span>}
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
            found={foundKeys.has(`${index}:${c}`)}
            onPicked={focusActive}
            onWindow={openWindow}
            showing={readOnly}
            mark={row ? cellMark?.(index, col.id) : undefined}
            onFillStart={onFillStart}
          />
        ))}
        {menuW && (
          <div
            className="dt-cell dt-cell-menu is-pinned-end is-pin-edge"
            style={{ right: 0 }}
            role="gridcell"
            onFocus={() => focusFor({ row: index, col: store.active()?.col ?? 0 })}
          >
            {row && readOnly && onRowOpen && (
              <button
                type="button"
                className="dt-row-more"
                tabIndex={-1}
                aria-label={ctx.i18n.t('row.open')}
                data-dt-tip={`${ctx.i18n.t('row.open')} ${ROW_EDIT_KBD}`}
                onClick={() => onRowOpen(row)}
              >
                <CaretRightIcon size={16} aria-hidden="true" />
              </button>
            )}
            {row && rowDialog && (
              <button
                type="button"
                className="dt-row-more dt-row-edit"
                tabIndex={-1}
                aria-label={ctx.i18n.t('sheet.menu.editRow')}
                data-dt-tip={`${ctx.i18n.t('sheet.menu.editRow')} ${ROW_EDIT_KBD}`}
                onClick={() => setRowAt(index)}
              >
                <PencilSimpleIcon size={16} aria-hidden="true" />
              </button>
            )}
            {row && (!readOnly || rowActions.length > 0) && (
              <SelectionRowMenu store={store} row={row} index={index} actions={rowActionsFor} />
            )}
          </div>
        )}
      </div>
    )
  }

  const cls = [
    'dt dt-grid dt-sheet-grid dt-form-grid',
    hs.scrolled.start && 'is-scrolled-start',
    hs.scrolled.end && 'is-scrolled-end',
    phone && 'is-touch',
    readOnly && 'is-readonly',
    rowHeight === 'auto' && 'is-auto-height',
    !frame && 'is-frameless',
  ]
  return (
    <div
      ref={root}
      style={{ '--dt-fg-head-h': `${metrics.head}px`, '--dt-fg-foot-h': `${metrics.foot}px` } as CSSProperties}
      className={cls.filter(Boolean).join(' ')}
      role="grid"
      aria-label={label}
      aria-rowcount={count + 1}
      aria-colcount={shown.length + (menuW ? 2 : 1)}
      aria-readonly={readOnly || undefined}
      data-density={density}
      onPointerDown={onPointerDown}
      onPointerOver={onPointerOver}
      onKeyDown={onKeyDown}
      onDoubleClick={onDoubleClick}
      onCopy={(e) => onCopy(e)}
      onCut={readOnly ? undefined : (e) => onCopy(e, true)}
      onPaste={readOnly ? undefined : onPaste}
      onClick={onClick}
    >
      {find !== null && (
        <div className="dt-find">
          <div className="dt-find-box">
            <span className="dt-input">
              <input
                value={find}
                aria-label={ctx.i18n.t('sheet.find')}
                placeholder={ctx.i18n.t('sheet.find')}
                onChange={(e) => setFind(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    goToMatch(e.shiftKey ? -1 : 1)
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    e.stopPropagation()
                    closeFind()
                  }
                }}
              />
            </span>
            {query && <FindCount store={store} found={found} i18n={ctx.i18n} />}
          </div>
        </div>
      )}
      <div ref={head} className="dt-fg-head">
        <div className="dt-head" role="row" aria-rowindex={1} style={headStyle(layout)}>
          <div className="dt-head-cell dt-gutter is-pinned-start" style={{ left: 0 }} role="columnheader">
            #
          </div>
          <HeaderGroups layout={layout} lead={1} />
          {withFill(shown, (col) => (
            <HeaderCell key={col.id} column={col} layout={layout} onMoved={() => {}} menu={false} />
          ))}
          {menuW && (
            <div
              className="dt-head-cell dt-cell-menu is-pinned-end is-pin-edge"
              style={{ right: 0 }}
              role="columnheader"
            />
          )}
        </div>
      </div>
      {rowAt !== null && (
        <RowDialog
          store={store}
          defs={defs}
          index={rowAt}
          labels={labels}
          issues={(i) => issues.cells.get(i)}
          onIndex={setRowAt}
          onClose={() => {
            const col = store.active()?.col ?? 0
            store.focus({ row: Math.min(rowAt, store.rows().length), col })
            setRowAt(null)
            focusActive()
          }}
        />
      )}
      {windowAt && Win && store.rows()[windowAt.row] && (
        <Win
          row={store.rows()[windowAt.row]!}
          value={store.read(windowAt.row, shown[windowAt.col]!.def)}
          onApply={(v) => {
            store.set(windowAt, v)
            closeWindow()
          }}
          onCancel={closeWindow}
        />
      )}
      {actionMenu && store.rows()[actionMenu.pos.row] && (
        <CellActionMenu
          actions={shown[actionMenu.pos.col]!.def.actions!}
          row={store.rows()[actionMenu.pos.row]!}
          anchor={actionMenu.anchor}
          setValue={(v) => store.set(actionMenu.pos, v)}
          onClose={() => {
            setActionMenu(null)
            actionMenu.anchor.focus({ preventScroll: true })
          }}
        />
      )}
      <GridContextMenu
        i18n={ctx.i18n}
        commands={{
          copy: () => void menuCopy(),
          // Gösterimde yalnız kopya ve seçim.
          ...(!readOnly && {
            cut: () => void menuCopy(true),
            paste: () => void menuPaste(),
            fill: () => store.fill(),
            clear: () => store.clear(),
          }),
          selectRow: () => store.selectRow(),
          selectColumn: () => store.selectColumn(),
          selectAll: () => store.selectAll(),
          info: () => {
            const r = store.range()
            let cells = 0
            let locked = 0
            if (r)
              for (let i = r.top; i <= r.bottom; i++)
                for (let c = r.left; c <= r.right; c++) {
                  cells++
                  // Gösterimde her hücre okunur: "atlanır" diyecek yazma komutu yok.
                  if (!readOnly && !store.canEdit(i, c)) locked++
                }
            return {
              cells,
              locked,
              single: !!r && r.top === r.bottom,
              row: store.rows()[store.active()?.row ?? -1],
              rowActions: rowActionsFor(),
            }
          },
          onClose: focusActive,
        }}
        trigger={
          <div
            ref={body}
            className="dt-fg-body"
            onMouseOver={(e) => onCellHover(e.target)}
            onMouseLeave={(e) => {
              // Öneri düğmeli balona geçen fare balonu kapatmaz.
              if (!(e.relatedTarget instanceof Element && e.relatedTarget.closest('.dt-cell-tip'))) setHovered(null)
            }}
            onContextMenu={(e) => {
              const pos = posOf(e.target)
              if (pos && !store.editing()) focusFor(pos)
            }}
          >
            <div className="dt-body" role="rowgroup" style={{ height: virtual.total }}>
              {virtual.items.map((item) => rowEl(item.index, item.start))}
            </div>
          </div>
        }
      />
      <div className="dt-fg-foot">
        <ScrollBar metrics={hs.metrics} onScroll={hs.scrollTo} />
        <div className="dt-status" role="status" aria-label={ctx.i18n.t('sheet.statusAria')}>
          {issues.errorRows > 0 && (
            <button
              type="button"
              className="dt-status-errors"
              onClick={() => {
                goToError(1)
                if (phone) setRowAt(store.active()?.row ?? 0)
              }}
            >
              <span className="dt-mark is-error" aria-hidden="true" />
              {ctx.i18n.t('sheet.errorsGoTo', { count: issues.errorRows })}
            </button>
          )}
          {notice && <span className="dt-status-notice">{notice}</span>}
          <SelectionSummary store={store} columns={defs} fmt={env.fmt} i18n={ctx.i18n} />
        </div>
        {phone && (
          <div className="dt-fg-add">
            <button
              type="button"
              className="dt-btn"
              disabled={maxRows !== undefined && rows.length >= maxRows}
              onClick={() => setRowAt(rows.length)}
            >
              <PlusIcon size={16} aria-hidden="true" />
              {ctx.i18n.t('sheet.addRow')}
            </button>
          </div>
        )}
      </div>
      <DelegatedTooltip root={root} />
      {tipAt && tipIssue && !(tipEditing?.row === tipAt.row && tipEditing.col === tipAt.col) && (
        <CellTip
          body={body}
          row={tipAt.row}
          col={tipAt.col}
          issue={tipIssue}
          suggest={
            tipIssue.suggest && store.canEdit(tipAt.row, tipAt.col)
              ? {
                  label: ctx.i18n.t('sheet.useOption', { option: tipIssue.suggest.label }),
                  apply: () => store.set(tipAt, tipIssue.suggest!.value),
                }
              : undefined
          }
          onLeave={() => setHovered(null)}
        />
      )}
    </div>
  )
}

/** DataSheet satır işareti (Vue 07 §3): değişti accent kare, yeni accent +. */
function GutterMark({ mark, i18n }: { mark: 'changed' | 'new' | undefined; i18n: I18n }) {
  if (mark === 'new')
    return (
      <PlusIcon size={13} weight="bold" className="dt-mark is-new" role="img" aria-label={i18n.t('sheet.addedRow')} />
    )
  if (mark === 'changed') return <span className="dt-mark is-changed" role="img" aria-label={i18n.t('sheet.changed')} />
  return null
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
/** "3 / 12": aktif hücre kaçıncı eşleşme (değilse 0); seçime abone, ızgara yeniden çizilmez. */
function FindCount<Row extends object>({
  store,
  found,
  i18n,
}: {
  store: SheetStore<Row>
  found: CellPos[]
  i18n: I18n
}) {
  const index = useSyncExternalStore(store.subscribe, () => {
    const a = store.active()
    return a ? found.findIndex((p) => p.row === a.row && p.col === a.col) + 1 : 0
  })
  return (
    <span className="dt-find-count" aria-live="polite">
      {i18n.t('sheet.findCount', { index, total: found.length })}
    </span>
  )
}

/** Silinecek satır sayısı: `index` seçimdeyse seçimdeki dolu satırlar, değilse 1 (-1: seçime bakar). */
function removeCount<Row extends object>(store: SheetStore<Row>, index: number) {
  const r = store.range()
  if (!r || (index >= 0 && (index < r.top || index > r.bottom))) return 1
  return Math.max(1, Math.min(r.bottom, store.rows().length - 1) - r.top + 1)
}

// ⋯ seçime abone: "N satırı sil" etiketi menü açılmadan doğru olmalı; yalnız bu satırın sayısı değişince çizilir.
function SelectionRowMenu<Row extends object>({
  store,
  row,
  index,
  actions,
}: {
  store: SheetStore<Row>
  row: Row
  index: number
  actions: (count: number) => Array<RowAction<Row>>
}) {
  const count = useSyncExternalStore(store.subscribe, () => removeCount(store, index))
  return <RowMenu row={row} label={String(index + 1)} actions={actions(count)} reserve onOpen={() => {}} />
}

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
  // Sondaki sıfırlar sütunun en az ondalığına kadar (hücredeki gibi): "250", "250,0000" değil.
  let min = 0
  for (let c = left; c <= right; c++) {
    const def = columns[c]
    if (!def) continue
    const numeric = isNumericType(def.type)
    if (numeric) {
      dp = Math.max(dp, decimalPlaces(def as ColumnDef))
      min = Math.max(min, minDecimalPlaces(def as ColumnDef))
    }
    for (let r = top; r <= Math.min(bottom, store.rows().length - 1); r++) cells.push([store.read(r, def), numeric])
  }
  const s = summarize(cells)
  const num = (v: string) => fmt.decimal(v, dp, 'auto', min)
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
            <b>{fmt.decimal(s.numbers.average, Math.max(dp, 2), 'auto', Math.max(min, 2))}</b>
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
