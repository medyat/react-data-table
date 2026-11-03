// Filtre çipi (04 §3, handoff 02 §5): `[ikon] Alan · operatör · değer │ ×`, iki tıklama hedefi. Gövde değer popover'ını
// açar (üstte operatör menüsü, tipe göre editör, altta durum + Clear); `boolean`'da popover yok, tıklama Yes ↔ No.
import { Popover } from '@base-ui/react/popover'
import { CaretDownIcon, CheckIcon, XIcon } from '@phosphor-icons/react'
import { Fragment, useRef } from 'react'
import type { ColumnDef } from '../../types/columns'
import { ME, type FilterOp } from '../../types/query'
import { Avatar } from '../cells/render-cell'
import type { RemoteLabels } from '../cells/remote-labels'
import { useDataTableContext } from '../provider'
import { DtMenu, DtMenuItem, DtMenuSeparator } from '../ui/menu'
import { changeOperator, editorOf, isComplete, opLabel, operatorsOf, shapeOf, type Chip, type Summary } from './model'
import { TYPE_ICONS } from './type-icons'
import { ValueEditor } from './value-editor'

export function FilterChip({
  chip,
  column,
  editing,
  summary,
  rows,
  labels,
  currencies,
  onChange,
  onEditing,
  onRemove,
  onOpen,
}: {
  chip: Chip
  column: ColumnDef
  editing: boolean
  summary: Summary
  rows: object[]
  labels: RemoteLabels
  currencies: string[]
  onChange: (chip: Chip) => void
  onEditing: (open: boolean) => void
  onRemove: () => void
  /** Telefon çipi (handoff 04 §3): operatör ve × yok; tamamı tek düğme, Filters alt sayfasını açar. */
  onOpen?: () => void
}) {
  const { i18n } = useDataTableContext()
  const type = column.type
  const Icon = TYPE_ICONS[type]
  const shape = shapeOf(chip.op, type)
  const complete = isComplete(chip, type)
  const count = Array.isArray(chip.value) ? chip.value.length : 1
  const opText = opLabel(i18n, chip.op, type, count)
  const tip = summary.full && summary.full !== summary.text ? summary.full : undefined
  const aria = complete
    ? i18n.t('filter.valueAria', { column: column.header, op: opText, value: summary.text })
    : i18n.t('filter.chooseValueAria', { column: column.header })
  const editor = editorOf(chip.op, type)
  const status =
    editor === 'options' && Array.isArray(chip.value) && chip.value.length
      ? i18n.t('option.selected', { count: chip.value.length })
      : shape === 'range'
        ? i18n.t('number.boundsIncluded')
        : ''

  const update = (patch: Partial<Chip>) => onChange({ ...chip, ...patch })
  const setOp = (op: FilterOp) => onChange(changeOperator(chip, op, type))
  const close = () => onEditing(false)
  // Açılınca odak editörün ilk alanına (08 §2 · Popover); Base UI varsayılanı üstteki operatör düğmesini seçerdi.
  const body = useRef<HTMLDivElement>(null)
  // Kapanınca odak çip gövdesine (Esc, Enter): editör seçiciden açıldıysa "önceki odak" artık yok. Fareyle dışarı
  // tıklanınca odak tıklanan yerde kalır.
  const trigger = useRef<HTMLButtonElement>(null)

  const head = (
    <>
      <Icon size={14} className="dt-chip-icon" aria-hidden="true" />
      <span className="dt-chip-field">{column.header}</span>
      <span className="dt-chip-op">{opText}</span>
    </>
  )
  const people = complete ? (summary.people?.slice(0, 3) ?? []) : []

  const content = editor && (
    <ValueEditor
      chip={chip}
      column={column}
      rows={rows}
      labels={labels}
      currencies={currencies}
      onChange={onChange}
      onDone={close}
    />
  )

  const cls = ['dt-chip', editing && 'is-editing', !complete && 'is-incomplete', onOpen && 'is-phone']
  return (
    <span className={cls.filter(Boolean).join(' ')} data-col={chip.column}>
      {onOpen ? (
        <button
          type="button"
          className="dt-chip-body"
          aria-label={i18n.t('mobile.chipAria', { summary: `${column.header} ${opText} ${summary.text}`.trim() })}
          onClick={onOpen}
        >
          <Icon size={14} className="dt-chip-icon" aria-hidden="true" />
          <span className="dt-chip-field">{column.header}</span>
          <span className="dt-chip-value">{summary.text}</span>
        </button>
      ) : type === 'boolean' ? (
        <button
          type="button"
          className="dt-chip-body"
          aria-label={aria}
          onClick={() => update({ value: chip.value !== true })}
        >
          {head}
          <span className="dt-chip-value">{summary.text}</span>
        </button>
      ) : (
        <Popover.Root open={editing} onOpenChange={(o) => onEditing(o)}>
          <Popover.Trigger ref={trigger} className="dt-chip-body" aria-label={aria}>
            {head}
            {shape !== 'none' && (
              <span className={complete ? 'dt-chip-value' : 'dt-chip-value is-placeholder'} data-dt-tip={tip}>
                {people.length > 0 && (
                  <span className="dt-chip-avatars">
                    {people.map((p) => (
                      <Avatar key={String(p.value)} user={p} />
                    ))}
                  </span>
                )}
                {complete ? summary.text : i18n.t('filter.selectValue')}
              </span>
            )}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner className="dt-positioner" align="start" sideOffset={4}>
              <Popover.Popup
                className={`dt-pop dt-chip-pop is-${editor ?? 'none'}`}
                initialFocus={() => body.current?.querySelector<HTMLElement>('input, textarea') ?? true}
                finalFocus={(type) =>
                  type === 'mouse' || type === 'touch' || type === 'pen' ? false : trigger.current
                }
              >
                <div className="dt-chip-pop-head">
                  <span className="dt-chip-pop-field">{column.header}</span>
                  <DtMenu
                    align="start"
                    className="dt-op-menu"
                    trigger={
                      <button type="button" className="dt-op-btn">
                        {opText}
                        <CaretDownIcon size={12} aria-hidden="true" />
                      </button>
                    }
                  >
                    {type === 'user' && (
                      // "is me" operatör değil, kısayol: `in ['@me']` kurar (03).
                      <DtMenuItem onSelect={() => onChange({ ...chip, op: 'in', value: [ME] })}>
                        {i18n.t('op.isMe')}
                      </DtMenuItem>
                    )}
                    {operatorsOf(column).map((op) => (
                      <Fragment key={op}>
                        {op === 'is_empty' && <DtMenuSeparator />}
                        <DtMenuItem selected={op === chip.op} onSelect={() => setOp(op)}>
                          {opLabel(i18n, op, type, count)}
                          {op === chip.op && <CheckIcon size={14} className="dt-pop-end" aria-hidden="true" />}
                        </DtMenuItem>
                      </Fragment>
                    ))}
                  </DtMenu>
                </div>
                {content && (
                  <div ref={body} className="dt-chip-pop-body">
                    {content}
                  </div>
                )}
                <div className="dt-pop-foot">
                  <span>{status}</span>
                  <button
                    type="button"
                    className="dt-pop-action"
                    disabled={chip.value === undefined}
                    onClick={() => update({ value: undefined })}
                  >
                    {i18n.t('common.clear')}
                  </button>
                </div>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      )}
      {!onOpen && (
        <button
          type="button"
          className="dt-chip-remove"
          aria-label={i18n.t('filter.removeAria', { column: column.header })}
          onClick={onRemove}
        >
          <XIcon size={12} aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
