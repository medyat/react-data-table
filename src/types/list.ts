// R3/R4/R5: liste bileşeninin sözleşmesi. TanStack tipi yok (D23).
import type { View } from './views'
import type { ColumnDef, IconComponent } from './columns'
import type { Density, Plural } from './core'
import type { FilterCondition, QueryWithoutPage, SortRule } from './query'

/** Uygulamanın açabildiği durum (R5). Her alan ayrı ayrı controlled olabilir: `state`'te olan alan dışarıdan okunur. */
export interface TableState {
  /** Aktif görünümün kimliği (04 §7); `null`: görünüm yok ya da hiçbiri seçili değil. Verilmezse varsayılan görünüm açılır. */
  view: string | null
  /** Toolbar araması (D3): filtre değildir, görünüme girmez. */
  search: string
  /** Yalnızca tam koşullar; değeri seçilmemiş çip ekranda kalır, buraya girmez (04 §1). */
  filters: FilterCondition[]
  sort: SortRule[]
  /** 1 tabanlı. */
  page: number
  pageSize: number
}

export interface UseDataTableOptions<Row extends object> {
  /** Kalıcı kimlik: görünümler ve tercihler bununla saklanır (ör. "production-orders"). */
  id: string
  columns: Array<ColumnDef<Row>>
  /** İstemci modu: satırlar burada verilir, paket sıralar ve sayfalar; `request` kullanılmaz (R4). */
  rows?: Row[]
  /** Satır kimliği yolu. Varsayılan 'id'. */
  rowKey?: string
  /** Verilmezse tercihten (Display › Density), o da yoksa standard. */
  density?: Density
  /** Boş durum, hata ve sayfa metinlerinde: { one: 'order', other: 'orders' }. Verilmezse `id`. */
  entityName?: Plural
  /** Controlled alanlar (R5). */
  state?: Partial<TableState>
  /** Uncontrolled başlangıç. */
  initialState?: Partial<TableState>
  /** Her değişimde tam durum; controlled alanlar burada güncellenir. */
  onStateChange?: (state: TableState) => void
  /** Tercih yoksa sayfa boyutu. Varsayılan 100. */
  pageSize?: number
  /** Varsayılan [50, 100, 250, 500]. */
  pageSizes?: number[]
  /** System görünümler (04 §7, D4): kodda tanımlı, herkes görür; kişisel görünümler provider'ın `viewsAdapter`'ından. */
  views?: View[]
  /** Her istekte `fields`'e eklenen alanlar. */
  fields?: string[]
  /** Sunucu modu: footer'da "Count total". Sayı sorgu değişene kadar geçerli; `signal` sorgu değişince iptal edilir. */
  count?: (query: QueryWithoutPage, signal: AbortSignal) => Promise<number>
}

/**
 * Sorgu sonucu: TanStack Query'nin `UseQueryResult`'ının yapısal alt kümesi; `useQuery` sonucu dönüştürülmeden verilir (R4).
 * `placeholderData: keepPreviousData` önerilir: yoksa her sorgu değişiminde gövde iskelete döner.
 */
export interface DataTableResult<Row extends object> {
  status: 'pending' | 'error' | 'success'
  data?: {
    rows: Row[]
    /** Sonraki sayfa var mı (Laravel `next_page_url !== null`). */
    hasMore?: boolean
    /** Biliniyorsa toplam. */
    total?: number
  }
  /** `message` ve `id` alanları okunur: hata ekranı ve "Copy error ID". */
  error?: unknown
  isFetching?: boolean
  isPlaceholderData?: boolean
  dataUpdatedAt?: number
  /** Refresh, Retry ve `R` bunu çağırır; yoksa görünmezler. */
  refetch?: () => unknown
}

/** Satır aksiyonu (05 §4, D34, D36): ⋯ menüsünde; `inline` ise ⋯'nın solunda ikon düğmesi. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Row için üst sınır; api-draft ile aynı
export interface RowAction<Row = any> {
  id: string
  label: string
  /** Menüde etiketin altında ikinci satır (gerekçe varsa o); inline düğmede tooltip "Label — description" (D36). */
  description?: string
  icon?: IconComponent
  /** Gösterim için ("⌘↵"); paket kısayol bağlamaz. */
  shortcut?: string
  /** Yetkiye bağlı: false → ne menüde ne inline (D34). Duruma bağlı pasiflik için `disabled`. */
  when?: (row: Row) => boolean
  /** ⋯'nın solunda 28 px ikon düğmesi (`icon` zorunlu); o satırın menüsünde yer almaz. Satır başına ilk 2 (D36). */
  inline?: boolean
  /** true veya gerekçe metni ("Already running") → pasif, gerekçe ikinci satırda. */
  disabled?: (row: Row) => boolean | string
  destructive?: boolean
  /** Menüde üstündeki ayırıcı. */
  separatorBefore?: boolean
  /** Onay, toast ve refresh uygulamanın işidir; paket sonucu beklemez (D20). */
  run: (row: Row) => void | Promise<void>
}

/** Toplu aksiyon. Seçim sayfa kapsamlıdır (D19): `rows` o anda seçili, yüklü satırlardır. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Row için üst sınır; api-draft ile aynı
export interface BulkAction<Row = any> {
  id: string
  label: string
  /** Bar düğmesinde tooltip, ⋯ menüsünde ikinci satır (gerekçe varsa o) (D36). */
  description?: string
  icon?: IconComponent
  /** Bar'da görünür; değilse ⋯ menüsünde. Bar'da en fazla 3. */
  inBar?: boolean
  destructive?: boolean
  /** Yetkiye bağlı: false → bar'da ve menüde yok (D36). Duruma bağlı pasiflik için `disabled`. */
  when?: (rows: Row[]) => boolean
  disabled?: (rows: Row[]) => boolean | string
  run: (rows: Row[]) => void | Promise<void>
}

/** Satır gövdesine tıklama. Varsayılan 'none': metin seçilip kopyalanabilir, seçim ve açma yapmaz (D6). */
export type RowClickMode = 'none' | 'open' | 'expand'
