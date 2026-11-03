// Faz 1 kabul kriterleri: boş değerler, select tonları, date overdue, datetime relative, star tooltip, color fill,
// boolean falseTone, +N, özel hücre bağlamı (03, T8).
import { act, cleanup, render as rtl } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RemoteLabels } from '../src/core/cells/remote-labels'
import { cellFillStyle, renderCellContent, type RenderEnv } from '../src/core/cells/render-cell'
import { getFormat } from '../src/core/format'
import { createI18n } from '../src/core/i18n'
import type { ColumnDef } from '../src/types'

interface R {
  id: number
  v?: unknown
}

const env: RenderEnv = {
  fmt: getFormat('en'),
  i18n: createI18n({ locale: 'en' }),
  today: new Date(2026, 9, 21),
  labels: new RemoteLabels(),
  density: 'standard',
  coarse: false,
}

afterEach(cleanup)

function render(def: ColumnDef<R>, value: unknown, row: R = { id: 1 }, e: RenderEnv = env) {
  const { container } = rtl(<div>{renderCellContent(def, row, value, e)}</div>)
  const root = container.firstElementChild as HTMLElement
  return {
    root,
    text: () => root.textContent,
    find: (sel: string) => root.querySelector<HTMLElement>(sel),
    findAll: (sel: string) => [...root.querySelectorAll<HTMLElement>(sel)],
  }
}
const col = (type: ColumnDef<R>['type'], extra: Record<string, unknown> = {}): ColumnDef<R> =>
  ({ id: 'v', header: 'V', type, ...extra }) as ColumnDef<R>

describe('boş değer', () => {
  it.each([null, undefined, '', []])('%s → "—" (sahte 0 yok)', (v) => {
    const w = render(col('int'), v)
    expect(w.text()).toBe('—')
    expect(w.find('.dt-empty')).not.toBeNull()
  })
  it('emptyText ezilir; 0 gerçek değerdir', () => {
    expect(render(col('int', { emptyText: 'n/a' }), null).text()).toBe('n/a')
    expect(render(col('float'), 0).text()).toBe('0.00')
  })
})

describe('sayı tipleri', () => {
  it('int negatif U+2212, currency kod ayrı, percentage bar', () => {
    expect(render(col('int'), -320).text()).toBe('−320')
    const c = render(col('currency', { currency: 'TRY' }), 412800)
    expect(c.text()).toBe('412,800.00TRY')
    expect(c.find('.dt-ccy')!.textContent).toBe('TRY')
    const b = render(col('percentage', { display: 'bar' }), 68)
    expect(b.find('.dt-bar-fill')!.style.width).toBe('68%')
    expect(b.find('.dt-bar-label')!.textContent).toBe('68%')
  })
  it('star: dolu sayısı ve tooltip "4 of 5"', () => {
    const w = render(col('star'), 4)
    expect(w.find('.dt-stars')!.getAttribute('aria-label')).toBe('4 of 5')
    expect(w.findAll('.dt-stars .is-on')).toHaveLength(4)
  })
})

describe('metin tipleri', () => {
  it('url yalnızca host + yeni sekme; id link + mono; color fill kontrast', () => {
    const u = render(col('url'), 'https://kuzeyotomotiv.com.tr/urunler')
    expect(u.find('a')!.textContent).toBe('kuzeyotomotiv.com.tr')
    expect(u.find('a')!.getAttribute('target')).toBe('_blank')
    const i = render(col('id', { href: (r: R) => `/orders/${r.id}` }), 'HC-080-S', { id: 9 })
    expect(i.find('a.dt-link')!.getAttribute('href')).toBe('/orders/9')
    expect(i.find('.dt-mono')!.textContent).toBe('HC-080-S')
    expect(cellFillStyle(col('color', { display: 'fill' }), '#F2C230')).toEqual({
      background: '#F2C230',
      color: 'var(--dt-fill-text-dark)',
    })
    expect(cellFillStyle(col('color', { display: 'fill' }), '#1F4E8C')?.color).toBe('var(--dt-fill-text-light)')
    expect(cellFillStyle(col('color'), '#1F4E8C')).toBeUndefined()
  })
  it('text: ilk satır + genişlet düğmesi tam metni taşır; phone dokunmatikte tel:', () => {
    const t = render(col('text'), 'Customer asked for zinc\nSecond line')
    expect(t.find('.dt-text-first')!.textContent).toBe('Customer asked for zinc')
    expect(t.find('.dt-text-expand')!.dataset.dtTip).toContain('Second line')
    expect(
      render(col('phone'), '+905324121807', { id: 1 }, { ...env, coarse: true })
        .find('a')!
        .getAttribute('href'),
    ).toBe('tel:+905324121807')
  })
})

describe('seçim tipleri', () => {
  const options = [
    { value: 'in_progress', label: 'In progress', tone: 'blue' as const },
    { value: 'done', label: 'Done', tone: 'green' as const },
    { value: 'custom', label: 'Custom', tone: { light: '#123456', dark: '#abcdef' } },
  ]
  it('boolean: Yes yeşil, No nötr, falseTone kırmızı', () => {
    expect(render(col('boolean'), true).find('.dt-badge')!.classList).toContain('dt-tone-green')
    expect(render(col('boolean'), false).find('.dt-badge')!.classList).toContain('dt-tone-gray')
    const d = render(col('boolean', { falseTone: 'destructive' }), false)
    expect(d.find('.dt-badge')!.classList).toContain('dt-tone-red')
    expect(d.text()).toBe('No')
  })
  it('select: ton sınıfı; özel ton tema başına; bilinmeyen değer gri ham', () => {
    const w = render(col('select', { options }), 'in_progress')
    expect(w.find('.dt-badge')!.classList).toContain('dt-tone-blue')
    expect(w.text()).toBe('In progress')
    const c = render(col('select', { options }), 'custom').find('.dt-badge')!
    expect(c.classList).toContain('dt-tone-custom')
    expect(c.style.getPropertyValue('--dt-tone-dark')).toBe('#abcdef')
    const u = render(col('select', { options }), 'qc_hold')
    expect(u.find('.dt-badge')!.classList).toContain('dt-tone-gray')
    expect(u.text()).toBe('qc_hold')
  })
  it('multiselect: 2 + N', () => {
    const m = render(col('multiselect', { options }), ['in_progress', 'done', 'custom'])
    expect(m.findAll('.dt-badge')).toHaveLength(2)
    expect(m.find('.dt-more')!.textContent).toBe('+1')
    expect(m.find('.dt-more')!.dataset.dtTip).toBe('Custom')
  })
  it('user: tek, çoklu (3 + N), Unassigned', () => {
    const users = [
      { value: 'u1', label: 'Ayşe K.' },
      { value: 'u2', label: 'Emre T.' },
      { value: 'u3', label: 'Deniz Ö.' },
      { value: 'u4', label: 'Burak Y.' },
      { value: 'u5', label: 'Selin A.' },
    ]
    const one = render(col('user', { options: users }), 'u1')
    expect(one.find('.dt-avatar')!.textContent).toBe('AK')
    expect(one.find('.dt-user-name')!.textContent).toBe('Ayşe K.')
    const many = render(col('user', { options: users, multiple: true }), ['u1', 'u2', 'u3', 'u4', 'u5'])
    expect(many.findAll('.dt-avatar')).toHaveLength(3)
    expect(many.find('.dt-more')!.textContent).toBe('+2')
    const none = render(col('user', { options: users }), null)
    expect(none.text()).toBe('Unassigned')
    expect(none.find('.dt-avatar.is-empty')).not.toBeNull()
  })
  it('ajax: etiket çözülene kadar ham, resolve sonrası önbellekte etiket ve sürüm artar', async () => {
    const labels = new RemoteLabels()
    const remote = {
      search: async () => ({ items: [], hasMore: false }),
      resolve: async (ids: Array<string | number>) => ids.map((id) => ({ value: id, label: `Customer ${id}` })),
    }
    const def = col('ajax', { remote })
    expect(render(def, 42, { id: 1 }, { ...env, labels }).text()).toBe('42')
    let changes = 0
    labels.subscribe(() => changes++)
    await act(() => new Promise((r) => setTimeout(r, 0)))
    expect(changes).toBe(1)
    expect(labels.getVersion()).toBe(1)
    expect(render(def, 42, { id: 1 }, { ...env, labels }).text()).toBe('Customer 42')
  })
})

describe('tarih tipleri', () => {
  it('date overdue: kırmızı + "3d late"; gelecek tarih düz', () => {
    const late = render(col('date', { overdue: true }), '2026-10-18')
    expect(late.text()).toBe('Oct 18 · 3d late')
    expect(late.find('.dt-late')).not.toBeNull()
    expect(render(col('date', { overdue: true }), '2026-10-24').text()).toBe('Oct 24')
    expect(render(col('date'), '2026-10-18').find('.dt-late')).toBeNull()
  })
  it('datetime relative + tam zaman tooltip', () => {
    const w = render(col('datetime', { relative: true }), new Date(2026, 9, 20, 22, 0))
    expect(w.text()).toBe('2 hours ago')
    expect(w.find('[data-dt-tip]')!.dataset.dtTip).toContain('2026')
  })
})

describe('yapısal ve özel', () => {
  it('object summary / fields; array ilk değerler + N', () => {
    expect(
      render(col('object', { summary: (v: unknown) => `Steel · ${(v as { kg: number }).kg} kg` }), { kg: 12.4 }).text(),
    ).toBe('{ }Steel · 12.4 kg')
    expect(render(col('object'), { a: 1, b: 2, c: 3, d: 4 }).text()).toBe('{ }4 fields')
    const a = render(col('array', { itemType: 'int' }), [40, 63, 80, 90, 100])
    expect(a.text()).toBe('[ ]40, 63, 80 +2')
  })
  it('özel cell: formatted ve daraltılmış value ile çağrılır, kabuk korunur', () => {
    const def: ColumnDef<R> = {
      id: 'v',
      header: 'V',
      type: 'int',
      cell: ({ value, formatted, density }) => (
        <b data-d={density}>{value !== null && value > 100 ? `${formatted}!` : formatted}</b>
      ),
    }
    const w = render(def, 12400)
    expect(w.find('b')!.textContent).toBe('12,400!')
    expect(w.find('b')!.dataset.d).toBe('standard')
  })
})
