// Görünümler (04 §7, D4, D5, D30, R6): system görünümler (`views` seçeneği) + adapter'daki kişisel görünümler, etkin görünüm,
// düzenlenmiş durum, görünüm başına kaydedilmemiş taslak (bellekte, oturum boyu), kaydet / kopyala / yeniden adlandır / sil.
// Paket veri çekmez (D18): adapter'ı uygulama verir, yoksa kaydetme yoktur.
//
// Vue'dan farkı: etkin görünüm tablonun durumundan türetilir (`state.view`, adrese bağlanabilir, R5). Görünüm verilmemişse
// varsayılandır, filtre ve sıralama verilmemişse görünümün kayıtlısıdır; "edited" saklanmaz, her çizimde karşılaştırılır.
// Böylece temiz adres varsayılan görünümü, adresten gelen görünüm + filtre de sayfa yenilenince doğru "edited"i gösterir.
import { useEffect, useRef, useState } from 'react'
import { byName, defaultView, sameState } from '../core/views/model'
import type { FilterCondition, SortRule } from '../types/query'
import type { View, ViewPatch, ViewState, ViewsAdapter } from '../types/views'

export interface ViewsOptions {
  tableId: string
  system: View[]
  adapter: ViewsAdapter | null
  locale: string
  defaultViewId: string | null
  setDefaultViewId: (id: string | null) => void
  /** İstenen görünüm: undefined → varsayılan (kullanıcı varsayılanı → system default → ilk system), null → görünümsüz. */
  requested: string | null | undefined
  /** İstenen filtre ve sıralama; eksikse etkin görünümün kayıtlısı. */
  query: { filters?: FilterCondition[]; sort?: SortRule[] }
  /** Ekrandaki sütun düzeni. */
  columns: ViewState['columns']
  /** Kayıtlı (kısmi) durum → tam durum; eksikler tablonun varsayılanı. */
  resolve: (patch: ViewPatch) => ViewState
  /** Tek adımda uygular (tek istek): görünüm kimliği, filtre, sıralama, sütunlar, sayfa 1. */
  apply: (id: string | null, state: ViewState) => void
  /** Yalnızca sütun düzeni: görünüm dışarıdan değişince (adres, geç gelen liste ya da tercih). */
  restoreColumns: (columns: ViewPatch['columns']) => void
}

export function useViews(o: ViewsOptions) {
  const [saved, setSaved] = useState<View[]>([])
  const [drafts, setDrafts] = useState<Record<string, ViewState>>({})

  const all = [...o.system, ...saved]
  const defaultId = defaultView(all, o.defaultViewId)?.id ?? null
  const activeId = o.requested === undefined ? defaultId : o.requested
  const active = all.find((v) => v.id === activeId) ?? null
  const stored = o.resolve(active?.state ?? {})
  const current: ViewState = {
    filters: o.query.filters ?? stored.filters,
    sort: o.query.sort ?? stored.sort,
    columns: o.columns,
  }
  const edited = !!active && !sameState(current, stored)

  // Sütun düzeni adreste yoktur: ekrandaki düzenin ait olduğu görünüm. Görünüm `activate` dışında değişirse (adres boşaldı,
  // geri tuşu, kişisel liste ya da varsayılan tercihi sonradan geldi) düzen o görünümün kayıtlısına döner.
  const shown = useRef(active?.id ?? null)
  useEffect(() => {
    const id = active?.id ?? null
    if (shown.current === id) return
    shown.current = id
    o.restoreColumns(active?.state.columns)
    // Yalnızca etkin görünüm değişince.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id])

  const activate = (view: View | null, keepDraft = true) => {
    const next = { ...drafts }
    if (active) {
      if (keepDraft && edited) next[active.id] = current
      else delete next[active.id]
    }
    setDrafts(next)
    shown.current = view?.id ?? null
    o.apply(view?.id ?? null, view ? (next[view.id] ?? o.resolve(view.state)) : o.resolve({}))
  }

  useEffect(() => {
    if (!o.adapter) return
    let live = true
    o.adapter
      .list(o.tableId)
      .then((vs) => live && setSaved(vs))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [o.adapter, o.tableId])

  const replace = (next: View) => setSaved((vs) => vs.map((v) => (v.id === next.id ? next : v)))
  const dropDraft = (id: string) => setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== id)))
  const writable = (v: View | null) => !!v && !!o.adapter && v.kind !== 'system'
  const collator = new Intl.Collator(o.locale)

  return {
    all,
    /** Durumda görünüm verilmezse açılan görünüm. */
    defaultId,
    activeId,
    current,
    sections: { system: o.system, personal: byName(saved, collator) },
    active,
    edited,
    // Adapter varsa ilk görünüm menüden yaratılır; tetik yalnızca ne görünüm ne adapter varken gizlenir (04 §7).
    hasViews: all.length > 0 || !!o.adapter,
    canSave: !!o.adapter,
    hasDraft: (id: string) => id in drafts,
    writable,
    /** Set as default / Remove default; temiz adresteki ekran görünümü değişmez. */
    setDefault: o.setDefaultViewId,
    select: (id: string) => {
      activate(all.find((v) => v.id === id) ?? null)
    },
    saveChanges: async () => {
      if (!writable(active) || !o.adapter) return
      replace(await o.adapter.update(o.tableId, active!.id, { state: current }))
      dropDraft(active!.id)
    },
    discard: () => {
      if (!active) return
      dropDraft(active.id)
      o.apply(active.id, o.resolve(active.state))
    },
    /** Save as new view / New view / Duplicate; kayıt sonrası yeni görünüm aktif. `fromCurrent`: düzenleme yeni görünüme taşındı. */
    create: async (input: { name: string; state: ViewState; makeDefault: boolean; fromCurrent: boolean }) => {
      if (!o.adapter) return
      const v = await o.adapter.create(o.tableId, { name: input.name, state: input.state })
      setSaved((vs) => [...vs, v])
      if (input.makeDefault) o.setDefaultViewId(v.id)
      activate(v, !input.fromCurrent)
    },
    rename: async (id: string, name: string) => {
      if (o.adapter) replace(await o.adapter.update(o.tableId, id, { name }))
    },
    /** Onaydan sonra hemen `remove`; aktif silinirse varsayılana, varsayılan silinirse system default'a (04 §7). */
    remove: async (id: string) => {
      if (!o.adapter) return
      await o.adapter.remove(o.tableId, id)
      setSaved((vs) => vs.filter((v) => v.id !== id))
      dropDraft(id)
      const preferredId = o.defaultViewId === id ? null : o.defaultViewId
      if (o.defaultViewId === id) o.setDefaultViewId(null)
      if (activeId === id)
        activate(
          defaultView(
            all.filter((v) => v.id !== id),
            preferredId,
          ),
          false,
        )
    },
  }
}

export type ViewsApi = ReturnType<typeof useViews>
