// DataSheet DS1 (docs/data-sheet.md): anahtar kilidi, değişiklik işaretleri, gönderilen yük (görünen sütunlar),
// satır sonuçları, hatalı satır onayı, anahtar tekrarı, görünümün listeye yerleşmesi ve tabanın yenilenmesi.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { DataTableProvider } from '../src/core/provider'
import { DataSheet } from '../src/data-sheet/data-sheet'
import { mergeView, useDataSheet, type DataSheetInstance } from '../src/data-sheet/use-data-sheet'
import type { ColumnDef, SheetChanges } from '../src/types'
import { flush, mockLayout } from './helpers/dom'

interface Product {
  id: string
  code: string | null
  title: string | null
  price: string | null
  note: string | null
}
const columns: Array<ColumnDef<Product>> = [
  { id: 'code', header: 'Kod', type: 'string', placeholder: () => 'Sonraki numara' },
  { id: 'title', header: 'Ad', type: 'string', required: true },
  {
    id: 'price',
    header: 'Fiyat',
    type: 'decimal',
    validate: (v) => (v !== null && Number(v) < 0 ? 'Eksi olamaz' : null),
  },
  { id: 'note', header: 'Not', type: 'string', hidden: true },
]
const loaded: Product[] = [
  { id: 'a', code: 'A-1', title: 'Pompa', price: '10.00', note: 'x' },
  { id: 'b', code: 'B-1', title: 'Vana', price: '20.00', note: null },
]

let sheet: DataSheetInstance<Product>
// Kanca örneği teste efektle verilir: render sırasında dışarı yazmak kural dışı.
const expose = (s: DataSheetInstance<Product>) => {
  sheet = s
}
function Harness({
  rows,
  onSave,
  autoFocus,
  cols = columns,
}: {
  rows: Product[]
  onSave: (c: SheetChanges<Product>) => Promise<void>
  autoFocus?: boolean
  cols?: Array<ColumnDef<Product>>
}) {
  const s = useDataSheet({ rows, columns: cols, keyColumn: 'code', getRowId: (r) => r.id, onSave })
  useEffect(() => expose(s))
  return (
    <DataTableProvider locale="tr-TR">
      <DataSheet sheet={s} label="Ürünler" autoFocus={autoFocus} />
    </DataTableProvider>
  )
}
async function open(onSave = vi.fn<(c: SheetChanges<Product>) => Promise<void>>(async () => {}), rows = loaded) {
  const view = render(<Harness rows={rows} onSave={onSave} />)
  await flush()
  return { onSave, rerender: (next: Product[]) => view.rerender(<Harness rows={next} onSave={onSave} />) }
}
const cell = (row: number, col: number) =>
  document.querySelector<HTMLElement>(`.dt-data-sheet .dt-cell[data-row="${row}"][data-col="${col}"]`)!
const editor = () => document.querySelector<HTMLInputElement>('.dt-data-sheet .is-editing input')
async function write(row: number, col: number, text: string) {
  fireEvent.pointerDown(cell(row, col), { button: 0 })
  fireEvent.keyDown(cell(row, col), { key: text[0]! })
  fireEvent.change(editor()!, { target: { value: text } })
  fireEvent.keyDown(editor()!, { key: 'Enter' })
  await flush()
}
const save = async () => {
  await act(async () => fireEvent.keyDown(cell(0, 1), { key: 's', metaKey: true, ctrlKey: true }))
  await flush()
}

beforeAll(mockLayout)
afterEach(cleanup)

describe('düzenlenebilirlik', () => {
  it('satıra bağlı kilit aynı satırdaki başka hücre değişince hemen açılır (hücre gri kalmaz)', async () => {
    const cols: Array<ColumnDef<Product>> = [
      columns[0]!,
      columns[1]!,
      { ...columns[2]!, editable: (row) => row.title !== 'Pompa' },
    ]
    render(<Harness rows={loaded} onSave={async () => {}} cols={cols} />)
    await flush()
    expect(cell(0, 2).classList.contains('is-readonly')).toBe(true)
    await write(0, 1, 'Pompa X')
    expect(cell(0, 2).classList.contains('is-readonly')).toBe(false)
  })

  it('e-posta, telefon, adres ve renk hücreleri metin gibi yazılır', async () => {
    const cols: Array<ColumnDef<Product>> = (['email', 'phone', 'url', 'color'] as const).map((type, i) => ({
      id: i === 0 ? 'title' : i === 1 ? 'note' : i === 2 ? 'price' : 'code',
      header: type,
      type,
    }))
    render(<Harness rows={loaded} onSave={async () => {}} cols={cols} />)
    await flush()
    for (const col of [0, 1, 2]) expect(cell(1, col).classList.contains('is-readonly')).toBe(false)
    // Renk anahtar sütununda: yüklenen satırda kilitli, boş satırda yazılır.
    expect(cell(2, 3).classList.contains('is-readonly')).toBe(false)
    await write(1, 0, 'a@b.co')
    expect(cell(1, 0).textContent).toContain('a@b.co')
  })
})

describe('yeni satır', () => {
  const active = () => document.querySelector('.dt-data-sheet .dt-cell[tabindex="0"]') as HTMLElement | null
  for (const [name, rows] of [
    ['boş tabloda', []],
    ['dolu tabloda', loaded],
  ] as const) {
    it(`${name} alttaki boş satıra yazıp Tab: doğan satırın sağdaki hücresine geçer`, async () => {
      // Uygulama ekranı autoFocus ile açar: ilk satır doğunca odağı geri çekmemeli.
      render(<Harness rows={[...rows]} onSave={async () => {}} autoFocus />)
      await flush()
      const row = rows.length
      fireEvent.pointerDown(cell(row, 1), { button: 0 })
      fireEvent.keyDown(cell(row, 1), { key: 'Y' })
      fireEvent.change(editor()!, { target: { value: 'Yunus' } })
      fireEvent.keyDown(editor()!, { key: 'Tab' })
      await flush()
      expect(cell(row, 1).textContent).toContain('Yunus')
      expect(active()?.dataset).toMatchObject({ row: String(row), col: '2' })
    })
  }
})

describe('şifre sütunu', () => {
  it('hücre maskeli; düzenleyicide değer açık, yazılır', async () => {
    const cols: Array<ColumnDef<Product>> = [columns[0]!, { id: 'note', header: 'Şifre', type: 'password' }]
    render(<Harness rows={loaded} onSave={async () => {}} cols={cols} />)
    await flush()
    expect(cell(1, 1).classList.contains('is-readonly')).toBe(false)
    await write(1, 1, 'Gizli123')
    // Uzunluk da sızmaz: maske her değerde aynı.
    expect(cell(1, 1).textContent).toBe('******')
    expect(cell(1, 1).textContent).not.toContain('Gizli123')
  })

  it('generate: hücre aksiyonu güçlü şifre yazar; seçenek yoksa aksiyon da yok', async () => {
    const cols: Array<ColumnDef<Product>> = [
      columns[0]!,
      { id: 'note', header: 'Şifre', type: 'password', generate: true },
      { id: 'title', header: 'Eski şifre', type: 'password' },
    ]
    render(<Harness rows={loaded} onSave={async () => {}} cols={cols} />)
    await flush()
    expect(within(cell(1, 2)).queryByRole('button', { name: 'Güçlü şifre oluştur' })).toBeNull()
    fireEvent.pointerDown(cell(1, 1), { button: 0 })
    fireEvent.click(within(cell(1, 1)).getByRole('button', { name: 'Güçlü şifre oluştur' }))
    await flush()
    const value = String(sheet.internal.state.rows[1]?.note)
    // 16 karakter; büyük, küçük harf, rakam ve işaret her birinden en az biri.
    expect(value).toMatch(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z\d]).{16}$/)
    expect(cell(1, 1).textContent).toBe('******')
  })
})

describe('autoFocus', () => {
  it('satırlar gelince ilk satırın ilk düzenlenebilir hücresine bir kez odaklanır (kilitli anahtar atlanır)', async () => {
    const onSave = vi.fn(async () => {})
    const view = render(<Harness rows={[]} onSave={onSave} autoFocus />)
    await flush()
    expect(document.activeElement).toBe(document.body)
    view.rerender(<Harness rows={loaded} onSave={onSave} autoFocus />)
    await act(async () => new Promise<void>((r) => requestAnimationFrame(() => r())))
    await flush()
    expect(document.activeElement).toBe(cell(0, 1))
  })
})

describe('focusNewRow', () => {
  it('boş listede alttaki boş satırın anahtardan sonraki ilk hücresine odaklanır', async () => {
    await open(undefined, [])
    await act(async () => sheet.focusNewRow())
    await flush()
    expect(document.activeElement).toBe(cell(0, 1))
  })
})

describe('anahtar sütunu', () => {
  it('yüklenen satırda kilitli, alttaki boş satırda yazılır; boş anahtarda yer tutucu', async () => {
    await open()
    expect(cell(0, 0).getAttribute('aria-readonly')).toBe('true')
    await write(2, 1, 'Conta')
    expect(cell(2, 0).hasAttribute('aria-readonly')).toBe(false)
    expect(cell(2, 0).textContent).toBe('Sonraki numara')
    expect(cell(2, 0).classList.contains('is-new')).toBe(true)
  })
  it('aynı anahtar iki satırda hata; boş anahtarlar sayılmaz', async () => {
    await open()
    await write(2, 1, 'Conta')
    await write(3, 1, 'Filtre')
    expect(cell(2, 0).classList.contains('is-error')).toBe(false)
    await write(2, 0, 'A-1')
    expect(cell(2, 0).classList.contains('is-error')).toBe(true)
    expect(cell(2, 0).getAttribute('aria-invalid')).toBe('true')
  })
})

describe('değişiklik ve gönderilen yük', () => {
  it('değişen hücre işaretlenir; Kaydet görünen sütunları gönderir, gizli sütun gitmez', async () => {
    const { onSave } = await open()
    await write(1, 2, '25')
    expect(cell(1, 2).classList.contains('is-changed')).toBe(true)
    expect(cell(1, 1).classList.contains('is-changed')).toBe(false)
    expect(sheet.summary).toEqual({ rows: 1, cells: 1, newRows: 0 })
    expect(sheet.counts.changed).toBe(1)
    await save()
    expect(onSave).toHaveBeenCalledTimes(1)
    const [row] = onSave.mock.calls[0]![0].rows
    expect(row).toMatchObject({ id: 'b', isNew: false, key: 'B-1' })
    expect(row!.values).toEqual({ code: 'B-1', title: 'Vana', price: '25' })
    expect(row!.row.note).toBeNull()
  })
  it('gizli sütun değiştirilmiş olsa da gitmez; yeni satırda yalnız görünen dolu alanlar', async () => {
    const { onSave } = await open()
    await act(async () =>
      sheet.internal.setState((s) => ({
        ...s,
        rows: s.rows.map((r) => (r.id === 'a' ? { ...r, note: 'y' } : r)),
      })),
    )
    await write(2, 1, 'Conta')
    await save()
    const rows = onSave.mock.calls[0]![0].rows
    expect(rows.find((r) => r.id === 'a')!.values).toEqual({ code: 'A-1', title: 'Pompa', price: '10.00' })
    expect(rows.find((r) => r.isNew)!.values).toEqual({ title: 'Conta' })
  })
  it('geri alınarak eski değerine dönen hücre değişmiş sayılmaz', async () => {
    await open()
    await write(0, 2, '11')
    expect(sheet.isDirty).toBe(true)
    await act(async () => fireEvent.keyDown(cell(1, 2), { key: 'z', metaKey: true, ctrlKey: true }))
    await flush()
    expect(sheet.isDirty).toBe(false)
  })
})

describe('satır sonuçları', () => {
  it('created: sunucunun satırı tabana geçer, yayılmış satırdaki yeni işareti silinir, anahtar kilitlenir', async () => {
    const onSave = vi.fn(async ({ rows }: SheetChanges<Product>) => {
      sheet.applyResult(
        rows.map((c) => ({ id: c.id, status: 'created' as const, row: { ...c.row, id: 's1', code: 'P-9' } })),
      )
    })
    await open(onSave)
    await write(2, 1, 'Conta')
    await save()
    expect(cell(2, 0).textContent).toBe('P-9')
    expect(cell(2, 0).getAttribute('aria-readonly')).toBe('true')
    expect(cell(2, 0).classList.contains('is-new')).toBe(false)
    expect(sheet.isDirty).toBe(false)
    expect(sheet.result).toEqual({ created: 1, updated: 0, failed: 0 })
    expect(sheet.saving).toBeNull()
  })
  it('error: alan hatası hücrede, görünüm Hatalılar, şerit; hücre düzenlenince sunucu hatası kalkar', async () => {
    const onSave = vi.fn(async ({ rows }: SheetChanges<Product>) => {
      sheet.applyResult(rows.map((c) => ({ id: c.id, status: 'error' as const, fieldErrors: { title: 'Reddedildi' } })))
    })
    await open(onSave)
    await write(1, 2, '30')
    await save()
    expect(sheet.result).toEqual({ created: 0, updated: 0, failed: 1 })
    expect(sheet.view).toBe('errors')
    expect(sheet.counts.errors).toBe(1)
    expect(document.querySelectorAll('.dt-data-sheet .dt-row:not(.is-blank)')).toHaveLength(1)
    expect(cell(0, 1).classList.contains('is-error')).toBe(true)
    // Satır no kalıcı: görünüm daralınca 2 kalır.
    expect(document.querySelector('.dt-data-sheet .dt-gutter-no')?.textContent).toBe('2')
    await write(0, 1, 'Vana 2')
    expect(cell(0, 1).classList.contains('is-error')).toBe(false)
    expect(sheet.isDirty).toBe(true)
  })
  // Hata sunucudan gelmiş olabilir (eşleşmeyen ilişki, geçici sorun): kullanıcının düzeltecek bir şeyi yoksa da yeniden
  // gönderebilmeli. Sunucu yine reddederse hata satırda kalır.
  it('hatalı satır varken Kaydet önce sorar; Yine de kaydet hatalılar dahil bütün değişenleri gönderir', async () => {
    const { onSave } = await open()
    await write(0, 2, '11')
    await write(1, 2, '-5')
    expect(cell(1, 2).classList.contains('is-error')).toBe(true)
    await save()
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Önce düzelt' })).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: 'Yine de kaydet' }))
    await flush()
    expect(onSave.mock.calls[0]![0].rows.map((r) => r.id)).toEqual(['a', 'b'])
  })
})

describe('uygulamanın araç çubuğu için komutlar', () => {
  it('discard onay sorar, onayda taban döner; sütun gizlenince görünmez ve gönderilmez', async () => {
    const { onSave } = await open()
    await write(0, 2, '11')
    await act(async () => sheet.discard())
    fireEvent.click(await screen.findByRole('button', { name: 'Değişiklikleri at' }))
    await flush()
    expect(sheet.isDirty).toBe(false)
    await act(async () => sheet.openColumns())
    const price = await screen.findByRole('switch', { name: /Fiyat/ })
    expect(screen.getByRole('switch', { name: /Not/ }).getAttribute('aria-checked')).toBe('false')
    fireEvent.click(price)
    fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    await flush()
    expect(document.querySelector('.dt-data-sheet .dt-head')?.textContent).not.toContain('Fiyat')
    await write(0, 1, 'Pompa 2')
    await act(async () => sheet.save())
    expect(onSave.mock.calls[0]![0].rows[0]!.values).toEqual({ code: 'A-1', title: 'Pompa 2' })
  })
  it('undo / redo kancadan; canUndo değişiklikle açılır', async () => {
    await open()
    expect(sheet.canUndo).toBe(false)
    await write(0, 2, '11')
    expect(sheet.canUndo).toBe(true)
    await act(async () => sheet.undo())
    expect(sheet.isDirty).toBe(false)
    expect(sheet.canRedo).toBe(true)
  })
})

describe('içe ve dışa aktarma', () => {
  it('CSV: başlık eşlenir, listedeki güncellenir, yeni satır eklenir; sonuç döner; tek geri al adımı', async () => {
    await open()
    let done: Promise<unknown> = Promise.resolve()
    await act(async () => {
      done = sheet.importFile()
    })
    const csv = 'Kod;Ad;Fiyat\nB-1;Vana X;\nC-1;Conta;5,50\n'
    const input = document.querySelector<HTMLInputElement>('.dt-import-dialog input[type="file"]')!
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([csv], 'urunler.csv')] } })
    })
    await waitFor(() => expect(screen.getByText(/Listedeki 1 satır güncellenir/)).toBeTruthy())
    expect(screen.getByRole('combobox', { name: 'Fiyat' })).toHaveProperty('value', 'price')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Tabloya uygula' })))
    await expect(done).resolves.toEqual({ updated: 1, added: 1 })
    await flush()
    expect(cell(1, 1).textContent).toBe('Vana X')
    expect(cell(1, 2).textContent).toContain('20')
    expect(cell(2, 0).textContent).toBe('C-1')
    expect(cell(2, 2).textContent).toContain('5,5')
    expect(sheet.summary).toEqual({ rows: 2, cells: 4, newRows: 1 })
    await act(async () => sheet.undo())
    expect(sheet.isDirty).toBe(false)
  })
  it('vazgeçilince null döner; .xls reddedilir', async () => {
    await open()
    let done: Promise<unknown> = Promise.resolve()
    await act(async () => {
      done = sheet.importFile()
    })
    const input = document.querySelector<HTMLInputElement>('.dt-import-dialog input[type="file"]')!
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(['x'], 'eski.xls')] } })
    })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('.xlsx'))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' })))
    await expect(done).resolves.toBeNull()
  })
})

describe('liste', () => {
  it('mergeView: görünümün satırları yerlerine, fazlası sona, çıkarılanın yeri kapanır', () => {
    const id = (r: string) => r
    expect(mergeView(['a', 'x', 'b', 'c'], new Set(['a', 'b', 'c']), ['a', 'c'], id)).toEqual(['a', 'x', 'c'])
    expect(mergeView(['a', 'x', 'c'], new Set(['a', 'c']), ['a', 'b', 'c'], id)).toEqual(['a', 'x', 'b', 'c'])
    expect(mergeView(['a', 'x'], new Set(['a']), ['a', 'd'], id)).toEqual(['a', 'x', 'd'])
  })
  it('uygulama rows yenileyince değişmemiş satır yenilenir, taslak kalır, yeni kayıt eklenir', async () => {
    const { rerender } = await open()
    await write(0, 2, '11')
    rerender([
      { ...loaded[0]!, title: 'Pompa X' },
      { ...loaded[1]!, title: 'Vana X' },
      { id: 'c', code: 'C-1', title: 'Conta', price: '5.00', note: null },
    ])
    await flush()
    expect(cell(0, 2).textContent).toContain('11')
    expect(cell(1, 1).textContent).toBe('Vana X')
    expect(cell(2, 0).textContent).toBe('C-1')
    expect(cell(2, 0).getAttribute('aria-readonly')).toBe('true')
  })
})
