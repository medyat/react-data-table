'use no memo'
// R11: Virtualizer örneği kendini değiştirerek çalışır; derleyici onu önbelleğe alırsa satırlar kaymaz. Bu dosya
// derleyicinin dışındadır ve her render'da düz veri döner, onu kullanan ızgara derlenmeye devam eder.
import { useVirtualizer, type Range } from '@tanstack/react-virtual'
import { useLayoutEffect, type RefObject } from 'react'

export interface VirtualRowsOptions {
  count: number
  scrollRef: RefObject<HTMLElement | null>
  /** Satır yüksekliği + 1 px alt kenarlık (02). */
  itemHeight: number
  /** Sticky header akış içinde: sanal öğeler header kadar aşağıda başlar, header görünür alanın üstünü örter (08 §2). */
  headHeight: number
  /** Yatay kaydırma çubuğu görünür alanın altını örter. */
  barHeight: number
  keyOf: (index: number) => string
  /** Odaktaki widget'ın satırı (−1 yok): kaydırınca DOM'dan çıkmaz, odak kaybolmaz (08 §2). */
  keepIndex: number
  /** Değişince ölçüm önbelleği sıfırlanır (sorgu / sayfa: açık detaylar kapandı, 05 §7). */
  resetKey?: string
}

export function useVirtualRows(o: VirtualRowsOptions) {
  // eslint-disable-next-line react-hooks/incompatible-library -- dosya derleyicinin dışında ("use no memo")
  const v = useVirtualizer({
    count: o.count,
    getScrollElement: () => o.scrollRef.current,
    estimateSize: () => o.itemHeight,
    scrollMargin: o.headHeight,
    scrollPaddingStart: o.headHeight,
    scrollPaddingEnd: o.barHeight,
    overscan: 10,
    getItemKey: o.keyOf,
    rangeExtractor: (range: Range) => {
      const start = Math.max(0, range.startIndex - range.overscan)
      const end = Math.min(range.count - 1, range.endIndex + range.overscan)
      const out: number[] = []
      const f = o.keepIndex
      if (f >= 0 && f < start && f < range.count) out.push(f)
      for (let i = start; i <= end; i++) out.push(i)
      if (f > end && f < range.count) out.push(f)
      return out
    },
  })
  // Yoğunluk değişince ölçüm önbelleği sıfırlanır: estimateSize değişimi tek başına yenilemez.
  useLayoutEffect(() => v.measure(), [v, o.itemHeight, o.resetKey])
  return {
    items: v.getVirtualItems().map((i) => ({ key: String(i.key), index: i.index, start: i.start })),
    total: v.getTotalSize(),
    /** Açık detaylı öğenin ref'i: yüksekliği ölçülür, anahtarla önbellekte kalır. */
    measureElement: v.measureElement,
    /** Detay kapanınca öğe satır yüksekliğine döner. */
    resizeItem: (index: number, size: number) => v.resizeItem(index, size),
  }
}
