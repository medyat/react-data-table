// Faz 1: roller, birincil link, sabit sütun ofseti, ikinci satır, iskelet, aksiyon overlay'i, açıklama, guard.
import { CopyIcon } from '@phosphor-icons/react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DataTable } from '../src/list/data-table'
import { useDataTable } from '../src/list/use-data-table'
import type { ColumnDef, DataTableResult, Density } from '../src/types'
import { flush, mockLayout } from './helpers/dom'

interface Order {
  id: number
  number: string
  product: { name: string; sku: string }
  status: string
  value: number
  dueAt: string
}

const rows: Order[] = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  number: `WO-26-${400 + i}`,
  product: { name: `Pump ${i}`, sku: `GP-${i}` },
  status: i % 2 ? 'done' : 'in_progress',
  value: 1000 * (i + 1),
  dueAt: '2026-10-18',
}))

const run = vi.fn()
const columns: Array<ColumnDef<Order>> = [
  { id: 'number', header: 'Order no.', type: 'id', primary: true, href: (r) => `/orders/${r.id}` },
  {
    id: 'product.name',
    header: 'Product',
    type: 'string',
    secondary: (r) => r.product.sku,
    actions: [
      { id: 'copy', label: 'Copy name', icon: CopyIcon, run },
      { id: 'open', label: 'Open product', icon: CopyIcon },
      { id: 'stock', label: 'Stock by warehouse', icon: CopyIcon },
    ],
  },
  { id: 'status', header: 'Status', type: 'select', options: [{ value: 'done', label: 'Done', tone: 'green' }] },
  { id: 'value', header: 'Value', type: 'currency', currency: 'TRY', description: 'Net of discounts' },
  { id: 'dueAt', header: 'Due date', type: 'date', overdue: true },
  {
    id: 'decide',
    header: 'Decision',
    type: 'object',
    cell: () => (
      <button type="button" className="approve">
        Approve
      </button>
    ),
  },
]

beforeAll(mockLayout)
afterEach(cleanup)

function Table(props: { density?: Density; result?: DataTableResult<Order>; onRowClick?: (row: Order) => void }) {
  const table = useDataTable({ id: 'orders', columns, rows: props.result ? undefined : rows, density: props.density })
  return <DataTable table={table} result={props.result} label="Orders" onRowClick={props.onRowClick} />
}

const mount = async (props: Parameters<typeof Table>[0] = {}) => {
  const view = render(<Table {...props} />)
  await flush()
  const q = <T extends HTMLElement = HTMLElement>(sel: string) => view.container.querySelector<T>(sel)!
  return { ...view, q, qa: (sel: string) => [...view.container.querySelectorAll<HTMLElement>(sel)] }
}

describe('roller ve yapı', () => {
  it('table, header, satır ve hücre rolleri; aria-rowindex header 1, ilk satır 2', async () => {
    const { q, qa } = await mount()
    expect(q('[role="table"]').getAttribute('aria-label')).toBe('Orders')
    expect(q('.dt-head').getAttribute('role')).toBe('row')
    // Birincil sütun varsa ⋯ sütunu da çizilir (Open / Copy).
    expect(qa('.dt-head [role="columnheader"]')).toHaveLength(columns.length + 1)
    const row = q('.dt-row[data-index="0"]')
    expect(row.getAttribute('role')).toBe('row')
    expect(row.getAttribute('aria-rowindex')).toBe('2')
    expect(row.querySelectorAll('[role="cell"]')).toHaveLength(columns.length + 1)
  })
  it('birincil hücre gerçek link, sayısal sağa, sabit sütun sticky ofset değişkeni kökte', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-10-21T10:00:00') })
    const { q } = await mount()
    const row = q('.dt-row[data-index="0"]')
    const primary = row.querySelector<HTMLElement>('[data-col="number"]')!
    expect(primary.classList).toContain('is-pinned-start')
    expect(primary.style.left).toBe('var(--dt-off-number)')
    expect(q('.dt-grid').style.getPropertyValue('--dt-off-number')).toBe('0px')
    expect(q('.dt-grid').style.getPropertyValue('--cols')).toContain('auto')
    expect(primary.querySelector('a.dt-link')!.getAttribute('href')).toBe('/orders/1')
    const value = row.querySelector<HTMLElement>('[data-col="value"]')!
    expect([...value.classList]).toEqual(expect.arrayContaining(['is-right', 'is-numeric']))
    expect(value.textContent).toBe('1,000.00TRY')
    expect(row.querySelector('[data-col="dueAt"]')!.textContent).toBe('Oct 18 · 3d late')
    vi.useRealTimers()
  })
  it('ikinci satır yalnızca Comfortable', async () => {
    const std = await mount()
    expect(std.q('.dt-secondary')).toBeNull()
    cleanup()
    const cmf = await mount({ density: 'comfortable' })
    expect(cmf.q('.dt').dataset.density).toBe('comfortable') // kök --dt-fs bundan çözülür
    expect(cmf.q('.dt-row[data-index="0"] .dt-secondary').textContent).toBe('GP-0')
  })
  it('sonuç bekleniyor → 12 iskelet satır, tipe göre biçim, aria-busy', async () => {
    const { q, qa } = await mount({ result: { status: 'pending' } })
    expect(q('[role="table"]').getAttribute('aria-busy')).toBe('true')
    expect(qa('.dt-row-skeleton')).toHaveLength(12)
    const first = q('.dt-row-skeleton')
    expect(first.querySelector('.dt-sk-num')).not.toBeNull() // currency
    expect(first.querySelector('.dt-sk-pill')).not.toBeNull() // select
  })
  it('aksiyon overlay: 3 aksiyon → ilk + ⋯; içerik değişmez', async () => {
    const { q } = await mount()
    const cell = q('.dt-row[data-index="0"] [data-col="product.name"]')
    const buttons = cell.querySelectorAll('.dt-cell-action')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]!.getAttribute('aria-label')).toBe('Copy name')
    expect(buttons[1]!.getAttribute('aria-label')).toBe('More')
    expect(cell.querySelector('.dt-cell-content')!.textContent).toBe('Pump 0')
  })
  it('description (D33): header tooltip ad + açıklama, aria-describedby gizli açıklamaya; odakta iki satırlı tooltip', async () => {
    const { q } = await mount()
    const label = q('.dt-head-cell[data-col="value"] .dt-head-label')
    expect(label.dataset.dtTip).toBe('Value\nNet of discounts')
    expect(document.getElementById(label.getAttribute('aria-describedby')!)?.textContent).toBe('Net of discounts')
    expect(label.textContent).not.toContain('Net of discounts')
    fireEvent.focusIn(label)
    const tip = q('.dt-tip')
    expect(tip.textContent).toContain('Net of discounts')
    expect(tip.classList).toContain('is-multi')
    expect(q('.dt-head-cell[data-col="status"] .dt-head-label').dataset.dtTip).toBe('Status')
  })
})

describe('guard ve klavye', () => {
  it('hücredeki düğmeye tık satır tıklamasını tetiklemez; düz hücreye tık tetikler', async () => {
    const onRowClick = vi.fn()
    const { q } = await mount({ onRowClick })
    const cell = q('.dt-row[data-index="0"] [data-col="product.name"]')
    const action = cell.querySelector('.dt-cell-action')!
    fireEvent.mouseDown(action)
    fireEvent.click(action)
    expect(run).toHaveBeenCalledWith(rows[0])
    expect(onRowClick).not.toHaveBeenCalled()
    fireEvent.mouseDown(cell, { clientX: 10, clientY: 10 })
    fireEvent.click(cell, { clientX: 10, clientY: 10 })
    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(onRowClick.mock.calls[0]![0]).toBe(rows[0])
    // Sürükleme (4 px'ten fazla) satır tıklaması değildir.
    fireEvent.mouseDown(cell, { clientX: 10, clientY: 10 })
    fireEvent.click(cell, { clientX: 30, clientY: 10 })
    expect(onRowClick).toHaveBeenCalledTimes(1)
  })
  it("satır klavyesi yok (D38): satır Tab durağı değil, widget'lar doğal Tab sırasında", async () => {
    const { q } = await mount()
    const row = q('.dt-row[data-index="0"]')
    expect(row.getAttribute('tabindex')).toBeNull()
    for (const el of row.querySelectorAll('a[href], button')) expect(el.getAttribute('tabindex')).not.toBe('-1')
    expect(row.querySelector('button.approve')).not.toBeNull()
  })
  it('header ⇧→ genişliği 16 px artırır, ⌥⇧→ sütunu taşır ve odak taşınan başlıkta kalır', async () => {
    const { q, qa } = await mount()
    const label = q<HTMLButtonElement>('.dt-head-cell[data-col="status"] .dt-head-label')
    fireEvent.keyDown(label, { key: 'ArrowRight', shiftKey: true })
    expect(q('.dt-grid').style.getPropertyValue('--cols')).toContain('156px') // select 140 + 16
    label.focus()
    fireEvent.keyDown(label, { key: 'ArrowRight', shiftKey: true, altKey: true })
    await flush()
    expect(qa('.dt-head-cell[data-col]').map((c) => c.dataset.col)).toEqual([
      'number',
      'product.name',
      'value',
      'status',
      'dueAt',
      'decide',
    ])
    expect((document.activeElement as HTMLElement).closest<HTMLElement>('.dt-head-cell')?.dataset.col).toBe('status')
  })
})
