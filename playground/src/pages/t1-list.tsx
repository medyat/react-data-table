// T1 · List screen: sunucu modu, TanStack Query ile (R4). Sahte Laravel API'si (/api/orders): sıralama, sayfalama, Count total,
// yükleme geçişleri. Sunucu senaryosu adres çubuğundan: ?delay=1500 ?fail=1 ?failAfter=1 ?size=500 (hash'ten önce).
// Seçim + bulk bar (T5), satır menüsü ve expand (T6): aksiyonlar yalnızca konsola yazar (iş mantığı uygulamanın, D20).
// ?bar=toolbar seçim çubuğu araç çubuğunda.
import { CalendarBlankIcon, PencilSimpleIcon, PlayIcon, UserIcon } from '@phosphor-icons/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  DataTable,
  useDataTable,
  type BulkAction,
  type Density,
  type QueryWithoutPage,
  type RowAction,
  type RowClickMode,
  type TableQuery,
} from '@medyat/react-data-table'
import { useState } from 'react'
import { orderColumns, orderViews, type Order } from '../data'

const params = new URLSearchParams(location.search)
const SCENARIOS = [
  ['', 'Normal'],
  ['?delay=1500', 'Slow server (1.5 s)'],
  ['?fail=1', 'Load fails'],
  ['?failAfter=1', 'Refresh fails (stale data)'],
  ['?size=500', 'Page size 500'],
] as const
let calls = 0

class ApiError extends Error {
  constructor(
    message: string,
    readonly id: string,
  ) {
    super(message)
  }
}

async function fetchOrders(query: TableQuery, signal: AbortSignal) {
  const q = new URLSearchParams({
    page: String(query.page.number),
    size: String(query.page.size),
    q: query.search,
    filters: JSON.stringify(query.filters),
  })
  const s = query.sort[0]
  if (s) {
    q.set('sort', s.column)
    q.set('dir', s.dir)
  }
  if (params.get('delay')) q.set('delay', params.get('delay')!)
  const failAfter = Number(params.get('failAfter') ?? Infinity)
  const counted = params.get('fail') !== '1'
  if (!counted || ++calls > failAfter) q.set('fail', '1')
  // StrictMode geliştirmede bağla-sök-bağla yapar; TanStack Query ilk isteği iptal edip yeniden atar. İptal sayılmaz.
  if (counted) signal.addEventListener('abort', () => calls--)
  const res = await fetch(`/api/orders?${q}`, { signal })
  const body = (await res.json()) as { items: Order[]; hasMore: boolean; message?: string }
  if (!res.ok)
    throw new ApiError(body.message ?? 'Request failed', `${res.status} · req ${calls.toString(16).padStart(8, '0')}`)
  return { rows: body.items, hasMore: body.hasMore }
}

async function countOrders(query: QueryWithoutPage, signal: AbortSignal) {
  const q = new URLSearchParams({ q: query.search, filters: JSON.stringify(query.filters) })
  const res = await fetch(`/api/orders/count?${q}`, { signal })
  return ((await res.json()) as { total: number }).total
}

const rowActions: Array<RowAction<Order>> = [
  {
    // D36: yalnızca Done satırlarda ⋯'nın solunda kalem
    id: 'edit',
    label: 'Edit',
    description: 'Open the order in the editor',
    icon: PencilSimpleIcon,
    inline: true,
    when: (r) => r.status === 'done',
    run: (r) => console.log('edit', r.number),
  },
  {
    id: 'release',
    label: 'Release',
    disabled: (r) => (r.status === 'in_progress' ? 'Already running' : r.status === 'done'),
    run: (r) => console.log('release', r.number),
  },
  { id: 'reschedule', label: 'Reschedule…', run: (r) => console.log('reschedule', r.number) },
  { id: 'hold', label: 'Put on hold', run: (r) => console.log('hold', r.number) },
  {
    id: 'archive',
    label: 'Archive',
    // D34: yetki örneği — yalnızca bitmiş siparişte görünür (pasif değil, yok)
    when: (r) => r.status === 'done',
    run: (r) => console.log('archive', r.number),
  },
  { id: 'cancel', label: 'Cancel order…', destructive: true, run: (r) => console.log('cancel', r.number) },
]

/** Alt satır için sahte operasyonlar (aynı sipariş → aynı liste); gerçek uygulamada detay bileşeni çeker. */
const OPS = ['Cutting', 'CNC machining', 'Welding', 'Assembly', 'Pressure test', 'Painting and packing']
const CENTERS = ['Saw SC-2', 'CNC-04', 'Robot cell W-1', 'Line 2', 'Test bench T-1', 'Paint shop']
const operations = (o: Order) =>
  Array.from({ length: 3 + (o.id % 3) }, (_, i) => {
    const k = (o.id + i) % OPS.length
    const done = i < Math.round(((3 + (o.id % 3)) * o.produced) / 100)
    return { op: (i + 1) * 10, name: OPS[k], center: CENTERS[k], status: done ? 'Done' : 'In progress' }
  })

function Operations({ row }: { row: Order }) {
  const ops = operations(row)
  return (
    <div className="pg-ops">
      <table className="pg-ops-table">
        <thead>
          <tr>
            <th>Op</th>
            <th>Operation</th>
            <th>Work center</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {ops.map((op) => (
            <tr key={op.op}>
              <td className="pg-mono">{op.op}</td>
              <td>{op.name}</td>
              <td>{op.center}</td>
              <td>{op.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pg-ops-foot">
        <span>
          {ops.length} operations · Line {(row.id % 2) + 1} routing
        </span>
        <a href="#">Open routing →</a>
      </div>
    </div>
  )
}

export function T1List({ density }: { density: Density }) {
  const [rowClick, setRowClick] = useState<RowClickMode>('none')
  /** Toplu aksiyonun kısmi hatası (D35): harita uygulamada, paket yalnızca okur. */
  const [rowErrors, setRowErrors] = useState(new Map<number, string>())
  const table = useDataTable({
    id: 'production-orders',
    columns: orderColumns,
    views: orderViews,
    entityName: { one: 'order', other: 'orders' },
    density,
    pageSize: Number(params.get('size') ?? 100),
    count: countOrders,
  })
  const result = useQuery({
    queryKey: ['orders', table.request],
    queryFn: ({ signal }) => fetchOrders(table.request, signal),
    placeholderData: keepPreviousData,
    retry: false,
  })

  const bulkActions: Array<BulkAction<Order>> = [
    {
      id: 'release',
      label: 'Release',
      description: 'Send the selected orders to the line',
      icon: PlayIcon,
      inBar: true,
      // D35 demo: her üçüncü satır sunucuda reddedilmiş gibi haritaya yazılır; refresh'te id aynı kaldığı için işaret kalır.
      run: (rows) => {
        const failed = new Map(rows.filter((_, i) => i % 3 === 2).map((r) => [r.id, 'Open despatch DS-1042']))
        setRowErrors(failed)
        console.log('bulk release', rows.length, 'failed', failed.size)
      },
    },
    {
      id: 'reschedule',
      label: 'Reschedule',
      icon: CalendarBlankIcon,
      inBar: true,
      run: (rows) => console.log('bulk reschedule', rows.length),
    },
    {
      id: 'assign',
      label: 'Assign owner',
      icon: UserIcon,
      inBar: true,
      run: (rows) => console.log('bulk assign', rows.length),
    },
    { id: 'hold', label: 'Put on hold', run: (rows) => console.log('bulk hold', rows.length) },
    {
      // D36: yalnızca hepsi Done seçiliyken görünür
      id: 'archive',
      label: 'Archive',
      when: (rows) => rows.every((r) => r.status === 'done'),
      run: (rows) => console.log('bulk archive', rows.length),
    },
    { id: 'priority', label: 'Change priority…', run: (rows) => console.log('bulk priority', rows.length) },
    { id: 'print', label: 'Print job cards', run: (rows) => console.log('bulk print', rows.length) },
    {
      id: 'copy',
      label: 'Copy order numbers',
      run: (rows) => void navigator.clipboard?.writeText(rows.map((r) => r.number).join('\n')),
    },
    {
      id: 'cancel',
      label: 'Cancel orders…',
      destructive: true,
      disabled: (rows) => (rows.every((r) => r.status === 'done') ? 'All already done' : false),
      run: (rows) => {
        console.log('bulk cancel', rows.length)
        table.clearSelection()
      },
    },
  ]

  return (
    <div className="pg-page">
      <header className="pg-title">
        <span className="pg-crumb">Production</span>
        <span className="pg-crumb-sep" aria-hidden="true">
          /
        </span>
        <h1>Production orders</h1>
        <label>
          Row click
          <select value={rowClick} onChange={(e) => setRowClick(e.target.value as RowClickMode)}>
            <option value="none">None (default)</option>
            <option value="open">Open record</option>
            <option value="expand">Expand details</option>
          </select>
        </label>
        <label>
          Server
          <select value={location.search} onChange={(e) => (location.search = e.target.value)}>
            {SCENARIOS.map(([q, label]) => (
              <option key={q} value={q}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </header>
      <DataTable
        table={table}
        result={result}
        selectable
        selectionBar={params.get('bar') === 'toolbar' ? 'toolbar' : 'floating'}
        bulkActions={bulkActions}
        rowActions={rowActions}
        rowError={(r) => rowErrors.get(r.id)}
        rowClick={rowClick}
        renderExpanded={({ row }) => <Operations row={row} />}
        autoRefresh={30}
        onRowOpen={({ event, href }) => {
          event.preventDefault()
          console.log('open', href)
        }}
      />
    </div>
  )
}
