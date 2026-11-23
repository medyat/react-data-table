// FormGrid (R34, docs/form-grid.md): formun içindeki satır dizisi; kontrollü, kaydetmez.
import type { Density } from './core'
import type { ColumnDef } from './columns'
import type { RowAction } from './list'

export interface FormGridChange {
  kind: 'edit' | 'undo' | 'redo'
  /** Değişen hücreler: satır sırası (yeni dizide) ve sütun id. */
  cells: Array<{ row: number; column: string }>
}

export interface FormGridProps<Row extends object> {
  rows: Row[]
  /** Her düzenleme, geri al ve yinele yeni diziyle tek çağrı; eski dizi değişmez. */
  onRowsChange: (rows: Row[], change: FormGridChange) => void
  columns: Array<ColumnDef<Row>>
  /** role=grid aria-label. */
  label: string
  /** Verilmezse geçici kimlik (form-grid.md §2). */
  getRowId?: (row: Row) => string
  /**
   * Sunucu hataları: anahtar satır sırası + alan yolu ("3.detail.delivery_term"); en uzun ön eki sütun id'si olan
   * sütuna düşer, düşmeyen satırındır (form-grid.md §6).
   */
  errors?: Record<string, string | string[]>
  /** Boş satıra ilk değer yazılınca satırın öbür alanları (form-grid.md §5); yazılan hücre bunu ezer. */
  newRow?: (rows: readonly Row[]) => Partial<Row>
  /** Satır sınırı: dolunca alttaki boş satır kaybolur. */
  maxRows?: number
  /** ⋯ menüsü. */
  rowActions?: Array<RowAction<Row>>
  density?: Density
}
