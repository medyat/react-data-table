// Alt çubuğun seçim özeti (form-grid.md §4): Hücre = boş olmayan hücre sayısı; Toplam, Ortalama, En küçük, En büyük
// yalnız sayılardan (Excel gibi). Değerler veriden gelir, DOM'dan değil.
import { isEmptyValue } from '../cells/format'

export interface SelectionSummary {
  count: number
  /** Seçimde sayı yoksa null. */
  numbers: { sum: number; average: number; min: number; max: number } | null
}

export function summarize(values: Iterable<unknown>): SelectionSummary {
  let count = 0
  let n = 0
  let sum = 0
  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    if (isEmptyValue(v)) continue
    count++
    if (typeof v !== 'number' || !Number.isFinite(v)) continue
    n++
    sum += v
    if (v < min) min = v
    if (v > max) max = v
  }
  return { count, numbers: n ? { sum, average: sum / n, min, max } : null }
}
