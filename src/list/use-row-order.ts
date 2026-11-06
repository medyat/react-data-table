// Satır sıralamanın iyimser gösterimi (R21): bırakınca yeni sıra hemen çizilir, uygulamaya komşularıyla taşıma bildirilir.
// Gösterilen sıra, gelen satırların sırası değişene (yenilenen sonuç) kadar burada kalır; Promise reddedilirse eski sıraya döner.
import { useRef, useState } from 'react'
import type { RowMove } from '../types/list'

const SEP = '\u0000'

export function useRowOrder<Row>(
  rows: Row[],
  rowId: (row: Row) => string,
  onMove: ((move: RowMove<Row>) => void | Promise<unknown>) | undefined,
) {
  // `base`: taşımanın yapıldığı satır sırası. Gelen satırlar artık o sırada değilse sunucunun sırası geçerlidir.
  const [moved, setMoved] = useState<{ base: string; ids: string[] } | null>(null)
  const [pending, setPending] = useState(false)
  // Yalnızca son taşımanın sonucu sırayı geri alabilir.
  const last = useRef(0)

  const keys = rows.map(rowId)
  const byId = new Map(rows.map((r, i) => [keys[i]!, r]))
  const shown = moved && moved.base === keys.join(SEP) ? moved.ids.map((id) => byId.get(id)!) : rows

  const move = (from: number, to: number) => {
    if (!onMove || from === to) return
    const next = [...shown]
    const [row] = next.splice(from, 1)
    next.splice(to, 0, row!)
    const token = ++last.current
    setMoved({ base: keys.join(SEP), ids: next.map(rowId) })
    const result = onMove({ row: row!, after: next[to - 1] ?? null, before: next[to + 1] ?? null })
    if (!(result instanceof Promise)) return
    setPending(true)
    result.then(
      () => {
        if (token === last.current) setPending(false)
      },
      () => {
        if (token !== last.current) return
        setPending(false)
        setMoved(null)
      },
    )
  }

  return { rows: shown, move, pending }
}
