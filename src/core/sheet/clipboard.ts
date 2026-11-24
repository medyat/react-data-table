// Pano biçimleri (Vue 07 §7, Vue `src/sheet/clipboard.ts`'ten): kopyada TSV (`text/plain`) + `<table>` (`text/html`),
// görüntülenen biçimde; yapıştırmada TSV çözümleme (Excel'in tırnaklı, içinde sekme/satır sonu olan hücreleri dahil),
// `text/html` yalnızca TSV yoksa.

/** Excel kuralı: sekme/satır sonu/tırnak içeren hücre çift tırnağa alınır, içteki tırnak ikilenir. */
const tsvCell = (s: string): string => (/[\t\n\r"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
export const toTsv = (matrix: string[][]): string => matrix.map((r) => r.map(tsvCell).join('\t')).join('\n')

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
export const toHtml = (matrix: string[][]): string =>
  `<table><tbody>${matrix.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`

/** TSV → matris; sondaki tek boş satır (Excel'in eklediği) atılır. */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
      continue
    }
    if (ch === '"' && cell === '') quoted = true
    else if (ch === '\t') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  if (rows.length > 1 && rows[rows.length - 1]!.every((c) => c === '')) rows.pop()
  return rows
}

function parseHtmlTable(html: string): string[][] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return [...doc.querySelectorAll('tr')].map((tr) =>
    [...tr.querySelectorAll('td, th')].map((td) => (td.textContent ?? '').replace(/\u00a0/g, ' ').trim()),
  )
}

/** Pano olayından matris: TSV öncelikli, sonra HTML tablosu. */
export function matrixFromClipboard(data: DataTransfer | null): string[][] {
  const text = data?.getData('text/plain') ?? ''
  if (text) return parseTsv(text)
  const html = data?.getData('text/html') ?? ''
  return html ? parseHtmlTable(html) : []
}
