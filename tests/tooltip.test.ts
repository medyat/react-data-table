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
    const content = cell('<span class="photo"></span><span class="name" style="overflow-x:hidden">BEREKET SPAGETTİ MAKARNA</span>')
    sized(content.querySelector<HTMLElement>('.name')!, 260, 140)
    expect(tipOf(content.querySelector('.name'))?.text).toBe('BEREKET SPAGETTİ MAKARNA')
  })
  it('taşan ama kesmeyen (overflow görünür) iç öğe tooltip açmaz', () => {
    const content = cell('<span class="name">Pump</span>')
    sized(content.querySelector<HTMLElement>('.name')!, 260, 140)
    expect(tipOf(content.querySelector('.name'))).toBeNull()
  })
  it('kesilmemiş hücrede tooltip yok', () => {
    expect(tipOf(cell('Pump'))).toBeNull()
  })
})
