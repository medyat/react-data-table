// İç içe başlığın grup satırları (form-grid.md §2 `group`, pano F1a): başlık satırının (`.dt-head`) üstteki grid
// satırlarında, kapsadığı yaprakların üstünde. Yerleşim açık (`grid-column`); yaprak, ön ve son hücreler CSS'te alt
// satıra ya da bütün satırlara yerleşir. Ekran okuyucu grubu yaprağın adında duyar (HeaderCell), hücre gizlidir.
import type { CSSProperties } from 'react'
import type { ColumnLayoutApi } from '../columns/use-column-layout'
import { pinStyle } from './pin'

export function HeaderGroups<Row extends object>({
  layout,
  lead,
}: {
  layout: ColumnLayoutApi<Row>
  /** Yapraklardan önceki sütun sayısı (sürükleme tutamacı, seçim, satır no). */
  lead: number
}) {
  return layout.groups.flatMap((row, level) =>
    row.map((g) => {
      const cls = ['dt-head-cell', 'dt-head-group']
      if (g.pin) cls.push(g.pin.pinned === 'start' ? 'is-pinned-start' : 'is-pinned-end')
      if (g.edge) cls.push('is-pin-edge')
      const style: CSSProperties = {
        gridRow: level + 1,
        gridColumn: `${lead + g.from + 1} / span ${g.span}`,
        ...(g.pin && pinStyle(g.pin)),
      }
      return (
        <div key={g.key} className={cls.join(' ')} style={style} aria-hidden="true" data-dt-tip={g.label}>
          <span className="dt-head-group-text">{g.label}</span>
        </div>
      )
    }),
  )
}

/** `.dt-head`'in grup varken satırları: gruplar, altta yapraklar. */
export const headStyle = <Row extends object>(layout: ColumnLayoutApi<Row>): CSSProperties | undefined =>
  layout.groups.length
    ? ({
        gridTemplateRows: `repeat(${layout.groups.length}, var(--dt-group-h)) var(--dt-head-h)`,
        height: 'auto',
        '--dt-head-groups': `calc(${layout.groups.length} * var(--dt-group-h))`,
      } as CSSProperties)
    : undefined
