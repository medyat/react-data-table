// İçe aktarmanın saf adımları (data-sheet.md §6, Vue 07 §13): başlık satırı tespiti, sütun eşleme, hücrenin sütun
// değerine çevrilmesi ve dosyanın tabloya yazılacak hücrelere dönüşmesi. DOM ve React yok.
import Decimal from 'decimal.js'
import type { ColumnDef } from '../../types/columns'
import { isEmptyValue } from '../../core/cells/format'
import { TYPE_SPECS } from '../../core/cells/specs'
import { columnName } from '../../core/columns/column-name'
import { readPath } from '../../core/columns/read-path'
import { isDecimalType } from '../../core/format/decimal'
import { parseInput, type ParseEnv } from '../../core/sheet/parse'
import { same } from '../../core/sheet/store'
import type { FileCell } from './read'

/** Başlık karşılaştırması: büyük/küçük harf, işaretler (ş→s, İ→i), ardışık boşluk duyarsız. */
export const normalize = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/\s+/g, ' ').trim()

const filled = (c: FileCell) => c !== null && c !== ''

/** Hücrenin metni: önizleme, anahtar ve başlık için. Tarih Excel'in gününden (UTC) `Y-m-d`. */
export function cellText(c: FileCell): string {
  if (c === null) return ''
  if (typeof c === 'string') return c
  if (typeof c === 'boolean') return String(c)
  if (c instanceof Date) return c.toISOString().slice(0, 10)
  return c.num
}

/**
 * İlk 20 satırda dolu hücresi en çok ve hücrelerinin çoğu metin olan ilk satır; yoksa ilk dolu satır. -1: dosya boş.
 */
export function detectHeaderRow(rows: FileCell[][]): number {
  let best = -1
  let most = 0
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cells = rows[i]!.filter(filled)
    const texts = cells.filter((c) => typeof c === 'string').length
    if (cells.length > most && texts * 2 > cells.length) {
      best = i
      most = cells.length
    }
  }
  return best >= 0 ? best : rows.findIndex((r) => r.some(filled))
}

/**
 * Her dosya sütunu için alan id'si ya da null. Yalnız tek ve kesin eşleşme: başlık sütunun `header`'ı, dışa aktarmanın
 * yazdığı tam adı (gruplu sütunda "Grup · Ad"), `id`'si ya da `importAliases`'ından biriyle aynıysa ve bunu tek alan
 * veriyorsa. Bir alan iki dosya sütununa verilmez (ilki alır).
 */
export function matchColumns<Row extends object>(
  headers: string[],
  fields: Array<ColumnDef<Row>>,
): Array<string | null> {
  const used = new Set<string>()
  return headers.map((h) => {
    const key = normalize(h)
    if (!key) return null
    const hits = fields.filter((f) =>
      [f.header, columnName(f), f.id, ...(f.importAliases ?? [])].some((n) => normalize(n) === key),
    )
    const id = hits.length === 1 ? hits[0]!.id : null
    if (!id || used.has(id)) return null
    used.add(id)
    return id
  })
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Dosya hücresi → sütun değeri. undefined: boş hücre, mevcut değer silinmez. Tipli hücre (sayı, tarih, mantıksal)
 * olduğu gibi; metin yerel ayarla çözülür (yapıştırmayla aynı `parseInput`).
 */
export function cellValue<Row extends object>(def: ColumnDef<Row>, c: FileCell, env: ParseEnv): unknown {
  if (c === null || (typeof c === 'string' && c.trim() === '')) return undefined
  if (typeof c === 'object' && 'num' in c && TYPE_SPECS[def.type].numeric) {
    if (isDecimalType(def.type)) return new Decimal(c.num).toFixed()
    return Number(c.num)
  }
  if (typeof c === 'boolean' && def.type === 'boolean') return c
  if (c instanceof Date) {
    const day = c.toISOString().slice(0, 10)
    const text = def.type === 'datetime' ? `${day} ${pad(c.getUTCHours())}:${pad(c.getUTCMinutes())}` : day
    return parseInput(def as ColumnDef, text, env)
  }
  return parseInput(def as ColumnDef, cellText(c), env)
}

export interface ImportPlan {
  /** Tabloya yazılacak hücreler, satır sırasıyla; listenin sonundaki satırlar doğar. */
  cells: Array<{ row: number; col: number; value: unknown }>
  /** Değeri değişecek liste satırı sayısı. */
  updated: number
  /** Listede olmayan anahtarlar (dosyadaki sırayla); boş anahtarlı satırlar ayrıca `blankKeys`. */
  missing: string[]
  blankKeys: number
  /** Dosyada ikinci kez gelen, listede olan anahtar: yeni satır olur, tabloda tekrar hatası alır. */
  repeated: number
  /** Eklenen satır sayısı (boş anahtarlılar dahil; `addNew` kapalıyken listede olmayanlar sayılmaz). */
  added: number
}

/**
 * Dosyanın veri satırları → hücreler. Eşleme anahtar sütunuyla: listede olan anahtar o satırı günceller (anahtar
 * yazılmaz); olmayan `addNew` açıksa yeni satırdır. Aynı anahtar dosyada iki kez: ikincisi yeni satır
 * olur ve tabloda anahtar tekrarı hatası alır (Vue 07 §13). Boş anahtarlı satır her zaman yeni satırdır. `value` ajax eşleşmesini de çözer; undefined atlanır.
 */
export function planImport<Row extends object>(o: {
  data: FileCell[][]
  /** Dosya sütunu → tablo sütun indeksi (`columns` içinde) ya da null. */
  mapping: Array<number | null>
  columns: Array<ColumnDef<Row>>
  rows: readonly Row[]
  keyColumn: string
  addNew: boolean
  value: (def: ColumnDef<Row>, c: FileCell) => unknown
}): ImportPlan {
  const keyCol = o.columns.findIndex((c) => c.id === o.keyColumn)
  const keyFile = o.mapping.indexOf(keyCol)
  const at = new Map<string, number>()
  o.rows.forEach((r, i) => {
    const k = readPath(r, o.keyColumn)
    if (!isEmptyValue(k) && !at.has(String(k).trim())) at.set(String(k).trim(), i)
  })
  const cells: ImportPlan['cells'] = []
  const used = new Set<number>()
  const missing: string[] = []
  let blankKeys = 0
  let repeated = 0
  let updated = 0
  let next = o.rows.length
  for (const line of o.data) {
    if (!line.some(filled)) continue
    const key = keyFile >= 0 ? cellText(line[keyFile] ?? null).trim() : ''
    const hit = key ? at.get(key) : undefined
    let row: number
    if (hit !== undefined && !used.has(hit)) {
      used.add(hit)
      row = hit
    } else {
      // Boş anahtar her zaman yeni satırdır: sunucu numara verir (§3). Dosyada tekrar eden anahtar da yeni satır
      // olur ve tabloda tekrar hatası alır; listede olmayan sayılmaz.
      if (hit !== undefined) repeated++
      else if (key) {
        missing.push(key)
        if (!o.addNew) continue
      } else blankKeys++
      row = next
    }
    const before = cells.length
    o.mapping.forEach((col, j) => {
      if (col === null || (row === hit && col === keyCol)) return
      const def = o.columns[col]!
      const v = o.value(def, line[j] ?? null)
      // Listedeki satırda aynı değer yazılmaz: sayım gerçek değişikliği söyler (dışa aktarıp geri almak 0 günceller).
      if (v === undefined || (row === hit && same(readPath(o.rows[row]!, def.id), v))) return
      cells.push({ row, col, value: v })
    })
    if (row === hit) {
      if (cells.length > before) updated++
    } else if (cells.length > before) next++
  }
  return { cells, updated, missing, blankKeys, repeated, added: next - o.rows.length }
}
