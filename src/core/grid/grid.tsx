// Izgara kökü (05 §2–4; 08 §1–2; brief §5.5): tek kayan alan, sticky header, sabit sütunlar + koşullu kenar gölgesi,
// sanal satırlar. Veri çekmez; sütun düzenini use-column-layout'tan alır. Satır klavyesi yok (D40): widget'lar doğal Tab sırasında.
import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import type { Density } from '../../types/core'
import { RemoteLabels } from '../cells/remote-labels'
import type { RenderEnv } from '../cells/render-cell'
import type { ColumnLayoutApi } from '../columns/use-column-layout'
import { getFormat } from '../format'
import { isPlainRowClick } from '../interaction/is-interactive'
import { useDataTableContext } from '../provider'
import { HeaderCell, type HeaderSort } from './header-cell'
import { Row } from './row'
import { SkeletonRow } from './skeleton-row'
import { useVirtualRows } from './use-virtual-rows'

const SKELETON_ROWS = 12
// jsdom ve ilk render: token okunamazsa standard yoğunluk.
const FALLBACK_ROW_H = 44
const FALLBACK_HEAD_H = 36

// Dokunmatikte Compact → Standard (02 · Yoğunluk); satır yüksekliği buna göre.
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

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
  /** Satır gövdesine düz tık (05 §7): hücredeki widget'a, metin seçimine, sürüklemeye ve değiştirici tuşa karşı tek guard. */
  onRowClick?: (row: Row, event: MouseEvent) => void
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
  onRowClick,
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

  const count = skeleton ? SKELETON_ROWS : rows.length
  const virtual = useVirtualRows({
    count,
    scrollRef: scroll,
    itemHeight: metrics.row + 1,
    headHeight: metrics.head,
    barHeight: metrics.bar,
    keyOf: (i) => (skeleton ? `sk-${i}` : rowId(rows[i]!)),
    keepIndex: skeleton ? -1 : focused,
  })

  // Genişlikler ve sabit ofsetler React render'ı dışında (05 · Resize): sürüklerken yalnızca CSS değişkenleri değişir.
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const write = () => {
      el.style.setProperty('--cols', layout.cols())
      el.style.setProperty('--dt-min-w', `${layout.minWidth()}px`)
      for (const [name, value] of Object.entries(layout.offsets())) el.style.setProperty(name, value)
    }
    write()
    return layout.subscribeSizing(write)
  }, [layout])

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
  }, [density, setScale, scale])

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
    const rowEl = (e.target as HTMLElement).closest<HTMLElement>('.dt-row[data-index]')
    const row = rowEl && rows[Number(rowEl.dataset.index)]
    if (row && onRowClick && isPlainRowClick(e.nativeEvent, rowEl, down.current)) onRowClick(row, e)
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
      />
    )
  }

  return (
    <div
      ref={root}
      className={cls.filter(Boolean).join(' ')}
      role="table"
      aria-label={label}
      aria-rowcount={rowCount}
      aria-colcount={layout.columns.length}
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
          {[...layout.start, ...layout.center].map(header)}
          <div className="dt-head-cell dt-cell-fill" role="presentation" aria-hidden="true" />
          {layout.end.map(header)}
        </div>
        <div className="dt-body" role="presentation" inert={dim || undefined} style={{ height: virtual.total }}>
          {virtual.items.map((item) => (
            <div
              key={item.key}
              className="dt-item"
              data-index={item.index}
              style={{ transform: `translateY(${item.start - metrics.head}px)` }}
            >
              {skeleton ? (
                <SkeletonRow index={item.index} columns={layout.columns} />
              ) : (
                <Row
                  row={rows[item.index]!}
                  index={item.index}
                  rowIndex={2 + rowIndexOffset + item.index}
                  columns={layout.columns}
                  env={env}
                />
              )}
            </div>
          ))}
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
