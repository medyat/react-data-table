// F1 · FormGrid: Sevk belgesi satırları formun içinde (docs/form-grid.md). Üstte yer tutucu form alanları: ızgara
// sayfayla kayar, başlık ve alt çubuk yapışkan. "1000 × 30" ölçüm verisi. Hatalar (E): Miktar 0 ya da eksi istemci
// hatası, 1000'den büyük uyarı; "Sunucu hataları" kaydetmenin döndürdüğü 422'yi taklit eder (form-grid.md §6).
// F2: Ürün sunucuda aranır (300 ms yapay gecikme), seçilince Ad ve Birim dolar (`onChange`); yeni satır KDV %20 ve
// Adet ile başlar (`newRow`); boş Teslim belgenin tarihini soluk gösterir (`placeholder`), Promosyonlu satırda zorunlu;
// Metre tek satırda seçilebilir (`optionEnabled`); "En çok 6 satır" `maxRows`.
import { TrashIcon } from '@phosphor-icons/react'
import { FormGrid, type ColumnDef, type OptionDef, type RowAction } from '@medyat/react-data-table'
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

type Product = OptionDef & { unit: string; category: string; stock: number }
const catalog: Product[] = (
  [
    ['RAY-AL', 'Korniş ray, alüminyum', 'm', 'Ray', 420],
    ['RAY-CL', 'Korniş ray, çelik', 'm', 'Ray', 0],
    ['KUM-LN', 'Lina tül kumaş, beyaz', 'm', 'Kumaş', 1280],
    ['KUM-BL', 'Blackout kumaş, gri', 'm', 'Kumaş', 96],
    ['SMF-RTS', 'Somfy motor RTS, 10 Nm', 'pcs', 'Motor', 14],
    ['SMF-IO', 'Somfy motor io, 6 Nm', 'pcs', 'Motor', 3],
    ['VDA-6', 'Vida, 6 mm', 'pcs', 'Bağlantı', 5400],
    ['DBL-8', 'Dübel, 8 mm', 'pcs', 'Bağlantı', 2200],
    ['KRS-50', 'Kurşun şerit', 'kg', 'Aksesuar', 38],
  ] as const
).map(([value, label, unit, category, stock]) => ({ value, label, unit, category, stock }))
const unitShort: Record<string, string> = { m: 'm', pcs: 'ad', kg: 'kg' }

// Liste seçeneği: ad ve kod solda, kategori ve stok sağda (stoksuz soluk).
function ProductItem({ option }: { option: OptionDef; search: string }) {
  const p = option as Product
  return (
    <span className="pg-product">
      <span>
        {p.label}
        <small>
          {p.value} · {p.category}
        </small>
      </span>
      <b className={p.stock ? undefined : 'is-empty'}>
        {p.stock.toLocaleString('tr-TR')} {unitShort[p.unit]}
      </b>
    </span>
  )
}
const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(t)
      reject(signal.reason)
    })
  })

const base: Array<ColumnDef<Line>> = [
  {
    id: 'code',
    header: 'Ürün',
    type: 'ajax',
    width: 140,
    required: true,
    remote: {
      async search(q, _page, { signal }) {
        await wait(300, signal)
        const n = q.toLocaleLowerCase('tr')
        const items = catalog.filter((p) => `${p.value} ${p.label}`.toLocaleLowerCase('tr').includes(n))
        return { items, hasMore: false }
      },
      resolve: async (values) => catalog.filter((p) => values.includes(p.value)),
    },
    Item: ProductItem,
    // Hücre yalnız kodu gösterir (kod + ad uzun); ad Ad sütununa yazılır.
    cell: ({ value }) => (value as string | null) ?? '',
    onChange: (_row, _value, { option }) => {
      const p = option as Product | undefined
      return { title: p?.label ?? null, unit: p?.unit ?? null }
    },
  },
  { id: 'title', header: 'Ad', type: 'string', width: 240 },
  {
    id: 'qty',
    header: 'Miktar',
    type: 'decimal',
    width: 104,
    required: true,
    validate: (v) => (v !== null && v !== '' && Number(v) <= 0 ? 'Miktar sıfırdan büyük olmalı' : null),
    warn: (v) => (Number(v) > 1000 ? 'Miktar alışılmadık derecede yüksek' : null),
  },
  {
    id: 'unit',
    header: 'Birim',
    type: 'select',
    options: units,
    width: 112,
    optionEnabled: (o, row, rows) => o.value !== 'm' || !rows.some((r) => r !== row && r.unit === 'm'),
  },
  { id: 'price', header: 'Birim fiyat', type: 'currency', currency: 'TRY', width: 128 },
  { id: 'vat', header: 'KDV', type: 'percentage', width: 80, hint: 'Satırın KDV oranı; boşsa üründen gelir.' },
  {
    id: 'date',
    header: 'Teslim',
    type: 'date',
    width: 128,
    placeholder: () => '1 Ara',
    required: (row) => row.gift === true,
  },
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
  const [server, setServer] = useState(false)
  const [limit, setLimit] = useState(false)
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
        <label>
          <input type="checkbox" checked={server} onChange={(e) => setServer(e.target.checked)} /> Sunucu hataları
        </label>
        <label>
          <input type="checkbox" checked={limit} onChange={(e) => setLimit(e.target.checked)} /> En çok 6 satır
        </label>
      </div>
      <FormGrid
        key={size}
        label="Satırlar"
        rows={rows}
        columns={size === 'big' ? wide : base}
        rowActions={actions}
        newRow={() => ({ vat: 20, unit: 'pcs' })}
        maxRows={limit ? 6 : undefined}
        errors={
          server
            ? {
                '1.qty': 'Depoda yeterli stok yok (120 m var).',
                '2.unit': 'Bu ürün yalnız adetle satılır.',
                '3': 'Satır faturalandı; değiştirilemez.',
              }
            : undefined
        }
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
