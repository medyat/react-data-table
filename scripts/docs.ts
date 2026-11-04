// Spesifikasyon Vue paketindedir (docs/react-kararlar.md); markdown tablolarını okur. Hem üretici script'ler
// hem testler kullanır: 02 → tokens.css, 09 → core/i18n/{en,tr}.ts. Parser dokümanların tablo biçimine bağlıdır.
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Yalnızca Node ortamında çalışır (script'ler ve node ortamlı testler); jsdom'da import.meta.url http şemalı olur.
// Kardeş repo varsayılandır; CI gibi başka bir yerleşimde DT_SPEC ile verilir.
const DOCS = process.env.DT_SPEC ?? fileURLToPath(new URL('../../data-table/docs/data-table/', import.meta.url))

/** Spesifikasyon yoksa doküman karşılaştırmalı testler atlanır; üretilmiş dosyalar repoda olduğu için build etkilenmez. */
export const hasSpec = (): boolean => existsSync(DOCS + '09-i18n.md')

export const readDoc = (name: string): string => readFileSync(DOCS + name, 'utf8')

export interface MdTable {
  heading: string
  header: string[]
  rows: string[][]
}

/** Markdown tablolarını (başlık satırı + satırlar) bulunduğu bölüm başlığıyla döndürür. */
export function tables(md: string): MdTable[] {
  const out: MdTable[] = []
  let heading = ''
  let cur: MdTable | null = null
  for (const line of md.split('\n')) {
    const h = /^#{2,3} (.*)/.exec(line)
    if (h) {
      heading = h[1]!
      cur = null
      continue
    }
    if (!line.startsWith('|')) {
      cur = null
      continue
    }
    const cells = line
      .replace(/^\|/, '')
      .replace(/\|\s*$/, '')
      .split('|')
      .map((s) => s.trim())
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue
    if (!cur) {
      cur = { heading, header: cells, rows: [] }
      out.push(cur)
    } else cur.rows.push(cells)
  }
  return out
}

const codes = (cell: string | undefined): string[] => [...(cell ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1]!)
const px = (s: string): string => s.replace(/(\d)\s+px\b/g, '$1px').trim()

export type Density = 'comfortable' | 'standard' | 'compact'
export interface DocTokens {
  light: Record<string, string>
  dark: Record<string, string>
  /** Temadan bağımsız: tipografi ve yarıçap. */
  fixed: Record<string, string>
  density: Record<Density, Record<string, string>>
}

/** 02-design-tokens.md'deki tüm `--dt-*` token'ları. */
export function docTokens(): DocTokens {
  const light: Record<string, string> = {}
  const dark: Record<string, string> = {}
  const fixed: Record<string, string> = {}
  const density: DocTokens['density'] = { comfortable: {}, standard: {}, compact: {} }
  const DENSITIES: Density[] = ['comfortable', 'standard', 'compact']

  for (const t of tables(readDoc('02-design-tokens.md'))) {
    const h = t.header.map((s) => s.toLowerCase())
    if (h[0] === 'token' && h[1] === 'light' && h[2] === 'dark') {
      // Renk tabloları. "`a` / `b`" satırları iki token; dark boş ya da "aynı" ise light değeri.
      for (const r of t.rows) {
        const names = codes(r[0])
        const lv = codes(r[1])
        const dv = codes(r[2])
        names.forEach((n, i) => {
          light[n] = lv[i]!
          dark[n] = dv.length ? dv[i]! : lv[i]!
        })
      }
    } else if (h[0] === 'ton' && h[1] === 'ad') {
      for (const r of t.rows) {
        const id = codes(r[0])[0]!
        const lv = codes(r[2])
        const dv = codes(r[3])
        ;(['bg', 'fg', 'dot'] as const).forEach((k, i) => {
          light[`--dt-${id}-${k}`] = lv[i]!
          dark[`--dt-${id}-${k}`] = dv[i]!
        })
      }
    } else if (h[0] === 'token' && h[1] === 'değer') {
      for (const r of t.rows) fixed[codes(r[0])[0]!] = px(codes(r[1])[0] ?? r[1]!)
    } else if (h[0] === 'token' && h[1] === 'comfortable') {
      for (const r of t.rows) {
        const n = codes(r[0])[0]!
        DENSITIES.forEach((d, i) => (density[d][n] = px(r[i + 1]!)))
      }
    } else if (h[0] === 'token' && h[1] === 'light' && h.length === 2) {
      // Gölgeler (light). "`--dt-shadow-pin-l` / `-r`" satırı ± ile iki token yazar.
      for (const r of t.rows) {
        const names = codes(r[0])
        const v = codes(r[1])[0]!
        if (names.length === 2 && names[1]!.startsWith('-')) {
          const base = names[0]!
          light[base] = v.replaceAll('±', '')
          light[base.replace(/-l$/, '') + names[1]!] = v.replaceAll('±', '-')
        } else light[names[0]!] = v
      }
    } else if (h[0] === 'token' && h[1] === 'dark' && h.length === 2) {
      for (const r of t.rows) dark[codes(r[0])[0]!] = codes(r[1])[0]!
    }
  }
  for (const n of Object.keys(light)) if (!(n in dark)) dark[n] = light[n]!
  return { light, dark, fixed, density }
}

export interface DocMessages {
  en: Record<string, string>
  tr: Record<string, string>
}

// R1: sheet ve içe aktarma bu pakette yok; metinleri de taşınmaz. Telefon ⋯ › Export başlığı sheet bölümünden alınır.
const SKIPPED_SECTIONS = ['Toplu düzenleme (sheet)', 'İçe aktarma']
const KEPT_KEYS = ['sheet.export']

// React'in bilinçli sapmaları (Vue'ya taşınmaz; docs/react-kararlar.md · Faz 7c): anahtar → [EN, TR], dokümandakini ezer.
const REACT_MESSAGES: Record<string, [string, string]> = {
  // WCAG 2.5.3: eksik çipin adı görünen metinle ("Status is Select…") başlar.
  'filter.chooseValueAria': ['{column} {op} {value}. Choose a value', '{column} {op} {value}. Bir değer seçin'],
}

/** 09-i18n.md'deki anahtar tabloları: `| \`key\` | EN | TR |`. */
export function docMessages(): DocMessages {
  const en: Record<string, string> = {}
  const tr: Record<string, string> = {}
  for (const t of tables(readDoc('09-i18n.md'))) {
    const skipped = SKIPPED_SECTIONS.includes(t.heading)
    for (const r of t.rows) {
      const m = /^`([a-z][A-Za-z0-9_.]*)`$/.exec(r[0] ?? '')
      if (!m || r.length !== 3) continue
      const key = m[1]!
      if (skipped && !KEPT_KEYS.includes(key)) continue
      if (key in en) throw new Error(`09-i18n.md: anahtar iki kez tanımlı: ${key}`)
      en[key] = r[1]!
      tr[key] = r[2]!
    }
  }
  for (const [key, [e, t]] of Object.entries(REACT_MESSAGES)) {
    if (!(key in en)) throw new Error(`REACT_MESSAGES: dokümanda olmayan anahtar: ${key}`)
    en[key] = e
    tr[key] = t
  }
  return { en, tr }
}
