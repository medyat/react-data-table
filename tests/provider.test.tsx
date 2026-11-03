// DataTableProvider, useDataTableContext ve localStorage adapter'ları.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createLocalStoragePreferences, createLocalStorageViews } from '../src/core/adapters/local-storage'
import { DataTableProvider, useDataTableContext } from '../src/core/provider'
import type { ViewState } from '../src/types'

const state: ViewState = {
  filters: [],
  sort: [{ column: 'dueAt', dir: 'asc' }],
  columns: { order: ['a'], visible: ['a'], widths: {}, pinned: { left: [], right: [] } },
}

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('createLocalStorageViews', () => {
  it('scope zorunlu', () => {
    // @ts-expect-error scope eksik
    expect(() => createLocalStorageViews({})).toThrow(TypeError)
  })
  it('oluştur / listele / güncelle / sil; scope ve tableId ayrı tutar', async () => {
    const a = createLocalStorageViews({ scope: 'a' })
    const v = await a.create('orders', { name: 'Gebze', state })
    expect(v.kind).toBe('personal')
    expect(await a.list('orders')).toEqual([v])
    expect(await a.list('products')).toEqual([])
    expect(await createLocalStorageViews({ scope: 'b' }).list('orders')).toEqual([])
    const u = await a.update('orders', v.id, { name: 'Gebze 2' })
    expect(u.name).toBe('Gebze 2')
    expect(u.state).toEqual(state)
    await a.remove('orders', v.id)
    expect(await a.list('orders')).toEqual([])
  })
  it('bozuk kayıt boş liste sayılır', async () => {
    localStorage.setItem('dt:a:views:orders', '{nope')
    expect(await createLocalStorageViews({ scope: 'a' }).list('orders')).toEqual([])
  })
})

describe('createLocalStoragePreferences', () => {
  it('başta boş, set birleştirir', async () => {
    const p = createLocalStoragePreferences({ scope: 'a' })
    expect(await p.get('orders')).toEqual({})
    await p.set('orders', { density: 'compact' })
    await p.set('orders', { pageSize: 250 })
    expect(await p.get('orders')).toEqual({ density: 'compact', pageSize: 250 })
  })
})

function Probe() {
  const ctx = useDataTableContext()
  return (
    <p>{`${ctx.locale}|${ctx.i18n.t('common.cancel')}|${ctx.viewsAdapter ? 'views' : '-'}|${ctx.preferences ? 'prefs' : '-'}`}</p>
  )
}

describe('DataTableProvider', () => {
  it('bağlam sağlar', () => {
    render(
      <DataTableProvider
        locale="tr"
        viewsAdapter={createLocalStorageViews({ scope: 'x' })}
        preferences={createLocalStoragePreferences({ scope: 'x' })}
      >
        <Probe />
      </DataTableProvider>,
    )
    expect(screen.getByRole('paragraph').textContent).toBe('tr|Vazgeç|views|prefs')
  })
  it('en yakın sağlayıcı geçerli; iki tablo birbirini etkilemez', () => {
    render(
      <DataTableProvider locale="tr">
        <Probe />
        <DataTableProvider locale="ru">
          <Probe />
        </DataTableProvider>
      </DataTableProvider>,
    )
    const [outer, inner] = screen.getAllByRole('paragraph')
    expect(outer!.textContent!.startsWith('tr|')).toBe(true)
    expect(inner!.textContent!.startsWith('ru|')).toBe(true)
  })
  it('üst bileşen yeniden çizilince, seçenekler aynıysa bağlam değişmez', () => {
    const preferences = createLocalStoragePreferences({ scope: 'x' })
    const seen = new Set<object>()
    function Spy() {
      seen.add(useDataTableContext())
      return null
    }
    // Çocuk sabit eleman: yeniden çizilirse sebebi yalnızca bağlam değeridir.
    const child = <Spy />
    function Parent() {
      // Derleyicisiz uygulama: Provider her üst çizimde yeni props alır.
      'use no memo'
      const [n, setN] = useState(0)
      return (
        <>
          <button type="button" onClick={() => setN(n + 1)}>
            bump
          </button>
          <DataTableProvider locale="tr" preferences={preferences}>
            {child}
          </DataTableProvider>
        </>
      )
    }
    render(<Parent />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('button'))
    expect(seen.size).toBe(1)
  })
  it('sağlayıcı yokken varsayılan bağlam: paket metinleri, adapter yok', () => {
    render(<Probe />)
    expect(screen.getByRole('paragraph').textContent!.endsWith('|-|-')).toBe(true)
  })
})
