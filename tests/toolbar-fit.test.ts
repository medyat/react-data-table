import { describe, expect, it } from 'vitest'
import { fitActions } from '../src/core/toolbar/fit'

// Sabit kısım 400, aralık 10; ikinciller 120 ve 90, birincil etiketli 140.
const base = { fixed: 400, gap: 10, secondary: [120, 90], primary: 140 }

describe('fitActions (R25)', () => {
  it('her şey sığıyorsa bütün ikinciller düğme, birincil etiketli', () => {
    expect(fitActions({ ...base, available: 400 + 10 + 120 + 10 + 90 + 10 + 140 })).toEqual({ shown: 2, label: true })
  })
  it('sığmayan ikinci sondan başlayarak menüye iner', () => {
    expect(fitActions({ ...base, available: 400 + 10 + 120 + 10 + 140 })).toEqual({ shown: 1, label: true })
    expect(fitActions({ ...base, available: 400 + 10 + 140 })).toEqual({ shown: 0, label: true })
  })
  it('ikinciller bittiyse birincil etiketini kaybeder', () => {
    expect(fitActions({ ...base, available: 400 + 10 + 36 })).toEqual({ shown: 0, label: false })
    expect(fitActions({ ...base, available: 100 })).toEqual({ shown: 0, label: false })
  })
  it('birincil yoksa yalnızca ikinciller sayılır', () => {
    expect(fitActions({ ...base, primary: 0, available: 400 + 10 + 120 })).toEqual({ shown: 1, label: true })
  })
})
