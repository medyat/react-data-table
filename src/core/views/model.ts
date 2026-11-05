// Görünüm modeli (04 §7, D4, D5): varsayılan görünüm sırası, düzenlenmiş durum karşılaştırması, ad doğrulama, sıralama.
import type { FilterCondition } from '../../types/query'
import type { View, ViewState } from '../../types/views'

/** Ekran açılırken: kullanıcı varsayılanı (tercih) → system `default` → ilk system view → yok (tablonun varsayılanı). */
export function defaultView(views: View[], preferredId: string | null | undefined): View | null {
  return (
    (preferredId ? views.find((v) => v.id === preferredId) : undefined) ??
    views.find((v) => v.kind === 'system' && v.default) ??
    views.find((v) => v.kind === 'system') ??
    null
  )
}

// Anahtarları her seviyede sıralı metin: jsonb saklayan sunucu nesne anahtarlarının sırasını korumaz, aynı koşul
// farklı sırayla döner.
const canonical = (value: unknown): string =>
  Array.isArray(value)
    ? `[${value.map(canonical).join(',')}]`
    : value !== null && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
          .join(',')}}`
      : JSON.stringify(value)
const normFilter = (f: FilterCondition) => {
  const v = 'value' in f ? f.value : undefined
  return { ...f, value: Array.isArray(v) ? [...(v as unknown[])].sort() : v }
}
const filtersKey = (fs: FilterCondition[]) =>
  canonical(fs.map(normFilter).sort((a, b) => a.column.localeCompare(b.column)))
const sorted = (ids: string[]) => [...ids].sort().join('\u0000')

/** Sırasız filtre eşitliği; adrese yalnızca görünümden farklı olan yazılır (R5). */
export const sameFilters = (a: FilterCondition[], b: FilterCondition[]) => filtersKey(a) === filtersKey(b)
export const sameSort = (a: ViewState['sort'], b: ViewState['sort']) => canonical(a) === canonical(b)

/** Normalize karşılaştırma: `in` değerleri sırasız, görünürler küme, genişlikte ±2 px tolerans. */
export function sameState(a: ViewState, b: ViewState): boolean {
  if (!sameFilters(a.filters, b.filters) || !sameSort(a.sort, b.sort)) return false
  const ca = a.columns
  const cb = b.columns
  if (ca.order.join('\u0000') !== cb.order.join('\u0000') || sorted(ca.visible) !== sorted(cb.visible)) return false
  if (ca.pinned.left.join('\u0000') !== cb.pinned.left.join('\u0000')) return false
  if (ca.pinned.right.join('\u0000') !== cb.pinned.right.join('\u0000')) return false
  for (const id of new Set([...Object.keys(ca.widths), ...Object.keys(cb.widths)])) {
    const x = ca.widths[id]
    const y = cb.widths[id]
    if (x === undefined || y === undefined ? x !== y : Math.abs(x - y) > 2) return false
  }
  return true
}

export type NameError = 'required' | 'tooLong' | 'taken'
/** Save as new view / Rename (04 §7): zorunlu, en fazla 60, kişisel görünümler arasında benzersiz (büyük/küçük harf duyarsız). */
export function nameError(name: string, views: View[], locale: string, selfId?: string): NameError | null {
  const n = name.trim()
  if (!n) return 'required'
  if (n.length > 60) return 'tooLong'
  const lower = n.toLocaleLowerCase(locale)
  const taken = views.some(
    (v) => v.kind === 'personal' && v.id !== selfId && v.name.toLocaleLowerCase(locale) === lower,
  )
  return taken ? 'taken' : null
}

/** Kişisel görünümler ada göre (yerel ayar karşılaştırması); system kod sırasında kalır. */
export const byName = (views: View[], collator: Intl.Collator): View[] =>
  [...views].sort((a, b) => collator.compare(a.name, b.name))
