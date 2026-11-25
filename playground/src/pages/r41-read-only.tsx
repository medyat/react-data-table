// R41 · FormGrid gösterimi: kaydedilmiş belgenin satırları. Düzenleme yok; seçim, ⌘C, ⌘F ve alt çubuğun toplamı
// var. "Auto row height" açıkken açıklaması olan satır uzar. Aç düğmesi, çift tık ve ⌘↵ satırı açar (burada metin).
// 500 satır: belgede beklenen üst sınır.
import { FormGrid, type ColumnDef } from '@medyat/react-data-table'
import { useState } from 'react'

interface Line {
  id: string
  code: string
  title: string
  note: string | null
  qty: number
  unit: string
  place: string
  order: string | null
}

const NOTES = [
  null,
  'Galvanised, cut to 6 m.',
  null,
  'Deliver with the forklift; ramp at the back entrance. Customer asked for two separate pallets.',
  null,
]

const LINES: Line[] = Array.from({ length: 500 }, (_, i) => ({
  id: `l${i + 1}`,
  code: `PRD-${String(1000 + i)}`,
  title: i % 7 === 3 ? 'Ball valve DN50, stainless steel, PN40, with lever handle' : `Product ${i + 1}`,
  note: NOTES[i % NOTES.length]!,
  qty: ((i * 37) % 250) + 1,
  unit: i % 3 ? 'pcs' : 'm',
  place: `MAIN · A-${String((i % 9) + 1).padStart(2, '0')}`,
  order: i % 4 ? `SO-2611-${String(100 + (i % 12))}` : null,
}))

const columns: Array<ColumnDef<Line>> = [
  {
    id: 'title',
    header: 'Product',
    type: 'string',
    width: 300,
    cell: ({ row }) => (
      <span className="pg-line">
        <span className="pg-line-code">{row.code}</span>
        <b>{row.title}</b>
        {row.note && <span className="pg-line-note">{row.note}</span>}
      </span>
    ),
  },
  { id: 'qty', header: 'Quantity', type: 'decimal', width: 110, unit: (r) => r.unit },
  { id: 'place', header: 'Location', type: 'string', width: 150 },
  { id: 'order', header: 'Order', type: 'string', width: 140 },
]

export function R41ReadOnly() {
  const [auto, setAuto] = useState(true)
  const [frame, setFrame] = useState(true)
  const [opened, setOpened] = useState<string | null>(null)
  return (
    <div className="pg-page">
      <label className="pg-toggle">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        Auto row height
      </label>{' '}
      <label className="pg-toggle">
        <input type="checkbox" checked={frame} onChange={(e) => setFrame(e.target.checked)} />
        Frame
      </label>
      <p className="pg-note">{opened ? `Opened ${opened}` : 'Open a row: its button, double click or ⌘↵.'}</p>
      <FormGrid
        key={String(auto)}
        readOnly
        rows={LINES}
        columns={columns}
        label="Despatch lines"
        getRowId={(r) => r.id}
        rowHeight={auto ? 'auto' : undefined}
        frame={frame}
        onRowOpen={(r) => setOpened(r.code)}
        rowActions={[{ id: 'note', label: 'Copy code', run: (r) => void navigator.clipboard.writeText(r.code) }]}
      />
    </div>
  )
}
