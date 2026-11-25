// Dışa aktarma ve pano için hücre değeri (05 §3, 07 §7, 07 §13, D46). Saf fonksiyonlar; kütüphaneye bağlı değil.
import type { ColumnDef } from '../../types/columns'
import {
  decimalOf,
  decimalPlaces,
  formatCell,
  minDecimalPlaces,
  isEmptyValue,
  optionLabel,
  type FormatEnv,
} from '../cells/format'
import { toDate } from '../format'
import { isoDay } from '../filters/model'
import { localDateTime } from '../sheet/parse'

/**
 * Düz metin: görüntülenen biçim, ama geri yapıştırılabilir/içe aktarılabilir (07 §7). Para kodu ve "—" yok,
 * tarihler ISO, listeler `; ` ile. Pano ve CSV bunu kullanır.
 */
const asciiMinus = (s: string): string => s.replace(/\u2212/g, '-')

export function plainText<Row extends object>(def: ColumnDef<Row>, row: Row, value: unknown, env: FormatEnv): string {
  if (isEmptyValue(value)) return ''
  switch (def.type) {
    // İşaret her zaman yazılır: `signDisplay: 'never'` yalnız ekranındır, kopyalanan değer geri yapıştırılınca aynı kalmalı.
    // Eksi düz tiredir: Excel U+2212'yi eksi saymaz, sayıyı metin olarak yapıştırır.
    case 'currency':
      return asciiMinus(env.fmt.decimal(decimalOf(value), decimalPlaces(def)))
    case 'int':
    case 'decimal':
    case 'percentage':
      return asciiMinus(formatCell({ ...def, signDisplay: 'auto' }, row, value, env))
    // ISO: Excel her bölge ayarında tarih olarak tanır. Tarih-saat yerel ve bölgesizdir (kullanıcının gördüğü saat).
    case 'date':
      return value instanceof Date ? isoDay(value) : String(value)
    case 'datetime':
      return localDateTime(value as string | Date)
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

// Excel: `0` her zaman yazılır, `#` yalnız doluysa (en az / en çok hane). Zorunlu hane yokken tam sayı noktasız
// biçim alır: `#,##0.##` Excel'de "10." yazar.
const decimals = (dp: number, min = dp, value?: number) =>
  dp > 0 && !(min === 0 && Number.isInteger(value)) ? `#,##0.${'0'.repeat(min)}${'#'.repeat(dp - min)}` : '#,##0'

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
    case 'decimal':
      return {
        value: Number(value),
        type: Number,
        format: decimals(decimalPlaces(def), minDecimalPlaces(def), Number(value)),
      }
    case 'percentage':
      // Değer 20 = %20 (03); geri içe aktarılınca 20 kalsın diye bölünmez, işaret biçimde.
      return {
        value: Number(value),
        type: Number,
        format: `${decimals(decimalPlaces(def), minDecimalPlaces(def), Number(value))}"%"`,
      }
    case 'currency': {
      const code = typeof def.currency === 'string' ? ` "${def.currency}"` : ''
      return {
        value: Number(value),
        type: Number,
        format: decimals(decimalPlaces(def), minDecimalPlaces(def), Number(value)) + code,
      }
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
