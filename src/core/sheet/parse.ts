// Hücre girişinin çözümlenmesi (Vue 07 §5, §7; Vue `src/sheet/parse.ts`'ten): sayı yerel ayara göre ("2240",
// "2.240,00", "2,240.00"; "%20" → 20), tarih "24.10", "24.10.2026", "+7d", "today"/"bugün", ISO; seçenek etiketle
// (büyük/küçük harf ve İ/ı duyarsız). Çözülemeyen giriş ham metin kalır; doğrulama onu tip hatası sayar.
import type { ColumnDef, OptionDef } from '../../types/columns'
import { optionLabel } from '../cells/format'
import { TYPE_SPECS } from '../cells/specs'
import { isoDay } from '../filters/model'
import { parseNumber } from '../format/parse'

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

/** "24.10" (bu yıl), "24.10.2026", "24/10/26", "+7d", "-3d", "today", ISO. Çözülemezse null. */
export function parseDateInput(text: string, env: ParseEnv): string | null {
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
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) return validDay(+iso[1]!, +iso[2]!, +iso[3]!)
  const dmy = /^(\d{1,2})[./](\d{1,2})(?:[./](\d{2}|\d{4}))?$/.exec(s)
  if (dmy) {
    const y = dmy[3] ? (dmy[3].length === 2 ? 2000 + +dmy[3] : +dmy[3]) : env.today.getFullYear()
    return validDay(y, +dmy[2]!, +dmy[1]!)
  }
  return null
}

/** Editör metni → hücre değeri. Boş → null; çözülemeyen → ham metin (tip hatası). */
export function parseInput(def: ColumnDef, text: string, env: ParseEnv): unknown {
  const s = text.trim()
  if (s === '') return null
  if (TYPE_SPECS[def.type].numeric || def.type === 'star') {
    // Formül yok (Vue 07 §2): "=" ile başlayan giriş sayı sütununda hata olarak kalır.
    if (s.startsWith('=')) return s
    return parseNumber(env.locale, s) ?? s
  }
  switch (def.type) {
    case 'date':
    case 'datetime':
      return parseDateInput(s, env) ?? s
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
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
