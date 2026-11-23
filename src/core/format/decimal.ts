// Ondalık sözleşmesi (R35): `decimal`, `currency`, `percentage` değeri sunucudaki gibi ondalık metindir ("1200.0000");
// paket onu float'tan geçirmez. Sayı da okunur (eski veri, uygulamanın kendi sayısı); yazılan her zaman metindir.
import Decimal from 'decimal.js'
import type { ColumnType } from '../../types/columns'

const DECIMAL_TEXT = /^-?\d+(\.\d+)?$/

/** Ondalık değer tutan türler; `int` ve `star` sayı kalır. */
export const isDecimalType = (type: ColumnType): boolean =>
  type === 'decimal' || type === 'currency' || type === 'percentage'

/** Geçerli ondalık: sonlu JS sayısı ya da `.` ayırıcılı metin (gruplama, üs yok). */
export const isDecimalValue = (v: unknown): v is number | string =>
  (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && DECIMAL_TEXT.test(v))

export const toDecimal = (v: number | string): Decimal => new Decimal(v)

/** Değer olarak eşit mi ("2.5" = "2.5000" = 2.5): geri al ve "değişti mi" hanelere değil değere bakar. */
export const sameDecimal = (a: unknown, b: unknown): boolean =>
  isDecimalValue(a) && isDecimalValue(b) && toDecimal(a).eq(toDecimal(b))

/** Kanonik metin: baştaki ve sondaki gereksiz sıfırlar yok, üs yok ("02.50" → "2.5"). */
export const decimalText = (v: number | string): string => toDecimal(v).toFixed()
