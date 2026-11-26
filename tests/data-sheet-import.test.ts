// @vitest-environment node
// DataSheet içe aktarması (data-sheet.md §6): CSV okuma, başlık tespiti, sütun eşleme, hücre çevirisi ve plan.
import { describe, expect, it } from 'vitest'
import { cellValue, detectHeaderRow, matchColumns, normalize, planImport } from '../src/data-sheet/import/match'
import { parseCsv, readFile, type FileCell } from '../src/data-sheet/import/read'
import type { ColumnDef } from '../src/types'

interface P {
  code: string | null
  title: string | null
  price: string | null
  qty: number | null
  unit: string | null
  active: boolean | null
}
const columns: Array<ColumnDef<P>> = [
  { id: 'code', header: 'Kod', type: 'string', importAliases: ['Stok Kodu', 'SKU'] },
  { id: 'title', header: 'Ürün adı', type: 'string' },
  { id: 'price', header: 'Fiyat', type: 'decimal' },
  { id: 'qty', header: 'Miktar', type: 'int' },
  {
    id: 'unit',
    header: 'Birim',
    type: 'select',
    options: [
      { value: 'C62', label: 'Adet' },
      { value: 'KGM', label: 'Kg' },
    ],
  },
  { id: 'active', header: 'Aktif', type: 'boolean' },
]
const env = { locale: 'tr-TR', today: new Date(2026, 10, 26), todayWord: 'Bugün', yesWord: 'Evet', noWord: 'Hayır' }

describe('okuma', () => {
  it('CSV: BOM atılır, ayraç ; seçilir, tırnak içindeki ayraç ve satır sonu korunur, boş hücre null', () => {
    const rows = parseCsv('﻿Kod;Ad;Not\r\nA-1;"Pompa; büyük";\r\nB-1;"İki\nsatır";"""tırnak"""\r\n')
    expect(rows).toEqual([
      ['Kod', 'Ad', 'Not'],
      ['A-1', 'Pompa; büyük', null],
      ['B-1', 'İki\nsatır', '"tırnak"'],
    ])
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
  it('.xls ve başka uzantı reddedilir', async () => {
    await expect(readFile(new File(['x'], 'eski.xls'))).rejects.toMatchObject({ code: 'xlsxOnly' })
  })
})

describe('başlık ve eşleme', () => {
  it('başlık satırı: üstteki başlık / boş satırlar atlanır, çoğu metin olan en dolu satır', () => {
    const rows: FileCell[][] = [
      ['Fiyat listesi 2026', null, null],
      [null, null, null],
      ['Stok Kodu', 'Ürün adı', 'Fiyat'],
      ['A-1', 'Pompa', { num: '10.5' }],
    ]
    expect(detectHeaderRow(rows)).toBe(2)
    expect(detectHeaderRow([])).toBe(-1)
  })
  it('eşleme: başlık, id ve takma ad; büyük/küçük harf ve Türkçe işaret duyarsız; tanınmayan ve ikinci kez gelen boş', () => {
    expect(normalize('  ÜRÜN   ADI ')).toBe('urun adi')
    expect(normalize('İŞLEM')).toBe('islem')
    expect(matchColumns(['stok kodu', 'URUN ADI', 'price', 'Açıklama', 'SKU'], columns)).toEqual([
      'code',
      'title',
      'price',
      null,
      null,
    ])
  })
})

describe('hücre çevirisi', () => {
  it('sayı ham metinden: ondalık metin kalır, tamsayı sayı olur; metin yerel ayarla; boş hücre atlanır', () => {
    const price = columns[2]!
    expect(cellValue(price, { num: '1650.10' }, env)).toBe('1650.1')
    expect(cellValue(price, { num: '1E-2' }, env)).toBe('0.01')
    expect(cellValue(price, '1.650,50', env)).toBe('1650.5')
    expect(cellValue(columns[3]!, { num: '7' }, env)).toBe(7)
    expect(cellValue(columns[4]!, 'kg', env)).toBe('KGM')
    expect(cellValue(columns[5]!, 'Evet', env)).toBe(true)
    expect(cellValue(columns[5]!, false, env)).toBe(false)
    expect(cellValue(columns[1]!, '  ', env)).toBeUndefined()
    expect(cellValue(columns[0]!, { num: '12345' }, env)).toBe('12345')
  })
})

describe('plan', () => {
  const rows: P[] = [
    { code: 'A-1', title: 'Pompa', price: '10.00', qty: 1, unit: 'C62', active: true },
    { code: 'B-1', title: 'Vana', price: '20.00', qty: 2, unit: 'C62', active: true },
  ]
  const data: FileCell[][] = [
    ['A-1', 'Pompa', { num: '10' }],
    ['B-1', 'Vana X', null],
    ['Z-9', 'Yeni', { num: '5' }],
    [null, 'Numarasız', null],
    [null, null, null],
    ['B-1', 'Vana tekrar', null],
  ]
  const plan = (addNew: boolean) =>
    planImport({
      data,
      mapping: [0, 1, 2],
      columns,
      rows,
      keyColumn: 'code',
      addNew,
      value: (def, c) => cellValue(def, c, env),
    })

  it('listedeki anahtar günceller (anahtar yazılmaz, boş hücre silmez, aynı değer sayılmaz); olmayan ve boş anahtar yeni satır; tekrar yeni', () => {
    const p = plan(true)
    expect(p.updated).toBe(1)
    expect(p.missing).toEqual(['Z-9'])
    expect(p.blankKeys).toBe(1)
    expect(p.repeated).toBe(1)
    expect(p.added).toBe(3)
    expect(p.cells).toEqual([
      { row: 1, col: 1, value: 'Vana X' },
      { row: 2, col: 0, value: 'Z-9' },
      { row: 2, col: 1, value: 'Yeni' },
      { row: 2, col: 2, value: '5' },
      { row: 3, col: 1, value: 'Numarasız' },
      { row: 4, col: 0, value: 'B-1' },
      { row: 4, col: 1, value: 'Vana tekrar' },
    ])
  })
  it('addNew kapalı: listede olmayan alınmaz; boş anahtarlı ve tekrar eden yine yeni satır', () => {
    const p = plan(false)
    expect(p.added).toBe(2)
    expect(p.cells.filter((c) => c.row >= 2)).toEqual([
      { row: 2, col: 1, value: 'Numarasız' },
      { row: 3, col: 0, value: 'B-1' },
      { row: 3, col: 1, value: 'Vana tekrar' },
    ])
  })
})
