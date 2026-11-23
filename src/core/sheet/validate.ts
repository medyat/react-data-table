// Hücre doğrulaması (Vue 07 §5): tip → validate → warn; ilk sorun kazanır. `required` istemcide hata üretmez,
// zorunluluğu sunucu söyler (form-grid.md §6).
import { isDecimalType, isDecimalValue } from '../format/decimal'
import type { ColumnDef, OptionDef, ValidationContext } from '../../types/columns'
import { isEmptyValue } from '../cells/format'
import { TYPE_SPECS } from '../cells/specs'
import { toDate } from '../format'
import type { I18n } from '../i18n'
import { fold } from './parse'

export interface Issue {
  level: 'error' | 'warning'
  message: string
  /** "“Adt” bir seçenek değil" için yakın seçenek (balonda öneri). */
  suggest?: OptionDef
}

const distance = (a: string, b: string): number => {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]!
    d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j]!
      d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return d[b.length]!
}

/** Yakın seçenek: aynı başlangıç, içerme ya da ≤ 2 harf farkı. */
export function closestOption(options: OptionDef[], value: string, locale: string): OptionDef | undefined {
  const v = fold(value, locale)
  if (!v) return undefined
  return (
    options.find((o) => fold(o.label, locale).startsWith(v) || v.startsWith(fold(o.label, locale))) ??
    options.find((o) => distance(fold(o.label, locale), v) <= 2)
  )
}

export function typeIssue(def: ColumnDef, value: unknown, i18n: I18n): Issue | null {
  if (isEmptyValue(value)) return null
  const error = (message: string, suggest?: OptionDef): Issue => ({ level: 'error', message, suggest })
  const { t } = i18n
  const number = isDecimalType(def.type) ? isDecimalValue(value) : typeof value === 'number'
  if ((TYPE_SPECS[def.type].numeric || def.type === 'star') && !number)
    return error(
      typeof value === 'string' && value.trim().startsWith('=') ? t('sheet.noFormulas') : t('sheet.notANumber'),
    )
  if ((def.type === 'date' || def.type === 'datetime') && Number.isNaN(toDate(value as string).getTime()))
    return error(t('sheet.notADate'))
  if (def.type === 'boolean' && typeof value !== 'boolean')
    return error(t('sheet.notAnOption', { value: String(value) }))
  if (def.type === 'select' && !def.options.some((o) => o.value === value))
    return error(
      t('sheet.notAnOption', { value: String(value) }),
      closestOption(def.options, String(value), i18n.locale),
    )
  if (def.type === 'multiselect') {
    const bad = (Array.isArray(value) ? value : [value]).find((v) => !def.options.some((o) => o.value === v))
    if (bad !== undefined) return error(t('sheet.notAnOption', { value: String(bad) }))
  }
  return null
}

export function cellIssue<Row extends object>(
  def: ColumnDef<Row>,
  value: unknown,
  ctx: ValidationContext<Row>,
  i18n: I18n,
): Issue | null {
  const type = typeIssue(def as ColumnDef, value, i18n)
  if (type) return type
  const err = def.validate?.(value, ctx)
  if (err) return { level: 'error', message: err }
  const warn = def.warn?.(value, ctx)
  return warn ? { level: 'warning', message: warn } : null
}
