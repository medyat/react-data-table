// Faz 4: seçim, bulk bar, satır menüsü, satır tıklaması ve birincil link, expand (05 §6–7, D6, D19, D20, D34, D36).
import { PencilSimpleIcon, PlayIcon } from '@phosphor-icons/react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect, type ComponentProps } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DataTable } from '../src/list/data-table'
import { useDataTable, type DataTableInstance } from '../src/list/use-data-table'
import type { BulkAction, ColumnDef, DataTableResult, RowAction } from '../src/types'
import { flush, mockLayout } from './helpers/dom'

interface Order {
  id: number
  number: string
  status: 'open' | 'done'
}

const orders = (n: number, from = 1): Order[] =>
  Array.from({ length: n }, (_, i) => ({
    id: from + i,
    number: `WO-${from + i}`,
    status: (from + i) % 2 ? 'open' : 'done',
  }))

const columns: Array<ColumnDef<Order>> = [
  { id: 'number', header: 'Order no.', type: 'id', primary: true, href: (r) => `/orders/${r.id}` },
  { id: 'status', header: 'Status', type: 'string' },
]

type Props = Omit<ComponentProps<typeof DataTable<Order>>, 'table'>

let table!: DataTableInstance<Order>
function Harness({ rows, props }: { rows?: Order[]; props: Props }) {
  const t = useDataTable<Order>({ id: 'orders', columns, rows, pageSize: 5 })
  useEffect(() => {
    table = t
  })
  return <DataTable table={t} {...props} />
}

const mount = async (props: Props = {}, rows: Order[] | undefined = orders(12)) => {
  const view = render(<Harness rows={rows} props={props} />)
  await flush()
  return { ...view, rerender: (p: Props, r?: Order[]) => view.rerender(<Harness rows={r} props={p} />) }
}

const box = (i: number) => document.querySelector<HTMLInputElement>(`.dt-row[data-index="${i}"] .dt-select-box`)!
const headBox = () => document.querySelector<HTMLInputElement>('.dt-head-select input')!
const bar = () => document.querySelector<HTMLElement>('.dt-bulk')
const selected = () =>
  [...document.querySelectorAll('.dt-row.is-selected [data-col="number"] .dt-cell-content')].map((e) => e.textContent)
const cell = (i: number) => document.querySelector<HTMLElement>(`.dt-row[data-index="${i}"] [data-col="status"]`)!

beforeAll(mockLayout)
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('seçim', () => {
  it('satır gövdesine tık seçmez; checkbox seçer, bar sayacı ve onSelectionChange', async () => {
    const onSelectionChange = vi.fn()
    const run = vi.fn()
    await mount({ selectable: true, onSelectionChange, bulkActions: [{ id: 'a', label: 'Release', run }] })
    fireEvent.click(cell(0))
    expect(selected()).toEqual([])
    expect(onSelectionChange).not.toHaveBeenCalled()
    fireEvent.click(box(1))
    expect(selected()).toEqual(['WO-2'])
    expect(bar()!.classList).toContain('is-floating')
    expect(bar()!.querySelector('.dt-bulk-count')!.textContent).toBe('1 selected')
    expect(onSelectionChange).toHaveBeenLastCalledWith([expect.objectContaining({ id: 2 })])
    expect(box(1).getAttribute('aria-label')).toBe('Select WO-2')
  })

  it('header checkbox yalnızca bu sayfa; kısmi seçimde indeterminate', async () => {
    await mount({ selectable: true })
    fireEvent.click(box(0))
    expect(headBox().indeterminate).toBe(true)
    expect(headBox().checked).toBe(false)
    fireEvent.click(headBox())
    expect(selected()).toEqual(['WO-1', 'WO-2', 'WO-3', 'WO-4', 'WO-5'])
    expect(headBox().indeterminate).toBe(false)
    expect(headBox().checked).toBe(true)
    fireEvent.click(headBox())
    expect(selected()).toEqual([])
  })

  it('⇧ ile aralık: son tıklanandan bu satıra aynı değer', async () => {
    await mount({ selectable: true })
    fireEvent.click(box(1))
    fireEvent.click(box(3), { shiftKey: true })
    expect(selected()).toEqual(['WO-2', 'WO-3', 'WO-4'])
    // Çapa son tıklanan (WO-4): WO-3–WO-4 aralığı kaldırılır.
    fireEvent.click(box(2), { shiftKey: true })
    expect(selected()).toEqual(['WO-2'])
  })

  it('sayfa, sıralama ve arama değişince temizlenir; geri dönünce eski seçim gelmez', async () => {
    await mount({ selectable: true })
    fireEvent.click(box(0))
    act(() => table.setPage(2))
    expect(selected()).toEqual([])
    act(() => table.setPage(1))
    expect(selected()).toEqual([])
    fireEvent.click(box(0))
    act(() => table.toggleSort('status', false))
    expect(selected()).toEqual([])
    fireEvent.click(box(0))
    act(() => table.setSearch('WO'))
    expect(selected()).toEqual([])
    expect(bar()).toBeNull()
  })

  it('refresh seçimi korur, yeni veride olmayan anahtarı düşürür; geri gelen satır seçili dönmez', async () => {
    const ok = (rows: Order[]): DataTableResult<Order> => ({ status: 'success', data: { rows }, dataUpdatedAt: 1 })
    const view = await mount({ selectable: true, result: ok(orders(3)) }, undefined)
    fireEvent.click(box(0))
    fireEvent.click(box(1))
    view.rerender({ selectable: true, result: ok(orders(3)) })
    expect(selected()).toEqual(['WO-1', 'WO-2'])
    view.rerender({ selectable: true, result: ok(orders(2, 2)) })
    await flush()
    expect(selected()).toEqual(['WO-2'])
    expect(table.selection).toEqual({ 2: true })
    view.rerender({ selectable: true, result: ok(orders(3)) })
    expect(selected()).toEqual(['WO-2'])
  })

  it("Esc seçimi temizler; seçim checkbox'ındayken tek harfli kısayollar çalışır", async () => {
    await mount({ selectable: true })
    fireEvent.click(box(0))
    box(0).focus()
    fireEvent.keyDown(box(0), { key: '/' })
    expect(document.activeElement).toBe(document.querySelector('.dt-toolbar input'))
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(selected()).toEqual([])
  })

  it('table.clearSelection uygulamadan seçimi kaldırır', async () => {
    await mount({ selectable: true })
    fireEvent.click(box(0))
    act(() => table.clearSelection())
    expect(selected()).toEqual([])
  })
})

describe('bulk bar', () => {
  const run = vi.fn()
  const actions: Array<BulkAction<Order>> = [
    { id: 'a', label: 'Release', icon: PlayIcon, inBar: true, description: 'To the line', run },
    { id: 'b', label: 'Reschedule', inBar: true, run },
    { id: 'c', label: 'Assign', inBar: true, run },
    { id: 'd', label: 'Fourth', inBar: true, run },
    { id: 'cancel', label: 'Cancel…', destructive: true, run },
    { id: 'hold', label: 'Hold', disabled: () => 'Already held', run },
    { id: 'archive', label: 'Archive', when: (rows) => rows.every((r) => r.status === 'done'), run },
  ]

  it("en fazla 3 aksiyon bar'da, kalanlar ⋯ menüsünde (yıkıcı en altta), when gizler, gerekçe ikinci satırda", async () => {
    await mount({ selectable: true, bulkActions: actions })
    fireEvent.click(box(0))
    const buttons = [...bar()!.querySelectorAll('.dt-bulk-btn:not(.dt-bulk-more, .dt-bulk-icon)')]
    expect(buttons.map((b) => b.textContent)).toEqual(['Release', 'Reschedule', 'Assign'])
    expect(buttons[0]!.getAttribute('data-dt-tip')).toBe('To the line')
    fireEvent.click(buttons[0]!)
    expect(run).toHaveBeenLastCalledWith([expect.objectContaining({ id: 1 })])
    fireEvent.click(screen.getByRole('button', { name: 'More bulk actions' }))
    await flush()
    const items = [...document.querySelectorAll('.dt-bulk-menu .dt-menu-item')]
    expect(items.map((i) => i.querySelector('.dt-menu-text > span')!.textContent)).toEqual([
      'Fourth',
      'Hold',
      'Cancel…',
    ])
    expect(items[1]!.textContent).toContain('Already held')
    expect(items[1]!.hasAttribute('data-disabled')).toBe(true)
    expect(document.querySelector('.dt-bulk-menu .dt-menu-sep')).not.toBeNull()
  })

  it('× seçimi temizler; selectionActions içeriği aksiyonların yerine', async () => {
    await mount({
      selectable: true,
      bulkActions: actions,
      selectionActions: ({ rows, clear }) => (
        <button type="button" className="custom" onClick={clear}>
          Custom {rows.length}
        </button>
      ),
    })
    fireEvent.click(box(0))
    fireEvent.click(box(1))
    expect(bar()!.querySelector('.custom')!.textContent).toBe('Custom 2')
    expect(bar()!.textContent).not.toContain('Release')
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(bar()).toBeNull()
  })

  it('bulkActions ve selectionActions yoksa çubuk yok; toolbar modunda araç çubuğu yerinde kalır', async () => {
    const { rerender } = await mount({ selectable: true })
    fireEvent.click(box(0))
    expect(selected()).toEqual(['WO-1'])
    expect(bar()).toBeNull()
    rerender({ selectable: true, selectionBar: 'toolbar', bulkActions: [] })
    await flush()
    expect(bar()).toBeNull()
    expect(document.querySelector('.dt-toolbar')).not.toBeNull()
  })

  it('selectionBar="toolbar": seçim varken araç çubuğunun yerine', async () => {
    await mount({ selectable: true, selectionBar: 'toolbar', bulkActions: actions })
    expect(document.querySelector('.dt-toolbar')).not.toBeNull()
    fireEvent.click(box(0))
    expect(document.querySelector('.dt-toolbar')).toBeNull()
    expect(bar()!.classList).toContain('is-toolbar')
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(document.querySelector('.dt-toolbar')).not.toBeNull()
  })
})

describe('satır menüsü ve açma', () => {
  const run = vi.fn()
  const rowActions: Array<RowAction<Order>> = [
    { id: 'cancel', label: 'Cancel order…', destructive: true, run },
    { id: 'edit', label: 'Edit', icon: PencilSimpleIcon, inline: true, when: (r) => r.status === 'done', run },
    { id: 'release', label: 'Release', disabled: (r) => (r.status === 'open' ? 'Already running' : false), run },
    { id: 'archive', label: 'Archive', when: (r) => r.status === 'done', run },
  ]
  const openMenu = async (i: number) => {
    fireEvent.click(document.querySelector(`.dt-row[data-index="${i}"] .dt-row-more`)!)
    await flush()
    return [...document.querySelectorAll<HTMLElement>('.dt-row-menu .dt-menu-item')]
  }

  it('Open / Open in new tab gerçek link, Copy panoya yazar ve "Copied" gösterir; aksiyonlar sırası ve yetki', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.assign(navigator, { clipboard: { writeText } })
    await mount({ rowActions })
    const items = await openMenu(0)
    expect(items.map((i) => i.textContent)).toEqual([
      'Open↵',
      'Open in new tab',
      'Copy Order no.',
      'ReleaseAlready running',
      'Cancel order…',
    ])
    expect(items[0]!.getAttribute('href')).toBe('/orders/1')
    expect(items[1]!.getAttribute('target')).toBe('_blank')
    fireEvent.click(items[2]!)
    expect(writeText).toHaveBeenCalledWith('WO-1')
    expect(document.querySelector('.dt-toast')!.textContent).toBe('Copied')
    fireEvent.click((await openMenu(0))[4]!)
    expect(run).toHaveBeenLastCalledWith(expect.objectContaining({ id: 1 }))
  })

  it("inline aksiyon ⋯'nın solunda ve o satırın menüsünde yok", async () => {
    await mount({ rowActions })
    expect(document.querySelector('.dt-row[data-index="0"] .dt-row-inline')).toBeNull()
    const edit = document.querySelector<HTMLElement>('.dt-row[data-index="1"] .dt-row-inline')!
    expect(edit.getAttribute('aria-label')).toBe('Edit')
    fireEvent.click(edit)
    expect(run).toHaveBeenLastCalledWith(expect.objectContaining({ id: 2 }))
    const items = await openMenu(1)
    expect(items.map((i) => i.textContent)).not.toContain('Edit')
    expect(items.map((i) => i.textContent)).toContain('Archive')
  })

  it('birincil linke düz tık onRowOpen; ⌘ tık tarayıcıya kalır', async () => {
    const onRowOpen = vi.fn()
    await mount({ onRowOpen })
    const link = document.querySelector<HTMLElement>('.dt-row[data-index="0"] .is-primary a.dt-link')!
    fireEvent.click(link, { metaKey: true })
    expect(onRowOpen).not.toHaveBeenCalled()
    fireEvent.click(link)
    expect(onRowOpen).toHaveBeenCalledWith(
      expect.objectContaining({ row: expect.objectContaining({ id: 1 }), href: '/orders/1' }),
    )
  })

  it('rowClick="open" satır gövdesinden birincil linki açar; onRowClick her zaman', async () => {
    const onRowOpen = vi.fn()
    const onRowClick = vi.fn()
    await mount({ rowClick: 'open', onRowOpen, onRowClick })
    fireEvent.click(cell(2))
    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(onRowOpen).toHaveBeenCalledWith(expect.objectContaining({ href: '/orders/3' }))
  })
})

describe('expand', () => {
  const renderExpanded = ({ row, close }: { row: Order; close: () => void }) => (
    <table>
      <tbody>
        <tr>
          <td>Detail {row.number}</td>
          <td>
            <button type="button" className="close" onClick={close}>
              Close
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  )
  const sub = () => [...document.querySelectorAll('.dt-subrow')].map((e) => e.textContent)
  const chevron = (i: number) => document.querySelector<HTMLElement>(`.dt-row[data-index="${i}"] .dt-expand`)

  it("chevron yalnızca canExpand'ta, açınca alt satır; close kapatır", async () => {
    await mount({ renderExpanded, canExpand: (r) => r.status === 'open' })
    expect(chevron(1)).toBeNull()
    expect(document.querySelector('.dt-row[data-index="1"] .dt-expand-space')).not.toBeNull()
    fireEvent.click(chevron(0)!)
    expect(chevron(0)!.getAttribute('aria-expanded')).toBe('true')
    expect(sub()).toEqual(['Detail WO-1Close'])
    expect(chevron(0)!.getAttribute('aria-controls')).toBe(document.querySelector('.dt-subrow')!.id)
    fireEvent.click(document.querySelector('.dt-subrow .close')!)
    expect(sub()).toEqual([])
  })

  it('rowClick="expand" gövdeden açıp kapatır; sayfa değişince açıklar kapanır', async () => {
    await mount({ renderExpanded, rowClick: 'expand' })
    fireEvent.click(cell(0))
    expect(sub()).toEqual(['Detail WO-1Close'])
    fireEvent.click(cell(0))
    expect(sub()).toEqual([])
    fireEvent.click(cell(0))
    act(() => table.setPage(2))
    act(() => table.setPage(1))
    expect(sub()).toEqual([])
  })

  it('açılan detay satır sayısıyla duyurulur', async () => {
    await mount({ renderExpanded })
    fireEvent.click(chevron(0)!)
    await act(() => new Promise((r) => requestAnimationFrame(r)))
    expect(document.querySelector('[aria-live="polite"]')!.textContent).toBe('WO-1 expanded, 1 rows')
  })
})

describe('satır hatası (D35)', () => {
  const rowError = (r: Order) => (r.id === 2 ? ['Open despatch DS-1042', 'Stock reserved'] : r.id === 3 ? '' : null)
  const row = (i: number) => document.querySelector<HTMLElement>(`.dt-row[data-index="${i}"]`)!

  it('hatalı satır: zemin sınıfı, ⋯ hücresinde ikon, satırda tooltip ve aria-describedby; boş metin hata değil', async () => {
    await mount({ rowError, selectable: true })
    expect(row(1).classList).toContain('is-error')
    expect(row(1).getAttribute('data-dt-tip')).toBe('Open despatch DS-1042\nStock reserved')
    const icon = row(1).querySelector<HTMLElement>('.dt-cell-menu .dt-row-error')!
    expect(icon.getAttribute('role')).toBe('img')
    expect(icon.getAttribute('aria-label')).toBe('Open despatch DS-1042\nStock reserved')
    expect(row(1).getAttribute('aria-describedby')).toBe(icon.id)
    // İkon ⋯'nın solunda.
    expect(icon.nextElementSibling?.classList).toContain('dt-row-more')
    for (const i of [0, 2]) {
      expect(row(i).classList).not.toContain('is-error')
      expect(row(i).hasAttribute('aria-describedby')).toBe(false)
      expect(row(i).querySelector('.dt-row-error')).toBeNull()
    }
  })

  it('sayfada hatalı satır varken ⋯ sütunu ikon payı kadar genişler', async () => {
    await mount({ rowError: () => null })
    const cols = () => document.querySelector<HTMLElement>('.dt-grid')!.style.getPropertyValue('--dt-menu-w')
    expect(cols()).not.toContain('--dt-icon')
    cleanup()
    await mount({ rowError })
    expect(cols()).toContain('var(--dt-icon)')
  })

  it('⋯ sütunu yoksa ikon ilk görünür hücrenin başında', async () => {
    const plain: Array<ColumnDef<Order>> = [{ id: 'status', header: 'Status', type: 'string' }]
    function Plain() {
      const t = useDataTable<Order>({ id: 'plain', columns: plain, rows: orders(3) })
      return <DataTable table={t} rowError={rowError} />
    }
    render(<Plain />)
    await flush()
    const first = row(1).querySelector<HTMLElement>('[data-col="status"]')!
    expect(first.classList).toContain('has-expand')
    expect(first.firstElementChild!.classList).toContain('dt-row-error')
    expect(document.querySelector('.dt-cell-menu')).toBeNull()
  })
})
