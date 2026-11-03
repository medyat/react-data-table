// T7 · Cell actions (hover/odak overlay'i) ve uygulamanın çizdiği hücreler (`cell`), üç yoğunlukta.
import {
  ArrowSquareOutIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  MagnifyingGlassIcon,
  WarningIcon,
  XIcon,
} from '@phosphor-icons/react'
import { DataTable, useDataTable, type ColumnDef, type Density } from '@medyat/react-data-table'
import { useState } from 'react'

interface Lot {
  id: number
  number: string
  product: { name: string; sku: string }
  produced: { done: number; total: number }
  inspection: 'lot_ready' | 'first_piece' | 'passed' | 'defects' | 'not_inspected'
  defects: number
  decision: { kind: 'pending' } | { kind: 'approved' | 'rejected'; at: string }
}

const LOTS: Lot[] = [
  {
    id: 1,
    number: 'WO-26-0418',
    product: { name: 'Hydraulic cylinder HC-80', sku: 'HC-080-S' },
    produced: { done: 340, total: 500 },
    inspection: 'lot_ready',
    defects: 0,
    decision: { kind: 'pending' },
  },
  {
    id: 2,
    number: 'WO-26-0385',
    product: { name: 'Tipper cylinder TP-120', sku: 'TP-120-D' },
    produced: { done: 6, total: 50 },
    inspection: 'first_piece',
    defects: 0,
    decision: { kind: 'pending' },
  },
  {
    id: 3,
    number: 'WO-26-0389',
    product: { name: 'Hydraulic power unit HPU-5.5', sku: 'HPU-055' },
    produced: { done: 18, total: 20 },
    inspection: 'passed',
    defects: 0,
    decision: { kind: 'approved', at: '09:42' },
  },
  {
    id: 4,
    number: 'WO-26-0414',
    product: { name: 'Piston rod 40 × 600', sku: 'PRD-40-600' },
    produced: { done: 130, total: 250 },
    inspection: 'defects',
    defects: 2,
    decision: { kind: 'rejected', at: '08:15' },
  },
  {
    id: 5,
    number: 'WO-26-0398',
    product: { name: 'Cylinder mounting bracket CB-80', sku: 'CB-080' },
    produced: { done: 70, total: 200 },
    inspection: 'not_inspected',
    defects: 0,
    decision: { kind: 'pending' },
  },
]

const INSPECTION = {
  lot_ready: { label: 'Lot 3 ready', icon: ClockIcon, cls: 'pg-badge-amber' },
  first_piece: { label: 'First piece', icon: MagnifyingGlassIcon, cls: 'pg-badge-blue' },
  passed: { label: 'Passed', icon: CheckIcon, cls: 'pg-badge-green' },
  defects: { label: 'Defects', icon: WarningIcon, cls: 'pg-badge-red' },
  not_inspected: { label: 'Not inspected', icon: null, cls: 'pg-badge-gray' },
} as const

const actionColumns: Array<ColumnDef<Lot>> = [
  { id: 'number', header: 'Order no.', type: 'id', primary: true, width: 136 },
  {
    id: 'product.name',
    header: 'Product · hover',
    type: 'string',
    width: 200,
    actions: [
      { id: 'copy', label: 'Copy name', icon: CopyIcon, run: (r) => navigator.clipboard?.writeText(r.product.name) },
      { id: 'open', label: 'Open product', icon: ArrowSquareOutIcon },
    ],
  },
  {
    id: 'always',
    header: 'reveal: always',
    type: 'string',
    accessor: (r) => r.product.name,
    width: 200,
    actions: [
      { id: 'copy', label: 'Copy name', icon: CopyIcon, reveal: 'always' },
      { id: 'open', label: 'Open product', icon: ArrowSquareOutIcon, reveal: 'always' },
    ],
  },
  {
    id: 'three',
    header: 'Three actions',
    type: 'string',
    accessor: (r) => r.product.name,
    width: 200,
    actions: [
      { id: 'copy', label: 'Copy name', icon: CopyIcon },
      { id: 'open', label: 'Open product', icon: ArrowSquareOutIcon },
      { id: 'stock', label: 'Stock by warehouse', icon: MagnifyingGlassIcon },
    ],
  },
  { id: 'customer', header: 'Customer', type: 'string', accessor: () => 'Marmara Vinç' },
]

function Decision({
  row,
  density,
  onDecide,
}: {
  row: Lot
  density: Density
  onDecide: (kind: 'approved' | 'rejected') => void
}) {
  const d = row.decision
  const size = density === 'comfortable' ? 'pg-btn is-md' : 'pg-btn is-sm'
  if (d.kind === 'pending')
    return (
      <span className="pg-decide">
        <button type="button" className={size} onClick={() => onDecide('approved')}>
          <CheckIcon size={14} className="is-green" />
          Approve
        </button>
        <button type="button" className={size} onClick={() => onDecide('rejected')}>
          <XIcon size={14} className="is-red" />
          Reject
        </button>
      </span>
    )
  const Icon = d.kind === 'approved' ? CheckIcon : XIcon
  return (
    <span className="pg-decided">
      <Icon size={14} className={d.kind === 'approved' ? 'is-green' : 'is-red'} />
      {d.kind === 'approved' ? 'Approved' : 'Rejected'}
      <span className="pg-qty-total"> · {d.at}</span>
    </span>
  )
}

export function T7Actions({ density }: { density: Density }) {
  const [lots, setLots] = useState(LOTS)
  const decide = (id: number, kind: 'approved' | 'rejected') =>
    setLots((all) =>
      all.map((l) => (l.id === id ? { ...l, decision: { kind, at: new Date().toTimeString().slice(0, 5) } } : l)),
    )

  const customColumns: Array<ColumnDef<Lot>> = [
    { id: 'number', header: 'Order no.', type: 'id', primary: true, width: 136 },
    { id: 'product.name', header: 'Product', type: 'string', secondary: (r) => r.product.sku },
    {
      id: 'produced',
      header: 'Produced',
      unit: 'pcs',
      type: 'object',
      align: 'right',
      width: 176,
      cell: ({ row }) => {
        const { done, total } = row.produced
        return (
          <span className="pg-qty">
            <span className="pg-qty-track">
              <span className="pg-qty-fill" style={{ width: `${(done / total) * 100}%` }} />
            </span>
            <span className="pg-qty-text">
              {done}
              <span className="pg-qty-total"> / {total}</span>
            </span>
          </span>
        )
      },
    },
    {
      id: 'inspection',
      header: 'Inspection',
      type: 'select',
      options: Object.entries(INSPECTION).map(([value, v]) => ({ value, label: v.label })),
      width: 150,
      cell: ({ row, formatted }) => {
        const spec = INSPECTION[row.inspection]
        const Icon = spec.icon
        return (
          <span className={`pg-badge ${spec.cls}`}>
            {Icon && <Icon size={12} weight="bold" />}
            {formatted}
            {row.defects > 0 && <span className="pg-badge-count">{row.defects}</span>}
          </span>
        )
      },
    },
    {
      id: 'decision',
      header: 'Decision',
      type: 'object',
      width: 220,
      cell: ({ row, density }) => <Decision row={row} density={density} onDecide={(k) => decide(row.id, k)} />,
    },
  ]

  const actions = useDataTable({ id: 't7-actions', columns: actionColumns, rows: lots, density })
  const custom = useDataTable({ id: 't7-cells', columns: customColumns, rows: lots, density })

  return (
    <div className="pg-page pg-scroll">
      <h1>Cell actions · Product name</h1>
      <p className="pg-sub">
        Buttons sit over the end of the text on the row's own background · the column never changes width
      </p>
      <div className="pg-fixed" style={{ height: 290 }}>
        <DataTable table={actions} label="Orders" />
      </div>
      <h1>Cells the app draws · always visible</h1>
      <p className="pg-sub">
        Quantity bar, custom badge and Approve / Reject through `cell`; the package keeps alignment, cut-off, empty
        value and density
      </p>
      <div className="pg-fixed" style={{ height: 330 }}>
        <DataTable table={custom} label="Lots" />
      </div>
    </div>
  )
}
