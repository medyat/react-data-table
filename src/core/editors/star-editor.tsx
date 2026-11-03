// Puan editörü (03): 1–max yıldız; tıklanınca uygulanır ve popover kapanır.
import { StarIcon } from '@phosphor-icons/react'
import type { ColumnDef } from '../../types/columns'

export function StarEditor({
  column,
  value,
  onChange,
  onDone,
}: {
  column: ColumnDef
  value: unknown
  onChange: (value: number) => void
  onDone: () => void
}) {
  const max = (column as { max?: number }).max ?? 5
  const on = (n: number) => typeof value === 'number' && n <= value
  return (
    <div className="dt-editor-stars" role="radiogroup">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          className={on(n) ? 'dt-star-btn is-on' : 'dt-star-btn'}
          role="radio"
          aria-checked={value === n}
          aria-label={String(n)}
          onClick={() => {
            onChange(n)
            onDone()
          }}
        >
          <StarIcon size={18} weight={on(n) ? 'fill' : 'regular'} aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
