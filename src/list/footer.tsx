// Footer (05 §8, brief §6.13, T9-12): ekrandaki verinin sayfasından okur; simple sayfalama (D7); tazelik bilgisi burada.
import {
  ArrowClockwiseIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CircleNotchIcon,
} from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { getFormat } from '../core/format'
import { useDataTableContext } from '../core/provider'

export type Freshness = 'normal' | 'refreshing' | 'stale' | 'live'

export interface FooterProps {
  /** Ekrandaki satır sayısı ve sayfası (1 tabanlı). */
  rowCount: number
  page: { number: number; size: number }
  hasMore: boolean
  /** Biliniyorsa toplam (istemci modunda hep; sunucuda yanıtla ya da Count total ile). */
  total?: number
  /** Count total düğmesi; sonuç "counted 09:42" eki alır. */
  countable: boolean
  counting: boolean
  countedAt: Date | null
  /** Kimlik değiştiren istek sürüyor: sayfalama kilitli. */
  busy: boolean
  firstLoad: boolean
  /** Gövde Empty mi (filtre/arama yok): "No rows" / "0 rows". */
  empty: boolean
  pageSizes: number[]
  updatedAt: Date | null
  freshness: Freshness
  onRefresh?: () => void
  onCount: () => void
  onPage: (page: number) => void
  onPageSize: (size: number) => void
  /** Telefon (handoff 04 §5): tazelik ve Rows per page yok; Önceki / Sonraki 44 px ikon. */
  phone?: boolean
}

/** "Updated 3 min ago" kendiliğinden eskisin: metin render'da değil, bu saatle hesaplanır. */
function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

export function Footer(p: FooterProps) {
  const now = useNow(30_000)
  const { i18n, locale } = useDataTableContext()
  const fmt = getFormat(locale)
  const from = (p.page.number - 1) * p.page.size + 1
  const to = from + p.rowCount - 1
  const lastPage = !p.hasMore
  const single = p.page.number === 1 && lastPage
  const time = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const updatedText = !p.updatedAt
    ? ''
    : now - p.updatedAt.getTime() < 60_000
      ? i18n.t('toolbar.updatedJustNow')
      : i18n.t('toolbar.updatedAgo', { time: fmt.relative(p.updatedAt, new Date(now), 'short') })

  const count = () => {
    if (p.total !== undefined && !single)
      return (
        <>
          <span className="dt-footer-of">{i18n.t('page.of', { total: fmt.int(p.total) })}</span>
          {p.countedAt && (
            <span className="dt-footer-muted">· {i18n.t('page.counted', { time: time(p.countedAt) })}</span>
          )}
        </>
      )
    if (p.counting)
      return (
        <span className="dt-footer-muted">
          {i18n.t('page.of', { total: '' })}
          <CircleNotchIcon size={12} className="dt-spin" aria-hidden="true" />
          {i18n.t('page.counting')}
        </span>
      )
    if (lastPage && !single) return <span className="dt-footer-muted">· {i18n.t('page.end')}</span>
    if (p.countable && !single)
      return (
        <button type="button" className="dt-btn dt-btn-ghost dt-btn-xs dt-footer-count" onClick={p.onCount}>
          · {i18n.t('page.countTotal')}
        </button>
      )
    return null
  }

  return (
    <div className="dt-footer" role="navigation" aria-label={i18n.t('page.nav')}>
      <div className="dt-footer-left">
        {p.firstLoad ? (
          <span className="dt-footer-muted">{i18n.t('common.loading')}</span>
        ) : p.rowCount === 0 ? (
          <span className="dt-footer-rows">{i18n.t(p.empty ? 'page.none' : 'page.zero')}</span>
        ) : (
          <>
            <span className="dt-footer-rows">{i18n.t('page.rows', { from: fmt.int(from), to: fmt.int(to) })}</span>
            {count()}
          </>
        )}
        {!p.phone && (p.updatedAt || p.freshness !== 'normal') && (
          <>
            <span className="dt-footer-vsep" aria-hidden="true" />
            {p.freshness === 'live' ? (
              <span className="dt-footer-live">
                <span className="dt-live-dot" aria-hidden="true" />
                {i18n.t('toolbar.live')}
              </span>
            ) : p.freshness === 'refreshing' ? (
              <span className="dt-footer-muted" role="status">
                {i18n.t('state.updating')}
              </span>
            ) : (
              p.updatedAt && (
                <span className={p.freshness === 'stale' ? 'dt-footer-updated is-stale' : 'dt-footer-updated'}>
                  {updatedText}
                </span>
              )
            )}
            {p.onRefresh && (
              <button
                type="button"
                className="dt-icon-btn-sm"
                aria-label={i18n.t('toolbar.refresh')}
                data-dt-tip={`${i18n.t('toolbar.refresh')} · R`}
                onClick={p.onRefresh}
              >
                <ArrowClockwiseIcon
                  size={14}
                  className={p.freshness === 'refreshing' ? 'dt-spin' : undefined}
                  aria-hidden="true"
                />
              </button>
            )}
          </>
        )}
      </div>
      <div className="dt-footer-right">
        {!p.phone && (
          <label className="dt-footer-size">
            <span className="dt-footer-size-label">{i18n.t('page.perPage')}</span>
            <span className="dt-select">
              <select value={p.page.size} disabled={p.busy} onChange={(e) => p.onPageSize(Number(e.target.value))}>
                {p.pageSizes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <CaretDownIcon size={12} aria-hidden="true" />
            </span>
          </label>
        )}
        {!p.phone && <span className="dt-footer-vsep" aria-hidden="true" />}
        <button
          type="button"
          className="dt-btn dt-btn-sm has-icon dt-footer-prev"
          aria-label={p.phone ? i18n.t('page.previous') : undefined}
          disabled={p.page.number <= 1 || p.busy}
          onClick={() => p.onPage(p.page.number - 1)}
        >
          <CaretLeftIcon size={p.phone ? 18 : 14} aria-hidden="true" />
          <span>{i18n.t('page.previous')}</span>
        </button>
        <button
          type="button"
          className="dt-btn dt-btn-sm dt-footer-next"
          aria-label={p.phone ? i18n.t('page.next') : undefined}
          disabled={!p.hasMore || p.busy}
          onClick={() => p.onPage(p.page.number + 1)}
        >
          <span>{i18n.t('page.next')}</span>
          <CaretRightIcon size={p.phone ? 18 : 14} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
