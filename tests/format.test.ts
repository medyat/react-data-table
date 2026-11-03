// @vitest-environment node
// Faz 1 kabul kriteri: sayılar tabular/sağa (CSS), negatiflerde U+2212, formatter'lar önbellekli (10k hücre < 10 ms); 09 · Biçimlendirme örnekleri.
import { describe, expect, it } from 'vitest'
import { MINUS, createFormat, getFormat, toDate } from '../src/core/format'

const en = createFormat('en')
const tr = createFormat('tr')
const today = new Date(2026, 9, 21) // 21 Ekim 2026 (brief örnekleri)

describe('sayılar (09 tablosu)', () => {
  it('int / float / yüzde / kısa sayı', () => {
    expect(en.int(12400)).toBe('12,400')
    expect(tr.int(12400)).toBe('12.400')
    expect(en.decimal(1284.5)).toBe('1,284.50')
    expect(tr.decimal(1284.5)).toBe('1.284,50')
    expect(en.decimal(0)).toBe('0.00')
    expect(en.percent(68)).toBe('68%')
    expect(tr.percent(68)).toBe('%68')
    expect(en.compact(250_000)).toBe('250K')
  })
  it('negatif gerçek eksi işareti (U+2212)', () => {
    expect(en.int(-320)).toBe(`${MINUS}320`)
    expect(tr.decimal(-12450)).toBe(`${MINUS}12.450,00`)
    expect(en.int(-320)).not.toContain('-')
  })
})

describe('tarihler', () => {
  it('bu yıl / başka yıl / tarih-saat', () => {
    expect(en.date('2026-10-24', today)).toBe('Oct 24')
    expect(tr.date('2026-10-24', today)).toBe('24 Eki')
    expect(en.date('2025-03-03', today)).toBe('Mar 3, 2025')
    expect(tr.date('2025-03-03', today)).toBe('3 Mar 2025')
    expect(en.dateTime(new Date(2026, 9, 17, 9, 42), today)).toMatch(/^Oct 17, 09:42/)
    expect(tr.dateTime(new Date(2026, 9, 17, 9, 42), today)).toBe('17 Eki 09:42')
  })
  it('ISO tarih yerel gün olarak okunur (UTC kayması yok)', () => {
    const d = toDate('2026-10-24')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 24])
  })
  it('göreli zaman ve gecikme', () => {
    const now = new Date(2026, 9, 21, 12, 0)
    expect(en.relative(new Date(2026, 9, 21, 10, 0), now)).toBe('2 hours ago')
    expect(tr.relative(new Date(2026, 9, 21, 10, 0), now)).toBe('2 saat önce')
    expect(en.relative(new Date(2026, 9, 24, 12, 0), now)).toBe('in 3 days')
    expect(en.daysLate('2026-10-18', today)).toBe(3)
    expect(en.daysLate('2026-10-21', today)).toBe(0)
    expect(en.daysLate('2026-10-25', today)).toBe(0)
  })
  it('liste ve karşılaştırma', () => {
    expect(en.list(['In progress', 'Released'])).toBe('In progress, Released')
    expect(tr.collator().compare('ışık', 'IŞIK')).toBe(0)
    expect(en.collator().compare('WO-2', 'WO-10')).toBeLessThan(0)
  })
})

describe('önbellek', () => {
  it('aynı locale aynı örnek; 10k biçimlendirme 10 ms altında', () => {
    expect(getFormat('en')).toBe(getFormat('en'))
    const f = getFormat('en')
    f.decimal(1) // ısınma
    // Paralel test işçileri CPU'yu paylaşır: üç denemenin en iyisi ölçülür.
    let best = Infinity
    for (let run = 0; run < 3; run++) {
      const t0 = performance.now()
      for (let i = 0; i < 10_000; i++) f.decimal(i * 1.5)
      best = Math.min(best, performance.now() - t0)
    }
    expect(best).toBeLessThan(10)
  })
})
