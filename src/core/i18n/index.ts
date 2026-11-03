import type { Plural } from '../../types/core'
import type { MessageValue, Messages } from '../../types/i18n'
import { en } from './en'
import { ru } from './ru'
import { tr } from './tr'

/** `{name}` düz değer, `{entity.one}` nokta yolu (09 · kurallar). `count` çoğul seçimini de yönetir. */
export type MessageParams = Record<
  string,
  string | number | boolean | null | undefined | Record<string, string> | Plural
>

export interface I18n {
  readonly locale: string
  /** Anahtar yoksa anahtarın kendisini döndürür; geliştirme modunda bir kez uyarır. */
  t: (key: string, params?: MessageParams) => string
  has: (key: string) => boolean
}

export const builtinMessages: Readonly<Record<string, Record<string, string>>> = { en, tr, ru }

const defaultLocale = (): string => (typeof navigator !== 'undefined' && navigator.language) || 'en'

const lookup = (params: MessageParams, path: string): string | undefined => {
  const [head, ...rest] = path.split('.')
  let v: unknown = params[head!]
  for (const p of rest) v = v && typeof v === 'object' ? (v as Record<string, unknown>)[p] : undefined
  return v === undefined || v === null || typeof v === 'object' ? undefined : String(v)
}

const interpolate = (text: string, params: MessageParams): string =>
  text.replace(/\{([A-Za-z0-9_.]+)\}/g, (m, path: string) => lookup(params, path) ?? m)

/** Fonksiyon mesajlar düz sözlük alır: `{ 'entity.one': 'order', count: 3 }`. */
const flatten = (params: MessageParams): Record<string, string | number> => {
  const out: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v && typeof v === 'object') for (const [k2, v2] of Object.entries(v)) out[`${k}.${k2}`] = v2
    else if (typeof v === 'string' || typeof v === 'number') out[k] = v
  }
  return out
}

export function createI18n(options: { locale?: string; messages?: Partial<Messages> } = {}): I18n {
  const locale = options.locale ?? defaultLocale()
  const lang = locale.split('-')[0]!.toLowerCase()
  const table: Messages = { ...(builtinMessages[lang] ?? en) }
  for (const [k, v] of Object.entries(options.messages ?? {})) if (v !== undefined) table[k] = v
  const plural = new Intl.PluralRules(locale)
  const warned = new Set<string>()

  const t = (key: string, params: MessageParams = {}): string => {
    let k = key
    if (typeof params.count === 'number') {
      const form = plural.select(params.count) === 'one' ? 'one' : 'other'
      if (`${key}.${form}` in table) k = `${key}.${form}`
    }
    const msg: MessageValue | undefined = table[k]
    if (msg === undefined) {
      if (import.meta.env?.DEV && !warned.has(k)) {
        warned.add(k)
        console.warn(`[data-table] i18n: eksik anahtar "${k}" (${locale})`)
      }
      return key
    }
    return interpolate(typeof msg === 'function' ? msg(flatten(params)) : msg, params)
  }

  return { locale, t, has: (key) => key in table }
}
