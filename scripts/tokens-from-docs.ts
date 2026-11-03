// 02-design-tokens.md → src/styles/tokens.css. Çalıştır: pnpm gen:docs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { docTokens } from './docs.ts'

const block = (selector: string, vars: Record<string, string>): string =>
  `${selector} {\n${Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')}\n}\n`

const { light, dark, fixed, density } = docTokens()

const css =
  `/* Üretilmiş dosya: scripts/tokens-from-docs.ts ← data-table/docs/data-table/02-design-tokens.md. Elle düzenlemeyin; dokümanı değiştirip \`pnpm gen:docs\` çalıştırın. */\n\n` +
  block(':root, [data-theme="light"]', { ...light, ...fixed }) +
  '\n' +
  block('.dark, [data-theme="dark"]', dark) +
  '\n/* Yoğunluk: bileşen kökü data-density taşır; :root varsayılanı standard. */\n' +
  block(':root, [data-density="standard"]', density.standard) +
  '\n' +
  block('[data-density="comfortable"]', density.comfortable) +
  '\n' +
  block('[data-density="compact"]', density.compact)

const out = fileURLToPath(new URL('../src/styles/tokens.css', import.meta.url))
writeFileSync(out, css)
console.log(
  `tokens.css: ${Object.keys(light).length} renk/gölge, ${Object.keys(fixed).length} sabit, ${Object.keys(density.standard).length} yoğunluk token'ı`,
)
