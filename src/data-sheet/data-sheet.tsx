// DataSheet (R44, docs/data-sheet.md): FormGrid'in ızgarası + taslak katmanı, anahtar sütunu, görünümler, hata ve
// değişiklik işaretleri, ⌘S ve iki onay penceresi. Araç çubuğu uygulamanındır (§2): `useDataSheet`'in durumunu okur,
// komutlarını çağırır. Hücre, klavye ve pano kuralları form-grid.md §3–§8.
import { lazy, Suspense, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import type { ColumnDef } from '../types/columns'
import type { Density } from '../types/core'
import { readPath } from '../core/columns/read-path'
import { getFormat } from '../core/format'
import { mac } from '../core/interaction/kbd'
import { useDataTableContext } from '../core/provider'
import { mapErrors } from '../core/sheet/errors'
import type { GridIssues } from '../core/sheet/issues'
import { same } from '../core/sheet/store'
import type { Issue } from '../core/sheet/validate'
import { ConfirmDialog } from '../core/ui/confirm-dialog'
import { SheetGrid } from '../form-grid/form-grid'
import { ImportDialog } from './import/import-dialog'
import { mergeView, type DataSheetInstance } from './use-data-sheet'

// Liste tablosundaki gibi tembel: @dnd-kit ızgarayla yüklenmez. lazy() tip parametresini düşürür.
const ColumnsDialog = lazy(
  () => import('../core/toolbar/columns-dialog'),
) as unknown as typeof import('../core/toolbar/columns-dialog').default

const MAX_ROWS = 10_000

export interface DataSheetProps<Row extends object> {
  sheet: DataSheetInstance<Row>
  /** role=grid aria-label. */
  label: string
  /** Varsayılan `compact` (Vue 07 §2). */
  density?: Density
  /** `false`: uygulamanın kartının içinde kenardan kenara, kendi çerçevesi ve köşesi yok (FormGrid `frame`). */
  frame?: boolean
  /**
   * Satırlar ilk kez geldiğinde ve ızgara kilitli değilken imleç bir kez ilk satırın ilk düzenlenebilir hücresine
   * gider (yüklenen satırda kilitli anahtar atlanır): ekran açılınca yazmaya hazırdır.
   */
  autoFocus?: boolean
}

export function DataSheet<Row extends object>({
  sheet,
  label,
  density = 'compact',
  frame = true,
  autoFocus = false,
}: DataSheetProps<Row>) {
  const { i18n, locale } = useDataTableContext()
  const { t } = i18n
  const fmt = getFormat(locale)
  const {
    options,
    state: s,
    setState,
    store,
    idOf,
    newRow,
    fields,
    changedOf,
    changes,
    cells,
    isNew,
    clientOf,
    dupOf,
    ordered,
    opener,
  } = sheet.internal
  const { blocked, run } = sheet.internal
  const key = options.keyColumn
  const readOnly = sheet.readOnly

  // Anahtar yüklenen satırda kilitli, yeni satırda sütunun kendi kuralıyla yazılır (data-sheet.md §3).
  const columns: Array<ColumnDef<Row>> = ordered
    .filter((c) => !s.hidden.has(c.id))
    .map((c) =>
      c.id === key
        ? {
            ...c,
            editable: (row: Row, ctx: { isNew: boolean }) =>
              ctx.isNew && (typeof c.editable === 'function' ? c.editable(row, ctx) : c.editable !== false),
          }
        : c,
    )
  const viewRows = s.viewIds ? s.rows.filter((r) => s.viewIds!.has(idOf(r))) : s.rows
  // Görünen satırların sorunları (FormGrid'in `collectIssues` biçiminde): sunucu hatası, yoksa anahtar tekrarı, yoksa
  // istemci kuralı.
  const ids = columns.map((c) => c.id)
  const issues: GridIssues = { cells: new Map(), rows: new Map(), order: [], errorRows: 0 }
  viewRows.forEach((row, r) => {
    const server = s.errors.get(idOf(row))
    const mapped = server?.size
      ? mapErrors(Object.fromEntries([...server].map(([p, m]) => [p ? `0.${p}` : '0', m])), ids)
      : null
    const rowMessages = mapped?.rows.get(0) ?? []
    const client = clientOf(row)
    const dup = dupOf(row)
    if (!mapped && !client && !dup) return
    let found: Map<string, Issue> | undefined
    let error = false
    columns.forEach((def, c) => {
      const messages = [...(c === 0 ? rowMessages : []), ...(mapped?.cells.get(0)?.get(def.id) ?? [])]
      const issue = messages.length
        ? ({ level: 'error', message: messages.join('\n') } as Issue)
        : ((def.id === key ? dup : undefined) ?? client?.get(def.id))
      if (!issue) return
      ;(found ??= new Map()).set(def.id, issue)
      if (issue.level === 'error') {
        error = true
        issues.order.push({ row: r, col: c })
      }
    })
    if (found) issues.cells.set(r, found)
    if (rowMessages.length) issues.rows.set(r, rowMessages)
    if (error || rowMessages.length) issues.errorRows++
  })

  const fieldIds = new Set(fields.map((d) => d.id))
  const cellMark = (index: number, column: string) => {
    const row = viewRows[index]
    if (!row || !fieldIds.has(column)) return undefined
    const base = s.base.get(idOf(row))
    if (!base) return column === key ? 'is-new' : undefined
    return base !== row && !same(readPath(row, column), readPath(base, column)) ? 'is-changed' : undefined
  }
  const rowMark = (index: number) => {
    const row = viewRows[index]
    if (!row) return undefined
    const changed = changedOf(row)
    return !changed ? 'new' : changed.length ? 'changed' : undefined
  }

  const onRowsChange = (next: Row[], change: { cells: Array<{ row: number; column: string }> }) =>
    setState((p) => {
      const rows = p.viewIds ? mergeView(p.rows, p.viewIds, next, idOf) : next
      // Çoğaltılan satır daraltılmış görünümde de görünür kalır.
      const viewIds = p.viewIds && new Set([...p.viewIds, ...next.map(idOf)])
      // Kullanıcı hücreyi düzenleyince o hücrenin sunucu hatası kalkar (Vue 07 §14).
      let errors = p.errors
      for (const c of change.cells) {
        const id = next[c.row] && idOf(next[c.row]!)
        const m = id ? errors.get(id) : undefined
        if (!m || ![...m.keys()].some((k) => k === c.column || k.startsWith(`${c.column}.`))) continue
        if (errors === p.errors) errors = new Map(errors)
        const copy = new Map([...m].filter(([k]) => k !== c.column && !k.startsWith(`${c.column}.`)))
        if (copy.size) errors.set(id!, copy)
        else errors.delete(id!)
      }
      let { no, next: n } = p
      for (const row of rows) {
        const id = idOf(row)
        if (no.has(id)) continue
        if (no === p.no) no = new Map(no)
        no.set(id, n++)
      }
      return { ...p, rows, viewIds, errors, no, next: n, result: null }
    })

  // `focusNewRow`: odak ızgarada değilken ızgara aktif hücreyi DOM'da odaklamaz; hücre burada odaklanır.
  const root = useRef<HTMLDivElement>(null)
  // Izgara az önce görünür olduysa (uygulama boş hâlde gizliyordu) gizli öğeye focus() sessizce düşer ve satırlar
  // sonraki karede çizilir: odak bir sonraki karede verilir, hücre yoksa birkaç kare beklenir.
  const focusCell = (pos: { row: number; col: number }) => {
    store.focus(pos)
    const go = (tries: number) => {
      const el = root.current?.querySelector<HTMLElement>(`.dt-cell[data-row="${pos.row}"][data-col="${pos.col}"]`)
      if (!el) return void (tries && requestAnimationFrame(() => go(tries - 1)))
      el.focus({ preventScroll: true })
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
    requestAnimationFrame(() => go(3))
  }

  useLayoutEffect(() => {
    if (!s.focusNew || readOnly) return
    focusCell({
      row: viewRows.length,
      col: Math.max(
        0,
        columns.findIndex((c) => c.id !== key),
      ),
    })
    setState((p) => ({ ...p, focusNew: false }))
  })

  const autoFocused = useRef(false)
  useLayoutEffect(() => {
    if (!autoFocus || autoFocused.current || readOnly) return
    // Kullanıcı ızgaraya girdiyse açılış odağı işini kaybetti: boş açılan tabloda ilk satır doğunca odağı geri çekmez.
    if (store.active()) return void (autoFocused.current = true)
    if (!viewRows.length) return
    autoFocused.current = true
    const col = columns.findIndex((_, c) => store.canEdit(0, c))
    if (col >= 0) focusCell({ row: 0, col })
  })

  // Kayıt hatalı bitince Hatalılar görünümünde ilk hataya gidilir (Vue 07 §14).
  useLayoutEffect(() => {
    if (!s.focusError) return
    const first = issues.order[0]
    if (first) store.focus(first)
    setState((p) => ({ ...p, focusError: false }))
  })

  const onKeyDown = (e: KeyboardEvent) => {
    if ((mac ? e.metaKey : e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault()
      sheet.save()
    }
  }

  const closeConfirm = (open: boolean) => !open && setState((p) => ({ ...p, confirm: null }))
  const maxRows = options.maxRows ?? MAX_ROWS

  return (
    <div ref={root} className="dt-data-sheet" onKeyDown={onKeyDown}>
      {readOnly ? (
        <SheetGrid
          readOnly
          rows={viewRows}
          columns={columns}
          label={label}
          getRowId={idOf}
          newRow={newRow}
          // Daraltılmış görünümde boş satır yok: yeni satır Tümü'de eklenir.
          maxRows={s.viewIds ? viewRows.length : maxRows}
          density={density}
          frame={frame}
          store={store}
          isNew={isNew}
          issues={issues}
          cellMark={cellMark}
          rowMark={rowMark}
          rowNo={(i) => s.no.get(idOf(viewRows[i]!)) ?? i + 1}
          removeLabel={() => t('sheet.menu.remove')}
          labels={sheet.internal.labels}
        />
      ) : (
        <SheetGrid
          onRowsChange={onRowsChange}
          rows={viewRows}
          columns={columns}
          label={label}
          getRowId={idOf}
          newRow={newRow}
          // Daraltılmış görünümde boş satır yok: yeni satır Tümü'de eklenir.
          maxRows={s.viewIds ? viewRows.length : maxRows}
          density={density}
          frame={frame}
          store={store}
          isNew={isNew}
          issues={issues}
          cellMark={cellMark}
          rowMark={rowMark}
          rowNo={(i) => s.no.get(idOf(viewRows[i]!)) ?? i + 1}
          removeLabel={() => t('sheet.menu.remove')}
          labels={sheet.internal.labels}
        />
      )}
      {s.columnsOpen && (
        <Suspense fallback={null}>
          <ColumnsDialog
            open
            onOpenChange={(open) => !open && setState((p) => ({ ...p, columnsOpen: false }))}
            pinnable={false}
            columns={ordered.map((def) => ({
              id: def.id,
              def,
              visible: !s.hidden.has(def.id),
              pinned: null,
              canHide: def.required !== true,
              // Anahtar satırları tanıtır: başta kilitli durur, gizlenmez.
              fixed: def.id === key,
            }))}
            onSave={({ order, visible }) =>
              setState((p) => ({
                ...p,
                order,
                hidden: new Set(order.filter((id) => !visible.includes(id))),
              }))
            }
            finalFocus={opener}
          />
        </Suspense>
      )}
      {s.importing && (
        <ImportDialog
          columns={columns}
          rows={s.rows}
          keyColumn={key}
          maxRows={maxRows}
          store={store}
          labels={sheet.internal.labels}
          onClose={(result) => {
            s.importing!(result)
            setState((p) => ({ ...p, importing: null }))
          }}
        />
      )}
      <ConfirmDialog
        open={s.confirm === 'errors'}
        onOpenChange={closeConfirm}
        title={t('sheet.errDialog.title', { count: blocked })}
        body={t('sheet.errDialog.body')}
        cancelLabel={t('sheet.errDialog.fix')}
        onCancel={() => {
          sheet.setView('errors')
          setState((p) => ({ ...p, focusError: true }))
        }}
        // Hata sunucudan gelmiş olabilir: kullanıcının düzeltecek bir şeyi yoksa da yeniden gönderebilir.
        confirmLabel={t('sheet.errDialog.save')}
        onConfirm={() => void run(sheet.internal.changes)}
      />
      <ConfirmDialog
        open={s.confirm === 'discard'}
        onOpenChange={closeConfirm}
        title={t('sheet.discard.title', { cells: fmt.int(cells), rows: fmt.int(changes.length) })}
        body={t('sheet.discard.body')}
        cancelLabel={t('sheet.discard.keep')}
        confirmLabel={t('sheet.leave.discard')}
        danger
        onConfirm={sheet.reset}
      />
    </div>
  )
}
