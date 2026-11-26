// DS1 · DataSheet (docs/data-sheet.md): ürün kartlarını toplu düzenleme. Kod anahtardır: yüklenen satırda kilitli,
// yeni satırda yazılır ya da boş bırakılır (sahte sunucu "P-<no>" verir). Para birimi gizli sütun: gönderilmez,
// değiştirilmişse gider. Sahte sunucu 100'erli parçaları 250 ms'de işler; adında "ERR" geçen satırı reddeder (alan
// hatası), "ROW" geçeni satır hatasıyla. Yükleme 2.000'lik sayfalarla. Araç çubuğu uygulamanındır (data-sheet.md §2):
// buradaki, kancanın durumunu ve komutlarını denemek için sade bir örnek; Swors kendi bileşenleriyle çizer.
import {
  DataSheet,
  useDataSheet,
  type ColumnDef,
  type DataSheetInstance,
  type SheetChanges,
  type SheetImportResult,
} from '@medyat/react-data-table'
import { useEffect, useState } from 'react'

interface Product {
  id: string
  code: string | null
  title: string | null
  category: string | null
  unit: string | null
  price: string | null
  currency: string | null
  vat: number | null
  active: boolean | null
  note: string | null
}

const categories = ['Hidrolik', 'Pompa', 'Vana', 'Conta', 'Filtre'].map((c) => ({ value: c.toLowerCase(), label: c }))
const units = [
  { value: 'C62', label: 'Adet' },
  { value: 'KGM', label: 'Kg' },
  { value: 'MTR', label: 'Metre' },
]

const columns: Array<ColumnDef<Product>> = [
  {
    id: 'code',
    header: 'Kod',
    type: 'string',
    width: 128,
    placeholder: () => 'Sonraki numara',
    importAliases: ['Stok Kodu', 'SKU'],
  },
  { id: 'title', header: 'Ürün adı', type: 'string', required: true, width: 260 },
  { id: 'category', header: 'Kategori', type: 'select', options: categories, required: true },
  { id: 'unit', header: 'Birim', type: 'select', options: units, required: true, width: 110 },
  {
    id: 'price',
    header: 'Liste fiyatı',
    type: 'decimal',
    validate: (v) => (v !== null && Number(v) < 0 ? 'Fiyat eksi olamaz' : null),
  },
  { id: 'currency', header: 'Para birimi', type: 'string', hidden: true, width: 110 },
  { id: 'vat', header: 'KDV', type: 'percentage', width: 90 },
  { id: 'active', header: 'Aktif', type: 'boolean', width: 90 },
  { id: 'note', header: 'Not', type: 'text', hidden: true },
]

const make = (from: number, count: number): Product[] =>
  Array.from({ length: count }, (_, k) => {
    const i = from + k
    return {
      id: `p${i}`,
      code: `HC-${String(i).padStart(5, '0')}`,
      title: `Hidrolik silindir ${i}`,
      category: categories[i % categories.length]!.value,
      unit: units[i % units.length]!.value,
      price: (100 + (i % 900) * 1.25).toFixed(2),
      currency: 'TRY',
      vat: 20,
      active: i % 7 !== 0,
      note: null,
    }
  })

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function Ds1DataSheet() {
  const [size, setSize] = useState(1000)
  return (
    <div className="pg-page">
      <p>
        <label>
          Satır:{' '}
          <select value={size} onChange={(e) => setSize(Number(e.target.value))}>
            <option value={1000}>1.000</option>
            <option value={10000}>10.000</option>
          </select>
        </label>
      </p>
      <Sheet key={size} size={size} />
    </div>
  )
}

function Sheet({ size }: { size: number }) {
  const [rows, setRows] = useState<Product[]>([])
  const [loading, setLoading] = useState<{ done: number; total: number } | false>({ done: 0, total: size })
  const [log, setLog] = useState<string[]>([])
  useEffect(() => {
    let off = false
    void (async () => {
      for (let i = 0; i < size; i += 2000) {
        await wait(150)
        if (off) return
        setRows((r) => [...r, ...make(i + 1, Math.min(2000, size - i))])
        setLoading({ done: Math.min(i + 2000, size), total: size })
      }
      setLoading(false)
    })()
    return () => {
      off = true
    }
  }, [size])

  const [serial] = useState(() => ({ n: size }))
  const onSave = async ({ rows: changed }: SheetChanges<Product>) => {
    setLog((l) => [`${changed.length} satır gönderiliyor`, ...l].slice(0, 8))
    for (let i = 0; i < changed.length; i += 100) {
      await wait(250)
      sheet.applyResult(
        changed.slice(i, i + 100).map((c) => {
          const title = String(c.row.title ?? '')
          if (title.includes('ERR'))
            return { id: c.id, status: 'error', fieldErrors: { title: 'Sunucu bu adı kabul etmedi' } }
          if (title.includes('ROW')) return { id: c.id, status: 'error', rowError: 'Kayıt kilitli' }
          if (!c.isNew) return { id: c.id, status: 'updated' }
          const code = c.key ? String(c.key) : `P-${++serial.n}`
          return { id: c.id, status: 'created', row: { ...(c.row as Product), id: `s-${code}`, code } }
        }),
      )
    }
    setLog((l) => [`gönderilen ilk satırın değerleri: ${JSON.stringify(changed[0]?.values)}`, ...l].slice(0, 8))
  }

  const sheet = useDataSheet<Product>({
    rows,
    loading,
    columns,
    keyColumn: 'code',
    getRowId: (r) => r.id,
    newRow: () => ({ unit: 'C62', vat: 20, active: true, currency: 'TRY' }),
    onSave,
  })

  return (
    <>
      <Toolbar
        sheet={sheet}
        loading={loading}
        onImported={(r) =>
          setLog((l) => [`içe aktarıldı: ${r.updated} güncellendi · ${r.added} eklendi`, ...l].slice(0, 8))
        }
      />
      <DataSheet sheet={sheet} label="Ürünler" />
      <p>isDirty: {String(sheet.isDirty)}</p>
      <ul>
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </>
  )
}

const VIEWS = { all: 'Tümü', changed: 'Değişen', errors: 'Hatalı' } as const

function Toolbar({
  sheet,
  loading,
  onImported,
}: {
  sheet: DataSheetInstance<Product>
  loading: { done: number; total: number } | false
  onImported: (r: SheetImportResult) => void
}) {
  const { summary, result, saving } = sheet
  const status = saving
    ? `Kaydediliyor: ${saving.done} / ${saving.total}`
    : loading
      ? `Yükleniyor: ${loading.done} / ${loading.total}`
      : summary.rows
        ? `${summary.rows} satırda ${summary.cells} değişiklik${summary.newRows ? ` · ${summary.newRows} yeni` : ''}`
        : result
          ? `${result.created + result.updated} kaydedildi · ${result.failed} hatalı`
          : 'Değişiklik yok'
  return (
    <div className="pg-sheet-toolbar" role="toolbar" aria-label="Ürünler">
      {sheet.phone && <strong>Telefonda yalnız görüntülenir</strong>}
      {(Object.keys(VIEWS) as Array<keyof typeof VIEWS>).map((v) => (
        <button key={v} type="button" aria-pressed={sheet.view === v} onClick={() => sheet.setView(v)}>
          {VIEWS[v]} {sheet.counts[v]}
        </button>
      ))}
      <button type="button" disabled={!sheet.canUndo} onClick={sheet.undo}>
        Geri al
      </button>
      <button type="button" disabled={!sheet.canRedo} onClick={sheet.redo}>
        Yinele
      </button>
      <button
        type="button"
        disabled={sheet.readOnly}
        onClick={() => void sheet.importFile().then((r) => r && onImported(r))}
      >
        İçe aktar
      </button>
      <button type="button" onClick={() => void sheet.exportFile({ format: 'xlsx', name: 'ürünler' })}>
        Excel
      </button>
      <button type="button" onClick={() => void sheet.exportFile({ format: 'csv', name: 'ürünler', rows: 'view' })}>
        CSV (görünen)
      </button>
      <details>
        <summary>Sütunlar</summary>
        {sheet.columns.map((c) => (
          <label key={c.id}>
            <input type="checkbox" checked={c.visible} onChange={() => sheet.toggleColumn(c.id)} /> {c.label}
          </label>
        ))}
      </details>
      <span className="pg-sheet-status">{status}</span>
      <button type="button" disabled={!summary.rows || sheet.readOnly} onClick={sheet.discard}>
        Vazgeç
      </button>
      <button type="button" disabled={!summary.rows || sheet.readOnly} onClick={sheet.save}>
        Kaydet ⌘S
      </button>
    </div>
  )
}
