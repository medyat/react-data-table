// use-column-layout: hibrit genişlik (--cols), sabit sütun ofsetleri, resize → px, görünürlük (05 §4, 01 · TanStack sınırı).
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useColumnLayout } from '../src/core/columns/use-column-layout'
import type { ColumnDef } from '../src/types'

interface Order {
  id: number
  number: string
  product: { name: string }
  customer: string
  value: number
  dueAt: string
}

const columns: Array<ColumnDef<Order>> = [
  { id: 'number', header: 'Order no.', type: 'id', primary: true },
  { id: 'product.name', header: 'Product', type: 'string' },
  { id: 'customer', header: 'Customer', type: 'string' },
  { id: 'value', header: 'Value', type: 'currency', currency: 'TRY' },
  { id: 'dueAt', header: 'Due date', type: 'date', hidden: true },
  { id: 'actions', header: '', type: 'object', width: 56, alwaysVisible: true },
]

afterEach(cleanup)

function setup() {
  let renders = 0
  const hook = renderHook(() => {
    renders++
    return useColumnLayout<Order>({ columns, layout: { pinned: { left: [], right: ['actions'] } } })
  })
  return { hook, renders: () => renders }
}

describe('useColumnLayout', () => {
  it('--cols: sabitler px, orta sütunlar minmax, bölge sonunda auto', () => {
    const api = setup().hook.result.current
    expect(api.cols()).toBe('136px minmax(160px, 1.2fr) minmax(160px, 1.2fr) 148px auto 56px')
    expect(api.minWidth()).toBe(136 + 160 + 160 + 148 + 56)
    expect(api.columns.map((c) => c.id)).toEqual(['number', 'product.name', 'customer', 'value', 'actions'])
  })
  it('sabit sütun ofsetleri CSS değişkeni olarak, kenar işareti', () => {
    const api = setup().hook.result.current
    const [number, product, , , actions] = api.columns
    expect(number).toMatchObject({ pinned: 'start', pinEdge: true, offsetVar: '--dt-off-number' })
    expect(actions).toMatchObject({ pinned: 'end', pinEdge: true })
    expect(product).toMatchObject({ pinned: null, pinEdge: false, offsetVar: '--dt-off-product_name' })
    expect(api.offsets()).toEqual({ '--dt-off-number': '0px', '--dt-off-actions': '0px' })
  })
  it('resize: px olur, en az 80; hook yeniden çizilmez, abone haber alır (05 · Resize)', () => {
    const { hook, renders } = setup()
    const api = hook.result.current
    const before = renders()
    let notified = 0
    const off = api.subscribeSizing(() => notified++)
    act(() => api.setWidth('customer', 184))
    expect(renders()).toBe(before)
    expect(notified).toBeGreaterThan(0)
    expect(api.cols()).toContain('184px')
    act(() => api.setWidth('customer', 10))
    expect(api.widthOf('customer')).toBe(80)
    expect(api.resizing()).toBeNull()
    off()
  })
  it('görünürlük: gizle / göster yeniden çizer', () => {
    const { hook } = setup()
    act(() => hook.result.current.setVisible('customer', false))
    expect(hook.result.current.columns.map((c) => c.id)).not.toContain('customer')
    act(() => hook.result.current.setVisible('dueAt', true))
    expect(hook.result.current.columns.map((c) => c.id)).toContain('dueAt')
  })
  it('birincil ve alwaysVisible gizlenemez', () => {
    const api = setup().hook.result.current
    expect(api.columns.find((c) => c.id === 'number')!.canHide).toBe(false)
    expect(api.columns.find((c) => c.id === 'actions')!.canHide).toBe(false)
    expect(api.columns.find((c) => c.id === 'customer')!.canHide).toBe(true)
  })
  it('move: aynı bölgedeki görünür komşuyla yer değiştirir; sabit bölgeye geçmez', () => {
    const { hook } = setup()
    act(() => hook.result.current.move('customer', -1))
    expect(hook.result.current.columns.map((c) => c.id)).toEqual([
      'number',
      'customer',
      'product.name',
      'value',
      'actions',
    ])
    act(() => hook.result.current.move('customer', -1))
    expect(hook.result.current.columns[1]!.id).toBe('customer')
  })
  it("ölçek: tip varsayılanı ve geliştiricinin width'i çarpılır, sürüklenen genişlik değişmez (02 · Ölçek)", () => {
    const { hook } = setup()
    act(() => hook.result.current.setScale(14 / 13))
    expect(hook.result.current.cols()).toBe('146px minmax(172px, 1.2fr) minmax(172px, 1.2fr) 159px auto 60px')
    act(() => hook.result.current.setWidth('customer', 200))
    expect(hook.result.current.cols()).toContain(' 200px ')
  })
})
