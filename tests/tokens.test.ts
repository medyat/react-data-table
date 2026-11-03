// @vitest-environment node
// Faz 0 kabul kriteri: 02'deki her token tokens.css'te, light ve dark; değerler tablolarla birebir.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { docTokens, hasSpec } from '../scripts/docs.ts'

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')

/** `selector { --a: b; }` bloklarını { selector: { --a: 'b' } } olarak okur. */
function blocks(src: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {}
  for (const m of src.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selector = m[1]!.replace(/\/\*[\s\S]*?\*\//g, '').trim()
    const vars: Record<string, string> = {}
    for (const decl of m[2]!.split(';')) {
      const i = decl.indexOf(':')
      if (i > 0) vars[decl.slice(0, i).trim()] = decl.slice(i + 1).trim()
    }
    out[selector] = vars
  }
  return out
}

const b = blocks(css)

describe.skipIf(!hasSpec())('tokens.css ↔ 02-design-tokens.md', () => {
  const doc = docTokens()
  it('parser dokümanı gerçekten okuyor', () => {
    expect(Object.keys(doc.light).length).toBeGreaterThan(70)
    expect(Object.keys(doc.fixed)).toHaveLength(33) // 12 + ölçek (D41)
    expect(Object.keys(doc.density.standard)).toHaveLength(10)
  })
  it('her token iki temada da var', () => {
    expect(Object.keys(doc.dark).sort()).toEqual(Object.keys(doc.light).sort())
  })
  it("light + temadan bağımsız token'lar", () => {
    expect(b[':root, [data-theme="light"]']).toEqual({ ...doc.light, ...doc.fixed })
  })
  it('dark: .dark sınıfı ve data-theme="dark" aynı blok', () => {
    expect(b['.dark, [data-theme="dark"]']).toEqual(doc.dark)
  })
  it('yoğunluk blokları', () => {
    expect(b[':root, [data-density="standard"]']).toEqual(doc.density.standard)
    expect(b['[data-density="comfortable"]']).toEqual(doc.density.comfortable)
    expect(b['[data-density="compact"]']).toEqual(doc.density.compact)
  })
})
