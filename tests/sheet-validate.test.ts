// @vitest-environment node
// FormGrid A adımı: hücre doğrulaması (tip → validate → warn), sunucu hatalarının sütuna eşlenmesi, seçim özeti.
import { describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import { mapErrors } from '../src/core/sheet/errors'
import { collectIssues, nextError } from '../src/core/sheet/issues'
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
    const qty: ColumnDef<Line> = { id: 'qty', header: 'Miktar', type: 'decimal', validate: () => 'kural' }
    expect(cellIssue(qty, 'abc', ctx, i18n)).toEqual({ level: 'error', message: 'Sayı girin', suggest: undefined })
    expect(cellIssue(qty, '=1+1', ctx, i18n)?.message).toBe('Formül desteklenmiyor')
    expect(cellIssue({ id: 'd', header: 'D', type: 'date' }, '31.02', ctx, i18n)?.message).toBe('Tarih girin')
    const issue = cellIssue(unit, 'Adt', ctx, i18n)
    expect(issue?.message).toBe('“Adt” bir seçenek değil')
    expect(issue?.suggest?.value).toBe('pcs')
  })
  it('sunucunun ondalık metni ve sayı geçerli; ondalık olmayan metin hata', () => {
    const qty: ColumnDef<Line> = { id: 'qty', header: 'Miktar', type: 'decimal' }
    expect(cellIssue(qty, '1200.0000', ctx, i18n)).toBeNull()
    expect(cellIssue(qty, '-0.5', ctx, i18n)).toBeNull()
    expect(cellIssue(qty, 12, ctx, i18n)).toBeNull()
    expect(cellIssue(qty, '1.200,00', ctx, i18n)?.message).toBe('Sayı girin')
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
  it('Hücre boş olmayanları sayar; sayılar yalnız sayı sütunundan, ondalık metin tam toplanır', () => {
    expect(
      summarize([
        [10, true],
        [null, true],
        ['', false],
        ['Adet', false],
        ['12', false],
        ['0.1', true],
        ['0.2', true],
        [-4, true],
      ]),
    ).toEqual({ count: 6, numbers: { sum: '6.3', average: '1.575', min: '-4', max: '10' } })
  })
  it('sayı yoksa numbers null; 0 bir değerdir', () => {
    expect(
      summarize([
        ['a', false],
        [null, true],
      ]).numbers,
    ).toBeNull()
    expect(summarize([['0.00', true]])).toEqual({ count: 1, numbers: { sum: '0', average: '0', min: '0', max: '0' } })
  })
  it('30 bin hücre algoritma olarak hızlı', () => {
    const cells = Array.from({ length: 30_000 }, (_, i): [unknown, boolean] => [i % 3 ? String(i / 4) : null, true])
    // İlk çağrı decimal.js'i ısıtır; paralel koşuda soğuk ölçüm sınırı rastgele aşıyordu.
    summarize(cells)
    const t0 = performance.now()
    summarize(cells)
    expect(performance.now() - t0).toBeLessThan(60)
  })
})

describe('collectIssues · nextError (form-grid.md §6)', () => {
  type R = { qty?: unknown; unit?: unknown }
  const cols: ColumnDef<R>[] = [
    { id: 'qty', type: 'decimal', header: 'Miktar', validate: (v) => (v === '0' ? 'Sıfır olamaz' : null) },
    { id: 'unit', type: 'string', header: 'Birim', warn: (v) => (v === 'x' ? 'Emin misiniz?' : null) },
  ]
  const collect = (rows: R[], errors: Record<string, string>) =>
    collectIssues({
      rows,
      columns: cols,
      errors: mapErrors(errors, ['qty', 'unit']),
      read: (i, def) => rows[i]?.[def.id as keyof R],
      isNew: () => false,
      i18n,
    })

  it('sunucu hatası istemci kuralından önce gelir; satır hatası ilk hücrede, uyarı sıraya girmez', () => {
    const issues = collect([{ qty: '0' }, { qty: 'abc', unit: 'x' }, { qty: '2' }], {
      '0.qty': 'Stok yetersiz',
      '2': 'Satır kilitli',
    })
    expect(issues.cells.get(0)?.get('qty')?.message).toBe('Stok yetersiz')
    expect(issues.cells.get(1)?.get('qty')?.message).toBe(i18n.t('sheet.notANumber'))
    expect(issues.cells.get(1)?.get('unit')?.level).toBe('warning')
    expect(issues.cells.get(2)?.get('qty')?.message).toBe('Satır kilitli')
    expect(issues.rows.get(2)).toEqual(['Satır kilitli'])
    expect(issues.order).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 0 },
      { row: 2, col: 0 },
    ])
    expect(issues.errorRows).toBe(3)
  })

  it('F8 sonraki hataya gider, uçta başa döner; ⇧F8 tersine', () => {
    const order = [
      { row: 0, col: 1 },
      { row: 3, col: 0 },
      { row: 3, col: 2 },
    ]
    expect(nextError(order, null, 1)).toEqual({ row: 0, col: 1 })
    expect(nextError(order, { row: 3, col: 0 }, 1)).toEqual({ row: 3, col: 2 })
    expect(nextError(order, { row: 3, col: 2 }, 1)).toEqual({ row: 0, col: 1 })
    expect(nextError(order, { row: 3, col: 0 }, -1)).toEqual({ row: 0, col: 1 })
    expect(nextError(order, { row: 0, col: 0 }, -1)).toEqual({ row: 3, col: 2 })
    expect(nextError([], { row: 0, col: 0 }, 1)).toBeNull()
  })
})
