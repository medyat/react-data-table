// Toolbar (05 §3, §11; T1, T13): yalnızca yapılandırılmış yuvalar; daralma kartın genişliğiyle (`size`, DataTable ölçer).
// Sıra (R25): görünüm · [arama · Filter] · boşluk · [Display · ⋯] │ ikinciller · birincil (köşeli parantez: birleşik grup).
// Düz flex satırı: öğeler üst üste binemez, boşluk daralır. Eylemler sığdığı kadar düğmedir (`fitActions`), kalanı ⋯'da.
// 640–1023 px'de arama ikona döner, tıklanınca açılır. <640 telefon (yanlar ve gruplar display: contents, düz flex sırası):
// görünüm · boşluk · arama · Filter · ⋯ · ayırıcı · birincil (CSS order); ikinciller ⋯ sayfasında. Arama açılınca araç
// çubuğunun yerini alır (T13-03), Cancel temizleyip kapatır.
import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import type { PrimaryAction, ToolbarAction } from '../../types/list'
import { useDataTableContext } from '../provider'
import { fitActions } from './fit'
import { SearchBox } from './search-box'

export type ToolbarSize = 'full' | 'narrow' | 'phone'
export interface ToolbarHandle {
  /** `/` kısayolu: dar kartta önce aramayı açar. */
  focusSearch: () => void
}

export function Toolbar({
  size,
  view,
  search,
  searchPlaceholder,
  onSearch,
  filter,
  display,
  more,
  end,
  primary,
  actions = [],
  ref,
}: {
  size: ToolbarSize
  /** Görünüm menüsü (04 §7), en solda. */
  view?: ReactNode
  /** null: arama yuvası yok. */
  search: string | null
  searchPlaceholder: string
  onSearch: (value: string) => void
  filter?: ReactNode
  display?: ReactNode
  /** ⋯ menüsü; düğmeye sığmayan ve `menu` olan eylemleri alır. */
  more?: (overflow: ToolbarAction[]) => ReactNode
  /** Uygulamanın serbest içeriği (R3: Vue'daki `#toolbar-end` slot'u); tanıma sığmayan durum için. */
  end?: ReactNode
  primary?: PrimaryAction
  actions?: ToolbarAction[]
  ref?: Ref<ToolbarHandle>
}) {
  const { i18n } = useDataTableContext()
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const phone = size === 'phone'
  const collapsed = size !== 'full' && !open && !search
  const phoneSearch = phone && !collapsed
  const buttons = actions.filter((a) => !a.menu)
  const bar = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ shown: buttons.length, label: true })

  // Eylemler dışındaki öğeler ve düğmelerin tam genişliği (görünmez ölçü alanı) her çizimde okunur; dil, yoğunluk,
  // açılan arama ve geç yüklenen font hepsini değiştirir. Sonuç değişmedikçe state yazılmaz, döngü olmaz.
  useLayoutEffect(() => {
    const el = bar.current
    const m = measure.current
    if (!el || !m || phone) return
    const run = () => {
      const style = getComputedStyle(el)
      const gap = parseFloat(style.columnGap) || 0
      const available = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      const items = [...el.children].filter((c) => c !== m) as HTMLElement[]
      const end = el.querySelector<HTMLElement>('.dt-toolbar-side.is-end')
      const outside = items.filter((c) => c !== end).reduce((sum, c) => sum + c.offsetWidth, 0)
      const inEnd = end ? ([...end.children] as HTMLElement[]).filter((c) => !c.dataset.dtAction) : []
      const fixed =
        outside +
        gap * (items.length - 1) +
        inEnd.reduce((sum, c) => sum + c.offsetWidth, 0) +
        gap * Math.max(0, inEnd.length - 1)
      const widths = ([...m.children] as HTMLElement[]).map((c) => c.offsetWidth)
      const next = fitActions({
        available,
        fixed,
        gap,
        secondary: widths.slice(0, buttons.length),
        primary: primary ? widths[buttons.length]! : 0,
      })
      setFit((f) => (f.shown === next.shown && f.label === next.label ? f : next))
    }
    run()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(run)
    ro.observe(el)
    ro.observe(m)
    return () => ro.disconnect()
  })
  const shown = phone ? [] : buttons.slice(0, fit.shown)
  const overflow = phone ? actions : actions.filter((a) => !shown.includes(a))
  const label = !phone && fit.label
  const openSearch = () => {
    setOpen(true)
    requestAnimationFrame(() => input.current?.focus())
  }
  useImperativeHandle(ref, () => ({
    focusSearch: () => (collapsed ? openSearch() : input.current?.focus()),
  }))

  if (phoneSearch)
    return (
      <div className="dt-toolbar is-phone" role="toolbar">
        <SearchBox value={search ?? ''} placeholder={searchPlaceholder} onChange={onSearch} inputRef={input} phone />
        <button
          type="button"
          className="dt-btn dt-btn-ghost dt-search-cancel"
          onClick={() => {
            setOpen(false)
            onSearch('')
          }}
        >
          {i18n.t('common.cancel')}
        </button>
      </div>
    )

  return (
    <div ref={bar} className={`dt-toolbar is-${size}`} role="toolbar">
      <div className="dt-toolbar-side is-start">{view}</div>
      <div className="dt-btn-group">
        {search !== null &&
          (collapsed ? (
            <button
              type="button"
              className="dt-btn dt-btn-icon dt-search-open"
              aria-label={searchPlaceholder}
              data-dt-tip={searchPlaceholder}
              onClick={openSearch}
            >
              <MagnifyingGlassIcon size={phone ? 20 : 16} aria-hidden="true" />
            </button>
          ) : (
            <SearchBox
              value={search}
              placeholder={searchPlaceholder}
              onChange={onSearch}
              inputRef={input}
              onBlur={() => setOpen(false)}
            />
          ))}
        {filter}
      </div>
      <span className="dt-toolbar-spacer" />
      <div className="dt-toolbar-side is-end">
        <div className="dt-btn-group">
          {display}
          {more?.(overflow)}
        </div>
        {/* Eylem varsa hep durur: ölçülen sabit kısım düğme sayısıyla değişmesin. */}
        {(end || primary || buttons.length > 0) && <span className="dt-toolbar-sep" aria-hidden="true" />}
        {end && <span className="dt-toolbar-end">{end}</span>}
        {shown.map((a) => (
          <ActionButton key={a.id} action={a} data-dt-action />
        ))}
        {primary && (
          <span className="dt-toolbar-end" data-dt-action>
            <PrimaryButton action={primary} label={label} />
          </span>
        )}
      </div>
      {!phone && (buttons.length > 0 || primary) && (
        <div ref={measure} className="dt-toolbar-measure" aria-hidden="true" inert>
          {buttons.map((a) => (
            <ActionButton key={a.id} action={a} />
          ))}
          {primary && <PrimaryButton action={primary} label />}
        </div>
      )}
    </div>
  )
}

function ActionButton({ action, ...rest }: { action: ToolbarAction; 'data-dt-action'?: boolean }) {
  const Icon = action.icon
  return (
    <button
      type="button"
      className={action.checked ? 'dt-btn has-icon is-active' : 'dt-btn has-icon'}
      aria-pressed={action.checked}
      onClick={action.run}
      {...rest}
    >
      {Icon && <Icon size={16} aria-hidden="true" />}
      {action.label}
    </button>
  )
}

function PrimaryButton({ action, label }: { action: PrimaryAction; label: boolean }) {
  const Icon = action.icon
  return (
    <button
      type="button"
      className={label ? 'dt-btn dt-btn-primary has-icon' : 'dt-btn dt-btn-primary dt-btn-icon'}
      aria-label={label ? undefined : action.label}
      data-dt-tip={label ? undefined : action.label}
      onClick={action.run}
    >
      <Icon size={16} aria-hidden="true" />
      {label && action.label}
    </button>
  )
}
