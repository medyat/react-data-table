// R21: iyimser satır sırası; taşıma bilgisi, bekleyen istek, ret ve yenilenen sonuç.
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useRowOrder } from '../src/list/use-row-order'
import type { RowMove } from '../src/types'

interface Item {
  id: string
}
const items = (ids: string): Item[] => ids.split('').map((id) => ({ id }))
const ids = (rows: Item[]) => rows.map((r) => r.id).join('')
const setup = (onMove: (m: RowMove<Item>) => void | Promise<unknown>, rows = items('abcd')) =>
  renderHook(({ rows }) => useRowOrder(rows, (r) => r.id, onMove), { initialProps: { rows } })

describe('useRowOrder', () => {
  it('taşınan satırın komşularını bildirir ve yeni sırayı hemen gösterir', () => {
    const onMove = vi.fn()
    const { result } = setup(onMove)

    act(() => result.current.move(3, 1))

    expect(ids(result.current.rows)).toBe('adbc')
    const move = onMove.mock.calls[0]![0] as RowMove<Item>
    expect([move.row.id, move.after?.id, move.before?.id]).toEqual(['d', 'a', 'b'])
  })

  it('başa ve sona taşımada boş komşu null', () => {
    const onMove = vi.fn()
    const { result } = setup(onMove)

    act(() => result.current.move(2, 0))
    act(() => result.current.move(0, 3))

    const moves = onMove.mock.calls.map((call) => call[0] as RowMove<Item>)
    expect(moves.map((m) => [m.row.id, m.after?.id ?? null, m.before?.id ?? null])).toEqual([
      ['c', null, 'a'],
      ['c', 'd', null],
    ])
    expect(ids(result.current.rows)).toBe('abdc')
  })

  it('Promise sürerken bekler; reddedilirse eski sıraya döner', async () => {
    let reject = () => {}
    const { result } = setup(() => new Promise((_, r) => (reject = () => r(new Error('x')))))

    act(() => result.current.move(0, 2))
    expect(result.current.pending).toBe(true)
    expect(ids(result.current.rows)).toBe('bcad')

    await act(async () => reject())
    expect(result.current.pending).toBe(false)
    expect(ids(result.current.rows)).toBe('abcd')
  })

  it('yenilenen sonuç gelince sunucunun sırası geçerli olur', async () => {
    const { result, rerender } = setup(() => Promise.resolve())

    await act(async () => result.current.move(0, 1))
    expect(ids(result.current.rows)).toBe('bacd')

    rerender({ rows: items('bcad') })
    expect(ids(result.current.rows)).toBe('bcad')
  })

  it('yerinde bırakmak bildirilmez', () => {
    const onMove = vi.fn()
    const { result } = setup(onMove)

    act(() => result.current.move(1, 1))

    expect(onMove).not.toHaveBeenCalled()
  })
})
