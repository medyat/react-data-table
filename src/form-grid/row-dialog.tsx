// Satır penceresi (form-grid.md §7, pano 2a · DialogStock, F2a, 3b): alanlar ızgaranın düzenlenebilir sütunlarıdır,
// aynı sırayla tek sütun. Taslak Tamam'a (ya da ‹ › ile geçişe) kadar satıra yazılmaz; İptal ve Esc atar. Alanı
// uygulama `renderField` ile verebilir, yoksa hücre editörü alan olarak çizilir. Pencere sütunu özet + kalemdir.
import { Dialog } from '@base-ui/react/dialog'
import { CaretLeftIcon, CaretRightIcon, PencilSimpleIcon, QuestionIcon } from '@phosphor-icons/react'
import { useId, useRef, useState, type ComponentType } from 'react'
import type { ColumnDef, OptionDef, WindowEditorProps } from '../types/columns'
import type { RowFieldProps } from '../types/form-grid'
import { plainText } from '../core/export/cells'
import { renderCellContent } from '../core/cells/render-cell'
import type { RemoteLabels } from '../core/cells/remote-labels'
import { readPath } from '../core/columns/read-path'
import { getFormat } from '../core/format'
import { DelegatedTooltip } from '../core/grid/tooltip'
import { useDataTableContext } from '../core/provider'
import { DtSwitch } from '../core/ui/switch'
import { CellEditor } from '../core/sheet/cell-editor'
import type { SheetStore } from '../core/sheet/store'
import type { Issue } from '../core/sheet/validate'

interface RowDialogProps<Row extends object> {
  store: SheetStore<Row>
  defs: Array<ColumnDef<Row>>
  /** Satır sırası; `rows.length` yeni satırdır. */
  index: number
  labels: RemoteLabels
  /** Satırın hücre hataları (sütun kimliğiyle). */
  issues: (index: number) => Map<string, Issue> | undefined
  onIndex: (index: number) => void
  onClose: () => void
}

export function RowDialog<Row extends object>(props: RowDialogProps<Row>) {
  const popup = useRef<HTMLDivElement>(null)
  return (
    // Dışarı tık kapatmaz: yanlışlıkla tıklayınca taslak gitmesin; İptal, Tamam ve Esc kapatır.
    <Dialog.Root open disablePointerDismissal onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="dt-scrim" />
        <Dialog.Popup
          ref={popup}
          className="dt-dialog dt-row-dialog dt-sheet-layer"
          // İlk düzenlenebilir alan; kilitli alan `inert`.
          initialFocus={() =>
            document.querySelector<HTMLElement>(
              '.dt-row-dialog .dt-rd-body :is(input, textarea, button):not([disabled], [inert] *)',
            )
          }
          finalFocus={false}
        >
          {/* Satır değişince taslak o satırdan yeniden kurulur. */}
          <RowForm key={props.index} {...props} />
        </Dialog.Popup>
        {/* Pencerenin dışında: `transform`'lu kutunun içinde `position: fixed` ona göre konumlanırdı. */}
        <DelegatedTooltip root={popup} />
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function RowForm<Row extends object>({ store, defs, index, labels, issues, onIndex, onClose }: RowDialogProps<Row>) {
  const { i18n, locale, renderField } = useDataTableContext()
  const id = useId()
  const rows = store.rows()
  const isNew = index >= rows.length
  const [draft, setDraft] = useState<Row>(() => rows[index] ?? store.blankRow())
  // Kullanıcının değiştirdiği alanlar: hücreden gelen hata orada kalkar (düzeltilmiş sayılır, doğrulama kayıtta).
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set())
  // Başka alanın `onChange`'i bu alanı değiştirince (Ürün → Ad) editör yeni değerle yeniden kurulur.
  const [revs, setRevs] = useState<Record<string, number>>({})
  const [windowCol, setWindowCol] = useState<number | null>(null)
  const rowIssues = isNew ? undefined : issues(index)
  const env = { i18n, fmt: getFormat(locale), today: new Date(), labels, density: 'standard' as const, coarse: false }

  const change = (col: number, value: unknown, option?: OptionDef) => {
    const next = store.preview(draft, col, value, option)
    const bumped = { ...revs }
    defs.forEach((d, c) => {
      if (c !== col && !Object.is(readPath(draft, d.id), readPath(next, d.id))) bumped[d.id] = (bumped[d.id] ?? 0) + 1
    })
    setRevs(bumped)
    setTouched(new Set(touched).add(defs[col]!.id))
    setDraft(next)
  }
  const go = (target: number) => {
    store.setRow(index, draft)
    onIndex(target)
  }
  const title = isNew ? i18n.t('sheet.newRow') : i18n.t('sheet.rowTitle', { n: index + 1 })
  const subtitle = isNew
    ? ''
    : defs
        .slice(0, 2)
        // `ajax`'ta kod (ürün kodu + adı), öbürlerinde görünen metin.
        .map((d) =>
          d.type === 'ajax' ? String(readPath(draft, d.id) ?? '') : plainText(d, draft, readPath(draft, d.id), env),
        )
        .filter(Boolean)
        .join(' · ')

  const field = (def: ColumnDef<Row>, col: number) => {
    const fieldId = `${id}-${col}`
    const issue = touched.has(def.id) ? undefined : rowIssues?.get(def.id)
    const value = readPath(draft, def.id)
    const props: RowFieldProps = {
      id: fieldId,
      label: def.header,
      hint: def.hint,
      required: typeof def.required === 'function' ? def.required(draft) : !!def.required,
      disabled: !store.canEdit(index, col),
      error: issue?.message,
      value,
      onChange: (v, option) => change(col, v, option),
      row: draft,
    }
    if (!def.editor?.window) {
      const custom = renderField?.(def, props)
      if (custom != null) return <div key={def.id}>{custom}</div>
    }
    const label = (
      <>
        {def.header}
        {props.required && <span className="dt-rd-req">*</span>}
      </>
    )
    const hint = def.hint && (
      <button
        type="button"
        className="dt-rd-hint"
        tabIndex={-1}
        aria-label={i18n.t('sheet.aboutField', { label: def.header })}
        aria-description={def.hint}
        data-dt-tip={def.hint}
      >
        <QuestionIcon size={16} weight="duotone" aria-hidden="true" />
      </button>
    )
    const below = (
      <>
        {def.description && <span className="dt-rd-desc">{def.description}</span>}
        {issue && <span className={`dt-rd-error is-${issue.level}`}>{issue.message}</span>}
      </>
    )
    const state = issue?.level === 'error' ? 'error' : issue?.level
    // Açık / kapalı: Swors'taki gibi çerçeveli ayar satırı, etiket solda anahtar sağda; kutunun tamamı tıklanır.
    if (def.type === 'boolean')
      return (
        <div key={def.id} className="dt-rd-field" data-state={state}>
          <label
            htmlFor={fieldId}
            className={props.disabled ? 'dt-rd-card is-disabled' : 'dt-rd-card'}
            inert={props.disabled}
          >
            <span className="dt-rd-card-text">
              <span className="dt-rd-label-text">{label}</span>
              {def.hint && <span className="dt-rd-desc">{def.hint}</span>}
            </span>
            <DtSwitch id={fieldId} checked={value === true} onChange={(v) => change(col, v)} />
          </label>
          {below}
        </div>
      )
    return (
      <div key={def.id} className="dt-rd-field" data-state={state}>
        <div className="dt-rd-label">
          <label htmlFor={fieldId}>{label}</label>
          {hint}
        </div>
        <div
          className={['dt-rd-input', props.disabled && 'is-disabled'].filter(Boolean).join(' ')}
          // Kilitli alan: tıklama ve klavye almaz; değer görünür kalır.
          inert={props.disabled}
        >
          {def.editor?.window ? (
            <>
              <span className="dt-rd-summary">{renderCellContent(def, draft, value, env)}</span>
              <button
                id={fieldId}
                type="button"
                className="dt-btn dt-btn-ghost dt-btn-icon dt-btn-sm"
                aria-label={i18n.t('sheet.edit')}
                onClick={() => setWindowCol(col)}
              >
                <PencilSimpleIcon size={16} aria-hidden="true" />
              </button>
            </>
          ) : (
            <CellEditor
              key={revs[def.id] ?? 0}
              field
              id={fieldId}
              invalid={issue?.level === 'error'}
              def={def}
              row={draft}
              rows={rows}
              labels={labels}
              text={undefined}
              value={value}
              onDraft={(v) => change(col, v === '' ? null : v)}
              onPick={(v) => change(col, v)}
            />
          )}
        </div>
        {below}
      </div>
    )
  }

  const Win: ComponentType<WindowEditorProps<Row>> | undefined =
    windowCol === null ? undefined : defs[windowCol]?.editor?.window
  return (
    <>
      <div className="dt-rd-head">
        <div className="dt-rd-titles">
          <Dialog.Title className="dt-dialog-title">{title}</Dialog.Title>
          {subtitle && <span className="dt-rd-sub">{subtitle}</span>}
        </div>
        {!isNew && (
          <>
            <button
              type="button"
              className="dt-btn dt-btn-ghost dt-btn-icon"
              aria-label={i18n.t('sheet.prevRow')}
              disabled={index === 0}
              onClick={() => go(index - 1)}
            >
              <CaretLeftIcon size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="dt-btn dt-btn-ghost dt-btn-icon"
              aria-label={i18n.t('sheet.nextRow')}
              disabled={index >= rows.length - 1}
              onClick={() => go(index + 1)}
            >
              <CaretRightIcon size={16} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      <div className="dt-rd-body">{defs.map((def, col) => (store.isField(col) ? field(def, col) : null))}</div>
      <div className="dt-rd-foot">
        <span className="dt-rd-count">{isNew ? '' : `${index + 1} / ${rows.length}`}</span>
        <Dialog.Close className="dt-btn">{i18n.t('common.cancel')}</Dialog.Close>
        {isNew && (
          <button
            type="button"
            className="dt-btn"
            onClick={() => {
              store.setRow(index, draft)
              onIndex(store.rows().length)
            }}
          >
            {i18n.t('sheet.addNext')}
          </button>
        )}
        <button
          type="button"
          className="dt-btn dt-btn-primary"
          onClick={() => {
            store.setRow(index, draft)
            onClose()
          }}
        >
          {i18n.t('common.done')}
        </button>
      </div>
      {Win && windowCol !== null && (
        <Win
          row={draft}
          value={readPath(draft, defs[windowCol]!.id)}
          onApply={(v) => {
            change(windowCol, v)
            setWindowCol(null)
          }}
          onCancel={() => setWindowCol(null)}
        />
      )}
    </>
  )
}
