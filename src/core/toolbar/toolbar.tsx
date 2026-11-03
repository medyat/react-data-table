// Toolbar (05 §3, §11; T1, T13): yalnızca yapılandırılmış yuvalar; daralma kartın genişliğiyle (`size`, DataTable ölçer).
// Sıra: görünüm · [arama · Filter] (tam ortada) · [Display · ⋯] │ birincil (köşeli parantez: birleşik düğme grubu, D43).
// 640–1023 px'de arama ikona döner, tıklanınca açılır. Görünüm yuvası 3b'de dolar; telefon düzeni Faz 7.
import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react'
import { SearchBox } from './search-box'

export type ToolbarSize = 'full' | 'narrow' | 'phone'
export interface ToolbarHandle {
  /** `/` kısayolu: dar kartta önce aramayı açar. */
  focusSearch: () => void
}

export function Toolbar({
  size,
  search,
  searchPlaceholder,
  onSearch,
  filter,
  display,
  more,
  end,
  ref,
}: {
  size: ToolbarSize
  /** null: arama yuvası yok. */
  search: string | null
  searchPlaceholder: string
  onSearch: (value: string) => void
  filter?: ReactNode
  display?: ReactNode
  more?: ReactNode
  /** Ekrana özgü birincil aksiyon (R3: Vue'daki `#toolbar-end` slot'u). */
  end?: ReactNode
  ref?: Ref<ToolbarHandle>
}) {
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const collapsed = size !== 'full' && !open && !search
  const openSearch = () => {
    setOpen(true)
    requestAnimationFrame(() => input.current?.focus())
  }
  useImperativeHandle(ref, () => ({
    focusSearch: () => (collapsed ? openSearch() : input.current?.focus()),
  }))

  return (
    <div className={`dt-toolbar is-${size} is-zoned`} role="toolbar">
      <div className="dt-toolbar-side is-start" />
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
              <MagnifyingGlassIcon size={16} aria-hidden="true" />
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
          {more}
        </div>
        {end && (
          <>
            <span className="dt-toolbar-sep" aria-hidden="true" />
            <span className="dt-toolbar-end">{end}</span>
          </>
        )}
      </div>
    </div>
  )
}
