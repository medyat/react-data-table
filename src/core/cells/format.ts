// Tipin varsayılan metni (03): `formatted` olarak özel hücreye verilir, tooltip ve dışa aktarma da bunu kullanır.
import { isDecimalValue } from '../format/decimal'
import type { ColumnDef, OptionDef } from '../../types/columns'
import { toDate, type Format } from '../format'
import type { I18n } from '../i18n'
import type { RemoteLabels } from './remote-labels'

export interface FormatEnv {
  fmt: Format
  i18n: I18n
  today: Date
  labels: RemoteLabels
}

/** null, undefined, '' ve boş dizi → boş (03 · Ortak kurallar). Sahte 0 yok: 0 bir değerdir. */
export const isEmptyValue = (v: unknown): boolean =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)

export const optionLabel = (options: OptionDef[] | undefined, value: unknown): string =>
  options?.find((o) => o.value === value)?.label ?? String(value)

/** URL'den yalnızca host (03: protokol gizli). Geçersizse olduğu gibi. */
export function urlHost(value: string): string {
  try {
    return new URL(value).host
  } catch {
    return value
  }
}

export function currencyCode<Row extends object>(def: Extract<ColumnDef<Row>, { type: 'currency' }>, row: Row): string {
  return typeof def.currency === 'function' ? def.currency(row) : def.currency
}

/** Sayı sütununun gösterdiği ondalık; filtre girişi de bu kadar kabul eder (0 ise tam sayı). */
export function decimalPlaces(def: ColumnDef): number {
  if (def.type === 'percentage') return def.decimalPlaces ?? 0
  if (def.type === 'decimal' || def.type === 'currency') return def.decimalPlaces ?? 2
  return 0
}

/** Sondaki sıfırlar bu kadar haneye kadar yazılır; verilmezse `decimalPlaces` (her zaman o kadar hane). */
export function minDecimalPlaces(def: ColumnDef): number {
  const max = decimalPlaces(def)
  if (def.type !== 'decimal' && def.type !== 'currency' && def.type !== 'percentage') return max
  return Math.min(def.minDecimalPlaces ?? max, max)
}

/** Ondalık metin olduğu gibi biçimlenir (float'a çevrilmez, R35); öteki değer sayıya. */
export const decimalOf = (v: unknown): number | string => (typeof v === 'string' && isDecimalValue(v) ? v : Number(v))

export function formatCell<Row extends object>(def: ColumnDef<Row>, row: Row, value: unknown, env: FormatEnv): string {
  if (isEmptyValue(value)) return def.emptyText ?? '—'
  const { fmt, i18n } = env
  switch (def.type) {
    case 'int':
      return fmt.int(Number(value), def.signDisplay)
    case 'decimal':
      return fmt.decimal(decimalOf(value), decimalPlaces(def), def.signDisplay, minDecimalPlaces(def))
    case 'percentage':
      return fmt.percent(decimalOf(value), decimalPlaces(def), def.signDisplay, minDecimalPlaces(def))
    case 'star':
      return i18n.t('cell.rating', { value: Number(value), max: def.max ?? 5 })
    case 'currency':
      return `${fmt.decimal(decimalOf(value), decimalPlaces(def), def.signDisplay, minDecimalPlaces(def))} ${currencyCode(def, row)}`
    case 'url':
      return urlHost(String(value))
    case 'boolean':
      return i18n.t(value ? 'common.yes' : 'common.no')
    case 'select':
      return optionLabel(def.options, value)
    case 'multiselect':
      return fmt.list((value as unknown[]).map((v) => optionLabel(def.options, v)))
    case 'ajax':
      return env.labels.label(def.id as string, def.remote, value as string | number)
    case 'user': {
      const ids = (Array.isArray(value) ? value : [value]) as Array<string | number>
      return fmt.list(
        ids.map(
          (id) => def.options?.find((o) => o.value === id)?.label ?? env.labels.label(def.id as string, def.remote, id),
        ),
      )
    }
    case 'date':
      // Geçersiz tarih metni (sheet'te yazılan "+", "abc") biçimlendirilmez, olduğu gibi gösterilir; hata balonu söyler.
      if (Number.isNaN(toDate(value as string | Date).getTime())) return String(value)
      return fmt.date(value as string | Date, env.today)
    case 'datetime':
      if (Number.isNaN(toDate(value as string | Date).getTime())) return String(value)
      return def.relative
        ? fmt.relative(value as string | Date, env.today)
        : fmt.dateTime(value as string | Date, env.today)
    case 'object':
      return def.summary
        ? def.summary(value, row)
        : i18n.t('cell.fields', { count: typeof value === 'object' && value ? Object.keys(value).length : 0 })
    case 'array':
      return fmt.list((value as unknown[]).map((v) => formatArrayItem(def.itemType, v, fmt)))
    default:
      return String(value)
  }
}

export function formatArrayItem(
  itemType: 'string' | 'int' | 'decimal' | 'id' | undefined,
  v: unknown,
  fmt: Format,
): string {
  if (itemType === 'int') return fmt.int(Number(v))
  if (itemType === 'decimal') return fmt.decimal(decimalOf(v))
  return String(v)
}
