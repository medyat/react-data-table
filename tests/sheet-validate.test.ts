// @vitest-environment node
// FormGrid A adımı: hücre doğrulaması (tip → validate → warn), sunucu hatalarının sütuna eşlenmesi, seçim özeti.
import { describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import { mapErrors } from '../src/core/sheet/errors'
import { summarize } from '../src/core/sheet/summary'
import { cellIssue } from '../src/core/sheet/validate'
import type { ColumnDef } from '../src/types'

interface Line {
  qty: number | null
  unit: string | null
  gtip: string | null
}
const i18n = createI18n({ locale: 'tr' })
const row: Line = { qty: 1, unit: 'pcs', gtip: null }
const ctx = { row, rows: [row], isNew: false }
const unit: ColumnDef<Line> = {
  id: 'unit',
  header: 'Birim',
  type: 'select',
  options: [
    { value: 'pcs', label: 'Adet' },
    { value: 'm', label: 'Metre' },
  ],
}

describe('cellIssue', () => {
  it('tip hatası önce: sayı değil, formül, tarih değil, seçenek değil (yakın öneriyle)', () => {
    const qty: ColumnDef<Line> = { id: 'qty', header: 'Miktar', type: 'float', validate: () => 'kural' }
    expect(cellIssue(qty, 'abc', ctx, i18n)).toEqual({ level: 'error', message: 'Sayı girin', suggest: undefined })
    expect(cellIssue(qty, '=1+1', ctx, i18n)?.message).toBe('Formül desteklenmiyor')
    expect(cellIssue({ id: 'd', header: 'D', type: 'date' }, '31.02', ctx, i18n)?.message).toBe('Tarih girin')
    const issue = cellIssue(unit, 'Adt', ctx, i18n)
    expect(issue?.message).toBe('“Adt” bir seçenek değil')
    expect(issue?.suggest?.value).toBe('pcs')
  })
  it('boş değer tip hatası değildir; validate hatası warn uyarısından önce gelir', () => {
    const gtip: ColumnDef<Line> = {
      id: 'gtip',
      header: 'GTİP',
      type: 'string',
      validate: (v) => (v && !/^\d{12}$/.test(String(v)) ? '12 rakam' : null),
      warn: (v, c) => (v && c.row.qty === 1 ? 'tek adet' : null),
    }
    expect(cellIssue(gtip, null, ctx, i18n)).toBeNull()
    expect(cellIssue(gtip, '12', ctx, i18n)).toEqual({ level: 'error', message: '12 rakam' })
    expect(cellIssue(gtip, '123456789012', ctx, i18n)).toEqual({ level: 'warning', message: 'tek adet' })
  })
  it('required istemcide hata üretmez', () => {
    expect(cellIssue({ ...unit, required: true }, null, ctx, i18n)).toBeNull()
  })
})

describe('mapErrors', () => {
  const ids = ['product_id', 'qty', 'detail', 'detail.transport']
  it('alan yolunun en uzun ön eki olan sütuna; sütuna düşmeyen satırın', () => {
    const m = mapErrors(
      {
        '0.qty': 'Miktar zorunlu',
        '2.detail.transport.vessel_name': ['Gemi adı zorunlu', 'En çok 50 harf'],
        '2.detail.delivery_term': 'Teslim şekli geçersiz',
        '3.lot_serial_lines': 'Lot eksik',
        '4': 'Satır geçersiz',
        title: 'başlığın hatası: satır değil',
      },
      ids,
    )
    expect(m.cells.get(0)?.get('qty')).toEqual(['Miktar zorunlu'])
    expect(m.cells.get(2)?.get('detail.transport')).toEqual(['Gemi adı zorunlu', 'En çok 50 harf'])
    expect(m.cells.get(2)?.get('detail')).toEqual(['Teslim şekli geçersiz'])
    expect(m.rows.get(3)).toEqual(['Lot eksik'])
    expect(m.rows.get(4)).toEqual(['Satır geçersiz'])
    expect(m.cells.size + m.rows.size).toBe(4)
  })
  it('ön ek nokta sınırında: "qty_unit" "qty" sütununa düşmez', () => {
    expect(mapErrors({ '1.qty_unit': 'x' }, ids).rows.get(1)).toEqual(['x'])
  })
})

describe('summarize', () => {
  it('Hücre boş olmayanları sayar; sayılar yalnız sayılardan', () => {
    expect(summarize([10, null, '', 'Adet', 2.5, -4])).toEqual({
      count: 4,
      numbers: { sum: 8.5, average: 8.5 / 3, min: -4, max: 10 },
    })
  })
  it('sayı yoksa numbers null; 0 bir değerdir', () => {
    expect(summarize(['a', null]).numbers).toBeNull()
    expect(summarize([0])).toEqual({ count: 1, numbers: { sum: 0, average: 0, min: 0, max: 0 } })
  })
  it('30 bin hücre algoritma olarak hızlı', () => {
    const values = Array.from({ length: 30_000 }, (_, i) => (i % 3 ? i : null))
    const t0 = performance.now()
    summarize(values)
    expect(performance.now() - t0).toBeLessThan(20)
  })
})
