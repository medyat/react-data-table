// Kesilmiş hücre metninin tooltip'i: metni hücrenin kendisi ya da içindeki bir öğe (etiket, kişi adı, özel hücre) kesebilir.
import { describe, expect, it } from 'vitest'
import { tipOf } from '../src/core/grid/tooltip'

/** jsdom yerleşim yapmaz: genişlikler elle verilir; `overflow` kısaltmasını `overflowX`'e açmadığı için uzun yazılır. */
const sized = (el: HTMLElement, scroll: number, client: number) => {
  Object.defineProperty(el, 'scrollWidth', { value: scroll, configurable: true })
  Object.defineProperty(el, 'clientWidth', { value: client, configurable: true })
  return el
}

const cell = (html: string) => {
  const content = document.createElement('div')
  content.className = 'dt-cell-content'
  content.innerHTML = html
  sized(content, 200, 200)
  return content
}

describe('tipOf', () => {
  it('hücrenin kendisi kesiyorsa metni', () => {
    const content = sized(cell('PAKETLİ ÜRÜNLER'), 240, 120)
    expect(tipOf(content)?.text).toBe('PAKETLİ ÜRÜNLER')
  })
  it('içteki öğe kesiyorsa (overflow gizli) yine metni', () => {
    const content = cell(
      '<span class="photo"></span><span class="name" style="overflow-x:hidden">BEREKET SPAGETTİ MAKARNA</span>',
    )
    sized(content.querySelector<HTMLElement>('.name')!, 260, 140)
    expect(tipOf(content.querySelector('.name'))?.text).toBe('BEREKET SPAGETTİ MAKARNA')
  })
  it('taşan ama kesmeyen (overflow görünür) iç öğe tooltip açmaz', () => {
    const content = cell('<span class="name">Pump</span>')
    sized(content.querySelector<HTMLElement>('.name')!, 260, 140)
    expect(tipOf(content.querySelector('.name'))).toBeNull()
  })
  it('alt alta duran satırlar ayrı satır kalır: metin sayfadaki düzenden (innerText) okunur', () => {
    const content = sized(cell('<span>Zebra Perde Sistemi</span><span>250 × 200 cm</span>'), 240, 120)
    // jsdom yerleşim yapmadığı için innerText yok; tarayıcının vereceği değer elle verilir.
    Object.defineProperty(content, 'innerText', { value: 'Zebra Perde Sistemi\n250 × 200 cm' })
    expect(tipOf(content)?.text).toBe('Zebra Perde Sistemi\n250 × 200 cm')
  })
  it('kesilmemiş hücrede tooltip yok', () => {
    expect(tipOf(cell('Pump'))).toBeNull()
  })
})
