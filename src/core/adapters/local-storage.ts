// Hazır adapter'lar (01 · plugin ve adapter'lar): tarayıcıda saklar; `scope` zorunlu, değişince eski veri taşınmaz.
import type { TableId } from '../../types/core'
import type { Preferences, PreferencesAdapter, View, ViewsAdapter } from '../../types/views'

interface KV {
  get: (key: string) => string | null
  set: (key: string, value: string) => void
}

/** localStorage yoksa ya da kapalıysa (gizli pencere, kota) bellek içi düşer; hata fırlatmaz. */
function storage(): KV {
  try {
    const ls = globalThis.localStorage
    const probe = '__dt_probe__'
    ls.setItem(probe, '1')
    ls.removeItem(probe)
    return { get: (k) => ls.getItem(k), set: (k, v) => ls.setItem(k, v) }
  } catch {
    const mem = new Map<string, string>()
    return {
      get: (k) => mem.get(k) ?? null,
      set: (k, v) => {
        mem.set(k, v)
      },
    }
  }
}

function readJson<T>(kv: KV, key: string, fallback: T): T {
  const raw = kv.get(key)
  if (raw === null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const requireScope = (scope: unknown, fn: string): string => {
  if (typeof scope !== 'string' || scope === '')
    throw new TypeError(`${fn}: 'scope' zorunlu (uygulama/kiracı anahtarı)`)
  return scope
}

const newId = (): string => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
const now = (): string => new Date().toISOString()

export function createLocalStorageViews(options: { scope: string }): ViewsAdapter {
  const scope = requireScope(options?.scope, 'createLocalStorageViews')
  const kv = storage()
  const key = (tableId: TableId) => `dt:${scope}:views:${tableId}`
  const read = (tableId: TableId) => readJson<View[]>(kv, key(tableId), [])
  const write = (tableId: TableId, views: View[]) => kv.set(key(tableId), JSON.stringify(views))

  return {
    async list(tableId) {
      return read(tableId)
    },
    async create(tableId, input) {
      const view: View = {
        id: newId(),
        name: input.name,
        kind: 'personal',
        state: input.state,
        updatedAt: now(),
      }
      write(tableId, [...read(tableId), view])
      return view
    },
    async update(tableId, id, patch) {
      const views = read(tableId)
      const i = views.findIndex((v) => v.id === id)
      if (i < 0) throw new Error(`createLocalStorageViews: görünüm yok: ${id}`)
      const next: View = {
        ...views[i]!,
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.state !== undefined && { state: patch.state }),
        updatedAt: now(),
      }
      views[i] = next
      write(tableId, views)
      return next
    },
    async remove(tableId, id) {
      write(
        tableId,
        read(tableId).filter((v) => v.id !== id),
      )
    },
  }
}

export function createLocalStoragePreferences(options: { scope: string }): PreferencesAdapter {
  const scope = requireScope(options?.scope, 'createLocalStoragePreferences')
  const kv = storage()
  const key = (tableId: TableId) => `dt:${scope}:prefs:${tableId}`
  return {
    get(tableId) {
      return readJson<Partial<Preferences>>(kv, key(tableId), {})
    },
    set(tableId, prefs) {
      kv.set(key(tableId), JSON.stringify({ ...readJson<Partial<Preferences>>(kv, key(tableId), {}), ...prefs }))
    },
  }
}
