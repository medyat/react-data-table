// Alt çubuğun seçim özeti (form-grid.md §4): Hücre = boş olmayan hücre sayısı; Toplam, Ortalama, En küçük, En büyük
// yalnız sayı sütunlarından (Excel gibi; "12" yazılı metin sayı değildir). Değerler veriden gelir, DOM'dan değil.
// Ondalık metin tam toplanır (R35): 0.1 + 0.2 = 0.3; sonuç metindir, gösterim yerel ayarla biçimler.
import Decimal from 'decimal.js'
import { isEmptyValue } from '../cells/format'
import { isDecimalValue } from '../format/decimal'

export interface SelectionSummary {
  count: number
  /** Seçimde sayı yoksa null. */
  numbers: { sum: string; average: string; min: string; max: string } | null
}

/** `cells`: [değer, sayı sütunu mu]. */
export function summarize(cells: Iterable<readonly [unknown, boolean]>): SelectionSummary {
  let count = 0
  const nums: Decimal[] = []
  for (const [v, numeric] of cells) {
    if (isEmptyValue(v)) continue
    count++
    if (numeric && isDecimalValue(v)) nums.push(new Decimal(v))
  }
  if (!nums.length) return { count, numbers: null }
  const sum = Decimal.sum(...nums)
  return {
    count,
    numbers: {
      sum: sum.toFixed(),
      average: sum.div(nums.length).toFixed(),
      min: Decimal.min(...nums).toFixed(),
      max: Decimal.max(...nums).toFixed(),
    },
  }
}
