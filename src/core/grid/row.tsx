// Satır + hücreler. Kabuk burada: hizalama, kesme, sabit sütun sticky'si, --dt-row-bg, ikinci satır, aksiyon overlay'i (05 §4, 03).
// Seçim, expand ve satır menüsü Faz 4'te eklenir.
import type { CSSProperties, ReactNode } from 'react'
import { CellActions } from '../cells/cell-actions'
import { cellFillStyle, renderCellContent, type RenderEnv } from '../cells/render-cell'
import { alignOf, isNumericType } from '../cells/specs'
import type { LayoutColumn } from '../columns/use-column-layout'
import { readPath } from '../columns/read-path'
import { fillIndex, pinClasses, pinStyle } from './pin'

export const FillCell = () => <div className="dt-cell dt-cell-fill" role="presentation" aria-hidden="true" />

/** Sütunları çizer, orta ile sağ sabitler arasına dolgu hücresini koyar. */
export function withFill<Row extends object>(
  columns: Array<LayoutColumn<Row>>,
  render: (col: LayoutColumn<Row>, i: number) => ReactNode,
): ReactNode[] {
  const at = fillIndex(columns)
  return [
    ...columns.slice(0, at).map((c, i) => render(c, i)),
    <FillCell key="__fill" />,
    ...columns.slice(at).map((c, i) => render(c, at + i)),
  ]
}

function Cell<Row extends object>({
  col,
  row,
  env,
  secondaryVisible,
}: {
  col: LayoutColumn<Row>
  row: Row
  env: RenderEnv
  secondaryVisible: boolean
}) {
  const def = col.def
  const value = def.accessor ? def.accessor(row) : readPath(row, col.id)
  let content = renderCellContent(def, row, value, env)
  // `id` ve `ajax` linki kendi içeriğinde çizer.
  const href = def.primary && def.type !== 'id' && def.type !== 'ajax' ? def.href?.(row) : undefined
  if (href)
    content = (
      <a className="dt-link dt-primary-link" href={href}>
        {content}
      </a>
    )
  const cls = [
    'dt-cell',
    `is-${alignOf(def)}`,
    isNumericType(def.type) && 'is-numeric',
    def.primary && 'is-primary',
    ...pinClasses(col),
  ]
  const style: CSSProperties = { ...pinStyle(col), ...cellFillStyle(def, value) }
  return (
    <div className={cls.filter(Boolean).join(' ')} style={style} role="cell" data-col={col.id}>
      <span className="dt-cell-content">{content}</span>
      {secondaryVisible && def.secondary && <span className="dt-secondary">{def.secondary(row) ?? ''}</span>}
      {def.actions?.length ? <CellActions actions={def.actions} row={row} /> : null}
    </div>
  )
}

export function Row<Row extends object>({
  row,
  index,
  rowIndex,
  columns,
  env,
}: {
  row: Row
  index: number
  /** aria-rowindex: header 1, ilk satır 2. */
  rowIndex: number
  columns: Array<LayoutColumn<Row>>
  env: RenderEnv
}) {
  // Comfortable: `secondary` görünür (02 · Yoğunluk).
  const secondaryVisible = env.density === 'comfortable'
  return (
    <div className="dt-row" role="row" aria-rowindex={rowIndex} data-index={index}>
      {withFill(columns, (col) => (
        <Cell key={col.id} col={col} row={row} env={env} secondaryVisible={secondaryVisible} />
      ))}
    </div>
  )
}
