// F1 · FormGrid: Sevk belgesi satırları formun içinde (docs/form-grid.md). Üstte yer tutucu form alanları: ızgara
// sayfayla kayar, başlık ve alt çubuk yapışkan. "1000 × 30" ölçüm verisi.
import { TrashIcon } from '@phosphor-icons/react'
import { FormGrid, type ColumnDef, type RowAction } from '@medyat/react-data-table'
import { useState } from 'react'

interface Line {
  code: string | null
  title: string | null
  qty: number | null
  unit: string | null
  price: number | null
  vat: number | null
  date: string | null
  note: string | null
  gift: boolean | null
  [extra: string]: unknown
}

const units = [
  { value: 'pcs', label: 'Adet' },
  { value: 'm', label: 'Metre' },
  { value: 'kg', label: 'Kilogram' },
]

const base: Array<ColumnDef<Line>> = [
  { id: 'code', header: 'Ürün', type: 'string', width: 140, required: true },
  { id: 'title', header: 'Ad', type: 'string', width: 240 },
  { id: 'qty', header: 'Miktar', type: 'decimal', width: 104, required: true },
  { id: 'unit', header: 'Birim', type: 'select', options: units, width: 112 },
  { id: 'price', header: 'Birim fiyat', type: 'currency', currency: 'TRY', width: 128 },
  { id: 'vat', header: 'KDV', type: 'percentage', width: 80, hint: 'Satırın KDV oranı; boşsa üründen gelir.' },
  { id: 'date', header: 'Teslim', type: 'date', width: 128 },
  { id: 'gift', header: 'Promosyon', type: 'boolean', width: 104 },
  { id: 'note', header: 'Açıklama', type: 'text', width: 260 },
]

const sample: Line[] = [
  {
    code: 'RAY-AL',
    title: 'Korniş ray, alüminyum',
    qty: 120,
    unit: 'm',
    price: 84.5,
    vat: 20,
    date: '2026-12-05',
    note: null,
    gift: false,
  },
  {
    code: 'KUM-LN',
    title: 'Lina tül kumaş, beyaz',
    qty: 300,
    unit: 'm',
    price: 142,
    vat: 20,
    date: null,
    note: '280 cm en, kurşunlu etek',
    gift: false,
  },
  {
    code: 'SMF-RTS',
    title: 'Somfy motor RTS, 10 Nm',
    qty: 40,
    unit: 'pcs',
    price: 3150,
    vat: 20,
    date: '2026-12-01',
    note: null,
    gift: true,
  },
  {
    code: 'VDA-6',
    title: 'Vida, 6 mm',
    qty: 2000,
    unit: 'pcs',
    price: 0.35,
    vat: 20,
    date: null,
    note: null,
    gift: false,
  },
]

// Ölçüm: 1000 satır × 30 sütun (form-grid.md §10 · hız bütçesi).
const wide: Array<ColumnDef<Line>> = [
  ...base,
  ...Array.from({ length: 21 }, (_, i): ColumnDef<Line> => ({
    id: `x${i}`,
    header: `Ek ${i + 1}`,
    type: 'decimal',
    width: 96,
  })),
]
const big = (): Line[] =>
  Array.from({ length: 1000 }, (_, i) => {
    const row: Line = { ...sample[i % 4]!, code: `P-${String(i + 1).padStart(4, '0')}` }
    for (let x = 0; x < 21; x++) row[`x${x}`] = (i * 7 + x * 13) % 500
    return row
  })

const actions: Array<RowAction<Line>> = [
  { id: 'remove', label: 'Satırı sil', icon: TrashIcon, destructive: true, run: () => {} },
]

export function F1FormGrid() {
  const [size, setSize] = useState<'small' | 'big'>('small')
  const [rows, setRows] = useState<Line[]>(sample)
  const [log, setLog] = useState('')
  return (
    <div className="pg-form">
      <div className="pg-form-fields">
        <label>
          Belge no <input defaultValue="SVK-2026-0412" />
        </label>
        <label>
          Cari <input defaultValue="Kuzey Perde Ltd." />
        </label>
        <label>
          Veri
          <select
            value={size}
            onChange={(e) => {
              const v = e.target.value as 'small' | 'big'
              setSize(v)
              setRows(v === 'big' ? big() : sample)
            }}
          >
            <option value="small">4 satır</option>
            <option value="big">1000 × 30</option>
          </select>
        </label>
      </div>
      <FormGrid
        key={size}
        label="Satırlar"
        rows={rows}
        columns={size === 'big' ? wide : base}
        rowActions={actions}
        onRowsChange={(next, change) => {
          setRows(next)
          setLog(`${change.kind}: ${change.cells.map((c) => `${c.row + 1}.${c.column}`).join(', ')}`)
        }}
      />
      <p className="pg-form-log">{log || 'Değişiklik yok'}</p>
      <div className="pg-form-after">Formun devamı (toplamlar, notlar) — ızgara sayfayla kayar.</div>
    </div>
  )
}
