// R32 · R33: `when: false` sütun tabloda yoktur; durumdaki (adres, görünüm) süzgeç ve sıralama yalnızca tablonun
// tanıyıp kullanılamaz bildiği sütunda atlanır, tanımadığı alan (sütunu olmayan Laraql alanı) olduğu gibi gider.
import { cleanup, render } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DataTableProvider } from '../src/core/provider'
import { DataTable } from '../src/list/data-table'
import { useDataTable, type DataTableInstance } from '../src/list/use-data-table'
import type { ColumnDef, TableState, View } from '../src/types'
import { flush, mockLayout } from './helpers/dom'

interface Company {
  id: number
  title: string
  city: string
  risk: string
  note: string
}

const columns: Array<ColumnDef<Company>> = [
  { id: 'title', header: 'Title', type: 'string', primary: true },
  { id: 'city', header: 'City', type: 'string', sortable: false },
  { id: 'risk', header: 'Risk', type: 'float', when: false },
  { id: 'note', header: 'Note', type: 'string', filterable: false },
]

beforeAll(mockLayout)
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function Harness({
  state,
  views,
  onTable,
}: {
  state?: Partial<TableState>
  views?: View[]
  onTable: (t: DataTableInstance<Company>) => void
}) {
  const table = useDataTable<Company>({ id: 'companies', columns, state, views })
  useEffect(() => {
    onTable(table)
  })
  return <DataTable table={table} result={{ status: 'pending' }} />
}

async function mount(props: { state?: Partial<TableState>; views?: View[] }) {
  let table!: DataTableInstance<Company>
  render(
    <DataTableProvider>
      <Harness {...props} onTable={(t) => (table = t)} />
    </DataTableProvider>,
  )
  await flush()
  return table
}

describe('sütunun `when` alanı (R33)', () => {
  it('false olan sütun tabloda, istekte ve başlıkta yoktur', async () => {
    const table = await mount({})

    expect(table.columns.map((c) => c.id)).toEqual(['title', 'city', 'note'])
    expect(table.request.fields).not.toContain('risk')
    expect(document.querySelector('.dt-head-cell[data-col="risk"]')).toBeNull()
  })
})

describe('durumdaki süzgeç ve sıralama (R32)', () => {
  it('adresteki koşul yalnızca kullanılamaz sütunda atlanır; tanınmayan alan gider', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const table = await mount({
      state: {
        filters: [
          { column: 'risk', op: 'gt', value: 0 },
          { column: 'note', op: 'contains', value: 'x' },
          { column: 'city', op: 'eq', value: 'Bursa' },
          { column: 'is_ours', op: 'eq', value: true },
        ],
        sort: [
          { column: 'risk', dir: 'desc' },
          { column: 'city', dir: 'asc' },
          { column: 'title', dir: 'asc' },
        ],
      },
    })

    expect(table.request.filters.map((f) => f.column)).toEqual(['city', 'is_ours'])
    expect(table.request.sort).toEqual([{ column: 'title', dir: 'asc' }])
  })

  it('hazır görünümün kullanılamaz koşulu atlanır, görünüm düzenlenmiş sayılmaz', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const table = await mount({
      state: { view: 'risky' },
      views: [
        {
          id: 'risky',
          name: 'Risky',
          kind: 'system',
          state: { filters: [{ column: 'risk', op: 'gt', value: 0 }], sort: [{ column: 'risk', dir: 'desc' }] },
        },
      ],
    })

    expect(table.request.filters).toEqual([])
    expect(table.request.sort).toEqual([])
    expect(table.views.edited).toBe(false)
  })
})
