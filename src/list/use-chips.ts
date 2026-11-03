// Ekrandaki çipler (04 §1, §3): tam koşullar tablonun durumunda (`filters`, URL'ye gidebilir), değeri seçilmemiş tek çip
// burada taslak olarak durur. Taslak yalnızca düzenlenen çiptir: başka çipe geçince ya da popover kapanınca kaldırılır.
// Clear veya şekil değiştiren operatör tam bir çipi eksik yapar: sorgudan çıkar, ekranda aynı yerinde kalır.
import { useState } from 'react'
import { defaultOperator, isComplete, toCondition, type Chip } from '../core/filters/model'
import type { ColumnDef } from '../types/columns'
import type { FilterCondition } from '../types/query'

export function useChips({
  defs,
  filters,
  setFilters,
}: {
  defs: ReadonlyMap<string, ColumnDef>
  filters: FilterCondition[]
  setFilters: (filters: FilterCondition[]) => void
}) {
  const [draft, setDraft] = useState<{ chip: Chip; at: number } | null>(null)
  const [editing, setEditingState] = useState<string | null>(null)

  // Tanımı olmayan sütun (eski URL, kaldırılmış sütun) çip olarak çizilmez; istekte kalır, sunucu karar verir.
  const chips: Chip[] = filters.filter((f) => defs.has(f.column))
  if (draft && !chips.some((c) => c.column === draft.chip.column))
    chips.splice(Math.min(draft.at, chips.length), 0, draft.chip)
  const has = (column: string) => filters.some((f) => f.column === column)

  const setEditing = (column: string | null) => {
    setEditingState(column)
    if (draft && draft.chip.column !== column) setDraft(null)
  }

  const update = (chip: Chip) => {
    const at = chips.findIndex((c) => c.column === chip.column)
    const rest = filters.filter((f) => f.column !== chip.column)
    if (isComplete(chip, defs.get(chip.column)!.type)) {
      // Sorgudaki sırası ekrandaki yeri: öncesindeki tam çiplerin sayısı.
      const before = chips.slice(0, at).filter((c) => has(c.column)).length
      rest.splice(before, 0, toCondition(chip))
      setFilters(rest)
      setDraft(null)
    } else {
      setDraft({ chip, at })
      if (has(chip.column)) setFilters(rest)
    }
  }

  const remove = (column: string) => {
    if (draft?.chip.column === column) setDraft(null)
    if (editing === column) setEditingState(null)
    if (has(column)) setFilters(filters.filter((f) => f.column !== column))
  }

  /** Picker / header: var olan çipi açar (D2), yoksa tipin varsayılan operatörüyle oluşturur; boolean doğrudan uygulanır. */
  const pick = (column: string) => {
    const def = defs.get(column)
    if (!def) return
    if (chips.some((c) => c.column === column)) return setEditing(column)
    if (def.type === 'boolean') {
      setEditing(null)
      setFilters([...filters, { column, op: 'eq', value: true }])
      return
    }
    setEditingState(column)
    setDraft({ chip: { column, op: defaultOperator(def) }, at: chips.length })
  }

  const clear = () => {
    setDraft(null)
    setEditingState(null)
    setFilters([])
  }

  return { chips, editing, setEditing, update, remove, pick, clear }
}
