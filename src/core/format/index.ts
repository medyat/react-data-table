// Intl biçimlendiricileri: locale + seçenek anahtarıyla önbellekli (01: hücre başına oluşturmak 10k satırda 134 ms, önbellekli 3,5 ms).
// Kurallar 09 · Biçimlendirme: gerçek eksi işareti U+2212, yüzde Intl ile (tr: %68), para = sayı + ayrı ISO kodu.
import type { IsoDate } from '../../types/core'

export const MINUS = '−'

const cache = new Map<string, unknown>()
function cached<T>(kind: string, locale: string, options: object | undefined, make: () => T): T {
  const key = `${kind}|${locale}|${options ? JSON.stringify(options) : ''}`
  let v = cache.get(key) as T | undefined
  if (v === undefined) {
    v = make()
    cache.set(key, v)
  }
  return v
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/** ISO tarih ("2026-10-24") yerel gün olarak okunur (UTC gece yarısı kayması olmasın); tarih-saat ve Date olduğu gibi. */
export function toDate(value: IsoDate | Date): Date {
  if (value instanceof Date) return value
  const m = DATE_ONLY.exec(value)
  return m ? new Date(+m[1]!, +m[2]! - 1, +m[3]!) : new Date(value)
}

const DAY_MS = 86_400_000
const startOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

export type Format = ReturnType<typeof createFormat>

export function createFormat(locale: string) {
  const nf = (o?: Intl.NumberFormatOptions) => cached('n', locale, o, () => new Intl.NumberFormat(locale, o))
  const df = (o: Intl.DateTimeFormatOptions) => cached('d', locale, o, () => new Intl.DateTimeFormat(locale, o))
  const minus = (s: string) => (s.includes('-') ? s.replace(/-/g, MINUS) : s)
  // Sıcak yol (hücre başına): JSON anahtarı üretmeden, hane sayısına göre küçük haritalar.
  const intFmt = nf({ maximumFractionDigits: 0 })
  const byDp = (make: (dp: number) => Intl.NumberFormat) => {
    const m = new Map<number, Intl.NumberFormat>()
    return (dp: number) => {
      let f = m.get(dp)
      if (!f) m.set(dp, (f = make(dp)))
      return f
    }
  }
  const decimalFmt = byDp((dp) => nf({ minimumFractionDigits: dp, maximumFractionDigits: dp }))
  const percentFmt = byDp((dp) => nf({ style: 'percent', minimumFractionDigits: dp, maximumFractionDigits: dp }))

  const relativeFormat = (style: 'long' | 'short') =>
    cached('r', locale, { style }, () => new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style }))

  /** "2 hours ago" / "in 3 days"; en büyük anlamlı birim. Footer tazeliği `short` ("14 min. ago"). */
  const relative = (value: IsoDate | Date, now: Date = new Date(), style: 'long' | 'short' = 'long'): string => {
    const diffMs = toDate(value).getTime() - now.getTime()
    const abs = Math.abs(diffMs)
    const rtf = relativeFormat(style)
    if (abs < 60_000) return rtf.format(0, 'second')
    if (abs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), 'minute')
    if (abs < DAY_MS) return rtf.format(Math.round(diffMs / 3_600_000), 'hour')
    if (abs < 30 * DAY_MS) return rtf.format(Math.round(diffMs / DAY_MS), 'day')
    if (abs < 365 * DAY_MS) return rtf.format(Math.round(diffMs / (30 * DAY_MS)), 'month')
    return rtf.format(Math.round(diffMs / (365 * DAY_MS)), 'year')
  }

  return {
    locale,
    int: (n: number): string => minus(intFmt.format(n)),
    /** Her zaman `dp` hane (noktalar hizalanır). */
    decimal: (n: number, dp = 2): string => minus(decimalFmt(dp).format(n)),
    /** 68 → "68%" (tr: "%68"). */
    percent: (n: number, dp = 0): string => minus(percentFmt(dp).format(n / 100)),
    /** Çip özetleri: 250000 → "250K" (tr: "250 B"). */
    compact: (n: number): string => minus(nf({ notation: 'compact', maximumFractionDigits: 0 }).format(n)),
    /** "Oct 24"; başka yılsa "Mar 3, 2025". */
    date: (value: IsoDate | Date, today: Date = new Date()): string => {
      const d = toDate(value)
      const sameYear = d.getFullYear() === today.getFullYear()
      return df(
        sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' },
      ).format(d)
    },
    /** "Oct 17, 09:42" (saat biçimi yerel ayardan). */
    dateTime: (value: IsoDate | Date, today: Date = new Date()): string => {
      const d = toDate(value)
      const sameYear = d.getFullYear() === today.getFullYear()
      return df({
        month: 'short',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' }),
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
    },
    /** Tam zaman (tooltip): "Oct 17, 2026, 09:42:10 GMT+3". */
    dateTimeFull: (value: IsoDate | Date): string =>
      df({ dateStyle: 'medium', timeStyle: 'long' }).format(toDate(value)),
    relative,
    /** Gecikme gün sayısı; gelecekte veya bugünse 0. */
    daysLate: (value: IsoDate | Date, today: Date = new Date()): number =>
      Math.max(0, Math.floor((startOfDay(today) - startOfDay(toDate(value))) / DAY_MS)),
    list: (items: string[]): string =>
      cached('l', locale, undefined, () => new Intl.ListFormat(locale, { type: 'unit' })).format(items),
    collator: (): Intl.Collator =>
      cached('c', locale, undefined, () => new Intl.Collator(locale, { numeric: true, sensitivity: 'base' })),
    plural: (): Intl.PluralRules => cached('p', locale, undefined, () => new Intl.PluralRules(locale)),
  }
}

const formats = new Map<string, Format>()
/** Locale başına tek örnek. */
export function getFormat(locale: string): Format {
  let f = formats.get(locale)
  if (!f) {
    f = createFormat(locale)
    formats.set(locale, f)
  }
  return f
}
