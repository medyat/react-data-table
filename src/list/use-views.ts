// Görünümler (04 §7, D4, D5, D30, R6): system görünümler (`views` seçeneği) + adapter'daki kişisel görünümler, açılış seçimi,
// düzenlenmiş durum, görünüm başına kaydedilmemiş taslak (bellekte, oturum boyu), kaydet / kopyala / yeniden adlandır / sil.
// Paket veri çekmez (D18): adapter'ı uygulama verir, yoksa kaydetme yoktur.
//
// Vue'dan farkı: aktif görünüm tablonun durumundadır (`state.view`, adrese bağlanabilir, R5) ve "edited" saklanmaz, her
// çizimde ekrandaki durum görünümün kayıtlı durumuyla karşılaştırılarak türetilir. Böylece adresten gelen görünüm + filtre
// sayfa yenilenince de doğru "edited" gösterir.
import { useEffect, useRef, useState } from 'react'
import { byName, defaultView, sameState } from '../core/views/model'
import type { View, ViewPatch, ViewState, ViewsAdapter } from '../types/views'

export interface ViewsOptions {
  tableId: string
  system: View[]
  adapter: ViewsAdapter | null
  locale: string
  defaultViewId: string | null
  setDefaultViewId: (id: string | null) => void
  /** `state.view`: undefined ise açılışta varsayılan seçildi (`auto`). */
  activeId: string | null
  /** Açılış görünümü paket tarafından seçildiyse: kişisel liste / tercih gelince varsayılana geçilebilir. */
  auto: boolean
  /** Tercihler yüklendi (Promise dönen adapter'da sonradan). */
  prefsReady: boolean
  /** Ekrandaki durum (filtre + sıralama + sütun düzeni). */
  current: ViewState
  /** Kayıtlı (kısmi) durum → tam durum; eksikler tablonun varsayılanı. */
  resolve: (patch: ViewPatch) => ViewState
  /** Tek adımda uygular (tek istek): görünüm kimliği, filtre, sıralama, sütunlar, sayfa 1. */
  apply: (id: string | null, state: ViewState) => void
  /** Yalnızca sütun düzeni: dışarıdan verilen kişisel görünüm liste gelince. */
  restoreColumns: (columns: ViewPatch['columns']) => void
}

export function useViews(o: ViewsOptions) {
  const [saved, setSaved] = useState<View[]>([])
  const [loaded, setLoaded] = useState(!o.adapter)
  const [drafts, setDrafts] = useState<Record<string, ViewState>>({})
  // Kullanıcı bir görünüm seçti ya da kaydetti: geç gelen liste / tercih açılış seçimini artık değiştirmez.
  const touched = useRef(false)
  // Geç gelen varsayılan yalnızca bir kez, liste ve tercih ilk geldiğinde: sonra "Set as default" görünümü değiştirmez.
  const settled = useRef(false)

  const all = [...o.system, ...saved]
  const active = all.find((v) => v.id === o.activeId) ?? null
  const edited = !!active && !sameState(o.current, o.resolve(active.state))

  const activate = (view: View | null, keepDraft = true) => {
    const next = { ...drafts }
    if (active) {
      if (keepDraft && edited) next[active.id] = o.current
      else delete next[active.id]
    }
    setDrafts(next)
    o.apply(view?.id ?? null, view ? (next[view.id] ?? o.resolve(view.state)) : o.resolve({}))
  }

  useEffect(() => {
    if (!o.adapter) return
    let live = true
    o.adapter
      .list(o.tableId)
      .then((vs) => live && setSaved(vs))
      .catch(() => {})
      .finally(() => live && setLoaded(true))
    return () => {
      live = false
    }
  }, [o.adapter, o.tableId])

  // Kullanıcı varsayılanı kişisel bir görünüm olabilir ya da tercih sonradan gelebilir: ikisi de gelince, açılış seçimi
  // paketinse ve dokunulmadıysa bir kez varsayılana geçilir (Vue: Promise.all([list, prefsReady])).
  const ready = loaded && o.prefsReady
  useEffect(() => {
    if (!ready || settled.current) return
    settled.current = true
    if (!o.auto) {
      // Görünüm dışarıdan (adres) verildi: filtre ve sıralama oradan okunur, sütunlar yalnızca görünümde (R5).
      const given = saved.find((v) => v.id === o.activeId)
      if (given && !touched.current) o.restoreColumns(given.state.columns)
      return
    }
    const preferred = defaultView(all, o.defaultViewId)
    if (!preferred || !o.auto || touched.current || edited || preferred.id === o.activeId) return
    activate(preferred)
    // Yalnızca hazır olunca bir kez; `activate` her çizimde yeni.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  const replace = (next: View) => setSaved((vs) => vs.map((v) => (v.id === next.id ? next : v)))
  const dropDraft = (id: string) => setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== id)))
  const writable = (v: View | null) => !!v && !!o.adapter && v.kind !== 'system'
  const collator = new Intl.Collator(o.locale)

  return {
    all,
    sections: { system: o.system, personal: byName(saved, collator) },
    active,
    edited,
    // Adapter varsa ilk görünüm menüden yaratılır; tetik yalnızca ne görünüm ne adapter varken gizlenir (04 §7).
    hasViews: all.length > 0 || !!o.adapter,
    canSave: !!o.adapter,
    hasDraft: (id: string) => id in drafts,
    writable,
    select: (id: string) => {
      touched.current = true
      activate(all.find((v) => v.id === id) ?? null)
    },
    saveChanges: async () => {
      if (!writable(active) || !o.adapter) return
      replace(await o.adapter.update(o.tableId, active!.id, { state: o.current }))
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
      touched.current = true
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
      if (o.activeId === id)
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
