// Sayı editörü (04 §3, T2-05): tek değer ya da Min / Max ("and"); 250 ms sonra ve Enter'da uygular; `currency` sütununda
// para birimi segmented (değer düz sayı, para birimi ayrı alan); percentage `%` son eki; yerel ayara göre okunur.
import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { useState, type KeyboardEvent } from 'react'
import type { ColumnDef } from '../../types/columns'
import type { FilterOp } from '../../types/query'
import { parseNumber } from '../format/parse'
import { useDelay } from '../interaction/use-delay'
import { useDataTableContext } from '../provider'

type Value = number | [number | null, number | null] | undefined

export function NumberEditor({
  column,
  op,
  value,
  currency,
  currencies,
  onChange,
  onCurrency,
  onDone,
}: {
  column: ColumnDef
  op: FilterOp
  value: unknown
  currency?: string
  /** `currency` sütunu: seçilebilir kodlar (sabit kod veya yüklü satırlardan). */
  currencies: string[]
  onChange: (value: Value) => void
  onCurrency: (code: string) => void
  onDone: () => void
}) {
  const { i18n, locale } = useDataTableContext()
  const range = op === 'between'
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 6 })
  const show = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? nf.format(n) : '')
  const fromValue = (v: unknown): [string, string] =>
    range ? [show(Array.isArray(v) ? v[0] : undefined), show(Array.isArray(v) ? v[1] : undefined)] : [show(v), '']
  const [[a, b], setDraft] = useState(() => fromValue(value))
  // Dışarıdan gelen değer yalnızca sayı olarak farklıysa taslağa yazılır: "1.000," yazarken biçim bozulmaz.
  const [seen, setSeen] = useState({ value, op })
  if (seen.value !== value || seen.op !== op) {
    setSeen({ value, op })
    const [x, y] = fromValue(value)
    const same = (p: string, q: string) => parseNumber(locale, p) === parseNumber(locale, q)
    if (!same(a, x) || !same(b, y)) setDraft([same(a, x) ? a : x, same(b, y) ? b : y])
  }
  const delay = useDelay(250)
  const commit = (min: string, max: string) => {
    const lo = parseNumber(locale, min)
    if (!range) return onChange(lo ?? undefined)
    const hi = parseNumber(locale, max)
    onChange(lo === null && hi === null ? undefined : [lo, hi])
  }
  const set = (next: [string, string]) => {
    setDraft(next)
    delay.run(() => commit(...next))
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    delay.cancel()
    commit(a, b)
    onDone()
  }
  const suffix = column.type === 'percentage' ? '%' : ''
  const field = (text: string, onText: (t: string) => void, first = false) => (
    <span className={suffix ? 'dt-input has-suffix' : 'dt-input'}>
      <input
        autoFocus={first}
        value={text}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        onChange={(e) => onText(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {suffix && <span className="dt-input-end dt-input-suffix">{suffix}</span>}
    </span>
  )

  return (
    <div className="dt-editor-number">
      {currencies.length > 1 && (
        <ToggleGroup
          className="dt-seg dt-seg-xs"
          value={currency ? [currency] : []}
          onValueChange={(v) => v[0] && onCurrency(String(v[0]))}
        >
          {currencies.map((c) => (
            <Toggle key={c} className="dt-seg-item" value={c} data-state={c === currency ? 'on' : 'off'}>
              {c}
            </Toggle>
          ))}
        </ToggleGroup>
      )}
      <div className="dt-editor-fields">
        <label className="dt-editor-field">
          {range && <span className="dt-editor-label">{i18n.t('number.min')}</span>}
          {field(a, (t) => set([t, b]), true)}
        </label>
        {range && (
          <>
            <span className="dt-editor-and">{i18n.t('number.and')}</span>
            <label className="dt-editor-field">
              <span className="dt-editor-label">{i18n.t('number.max')}</span>
              {field(b, (t) => set([a, t]))}
            </label>
          </>
        )}
      </div>
    </div>
  )
}
