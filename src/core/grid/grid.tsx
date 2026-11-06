// Izgara kökü (05 §2–4, §6–7; 08 §1–2; brief §5.5): tek kayan alan, sticky header, sabit sütunlar + koşullu kenar gölgesi,
// sanal satırlar (öğe = satır + açık detay, ölçülen yükseklik), seçim sütunu (40 px) ve ⋯ sütunu. Veri çekmez; sütun düzenini
// use-column-layout'tan, seçim ve expand durumunu üstten alır. Satır klavyesi yok (D40): widget'lar doğal Tab sırasında.
import {
  lazy,
  Suspense,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import type { Density } from '../../types/core'
import type { RowAction } from '../../types/list'
import { RemoteLabels } from '../cells/remote-labels'
import type { RenderEnv } from '../cells/render-cell'
import type { ColumnLayoutApi } from '../columns/use-column-layout'
import { getFormat } from '../format'
import { isPlainRowClick } from '../interaction/is-interactive'
import { useDataTableContext } from '../provider'
import { HeaderCell, type HeaderSort } from './header-cell'
import { inlineActionsOf } from './inline-actions'
import { Row, type RowExtras } from './row'
import { SkeletonRow } from './skeleton-row'
import type { HandleBind, SortableState } from './sortable-rows'
import { useVirtualRows } from './use-virtual-rows'

// lazy() generic bileşenin tip parametresini düşürür; öğe tipi aynen geçer. @dnd-kit yalnızca sıralama açıkken yüklenir (R21).
const SortableRows = lazy(() => import('./sortable-rows')) as unknown as typeof import('./sortable-rows').default

const SKELETON_ROWS = 12
// jsdom ve ilk render: token okunamazsa standard yoğunluk.
const FALLBACK_ROW_H = 44
const FALLBACK_HEAD_H = 36

// Dokunmatikte Compact → Standard (02 · Yoğunluk); satır yüksekliği buna göre.
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

// Seçim ve ⋯ sütunları düzenin dışında: track'ler başa / sona eklenir, sabit sütun ofsetleri o kadar kayar (05 §4, §6).
// ⋯ sütunu içeriğe göre: dolgu 8 + ⋯ + 8; sayfada hatalı satır varsa (D35) + ikon + gap; inline aksiyon başına (D36, sayfadaki
// en kalabalık satır) + düğme + gap.
const SELECT_W = 40
const SELECT_W_PHONE = 48
// Sıra tutamağı (R21): seçimden önce, 28 px düğme + dolgu; telefonda dokunma payı.
const HANDLE_W = 32
const HANDLE_W_PHONE = 44
const MENU_PAD = 8

export interface GridProps<Row extends object> {
  layout: ColumnLayoutApi<Row>
  rows: Row[]
  rowId: (row: Row) => string
  /** role=table aria-label. */
  label: string
  density: Density
  /** 12 iskelet satır (ilk yükleme). */
  skeleton?: boolean
  /** aria-rowcount; bilinmiyorsa -1. */
  rowCount?: number
  /** Önceki sayfaların satırları: aria-rowindex sayfa boyunca sürer. */
  rowIndexOffset?: number
  /** Kimlik değiştiren istek sürüyor: satırlar soluk ve `inert` (05 §10). */
  dim?: boolean
  /** Yenileme çubuğu. */
  refreshing?: boolean
  /** Gövde üstünde durum notu ("Still loading…"). */
  notice?: ReactNode
  /** Satır yokken gövdenin ortasında. */
  state?: ReactNode
  verticalLines?: boolean
  /** Değişince gövde başa kayar (sayfa değişimi, 05 §8). */
  scrollKey?: string | number
  sort?: Map<string, HeaderSort>
  /** Verilirse sıralanabilir sütunlarda header sıralar. */
  canSort?: (id: string) => boolean
  onSort?: (id: string, additive: boolean) => void
  onSortSet?: (id: string, dir: 'asc' | 'desc' | null) => void
  /** Filtrelenen sütunlar: header'da huni. */
  filtered?: ReadonlySet<string>
  /** Verilirse filtrelenebilir sütunlarda header menüsünde "Filter by this column…". */
  canFilter?: (id: string) => boolean
  onFilter?: (id: string) => void
  /** Sütun menüsünde Column settings; verilmezse yok. */
  onColumns?: (from: HTMLElement | null) => void
  /** Satır gövdesine düz tık (05 §7): hücredeki widget'a, metin seçimine, sürüklemeye ve değiştirici tuşa karşı tek guard. */
  onRowClick?: (row: Row, event: MouseEvent) => void
  /** Seçim sütunu (05 §6): anahtar → seçili. */
  selection?: Record<string, true>
  onSelectRows?: (ids: string[], value: boolean) => void
  /** Birincil hücrede chevron + alt satır (05 §7): anahtar → açık. */
  expanded?: Record<string, true>
  canExpand?: (row: Row) => boolean
  onToggleExpand?: (id: string, value: boolean) => void
  renderExpanded?: (row: Row, close: () => void) => ReactNode
  /** Değişince açık detayların ölçümü sıfırlanır (sorgu / sayfa). */
  resetKey?: string
  /** ⋯ sütunu ve satır menüsü: Open / Copy yerleşik, `rowActions` uygulamanın. */
  rowMenu?: boolean
  rowActions?: Array<RowAction<Row>>
  primaryHref?: (row: Row) => string | undefined
  primaryLabel?: (row: Row) => string
  /** Satır hatası (05 §4, D35): metin ya da metin listesi; boş → yok. Harita uygulamanın. */
  rowError?: (row: Row) => string | string[] | null | undefined
  /** Birincil linke düz sol tık, menüde Open (05 §7). Tarayıcı gezinmesi dinleyicide durdurulabilir. */
  onRowOpen?: (row: Row, event: MouseEvent) => void
  /** Satır sıralama (R21): tutamak sütunu; `disabled` gerekçesi tooltip'te, `pending` önceki taşıma sürerken. */
  reorder?: { disabled: boolean | string; pending: boolean; onMove: (from: number, to: number) => void }
}

export function Grid<Row extends object>({
  layout,
  rows,
  rowId,
  label,
  density: requested,
  skeleton = false,
  rowCount = -1,
  rowIndexOffset = 0,
  dim = false,
  refreshing = false,
  notice,
  state,
  verticalLines = false,
  scrollKey,
  sort,
  canSort,
  onSort,
  onSortSet,
  filtered,
  canFilter,
  onFilter,
  onColumns,
  onRowClick,
  selection,
  onSelectRows,
  expanded,
  canExpand,
  onToggleExpand,
  renderExpanded,
  resetKey,
  rowMenu = false,
  rowActions = [],
  primaryHref,
  primaryLabel,
  onRowOpen,
  rowError,
  reorder,
}: GridProps<Row>) {
  const ctx = useDataTableContext()
  const root = useRef<HTMLDivElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const density: Density = coarse && requested === 'compact' ? 'standard' : requested
  const [labels] = useState(() => new RemoteLabels())
  const labelsVersion = useSyncExternalStore(labels.subscribe, labels.getVersion)

  // Satır ve header yüksekliği, kaydırma çubuğu payı token'dan ve DOM'dan ölçülür (02 tek kaynak).
  const [metrics, setMetrics] = useState({ row: FALLBACK_ROW_H, head: FALLBACK_HEAD_H, bar: 0 })
  const [scrolled, setScrolled] = useState({ start: false, end: false })
  const [focused, setFocused] = useState(-1)
  const [dragging, setDragging] = useState(-1)

  const selectable = !!onSelectRows
  const expandable = !!renderExpanded
  const phone = layout.phone
  const selW = selectable ? (phone ? SELECT_W_PHONE : SELECT_W) : 0
  const handleW = reorder ? (phone ? HANDLE_W_PHONE : HANDLE_W) : 0
  /** Düzenin önündeki sütunlar: tutamak + seçim. */
  const leadW = handleW + selW
  const sortable = !!reorder && !reorder.disabled && !skeleton
  const maxInline = rowActions.some((a) => a.inline)
    ? rows.reduce((m, r) => Math.max(m, inlineActionsOf(rowActions, r).length), 0)
    : 0
  /** `rowError` sonucu mesaj listesine iner; boş metinler düşer, boş liste = hata yok. */
  const errorOf = (row: Row): string[] => {
    const e = rowError?.(row)
    return (Array.isArray(e) ? e : [e]).filter((m): m is string => !!m)
  }
  const anyError = !!rowError && rows.some((r) => errorOf(r).length > 0)
  const menuW = rowMenu
    ? `calc(${2 * MENU_PAD}px${anyError ? ' + var(--dt-icon) - 2px + var(--dt-space)' : ''} + ${maxInline + 1} * var(--dt-control-h-sm) + ${maxInline} * var(--dt-space))`
    : ''
  const isOpen = (row: Row) => !!expanded?.[rowId(row)]

  const count = skeleton ? SKELETON_ROWS : rows.length
  const virtual = useVirtualRows({
    count,
    scrollRef: scroll,
    itemHeight: metrics.row + 1,
    headHeight: metrics.head,
    barHeight: metrics.bar,
    keyOf: (i) => (skeleton ? `sk-${i}` : rowId(rows[i]!)),
    keepIndex: skeleton ? -1 : dragging >= 0 ? dragging : focused,
    resetKey,
  })

  // Kapanan detay: öğe satır yüksekliğine döner (açıkken ölçülmüştü).
  const openIds = Object.keys(expanded ?? {}).join('\u0000')
  const lastOpen = useRef<string[]>([])
  useLayoutEffect(() => {
    const now = new Set(Object.keys(expanded ?? {}))
    for (const id of lastOpen.current) {
      if (now.has(id)) continue
      const i = rows.findIndex((r) => rowId(r) === id)
      if (i >= 0) virtual.resizeItem(i, metrics.row + 1)
    }
    lastOpen.current = [...now]
    // Yalnızca açık anahtarlar değişince.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIds])

  // Genişlikler ve sabit ofsetler React render'ı dışında (05 · Resize): sürüklerken yalnızca CSS değişkenleri değişir.
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const write = () => {
      const lead = [handleW ? `${handleW}px` : '', selW ? `${selW}px` : '']
      el.style.setProperty('--cols', [...lead, layout.cols(), menuW].filter(Boolean).join(' '))
      const min = `${layout.minWidth() + leadW}px`
      el.style.setProperty('--dt-min-w', menuW ? `calc(${min} + ${menuW})` : min)
      // Detay satırı düzenin ilk sütunuyla hizalanır: tutamak ve seçim payı birlikte.
      el.style.setProperty('--dt-sel-w', `${leadW}px`)
      el.style.setProperty('--dt-menu-w', menuW || '0px')
      const start = new Set(layout.start.map((c) => c.offsetVar))
      const end = new Set(layout.end.map((c) => c.offsetVar))
      for (const [name, value] of Object.entries(layout.offsets())) {
        if (start.has(name)) el.style.setProperty(name, `${parseFloat(value) + leadW}px`)
        else if (end.has(name) && menuW) el.style.setProperty(name, `calc(${value} + ${menuW})`)
        else el.style.setProperty(name, value)
      }
    }
    write()
    return layout.subscribeSizing(write)
  }, [layout, selW, handleW, leadW, menuW])

  // Yoğunluk değişince: satır yüksekliği, header yüksekliği ve sütun ölçeği (--dt-fs / 13) yeniden okunur.
  const { setScale, scale } = layout
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const css = getComputedStyle(el)
    const row = parseFloat(css.getPropertyValue('--dt-row-h'))
    const fs = parseFloat(css.getPropertyValue('--dt-fs'))
    const head = el.querySelector<HTMLElement>('.dt-head')?.offsetHeight
    const s = scroll.current
    const next = {
      row: Number.isFinite(row) ? row : FALLBACK_ROW_H,
      head: head || FALLBACK_HEAD_H,
      bar: s ? Math.max(0, s.offsetHeight - s.clientHeight) : 0,
    }
    setMetrics((p) => (p.row === next.row && p.head === next.head && p.bar === next.bar ? p : next))
    const k = Number.isFinite(fs) ? fs / 13 : 1
    if (k !== scale) setScale(k)
  }, [density, phone, setScale, scale])

  // İlk çizimde değil, anahtar değişince başa (05 §8).
  const lastScrollKey = useRef(scrollKey)
  useLayoutEffect(() => {
    if (lastScrollKey.current === scrollKey) return
    lastScrollKey.current = scrollKey
    if (scroll.current) scroll.current.scrollTop = 0
  }, [scrollKey])

  // Sabit sütun kenar gölgesi yalnızca o yöne kaydırılmışken (05 §4 · Pinned); kap boyu değişince de yeniden bakılır.
  useLayoutEffect(() => {
    const el = scroll.current
    if (!el) return
    const update = () => {
      const start = el.scrollLeft > 0
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
      setScrolled((p) => (p.start === start && p.end === end ? p : { start, end }))
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro?.disconnect()
    }
  }, [])

  const onFocus = (e: FocusEvent) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.dt-row[data-index]')
    setFocused(row ? Number(row.dataset.index) : -1)
  }

  // Sürükleme tespiti için mousedown noktası; render'a girmez.
  const down = useRef<{ x: number; y: number } | null>(null)
  const onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    const rowEl = target.closest<HTMLElement>('.dt-row[data-index]')
    const row = rowEl && rows[Number(rowEl.dataset.index)]
    if (!row) return
    // Birincil linke düz sol tık → onRowOpen; değiştirici tuş / orta tık tarayıcıya (D6).
    const link = target.closest('a.dt-link')
    if (link && link.closest('.dt-cell.is-primary') && rowEl.contains(link)) {
      if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) onRowOpen?.(row, e)
      return
    }
    if (onRowClick && isPlainRowClick(e.nativeEvent, rowEl, down.current)) onRowClick(row, e)
  }

  // Checkbox ⇧ aralığının çapası (05 §6); satır anahtarları değişince (sayfa / sorgu) sıfırlanır.
  const rowKeys = rows.map(rowId).join('\u0000')
  const anchor = useRef({ keys: rowKeys, index: -1 })
  const onSelect = (i: number, value: boolean, shift: boolean) => {
    if (anchor.current.keys !== rowKeys) anchor.current = { keys: rowKeys, index: -1 }
    const a = anchor.current.index
    const [from, to] = a < i ? [a, i] : [i, a]
    onSelectRows?.(shift && a >= 0 ? rows.slice(from, to + 1).map(rowId) : [rowId(rows[i]!)], value)
    anchor.current = { keys: rowKeys, index: i }
  }
  const selectedCount = selectable ? rows.reduce((n, r) => n + (selection?.[rowId(r)] ? 1 : 0), 0) : 0
  const allSelected = rows.length > 0 && selectedCount === rows.length
  const uid = useId()
  const extrasOf = (row: Row, i: number, bind?: HandleBind): RowExtras<Row> => {
    const id = rowId(row)
    const subrow = `${uid}-sub-${id}`
    return {
      label: primaryLabel?.(row) ?? id,
      uid: `${uid}-r-${id}`,
      error: errorOf(row),
      handle: reorder
        ? {
            disabled: !!reorder.disabled || reorder.pending,
            reason: typeof reorder.disabled === 'string' ? reorder.disabled : undefined,
            edge: !selectable && !layout.start.length,
            bind,
          }
        : undefined,
      select: selectable
        ? {
            selected: !!selection?.[id],
            edge: !layout.start.length,
            left: handleW,
            onChange: (v, shift) => onSelect(i, v, shift),
          }
        : undefined,
      expand: expandable
        ? {
            can: canExpand?.(row) ?? true,
            open: isOpen(row),
            controls: subrow,
            onToggle: () => onToggleExpand?.(id, !isOpen(row)),
          }
        : undefined,
      menu: rowMenu
        ? {
            edge: !layout.end.length,
            actions: rowActions,
            href: primaryHref?.(row),
            onOpen: (e) => onRowOpen?.(row, e),
          }
        : undefined,
    }
  }

  /** Taşınan başlık yeni yerinde odakta kalır (⌥⇧←/→ ve menü). */
  const focusHeader = (id: string) =>
    requestAnimationFrame(() => {
      const cell = [...(root.current?.querySelectorAll<HTMLElement>('.dt-head-cell[data-col]') ?? [])].find(
        (c) => c.dataset.col === id,
      )
      cell?.querySelector<HTMLElement>('.dt-head-label')?.focus()
    })

  // labelsVersion bağımlılık olarak env'de: derleyici env'i önbelleğe alır, etiket çözülünce yenisi kurulmalı.
  const env: RenderEnv & { labelsVersion: number } = {
    fmt: getFormat(ctx.locale),
    i18n: ctx.i18n,
    today: new Date(),
    labels,
    density,
    coarse,
    labelsVersion,
  }

  const cls = [
    'dt-grid',
    scrolled.start && 'is-scrolled-start',
    scrolled.end && 'is-scrolled-end',
    skeleton && 'is-skeleton',
    dim && 'is-dim',
    verticalLines && 'has-vlines',
    phone && 'is-phone',
  ]
  const header = (col: (typeof layout.columns)[number]) => {
    const sortable = !!onSort && (canSort?.(col.id) ?? false)
    return (
      <HeaderCell
        key={col.id}
        column={col}
        layout={layout}
        onMoved={focusHeader}
        sort={sort?.get(col.id)}
        onSort={sortable ? (additive) => onSort(col.id, additive) : undefined}
        onSortSet={sortable && onSortSet ? (dir) => onSortSet(col.id, dir) : undefined}
        filtered={filtered?.has(col.id)}
        onFilter={onFilter && canFilter?.(col.id) ? () => onFilter(col.id) : undefined}
        onColumns={onColumns}
      />
    )
  }

  const itemEl = (item: (typeof virtual.items)[number], drag?: SortableState) => {
    const row = skeleton ? undefined : rows[item.index]
    const open = !!row && expandable && isOpen(row)
    // Yalnızca açık öğeler ölçülür; kapalı satır sabit yükseklikte.
    const measure = open ? virtual.measureElement : undefined
    return (
      <div
        key={item.key}
        ref={
          drag
            ? (el) => {
                drag.setNodeRef(el)
                measure?.(el)
              }
            : measure
        }
        className={drag?.dragging ? 'dt-item is-dragging' : 'dt-item'}
        data-index={item.index}
        style={
          drag
            ? // @dnd-kit satır yerlerini transform'u yok sayarak ölçer: konum top'ta, transform yalnızca sürükleme kayması.
              {
                top: item.start - metrics.head,
                transform: drag.y ? `translateY(${drag.y}px)` : undefined,
                transition: drag.transition,
              }
            : { transform: `translateY(${item.start - metrics.head}px)` }
        }
      >
        {!row ? (
          <SkeletonRow index={item.index} columns={layout.columns} />
        ) : (
          <>
            <Row
              row={row}
              index={item.index}
              rowIndex={2 + rowIndexOffset + item.index}
              columns={layout.columns}
              env={env}
              extras={extrasOf(row, item.index, drag?.handle)}
            />
            {open && (
              <div
                id={`${uid}-sub-${rowId(row)}`}
                className="dt-subrow"
                role="row"
                aria-rowindex={2 + rowIndexOffset + item.index}
              >
                <div role="cell" aria-colspan={layout.columns.length}>
                  {renderExpanded!(row, () => onToggleExpand?.(rowId(row), false))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div
      ref={root}
      className={cls.filter(Boolean).join(' ')}
      role="table"
      aria-label={label}
      aria-rowcount={rowCount}
      aria-colcount={layout.columns.length + (reorder ? 1 : 0) + (selectable ? 1 : 0) + (rowMenu ? 1 : 0)}
      aria-busy={skeleton || dim || undefined}
      data-density={density}
      onFocus={onFocus}
      onMouseDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
      onClick={onClick}
    >
      {/* Tab ile odaklanan widget'ı tarayıcı kaydırır: sticky header ve yatay çubuk payı (08 §2). */}
      <div
        ref={scroll}
        className="dt-scroll"
        style={{ scrollPaddingTop: metrics.head, scrollPaddingBottom: metrics.bar }}
      >
        <div className="dt-head" role="row" aria-rowindex={1}>
          {reorder && (
            <div
              className={
                selectable || layout.start.length
                  ? 'dt-head-cell dt-head-handle is-pinned-start'
                  : 'dt-head-cell dt-head-handle is-pinned-start is-pin-edge'
              }
              style={{ left: 0 }}
              role="columnheader"
            >
              <span className="dt-sr-only">{ctx.i18n.t('reorder.column')}</span>
            </div>
          )}
          {selectable && (
            <div
              className={
                layout.start.length
                  ? 'dt-head-cell dt-head-select is-pinned-start'
                  : 'dt-head-cell dt-head-select is-pinned-start is-pin-edge'
              }
              style={{ left: handleW }}
              role="columnheader"
            >
              <input
                type="checkbox"
                className="dt-checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = selectedCount > 0 && !allSelected
                }}
                aria-label={ctx.i18n.t('row.selectPageAria')}
                onChange={() => onSelectRows?.(rows.map(rowId), !allSelected)}
              />
            </div>
          )}
          {[...layout.start, ...layout.center].map(header)}
          <div className="dt-head-cell dt-cell-fill" role="presentation" aria-hidden="true" />
          {layout.end.map(header)}
          {rowMenu && (
            <div
              className={
                layout.end.length
                  ? 'dt-head-cell dt-head-menu-col is-pinned-end'
                  : 'dt-head-cell dt-head-menu-col is-pinned-end is-pin-edge'
              }
              style={{ right: 0 }}
              role="columnheader"
            />
          )}
        </div>
        <div className="dt-body" role="presentation" inert={dim || undefined} style={{ height: virtual.total }}>
          {sortable && reorder ? (
            // Yüklenene kadar satırlar sürüklenemeden çizilir.
            <Suspense fallback={virtual.items.map((item) => itemEl(item))}>
              <SortableRows
                ids={rows.map(rowId)}
                labelOf={(id) => {
                  const row = rows.find((r) => rowId(r) === id)
                  return row ? (primaryLabel?.(row) ?? id) : id
                }}
                disabled={reorder.pending}
                onMove={reorder.onMove}
                onActive={setDragging}
                items={virtual.items}
                keyOf={(item) => item.key}
                render={itemEl}
              />
            </Suspense>
          ) : (
            virtual.items.map((item) => itemEl(item))
          )}
        </div>
      </div>
      {refreshing && <div className="dt-refresh-bar" aria-hidden="true" />}
      {notice && (
        <div className="dt-notice" role="status">
          {notice}
        </div>
      )}
      {state && !skeleton && rows.length === 0 && <div className="dt-body-state">{state}</div>}
    </div>
  )
}
