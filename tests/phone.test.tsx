// Faz 7: telefon düzeni (05 §11, 04 §9, handoff 04, T13): kart < 640 px → alt sayfalar, Filters taslağı, ⋯ sayfası, sabitleme.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DataTable } from '../src/list/data-table'
import { useDataTable, type DataTableInstance } from '../src/list/use-data-table'
import type { BulkAction, ColumnDef, TableState } from '../src/types'
import { flush, mockCardWidth, mockLayout } from './helpers/dom'

interface Item {
  id: number
  code: string
  name: string
  qty: number
}

const columns: Array<ColumnDef<Item>> = [
  { id: 'code', header: 'Code', type: 'id', primary: true },
  { id: 'name', header: 'Name', type: 'string' },
  { id: 'qty', header: 'Qty', type: 'int' },
]
const rows: Item[] = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  code: `A-${i + 1}`,
  name: i % 2 ? 'Pump' : 'Valve',
  qty: i,
}))

let table!: DataTableInstance<Item>
function Table(props: Partial<Parameters<typeof DataTable<Item>>[0]> & { onStateChange?: (s: TableState) => void }) {
  const { onStateChange, ...rest } = props
  const t = useDataTable({ id: 'items', columns, rows, pageSize: 10, onStateChange })
  useEffect(() => {
    table = t
  })
  return <DataTable table={t} {...rest} />
}
const mount = async (ui: React.ReactElement) => {
  render(ui)
  await flush()
}
const sheet = () => screen.getByRole('dialog')
const codes = () =>
  [...document.querySelectorAll('.dt-row [data-col="code"] .dt-cell-content')].map((e) => e.textContent)

beforeAll(mockLayout)
beforeEach(() => mockCardWidth(390))
afterEach(() => {
  cleanup()
  mockCardWidth(1200)
})

describe('telefon düzeni', () => {
  it('kökte is-phone; Display yok; yalnızca birincil sütun başa sabit, sona sabit yok', async () => {
    await mount(<Table />)
    expect(document.querySelector('.dt-list')!.classList).toContain('is-phone')
    expect(screen.queryByRole('button', { name: 'Display' })).toBeNull()
    const pinned = [...document.querySelectorAll<HTMLElement>('.dt-head-cell[data-col].is-pinned-start')]
    expect(pinned.map((c) => c.dataset.col)).toEqual(['code'])
    expect(document.querySelector('.dt-head-cell[data-col].is-pinned-end')).toBeNull()
  })

  it('Filters sayfası taslakta biriktirir; Show results filtre + sıralamayı tek güncellemede, sayfa 1 ile uygular', async () => {
    const onStateChange = vi.fn()
    await mount(<Table onStateChange={onStateChange} />)
    table.setPage(2)
    await flush()
    onStateChange.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    // Sayfa tembel yüklenir.
    await screen.findByRole('dialog')
    await flush()
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Add filter' }))
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Name' }))
    await flush()
    const input = within(sheet()).getByRole('textbox')
    expect(document.activeElement).toBe(input)
    fireEvent.change(input, { target: { value: 'Pump' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await flush()
    fireEvent.change(within(sheet()).getByRole('combobox', { name: 'Sort' }), { target: { value: 'qty' } })
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Sort descending' }))
    // Taslak: Show results'tan önce tabloya hiçbir şey gitmez.
    expect(onStateChange).not.toHaveBeenCalled()

    fireEvent.click(within(sheet()).getByRole('button', { name: 'Show results' }))
    await flush()
    expect(onStateChange).toHaveBeenCalledTimes(1)
    expect(onStateChange.mock.calls[0]![0]).toMatchObject({
      filters: [{ column: 'name', op: 'contains', value: 'Pump' }],
      sort: [{ column: 'qty', dir: 'desc' }],
      page: 1,
    })
    expect(codes()[0]).toBe('A-30')
  })

  it('telefon çipi dokununca sayfayı o sütunun editörüyle açar; çubukta Add filter / Clear all yok', async () => {
    await mount(<Table />)
    table.setFilters([{ column: 'name', op: 'contains', value: 'Pump' }])
    await flush()
    expect(screen.queryByRole('button', { name: 'Add filter' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull()
    // Operatör görünür: "is" ile "is not" telefonda da ayırt edilir; ad görünen metinle başlar (WCAG 2.5.3).
    const body = document.querySelector<HTMLElement>('.dt-chip-body')!
    expect(body.textContent).toBe('Name contains “Pump”')
    expect(body.getAttribute('aria-label')).toBe('Name contains “Pump”. Open filters')
    fireEvent.click(document.querySelector('.dt-chip-body')!)
    await screen.findByRole('dialog')
    await flush()
    expect(within(sheet()).getByRole('heading', { name: 'Name' })).toBeTruthy()
    expect(within(sheet()).getByRole('textbox')).toHaveProperty('value', 'Pump')
  })

  it('header hunisi telefonda popover yerine sayfayı o sütunla açar', async () => {
    await mount(<Table />)
    table.setFilters([{ column: 'qty', op: 'gt', value: 3 }])
    await flush()
    fireEvent.click(document.querySelector('.dt-head-cell[data-col="qty"] .dt-head-filtered')!)
    await screen.findByRole('dialog')
    await flush()
    expect(sheet().classList).toContain('dt-filters-sheet')
    expect(within(sheet()).getByRole('heading', { name: 'Qty' })).toBeTruthy()
  })

  it('Filters editöründe Clear sonrası odak değer alanına geçer', async () => {
    await mount(<Table />)
    table.setFilters([{ column: 'name', op: 'contains', value: 'Pump' }])
    await flush()
    fireEvent.click(document.querySelector('.dt-chip-body')!)
    await screen.findByRole('dialog')
    await flush()
    const clear = within(sheet()).getByRole('button', { name: 'Clear' })
    clear.focus()
    fireEvent.click(clear)
    await flush()
    expect(document.activeElement).toBe(within(sheet()).getByRole('textbox'))
  })

  it('Geri: değeri seçilmemiş çip taslaktan düşer', async () => {
    await mount(<Table />)
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    // Sayfa tembel yüklenir.
    await screen.findByRole('dialog')
    await flush()
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Add filter' }))
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Qty' }))
    await flush()
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Back to filters' }))
    expect(within(sheet()).queryByRole('button', { name: /^Qty/ })).toBeNull()
  })
})

describe('⋯ sayfası', () => {
  it('Density › seçince ana seviyeye döner; Sort › yön değiştirir ve kaldırır', async () => {
    await mount(<Table />)
    table.setQuery({
      sort: [
        { column: 'qty', dir: 'asc' },
        { column: 'name', dir: 'asc' },
      ],
    })
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    await flush()
    fireEvent.click(within(sheet()).getByRole('button', { name: /^Density/ }))
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Compact' }))
    await flush()
    expect(document.querySelector('.dt')!.getAttribute('data-density')).toBe('compact')
    expect(within(sheet()).getByRole('button', { name: /^Sort/ }).textContent).toContain('Qty ↑ +1')

    fireEvent.click(within(sheet()).getByRole('button', { name: /^Sort/ }))
    fireEvent.click(within(sheet()).getAllByRole('button', { name: /ascending/ })[0]!)
    await flush()
    expect(table.request.sort).toEqual([
      { column: 'qty', dir: 'desc' },
      { column: 'name', dir: 'asc' },
    ])
    fireEvent.click(within(sheet()).getAllByRole('button', { name: /descending/ })[0]!)
    await flush()
    expect(table.request.sort[0]).toEqual({ column: 'qty', dir: 'asc' })
    fireEvent.click(within(sheet()).getAllByRole('button', { name: 'Clear sort' })[1]!)
    await flush()
    expect(table.request.sort).toEqual([{ column: 'qty', dir: 'asc' }])
  })

  it('Columns dialog telefonda sabitleme bölümü göstermez', async () => {
    await mount(<Table />)
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    await flush()
    fireEvent.click(within(sheet()).getByRole('button', { name: /^Columns/ }))
    const dialog = await screen.findByRole('dialog')
    await flush()
    expect(dialog.classList).toContain('is-phone')
    expect(within(dialog).queryByRole('radiogroup')).toBeNull()
  })
})

describe('bulk bar', () => {
  it('telefonda çubukta en fazla 2 aksiyon; kalanlar More sayfasında, yıkıcı en altta', async () => {
    const run = vi.fn()
    const actions: Array<BulkAction<Item>> = [
      { id: 'a', label: 'Release', inBar: true, run },
      { id: 'b', label: 'Hold', inBar: true, run },
      { id: 'c', label: 'Close', inBar: true, run },
      { id: 'd', label: 'Delete', destructive: true, run },
    ]
    await mount(<Table selectable bulkActions={actions} />)
    fireEvent.click(document.querySelector('.dt-row[data-index="0"] .dt-select-box')!)
    await flush()
    const bar = document.querySelector<HTMLElement>('.dt-bulk')!
    expect(bar.classList).toContain('is-phone')
    expect(
      [...bar.querySelectorAll('.dt-bulk-btn:not(.dt-bulk-more):not(.dt-bulk-icon)')].map((b) => b.textContent),
    ).toEqual(['Release', 'Hold'])
    fireEvent.click(within(bar).getByRole('button', { name: 'More bulk actions' }))
    await flush()
    expect(
      within(sheet())
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Close', 'Delete'])
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Close' }))
    await flush()
    expect(run).toHaveBeenCalledWith([expect.objectContaining({ id: 1 })])
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
