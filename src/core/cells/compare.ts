// Tipe göre sıralama karşılaştırıcısı (04 §6): boş değer "en büyük" (artanda sonda, azalanda başta — PostgreSQL varsayılanı).
// Liste (useListTable) ve sheet (yerel sıralama, 07 §10) aynı kuralı kullanır.
import type { ColumnDef } from '../../types/columns'
import { getFormat } from '../format'
import { TYPE_SPECS } from './specs'

const isEmpty = (v: unknown) => v === null || v === undefined || v === ''

export function comparator(def: ColumnDef, locale: string): (a: unknown, b: unknown) => number {
  const empty = (a: unknown, b: unknown): number | null => {
    const ea = isEmpty(a)
    const eb = isEmpty(b)
    if (ea && eb) return 0
    if (ea) return 1
    if (eb) return -1
    return null
  }
  const spec = TYPE_SPECS[def.type]
  if (spec.numeric || def.type === 'boolean' || def.type === 'star') {
    return (a, b) => empty(a, b) ?? Number(a) - Number(b)
  }
  if (def.type === 'date' || def.type === 'datetime') {
    return (a, b) => empty(a, b) ?? new Date(a as string).getTime() - new Date(b as string).getTime()
  }
  const collator = getFormat(locale).collator()
  return (a, b) => empty(a, b) ?? collator.compare(String(a), String(b))
}
