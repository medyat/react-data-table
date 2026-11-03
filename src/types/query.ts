// api-draft.ts §3'ten türetildi: filtre, sıralama, sütun düzeni.
import type { IsoDate } from './core'

/** 18 operatör (04). Çok değerli hücrelerde (multiselect) `in` "şunlardan birini içerir" anlamındadır. */
export type FilterOp =
  | 'is_empty'
  | 'is_not_empty'
  | 'eq'
  | 'neq'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in'
  | 'not_in'
  | 'before'
  | 'after'
  | 'within'

export type DatePreset =
  'today' | 'this_week' | 'next_7_days' | 'this_month' | 'last_30_days' | 'this_quarter' | 'overdue'

/** `user` filtrelerinde oturumdaki kullanıcı. Sunucuda çözülür. */
export const ME = '@me' as const

/** Operatöre göre ayrışan koşul. `currency` sütununda değer düz sayıdır; para birimi `currency` alanıyla gelir. */
export type FilterCondition =
  | { column: string; op: 'is_empty' | 'is_not_empty' }
  | { column: string; op: 'eq' | 'neq'; value: string | number | boolean }
  | { column: string; op: 'contains' | 'not_contains' | 'starts_with' | 'ends_with'; value: string }
  | { column: string; op: 'gt' | 'gte' | 'lt' | 'lte'; value: number; currency?: string }
  /** Uçlar dahil; tek taraflıysa biri null. */
  | { column: string; op: 'between'; value: [number | null, number | null]; currency?: string }
  | { column: string; op: 'in' | 'not_in'; value: Array<string | number> }
  | { column: string; op: 'before' | 'after'; value: IsoDate | { preset: 'today' } }
  | { column: string; op: 'within'; value: { preset: DatePreset } | { from: IsoDate; to: IsoDate } }

export interface SortRule {
  column: string
  dir: 'asc' | 'desc'
}

export interface TableQuery {
  search: string
  filters: FilterCondition[]
  /** Öncelik sırasıyla, en fazla 3. */
  sort: SortRule[]
  /** Sayfa numarası 1'den başlar (Laravel simplePaginate ile aynı). */
  page: { number: number; size: number }
  /** Görünür sütun id'leri. */
  columns: string[]
  /** Sunucudan istenen alan yolları: görünür sütunların yolları + sütunların `fields`'i + tablonun `fields` prop'u. */
  fields: string[]
}

export type QueryWithoutPage = Omit<TableQuery, 'page'>

export type RequestReason = 'initial' | 'query' | 'page' | 'columns' | 'refresh'

/**
 * `@request` olayının yükü. Paket veri çekmez: uygulama bu sorguyla kendi HTTP'sini atar ve
 * `rows`, `hasMore`, `loading`, `error` prop'larını günceller. Her yeni talepte öncekinin `signal`'i abort edilir.
 */
export interface TableRequest {
  query: TableQuery
  reason: RequestReason
  signal: AbortSignal
}

/** `countable` tablolarda "Count total" → `@count`; uygulama `total` prop'unu verir. */
export interface CountRequest {
  query: QueryWithoutPage
  signal: AbortSignal
}

/** `true` genel hata; string mesaj; nesne: mesaj + hata kimliği ("Copy error ID"). */
export type TableError = boolean | string | { message?: string; id?: string }

export interface ColumnLayout {
  /** Görünür + gizli tüm sütunların sırası. */
  order: string[]
  /** Tanımlıysa beyaz liste: burada olmayan (sonradan eklenen) sütun gizlidir. */
  visible: string[]
  /** Yalnızca varsayılandan farklı genişlikler. */
  widths: Record<string, number>
  pinned: { left: string[]; right: string[] }
}
