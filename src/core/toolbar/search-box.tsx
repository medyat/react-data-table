// Toolbar araması (04 §5, D3): çip üretmez; 250 ms gecikme; Esc önce temizler, ikinci Esc odaktan çıkar; `/` dışarıdan odaklar.
import { MagnifyingGlassIcon, XCircleIcon, XIcon } from '@phosphor-icons/react'
import { useState, type Ref } from 'react'
import { useDelay } from '../interaction/use-delay'
import { useDataTableContext } from '../provider'

export function SearchBox({
  value,
  placeholder,
  onChange,
  inputRef,
  onBlur,
  phone,
}: {
  value: string
  placeholder: string
  onChange: (value: string) => void
  inputRef?: Ref<HTMLInputElement>
  onBlur?: () => void
  /** Telefon araması (T13-03): ikon 18, dolu XCircle temizleme, kısayol rozeti yok. */
  phone?: boolean
}) {
  const { i18n } = useDataTableContext()
  const [draft, setDraft] = useState(value)
  // Dışarıdan gelen değer (Clear search, geri tuşu) taslağa yazılır. Kendi gönderdiğimiz değer URL'den geç dönebilir:
  // o arada yazılanlar ezilmesin.
  const [seen, setSeen] = useState(value)
  const [sent, setSent] = useState(value)
  if (seen !== value) {
    setSeen(value)
    if (value !== sent) setDraft(value)
  }
  const delay = useDelay(250)
  const send = (text: string) => {
    setSent(text)
    onChange(text)
  }
  const commit = (text: string, now = false) => {
    setDraft(text)
    if (now) {
      delay.cancel()
      send(text)
    } else delay.run(() => send(text))
  }

  return (
    <label className="dt-input dt-search has-icon" onBlur={onBlur}>
      <span className="dt-input-icon">
        <MagnifyingGlassIcon size={phone ? 18 : 16} aria-hidden="true" />
      </span>
      <input
        ref={inputRef}
        type="search"
        value={draft}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        onChange={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return
          e.preventDefault()
          if (draft) commit('', true)
          else e.currentTarget.blur()
        }}
      />
      <span className="dt-input-end">
        {draft ? (
          <button
            type="button"
            className="dt-input-clear"
            aria-label={i18n.t('common.clear')}
            onClick={() => commit('', true)}
          >
            {phone ? (
              <XCircleIcon size={20} weight="fill" aria-hidden="true" />
            ) : (
              <XIcon size={14} aria-hidden="true" />
            )}
          </button>
        ) : (
          !phone && (
            <kbd className="dt-kbd" aria-hidden="true">
              /
            </kbd>
          )
        )}
      </span>
    </label>
  )
}
