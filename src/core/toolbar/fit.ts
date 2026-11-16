/**
 * Araç çubuğunun eylem alanı (R25): ikinciller listedeki sırayla önceliklidir, sığmayan sondan başlayarak ⋯'ya iner;
 * hiçbiri kalmayınca birincil yalnızca ikon olur. `fixed`: eylemler dışındaki her şey (aralıkları dahil); her düğme
 * önüne bir `gap` alır. Birincil yoksa genişlikleri 0'dır.
 */
export function fitActions({
  available,
  fixed,
  gap,
  secondary,
  primary,
}: {
  available: number
  fixed: number
  gap: number
  secondary: number[]
  primary: number
}): { shown: number; label: boolean } {
  const slot = (w: number) => (w > 0 ? gap + w : 0)
  for (let shown = secondary.length; shown >= 0; shown--) {
    const used = fixed + secondary.slice(0, shown).reduce((sum, w) => sum + slot(w), 0) + slot(primary)
    if (used <= available) return { shown, label: true }
  }
  return { shown: 0, label: false }
}
