// R3/R4: liste bileşeninin sözleşmesi. TanStack tipi yok (D23).
import type { ColumnDef } from './columns'
import type { Density } from './core'

export interface UseDataTableOptions<Row extends object> {
  /** Kalıcı kimlik: görünümler ve tercihler bununla saklanır (ör. "production-orders"). */
  id: string
  columns: Array<ColumnDef<Row>>
  /** İstemci modu: satırlar burada verilir, paket filtreler, sıralar, sayfalar (R4). */
  rows?: Row[]
  /** Satır kimliği yolu. Varsayılan 'id'. */
  rowKey?: string
  /** Varsayılan 'standard'. */
  density?: Density
}

/**
 * Sorgu sonucu: TanStack Query'nin `UseQueryResult`'ının yapısal alt kümesi; `useQuery` sonucu dönüştürülmeden verilir (R4).
 * Faz 2'de hata, yenileme ve sayfa alanları eklenir.
 */
export interface DataTableResult<Row extends object> {
  status: 'pending' | 'error' | 'success'
  data?: { rows: Row[] }
}
