'use no memo'
// R11: Virtualizer örneği kendini değiştirerek çalışır; dosya derleyicinin dışındadır (use-virtual-rows ile aynı).
// FormGrid kendi içinde dikey kaymaz (form-grid.md §4): satırlar en yakın kayan atayla (Sheet gövdesi, sayfa ya da
// pencere) kayar. Sanal pencere o atanın görünür alanından ve ızgaranın içindeki konumundan (`scrollMargin`) hesaplanır.
import {
  elementScroll,
  observeElementOffset,
  observeElementRect,
  observeWindowOffset,
  observeWindowRect,
  useVirtualizer,
  windowScroll,
  type Range,
} from '@tanstack/react-virtual'
import { useLayoutEffect, useState, type RefObject } from 'react'

/** Dikey kayan en yakın ata; yoksa pencere. */
export function scrollParent(el: HTMLElement | null): HTMLElement | Window {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const y = getComputedStyle(p).overflowY
    if ((y === 'auto' || y === 'scroll' || y === 'overlay') && p !== document.body && p !== document.documentElement)
      return p
  }
  return window
}

// `instanceof Window` başka belgede (jsdom, iframe) tutmaz.
const isWindow = (p: HTMLElement | Window | null): p is Window => p === window

const offsetIn = (el: HTMLElement, parent: HTMLElement | Window): number =>
  isWindow(parent)
    ? el.getBoundingClientRect().top + window.scrollY
    : el.getBoundingClientRect().top - parent.getBoundingClientRect().top + parent.scrollTop

export interface PageRowsOptions {
  count: number
  /** Satırların kabı (gövde): sanal konumlar onun tepesinden ölçülür. */
  bodyRef: RefObject<HTMLElement | null>
  itemHeight: number
  /** Kayan atanın üstünü örten yapışkan başlık ve altını örten alt çubuk. */
  headHeight: number
  footHeight: number
  /** Aktif satır: görünür alanın dışında da çizilir (odak kaybolmaz). */
  keepIndex: () => number
  /** Satırlar içerik kadar uzar (R41): çizilen satır ölçülür, çizilmeyen `itemHeight` sayılır. */
  measure?: boolean
}

export function usePageRows(o: PageRowsOptions) {
  const [parent, setParent] = useState<HTMLElement | Window | null>(null)
  const [margin, setMargin] = useState(0)
  useLayoutEffect(() => {
    const body = o.bodyRef.current
    if (!body) return
    const p = scrollParent(body)
    setParent(p)
    // Izgaranın üstündeki form alanları boy değiştirebilir: kap boyunda ve pencere boyunda yeniden ölçülür.
    const measure = () => setMargin(Math.round(offsetIn(body, p)))
    measure()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    ro?.observe(isWindow(p) ? document.body : (p.firstElementChild ?? p))
    addEventListener('resize', measure)
    return () => {
      ro?.disconnect()
      removeEventListener('resize', measure)
    }
  }, [o.bodyRef])

  const win = isWindow(parent)
  // eslint-disable-next-line react-hooks/incompatible-library -- dosya derleyicinin dışında ("use no memo")
  const v = useVirtualizer<Element, Element>({
    count: o.count,
    getScrollElement: () => (parent ?? null) as Element | null,
    // Pencere için TanStack'in pencere gözlemcileri; tip ayrımı yalnız derleme zamanında.
    ...((win
      ? { observeElementRect: observeWindowRect, observeElementOffset: observeWindowOffset, scrollToFn: windowScroll }
      : { observeElementRect, observeElementOffset, scrollToFn: elementScroll }) as object),
    estimateSize: () => o.itemHeight,
    scrollMargin: margin,
    scrollPaddingStart: o.headHeight,
    scrollPaddingEnd: o.footHeight,
    overscan: 10,
    initialRect: { width: 0, height: 800 },
    rangeExtractor: (range: Range) => {
      const start = Math.max(0, range.startIndex - range.overscan)
      const end = Math.min(range.count - 1, range.endIndex + range.overscan)
      const out: number[] = []
      const f = o.keepIndex()
      if (f >= 0 && f < start && f < range.count) out.push(f)
      for (let i = start; i <= end; i++) out.push(i)
      if (f > end && f < range.count) out.push(f)
      return out
    },
  })
  useLayoutEffect(() => v.measure(), [v, o.itemHeight])
  return {
    items: v.getVirtualItems().map((i) => ({ index: i.index, start: i.start - margin })),
    total: v.getTotalSize(),
    /** Çizilmemiş satıra gider (klavyeyle görünür alanın dışına çıkınca). */
    scrollTo: (index: number) => v.scrollToIndex(index, { align: 'auto' }),
    /** `measure` açıkken satırın ref'i; satır `data-index` taşır. */
    measureElement: o.measure ? v.measureElement : undefined,
  }
}
