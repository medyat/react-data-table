// Faz 3a · filtreler ve arama (04 §1–5): picker, eksik çip, D2, anında uygulanan seçenekler, operatör değişimi, boolean,
// ×, Clear all, No results, header'dan filtre, arama (250 ms, Esc), sayfa 1, kısayollar, controlled filtreler.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DataTableProvider } from '../src/core/provider'
import { DataTable } from '../src/list/data-table'
import { useDataTable } from '../src/list/use-data-table'
import type { ColumnDef, TableQuery, TableState, UseDataTableOptions } from '../src/types'
import { flush, mockLayout } from './helpers/dom'

interface Order {
  id: number
  number: string
  product: string
  status: string
  urgent: boolean
  qty: number
}

const columns: Array<ColumnDef<Order>> = [
  { id: 'number', header: 'Order', type: 'id', primary: true },
  { id: 'product', header: 'Product', type: 'string', suggested: true },
  {
    id: 'status',
    header: 'Status',
    type: 'select',
    options: [
      { value: 'planned', label: 'Planned' },
      { value: 'done', label: 'Done' },
      { value: 'hold', label: 'On hold' },
    ],
    filterNoun: { one: 'status', other: 'statuses' },
  },
  { id: 'urgent', header: 'Urgent', type: 'boolean' },
  { id: 'qty', header: 'Qty', type: 'int' },
]
const STATUSES = ['planned', 'done', 'hold']
const orders: Order[] = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  number: `SO-${String(i + 1).padStart(3, '0')}`,
  product: i % 2 ? 'Pump' : 'Valve',
  status: STATUSES[i % 3]!,
  urgent: i % 5 === 0,
  qty: i,
}))

beforeAll(mockLayout)
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function Table(props: { options?: Partial<UseDataTableOptions<Order>>; server?: boolean }) {
  const table = useDataTable({
    id: 'orders',
    entityName: { one: 'order', other: 'orders' },
    columns,
    rows: props.server ? undefined : orders,
    pageSize: 10,
    ...props.options,
  })
  return (
    <>
      <output data-testid="request">{JSON.stringify(table.request)}</output>
      <DataTable
        table={table}
        result={props.server ? { status: 'success', data: { rows: orders.slice(0, 5) }, dataUpdatedAt: 1 } : undefined}
      />
    </>
  )
}
const mount = async (ui: React.ReactElement) => {
  render(ui)
  await flush()
}

/** Uygulamanın sorgu anahtarına koyacağı istek (R4). */
const req = () => JSON.parse(screen.getByTestId('request').textContent!) as TableQuery
const chip = (col: string) => document.querySelector<HTMLElement>(`.dt-chip[data-col="${col}"]`)
const chips = () => [...document.querySelectorAll<HTMLElement>('.dt-chip')].map((c) => c.dataset.col)
/** Çip parçaları boşlukla: "Status is any of Planned, On hold". */
const chipText = (col: string) =>
  [...chip(col)!.querySelectorAll('.dt-chip-body > span')].map((e) => e.textContent?.trim()).join(' ')
const pop = () => document.querySelector<HTMLElement>('.dt-chip-pop')
/** "Rows 1–10 of 30": footer sol bölümü, parçalar boşlukla. */
const footer = () =>
  [...document.querySelector('.dt-footer-left')!.querySelectorAll('.dt-footer-rows, .dt-footer-of')]
    .map((e) => e.textContent)
    .join(' ')
const polite = () => document.querySelector('[aria-live="polite"]')!.textContent

const openPicker = async () => {
  fireEvent.click(document.querySelector('.dt-toolbar .dt-filter-trigger')!)
  await flush()
}
const pickColumn = async (header: string) => {
  await openPicker()
  fireEvent.click(screen.getByRole('option', { name: new RegExp(`^${header}`) }))
  await flush()
}
const check = async (label: string) => {
  fireEvent.click(within(pop()!).getByRole('checkbox', { name: new RegExp(label) }))
  await flush()
}
const setOp = async (label: string) => {
  fireEvent.click(pop()!.querySelector('.dt-op-btn')!)
  await flush()
  fireEvent.click(screen.getByRole('menuitem', { name: label }))
  await flush()
}
const closePop = async () => {
  fireEvent.keyDown(pop()!, { key: 'Escape' })
  await flush()
}

describe('picker ve eksik çip', () => {
  it('picker: Filtered · Suggested · All columns; seçim eksik çip + editör açar, sorguya girmez', async () => {
    await mount(<Table server />)
    await openPicker()
    expect(screen.getByText('Suggested')).toBeTruthy()
    expect(screen.getByText('All columns')).toBeTruthy()
    expect(screen.queryByText('Filtered')).toBeNull()
    fireEvent.click(screen.getByRole('option', { name: /^Status/ }))
    await flush()
    expect(chip('status')!.classList).toContain('is-incomplete')
    expect(chipText('status')).toBe('Status is Select…')
    // WCAG 2.5.3: erişilebilir ad görünen metinle başlar (sesli komut "Status is Select…" ile bulur).
    expect(chip('status')!.querySelector('.dt-chip-body')!.getAttribute('aria-label')).toBe(
      'Status is Select…. Choose a value',
    )
    expect(pop()).not.toBeNull()
    expect(req().filters).toEqual([])
    expect(document.querySelector('.dt-filter-trigger .dt-counter')).toBeNull()
  })
  it('D2: aynı sütun ikinci kez seçilince yeni çip açılmaz; değer seçilmeden kapanınca çip kalkar', async () => {
    await mount(<Table server />)
    await pickColumn('Status')
    await check('Done')
    await closePop()
    await openPicker()
    expect(screen.getByText('Filtered')).toBeTruthy()
    fireEvent.click(screen.getByRole('option', { name: /^Status/ }))
    await flush()
    expect(chips()).toEqual(['status'])
    expect(pop()).not.toBeNull()
    await closePop()
    await pickColumn('Product')
    expect(chips()).toEqual(['status', 'product'])
    await closePop()
    expect(chips()).toEqual(['status'])
  })
})

describe('değer ve operatör', () => {
  it('seçenekler anında uygulanır: sorgu, sayaç, tekil/çoğul etiket, özet, header işareti, duyuru; sayfa 1', async () => {
    await mount(<Table server options={{ initialState: { page: 3 } }} />)
    await pickColumn('Status')
    await check('Done')
    expect(req().filters).toEqual([{ column: 'status', op: 'in', value: ['done'] }])
    expect(req().page.number).toBe(1)
    expect(document.querySelector('.dt-filter-trigger .dt-counter')!.textContent).toBe('1')
    expect(chipText('status')).toBe('Status is Done')
    expect(document.querySelector('.dt-head-cell[data-col="status"] .dt-head-filtered')).not.toBeNull()
    expect(polite()).toBe('Filter added: Status Done')
    await check('Planned')
    expect(chipText('status')).toBe('Status is any of Done, Planned')
    await check('On hold')
    expect(chipText('status')).toBe('Status is any of 3 statuses')
  })
  it('operatör: in → not_in değeri korur; şekil değişince silinir ve çip eksik kalır; is_empty anında, değersiz', async () => {
    await mount(<Table server />)
    await pickColumn('Status')
    await check('Done')
    await setOp('is not')
    expect(chipText('status')).toBe('Status is not Done')
    expect(req().filters).toEqual([{ column: 'status', op: 'not_in', value: ['done'] }])
    await setOp('is empty')
    expect(req().filters).toEqual([{ column: 'status', op: 'is_empty' }])
    expect(chip('status')!.querySelector('.dt-chip-value')).toBeNull()
    // Qty: between → is greater than (şekil değişir) değeri siler.
    await closePop()
    await pickColumn('Qty')
    const [min] = within(pop()!).getAllByRole('textbox')
    vi.useFakeTimers({ shouldAdvanceTime: true })
    fireEvent.change(min!, { target: { value: '5' } })
    act(() => vi.advanceTimersByTime(250))
    expect(req().filters.at(-1)).toEqual({ column: 'qty', op: 'between', value: [5, null] })
    await setOp('is greater than')
    expect(chip('qty')!.classList).toContain('is-incomplete')
    expect(req().filters.map((f) => f.column)).toEqual(['status'])
  })
  it('Clear değeri siler, çip yerinde ve açık kalır; metin 250 ms sonra ve Enter ile uygulanır, Enter kapatır', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await mount(<Table server />)
    await pickColumn('Status')
    await check('Done')
    await closePop()
    await pickColumn('Product')
    const input = within(pop()!).getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Pu' } })
    act(() => vi.advanceTimersByTime(200))
    expect(req().filters).toHaveLength(1)
    act(() => vi.advanceTimersByTime(50))
    expect(req().filters.at(-1)).toEqual({ column: 'product', op: 'contains', value: 'Pu' })
    fireEvent.change(input, { target: { value: 'Pump' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await flush()
    expect(req().filters.at(-1)).toEqual({ column: 'product', op: 'contains', value: 'Pump' })
    expect(pop()).toBeNull()
    // Status çipinde Clear: sorgudan çıkar, ilk sırada kalır.
    fireEvent.click(chip('status')!.querySelector('.dt-chip-body')!)
    await flush()
    fireEvent.click(within(pop()!).getByRole('button', { name: 'Clear' }))
    await flush()
    expect(chips()).toEqual(['status', 'product'])
    expect(chip('status')!.classList).toContain('is-incomplete')
    expect(req().filters.map((f) => f.column)).toEqual(['product'])
    // Yeniden değer seçilince sorguda da ilk sıraya döner.
    await check('Planned')
    expect(req().filters.map((f) => f.column)).toEqual(['status', 'product'])
  })
  it('metin taslağı: duraklayınca sondaki boşluk silinmez', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await mount(<Table server />)
    await pickColumn('Product')
    const input = within(pop()!).getByRole<HTMLInputElement>('textbox')
    fireEvent.change(input, { target: { value: 'Big ' } })
    act(() => vi.advanceTimersByTime(250))
    expect(req().filters.at(-1)).toMatchObject({ value: 'Big' })
    expect(input.value).toBe('Big ')
  })
  it('boolean: popover yok, doğrudan "is Yes"; tık Yes ↔ No; × kaldırır ve duyurur; Clear all', async () => {
    await mount(<Table server />)
    await pickColumn('Urgent')
    expect(pop()).toBeNull()
    expect(chipText('urgent')).toBe('Urgent is Yes')
    expect(req().filters).toEqual([{ column: 'urgent', op: 'eq', value: true }])
    fireEvent.click(chip('urgent')!.querySelector('.dt-chip-body')!)
    await flush()
    expect(req().filters).toEqual([{ column: 'urgent', op: 'eq', value: false }])
    fireEvent.click(screen.getByRole('button', { name: 'Remove Urgent filter' }))
    await flush()
    expect(chips()).toEqual([])
    expect(polite()).toBe('Urgent filter removed')
    await pickColumn('Urgent')
    await pickColumn('Status')
    await check('Done')
    await closePop()
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    await flush()
    expect(chips()).toEqual([])
    expect(req().filters).toEqual([])
  })
  it("× sonrası odak sonraki çipe, son çipte Add filter'a", async () => {
    await mount(<Table server />)
    await pickColumn('Urgent')
    await pickColumn('Status')
    await check('Done')
    await closePop()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Urgent filter' }))
    await flush()
    expect(document.activeElement).toBe(chip('status')!.querySelector('.dt-chip-body'))
    await pickColumn('Qty')
    await closePop()
    await pickColumn('Urgent')
    fireEvent.click(screen.getByRole('button', { name: 'Remove Urgent filter' }))
    await flush()
    expect(document.activeElement!.classList).toContain('dt-filter-add')
  })
})

describe('tarih editörü', () => {
  const withDue = { columns: [...columns, { id: 'due', header: 'Due', type: 'date' } as ColumnDef<Order>] }
  const openDue = async () => {
    await pickColumn('Due')
    await screen.findByRole('grid')
  }
  const day = (iso: string) => pop()!.querySelector<HTMLElement>(`.dt-cal-day[data-value="${iso}"]`)!
  const due = () => req().filters.find((f) => f.column === 'due')

  it('within: hazır aralık o günün tarihlerini uygular ve kapanır; özel aralık iki uçla, ters sırada da sıralı uygulanır', async () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 3, 10), shouldAdvanceTime: true })
    await mount(<Table server options={withDue} />)
    await openDue()
    expect(pop()!.querySelector('.dt-cal-title')!.textContent).toBe('November 2026')
    expect(day('2026-11-03').dataset.today).toBe('')
    fireEvent.click(within(pop()!).getByRole('button', { name: 'This week' }))
    await flush()
    expect(due()).toEqual({ column: 'due', op: 'within', value: { from: '2026-11-01', to: '2026-11-07' } })
    expect(chipText('due')).toBe('Due is within Nov 1 – 7')
    expect(pop()).toBeNull()
    fireEvent.click(chip('due')!.querySelector('.dt-chip-body')!)
    await screen.findByRole('grid')
    expect(within(pop()!).getByRole('button', { name: /This week/ }).classList).toContain('is-on')
    expect(within(pop()!).queryByRole('button', { name: 'Custom range' })).toBeNull()
    fireEvent.click(day('2026-11-10'))
    await flush()
    expect(pop()).not.toBeNull()
    fireEvent.mouseEnter(day('2026-11-07'))
    await flush()
    const marked = [...pop()!.querySelectorAll<HTMLElement>('.dt-cal-cell.is-band .dt-cal-day')]
    expect(marked.map((e) => e.dataset.value)).toEqual(['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10'])
    fireEvent.click(day('2026-11-07'))
    await flush()
    expect(due()).toEqual({ column: 'due', op: 'within', value: { from: '2026-11-07', to: '2026-11-10' } })
    expect(pop()).toBeNull()
    // Yeniden açınca seçili aralık çizilir; hiçbir hazır aralığa denk gelmediği için işaretli hazır yok.
    fireEvent.click(chip('due')!.querySelector('.dt-chip-body')!)
    await screen.findByRole('grid')
    expect(day('2026-11-07').dataset.selectionStart).toBe('')
    expect(day('2026-11-10').dataset.selectionEnd).toBe('')
    expect(day('2026-11-08').dataset.selected).toBe('')
    expect(pop()!.querySelector('.dt-date-preset.is-on')).toBeNull()
  })
  it('Overdue: "bugünden önce" olarak uygulanır', async () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 3, 10), shouldAdvanceTime: true })
    await mount(<Table server options={withDue} />)
    await openDue()
    fireEvent.click(within(pop()!).getByRole('button', { name: 'Overdue' }))
    await flush()
    expect(due()).toEqual({ column: 'due', op: 'before', value: '2026-11-03' })
    expect(pop()).toBeNull()
  })
  it('is / before: bugün, dün, evvelsi gün, yarın, öbür gün ve tek gün; seçilen gün yerel tarih olarak gider (UTC kayması yok)', async () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 3, 23, 30), shouldAdvanceTime: true })
    await mount(<Table server options={withDue} />)
    await openDue()
    await setOp('is')
    await screen.findByRole('grid')
    expect([...pop()!.querySelectorAll('.dt-date-preset')].map((e) => e.textContent)).toEqual([
      'Today',
      'Yesterday',
      '2 days ago',
      'Tomorrow',
      'In 2 days',
    ])
    fireEvent.click(within(pop()!).getByRole('button', { name: 'Yesterday' }))
    await flush()
    expect(due()).toEqual({ column: 'due', op: 'eq', value: '2026-11-02' })
    fireEvent.click(chip('due')!.querySelector('.dt-chip-body')!)
    await screen.findByRole('grid')
    expect(within(pop()!).getByRole('button', { name: 'Yesterday' }).classList).toContain('is-on')
    fireEvent.click(within(pop()!).getByRole('button', { name: 'In 2 days' }))
    await flush()
    expect(due()).toEqual({ column: 'due', op: 'eq', value: '2026-11-05' })
    fireEvent.click(chip('due')!.querySelector('.dt-chip-body')!)
    await screen.findByRole('grid')
    await setOp('is before')
    fireEvent.click(day('2026-11-20'))
    await flush()
    expect(due()).toEqual({ column: 'due', op: 'before', value: '2026-11-20' })
    fireEvent.click(chip('due')!.querySelector('.dt-chip-body')!)
    await screen.findByRole('grid')
    expect(day('2026-11-20').dataset.selected).toBe('')
  })
  it('başlık: gün → ay → yıl ızgarası; seçim bir alt görünüme döner, Esc popover’ı kapatmadan geri çıkar', async () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 3, 10), shouldAdvanceTime: true })
    await mount(<Table server options={withDue} />)
    await openDue()
    const title = () => pop()!.querySelector<HTMLElement>('.dt-cal-title')!
    fireEvent.click(title())
    await flush()
    expect(title().textContent).toBe('2026')
    expect(document.activeElement?.getAttribute('aria-label')).toBe('November 2026')
    fireEvent.click(title())
    await flush()
    expect(title().textContent).toBe('2016 – 2027')
    fireEvent.click(within(pop()!).getByRole('button', { name: 'Previous' }))
    await flush()
    expect(title().textContent).toBe('2004 – 2015')
    fireEvent.click(within(pop()!).getByRole('button', { name: '2012' }))
    await flush()
    expect(title().textContent).toBe('2012')
    fireEvent.click(within(pop()!).getByRole('button', { name: 'March 2012' }))
    await flush()
    expect(title().textContent).toBe('March 2012')
    expect(document.activeElement).toBe(title())
    expect(day('2012-03-15')).not.toBeNull()
    fireEvent.click(title())
    await flush()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    await flush()
    expect(pop()).not.toBeNull()
    expect(title().textContent).toBe('March 2012')
    // Seçilen aralığın ayı ay ızgarasında seçili görünür.
    fireEvent.click(day('2012-03-10'))
    fireEvent.click(day('2012-03-12'))
    await flush()
    fireEvent.click(chip('due')!.querySelector('.dt-chip-body')!)
    await screen.findByRole('grid')
    expect(title().textContent).toBe('March 2012')
    fireEvent.click(title())
    await flush()
    expect(within(pop()!).getByRole('button', { name: 'March 2012' }).getAttribute('aria-pressed')).toBe('true')
  })
  it('hafta başı yerel ayardan: en-US pazar, tr pazartesi', async () => {
    await mount(<Table server options={withDue} />)
    await openDue()
    expect(pop()!.querySelector('.dt-cal-dow')!.getAttribute('aria-label')).toBe('Sunday')
    cleanup()
    await mount(
      <DataTableProvider locale="tr">
        <Table server options={withDue} />
      </DataTableProvider>,
    )
    fireEvent.click(document.querySelector('.dt-toolbar .dt-filter-trigger')!)
    await flush()
    fireEvent.click(screen.getByRole('option', { name: /^Due/ }))
    await screen.findByRole('grid')
    expect(pop()!.querySelector('.dt-cal-dow')!.getAttribute('aria-label')).toBe('Pazartesi')
  })
})

describe('istemci modu ve durumlar', () => {
  it('süzer; No results: tek filtrede Remove “Status”, ikide Clear all filters', async () => {
    await mount(<Table />)
    await pickColumn('Status')
    await check('Done')
    expect(footer()).toBe('Rows 1–10')
    await setOp('is not')
    expect(footer()).toBe('Rows 1–10 of 20')
    await check('Planned')
    await check('On hold')
    expect(document.querySelector('.dt-state')!.textContent).toContain('No orders match this filter')
    fireEvent.click(screen.getByRole('button', { name: 'Remove “Status”' }))
    await flush()
    expect(chips()).toEqual([])
    expect(footer()).toBe('Rows 1–10 of 30')
  })
  it('header: "Filter by this column…" çipi açar; huni var olan çipi açar', async () => {
    await mount(<Table />)
    fireEvent.click(screen.getByRole('button', { name: 'Status column options' }))
    await flush()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Filter by this column…' }))
    await flush()
    expect(chips()).toEqual(['status'])
    expect(pop()).not.toBeNull()
    await check('Done')
    await closePop()
    fireEvent.click(document.querySelector('.dt-head-cell[data-col="status"] .dt-head-filtered')!)
    await flush()
    expect(pop()).not.toBeNull()
    expect(chips()).toEqual(['status'])
  })
})

describe('arama', () => {
  it('250 ms sonra uygulanır, sayfa 1; çip ve sayaç üretmez; Esc önce temizler', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await mount(<Table options={{ initialState: { page: 2 } }} />)
    const box = screen.getByRole('searchbox', { name: 'Search orders…' })
    fireEvent.change(box, { target: { value: 'so-00' } })
    act(() => vi.advanceTimersByTime(249))
    expect(req().search).toBe('')
    act(() => vi.advanceTimersByTime(1))
    expect(req().search).toBe('so-00')
    expect(req().page.number).toBe(1)
    expect(footer()).toBe('Rows 1–9')
    expect(chips()).toEqual([])
    fireEvent.keyDown(box, { key: 'Escape' })
    await flush()
    expect(req().search).toBe('')
    expect(footer()).toBe('Rows 1–10 of 30')
  })
  it('sonuç yoksa "No orders match …" ve Clear search; filtreyle birlikte tek başlık', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await mount(<Table />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'nope' } })
    act(() => vi.advanceTimersByTime(250))
    expect(document.querySelector('.dt-state')!.textContent).toContain('No orders match “nope”')
    await pickColumn('Urgent')
    expect(document.querySelector('.dt-state')!.textContent).toContain('No orders match “nope” and 1 filters')
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    await flush()
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('')
    expect(footer()).toBe('Rows 1–6')
  })
  it("kısayollar: '/' aramaya odaklar, 'F' picker'ı açar; metin alanındayken çalışmaz", async () => {
    await mount(<Table />)
    fireEvent.keyDown(window, { key: '/' })
    await flush()
    expect(document.activeElement).toBe(screen.getByRole('searchbox'))
    fireEvent.keyDown(document.activeElement!, { key: 'f' })
    await flush()
    expect(document.querySelector('.dt-picker')).toBeNull()
    ;(document.activeElement as HTMLElement).blur()
    fireEvent.keyDown(window, { key: 'f' })
    await flush()
    expect(document.querySelector('.dt-picker')).not.toBeNull()
  })
})

describe('controlled filtreler ve arama (R5)', () => {
  it('onStateChange tam koşulları bildirir; dışarıdan gelen filtre ve arama ekrana yansır', async () => {
    const onStateChange = vi.fn<(s: TableState) => void>()
    function Url() {
      const [state, setState] = useState<Partial<TableState>>({
        filters: [{ column: 'urgent', op: 'eq', value: true }],
      })
      return (
        <>
          <button type="button" onClick={() => setState({ filters: [], search: 'valve' })}>
            back
          </button>
          <Table
            options={{
              state,
              onStateChange: (s) => {
                onStateChange(s)
                setState({ filters: s.filters, search: s.search })
              },
            }}
          />
        </>
      )
    }
    await mount(<Url />)
    expect(chipText('urgent')).toBe('Urgent is Yes')
    expect(footer()).toBe('Rows 1–6')
    await pickColumn('Status')
    // Eksik çip durumu değiştirmez.
    expect(onStateChange).not.toHaveBeenCalled()
    await check('Done')
    expect(onStateChange.mock.lastCall![0].filters).toEqual([
      { column: 'urgent', op: 'eq', value: true },
      { column: 'status', op: 'in', value: ['done'] },
    ])
    await closePop()
    fireEvent.click(screen.getByRole('button', { name: 'back' }))
    await flush()
    expect(chips()).toEqual([])
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('valve')
    expect(footer()).toBe('Rows 1–10 of 15')
  })
})
