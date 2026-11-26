// İçe aktarma okuyucusu (data-sheet.md §6, Vue 07 §13): .xlsx `read-excel-file` ile (peer, ilk kullanımda yüklenir),
// .csv elle. Sayı hücresi ham metniyle gelir (`{ num }`): ondalık kayan noktaya hiç girmez, kod sütunundaki 12345
// "12345.0" olmaz.

/** Dosya hücresi: metin, sayının ham metni, mantıksal, tarih (Excel'in UTC günü) ya da boş. */
export type FileCell = string | { num: string } | boolean | Date | null

export interface FileSheet {
  name: string
  rows: FileCell[][]
}

/** `xlsxOnly`: eski ikili .xls ya da başka uzantı; `failed`: dosya okunamadı. */
export class ImportError extends Error {
  constructor(readonly code: 'xlsxOnly' | 'failed') {
    super(code)
  }
}

export async function readFile(file: File): Promise<FileSheet[]> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'csv' && ext !== 'xlsx') throw new ImportError('xlsxOnly')
  try {
    if (ext === 'csv') return [{ name: file.name.replace(/\.csv$/i, ''), rows: parseCsv(await file.text()) }]
    const { default: readXlsxFile } = await import('read-excel-file/browser')
    const sheets = await readXlsxFile<{ num: string }>(file, { parseNumber: (num) => ({ num }), trim: true })
    return sheets.map((s) => ({ name: s.sheet, rows: s.data as unknown as FileCell[][] }))
  } catch {
    throw new ImportError('failed')
  }
}

/** CSV (RFC 4180): BOM atılır; ayraç ilk satırda tırnak dışında hangisi çoksa `;` ya da `,`. Boş hücre null. */
export function parseCsv(text: string): FileCell[][] {
  const src = text.replace(/^\uFEFF/, '')
  const first = src.slice(0, src.search(/\r?\n|$/)).replace(/"[^"]*"/g, '')
  const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: FileCell[][] = []
  let row: FileCell[] = []
  let cell = ''
  let quoted = false
  const push = () => {
    row.push(cell === '' ? null : cell)
    cell = ''
  }
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (quoted) {
      if (ch !== '"') cell += ch
      else if (src[i + 1] === '"') {
        cell += '"'
        i++
      } else quoted = false
    } else if (ch === '"') quoted = true
    else if (ch === sep) push()
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      push()
      rows.push(row)
      row = []
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    push()
    rows.push(row)
  }
  return rows
}
