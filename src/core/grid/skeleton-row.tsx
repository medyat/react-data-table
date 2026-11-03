// Yükleme iskeleti (03 · Skeleton, T8-02): tipe göre biçim; metin çubuğu satırdan satıra %55–80 arası değişir.
import { TYPE_SPECS, alignOf } from '../cells/specs'
import type { LayoutColumn } from '../columns/use-column-layout'
import { pinClasses, pinStyle } from './pin'
import { withFill } from './row'

const WIDTHS = [72, 58, 80, 64, 55, 76, 61, 69]

export function SkeletonRow<Row extends object>({
  index,
  columns,
}: {
  index: number
  columns: Array<LayoutColumn<Row>>
}) {
  return (
    <div className="dt-row dt-row-skeleton" role="row" aria-hidden="true">
      {withFill(columns, (col, i) => {
        const shape = TYPE_SPECS[col.def.type].skeleton
        const width = `${WIDTHS[(index + i) % WIDTHS.length]}%`
        const cls = ['dt-cell', `is-${alignOf(col.def)}`, ...pinClasses(col)].join(' ')
        return (
          <div key={col.id} className={cls} style={pinStyle(col)} role="cell">
            {shape === 'person' ? (
              <>
                <span className="dt-sk dt-sk-circle" />
                <span className="dt-sk dt-sk-bar" style={{ width }} />
              </>
            ) : shape === 'badge' ? (
              <span className="dt-sk dt-sk-pill" />
            ) : shape === 'number' ? (
              <span className="dt-sk dt-sk-bar dt-sk-num" />
            ) : (
              <span className="dt-sk dt-sk-bar" style={{ width }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
