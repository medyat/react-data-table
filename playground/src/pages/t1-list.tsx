// T1 · List screen: sunucu modu, TanStack Query ile (R4). Sahte Laravel API'si (/api/orders): sıralama, sayfalama, Count total,
// yükleme geçişleri. Sunucu senaryosu adres çubuğundan: ?delay=1500 ?fail=1 ?failAfter=1 ?size=500 (hash'ten önce).
// Araç çubuğu ve sütun yönetimi Faz 2'nin ikinci diliminde; filtre ve arama Faz 3a.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { DataTable, useDataTable, type Density, type QueryWithoutPage, type TableQuery } from '@medyat/react-data-table'
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

export function T1List({ density }: { density: Density }) {
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

  return (
    <div className="pg-page">
      <header className="pg-title">
        <span className="pg-crumb">Production</span>
        <span className="pg-crumb-sep" aria-hidden="true">
          /
        </span>
        <h1>Production orders</h1>
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
      <DataTable table={table} result={result} />
    </div>
  )
}
