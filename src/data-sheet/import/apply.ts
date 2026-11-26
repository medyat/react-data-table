// İçe aktarmanın uygulama adımı (data-sheet.md §6): `ajax` sütunlarındaki metinler `remote.match` ile seçeneğe
// çevrilir, sonra plan kurulur. Dosya penceresi ve `importRows` aynı yoldan geçer.
import type { ColumnDef, OptionDef } from '../../types/columns'
import type { RemoteLabels } from '../../core/cells/remote-labels'
import type { ParseEnv } from '../../core/sheet/parse'
import { cellText, cellValue, planImport, type ImportPlan } from './match'
import type { FileCell } from './read'

export async function resolveImport<Row extends object>(o: {
  data: FileCell[][]
  /** Veri sütunu → tablo sütun indeksi (`columns` içinde) ya da null. */
  mapping: Array<number | null>
  columns: Array<ColumnDef<Row>>
  rows: readonly Row[]
  keyColumn: string
  addNew: boolean
  labels: RemoteLabels
  env: ParseEnv
}): Promise<ImportPlan> {
  const found = new Map<number, Map<string, OptionDef | null>>()
  for (const [j, col] of o.mapping.entries()) {
    const def = col === null ? undefined : o.columns[col]
    if (def?.type !== 'ajax' || !def.remote.match) continue
    const texts = [...new Set(o.data.map((r) => cellText(r[j] ?? null).trim()).filter(Boolean))]
    const map = new Map<string, OptionDef | null>()
    for (let k = 0; k < texts.length; k += 100) {
      const part = texts.slice(k, k + 100)
      const options = await def.remote.match(part, { signal: new AbortController().signal }).catch(() => [])
      part.forEach((text, n) => map.set(text, options[n] ?? null))
    }
    o.labels.seed(
      def.id,
      [...map.values()].filter((x): x is OptionDef => !!x),
    )
    found.set(col!, map)
  }
  return planImport({
    data: o.data,
    mapping: o.mapping,
    columns: o.columns,
    rows: o.rows,
    keyColumn: o.keyColumn,
    addNew: o.addNew,
    value: (def, c) => {
      if (def.type !== 'ajax') return cellValue(def, c, o.env)
      const text = cellText(c).trim()
      if (!text) return undefined
      return found.get(o.columns.findIndex((c) => c.id === def.id))?.get(text)?.value ?? text
    },
  })
}

/** Uygulamanın kaydındaki değer → dosya hücresi: sayı ham metniyle (dosyadaki gibi), nesne metne. */
export function toFileCell(value: unknown): FileCell {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return { num: String(value) }
  if (typeof value === 'string' || typeof value === 'boolean' || value instanceof Date) return value
  return String(value)
}
