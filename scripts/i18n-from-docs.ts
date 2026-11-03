// 09-i18n.md → src/core/i18n/en.ts ve tr.ts. Çalıştır: pnpm gen:docs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { docMessages } from './docs.ts'

const { en, tr } = docMessages()

const file = (name: string, messages: Record<string, string>): string =>
  `// Üretilmiş dosya: scripts/i18n-from-docs.ts ← data-table/docs/data-table/09-i18n.md (+ docs.ts REACT_MESSAGES). Elle düzenlemeyin; dokümanı değiştirip \`pnpm gen:docs\` çalıştırın.\n` +
  `export const ${name}: Record<string, string> = {\n` +
  Object.entries(messages)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join('\n') +
  '\n}\n'

for (const [name, messages] of [
  ['en', en],
  ['tr', tr],
] as const) {
  writeFileSync(fileURLToPath(new URL(`../src/core/i18n/${name}.ts`, import.meta.url)), file(name, messages))
}
console.log(`i18n: ${Object.keys(en).length} anahtar (en, tr)`)
