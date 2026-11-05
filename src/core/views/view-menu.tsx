// Görünüm seçici + menüsü (04 §7, handoff 03 §4.1, T3-01/02/03; R15): System / My views bölümleri (D30: paylaşım yok),
// satır ⋯ menüsü; altta düzenlenmişse kaydetme satırı (D27), değilse New view. Kısayol `V` DataTable'da.
// Liste ARIA grid'idir (Vue'da reka Listbox; 7c'de axe'e göre ayrıldı): ↑↓ vurguyu taşır (`aria-activedescendant` satırın
// görünüm hücresine), Enter seçer; Tab satırların ⋯ düğmelerine ve alttaki düğmelere gider. Görünüm çoksa (R15) odak
// Find a view… aramasındadır (combobox + grid popup), azsa listenin kendisinde. Base UI Combobox liste içindeki
// düğmeleri Tab sırasından çıkardığı için kullanılmadı.
import { Popover } from '@base-ui/react/popover'
import {
  CaretDownIcon,
  CheckIcon,
  DotsThreeIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  StackIcon,
} from '@phosphor-icons/react'
import { useId, useState, type FocusEvent, type KeyboardEvent } from 'react'
import type { View } from '../../types/views'
import { SAVE_KBD } from '../interaction/kbd'
import { useDataTableContext } from '../provider'
import { BottomSheet } from '../ui/bottom-sheet'
import { DtMenu, DtMenuItem, DtMenuSeparator } from '../ui/menu'

/** Bu sayıdan az görünümde arama yok (R15): liste bir bakışta okunur. */
const SEARCH_MIN_VIEWS = 8

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
  /** `null`: varsayılan kaldırılır, açılış system default'a döner (R6). */
  onSetDefault: (id: string | null) => void
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
      ['system', 'views.system'],
      ['personal', 'views.mine'],
    ] as const
  )
    .map(([key, title]) => ({
      key,
      title,
      views: sections[key].filter((v) => !q || v.name.toLocaleLowerCase().includes(needle)),
    }))
    .filter((g) => g.views.length)
  // Aktif görünümün durumu alttaki kaydetme satırındadır; listede yalnızca bırakılmış taslaklar işaretlenir.
  const isEdited = (v: View) => v.id !== active?.id && hasDraft(v.id)
  const searchable = sections.system.length + sections.personal.length >= SEARCH_MIN_VIEWS
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
  const triggerLabel = i18n.t(edited ? 'sr.viewEdited' : 'sr.view', { name })
  const triggerContent = (
    <>
      <span className="dt-view-icon" aria-hidden="true">
        <StackIcon size={16} />
      </span>
      {/* Boşluk görünmez (flex) ama görünen metni "All orders Edited" yapar; ad onu içermeli (WCAG 2.5.3). */}
      <span className="dt-view-name">{name}</span>
      {edited && (
        <>
          {' '}
          <span className="dt-view-dot" aria-hidden="true" />
          <span className="dt-view-edited">{i18n.t('views.edited')}</span>
        </>
      )}
      <CaretDownIcon size={14} aria-hidden="true" />
    </>
  )
  const focusList = () => document.getElementById(searchable ? `${listId}-q` : listId)
  const onListKey = (e: KeyboardEvent<HTMLElement>) => {
    const i = flat.findIndex((v) => v.id === hl)
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key]
    if (step) {
      e.preventDefault()
      const next = flat[Math.min(flat.length - 1, Math.max(0, i < 0 ? 0 : i + step))]
      if (next) setHl(next.id)
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      setHl((e.key === 'Home' ? flat[0] : flat.at(-1))?.id ?? null)
    } else if (e.key === 'Enter' && i >= 0 && e.target === e.currentTarget) {
      e.preventDefault()
      pick(flat[i]!.id)
    }
  }
  const activeDescendant = hl && flat.some((v) => v.id === hl) ? optionId(hl) : undefined
  const content = (
    <>
      {searchable && (
        <label className="dt-input has-icon dt-picker-search">
          <span className="dt-input-icon">
            <MagnifyingGlassIcon size={14} aria-hidden="true" />
          </span>
          <input
            id={`${listId}-q`}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-haspopup="grid"
            aria-controls={listId}
            aria-activedescendant={activeDescendant}
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
            onKeyDown={onListKey}
          />
        </label>
      )}
      {/* Combobox + grid popup (ARIA 1.2): satır = görünüm hücresi + ⋯ hücresi. listbox yalnızca option alabildiği için
          satırdaki ⋯ düğmesi onu bozuyordu (axe aria-required-children). Grup başlığı satır değil: rowgroup'un adı. */}
      <div
        id={listId}
        role={groups.length ? 'grid' : undefined}
        className="dt-views-list"
        aria-label={groups.length ? i18n.t('views.title') : undefined}
        // Arama yoksa odak listededir: klavye ve vurgu onunla.
        tabIndex={searchable ? undefined : 0}
        aria-activedescendant={searchable ? undefined : activeDescendant}
        onKeyDown={searchable ? undefined : onListKey}
        onBlur={leave}
      >
        {groups.map((g) => (
          <div key={g.key} role="rowgroup" aria-labelledby={`${listId}-${g.key}`}>
            <div id={`${listId}-${g.key}`} className="dt-pop-label" aria-hidden="true">
              {i18n.t(g.title)}
            </div>
            {g.views.map((v) => (
              <div key={v.id} role="row" className={v.id === active?.id ? 'dt-view-row is-active' : 'dt-view-row'}>
                <div
                  id={optionId(v.id)}
                  role="gridcell"
                  aria-selected={v.id === active?.id}
                  className="dt-view-item"
                  // Açılışta vurgu yok, aktifi işaret gösterir; klavyeyle ya da yazınca taşınan vurgu çizilir.
                  data-highlighted={moved && v.id === hl ? '' : undefined}
                  onPointerEnter={() => setHl(v.id)}
                  onClick={() => pick(v.id)}
                >
                  <span className="dt-view-check" aria-hidden="true">
                    {v.id === active?.id && <CheckIcon size={sheet ? 18 : 14} />}
                  </span>
                  <span className="dt-view-row-name">{v.name}</span>
                  {isEdited(v) && (
                    <>
                      <span className="dt-view-dot" aria-hidden="true" />
                      <span className="dt-view-edited">{i18n.t('views.edited')}</span>
                    </>
                  )}
                  {v.id === defaultId && <span className="dt-view-default">{i18n.t('views.default')}</span>}
                </div>
                <div role="gridcell" className="dt-view-more-cell">
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
                    {v.id === defaultId ? (
                      <DtMenuItem destructive onSelect={() => onSetDefault(null)}>
                        {i18n.t('views.removeDefault')}
                      </DtMenuItem>
                    ) : (
                      <DtMenuItem onSelect={() => onSetDefault(v.id)}>{i18n.t('views.setDefault')}</DtMenuItem>
                    )}
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
              </div>
            ))}
          </div>
        ))}
        {groups.length === 0 && <div className="dt-options-empty">{i18n.t('views.noMatch')}</div>}
      </div>
      {edited && active ? (
        <div className="dt-views-foot">
          <p className="dt-views-unsaved">
            <span className="dt-view-dot" aria-hidden="true" />
            {i18n.t('views.unsaved')}
          </p>
          <div className="dt-views-foot-actions">
            <button type="button" className="dt-btn dt-btn-ghost dt-views-revert" onClick={() => after(onDiscard)}>
              {i18n.t('views.discard')}
            </button>
            {canWrite ? (
              <>
                <button type="button" className="dt-btn dt-btn-sm" onClick={() => after(onSaveAs)}>
                  {i18n.t('views.saveAsNew')}
                </button>
                <button type="button" className="dt-btn dt-btn-sm dt-btn-primary" onClick={() => after(onSaveChanges)}>
                  {i18n.t('views.saveChanges')}
                  <kbd className="dt-kbd" aria-hidden="true">
                    {SAVE_KBD}
                  </kbd>
                </button>
              </>
            ) : (
              canSave && (
                <button type="button" className="dt-btn dt-btn-sm dt-btn-primary" onClick={() => after(onSaveAs)}>
                  {i18n.t('views.saveAsMine')}
                </button>
              )
            )}
          </div>
        </div>
      ) : (
        canSave && (
          <>
            <div className="dt-pop-sep" />
            <button type="button" className="dt-pop-item dt-view-new" onClick={() => after(onSaveAs)}>
              <PlusIcon size={14} aria-hidden="true" />
              {i18n.t('views.new')}
            </button>
          </>
        )
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
        initialFocus={focusList}
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
          <Popover.Popup className="dt-pop dt-views" initialFocus={focusList}>
            {content}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
