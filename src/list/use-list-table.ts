'use no memo'
// İstemci modunun satır modeli (01 · TanStack sınırı, D23): filtre, arama, sıralama ve sayfalama TanStack row model'leriyle. Sunucu modunda
// kullanılmaz: işlemi sunucu yapar, satırlar olduğu gibi çizilir. R11: TanStack örneği kendi atom'larını değiştirir;
// dosya derleyicinin dışındadır.
import {
  columnFilteringFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef as TanstackColumnDef,
} from '@tanstack/react-table'
import { comparator } from '../core/cells/compare'
import { TYPE_SPECS } from '../core/cells/specs'
import { readPath } from '../core/columns/read-path'
import { matches } from '../core/filters/model'
import type { ColumnDef } from '../types/columns'
import type { FilterCondition, SortRule } from '../types/query'
import { MAX_SORT } from './sort'

const features = tableFeatures({
  // globalFiltering, columnFiltering'i ön koşul ister (TanStack).
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
})
type Features = typeof features

const NO_ROWS: never[] = []
const noop = () => {}

export const isSortable = (def: ColumnDef): boolean => def.sortable ?? TYPE_SPECS[def.type].sortable
export const isFilterable = (def: ColumnDef): boolean => def.filterable ?? TYPE_SPECS[def.type].filterable
export const isSearchable = (def: ColumnDef): boolean => def.searchable ?? TYPE_SPECS[def.type].searchable
const isEmpty = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)

export interface ListTableOptions<Row extends object> {
  columns: Array<ColumnDef<Row>>
  /** Verilmezse sunucu modu: hook boş döner. */
  rows: Row[] | undefined
  rowId: (row: Row) => string
  locale: string
  search: string
  /** Yalnızca tam koşullar; sütun başına `filterFn` (04 §1). */
  filters: FilterCondition[]
  sort: SortRule[]
  page: number
  pageSize: number
}

export function useListTable<Row extends object>(o: ListTableOptions<Row>) {
  const columns: Array<TanstackColumnDef<Features, Row, unknown>> = o.columns.map((d) => {
    const id = d.id as string
    const cmp = comparator(d as ColumnDef, o.locale)
    return {
      id,
      accessorFn: d.accessor ?? ((row: Row) => readPath(row, id)),
      enableSorting: isSortable(d as ColumnDef),
      enableGlobalFilter: isSearchable(d as ColumnDef),
      enableColumnFilter: isFilterable(d as ColumnDef),
      filterFn: (row, columnId, cond: FilterCondition) => matches(cond, row.getValue(columnId), { locale: o.locale }),
      sortFn: (a, b, columnId) => cmp(a.getValue(columnId), b.getValue(columnId)),
      // Boş değer "en büyük": artanda sonda, azalanda başta (PostgreSQL ile aynı).
      sortUndefined: 1,
    }
  })

  const searchable = new Set(o.columns.filter((d) => isSearchable(d as ColumnDef)).map((d) => d.id as string))
  // Durum tamamen dışarıda (useDataTable); TanStack'in updater'ları kullanılmaz.
  const table = useTable(
    {
      features,
      columns,
      data: o.rows ?? NO_ROWS,
      getRowId: o.rowId,
      state: {
        // Arama locale'e göre küçültülür (09: I/ı, İ/i doğru eşleşmeli).
        globalFilter: o.search.trim().toLocaleLowerCase(o.locale),
        columnFilters: o.filters.map((f) => ({ id: f.column, value: f })),
        sorting: o.sort.map((s) => ({ id: s.column, desc: s.dir === 'desc' })),
        pagination: { pageIndex: o.page - 1, pageSize: o.pageSize },
      },
      getColumnCanGlobalFilter: (column) => searchable.has(column.id),
      globalFilterFn: (row, columnId, needle: string) => {
        const v = row.getValue(columnId)
        return !isEmpty(v) && String(v).toLocaleLowerCase(o.locale).includes(needle)
      },
      onGlobalFilterChange: noop,
      onColumnFiltersChange: noop,
      onSortingChange: noop,
      onPaginationChange: noop,
      autoResetPageIndex: false,
      maxMultiSortColCount: MAX_SORT,
    },
    (s) => ({
      globalFilter: s.globalFilter,
      columnFilters: s.columnFilters,
      sorting: s.sorting,
      pagination: s.pagination,
    }),
  )

  if (!o.rows) return { rows: undefined, total: undefined }
  return {
    /** Sayfadaki satırlar: sıralı ve dilimlenmiş. */
    rows: table.getRowModel().rows.map((r) => r.original),
    /** Filtre ve arama sonrası, sayfalama öncesi toplam. */
    total: table.getPrePaginatedRowModel().rows.length,
  }
}
