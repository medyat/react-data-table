// Tablonun durumu ve mantığı (R3, R5). Ekranın başka yerleri de buradan okur; `<DataTable table={…} />` çizer.
import { useState } from 'react'
import { useColumnLayout } from '../core/columns/use-column-layout'
import { readPath } from '../core/columns/read-path'
import { usePreferences } from '../core/preferences/use-preferences'
import { useDataTableContext } from '../core/provider'
import type { ColumnDef } from '../types/columns'
import type { TableState, UseDataTableOptions } from '../types/list'
import type { TableQuery } from '../types/query'
import { setSort, toggleSort } from './sort'
import { useListTable } from './use-list-table'

const PAGE_SIZES = [50, 100, 250, 500]

/** İstenecek alanlar (R4): satır anahtarı, görünür sütunların yolu ve `fields`'i, tablonun `fields`'i; koddaki sırayla. */
function fieldsOf<Row extends object>(
  columns: Array<ColumnDef<Row>>,
  visible: Set<string>,
  rowKey: string,
  extra: string[] = [],
): string[] {
  const out = new Set([rowKey])
  for (const c of columns) {
    if (!visible.has(c.id as string)) continue
    if (!c.accessor) out.add(c.id as string)
    for (const f of c.fields ?? []) out.add(f)
  }
  for (const f of extra) out.add(f)
  return [...out]
}

export function useDataTable<Row extends object>(options: UseDataTableOptions<Row>) {
  const ctx = useDataTableContext()
  const rowKey = options.rowKey ?? 'id'
  const rowId = (row: Row) => String(readPath(row, rowKey))
  const prefs = usePreferences(options.id, ctx.preferences, {
    density: 'standard',
    verticalLines: false,
    pageSize: options.pageSize ?? 100,
    defaultViewId: null,
  })
  const layout = useColumnLayout({ columns: options.columns })

  // R5: `state`'teki alan dışarıdan, diğerleri içeriden. Uncontrolled sayfa boyutu tercihi izler.
  const [inner, setInner] = useState<Partial<TableState>>(() => options.initialState ?? {})
  const state: TableState = {
    sort: options.state?.sort ?? inner.sort ?? [],
    page: options.state?.page ?? inner.page ?? 1,
    pageSize: options.state?.pageSize ?? inner.pageSize ?? prefs.prefs.pageSize,
  }
  const update = (patch: Partial<TableState>) => {
    const next = { ...state, ...patch }
    setInner(next)
    options.onStateChange?.(next)
  }

  // Sütun taşımak ya da gizlemek isteği değiştirmez (R4): alanlar yalnızca yeni görünen sütunla, ya da sorgu değişince
  // yeniden kurulur. Önceki isteğin alanları render'lar arasında saklanır.
  const visible = fieldsOf(options.columns, new Set(layout.columns.map((c) => c.id)), rowKey, options.fields)
  const identity = JSON.stringify([state.sort, state.page, state.pageSize])
  const [sent, setSent] = useState({ identity, fields: visible })
  let fields = sent.fields
  if (sent.identity !== identity || visible.some((f) => !sent.fields.includes(f))) {
    fields = visible
    setSent({ identity, fields })
  }
  const request: TableQuery = {
    search: '',
    filters: [],
    sort: state.sort,
    page: { number: state.page, size: state.pageSize },
    fields,
  }

  const client = useListTable({
    columns: options.columns,
    rows: options.rows,
    rowId,
    locale: ctx.locale,
    sort: state.sort,
    page: state.page,
    pageSize: state.pageSize,
  })

  return {
    id: options.id,
    columns: options.columns,
    entityName: options.entityName ?? { one: options.id, other: options.id },
    /** Sunucu modunda `useQuery` anahtarına ve isteğe girer (R4). */
    request,
    state,
    /** İstemci modu: sayfadaki satırlar ve toplam. Sunucu modunda undefined. */
    rows: client.rows,
    total: client.total,
    density: options.density ?? prefs.prefs.density,
    prefs,
    pageSizes: options.pageSizes ?? PAGE_SIZES,
    count: options.count,
    rowId,
    layout,
    /** Header tıklaması ve ⇧ ile ikincil sıralama; sayfa 1'e döner. */
    toggleSort: (column: string, multi: boolean) => update({ sort: toggleSort(state.sort, column, multi), page: 1 }),
    setSort: (column: string, dir: 'asc' | 'desc' | null) =>
      update({ sort: setSort(state.sort, column, dir), page: 1 }),
    setPage: (page: number) => update({ page }),
    setPageSize: (pageSize: number) => {
      prefs.set({ pageSize })
      update({ pageSize, page: 1 })
    },
  }
}

export type DataTableInstance<Row extends object> = ReturnType<typeof useDataTable<Row>>
