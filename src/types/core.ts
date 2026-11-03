// api-draft.ts §1'den türetildi. Public sözleşme; TanStack tipi yok (D23).
export type Density = 'comfortable' | 'standard' | 'compact'
export type RowKey = string | number
/** Tablo örneğinin kalıcı kimliği: görünümler ve tercihler bununla saklanır (ör. "production-orders"). */
export type TableId = string
/** ISO tarih ("2026-10-24") veya tarih-saat ("2026-10-24T09:42:00Z"). */
export type IsoDate = string
export type Tone = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'pink' | 'teal'
/** Çoğul biçimli metin: { one: 'status', other: 'statuses' } */
export interface Plural {
  one: string
  other: string
}
