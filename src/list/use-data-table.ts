// Tablonun durumu ve mantığı (R3, R5). Ekranın başka yerleri de buradan okur; `<DataTable table={…} />` çizer.
import { useState, useSyncExternalStore } from 'react'
import { useColumnLayout } from '../core/columns/use-column-layout'
import { readPath } from '../core/columns/read-path'
import { usePreferences } from '../core/preferences/use-preferences'
import { useDataTableContext } from '../core/provider'
import { defaultView, sameFilters, sameSort } from '../core/views/model'
import type { ColumnDef } from '../types/columns'
import type { TableState, UseDataTableOptions } from '../types/list'
import type { FilterCondition, SortRule, TableQuery } from '../types/query'
import type { View, ViewPatch, ViewState } from '../types/views'
import { setSort, toggleSort } from './sort'
import { useListTable } from './use-list-table'
import { useViews } from './use-views'

/** Hazır "Tümü" görünümünün kimliği (R19); adreste ve kişisel varsayılan tercihinde bu değerle durur. */
const ALL_VIEW_ID = 'all'
const PAGE_SIZES = [50, 100, 250, 500]
const NONE: Record<string, true> = {}

/** İstenecek alanlar (R4): satır anahtarı, görünür sütunların yolu ve `fields`'i, tablonun `fields`'i; koddaki sırayla. */
function fieldsOf<Row extends object>(
  columns: Array<ColumnDef<Row>>,
  visible: Set<string>,
  rowKey: string,
  extra: string[] = [],
): string[] {
  const out = new Set([rowKey])
  for (const c of columns) {
    if (!visible.has(c.id as string)) continue
    if (!c.accessor) out.add(c.id as string)
    for (const f of c.fields ?? []) out.add(f)
  }
  for (const f of extra) out.add(f)
  return [...out]
}

export function useDataTable<Row extends object>(options: UseDataTableOptions<Row>) {
  const ctx = useDataTableContext()
  const rowKey = options.rowKey ?? 'id'
  const rowId = (row: Row) => String(readPath(row, rowKey))
  const prefs = usePreferences(options.id, ctx.preferences, {
    density: 'standard',
    verticalLines: false,
    pageSize: options.pageSize ?? 100,
    defaultViewId: null,
  })
  // R19: hazır "Tümü" görünümü her ekranda ilk sıradadır; uygulama aynı kimlikle verirse onunki geçer. Adapter da görünüm
  // de yoksa menü hiç çizilmez: tek seçenekli menü anlamsız olurdu.
  const appViews = options.views ?? []
  const system: View[] =
    appViews.some((v) => v.id === ALL_VIEW_ID) || (!appViews.length && !ctx.viewsAdapter)
      ? appViews
      : [{ id: ALL_VIEW_ID, name: ctx.i18n.t('views.all'), kind: 'system', state: {} }, ...appViews]
  // R5: `state` verilince durum yalnızca odur, eksik alan varsayılandır; verilmezse içeride (`initialState` ile başlar).
  const [inner, setInner] = useState<Partial<TableState>>(() => ({ ...options.initialState }))
  const source = options.state ?? inner
  // Açılıştaki sütun düzeni: istenen ya da varsayılan system görünümünün; kişisel olan liste gelince (useViews).
  const [opening] = useState(() =>
    source.view === undefined
      ? defaultView(system, prefs.prefs.defaultViewId)
      : system.find((v) => v.id === source.view),
  )
  const layout = useColumnLayout({ columns: options.columns, layout: opening?.state.columns })

  // Genişlik değişimi hook'u yeniden çizmez (05 · Resize); "edited" için sürükleme bitince bir kez çizilir.
  useSyncExternalStore(layout.subscribeSizing, () => (layout.resizing() ? '' : JSON.stringify(layout.state().widths)))
  const resolve = (p: ViewPatch): ViewState => ({
    filters: p.filters ?? [],
    sort: p.sort ?? [],
    columns: layout.resolve(p.columns),
  })
  const views = useViews({
    tableId: options.id,
    system,
    adapter: ctx.viewsAdapter,
    locale: ctx.locale,
    defaultViewId: prefs.prefs.defaultViewId,
    setDefaultViewId: (id) => {
      // Temiz adres "varsayılan" demektir: varsayılan değişince ekrandaki görünüm adreste açıkça kalır.
      if (source.view === undefined) update({}, defaultView(views.all, id)?.id ?? null)
      prefs.set({ defaultViewId: id })
    },
    requested: source.view,
    query: { filters: source.filters, sort: source.sort },
    columns: layout.state(),
    resolve,
    apply: (view, s) => {
      layout.reset(s.columns)
      update({ view, filters: s.filters, sort: s.sort, page: 1 })
    },
    // `reset(undefined)` açılışın düzenine döner; sütunsuz görünüm tablonun varsayılanıdır.
    restoreColumns: (columns) => layout.reset(columns ?? {}),
  })
  const state: TableState = {
    view: views.activeId,
    search: source.search ?? '',
    filters: views.current.filters,
    sort: views.current.sort,
    page: source.page ?? 1,
    pageSize: source.pageSize ?? prefs.prefs.pageSize,
  }
  /**
   * `changed`: varsayılandan farklı alanlar. `defaultId` yalnızca bu değişimle birlikte değişen varsayılan görünüm için.
   * Sayfa boyutu değişimden önceki tercihle karşılaştırılır: tercihi kalıcı saklamayan uygulamada yalnızca adreste yaşar.
   */
  const update = (patch: Partial<TableState>, defaultId = views.defaultId) => {
    const next = { ...state, ...patch }
    setInner(next)
    const stored = resolve(views.all.find((v) => v.id === next.view)?.state ?? {})
    const changed: Partial<TableState> = {
      ...(next.view !== defaultId && { view: next.view }),
      ...(next.search && { search: next.search }),
      ...(!sameFilters(next.filters, stored.filters) && { filters: next.filters }),
      ...(!sameSort(next.sort, stored.sort) && { sort: next.sort }),
      ...(next.page > 1 && { page: next.page }),
      ...(next.pageSize !== prefs.prefs.pageSize && { pageSize: next.pageSize }),
    }
    options.onStateChange?.(next, changed)
  }

  // Sütun taşımak ya da gizlemek isteği değiştirmez (R4): alanlar yalnızca yeni görünen sütunla, ya da sorgu değişince
  // yeniden kurulur. Önceki isteğin alanları render'lar arasında saklanır.
  const visible = fieldsOf(options.columns, new Set(layout.columns.map((c) => c.id)), rowKey, options.fields)
  const identity = JSON.stringify([state.search, state.filters, state.sort, state.page, state.pageSize])
  const [sent, setSent] = useState({ identity, fields: visible })
  let fields = sent.fields
  if (sent.identity !== identity || visible.some((f) => !sent.fields.includes(f))) {
    fields = visible
    setSent({ identity, fields })
  }
  const request: TableQuery = {
    search: state.search,
    filters: state.filters,
    sort: state.sort,
    page: { number: state.page, size: state.pageSize },
    fields,
  }

  // Seçim sayfa kapsamlı (D19): sayfa, sayfa boyutu, filtre, arama ve sıralama değişince temizlenir; refresh'te kalır.
  const [selected, setSelected] = useState({ identity, ids: NONE })
  if (selected.identity !== identity) setSelected({ identity, ids: NONE })
  const selection = selected.identity === identity ? selected.ids : NONE

  const client = useListTable({
    columns: options.columns,
    rows: options.rows,
    rowId,
    locale: ctx.locale,
    search: state.search,
    filters: state.filters,
    sort: state.sort,
    page: state.page,
    pageSize: state.pageSize,
  })

  return {
    id: options.id,
    columns: options.columns,
    entityName: options.entityName ?? { one: options.id, other: options.id },
    /** Sunucu modunda `useQuery` anahtarına ve isteğe girer (R4). */
    request,
    state,
    /** İstemci modu: verilen tüm satırlar (filtre öncesi). Sunucu modunda undefined. */
    allRows: options.rows,
    /** İstemci modu: sayfadaki satırlar ve toplam. Sunucu modunda undefined. */
    rows: client.rows,
    total: client.total,
    density: options.density ?? prefs.prefs.density,
    /** Uygulama `density` verdiyse kullanıcının seçimi etkisiz; Display'de seçici gösterilmez. */
    densityFixed: options.density !== undefined,
    prefs,
    views,
    /** Görünümün kayıtlı (kısmi) durumu → tam durum (Duplicate dialog'unun özeti). */
    resolveView: (v: { state: ViewPatch }) => resolve(v.state),
    /** Display › Reset: tercihler ve sütun düzeni aktif görünümün kayıtlı haline döner; filtre ve sıralama kalır (04 §8). */
    resetDisplay: () => {
      prefs.reset()
      layout.reset(views.active?.state.columns ?? {})
    },
    /** Seçili satır anahtarları (05 §6). Satırların kendisi `DataTable`'ın `onSelectionChange`'inde. */
    selection,
    setSelection: (ids: Record<string, true>) => setSelected({ identity, ids }),
    clearSelection: () => setSelected({ identity, ids: NONE }),
    pageSizes: options.pageSizes ?? PAGE_SIZES,
    count: options.count,
    rowId,
    layout,
    /** Header tıklaması ve ⇧ ile ikincil sıralama; sayfa 1'e döner. */
    toggleSort: (column: string, multi: boolean) => update({ sort: toggleSort(state.sort, column, multi), page: 1 }),
    setSort: (column: string, dir: 'asc' | 'desc' | null) =>
      update({ sort: setSort(state.sort, column, dir), page: 1 }),
    /** Arama ve filtre değişince sayfa 1'e döner (D19). */
    setSearch: (search: string) => update({ search, page: 1 }),
    setFilters: (filters: FilterCondition[]) => update({ filters, page: 1 }),
    /** Filtre ve sıralama tek istekte (telefon Filters › Show results, ⋯ › Sort); sayfa 1. */
    setQuery: (patch: { filters?: FilterCondition[]; sort?: SortRule[] }) => update({ ...patch, page: 1 }),
    setPage: (page: number) => update({ page }),
    setPageSize: (pageSize: number) => {
      prefs.set({ pageSize })
      update({ pageSize, page: 1 })
    },
  }
}

export type DataTableInstance<Row extends object> = ReturnType<typeof useDataTable<Row>>
