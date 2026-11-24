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
    expect(grid.querySelectorAll('.dt-row-more:not(.dt-row-edit)')).toHaveLength(2)
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

describe('sağ tık menüsü (pano ContextMenu)', () => {
  type L = { code: string | null; lot: string | null }
  const cols: Array<ColumnDef<L>> = [
    { id: 'code', header: 'Ürün', type: 'string' },
    { id: 'lot', header: 'Lot', type: 'string', editable: false },
  ]
  function Harness({ onChange }: { onChange: (rows: L[], c: FormGridChange) => void }) {
    const [rows, setRows] = useState<L[]>([
      { code: 'A', lot: 'L1' },
      { code: 'B', lot: 'L2' },
      { code: 'C', lot: 'L3' },
    ])
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
  const open = async (at: HTMLElement) => {
    fireEvent.contextMenu(at)
    await flush()
    return screen.getByRole('menu')
  }

  it('başlıklar hücre ve kilitli sayısını, satır sayısını yazar; sil ⌘⌫ taşır', async () => {
    render(<Harness onChange={vi.fn()} />)
    await flush()
    fireEvent.pointerDown(cell(0, 0), { button: 0 })
    fireEvent.pointerDown(cell(1, 1), { button: 0, shiftKey: true })
    const menu = await open(cell(1, 1))
    expect(within(menu).getByText('4 hücre · 2 kilitli hücre atlanır')).toBeTruthy()
    expect(within(menu).getByText('2 satır')).toBeTruthy()
    const remove = within(menu).getByRole('menuitem', { name: /2 satırı sil/ })
    expect(remove.textContent).toContain(/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘⌫' : 'Ctrl+Backspace')
  })

  it('seçimin hepsi kilitliyse Kes, Temizle ve Doldur pasif', async () => {
    render(<Harness onChange={vi.fn()} />)
    await flush()
    fireEvent.pointerDown(cell(1, 1), { button: 0 })
    const menu = await open(cell(1, 1))
    for (const name of [/Kes/, /İçeriği temizle/, /Aşağı doldur/])
      expect(within(menu).getByRole('menuitem', { name }).getAttribute('aria-disabled')).toBe('true')
    expect(
      within(menu)
        .getByRole('menuitem', { name: /Kopyala/ })
        .getAttribute('aria-disabled'),
    ).toBeNull()
  })

  it('⌘⌫ seçili satırları siler', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await flush()
    fireEvent.pointerDown(cell(0, 0), { button: 0 })
    fireEvent.pointerDown(cell(1, 0), { button: 0, shiftKey: true })
    const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true }
    fireEvent.keyDown(cell(1, 0), { key: 'Backspace', ...mod })
    await flush()
    expect(onChange.mock.lastCall).toEqual([[{ code: 'C', lot: 'L3' }], expect.objectContaining({ kind: 'remove' })])
  })
})

describe('satır silince odak', () => {
  const mod = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true })
  it('⌘⌫ sonrası odak yeni aktif hücrede, klavye çalışır', async () => {
    await openGrid([
      { code: 'A', qty: '1', unit: 'pc', gift: false },
      { code: 'B', qty: '2', unit: 'm', gift: false },
      { code: 'C', qty: '3', unit: 'm', gift: false },
    ])
    fireEvent.pointerDown(cell(1, 0), { button: 0 })
    cell(1, 0).focus()
    fireEvent.keyDown(cell(1, 0), { key: 'Backspace', ...mod() })
    await flush()
    expect(cell(1, 0).textContent).toBe('C')
    expect(document.activeElement).toBe(cell(1, 0))
  })
  it('⋯ menüsünden silince odak aktif hücrede', async () => {
    await openGrid([
      { code: 'A', qty: '1', unit: 'pc', gift: false },
      { code: 'B', qty: '2', unit: 'm', gift: false },
    ])
    fireEvent.pointerDown(cell(0, 0), { button: 0 })
    const more = screen.getAllByRole('button', { name: /işlemleri/ })[0]!
    fireEvent.focus(more)
    fireEvent.click(more)
    await flush()
    fireEvent.click(screen.getByRole('menuitem', { name: /Satırı sil/ }))
    await flush()
    await flush()
    expect(cell(0, 0).textContent).toBe('B')
    expect(document.activeElement).toBe(cell(0, 0))
  })
})

describe('hücre aksiyonları (F4a)', () => {
  type P = { code: string | null; price: string | null }
  const anchors: Array<HTMLElement | null> = []
  const cols: Array<ColumnDef<P>> = [
    { id: 'code', header: 'Ürün', type: 'string' },
    {
      id: 'price',
      header: 'Birim fiyat',
      type: 'decimal',
      actions: [
        {
          id: 'fetch',
          label: 'Fiyat getir',
          icon: TrashIcon,
          menu: [
            {
              id: 'last',
              label: 'Son satış fiyatı',
              run: (_row, ctx) => {
                anchors.push(ctx.anchor)
                ctx.setValue?.('92.5')
              },
            },
          ],
        },
      ],
    },
  ]
  function Harness({ onChange }: { onChange: (rows: P[], c: FormGridChange) => void }) {
    const [rows, setRows] = useState<P[]>([{ code: 'A', price: '10' }])
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

  it('iç içe menüdeki öğe ctx.setValue ile hücreye yazar, geri alınır; ctx.anchor hücredir', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await flush()
    fireEvent.pointerDown(cell(0, 1), { button: 0 })
    fireEvent.click(within(cell(0, 1)).getByRole('button', { name: 'Fiyat getir' }))
    await flush()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Son satış fiyatı' }))
    await flush()
    expect(onChange.mock.lastCall).toEqual([[{ code: 'A', price: '92.5' }], expect.objectContaining({ kind: 'edit' })])
    expect(anchors.at(-1)).toBe(cell(0, 1))
    const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true }
    cell(0, 1).focus()
    fireEvent.keyDown(cell(0, 1), { key: 'z', ...mod })
    await flush()
    expect(onChange.mock.lastCall?.[0]).toEqual([{ code: 'A', price: '10' }])
  })

  it('⌥↵ aksiyon menüsünü açar; Esc kapatır, odak hücrede', async () => {
    render(<Harness onChange={vi.fn()} />)
    await flush()
    fireEvent.pointerDown(cell(0, 1), { button: 0 })
    cell(0, 1).focus()
    fireEvent.keyDown(cell(0, 1), { key: 'Enter', altKey: true })
    await flush()
    const menu = screen.getByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: /Fiyat getir/ })).toBeTruthy()
    fireEvent.keyDown(menu, { key: 'Escape' })
    await flush()
    await flush()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(cell(0, 1))
  })
})

describe('pencere düzenleyici (§7)', () => {
  type Lot = { code: string; qty: number }
  type L = { code: string | null; lots: Lot[] | null }
  const opened: Array<{ row: L; value: unknown }> = []
  // Pencerenin Tamam'ı bu değeri yazar.
  const next: { value: unknown } = { value: null }
  function LotWindow({ row, value, onApply }: { row: L; value: unknown; onApply: (v: unknown) => void }) {
    opened.push({ row, value })
    return (
      <div role="dialog" aria-label="Lotlar">
        <button type="button" onClick={() => onApply(next.value)}>
          uygula
        </button>
      </div>
    )
  }
  const cols: Array<ColumnDef<L>> = [
    { id: 'code', header: 'Ürün', type: 'string' },
    {
      id: 'lots',
      header: 'Lot / seri',
      type: 'array',
      cell: ({ value }) => `${(value as Lot[] | null)?.length ?? 0} lot`,
      editor: { window: LotWindow },
    },
  ]
  const mod = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true })
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
  function Harness({ onChange }: { onChange: (rows: L[], c: FormGridChange) => void }) {
    const [rows, setRows] = useState<L[]>([
      { code: 'A', lots: [{ code: 'L1', qty: 2 }] },
      { code: 'B', lots: null },
    ])
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

  it('F2 pencereyi satır ve değerle açar; onApply yazar, pencere kapanır, geri alınır', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await flush()
    fireEvent.pointerDown(cell(0, 1), { button: 0 })
    cell(0, 1).focus()
    fireEvent.keyDown(cell(0, 1), { key: 'F2' })
    await flush()
    expect(screen.getByRole('dialog', { name: 'Lotlar' })).toBeTruthy()
    expect(opened.at(-1)?.value).toEqual([{ code: 'L1', qty: 2 }])
    next.value = [{ code: 'L9', qty: 5 }]
    fireEvent.click(screen.getByRole('button', { name: 'uygula' }))
    await flush()
    expect(screen.queryByRole('dialog', { name: 'Lotlar' })).toBeNull()
    expect(onChange.mock.lastCall?.[0][0]).toEqual({ code: 'A', lots: [{ code: 'L9', qty: 5 }] })
    fireEvent.keyDown(cell(0, 1), { key: 'z', ...mod() })
    await flush()
    expect(onChange.mock.lastCall?.[0][0].lots).toEqual([{ code: 'L1', qty: 2 }])
  })

  it('kalem ve çift tık açar; yazmak düzenlemez, Delete atlar', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await flush()
    fireEvent.pointerDown(cell(0, 1), { button: 0 })
    fireEvent.click(within(cell(0, 1)).getByRole('button', { name: 'Düzenle' }))
    await flush()
    expect(screen.getByRole('dialog', { name: 'Lotlar' })).toBeTruthy()
    next.value = [{ code: 'L1', qty: 2 }]
    fireEvent.click(screen.getByRole('button', { name: 'uygula' }))
    await flush()
    fireEvent.doubleClick(cell(1, 1))
    await flush()
    expect(opened.at(-1)?.row).toEqual({ code: 'B', lots: null })
    next.value = null
    fireEvent.click(screen.getByRole('button', { name: 'uygula' }))
    await flush()
    cell(1, 1).focus()
    fireEvent.keyDown(cell(1, 1), { key: 'x' })
    expect(cell(1, 1).classList.contains('is-editing')).toBe(false)
    fireEvent.pointerDown(cell(0, 1), { button: 0 })
    fireEvent.keyDown(cell(0, 1), { key: 'Delete' })
    await flush()
    expect(onChange.mock.lastCall?.[0][0].lots).toEqual([{ code: 'L1', qty: 2 }])
  })

  it('⌘C / ⌘V değeri bütün nesne olarak taşır; dışarıdan gelen metin yapıştırılmaz', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await flush()
    fireEvent.pointerDown(cell(0, 0), { button: 0 })
    fireEvent.pointerDown(cell(0, 1), { button: 0, shiftKey: true })
    const c = clip()
    fireEvent.copy(cell(0, 1), c)
    fireEvent.pointerDown(cell(1, 0), { button: 0 })
    fireEvent.paste(cell(1, 0), c)
    await flush()
    expect(onChange.mock.lastCall?.[0][1]).toEqual({ code: 'A', lots: [{ code: 'L1', qty: 2 }] })
    const p = clip()
    p.data['text/plain'] = 'C\t3 lot'
    fireEvent.paste(cell(1, 0), p)
    await flush()
    expect(onChange.mock.lastCall?.[0][1]).toEqual({ code: 'C', lots: [{ code: 'L1', qty: 2 }] })
  })
})

describe('satır penceresi (§7)', () => {
  const mod = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true })
  const open = async (row: number) => {
    fireEvent.click(document.querySelectorAll<HTMLElement>('.dt-row-edit')[row]!)
    await flush()
    return screen.getByRole('dialog')
  }

  it('kalem açar: alanlar sütun sırasıyla, kilitli alan pasif; Tamam değişeni yazar, geri alınır', async () => {
    const onChange = vi.fn()
    render(
      <DataTableProvider locale="tr-TR">
        <Harness onChange={onChange} />
      </DataTableProvider>,
    )
    await flush()
    const dialog = await open(1)
    expect(within(dialog).getByRole('heading', { name: 'Satır 2' })).toBeTruthy()
    expect(
      [...dialog.querySelectorAll('.dt-rd-field :is(.dt-rd-label label, .dt-rd-label-text)')].map((l) => l.textContent),
    ).toEqual(['Ürün*', 'Miktar', 'Promosyon'])
    expect(dialog.querySelector('.dt-rd-input.is-disabled')?.contains(within(dialog).getByLabelText('Ürün'))).toBe(true)
    fireEvent.change(within(dialog).getByLabelText('Miktar'), { target: { value: '7' } })
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Promosyon' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tamam' }))
    await flush()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onChange.mock.lastCall).toEqual([
      [initial[0], { code: 'B', qty: '7', gift: true }],
      {
        kind: 'edit',
        cells: [
          { row: 1, column: 'qty' },
          { row: 1, column: 'gift' },
        ],
      },
    ])
    fireEvent.keyDown(document.activeElement!, { key: 'z', ...mod() })
    await flush()
    expect(onChange.mock.lastCall?.[0]).toEqual(initial)
  })

  it('‹ › geçerken yazar; İptal atar', async () => {
    const onChange = vi.fn()
    render(
      <DataTableProvider locale="tr-TR">
        <Harness onChange={onChange} />
      </DataTableProvider>,
    )
    await flush()
    const dialog = await open(0)
    expect(within(dialog).getByRole('button', { name: 'Önceki satır' }).hasAttribute('disabled')).toBe(true)
    fireEvent.change(within(dialog).getByLabelText('Miktar'), { target: { value: '5' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sonraki satır' }))
    await flush()
    expect(onChange.mock.lastCall?.[0][0]).toEqual({ code: 'A', qty: '5', gift: false })
    expect(within(dialog).getByRole('heading', { name: 'Satır 2' })).toBeTruthy()
    expect((within(dialog).getByLabelText('Miktar') as HTMLInputElement).value).toBe('2')
    fireEvent.change(within(dialog).getByLabelText('Miktar'), { target: { value: '9' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Vazgeç' }))
    await flush()
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('⌘↵ boş satırda yeni satır penceresi; "Ekle ve yeni satır" ekler ve boş pencereye geçer', async () => {
    const onChange = vi.fn()
    render(
      <DataTableProvider locale="tr-TR">
        <Harness onChange={onChange} />
      </DataTableProvider>,
    )
    await flush()
    fireEvent.pointerDown(cell(2, 1), { button: 0 })
    cell(2, 1).focus()
    fireEvent.keyDown(cell(2, 1), { key: 'Enter', ...mod() })
    await flush()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Yeni satır' })).toBeTruthy()
    fireEvent.change(within(dialog).getByLabelText('Ürün'), { target: { value: 'C' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ekle ve yeni satır' }))
    await flush()
    expect(onChange.mock.lastCall?.[0][2]).toEqual({ code: 'C' })
    expect((within(dialog).getByLabelText('Ürün') as HTMLInputElement).value).toBe('')
  })

  it('hücredeki hata alanın altında tam metniyle; alan değişince kalkar', async () => {
    render(
      <FormGrid
        label="Satırlar"
        rows={initial}
        columns={columns}
        errors={{ '0.qty': 'Stok yetersiz: rafta 22 m var.' }}
        onRowsChange={() => {}}
      />,
    )
    await flush()
    const dialog = await open(0)
    expect(within(dialog).getByText('Stok yetersiz: rafta 22 m var.')).toBeTruthy()
    const qty = within(dialog).getByLabelText('Miktar')
    expect(qty.getAttribute('aria-invalid')).toBe('true')
    expect(qty.closest('.dt-rd-field')?.getAttribute('data-state')).toBe('error')
    // Dışarı tık kapatmaz (yanlışlıkla tıklayınca taslak gitmesin).
    const scrim = document.querySelector('.dt-scrim')!
    fireEvent.pointerDown(scrim)
    fireEvent.mouseDown(scrim)
    fireEvent.click(scrim)
    await flush()
    expect(screen.getByRole('dialog')).toBe(dialog)
    fireEvent.change(within(dialog).getByLabelText('Miktar'), { target: { value: '3' } })
    expect(within(dialog).queryByText('Stok yetersiz: rafta 22 m var.')).toBeNull()
  })

  it('renderField uygulamanın alanını çizer; null paketin alanını bırakır', async () => {
    const onChange = vi.fn()
    render(
      <DataTableProvider
        locale="tr-TR"
        renderField={(col, f) =>
          col.type === 'decimal' ? (
            <input
              id={f.id}
              aria-label={`app ${f.label}`}
              value={String(f.value ?? '')}
              onChange={(e) => f.onChange(Number(e.target.value))}
            />
          ) : null
        }
      >
        <Harness onChange={onChange} />
      </DataTableProvider>,
    )
    await flush()
    const dialog = await open(0)
    fireEvent.change(within(dialog).getByLabelText('app Miktar'), { target: { value: '8' } })
    expect(within(dialog).getByRole('switch', { name: 'Promosyon' })).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tamam' }))
    await flush()
    expect(onChange.mock.lastCall?.[0][0]).toEqual({ code: 'A', qty: 8, gift: false })
  })
})

describe('telefon (pano 3a, 3b)', () => {
  it('dokunmatikte satıra dokunmak satır penceresini açar, hücre düzenlenmez; "Satır ekle" yeni satır penceresi', async () => {
    const real = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: q === '(pointer: coarse)', media: q })) as typeof window.matchMedia
    try {
      render(
        <DataTableProvider locale="tr-TR">
          <Harness />
        </DataTableProvider>,
      )
      await flush()
      expect(document.querySelector('.dt-form-grid')?.classList.contains('is-touch')).toBe(true)
      fireEvent.pointerDown(cell(1, 1), { button: 0 })
      fireEvent.click(cell(1, 1))
      await flush()
      expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Satır 2' })).toBeTruthy()
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Vazgeç' }))
      await flush()
      fireEvent.doubleClick(cell(1, 1))
      expect(cell(1, 1).classList.contains('is-editing')).toBe(false)
      fireEvent.click(screen.getByRole('button', { name: 'Satır ekle' }))
      await flush()
      expect(within(screen.getByRole('dialog')).getByRole('heading', { name: 'Yeni satır' })).toBeTruthy()
    } finally {
      window.matchMedia = real
    }
  })
})

describe('select yazarak', () => {
  type Rate = { n: number | null }
  const rateCols: Array<ColumnDef<Rate>> = [
    {
      id: 'n',
      header: 'Taksit',
      type: 'select',
      options: [1, 2, 3, 4].map((n) => ({ value: n, label: n === 1 ? 'Tek çekim' : `${n} taksit` })),
    },
  ]
  it('değeriyle eşleşen yazım (4) listeyi süzer, tek Enter seçer', async () => {
    const onChange = vi.fn()
    render(
      <DataTableProvider locale="tr-TR">
        <FormGrid label="Satırlar" rows={[]} columns={rateCols} onRowsChange={onChange} />
      </DataTableProvider>,
    )
    await flush()
    fireEvent.pointerDown(cell(0, 0), { button: 0 })
    fireEvent.keyDown(cell(0, 0), { key: '4' })
    await flush()
    expect([...document.querySelectorAll('.dt-cell-option')].map((o) => o.textContent)).toEqual(['4 taksit↵'])
    fireEvent.keyDown(editor()!, { key: 'Enter' })
    await flush()
    expect(onChange.mock.lastCall?.[0]).toEqual([{ n: 4 }])
    expect(editor()).toBeNull()
  })
  it("yazılan değerle de eşleşir: 1 etiketi 1 içermeyen Tek çekim'i bulur ve önce o vurgulu", async () => {
    const onChange = vi.fn()
    render(
      <DataTableProvider locale="tr-TR">
        <FormGrid label="Satırlar" rows={[]} columns={rateCols} onRowsChange={onChange} />
      </DataTableProvider>,
    )
    await flush()
    fireEvent.pointerDown(cell(0, 0), { button: 0 })
    fireEvent.keyDown(cell(0, 0), { key: '1' })
    await flush()
    expect([...document.querySelectorAll('.dt-cell-option')].map((o) => o.textContent)).toEqual(['Tek çekim↵'])
    fireEvent.keyDown(editor()!, { key: 'Enter' })
    await flush()
    expect(onChange.mock.lastCall?.[0]).toEqual([{ n: 1 }])
  })
  it('yapıştırma etiketi (büyük/küçük harf, İ/ı duyarsız) ve değeri sayı değerine çevirir', async () => {
    const onChange = vi.fn()
    render(
      <DataTableProvider locale="tr-TR">
        <FormGrid label="Satırlar" rows={[]} columns={rateCols} onRowsChange={onChange} />
      </DataTableProvider>,
    )
    await flush()
    fireEvent.pointerDown(cell(0, 0), { button: 0 })
    fireEvent.paste(cell(0, 0), {
      clipboardData: { getData: (t: string) => (t === 'text/plain' ? 'Tek çekim\n4 TAKSİT\n3\n9 taksit' : '') },
    })
    await flush()
    expect(onChange.mock.lastCall?.[0]).toEqual([{ n: 1 }, { n: 4 }, { n: 3 }, { n: '9 taksit' }])
  })
  it('boş seçim hücresine tık listeyi açar; dolu hücrede tık yalnız seçer', async () => {
    render(
      <DataTableProvider locale="tr-TR">
        <FormGrid label="Satırlar" rows={[{ n: 2 }]} columns={rateCols} onRowsChange={() => {}} />
      </DataTableProvider>,
    )
    await flush()
    fireEvent.pointerDown(cell(0, 0), { button: 0 })
    fireEvent.click(cell(0, 0))
    await flush()
    expect(editor()).toBeNull()
    fireEvent.pointerDown(cell(1, 0), { button: 0 })
    fireEvent.click(cell(1, 0))
    await flush()
    expect(editor()).not.toBeNull()
    expect(document.querySelectorAll('.dt-cell-option')).toHaveLength(4)
  })
})

describe("select display 'text'", () => {
  it('listede de rozet yok (R38)', async () => {
    render(
      <DataTableProvider locale="tr-TR">
        <FormGrid
          label="Satırlar"
          rows={[{ n: 1 }]}
          columns={[
            { id: 'n', header: 'Taksit', type: 'select', display: 'text', options: [{ value: 1, label: 'Tek çekim' }] },
          ]}
          onRowsChange={() => {}}
        />
      </DataTableProvider>,
    )
    await flush()
    expect(cell(0, 0).querySelector('.dt-badge')).toBeNull()
    fireEvent.pointerDown(cell(0, 0), { button: 0 })
    fireEvent.keyDown(cell(0, 0), { key: 'F2' })
    await flush()
    const item = document.querySelector('.dt-cell-option')!
    expect(item.querySelector('.dt-badge')).toBeNull()
    expect(item.textContent).toContain('Tek çekim')
  })
})

describe('tarih-saat maskesi', () => {
  function AtHarness({ onChange }: { onChange: (rows: Array<{ at: string | null }>) => void }) {
    const [rows, setRows] = useState<Array<{ at: string | null }>>([
      { at: new Date(2026, 10, 24, 14, 30).toISOString() },
    ])
    return (
      <DataTableProvider locale="tr-TR">
        <FormGrid
          label="Satırlar"
          rows={rows}
          columns={[{ id: 'at', header: 'Zaman', type: 'datetime' }]}
          onRowsChange={(next) => {
            setRows(next)
            onChange(next)
          }}
        />
      </DataTableProvider>
    )
  }
  it('F2 dilin biçiminde açar; yazılan rakama ayraç konur; kalıp ipucu boşken; canlı açıklama anlaşılanı söyler', async () => {
    const onChange = vi.fn()
    render(<AtHarness onChange={onChange} />)
    await flush()
    fireEvent.pointerDown(cell(0, 0), { button: 0 })
    fireEvent.keyDown(cell(0, 0), { key: 'F2' })
    expect(editor()?.value).toBe('24.11.2026 14:30')
    expect(editor()?.placeholder).toBe('gg.aa.yyyy ss:dd')
    fireEvent.change(editor()!, { target: { value: '0112202609' } })
    expect(editor()?.value).toBe('01.12.2026 09')
    expect(document.querySelector('.dt-date-hint')?.textContent).toBe('Biçim: gg.aa.yyyy ss:dd')
    fireEvent.change(editor()!, { target: { value: '01.12.2026 0915' } })
    expect(editor()?.value).toBe('01.12.2026 09:15')
    expect(document.querySelector('.dt-date-hint')?.textContent).toMatch(/1 Aralık 2026 Salı.*09:15/)
    fireEvent.keyDown(editor()!, { key: 'Enter' })
    await flush()
    expect(onChange.mock.lastCall?.[0][0].at).toBe(new Date(2026, 11, 1, 9, 15).toISOString())
  })
  it('ayracın hemen ardında geri silme önündeki rakamı siler', async () => {
    render(<AtHarness onChange={vi.fn()} />)
    await flush()
    fireEvent.pointerDown(cell(0, 0), { button: 0 })
    fireEvent.keyDown(cell(0, 0), { key: 'F2' })
    const input = editor()!
    // "24.|11.2026 14:30": ayraç silinir, maske onu geri koyardı; silinen ayraçtan önceki rakamdır.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '2411.2026 14:30')
    input.setSelectionRange(2, 2)
    fireEvent.input(input, { inputType: 'deleteContentBackward' })
    expect(editor()?.value).toBe('21.12.0261 43:0')
    expect(editor()?.selectionStart).toBe(1)
  })
})
