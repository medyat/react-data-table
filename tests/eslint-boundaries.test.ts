// @vitest-environment node
// Faz 0 kabul kriteri: ESLint, grid/'den TanStack import'unu reddeder; katman sınırları (01) çalışır.
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint({ cwd: fileURLToPath(new URL('..', import.meta.url)) })
const TANSTACK = "import { useReactTable } from '@tanstack/react-table'\nexport const x = useReactTable"

async function restricted(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })
  return result!.messages.filter((m) => m.ruleId === 'no-restricted-imports').map((m) => m.message)
}

describe('import sınırları', () => {
  it('grid/ ve list/ bileşenleri TanStack Table import edemez', async () => {
    for (const f of ['src/core/grid/row.tsx', 'src/list/data-table.tsx']) {
      const msgs = await restricted(f, TANSTACK)
      expect(msgs, f).toHaveLength(1)
      expect(msgs[0]).toContain('TanStack')
    }
  })
  it('use-column-layout ve use-list-table edebilir', async () => {
    for (const f of ['src/core/columns/use-column-layout.ts', 'src/list/use-list-table.ts']) {
      expect(await restricted(f, TANSTACK), f).toEqual([])
    }
  })
  it("core/ list/'i import edemez, list/ core/'u edebilir", async () => {
    expect(
      await restricted('src/core/cells/x.ts', "import { a } from '../../list/use-list-table'\nexport const b = a"),
    ).toHaveLength(1)
    expect(await restricted('src/list/x.ts', "import { a } from '../core/provider'\nexport const b = a")).toEqual([])
  })
})
