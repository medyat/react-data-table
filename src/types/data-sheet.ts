// DataSheet (R44, docs/data-sheet.md): çok kaydı Excel gibi düzenleyip tek Kaydet ile uygulamaya teslim eder.
import type { ColumnDef } from './columns'

/** Kaydedilecek satır (data-sheet.md §5). */
export interface SheetChangeRow<Row> {
  /** Yüklenen satırda `getRowId`, yenide paketin kimliği; `applyResult`'ta aynı kimlik döner. */
  id: string
  /** Listeye bu oturumda eklendi; sunucuda olup olmadığını paket bilmez (D47). */
  isNew: boolean
  /** Anahtar sütununun değeri; yeni satırda boş olabilir (§3). */
  key: unknown
  /**
   * Görünen sütunların değerleri (sütun id'sinin yoluyla, `variables.renk`); yeni satırda yalnız dolu olanlar.
   * Gizlenmiş ama değiştirilmiş sütun da girer: değişiklik sessizce kaybolmasın.
   */
  values: Partial<Row>
  /** Satırın taslaklı tam hâli, gizli alanlar dahil. */
  row: Row
}

export interface SheetChanges<Row> {
  rows: Array<SheetChangeRow<Row>>
}

export type SheetRowResult<Row> =
  | { id: string; status: 'created' | 'updated'; row?: Row }
  | { id: string; status: 'error'; fieldErrors?: Record<string, string | string[]>; rowError?: string }

export type SheetView = 'all' | 'changed' | 'errors'

/** İçe aktarma uygulandı (data-sheet.md §6): bildirimi uygulama gösterir. */
export interface SheetImportResult {
  updated: number
  added: number
}

export interface SheetExportOptions {
  format: 'csv' | 'xlsx'
  /** Dosya ve sayfa adı, uzantısız ("ürünler"). */
  name: string
  /**
   * Satırlar hep listenin tamamıdır. Varsayılan görünen sütunlar; `all` gizliler dahil bütün sütunlar (dosyayı
   * doldurup geri yüklemek için). Gizlenen sütun da içe aktarılır.
   */
  columns?: 'visible' | 'all'
}

export interface DataSheetOptions<Row extends object> {
  /** Uygulamanın yüklediği kayıtlar (taban). Yenilenince gelen kayıtların tabanı yenilenir, taslaklar kalır. */
  rows: Row[]
  /** Yüklenirken düzenleme kapalı; `{ done, total }` ilerleme şeridi çizer. */
  loading?: boolean | { done: number; total: number }
  columns: Array<ColumnDef<Row>>
  /** Eşleme anahtarının sütunu: yüklenen satırda kilitli, yeni satırda yazılır; `required` değilse boş kalabilir. */
  keyColumn: string
  /** Yüklenen satırın kimliği. */
  getRowId: (row: Row) => string
  newRow?: (rows: readonly Row[]) => Partial<Row>
  /** Varsayılan 10.000 (Vue 07 §1). */
  maxRows?: number
  /**
   * Kaydet: değişiklikleri teslim eder. Uygulama parçaları gönderdikçe `applyResult` çağırır; söz bitince kayıt biter.
   * Söz reddedilirse sonuç gelmeyen satırlar taslak kalır.
   */
  onSave: (changes: SheetChanges<Row>) => Promise<void>
}
