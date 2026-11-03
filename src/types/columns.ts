// api-draft.ts §2'den türetildi: sütun tanımı, özel hücre, hücre aksiyonu. Sheet'e ait alanlar yok (R1).
import type { ComponentType, ReactNode } from 'react'
import type { Density, IsoDate, Plural, Tone } from './core'
import type { FilterOp } from './query'

/** 23 tip. `type` zorunludur; veriden çıkarsama yoktur. */
export type ColumnType =
  // sayı
  | 'int'
  | 'float'
  | 'percentage'
  | 'star'
  | 'currency'
  // metin
  | 'string'
  | 'text'
  | 'uppercase'
  | 'lowercase'
  | 'phone'
  | 'color'
  | 'email'
  | 'url'
  | 'id'
  // seçim
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'ajax'
  | 'user'
  // tarih
  | 'date'
  | 'datetime'
  // yapısal (object: sıralanmaz, filtrelenmez — özel içerik için kaçış kapısı)
  | 'object'
  | 'array'

export interface OptionDef {
  value: string | number
  label: string
  /** Hazır ton veya tema başına açık renk. Verilmezse 'gray'. */
  tone?: Tone | { light: string; dark: string }
  description?: string
}

export interface UserOption extends OptionDef {
  avatarUrl?: string
  /** Avatar yoksa gösterilecek baş harfler; verilmezse label'dan üretilir. */
  initials?: string
}

/** `ajax` ve `user` sütunlarının seçenek kaynağı (sütunun kendi verisi; metin filtresi önerisi değildir). */
export interface RemoteOptions<O extends OptionDef = OptionDef> {
  /** Yazdıkça arama. Varsayılan sayfa boyutu 20. */
  search: (q: string, page: number, ctx: { signal: AbortSignal }) => Promise<{ items: O[]; hasMore: boolean }>
  /** Kayıtlı filtre değerlerinin, yapıştırılan değerlerin ve hücre değerlerinin etiketlerini çözer. */
  resolve: (values: Array<string | number>, ctx: { signal: AbortSignal }) => Promise<O[]>
  pageSize?: number
}

/** Özel hücre içeriğine verilen bağlam. `value` tipe göre daralır (int → number | null, select → string | number | null …). */
export interface CellContext<Row, V = unknown> {
  row: Row
  value: V
  /** Tipin varsayılan biçimlendirmesi ("12,400", "Oct 24"); özel içerik bunu sarabilir. */
  formatted: string
  column: { id: string; type: ColumnType }
  density: Density
}

/**
 * Özel hücre içeriği: bağlamdan ReactNode döndüren fonksiyon. Hook çağıran içerik bir bileşene sarılır
 * (`cell: (ctx) => <Owner {...ctx} />`): fonksiyon her satır için düz çağrılır.
 * Tipin kabuğu (hizalama, kesme, boş değer, yoğunluk, hover) korunur; yalnızca içerik değişir.
 */
export type CellRender<Row, V = unknown> = (ctx: CellContext<Row, V>) => ReactNode

/** İkon bileşeni: Phosphor ikonları doğrudan verilir; paket `size`, `weight` ve `aria-hidden` geçirir. */
export type IconComponent = ComponentType<{
  size?: number | string
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'
  className?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}>

/** Hücre aksiyonu: paket sağ kenarda overlay olarak çizer (metin yerleşimi değişmez), ≤ 2 ikon + ⋯ menüsü. */
export interface CellAction<Row> {
  id: string
  label: string
  icon: IconComponent
  /** 'hover': hover ve focus-within'de görünür (varsayılan). 'always': her zaman. */
  reveal?: 'hover' | 'always'
  /** Değere bağlı aksiyon: false → gösterilmez. */
  when?: (row: Row) => boolean
  disabled?: (row: Row) => boolean | string
  destructive?: boolean
  /** Alt menü (⋯ olarak çizilir). */
  menu?: Array<Omit<CellAction<Row>, 'reveal' | 'menu'>>
  run?: (row: Row) => void | Promise<void>
}

export interface ColumnFilterOptions {
  /** Tipin listesinden alt küme. */
  operators?: FilterOp[]
  defaultOperator?: FilterOp
}

/** Nokta yolu: 'customer.title'. Gerçek koşullu tip Faz 2'de (api-draft: src/types/path.ts). */
export type Path<Row> = string & { __row?: Row }

export interface BaseColumn<Row, V = unknown> {
  /** Kararlı kimlik; `accessor` verilmezse değer bu yoldan okunur ('customer.title' → row.customer?.title). */
  id: Path<Row> | string
  /** Header metni (uygulama i18n'den verir). */
  header: string
  /** Dar alanlarda (telefon) kısa header. */
  headerShort?: string
  /** Sütun açıklaması: header tooltip'inde ad altında ikinci satır, Columns dialog'unda ad altında; hücrede gösterilmez. */
  description?: string
  /** Hesaplanan değer. Verilirse `fields` ile sunucudan istenecek alanlar bildirilir. */
  accessor?: (row: Row) => V
  fields?: string[]
  /** string → header'da soluk son ek ("pcs", "d"). Fonksiyon → hücrede, satır bazında. */
  unit?: string | ((row: Row) => string)

  align?: 'left' | 'right' | 'center'
  /** px. Varsayılan tipe göre (05 · Sütun genişlikleri). Sabit sütunlar her zaman px. */
  width?: number
  /** px. Varsayılan 80. */
  minWidth?: number
  maxWidth?: number
  hidden?: boolean
  /** Gizlenemez. Birincil sütun için otomatik true. */
  alwaysVisible?: boolean

  /** Birincil hücre: gerçek <a href> (D6); her zaman sola sabit (D45). Tabloda en fazla bir tane. */
  primary?: boolean
  /** Birincil hücre veya `id`/`ajax` tipi için kayıt linki. */
  href?: (row: Row) => string | undefined
  /** İkinci satır (yalnızca Comfortable). */
  secondary?: (row: Row) => string | null | undefined
  /** Boş değer metni. Varsayılan "—". */
  emptyText?: string

  sortable?: boolean
  filterable?: boolean
  filter?: ColumnFilterOptions
  searchable?: boolean
  suggested?: boolean
  filterNoun?: Plural
  priority?: number

  cell?: CellRender<Row, V>
  actions?: Array<CellAction<Row>>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Row için üst sınır; api-draft ile aynı
export type ColumnDef<Row = any> =
  | (BaseColumn<Row, number | null> & { type: 'int' })
  | (BaseColumn<Row, number | null> & { type: 'float'; decimalPlaces?: number })
  | (BaseColumn<Row, number | null> & { type: 'percentage'; display?: 'text' | 'bar'; decimalPlaces?: number })
  | (BaseColumn<Row, number | null> & { type: 'star'; max?: number })
  | (BaseColumn<Row, number | null> & {
      type: 'currency'
      /** Sabit ISO kodu veya satırdan okuma. */
      currency: string | ((row: Row) => string)
      decimalPlaces?: number
    })
  | (BaseColumn<Row, string | null> & { type: 'string' | 'text' | 'uppercase' | 'lowercase' | 'email' | 'url' | 'id' })
  | (BaseColumn<Row, string | null> & { type: 'phone' })
  | (BaseColumn<Row, string | null> & { type: 'color'; display?: 'swatch' | 'fill'; palette?: string[] })
  | (BaseColumn<Row, boolean | null> & { type: 'boolean'; falseTone?: 'neutral' | 'destructive' })
  | (BaseColumn<Row, string | number | null> & {
      type: 'select'
      options: OptionDef[]
    })
  | (BaseColumn<Row, Array<string | number> | null> & {
      type: 'multiselect'
      options: OptionDef[]
    })
  | (BaseColumn<Row, string | number | null> & { type: 'ajax'; remote: RemoteOptions })
  | (BaseColumn<Row, string | number | Array<string | number> | null> & {
      type: 'user'
      remote?: RemoteOptions<UserOption>
      options?: UserOption[]
      /** Birden çok kişi (avatar yığını). */
      multiple?: boolean
    })
  | (BaseColumn<Row, IsoDate | Date | null> & { type: 'date'; overdue?: boolean | ((row: Row) => boolean) })
  | (BaseColumn<Row, IsoDate | Date | null> & {
      type: 'datetime'
      relative?: boolean
      overdue?: boolean | ((row: Row) => boolean)
    })
  | (BaseColumn<Row, unknown> & { type: 'object'; summary?: (value: unknown, row: Row) => string })
  | (BaseColumn<Row, unknown[] | null> & { type: 'array'; itemType?: 'string' | 'int' | 'float' | 'id' })
