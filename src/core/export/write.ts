// Yerleşik dışa aktarma (D46): .xlsx `write-excel-file` ile (peer, ilk kullanımda yüklenir), .csv elle. Paket ekranda
// görünen sütun ve satırları yazar; uygulama `onExport` verirse bu yol hiç çalışmaz.
import type { ColumnDef } from '../../types/columns'
import type { FormatEnv } from '../cells/format'
import { listOptions, plainText, xlsxCell } from './cells'

export interface ExportJob<Row extends object> {
  format: 'csv' | 'xlsx'
  columns: Array<ColumnDef<Row>>
  rows: Row[]
  /** Hücre değeri (accessor ya da satır yolu). */
  read: (row: Row, def: ColumnDef<Row>) => unknown
  env: FormatEnv
  /** Dosya ve sayfa adı (uzantısız). */
  name: string
}

// 02 · Dışa aktarma (Excel): dosya her zaman açık temada.
const HEADER = {
  fontWeight: 'bold',
  textColor: '#15171C',
  backgroundColor: '#E8EAEE',
  borderColor: '#B4B9C2',
  borderStyle: 'thin',
  alignVertical: 'center',
} as const

/** Yazı boyutu (pt), tüm hücreler; Excel varsayılanı 11. Genişlik hesabı buna göre ölçeklenir. */
const FONT_PT = 16

/** Excel sayfa adı: en çok 31 karakter, `[]:*?/\` yok. */
export const sheetName = (s: string) => s.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Sheet1'

/**
 * Sütun genişliği: başlık ve ilk 200 satırın en uzunu, 8–60 karakter. Excel genişliği 11 pt karakter cinsinden
 * ölçtüğü için yazı boyutu oranında büyütülür.
 */
function widthOf(texts: string[]): number {
  let w = 0
  for (const t of texts) w = Math.max(w, ...t.split('\n').map((l) => l.length))
  return Math.round(Math.min(60, Math.max(8, w + 2)) * (FONT_PT / 11))
}

export function toCsv<Row extends object>(job: ExportJob<Row>): string {
  // Ondalık ayırıcı virgülse (tr, de …) Excel `;` bekler.
  const sep = job.env.fmt.decimal(1.5, 1).includes(',') ? ';' : ','
  const esc = (t: string) => (t.includes(sep) || /["\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t)
  const lines = [
    job.columns.map((c) => esc(c.header)),
    ...job.rows.map((r) => job.columns.map((c) => esc(plainText(c, r, job.read(r, c), job.env)))),
  ]
  return lines.map((l) => l.join(sep)).join('\r\n')
}

export async function toXlsx<Row extends object>(job: ExportJob<Row>): Promise<Blob> {
  const [{ default: writeXlsxFile }, util] = await Promise.all([
    import('write-excel-file/browser'),
    import('write-excel-file/utility'),
  ])
  const { columns, rows, env } = job
  const data = [
    columns.map((c) => ({ value: c.header, ...HEADER })),
    ...rows.map((r) => columns.map((c) => xlsxCell(c, r, job.read(r, c), env))),
  ]
  const sample = rows.slice(0, 200)
  const widths = columns.map((c) => ({
    width: widthOf([c.header, ...sample.map((r) => plainText(c, r, job.read(r, c), env))]),
  }))

  // Seçimli sütunlar: seçenekler ikinci sayfada birer sütun (görünür); içerik sayfasında hücre o listeden seçilir.
  const listed = columns.flatMap((c, i) => {
    const values = listOptions(c, env)
    return values ? [{ column: i + 1, header: c.header, values }] : []
  })
  const optionsName = sheetName(env.i18n.t('export.optionsSheet'))
  const ref = `'${optionsName.replace(/'/g, "''")}'`
  const validations = rows.length
    ? listed.map((l, j) => {
        const col = util.getCellAddress(0, j).replace(/\d+$/, '')
        const range = util.getCellAddress(1, l.column - 1) + ':' + util.getCellAddress(rows.length, l.column - 1)
        return (
          `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${range}">` +
          `<formula1>${util.sanitizeTextContent(`${ref}!$${col}$2:$${col}$${l.values.length + 1}`)}</formula1>` +
          `</dataValidation>`
        )
      })
    : []
  const optionRows = Math.max(0, ...listed.map((l) => l.values.length))
  const optionsData = [
    listed.map((l) => ({ value: l.header, ...HEADER })),
    ...Array.from({ length: optionRows }, (_, i) => listed.map((l) => ({ value: l.values[i] ?? null }))),
  ]

  const feature = {
    files: {
      transform: {
        'xl/worksheets/sheet{id}.xml': {
          transform: (xml: string, _o: unknown, p: { sheetIndex: number }) => {
            if (p.sheetIndex !== 0 || !validations.length) return xml
            const order = util.getOrderOfSiblings('xl/worksheets/sheet{id}.xml', 'worksheet')!
            const markup = `<dataValidations count="${validations.length}">${validations.join('')}</dataValidations>`
            return util.insertElementMarkupAccordingToOrderOfSiblings(xml, markup, order, 'worksheet')
          },
        },
      },
    },
  }

  const main = { sheet: sheetName(job.name), data, columns: widths, stickyRowsCount: 1 }
  const sheets = listed.length
    ? [
        main,
        {
          sheet: optionsName,
          data: optionsData,
          columns: listed.map((l) => ({ width: widthOf([l.header, ...l.values]) })),
        },
      ]
    : [main]
  // Kütüphanenin tipleri dar (stil birleşimi, feature imzası); yapı README'deki sözleşmeye uyar.
  return writeXlsxFile(sheets as never, { features: [feature], fontSize: FONT_PT } as never).toBlob()
}

function download(blob: Blob, fileName: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export async function exportFile<Row extends object>(job: ExportJob<Row>): Promise<void> {
  const blob =
    job.format === 'csv'
      ? // BOM: Excel UTF-8'i (Türkçe karakterler) ancak böyle tanır.
        new Blob(['﻿' + toCsv(job)], { type: 'text/csv;charset=utf-8' })
      : await toXlsx(job)
  download(blob, `${job.name}.${job.format}`)
}
