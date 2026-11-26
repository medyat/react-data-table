// Sürükleyerek seçim (Excel gibi): imleç görünen alanın kenarına yaklaşınca ya da dışına çıkınca ızgara o yöne kayar,
// hız kenarı ne kadar geçtiğiyle artar. İmleç dursa da seçim kayan içerikte altındaki hücreye uzar: tarayıcı imleç
// kıpırdamadıkça `pointerover` göndermez. Dikey kayma en yakın kayan atadadır (use-page-rows), yatay gövdede.
import { scrollParent } from './use-page-rows'

/** Kenar bölgesi (px) ve kare başına en hızlı adım. */
const EDGE = 40
const MAX_STEP = 40

const step = (d: number) => Math.sign(d) * Math.min(MAX_STEP, Math.ceil(Math.abs(d) / 3))

export interface DragScrollOptions {
  body: HTMLElement
  /** Görünen alanı örten parçalar: yapışkan başlık, alt çubuk, sabit sütunlar. */
  insets: () => { top: number; bottom: number; start: number; end: number }
  scrollX: (x: number) => void
  /** İmlecin (sınırlanmış) noktasındaki hücreye seçimi uzatır. */
  extend: (x: number, y: number) => void
  /** Bırakınca (doldurma tutamacı burada uygular). */
  onEnd?: () => void
}

/** Bırakılana kadar sürer; durdurucuyu döner. */
export function startDragScroll(o: DragScrollOptions): () => void {
  const parent = scrollParent(o.body)
  let x = -1
  let y = -1
  let frame = 0
  let done = false
  const tick = () => {
    frame = requestAnimationFrame(tick)
    const box = o.body.getBoundingClientRect()
    const view = parent === window ? { top: 0, bottom: innerHeight } : (parent as HTMLElement).getBoundingClientRect()
    const pad = o.insets()
    const top = Math.max(box.top, view.top + pad.top)
    const bottom = Math.min(box.bottom, view.bottom - pad.bottom)
    const left = box.left + pad.start
    const right = box.right - pad.end
    // Satırların o kenarı zaten görünüyorsa sayfa kaymaz: ızgaranın üstündeki alanlar seçimle ilgisiz.
    const above = box.top < top
    const below = box.bottom > bottom
    const dy = above && y < top + EDGE ? y - top - EDGE : below && y > bottom - EDGE ? y - bottom + EDGE : 0
    const dx = x < left + EDGE ? x - left - EDGE : x > right - EDGE ? x - right + EDGE : 0
    if (dy) parent.scrollBy(0, step(dy))
    if (dx) o.scrollX(o.body.scrollLeft + step(dx))
    o.extend(Math.min(Math.max(x, box.left + 1), right - 1), Math.min(Math.max(y, top + 1), bottom - 1))
  }
  // Döngü ilk harekette başlar. Tuş pencerenin dışında bırakılırsa `pointerup` gelmeyebilir: tuşsuz hareket ya da
  // odak kaybı da bitirir, yoksa sayfa durmadan kayardı.
  const move = (e: PointerEvent) => {
    if (!(e.buttons & 1)) return stop()
    x = e.clientX
    y = e.clientY
    frame ||= requestAnimationFrame(tick)
  }
  const stop = () => {
    if (done) return
    done = true
    cancelAnimationFrame(frame)
    removeEventListener('pointermove', move)
    removeEventListener('pointerup', stop)
    removeEventListener('pointercancel', stop)
    removeEventListener('blur', stop)
    o.onEnd?.()
  }
  addEventListener('pointermove', move)
  addEventListener('pointerup', stop)
  addEventListener('pointercancel', stop)
  addEventListener('blur', stop)
  return stop
}
