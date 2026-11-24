// @vitest-environment node
// FormGrid B adımı: depo (seçim, düzenleme, yazma, geri al) ve klavye niyetleri; DOM yok.
import { describe, expect, it, vi } from 'vitest'
import { applyIntent, keyIntent, type KeyInput } from '../src/core/sheet/keyboard'
import { CELL, createSheetStore, type SheetChange } from '../src/core/sheet/store'
import type { ColumnDef } from '../src/types'

interface Line {
  code: string | null
  qty: number | null
  unit: string | null
  done?: boolean | null
  detail?: { term?: string | null }
}
const columns: Array<ColumnDef<Line>> = [
  { id: 'code', header: 'Ürün', type: 'string', editable: (_r, { isNew }) => isNew },
  { id: 'qty', header: 'Miktar', type: 'decimal' },
  { id: 'unit', header: 'Birim', type: 'select', options: [{ value: 'pcs', label: 'Adet' }] },
  { id: 'done', header: 'Tamam', type: 'boolean' },
  { id: 'detail.term', header: 'Teslim', type: 'string' },
]

/** Uygulamayı taklit eder: `onRowsChange` gelen diziyi tutar ve depoyu onunla senkronlar (render gibi). */
function setup(
  initial: Line[] = [
    { code: 'A', qty: 1, unit: 'pcs' },
    { code: 'B', qty: 2, unit: null },
  ],
) {
  const changes: SheetChange[] = []
  let rows = initial
  const onRowsChange = vi.fn((next: Line[], change: SheetChange) => {
    rows = next
    changes.push(change)
  })
  const store = createSheetStore<Line>({ rows, columns, onRowsChange })
  const render = () => store.sync({ rows, columns, onRowsChange })
  return { store, changes, rows: () => rows, render, onRowsChange }
}

describe('seçim ve hareket', () => {
  it('ok tuşları sınırda durur; satır sayısına boş satır dahil', () => {
    const { store } = setup()
    expect(store.rowCount()).toBe(3)
    store.focus({ row: 0, col: 0 })
    store.move('up')
    store.move('left')
    expect(store.active()).toEqual({ row: 0, col: 0 })
    for (let i = 0; i < 10; i++) store.move('down')
    expect(store.active()).toEqual({ row: 2, col: 0 })
  })
  it('Tab satır sonunda sonraki satırın başına, ⇧Tab tersine', () => {
    const { store } = setup()
    store.focus({ row: 0, col: 4 })
    store.tab(false)
    expect(store.active()).toEqual({ row: 1, col: 0 })
    store.tab(true)
    expect(store.active()).toEqual({ row: 0, col: 4 })
  })
  it('⇧ ok aralık seçer; cellState kenarları verir; Esc aktif hücreye daraltır', () => {
    const { store } = setup()
    store.focus({ row: 0, col: 1 })
    store.move('down', true)
    store.move('right', true)
    expect(store.range()).toEqual({ top: 0, bottom: 1, left: 1, right: 2 })
    expect(store.cellState(0, 1)).toBe(CELL.selected | CELL.top | CELL.left)
    expect(store.cellState(1, 2)).toBe(CELL.active | CELL.selected | CELL.bottom | CELL.right)
    expect(store.cellState(2, 2)).toBe(0)
    store.collapse()
    expect(store.cellState(1, 2)).toBe(CELL.active)
  })
  it('⌘ + yön en sona: son dolu satıra (boş satıra değil), ilk satıra, satırın ilk/son sütununa; ⇧ ile seçerek', () => {
    const { store } = setup()
    store.focus({ row: 0, col: 1 })
    store.jump('down')
    expect(store.active()).toEqual({ row: 1, col: 1 })
    store.jump('right')
    expect(store.active()).toEqual({ row: 1, col: 4 })
    store.jump('up', true)
    expect(store.range()).toEqual({ top: 0, bottom: 1, left: 4, right: 4 })
    store.jump('left', true)
    expect(store.range()).toEqual({ top: 0, bottom: 1, left: 0, right: 4 })
    // Boş satırdayken ⌘↑ ilk satıra, ⌘↓ yerinde kalır.
    store.focus({ row: 2, col: 0 })
    store.jump('down')
    expect(store.active()).toEqual({ row: 2, col: 0 })
  })
  it('satır, sütun, tümü; Home/End, ana tuşla ilk/son satır; sayfa', () => {
    const { store } = setup()
    store.focus({ row: 1, col: 2 })
    store.selectRow()
    expect(store.range()).toEqual({ top: 1, bottom: 1, left: 0, right: 4 })
    store.selectColumn()
    expect(store.range()).toEqual({ top: 0, bottom: 1, left: 4, right: 4 })
    store.selectAll()
    expect(store.range()).toEqual({ top: 0, bottom: 1, left: 0, right: 4 })
    store.edge(false, true)
    expect(store.active()).toEqual({ row: 0, col: 0 })
    store.edge(true, false)
    expect(store.active()).toEqual({ row: 0, col: 4 })
    store.page(1, 10)
    expect(store.active()).toEqual({ row: 2, col: 4 })
  })
  it('hücre yalnız kendi bayrağı değişince farklı değer görür', () => {
    const { store } = setup()
    store.focus({ row: 0, col: 0 })
    const before = store.cellState(1, 3)
    store.move('right')
    expect(store.cellState(1, 3)).toBe(before)
  })
})

describe('düzenleme ve yazma', () => {
  it('F2 mevcut değerle, yazmak harfle açar; onay yeni diziyle onRowsChange çağırır, eski dizi değişmez', () => {
    const { store, changes, rows } = setup()
    const old = rows()
    store.focus({ row: 0, col: 1 })
    expect(store.startEdit()).toBe(true)
    expect(store.editing()?.draft).toBe(1)
    expect(store.cellState(0, 1) & CELL.editing).toBeTruthy()
    store.setDraft(5)
    store.commit()
    expect(rows()[0]).toEqual({ code: 'A', qty: 5, unit: 'pcs' })
    expect(old[0]!.qty).toBe(1)
    expect(changes).toEqual([{ kind: 'edit', cells: [{ row: 0, column: 'qty' }] }])
    expect(store.startEdit('7')).toBe(true)
    expect(store.editing()).toMatchObject({ draft: '7', text: '7' })
    store.cancel()
    expect(store.editing()).toBeNull()
  })
  it('aynı değer yazılmaz; "" null olur; nokta yolu iç nesneyi kopyalayarak yazar', () => {
    const { store, onRowsChange, rows, render } = setup()
    store.focus({ row: 1, col: 1 })
    store.startEdit()
    store.commit()
    expect(onRowsChange).not.toHaveBeenCalled()
    store.focus({ row: 1, col: 4 })
    store.startEdit('x')
    store.setDraft('Fob')
    store.commit()
    render()
    expect(rows()[1]!.detail).toEqual({ term: 'Fob' })
    store.startEdit()
    store.setDraft('')
    store.commit()
    expect(rows()[1]!.detail).toEqual({ term: null })
  })
  it('başka hücreye geçmek açık düzenlemeyi onaylar', () => {
    const { store, rows } = setup()
    store.focus({ row: 0, col: 1 })
    store.startEdit('9')
    store.setDraft(9)
    store.focus({ row: 1, col: 1 })
    expect(rows()[0]!.qty).toBe(9)
    expect(store.editing()).toBeNull()
  })
  it('boş satıra yazmak satırı doğurur (kind edit); boş değer satır doğurmaz', () => {
    const { store, rows, changes, render } = setup()
    store.focus({ row: 2, col: 1 })
    store.startEdit('')
    store.commit()
    expect(rows()).toHaveLength(2)
    store.startEdit('3')
    store.setDraft(3)
    store.commit()
    render()
    expect(rows()).toHaveLength(3)
    expect(rows()[2]).toEqual({ qty: 3 })
    expect(changes.at(-1)).toEqual({ kind: 'edit', cells: [{ row: 2, column: 'qty' }] })
    expect(store.rowCount()).toBe(4)
    expect(store.isNew(2)).toBe(true)
    expect(store.isNew(0)).toBe(false)
  })
  it('editable(row, { isNew }): açılıştaki satırda kilitli, yeni satırda açık; boolean düzenlenmez, Space çevirir', () => {
    const { store, rows, render } = setup()
    store.focus({ row: 0, col: 0 })
    expect(store.startEdit('x')).toBe(false)
    store.focus({ row: 2, col: 0 })
    expect(store.canEdit(2, 0)).toBe(true)
    store.focus({ row: 0, col: 3 })
    expect(store.startEdit()).toBe(false)
    store.toggle()
    render()
    expect(rows()[0]!.done).toBe(true)
    store.toggle()
    expect(rows()[0]!.done).toBe(false)
  })
  it('Delete seçimdeki düzenlenebilir hücreleri tek adımda boşaltır, kilitli olanı bırakır', () => {
    const { store, rows, changes } = setup()
    store.focus({ row: 0, col: 0 })
    store.move('right', true)
    store.move('down', true)
    store.clear()
    expect(rows().map((r) => [r.code, r.qty])).toEqual([
      ['A', null],
      ['B', null],
    ])
    expect(changes).toHaveLength(1)
  })
})

describe('geri al', () => {
  it('⌘Z / ⌘⇧Z adım adım; aktif hücre değişen hücreye gider', () => {
    const { store, rows, render } = setup()
    store.focus({ row: 1, col: 1 })
    store.startEdit('5')
    store.setDraft(5)
    store.commit()
    render()
    store.focus({ row: 0, col: 3 })
    store.toggle()
    render()
    store.undo()
    render()
    expect(rows()[0]!.done).toBeFalsy()
    store.undo()
    render()
    expect(rows()[1]!.qty).toBe(2)
    expect(store.active()).toEqual({ row: 1, col: 1 })
    expect(store.canUndo()).toBe(false)
    store.redo()
    render()
    expect(rows()[1]!.qty).toBe(5)
    expect(store.canRedo()).toBe(true)
  })
  it('uygulamanın sonradan yazdığı hücre geri alınmaz; kullanıcınınki alınır', () => {
    const { store, rows, render, onRowsChange } = setup()
    store.focus({ row: 0, col: 1 })
    store.startEdit('9')
    store.setDraft(9)
    store.commit()
    store.focus({ row: 0, col: 2 })
    store.startEdit('x')
    store.setDraft(null)
    store.commit()
    render()
    // İki ayrı adım; ikincisi Birim'i boşalttı. Uygulama Birim'e fiyat isteğinden dönen değeri yazar.
    const appRows = rows().map((r, i) => (i === 0 ? { ...r, unit: 'pcs' } : r))
    store.sync({ rows: appRows, columns, onRowsChange })
    store.undo() // Birim adımı: hücre uygulamanınki → atlanır
    expect(appRows[0]!.unit).toBe('pcs')
    store.undo() // Miktar adımı: kullanıcınınki → geri gelir
    render()
    expect(rows()[0]).toMatchObject({ qty: 1, unit: 'pcs' })
  })
  it('doğan satır geri alınınca kalkar, yinelenince değeriyle geri gelir', () => {
    const { store, rows, render } = setup()
    store.focus({ row: 2, col: 1 })
    store.startEdit('4')
    store.setDraft(4)
    store.commit()
    render()
    store.undo()
    render()
    expect(rows()).toHaveLength(2)
    store.redo()
    render()
    expect(rows()[2]).toEqual({ qty: 4 })
  })
  it('düzenleme açıkken geri al çalışmaz (editörün kendi geri alı); 100 adım sınırı', () => {
    const { store, render } = setup()
    store.focus({ row: 0, col: 1 })
    for (let i = 0; i < 105; i++) {
      store.startEdit(String(i))
      store.setDraft(i + 100)
      store.commit()
      render()
    }
    store.startEdit()
    store.undo()
    expect(store.editing()).not.toBeNull()
    store.cancel()
    let n = 0
    while (store.canUndo()) {
      store.undo()
      render()
      n++
    }
    expect(n).toBe(100)
  })
})

const key = (k: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...mods,
})
const mac = { editing: false, multiline: false, mac: true }
const win = { ...mac, mac: false }

describe('keyIntent', () => {
  it('tek ana tuş: Mac ⌘, Windows Ctrl; ⌥ + ok ızgara tuşu değil', () => {
    expect(keyIntent(key('z', { metaKey: true }), mac)).toEqual({ type: 'undo' })
    expect(keyIntent(key('z', { ctrlKey: true }), mac)).toBeNull()
    expect(keyIntent(key('z', { ctrlKey: true }), win)).toEqual({ type: 'undo' })
    expect(keyIntent(key('Z', { metaKey: true, shiftKey: true }), mac)).toEqual({ type: 'redo' })
    expect(keyIntent(key('y', { ctrlKey: true }), win)).toEqual({ type: 'redo' })
    expect(keyIntent(key('ArrowDown', { metaKey: true }), mac)).toEqual({ type: 'jump', dir: 'down', extend: false })
    expect(keyIntent(key('ArrowLeft', { metaKey: true, shiftKey: true }), mac)).toEqual({
      type: 'jump',
      dir: 'left',
      extend: true,
    })
    expect(keyIntent(key('ArrowDown', { ctrlKey: true }), win)).toEqual({ type: 'jump', dir: 'down', extend: false })
    expect(keyIntent(key('ArrowDown', { ctrlKey: true }), mac)).toBeNull()
    expect(keyIntent(key('ArrowDown', { altKey: true }), win)).toBeNull()
    expect(keyIntent(key('ArrowDown', { shiftKey: true }), win)).toEqual({ type: 'move', dir: 'down', extend: true })
  })
  it('⌥↵ menü; Enter alt, ⇧Enter üst hücre; F2 düzenler; harf yazarak açar; Space, ⇧Space, ⌃Space', () => {
    expect(keyIntent(key('Enter', { altKey: true }), mac)).toEqual({ type: 'menu' })
    expect(keyIntent(key('Enter'), mac)).toEqual({ type: 'move', dir: 'down', extend: false })
    expect(keyIntent(key('Enter', { shiftKey: true }), mac)).toEqual({ type: 'move', dir: 'up', extend: false })
    expect(keyIntent(key('F2'), mac)).toEqual({ type: 'edit' })
    expect(keyIntent(key('ş'), mac)).toEqual({ type: 'type', text: 'ş' })
    expect(keyIntent(key('ş', { altKey: true }), mac)).toBeNull()
    expect(keyIntent(key(' '), mac)).toEqual({ type: 'toggle' })
    expect(keyIntent(key(' ', { shiftKey: true }), mac)).toEqual({ type: 'selectRow' })
    expect(keyIntent(key(' ', { ctrlKey: true }), mac)).toEqual({ type: 'selectColumn' })
    expect(keyIntent(key('F8', { shiftKey: true }), mac)).toEqual({ type: 'error', dir: -1 })
    expect(keyIntent(key('d', { metaKey: true }), mac)).toEqual({ type: 'fill' })
  })
  it('düzenlemede: Tab/Enter onaylayıp geçer, Esc iptal; text hücresinde ⇧↵ ve ⌥↵ editöre kalır; IME bekler', () => {
    const ed = { ...mac, editing: true }
    expect(keyIntent(key('Enter'), ed)).toEqual({ type: 'commit', then: 'down' })
    expect(keyIntent(key('Tab', { shiftKey: true }), ed)).toEqual({ type: 'commit', then: 'back' })
    expect(keyIntent(key('Escape'), ed)).toEqual({ type: 'cancel' })
    expect(keyIntent(key('ArrowLeft'), ed)).toBeNull()
    expect(keyIntent(key('Enter', { altKey: true }), { ...ed, multiline: true })).toBeNull()
    expect(keyIntent(key('Enter', { shiftKey: true }), { ...ed, multiline: true })).toBeNull()
    expect(keyIntent(key('Enter'), { ...ed, multiline: true })).toEqual({ type: 'commit', then: 'down' })
    expect(keyIntent(key('a', { isComposing: true }), mac)).toBeNull()
  })
  it('applyIntent: commit sonra Tab; menü ve hata ızgaraya kalır', () => {
    const { store, rows } = setup()
    store.focus({ row: 0, col: 1 })
    applyIntent(store, { type: 'type', text: '8' }, { pageSize: 5 })
    store.setDraft(8)
    expect(applyIntent(store, { type: 'commit', then: 'tab' }, { pageSize: 5 })).toBe(true)
    expect(rows()[0]!.qty).toBe(8)
    expect(store.active()).toEqual({ row: 0, col: 2 })
    expect(applyIntent(store, { type: 'menu' }, { pageSize: 5 })).toBe(false)
  })
})

describe('satır kimliği', () => {
  it('uygulama satırları kopyalayınca (form kütüphanesi) seçim kimliği, yenilik ve geri al sürer', () => {
    const { store, rows, render, onRowsChange } = setup()
    store.focus({ row: 0, col: 1 })
    store.startEdit('3')
    store.setDraft(3)
    store.commit()
    const cloned = rows().map((r) => structuredClone(r))
    store.sync({ rows: cloned, columns, onRowsChange })
    expect(store.isNew(0)).toBe(false)
    store.undo()
    render()
    expect(rows()[0]!.qty).toBe(1)
  })
})

describe('F2: newRow, maxRows, onChange, ajax', () => {
  type P = { product: number | null; title: string | null; unit: string | null; qty: string | null }
  const products = [{ value: 7, label: 'Vida', unit: 'pcs' }]
  const cols: Array<ColumnDef<P>> = [
    {
      id: 'product',
      header: 'Ürün',
      type: 'ajax',
      remote: { search: async () => ({ items: products, hasMore: false }), resolve: async () => products },
      onChange: (_row, _value, { option }) => ({
        title: option?.label ?? null,
        unit: (option as { unit?: string })?.unit,
      }),
    },
    { id: 'title', header: 'Ad', type: 'string' },
    { id: 'unit', header: 'Birim', type: 'string' },
    { id: 'qty', header: 'Miktar', type: 'decimal' },
  ]
  function make(opts: { maxRows?: number } = {}) {
    let rows: P[] = []
    const changes: SheetChange[] = []
    const base = {
      columns: cols,
      newRow: () => ({ qty: '1' }),
      optionOf: (def: ColumnDef<P>, v: unknown) =>
        def.id === 'product' ? products.find((p) => p.value === v) : undefined,
      onRowsChange: (next: P[], change: SheetChange) => {
        rows = next
        changes.push(change)
      },
      ...opts,
    }
    const store = createSheetStore<P>({ ...base, rows })
    const render = () => store.sync({ ...base, rows })
    return { store, rows: () => rows, changes, render }
  }

  it('boş satıra yazınca newRow tabanı + onChange aynı adımda; tek geri al hepsini kaldırır, yinele geri getirir', () => {
    const { store, rows, changes, render } = make()
    store.set({ row: 0, col: 0 }, 7)
    render()
    expect(rows()).toEqual([{ qty: '1', product: 7, title: 'Vida', unit: 'pcs' }])
    expect(changes.at(-1)!.cells.map((c) => c.column)).toEqual(['product', 'title', 'unit'])
    store.undo()
    render()
    expect(rows()).toEqual([])
    store.redo()
    render()
    expect(rows()).toEqual([{ qty: '1', product: 7, title: 'Vida', unit: 'pcs' }])
  })

  it('onChange var olan satırda yalnız farklı alanları yazar; geri al öncekine döner', () => {
    const { store, rows, render } = make()
    store.set({ row: 0, col: 0 }, 7)
    render()
    store.set({ row: 0, col: 1 }, 'Özel ad')
    render()
    store.set({ row: 0, col: 0 }, null)
    render()
    expect(rows()[0]).toMatchObject({ product: null, title: null, unit: undefined })
    store.undo()
    render()
    expect(rows()[0]).toMatchObject({ product: 7, title: 'Özel ad', unit: 'pcs' })
  })

  it('maxRows dolunca boş satır yok, fazlası yazılmaz', () => {
    const { store, rows, render } = make({ maxRows: 1 })
    expect(store.rowCount()).toBe(1)
    store.set({ row: 0, col: 3 }, '5')
    render()
    expect(store.rowCount()).toBe(1)
    store.set({ row: 1, col: 3 }, '6')
    render()
    expect(rows()).toHaveLength(1)
  })

  it('ajax hücresinde yazarak açılış değeri değiştirmez (yazılan arama metnidir)', () => {
    const { store, rows, render } = make()
    store.set({ row: 0, col: 0 }, 7)
    render()
    store.focus({ row: 0, col: 0 })
    store.startEdit('v')
    expect(store.editing()?.draft).toBe(7)
    expect(store.editing()?.text).toBe('v')
    store.commit()
    render()
    expect(rows()[0]!.product).toBe(7)
  })
})

describe('F3: yapıştır, doldur, satır sil', () => {
  type P = { product: string | null; title: string | null; qty: string | null; lock?: string | null }
  const cols: Array<ColumnDef<P>> = [
    {
      id: 'product',
      header: 'Ürün',
      type: 'string',
      onChange: (_r, v) => ({ title: v ? `Ad ${String(v)}` : null }),
    },
    { id: 'title', header: 'Ad', type: 'string' },
    { id: 'qty', header: 'Miktar', type: 'decimal' },
    { id: 'lock', header: 'Kilit', type: 'string', editable: false },
  ]
  function make(initial: P[] = [], maxRows?: number) {
    let rows = initial
    const changes: SheetChange[] = []
    const base = {
      columns: cols,
      maxRows,
      onRowsChange: (next: P[], change: SheetChange) => {
        rows = next
        changes.push(change)
      },
    }
    const store = createSheetStore<P>({ ...base, rows })
    const render = () => store.sync({ ...base, rows })
    return { store, rows: () => rows, changes, render }
  }
  const asText = (_d: ColumnDef<P>, t: string) => (t === '' ? null : t)

  it('aktif hücreden yapıştırır, alttan taşanlar yeni satır, kilitli hücre atlanır; boş Ad onChange değerini ezmez', () => {
    const { store, rows, changes, render } = make([{ product: 'A', title: 'Ad A', qty: '1', lock: 'x' }])
    store.focus({ row: 0, col: 0 })
    const r = store.paste(
      [
        ['B', '', '2', 'y'],
        ['C', 'Özel', '3', 'y'],
        ['', '', '', ''],
        ['D', '', '4', ''],
      ],
      asText,
    )
    render()
    expect(r.skipped).toBe(0)
    expect(rows()).toEqual([
      { product: 'B', title: 'Ad B', qty: '2', lock: 'x' },
      { product: 'C', title: 'Özel', qty: '3' },
      { product: null },
      { product: 'D', title: 'Ad D', qty: '4' },
    ])
    expect(changes.at(-1)!.kind).toBe('paste')
    expect(changes.at(-1)!.cells.filter((c) => c.row === 1 && c.column === 'title')).toHaveLength(1)
    expect(store.range()).toEqual({ top: 0, bottom: 3, left: 0, right: 3 })
    store.undo()
    render()
    expect(rows()).toEqual([{ product: 'A', title: 'Ad A', qty: '1', lock: 'x' }])
  })

  it('tek değer seçili aralığın hepsine yazılır', () => {
    const { store, rows, render } = make([
      { product: 'A', title: null, qty: '1' },
      { product: 'B', title: null, qty: '2' },
    ])
    store.focus({ row: 0, col: 2 })
    store.focus({ row: 1, col: 2 }, true)
    store.paste([['9']], asText)
    render()
    expect(rows().map((r) => r.qty)).toEqual(['9', '9'])
  })

  it('maxRows: sığmayan satırlar alınmaz, sayısı döner', () => {
    const { store, rows, render } = make([{ product: 'A', title: null, qty: '1' }], 2)
    store.focus({ row: 1, col: 2 })
    const r = store.paste([['5'], ['6'], ['7']], asText)
    render()
    expect(r.skipped).toBe(2)
    expect(rows()).toHaveLength(2)
    expect(rows()[1]!.qty).toBe('5')
  })

  it('⌘D: aralıkta ilk satır aşağı, tek satırda üstteki satır gelir; kilitli atlanır', () => {
    const { store, rows, changes, render } = make([
      { product: 'A', title: 'x', qty: '1', lock: 'k' },
      { product: 'B', title: 'y', qty: '2', lock: 'm' },
      { product: 'C', title: 'z', qty: '3', lock: 'n' },
    ])
    store.focus({ row: 0, col: 2 })
    store.focus({ row: 2, col: 3 }, true)
    store.fill()
    render()
    expect(rows().map((r) => [r.qty, r.lock])).toEqual([
      ['1', 'k'],
      ['1', 'm'],
      ['1', 'n'],
    ])
    expect(changes.at(-1)!.kind).toBe('fill')
    store.focus({ row: 2, col: 1 })
    store.fill()
    render()
    expect(rows()[2]!.title).toBe('y')
  })

  it('satır sil: seçili satırlar gider, geri al yerlerine koyar, yinele yine siler', () => {
    const a = { product: 'A', title: null, qty: '1' }
    const b = { product: 'B', title: null, qty: '2' }
    const c = { product: 'C', title: null, qty: '3' }
    const { store, rows, changes, render } = make([a, b, c])
    store.focus({ row: 0, col: 0 })
    store.focus({ row: 1, col: 0 }, true)
    store.removeRows()
    render()
    expect(rows()).toEqual([c])
    expect(changes.at(-1)!.kind).toBe('remove')
    store.undo()
    render()
    expect(rows()).toEqual([a, b, c])
    store.redo()
    render()
    expect(rows()).toEqual([c])
  })
})

describe('tümü / sütun seçimi boş satırı almaz', () => {
  type P = { a: string | null }
  const make = (rows: P[]) =>
    createSheetStore<P>({ rows, columns: [{ id: 'a', header: 'A', type: 'string' }], onRowsChange: () => {} })
  it('son dolu satırda biter, aktif hücre dolu satırdadır', () => {
    const store = make([{ a: '1' }, { a: '2' }])
    store.focus({ row: 0, col: 0 })
    store.selectAll()
    expect(store.range()).toEqual({ top: 0, bottom: 1, left: 0, right: 0 })
    expect(store.active()).toEqual({ row: 1, col: 0 })
    store.selectColumn()
    expect(store.range()).toEqual({ top: 0, bottom: 1, left: 0, right: 0 })
  })
  it('hiç satır yoksa boş satır seçilir', () => {
    const store = make([])
    store.selectAll()
    expect(store.range()).toEqual({ top: 0, bottom: 0, left: 0, right: 0 })
  })
})
