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
  { id: 'qty', header: 'Miktar', type: 'float', hint: 'Satırın miktarı' },
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
  qty: number | null
  unit: string | null
  gift: boolean | null
  note?: string | null
}
const editColumns: Array<ColumnDef<Item>> = [
  { id: 'code', header: 'Ürün', type: 'string' },
  { id: 'qty', header: 'Miktar', type: 'float' },
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
function EditHarness({ onChange }: { onChange: (rows: Item[], c: FormGridChange) => void }) {
  const [rows, setRows] = useState<Item[]>([{ code: 'A', qty: 1200.5, unit: 'pc', gift: false }])
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
async function openGrid() {
  const onChange = vi.fn()
  render(<EditHarness onChange={onChange} />)
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
    expect(onChange.mock.lastCall?.[0][0].qty).toBe(2.5)
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
