// FormGrid (R34, docs/form-grid.md): formun içindeki satır dizisi; kontrollü, kaydetmez.
import type { Density } from './core'
import type { ColumnDef, OptionDef } from './columns'
import type { RowAction } from './list'

export interface FormGridChange {
  kind: 'edit' | 'paste' | 'fill' | 'remove' | 'duplicate' | 'undo' | 'redo'
  /** Değişen hücreler: satır sırası (yeni dizide) ve sütun id. */
  cells: Array<{ row: number; column: string }>
}

interface FormGridBase<Row extends object> {
  rows: Row[]
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
  /** false: ⌘F ızgara araması kapalı, tarayıcınınki çalışır (form-grid.md §8.1). */
  search?: boolean
  /** Varsayılan true: satırda kalem, ⌘↵ ve ⋯ › Satırı düzenle satır penceresini açar (§7). */
  rowDialog?: boolean
  /** ⋯ menüsü. */
  rowActions?: Array<RowAction<Row>>
  /** Varsayılan `standard` (formda 42 px satır, R40). */
  density?: Density
  /** false: çerçeve ve köşe yuvarlaklığı yok; ızgara içinde durduğu kartın kenarına oturur (belge detayı, R41). */
  frame?: boolean
}

/** Düzenlenen satırlar. */
interface FormGridEditing<Row extends object> extends FormGridBase<Row> {
  readOnly?: false
  /** Her düzenleme, geri al ve yinele yeni diziyle tek çağrı; eski dizi değişmez. */
  onRowsChange: (rows: Row[], change: FormGridChange) => void
  onRowOpen?: undefined
  rowHeight?: undefined
}

/**
 * Gösterim (R41): belgenin kaydedilmiş satırları. Boş satır, düzenleyici, yapıştırma, silme, doldurma ve satır
 * penceresi yok; seçim, kopya, ⌘F ve alt çubuğun seçim özeti kalır.
 */
interface FormGridShowing<Row extends object> extends FormGridBase<Row> {
  readOnly: true
  onRowsChange?: undefined
  /** Verilirse satırda aç düğmesi ve ⌘↵ satırı açar (satır detayı uygulamanın). */
  onRowOpen?: (row: Row) => void
  /** `auto`: satır içeriği kadar uzar (çok satırlı hücre); varsayılan yoğunluğun sabit yüksekliği. */
  rowHeight?: 'auto'
}

export type FormGridProps<Row extends object> = FormGridEditing<Row> | FormGridShowing<Row>

/** Satır penceresinin bir alanı (`renderField`); değer taslaktır, Tamam'a kadar satıra yazılmaz. */
export interface RowFieldProps {
  /** Etiketin `htmlFor`'u; iç içe pencerelerde tekil. */
  id: string
  label: string
  hint?: string
  required: boolean
  /** Satır için kilitli (`editable(row)` false). */
  disabled: boolean
  /** Hücredeki hata ya da uyarının tam metni; alan değişince kalkar. */
  error?: string
  value: unknown
  /** `option`: seçilen seçenek (`ajax`), sütunun `onChange`'ine gider (Ürün → Ad). */
  onChange: (value: unknown, option?: OptionDef) => void
  row: object
}
