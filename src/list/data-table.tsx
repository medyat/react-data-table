// Liste bileşeni (05): Faz 1'de ızgara ve hücreler; araç çubuğu, durumlar ve sayfalama Faz 2'de.
import type { MouseEvent } from 'react'
import { Grid } from '../core/grid/grid'
import type { DataTableResult } from '../types/list'
import type { DataTableInstance } from './use-data-table'

export function DataTable<Row extends object>({
  table,
  result,
  label,
  onRowClick,
}: {
  table: DataTableInstance<Row>
  /** Sunucu modu: `useQuery` sonucu (R4). İstemci modunda satırlar `useDataTable({ rows })`'dan. */
  result?: DataTableResult<Row>
  /** Izgaranın erişilebilir adı. */
  label?: string
  /** Satır gövdesine düz tık; hücredeki düğme, link ve metin seçimi tetiklemez (05 §7). */
  onRowClick?: (row: Row, event: MouseEvent) => void
}) {
  const rows = result?.data?.rows ?? table.rows ?? []
  const skeleton = result?.status === 'pending' && !result.data
  return (
    // Kökün yazı boyutu (--dt-fs) kökteki yoğunluktan çözülür; yalnızca ızgarada olsaydı hep standard kalırdı.
    <div className="dt dt-list" data-density={table.density}>
      <Grid
        layout={table.layout}
        rows={rows}
        rowId={table.rowId}
        label={label ?? table.id}
        density={table.density}
        skeleton={skeleton}
        rowCount={skeleton ? -1 : rows.length + 1}
        onRowClick={onRowClick}
      />
    </div>
  )
}
