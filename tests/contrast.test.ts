// @vitest-environment node
// Faz 0 kabul kriteri: 08 §6'daki token çiftleri WCAG AA'yı (metin 4.5:1) geçer. Hesaplamalı, tarayıcı yok.
import { describe, expect, it } from 'vitest'
import { docTokens, hasSpec } from '../scripts/docs.ts'

type RGB = [number, number, number]

function parse(color: string): { rgb: RGB; a: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)
  if (hex) {
    const n = parseInt(hex[1]!, 16)
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], a: 1 }
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/.exec(color)
  if (rgba) return { rgb: [+rgba[1]!, +rgba[2]!, +rgba[3]!], a: rgba[4] === undefined ? 1 : +rgba[4] }
  throw new Error(`renk okunamadı: ${color}`)
}

/** Yarı saydam zemin, temanın --dt-surface'i üzerine bindirilir. */
const over = (c: { rgb: RGB; a: number }, base: RGB): RGB =>
  c.rgb.map((v, i) => Math.round(v * c.a + base[i]! * (1 - c.a))) as RGB

const channel = (v: number): number => {
  const s = v / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const luminance = ([r, g, b]: RGB): number => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
const ratio = (a: RGB, b: RGB): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const TONES = ['n', 'b', 'g', 'a', 'r', 'v', 'p', 'c']
const TEXT_PAIRS: Array<[fg: string, bg: string]> = [
  ['--dt-text', '--dt-surface'],
  ['--dt-text-2', '--dt-surface'],
  ['--dt-text-3', '--dt-surface'],
  ['--dt-text-2', '--dt-surface-2'],
  ['--dt-text-3', '--dt-surface-2'],
  ['--dt-accent-text', '--dt-accent-soft'],
  ['--dt-on-ink', '--dt-ink'],
  ['--dt-on-accent', '--dt-accent'],
  ['--dt-bulk-fg', '--dt-bulk-bg'],
  ['--dt-bulk-fg-2', '--dt-bulk-bg'],
  ['--dt-bulk-link', '--dt-bulk-bg'],
  ['--dt-tip-fg', '--dt-tip-bg'],
  ...TONES.map((t): [string, string] => [`--dt-${t}-fg`, `--dt-${t}-bg`]),
]

const doc: Pick<ReturnType<typeof docTokens>, 'light' | 'dark'> = hasSpec() ? docTokens() : { light: {}, dark: {} }

describe.skipIf(!hasSpec()).each([
  ['light', doc.light],
  ['dark', doc.dark],
])('kontrast · %s', (_theme, tokens) => {
  // Gövde atlanan suite'te de çalışır; renkler yalnızca test içinde çözülür.
  const resolve = (name: string): RGB => over(parse(tokens[name]!), parse(tokens['--dt-surface']!).rgb)

  it.each(TEXT_PAIRS)('%s / %s ≥ 4.5', (fg, bg) => {
    expect(ratio(resolve(fg), resolve(bg))).toBeGreaterThanOrEqual(4.5)
  })
})
