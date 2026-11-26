// DataSheet'in durumu (docs/data-sheet.md §1, §4, §5): taban (yüklenen + kaydedilen satırlar), taslak satır listesi,
// sunucu hataları, kalıcı satır no ve kayıt ilerlemesi. Hücre motoru FormGrid'inki; depo burada kurulur, ızgara onu
// kullanır. Uygulamanın `rows` dizisine dokunulmaz.
import { useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import type { ColumnDef } from '../types/columns'
import type {
  DataSheetOptions,
  SheetChangeRow,
  SheetChanges,
  SheetExportOptions,
  SheetImportResult,
  SheetRowResult,
  SheetView,
} from '../types/data-sheet'
import { RemoteLabels } from '../core/cells/remote-labels'
import { exportFile } from '../core/export/write'
import { getFormat } from '../core/format'
import { isEmptyValue } from '../core/cells/format'
import { readPath } from '../core/columns/read-path'
import { useDataTableContext } from '../core/provider'
import { createSheetStore, same, writePath, type SheetStore } from '../core/sheet/store'
import { cellIssue, type Issue } from '../core/sheet/validate'
import { useParseEnv } from '../core/sheet/cell-editor'
import { resolveImport, toFileCell } from './import/apply'

/** Izgaranın varsayılan satır sınırı (`DataSheetOptions.maxRows`). */
export const MAX_ROWS = 10_000

/** Yeni satırın paketteki kimliği; uygulamanın alanlarına karışmaz (spread taşır, JSON yazmaz). */
const NEW = Symbol('dt-new-row')
let seq = 0

export interface SaveSummary {
  created: number
  updated: number
  failed: number
}

export interface SheetState<Row extends object> {
  /** Son görülen `options.rows`: değişince tabana katılır. */
  source: Row[]
  rows: Row[]
  base: Map<string, Row>
  /** Sunucu hataları: satır kimliği → alan yolu ('' satırın) → mesajlar. */
  errors: Map<string, Map<string, string[]>>
  no: Map<string, number>
  next: number
  hidden: Set<string>
  /** Sütunların sırası (Sütunlar penceresi); başta tanımların sırası. */
  order: string[]
  columnsOpen: boolean
  view: SheetView
  /** Daraltılmış görünümün satırları; seçildiği anın fotoğrafı (düzelen satır imlecin altından kaçmaz, Vue 07 §11). */
  viewIds: Set<string> | null
  saving: { total: number; done: number } | null
  /** Son kaydın sonucu; sonraki değişiklikte kalkar. */
  result: SaveSummary | null
  /** Açık onay penceresi (bileşen çizer). */
  confirm: 'errors' | 'discard' | null
  /** Kayıt hatalı bitti: bileşen ilk hatalı hücreye gider. */
  focusError: boolean
  /** `focusNewRow`: bileşen alttaki boş satıra gider. */
  focusNew: boolean
  /** İçe aktarma penceresi açık; kapanınca sonuçla çözülür. */
  importing: ((result: SheetImportResult | null) => void) | null
}

export interface DataSheetInstance<Row extends object> {
  /** Kaydedilmemiş değişiklik var (ayrılma koruması uygulamanın). */
  isDirty: boolean
  /** Şu anki değişiklikler (Kaydet'in teslim edeceği yük; hatalı satırlar dahil). */
  getChanges: () => SheetChanges<Row>
  /** Uygulama her parçanın cevabıyla çağırır (data-sheet.md §5). */
  applyResult: (results: Array<SheetRowResult<Row>>) => void
  /** Bütün satırlar tabana döner; onay sormaz. */
  reset: () => void
  // Araç çubuğu uygulamanındır (data-sheet.md §2): durum ve komutlar.
  view: SheetView
  setView: (view: SheetView) => void
  /** Görünümlerin satır sayıları. */
  counts: Record<SheetView, number>
  /** Değişiklik özeti: satır, hücre (yeni satırda dolu hücre), yeni satır. */
  summary: { rows: number; cells: number; newRows: number }
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  /** ⌘S ile aynı: hatalı satır varsa önce sorar, onayda yalnız hatasızları `onSave`'e verir. */
  save: () => void
  /** Onay sorup taslağı tabana döndürür. */
  discard: () => void
  /** Kayıt sürüyor: `applyResult` ile gelen satır sayısı. */
  saving: { total: number; done: number } | null
  /** Son kaydın sonucu; sonraki değişiklikte kalkar. */
  result: SaveSummary | null
  /** Telefon, yükleme ya da kayıt: düzenleme kapalı. */
  readOnly: boolean
  /** Telefonda salt okunur (D14); açılışta karar verilir. */
  phone: boolean
  /**
   * Liste tablosunun Sütunlar penceresini açar: göster / gizle ve sıra. Anahtar başta kilitli, `required` gizlenemez;
   * sabitleme yoktur (ızgara yalnız ilk sütunu sabitler). Düzen oturumludur.
   */
  openColumns: () => void
  /**
   * Tümü görünümüne geçer ve imleci alttaki boş satırın anahtardan sonraki ilk sütununa koyar (Ad): yazınca yeni
   * satır olur. Uygulamanın "Boş satır ekle"si.
   */
  focusNewRow: () => void
  /**
   * İçe aktarma penceresini açar (Tümü görünümüne geçer). Uygulanınca sonuçla, vazgeçilince null ile çözülür; dosya
   * yalnız tabloyu doldurur, kayıt Kaydet'tedir.
   */
  importFile: () => Promise<SheetImportResult | null>
  /**
   * Uygulamanın getirdiği kayıtları dosya gibi içe aktarır (başka sistemden aktarım): kayıt sütun kimliğiyle yazılır
   * (`{ code, title }`), değer dosya hücresi gibi çözülür, eşleme penceredekiyle aynıdır (anahtar, `remote.match`,
   * yalnız görünen alan sütunları, `addNew` varsayılan açık). Tümü görünümüne geçer; tek geri al adımıdır. Izgara
   * kilitliyse null; `maxRows` aşılırsa hiçbir şey yazılmaz, söz reddedilir.
   */
  importRows: (
    records: ReadonlyArray<Record<string, unknown>>,
    o?: { addNew?: boolean },
  ) => Promise<SheetImportResult | null>
  /** Görünen sütunları taslak değerlerle yazar (liste tablosunun yazıcısı). */
  exportFile: (o: SheetExportOptions) => Promise<void>
  /** @internal DataSheet bileşeni için. */
  readonly internal: SheetInternals<Row>
}

export interface SheetInternals<Row extends object> {
  options: DataSheetOptions<Row>
  state: SheetState<Row>
  setState: (fn: (s: SheetState<Row>) => SheetState<Row>) => void
  store: SheetStore<Row>
  idOf: (row: Row) => string
  newRow: (rows: readonly Row[]) => Partial<Row>
  /** Değerle yazılan alan sütunları (accessor'lı ve `editable: false` olanlar gönderilmez). */
  fields: Array<ColumnDef<Row>>
  /** Satırın tabandan farklı alanları; yeni satırda null. */
  changedOf: (row: Row) => string[] | null
  changes: Array<SheetChangeRow<Row>>
  cells: number
  isNew: (row: Row) => boolean
  /** Satırın istemci kuralı sorunları (önbellekli). */
  clientOf: (row: Row) => Map<string, Issue> | null
  dupOf: (row: Row) => Issue | undefined
  /** Hatalı olduğu için gönderilmeyecek değişen satır sayısı ve gönderilecekler. */
  blocked: number
  run: (send: Array<SheetChangeRow<Row>>) => Promise<void>
  labels: RemoteLabels
  /** Sütun tanımları pencerenin sırasıyla, gizliler dahil. */
  ordered: Array<ColumnDef<Row>>
  /** Sütunlar penceresini açan öğe: kapanınca odak ona döner. */
  opener: RefObject<HTMLElement | null>
}

const isField = <Row extends object>(def: ColumnDef<Row>) => !def.accessor && def.editable !== false

function numbered<Row extends object>(s: SheetState<Row>, ids: Iterable<string>) {
  let { no, next } = s
  for (const id of ids)
    if (!no.has(id)) {
      if (no === s.no) no = new Map(no)
      no.set(id, next++)
    }
  return no === s.no ? s : { ...s, no, next }
}

/**
 * Daraltılmış görünümün yeni listesini bütün listeye yerleştirir: görünümün satırları sırayla eski yerlerine, fazlası
 * (çoğaltılan, geri alınan) sona; çıkarılan satırın yeri kapanır.
 */
export function mergeView<Row>(all: Row[], viewIds: Set<string>, next: Row[], idOf: (row: Row) => string): Row[] {
  const out: Row[] = []
  let k = 0
  for (const row of all) {
    if (!viewIds.has(idOf(row))) out.push(row)
    else if (k < next.length) out.push(next[k++]!)
  }
  while (k < next.length) out.push(next[k++]!)
  return out
}

export function useDataSheet<Row extends object>(options: DataSheetOptions<Row>): DataSheetInstance<Row> {
  const idOf = (row: Row) => (row as { [NEW]?: string })[NEW] ?? options.getRowId(row)
  const newRow = (rows: readonly Row[]) =>
    ({ ...options.newRow?.(rows), [NEW]: `new-${++seq}` }) as unknown as Partial<Row>
  const [state, setState] = useState<SheetState<Row>>(() => {
    const base = new Map(options.rows.map((r) => [options.getRowId(r), r]))
    return {
      source: options.rows,
      rows: options.rows,
      base,
      errors: new Map(),
      no: new Map([...base.keys()].map((id, i) => [id, i + 1])),
      next: base.size + 1,
      hidden: new Set(options.columns.filter((c) => c.hidden).map((c) => c.id)),
      order: options.columns.map((c) => c.id),
      columnsOpen: false,
      view: 'all',
      viewIds: null,
      saving: null,
      result: null,
      confirm: null,
      focusError: false,
      focusNew: false,
      importing: null,
    }
  })
  const [labels] = useState(() => new RemoteLabels())
  const opener = useRef<HTMLElement | null>(null)
  const [store] = useState(() =>
    createSheetStore<Row>({ rows: state.rows, columns: options.columns, onRowsChange: () => {} }),
  )

  // Uygulama `rows`'u yeniledi (sayfa sayfa yükleme, kayıttan sonra tazeleme): tabana katılır, taslaklar kalır.
  let s = state
  if (options.rows !== s.source) {
    const base = new Map(s.base)
    const at = new Map(s.rows.map((r, i) => [idOf(r), i]))
    const rows = [...s.rows]
    for (const row of options.rows) {
      const id = options.getRowId(row)
      const old = base.get(id)
      base.set(id, row)
      const i = at.get(id)
      // Değiştirilmemiş satır yenisiyle değişir; değiştirilmiş satırın taslağı yeni tabanın üstünde kalır.
      if (i !== undefined) {
        if (rows[i] === old) rows[i] = row
      } else if (!old) rows.push(row)
    }
    s = numbered({ ...s, source: options.rows, base, rows }, base.keys())
    setState(s)
  }

  const fields = options.columns.filter(isField)
  const changedOf = (row: Row): string[] | null => {
    const base = s.base.get(idOf(row))
    if (!base) return null
    if (base === row) return []
    return fields.filter((d) => !same(readPath(row, d.id), readPath(base, d.id))).map((d) => d.id)
  }

  const changes: Array<SheetChangeRow<Row>> = []
  let cells = 0
  let newRows = 0
  for (const row of s.rows) {
    const changed = changedOf(row)
    if (changed && !changed.length) continue
    const isNew = !changed
    let values = {} as Partial<Row>
    let filled = 0
    for (const def of fields) {
      const value = readPath(row, def.id)
      // Gizli sütun değiştirilmiş olsa da gitmez (karar, 2026-11-27): gönderilen, kullanıcının gördüğüdür.
      if (isNew && !isEmptyValue(value)) filled++
      if (s.hidden.has(def.id) || (isNew && isEmptyValue(value))) continue
      values = writePath(values, def.id, value)
    }
    if (isNew) {
      newRows++
      cells += filled
    } else cells += changed.length
    changes.push({ id: idOf(row), isNew, key: readPath(row, options.keyColumn), values, row })
  }

  const getChanges = () => ({ rows: changes })

  const applyResult = (results: Array<SheetRowResult<Row>>) =>
    setState((s) => {
      const rows = [...s.rows]
      const at = new Map(rows.map((r, i) => [idOf(r), i]))
      const base = new Map(s.base)
      const errors = new Map(s.errors)
      const no = new Map(s.no)
      const sum = { ...(s.result ?? { created: 0, updated: 0, failed: 0 }) }
      for (const r of results) {
        const i = at.get(r.id)
        if (i === undefined) continue
        if (r.status === 'error') {
          const map = new Map<string, string[]>()
          for (const [path, m] of Object.entries(r.fieldErrors ?? {})) map.set(path, Array.isArray(m) ? m : [m])
          if (r.rowError) map.set('', [r.rowError])
          errors.set(r.id, map)
          sum.failed++
          continue
        }
        // Sunucunun satırı tabandır (boş anahtarla açılan satırın kodu böyle gelir); yoksa taslağın kendisi.
        // Uygulama sunucunun satırını taslaktan yayarak kurarsa yeni satır işareti de gelir: kalırsa satır yeni sayılırdı.
        let saved = rows[i]!
        if (r.row) {
          saved = { ...r.row }
          delete (saved as { [NEW]?: string })[NEW]
        }
        const id = r.row ? options.getRowId(r.row) : r.id
        rows[i] = saved
        base.set(id, saved)
        errors.delete(r.id)
        if (id !== r.id) {
          no.set(id, no.get(r.id) ?? s.next)
          no.delete(r.id)
        }
        sum[r.status]++
      }
      const saving = s.saving && { ...s.saving, done: Math.min(s.saving.total, s.saving.done + results.length) }
      return { ...s, rows, base, errors, no, saving, result: sum }
    })

  const reset = () => {
    store.clearHistory()
    setState((s) => ({ ...s, rows: [...s.base.values()], errors: new Map(), view: 'all', viewIds: null, result: null }))
  }

  // Telefonda salt okunur (D14); karar açılışta verilir, pencere sonradan daralınca düzenleme kapanmaz.
  const [phone] = useState(
    () => typeof matchMedia === 'function' && (matchMedia('(pointer: coarse)').matches || innerWidth < 768),
  )
  const readOnly = phone || !!options.loading || !!s.saving

  // İstemci kuralları satır nesnesine göre önbellekte: hücre onayı yalnız değişen satırı yeniden doğrular (Vue 07 §18).
  // `validate`'in `rows`'u satır son değiştiğindeki listedir.
  const { i18n, locale } = useDataTableContext()
  const parseEnv = useParseEnv()
  const isNew = (row: Row) => !s.base.has(idOf(row))
  const [cache, setCache] = useState(() => ({ locale, map: new WeakMap<Row, Map<string, Issue> | null>() }))
  if (cache.locale !== locale) setCache({ locale, map: new WeakMap() })
  const clientOf = (row: Row) => {
    let found = cache.map.get(row)
    if (found !== undefined) return found
    found = null
    for (const def of options.columns) {
      const value = def.accessor ? def.accessor(row) : readPath(row, def.id)
      const issue = cellIssue(def, value, { row, rows: s.rows, isNew: isNew(row) }, i18n)
      if (issue) (found ??= new Map()).set(def.id, issue)
    }
    cache.map.set(row, found)
    return found
  }

  // Aynı anahtar listede bir kez (Vue 07 §9); boş anahtar seriden numara alır, sayılmaz.
  const key = options.keyColumn
  // Sonradan gelen sütun (özel alanlar geç yüklenir) sırada yoksa sona eklenir.
  const rank = (def: ColumnDef<Row>) => {
    const i = s.order.indexOf(def.id)
    return i < 0 ? s.order.length + options.columns.indexOf(def) : i
  }
  const ordered = [...options.columns].sort((a, b) => rank(a) - rank(b))
  const byKey = new Map<string, string[]>()
  for (const row of s.rows) {
    const v = readPath(row, key)
    if (isEmptyValue(v)) continue
    const list = byKey.get(String(v))
    if (list) list.push(idOf(row))
    else byKey.set(String(v), [idOf(row)])
  }
  const dupOf = (row: Row): Issue | undefined => {
    const v = readPath(row, key)
    const ids = isEmptyValue(v) ? undefined : byKey.get(String(v))
    if (!ids || ids.length < 2) return undefined
    const other = ids.find((id) => id !== idOf(row))!
    return { level: 'error', message: i18n.t('sheet.duplicateKey', { key: String(v), row: s.no.get(other) ?? '' }) }
  }

  const errorIds = new Set<string>()
  for (const row of s.rows) {
    const id = idOf(row)
    if (s.errors.get(id)?.size || dupOf(row) || [...(clientOf(row)?.values() ?? [])].some((i) => i.level === 'error'))
      errorIds.add(id)
  }

  const snapshot = (view: SheetView, p: SheetState<Row>): Set<string> | null => {
    if (view === 'all') return null
    if (view === 'changed') return new Set(changes.map((c) => c.id))
    return new Set([...errorIds, ...p.errors.keys()])
  }
  const setView = (view: SheetView) => setState((p) => ({ ...p, view, viewIds: snapshot(view, p) }))

  const run = async (send: Array<SheetChangeRow<Row>>) => {
    if (!send.length) return
    setState((p) => ({ ...p, saving: { total: send.length, done: 0 }, result: { created: 0, updated: 0, failed: 0 } }))
    try {
      await options.onSave({ rows: send })
    } catch {
      // Taşıma hatası uygulamanın mesajıdır; sonuç gelmeyen satırlar taslak kalır.
    }
    store.clearHistory()
    setState((p) => {
      // Kayıttan sonra Hatalılar görünümünde ilk hataya gidilir (Vue 07 §14).
      if (!p.result?.failed) return { ...p, saving: null }
      return { ...p, saving: null, view: 'errors', viewIds: snapshot('errors', p), focusError: true }
    })
  }

  const blocked = changes.filter((c) => errorIds.has(c.id)).length
  const save = () => {
    if (readOnly || !changes.length) return
    if (blocked) setState((p) => ({ ...p, confirm: 'errors' }))
    else void run(changes)
  }

  const canUndo = useSyncExternalStore(store.subscribe, store.canUndo)
  const canRedo = useSyncExternalStore(store.subscribe, store.canRedo)

  return {
    isDirty: changes.length > 0,
    getChanges,
    applyResult,
    reset,
    view: s.view,
    setView,
    counts: { all: s.rows.length, changed: changes.length, errors: errorIds.size },
    summary: { rows: changes.length, cells, newRows },
    canUndo: canUndo && !readOnly,
    canRedo: canRedo && !readOnly,
    undo: () => !readOnly && store.undo(),
    redo: () => !readOnly && store.redo(),
    save,
    discard: () => changes.length > 0 && !readOnly && setState((p) => ({ ...p, confirm: 'discard' })),
    saving: s.saving,
    result: s.result,
    readOnly,
    phone,
    focusNewRow: () => setState((p) => ({ ...p, view: 'all', viewIds: null, focusNew: true })),
    openColumns: () => {
      // Pencere kapanınca odak açan düğmeye döner; düğme uygulamanın çubuğundadır.
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setState((p) => ({ ...p, columnsOpen: true }))
    },
    importFile: () =>
      new Promise<SheetImportResult | null>((resolve) => {
        if (readOnly) return resolve(null)
        setState((p) => ({ ...p, view: 'all', viewIds: null, importing: resolve }))
      }),
    importRows: async (records, { addNew = true } = {}) => {
      if (readOnly) return null
      // Penceredeki alan listesi: görünen, değerle yazılan, pencere editörü olmayan sütunlar (store'un sırası).
      const shown = ordered.filter((c) => !s.hidden.has(c.id))
      const mapping = shown.flatMap((c, i) => (!c.accessor && c.editable !== false && !c.editor?.window ? [i] : []))
      const plan = await resolveImport({
        data: records.map((r) => mapping.map((i) => toFileCell(readPath(r, shown[i]!.id)))),
        mapping,
        columns: shown,
        rows: s.rows,
        keyColumn: key,
        addNew,
        labels,
        env: parseEnv,
      })
      if (s.rows.length + plan.added > (options.maxRows ?? MAX_ROWS)) throw new Error('maxRows')
      setState((p) => ({ ...p, view: 'all', viewIds: null }))
      if (plan.cells.length && !store.importCells(plan.cells)) return null
      return { updated: plan.updated, added: plan.added }
    },
    exportFile: ({ format, name, columns = 'visible' }) =>
      exportFile({
        format,
        name,
        columns: columns === 'all' ? ordered : ordered.filter((c) => !s.hidden.has(c.id)),
        rows: s.rows,
        read: (row, def) => (def.accessor ? def.accessor(row) : readPath(row, def.id)),
        env: { fmt: getFormat(locale), i18n, today: new Date(), labels },
      }),
    internal: {
      labels,
      ordered,
      opener,
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
      blocked,
      run,
    },
  }
}
