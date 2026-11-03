// Faz 2 · araç çubuğu (05 §3, §5, §9): yuvalar, daralma, Display (yoğunluk, dikey çizgiler, Reset), Columns dialog'u
// (taslak, Save / Cancel, konumsal sabitleme, bul), ⋯ menüsü (Refresh, Print, Auto-refresh).
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, onTestFinished, vi } from 'vitest'
import { DataTableProvider } from '../src/core/provider'
import { DataTable } from '../src/list/data-table'
import { useDataTable } from '../src/list/use-data-table'
import type { ColumnDef, DataTableResult, PreferencesAdapter } from '../src/types'
import { flush, mockCardWidth, mockLayout } from './helpers/dom'

interface Item {
  id: number
  code: string
  name: string
  qty: number
  site: string
}

const columns: Array<ColumnDef<Item>> = [
  { id: 'code', header: 'Code', type: 'id', primary: true },
  { id: 'name', header: 'Name', type: 'string', description: 'Product name' },
  { id: 'qty', header: 'Qty', type: 'int' },
  { id: 'site', header: 'Site', type: 'string', hidden: true },
]
const rows: Item[] = [{ id: 1, code: 'A-1', name: 'Pump', qty: 3, site: 'Gebze' }]

beforeAll(mockLayout)
afterEach(() => {
  cleanup()
  mockCardWidth(1200)
  vi.useRealTimers()
})

function Table(props: Partial<Parameters<typeof DataTable<Item>>[0]> & { server?: boolean }) {
  const { server, ...rest } = props
  const table = useDataTable({ id: 'items', columns, rows: server ? undefined : rows })
  return <DataTable table={table} {...rest} />
}

const mount = async (ui: React.ReactElement) => {
  const view = render(ui)
  await flush()
  return view
}
const heads = () => [...document.querySelectorAll<HTMLElement>('.dt-head-cell[data-col]')].map((c) => c.dataset.col)
const openDisplay = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Display' }))
  await flush()
}
const openColumns = async () => {
  if (!screen.queryByRole('button', { name: /^Columns/ })) await openDisplay()
  fireEvent.click(screen.getByRole('button', { name: /^Columns/ }))
  // Dialog tembel yüklenir.
  await screen.findByRole('dialog')
  await flush()
  return screen.getByRole('dialog')
}
const switchOf = (dialog: HTMLElement, header: string) => within(dialog).getByRole('switch', { name: header })

describe('yuvalar ve daralma', () => {
  it('auto: Display var; ⋯ yalnızca yenileme ya da Print varsa; toolbarEnd sonda; false: araç çubuğu yok', async () => {
    const view = await mount(<Table toolbarEnd={<button type="button">New item</button>} />)
    expect(screen.getByRole('button', { name: 'Display' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
    expect(document.querySelector('.dt-toolbar-end')!.textContent).toBe('New item')
    view.rerender(<Table onPrint={() => {}} />)
    expect(screen.getByRole('button', { name: 'More actions' })).toBeTruthy()
    view.rerender(<Table toolbar={false} />)
    expect(document.querySelector('.dt-toolbar')).toBeNull()
  })
  it('640–1023 px kartta Display yalnızca ikon, ipucu adı taşır', async () => {
    mockCardWidth(800)
    await mount(<Table />)
    const display = screen.getByRole('button', { name: 'Display' })
    expect(document.querySelector('.dt-toolbar')!.classList).toContain('is-narrow')
    expect(display.classList).toContain('dt-btn-icon')
    expect(display.dataset.dtTip).toBe('Display')
  })
  it('640–1023 px kartta Filter etiketli kalır (Vue: yalnızca telefonda ikon); ad görünen metinle aynı', async () => {
    mockCardWidth(800)
    await mount(<Table />)
    const filter = document.querySelector<HTMLElement>('.dt-toolbar .dt-filter-trigger')!
    expect(filter.classList).not.toContain('dt-btn-icon')
    expect(filter.textContent).toBe('Filter')
    expect(screen.getByRole('combobox', { name: 'Filter' })).toBe(filter)
  })
})

describe('Display', () => {
  it('yoğunluk ve dikey çizgiler tercihe yazılır; Reset ikisini ve sütun düzenini geri alır', async () => {
    const set = vi.fn()
    const preferences: PreferencesAdapter = { get: () => ({}), set }
    await mount(
      <DataTableProvider preferences={preferences}>
        <Table />
      </DataTableProvider>,
    )
    await openDisplay()
    fireEvent.click(screen.getByRole('button', { name: 'Compact' }))
    await flush()
    expect(document.querySelector('.dt')!.getAttribute('data-density')).toBe('compact')
    expect(set).toHaveBeenCalledWith('items', { density: 'compact' })
    fireEvent.click(screen.getByRole('switch'))
    await flush()
    expect(document.querySelector('.dt-grid')!.classList).toContain('has-vlines')
    expect(screen.getByText('Saved for you only')).toBeTruthy()
    // Düzeni değiştir, sonra Reset.
    const columnsDialog = await openColumns()
    fireEvent.click(switchOf(columnsDialog, 'Qty'))
    fireEvent.click(within(columnsDialog).getByRole('button', { name: 'Save' }))
    await flush()
    expect(heads()).not.toContain('qty')
    await openDisplay()
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    await flush()
    expect(document.querySelector('.dt')!.getAttribute('data-density')).toBe('standard')
    expect(document.querySelector('.dt-grid')!.classList).not.toContain('has-vlines')
    expect(heads()).toEqual(['code', 'name', 'qty'])
  })
  it('tercih deposu yoksa "Saved for you only" yazmaz', async () => {
    await mount(<Table />)
    await openDisplay()
    expect(screen.queryByText('Saved for you only')).toBeNull()
  })
})

describe('Columns dialog', () => {
  it('taslak: Cancel hiçbir şeyi değiştirmez, Save tek seferde uygular; birincil kilitli', async () => {
    await mount(<Table />)
    let dialog = await openColumns()
    expect(within(dialog).getByText('3 of 4 shown')).toBeTruthy()
    expect(within(dialog).queryByRole('switch', { name: 'Code' })).toBeNull()
    expect(within(dialog).getByLabelText('Always shown')).toBeTruthy()
    fireEvent.click(switchOf(dialog, 'Site'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await flush()
    expect(heads()).toEqual(['code', 'name', 'qty'])
    dialog = await openColumns()
    expect(switchOf(dialog, 'Site').getAttribute('data-state')).toBe('unchecked')
    fireEvent.click(switchOf(dialog, 'Site'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await flush()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(heads()).toEqual(['code', 'name', 'qty', 'site'])
  })
  it('konumsal sabitleme: "Last column" son görünür sütunu sağa sabitler, listede raptiye', async () => {
    await mount(<Table />)
    const dialog = await openColumns()
    fireEvent.click(within(dialog).getAllByRole('radio', { name: 'Last column' })[0]!)
    await flush()
    const qtyRow = dialog.querySelector('.dt-col-row[data-col="qty"]')!
    expect(qtyRow.querySelector('[aria-label="Pinned"]')).not.toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await flush()
    expect(document.querySelector('.dt-head-cell[data-col="qty"]')!.classList).toContain('is-pinned-end')
  })
  it('Show all / Hide all; bul süzer ve sürüklemeyi kapatır', async () => {
    await mount(<Table />)
    const dialog = await openColumns()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Show all' }))
    expect(within(dialog).getByText('4 of 4 shown')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hide all' }))
    // Birincil gizlenemez.
    expect(within(dialog).getByText('1 of 4 shown')).toBeTruthy()
    fireEvent.change(within(dialog).getByRole('searchbox', { name: 'Find a column' }), { target: { value: 'na' } })
    const listed = [...dialog.querySelectorAll<HTMLElement>('.dt-col-row[data-col]')].map((r) => r.dataset.col)
    expect(listed).toEqual(['name'])
    expect(within(dialog).getByRole('button', { name: 'Reorder Name' })).toHaveProperty('disabled', true)
  })
  it('klavyeyle sıralama: Space al, ↓, Space bırak; dialog ok tuşunu yutmaz', async () => {
    await mount(<Table />)
    const dialog = await openColumns()
    // dnd-kit klavye hedefini konumdan seçer: satırları 40 px aralıkla alt alta diz.
    const rect = Element.prototype.getBoundingClientRect
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const row = this.closest('.dt-col-row')
      if (!row) return rect.call(this)
      const top = [...row.parentElement!.children].indexOf(row) * 40
      return { x: 0, y: top, top, left: 0, right: 400, bottom: top + 40, width: 400, height: 40, toJSON: () => ({}) }
    })
    onTestFinished(() => {
      vi.restoreAllMocks()
    })
    const handle = within(dialog).getByRole('button', { name: 'Reorder Name' })
    handle.focus()
    const key = async (code: string, key = code) => {
      fireEvent.keyDown(handle, { code, key })
      await flush()
    }
    await key('Space', ' ')
    await key('ArrowDown')
    await key('Space', ' ')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await flush()
    expect(heads()).toEqual(['code', 'qty', 'name'])
  })
})

describe('⋯ menüsü', () => {
  const ok: DataTableResult<Item> = { status: 'success', data: { rows, hasMore: false }, dataUpdatedAt: 1 }
  const openMore = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    await flush()
  }
  it('Refresh refetch eder; Print sayfasız sorgu ve görünür sütunlarla', async () => {
    const refetch = vi.fn()
    const onPrint = vi.fn()
    await mount(<Table server result={{ ...ok, refetch }} onPrint={onPrint} />)
    await openMore()
    fireEvent.click(screen.getByRole('menuitem', { name: /Refresh/ }))
    expect(refetch).toHaveBeenCalledTimes(1)
    await openMore()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Print' }))
    expect(onPrint.mock.calls[0]![0]).toEqual({
      query: { search: '', filters: [], sort: [], fields: ['id', 'code', 'name', 'qty'] },
      visibleColumns: ['code', 'name', 'qty'],
    })
  })
  it('Auto-refresh: açıkken footer "Live", her aralıkta refetch', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const refetch = vi.fn()
    await mount(<Table server result={{ ...ok, refetch }} autoRefresh={30} />)
    await openMore()
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Auto-refresh/ }))
    await flush()
    expect(document.querySelector('.dt-footer-live')!.textContent).toBe('Live')
    act(() => vi.advanceTimersByTime(30_000))
    expect(refetch).toHaveBeenCalledTimes(1)
  })
})
