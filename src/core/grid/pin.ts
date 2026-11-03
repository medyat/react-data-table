import type { CSSProperties } from 'react'
import type { LayoutColumn } from '../columns/use-column-layout'

/** Sabit hücrenin sticky ofseti: değer kökteki `--dt-off-…` değişkeninde, resize'da React dışında yazılır. */
export const pinStyle = <Row extends object>(col: LayoutColumn<Row>): CSSProperties | undefined =>
  col.pinned === 'start'
    ? { left: `var(${col.offsetVar})` }
    : col.pinned === 'end'
      ? { right: `var(${col.offsetVar})` }
      : undefined

export const pinClasses = <Row extends object>(col: LayoutColumn<Row>): string[] =>
  [
    col.pinned === 'start' && 'is-pinned-start',
    col.pinned === 'end' && 'is-pinned-end',
    col.pinEdge && 'is-pin-edge',
  ].filter((c): c is string => !!c)

/** Orta ile sağ sabit sütunlar arasındaki `auto` dolgu track'i (use-column-layout `cols()`) için bölme noktası. */
export const fillIndex = <Row extends object>(columns: Array<LayoutColumn<Row>>): number => {
  const at = columns.findIndex((c) => c.pinned === 'end')
  return at < 0 ? columns.length : at
}
