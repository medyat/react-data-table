// Hata / uyarı balonu (06 §5): ızgaranın kökünde tek düğüm, `position: fixed`. Hücrenin içindeyken gövde kabı (yatay
// kaydırma için `overflow: hidden`) onu ilk ve son satırda kırpıyordu.
import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { Issue } from '../core/sheet/validate'

const GAP = 6
/** Balon ile pencere kenarı arasında kalan en az boşluk. */
const EDGE = 8

export function CellTip({
  body,
  row,
  col,
  issue,
  suggest,
  onLeave,
}: {
  body: RefObject<HTMLElement | null>
  row: number
  col: number
  issue: Issue
  /** Yakın seçenek önerisinin düğmesi ("Adet kullan"). */
  suggest?: { label: string; apply: () => void }
  onLeave: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null)

  // Üstte pencerede yer varsa üstte, yoksa altta; kaydırınca hücreyle gider.
  useLayoutEffect(() => {
    const update = () => {
      const cell = body.current?.querySelector(`.dt-cell[data-row="${row}"][data-col="${col}"]`)
      const el = ref.current
      if (!cell || !el) return
      const r = cell.getBoundingClientRect()
      const above = r.top - GAP - el.offsetHeight
      setPlace({ left: r.left, top: above >= EDGE ? above : r.bottom + GAP })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [body, row, col, issue.message])

  return (
    <div
      ref={ref}
      className={`dt-cell-tip is-floating is-${issue.level}`}
      style={place ?? { visibility: 'hidden' }}
      aria-hidden="true"
      onMouseLeave={onLeave}
    >
      {issue.message}
      {suggest && (
        <button type="button" className="dt-cell-tip-btn" tabIndex={-1} onClick={suggest.apply}>
          {suggest.label}
        </button>
      )}
    </div>
  )
}
