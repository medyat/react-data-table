/** Nokta yolu okuma: 'customer.title' → row.customer?.title (null-güvenli). En fazla 4 seviye (api-draft). */
export function readPath(row: unknown, path: string): unknown {
  let v: unknown = row
  for (const key of path.split('.')) {
    if (v === null || v === undefined) return undefined
    v = (v as Record<string, unknown>)[key]
  }
  return v
}
