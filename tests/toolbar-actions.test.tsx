// R25: araç çubuğu eylemleri. Ölçüm jsdom'da 0 olduğundan her şey sığar; sığdırma hesabı toolbar-fit.test.ts'te.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ArchiveIcon, DownloadIcon, PlusIcon } from '@phosphor-icons/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DataTableProvider } from '../src/core/provider'
import { DataTable } from '../src/list/data-table'
import { useDataTable } from '../src/list/use-data-table'
import type { ColumnDef, PrimaryAction, ToolbarAction } from '../src/types'
import { flush, mockLayout } from './helpers/dom'

interface Row {
  id: number
  name: string
}
const columns: Array<ColumnDef<Row>> = [{ id: 'name', header: 'Name', type: 'string', primary: true }]

function Harness({ primary, actions }: { primary?: PrimaryAction; actions?: ToolbarAction[] }) {
  const table = useDataTable<Row>({
    id: 'rows',
    columns,
    rows: [{ id: 1, name: 'A' }],
    entityName: { one: 'row', other: 'rows' },
  })
  return <DataTable table={table} primaryAction={primary} actions={actions} />
}

beforeAll(mockLayout)
afterEach(cleanup)

describe('araç çubuğu eylemleri (R25)', () => {
  it('birincil ve ikincil düğmedir; menu olan yalnızca ⋯ içinde, aç/kapa işaretli', async () => {
    const add = vi.fn()
    const load = vi.fn()
    const archive = vi.fn()
    render(
      <DataTableProvider>
        <Harness
          primary={{ label: 'New row', icon: PlusIcon, run: add }}
          actions={[
            { id: 'load', label: 'Load holidays', icon: DownloadIcon, run: load },
            { id: 'archive', label: 'Archive', icon: ArchiveIcon, checked: true, menu: true, run: archive },
          ]}
        />
      </DataTableProvider>,
    )
    await flush()
    const bar = screen.getByRole('toolbar')
    fireEvent.click(screen.getByRole('button', { name: 'New row' }))
    expect(add).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Load holidays' }))
    expect(load).toHaveBeenCalledOnce()
    expect(bar.querySelector('[aria-pressed]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
    const item = await screen.findByRole('menuitemcheckbox', { name: 'Archive' })
    expect(item.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(item)
    expect(archive).toHaveBeenCalledOnce()
  })

  // `.dt-btn.has-icon`'ın sol boşluğu `.dt-btn-icon`'ı ezer: ikon düğmede ortalanmaz, sağa kayar.
  it('yazısız Display düğmesi ikon düğmesidir, yazılı düğmenin sol boşluğunu almaz', async () => {
    render(
      <DataTableProvider>
        <Harness />
      </DataTableProvider>,
    )
    await flush()
    const display = screen.getByRole('button', { name: 'Display' })
    expect(display.classList.contains('dt-btn-icon')).toBe(true)
    expect(display.classList.contains('has-icon')).toBe(false)
  })

  it('iconOnly ikincil yazısız ikon düğmesidir: adı erişilebilir ad, açıklaması tooltip', async () => {
    const load = vi.fn()
    render(
      <DataTableProvider>
        <Harness
          actions={[
            { id: 'import', label: 'Import', description: 'Import rows from Excel', icon: DownloadIcon, iconOnly: true, run: load },
          ]}
        />
      </DataTableProvider>,
    )
    await flush()
    const button = screen.getByRole('button', { name: 'Import' })
    expect(button.textContent).toBe('')
    expect(button.getAttribute('data-dt-tip')).toBe('Import rows from Excel')
    fireEvent.click(button)
    expect(load).toHaveBeenCalledOnce()
  })
})
