// Görünüm modeli (04 §7): varsayılan görünüm sırası, düzenlenmiş durum karşılaştırması, ad doğrulama.
import { describe, expect, it } from 'vitest'
import { byName, defaultView, nameError, sameState } from '../src/core/views/model'
import type { View, ViewState } from '../src/types'

const v = (id: string, kind: View['kind'], extra: Partial<View> = {}): View => ({
  id,
  name: id,
  kind,
  state: {},
  ...extra,
})
const state = (extra: Partial<ViewState> = {}): ViewState => ({
  filters: [],
  sort: [],
  columns: { order: ['a', 'b', 'c'], visible: ['a', 'b'], widths: {}, pinned: { left: ['a'], right: [] } },
  ...extra,
})

describe('defaultView', () => {
  const views = [v('s1', 'system'), v('s2', 'system', { default: true }), v('p1', 'personal')]
  it('tercih → system default → ilk system → yok', () => {
    expect(defaultView(views, 'p1')?.id).toBe('p1')
    expect(defaultView(views, 'yok')?.id).toBe('s2')
    expect(defaultView(views, null)?.id).toBe('s2')
    expect(defaultView([v('s1', 'system'), v('p1', 'personal')], null)?.id).toBe('s1')
    expect(defaultView([v('p1', 'personal')], null)).toBeNull()
  })
})

describe('sameState', () => {
  it('in değerleri sırasız, görünürler küme, genişlik ±2 px', () => {
    const a = state({
      filters: [{ column: 'status', op: 'in', value: ['x', 'y'] }],
      columns: { order: ['a', 'b', 'c'], visible: ['b', 'a'], widths: { a: 200 }, pinned: { left: ['a'], right: [] } },
    })
    const b = state({
      filters: [{ column: 'status', op: 'in', value: ['y', 'x'] }],
      columns: { order: ['a', 'b', 'c'], visible: ['a', 'b'], widths: { a: 202 }, pinned: { left: ['a'], right: [] } },
    })
    expect(sameState(a, b)).toBe(true)
    expect(sameState(a, { ...b, columns: { ...b.columns, widths: { a: 203 } } })).toBe(false)
    expect(sameState(a, { ...b, columns: { ...b.columns, widths: {} } })).toBe(false)
    expect(sameState(a, { ...b, sort: [{ column: 'a', dir: 'asc' }] })).toBe(false)
    expect(sameState(a, { ...b, filters: [] })).toBe(false)
    expect(sameState(a, { ...b, columns: { ...b.columns, order: ['b', 'a', 'c'] } })).toBe(false)
    expect(sameState(a, { ...b, columns: { ...b.columns, pinned: { left: [], right: ['a'] } } })).toBe(false)
  })
})

describe('nameError ve sıralama', () => {
  const views = [v('p1', 'personal', { name: 'Gebze' }), v('s1', 'system', { name: 'Late' })]
  it('zorunlu, 60 karakter, kişisel görünümler arasında benzersiz (harf duyarsız; kendisi hariç)', () => {
    expect(nameError('  ', views, 'tr')).toBe('required')
    expect(nameError('x'.repeat(61), views, 'tr')).toBe('tooLong')
    expect(nameError('gebze', views, 'tr')).toBe('taken')
    expect(nameError('gebze', views, 'tr', 'p1')).toBeNull()
    expect(nameError('Late', views, 'tr')).toBeNull() // system ile çakışma serbest
    expect(nameError('İzmir', views, 'tr')).toBeNull()
  })
  it('byName yerel ayara göre sıralar', () => {
    const c = new Intl.Collator('tr')
    const names = byName([v('1', 'personal', { name: 'Şile' }), v('2', 'personal', { name: 'Çorlu' })], c).map(
      (x) => x.name,
    )
    expect(names).toEqual(['Çorlu', 'Şile'])
  })
})
