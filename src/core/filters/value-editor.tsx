// Çipin değer editörü (04 §3): tipe ve operatöre göre seçenek, metin, sayı, yıldız ya da tarih. Masaüstünde çip popover'ında,
// telefonda Filters alt sayfasının değer seviyesinde (handoff 04 §6.2) aynı bileşen.
import { lazy, Suspense } from 'react'
import type { ColumnDef } from '../../types/columns'
import type { RemoteLabels } from '../cells/remote-labels'
import { NumberEditor } from '../editors/number-editor'
import { OptionsEditor } from '../editors/options-editor'
import { StarEditor } from '../editors/star-editor'
import { TextEditor } from '../editors/text-editor'
import { changeOperator, editorOf, type Chip } from './model'

// Takvim (react-day-picker) yalnızca tarih editörü açılınca yüklenir; çekirdek pakete girmez (R10).
const DateEditor = lazy(() => import('../editors/date-editor'))

export function ValueEditor({
  chip,
  column,
  rows,
  labels,
  currencies,
  onChange,
  onDone,
}: {
  chip: Chip
  column: ColumnDef
  rows: object[]
  labels: RemoteLabels
  currencies: string[]
  onChange: (chip: Chip) => void
  /** Enter / seçim bitti: popover kapanır, alt sayfada Filters'a dönülür. */
  onDone: () => void
}) {
  const type = column.type
  const setValue = (value: unknown) =>
    onChange({ ...chip, value, currency: type === 'currency' ? (chip.currency ?? currencies[0]) : chip.currency })
  switch (editorOf(chip.op, type)) {
    case 'options':
      return (
        <OptionsEditor
          column={column}
          op={chip.op}
          value={Array.isArray(chip.value) ? (chip.value as Array<string | number>) : []}
          rows={rows}
          labels={labels}
          onChange={setValue}
          // Kişi listesinde Unassigned `is_empty` ile değişimli: boş değer `in` listesinde taşınamaz.
          onUnassigned={() => onChange(changeOperator(chip, chip.op === 'is_empty' ? 'in' : 'is_empty', type))}
        />
      )
    case 'text':
      return <TextEditor column={column} op={chip.op} value={chip.value} onChange={setValue} onDone={onDone} />
    case 'number':
      return (
        <NumberEditor
          column={column}
          op={chip.op}
          value={chip.value}
          currency={chip.currency}
          currencies={currencies}
          onChange={setValue}
          onCurrency={(currency) => onChange({ ...chip, currency })}
          onDone={onDone}
        />
      )
    case 'star':
      return <StarEditor column={column} value={chip.value} onChange={setValue} onDone={onDone} />
    case 'date':
      return (
        <Suspense fallback={null}>
          <DateEditor
            op={chip.op}
            value={chip.value}
            onChange={(value, op) => (op ? onChange({ ...chip, op, value }) : setValue(value))}
            onDone={onDone}
          />
        </Suspense>
      )
    default:
      return null
  }
}
