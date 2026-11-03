// Görünüm seçici + menüsü (04 §7, handoff 03 §4.1, T3-01/02/03): üstte kaydetme bölümü (yalnızca düzenlenmişse, D27),
// Find a view…, System / My views bölümleri (D30: paylaşım yok), satır ⋯ menüsü, altta New view. Kısayol `V` DataTable'da.
// Vue'daki reka Listbox'ın karşılığı burada: odak aramada kalır, ↑↓ vurguyu taşır (`aria-activedescendant`), Enter seçer;
// Tab satırların ⋯ düğmelerine ve New view'a gider. Base UI Combobox liste içindeki düğmeleri Tab sırasından çıkardığı için
// kullanılmadı.
import { Popover } from '@base-ui/react/popover'
import {
  CaretDownIcon,
  CheckIcon,
  DotsThreeIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  StackIcon,
} from '@phosphor-icons/react'
import { useId, useState, type FocusEvent } from 'react'
import type { View } from '../../types/views'
import { SAVE_KBD } from '../interaction/kbd'
import { useDataTableContext } from '../provider'
import { BottomSheet } from '../ui/bottom-sheet'
import { DtMenu, DtMenuItem, DtMenuSeparator } from '../ui/menu'

export function ViewMenu({
  sections,
  active,
  edited,
  hasDraft,
  defaultId,
  canSave,
  canWrite,
  open,
  onOpenChange,
  onSelect,
  onSaveChanges,
  onSaveAs,
  onDiscard,
  onRename,
  onDuplicate,
  onSetDefault,
  onDelete,
  sheet,
}: {
  sections: { system: View[]; personal: View[] }
  active: View | null
  edited: boolean
  hasDraft: (id: string) => boolean
  defaultId: string | null
  /** Adapter var: kaydetme, New view, Duplicate. */
  canSave: boolean
  /** Aktif görünüm üzerine yazılabilir (personal). */
  canWrite: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (id: string) => void
  onSaveChanges: () => void
  /** Save as new view… / Save as my view… / New view: mevcut durumla. */
  onSaveAs: () => void
  onDiscard: () => void
  onRename: (view: View) => void
  onDuplicate: (view: View) => void
  onSetDefault: (id: string) => void
  onDelete: (view: View) => void
  /** Telefon: popover yerine alt sayfa (T13-06). */
  sheet?: boolean
}) {
  const { i18n } = useDataTableContext()
  const [q, setQ] = useState('')
  // Vurgulu satır: açılışta aktif görünüm (menü `V` ile dışarıdan da açılır), yazınca ilk eşleşme (reka Listbox).
  const [moved, setMoved] = useState<string | null>(null)
  const hl = moved ?? active?.id ?? null
  const setHl = (id: string | null) => setMoved(id ?? '')
  const listId = useId()
  const name = active?.name ?? i18n.t('views.title')
  const needle = q.toLocaleLowerCase()
  const groups = (
    [
      ['system', 'views.system', 'views.builtIn'],
      ['personal', 'views.mine', 'views.onlyYou'],
    ] as const
  )
    .map(([key, title, hint]) => ({
      key,
      title,
      hint,
      views: sections[key].filter((v) => !q || v.name.toLocaleLowerCase().includes(needle)),
    }))
    .filter((g) => g.views.length)
  const isEdited = (v: View) => (v.id === active?.id ? edited : hasDraft(v.id))
  const canEdit = (v: View) => canSave && v.kind !== 'system'
  const flat = groups.flatMap((g) => g.views)
  const setOpen = (o: boolean) => {
    onOpenChange(o)
    setQ('')
    setMoved(null)
  }
  const pick = (id: string) => {
    setOpen(false)
    onSelect(id)
  }
  const optionId = (id: string) => `${listId}-${id}`
  // Odak arama ve listeden çıkınca (ör. New view) vurgu kalkar: aynı anda iki odak işareti olmasın (reka Listbox).
  const leave = (e: FocusEvent<HTMLElement>) => {
    const to = e.relatedTarget as HTMLElement | null
    if (!to || (to.id !== `${listId}-q` && !document.getElementById(listId)?.contains(to))) setHl(null)
  }
  /** Dialog açan eylemler popover kapandıktan sonra: kapanış odağı tetikleyiciye dönerken dialog'u kapatmasın. */
  const after = (fn: () => void) => {
    setOpen(false)
    setTimeout(fn, 0)
  }
  const action = (main: string, onClick: () => void, sub?: string, kbd?: boolean) => (
    <button
      type="button"
      className={sub ? 'dt-pop-item dt-view-action' : 'dt-pop-item dt-view-action is-single'}
      onClick={onClick}
    >
      <span className="dt-view-action-main">
        {main}
        {kbd && <kbd className="dt-kbd">{SAVE_KBD}</kbd>}
      </span>
      {sub && <span className="dt-view-action-sub">{sub}</span>}
    </button>
  )

  const triggerLabel = i18n.t(edited ? 'sr.viewEdited' : 'sr.view', { name })
  const triggerContent = (
    <>
      <span className="dt-view-icon" aria-hidden="true">
        <StackIcon size={16} />
      </span>
      <span className="dt-view-name">{name}</span>
      {edited && (
        <>
          <span className="dt-view-dot" aria-hidden="true" />
          <span className="dt-view-edited">{i18n.t('views.edited')}</span>
        </>
      )}
      <CaretDownIcon size={14} aria-hidden="true" />
    </>
  )
  const focusSearch = () => document.getElementById(`${listId}-q`)
  const content = (
    <>
      {edited && active && (
        <>
          <div className="dt-pop-label">{i18n.t('views.editedName', { name: active.name })}</div>
          {canWrite ? (
            <>
              {action(
                i18n.t('views.saveChanges'),
                () => after(onSaveChanges),
                i18n.t('views.updates', { name: active.name }),
                true,
              )}
              {action(
                i18n.t('views.saveAsNew'),
                () => after(onSaveAs),
                i18n.t('views.keepsUnchanged', { name: active.name }),
              )}
            </>
          ) : (
            canSave && action(i18n.t('views.saveAsMine'), () => after(onSaveAs), undefined, true)
          )}
          {action(i18n.t('views.discard'), () => after(onDiscard))}
          <div className="dt-pop-sep" />
        </>
      )}
      <label className="dt-input has-icon dt-picker-search">
        <span className="dt-input-icon">
          <MagnifyingGlassIcon size={14} aria-hidden="true" />
        </span>
        <input
          id={`${listId}-q`}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={hl && flat.some((v) => v.id === hl) ? optionId(hl) : undefined}
          autoComplete="off"
          value={q}
          placeholder={i18n.t('views.find')}
          aria-label={i18n.t('views.find')}
          onBlur={leave}
          onChange={(e) => {
            const text = e.target.value
            setQ(text)
            const first = sections.system
              .concat(sections.personal)
              .find((v) => v.name.toLocaleLowerCase().includes(text.toLocaleLowerCase()))
            setHl(first?.id ?? null)
          }}
          onKeyDown={(e) => {
            const i = flat.findIndex((v) => v.id === hl)
            const step = { ArrowDown: 1, ArrowUp: -1 }[e.key]
            if (step) {
              e.preventDefault()
              const next = flat[Math.min(flat.length - 1, Math.max(0, i < 0 ? 0 : i + step))]
              if (next) setHl(next.id)
            } else if (e.key === 'Home' || e.key === 'End') {
              e.preventDefault()
              setHl((e.key === 'Home' ? flat[0] : flat.at(-1))?.id ?? null)
            } else if (e.key === 'Enter' && i >= 0) {
              e.preventDefault()
              pick(flat[i]!.id)
            }
          }}
        />
      </label>
      <div id={listId} role="listbox" className="dt-views-list" aria-label={i18n.t('views.title')} onBlur={leave}>
        {groups.map((g) => (
          <div key={g.key} role="group" aria-labelledby={`${listId}-${g.key}`}>
            <div id={`${listId}-${g.key}`} className="dt-pop-label">
              {i18n.t(g.title)}
              <span>{i18n.t(g.hint)}</span>
            </div>
            {g.views.map((v) => (
              <div key={v.id} className={v.id === active?.id ? 'dt-view-row is-active' : 'dt-view-row'}>
                <div
                  id={optionId(v.id)}
                  role="option"
                  aria-selected={v.id === active?.id}
                  className="dt-view-item"
                  data-highlighted={v.id === hl ? '' : undefined}
                  onPointerEnter={() => setHl(v.id)}
                  onClick={() => pick(v.id)}
                >
                  {sheet && v.id === active?.id && <CheckIcon size={18} className="dt-view-check" aria-hidden="true" />}
                  <span className="dt-view-row-name">{v.name}</span>
                  {isEdited(v) && (
                    <>
                      <span className="dt-view-dot" aria-hidden="true" />
                      <span className="dt-view-edited">{i18n.t('views.edited')}</span>
                    </>
                  )}
                  {v.id === defaultId && <span className="dt-view-default">{i18n.t('views.default')}</span>}
                </div>
                <DtMenu
                  side="right"
                  align="start"
                  className="dt-view-row-menu"
                  trigger={
                    <button type="button" className="dt-icon-btn-sm dt-view-more" aria-label={i18n.t('common.more')}>
                      <DotsThreeIcon size={16} weight="bold" aria-hidden="true" />
                    </button>
                  }
                >
                  {canEdit(v) && (
                    <DtMenuItem onSelect={() => after(() => onRename(v))}>{i18n.t('views.rename')}</DtMenuItem>
                  )}
                  {canSave && (
                    <DtMenuItem onSelect={() => after(() => onDuplicate(v))}>{i18n.t('views.duplicate')}</DtMenuItem>
                  )}
                  <DtMenuItem onSelect={() => onSetDefault(v.id)}>{i18n.t('views.setDefault')}</DtMenuItem>
                  {canEdit(v) && (
                    <>
                      <DtMenuSeparator />
                      <DtMenuItem destructive onSelect={() => after(() => onDelete(v))}>
                        {i18n.t('views.delete')}
                      </DtMenuItem>
                    </>
                  )}
                  {v.kind === 'system' && <div className="dt-view-note">{i18n.t('views.systemNote')}</div>}
                </DtMenu>
              </div>
            ))}
          </div>
        ))}
        {groups.length === 0 && <div className="dt-options-empty">{i18n.t('views.noMatch')}</div>}
      </div>
      {canSave && (
        <>
          <div className="dt-pop-sep" />
          <button type="button" className="dt-pop-item dt-view-new" onClick={() => after(onSaveAs)}>
            <PlusIcon size={14} aria-hidden="true" />
            {i18n.t('views.new')}
          </button>
        </>
      )}
    </>
  )

  if (sheet)
    return (
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={i18n.t('views.title')}
        hideTitle
        className="dt-views"
        initialFocus={focusSearch}
        trigger={
          <button type="button" className="dt-btn dt-btn-ghost has-icon dt-view-trigger" aria-label={triggerLabel}>
            {triggerContent}
          </button>
        }
      >
        {content}
      </BottomSheet>
    )
  return (
    <Popover.Root open={open} onOpenChange={(o) => setOpen(o)}>
      <Popover.Trigger className="dt-btn dt-btn-ghost has-icon dt-view-trigger" aria-label={triggerLabel}>
        {triggerContent}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="dt-positioner" align="start" sideOffset={4}>
          <Popover.Popup className="dt-pop dt-views" initialFocus={focusSearch}>
            {content}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
