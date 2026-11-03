// Faz 2 · veri akışı (R4, 05 §8–10): istemci sıralaması ve sayfalaması, sunucu modunda yükleme geçişleri, footer, Count total,
// isteğin alanları, controlled durum ve sayfa boyutu tercihi.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DataTableProvider } from '../src/core/provider'
import { DataTable } from '../src/list/data-table'
import { useDataTable, type DataTableInstance } from '../src/list/use-data-table'
import type {
  ColumnDef,
  DataTableResult,
  PreferencesAdapter,
  QueryWithoutPage,
  TableState,
  UseDataTableOptions,
} from '../src/types'
import { flush, mockLayout } from './helpers/dom'

interface Person {
  id: number
  name: string | null
  city: string
  score: number | null
}

const columns: Array<ColumnDef<Person>> = [
  { id: 'name', header: 'Name', type: 'string', primary: true },
  { id: 'city', header: 'City', type: 'string' },
  { id: 'score', header: 'Score', type: 'int' },
  { id: 'note', header: 'Note', type: 'string', hidden: true, fields: ['note_id'] },
]

const people = (n: number, from = 1): Person[] =>
  Array.from({ length: n }, (_, i) => ({ id: from + i, name: `P${from + i}`, city: 'Gebze', score: from + i }))

beforeAll(mockLayout)
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

type Options = Partial<UseDataTableOptions<Person>>

function Harness({
  result,
  options,
  onTable,
}: {
  result?: DataTableResult<Person>
  options?: Options
  onTable?: (t: DataTableInstance<Person>) => void
}) {
  const table = useDataTable<Person>({
    id: 'people',
    columns,
    entityName: { one: 'person', other: 'people' },
    ...options,
  })
  useEffect(() => {
    onTable?.(table)
  })
  return <DataTable table={table} result={result} />
}

const texts = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].map((e) => e.textContent)
const names = () => texts('.dt-row [data-col="name"] .dt-cell-content')
const footer = () => document.querySelector('.dt-footer-left')!.textContent
const label = (col: string) => document.querySelector<HTMLElement>(`.dt-head-cell[data-col="${col}"] .dt-head-label`)!

describe('istemci modu', () => {
  it('header tık asc → desc → kapalı; Türkçe collator, boş değer artanda sonda, azalanda başta', async () => {
    const rows: Person[] = ['Zeynep', 'İnci', null, 'Ali', 'Çelik', 'Ilgın'].map((name, i) => ({
      id: i + 1,
      name,
      city: 'Gebze',
      score: i,
    }))
    render(
      <DataTableProvider locale="tr">
        <Harness options={{ rows }} />
      </DataTableProvider>,
    )
    await flush()
    fireEvent.click(label('name'))
    await flush()
    expect(names()).toEqual(['Ali', 'Çelik', 'Ilgın', 'İnci', 'Zeynep', '—'])
    expect(label('name').closest('[role="columnheader"]')!.getAttribute('aria-sort')).toBe('ascending')
    fireEvent.click(label('name'))
    await flush()
    expect(names()[0]).toBe('—')
    fireEvent.click(label('name'))
    await flush()
    expect(names()[0]).toBe('Zeynep')
    expect(label('name').closest('[role="columnheader"]')!.hasAttribute('aria-sort')).toBe(false)
  })
  it('⇧ ikincil sıralama: öncelik rozeti, aria-sort yalnızca birincilde; menüden yön', async () => {
    render(<Harness options={{ rows: people(5) }} />)
    await flush()
    fireEvent.click(label('city'))
    fireEvent.click(label('score'), { shiftKey: true })
    await flush()
    const head = (col: string) => label(col).closest<HTMLElement>('[role="columnheader"]')!
    expect(head('city').querySelector('.dt-head-sort-index')!.textContent).toBe('1')
    expect(head('score').querySelector('.dt-head-sort-index')!.textContent).toBe('2')
    expect(head('city').getAttribute('aria-sort')).toBe('ascending')
    expect(head('score').hasAttribute('aria-sort')).toBe(false)
    // Enter da sıralar; ⇧ ikincilin yönünü değiştirir.
    fireEvent.keyDown(label('score'), { key: 'Enter', shiftKey: true })
    await flush()
    expect(names()[0]).toBe('P5')
  })
  it('sayfalama: footer metinleri, Next, sayfa boyutu 1. sayfaya döner, Alt→', async () => {
    render(<Harness options={{ rows: people(120), pageSize: 50 }} />)
    await flush()
    expect(footer()).toContain('Rows 1–50')
    expect(footer()).toContain('of 120')
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    await flush()
    expect(footer()).toContain('Rows 51–100')
    expect(document.querySelector('.dt-row[data-index="0"]')!.getAttribute('aria-rowindex')).toBe('52')
    fireEvent.change(document.querySelector('.dt-footer select')!, { target: { value: '100' } })
    await flush()
    expect(footer()).toContain('Rows 1–100')
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true })
    await flush()
    expect(footer()).toContain('Rows 101–120')
    expect(screen.getByRole('button', { name: /Next/ })).toHaveProperty('disabled', true)
  })
  it('tek sayfa: "of N" ve Count total yok', async () => {
    render(<Harness options={{ rows: people(3) }} />)
    await flush()
    expect(footer()).toBe('Rows 1–3')
  })
  it('hiç satır yok: Empty durumu ve "No rows"', async () => {
    render(<Harness options={{ rows: [] }} />)
    await flush()
    expect(screen.getByRole('status', { name: '' }).textContent).toContain('No people yet')
    expect(footer()).toBe('No rows')
  })
})

describe('sunucu modu: yükleme geçişleri', () => {
  const page1: DataTableResult<Person> = {
    status: 'success',
    data: { rows: people(3), hasMore: true },
    dataUpdatedAt: 1,
    refetch: vi.fn(),
  }
  const mountServer = async (result: DataTableResult<Person>, options?: Options) => {
    let table!: DataTableInstance<Person>
    const view = render(<Harness result={result} options={options} onTable={(t) => (table = t)} />)
    await flush()
    return {
      ...view,
      table: () => table,
      show: (r: DataTableResult<Person>) =>
        view.rerender(<Harness result={r} options={options} onTable={(t) => (table = t)} />),
    }
  }

  it('ilk yükleme: iskelet anında, footer "Loading…", sayfalama kilitli', async () => {
    await mountServer({ status: 'pending', isFetching: true })
    expect(document.querySelectorAll('.dt-row-skeleton').length).toBe(12)
    expect(footer()).toBe('Loading…')
    expect(screen.getByRole('button', { name: /Next/ })).toHaveProperty('disabled', true)
  })

  it('sayfa değişimi kimlik değiştirir: eski satırlar soluk + inert, footer eski sayfada kilitli, 400 ms sonra iskelet', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const s = await mountServer(page1)
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(s.table().request.page.number).toBe(2)
    // TanStack Query: yeni anahtarın verisi yok, eski veri yer tutucu ve dataUpdatedAt 0.
    s.show({ ...page1, isFetching: true, isPlaceholderData: true, dataUpdatedAt: 0 })
    const grid = document.querySelector<HTMLElement>('.dt-grid')!
    expect(grid.classList).toContain('is-dim')
    expect(grid.querySelector('.dt-body')!.hasAttribute('inert')).toBe(true)
    expect(footer()).toContain('Rows 1–3')
    // Yeni anahtarın henüz verisi yok; tazelik ekrandaki verinin zamanını gösterir.
    expect(footer()).toContain('Updated')
    expect(screen.getByRole('button', { name: /Previous/ })).toHaveProperty('disabled', true)
    act(() => vi.advanceTimersByTime(399))
    expect(document.querySelector('.dt-row-skeleton')).toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(document.querySelectorAll('.dt-row-skeleton').length).toBe(12)
    s.show({ ...page1, data: { rows: people(3, 101), hasMore: false }, dataUpdatedAt: 2 })
    await flush()
    expect(footer()).toContain('Rows 101–103')
    // Aynı anahtarda yenileme snapshot'ı ilerletir; sonraki istek, sonucu gelmeden eski veriyi yeni sayfaya yazmaz.
    s.show({ ...page1, data: { rows: people(3, 101), hasMore: false }, dataUpdatedAt: 3 })
    await flush()
    fireEvent.click(screen.getByRole('button', { name: /Previous/ }))
    await flush()
    expect(grid.classList).not.toContain('is-dim')
    expect(footer()).toContain('Rows 101–103')
    expect(footer()).toContain('end of results')
  })

  it('yenileme kimliği korur: satırlar etkileşimli, 150 ms sonra çubuk ve "Updating…"; hata → Stale şeridi', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const s = await mountServer(page1)
    s.show({ ...page1, isFetching: true })
    expect(document.querySelector('.dt-grid')!.classList).not.toContain('is-dim')
    act(() => vi.advanceTimersByTime(149))
    expect(document.querySelector('.dt-refresh-bar')).toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(document.querySelector('.dt-refresh-bar')).not.toBeNull()
    expect(footer()).toContain('Updating…')
    s.show({ ...page1, status: 'error', error: new Error('Network') })
    expect(names()).toEqual(['P1', 'P2', 'P3'])
    expect(document.querySelector('.dt-strip')!.textContent).toMatch(/Couldn't refresh/)
  })

  it('kimlik değiştiren isteğin hatası: Error durumu, mesaj, Copy error ID, assertive duyuru; Try again refetch', async () => {
    const refetch = vi.fn()
    await mountServer({ status: 'error', error: { message: 'Server said no', id: 'E-42' }, refetch })
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain("Couldn't load people")
    expect(alert.textContent).toContain('Server said no')
    expect(alert.querySelector('.dt-state-code')!.textContent).toBe('E-42')
    expect(document.querySelector('[aria-live="assertive"]')!.textContent).toContain("Couldn't load people")
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('10 sn sürerse "Still loading…"', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const s = await mountServer(page1)
    s.show({ ...page1, isFetching: true, isPlaceholderData: true, dataUpdatedAt: 1 })
    act(() => vi.advanceTimersByTime(10_000))
    expect(document.querySelector('.dt-notice')!.textContent).toBe('Still loading…')
  })

  it('Count total: sayfasız sorgu ve iptal sinyali; sonuç "of N · counted", sıralama değişince düşer', async () => {
    let resolve!: (n: number) => void
    const count = vi.fn<(q: QueryWithoutPage, s: AbortSignal) => Promise<number>>(
      () => new Promise<number>((r) => (resolve = r)),
    )
    await mountServer(page1, { count })
    fireEvent.click(screen.getByRole('button', { name: /Count total/ }))
    expect(count.mock.calls[0]![0]).not.toHaveProperty('page')
    expect(footer()).toContain('Counting…')
    await act(async () => resolve(1240))
    // Parçalar arası boşluk flex gap'ten; metinde boşluk yok.
    expect(footer()).toMatch(/of 1,240· counted \d\d:\d\d/)
    expect(document.querySelector('[aria-live="polite"]')!.textContent).toBe('1,240 people')
    const signal = count.mock.calls[0]![1]
    fireEvent.click(label('city'))
    await flush()
    expect(footer()).not.toContain('1,240')
    expect(signal.aborted).toBe(true)
  })

  it('R yeniler, metin alanında yazarken yenilemez', async () => {
    const refetch = vi.fn()
    await mountServer({ ...page1, refetch })
    fireEvent.keyDown(window, { key: 'r' })
    expect(refetch).toHaveBeenCalledTimes(1)
    const input = document.body.appendChild(document.createElement('input'))
    fireEvent.keyDown(input, { key: 'r' })
    expect(refetch).toHaveBeenCalledTimes(1)
    input.remove()
  })
})

describe('istek (R4)', () => {
  it('alanlar: satır anahtarı + görünür sütunlar + `fields`; gizlemek ve taşımak isteği değiştirmez, yeni sütun genişletir', async () => {
    let table!: DataTableInstance<Person>
    render(<Harness result={{ status: 'pending' }} onTable={(t) => (table = t)} />)
    await flush()
    expect(table.request.fields).toEqual(['id', 'name', 'city', 'score'])
    const before = table.request.fields
    act(() => table.layout.setVisible('city', false))
    await flush()
    expect(table.request.fields).toBe(before)
    act(() => table.layout.move('score', -1))
    await flush()
    expect(table.request.fields).toBe(before)
    act(() => table.layout.setVisible('note', true))
    await flush()
    // Koddaki sıra; gizli `city` artık istenmez.
    expect(table.request.fields).toEqual(['id', 'name', 'score', 'note', 'note_id'])
  })
  it('sıralama değişince sayfa 1', async () => {
    let table!: DataTableInstance<Person>
    render(
      <Harness result={{ status: 'pending' }} options={{ initialState: { page: 3 } }} onTable={(t) => (table = t)} />,
    )
    await flush()
    expect(table.request.page.number).toBe(3)
    fireEvent.click(label('city'))
    await flush()
    expect(table.request).toMatchObject({ sort: [{ column: 'city', dir: 'asc' }], page: { number: 1 } })
  })
})

describe('durum (R5) ve tercihler', () => {
  it('controlled sort: tık onStateChange ile bildirilir, ekran dışarıdaki duruma uyar', async () => {
    const onStateChange = vi.fn<(s: TableState) => void>()
    const state = { sort: [] }
    const view = render(<Harness options={{ rows: people(3), state, onStateChange }} />)
    await flush()
    fireEvent.click(label('score'))
    await flush()
    expect(onStateChange).toHaveBeenLastCalledWith({
      search: '',
      filters: [],
      sort: [{ column: 'score', dir: 'asc' }],
      page: 1,
      pageSize: 100,
    })
    expect(label('score').closest('[role="columnheader"]')!.classList).not.toContain('is-sorted')
    view.rerender(
      <Harness options={{ rows: people(3), state: { sort: [{ column: 'score', dir: 'desc' }] }, onStateChange }} />,
    )
    await flush()
    expect(names()[0]).toBe('P3')
  })
  it('sayfa boyutu tercihten okunur ve tercihe yazılır', async () => {
    const set = vi.fn()
    const preferences: PreferencesAdapter = { get: () => ({ pageSize: 250 }), set }
    render(
      <DataTableProvider preferences={preferences}>
        <Harness options={{ rows: people(600) }} />
      </DataTableProvider>,
    )
    await flush()
    expect(footer()).toContain('Rows 1–250')
    fireEvent.change(document.querySelector('.dt-footer select')!, { target: { value: '50' } })
    expect(set).toHaveBeenCalledWith('people', { pageSize: 50 })
  })
})
