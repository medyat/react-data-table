// Liste bileşeni (05): ızgara, footer, durum ekranları, yükleme geçişleri (R4). Paket veri çekmez (D18): sunucu modunda
// `useQuery` sonucunu `result` olarak alır; istemci modunda satırlar `useDataTable({ rows })`'dan gelir.
// Görünümler 3b'de.
import { CircleNotchIcon, FunnelIcon, PlusIcon, WarningIcon } from '@phosphor-icons/react'
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { optionLabel } from '../core/cells/format'
import { RemoteLabels } from '../core/cells/remote-labels'
import { ColumnPicker } from '../core/filters/column-picker'
import { FilterBar } from '../core/filters/filter-bar'
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
import { Toolbar, type ToolbarHandle, type ToolbarSize } from '../core/toolbar/toolbar'
import type { ColumnDef } from '../types/columns'
import type { DataTableResult } from '../types/list'
import type { FilterCondition, QueryWithoutPage } from '../types/query'
import { Footer, type Freshness } from './footer'
import { useChips } from './use-chips'
import { isFilterable, isSearchable, isSortable } from './use-list-table'
import type { DataTableInstance } from './use-data-table'
import { useLoadState } from './use-load-state'

/** `error` yapısal okunur: TanStack Query'nin `Error`'u, uygulamanın `{ message, id }`'si ya da düz metin. */
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
  searchPlaceholder,
  autoRefresh,
  onPrint,
  shortcuts = true,
  onRowClick,
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
  /** Verilmezse "Search {entity}…". */
  searchPlaceholder?: string
  /** Saniye. Verilirse ⋯ menüsünde Auto-refresh; açıkken footer "Live". */
  autoRefresh?: number
  /** Verilirse ⋯ › Print. Sorgu sayfasızdır. */
  onPrint?: (payload: { query: QueryWithoutPage; visibleColumns: string[] }) => void
  /** Tek harfli kısayollar (/ arama, F filtre, R yenile). Alt←/→ her zaman çalışır. */
  shortcuts?: boolean
  /** Satır gövdesine düz tık; hücredeki düğme, link ve metin seçimi tetiklemez (05 §7). */
  onRowClick?: (row: Row, event: MouseEvent) => void
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
    filters: JSON.stringify(q.filters),
    sort: JSON.stringify(q.sort),
    loaded: `${load.updatedAt?.getTime() ?? 0}|${rows.length}`,
    total: countedNow ? countedNow.at.getTime() : 0,
  }
  const [seen, setSeen] = useState({ ...said, text: '' })
  let polite = seen.text
  if (
    seen.filters !== said.filters ||
    seen.sort !== said.sort ||
    seen.loaded !== said.loaded ||
    seen.total !== said.total
  ) {
    if (seen.filters !== said.filters) polite = filterNews(JSON.parse(seen.filters) as FilterCondition[]) ?? polite
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

  // Kısayollar (08 §3): kapsam sayfa. Alt←/→ sayfa (her zaman), R yenile (odak metin alanında değilken).
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented) return
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      if (busy) return
      const left = e.key === 'ArrowLeft'
      if (left ? page.number > 1 : hasMore) {
        e.preventDefault()
        table.setPage(page.number + (left ? -1 : 1))
      }
      return
    }
    const target = e.target instanceof Element ? e.target : null
    if (!shortcuts || e.ctrlKey || e.metaKey || e.altKey || (target && isTextInput(target))) return
    if (e.key === '/' && hasSearch) {
      e.preventDefault()
      toolbarRef.current?.focusSearch()
    } else if ((e.key === 'f' || e.key === 'F') && hasFilter) {
      e.preventDefault()
      setPickerOpen(true)
    } else if ((e.key === 'r' || e.key === 'R') && refetch) {
      e.preventDefault()
      refetch()
    }
  })
  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
  const print =
    onPrint &&
    (() =>
      onPrint({
        query: { search: q.search, filters: q.filters, sort: q.sort, fields: q.fields },
        visibleColumns: table.layout.columns.map((c) => c.id),
      }))
  const moreMenu = toolbar === 'auto' && !!(refetch || print)
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
    <div ref={root} className="dt dt-list" data-density={table.density}>
      {toolbar !== false && (
        <Toolbar
          ref={toolbarRef}
          size={size}
          search={hasSearch ? q.search : null}
          searchPlaceholder={searchPlaceholder ?? i18n.t('toolbar.search', { entity })}
          onSearch={table.setSearch}
          filter={
            hasFilter && (
              <ColumnPicker
                columns={filterable}
                chips={chips.chips}
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                onPick={chips.pick}
                trigger={
                  <button
                    type="button"
                    className={[
                      'dt-btn has-icon dt-filter-trigger',
                      q.filters.length > 0 && 'is-active',
                      size !== 'full' && !q.filters.length && 'dt-btn-icon',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    aria-label={size !== 'full' ? i18n.t('toolbar.filter') : undefined}
                  >
                    <FunnelIcon size={16} aria-hidden="true" />
                    {size === 'full' && <span>{i18n.t('toolbar.filter')}</span>}
                    {q.filters.length > 0 && <span className="dt-counter">{q.filters.length}</span>}
                  </button>
                }
              />
            )
          }
          display={
            toolbar === 'auto' && (
              <DisplayPopover
                density={table.density}
                onDensity={(density) => prefs.set({ density })}
                verticalLines={prefs.prefs.verticalLines}
                onVerticalLines={(verticalLines) => prefs.set({ verticalLines })}
                columns={table.layout.panel}
                counts={table.layout.counts}
                onColumnsSave={table.layout.arrange}
                persistent={prefs.persistent}
                onReset={() => {
                  // Tercihler ve sütun düzeni; sıralama korunur.
                  prefs.reset()
                  table.layout.reset()
                }}
                iconOnly={size !== 'full'}
              />
            )
          }
          more={
            moreMenu && (
              <MoreMenu
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
      )}
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
          add={
            <ColumnPicker
              columns={filterable}
              chips={chips.chips}
              onPick={chips.pick}
              trigger={
                <button
                  type="button"
                  className="dt-btn dt-btn-ghost dt-btn-sm has-icon dt-filter-add dt-filter-trigger"
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
        onFilter={chips.pick}
        notice={
          load.stillLoading && (
            <>
              <CircleNotchIcon size={14} className="dt-spin" aria-hidden="true" />
              {i18n.t('state.stillLoading')}
            </>
          )
        }
        state={state}
        onRowClick={onRowClick}
      />
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
      />
      <span className="dt-sr-only" aria-live="polite">
        {polite}
      </span>
      <span className="dt-sr-only" aria-live="assertive">
        {load.errorKind === 'error' ? `${i18n.t('state.errorTitle', { entity })} ${i18n.t('state.tryAgain')}` : ''}
      </span>
      <DelegatedTooltip root={root} />
    </div>
  )
}
