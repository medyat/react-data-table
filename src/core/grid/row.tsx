// Satır + hücreler. Kabuk burada: hizalama, kesme, sabit sütun sticky'si, --dt-row-bg, ikinci satır, aksiyon overlay'i (05 §4, 03);
// seçim hücresi (40 px, sol sabit), birincil hücrede expand chevron'u, sağ sabit ⋯ hücresi ve inline aksiyonlar (05 §6–7, D28, D36).
import { CaretRightIcon } from '@phosphor-icons/react'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import type { RowAction } from '../../types/list'
import { CellActions } from '../cells/cell-actions'
import { cellFillStyle, renderCellContent, type RenderEnv } from '../cells/render-cell'
import { alignOf, isNumericType } from '../cells/specs'
import type { LayoutColumn } from '../columns/use-column-layout'
import { readPath } from '../columns/read-path'
import { inlineActionsOf } from './inline-actions'
import { fillIndex, pinClasses, pinStyle } from './pin'
import { RowMenu } from './row-menu'

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

/** Birincil hücredeki chevron (05 §7): `canExpand` değilse aynı genişlikte boşluk (hizalama). */
interface Expand {
  can: boolean
  open: boolean
  controls: string
  label: string
  onToggle: () => void
}

function Cell<Row extends object>({
  col,
  row,
  env,
  secondaryVisible,
  expand,
}: {
  col: LayoutColumn<Row>
  row: Row
  env: RenderEnv
  secondaryVisible: boolean
  expand?: Expand
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
    expand && 'has-expand',
    ...pinClasses(col),
  ]
  const style: CSSProperties = { ...pinStyle(col), ...cellFillStyle(def, value) }
  const main = (
    <>
      <span className="dt-cell-content">{content}</span>
      {secondaryVisible && def.secondary && <span className="dt-secondary">{def.secondary(row) ?? ''}</span>}
    </>
  )
  return (
    <div className={cls.filter(Boolean).join(' ')} style={style} role="cell" data-col={col.id}>
      {expand ? (
        <>
          {expand.can ? (
            <button
              type="button"
              className={expand.open ? 'dt-expand is-open' : 'dt-expand'}
              aria-expanded={expand.open}
              aria-controls={expand.controls}
              aria-label={env.i18n.t('expand.showAria', { id: expand.label })}
              onClick={expand.onToggle}
            >
              <CaretRightIcon size={14} aria-hidden="true" />
            </button>
          ) : (
            <span className="dt-expand-space" aria-hidden="true" />
          )}
          <span className="dt-cell-main">{main}</span>
        </>
      ) : (
        main
      )}
      {def.actions?.length ? <CellActions actions={def.actions} row={row} /> : null}
    </div>
  )
}

/** Inline satır aksiyonu (D36): ⋯ ile aynı 28 px düğme; label aria'da, açıklama tooltip'te ve gizli span'da. */
function InlineAction<Row extends object>({ action: a, row, uid }: { action: RowAction<Row>; row: Row; uid: string }) {
  const Icon = a.icon!
  const d = a.disabled?.(row)
  const reason = typeof d === 'string' ? d : null
  const descId = a.description ? `${uid}-${a.id}` : undefined
  return (
    <span className="dt-row-inline-wrap">
      <button
        type="button"
        className="dt-row-inline"
        disabled={!!d}
        aria-label={a.label}
        aria-describedby={descId}
        data-dt-tip={reason ?? (a.description ? `${a.label} — ${a.description}` : a.label)}
        onClick={() => void a.run(row)}
      >
        <Icon size={16} aria-hidden="true" />
      </button>
      {descId && (
        <span id={descId} className="dt-sr-only">
          {a.description}
        </span>
      )}
    </span>
  )
}

/** Satırın seçim, expand ve menü bağlamı; ızgara verir. */
export interface RowExtras<Row extends object> {
  /** Birincil hücre metni: aria etiketleri ve Copy. */
  label: string
  /** Satıra özgü id öneki: alt satır ve inline açıklamaları. */
  uid: string
  select?: { selected: boolean; edge: boolean; onChange: (value: boolean, shift: boolean) => void }
  expand?: Omit<Expand, 'label'>
  menu?: {
    edge: boolean
    actions: Array<RowAction<Row>>
    href?: string
    primaryHeader?: string
    onOpen: (event: MouseEvent) => void
    onCopy: () => void
  }
}

export function Row<Row extends object>({
  row,
  index,
  rowIndex,
  columns,
  env,
  extras,
}: {
  row: Row
  index: number
  /** aria-rowindex: header 1, ilk satır 2. */
  rowIndex: number
  columns: Array<LayoutColumn<Row>>
  env: RenderEnv
  extras?: RowExtras<Row>
}) {
  // Comfortable: `secondary` görünür (02 · Yoğunluk).
  const secondaryVisible = env.density === 'comfortable'
  const sel = extras?.select
  const menu = extras?.menu
  const expand = extras?.expand && { ...extras.expand, label: extras.label }
  const cls = ['dt-row', sel?.selected && 'is-selected', expand?.open && 'is-expanded']
  return (
    <div className={cls.filter(Boolean).join(' ')} role="row" aria-rowindex={rowIndex} data-index={index}>
      {sel && (
        // 40 px'in tamamı tıklanır; ⇧ aralığı ızgarada.
        <label
          className={
            sel.edge ? 'dt-cell dt-cell-select is-pinned-start is-pin-edge' : 'dt-cell dt-cell-select is-pinned-start'
          }
          style={{ left: 0 }}
          role="cell"
        >
          <input
            type="checkbox"
            className="dt-checkbox dt-select-box"
            checked={sel.selected}
            aria-label={env.i18n.t('row.selectAria', { id: extras.label })}
            onChange={(e) => sel.onChange(e.target.checked, (e.nativeEvent as globalThis.MouseEvent).shiftKey === true)}
          />
        </label>
      )}
      {withFill(columns, (col) => (
        <Cell
          key={col.id}
          col={col}
          row={row}
          env={env}
          secondaryVisible={secondaryVisible}
          expand={col.def.primary ? expand : undefined}
        />
      ))}
      {menu && (
        <div
          className={
            menu.edge ? 'dt-cell dt-cell-menu is-pinned-end is-pin-edge' : 'dt-cell dt-cell-menu is-pinned-end'
          }
          style={{ right: 0 }}
          role="cell"
        >
          {inlineActionsOf(menu.actions, row).map((a) => (
            <InlineAction key={a.id} action={a} row={row} uid={extras.uid} />
          ))}
          <RowMenu
            row={row}
            label={extras.label}
            primaryHeader={menu.primaryHeader}
            href={menu.href}
            actions={menu.actions}
            onOpen={menu.onOpen}
            onCopy={menu.onCopy}
          />
        </div>
      )}
    </div>
  )
}
