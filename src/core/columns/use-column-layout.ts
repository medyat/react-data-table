'use no memo'
// TanStack Table'ın sütun modeli (01 · TanStack sınırı, D23): sıra, görünürlük, genişlik, resize, sabitleme.
// Bu dosya dışında (grid/, cells/ …) TanStack import edilmez; dışarıya kendi tiplerimiz çıkar.
//
// R11: TanStack örneği kendi atom'larını değiştirerek çalışır; React Compiler bu nesneleri önbelleğe alırsa ekran
// eski durumda donar. Dosya derleyicinin dışındadır.
//
// Performans (05 · Resize): hook genişlik değişiminde yeniden çizilmez (useTable seçicisi genişliği içermez).
// Izgara `subscribeSizing` ile `--cols` ve sabit ofsetlerini React render'ı dışında yazar.
import {
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  tableFeatures,
  useTable,
  type Column,
  type ColumnDef as TanstackColumnDef,
  type Header,
} from '@tanstack/react-table'
import { useState } from 'react'
import type { ColumnDef } from '../../types/columns'
import type { ColumnLayout } from '../../types/query'
import { defaultTrack, type Track } from '../cells/specs'
import { readPath } from './read-path'

export const MIN_COLUMN_WIDTH = 80

const features = tableFeatures({
  columnSizingFeature,
  columnResizingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnVisibilityFeature,
})
type Features = typeof features
type TColumn<Row extends object> = Column<Features, Row, unknown>

export type PinSide = 'start' | 'end' | null

/** Izgaranın çizdiği, TanStack'ten bağımsız sütun görünümü. Genişlik burada değil, `cols()`/`offsets()`'ta. */
export interface LayoutColumn<Row extends object = object> {
  id: string
  def: ColumnDef<Row>
  pinned: PinSide
  /** Bölgenin kenarındaki sabit sütun: kaydırma gölgesini bu taşır. */
  pinEdge: boolean
  /** Sabit hücrelerin sticky ofsetini taşıyan CSS değişkeni (`--dt-off-…`). */
  offsetVar: string
  canHide: boolean
  /** Resize tutamacının TanStack işleyicisi (fare ve dokunma). */
  resizeHandler: (event: unknown) => void
}

/** Columns dialog'unun satırı (05 §5, D45): tüm sütunlar ekran sırasıyla. */
export interface PanelColumn<Row extends object = object> {
  id: string
  def: ColumnDef<Row>
  visible: boolean
  pinned: PinSide
  canHide: boolean
  /** Her zaman sola sabit (birincil): listede kilitli, taşınmaz, gizlenmez. */
  fixed: boolean
}

/** Dialog taslağı: sıra, görünürler ve konumsal sabitleme (ilk `start`, son `end` görünür sütun). */
export interface ColumnsDraft {
  order: string[]
  visible: string[]
  start: number
  end: number
}

export interface ColumnLayoutOptions<Row extends object> {
  columns: Array<ColumnDef<Row>>
  /** Görünümden gelen düzen (Faz 3b); verilmezse sütun tanımları. */
  layout?: Partial<ColumnLayout>
}

const NO_ROWS: never[] = []
const trackCss = (t: Track): string => (typeof t === 'number' ? `${t}px` : `minmax(${t.min}px, ${t.fr}fr)`)
const trackMin = (t: Track): number => (typeof t === 'number' ? t : t.min)
/** Sütun id'si CSS özel özellik adına: 'product.name' → '--dt-off-product_name'. */
export const offsetVarName = (id: string): string => `--dt-off-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`

/** Gizlenemeyen sütun: `alwaysVisible` ve birincil. */
const alwaysShown = (d: ColumnDef): boolean => !!(d.alwaysVisible || d.primary)

export function useColumnLayout<Row extends object>(options: ColumnLayoutOptions<Row>) {
  const defs = options.columns
  const defById = new Map(defs.map((d) => [d.id as string, d]))
  // Tip varsayılanları ve geliştiricinin `width`'i 13 px yazıya göre (02 · Ölçek); ızgara yoğunluğun --dt-fs'ini ölçüp
  // oranı bildirir. Kullanıcının sürüklediği genişlik (columnSizing) ölçeklenmez.
  const [scale, setScale] = useState(1)
  // Telefonda (05 §11) yalnızca birincil sütun sola sabit, sağa sabit yok; kayıtlı sabitleme durumu değişmez. Kartın genişliğini
  // DataTable ölçer ve bildirir.
  const [phone, setPhone] = useState(false)
  const fixed = defs.filter((d) => d.primary).map((d) => d.id as string)

  const trackFor = (d: ColumnDef<Row>): Track => {
    const t = defaultTrack(d)
    return typeof t === 'number' ? Math.round(t * scale) : { ...t, min: Math.round(t.min * scale) }
  }
  const minOf = (d: ColumnDef<Row>): number => Math.min(d.minWidth ?? MIN_COLUMN_WIDTH, trackMin(trackFor(d)))
  /** Kaydedilen / uygulanan genişlik sütunun min–max aralığında (05 · Resize: min 80). */
  const clampWidth = (id: string, px: number): number => {
    const def = defById.get(id)
    return Math.min(def?.maxWidth ?? Infinity, Math.max(def ? minOf(def) : MIN_COLUMN_WIDTH, Math.round(px)))
  }

  // Her zaman açık id + accessorFn (accessorKey asla: nokta → alt çizgi çakışması, 01).
  const tanstackColumns: Array<TanstackColumnDef<Features, Row, unknown>> = defs.map((d) => {
    const id = d.id as string
    return {
      id,
      accessorFn: d.accessor ?? ((row: Row) => readPath(row, id)),
      size: trackMin(trackFor(d)),
      // Açık `width` 80'in altındaysa (ör. 56 px aksiyon sütunu) o geçerli.
      minSize: minOf(d),
      maxSize: d.maxWidth,
      enableHiding: !alwaysShown(d),
    }
  })

  /** Görünümden gelen düzen → TanStack durumu (04 §7): bilinmeyen sütun atlanır; `visible` varsa beyaz listedir; gizlenemeyen hep açık. */
  const known = (ids: string[] | undefined) => ids?.filter((id) => defById.has(id))
  const stateOf = (l: Partial<ColumnLayout> | undefined) => {
    const fx = fixed.filter((id) => defById.has(id))
    const start = [...fx, ...(known(l?.pinned?.left) ?? []).filter((id) => !fx.includes(id))]
    const end = (known(l?.pinned?.right) ?? []).filter((id) => !fx.includes(id))
    const visibility: Record<string, boolean> = {}
    for (const d of defs) {
      const id = d.id as string
      visibility[id] = alwaysShown(d) || (l?.visible ? l.visible.includes(id) : !d.hidden)
    }
    const sizing: Record<string, number> = {}
    for (const [id, w] of Object.entries(l?.widths ?? {})) if (defById.has(id)) sizing[id] = clampWidth(id, w)
    return {
      columnPinning: { start, end },
      columnVisibility: visibility,
      columnOrder: known(l?.order) ?? [],
      columnSizing: sizing,
    }
  }

  const table = useTable(
    {
      features,
      columns: tanstackColumns,
      data: NO_ROWS,
      initialState: stateOf(options.layout),
      columnResizeMode: 'onChange',
    },
    // Genişlik ve resize durumu bilerek yok: sürüklerken ekran yeniden çizilmez (05 · Resize).
    (s) => ({ columnOrder: s.columnOrder, columnVisibility: s.columnVisibility, columnPinning: s.columnPinning }),
  )

  const headerById = new Map(table.getFlatHeaders().map((h) => [h.column.id, h as Header<Features, Row, unknown>]))
  const toLayoutColumn = (col: TColumn<Row>, pinned: PinSide, pinEdge: boolean): LayoutColumn<Row> => ({
    id: col.id,
    def: defById.get(col.id)!,
    pinned,
    pinEdge,
    offsetVar: offsetVarName(col.id),
    canHide: col.getCanHide(),
    resizeHandler: (e) => headerById.get(col.id)?.getResizeHandler()(e),
  })

  const isPrimary = (c: TColumn<Row>) => !!defById.get(c.id)?.primary
  const startCols = phone ? table.getVisibleLeafColumns().filter(isPrimary) : table.getStartVisibleLeafColumns()
  const centerCols = phone
    ? table.getVisibleLeafColumns().filter((c) => !isPrimary(c))
    : table.getCenterVisibleLeafColumns()
  const endCols = phone ? [] : table.getEndVisibleLeafColumns()
  const isPinnedCol = (c: TColumn<Row>) => (phone ? isPrimary(c) : c.getIsPinned() !== false)
  const start = startCols.map((c, i, all) => toLayoutColumn(c, 'start', i === all.length - 1))
  const center = centerCols.map((c) => toLayoutColumn(c, null, false))
  const end = endCols.map((c, i) => toLayoutColumn(c, 'end', i === 0))

  /** Sütunun gerçek track'i: sabit ve resize edilmiş sütunlar px, diğerleri tip varsayılanı (minmax olabilir). */
  const trackOf = (col: TColumn<Row>, pinned: boolean): Track => {
    // Ham columnSizing sürüklerken min/max'ı aşabilir; getSize() kırpar (min 80, 05 · Resize).
    const resized = table.atoms.columnSizing.get()[col.id] !== undefined
    return pinned || resized ? col.getSize() : trackFor(defById.get(col.id)!)
  }

  /** grid-template-columns: sabit px, orta track'ler, bölge sonunda `auto` dolgu (05 · Resize). */
  const cols = (): string =>
    [
      ...startCols.map((c) => trackCss(trackOf(c, true))),
      ...centerCols.map((c) => trackCss(trackOf(c, false))),
      'auto',
      ...endCols.map((c) => trackCss(trackOf(c, true))),
    ].join(' ')

  /** Sabit hücrelerin sticky ofsetleri: start için left, end için right (TanStack getStart / getAfter). */
  const offsets = (): Record<string, string> => {
    const out: Record<string, string> = {}
    let left = 0
    for (const c of startCols) {
      out[offsetVarName(c.id)] = `${left}px`
      left += c.getSize()
    }
    for (const c of endCols) out[offsetVarName(c.id)] = `${c.getAfter('end')}px`
    return out
  }

  /** Satır ve header'ın en az genişliği; kabı aşarsa yatay kayar. */
  const minWidth = (): number =>
    table.getVisibleLeafColumns().reduce((sum, c) => sum + trackMin(trackOf(c, isPinnedCol(c))), 0)

  /** Move left/right (D22: sürükleme yok): aynı sabitleme bölgesindeki görünür komşuyla yer değiştirir. */
  const move = (id: string, delta: -1 | 1) => {
    const ordered = table.getOrderColumnsFn()(table.getAllLeafColumns())
    const at = ordered.findIndex((c) => c.id === id)
    const me = ordered[at]
    if (!me) return
    const region = me.getIsPinned()
    let j = at + delta
    while (j >= 0 && j < ordered.length && !(ordered[j]!.getIsVisible() && ordered[j]!.getIsPinned() === region))
      j += delta
    const other = ordered[j]
    if (!other) return
    const ids = ordered.map((c) => c.id)
    ids[at] = other.id
    ids[j] = me.id
    table.setColumnOrder(ids)
  }

  const apply = (l?: Partial<ColumnLayout>) => {
    const st = stateOf(l)
    table.setColumnOrder(st.columnOrder)
    table.setColumnVisibility(st.columnVisibility)
    table.setColumnPinning(st.columnPinning)
    table.setColumnSizing(st.columnSizing)
  }

  /** Etkin düzen (görünüme yazılan biçim): sıra, görünürler, yalnızca değiştirilmiş genişlikler, sabitler. */
  const state = (): ColumnLayout => {
    const p = table.atoms.columnPinning.get()
    return {
      order: table
        .getOrderColumnsFn()(table.getAllLeafColumns())
        .map((c) => c.id),
      visible: table.getVisibleLeafColumns().map((c) => c.id),
      widths: Object.fromEntries(
        Object.entries(table.atoms.columnSizing.get()).map(([id, w]) => [id, clampWidth(id, w)]),
      ),
      pinned: { left: [...(p.start ?? [])], right: [...(p.end ?? [])] },
    }
  }

  const rank = (c: TColumn<Row>) => {
    const p = c.getIsPinned()
    return p === 'start' ? 0 : p === 'end' ? 2 : 1
  }
  const panel: Array<PanelColumn<Row>> = [...table.getOrderColumnsFn()(table.getAllLeafColumns())]
    .sort((a, b) => rank(a) - rank(b))
    .map((c) => {
      const pinned = c.getIsPinned()
      return {
        id: c.id,
        def: defById.get(c.id)!,
        visible: c.getIsVisible(),
        pinned: pinned === false ? null : pinned,
        canHide: c.getCanHide(),
        fixed: fixed.includes(c.id),
      }
    })

  /** Canlı sürükleme genişliği; sürüklenmiyorsa null. */
  const resizing = (): { id: string; size: number } | null => {
    const id = table.atoms.columnResizing.get().isResizingColumn
    return id ? { id, size: table.getColumn(id)?.getSize() ?? 0 } : null
  }

  /** Genişlik ya da resize durumu değişince çağrılır; abonelikten çıkış fonksiyonu döner. */
  const subscribeSizing = (listener: () => void): (() => void) => {
    const a = table.atoms.columnSizing.subscribe(listener)
    const b = table.atoms.columnResizing.subscribe(listener)
    return () => {
      a.unsubscribe()
      b.unsubscribe()
    }
  }

  return {
    columns: [...start, ...center, ...end],
    start,
    center,
    end,
    scale,
    setScale,
    phone,
    setPhone,
    cols,
    offsets,
    minWidth,
    resizing,
    subscribeSizing,
    move,
    panel,
    counts: { shown: table.getVisibleLeafColumns().length, total: table.getAllLeafColumns().length },
    state,
    /** Görünümün düzeni uygulanmadan `state()` biçiminde (04 §7 "edited" karşılaştırması). */
    resolve: (l: Partial<ColumnLayout> | undefined): ColumnLayout => {
      const st = stateOf(l)
      const order = [...st.columnOrder, ...defs.map((d) => d.id as string).filter((id) => !st.columnOrder.includes(id))]
      return {
        order,
        visible: order.filter((id) => st.columnVisibility[id]),
        widths: st.columnSizing,
        pinned: { left: st.columnPinning.start, right: st.columnPinning.end },
      }
    },
    /** Dialog'un Save'i (D45): sabitleme konumsaldır, sabitlerden sonraki ilk `start` ve son `end` görünür sütun. */
    arrange: (d: ColumnsDraft) => {
      const free = d.order.filter((id) => d.visible.includes(id) && !fixed.includes(id))
      const left = free.slice(0, d.start)
      apply({
        order: d.order,
        visible: d.visible,
        widths: state().widths,
        pinned: { left, right: d.end ? free.slice(left.length).slice(-d.end) : [] },
      })
    },
    /** Display › Reset: verilmezse `layout` seçeneğine, o da yoksa sütun tanımlarına döner. */
    reset: (l: Partial<ColumnLayout> | undefined = options.layout) => apply(l),
    widthOf: (id: string): number => table.getColumn(id)?.getSize() ?? 0,
    setWidth: (id: string, px: number) => table.setColumnSizing((s) => ({ ...s, [id]: clampWidth(id, px) })),
    setVisible: (id: string, visible: boolean) => table.getColumn(id)?.toggleVisibility(visible),
  }
}

export type ColumnLayoutApi<Row extends object = object> = ReturnType<typeof useColumnLayout<Row>>
