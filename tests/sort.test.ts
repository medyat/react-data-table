// Sıralama kuralları (04 §6).
import { describe, expect, it } from 'vitest'
import { setSort, toggleSort } from '../src/list/sort'

describe('toggleSort', () => {
  it('tık: asc → desc → kapalı; diğer sütunlar kalkar', () => {
    let s = toggleSort([{ column: 'b', dir: 'asc' }], 'a', false)
    expect(s).toEqual([{ column: 'a', dir: 'asc' }])
    s = toggleSort(s, 'a', false)
    expect(s).toEqual([{ column: 'a', dir: 'desc' }])
    expect(toggleSort(s, 'a', false)).toEqual([])
  })
  it('⇧: ikincil ekler, yerinde yön değiştirir, kaldırır; en fazla 3, dördüncüde en eski düşer', () => {
    let s = toggleSort([], 'a', true)
    s = toggleSort(s, 'b', true)
    s = toggleSort(s, 'a', true)
    expect(s).toEqual([
      { column: 'a', dir: 'desc' },
      { column: 'b', dir: 'asc' },
    ])
    s = toggleSort(toggleSort(s, 'c', true), 'd', true)
    expect(s.map((r) => r.column)).toEqual(['b', 'c', 'd'])
    expect(toggleSort(toggleSort(s, 'c', true), 'c', true).map((r) => r.column)).toEqual(['b', 'd'])
  })
  it('menü: yön tek sıralama yapar, kaldırmak yalnızca o sütunu çıkarır', () => {
    const two = [
      { column: 'a', dir: 'asc' as const },
      { column: 'b', dir: 'asc' as const },
    ]
    expect(setSort(two, 'b', 'desc')).toEqual([{ column: 'b', dir: 'desc' }])
    expect(setSort(two, 'a', null)).toEqual([{ column: 'b', dir: 'asc' }])
  })
})
