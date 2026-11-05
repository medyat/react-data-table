// Faz 3b · görünümler (04 §7, R6): açılış seçimi, tek adımda uygulama, edited + kaydetme bölümü, görünüm başına taslak,
// ⌘S, Save as new view dialog'u, Rename / Duplicate / Delete, adapter'sız menü, Display › Reset, controlled görünüm (R5).
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DataTableProvider } from '../src/core/provider'
import { DataTable } from '../src/list/data-table'
import { useDataTable } from '../src/list/use-data-table'
import type { ColumnDef, PreferencesAdapter, TableState, UseDataTableOptions, View, ViewsAdapter } from '../src/types'
import { flush, mockLayout } from './helpers/dom'

interface Order {
  id: number
  number: string
  product: string
  status: string
  value: number
}
const columns: Array<ColumnDef<Order>> = [
  { id: 'number', header: 'Order', type: 'id', primary: true },
  { id: 'product', header: 'Product', type: 'string' },
  {
    id: 'status',
    header: 'Status',
    type: 'select',
    options: [
      { value: 'planned', label: 'Planned' },
      { value: 'done', label: 'Done' },
    ],
  },
  { id: 'value', header: 'Value', type: 'int' },
]
const orders: Order[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  number: `SO-${i + 1}`,
  product: i % 2 ? 'Pump' : 'Valve',
  status: i % 3 ? 'planned' : 'done',
  value: i * 10,
}))
const sys: View[] = [
  { id: 'all', name: 'All orders', kind: 'system', state: {}, default: true },
  {
    id: 'late',
    name: 'Late orders',
    kind: 'system',
    state: {
      filters: [{ column: 'status', op: 'in', value: ['done'] }],
      sort: [{ column: 'value', dir: 'asc' }],
      columns: { visible: ['number', 'status', 'value'] },
    },
  },
]

/** Bellek içi adapter: `views` dizisi test tarafından okunur. */
function memoryAdapter(initial: View[] = []) {
  const views = [...initial]
  const adapter: ViewsAdapter & { views: View[] } = {
    views,
    list: async () => [...views],
    create: async (_t, input) => {
      const v: View = { id: `v${views.length + 1}`, name: input.name, kind: 'personal', state: input.state }
      views.push(v)
      return v
    },
    update: async (_t, id, patch) => {
      const i = views.findIndex((v) => v.id === id)
      views[i] = { ...views[i]!, ...(patch.name && { name: patch.name }), ...(patch.state && { state: patch.state }) }
      return views[i]!
    },
    remove: async (_t, id) => {
      views.splice(
        views.findIndex((v) => v.id === id),
        1,
      )
    },
  }
  return adapter
}

beforeAll(mockLayout)
afterEach(cleanup)

function Table({ options }: { options?: Partial<UseDataTableOptions<Order>> }) {
  const table = useDataTable({ id: 'orders', columns, rows: orders, views: sys, ...options })
  return <DataTable table={table} />
}
const mount = async (o: {
  adapter?: ViewsAdapter
  prefs?: PreferencesAdapter
  options?: Partial<UseDataTableOptions<Order>>
}) => {
  render(
    <DataTableProvider viewsAdapter={o.adapter} preferences={o.prefs}>
      <Table options={o.options} />
    </DataTableProvider>,
  )
  await flush()
  await flush()
}

const trigger = () => document.querySelector<HTMLElement>('.dt-view-trigger')!
const menu = () => document.querySelector<HTMLElement>('.dt-views:not([data-closed])')
const openMenu = async () => {
  if (menu()) return
  fireEvent.click(trigger())
  await flush()
}
const row = (name: string) =>
  [...menu()!.querySelectorAll<HTMLElement>('.dt-view-row')].find((r) => r.textContent?.includes(name))
const pickView = async (name: string) => {
  await openMenu()
  fireEvent.click(row(name)!.querySelector('.dt-view-item')!)
  await flush()
}
const menuButton = (text: string) => within(menu()!).queryByRole('button', { name: text }) ?? undefined
const rowAction = async (name: string, item: string) => {
  await openMenu()
  fireEvent.click(row(name)!.querySelector('.dt-view-more')!)
  await flush()
  fireEvent.click(screen.getByRole('menuitem', { name: item }))
  await flush()
  // Dialog açan eylemler popover kapandıktan sonra (setTimeout 0).
  await act(() => new Promise((r) => setTimeout(r, 0)))
  await flush()
}
const sortBy = async (col: string) => {
  fireEvent.click(document.querySelector(`.dt-head-cell[data-col="${col}"] .dt-head-label`)!)
  await flush()
}
const ariaSort = (col: string) =>
  document.querySelector(`[role="columnheader"][data-col="${col}"]`)!.getAttribute('aria-sort')
const heads = () => [...document.querySelectorAll<HTMLElement>('.dt-head-cell[data-col]')].map((c) => c.dataset.col)
const dialog = () => document.querySelector<HTMLElement>('.dt-view-dialog')
const submitDialog = async (name?: string) => {
  const input = dialog()!.querySelector<HTMLInputElement>('input[type="text"]')!
  if (name !== undefined) fireEvent.change(input, { target: { value: name } })
  fireEvent.submit(dialog()!.querySelector('form')!)
  await flush()
  await flush()
}
const pressSave = async () => {
  fireEvent.keyDown(window, { key: 's', metaKey: true })
  await flush()
  await flush()
}

describe('açılış ve seçim', () => {
  it('açılış: system default; tercih varsa o; seçim filtre + sıralama + sütunları tek adımda uygular', async () => {
    const onStateChange = vi.fn()
    await mount({ options: { onStateChange } })
    expect(trigger().textContent).toBe('All orders')
    expect(document.querySelector('.dt-view-icon')).not.toBeNull()
    onStateChange.mockClear()
    await pickView('Late orders')
    expect(onStateChange).toHaveBeenCalledTimes(1)
    expect(onStateChange.mock.calls[0]![0]).toMatchObject({
      view: 'late',
      filters: [{ column: 'status', op: 'in', value: ['done'] }],
      sort: [{ column: 'value', dir: 'asc' }],
      page: 1,
    })
    expect(heads()).toEqual(['number', 'status', 'value'])
    expect(trigger().textContent).toBe('Late orders')
    expect(document.querySelector('.dt-chip[data-col="status"]')).not.toBeNull()
    expect(document.querySelector('[aria-live="polite"]')!.textContent).toBe('View Late orders')
    cleanup()

    await mount({ prefs: { get: () => ({ defaultViewId: 'late' }), set: () => {} } })
    expect(trigger().textContent).toBe('Late orders')
    expect(document.querySelector('.dt-chip[data-col="status"]')).not.toBeNull()
  })
  it('az görünümde arama yok: odak listede, ↑↓ vurguyu taşır, Enter seçer; aktifte işaret, grup başlığında ipucu yok', async () => {
    await mount({})
    await openMenu()
    expect(within(menu()!).queryByRole('combobox')).toBeNull()
    const grid = within(menu()!).getByRole('grid', { name: 'Views' })
    expect(document.activeElement).toBe(grid)
    expect(within(grid).getByRole('rowgroup', { name: 'Built-in views' })).toBeTruthy()
    const rows = within(grid).getAllByRole('row')
    expect(rows.map((r) => within(r).getAllByRole('gridcell').length)).toEqual([2, 2])
    expect(within(rows[1]!).getAllByRole('gridcell')[1]!.querySelector('.dt-view-more')).not.toBeNull()
    expect(rows[0]!.querySelector('.dt-view-check svg')).not.toBeNull()
    expect(rows[1]!.querySelector('.dt-view-check svg')).toBeNull()

    const cell = (r: HTMLElement) => within(r).getAllByRole('gridcell')[0]!
    expect(grid.getAttribute('aria-activedescendant')).toBe(cell(rows[0]!).id)
    expect(cell(rows[0]!).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(grid, { key: 'ArrowDown' })
    expect(grid.getAttribute('aria-activedescendant')).toBe(cell(rows[1]!).id)
    fireEvent.keyDown(grid, { key: 'Enter' })
    await flush()
    expect(trigger().textContent).toBe('Late orders')
  })
  it('8 ve üzeri görünümde arama: combobox listeyi yönetir ve süzer', async () => {
    const many: View[] = Array.from({ length: 8 }, (_, i) => ({
      id: `s${i}`,
      name: `View ${i}`,
      kind: 'system',
      state: {},
    }))
    await mount({ options: { views: many } })
    await openMenu()
    const grid = within(menu()!).getByRole('grid', { name: 'Views' })
    const search = within(menu()!).getByRole('combobox', { name: 'Find a view…' })
    expect(search.getAttribute('aria-controls')).toBe(grid.id)
    expect(document.activeElement).toBe(search)
    fireEvent.change(search, { target: { value: 'View 7' } })
    expect(within(grid).getAllByRole('row')).toHaveLength(1)
  })

  it('kişisel varsayılan: liste gelince ona geçilir; kullanıcı önce seçtiyse geçilmez', async () => {
    const adapter = memoryAdapter([
      { id: 'p1', name: 'Mine', kind: 'personal', state: { sort: [{ column: 'value', dir: 'desc' }] } },
    ])
    await mount({ adapter, prefs: { get: () => ({ defaultViewId: 'p1' }), set: () => {} } })
    expect(trigger().textContent).toBe('Mine')
    expect(ariaSort('value')).toBe('descending')
  })
})

describe('düzenlenmiş durum ve kaydetme', () => {
  it('düzenlenince Edited + kaydetme bölümü (system: Save as my view…); Discard geri alır; taslak görünüm başına kalır', async () => {
    await mount({ adapter: memoryAdapter() })
    await sortBy('product')
    expect(trigger().textContent).toContain('Edited')
    expect(trigger().getAttribute('aria-label')).toBe('View All orders, edited')
    await openMenu()
    expect(menu()!.textContent).toContain('This view has unsaved changes.')
    expect(menuButton('Save as view…')).toBeTruthy()
    expect(menuButton('Save')).toBeUndefined()
    // Düzenlenmiş görünümde alt satır kaydetme bölümüdür; New view yok.
    expect(menuButton('New view')).toBeUndefined()
    // Aktif görünümün durumu alttaki satırda; listede tekrar "Edited" yazmaz.
    expect(row('All orders')!.textContent).not.toContain('Edited')
    fireEvent.click(menuButton('Revert')!)
    await act(() => new Promise((r) => setTimeout(r, 0)))
    await flush()
    expect(trigger().textContent).not.toContain('Edited')
    expect(ariaSort('product')).toBeNull()
    // Taslak: All orders düzenle → Late'e geç → geri dön.
    await sortBy('product')
    await pickView('Late orders')
    expect(trigger().textContent).toBe('Late orders')
    await openMenu()
    expect(row('All orders')!.textContent).toContain('Edited')
    expect(row('Late orders')!.textContent).not.toContain('Edited')
    await pickView('All orders')
    expect(trigger().textContent).toContain('Edited')
    expect(ariaSort('product')).toBe('ascending')
  })
  it('⌘S: system → dialog (ad doğrulama, varsayılan checkbox); personal → Save changes; New view aynı adı reddeder', async () => {
    const adapter = memoryAdapter()
    const set = vi.fn()
    await mount({ adapter, prefs: { get: () => ({}), set } })
    await sortBy('product')
    await pressSave()
    expect(dialog()).not.toBeNull()
    expect(dialog()!.textContent).toContain('Only you can see it')
    expect(dialog()!.textContent).toContain('Product ↑')
    await submitDialog()
    expect(dialog()!.textContent).toContain('Enter a name.')
    await submitDialog('x'.repeat(61))
    expect(dialog()!.textContent).toContain('60 characters')
    fireEvent.click(dialog()!.querySelector<HTMLInputElement>('.dt-check-row input')!)
    await submitDialog('Mine')
    expect(dialog()).toBeNull()
    expect(adapter.views).toHaveLength(1)
    expect(adapter.views[0]).toMatchObject({ name: 'Mine', kind: 'personal' })
    expect(adapter.views[0]!.state.sort).toEqual([{ column: 'product', dir: 'asc' }])
    expect(set).toHaveBeenCalledWith('orders', { defaultViewId: 'v1' })
    expect(trigger().textContent).toBe('Mine')
    await openMenu()
    expect(row('Mine')!.textContent).toContain('Default')
    expect(menu()!.textContent).toContain('My views')
    // Kaynak görünüm (All orders) düzenlemeyi yeni görünüme devretti: taslağı yok.
    expect(row('All orders')!.textContent).not.toContain('Edited')
    fireEvent.click(trigger())
    await flush()
    // Personal: altta Farklı kaydet… ve Kaydet; ⌘S dialog açmadan kaydeder.
    await sortBy('product')
    await openMenu()
    expect(menuButton('Save as…')).toBeTruthy()
    expect(menuButton('Save')).toBeTruthy()
    fireEvent.click(trigger())
    await flush()
    await pressSave()
    expect(dialog()).toBeNull()
    expect(adapter.views[0]!.state.sort).toEqual([{ column: 'product', dir: 'desc' }])
    expect(trigger().textContent).not.toContain('Edited')
    await openMenu()
    fireEvent.click(menuButton('New view')!)
    await act(() => new Promise((r) => setTimeout(r, 0)))
    await flush()
    await submitDialog('mine')
    expect(dialog()!.textContent).toContain('already have a view')
  })
  it('Rename, Duplicate ("{ad} copy"), Delete onayı → remove; aktif silinince varsayılana dönülür', async () => {
    const adapter = memoryAdapter([
      { id: 'p1', name: 'Mine', kind: 'personal', state: { sort: [{ column: 'value', dir: 'desc' }] } },
    ])
    await mount({ adapter })
    await rowAction('Mine', 'Rename')
    expect(dialog()!.textContent).toContain('Rename')
    expect(dialog()!.querySelector<HTMLInputElement>('input[type="text"]')!.value).toBe('Mine')
    await submitDialog('Renamed')
    expect(adapter.views[0]!.name).toBe('Renamed')
    await rowAction('Renamed', 'Duplicate')
    expect(dialog()!.querySelector<HTMLInputElement>('input[type="text"]')!.value).toBe('Renamed copy')
    expect(dialog()!.textContent).toContain('Value ↓')
    await submitDialog()
    expect(adapter.views.map((v) => v.name)).toEqual(['Renamed', 'Renamed copy'])
    expect(trigger().textContent).toBe('Renamed copy')
    expect(ariaSort('value')).toBe('descending')
    await rowAction('Renamed copy', 'Delete')
    const alert = screen.getByRole('alertdialog')
    expect(alert.textContent).toContain('Delete “Renamed copy”?')
    expect(document.activeElement?.textContent?.trim()).toBe('Cancel')
    fireEvent.click(within(alert).getByRole('button', { name: 'Delete' }))
    await flush()
    await flush()
    expect(adapter.views.map((v) => v.name)).toEqual(['Renamed'])
    expect(trigger().textContent).toBe('All orders')
  })
  it('Set as default görünümü değiştirmez; Default etiketi taşınır', async () => {
    const set = vi.fn()
    await mount({ prefs: { get: () => ({}), set } })
    await rowAction('Late orders', 'Set as default')
    expect(set).toHaveBeenCalledWith('orders', { defaultViewId: 'late' })
    expect(trigger().textContent).toBe('All orders')
    await openMenu()
    expect(row('Late orders')!.textContent).toContain('Default')
  })
  it('varsayılan görünümün satırında Remove default: tercih null olur, etiket kalkar; diğer satırlarda Set as default', async () => {
    const set = vi.fn()
    await mount({ prefs: { get: () => ({ defaultViewId: 'late' }), set } })
    await openMenu()
    fireEvent.click(row('All orders')!.querySelector('.dt-view-more')!)
    await flush()
    expect(screen.queryByRole('menuitem', { name: 'Remove default' })).toBeNull()
    expect(screen.getByRole('menuitem', { name: 'Set as default' })).toBeTruthy()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    await flush()

    await openMenu()
    fireEvent.click(row('Late orders')!.querySelector('.dt-view-more')!)
    await flush()
    expect(screen.getByRole('menuitem', { name: 'Remove default' }).classList).toContain('is-destructive')
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    await flush()
    await rowAction('Late orders', 'Remove default')
    expect(set).toHaveBeenCalledWith('orders', { defaultViewId: null })
    await openMenu()
    expect(row('Late orders')!.textContent).not.toContain('Default')
  })
  it('hiç görünüm yokken adapter varsa tetik "Views" yazar ve New view sunar; adapter de yoksa tetik yok', async () => {
    await mount({ adapter: memoryAdapter(), options: { views: [] } })
    expect(trigger().textContent).toBe('Views')
    await openMenu()
    expect(menuButton('New view')).toBeTruthy()
    cleanup()

    await mount({ options: { views: [] } })
    expect(trigger()).toBeNull()
  })
  it('adapter yoksa yalnızca Discard ve Set as default; New view yok', async () => {
    await mount({})
    await sortBy('product')
    await openMenu()
    expect(menuButton('Revert')).toBeTruthy()
    expect(menuButton('Save as view…')).toBeUndefined()
    expect(menuButton('New view')).toBeUndefined()
  })
})

describe('Display › Reset ve controlled görünüm (R5)', () => {
  it('Reset: sütun düzeni görünümün kayıtlı haline döner; filtre ve sıralama korunur', async () => {
    await mount({ prefs: { get: () => ({ defaultViewId: 'late' }), set: () => {} } })
    expect(heads()).toEqual(['number', 'status', 'value'])
    fireEvent.click(screen.getByRole('button', { name: 'Display' }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: /^Columns/ }))
    const dlg = await screen.findByRole('dialog')
    await flush()
    fireEvent.click(within(dlg).getByRole('switch', { name: 'Status' }))
    fireEvent.click(within(dlg).getByRole('button', { name: 'Save' }))
    await flush()
    expect(heads()).toEqual(['number', 'value'])
    expect(trigger().textContent).toContain('Edited')
    fireEvent.click(screen.getByRole('button', { name: 'Display' }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    await flush()
    expect(heads()).toEqual(['number', 'status', 'value'])
    expect(trigger().textContent).not.toContain('Edited')
    expect(document.querySelectorAll('.dt-chip')).toHaveLength(1)
    expect(ariaSort('value')).toBe('ascending')
  })
  it('controlled: adresten gelen görünüm uygulanmaz, ekrandaki durum ona göre "Edited"; açılış seçimi bir kez bildirilir', async () => {
    const onStateChange = vi.fn()
    await mount({ options: { state: { view: 'late', filters: [] }, onStateChange } })
    expect(trigger().textContent).toContain('Late orders')
    expect(trigger().textContent).toContain('Edited')
    expect(document.querySelector('.dt-chip')).toBeNull()
    expect(onStateChange).not.toHaveBeenCalled()
    cleanup()

    const changes: TableState[] = []
    await mount({ options: { state: { filters: [] }, onStateChange: (s) => changes.push(s) } })
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ view: 'all', filters: [] })
  })
  it('controlled: adresten gelen görünümün sütunları uygulanır (adreste sütun yok); kişisel olan liste gelince', async () => {
    const late = sys[1]!.state
    await mount({ options: { state: { view: 'late', filters: late.filters, sort: late.sort } } })
    expect(heads()).toEqual(['number', 'status', 'value'])
    expect(trigger().textContent).not.toContain('Edited')
    cleanup()

    const mine: View = {
      id: 'p1',
      name: 'Mine',
      kind: 'personal',
      state: { filters: [], sort: [], columns: { visible: ['number', 'value'] } },
    }
    await mount({ adapter: memoryAdapter([mine]), options: { state: { view: 'p1', filters: [], sort: [] } } })
    expect(heads()).toEqual(['number', 'value'])
    expect(trigger().textContent).not.toContain('Edited')
  })
})
