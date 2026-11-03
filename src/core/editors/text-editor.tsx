// Metin editörü (04 §3): 250 ms sonra ve Enter'da uygular; Enter popover'ı kapatır. `id` sütununda `in`/`not_in` için
// yapıştırılan liste (satır sonu / virgül / noktalı virgül) değer dizisine ayrılır (03); uppercase/lowercase çevirir.
import { useState } from 'react'
import type { ColumnDef } from '../../types/columns'
import type { FilterOp } from '../../types/query'
import { useDelay } from '../interaction/use-delay'

type Value = string | Array<string | number>
const asText = (v: unknown) => (Array.isArray(v) ? v.join(', ') : typeof v === 'string' ? v : '')

export function TextEditor({
  column,
  op,
  value,
  onChange,
  onDone,
}: {
  column: ColumnDef
  op: FilterOp
  value: unknown
  onChange: (value: Value) => void
  onDone: () => void
}) {
  const normalize = (s: string) =>
    column.type === 'uppercase' ? s.toLocaleUpperCase() : column.type === 'lowercase' ? s.toLocaleLowerCase() : s
  const parse = (text: string): Value => {
    const s = normalize(text).trim()
    if (op !== 'in' && op !== 'not_in') return s
    return s
      .split(/[\n,;]+/)
      .map((p) => p.trim())
      .filter(Boolean)
  }
  const [draft, setDraft] = useState(() => asText(value))
  // Dışarıdan gelen değer (Clear, operatör değişimi) taslağa yazılır; uygulanmış biçimi aynıysa taslak korunur, yazılan
  // sondaki boşluk silinmez.
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    if (JSON.stringify(parse(draft)) !== JSON.stringify(value ?? '')) setDraft(asText(value))
  }
  const delay = useDelay(250)

  return (
    <label className="dt-input dt-editor-text">
      <input
        autoFocus
        value={draft}
        type="text"
        autoComplete="off"
        onChange={(e) => {
          const text = normalize(e.target.value)
          setDraft(text)
          delay.run(() => onChange(parse(text)))
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          delay.cancel()
          onChange(parse(draft))
          onDone()
        }}
      />
    </label>
  )
}
