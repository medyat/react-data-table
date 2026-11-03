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
