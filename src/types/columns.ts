// api-draft.ts §2'den türetildi: sütun tanımı, özel hücre, hücre aksiyonu. Düzenleme alanları FormGrid içindir
// (R34); DataTable onları okumaz.
import type { ComponentType, ReactNode } from 'react'
import type { Density, IsoDate, Plural, Tone } from './core'
import type { FilterOp } from './query'

/** 23 tip. `type` zorunludur; veriden çıkarsama yoktur. */
export type ColumnType =
  // sayı
  | 'int'
  | 'decimal'
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
  /**
   * Hazır ton, tema başına açık renk ya da dolu hap (`fill`: zemin bu renk, yazı okunurluğa göre siyah/beyaz,
   * iki temada aynı). Verilmezse 'gray'.
   */
  tone?: Tone | { light: string; dark: string } | { fill: string }
  description?: string
}

export interface UserOption extends OptionDef {
  avatarUrl?: string
  /** Avatar yoksa gösterilecek baş harfler; verilmezse label'dan üretilir. */
  initials?: string
}

/** `ajax` ve `user` sütunlarının seçenek kaynağı (sütunun kendi verisi; metin filtresi önerisi değildir). */
export interface RemoteOptions<O extends OptionDef = OptionDef, Row = unknown> {
  /**
   * Yazdıkça arama. Varsayılan sayfa boyutu 20. FormGrid hücresinde `row` düzenlenen satırdır (boş satırda yok):
   * Konum satırdaki ürünün raflarını ister (form-grid.md §3.2). Liste filtresinde `row` yoktur.
   */
  search(q: string, page: number, ctx: { signal: AbortSignal; row?: Row }): Promise<{ items: O[]; hasMore: boolean }>
  /**
   * FormGrid yapıştırması: Excel'den gelen metinler (ürün kodu, ad) seçeneğe; dönen dizi aynı sıradadır, bulunamayan
   * `null`. Paket 100'erlik parçalarla sorar. Verilmezse yapıştırılan metin olduğu gibi değer olur (değer kodsa yeter).
   */
  match?(texts: string[], ctx: { signal: AbortSignal }): Promise<Array<O | null>>
  /** Kayıtlı filtre değerlerinin, yapıştırılan değerlerin ve hücre değerlerinin etiketlerini çözer. */
  resolve: (values: Array<string | number>, ctx: { signal: AbortSignal }) => Promise<O[]>
  pageSize?: number
  /**
   * Listenin altında "yeni kayıt": uygulama kaydı kendi formunda açar (yazılan metin ön dolu) ve kaydedilen kaydı
   * seçenek olarak döndürür; hücreye listeden seçilmiş gibi yazılır (`onChange` seçenekle). Vazgeçilirse `null` ya da
   * hiç dönmeyen söz: hücre değişmez. Verilmezse öğe çizilmez (yetkisi olmayana verilmez).
   */
  create?(text: string): Promise<O | null>
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

/** Doğrulama bağlamı (FormGrid): satır, bütün satırlar ve satırın formda yeni eklenip eklenmediği. */
export interface ValidationContext<Row> {
  row: Row
  rows: readonly Row[]
  isNew: boolean
}

/** Hata ya da uyarı metni döndürür; sorun yoksa null. */
export type Validator<Row> = (value: unknown, ctx: ValidationContext<Row>) => string | null | undefined

/** İkon bileşeni: Phosphor ikonları doğrudan verilir; paket `size`, `weight` ve `aria-hidden` geçirir. */
export type IconComponent = ComponentType<{
  size?: number | string
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'
  className?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}>

/** Hücre aksiyonu: paket sağ kenarda overlay olarak çizer (metin yerleşimi değişmez), ≤ 2 ikon + ⋯ menüsü. */
/** Pencere düzenleyicinin aldığı değerler; pencere çizildiği sürece açıktır. */
export interface WindowEditorProps<Row> {
  row: Row
  value: unknown
  /** Değeri hücreye yazar (geri al'a girer) ve pencereyi kapatır. */
  onApply: (value: unknown) => void
  onCancel: () => void
}

/** `run`'ın ikinci parametresi (form-grid.md §3.3). */
export interface CellActionContext {
  /** Hücrenin kendisi: uygulamanın popover'ı ona bağlanır. */
  anchor: HTMLElement | null
  /** FormGrid'de hücreye yazar ve geri al'a girer; liste tablosunda yok (salt okunur). */
  setValue?: (value: unknown) => void
}

/** Menü öğesi; kendi `menu`'su alt menü olur ("Fiyat getir ›"). Öğenin kendi kısayolu yok. */
export interface CellActionItem<Row> {
  id: string
  label: string
  icon?: IconComponent
  /** Değere bağlı aksiyon: false → gösterilmez. */
  when?: (row: Row) => boolean
  /** true ya da gerekçe metni → pasif; gerekçe ipucunda (kilitli hücrede yazan aksiyon). */
  disabled?: (row: Row) => boolean | string
  destructive?: boolean
  menu?: Array<CellActionItem<Row>>
  run?: (row: Row, ctx: CellActionContext) => void | Promise<void>
}

/** Hücrenin sağındaki aksiyon: ≤ 2 ikon düğme, fazlası ⋯ menüsünde. */
export interface CellAction<Row> extends CellActionItem<Row> {
  icon: IconComponent
  /** 'hover': hover ve focus-within'de görünür (varsayılan). 'always': her zaman. */
  reveal?: 'hover' | 'always'
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
  /** DataSheet içe aktarması (data-sheet.md §6): dosyadaki başka başlıklar ("Stok Kodu", "SKU"); büyük/küçük harf ve
   *  Türkçe işaret duyarsız. */
  importAliases?: string[]
  /** İç içe başlık: üstteki grup adı, dıştan içe (`['Ek vergiler', 'ÖTV']`). Yan yana duran aynı gruplu sütunlar tek
   *  grup başlığı altında çizilir; taşıma ya da sabitleme araya girerse grup bölünür. Izgara dışında (filtre, Sütunlar,
   *  satır penceresi, Excel) sütun tam adıyla görünür: "İndirim · Oran". */
  group?: string | string[]
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
  /**
   * R33: false → sütun bu kullanıcı için yoktur: tabloda, Columns dialog'unda, Filter'da, istekte. Durumdaki (adres,
   * görünüm) süzgeci ve sıralaması atlanır. Yetki içindir; satır aksiyonunun `when`'i gibi (D34). `hidden` ise gizli
   * başlar ama açılabilir.
   */
  when?: boolean
  /** Gizlenemez. Birincil sütun için otomatik true. */
  alwaysVisible?: boolean

  /** Birincil hücre: gerçek <a href> (D6); her zaman sola sabit (D45). Tabloda en fazla bir tane. */
  primary?: boolean
  /** Birincil hücre veya `id`/`ajax` tipi için kayıt linki. */
  href?: (row: Row) => string | undefined
  /** İkinci satır (Comfortable ve Standard; Compact'ta çizilmez, R27). */
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

  // FormGrid (R34, docs/form-grid.md §3.1). DataTable bu alanları okumaz.
  /** Varsayılan true; fonksiyon satıra göre kilitler. */
  editable?: boolean | ((row: Row, ctx: { isNew: boolean }) => boolean)
  /**
   * Başlıkta yıldız. İstemcide hata üretmez: zorunluluğu sunucu söyler. Fonksiyon satıra göre zorunlu kılar
   * (çıkış konumu yalnız stok takipli satırda): başlık yıldız taşımaz, hücre `aria-required` taşır.
   */
  required?: boolean | ((row: Row) => boolean)
  /** Boş hücrede soluk yazılan, başka yerden gelen değer; hücrenin değeri olmaz (talebin İhtiyaç tarihi). */
  placeholder?: (row: Row) => string | null | undefined
  /**
   * Hücreye yazılınca aynı satıra yazılacak öbür alanlar (Ürün seçilince Ad ve Birim). `row` yazılmış haliyle gelir;
   * `option` seçilen seçenektir (`ajax`'ta aramanın döndürdüğü nesnenin kendisi, ek alanlarıyla). Yazılanlar aynı
   * geri al adımına girer; onların `onChange`'i çağrılmaz.
   */
  onChange?: (row: Row, value: unknown, ctx: { option?: OptionDef; rows: readonly Row[] }) => Partial<Row> | void
  /**
   * Pencere düzenleyici (form-grid.md §7, `object` / `array`): hücreye yazılmaz, hücre özet gösterir; kalem, çift tık
   * ya da F2 uygulamanın penceresini açar. Değer ⌘C / ⌘V / ⌘D ile bütün olarak taşınır; temizleme atlar.
   */
  editor?: { window: ComponentType<WindowEditorProps<Row>> }
  /** `select`'te seçeneği kapatır: liste soluk gösterir, seçilemez (taksit her satırda bir kez). */
  optionEnabled?: (option: OptionDef, row: Row, rows: readonly Row[]) => boolean
  /** Hata: hücre kırmızı, balonda mesaj. */
  validate?: Validator<Row>
  /** Uyarı: kaydı engellemez. */
  warn?: Validator<Row>
  /** Başlıkta ? ikonu ile açıklama. */
  hint?: string
}

/** Sayı türlerinin işareti (R36). Verilmezse bugünkü gibi: yalnız eksi yazılır, renk yok. */
export interface NumberSign {
  /** Intl'in adı: `exceptZero` artıya + yazar, `never` işareti hiç yazmaz (yön başka yerde söyleniyorsa). */
  signDisplay?: 'auto' | 'exceptZero' | 'never'
  /** Yalnız verilen işaret boyanır; sıfır ("-0.00" dahil) eksi ya da artı değildir. */
  signTone?: { negative?: 'destructive'; positive?: 'success'; zero?: 'muted' }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Row için üst sınır; api-draft ile aynı
export type ColumnDef<Row = any> =
  | (BaseColumn<Row, number | null> & NumberSign & { type: 'int' })
  // Ondalık türlerin değeri sunucudaki gibi ondalık metindir ("1200.0000"); sayı da okunur, yazılan metindir (R35).
  // `decimalPlaces` en çok hane; `minDecimalPlaces` sondaki sıfırların yazıldığı en az hane (verilmezse ikisi eşit).
  | (BaseColumn<Row, string | number | null> &
      NumberSign & { type: 'decimal'; decimalPlaces?: number; minDecimalPlaces?: number })
  | (BaseColumn<Row, string | number | null> &
      NumberSign & { type: 'percentage'; display?: 'text' | 'bar'; decimalPlaces?: number; minDecimalPlaces?: number })
  | (BaseColumn<Row, number | null> & { type: 'star'; max?: number })
  | (BaseColumn<Row, string | number | null> &
      NumberSign & {
        type: 'currency'
        /** Sabit ISO kodu veya satırdan okuma. */
        currency: string | ((row: Row) => string)
        decimalPlaces?: number
        minDecimalPlaces?: number
      })
  | (BaseColumn<Row, string | null> & { type: 'string' | 'text' | 'uppercase' | 'lowercase' | 'email' | 'url' | 'id' })
  | (BaseColumn<Row, string | null> & { type: 'phone' })
  | (BaseColumn<Row, string | null> & { type: 'color'; display?: 'swatch' | 'fill'; palette?: string[] })
  | (BaseColumn<Row, boolean | null> & { type: 'boolean'; falseTone?: 'neutral' | 'destructive' })
  | (BaseColumn<Row, string | number | null> & {
      type: 'select'
      options: OptionDef[]
      /** 'text': rozetsiz düz etiket, hücrede ve listede (taksit gibi tonu olmayan sıralı seçenek; R38). */
      display?: 'badge' | 'text'
    })
  | (BaseColumn<Row, Array<string | number> | null> & {
      type: 'multiselect'
      options: OptionDef[]
    })
  | (BaseColumn<Row, string | number | null> & {
      type: 'ajax'
      remote: RemoteOptions<OptionDef, Row>
      /**
       * FormGrid listesinde seçeneğin içeriği (Swors `SourcePicker`'ın `Item`'ı gibi): `option` aramanın döndürdüğü
       * nesnedir, ek alanlarıyla (stok, kategori); `search` yazılan metin (vurgulamak için). Verilmezse ad + açıklama.
       */
      Item?: ComponentType<{ option: OptionDef; search: string }>
    })
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
  | (BaseColumn<Row, unknown[] | null> & { type: 'array'; itemType?: 'string' | 'int' | 'decimal' | 'id' })
