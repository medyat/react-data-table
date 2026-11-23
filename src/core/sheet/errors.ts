// Sunucu hatalarının hücreye eşlenmesi (form-grid.md §6): anahtar "satır sırası.alan yolu"; alan yolunun en uzun ön
// eki olan sütun hatayı alır ("3.detail.transport.vessel_name" → `detail.transport`). Sütuna düşmeyen hata satırın.

export interface MappedErrors {
  /** satır sırası → sütun id → mesajlar */
  cells: Map<number, Map<string, string[]>>
  /** satır sırası → hiçbir sütuna düşmeyen mesajlar (satır başında) */
  rows: Map<number, string[]>
}

const push = <K>(m: Map<K, string[]>, k: K, v: string) => {
  const list = m.get(k)
  if (list) list.push(v)
  else m.set(k, [v])
}

export function mapErrors(errors: Record<string, string | string[]>, columnIds: readonly string[]): MappedErrors {
  const cells = new Map<number, Map<string, string[]>>()
  const rows = new Map<number, string[]>()
  // Uzun id önce: "detail.transport" "detail"ten önce eşleşir.
  const ids = [...columnIds].sort((a, b) => b.length - a.length)
  for (const [key, value] of Object.entries(errors)) {
    const m = /^(\d+)(?:\.(.+))?$/.exec(key)
    if (!m) continue
    const index = Number(m[1])
    const path = m[2] ?? ''
    const id = path ? ids.find((c) => path === c || path.startsWith(`${c}.`)) : undefined
    for (const message of Array.isArray(value) ? value : [value]) {
      if (id === undefined) push(rows, index, message)
      else {
        let row = cells.get(index)
        if (!row) cells.set(index, (row = new Map()))
        push(row, id, message)
      }
    }
  }
  return { cells, rows }
}
