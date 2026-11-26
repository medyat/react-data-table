// İçe aktarma penceresi (data-sheet.md §6, Vue 07 §13): dosya → sayfa ve başlık satırı → sütun eşleme → özet →
// Tabloya uygula. Dosya yalnız tabloyu doldurur; kayıt Kaydet'tedir. Saf adımlar `match.ts`'te.
import { Dialog } from '@base-ui/react/dialog'
import { CaretDownIcon, FileArrowUpIcon, FileCsvIcon, FileXlsIcon } from '@phosphor-icons/react'
import { useState, type DragEvent } from 'react'
import type { ColumnDef } from '../../types/columns'
import type { SheetImportResult } from '../../types/data-sheet'
import type { RemoteLabels } from '../../core/cells/remote-labels'
import { columnName } from '../../core/columns/column-name'
import { plainText } from '../../core/export/cells'
import { getFormat } from '../../core/format'
import { useDataTableContext } from '../../core/provider'
import { useParseEnv } from '../../core/sheet/cell-editor'
import type { SheetStore } from '../../core/sheet/store'
import { resolveImport } from './apply'
import { cellText, cellValue, detectHeaderRow, matchColumns, planImport } from './match'
import { ImportError, readFile, type FileSheet } from './read'

export interface ImportDialogProps<Row extends object> {
  /** Izgaranın sütunları (görünenler; anahtar sütunu yeni satırda yazılır). */
  columns: Array<ColumnDef<Row>>
  rows: readonly Row[]
  keyColumn: string
  maxRows: number
  store: SheetStore<Row>
  labels: RemoteLabels
  onClose: (result: SheetImportResult | null) => void
}

interface Loaded {
  name: string
  sheets: FileSheet[]
  sheet: number
  header: number
  /** Dosya sütunu → alan id'si; null alınmaz. */
  mapping: Array<string | null>
}

const SKIP = '-'

export function ImportDialog<Row extends object>(p: ImportDialogProps<Row>) {
  const { i18n, locale } = useDataTableContext()
  const { t } = i18n
  const fmt = getFormat(locale)
  const parseEnv = useParseEnv()
  const [file, setFile] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addNew, setAddNew] = useState(true)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)

  // Pencere sütununa (object/array) dosyadan metin yazılmaz; accessor'lı ve kilitli sütun alan değildir.
  const fields = p.columns.filter((c) => !c.accessor && c.editable !== false && !c.editor?.window)
  const keyDef = p.columns.find((c) => c.id === p.keyColumn)!
  const key = columnName(keyDef)

  const data = file ? file.sheets[file.sheet]!.rows : []
  const headers = file ? (data[file.header] ?? []).map((c) => cellText(c).trim()) : []
  const body = file ? data.slice(file.header + 1) : []
  const remap = (sheets: FileSheet[], sheet: number, header: number): Array<string | null> =>
    matchColumns(
      (sheets[sheet]!.rows[header] ?? []).map((c) => cellText(c)),
      fields,
    )

  const load = async (f: File | undefined) => {
    if (!f) return
    setError(null)
    try {
      const sheets = await readFile(f)
      const header = Math.max(0, detectHeaderRow(sheets[0]!.rows))
      setFile({ name: f.name, sheets, sheet: 0, header, mapping: remap(sheets, 0, header) })
    } catch (e) {
      setError(t(e instanceof ImportError && e.code === 'xlsxOnly' ? 'import.xlsxOnly' : 'import.failed'))
    }
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    void load(e.dataTransfer.files[0])
  }

  const colOf = (id: string | null) => (id ? p.columns.findIndex((c) => c.id === id) : -1)
  const mapping = (file?.mapping ?? []).map((id) => (colOf(id) >= 0 ? colOf(id) : null))
  const keyFile = file ? file.mapping.indexOf(p.keyColumn) : -1
  // Önizleme ajax'ı çözmez: metin olduğu gibi sayılır (sayılar değişmez, yalnız değer).
  const preview = file
    ? planImport({
        data: body,
        mapping,
        columns: p.columns,
        rows: p.rows,
        keyColumn: p.keyColumn,
        addNew,
        value: (def, c) => cellValue(def, c, parseEnv),
      })
    : null
  const total = p.rows.length + (preview?.added ?? 0)
  const tooMany = total > p.maxRows
  const canApply = !!preview && keyFile >= 0 && !tooMany && !busy && preview.cells.length > 0

  const apply = async () => {
    if (!file || !canApply) return
    setBusy(true)
    // `ajax` sütunundaki metinler (kod, ad) uygulamanın `match`'iyle seçeneğe çevrilir (yapıştırmayla aynı yol).
    const plan = await resolveImport({
      data: body,
      mapping,
      columns: p.columns,
      rows: p.rows,
      keyColumn: p.keyColumn,
      addNew,
      labels: p.labels,
      env: parseEnv,
    })
    p.store.importCells(plan.cells)
    p.onClose({ updated: plan.updated, added: plan.added })
  }

  const firstValue = (j: number, id: string | null): string => {
    const def = id ? p.columns.find((c) => c.id === id) : undefined
    const cell = body.find((r) => cellText(r[j] ?? null).trim() !== '')?.[j] ?? null
    const raw = cellText(cell)
    if (!def || cell === null || def.type === 'ajax') return raw
    const v = cellValue(def, cell, parseEnv)
    const shown =
      v === undefined ? '' : plainText(def, {} as Row, v, { fmt, i18n, today: new Date(), labels: p.labels })
    return shown && shown !== raw ? `${raw} → ${shown}` : raw
  }

  const setMapping = (j: number, id: string | null) =>
    setFile((f) => f && { ...f, mapping: f.mapping.map((m, k) => (k === j ? id : m)) })
  const choose = (sheet: number, header: number) =>
    setFile((f) => f && { ...f, sheet, header, mapping: remap(f.sheets, sheet, header) })

  const fileInput = (
    <input
      type="file"
      accept=".xlsx,.csv"
      className="dt-sr-only"
      onChange={(e) => {
        void load(e.target.files?.[0])
        e.target.value = ''
      }}
    />
  )
  const Icon = file?.name.toLowerCase().endsWith('.csv') ? FileCsvIcon : FileXlsIcon

  return (
    <Dialog.Root open onOpenChange={(open) => !open && p.onClose(null)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="dt-scrim" forceRender />
        <Dialog.Popup className="dt-dialog dt-import-dialog dt-sheet-layer">
          <Dialog.Title className="dt-dialog-title">{t('import.title')}</Dialog.Title>
          <Dialog.Description className="dt-dialog-body">{t('import.body', { key })}</Dialog.Description>

          {!file ? (
            <label
              className={over ? 'dt-import-drop is-over' : 'dt-import-drop'}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(true)
              }}
              onDragLeave={() => setOver(false)}
              onDrop={onDrop}
            >
              {fileInput}
              <FileArrowUpIcon size={24} aria-hidden="true" />
              {t('import.drop')}
            </label>
          ) : (
            <>
              <div className="dt-import-file">
                <Icon size={24} aria-hidden="true" />
                <div className="dt-import-file-text">
                  <strong>{file.name}</strong>
                  <span>
                    {t('import.sheetInfo', {
                      sheet: file.sheets[file.sheet]!.name,
                      count: fmt.int(body.filter((r) => r.some((c) => cellText(c) !== '')).length),
                    })}
                  </span>
                </div>
                <label className="dt-btn dt-btn-sm">
                  {fileInput}
                  {t('import.replace')}
                </label>
              </div>

              <div className="dt-import-row">
                <p className="dt-import-key">
                  {t('import.matchBy')} <strong>{key}</strong>
                  {keyFile >= 0 ? (
                    <> ← “{headers[keyFile]}”</>
                  ) : (
                    <span className="dt-field-error">{t('import.keyRequired', { key })}</span>
                  )}
                </p>
                {file.sheets.length > 1 && (
                  <label className="dt-import-pick">
                    {t('import.sheet')}
                    <span className="dt-select">
                      <select value={file.sheet} onChange={(e) => choose(Number(e.target.value), 0)}>
                        {file.sheets.map((s, i) => (
                          <option key={i} value={i}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <CaretDownIcon size={12} aria-hidden="true" />
                    </span>
                  </label>
                )}
                <label className="dt-import-pick">
                  {t('import.headerRow')}
                  <span className="dt-select">
                    <select value={file.header} onChange={(e) => choose(file.sheet, Number(e.target.value))}>
                      {data.slice(0, 20).map((_, i) => (
                        <option key={i} value={i}>
                          {t('import.headerRowN', { n: i + 1 })}
                        </option>
                      ))}
                    </select>
                    <CaretDownIcon size={12} aria-hidden="true" />
                  </span>
                </label>
              </div>

              <div className="dt-import-map" role="table" aria-label={t('import.title')}>
                <div role="row" className="dt-import-map-head">
                  <span role="columnheader">{t('import.excelColumn')}</span>
                  <span role="columnheader">{t('import.field')}</span>
                  <span role="columnheader">{t('import.firstValue')}</span>
                </div>
                {headers.map((h, j) => {
                  const id = file.mapping[j] ?? null
                  return (
                    <div role="row" key={j}>
                      <span role="cell" className="dt-import-map-col">
                        {h || '—'}
                      </span>
                      <span role="cell">
                        <span className="dt-select">
                          <select
                            aria-label={h || t('import.field')}
                            value={id ?? (h ? '' : SKIP)}
                            onChange={(e) =>
                              setMapping(j, e.target.value && e.target.value !== SKIP ? e.target.value : null)
                            }
                          >
                            <option value="" disabled>
                              {t('import.chooseField')}
                            </option>
                            {fields.map((f) => (
                              <option key={f.id} value={f.id} disabled={f.id !== id && file.mapping.includes(f.id)}>
                                {columnName(f)}
                                {f.id === p.keyColumn ? ` · ${t('import.matchKey')}` : ''}
                              </option>
                            ))}
                            <option value={SKIP}>{t('import.skip')}</option>
                          </select>
                          <CaretDownIcon size={12} aria-hidden="true" />
                        </span>
                      </span>
                      <span role="cell" className="dt-import-map-value">
                        {firstValue(j, id)}
                      </span>
                    </div>
                  )
                })}
              </div>

              {preview && keyFile >= 0 && (
                <div className="dt-import-summary" role="status">
                  <p>
                    {t('import.summary', {
                      updates: fmt.int(preview.updated),
                      news: fmt.int(preview.missing.length),
                      key,
                    })}
                    {preview.blankKeys > 0 && ` · ${t('import.blankKeys', { count: fmt.int(preview.blankKeys), key })}`}
                  </p>
                  {preview.missing.length > 0 && (
                    <>
                      <label className="dt-check-row">
                        <input
                          type="checkbox"
                          className="dt-checkbox"
                          checked={addNew}
                          onChange={(e) => setAddNew(e.target.checked)}
                        />
                        {t('import.addNew', { count: fmt.int(preview.missing.length), key })}
                      </label>
                      <details>
                        <summary>{t('import.seeNew', { key })}</summary>
                        <p className="dt-import-missing">{preview.missing.join(', ')}</p>
                      </details>
                    </>
                  )}
                </div>
              )}
              {tooMany && (
                <p className="dt-field-error" role="alert">
                  {t('sheet.limitFile', { count: fmt.int(total), max: fmt.int(p.maxRows) })}
                </p>
              )}
            </>
          )}
          {error && (
            <p className="dt-field-error" role="alert">
              {error}
            </p>
          )}

          <div className="dt-dialog-actions">
            <Dialog.Close className="dt-btn">{t('common.cancel')}</Dialog.Close>
            <button type="button" className="dt-btn dt-btn-primary" disabled={!canApply} onClick={() => void apply()}>
              {t('import.apply')}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
