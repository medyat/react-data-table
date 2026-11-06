// R21: sıra tutamağı sütunu; varsayılan kapalı, seçimden önce ve sol sabit, pasifken gerekçe. Sürükleme e2e'de (reorder.spec).
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { DataTable } from '../src/list/data-table'
import { useDataTable } from '../src/list/use-data-table'
import type { ColumnDef, RowReorder } from '../src/types'
import { flush, mockLayout } from './helpers/dom'

interface Field {
  id: string
  title: string
}
const rows: Field[] = ['Width', 'Height', 'Pattern'].map((title, i) => ({ id: `f${i}`, title }))
const columns: Array<ColumnDef<Field>> = [{ id: 'title', header: 'Title', type: 'string', primary: true }]

beforeAll(mockLayout)
afterEach(cleanup)

function Table({ reorder }: { reorder?: RowReorder<Field> }) {
  const table = useDataTable({ id: 'fields', columns, rows })
  return <DataTable table={table} label="Fields" selectable reorder={reorder} />
}

const mount = async (reorder?: RowReorder<Field>) => {
  const view = render(<Table reorder={reorder} />)
  await flush()
  const q = (sel: string) => view.container.querySelector<HTMLElement>(sel)!
  const qa = (sel: string) => [...view.container.querySelectorAll<HTMLElement>(sel)]
  return { q, qa }
}

describe('sıra tutamağı', () => {
  it('reorder verilmezse tutamak sütunu yok', async () => {
    const { q, qa } = await mount()
    expect(qa('.dt-row-handle')).toHaveLength(0)
    expect(q('.dt-grid').style.getPropertyValue('--cols').startsWith('40px ')).toBe(true)
  })

  it('seçimden önce, sol sabit; seçim sütunu tutamak kadar kayar', async () => {
    const { q, qa } = await mount({ onMove: () => {} })
    const grid = q('.dt-grid')
    expect(grid.style.getPropertyValue('--cols').startsWith('32px 40px ')).toBe(true)
    expect(grid.getAttribute('aria-colcount')).toBe('4')
    expect(q('.dt-head [role="columnheader"]').classList).toContain('dt-head-handle')
    const row = q('.dt-row[data-index="0"]')
    const [handleCell, selectCell] = [...row.querySelectorAll<HTMLElement>('[role="cell"]')]
    expect(handleCell!.classList).toContain('dt-cell-handle')
    expect(selectCell!.style.left).toBe('32px')
    expect(qa('.dt-row-handle').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Move Width',
      'Move Height',
      'Move Pattern',
    ])
  })

  it('açıkken tutamak sürüklenebilir olarak bağlanır', async () => {
    const { q } = await mount({ onMove: () => {} })
    await waitFor(() => expect(q('.dt-row-handle').getAttribute('aria-roledescription')).toBe('sortable'))
    expect(q('.dt-row-handle').hasAttribute('aria-disabled')).toBe(false)
  })

  it("pasifken gerekçe tooltip'te, sürükleme bağlanmaz", async () => {
    const { q } = await mount({ disabled: 'Choose a scope to reorder', onMove: () => {} })
    const handle = q('.dt-row-handle')
    expect(handle.getAttribute('aria-disabled')).toBe('true')
    expect(handle.dataset.dtTip).toBe('Choose a scope to reorder')
    expect(handle.hasAttribute('aria-roledescription')).toBe(false)
  })
})
