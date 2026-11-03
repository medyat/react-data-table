// Sahte Laravel API'si (Vite dev middleware): Vue playground'undaki mock-api.ts'in sipariş kısmı, aynı tohumla aynı veri.
// GET /api/orders?page=1&size=100&sort=dueAt&dir=asc&q=&filters=[…]&delay=ms&fail=1 → { items, hasMore } (simplePaginate gibi)
// GET /api/orders/count?q=&filters=[…]                                              → { total }
// `filters` JSON FilterCondition[]: sahte sunucu paketin `matches` eşlemesiyle uygular (hazır tarih aralıkları sunucuda çözülür, 04).
import type { Plugin } from 'vite'
import { matches } from '../../src/core/filters/model'
import type { FilterCondition } from '../../src/types'

export interface Order {
  id: number
  number: string
  product: { name: string; sku: string }
  customer: string
  status: 'draft' | 'planned' | 'released' | 'in_progress' | 'on_hold' | 'done'
  produced: number
  owner: { id: string; name: string } | null
  dueAt: string
  createdAt: string
  value: number
  currency: 'TRY'
  plant: 'Gebze' | 'Dilovası'
}

/** mulberry32: aynı tohum → aynı veri. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PRODUCTS = [
  'Gear pump GP-25',
  'Hydraulic cylinder HC-63',
  'Valve manifold block VM-4',
  'Pressure relief valve PR-16',
  'Hydraulic power unit HPU-5.5',
  'Directional valve DV-10',
  'Hydraulic cylinder HC-80',
  'Telescopic cylinder TC-3',
  'Cylinder mounting bracket CB-80',
  'Hose assembly kit HK-12',
  'Piston rod 40 × 600',
  'Seal kit SK-80',
  'Tipper cylinder TP-120',
]
const CUSTOMERS = [
  'Ege Tarım Makine',
  'Marmara Vinç',
  'Delta Forklift',
  'Kuzey Otomotiv',
  'Atlas Kaldırma',
  'Toros Makina',
  'Anka Damper',
  'Yıldız Pres',
  'Sakarya Römork',
  'Karadeniz Tersane',
]
const OWNERS = [
  { id: 'u1', name: 'Ayşe K.' },
  { id: 'u2', name: 'Emre T.' },
  { id: 'u3', name: 'Selin A.' },
  { id: 'u4', name: 'Burak Y.' },
  { id: 'u5', name: 'Deniz Ö.' },
  { id: 'u6', name: 'Murat S.' },
]
const STATUSES: Order['status'][] = [
  'draft',
  'planned',
  'released',
  'in_progress',
  'in_progress',
  'on_hold',
  'done',
  'done',
]
const TODAY = Date.UTC(2026, 9, 21)

export function makeOrders(count = 1284): Order[] {
  const r = rng(26)
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!
  return Array.from({ length: count }, (_, i) => {
    const status = pick(STATUSES)
    const produced =
      status === 'done' ? 100 : status === 'in_progress' || status === 'on_hold' ? Math.round(r() * 90) + 5 : 0
    const product = pick(PRODUCTS)
    return {
      id: i + 1,
      number: `WO-26-${String(300 + i).padStart(4, '0')}`,
      product: { name: product, sku: product.split(' ').at(-1)!.toUpperCase() },
      customer: pick(CUSTOMERS),
      status,
      produced,
      owner: r() < 0.08 ? null : pick(OWNERS),
      dueAt: new Date(TODAY + Math.round(r() * 60 - 20) * 86400000).toISOString().slice(0, 10),
      createdAt: new Date(TODAY - Math.round(r() * 90) * 86400000 - Math.round(r() * 86400000)).toISOString(),
      value: (Math.round(r() * 1_300_000 + 20_000) / 100) * 100,
      currency: 'TRY',
      plant: r() < 0.7 ? 'Gebze' : 'Dilovası',
    }
  })
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

export function mockApi(): Plugin {
  const orders = makeOrders()
  return {
    name: 'dt-mock-api',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const q = url.searchParams
        const json = (status: number, body: unknown) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(body))
        }
        if (q.has('delay')) await sleep(Number(q.get('delay')))
        if (q.get('fail') === '1') return json(500, { message: 'Simulated failure' })

        const search = (q.get('q') ?? '').toLocaleLowerCase('tr')
        const get = (o: Order, path: string): unknown =>
          path.split('.').reduce<unknown>((v, k) => (v as Record<string, unknown> | null)?.[k], o)
        const filters = JSON.parse(q.get('filters') || '[]') as FilterCondition[]
        const cell = (o: Order, column: string) => (column === 'owner' ? (o.owner?.id ?? null) : get(o, column))
        const matching = orders.filter(
          (o) =>
            (!search ||
              [o.number, o.product.name, o.customer].some((s) => s.toLocaleLowerCase('tr').includes(search))) &&
            filters.every((f) => matches(f, cell(o, f.column), { locale: 'tr' })),
        )

        if (url.pathname === '/orders/count') return json(200, { total: matching.length })
        if (url.pathname !== '/orders') return json(404, { message: 'Not found' })

        const sort = q.get('sort')
        const dir = q.get('dir') === 'desc' ? -1 : 1
        const sorted = sort
          ? [...matching].sort((a, b) => {
              const x = get(a, sort) as string | number
              const y = get(b, sort) as string | number
              return x > y ? dir : x < y ? -dir : 0
            })
          : matching
        const page = Math.max(1, Number(q.get('page') ?? 1))
        const size = Math.min(500, Math.max(1, Number(q.get('size') ?? 100)))
        const start = (page - 1) * size
        json(200, { items: sorted.slice(start, start + size), hasMore: start + size < sorted.length })
      })
    },
  }
}
