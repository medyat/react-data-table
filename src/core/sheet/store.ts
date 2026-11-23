// Hücre motorunun deposu (form-grid.md §5): aktif hücre, seçim aralığı, düzenleme oturumu ve geri al React dışında
// durur; hücre `cellState` ile yalnız kendi bayrağını okur, ok tuşunda yalnız değişen hücreler yeniden çizilir.
// Veri uygulamanındır: her yazma yeni satır dizisiyle `onRowsChange`'e gider, depo yalnız kimlik ve geçmiş tutar.
// Satırların sonunda her zaman bir boş satır vardır (dizin = rows.length); ona yazmak satırı doğurur (`kind: 'edit'`).
import { sameDecimal } from '../format/decimal'
import type { ColumnDef } from '../../types/columns'
import { isEmptyValue } from '../cells/format'
import { readPath } from '../columns/read-path'

export interface CellPos {
  row: number
  col: number
}
export type Direction = 'up' | 'down' | 'left' | 'right'

export interface SheetChange {
  kind: 'edit' | 'undo' | 'redo'
  /** Değişen hücreler: satır sırası (değişiklikten sonraki dizide) ve sütun id. */
  cells: Array<{ row: number; column: string }>
}

export interface SheetStoreOptions<Row extends object> {
  rows: readonly Row[]
  columns: ReadonlyArray<ColumnDef<Row>>
  onRowsChange: (rows: Row[], change: SheetChange) => void
  /** Verilmezse satır nesnesine geçici kimlik (WeakMap); yazılan yeni nesne eskisinin kimliğini alır. */
  getRowId?: (row: Row) => string
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
} as const

// F1'de hücrede düzenlenen türler; ötekiler kendi fazında gelir (ajax F2, object/array pencere F4).
const INLINE = new Set([
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
])

interface Patch {
  id: string
  col: string
  before: unknown
  after: unknown
}
interface Step {
  patches: Patch[]
  /** Bu adımda doğan satırlar: geri alınınca kalkar, yinelenince boş olarak geri gelir. */
  added: string[]
}

const HISTORY = 100

/** Boş değerler (null / undefined / '' / []) birbirine eşittir. */
// Ondalıkta değere bakılır ("120.0000" = "120"): F2 + Enter değişiklik saymaz (R35).
const same = (a: unknown, b: unknown): boolean =>
  (isEmptyValue(a) && isEmptyValue(b)) || Object.is(a, b) || sameDecimal(a, b)

function writePath<Row extends object>(row: Row, path: string, value: unknown): Row {
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

  let active: CellPos | null = null
  let anchor: CellPos | null = null
  // `text`: editörün ham metni (yazarak açılışta yazılan harf); sanal kaydırmada editör yeniden çizilince kaybolmasın.
  let editing: { pos: CellPos; draft: unknown; text?: string } | null = null
  const undoStack: Step[] = []
  const redoStack: Step[] = []

  const emit = () => {
    for (const l of listeners) l()
  }
  const rowCount = () => rows.length + 1
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

  const canEdit = (rowIndex: number, col: number): boolean => {
    const def = o.columns[col]
    if (!def || def.accessor || !(INLINE.has(def.type) || def.type === 'boolean')) return false
    if (typeof def.editable !== 'function') return def.editable !== false
    const row = rows[rowIndex]
    // Boş satır: henüz satır yok, sütunun kuralı boş nesneyle sorulur.
    return def.editable(row ?? ({} as Row), { isNew: !row || !initial.has(idOf(row)) })
  }

  /** Hücrelere yazar; tek kullanıcı işlemi tek geri al adımıdır. Boş satıra yazmak satırı doğurur. */
  const write = (
    cells: Array<{ row: number; col: number; value: unknown }>,
    kind: SheetChange['kind'],
    record = true,
  ) => {
    const next = [...rows]
    const patches: Patch[] = []
    const added: string[] = []
    const changed: SheetChange['cells'] = []
    for (const c of cells) {
      const def = o.columns[c.col]
      if (!def) continue
      let row = next[c.row]
      if (!row) {
        if (c.row !== next.length || isEmptyValue(c.value)) continue
        row = {} as Row
        added.push(idOf(row))
      } else if (same(readPath(row, def.id), c.value)) continue
      const id = idOf(row)
      const before = readPath(row, def.id)
      const updated = writePath(row, def.id, c.value)
      if (!o.getRowId) tempIds.set(updated, id)
      next[c.row] = updated
      patches.push({ id, col: def.id, before, after: c.value })
      changed.push({ row: c.row, column: def.id })
    }
    if (!patches.length) return false
    rows = next
    if (record) {
      undoStack.push({ patches, added })
      if (undoStack.length > HISTORY) undoStack.shift()
      redoStack.length = 0
    }
    o.onRowsChange(next, { kind, cells: changed })
    emit()
    return true
  }

  const colIndex = (id: string) => o.columns.findIndex((c) => c.id === id)

  /** Geri al / yinele: hücre o adımdan sonra başka biri (uygulama) tarafından değiştirildiyse atlanır (§8). */
  const replay = (step: Step, dir: 'undo' | 'redo') => {
    let next = [...rows]
    const at = new Map(next.map((r, i) => [idOf(r), i]))
    if (dir === 'redo')
      for (const id of step.added) {
        if (at.has(id)) continue
        const row = {} as Row
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
      first ??= { row: i, col: colIndex(p.col) }
    }
    if (dir === 'undo' && step.added.length) {
      const drop = new Set(step.added)
      next = next.filter((r) => !drop.has(idOf(r)))
    }
    rows = next
    if (first) {
      active = clampPos(first)
      anchor = null
    }
    if (changed.length || step.added.length) o.onRowsChange(next, { kind: dir, cells: changed })
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
    isNew: (index: number) => !rows[index] || !initial.has(idOf(rows[index])),
    read,
    canEdit,
    active: () => active,
    range,
    editing: () => editing,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,

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
      active = { row: rowCount() - 1, col: colCount() - 1 }
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
      active = { row: rowCount() - 1, col: a.col }
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
      if (def.type === 'boolean') return false
      editing = { pos: active, draft: seed === undefined ? read(active.row, def) : seed, text: seed }
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
    /** Tek hücreye yazar (balondaki yakın seçenek önerisi); tek geri al adımı. */
    set(pos: CellPos, value: unknown) {
      if (canEdit(pos.row, pos.col)) write([{ ...pos, value }], 'edit')
    },
    /** Space: boolean hücresini çevirir. */
    toggle() {
      if (!active || !canEdit(active.row, active.col)) return
      const def = o.columns[active.col]!
      if (def.type === 'boolean') write([{ ...active, value: read(active.row, def) !== true }], 'edit')
    },
    /** Delete / Backspace: seçimdeki düzenlenebilir hücreleri boşaltır (boş satıra dokunmaz). */
    clear() {
      const r = range()
      if (!r) return
      const cells: Array<{ row: number; col: number; value: unknown }> = []
      for (let row = r.top; row <= Math.min(r.bottom, rows.length - 1); row++)
        for (let col = r.left; col <= r.right; col++) if (canEdit(row, col)) cells.push({ row, col, value: null })
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
