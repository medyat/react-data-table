// Hücre motorunun deposu (form-grid.md §5): aktif hücre, seçim aralığı, düzenleme oturumu ve geri al React dışında
// durur; hücre `cellState` ile yalnız kendi bayrağını okur, ok tuşunda yalnız değişen hücreler yeniden çizilir.
// Veri uygulamanındır: her yazma yeni satır dizisiyle `onRowsChange`'e gider, depo yalnız kimlik ve geçmiş tutar.
// Satırların sonunda her zaman bir boş satır vardır (dizin = rows.length); ona yazmak satırı doğurur (`kind: 'edit'`).
import { sameDecimal } from '../format/decimal'
import type { ColumnDef, OptionDef } from '../../types/columns'
import { isEmptyValue } from '../cells/format'
import { readPath } from '../columns/read-path'
import { isNumericType } from '../cells/specs'

export interface CellPos {
  row: number
  col: number
}
export type Direction = 'up' | 'down' | 'left' | 'right'

export interface SheetChange {
  kind: 'edit' | 'paste' | 'fill' | 'import' | 'remove' | 'duplicate' | 'undo' | 'redo'
  /** Değişen hücreler: satır sırası (değişiklikten sonraki dizide) ve sütun id. */
  cells: Array<{ row: number; column: string }>
}

export interface SheetStoreOptions<Row extends object> {
  rows: readonly Row[]
  columns: ReadonlyArray<ColumnDef<Row>>
  onRowsChange: (rows: Row[], change: SheetChange) => void
  /** Verilmezse satır nesnesine geçici kimlik (WeakMap); yazılan yeni nesne eskisinin kimliğini alır. */
  getRowId?: (row: Row) => string
  /** Boş satıra ilk yazımda satırın öbür alanları. */
  newRow?: (rows: readonly Row[]) => Partial<Row>
  /** Dolunca boş satır yok. */
  maxRows?: number
  /** Gösterim (R41): boş satır yok, hiçbir hücre yazılmaz, satır silinmez ve çoğaltılmaz; seçim ve kopya kalır. */
  readOnly?: boolean
  /** `onChange`'e verilecek seçenek: `select`'te sütunun listesi, `ajax`'ta etiket önbelleği. */
  optionOf?: (def: ColumnDef<Row>, value: unknown) => OptionDef | undefined
  /** Satır yeni mi (`editable(row, { isNew })`); verilmezse açılışta olmayan satır yenidir. DataSheet kayıttan sonra değiştirir. */
  isNew?: (row: Row) => boolean
}

/** `cellState` bayrakları: hücre bunlarla çizilir (kenarlar seçim aralığının çerçevesi). */
export const CELL = {
  active: 1,
  selected: 2,
  editing: 4,
  top: 8,
  right: 16,
  bottom: 32,
  left: 64,
  /** Doldurma tutamacı bu hücrede (aralığın sağ altı). */
  handle: 128,
  /** Tutamaç sürüklenirken doldurulacak hücre. */
  fill: 256,
} as const

/**
 * Doldurma dizisi (Vue 07 §8): sayı sütununda en az iki kaynak sabit artışlıysa (1, 2, 3 / 10, 20) devam eder; değilse
 * null (kaynak tekrarlanır). Kaynak metinse (ondalık metin) sonuç da metin, kaynaktaki en çok basamakla.
 */
export function fillSeries(numeric: boolean, source: unknown[]): ((k: number) => unknown) | null {
  if (!numeric || source.length < 2) return null
  const nums = source.map((v) => (isEmptyValue(v) ? NaN : Number(v)))
  if (nums.some(Number.isNaN)) return null
  const places = Math.max(...source.map((v) => String(v).split('.')[1]?.length ?? 0))
  const round = (n: number) => Number(n.toFixed(places))
  const step = round(nums[1]! - nums[0]!)
  if (nums.some((n, i) => i > 0 && round(n - nums[i - 1]!) !== step)) return null
  const asText = typeof source[0] === 'string'
  return (k) => (asText ? (nums[0]! + step * k).toFixed(places) : round(nums[0]! + step * k))
}

// Hücrede düzenlenen türler; object/array pencereyle (F4).
const INLINE = new Set([
  'ajax',
  'string',
  'text',
  'uppercase',
  'lowercase',
  'int',
  'decimal',
  'percentage',
  'currency',
  'select',
  'date',
  'datetime',
])

interface Patch {
  id: string
  col: string
  before: unknown
  after: unknown
}
interface Step {
  patches: Patch[]
  /** Bu adımda doğan satırlar: geri alınınca kalkar, yinelenince `newRow`'un verdiğiyle geri gelir. */
  added: Array<{ id: string; base: object }>
  /** Bu adımda silinen satırlar (silinmeden önceki sırayla): geri alınınca yerlerine döner. */
  removed: Array<{ id: string; row: object; index: number }>
}

const HISTORY = 100

/** Boş değerler (null / undefined / '' / []) birbirine eşittir. */
// Ondalıkta değere bakılır ("120.0000" = "120"): F2 + Enter değişiklik saymaz (R35).
export const same = (a: unknown, b: unknown): boolean =>
  (isEmptyValue(a) && isEmptyValue(b)) || Object.is(a, b) || sameDecimal(a, b)

export function writePath<Row extends object>(row: Row, path: string, value: unknown): Row {
  const keys = path.split('.')
  const out = { ...row } as Record<string, unknown>
  let o = out
  for (const k of keys.slice(0, -1)) {
    const next = o[k]
    o[k] = next && typeof next === 'object' ? { ...(next as object) } : {}
    o = o[k] as Record<string, unknown>
  }
  o[keys[keys.length - 1]!] = value
  return out as Row
}

export function createSheetStore<Row extends object>(options: SheetStoreOptions<Row>) {
  let o = options
  let rows = o.rows
  const listeners = new Set<() => void>()
  const tempIds = new WeakMap<object, string>()
  let counter = 0
  const idOf = (row: Row): string => {
    if (o.getRowId) return o.getRowId(row)
    let id = tempIds.get(row)
    if (!id) tempIds.set(row, (id = `r${++counter}`))
    return id
  }
  // Uygulama satırı yeni nesneyle değiştirince (fiyat yazdı, form kütüphanesi kopyaladı) geçici kimlik kaybolmasın:
  // kimliği olmayan nesne, aynı sıradaki ve yeni dizide artık bulunmayan eski nesnenin kimliğini alır. Sıra
  // değiştirilip aynı anda kopyalanan satırlarda tutmaz; o durumda `getRowId` verilir.
  const inherit = (prev: readonly Row[], next: readonly Row[]) => {
    let kept: Set<Row> | null = null
    next.forEach((row, i) => {
      if (tempIds.has(row)) return
      const old = prev[i]
      if (!old) return
      kept ??= new Set(next)
      const id = tempIds.get(old)
      if (id && !kept.has(old)) tempIds.set(row, id)
    })
  }
  // Açılışta olan satırlar "yeni" değildir (`editable(row, { isNew })`).
  const initial = new Set(rows.map(idOf))
  const isNewRow = (row: Row | undefined) => !row || (o.isNew ? o.isNew(row) : !initial.has(idOf(row)))

  let active: CellPos | null = null
  let anchor: CellPos | null = null
  // Tutamaç sürüklenirken hedefin son satırı.
  let fillEnd: number | null = null
  // `text`: editörün ham metni (yazarak açılışta yazılan harf); sanal kaydırmada editör yeniden çizilince kaybolmasın.
  let editing: { pos: CellPos; draft: unknown; text?: string } | null = null
  const undoStack: Step[] = []
  const redoStack: Step[] = []

  const emit = () => {
    for (const l of listeners) l()
  }
  const full = () => !!o.readOnly || (o.maxRows !== undefined && rows.length >= o.maxRows)
  const rowCount = () => rows.length + (full() ? 0 : 1)
  // Tümü / sütun seçimi son dolu satırda biter: boş satır veri değil, giriş yeri (satır menüsü ona düşmesin).
  const lastRow = () => Math.max(rows.length, 1) - 1
  const colCount = () => o.columns.length
  const clampPos = (p: CellPos): CellPos => ({
    row: Math.min(Math.max(p.row, 0), rowCount() - 1),
    col: Math.min(Math.max(p.col, 0), colCount() - 1),
  })

  const range = () => {
    if (!active) return null
    const a = anchor ?? active
    return {
      top: Math.min(a.row, active.row),
      bottom: Math.max(a.row, active.row),
      left: Math.min(a.col, active.col),
      right: Math.max(a.col, active.col),
    }
  }

  const read = (rowIndex: number, def: ColumnDef<Row>): unknown => {
    const row = rows[rowIndex]
    if (!row) return null
    return def.accessor ? def.accessor(row) : readPath(row, def.id)
  }

  /** Sütun düzenlenebilir türde mi (satıra bakmadan): satır penceresinde alan olur. */
  const isField = (col: number): boolean => {
    const def = o.columns[col]
    return (
      !o.readOnly &&
      !!def &&
      !def.accessor &&
      def.editable !== false &&
      (INLINE.has(def.type) || def.type === 'boolean' || !!def.editor?.window)
    )
  }
  const canEdit = (rowIndex: number, col: number): boolean => {
    if (!isField(col)) return false
    const def = o.columns[col]!
    if (typeof def.editable !== 'function') return true
    const row = rows[rowIndex]
    // Boş satır: henüz satır yok, sütunun kuralı boş nesneyle sorulur.
    return def.editable(row ?? ({} as Row), { isNew: isNewRow(row) })
  }

  /** Hücrelere yazar; tek kullanıcı işlemi tek geri al adımıdır. Boş satıra yazmak satırı doğurur. */
  const write = (
    cells: Array<{ row: number; col: number; value: unknown }>,
    kind: SheetChange['kind'],
    // Yapıştırma boş Excel satırını da satır yapar: yoksa ardındaki satırların sırası kayar ve hepsi düşerdi.
    create = false,
  ) => {
    const next = [...rows]
    const patches: Patch[] = []
    const added: Step['added'] = []
    const changed: SheetChange['cells'] = []
    // Aynı işlemde `onChange`'in yazdığı alanı boş bir hücre ezmez: Excel'den kod + boş Ad yapıştırılınca Ad üründen
    // gelir; dolu Ad yazılanı ezer.
    const derived = new Set<string>()
    const put = (index: number, path: string, value: unknown) => {
      const row = next[index]!
      const id = idOf(row)
      const updated = writePath(row, path, value)
      if (!o.getRowId) tempIds.set(updated, id)
      next[index] = updated
      patches.push({ id, col: path, before: readPath(row, path), after: value })
      if (!changed.some((c) => c.row === index && c.column === path)) changed.push({ row: index, column: path })
    }
    for (const c of cells) {
      const def = o.columns[c.col]
      if (!def) continue
      let row = next[c.row]
      if (!row) {
        if (c.row !== next.length || (!create && isEmptyValue(c.value))) continue
        if (o.maxRows !== undefined && next.length >= o.maxRows) continue
        // Doğan satır `newRow`'un alanlarıyla başlar; onlar patch değil satırın tabanıdır (geri al satırı kaldırır).
        const base = { ...o.newRow?.(next) }
        row = base as Row
        added.push({ id: idOf(row), base })
        next.push(row)
      } else if (same(readPath(row, def.id), c.value)) continue
      else if (isEmptyValue(c.value) && derived.has(`${c.row}:${def.id}`)) continue
      put(c.row, def.id, c.value)
      const extra = def.onChange?.(next[c.row]!, c.value, { option: o.optionOf?.(def, c.value), rows: next })
      for (const [path, value] of Object.entries(extra ?? {})) {
        derived.add(`${c.row}:${path}`)
        if (!same(readPath(next[c.row], path), value)) put(c.row, path, value)
      }
    }
    if (!patches.length && !added.length) return false
    rows = next
    record({ patches, added, removed: [] })
    o.onRowsChange(next, { kind, cells: changed })
    emit()
    return true
  }

  const record = (step: Step) => {
    undoStack.push(step)
    if (undoStack.length > HISTORY) undoStack.shift()
    redoStack.length = 0
  }

  const colIndex = (id: string) => o.columns.findIndex((c) => c.id === id)

  /** Geri al / yinele: hücre o adımdan sonra başka biri (uygulama) tarafından değiştirildiyse atlanır (§8). */
  const replay = (step: Step, dir: 'undo' | 'redo') => {
    let next = [...rows]
    const at = new Map(next.map((r, i) => [idOf(r), i]))
    if (dir === 'redo')
      for (const { id, base } of step.added) {
        if (at.has(id)) continue
        const row = { ...base } as Row
        if (!o.getRowId) tempIds.set(row, id)
        at.set(id, next.push(row) - 1)
      }
    const changed: SheetChange['cells'] = []
    let first: CellPos | null = null
    for (const p of dir === 'undo' ? [...step.patches].reverse() : step.patches) {
      const i = at.get(p.id)
      if (i === undefined) continue
      const [from, to] = dir === 'undo' ? [p.after, p.before] : [p.before, p.after]
      if (!same(readPath(next[i], p.col), from)) continue
      const updated = writePath(next[i]!, p.col, to)
      if (!o.getRowId) tempIds.set(updated, p.id)
      next[i] = updated
      changed.push({ row: i, column: p.col })
      // `onChange`'in yazdığı alanın sütunu olmayabilir: odak ilk sütunlu hücreye.
      const col = colIndex(p.col)
      if (col >= 0) first ??= { row: i, col }
    }
    if (dir === 'undo' && step.added.length) {
      const drop = new Set(step.added.map((a) => a.id))
      next = next.filter((r) => !drop.has(idOf(r)))
    }
    if (step.removed.length) {
      if (dir === 'undo') for (const r of step.removed) next.splice(Math.min(r.index, next.length), 0, r.row as Row)
      else {
        const drop = new Set(step.removed.map((r) => r.id))
        next = next.filter((r) => !drop.has(idOf(r)))
      }
      first ??= { row: Math.min(step.removed[0]!.index, Math.max(next.length - 1, 0)), col: active?.col ?? 0 }
    }
    rows = next
    if (first) {
      active = clampPos(first)
      anchor = null
    }
    if (changed.length || step.added.length || step.removed.length) o.onRowsChange(next, { kind: dir, cells: changed })
    emit()
  }

  const setActive = (pos: CellPos, extend = false) => {
    const p = clampPos(pos)
    if (extend) anchor ??= active ?? p
    else anchor = null
    active = p
    emit()
  }

  const commit = (): boolean => {
    if (!editing) return false
    const { pos, draft } = editing
    editing = null
    if (!write([{ row: pos.row, col: pos.col, value: draft === '' ? null : draft }], 'edit')) emit()
    return true
  }

  const store = {
    subscribe(l: () => void) {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    /** Her render'da: uygulamanın güncel satırları ve sütunları (depo kendi yazdığını beklemeden kullanır). */
    sync(next: SheetStoreOptions<Row>) {
      o = next
      if (!o.getRowId && next.rows !== rows) inherit(rows, next.rows)
      rows = next.rows
      if (active) active = clampPos(active)
    },
    rows: () => rows,
    rowCount,
    rowId: (index: number) => (rows[index] ? idOf(rows[index]) : null),
    isNew: (index: number) => isNewRow(rows[index]),
    read,
    canEdit,
    isField,
    active: () => active,
    range,
    editing: () => editing,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    /** Kayıttan sonra (Vue 07 §12): kaydedilen satır geri alınamaz. */
    clearHistory() {
      undoStack.length = 0
      redoStack.length = 0
      emit()
    },

    /** Hücrenin bayrakları (`CELL`); ilkel değer: `useSyncExternalStore` yalnız değişince yeniden çizer. */
    cellState(row: number, col: number): number {
      if (!active) return 0
      let s = 0
      if (active.row === row && active.col === col) s |= CELL.active
      if (editing && editing.pos.row === row && editing.pos.col === col) s |= CELL.editing
      const r = range()!
      if (anchor && row >= r.top && row <= r.bottom && col >= r.left && col <= r.right) {
        s |= CELL.selected
        if (row === r.top) s |= CELL.top
        if (row === r.bottom) s |= CELL.bottom
        if (col === r.left) s |= CELL.left
        if (col === r.right) s |= CELL.right
      }
      if (!o.readOnly && !editing && fillEnd === null && row === r.bottom && col === r.right && row < rows.length)
        s |= CELL.handle
      if (fillEnd !== null && row > r.bottom && row <= fillEnd && col >= r.left && col <= r.right) {
        s |= CELL.fill
        if (row === fillEnd) s |= CELL.bottom
        if (col === r.left) s |= CELL.left
        if (col === r.right) s |= CELL.right
      }
      return s
    },

    focus: (pos: CellPos, extend = false) => {
      if (editing) commit()
      setActive(pos, extend)
    },
    move(dir: Direction, extend = false) {
      const from = active ?? { row: 0, col: 0 }
      const d = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[dir]
      setActive({ row: from.row + d[0]!, col: from.col + d[1]! }, extend)
    },
    /**
     * ⌘ + yön: o yönde en sona; aşağıda son dolu satıra (boş satıra ↓ ile inilir, ⌘↓ her seferinde onu bulmasın).
     * `extend`: ⌘⇧ + yön seçimi oraya kadar büyütür.
     */
    jump(dir: Direction, extend = false) {
      const a = active ?? { row: 0, col: 0 }
      const to = {
        up: { row: 0, col: a.col },
        down: { row: Math.max(a.row, rows.length - 1), col: a.col },
        left: { row: a.row, col: 0 },
        right: { row: a.row, col: colCount() - 1 },
      }[dir]
      setActive(to, extend)
    },
    /** Tab: satır sonunda sonraki satırın başına, ⇧Tab tersine (Tab sırası sütun sırasıdır). */
    tab(back: boolean) {
      const a = active ?? { row: 0, col: -1 }
      const last = colCount() - 1
      if (!back) setActive(a.col < last ? { row: a.row, col: a.col + 1 } : { row: a.row + 1, col: 0 })
      else
        setActive(
          a.col > 0 ? { row: a.row, col: a.col - 1 } : { row: Math.max(a.row - 1, 0), col: a.row > 0 ? last : 0 },
        )
    },
    /** Home / End: satırın başı / sonu; ana tuşla ilk / son satır. */
    edge(end: boolean, rowsToo: boolean, extend = false) {
      const a = active ?? { row: 0, col: 0 }
      setActive({ row: rowsToo ? (end ? rowCount() - 1 : 0) : a.row, col: end ? colCount() - 1 : 0 }, extend)
    },
    page(dir: 1 | -1, size: number, extend = false) {
      const a = active ?? { row: 0, col: 0 }
      setActive({ row: a.row + dir * Math.max(1, size), col: a.col }, extend)
    },
    selectAll() {
      anchor = { row: 0, col: 0 }
      active = { row: lastRow(), col: colCount() - 1 }
      emit()
    },
    selectRow() {
      const a = active ?? { row: 0, col: 0 }
      anchor = { row: a.row, col: 0 }
      active = { row: a.row, col: colCount() - 1 }
      emit()
    },
    selectColumn() {
      const a = active ?? { row: 0, col: 0 }
      anchor = { row: 0, col: a.col }
      active = { row: lastRow(), col: a.col }
      emit()
    },
    /** Esc: seçim aktif hücreye daralır. */
    collapse() {
      if (!anchor) return
      anchor = null
      emit()
    },

    /** F2 / çift tık (seed yok: mevcut değer) ya da yazarak açılış (seed: yazılan harf). boolean'ın düzenlemesi yok. */
    startEdit(seed?: string): boolean {
      if (!active || !canEdit(active.row, active.col)) return false
      const def = o.columns[active.col]!
      if (def.type === 'boolean' || def.editor?.window) return false
      // `ajax`'ta yazılan harf aramadır, değer değil: listeden seçilene kadar taslak eski değerdir.
      const draft = seed === undefined || def.type === 'ajax' ? read(active.row, def) : seed
      editing = { pos: active, draft, text: seed }
      anchor = null
      emit()
      return true
    },
    /** Editörün değeri; bildirim yok (hücre editörü kendi durumunu çizer). */
    setDraft(value: unknown, text?: string) {
      if (editing) editing = { ...editing, draft: value, text }
    },
    commit,
    cancel() {
      if (!editing) return
      editing = null
      emit()
    },
    /** Satır penceresinin taslağı: alana yazılan değer `onChange`'in yazdıklarıyla (Ürün → Ad); depoya yazmaz. */
    preview(row: Row, col: number, value: unknown, option?: OptionDef): Row {
      const def = o.columns[col]!
      let next = writePath(row, def.id, value)
      const extra = def.onChange?.(next, value, { option: option ?? o.optionOf?.(def, value), rows })
      for (const [path, v] of Object.entries(extra ?? {})) next = writePath(next, path, v)
      return next
    },
    /** Satır penceresinin Tamam'ı: değişen alanlar sütun sırasıyla, tek geri al adımı. Satır yoksa doğar. */
    setRow(index: number, draft: Row): boolean {
      const base = rows[index] ?? ({ ...o.newRow?.(rows) } as Row)
      const cells: Array<{ row: number; col: number; value: unknown }> = []
      o.columns.forEach((def, col) => {
        const value = readPath(draft, def.id)
        if (canEdit(index, col) && !same(readPath(base, def.id), value)) cells.push({ row: index, col, value })
      })
      return write(cells, 'edit')
    },
    /** Yeni satırın başlangıcı (satır penceresinde "Satır ekle"). */
    blankRow: (): Row => ({ ...o.newRow?.(rows) }) as Row,
    /** Tek hücreye yazar (balondaki yakın seçenek önerisi); tek geri al adımı. */
    set(pos: CellPos, value: unknown) {
      if (canEdit(pos.row, pos.col)) write([{ ...pos, value }], 'edit')
    },
    /**
     * Yapıştırma (Vue 07 §7): aktif hücreden başlar; tek değer + aralık seçiliyse aralığın hepsine yazılır. Kilitli hücre
     * atlanır, alttan taşan satırlar yeni satır olur; `maxRows`'u aşanlar alınmaz ve sayısı döner. Tek geri al adımı;
     * yapıştırılan alan seçili kalır. `value` metni sütunun değerine çevirir (çözümleme, `ajax` eşleşmesi); `i`, `j` metnin
     * matristeki yeridir, `undefined` hücreyi atlar.
     */
    paste(
      matrix: string[][],
      value: (def: ColumnDef<Row>, text: string, i: number, j: number) => unknown,
    ): { skipped: number } {
      if (o.readOnly || editing || !active || !matrix.length) return { skipped: 0 }
      const r = range()!
      const single = matrix.length === 1 && matrix[0]!.length === 1
      const height = single && anchor ? r.bottom - r.top + 1 : matrix.length
      const width = single && anchor ? r.right - r.left + 1 : Math.max(...matrix.map((m) => m.length))
      const limit = o.maxRows ?? Infinity
      const cells: Array<{ row: number; col: number; value: unknown }> = []
      let skipped = 0
      for (let i = 0; i < height; i++) {
        const row = r.top + i
        if (row >= limit) {
          skipped++
          continue
        }
        for (let j = 0; j < width; j++) {
          const col = r.left + j
          const def = o.columns[col]
          const text = single ? matrix[0]![0] : matrix[i]![j]
          if (!def || text === undefined || !canEdit(row, col)) continue
          const v = single ? value(def, text, 0, 0) : value(def, text, i, j)
          // undefined: yapıştırılamaz (pencere sütununa dışarıdan metin), hücre olduğu gibi kalır.
          if (v !== undefined) cells.push({ row, col, value: v })
        }
      }
      write(cells, 'paste', true)
      const bottom = Math.min(r.top + height - skipped, rows.length + 1) - 1
      anchor = { row: r.top, col: r.left }
      active = clampPos({ row: Math.max(bottom, r.top), col: r.left + width - 1 })
      emit()
      return { skipped }
    },
    /**
     * ⌘D (Excel): aralıkta ilk satır altındakilere kopyalanır; tek satırda üstteki satır aşağı gelir. Kilitli hücre
     * atlanır; tek geri al adımı.
     */
    fill() {
      const r = range()
      if (!r || editing) return
      const source = r.top === r.bottom ? r.top - 1 : r.top
      if (source < 0 || source >= rows.length) return
      const cells: Array<{ row: number; col: number; value: unknown }> = []
      for (let row = source + 1; row <= Math.min(r.bottom, rows.length - 1); row++)
        for (let col = r.left; col <= r.right; col++)
          if (canEdit(row, col)) cells.push({ row, col, value: readPath(rows[source]!, o.columns[col]!.id) })
      write(cells, 'fill')
    },
    /** DataSheet içe aktarması: hücreler satır sırasıyla, listenin sonundakiler satır doğurur; kilitli hücre atlanır. Tek geri al adımı. */
    importCells(cells: Array<{ row: number; col: number; value: unknown }>): boolean {
      if (o.readOnly || editing) return false
      return write(
        cells.filter((c) => canEdit(c.row, c.col)),
        'import',
        true,
      )
    },
    /** Tutamaç sürüklenirken hedef satır (aralığın altı; yalnız var olan satırlar). */
    previewFill(to: number) {
      const r = range()
      const next = r && to > r.bottom ? Math.min(to, rows.length - 1) : null
      if (next === fillEnd || (next !== null && next <= r!.bottom)) return
      fillEnd = next
      emit()
    },
    /** Tutamaç bırakıldı: kaynak aralık hedefe kadar doldurulur, seçim doldurulanı kapsar. Kilitli hücre atlanır. */
    endFill() {
      const r = range()
      const end = fillEnd
      fillEnd = null
      if (!r || end === null || editing) return emit()
      const cells: Array<{ row: number; col: number; value: unknown }> = []
      for (let col = r.left; col <= r.right; col++) {
        const def = o.columns[col]!
        const source = rows.slice(r.top, r.bottom + 1).map((row) => readPath(row, def.id))
        const series = fillSeries(isNumericType(def.type), source)
        for (let row = r.bottom + 1; row <= end; row++) {
          const k = row - r.top
          if (canEdit(row, col)) cells.push({ row, col, value: series ? series(k) : source[k % source.length] })
        }
      }
      anchor = { row: r.top, col: r.left }
      active = { row: end, col: r.right }
      if (!write(cells, 'fill')) emit()
    },
    /** Seçimdeki satırları siler (menü); geri alınınca yerlerine döner. Boş satır silinmez. */
    removeRows() {
      const r = range()
      if (!r || o.readOnly) return
      const indexes: number[] = []
      for (let i = r.top; i <= Math.min(r.bottom, rows.length - 1); i++) indexes.push(i)
      if (!indexes.length) return
      editing = null
      const removed = indexes.map((index) => ({ id: idOf(rows[index]!), row: rows[index]!, index }))
      const drop = new Set(indexes)
      rows = rows.filter((_, i) => !drop.has(i))
      record({ patches: [], added: [], removed })
      anchor = null
      active = clampPos({ row: r.top, col: active?.col ?? 0 })
      o.onRowsChange([...rows], { kind: 'remove', cells: [] })
      emit()
    },
    /**
     * Seçimdeki satırları sona kopyalar (pano 1e · "N satırı çoğalt"; sıralanmayan ızgarada araya ekleme yok). Kopya
     * `newRow`'un tabanına yalnız sütunların alanlarını alır: satır kimliği ve sütunu olmayan alanlar (kaynak bağı)
     * taşınmaz. `maxRows`'u aşanlar alınmaz. Geri alınınca kopyalar kalkar.
     */
    duplicate() {
      const r = range()
      if (!r || editing || o.readOnly) return
      const room = (o.maxRows ?? Infinity) - rows.length
      const copies: Row[] = []
      for (let i = r.top; i <= Math.min(r.bottom, rows.length - 1) && copies.length < room; i++) {
        let copy = { ...o.newRow?.(rows) } as Row
        for (const def of o.columns) {
          const value = def.accessor ? undefined : readPath(rows[i], def.id)
          if (value !== undefined) copy = writePath(copy, def.id, value)
        }
        copies.push(copy)
      }
      if (!copies.length) return
      record({ patches: [], added: copies.map((row) => ({ id: idOf(row), base: row })), removed: [] })
      rows = [...rows, ...copies]
      anchor = null
      active = { row: rows.length - copies.length, col: active?.col ?? 0 }
      o.onRowsChange([...rows], { kind: 'duplicate', cells: [] })
      emit()
    },
    /** Space: boolean hücresini çevirir; listeli hücrede (select, ajax) listeyi açar, F2 gibi. */
    toggle() {
      if (!active || !canEdit(active.row, active.col)) return
      const def = o.columns[active.col]!
      if (def.type === 'boolean') write([{ ...active, value: read(active.row, def) !== true }], 'edit')
      else if (def.type === 'select' || def.type === 'ajax') this.startEdit()
    },
    /** Delete / Backspace: seçimdeki düzenlenebilir hücreleri boşaltır (boş satıra dokunmaz). */
    clear() {
      const r = range()
      if (!r) return
      const cells: Array<{ row: number; col: number; value: unknown }> = []
      for (let row = r.top; row <= Math.min(r.bottom, rows.length - 1); row++)
        for (let col = r.left; col <= r.right; col++)
          if (canEdit(row, col) && !o.columns[col]!.editor?.window) cells.push({ row, col, value: null })
      write(cells, 'edit')
    },
    undo() {
      if (editing) return
      const step = undoStack.pop()
      if (!step) return
      redoStack.push(step)
      replay(step, 'undo')
    },
    redo() {
      if (editing) return
      const step = redoStack.pop()
      if (!step) return
      undoStack.push(step)
      replay(step, 'redo')
    },
  }
  return store
}

export type SheetStore<Row extends object> = ReturnType<typeof createSheetStore<Row>>
