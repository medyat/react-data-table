// Save as new view (04 §7, handoff 03 §4.2, T3-04) ve Rename: Name (odaklı; Duplicate'ten "{ad} copy" seçili), özet,
// Make this my default view. Enter kaydeder; hata alanın altında. Her açılışta yeniden kurulur (DataTable `key` verir).
import { Dialog } from '@base-ui/react/dialog'
import { useRef, useState } from 'react'
import { useDataTableContext } from '../provider'
import type { NameError } from './model'

export interface ViewSummary {
  filters: string
  sort: string
  columns: string
}

export function ViewDialog({
  open,
  onOpenChange,
  mode,
  name: initialName,
  summary,
  validate,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'rename'
  name: string
  /** Yalnızca create: Filters / Sort / Columns satırları. */
  summary: ViewSummary | null
  validate: (name: string) => NameError | null
  onSave: (input: { name: string; makeDefault: boolean }) => void
}) {
  const { i18n } = useDataTableContext()
  const [name, setName] = useState(initialName)
  const [makeDefault, setMakeDefault] = useState(false)
  const [error, setError] = useState<NameError | null>(null)
  const input = useRef<HTMLInputElement>(null)

  return (
    <Dialog.Root open={open} onOpenChange={(o) => onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="dt-scrim" />
        <Dialog.Popup
          className="dt-dialog dt-view-dialog"
          initialFocus={() => {
            // Duplicate'te dolu gelen ad seçili: yazmak onu değiştirir.
            input.current?.select()
            return input.current
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const err = validate(name)
              setError(err)
              if (err) return
              onSave({ name: name.trim(), makeDefault })
              onOpenChange(false)
            }}
          >
            <Dialog.Title className="dt-dialog-title">
              {i18n.t(mode === 'rename' ? 'views.rename' : 'views.dialogTitle')}
            </Dialog.Title>
            {mode === 'create' && (
              <Dialog.Description className="dt-dialog-body">{i18n.t('views.dialogBody')}</Dialog.Description>
            )}
            <label className="dt-field">
              <span className="dt-field-label">{i18n.t('views.name')}</span>
              <span className="dt-input">
                <input
                  ref={input}
                  value={name}
                  type="text"
                  aria-invalid={error ? true : undefined}
                  onChange={(e) => setName(e.target.value)}
                />
              </span>
              {error && (
                <span className="dt-field-error" role="alert">
                  {i18n.t(`views.err.${error}`)}
                </span>
              )}
            </label>
            {summary && (
              <div className="dt-view-summary">
                <span>{i18n.t('views.filters')}</span>
                <span>{summary.filters}</span>
                <span>{i18n.t('views.sort')}</span>
                <span>{summary.sort}</span>
                <span>{i18n.t('views.columns')}</span>
                <span>{summary.columns}</span>
              </div>
            )}
            {mode === 'create' && (
              <label className="dt-check-row">
                <input
                  type="checkbox"
                  className="dt-checkbox"
                  checked={makeDefault}
                  onChange={(e) => setMakeDefault(e.target.checked)}
                />
                {i18n.t('views.makeDefault')}
              </label>
            )}
            <div className="dt-dialog-actions">
              <Dialog.Close className="dt-btn">{i18n.t('common.cancel')}</Dialog.Close>
              <button type="submit" className="dt-btn dt-btn-primary">
                {i18n.t(mode === 'rename' ? 'common.save' : 'views.save')}
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
