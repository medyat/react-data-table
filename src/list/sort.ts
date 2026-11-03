// Sıralama kuralları (04 §6): tık asc → desc → kapalı ve diğerleri kalkar; ⇧ ile ikincil, en fazla 3 (dördüncüde en eski düşer).
import type { SortRule } from '../types/query'

export const MAX_SORT = 3

export function toggleSort(current: SortRule[], column: string, multi: boolean): SortRule[] {
  const at = current.findIndex((s) => s.column === column)
  const existing = at >= 0 ? current[at]! : null
  const next: SortRule | null = !existing
    ? { column, dir: 'asc' }
    : existing.dir === 'asc'
      ? { column, dir: 'desc' }
      : null
  if (!multi) return next ? [next] : []
  if (!next) return current.filter((s) => s.column !== column)
  if (at >= 0) return current.map((s) => (s.column === column ? next : s))
  return [...current, next].slice(-MAX_SORT)
}

/** Sütun menüsü: yön seçmek tek sıralama yapar; kaldırmak yalnızca o sütunu çıkarır. */
export const setSort = (current: SortRule[], column: string, dir: 'asc' | 'desc' | null): SortRule[] =>
  dir ? [{ column, dir }] : current.filter((s) => s.column !== column)
