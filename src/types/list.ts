// R3/R4/R5: liste bileşeninin sözleşmesi. TanStack tipi yok (D23).
import type { ColumnDef } from './columns'
import type { Density, Plural } from './core'
import type { FilterCondition, QueryWithoutPage, SortRule } from './query'

/** Uygulamanın açabildiği durum (R5). Her alan ayrı ayrı controlled olabilir: `state`'te olan alan dışarıdan okunur. */
export interface TableState {
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
