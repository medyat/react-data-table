// Filtre modeli (04 §1–3, 03 · Operatör anahtarları): operatör listeleri, varsayılanlar, şekil koruma, eksik çip,
// hazır tarih aralıkları, istemci eşleme ve çip özetleri.
import { describe, expect, it } from 'vitest'
import { createI18n } from '../src/core/i18n'
import {
  changeOperator,
  defaultOperator,
  isComplete,
  matches,
  opLabel,
  operatorsOf,
  resolvePreset,
  shapeOf,
  summarize,
  toCondition,
  type Chip,
} from '../src/core/filters/model'
import { getFormat } from '../src/core/format'
import { parseNumber } from '../src/core/format/parse'
import type { ColumnDef, FilterCondition } from '../src/types'

const i18n = createI18n({ locale: 'en' })
const fmt = getFormat('en')
const env = { i18n, fmt, labelOf: (v: string | number) => `L:${v}`, today: new Date('2026-10-21T10:00:00') }
const col = (type: ColumnDef['type'], extra: Record<string, unknown> = {}): ColumnDef =>
  ({ id: 'c', header: 'Col', type, ...extra }) as ColumnDef

describe('operatörler ve varsayılanlar', () => {
  it('her tipin listesi boşluk operatörleriyle biter; object filtrelenmez', () => {
    for (const t of ['int', 'string', 'select', 'date', 'user', 'star', 'boolean'] as const)
      expect(operatorsOf(col(t)).slice(-2)).toEqual(['is_empty', 'is_not_empty'])
    expect(operatorsOf(col('object'))).toEqual([])
    expect(operatorsOf(col('string', { filter: { operators: ['contains'] } }))).toEqual(['contains'])
  })
  it('varsayılan operatör tipe göre (04 §2)', () => {
    expect(defaultOperator(col('currency'))).toBe('between')
    expect(defaultOperator(col('string'))).toBe('contains')
    expect(defaultOperator(col('id'))).toBe('in')
    expect(defaultOperator(col('select'))).toBe('in')
    expect(defaultOperator(col('date'))).toBe('within')
    expect(defaultOperator(col('boolean'))).toBe('eq')
    expect(defaultOperator(col('star'))).toBe('gte')
    expect(defaultOperator(col('int', { filter: { defaultOperator: 'gt' } }))).toBe('gt')
  })
  it('etiket: in/not_in tekil-çoğul, star gte/lte', () => {
    expect(opLabel(i18n, 'in', 'select', 1)).toBe('is')
    expect(opLabel(i18n, 'in', 'select', 2)).toBe('is any of')
    expect(opLabel(i18n, 'not_in', 'select', 3)).toBe('is none of')
    expect(opLabel(i18n, 'gte', 'star')).toBe('at least')
    expect(opLabel(i18n, 'gte', 'int')).toBe('is at least')
  })
})

describe('operatör değişiminde değer korunumu ve eksik çip', () => {
  it('aynı şekil grubunda kalır, şekil değişince silinir, boşlukta değersiz', () => {
    const chip: Chip = { column: 'c', op: 'in', value: ['a', 'b'] }
    expect(changeOperator(chip, 'not_in', 'select').value).toEqual(['a', 'b'])
    expect(changeOperator({ column: 'c', op: 'contains', value: 'x' }, 'starts_with', 'string').value).toBe('x')
    expect(changeOperator({ column: 'c', op: 'gt', value: 5 }, 'lte', 'int').value).toBe(5)
    expect(changeOperator({ column: 'c', op: 'gt', value: 5 }, 'between', 'int').value).toBeUndefined()
    expect(
      changeOperator({ column: 'c', op: 'within', value: { preset: 'today' } }, 'before', 'date').value,
    ).toBeUndefined()
    expect(changeOperator({ column: 'c', op: 'before', value: '2026-10-01' }, 'after', 'date').value).toBe('2026-10-01')
    expect(changeOperator(chip, 'is_empty', 'select')).toEqual({ column: 'c', op: 'is_empty', value: undefined })
    expect(shapeOf('eq', 'star')).toBe('number')
    expect(shapeOf('eq', 'date')).toBe('date')
  })
  it('isComplete şekle göre; between tek uçla tam; toCondition değersiz boşluk', () => {
    expect(isComplete({ column: 'c', op: 'in', value: [] }, 'select')).toBe(false)
    expect(isComplete({ column: 'c', op: 'contains', value: '' }, 'string')).toBe(false)
    expect(isComplete({ column: 'c', op: 'between', value: [100, null] }, 'int')).toBe(true)
    expect(isComplete({ column: 'c', op: 'between', value: [null, null] }, 'int')).toBe(false)
    expect(isComplete({ column: 'c', op: 'within', value: { preset: 'this_week' } }, 'date')).toBe(true)
    expect(isComplete({ column: 'c', op: 'within', value: { from: '2026-10-01' } }, 'date')).toBe(false)
    expect(isComplete({ column: 'c', op: 'is_empty' }, 'string')).toBe(true)
    expect(toCondition({ column: 'c', op: 'is_empty', value: 'stale' })).toEqual({ column: 'c', op: 'is_empty' })
    expect(toCondition({ column: 'c', op: 'gt', value: 5, currency: 'TRY' })).toEqual({
      column: 'c',
      op: 'gt',
      value: 5,
      currency: 'TRY',
    })
  })
})

describe('hazır tarih aralıkları (yerel ayara göre hafta başı)', () => {
  const now = new Date('2026-10-21T10:00:00') // Çarşamba
  it('this_week tr Pazartesi, en-US Pazar; overdue bugünden önce', () => {
    expect(resolvePreset('this_week', 'tr', now)).toEqual({ from: '2026-10-19', to: '2026-10-25' })
    expect(resolvePreset('this_week', 'en-US', now)).toEqual({ from: '2026-10-18', to: '2026-10-24' })
    expect(resolvePreset('today', 'tr', now)).toEqual({ from: '2026-10-21', to: '2026-10-21' })
    expect(resolvePreset('next_7_days', 'tr', now)).toEqual({ from: '2026-10-21', to: '2026-10-28' })
    expect(resolvePreset('this_month', 'tr', now)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(resolvePreset('last_30_days', 'tr', now)).toEqual({ from: '2026-09-21', to: '2026-10-21' })
    expect(resolvePreset('this_quarter', 'tr', now)).toEqual({ from: '2026-10-01', to: '2026-12-31' })
    expect(resolvePreset('overdue', 'tr', now)).toEqual({ from: null, to: '2026-10-20' })
  })
})

describe('istemci modu eşleme', () => {
  const m = (cond: FilterCondition, cell: unknown) =>
    matches(cond, cell, { locale: 'tr', now: new Date('2026-10-21T10:00:00') })
  it('metin: büyük/küçük harf duyarsız (Türkçe İ/ı), dizi hücrede her öğe', () => {
    expect(m({ column: 'c', op: 'contains', value: 'ışık' }, 'IŞIK Makine')).toBe(true)
    expect(m({ column: 'c', op: 'not_contains', value: 'x' }, 'abc')).toBe(true)
    expect(m({ column: 'c', op: 'starts_with', value: 'ab' }, 'abc')).toBe(true)
    expect(m({ column: 'c', op: 'ends_with', value: 'bc' }, 'abc')).toBe(true)
    expect(m({ column: 'c', op: 'eq', value: 'ABC' }, 'abc')).toBe(true)
    expect(m({ column: 'c', op: 'contains', value: 'gp' }, ['HC-63', 'GP-25'])).toBe(true)
  })
  it('sayı, aralık (uçlar dahil, tek taraflı), boş değer', () => {
    expect(m({ column: 'c', op: 'between', value: [100, 250] }, 250)).toBe(true)
    expect(m({ column: 'c', op: 'between', value: [100, null] }, 99)).toBe(false)
    expect(m({ column: 'c', op: 'gte', value: 4 }, 4)).toBe(true)
    expect(m({ column: 'c', op: 'lt', value: 4 }, null)).toBe(false)
    expect(m({ column: 'c', op: 'is_empty' }, [])).toBe(true)
    expect(m({ column: 'c', op: 'is_not_empty' }, 0)).toBe(true)
  })
  it("liste: tekil ve çok değerli hücre; '@me' istemcide eşleşmez", () => {
    expect(m({ column: 'c', op: 'in', value: ['done', 'planned'] }, 'done')).toBe(true)
    expect(m({ column: 'c', op: 'in', value: [1] }, '1')).toBe(true)
    expect(m({ column: 'c', op: 'not_in', value: ['a'] }, ['a', 'b'])).toBe(false)
    expect(m({ column: 'c', op: 'in', value: ['@me'] }, 'u1')).toBe(false)
  })
  it('tarih: hazır aralık, özel aralık, before/after, eq gün', () => {
    expect(m({ column: 'c', op: 'within', value: { preset: 'this_week' } }, '2026-10-25')).toBe(true)
    expect(m({ column: 'c', op: 'within', value: { preset: 'overdue' } }, '2026-10-21')).toBe(false)
    expect(
      m({ column: 'c', op: 'within', value: { from: '2026-10-01', to: '2026-10-10' } }, '2026-10-10T23:00:00Z'),
    ).toBe(true)
    expect(m({ column: 'c', op: 'before', value: { preset: 'today' } }, '2026-10-20')).toBe(true)
    expect(m({ column: 'c', op: 'after', value: '2026-10-20' }, new Date('2026-10-21T09:00:00'))).toBe(true)
    expect(m({ column: 'c', op: 'eq', value: '2026-10-21' }, '2026-10-21T15:00:00Z')).toBe(true)
  })
})

describe('çip özeti (04 §3)', () => {
  it('liste: 1 değer, 2 virgül, 3+ sayım (filterNoun), kişiler', () => {
    const sel = col('select', { filterNoun: { one: 'status', other: 'statuses' } })
    expect(summarize({ column: 'c', op: 'in', value: ['a'] }, sel, env).text).toBe('L:a')
    expect(summarize({ column: 'c', op: 'in', value: ['a', 'b'] }, sel, env).text).toBe('L:a, L:b')
    expect(summarize({ column: 'c', op: 'in', value: ['a', 'b', 'c'] }, sel, env)).toMatchObject({
      text: '3 statuses',
      full: 'L:a, L:b, L:c',
    })
    expect(summarize({ column: 'c', op: 'in', value: ['a', 'b', 'c'] }, col('select'), env).text).toBe('3 values')
    const u = summarize({ column: 'c', op: 'in', value: ['u1', 'u2', 'u3'] }, col('user'), env)
    expect(u.text).toBe('3 people')
    expect(u.people).toHaveLength(3)
    expect(summarize({ column: 'c', op: 'in', value: ['@me'] }, col('user'), env).text).toBe('Me')
  })
  it('sayı aralığı kısa, tek uç ≥/≤, para birimi, yüzde, metin tırnaklı, boolean, tarih', () => {
    expect(
      summarize({ column: 'c', op: 'between', value: [100000, 250000], currency: 'TRY' }, col('currency'), env).text,
    ).toBe('100K – 250K TRY')
    expect(
      summarize({ column: 'c', op: 'between', value: [100000, null], currency: 'TRY' }, col('currency'), env).text,
    ).toBe('≥ 100K TRY')
    expect(summarize({ column: 'c', op: 'lt', value: 80 }, col('percentage'), env).text).toBe('80%')
    expect(summarize({ column: 'c', op: 'contains', value: 'cylinder' }, col('string'), env).text).toBe('“cylinder”')
    expect(summarize({ column: 'c', op: 'eq', value: false }, col('boolean'), env).text).toBe('No')
    expect(summarize({ column: 'c', op: 'within', value: { preset: 'last_30_days' } }, col('date'), env).text).toBe(
      'Last 30 days',
    )
    expect(
      summarize({ column: 'c', op: 'within', value: { from: '2026-10-12', to: '2026-10-24' } }, col('date'), env).text,
    ).toBe('Oct 12 – 24')
    expect(
      summarize({ column: 'c', op: 'within', value: { from: '2026-09-28', to: '2026-10-04' } }, col('date'), env).text,
    ).toBe('Sep 28 – Oct 4')
    expect(summarize({ column: 'c', op: 'is_empty' }, col('string'), env).text).toBe('')
  })
})

describe('yerel sayı okuma', () => {
  it('iki ayırıcı varsa sondaki ondalık; tek ayırıcıda yerel ayar; % ve kod atılır', () => {
    expect(parseNumber('tr', '1.284,50')).toBe(1284.5)
    expect(parseNumber('en', '1,284.50')).toBe(1284.5)
    expect(parseNumber('tr', '12.400')).toBe(12400)
    expect(parseNumber('en', '12.400')).toBe(12.4)
    expect(parseNumber('en', '68%')).toBe(68)
    expect(parseNumber('en', '−320')).toBe(-320)
    expect(parseNumber('en', '')).toBeNull()
    expect(parseNumber('en', 'abc')).toBeNull()
  })
})
