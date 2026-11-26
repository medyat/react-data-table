// Sürükleyerek seçimde kenar kayması: yalnız gizli satır varken dikey kayar, bırakınca durur, seçim sınırlanmış noktaya uzar.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startDragScroll } from '../src/core/sheet/drag-scroll'

const rect = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 800 }) as DOMRect
const pad = { top: 40, bottom: 0, start: 0, end: 0 }
const move = (clientY: number) => dispatchEvent(new MouseEvent('pointermove', { clientX: 300, clientY, buttons: 1 }))

function setup(box: DOMRect) {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
  const body = document.createElement('div')
  document.body.append(body)
  body.getBoundingClientRect = () => box
  const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
  const extend = vi.fn()
  const stop = startDragScroll({ body, insets: () => pad, scrollX: vi.fn(), extend })
  return { scroll, extend, stop }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('startDragScroll', () => {
  it('alt kenarda satır gizliyse aşağı kayar; seçim görünen alana sınırlanır; bırakınca durur', () => {
    const { scroll, extend } = setup(rect(100, 5000))
    move(innerHeight + 50)
    vi.advanceTimersByTime(32)
    expect(scroll).toHaveBeenCalled()
    expect(scroll.mock.lastCall![1]).toBeGreaterThan(0)
    expect(extend.mock.lastCall).toEqual([300, innerHeight - 1])
    dispatchEvent(new MouseEvent('pointerup'))
    scroll.mockClear()
    vi.advanceTimersByTime(64)
    expect(scroll).not.toHaveBeenCalled()
  })
  it('tuşsuz hareket (pencere dışında bırakıldı) ya da odak kaybı bitirir; bitiş bir kez', () => {
    const onEnd = vi.fn()
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
    const body = document.createElement('div')
    document.body.append(body)
    const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    startDragScroll({ body, insets: () => pad, scrollX: vi.fn(), extend: vi.fn(), onEnd })
    body.getBoundingClientRect = () => rect(100, 5000)
    dispatchEvent(new MouseEvent('pointermove', { clientX: 300, clientY: innerHeight + 50, buttons: 0 }))
    dispatchEvent(new Event('blur'))
    vi.advanceTimersByTime(64)
    expect(scroll).not.toHaveBeenCalled()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })
  it('satırların üst kenarı görünüyorsa üste sürüklemek sayfayı kaydırmaz', () => {
    const { scroll, stop } = setup(rect(100, 5000))
    move(90)
    vi.advanceTimersByTime(32)
    expect(scroll).not.toHaveBeenCalled()
    stop()
  })
})
