// Telefon Filters alt sayfası (04 §9, handoff 04 §6.1–6.2, T13-04/05): uygulanmış filtreler · Suggested · Add filter · Sort ·
// Show results. Değişiklikler taslakta birikir ve Show results'la tek seferde uygulanır (masaüstündeki anında uygulamadan
// farklı). Değer editörü ve sütun seçici aynı sayfanın alt seviyeleridir (geri okuyla döner). Her açılışta yeniden kurulur
// (`key`): taslak o anki çiplerden ve sıralamadan başlar.
import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  XIcon,
} from '@phosphor-icons/react'
import { useRef, useState } from 'react'
import type { ColumnDef } from '../../types/columns'
import type { FilterOp, SortRule } from '../../types/query'
import type { RemoteLabels } from '../cells/remote-labels'
import { TYPE_SPECS } from '../cells/specs'
import { useDataTableContext } from '../provider'
import { BottomSheet } from '../ui/bottom-sheet'
import { changeOperator, defaultOperator, isComplete, opLabel, operatorsOf, type Chip, type Summary } from './model'
import { TYPE_ICONS } from './type-icons'
import { ValueEditor } from './value-editor'

type Level = 'main' | 'editor' | 'picker'

export function FiltersSheet({
  open,
  onOpenChange,
  column,
  columns,
  chips,
  sort,
  rows,
  labels,
  summaryOf,
  currenciesOf,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Verilirse doğrudan o sütunun editörüyle açılır (çip, header hunisi, picker). */
  column?: string
  columns: ColumnDef[]
  chips: Chip[]
  sort: SortRule[]
  rows: object[]
  labels: RemoteLabels
  summaryOf: (chip: Chip) => Summary
  currenciesOf: (def: ColumnDef) => string[]
  onApply: (chips: Chip[], sort: SortRule[]) => void
}) {
  const { i18n } = useDataTableContext()
  const defOf = (id: string) => columns.find((c) => c.id === id)
  const headerOf = (id: string) => defOf(id)?.header ?? id

  /** Var olan taslak çipi açar, yoksa varsayılan operatörle oluşturur. boolean'ın editörü yok: dokunuş Yes ↔ No. */
  const editIn = (list: Chip[], id: string): { draft: Chip[]; editing: string | null } => {
    const def = defOf(id)
    if (!def) return { draft: list, editing: null }
    const existing = list.find((c) => c.column === id)
    if (def.type === 'boolean')
      return {
        draft: existing
          ? list.map((c) => (c === existing ? { ...c, value: c.value !== true } : c))
          : [...list, { column: id, op: defaultOperator(def), value: true }],
        editing: null,
      }
    return { draft: existing ? list : [...list, { column: id, op: defaultOperator(def) }], editing: id }
  }
  const [start] = useState(() => (column ? editIn(chips, column) : { draft: chips, editing: null }))
  const [draft, setDraft] = useState<Chip[]>(start.draft)
  // shortcut: telefonda tek sıralama kuralı; çoklu sıralama masaüstünde (ikincil kurallar Show results'ta düşer).
  const [draftSort, setDraftSort] = useState<SortRule | null>(sort[0] ?? null)
  const [editing, setEditing] = useState<string | null>(start.editing)
  const [level, setLevel] = useState<Level>(start.editing ? 'editor' : 'main')
  const [q, setQ] = useState('')
  const editor = useRef<HTMLDivElement>(null)

  const filterable = columns.filter((c) => c.filterable ?? TYPE_SPECS[c.type].filterable)
  const sortable = columns.filter((c) => c.sortable ?? TYPE_SPECS[c.type].sortable)
  const drafted = (id: string) => draft.some((c) => c.column === id)
  const suggested = filterable.filter((c) => c.suggested && !drafted(c.id as string))
  const needle = q.toLocaleLowerCase()
  const pickable = filterable.filter(
    (c) => !drafted(c.id as string) && (!q || c.header.toLocaleLowerCase().includes(needle)),
  )
  const chip = draft.find((c) => c.column === editing) ?? null
  const chipDef = editing ? defOf(editing) : undefined

  const edit = (id: string) => {
    const next = editIn(draft, id)
    setDraft(next.draft)
    if (!next.editing) return
    setEditing(next.editing)
    setLevel('editor')
  }
  // Updater'lar: metin editörü Enter'da aynı olayda önce değeri yazar sonra Done der; `back` güncel taslağı görmeli.
  const replace = (next: Chip) => setDraft((d) => d.map((c) => (c.column === next.column ? next : c)))
  const remove = (id: string) => setDraft((d) => d.filter((c) => c.column !== id))
  /** Geri / Done: değer seçilmemiş çip taslaktan düşer (04 §1). */
  const back = () => {
    if (chipDef) setDraft((d) => d.filter((c) => c.column !== editing || isComplete(c, chipDef.type)))
    setEditing(null)
    setLevel('main')
  }
  const apply = () => {
    onApply(
      draft.filter((c) => isComplete(c, defOf(c.column)!.type)),
      draftSort ? [draftSort] : [],
    )
    onOpenChange(false)
  }
  const title =
    level === 'main'
      ? i18n.t('mobile.filters')
      : level === 'picker'
        ? i18n.t('filter.addFilter')
        : (chipDef?.header ?? '')
  const count = Array.isArray(chip?.value) ? chip.value.length : 1

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      className="dt-filters-sheet"
      headStart={
        level !== 'main' && (
          <button type="button" className="dt-bsheet-back" aria-label={i18n.t('mobile.backToFilters')} onClick={back}>
            <CaretLeftIcon size={20} aria-hidden="true" />
          </button>
        )
      }
      headEnd={
        level === 'main' ? (
          <button type="button" className="dt-bsheet-action" onClick={() => setDraft([])}>
            {i18n.t('filter.clearAll')}
          </button>
        ) : (
          level === 'editor' && (
            <button
              type="button"
              className="dt-bsheet-action"
              disabled={chip?.value === undefined}
              onClick={() => {
                // Devre dışı kalacak düğmeden odak body'ye düşmesin: değer alanına (operatör seçicisi hariç).
                editor.current?.querySelector<HTMLElement>('input, textarea, button')?.focus()
                if (chip) replace({ ...chip, value: undefined })
              }}
            >
              {i18n.t('common.clear')}
            </button>
          )
        )
      }
      foot={
        level === 'editor' ? (
          <button type="button" className="dt-bsheet-primary" onClick={back}>
            {i18n.t('common.done')}
          </button>
        ) : (
          <button type="button" className="dt-bsheet-primary" onClick={apply}>
            {i18n.t('mobile.showResults')}
          </button>
        )
      }
    >
      {level === 'main' && (
        <>
          {draft.map((c) => (
            <div key={c.column} className="dt-bsheet-row is-split">
              <button type="button" className="dt-bsheet-row-main" onClick={() => edit(c.column)}>
                <span className="dt-bsheet-field">{headerOf(c.column)}</span>
                <span className="dt-bsheet-value is-strong">{summaryOf(c).text}</span>
              </button>
              <button
                type="button"
                className="dt-bsheet-x"
                aria-label={i18n.t('filter.removeAria', { column: headerOf(c.column) })}
                onClick={() => remove(c.column)}
              >
                <XIcon size={16} aria-hidden="true" />
              </button>
            </div>
          ))}
          {suggested.length > 0 && (
            <>
              <div className="dt-bsheet-label">{i18n.t('picker.suggested')}</div>
              {suggested.map((c) => (
                <button key={c.id} type="button" className="dt-bsheet-row" onClick={() => edit(c.id as string)}>
                  <span className="dt-bsheet-field">{c.header}</span>
                  <span className="dt-bsheet-value">{i18n.t('common.any')}</span>
                  <CaretRightIcon size={16} aria-hidden="true" />
                </button>
              ))}
            </>
          )}
          <button type="button" className="dt-bsheet-row is-accent" onClick={() => setLevel('picker')}>
            <PlusIcon size={18} aria-hidden="true" />
            {i18n.t('filter.addFilter')}
          </button>
          <div className="dt-bsheet-sep" />
          <div className="dt-bsheet-label">{i18n.t('mobile.sort')}</div>
          <div className="dt-bsheet-row is-sort">
            <label className="dt-select dt-bsheet-select">
              <select
                value={draftSort?.column ?? ''}
                aria-label={i18n.t('mobile.sort')}
                onChange={(e) =>
                  setDraftSort(e.target.value ? { column: e.target.value, dir: draftSort?.dir ?? 'asc' } : null)
                }
              >
                <option value="">{i18n.t('common.empty')}</option>
                {sortable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.header}
                  </option>
                ))}
              </select>
              <CaretDownIcon size={14} aria-hidden="true" />
            </label>
            <ToggleGroup
              className="dt-seg dt-bsheet-dir"
              value={draftSort ? [draftSort.dir] : []}
              disabled={!draftSort}
              onValueChange={(v) => {
                const dir = v[0]
                if ((dir === 'asc' || dir === 'desc') && draftSort) setDraftSort({ ...draftSort, dir })
              }}
            >
              {(['asc', 'desc'] as const).map((d) => (
                <Toggle
                  key={d}
                  className="dt-seg-item"
                  value={d}
                  data-state={draftSort?.dir === d ? 'on' : 'off'}
                  aria-label={i18n.t(d === 'asc' ? 'header.sortAsc' : 'header.sortDesc')}
                >
                  {d === 'asc' ? (
                    <ArrowUpIcon size={16} aria-hidden="true" />
                  ) : (
                    <ArrowDownIcon size={16} aria-hidden="true" />
                  )}
                </Toggle>
              ))}
            </ToggleGroup>
          </div>
        </>
      )}

      {level === 'picker' && (
        <>
          <label className="dt-input has-icon dt-bsheet-search">
            <span className="dt-input-icon">
              <MagnifyingGlassIcon size={16} aria-hidden="true" />
            </span>
            <input
              type="search"
              value={q}
              placeholder={i18n.t('picker.search')}
              aria-label={i18n.t('picker.search')}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          {pickable.map((c) => {
            const Icon = TYPE_ICONS[c.type]
            return (
              <button key={c.id} type="button" className="dt-bsheet-row" onClick={() => edit(c.id as string)}>
                <Icon size={16} className="dt-bsheet-icon" aria-hidden="true" />
                {c.header}
              </button>
            )
          })}
          {pickable.length === 0 && <div className="dt-options-empty">{i18n.t('picker.noMatch')}</div>}
        </>
      )}

      {level === 'editor' && chip && chipDef && (
        <div ref={editor} className="dt-bsheet-editor">
          <label className="dt-select dt-bsheet-select">
            <select
              value={chip.op}
              aria-label={i18n.t('mobile.operator')}
              onChange={(e) => replace(changeOperator(chip, e.target.value as FilterOp, chipDef.type))}
            >
              {operatorsOf(chipDef).map((op) => (
                <option key={op} value={op}>
                  {opLabel(i18n, op, chipDef.type, count)}
                </option>
              ))}
            </select>
            <CaretDownIcon size={14} aria-hidden="true" />
          </label>
          <ValueEditor
            chip={chip}
            column={chipDef}
            rows={rows}
            labels={labels}
            currencies={currenciesOf(chipDef)}
            onChange={replace}
            onDone={back}
          />
        </div>
      )}
    </BottomSheet>
  )
}
