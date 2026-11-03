import js from '@eslint/js'
import { defineConfig } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// 01 · TanStack sınırı (D23): TanStack Table yalnızca bu dosyalarda yaşar.
const TANSTACK_HOSTS = ['src/core/columns/use-column-layout.ts', 'src/list/use-list-table.ts']
const TANSTACK_PATTERN = {
  group: ['@tanstack/react-table', '@tanstack/react-table/*', '@tanstack/table-core', '@tanstack/table-core/*'],
  message: 'TanStack Table yalnızca use-column-layout / use-list-table içinde (01 · TanStack sınırı, D23).',
}

// 01 · Klasör yapısı: core/ list/'i bilmez. Sheet gelince buraya eklenir (R1).
const LAYERS = { core: ['list'] }

const restrict = (patterns) => ({ 'no-restricted-imports': ['error', { patterns }] })

const boundaryConfigs = Object.entries(LAYERS).flatMap(([dir, banned]) => {
  const layer = {
    group: banned.map((b) => `**/${b}/**`),
    message: `${dir}/ yalnızca core/ import eder (01 · klasör yapısı).`,
  }
  const hosts = TANSTACK_HOSTS.filter((h) => h.startsWith(`src/${dir}/`))
  return [
    { files: [`src/${dir}/**`], ignores: hosts, rules: restrict([layer, TANSTACK_PATTERN]) },
    { files: hosts, rules: restrict([layer]) },
  ]
})

export default defineConfig([
  { ignores: ['dist/**', 'node_modules/**', 'docs/**', 'playwright-report/**', 'test-results/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  ...boundaryConfigs,
  // list/ katmanı TanStack'i yalnızca use-list-table'da kullanır; core/ dışındaki diğer klasörler de aynı kurala bağlı.
  { files: ['src/list/**'], ignores: TANSTACK_HOSTS, rules: restrict([TANSTACK_PATTERN]) },
])
