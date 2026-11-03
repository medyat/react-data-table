// @vitest-environment node
// Faz 0 kabul kriteri: t('key', params) ve .one/.other çoğulları çalışır; eksik anahtar dev modda uyarır.
// (node: scripts/docs.ts import.meta.url ile dokümanı okur; jsdom ortamında URL http şemalı olur.)
import { describe, expect, it, vi } from 'vitest'
import { docMessages, hasSpec } from '../scripts/docs.ts'
import { createI18n } from '../src/core/i18n'
import { en } from '../src/core/i18n/en'
import { ru } from '../src/core/i18n/ru'
import { tr } from '../src/core/i18n/tr'

const entityEn = { one: 'order', other: 'orders' }

describe.skipIf(!hasSpec())('en.ts / tr.ts ↔ 09-i18n.md', () => {
  it('üretilmiş dosyalar dokümanla birebir (pnpm gen:docs)', () => {
    const d = docMessages()
    expect(en).toEqual(d.en)
    expect(tr).toEqual(d.tr)
    expect(Object.keys(en).length).toBeGreaterThan(250)
  })
})

describe('dil dosyaları', () => {
  // Tekil/çoğul seçimi dile aittir (TR sayıdan sonra tekil, 09 · kurallar); karşılaştırılan parametrenin kökü.
  const params = (text: string) => [...new Set([...text.matchAll(/\{([A-Za-z0-9_]+)[.}]/g)].map((m) => m[1]))].sort()

  it('her anahtarın üç dili var; .one varsa .other da var', () => {
    expect(Object.keys(tr)).toEqual(Object.keys(en))
    expect(Object.keys(ru)).toEqual(Object.keys(en))
    for (const k of Object.keys(en)) if (k.endsWith('.one')) expect(en).toHaveProperty(k.replace(/\.one$/, '.other'))
  })
  it('çeviriler aynı parametreleri taşır', () => {
    for (const [k, v] of Object.entries(en)) {
      expect(params(tr[k]!), `tr ${k}`).toEqual(params(v))
      expect(params(ru[k]!), `ru ${k}`).toEqual(params(v))
    }
  })
})

describe('createI18n', () => {
  it('parametre ve nokta yolu', () => {
    expect(createI18n({ locale: 'en' }).t('state.emptyTitle', { entity: entityEn })).toBe('No orders yet')
  })
  it('çoğul: count ile .one / .other seçilir', () => {
    const i = createI18n({ locale: 'en' })
    expect(i.t('state.noResults', { count: 1, entity: entityEn })).toBe('No orders match this filter')
    expect(i.t('state.noResults', { count: 3, entity: entityEn })).toBe('No orders match these 3 filters')
  })
  it('tr: sayıdan sonra tekil (09 · kurallar)', () => {
    const i = createI18n({ locale: 'tr-TR' })
    expect(i.t('state.noResults', { count: 3, entity: { one: 'sipariş', other: 'siparişler' } })).toBe(
      'Bu 3 filtreye uyan sipariş yok',
    )
  })
  it('messages tek anahtarı ezer; fonksiyon mesaj düz sözlük alır', () => {
    const i = createI18n({
      locale: 'en',
      messages: { 'common.cancel': 'Nope', 'common.apply': (p) => `Go ${p.n} ${p['entity.one']}` },
    })
    expect(i.t('common.cancel')).toBe('Nope')
    expect(i.t('common.apply', { n: 2, entity: entityEn })).toBe('Go 2 order')
    expect(i.t('common.close')).toBe('Close')
  })
  it('eksik anahtar: anahtar döner, dev modda yalnızca bir kez uyarır', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const i = createI18n({ locale: 'en' })
    expect(i.t('nope.key')).toBe('nope.key')
    i.t('nope.key')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(i.has('nope.key')).toBe(false)
    warn.mockRestore()
  })
  it('bilinmeyen dil İngilizceye düşer, eksik parametre yerinde kalır', () => {
    const i = createI18n({ locale: 'de-DE' })
    expect(i.t('common.cancel')).toBe('Cancel')
    expect(i.t('state.emptyTitle')).toBe('No {entity.other} yet')
  })
})
