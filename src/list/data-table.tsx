// Liste bileşeni (05): ızgara, footer, durum ekranları, yükleme geçişleri (R4). Paket veri çekmez (D18): sunucu modunda
// `useQuery` sonucunu `result` olarak alır; istemci modunda satırlar `useDataTable({ rows })`'dan gelir.
import { CircleNotchIcon, FunnelIcon, PlusIcon, WarningIcon } from '@phosphor-icons/react'
import {
  lazy,
  Suspense,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { optionLabel } from '../core/cells/format'
import { exportFile } from '../core/export/write'
import { readPath } from '../core/columns/read-path'
import { RemoteLabels } from '../core/cells/remote-labels'
import { ColumnPicker } from '../core/filters/column-picker'
import { FilterBar } from '../core/filters/filter-bar'
import { toCondition } from '../core/filters/model'

// Telefon Filters sayfası ilk açılışta yüklenir.
// lazy() generic bileşenin tip parametresini düşürür; satır tipi dialog'a aynen geçer.
const ColumnsDialog = lazy(
  () => import('../core/toolbar/columns-dialog'),
) as unknown as typeof import('../core/toolbar/columns-dialog').default
const FiltersSheet = lazy(() => import('../core/filters/filters-sheet').then((m) => ({ default: m.FiltersSheet })))
import { summarize, type Chip } from '../core/filters/model'
import { getFormat } from '../core/format'
import type { HeaderSort } from '../core/grid/header-cell'
import { Grid } from '../core/grid/grid'
import { DelegatedTooltip } from '../core/grid/tooltip'
import { isTextInput } from '../core/interaction/is-interactive'
import { useDataTableContext } from '../core/provider'
import { StateMessage } from '../core/states/state-message'
import { DisplayPopover } from '../core/toolbar/display-popover'
import { MoreMenu } from '../core/toolbar/more-menu'
import { PhoneMoreSheet } from '../core/toolbar/phone-more-sheet'
import { Toolbar, type ToolbarHandle, type ToolbarSize } from '../core/toolbar/toolbar'
import { ConfirmDialog } from '../core/ui/confirm-dialog'
import { nameError } from '../core/views/model'
import { ViewDialog, type ViewSummary } from '../core/views/view-dialog'
import { ViewMenu } from '../core/views/view-menu'
import type { ColumnDef } from '../types/columns'
import type { BulkAction, DataTableResult, RowAction, RowClickMode } from '../types/list'
import type { FilterCondition, QueryWithoutPage } from '../types/query'
import type { View, ViewState } from '../types/views'
import { BulkBar } from './bulk-bar'
import { Footer, type Freshness } from './footer'
import { useChips } from './use-chips'
import { isFilterable, isSearchable, isSortable } from './use-list-table'
import type { DataTableInstance } from './use-data-table'
import { useLoadState } from './use-load-state'

/** `error` yapısal okunur: TanStack Query'nin `Error`'u, uygulamanın `{ message, id }`'si ya da düz metin. */
const NONE: Record<string, true> = {}

function errorInfo(error: unknown): { message?: string; id?: string } {
  if (typeof error === 'string') return { message: error }
  if (typeof error !== 'object' || !error) return {}
  const e = error as { message?: unknown; id?: unknown }
  return {
    message: typeof e.message === 'string' ? e.message : undefined,
    id: typeof e.id === 'string' || typeof e.id === 'number' ? String(e.id) : undefined,
  }
}

export function DataTable<Row extends object>({
  table,
  result,
  label,
  empty,
  toolbar = 'auto',
  toolbarEnd,
  notice,
  searchPlaceholder,
  autoRefresh,
  onPrint,
  exportable = true,
  onExport,
  shortcuts = true,
  onRowClick,
  rowClick = 'none',
  onRowOpen,
  rowActions,
  selectable = false,
  selectionBar = 'floating',
  bulkActions,
  selectionActions,
  onSelectionChange,
  renderExpanded,
  canExpand,
  rowError,
}: {
  table: DataTableInstance<Row>
  /** Sunucu modu: `useQuery` sonucu, dönüştürmeden (R4). İstemci modunda verilmez. */
  result?: DataTableResult<Row>
  /** Izgaranın erişilebilir adı. Verilmezse `entityName.other`. */
  label?: string
  /** Hiç satır yokken (filtre ve arama yokken) gövdede; verilmezse "No {entity} yet". */
  empty?: ReactNode
  /** auto: yapılandırılana göre yuvalar; minimal: yalnızca arama (3a) + `toolbarEnd`; false: araç çubuğu yok. */
  toolbar?: 'auto' | 'minimal' | false
  /** Ekrana özgü birincil aksiyon, araç çubuğunun sonunda (ör. "New order"). */
  toolbarEnd?: ReactNode
  /**
   * Araç çubuğu ile sütun başlıkları arasında uygulamanın şeridi (R16): listenin bağlamını anlatır
   * ("Yalnızca arşivlenmiş kayıtlar"). İçerik ve rolü uygulamanındır; paket yer ve hizayı verir.
   */
  notice?: ReactNode
  /** Verilmezse "Search {entity}…". */
  searchPlaceholder?: string
  /** Saniye. Verilirse ⋯ menüsünde Auto-refresh; açıkken footer "Live". */
  autoRefresh?: number
  /** Verilirse ⋯ › Print. Sorgu sayfasızdır. */
  onPrint?: (payload: { query: QueryWithoutPage; visibleColumns: string[] }) => void
  /** ⋯ › Export (D46). Varsayılan açık; `false` gizler (ör. yetki). */
  exportable?: boolean
  /** Verilirse paket dosya yazmaz; `rows` paketin yazacağı satırlardır (seçim varsa seçili, yoksa sayfadaki). */
  onExport?: (payload: {
    format: 'csv' | 'xlsx'
    query: QueryWithoutPage
    selection: Row[]
    rows: Row[]
    visibleColumns: string[]
  }) => void
  /** Tek harfli kısayollar (/ arama, F filtre, R yenile, V görünümler) ve ⌘S. Alt←/→ her zaman çalışır. */
  shortcuts?: boolean
  /** Satır gövdesine düz tık; hücredeki düğme, link ve metin seçimi tetiklemez (05 §7). `rowClick`'ten bağımsız. */
  onRowClick?: (row: Row, event: MouseEvent) => void
  /** Satır gövdesine tıklama (D6): 'open' birincil linki açar, 'expand' detayı açıp kapatır. Varsayılan 'none'. */
  rowClick?: RowClickMode
  /** Birincil linke düz sol tık, menüde Open, `rowClick="open"`. Paket gezinmeyi durdurmaz: `event.preventDefault()` dinleyicide. */
  onRowOpen?: (payload: { row: Row; href: string; event: MouseEvent }) => void
  /** Satır menüsü (⋯): Open / Copy yerleşik + bunlar. */
  rowActions?: Array<RowAction<Row>>
  /** Seçim sütunu; seçim sayfa kapsamlıdır (D19), durum `table.selection`'da. */
  selectable?: boolean
  /** Seçim çubuğu: yüzer (varsayılan) ya da araç çubuğunun yerine. */
  selectionBar?: 'floating' | 'toolbar'
  bulkActions?: Array<BulkAction<Row>>
  /** `bulkActions` yerine seçim çubuğunun içeriği. */
  selectionActions?: (props: { rows: Row[]; clear: () => void }) => ReactNode
  /** Seçim her değiştiğinde; sayfadaki seçili satırlar (D19). */
  onSelectionChange?: (rows: Row[]) => void
  /** Satır detayı (05 §7): birincil hücrede chevron; veriyi detay bileşeni çeker. */
  renderExpanded?: (props: { row: Row; close: () => void }) => ReactNode
  /** Bu satırın detayı var mı? Yoksa chevron yerinde boşluk kalır. */
  canExpand?: (row: Row) => boolean
  /** Satır hatası (D35): metin ya da metin listesi → hata zemini, ⋯ hücresinde uyarı ikonu, satırda tooltip. Harita
   * uygulamanın: paket hata saklamaz, temizlemez. */
  rowError?: (row: Row) => string | string[] | null | undefined
}) {
  const { i18n, locale } = useDataTableContext()
  const fmt = getFormat(locale)
  const entity = table.entityName
  const q = table.request
  const server = table.rows === undefined
  const load = useLoadState(server ? result : undefined, JSON.stringify([q.search, q.filters, q.sort, q.page]), q.page)
  const rows = server ? load.rows : (table.rows ?? [])
  const hasRows = rows.length > 0
  const refetch = server ? result?.refetch : undefined
  const busy = load.busy

  // Filtreler (04): tam koşullar tablonun durumunda, eksik çip ve açık editör burada.
  const defs = new Map(table.columns.map((c) => [c.id as string, c as ColumnDef]))
  const filterable = table.columns.filter((c) => isFilterable(c as ColumnDef)) as ColumnDef[]
  const filterIds = new Set(filterable.map((c) => c.id as string))
  const chips = useChips({ defs, filters: q.filters, setFilters: table.setFilters })
  const [pickerOpen, setPickerOpen] = useState(false)
  // Telefon Filters sayfası (04 §9): her açılışta yeni `key` ile taslak o anki çiplerden kurulur.
  const [sheet, setSheet] = useState<{ key: number; open: boolean; column?: string } | null>(null)
  const openSheet = (column?: string) => setSheet((s) => ({ key: (s?.key ?? 0) + 1, open: true, column }))
  const [labels] = useState(() => new RemoteLabels())
  // Seçenek editörü (renk) ve para birimi listesi yüklü satırlardan.
  const sourceRows: object[] = server ? rows : (table.allRows ?? [])
  const labelOf = (def: ColumnDef) => (v: string | number) => {
    if (def.type === 'select' || def.type === 'multiselect' || (def.type === 'user' && def.options))
      return optionLabel(def.options, v)
    if ((def.type === 'user' || def.type === 'ajax') && def.remote) return labels.label(def.id as string, def.remote, v)
    return String(v)
  }
  const summaryOf = (chip: Chip) =>
    summarize(chip, defs.get(chip.column)!, { i18n, fmt, labelOf: labelOf(defs.get(chip.column)!) })
  const currenciesOf = (def: ColumnDef): string[] => {
    if (def.type !== 'currency') return []
    if (typeof def.currency === 'string') return [def.currency]
    const of = def.currency
    return [...new Set(sourceRows.map((r) => of(r)))]
  }
  const hasFilter = toolbar === 'auto' && filterable.length > 0
  const hasSearch = toolbar !== false && table.columns.some((c) => isSearchable(c as ColumnDef))
  const toolbarRef = useRef<ToolbarHandle>(null)

  // Columns dialog'u (D45): Display popover'ı ve sütun menüsü açar. Dialog ve @dnd-kit ilk açılışta yüklenir, sonra
  // bağlı kalır; kapanınca odak açan düğmeye döner (açan popover / menü o an kapanmıştır).
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [columnsUsed, setColumnsUsed] = useState(false)
  const columnsFrom = useRef<HTMLElement | null>(null)
  const openColumns = (from: HTMLElement | null) => {
    columnsFrom.current = from
    setColumnsUsed(true)
    setColumnsOpen(true)
  }

  // Görünümler (04 §7): menü, Save as new view / Rename dialog'u, silme onayı. Görünüm uygulanınca açık çip taslağı kalkar.
  const vw = table.views
  const hasViews = toolbar === 'auto' && vw.hasViews
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [viewDialog, setViewDialog] = useState<{
    key: number
    mode: 'create' | 'rename'
    name: string
    state: ViewState
    summary: ViewSummary | null
    view?: View
    /** Mevcut düzenleme yeni görünüme taşınır (Save as new / New view); Duplicate'te aktif görünümün taslağı kalır. */
    fromCurrent: boolean
  } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<View | null>(null)
  const current = (): ViewState => ({ filters: q.filters, sort: q.sort, columns: table.layout.state() })
  const viewSummary = (s: ViewState): ViewSummary => {
    const lead = s.sort[0]
    const more = s.sort.length > 1 ? ` +${s.sort.length - 1}` : ''
    const pinned = [...s.columns.pinned.left, ...s.columns.pinned.right].map(headerOf).join(', ')
    return {
      filters: s.filters.map((f) => headerOf(f.column)).join(' · ') || i18n.t('common.empty'),
      sort: lead ? `${headerOf(lead.column)} ${lead.dir === 'asc' ? '↑' : '↓'}${more}` : i18n.t('common.empty'),
      columns: [
        i18n.t('views.columnsSummary', { shown: s.columns.visible.length, total: table.columns.length }),
        ...(pinned ? [i18n.t('views.pinnedSummary', { name: pinned })] : []),
      ].join(' · '),
    }
  }
  /** Save as new view / Save as my view / New view: mevcut durum, ad boş. Duplicate: kaynağın kayıtlı durumu, "{ad} copy". */
  const openSaveAs = (view?: View) => {
    const state = view ? table.resolveView(view) : current()
    setViewDialog({
      key: (viewDialog?.key ?? 0) + 1,
      mode: 'create',
      name: view ? i18n.t('views.copyName', { name: view.name }) : '',
      state,
      summary: viewSummary(state),
      view,
      fromCurrent: !view,
    })
  }
  const selectView = (id: string) => {
    chips.setEditing(null)
    vw.select(id)
  }

  // Seçim ve expand (05 §6–7): seçim tabloda (sorgu değişince temizlenir), açık detaylar burada aynı kuralla.
  const rowKeys = rows.map(table.rowId).join('\u0000')
  const selectedRows = selectable ? rows.filter((r) => table.selection[table.rowId(r)]) : []
  const selectedKey = selectedRows.map(table.rowId).join('\u0000')
  const selectRows = (ids: string[], value: boolean) => {
    const next = { ...table.selection }
    for (const id of ids) {
      if (value) next[id] = true
      else delete next[id]
    }
    table.setSelection(next)
  }
  const expandKey = JSON.stringify([q.search, q.filters, q.sort, q.page])
  const [open, setOpen] = useState({ key: expandKey, ids: NONE })
  if (open.key !== expandKey) setOpen({ key: expandKey, ids: NONE })
  const expanded = open.key === expandKey ? open.ids : NONE
  const toggleExpand = (id: string, value: boolean) => {
    const next = { ...expanded }
    if (value) next[id] = true
    else delete next[id]
    setOpen({ key: expandKey, ids: next })
    // Açılan detay satır sayısıyla okunur (08 §5): detay çizildikten sonra DOM'dan.
    const row = rows.find((r) => table.rowId(r) === id)
    if (value && row)
      requestAnimationFrame(() => {
        const sub = [...(root.current?.querySelectorAll<HTMLElement>('.dt-subrow') ?? [])].find((el) =>
          el.id.endsWith(`-sub-${id}`),
        )
        const count = sub ? sub.querySelectorAll('[role="row"], tr').length : 0
        setSeen((s) => ({ ...s, text: i18n.t('sr.expanded', { label: primaryLabel(row), count }) }))
      })
  }
  // Yeni veride olmayan anahtarlar düşer (05 §12): refresh'te kalan satırların seçimi ve açıklığı korunur. Seçim tablonun
  // durumu olduğundan effect'te, açıklık burada render sırasında.
  const ids = new Set(rows.map(table.rowId))
  const keep = (o: Record<string, true>) =>
    Object.fromEntries(Object.entries(o).filter(([id]) => ids.has(id))) as Record<string, true>
  if (Object.keys(expanded).some((id) => !ids.has(id))) setOpen({ key: expandKey, ids: keep(expanded) })
  useEffect(() => {
    if (Object.keys(table.selection).some((id) => !ids.has(id))) table.setSelection(keep(table.selection))
    // Yalnızca satırlar değişince.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowKeys])
  const lastSelected = useRef('')
  useEffect(() => {
    if (lastSelected.current === selectedKey) return
    lastSelected.current = selectedKey
    onSelectionChange?.(selectedRows)
    // Yalnızca seçim değişince.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey])

  // Birincil hücre (D6): link, aria etiketleri ve Copy için metin; ⋯ sütunu birincil sütun ya da rowActions varsa.
  const primaryDef = table.columns.find((c) => c.primary)
  const primaryHref = (row: Row) => primaryDef?.href?.(row)
  const primaryLabel = (row: Row): string => {
    const v = primaryDef
      ? primaryDef.accessor
        ? primaryDef.accessor(row)
        : readPath(row, primaryDef.id as string)
      : table.rowId(row)
    return v === null || v === undefined ? '' : String(v)
  }
  const rowMenu = !!rowActions?.length || !!primaryDef
  const handleRowClick = (row: Row, event: MouseEvent) => {
    onRowClick?.(row, event)
    if (rowClick === 'open')
      (event.target as Element).closest('.dt-row')?.querySelector<HTMLElement>('.dt-cell.is-primary a.dt-link')?.click()
    else if (rowClick === 'expand' && renderExpanded && (canExpand?.(row) ?? true)) {
      const id = table.rowId(row)
      toggleExpand(id, !expanded[id])
    }
  }

  // Count total (05 §8): sonuç arama/filtre/sıralama değişene kadar geçerli; değişince bekleyen sayım iptal edilir.
  const countKey = JSON.stringify([q.search, q.filters, q.sort])
  const [counted, setCounted] = useState<{ key: string; total: number; at: Date } | null>(null)
  const [counting, setCounting] = useState<string | null>(null)
  const countCtl = useRef<AbortController | null>(null)
  useEffect(() => () => countCtl.current?.abort(), [countKey])
  const count = () => {
    if (!table.count) return
    countCtl.current?.abort()
    const ctl = new AbortController()
    countCtl.current = ctl
    setCounting(countKey)
    const { search, filters, sort, fields } = q
    table
      .count({ search, filters, sort, fields }, ctl.signal)
      .then((n) => !ctl.signal.aborted && setCounted({ key: countKey, total: n, at: new Date() }))
      .catch(() => {})
      .finally(() => !ctl.signal.aborted && setCounting(null))
  }
  const countedNow = counted?.key === countKey ? counted : null
  const total = server ? (result?.data?.total ?? countedNow?.total) : table.total
  const page = server ? load.page : q.page
  const hasMore = server ? !!result?.data?.hasMore : page.number * page.size < (table.total ?? 0)

  const bodyState: 'error' | 'noResults' | 'noRowsOnPage' | 'empty' | null =
    load.skeleton || hasRows || load.pending
      ? null
      : load.errorKind === 'error'
        ? 'error'
        : q.search || q.filters.length
          ? 'noResults'
          : q.page.number > 1
            ? 'noRowsOnPage'
            : 'empty'
  const err = errorInfo(result?.error)
  // Auto-refresh (05 §3): açıkken footer "Live".
  const [live, setLive] = useState(false)
  useEffect(() => {
    if (!live || !autoRefresh || !refetch) return
    const t = setInterval(() => refetch(), autoRefresh * 1000)
    return () => clearInterval(t)
  }, [live, autoRefresh, refetch])
  const freshness: Freshness =
    live && autoRefresh ? 'live' : load.bar ? 'refreshing' : load.errorKind === 'stale' ? 'stale' : 'normal'
  const clock = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })

  const sort = new Map<string, HeaderSort>(
    q.sort.map((s, i) => [s.column, { dir: s.dir, index: q.sort.length > 1 ? i + 1 : null }]),
  )
  const sortable = new Set(table.columns.filter(isSortable).map((c) => c.id as string))
  const headerOf = (id: string) => table.columns.find((c) => c.id === id)?.header ?? id

  // Ekran okuyucu (08 §5): tek polite bölge; son değişen olay okunur. İlk çizimde duyuru yok.
  const first = q.sort[0]
  const said = {
    view: table.state.view ?? '',
    filters: JSON.stringify(q.filters),
    sort: JSON.stringify(q.sort),
    loaded: `${load.updatedAt?.getTime() ?? 0}|${rows.length}`,
    total: countedNow ? countedNow.at.getTime() : 0,
    selected: selectedRows.length,
  }
  const [seen, setSeen] = useState({ ...said, text: '' })
  let polite = seen.text
  if (
    seen.view !== said.view ||
    seen.filters !== said.filters ||
    seen.sort !== said.sort ||
    seen.loaded !== said.loaded ||
    seen.total !== said.total ||
    seen.selected !== said.selected
  ) {
    if (seen.view !== said.view && vw.active) polite = i18n.t('sr.view', { name: vw.active.name })
    else if (seen.selected !== said.selected && said.selected > 0)
      polite = i18n.t('selection.selected', { count: said.selected })
    else if (seen.filters !== said.filters) polite = filterNews(JSON.parse(seen.filters) as FilterCondition[]) ?? polite
    else if (seen.total !== said.total && countedNow)
      polite = i18n.t('sr.total', { count: fmt.int(countedNow.total), entity })
    else if (seen.sort !== said.sort && first)
      polite = i18n.t('sr.sorted', { column: headerOf(first.column), dir: i18n.t(`sr.${first.dir}`) })
    else if (seen.loaded !== said.loaded && !load.pending) polite = i18n.t('sr.loaded', { count: rows.length })
    setSeen({ ...said, text: polite })
  }

  /** Eklenen ya da değişen filtre özetiyle, kaldırılan adıyla okunur (08 §5). */
  function filterNews(before: FilterCondition[]): string | undefined {
    const prev = new Map(before.map((f) => [f.column, JSON.stringify(f)]))
    const changed = q.filters.find((f) => defs.has(f.column) && prev.get(f.column) !== JSON.stringify(f))
    if (changed)
      return i18n.t('sr.filterAdded', { summary: `${headerOf(changed.column)} ${summaryOf(changed).text}`.trim() })
    const gone = before.find((f) => !q.filters.some((n) => n.column === f.column))
    return gone && i18n.t('sr.filterRemoved', { column: headerOf(gone.column) })
  }

  // Daralma eşikleri kartın kendi genişliğinden (05 §3): ≥1024 etiketli, 640–1023 ikon, <640 telefon (Faz 7).
  const root = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(1440)
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const measure = () => setWidth(el.clientWidth || 1440)
    measure()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])
  const size: ToolbarSize = width >= 1024 ? 'full' : width >= 640 ? 'narrow' : 'phone'
  const phone = size === 'phone'
  // `layout` her çizimde yeni nesne; setter kararlı.
  const { setPhone } = table.layout
  useLayoutEffect(() => setPhone(phone), [setPhone, phone])
  /** Picker / header hunisi / F: telefonda Filters sayfası o sütunun editörüyle açılır. */
  const pick = (column: string) => (phone ? openSheet(column) : chips.pick(column))

  // Kısayollar (08 §3): kapsam sayfa. Alt←/→ sayfa (her zaman), R yenile (odak metin alanında değilken).
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented) return
    const target = e.target instanceof Element ? e.target : null
    // Seçim checkbox'ları Tab durağı (D40): odakları kısayolları ve Esc'i kapatmaz.
    const typing =
      !!target && isTextInput(target) && !(target instanceof HTMLInputElement && target.type === 'checkbox')
    // Esc sırayla: açık popover / menü / dialog (odak içindedir) → seçim (05 §6); metin alanında aramanın Esc'i.
    if (e.key === 'Escape') {
      const inLayer = !!target?.closest(
        '[role="menu"], [role="dialog"], [role="alertdialog"], [role="listbox"], .dt-pop',
      )
      if (!inLayer && selectedRows.length && !typing) table.clearSelection()
      return
    }
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      if (busy) return
      const left = e.key === 'ArrowLeft'
      if (left ? page.number > 1 : hasMore) {
        e.preventDefault()
        table.setPage(page.number + (left ? -1 : 1))
      }
      return
    }
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
      if (!shortcuts || !vw.edited || !vw.canSave || viewDialog) return
      e.preventDefault()
      if (vw.writable(vw.active)) void vw.saveChanges()
      else openSaveAs()
      return
    }
    if (!shortcuts || e.ctrlKey || e.metaKey || e.altKey || typing) return
    if (e.key === '/' && hasSearch) {
      e.preventDefault()
      toolbarRef.current?.focusSearch()
    } else if ((e.key === 'f' || e.key === 'F') && hasFilter) {
      e.preventDefault()
      if (phone) openSheet()
      else setPickerOpen(true)
    } else if ((e.key === 'r' || e.key === 'R') && refetch) {
      e.preventDefault()
      refetch()
    } else if ((e.key === 'v' || e.key === 'V') && hasViews) {
      e.preventDefault()
      setViewMenuOpen(true)
    }
  })
  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Filter düğmesinin adı görünen parçalarından ("Filter 2"): Combobox tetikleyicisi (role=combobox) adını içerikten
  // almaz, sabit aria-label de sayacı dışarıda bırakıp görünen metinle uyuşmaz (WCAG 2.5.3). İkon kipinde etiket gizli.
  const filterId = useId()
  const filterLabelledBy = q.filters.length ? `${filterId}-l ${filterId}-n` : `${filterId}-l`
  const filterText = (labelShown: boolean) => (
    <>
      <span id={`${filterId}-l`} className={labelShown ? undefined : 'dt-sr-only'}>
        {i18n.t('toolbar.filter')}
      </span>
      {q.filters.length > 0 && (
        <>
          {' '}
          <span id={`${filterId}-n`} className="dt-counter">
            {q.filters.length}
          </span>
        </>
      )}
    </>
  )
  const unpaged = { search: q.search, filters: q.filters, sort: q.sort, fields: q.fields }
  const visibleColumns = table.layout.columns.map((c) => c.id)
  const print = onPrint && (() => onPrint({ query: unpaged, visibleColumns }))
  // Export (D46): ekranda görünen sütunlar ve satırlar; seçim varsa seçili satırlar, yoksa sayfadaki satırlar.
  const exportRows = selectedRows.length ? selectedRows : rows
  // Aksiyonsuz çubuk yalnızca sayaç ve × olurdu: seçim Export'ta, header checkbox'ında ve Esc'te kalır (React sapması).
  const bulkBar = selectedRows.length > 0 && (!!bulkActions?.length || !!selectionActions)
  const exportHint = exportable
    ? selectedRows.length
      ? i18n.t('toolbar.exportSelected', { count: selectedRows.length })
      : i18n.t('toolbar.export', { count: rows.length })
    : undefined
  const runExport = (format: 'csv' | 'xlsx') => {
    if (onExport) return onExport({ format, query: unpaged, selection: selectedRows, rows: exportRows, visibleColumns })
    void exportFile({
      format,
      columns: table.layout.columns.map((c) => c.def),
      rows: exportRows,
      read: (row, def) => (def.accessor ? def.accessor(row) : readPath(row, def.id as string)),
      env: { fmt, i18n, today: new Date(), labels },
      name: entity.other,
    })
  }
  const moreMenu = toolbar === 'auto' && !!(refetch || print || exportHint)
  const prefs = table.prefs

  const state =
    bodyState === 'error' ? (
      <StateMessage
        kind="error"
        title={i18n.t('state.errorTitle', { entity })}
        lines={[err.message, i18n.t('state.errorKept')].filter((l): l is string => !!l)}
        actions={
          refetch && (
            <button type="button" className="dt-btn" disabled={load.pending} onClick={() => refetch()}>
              {i18n.t('state.tryAgain')}
            </button>
          )
        }
        after={
          err.id && (
            <div className="dt-state-id">
              <button
                type="button"
                className="dt-btn dt-btn-ghost dt-btn-xs"
                onClick={() => void navigator.clipboard?.writeText(err.id!)}
              >
                {i18n.t('state.copyErrorId')}
              </button>
              <code className="dt-state-code">{err.id}</code>
            </div>
          )
        }
      />
    ) : bodyState === 'noResults' ? (
      <StateMessage
        kind={q.search ? 'noResultsSearch' : 'noResults'}
        title={i18n.t(
          q.search && q.filters.length ? 'state.noResultsBoth' : q.search ? 'state.noResultsSearch' : 'state.noResults',
          { entity, q: q.search, count: q.filters.length },
        )}
        actions={
          <>
            {q.filters.length === 1 ? (
              <button type="button" className="dt-btn" onClick={() => chips.remove(q.filters[0]!.column)}>
                {i18n.t('state.removeFilter', { column: headerOf(q.filters[0]!.column) })}
              </button>
            ) : (
              q.filters.length > 1 && (
                <button type="button" className="dt-btn" onClick={chips.clear}>
                  {i18n.t('state.clearAllFilters')}
                </button>
              )
            )}
            {q.search && (
              <button type="button" className="dt-btn" onClick={() => table.setSearch('')}>
                {i18n.t('state.clearSearch')}
              </button>
            )}
          </>
        }
      />
    ) : bodyState === 'noRowsOnPage' ? (
      <StateMessage
        kind="noRowsOnPage"
        title={i18n.t('page.noneOnPage')}
        actions={
          <button type="button" className="dt-btn" onClick={() => table.setPage(q.page.number - 1)}>
            {i18n.t('page.previousPage')}
          </button>
        }
      />
    ) : bodyState === 'empty' ? (
      (empty ?? <StateMessage kind="empty" title={i18n.t('state.emptyTitle', { entity })} />)
    ) : null

  return (
    // Kökün yazı boyutu (--dt-fs) kökteki yoğunluktan çözülür; yalnızca ızgarada olsaydı hep standard kalırdı.
    <div ref={root} className={phone ? 'dt dt-list is-phone' : 'dt dt-list'} data-density={table.density}>
      {selectionBar === 'toolbar' && bulkBar && toolbar !== false ? (
        <BulkBar variant="toolbar" rows={selectedRows} actions={bulkActions ?? []} onClear={table.clearSelection}>
          {selectionActions?.({ rows: selectedRows, clear: table.clearSelection })}
        </BulkBar>
      ) : (
        toolbar !== false && (
          <Toolbar
            ref={toolbarRef}
            size={size}
            view={
              hasViews && (
                <ViewMenu
                  sections={vw.sections}
                  active={vw.active}
                  edited={vw.edited}
                  hasDraft={vw.hasDraft}
                  defaultId={prefs.prefs.defaultViewId}
                  canSave={vw.canSave}
                  canWrite={vw.writable(vw.active)}
                  open={viewMenuOpen}
                  onOpenChange={setViewMenuOpen}
                  onSelect={selectView}
                  onSaveChanges={() => void vw.saveChanges()}
                  onSaveAs={() => openSaveAs()}
                  onDiscard={() => {
                    chips.setEditing(null)
                    vw.discard()
                  }}
                  onRename={(view) =>
                    setViewDialog({
                      key: (viewDialog?.key ?? 0) + 1,
                      mode: 'rename',
                      name: view.name,
                      state: current(),
                      summary: null,
                      view,
                      fromCurrent: false,
                    })
                  }
                  onDuplicate={openSaveAs}
                  onSetDefault={(id) => prefs.set({ defaultViewId: id })}
                  onDelete={setConfirmDelete}
                  sheet={phone}
                />
              )
            }
            search={hasSearch ? q.search : null}
            searchPlaceholder={searchPlaceholder ?? i18n.t('toolbar.search', { entity })}
            onSearch={table.setSearch}
            filter={
              hasFilter &&
              (phone ? (
                <button
                  type="button"
                  className={
                    q.filters.length
                      ? 'dt-btn dt-btn-icon dt-filter-trigger is-active'
                      : 'dt-btn dt-btn-icon dt-filter-trigger'
                  }
                  aria-labelledby={filterLabelledBy}
                  onClick={() => openSheet()}
                >
                  <FunnelIcon size={20} aria-hidden="true" />
                  {filterText(false)}
                </button>
              ) : (
                <ColumnPicker
                  columns={filterable}
                  chips={chips.chips}
                  open={pickerOpen}
                  onOpenChange={setPickerOpen}
                  onPick={chips.pick}
                  trigger={
                    <button
                      type="button"
                      // Dar kartta da etiketli (Vue: ikon yalnızca telefonda).
                      className={
                        q.filters.length
                          ? 'dt-btn has-icon dt-filter-trigger is-active'
                          : 'dt-btn has-icon dt-filter-trigger'
                      }
                      aria-labelledby={filterLabelledBy}
                    >
                      <FunnelIcon size={16} aria-hidden="true" />
                      {filterText(true)}
                    </button>
                  }
                />
              ))
            }
            display={
              toolbar === 'auto' &&
              !phone && (
                <DisplayPopover
                  density={table.density}
                  onDensity={table.densityFixed ? undefined : (density) => prefs.set({ density })}
                  verticalLines={prefs.prefs.verticalLines}
                  onVerticalLines={(verticalLines) => prefs.set({ verticalLines })}
                  counts={table.layout.counts}
                  onColumns={openColumns}
                  persistent={prefs.persistent}
                  onReset={table.resetDisplay}
                  iconOnly={size !== 'full'}
                />
              )
            }
            more={
              phone
                ? toolbar === 'auto' && (
                    <PhoneMoreSheet
                      density={table.density}
                      onDensity={table.densityFixed ? undefined : (density) => prefs.set({ density })}
                      columns={table.layout.panel}
                      counts={table.layout.counts}
                      onColumnsSave={table.layout.arrange}
                      sort={q.sort}
                      onSort={(sort) => table.setQuery({ sort })}
                      persistent={prefs.persistent}
                      onReset={table.resetDisplay}
                      exportHint={exportHint}
                      onExport={runExport}
                      onRefresh={refetch && (() => refetch())}
                      onPrint={print}
                      autoRefresh={!!autoRefresh && !!refetch}
                      autoRefreshOn={live}
                      onAutoRefresh={setLive}
                    />
                  )
                : moreMenu && (
                    <MoreMenu
                      exportHint={exportHint}
                      onExport={runExport}
                      onRefresh={refetch && (() => refetch())}
                      onPrint={print}
                      autoRefresh={!!autoRefresh && !!refetch}
                      autoRefreshOn={live}
                      onAutoRefresh={setLive}
                    />
                  )
            }
            end={toolbarEnd}
          />
        )
      )}
      {notice && <div className="dt-list-notice">{notice}</div>}
      {load.errorKind === 'stale' && load.updatedAt && (
        <div className="dt-strip" role="status">
          <WarningIcon size={16} aria-hidden="true" />
          <span>{i18n.t('state.stale', { time: clock(load.updatedAt) })}</span>
          {refetch && (
            <button type="button" className="dt-strip-action" disabled={load.pending} onClick={() => refetch()}>
              {i18n.t('common.retry')}
            </button>
          )}
        </div>
      )}
      {chips.chips.length > 0 && (
        <FilterBar
          chips={chips.chips}
          defOf={(column) => defs.get(column)!}
          editing={chips.editing}
          rows={sourceRows}
          labels={labels}
          summaryOf={summaryOf}
          currenciesOf={currenciesOf}
          onChange={chips.update}
          onRemove={chips.remove}
          onEditing={chips.setEditing}
          onClearAll={chips.clear}
          onOpen={phone ? openSheet : undefined}
          add={
            <ColumnPicker
              columns={filterable}
              chips={chips.chips}
              onPick={chips.pick}
              trigger={
                <button
                  type="button"
                  className="dt-btn dt-btn-ghost dt-btn-sm has-icon dt-filter-add dt-filter-trigger"
                  aria-label={i18n.t('filter.addFilter')}
                >
                  <PlusIcon size={14} aria-hidden="true" />
                  {i18n.t('filter.addFilter')}
                </button>
              }
            />
          }
        />
      )}
      <Grid
        layout={table.layout}
        rows={rows}
        rowId={table.rowId}
        label={label ?? entity.other}
        density={table.density}
        skeleton={load.skeleton}
        dim={load.dim}
        refreshing={load.bar}
        verticalLines={table.prefs.prefs.verticalLines}
        rowCount={total === undefined ? -1 : total + 1}
        rowIndexOffset={(page.number - 1) * page.size}
        scrollKey={JSON.stringify([q.page.number, q.search, q.filters])}
        sort={sort}
        canSort={(id) => sortable.has(id)}
        onSort={table.toggleSort}
        onSortSet={table.setSort}
        filtered={new Set(q.filters.map((f) => f.column))}
        canFilter={(id) => filterIds.has(id)}
        onFilter={pick}
        onColumns={toolbar === 'auto' && !phone ? openColumns : undefined}
        notice={
          load.stillLoading && (
            <>
              <CircleNotchIcon size={14} className="dt-spin" aria-hidden="true" />
              {i18n.t('state.stillLoading')}
            </>
          )
        }
        state={state}
        onRowClick={handleRowClick}
        selection={selectable ? table.selection : undefined}
        onSelectRows={selectable ? selectRows : undefined}
        expanded={expanded}
        canExpand={canExpand}
        onToggleExpand={toggleExpand}
        renderExpanded={renderExpanded && ((row, close) => renderExpanded({ row, close }))}
        resetKey={expandKey}
        rowMenu={rowMenu}
        rowActions={rowActions}
        primaryHref={primaryHref}
        primaryLabel={primaryLabel}
        onRowOpen={(row, event) => onRowOpen?.({ row, href: primaryHref(row) ?? '', event })}
        rowError={rowError}
      />
      {selectionBar === 'floating' && bulkBar && (
        <BulkBar
          variant="floating"
          phone={phone}
          rows={selectedRows}
          actions={bulkActions ?? []}
          onClear={table.clearSelection}
        >
          {selectionActions?.({ rows: selectedRows, clear: table.clearSelection })}
        </BulkBar>
      )}
      <Footer
        rowCount={rows.length}
        page={page}
        hasMore={hasMore}
        total={total}
        countable={server && !!table.count}
        counting={counting === countKey}
        countedAt={countedNow?.at ?? null}
        busy={busy}
        firstLoad={load.skeleton && !hasRows}
        empty={bodyState === 'empty'}
        pageSizes={table.pageSizes}
        updatedAt={load.updatedAt}
        freshness={freshness}
        onRefresh={refetch && (() => refetch())}
        onCount={count}
        onPage={table.setPage}
        onPageSize={table.setPageSize}
        phone={phone}
      />
      {sheet && phone && hasFilter && (
        <Suspense fallback={null}>
          <FiltersSheet
            key={sheet.key}
            open={sheet.open}
            onOpenChange={(o) => setSheet({ ...sheet, open: o })}
            column={sheet.column}
            columns={table.columns as ColumnDef[]}
            chips={chips.chips}
            sort={q.sort}
            rows={sourceRows}
            labels={labels}
            summaryOf={summaryOf}
            currenciesOf={currenciesOf}
            onApply={(next, sort) => {
              chips.setEditing(null)
              table.setQuery({ filters: next.map(toCondition), sort })
            }}
          />
        </Suspense>
      )}
      <span className="dt-sr-only" aria-live="polite">
        {polite}
      </span>
      <span className="dt-sr-only" aria-live="assertive">
        {load.errorKind === 'error' ? `${i18n.t('state.errorTitle', { entity })} ${i18n.t('state.tryAgain')}` : ''}
      </span>
      <DelegatedTooltip root={root} />
      {viewDialog && (
        <ViewDialog
          key={viewDialog.key}
          open
          onOpenChange={(o) => !o && setViewDialog(null)}
          mode={viewDialog.mode}
          name={viewDialog.name}
          summary={viewDialog.summary}
          validate={(name) =>
            nameError(name, vw.all, locale, viewDialog.mode === 'rename' ? viewDialog.view?.id : undefined)
          }
          onSave={({ name, makeDefault }) => {
            if (viewDialog.mode === 'rename' && viewDialog.view) void vw.rename(viewDialog.view.id, name)
            else {
              chips.setEditing(null)
              void vw.create({ name, state: viewDialog.state, makeDefault, fromCurrent: viewDialog.fromCurrent })
            }
          }}
        />
      )}
      {columnsUsed && (
        <Suspense fallback={null}>
          <ColumnsDialog
            open={columnsOpen}
            onOpenChange={setColumnsOpen}
            columns={table.layout.panel}
            onSave={table.layout.arrange}
            finalFocus={columnsFrom}
          />
        </Suspense>
      )}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={i18n.t('views.delete.title', { name: confirmDelete?.name ?? '' })}
        body={i18n.t('views.delete.body')}
        confirmLabel={i18n.t('views.delete')}
        danger
        onConfirm={() => confirmDelete && void vw.remove(confirmDelete.id)}
      />
    </div>
  )
}
