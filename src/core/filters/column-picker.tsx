// Column picker (04 §2, handoff 03 §3.2, T2-01): arama (odaklı) + Filtered ("opens its chip", D2) · Suggested (≤ 4) · All
// columns. Base UI Combobox: yazı alanı popup'ın içinde, ↑↓ ile gezinme, Enter seçer.
import { Combobox } from '@base-ui/react/combobox'
import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { useRef, useState, type ReactElement } from 'react'
import type { ColumnDef } from '../../types/columns'
import { typeLabelKey } from '../cells/specs'
import { useDataTableContext } from '../provider'
import type { Chip } from './model'
import { TYPE_ICONS } from './type-icons'

export function ColumnPicker({
  columns,
  chips,
  trigger,
  open,
  onOpenChange,
  onPick,
}: {
  /** Yalnızca filtrelenebilir sütunlar. */
  columns: ColumnDef[]
  chips: Chip[]
  trigger: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onPick: (columnId: string) => void
}) {
  const { i18n } = useDataTableContext()
  const [inner, setInner] = useState(false)
  const isOpen = open ?? inner
  const setOpen = (o: boolean) => {
    setInner(o)
    onOpenChange?.(o)
  }
  const [q, setQ] = useState('')
  // Seçimle kapanınca odak tetikleyiciye dönmez: açılan çip editörü alır (08 §2 · Popover). Esc'te döner.
  const picked = useRef(false)

  const needle = q.toLocaleLowerCase()
  const match = (c: ColumnDef) => !q || c.header.toLocaleLowerCase().includes(needle)
  const chipped = new Set(chips.map((c) => c.column))
  const filtered = chips
    .map((ch) => columns.find((c) => c.id === ch.column))
    .filter((c): c is ColumnDef => !!c && match(c))
  const suggested = columns.filter((c) => c.suggested && !chipped.has(c.id as string) && match(c)).slice(0, 4)
  const taken = new Set([...chipped, ...suggested.map((c) => c.id as string)])
  const rest = columns.filter((c) => !taken.has(c.id as string) && match(c))
  const typeHint = (c: ColumnDef) => i18n.t(typeLabelKey(c.type))
  const groups = [
    { key: 'filtered', label: i18n.t('picker.filtered'), items: filtered, hint: () => i18n.t('picker.filteredHint') },
    { key: 'suggested', label: i18n.t('picker.suggested'), items: suggested, hint: typeHint },
    { key: 'all', label: i18n.t('picker.allColumns'), items: rest, hint: typeHint },
  ].filter((g) => g.items.length)

  return (
    <Combobox.Root<string>
      open={isOpen}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setQ('')
      }}
      value={null}
      onValueChange={(id) => {
        if (typeof id !== 'string') return
        picked.current = true
        setOpen(false)
        setQ('')
        onPick(id)
      }}
      inputValue={q}
      onInputValueChange={(v) => setQ(v)}
      filter={null}
      autoHighlight
    >
      <Combobox.Trigger render={trigger} />
      <Combobox.Portal>
        <Combobox.Positioner className="dt-positioner" align="start" sideOffset={4}>
          <Combobox.Popup
            className="dt-pop dt-picker"
            finalFocus={() => {
              const keep = !picked.current
              picked.current = false
              return keep
            }}
          >
            <label className="dt-input has-icon dt-picker-search">
              <span className="dt-input-icon">
                <MagnifyingGlassIcon size={14} aria-hidden="true" />
              </span>
              <Combobox.Input placeholder={i18n.t('picker.search')} aria-label={i18n.t('picker.search')} />
            </label>
            <Combobox.List className="dt-picker-list" aria-label={i18n.t('display.columns')}>
              {groups.map((g) => (
                <Combobox.Group key={g.key}>
                  <Combobox.GroupLabel className="dt-pop-label">{g.label}</Combobox.GroupLabel>
                  {g.items.map((c) => {
                    const Icon = TYPE_ICONS[c.type]
                    return (
                      <Combobox.Item key={c.id as string} value={c.id as string} className="dt-picker-item">
                        <Icon size={14} aria-hidden="true" />
                        <span className="dt-picker-name">{c.header}</span>
                        <span className="dt-picker-hint">{g.hint(c)}</span>
                      </Combobox.Item>
                    )
                  })}
                </Combobox.Group>
              ))}
            </Combobox.List>
            {groups.length === 0 && <div className="dt-options-empty">{i18n.t('picker.noMatch')}</div>}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
