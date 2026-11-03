'use no memo'
// İstemci modunun satır modeli (01 · TanStack sınırı, D23): sıralama ve sayfalama TanStack row model'leriyle. Sunucu modunda
// kullanılmaz: işlemi sunucu yapar, satırlar olduğu gibi çizilir. R11: TanStack örneği kendi atom'larını değiştirir;
// dosya derleyicinin dışındadır.
import {
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef as TanstackColumnDef,
} from '@tanstack/react-table'
import { comparator } from '../core/cells/compare'
import { TYPE_SPECS } from '../core/cells/specs'
import { readPath } from '../core/columns/read-path'
import type { ColumnDef } from '../types/columns'
import type { SortRule } from '../types/query'
import { MAX_SORT } from './sort'

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
})
type Features = typeof features

const NO_ROWS: never[] = []
const noop = () => {}

export const isSortable = (def: ColumnDef): boolean => def.sortable ?? TYPE_SPECS[def.type].sortable

export interface ListTableOptions<Row extends object> {
  columns: Array<ColumnDef<Row>>
  /** Verilmezse sunucu modu: hook boş döner. */
  rows: Row[] | undefined
  rowId: (row: Row) => string
  locale: string
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
      sortFn: (a, b, columnId) => cmp(a.getValue(columnId), b.getValue(columnId)),
      // Boş değer "en büyük": artanda sonda, azalanda başta (PostgreSQL ile aynı).
      sortUndefined: 1,
    }
  })

  // Durum tamamen dışarıda (useDataTable); TanStack'in updater'ları kullanılmaz.
  const table = useTable(
    {
      features,
      columns,
      data: o.rows ?? NO_ROWS,
      getRowId: o.rowId,
      state: {
        sorting: o.sort.map((s) => ({ id: s.column, desc: s.dir === 'desc' })),
        pagination: { pageIndex: o.page - 1, pageSize: o.pageSize },
      },
      onSortingChange: noop,
      onPaginationChange: noop,
      autoResetPageIndex: false,
      maxMultiSortColCount: MAX_SORT,
    },
    (s) => ({ sorting: s.sorting, pagination: s.pagination }),
  )

  if (!o.rows) return { rows: undefined, total: undefined }
  return {
    /** Sayfadaki satırlar: sıralı ve dilimlenmiş. */
    rows: table.getRowModel().rows.map((r) => r.original),
    /** Sayfalama öncesi toplam. */
    total: table.getPrePaginatedRowModel().rows.length,
  }
}
