// jsdom ölçüm yapmaz: virtual-core kabı clientWidth/clientHeight ile okur → kaydırma kabına 600 px, diğerlerine 40/100 ver.
import { act } from '@testing-library/react'

// Kart genişliği modül değişkeni: vitest, parametreli hook fonksiyonunu fixture sanır (beforeAll(mockLayout) çağrısı).
let cardWidth = 1200
export const mockCardWidth = (w: number) => (cardWidth = w)
export function mockLayout() {
  // Kaydırma kabı 1000 × 600; kart ve toolbar `cardWidth` (varsayılan daralma eşiklerinin üstü; telefon testleri 390); diğerleri 100 × 40.
  const size = (el: HTMLElement, axis: 'w' | 'h') =>
    el.classList.contains('dt-scroll')
      ? axis === 'h'
        ? 600
        : 1000
      : el.classList.contains('dt-toolbar') || el.classList.contains('dt-list')
        ? axis === 'h'
          ? 52
          : cardWidth
        : axis === 'h'
          ? 40
          : 100
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return size(this, 'h')
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return size(this, 'w')
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() {
      return document.body
    },
  })
  Object.defineProperty(Element.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return size(this as HTMLElement, 'h')
    },
  })
  Object.defineProperty(Element.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return size(this as HTMLElement, 'w')
    },
  })
  Element.prototype.getBoundingClientRect = function () {
    const h = size(this as HTMLElement, 'h')
    return { x: 0, y: 0, top: 0, left: 0, right: 1000, bottom: h, width: 1000, height: h, toJSON: () => ({}) }
  }
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0) as unknown as number
  Element.prototype.scrollIntoView ??= () => {}
  // Base UI / floating-ui portallı içerik için gözlemci stub'ları.
  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  globalThis.IntersectionObserver ??= Observer as unknown as typeof IntersectionObserver
  globalThis.ResizeObserver ??= Observer as unknown as typeof ResizeObserver
}

/** Sanal liste ölçümü ve odak: react-virtual ölçümü bir sonraki karede; act içinde bir makro görev bekler. */
export const flush = () => act(() => new Promise((r) => setTimeout(r, 0)))
