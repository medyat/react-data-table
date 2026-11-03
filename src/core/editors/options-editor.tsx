// Seçenek editörü (04 §3, T2-02/03): select · multiselect · color · ajax · user. Her işaretleme anında uygulanır;
// hover'da "Only"; `user`'da Me ve Unassigned en üstte; uzak kaynaklar yazdıkça arar ve 20'şer yükler (03).
import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import type { ColumnDef, OptionDef, RemoteOptions, UserOption } from '../../types/columns'
import type { FilterOp } from '../../types/query'
import { ME } from '../../types/query'
import { Avatar, Badge } from '../cells/render-cell'
import type { RemoteLabels } from '../cells/remote-labels'
import { readPath } from '../columns/read-path'
import { useDelay } from '../interaction/use-delay'
import { useDataTableContext } from '../provider'

type Value = string | number

function staticOptions(def: ColumnDef, rows: object[]): OptionDef[] {
  if (def.type === 'select' || def.type === 'multiselect') return def.options
  if (def.type === 'user' && def.options) return [...def.options].sort((a, b) => a.label.localeCompare(b.label))
  if (def.type === 'color' && def.palette) return def.palette.map((value) => ({ value, label: value }))
  if (def.type !== 'color') return []
  // Paletsiz renk: yüklü satırlardaki değerler (uzaktan öneri yok, D3).
  const seen = new Set<Value>()
  for (const row of rows) {
    const raw = def.accessor ? def.accessor(row) : readPath(row, def.id as string)
    for (const v of Array.isArray(raw) ? raw : [raw])
      if (v !== null && v !== undefined && v !== '') seen.add(v as Value)
  }
  return [...seen].sort((a, b) => String(a).localeCompare(String(b))).map((value) => ({ value, label: String(value) }))
}

export function OptionsEditor({
  column,
  op,
  value,
  rows,
  labels,
  onChange,
  onUnassigned,
}: {
  column: ColumnDef
  op: FilterOp
  value: Value[]
  rows: object[]
  labels: RemoteLabels
  onChange: (values: Value[]) => void
  onUnassigned: () => void
}) {
  const { i18n } = useDataTableContext()
  const def = column
  const remote: RemoteOptions | undefined =
    def.type === 'ajax' || def.type === 'user' ? (def as { remote?: RemoteOptions }).remote : undefined
  const isUser = def.type === 'user'
  const [q, setQ] = useState('')
  const all = staticOptions(def, rows)

  // Uzak kaynak: 250 ms sonra arar; sayfa sayfa ekler. Hata ya da iptalde liste olduğu gibi kalır (D18).
  const [found, setFound] = useState<{ items: OptionDef[]; hasMore: boolean; page: number }>({
    items: [],
    hasMore: false,
    page: 1,
  })
  const [loading, setLoading] = useState(!!remote)
  const ctl = useRef<AbortController | null>(null)
  /** `loading` çağıran tarafta açılır: ilk yükleme başlangıç durumunda zaten açık. */
  const load = (query: string, page: number) => {
    if (!remote) return
    ctl.current?.abort()
    const c = new AbortController()
    ctl.current = c
    remote
      .search(query, page, { signal: c.signal })
      .then((res) => {
        if (c.signal.aborted) return
        setFound((f) => ({ items: page > 1 ? [...f.items, ...res.items] : res.items, hasMore: res.hasMore, page }))
        labels.seed(def.id as string, res.items)
      })
      .catch(() => {})
      .finally(() => !c.signal.aborted && setLoading(false))
  }
  const delay = useDelay(250)
  useEffect(() => {
    load('', 1)
    return () => ctl.current?.abort()
    // Açılışta bir kez; sonraki aramalar yazdıkça.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const needle = q.trim().toLocaleLowerCase()
  const options = remote ? found.items : needle ? all.filter((o) => o.label.toLocaleLowerCase().includes(needle)) : all
  const showSearch = !!remote || all.length > 7
  const placeholder = def.filterNoun ? i18n.t('option.searchNoun', { noun: def.filterNoun }) : i18n.t('option.search')

  const selected = new Set(value.map(String))
  const isOn = (v: Value) => selected.has(String(v))
  const toggle = (v: Value) => onChange(isOn(v) ? value.filter((x) => String(x) !== String(v)) : [...value, v])
  const unassigned = op === 'is_empty'
  const body = (o: OptionDef) =>
    def.type === 'user' ? (
      <>
        <Avatar user={o as UserOption} /> {o.label}
      </>
    ) : def.type === 'select' || def.type === 'multiselect' ? (
      <Badge tone={o.tone ?? 'gray'} label={o.label} />
    ) : def.type === 'color' ? (
      <>
        <span className="dt-swatch" style={{ background: String(o.value) }} aria-hidden="true" />
        <span className="dt-mono">{o.label}</span>
      </>
    ) : (
      o.label
    )

  return (
    <div className="dt-options">
      {showSearch && (
        <label className="dt-input has-icon dt-options-search">
          <span className="dt-input-icon">
            <MagnifyingGlassIcon size={14} aria-hidden="true" />
          </span>
          <input
            type="search"
            value={q}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(e) => {
              const text = e.target.value
              setQ(text)
              if (!remote) return
              setLoading(true)
              delay.run(() => load(text, 1))
            }}
          />
        </label>
      )}
      <div className="dt-options-list" role="group">
        {isUser && !q && (
          <>
            <label className={isOn(ME) ? 'dt-option is-on' : 'dt-option'}>
              <input type="checkbox" className="dt-checkbox" checked={isOn(ME)} onChange={() => toggle(ME)} />
              <span className="dt-option-body">
                <span className="dt-avatar dt-tone-blue" aria-hidden="true">
                  {i18n.t('common.me').slice(0, 2)}
                </span>
                {i18n.t('common.me')}
              </span>
            </label>
            <label className={unassigned ? 'dt-option is-unassigned is-on' : 'dt-option is-unassigned'}>
              <input type="checkbox" className="dt-checkbox" checked={unassigned} onChange={onUnassigned} />
              <span className="dt-option-body">
                <span className="dt-avatar is-empty" aria-hidden="true" />
                {i18n.t('common.unassigned')}
              </span>
            </label>
            <div className="dt-pop-sep" />
          </>
        )}
        {options.map((o) => (
          <label key={String(o.value)} className={isOn(o.value) ? 'dt-option is-on' : 'dt-option'}>
            <input type="checkbox" className="dt-checkbox" checked={isOn(o.value)} onChange={() => toggle(o.value)} />
            <span className="dt-option-body">{body(o)}</span>
            <button
              type="button"
              className="dt-btn dt-btn-xs dt-option-only"
              tabIndex={-1}
              onClick={(e) => {
                // Label içindeki düğme: tık checkbox'ı da değiştirmesin.
                e.preventDefault()
                onChange([o.value])
              }}
            >
              {i18n.t('option.only')}
            </button>
          </label>
        ))}
        {options.length === 0 && !loading && (
          <div className="dt-options-empty">{i18n.t(remote ? 'remote.noResults' : 'picker.noMatch')}</div>
        )}
        {loading && <div className="dt-options-empty">{i18n.t('common.loading')}</div>}
        {remote && found.hasMore && !loading && (
          <button
            type="button"
            className="dt-btn dt-btn-ghost dt-btn-sm dt-options-more"
            onClick={() => {
              setLoading(true)
              load(q, found.page + 1)
            }}
          >
            {i18n.t('remote.loadMore')}
          </button>
        )}
      </div>
    </div>
  )
}
