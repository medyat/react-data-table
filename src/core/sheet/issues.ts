// Izgaranın bütün sorunları tek geçişte (form-grid.md §6): sunucu hatası (`mapErrors`) önce, yoksa istemci kuralı
// (`cellIssue`: tip → validate → warn). Sütuna düşmeyen satır hatası satırın ilk hücresinde de gösterilir: klavyeyle
// "hataya git" oraya iner, gutter ikonu yalnız fareyle okunur. Liste, gezinme ve alt çubuk sayısı veriden (DOM'dan değil).
import type { ColumnDef } from '../../types/columns'
import type { I18n } from '../i18n'
import type { MappedErrors } from './errors'
import type { CellPos } from './store'
import { cellIssue, type Issue } from './validate'

export interface GridIssues {
  /** satır sırası → sütun id → sorun */
  cells: Map<number, Map<string, Issue>>
  /** satır sırası → sütuna düşmeyen sunucu mesajları (gutter) */
  rows: Map<number, string[]>
  /** Hatalı hücreler satır satır, soldan sağa (F8 sırası); uyarı girmez. */
  order: CellPos[]
  /** Hatası olan satır sayısı (alt çubuk). */
  errorRows: number
}

export function collectIssues<Row extends object>(o: {
  rows: readonly Row[]
  columns: ReadonlyArray<ColumnDef<Row>>
  errors: MappedErrors
  read: (index: number, def: ColumnDef<Row>) => unknown
  isNew: (index: number) => boolean
  i18n: I18n
}): GridIssues {
  const cells = new Map<number, Map<string, Issue>>()
  const order: CellPos[] = []
  let errorRows = 0
  o.rows.forEach((row, r) => {
    const server = o.errors.cells.get(r)
    const rowMessages = o.errors.rows.get(r) ?? []
    let found: Map<string, Issue> | undefined
    let hasError = false
    o.columns.forEach((def, c) => {
      const messages = [...(c === 0 ? rowMessages : []), ...(server?.get(def.id) ?? [])]
      const issue: Issue | null = messages.length
        ? { level: 'error', message: messages.join('\n') }
        : cellIssue(def, o.read(r, def), { row, rows: o.rows, isNew: o.isNew(r) }, o.i18n)
      if (!issue) return
      ;(found ??= new Map()).set(def.id, issue)
      if (issue.level === 'error') {
        hasError = true
        order.push({ row: r, col: c })
      }
    })
    if (found) cells.set(r, found)
    if (hasError) errorRows++
  })
  return { cells, rows: o.errors.rows, order, errorRows }
}

/** Aktif hücreden sonraki (dir 1) ya da önceki (dir -1) hata (⌘F'de eşleşme); uçta başa döner. Yoksa null. */
export function nextError(order: readonly CellPos[], from: CellPos | null, dir: 1 | -1): CellPos | null {
  if (!order.length) return null
  if (!from) return dir === 1 ? order[0]! : order[order.length - 1]!
  const after = (p: CellPos) => p.row > from.row || (p.row === from.row && p.col > from.col)
  const before = (p: CellPos) => p.row < from.row || (p.row === from.row && p.col < from.col)
  if (dir === 1) return order.find(after) ?? order[0]!
  for (let i = order.length - 1; i >= 0; i--) if (before(order[i]!)) return order[i]!
  return order[order.length - 1]!
}
