import { useColumnLayout } from '../core/columns/use-column-layout'
import { readPath } from '../core/columns/read-path'
import type { UseDataTableOptions } from '../types/list'

/** Tablonun durumu ve mantığı (R3). Ekranın başka yerleri de buradan okur; `<DataTable table={…} />` çizer. */
export function useDataTable<Row extends object>(options: UseDataTableOptions<Row>) {
  const rowKey = options.rowKey ?? 'id'
  const layout = useColumnLayout({ columns: options.columns })
  return {
    id: options.id,
    columns: options.columns,
    rows: options.rows,
    density: options.density ?? 'standard',
    rowId: (row: Row) => String(readPath(row, rowKey)),
    layout,
  }
}

export type DataTableInstance<Row extends object> = ReturnType<typeof useDataTable<Row>>
