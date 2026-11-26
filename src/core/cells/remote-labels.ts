// `ajax` ve `user` hücreleri için etiket önbelleği: id'ler toplanır, bir mikro görevde tek `resolve` çağrısıyla çözülür (03).
// Çözülürken hücre iskelet çizer (`loading`); bitince `version` artar, ızgara `useSyncExternalStore` ile yeniden çizer.
import type { OptionDef, RemoteOptions } from '../../types/columns'

export class RemoteLabels {
  private readonly cache = new Map<string, Map<string | number, OptionDef>>()
  private readonly pending = new Map<string, { remote: RemoteOptions; ids: Set<string | number> }>()
  private readonly inFlight = new Map<string, Set<string | number>>()
  // `resolve`'un döndürmediği id'ler (silinmiş kayıt, başka kaynaktan kod): yeniden sorulmaz. Sorulsaydı her çözüm
  // ızgarayı yeniden çizer, çizim aynı id'yi yine sorardı; tıklama gibi ayrık olaydan sonra bu döngü eşzamanlı
  // dönüp sekmeyi kilitliyordu. Aramadan gelen seçenek önbelleğe yazılınca yine bulunur (önbellek önce bakılır).
  private readonly missing = new Map<string, Set<string | number>>()
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
    if (hit || !remote || this.missing.get(columnId)?.has(id)) return hit
    if (!this.inFlight.get(columnId)?.has(id)) {
      let p = this.pending.get(columnId)
      if (!p) this.pending.set(columnId, (p = { remote, ids: new Set() }))
      p.ids.add(id)
      this.schedule()
    }
    return undefined
  }

  /** Kimlik sorulmayı bekliyor ya da yolda: hücre ham değer yerine iskelet çizer. */
  loading(columnId: string, id: string | number): boolean {
    if (this.cache.get(columnId)?.has(id) || this.missing.get(columnId)?.has(id)) return false
    return !!this.pending.get(columnId)?.ids.has(id) || !!this.inFlight.get(columnId)?.has(id)
  }

  label(columnId: string, remote: RemoteOptions | undefined, id: string | number): string {
    return this.option(columnId, remote, id)?.label ?? String(id)
  }

  /** Testler ve uygulama için: dış kaynaktan gelen etiketleri doğrudan yaz. */
  seed(columnId: string, options: OptionDef[]) {
    if (!options.length) return
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
        let miss = this.missing.get(columnId)
        if (!miss) this.missing.set(columnId, (miss = new Set()))
        const missing = miss
        remote
          .resolve(batch, { signal: new AbortController().signal })
          .then((options) => {
            const found = new Set(options.map((o) => o.value))
            for (const id of batch) if (!found.has(id)) missing.add(id)
            this.seed(columnId, options)
          })
          .catch(() => {
            // Hata alan kimlik bulunamamış sayılır: ham değer görünür. Sayılmasaydı iskelet kalkınca her çizim yeniden
            // sorardı; kalıcı hatada bu sonsuz döngüdür. Yeniden deneme uygulamanın (D18).
            batch.forEach((id) => missing.add(id))
          })
          .finally(() => {
            batch.forEach((id) => flight.delete(id))
            // Bulunamayan kimliğin hücresi de iskeletten çıkmalı: bir kez yeniden çizilir, yeniden sorulmaz.
            this.version++
            for (const l of this.listeners) l()
          })
      }
    })
  }
}
