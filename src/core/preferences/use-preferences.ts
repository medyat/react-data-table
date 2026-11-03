// Kişisel tercihler (05 §9, 04 §8, D5): yoğunluk, dikey çizgiler, sayfa boyutu, varsayılan görünüm. Görünüme değil, tablo
// kimliği başına yazılır. Adapter yoksa oturumluk; senkron `get` ilk render'da, Promise dönen `get` gelince uygulanır.
import { useEffect, useState } from 'react'
import type { TableId } from '../../types/core'
import type { Preferences, PreferencesAdapter } from '../../types/views'

/** Bozuk ya da eski kayıt tercihleri bozmaz: yalnızca tipi doğru alanlar alınır. */
function merge(base: Preferences, p: Partial<Preferences> | undefined): Preferences {
  if (!p) return base
  const next = { ...base }
  if (p.density === 'comfortable' || p.density === 'standard' || p.density === 'compact') next.density = p.density
  if (typeof p.verticalLines === 'boolean') next.verticalLines = p.verticalLines
  if (typeof p.pageSize === 'number' && p.pageSize > 0) next.pageSize = p.pageSize
  if ('defaultViewId' in p) next.defaultViewId = p.defaultViewId ?? null
  return next
}

export function usePreferences(tableId: TableId, adapter: PreferencesAdapter | null, defaults: Preferences) {
  const [prefs, setPrefs] = useState<Preferences>(() => {
    const got = adapter?.get(tableId)
    return got instanceof Promise ? defaults : merge(defaults, got)
  })

  useEffect(() => {
    const got = adapter?.get(tableId)
    if (!(got instanceof Promise)) return
    let live = true
    got.then((p) => live && setPrefs((prev) => merge(prev, p))).catch(() => {})
    return () => {
      live = false
    }
  }, [adapter, tableId])

  const set = (patch: Partial<Preferences>) => {
    setPrefs((prev) => merge(prev, patch))
    if (adapter) void Promise.resolve(adapter.set(tableId, patch)).catch(() => {})
  }

  return {
    prefs,
    set,
    /** Display › Reset: ekran ayarları; varsayılan görünüm seçimi kalır (görünüm menüsünden yönetilir). */
    reset: () => set({ density: defaults.density, verticalLines: defaults.verticalLines, pageSize: defaults.pageSize }),
    /** Arayüz "Saved for you only" notunu yalnızca kalıcı depoda gösterir. */
    persistent: adapter !== null,
  }
}
