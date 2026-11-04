// Yerel ayara göre sayı okuma (03 · Yapıştırma): "12.400", "12,400", "1.284,50", "68%" — iki ayırıcı varsa sondaki ondalıktır.
const seps = new Map<string, { group: string; decimal: string }>()
function sepsOf(locale: string) {
  let s = seps.get(locale)
  if (!s) {
    const parts = new Intl.NumberFormat(locale).formatToParts(12345.6)
    s = {
      group: parts.find((p) => p.type === 'group')?.value ?? ',',
      decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
    }
    seps.set(locale, s)
  }
  return s
}

export function parseNumber(locale: string, text: string): number | null {
  let s = text.replace(/[\s%\u00a0A-Za-z₺€$£]/g, '').replace('−', '-')
  if (s === '' || s === '-') return null
  const comma = s.lastIndexOf(',')
  const dot = s.lastIndexOf('.')
  const decimal = comma >= 0 && dot >= 0 ? (comma > dot ? ',' : '.') : sepsOf(locale).decimal
  s = s.split(decimal === ',' ? '.' : ',').join('')
  if (decimal === ',') s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Binlik grupları olan sayı (yapıştırma): "1.234.567", "1.284,50", "12,400.5". Grup ayırıcısı tek tiptir, ondalık
 * (varsa) ötekidir. "0,3." gibi yazarken eklenen ikinci ayırıcı buna uymaz.
 */
const GROUPED = /^\d{1,3}([.,])\d{3}(?:\1\d{3})*(?:(?!\1)[.,]\d+)?$/

/**
 * Sayı alanına yazılanı düzeltir; alanda ne görünüyorsa o uygulanır. Ondalıkta nokta da virgül de ondalıktır ve
 * yerel ayırıcıya çevrilir ("10.3" → tr "10,3"), ikinci ayırıcı yazılmaz. Tam sayıda kesir atılır ("18.5" → "18").
 * Gruplu sayı okunup ayırıcısız yazılır.
 */
export function cleanNumber(locale: string, text: string, integer: boolean): string {
  const t = text.replace(/−/g, '-').replace(/[^\d.,-]/g, '')
  const sign = t.startsWith('-') ? '-' : ''
  const body = t.replace(/-/g, '')
  if (GROUPED.test(body)) {
    const n = parseNumber(locale, sign + body)
    if (n === null) return sign
    return plainNumber(locale, integer ? Math.trunc(n) : n)
  }
  // Gruplu olmayan ayırıcı ondalıktır; tam sayıda kesir atılır.
  const [whole, ...fraction] = body.split(/[.,]/)
  if (integer) return sign + whole
  return sign + whole + (fraction.length > 0 ? sepsOf(locale).decimal + fraction.join('') : '')
}

/** Sayı alanında gösterim: gruplamasız, yerel ondalık ayırıcıyla ("1284,5"); `cleanNumber` aynısını üretir. */
export const plainNumber = (locale: string, n: number) =>
  new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 6 }).format(n).replace('−', '-')
