// Hücre girişinin çözümlenmesi (Vue 07 §5, §7; Vue `src/sheet/parse.ts`'ten): sayı yerel ayara göre ("2240",
// "2.240,00", "2,240.00"; "%20" → 20), tarih "24.10", "24.10.2026", "+7d", "today"/"bugün", ISO; seçenek etiketle
// (büyük/küçük harf ve İ/ı duyarsız). Çözülemeyen giriş ham metin kalır; doğrulama onu tip hatası sayar.
import type { ColumnDef, OptionDef } from '../../types/columns'
import { optionLabel } from '../cells/format'
import { TYPE_SPECS } from '../cells/specs'
import { isoDay } from '../filters/model'
import { isDecimalType } from '../format/decimal'
import { parseDecimal, parseNumber } from '../format/parse'

export interface ParseEnv {
  locale: string
  today: Date
  /** i18n `date.today` ("Today" / "Bugün"); "today" her dilde kabul edilir. */
  todayWord: string
  /** i18n `common.yes` / `common.no` (boolean yapıştırma); true/false/1/0/yes/no her dilde. */
  yesWord: string
  noWord: string
}

export const fold = (s: string, locale: string): string => s.trim().toLocaleLowerCase(locale).replace(/ı|i̇/g, 'i')

const matchOption = (options: OptionDef[], text: string, locale: string): unknown => {
  const o = options.find((opt) => fold(opt.label, locale) === fold(text, locale) || String(opt.value) === text.trim())
  return o ? o.value : text.trim()
}

const splitList = (s: string): string[] =>
  s
    .split(/[;,]/)
    .map((p) => p.trim())
    .filter(Boolean)

const validDay = (y: number, m: number, d: number): string | null => {
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? isoDay(dt) : null
}

type Order = 'dmy' | 'mdy' | 'ymd'
const orders = new Map<string, Order>()
/** Dilin gün, ay, yıl sırası (Intl): en-US ay önde, tr ve ru gün önde. */
const orderOf = (locale: string): Order => {
  let o = orders.get(locale)
  if (!o) {
    o = new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(2026, 10, 24))
      .filter((p) => p.type === 'day' || p.type === 'month' || p.type === 'year')
      .map((p) => p.type[0])
      .join('') as Order
    orders.set(locale, o)
  }
  return o
}

const monthKey = (s: string, locale: string) => fold(s, locale).replace(/\.$/, '')
const months = new Map<string, Map<string, number>>()
/** Dilin ve İngilizcenin kısa ve uzun ay adları (ru'da "ноября" gibi tarih içindeki hâli de) → ay. */
const monthsOf = (locale: string): Map<string, number> => {
  let map = months.get(locale)
  if (!map) {
    map = new Map()
    for (const lang of [locale, 'en'])
      for (let m = 0; m < 12; m++)
        for (const month of ['long', 'short'] as const)
          for (const day of [undefined, 'numeric'] as const) {
            const name = new Intl.DateTimeFormat(lang, { month, day })
              .formatToParts(new Date(2026, m, 15))
              .find((p) => p.type === 'month')!.value
            if (!map.has(monthKey(name, locale))) map.set(monthKey(name, locale), m + 1)
          }
    months.set(locale, map)
  }
  return map
}

/** Yalnız gün: "24.10" (bu yıl), "24.10.2026", "+7d", "today", ay adıyla ("24 Kas 2026", "Nov 24, 2026",
 *  Excel'in "24-Nov-26"'sı), ISO. Nokta her dilde gün öndedir (ay önde yazan ABD noktayı kullanmaz); eğik çizgi ve
 *  tire dilin sırasıyla okunur. Dilin sırasında geçersiz olan çevrilmez. */
function parseDay(text: string, env: ParseEnv): string | null {
  const s = text.trim()
  if (!s) return null
  const low = fold(s, env.locale)
  if (low === 'today' || low === fold(env.todayWord, env.locale)) return isoDay(env.today)
  const rel = /^([+-])(\d+)d$/i.exec(s)
  if (rel) {
    const d = new Date(env.today)
    d.setDate(d.getDate() + (rel[1] === '-' ? -1 : 1) * Number(rel[2]))
    return isoDay(d)
  }
  const tokens = s.split(/[\s.,/-]+/).filter(Boolean)
  const named = tokens.findIndex((tk) => !/^\d+$/.test(tk))
  let y: string | undefined
  let m: string | number | undefined
  let d: string | undefined
  if (named >= 0) {
    m = monthsOf(env.locale).get(monthKey(tokens[named]!, env.locale))
    const nums = tokens.filter((_, i) => i !== named)
    if (!m || !nums.length || nums.length > 2 || !nums.every((n) => /^\d+$/.test(n))) return null
    ;[d, y] = nums[0]!.length === 4 ? [nums[1], nums[0]] : nums
  } else {
    if (tokens.length < 2 || tokens.length > 3) return null
    const order: Order = tokens[0]!.length === 4 ? 'ymd' : /^\d{1,2}\./.test(s) ? 'dmy' : orderOf(env.locale)
    const fields = tokens.length === 2 ? order.replace('y', '') : order
    const at = (f: string) => tokens[fields.indexOf(f)]
    ;[y, m, d] = [at('y'), at('m'), at('d')]
  }
  if (!d || d.length > 2 || String(m).length > 2 || (y && y.length !== 2 && y.length !== 4)) return null
  const now = env.today.getFullYear()
  // İki haneli yıl kayan pencereyle: bugünden en çok 20 yıl ileri, gerisi geçmiş (2026'da 97 → 1997, 46 → 2046).
  const near = (yy: number) => {
    const c = Math.floor(now / 100) * 100 + yy
    return c > now + 20 ? c - 100 : c <= now - 80 ? c + 100 : c
  }
  const year = !y ? now : y.length === 2 ? near(+y) : +y
  return validDay(year, +m!, +d)
}

const ZONED = /^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/i
// Gün + saat: "14:30", "14.30", "14:30:15", "2:30 PM"; ISO'nun "T"si de ayırır.
const WITH_TIME = /^(.+?)[\sT]+(\d{1,2})[:.](\d{2})(?:[:.](\d{2})(?:[.,]\d+)?)?(?:\s*([ap])\.?\s?m\.?)?$/i

/** Metnin yerel günü ve saati; saat yoksa 00:00. Bölgesi yazılı ISO kendi anının yerel karşılığıdır. */
function parseParts(text: string, env: ParseEnv): Date | null {
  const s = text.trim()
  if (ZONED.test(s)) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const t = WITH_TIME.exec(s)
  const day = parseDay(t ? t[1]! : s, env)
  if (!day) return null
  let h = t ? +t[2]! : 0
  const min = t ? +t[3]! : 0
  const sec = t?.[4] ? +t[4] : 0
  const half = t?.[5]?.toLowerCase()
  if (half) {
    if (h < 1 || h > 12) return null
    h = (h % 12) + (half === 'p' ? 12 : 0)
  }
  if (h > 23 || min > 59 || sec > 59) return null
  const [y, mo, d] = day.split('-').map(Number)
  return new Date(y!, mo! - 1, d!, h, min, sec)
}

/** Gün (`date`); saatli metinde gün alınır (Excel'in tarih-saat hücresi). Çözülemezse null. */
export function parseDateInput(text: string, env: ParseEnv): string | null {
  const d = parseParts(text, env)
  return d && isoDay(d)
}

/** Tarih-saat bir andır: değer ISO UTC metni, kullanıcı yerel gün ve saatle yazar (Swors `DateTimeField` ile aynı).
 *  Gün yazımları `date`'inkiler, saat yoksa 00:00 (Excel gibi); bölgesi yazılı ISO anı korur. */
export function parseDateTimeInput(text: string, env: ParseEnv): string | null {
  return parseParts(text, env)?.toISOString() ?? null
}

/** Elle yazım kalıbı, dilin gün / ay / yıl sırası ve ayracıyla (Intl): tr ve ru "dd.MM.yyyy", en-US "MM/dd/yyyy";
 *  tarih-saatte " HH:mm". Maskelenmiş metin `parseDay`'in kurallarıyla okunur. */
export function dateMask(locale: string, type: 'date' | 'datetime'): string {
  // shortcut: ayraç ilk ara metindir; "2026. 11. 24." gibi çok parçalı yazımlar (hu, ko) tek ayraca iner, o diller gelince bakılır.
  const sep =
    new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(2026, 10, 24))
      .find((p) => p.type === 'literal')
      ?.value.trim() || '.'
  const FIELDS = { d: 'dd', m: 'MM', y: 'yyyy' } as const
  const day = [...orderOf(locale)].map((f) => FIELDS[f as keyof typeof FIELDS]).join(sep)
  return type === 'datetime' ? `${day} HH:mm` : day
}

const SLOT = /[dMyHm]/

/** Metnin rakamları kalıba dizilir; ayraç ancak ardından rakam gelince yazılır (geri silme ayraca takılmasın). */
export function maskText(text: string, mask: string): string {
  const digits = text.replace(/\D/g, '')
  let out = ''
  let i = 0
  for (const ch of mask) {
    if (i >= digits.length) break
    out += SLOT.test(ch) ? digits[i++] : ch
  }
  return out
}

/** Değer kalıbın biçiminde (editörün ilk metni); tarih olmayan değer olduğu gibi. */
export function fillMask(mask: string, value: unknown): string {
  if (value === null || value === undefined) return ''
  const day = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null
  const d = day ? new Date(+day[1]!, +day[2]! - 1, +day[3]!) : new Date(value as string | Date)
  if (Number.isNaN(d.getTime())) return String(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  const parts: Record<string, string> = {
    dd: pad(d.getDate()),
    MM: pad(d.getMonth() + 1),
    yyyy: String(d.getFullYear()),
    HH: pad(d.getHours()),
    mm: pad(d.getMinutes()),
  }
  return mask.replace(/dd|MM|yyyy|HH|mm/g, (tok) => parts[tok]!)
}

/** Anın yerel günü ve saati, bölgesiz ISO ("2026-11-24 14:30"; saniye varsa yazılır): editör metni ve kopya. Excel bu
 *  yazımı her bölge ayarında tarih-saat olarak tanır. */
export function localDateTime(value: string | Date): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  const sec = d.getSeconds() ? `:${pad(d.getSeconds())}` : ''
  return `${isoDay(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}${sec}`
}

/** Editör metni → hücre değeri. Boş → null; çözülemeyen → ham metin (tip hatası). */
export function parseInput(def: ColumnDef, text: string, env: ParseEnv): unknown {
  const s = text.trim()
  if (s === '') return null
  if (TYPE_SPECS[def.type].numeric || def.type === 'star') {
    // Formül yok (Vue 07 §2): "=" ile başlayan giriş sayı sütununda hata olarak kalır.
    if (s.startsWith('=')) return s
    // Ondalık türler metin olarak çözümlenir (R35); int ve star sayı kalır.
    return (isDecimalType(def.type) ? parseDecimal(env.locale, s) : parseNumber(env.locale, s)) ?? s
  }
  switch (def.type) {
    case 'date':
      return parseDateInput(s, env) ?? s
    case 'datetime':
      return parseDateTimeInput(s, env) ?? s
    case 'select':
      return matchOption(def.options, s, env.locale)
    case 'multiselect':
      return splitList(s).map((part) => matchOption(def.options, part, env.locale))
    case 'boolean': {
      const v = fold(s, env.locale)
      if (['true', '1', 'yes', fold(env.yesWord, env.locale)].includes(v)) return true
      if (['false', '0', 'no', fold(env.noWord, env.locale)].includes(v)) return false
      return s
    }
    case 'uppercase':
      return s.toLocaleUpperCase(env.locale)
    case 'lowercase':
      return s.toLocaleLowerCase(env.locale)
    default:
      return s
  }
}

/** Hücre değeri → editörün ham metni. */
export function inputText(def: ColumnDef, value: unknown): string {
  if (value === null || value === undefined) return ''
  if (def.type === 'select') return optionLabel(def.options, value)
  if (def.type === 'datetime') return localDateTime(value as string | Date)
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
