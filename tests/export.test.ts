// @vitest-environment node
// Yerleşik dışa aktarma (D46, 05 §3, 07 §13): hücre tipleri Excel'e tipli, tarih duvar saatiyle;
// başlık boyalı ve dondurulmuş; seçimli sütunlar seçenek sayfasından açılır liste; CSV yerel ayraçla;
// içe aktarma (okuyucu) bu pakette yok (R1).
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { RemoteLabels } from '../src/core/cells/remote-labels'
import type { FormatEnv } from '../src/core/cells/format'
import { datePattern, xlsxCell } from '../src/core/export/cells'
import { sheetName, toCsv, toXlsx, type ExportJob } from '../src/core/export/write'
import { getFormat } from '../src/core/format'
import { createI18n } from '../src/core/i18n'
import type { ColumnDef } from '../src/types'

interface P {
  sku: string
  name: string
  price: number | null
  vat: number
  status: string | null
  active: boolean
  due: string | null
}
const envOf = (locale: string): FormatEnv => ({
  fmt: getFormat(locale),
  i18n: createI18n({ locale }),
  today: new Date(2026, 9, 29),
  labels: new RemoteLabels(),
})
const en = envOf('en')
const columns: Array<ColumnDef<P>> = [
  { id: 'sku', header: 'SKU', type: 'id' },
  { id: 'name', header: 'Name', type: 'string' },
  { id: 'price', header: 'Price', type: 'currency', currency: 'TRY' },
  { id: 'vat', header: 'VAT', type: 'percentage' },
  {
    id: 'status',
    header: 'Status',
    type: 'select',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'live', label: 'Live' },
    ],
  },
  { id: 'active', header: 'Active', type: 'boolean' },
  { id: 'due', header: 'Due', type: 'date' },
]
const rows: P[] = [
  { sku: 'HC-1', name: 'Cylinder; "big"', price: 1650, vat: 20, status: 'live', active: true, due: '2026-10-24' },
  { sku: 'GP-2', name: 'Pump', price: null, vat: 10, status: null, active: false, due: null },
]
const job = (over: Partial<ExportJob<P>> = {}): ExportJob<P> => ({
  format: 'xlsx',
  columns,
  rows,
  read: (r, d) => r[d.id as keyof P],
  env: en,
  name: 'products',
  ...over,
})
async function unzip(blob: Blob) {
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  return (p: string) => strFromU8(files[p]!)
}

describe('xlsxCell', () => {
  const def = (id: keyof P) => columns.find((c) => c.id === id)!
  it('sayı tipli, biçim tipten: para kodu, yüzde değeri bölünmez', () => {
    expect(xlsxCell(def('price'), rows[0]!, 1650, en)).toEqual({ value: 1650, type: Number, format: '#,##0.00 "TRY"' })
    expect(xlsxCell(def('vat'), rows[0]!, 20, en)).toEqual({ value: 20, type: Number, format: '#,##0"%"' })
  })
  it('tarih yerel gün olarak (UTC kayması yok), biçim yerel ayarın gün/ay sırasıyla', () => {
    const c = xlsxCell(def('due'), rows[0]!, '2026-10-24', en)
    expect((c.value as Date).toISOString()).toBe('2026-10-24T00:00:00.000Z')
    expect(c.format).toBe('mm/dd/yyyy')
    expect(xlsxCell(def('due'), rows[0]!, '2026-10-24', envOf('tr')).format).toBe('dd.mm.yyyy')
    expect(datePattern('de')).toBe('dd.mm.yyyy')
  })
  it('seçenek etiketi, boolean Yes/No, boş → null', () => {
    expect(xlsxCell(def('status'), rows[0]!, 'live', en).value).toBe('Live')
    expect(xlsxCell(def('active'), rows[0]!, false, en).value).toBe('No')
    expect(xlsxCell(def('price'), rows[0]!, null, en).value).toBeNull()
  })
})

describe('CSV', () => {
  it('en: virgül ayraç, ayraç/tırnak içeren hücre tırnaklı; para kodu ve "—" yok', () => {
    expect(toCsv(job({ format: 'csv', columns: columns.slice(0, 3) })).split('\r\n')).toEqual([
      'SKU,Name,Price',
      'HC-1,"Cylinder; ""big""","1,650.00"',
      'GP-2,Pump,',
    ])
  })
  it('tr: ondalık virgül olduğu için noktalı virgül ayraç', () => {
    const lines = toCsv(job({ format: 'csv', columns: columns.slice(0, 3), env: envOf('tr') })).split('\r\n')
    expect(lines[0]).toBe('SKU;Name;Price')
    expect(lines[1]).toBe('HC-1;"Cylinder; ""big""";1.650,00')
  })
})

describe('XLSX', () => {
  it('başlık kalın + dolgu + alt çizgi, dondurulmuş; seçimli sütunlar seçenek sayfasından açılır liste', async () => {
    const read = await unzip(await toXlsx(job()))
    expect(read('xl/workbook.xml')).toMatch(/<sheet [^>]*name="products"/)
    // Seçenek sayfası görünür (kullanıcı seçenekleri görebilsin).
    expect(read('xl/workbook.xml')).toMatch(/<sheet [^>]*name="Options"/)
    expect(read('xl/workbook.xml')).not.toContain('state="hidden"')
    const sheet = read('xl/worksheets/sheet1.xml')
    expect(sheet).toContain('state="frozen"')
    // Status (E) ← Options!A, Active (F) ← Options!B; yalnızca veri satırları (2–3).
    expect(sheet).toContain('sqref="E2:E3"><formula1>\'Options\'!$A$2:$A$3</formula1>')
    expect(sheet).toContain('sqref="F2:F3"><formula1>\'Options\'!$B$2:$B$3</formula1>')
    const styles = read('xl/styles.xml')
    expect(styles).toContain('FFE8EAEE')
    expect(styles).toMatch(/<b\/>/)
    // 16 pt: varsayılan font ve başlığın kalın fontu; 11 pt font kalmaz. Genişlik 16/11 ölçekli (SKU: 8 → 12).
    expect(styles).toContain('<sz val="16"/>')
    expect(styles).not.toContain('<sz val="11"/>')
    expect(sheet).toMatch(/<col min="1" max="1" width="12"/)
  })
  it('seçimli sütun yoksa seçenek sayfası ve doğrulama yok', async () => {
    const read = await unzip(await toXlsx(job({ columns: columns.slice(0, 3) })))
    expect(read('xl/workbook.xml')).not.toContain('Options')
    expect(read('xl/worksheets/sheet1.xml')).not.toContain('dataValidation')
  })
  it('sayfa adı Excel kurallarına uyar', () => {
    expect(sheetName('a/b:c*d?[e]')).toBe('a b c d  e ')
    expect(sheetName('x'.repeat(40))).toHaveLength(31)
  })
})
