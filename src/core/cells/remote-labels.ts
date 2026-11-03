// `ajax` ve `user` hücreleri için etiket önbelleği: id'ler toplanır, bir mikro görevde tek `resolve` çağrısıyla çözülür (03).
// Çözülene kadar ham değer görünür; çözülünce `version` artar, ızgara `useSyncExternalStore` ile yeniden çizer.
import type { OptionDef, RemoteOptions } from '../../types/columns'

export class RemoteLabels {
  private readonly cache = new Map<string, Map<string | number, OptionDef>>()
  private readonly pending = new Map<string, { remote: RemoteOptions; ids: Set<string | number> }>()
  private readonly inFlight = new Map<string, Set<string | number>>()
  private scheduled = false
  private readonly listeners = new Set<() => void>()
  /** Her çözümde artar. */
  version = 0

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  readonly getVersion = (): number => this.version

  option(columnId: string, remote: RemoteOptions | undefined, id: string | number): OptionDef | undefined {
    const hit = this.cache.get(columnId)?.get(id)
    if (hit || !remote) return hit
    if (!this.inFlight.get(columnId)?.has(id)) {
      let p = this.pending.get(columnId)
      if (!p) this.pending.set(columnId, (p = { remote, ids: new Set() }))
      p.ids.add(id)
      this.schedule()
    }
    return undefined
  }

  label(columnId: string, remote: RemoteOptions | undefined, id: string | number): string {
    return this.option(columnId, remote, id)?.label ?? String(id)
  }

  /** Testler ve uygulama için: dış kaynaktan gelen etiketleri doğrudan yaz. */
  seed(columnId: string, options: OptionDef[]) {
    let m = this.cache.get(columnId)
    if (!m) this.cache.set(columnId, (m = new Map()))
    for (const o of options) m.set(o.value, o)
    this.version++
    for (const l of this.listeners) l()
  }

  private schedule() {
    if (this.scheduled) return
    this.scheduled = true
    queueMicrotask(() => {
      this.scheduled = false
      for (const [columnId, { remote, ids }] of this.pending) {
        this.pending.delete(columnId)
        const batch = [...ids]
        let flight = this.inFlight.get(columnId)
        if (!flight) this.inFlight.set(columnId, (flight = new Set()))
        batch.forEach((id) => flight.add(id))
        remote
          .resolve(batch, { signal: new AbortController().signal })
          .then((options) => this.seed(columnId, options))
          .catch(() => {
            /* ham değer görünür kalır; yeniden deneme uygulamanın (D18) */
          })
          .finally(() => batch.forEach((id) => flight.delete(id)))
      }
    })
  }
}
