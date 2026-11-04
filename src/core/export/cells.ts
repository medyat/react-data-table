// Dışa aktarma ve pano için hücre değeri (05 §3, 07 §7, 07 §13, D46). Saf fonksiyonlar; kütüphaneye bağlı değil.
import type { ColumnDef } from '../../types/columns'
import { formatCell, isEmptyValue, optionLabel, type FormatEnv } from '../cells/format'
import { toDate } from '../format'

/**
 * Düz metin: görüntülenen biçim, ama geri yapıştırılabilir/içe aktarılabilir (07 §7). Para kodu ve "—" yok,
 * tarihler ISO, listeler `; ` ile. Pano ve CSV bunu kullanır.
 */
export function plainText<Row extends object>(def: ColumnDef<Row>, row: Row, value: unknown, env: FormatEnv): string {
  if (isEmptyValue(value)) return ''
  switch (def.type) {
    case 'currency':
      return env.fmt.decimal(Number(value), def.decimalPlaces ?? 2)
    case 'date':
    case 'datetime':
      return value instanceof Date ? value.toISOString() : String(value)
    case 'multiselect':
      return (value as unknown[]).map((v) => optionLabel(def.options, v)).join('; ')
    case 'string':
    case 'text':
    case 'uppercase':
    case 'lowercase':
    case 'email':
    case 'url':
    case 'phone':
    case 'id':
      return String(value)
    default:
      return formatCell(def, row, value, env)
  }
}

/** write-excel-file hücresi (stil hariç). */
export interface XlsxCell {
  value: string | number | Date | null
  type?: StringConstructor | NumberConstructor | DateConstructor
  format?: string
}

/** Yerel ayarın gün/ay/yıl sırası Excel biçimi olarak: tr → `dd.mm.yyyy`, en → `mm/dd/yyyy`. Yerel ayar başına bir kez. */
const patterns = new Map<string, string>()
export function datePattern(locale: string): string {
  let p = patterns.get(locale)
  if (p === undefined) {
    const parts = new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(
      new Date(2026, 9, 24),
    )
    const CODE: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = { year: 'yyyy', month: 'mm', day: 'dd' }
    p = parts.map((x) => CODE[x.type] ?? x.value).join('')
    patterns.set(locale, p)
  }
  return p
}

const decimals = (dp: number) => (dp > 0 ? `#,##0.${'0'.repeat(dp)}` : '#,##0')

/**
 * Excel kütüphanesi Date'i UTC'den seri sayıya çevirir; hücrenin duvar saatini korumak için yerel bileşenler UTC'ye
 * yazılır (aksi halde UTC+3'te 24 Ekim gece yarısı 23 Ekim olur).
 */
const wallClock = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()))

/**
 * Excel hücresi: sayılar ve tarihler tipli (Excel'de hesaplanabilir, biçimi Excel verir), seçenekler etiketiyle,
 * boolean Yes/No; geri içe aktarılınca aynı değere döner (07 §13).
 */
export function xlsxCell<Row extends object>(def: ColumnDef<Row>, row: Row, value: unknown, env: FormatEnv): XlsxCell {
  if (isEmptyValue(value)) return { value: null }
  switch (def.type) {
    case 'int':
    case 'star':
      return { value: Number(value), type: Number, format: '#,##0' }
    case 'float':
      return { value: Number(value), type: Number, format: decimals(def.decimalPlaces ?? 2) }
    case 'percentage':
      // Değer 20 = %20 (03); geri içe aktarılınca 20 kalsın diye bölünmez, işaret biçimde.
      return { value: Number(value), type: Number, format: `${decimals(def.decimalPlaces ?? 0)}"%"` }
    case 'currency': {
      const code = typeof def.currency === 'string' ? ` "${def.currency}"` : ''
      return { value: Number(value), type: Number, format: decimals(def.decimalPlaces ?? 2) + code }
    }
    case 'date':
    case 'datetime': {
      const d = toDate(value as string | Date)
      if (Number.isNaN(d.getTime())) return { value: String(value), type: String }
      const day = datePattern(env.i18n.locale)
      return { value: wallClock(d), type: Date, format: def.type === 'date' ? day : `${day} hh:mm` }
    }
    default: {
      const text = plainText(def, row, value, env)
      return { value: text === '' ? null : text, type: String }
    }
  }
}

/** Seçenek listesi Excel'de açılır liste olur (seçenek sayfasından, D46): yalnızca tek değerli, sabit seçenekli sütunlar. */
export function listOptions<Row extends object>(def: ColumnDef<Row>, env: FormatEnv): string[] | null {
  if (def.type === 'select') return def.options.map((o) => o.label)
  if (def.type === 'boolean') return [env.i18n.t('common.yes'), env.i18n.t('common.no')]
  return null
}
