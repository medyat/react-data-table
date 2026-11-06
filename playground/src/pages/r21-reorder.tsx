// R21 · Satır sıralama: formdaki alanların sırası listede sürüklenerek değişir. Sunucu yerine 400 ms'lik sahte istek;
// "Fail next move" işaretliyse istek reddedilir ve tablo eski sıraya döner. Arama ya da başka sıralama varken tutamak pasif.
import { DataTable, useDataTable, type ColumnDef, type Density, type RowMove } from '@medyat/react-data-table'
import { useState } from 'react'

interface Field {
  id: string
  title: string
  code: string
  type: string
}

const FIELDS: Field[] = [
  { id: 'f1', title: 'Fabric width', code: 'fabric_width', type: 'Decimal' },
  { id: 'f2', title: 'Weight', code: 'weight', type: 'Integer' },
  { id: 'f3', title: 'Pattern', code: 'pattern', type: 'Select' },
  { id: 'f4', title: 'Season', code: 'season', type: 'Multi-select' },
  { id: 'f5', title: 'Colour code', code: 'colour_code', type: 'Text' },
  { id: 'f6', title: 'Washing', code: 'washing', type: 'Long text' },
  { id: 'f7', title: 'Origin', code: 'origin', type: 'Select' },
]

// Sanal satırlarda uzun mesafe (otomatik kaydırma) denemesi için.
const MANY: Field[] = Array.from({ length: 300 }, (_, i) => ({
  id: `m${i + 1}`,
  title: `Field ${i + 1}`,
  code: `field_${i + 1}`,
  type: 'Text',
}))

const columns: Array<ColumnDef<Field>> = [
  { id: 'title', header: 'Title', type: 'string', primary: true, href: (r) => `#/r21/${r.id}` },
  { id: 'code', header: 'Code', type: 'id' },
  { id: 'type', header: 'Type', type: 'string' },
]

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function R21Reorder({ density }: { density: Density }) {
  const [fields, setFields] = useState(FIELDS)
  const [fail, setFail] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const table = useDataTable({
    id: 'r21-fields',
    columns,
    rows: fields,
    density,
    entityName: { one: 'field', other: 'fields' },
  })

  // Sunucunun yapacağı: taşınanı `after`'ın hemen arkasına koyar ve yeniden numaralar.
  const onMove = async ({ row, after }: RowMove<Field>) => {
    await wait(400)
    if (fail) {
      setFail(false)
      throw new Error('Move rejected')
    }
    setFields((all) => {
      const rest = all.filter((f) => f.id !== row.id)
      rest.splice(after ? rest.findIndex((f) => f.id === after.id) + 1 : 0, 0, row)
      return rest
    })
    setLog((l) => [`${row.title} → after ${after?.title ?? '(top)'}`, ...l].slice(0, 5))
  }
  const disabled = table.request.search || table.request.sort.length ? 'Clear the search and sorting to reorder' : false

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} />
        Fail next move
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={fields.length > FIELDS.length}
          onChange={(e) => setFields(e.target.checked ? MANY : FIELDS)}
        />
        300 fields
      </label>
      <div className="pg-fixed" style={{ height: 480 }}>
        <DataTable table={table} label="Fields" selectable reorder={{ disabled, onMove }} />
      </div>
      <ol aria-label="Moves" style={{ margin: 0 }}>
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ol>
    </div>
  )
}
