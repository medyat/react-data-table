// FormGrid C adımı: iskelet (role=grid, satır no, boş satır, ⋯), fare ve klavyeyle seçim, Space ile yazma, geri al.
import { TrashIcon } from '@phosphor-icons/react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DataTableProvider } from '../src/core/provider'
import { FormGrid } from '../src/form-grid/form-grid'
import type { ColumnDef, FormGridChange, RowAction } from '../src/types'
import { flush, mockLayout } from './helpers/dom'

interface Line {
  code: string | null
  qty: number | null
  gift: boolean | null
}
const columns: Array<ColumnDef<Line>> = [
  { id: 'code', header: 'Ürün', type: 'string', required: true, editable: (_r, { isNew }) => isNew },
  { id: 'qty', header: 'Miktar', type: 'decimal', hint: 'Satırın miktarı' },
  { id: 'gift', header: 'Promosyon', type: 'boolean' },
]
const initial: Line[] = [
  { code: 'A', qty: 1, gift: false },
  { code: 'B', qty: 2, gift: null },
]

function Harness({
  onChange,
  actions,
}: {
  onChange?: (rows: Line[], c: FormGridChange) => void
  actions?: Array<RowAction<Line>>
}) {
  const [rows, setRows] = useState(initial)
  return (
    <FormGrid
      label="Satırlar"
      rows={rows}
      columns={columns}
      rowActions={actions}
      onRowsChange={(next, change) => {
        setRows(next)
        onChange?.(next, change)
      }}
    />
  )
}

const cell = (row: number, col: number) =>
  document.querySelector<HTMLElement>(`.dt-form-grid .dt-cell[data-row="${row}"][data-col="${col}"]`)!

beforeAll(mockLayout)
afterEach(cleanup)

describe('FormGrid iskeleti', () => {
  it('role=grid; satır no; altta boş satır; zorunlu yıldız ve açıklama başlıkta; ⋯ yalnız dolu satırda', async () => {
    const actions: Array<RowAction<Line>> = [{ id: 'rm', label: 'Sil', icon: TrashIcon, run: () => {} }]
    render(<Harness actions={actions} />)
    await flush()
    const grid = screen.getByRole('grid', { name: 'Satırlar' })
    expect(grid.getAttribute('aria-rowcount')).toBe('4')
    expect(
      within(grid)
        .getAllByRole('rowheader')
        .map((c) => c.textContent),
    ).toEqual(['1', '2', ''])
    expect(within(grid).getByRole('img', { name: 'Required' })).toBeTruthy()
    expect(within(grid).getByRole('img', { name: 'Satırın miktarı' })).toBeTruthy()
    expect(grid.querySelectorAll('.dt-row-more')).toHaveLength(2)
    // Başlıkta sütun menüsü yok: formun sütunu gizlenmez, taşınmaz.
    expect(grid.querySelector('.dt-head-menu')).toBeNull()
  })
  it('kilitli hücre aria-readonly; açılıştaki satırda Ürün kilitli, boş satırda açık', async () => {
    render(<Harness />)
    await flush()
    expect(cell(0, 0).getAttribute('aria-readonly')).toBe('true')
    expect(cell(2, 0).hasAttribute('aria-readonly')).toBe(false)
  })
})

describe('seçim ve klavye', () => {
  it('tık aktif yapar ve odaklar; ok tuşu odağı taşır; ⇧ tık aralık seçer', async () => {
    render(<Harness />)
    await flush()
    fireEvent.pointerDown(cell(0, 1), { button: 0 })
    cell(0, 1).focus()
    await flush()
    expect(['is-active'].every((c) => cell(0, 1).classList.contains(c))).toBe(true)
    expect(cell(0, 1).getAttribute('tabindex')).toBe('0')
    fireEvent.keyDown(cell(0, 1), { key: 'ArrowDown' })
    await flush()
    expect(document.activeElement).toBe(cell(1, 1))
    expect(cell(0, 1).getAttribute('tabindex')).toBe('-1')
    fireEvent.pointerDown(cell(1, 2), { button: 0, shiftKey: true })
    await flush()
    expect(['is-selected'].every((c) => cell(1, 1).classList.contains(c))).toBe(true)
    expect(['is-active', 'is-selected', 'is-edge-r'].every((c) => cell(1, 2).classList.contains(c))).toBe(true)
  })
  it('Space boolean hücresini yazar; ⌘Z geri alır; değişiklik türü bildirilir', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await flush()
    fireEvent.pointerDown(cell(0, 2), { button: 0 })
    cell(0, 2).focus()
    fireEvent.keyDown(cell(0, 2), { key: ' ' })
    await flush()
    expect(onChange).toHaveBeenLastCalledWith([{ code: 'A', qty: 1, gift: true }, initial[1]], {
      kind: 'edit',
      cells: [{ row: 0, column: 'gift' }],
    })
    expect(cell(0, 2).textContent).toContain('Yes')
    const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true }
    await act(async () => fireEvent.keyDown(cell(0, 2), { key: 'z', ...mod }))
    await flush()
    expect(onChange.mock.calls.at(-1)![1]).toEqual({ kind: 'undo', cells: [{ row: 0, column: 'gift' }] })
    expect(onChange.mock.calls.at(-1)![0][0].gift).toBe(false)
  })
})

// D adımı: düzenleme ve editörler (form-grid.md §8, Vue 07 §5).
interface Item {
  code: string | null
  qty: string | number | null
  unit: string | null
  gift: boolean | null
  note?: string | null
}
const editColumns: Array<ColumnDef<Item>> = [
  { id: 'code', header: 'Ürün', type: 'string' },
  { id: 'qty', header: 'Miktar', type: 'decimal' },
  {
    id: 'unit',
    header: 'Birim',
    type: 'select',
    options: [
      { value: 'm', label: 'Metre' },
      { value: 'pc', label: 'Adet' },
    ],
  },
  { id: 'gift', header: 'Promosyon', type: 'boolean' },
  { id: 'note', header: 'Not', type: 'text' },
]
function EditHarness({ onChange, initial }: { onChange: (rows: Item[], c: FormGridChange) => void; initial?: Item[] }) {
  const [rows, setRows] = useState<Item[]>(initial ?? [{ code: 'A', qty: 1200.5, unit: 'pc', gift: false }])
  return (
    <DataTableProvider locale="tr-TR">
      <input aria-label="Dışarıdaki alan" />
      <FormGrid
        label="Satırlar"
        rows={rows}
        columns={editColumns}
        onRowsChange={(next, change) => {
          setRows(next)
          onChange(next, change)
        }}
      />
    </DataTableProvider>
  )
}
const editor = () =>
  document.querySelector<HTMLInputElement>('.dt-form-grid .is-editing input, .dt-form-grid .is-editing textarea')
async function openGrid(initial?: Item[]) {
  const onChange = vi.fn()
  render(<EditHarness onChange={onChange} initial={initial} />)
  await flush()
  return onChange
}

describe('düzenleme', () => {
  it('yazmak düzenler ve içeriği değiştirir; Enter yerel ayara göre çözümleyip yazar ve alt hücreye iner', async () => {
    const onChange = await openGrid()
    fireEvent.pointerDown(cell(0, 1), { button: 0 })
    fireEvent.keyDown(cell(0, 1), { key: '2' })
    expect(editor()?.value).toBe('2')
    expect(document.activeElement).toBe(editor())
    fireEvent.change(editor()!, { target: { value: '2,5' } })
    fireEvent.keyDown(editor()!, { key: 'Enter' })
    await flush()
    expect(onChange.mock.lastCall?.[0][0].qty).toBe('2.5')
    expect(editor()).toBeNull()
    expect(cell(1, 1).classList.contains('is-active')).toBe(true)
    expect(document.activeElement).toBe(cell(1, 1))
  })
  it('F2 mevcut değeri yerel ondalıkla açar (tr: 1200,5); Esc iptal eder, odak hücreye döner', async () => {
    const onChange = await openGrid()
    fireEvent.pointerDown(cell(0, 1), { button: 0 })
    fireEvent.keyDown(cell(0, 1), { key: 'F2' })
    expect(editor()?.value).toBe('1200,5')
    fireEvent.change(editor()!, { target: { value: '9' } })
    fireEvent.keyDown(editor()!, { key: 'Escape' })
    await flush()
    expect(onChange).not.toHaveBeenCalled()
    expect(editor()).toBeNull()
    expect(document.activeElement).toBe(cell(0, 1))
  })
  it('ondalık metin: F2 noktayı ondalık okur (tr "123.456" → "123,456"); değişmeden Enter yazmaz; yazılan metin olarak gider', async () => {
    const onChange = await openGrid([{ code: 'A', qty: '123.456', unit: 'pc', gift: false }])
    fireEvent.pointerDown(cell(0, 1), { button: 0 })
    fireEvent.keyDown(cell(0, 1), { key: 'F2' })
    expect(editor()?.value).toBe('123,456')
    fireEvent.keyDown(editor()!, { key: 'Enter' })
    await flush()
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.keyDown(cell(1, 1), { key: 'ArrowUp' })
    fireEvent.keyDown(cell(0, 1), { key: 'F2' })
    fireEvent.change(editor()!, { target: { value: '0,1' } })
    fireEvent.keyDown(editor()!, { key: 'Enter' })
    await flush()
    expect(onChange.mock.lastCall?.[0][0].qty).toBe('0.1')
  })
  it('sayı kutusu harfi ve ikinci ayırıcıyı almaz: görünen değer yazılandır', async () => {
    await openGrid()
    fireEvent.pointerDown(cell(0, 1), { button: 0 })
    fireEvent.keyDown(cell(0, 1), { key: 'F2' })
    fireEvent.change(editor()!, { target: { value: '12a,5,3' } })
    expect(editor()?.value).toBe('12,53')
  })
  it('Tab onaylar ve sağa geçer; boş satıra yazmak satırı doğurur', async () => {
    const onChange = await openGrid()
    fireEvent.pointerDown(cell(1, 0), { button: 0 })
    fireEvent.keyDown(cell(1, 0), { key: 'X' })
    fireEvent.keyDown(editor()!, { key: 'Tab' })
    await flush()
    expect(onChange.mock.lastCall?.[0]).toHaveLength(2)
    expect(onChange.mock.lastCall?.[0][1]).toEqual({ code: 'X' })
    expect(cell(1, 1).classList.contains('is-active')).toBe(true)
  })
  it('seçenek: yazılan etiketle eşleşen değer yazılır (İ/ı ve harf duyarsız)', async () => {
    const onChange = await openGrid()
    fireEvent.pointerDown(cell(0, 2), { button: 0 })
    fireEvent.keyDown(cell(0, 2), { key: 'F2' })
    expect(editor()?.value).toBe('Adet')
    fireEvent.change(editor()!, { target: { value: 'METRE' } })
    // Liste açıkken Enter önce listeye gider; Tab her durumda onaylar.
    fireEvent.keyDown(editor()!, { key: 'Tab' })
    await flush()
    expect(onChange.mock.lastCall?.[0][0].unit).toBe('m')
  })
  it('seçenek: liste açıkken tek Esc düzenlemeyi iptal eder, odak hücreye döner (Excel gibi; Vue 07 §5 iki Esc)', async () => {
    const onChange = await openGrid()
    fireEvent.pointerDown(cell(0, 2), { button: 0 })
    fireEvent.keyDown(cell(0, 2), { key: 'F2' })
    fireEvent.change(editor()!, { target: { value: 'met' } })
    expect(editor()?.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(editor()!, { key: 'Escape' })
    await flush()
    expect(editor()).toBeNull()
    expect(document.querySelector('.dt-cell-list')).toBeNull()
    expect(document.activeElement).toBe(cell(0, 2))
    expect(onChange).not.toHaveBeenCalled()
  })
  it('çift tık düzenler; boolean hücresinde çevirir', async () => {
    const onChange = await openGrid()
    fireEvent.doubleClick(cell(0, 0))
    expect(editor()?.value).toBe('A')
    fireEvent.keyDown(editor()!, { key: 'Escape' })
    fireEvent.doubleClick(cell(0, 3))
    await flush()
    expect(onChange.mock.lastCall?.[0][0].gift).toBe(true)
  })
  it('uzun metin hücrenin altındaki kutuda yazılır: ⤢ açar, ⌥↵ satır atlatır, Enter onaylar ve odak hücreye döner', async () => {
    const onChange = await openGrid()
    fireEvent.pointerDown(cell(0, 4), { button: 0 })
    fireEvent.keyDown(cell(0, 4), { key: 'İ' })
    await flush()
    const box = () => document.querySelector<HTMLTextAreaElement>('.dt-text-pop textarea')
    expect(box()?.value).toBe('İ')
    fireEvent.change(box()!, { target: { value: 'İlk' } })
    fireEvent.keyDown(box()!, { key: 'Enter', altKey: true })
    expect(box()?.value).toBe('İlk\n')
    expect(cell(0, 4).textContent).toBe('İlk')
    fireEvent.keyDown(box()!, { key: 'Enter' })
    await flush()
    expect(onChange.mock.lastCall?.[0][0].note).toBe('İlk')
    expect(box()).toBeNull()
    expect(document.activeElement).toBe(cell(1, 4))
    // Yazılmış metinde ⤢ kutuyu açar.
    fireEvent.click(cell(0, 4).querySelector('.dt-text-expand')!)
    await flush()
    expect(box()?.value).toBe('İlk')
  })
  it('ızgara dışına tık onaylar ve odağı oraya bırakır', async () => {
    const onChange = await openGrid()
    fireEvent.pointerDown(cell(0, 0), { button: 0 })
    fireEvent.keyDown(cell(0, 0), { key: 'B' })
    const outside = screen.getByLabelText('Dışarıdaki alan')
    fireEvent.pointerDown(outside)
    outside.focus()
    await flush()
    expect(onChange.mock.lastCall?.[0][0].code).toBe('B')
    expect(document.activeElement).toBe(outside)
  })
})

// F2: sunucuda aranan seçenek ve aynı satıra yazma (form-grid.md §3.2).
describe('ajax hücresi', () => {
  it('Item verilince liste seçeneği onunla çizilir; aramanın ek alanları ve yazılan metin gelir', async () => {
    type Product = { value: string; label: string; stock: number; category: string }
    const products: Product[] = [{ value: 'VDA-6', label: 'Vida, 6 mm', stock: 120, category: 'Bağlantı' }]
    const cols: Array<ColumnDef<{ product: string | null }>> = [
      {
        id: 'product',
        header: 'Ürün',
        type: 'ajax',
        remote: { search: async () => ({ items: products, hasMore: false }), resolve: async () => products },
        Item: ({ option, search }) => {
          const p = option as Product
          return (
            <span data-testid="item">
              {p.label} · {p.category} · {p.stock} · {search}
            </span>
          )
        },
      },
    ]
    render(
      <DataTableProvider locale="tr-TR">
        <FormGrid label="Satırlar" rows={[]} columns={cols} onRowsChange={() => {}} />
      </DataTableProvider>,
    )
    await flush()
    fireEvent.pointerDown(cell(0, 0), { button: 0 })
    fireEvent.keyDown(cell(0, 0), { key: 'v' })
    await flush()
    expect((await screen.findByTestId('item')).textContent).toBe('Vida, 6 mm · Bağlantı · 120 · v')
  })

  type Line = { product: string | null; title: string | null; qty: string | null }
  const items = [
    { value: 'VDA-6', label: 'Vida, 6 mm' },
    { value: 'DBL-8', label: 'Dübel, 8 mm' },
  ]
  it('yazdıkça satırla arar; listeden seçmek onChange ile aynı adımda yazar; yazılan metin değer olmaz', async () => {
    const search = vi.fn(async (q: string) => ({
      items: items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase())),
      hasMore: false,
    }))
    const cols: Array<ColumnDef<Line>> = [
      {
        id: 'product',
        header: 'Ürün',
        type: 'ajax',
        remote: { search, resolve: async (v) => items.filter((i) => v.includes(i.value)) },
        onChange: (_row, _v, { option }) => ({ title: option?.label ?? null }),
      },
      { id: 'title', header: 'Ad', type: 'string' },
      { id: 'qty', header: 'Miktar', type: 'decimal' },
    ]
    const onChange = vi.fn()
    function Harness() {
      const [rows, setRows] = useState<Line[]>([{ product: 'VDA-6', title: 'Vida, 6 mm', qty: '1' }])
      return (
        <DataTableProvider locale="tr-TR">
          <FormGrid
            label="Satırlar"
            rows={rows}
            columns={cols}
            onRowsChange={(next, change) => {
              setRows(next)
              onChange(next, change)
            }}
          />
        </DataTableProvider>
      )
    }
    render(<Harness />)
    await flush()
    fireEvent.pointerDown(cell(0, 0), { button: 0 })
    fireEvent.keyDown(cell(0, 0), { key: 'd' })
    await flush()
    expect(search).toHaveBeenLastCalledWith(
      'd',
      1,
      expect.objectContaining({ row: expect.objectContaining({ product: 'VDA-6' }) }),
    )
    // Seçmeden çıkış: yazılan "d" değer değildir, hücre değişmez.
    fireEvent.keyDown(editor()!, { key: 'Escape' })
    await flush()
    expect(editor()).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.keyDown(cell(0, 0), { key: 'F2' })
    expect(editor()?.value).toBe('Vida, 6 mm')
    fireEvent.change(editor()!, { target: { value: 'dübel' } })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300))
    })
    await flush()
    fireEvent.click(await screen.findByRole('option', { name: /Dübel/ }))
    await flush()
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.lastCall).toEqual([
      [{ product: 'DBL-8', title: 'Dübel, 8 mm', qty: '1' }],
      {
        kind: 'edit',
        cells: [
          { row: 0, column: 'product' },
          { row: 0, column: 'title' },
        ],
      },
    ])
  })
})

// F3: pano ve ⌘D (Vue 07 §7–8).
describe('pano', () => {
  const clip = () => {
    const data: Record<string, string> = {}
    return {
      data,
      clipboardData: {
        setData: (type: string, value: string) => (data[type] = value),
        getData: (type: string) => data[type] ?? '',
      },
    }
  }
  const mod = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true })

  it('⌘C seçimi görünen biçimde TSV yazar; ⌘V aktif hücreden yapıştırır, alttan taşan yeni satır olur', async () => {
    const onChange = await openGrid([
      { code: 'A', qty: '1200.5', unit: 'pc', gift: false },
      { code: 'B', qty: '3', unit: 'm', gift: true },
    ])
    fireEvent.pointerDown(cell(0, 0), { button: 0 })
    fireEvent.pointerDown(cell(1, 2), { button: 0, shiftKey: true })
    const c = clip()
    fireEvent.copy(cell(1, 2), c)
    expect(c.data['text/plain']).toBe('A\t1.200,50\tAdet\nB\t3,00\tMetre')
    fireEvent.pointerDown(cell(1, 0), { button: 0 })
    const p = clip()
    p.data['text/plain'] = 'C\t2,5\tmetre\r\nD\t7\tAdet\r\n'
    fireEvent.paste(cell(1, 0), p)
    await flush()
    expect(onChange.mock.lastCall).toEqual([
      [
        { code: 'A', qty: '1200.5', unit: 'pc', gift: false },
        { code: 'C', qty: '2.5', unit: 'm', gift: true },
        { code: 'D', qty: '7', unit: 'pc' },
      ],
      expect.objectContaining({ kind: 'paste' }),
    ])
  })

  it('⌘X kopyalar ve temizler; ⌘D üstteki değeri aşağı yazar', async () => {
    const onChange = await openGrid([
      { code: 'A', qty: '1', unit: 'pc', gift: false },
      { code: 'B', qty: '2', unit: 'm', gift: false },
    ])
    fireEvent.pointerDown(cell(1, 1), { button: 0 })
    fireEvent.keyDown(cell(1, 1), { key: 'd', ...mod() })
    await flush()
    expect(onChange.mock.lastCall?.[0][1].qty).toBe('1')
    expect(onChange.mock.lastCall?.[1].kind).toBe('fill')
    const c = clip()
    fireEvent.cut(cell(1, 1), c)
    await flush()
    expect(c.data['text/plain']).toBe('1,00')
    expect(onChange.mock.lastCall?.[0][1].qty).toBeNull()
  })
})

describe('ajax yapıştırma', () => {
  it('Excel kodu match ile değere çevrilir, seçenek onChange e gider; bulunamayan kod metin kalır', async () => {
    type Line = { product: number | string | null; title: string | null }
    const catalog = [{ value: 7, label: 'Vida, 6 mm', code: 'VDA-6' }]
    const match = vi.fn(async (texts: string[]) => texts.map((t) => catalog.find((c) => c.code === t) ?? null))
    const cols: Array<ColumnDef<Line>> = [
      {
        id: 'product',
        header: 'Ürün',
        type: 'ajax',
        remote: { search: async () => ({ items: [], hasMore: false }), resolve: async () => [], match },
        onChange: (_r, _v, { option }) => ({ title: option?.label ?? null }),
      },
      { id: 'title', header: 'Ad', type: 'string' },
    ]
    const onChange = vi.fn()
    function Harness() {
      const [rows, setRows] = useState<Line[]>([])
      return (
        <DataTableProvider locale="tr-TR">
          <FormGrid
            label="Satırlar"
            rows={rows}
            columns={cols}
            onRowsChange={(next, change) => {
              setRows(next)
              onChange(next, change)
            }}
          />
        </DataTableProvider>
      )
    }
    render(<Harness />)
    await flush()
    fireEvent.pointerDown(cell(0, 0), { button: 0 })
    fireEvent.paste(cell(0, 0), {
      clipboardData: { getData: (t: string) => (t === 'text/plain' ? 'VDA-6\t\nYOK-1\tElle' : '') },
    })
    await flush()
    expect(match).toHaveBeenCalledWith(['VDA-6', 'YOK-1'], expect.anything())
    expect(onChange.mock.lastCall?.[0]).toEqual([
      { product: 7, title: 'Vida, 6 mm' },
      { product: 'YOK-1', title: 'Elle' },
    ])
    expect(cell(0, 0).textContent).toBe('Vida, 6 mm')
  })
})

describe('⌘F arama', () => {
  const mod = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true })
  it('görünen metinde bulur, Enter sonraki / ⇧Enter önceki eşleşmeyi aktif yapar, Esc kapatır ve odak hücrede', async () => {
    await openGrid([
      { code: 'A', qty: '1200.5', unit: 'pc', gift: false },
      { code: 'B', qty: '3', unit: 'm', gift: true },
      { code: 'C', qty: '4', unit: 'm', gift: false },
    ])
    fireEvent.pointerDown(cell(0, 0), { button: 0 })
    fireEvent.keyDown(cell(0, 0), { key: 'f', ...mod() })
    const box = screen.getByRole('textbox', { name: 'Tabloda bul' })
    fireEvent.change(box, { target: { value: 'metre' } })
    expect(document.querySelectorAll('.is-found')).toHaveLength(2)
    expect(screen.getByText('0 / 2')).toBeTruthy()
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(cell(1, 2).classList.contains('is-active')).toBe(true)
    expect(screen.getByText('1 / 2')).toBeTruthy()
    fireEvent.keyDown(box, { key: 'Enter' })
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    expect(cell(1, 2).classList.contains('is-active')).toBe(true)
    fireEvent.keyDown(box, { key: 'Escape' })
    await flush()
    expect(screen.queryByRole('textbox', { name: 'Tabloda bul' })).toBeNull()
    expect(document.activeElement).toBe(cell(1, 2))
  })
})

it('boş satırın hücrelerinde "Yeni satır" soluk yazar', async () => {
  await openGrid([{ code: 'A', qty: '1', unit: 'pc', gift: false }])
  expect(cell(1, 0).querySelector('.dt-cell-placeholder')?.textContent).toBe('Yeni satır')
  expect(cell(1, 1).querySelector('.dt-cell-placeholder')?.textContent).toBe('Yeni satır')
  expect(cell(0, 0).querySelector('.dt-cell-placeholder')).toBeNull()
})
