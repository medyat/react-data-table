// Tek tooltip, delegasyonla (02 · Tooltip 400 ms): kesilmiş hücre metni ve `data-dt-tip` taşıyan öğeler.
// Hücre başına Base UI Tooltip örneği 500 satırda ağır olurdu; kökte tek dinleyici + tek DOM düğümü.
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

const DELAY = 400
/** Tooltip ile pencere kenarı arasında kalan en az boşluk. */
const EDGE = 8
/** Okun kutunun köşesine en çok bu kadar yaklaşması: yuvarlak köşenin üstüne binmez. */
const ARROW_EDGE = 12
/** Öğe ile kutu arası; okun ucu öğeye değmez. */
const GAP = 9

interface Tip {
  text: string
  left: number
  top: number
}

const overflows = (el: HTMLElement) => el.scrollWidth > el.clientWidth + 1
/** Metni içteki öğe de kesebilir (etiket, kişi adı, başlık metni, özel hücre); taşıp görünen öğe kesmez. */
const clips = (el: HTMLElement) => overflows(el) && getComputedStyle(el).overflowX !== 'visible'

export const tipOf = (target: Element | null): { el: HTMLElement; text: string } | null => {
  const tipped = target?.closest<HTMLElement>('[data-dt-tip]')
  if (tipped?.dataset.dtTip) return { el: tipped, text: tipped.dataset.dtTip }
  const content = target?.closest<HTMLElement>('.dt-cell-content, .dt-head-label, .dt-view-name')
  if (content && (overflows(content) || [...content.querySelectorAll<HTMLElement>('*')].some(clips)))
    // innerText sayfadaki satır düzenini korur (ad ve altındaki özet ayrı satır); textContent onları bitiştirirdi.
    // jsdom'da innerText yok.
    return { el: content, text: (content.innerText ?? content.textContent ?? '').trim() }
  return null
}

export function DelegatedTooltip({ root }: { root: RefObject<HTMLElement | null> }) {
  const [tip, setTip] = useState<Tip | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Ortalanır ama pencereden taşmaz. `left` + `translateX(-50%)` sağ kenardaki öğede (satır hatası) genişliği
  // kenara kalan boşlukla sınırlıyor, metin harf harf bölünüyordu; genişlik artık metinden gelir.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !tip) return
    const right = document.documentElement.clientWidth - EDGE - el.offsetWidth
    const left = Math.max(EDGE, Math.min(tip.left - el.offsetWidth / 2, right))
    el.style.left = `${left}px`
    // Ok kutunun ortasında değil, öğenin (ya da imlecin) hizasında: kutu kenara yaslanınca da doğru yeri gösterir.
    const arrow = Math.max(ARROW_EDGE, Math.min(tip.left - left, el.offsetWidth - ARROW_EDGE))
    el.style.setProperty('--dt-tip-arrow-x', `${arrow}px`)
  }, [tip])

  useEffect(() => {
    const el = root.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let anchor: HTMLElement | null = null

    const hide = () => {
      clearTimeout(timer)
      anchor = null
      setTip(null)
    }
    const show = (target: HTMLElement, text: string, x?: number) => {
      const r = target.getBoundingClientRect()
      // Geniş anchor'da (hatalı satır) imlecin altında, dar anchor'da ortada.
      const left = x !== undefined && r.width > 320 ? x : r.left + r.width / 2
      setTip({ text, left: Math.round(left), top: Math.round(r.bottom + GAP) })
    }
    const onOver = (e: MouseEvent) => {
      const hit = tipOf(e.target as Element)
      if (!hit || hit.el === anchor) return
      hide()
      anchor = hit.el
      timer = setTimeout(() => show(hit.el, hit.text, e.clientX), DELAY)
    }
    const onOut = (e: MouseEvent) => {
      if (anchor && !anchor.contains(e.relatedTarget as Node | null)) hide()
    }
    const onFocusin = (e: FocusEvent) => {
      const hit = tipOf(e.target as Element)
      if (!hit) return
      hide()
      anchor = hit.el
      show(hit.el, hit.text)
    }

    el.addEventListener('mouseover', onOver)
    el.addEventListener('mouseout', onOut)
    el.addEventListener('focusin', onFocusin)
    el.addEventListener('focusout', hide)
    el.addEventListener('scroll', hide, true)
    el.addEventListener('mousedown', hide)
    return () => {
      clearTimeout(timer)
      el.removeEventListener('mouseover', onOver)
      el.removeEventListener('mouseout', onOut)
      el.removeEventListener('focusin', onFocusin)
      el.removeEventListener('focusout', hide)
      el.removeEventListener('scroll', hide, true)
      el.removeEventListener('mousedown', hide)
    }
  }, [root])

  if (!tip) return null
  // position: fixed; kökün içinde kalır, yoğunluk ve font token'larını oradan alır.
  return (
    <div ref={ref} className="dt-tip" role="tooltip" style={{ top: tip.top }}>
      {/* Satır sınırı içteki kutuda: dıştaki kırpsaydı ok da kesilirdi. */}
      <div className="dt-tip-body">
        {tip.text.split('\n').map((line, i) => (
          <div key={i} className="dt-tip-line">
            {line}
          </div>
        ))}
      </div>
      <span className="dt-tip-arrow" aria-hidden="true" />
    </div>
  )
}
