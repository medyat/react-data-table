// Liste bileşeni (05): ızgara, footer, durum ekranları, yükleme geçişleri (R4). Paket veri çekmez (D18): sunucu modunda
// `useQuery` sonucunu `result` olarak alır; istemci modunda satırlar `useDataTable({ rows })`'dan gelir.
// Filtre ve arama Faz 3a, görünümler 3b.
import { CircleNotchIcon, WarningIcon } from '@phosphor-icons/react'
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { getFormat } from '../core/format'
import type { HeaderSort } from '../core/grid/header-cell'
import { Grid } from '../core/grid/grid'
import { DelegatedTooltip } from '../core/grid/tooltip'
import { isTextInput } from '../core/interaction/is-interactive'
import { useDataTableContext } from '../core/provider'
import { StateMessage } from '../core/states/state-message'
import { DisplayPopover } from '../core/toolbar/display-popover'
import { MoreMenu } from '../core/toolbar/more-menu'
import { Toolbar, type ToolbarSize } from '../core/toolbar/toolbar'
import type { DataTableResult } from '../types/list'
import type { QueryWithoutPage } from '../types/query'
import { Footer, type Freshness } from './footer'
import { isSortable } from './use-list-table'
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
  /** Saniye. Verilirse ⋯ menüsünde Auto-refresh; açıkken footer "Live". */
  autoRefresh?: number
  /** Verilirse ⋯ › Print. Sorgu sayfasızdır. */
  onPrint?: (payload: { query: QueryWithoutPage; visibleColumns: string[] }) => void
  /** Tek harfli kısayollar (R). Alt←/→ her zaman çalışır. */
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

  const bodyState: 'error' | 'noRowsOnPage' | 'empty' | null =
    load.skeleton || hasRows || load.pending
      ? null
      : load.errorKind === 'error'
        ? 'error'
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
    sort: JSON.stringify(q.sort),
    loaded: `${load.updatedAt?.getTime() ?? 0}|${rows.length}`,
    total: countedNow ? countedNow.at.getTime() : 0,
  }
  const [seen, setSeen] = useState({ ...said, text: '' })
  let polite = seen.text
  if (seen.sort !== said.sort || seen.loaded !== said.loaded || seen.total !== said.total) {
    if (seen.total !== said.total && countedNow)
      polite = i18n.t('sr.total', { count: fmt.int(countedNow.total), entity })
    else if (seen.sort !== said.sort && first)
      polite = i18n.t('sr.sorted', { column: headerOf(first.column), dir: i18n.t(`sr.${first.dir}`) })
    else if (seen.loaded !== said.loaded && !load.pending) polite = i18n.t('sr.loaded', { count: rows.length })
    setSeen({ ...said, text: polite })
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
    if ((e.key === 'r' || e.key === 'R') && refetch) {
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
          size={size}
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
        scrollKey={q.page.number}
        sort={sort}
        canSort={(id) => sortable.has(id)}
        onSort={table.toggleSort}
        onSortSet={table.setSort}
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
