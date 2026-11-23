// Yatay kaydırma (form-grid.md §4): başlık sayfaya yapışırken kendi kabında olmalı, bu yüzden başlık ve gövde ayrı
// kaplardır (`overflow: hidden`), yatay konum ikisinde eşitlenir. Gövdenin çubuğu yok; yerine alt çubuğun hemen
// üstünde her zaman görünen, yalnız kayan bölümü (sabit sütunların arasını) kaplayan bir çubuk çizilir.
import { useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'

interface Metrics {
  /** Kayan bölümün görünen ve toplam genişliği (sabit sütunlar hariç). */
  view: number
  content: number
  left: number
  /** Sabit sütunların genişliği: çubuk yalnız kayan bölümün altında. */
  start: number
  end: number
}

// DOM'a yazma kancanın dışında: derleyici kanca argümanının (ref listesi) değiştirildiğini sanmasın.
const setLeft = (panes: Array<RefObject<HTMLElement | null>>, left: number) => {
  for (const p of panes) {
    const el = p.current
    if (el && el.scrollLeft !== left) el.scrollLeft = left
  }
}

/** Kapların `scrollLeft`'ini eşitler; trackpad ve ⇧ tekerleğiyle yatay kaydırmayı gövdede kendisi yapar. */
export function useHorizontalScroll(
  panes: Array<RefObject<HTMLElement | null>>,
  pinned: () => { start: number; end: number },
) {
  const [m, setM] = useState<Metrics>({ view: 0, content: 0, left: 0, start: 0, end: 0 })
  const scrollTo = (x: number) => {
    const body = panes[0]!.current
    if (!body) return
    const max = body.scrollWidth - body.clientWidth
    const left = Math.max(0, Math.min(max, Math.round(x)))
    setLeft(panes, left)
  }
  useLayoutEffect(() => {
    const body = panes[0]!.current
    if (!body) return
    const update = () => {
      // Odaklanan hücreyi tarayıcı gövdede görünür kılar: öbür kaplar ona uyar.
      const left = body.scrollLeft
      setLeft(panes.slice(1), left)
      const pin = pinned()
      const next = {
        view: body.clientWidth - pin.start - pin.end,
        content: body.scrollWidth - pin.start - pin.end,
        left,
        start: pin.start,
        end: pin.end,
      }
      setM((p) => ((Object.keys(next) as Array<keyof Metrics>).every((k) => p[k] === next[k]) ? p : next))
    }
    update()
    const onWheel = (e: WheelEvent) => {
      const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX
      if (!dx || Math.abs(dx) < Math.abs(e.shiftKey ? 0 : e.deltaY)) return
      const max = body.scrollWidth - body.clientWidth
      if (max <= 0) return
      // Kenarda tarayıcının geri/ileri hareketi tetiklenmesin.
      e.preventDefault()
      scrollTo(body.scrollLeft + dx)
    }
    body.addEventListener('scroll', update, { passive: true })
    body.addEventListener('wheel', onWheel, { passive: false })
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    ro?.observe(body)
    if (body.firstElementChild) ro?.observe(body.firstElementChild)
    return () => {
      body.removeEventListener('scroll', update)
      body.removeEventListener('wheel', onWheel)
      ro?.disconnect()
    }
    // Kaplar bileşenin ömrü boyunca aynı ref'ler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return { metrics: m, scrollTo, scrolled: { start: m.left > 0, end: m.left < m.content - m.view - 1 } }
}

/** Her zaman görünen çubuk: tutamak sürüklenir, oluk tıklanınca bir görünen genişlik kayar. */
export function ScrollBar({ metrics, onScroll }: { metrics: Metrics; onScroll: (left: number) => void }) {
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number } | null>(null)
  const { view, content, left, start, end } = metrics
  const overflow = content > view + 1
  const ratio = overflow ? view / content : 1
  const thumbW = Math.max(32, view * ratio)
  const room = view - thumbW
  const thumbX = overflow && room > 0 ? (left / (content - view)) * room : 0
  const toLeft = (x: number) => (room > 0 ? (x / room) * (content - view) : 0)
  return (
    <div className="dt-hbar" style={{ paddingLeft: start, paddingRight: end }} aria-hidden="true">
      <div
        ref={track}
        className={overflow ? 'dt-hbar-track' : 'dt-hbar-track is-idle'}
        onPointerDown={(e) => {
          if (e.target !== track.current || !overflow) return
          const x = e.clientX - track.current.getBoundingClientRect().left
          onScroll(left + (x < thumbX ? -view : view))
        }}
      >
        {overflow && (
          <div
            className="dt-hbar-thumb"
            style={{ width: thumbW, transform: `translateX(${thumbX}px)` }}
            onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              drag.current = { x: e.clientX, left: thumbX }
            }}
            onPointerMove={(e) => {
              if (drag.current) onScroll(toLeft(drag.current.left + e.clientX - drag.current.x))
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          />
        )}
      </div>
    </div>
  )
}
