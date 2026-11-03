// Filtre modeli (04 §1–3, 03 · Operatör anahtarları): tipe göre operatörler ve varsayılan, değer şekli (operatör değişiminde
// koruma kuralı), eksik çip, hazır tarih aralıkları, istemci modu eşleme ve çip değer özeti. Framework'ten bağımsız; Vue paketindekiyle aynı.
import type { ColumnDef, ColumnType } from '../../types/columns'
import type { Plural } from '../../types/core'
import type { DatePreset, FilterCondition, FilterOp } from '../../types/query'
import type { I18n } from '../i18n'
import type { Format } from '../format'

const EMPTY: FilterOp[] = ['is_empty', 'is_not_empty']
const NUMBER: FilterOp[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', ...EMPTY]
const TEXT: FilterOp[] = ['contains', 'not_contains', 'eq', 'neq', 'starts_with', 'ends_with', ...EMPTY]
const LIST: FilterOp[] = ['in', 'not_in', ...EMPTY]
const DATE: FilterOp[] = ['within', 'eq', 'before', 'after', ...EMPTY]
const CASED: FilterOp[] = ['contains', 'eq', 'neq', 'starts_with', ...EMPTY]

/** Tipe göre operatör listesi (03, brief §6.5); `filter.operators` alt küme seçebilir. */
export const OPERATORS: Record<ColumnType, FilterOp[]> = {
  int: NUMBER,
  float: NUMBER,
  percentage: ['eq', 'gt', 'gte', 'lt', 'lte', 'between', ...EMPTY],
  star: ['gte', 'lte', 'eq', ...EMPTY],
  currency: NUMBER,
  string: TEXT,
  text: ['contains', 'not_contains', ...EMPTY],
  uppercase: CASED,
  lowercase: CASED,
  phone: ['contains', 'starts_with', ...EMPTY],
  color: LIST,
  email: ['contains', 'eq', 'ends_with', ...EMPTY],
  url: ['contains', ...EMPTY],
  id: ['in', 'contains', ...EMPTY],
  boolean: ['eq', ...EMPTY],
  select: LIST,
  multiselect: LIST,
  ajax: LIST,
  user: LIST,
  date: DATE,
  datetime: DATE,
  object: [],
  array: ['contains', ...EMPTY],
}

const DEFAULT_OP: Partial<Record<ColumnType, FilterOp>> = {
  int: 'between',
  float: 'between',
  percentage: 'between',
  currency: 'between',
  star: 'gte',
  id: 'in',
  boolean: 'eq',
  date: 'within',
  datetime: 'within',
}

export const operatorsOf = (def: ColumnDef): FilterOp[] => def.filter?.operators ?? OPERATORS[def.type]
export const defaultOperator = (def: ColumnDef): FilterOp =>
  def.filter?.defaultOperator ?? DEFAULT_OP[def.type] ?? operatorsOf(def)[0] ?? 'is_empty'

/** Değerin şekli: operatör değişiminde değer yalnızca aynı şekilde korunur (04 §3 · Uygulama zamanı). */
export type Shape = 'none' | 'text' | 'number' | 'range' | 'list' | 'date' | 'dateRange' | 'boolean'
export function shapeOf(op: FilterOp, type: ColumnType): Shape {
  if (op === 'is_empty' || op === 'is_not_empty') return 'none'
  if (op === 'in' || op === 'not_in') return 'list'
  if (op === 'between') return 'range'
  if (op === 'within') return 'dateRange'
  if (op === 'before' || op === 'after' || type === 'date' || type === 'datetime') return 'date'
  if (type === 'boolean') return 'boolean'
  if (op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte') return 'number'
  if (type === 'int' || type === 'float' || type === 'percentage' || type === 'currency' || type === 'star')
    return 'number'
  return 'text'
}

/** Ekrandaki çip: değeri henüz seçilmemiş olabilir (eksik çip sorguya girmez). */
/** Çip editörü (FilterChip ve telefon Filters sayfası): liste şekli `id`'de metin (yapıştırılan liste), diğerlerinde seçenek listesi. */
export type Editor = 'options' | 'text' | 'number' | 'star' | 'date' | null
export function editorOf(op: FilterOp, type: ColumnType): Editor {
  const s = shapeOf(op, type)
  if (s === 'none' || s === 'boolean') return null
  if (s === 'list') return type === 'id' ? 'text' : 'options'
  if (s === 'text') return 'text'
  if (s === 'date' || s === 'dateRange') return 'date'
  return type === 'star' ? 'star' : 'number'
}

export interface Chip {
  column: string
  op: FilterOp
  value?: unknown
  currency?: string
}

export type DateValue = string | { preset: 'today' }
export type DateRangeValue = { preset: DatePreset } | { from: string; to: string }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'

export function isComplete(chip: Chip, type: ColumnType): boolean {
  const v = chip.value
  switch (shapeOf(chip.op, type)) {
    case 'none':
      return true
    case 'list':
      return Array.isArray(v) && v.length > 0
    case 'range':
      return Array.isArray(v) && ((v[0] !== null && v[0] !== undefined) || (v[1] !== null && v[1] !== undefined))
    case 'text':
      return typeof v === 'string' && v !== ''
    case 'number':
      return typeof v === 'number' && Number.isFinite(v)
    case 'boolean':
      return typeof v === 'boolean'
    case 'date':
      return (typeof v === 'string' && v !== '') || (isObj(v) && v.preset === 'today')
    case 'dateRange':
      return isObj(v) && (typeof v.preset === 'string' || (typeof v.from === 'string' && typeof v.to === 'string'))
  }
}

export function toCondition(chip: Chip): FilterCondition {
  const out: Record<string, unknown> = { column: chip.column, op: chip.op }
  if (chip.value !== undefined && shapeOf(chip.op, 'string') !== 'none') out.value = chip.value
  if (chip.currency) out.currency = chip.currency
  return out as FilterCondition
}

export function changeOperator(chip: Chip, op: FilterOp, type: ColumnType): Chip {
  const shape = shapeOf(op, type)
  const keep = shape !== 'none' && shape === shapeOf(chip.op, type)
  return { ...chip, op, value: keep ? chip.value : undefined }
}

/** Operatör etiketi (03): `in`/`not_in` değer sayısına göre tekil/çoğul; `star`'da gte/lte "at least / at most". */
export function opLabel(i18n: I18n, op: FilterOp, type: ColumnType, valueCount = 1): string {
  if (op === 'in' || op === 'not_in') return i18n.t(`op.${op}`, { count: Math.max(1, valueCount) })
  if (type === 'star' && (op === 'gte' || op === 'lte')) return i18n.t(`op.star.${op}`)
  return i18n.t(`op.${op}`)
}

/* ---------- tarih ---------- */

export interface IsoRange {
  from: string | null
  to: string | null
}
export const isoDay = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
/** Haftanın ilk günü (1 = Pazartesi … 7 = Pazar) yerel ayardan (`Intl.Locale` weekInfo); desteklenmeyen tarayıcıda Pazartesi. */
export const weekStart = (locale: string): number => {
  try {
    const l = new Intl.Locale(locale) as unknown as {
      getWeekInfo?: () => { firstDay: number }
      weekInfo?: { firstDay: number }
    }
    return l.getWeekInfo?.().firstDay ?? l.weekInfo?.firstDay ?? 1
  } catch {
    return 1
  }
}

/** Hazır aralık → ISO gün aralığı (uçlar dahil). Hafta başı yerel ayardan (tr/en-GB Pazartesi, en-US Pazar). Yerel takvim, saf Date. */
export function resolvePreset(preset: DatePreset, locale: string, now = new Date()): IsoRange {
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (preset) {
    case 'today':
      return { from: isoDay(t), to: isoDay(t) }
    case 'this_week': {
      const diff = (t.getDay() - (weekStart(locale) % 7) + 7) % 7
      const start = addDays(t, -diff)
      return { from: isoDay(start), to: isoDay(addDays(start, 6)) }
    }
    case 'next_7_days':
      return { from: isoDay(t), to: isoDay(addDays(t, 7)) }
    case 'this_month':
      return {
        from: isoDay(new Date(t.getFullYear(), t.getMonth(), 1)),
        to: isoDay(new Date(t.getFullYear(), t.getMonth() + 1, 0)),
      }
    case 'last_30_days':
      return { from: isoDay(addDays(t, -30)), to: isoDay(t) }
    case 'this_quarter': {
      const qm = Math.floor(t.getMonth() / 3) * 3
      return { from: isoDay(new Date(t.getFullYear(), qm, 1)), to: isoDay(new Date(t.getFullYear(), qm + 3, 0)) }
    }
    case 'overdue':
      return { from: null, to: isoDay(addDays(t, -1)) }
  }
}

const dayOf = (v: unknown): string | null => {
  if (v instanceof Date) return isoDay(v)
  if (typeof v === 'string' && v.length >= 10) return v.slice(0, 10)
  return null
}
const dateArg = (v: DateValue, now: Date): string => (typeof v === 'string' ? v.slice(0, 10) : isoDay(now))

/* ---------- istemci modu eşleme ---------- */

const isEmptyVal = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
const lower = (v: unknown, locale: string) => String(v).toLocaleLowerCase(locale)

/** Tek koşul, tek hücre değeri (04 §1 değer biçimleri). `'@me'` istemcide çözülemez: eşleşmez. */
export function matches(cond: FilterCondition, cell: unknown, env: { locale: string; now?: Date }): boolean {
  const now = env.now ?? new Date()
  switch (cond.op) {
    case 'is_empty':
      return isEmptyVal(cell)
    case 'is_not_empty':
      return !isEmptyVal(cell)
  }
  if (isEmptyVal(cell)) return false
  switch (cond.op) {
    case 'eq':
    case 'neq': {
      const day = dayOf(cell)
      const hit =
        typeof cond.value === 'string' && day && /^\d{4}-\d{2}-\d{2}/.test(cond.value)
          ? day === cond.value.slice(0, 10)
          : typeof cell === 'string' && typeof cond.value === 'string'
            ? lower(cell, env.locale) === lower(cond.value, env.locale)
            : cell === cond.value || String(cell) === String(cond.value)
      return cond.op === 'eq' ? hit : !hit
    }
    case 'gt':
      return Number(cell) > cond.value
    case 'gte':
      return Number(cell) >= cond.value
    case 'lt':
      return Number(cell) < cond.value
    case 'lte':
      return Number(cell) <= cond.value
    case 'between': {
      const n = Number(cell)
      const [min, max] = cond.value
      return (min === null || n >= min) && (max === null || n <= max)
    }
    case 'contains':
    case 'not_contains':
    case 'starts_with':
    case 'ends_with': {
      const needle = lower(cond.value, env.locale)
      const items = Array.isArray(cell) ? cell : [cell]
      const hit = items.some((item) => {
        const s = lower(item, env.locale)
        return cond.op === 'starts_with'
          ? s.startsWith(needle)
          : cond.op === 'ends_with'
            ? s.endsWith(needle)
            : s.includes(needle)
      })
      return cond.op === 'not_contains' ? !hit : hit
    }
    case 'in':
    case 'not_in': {
      const wanted = new Set(cond.value.map(String))
      const items = Array.isArray(cell) ? cell : [cell]
      const hit = items.some((item) => wanted.has(String(item)))
      return cond.op === 'in' ? hit : !hit
    }
    case 'before':
      return (dayOf(cell) ?? '') < dateArg(cond.value, now)
    case 'after':
      return (dayOf(cell) ?? '') > dateArg(cond.value, now)
    case 'within': {
      const day = dayOf(cell)
      if (!day) return false
      const r = 'preset' in cond.value ? resolvePreset(cond.value.preset, env.locale, now) : cond.value
      return (r.from === null || day >= r.from) && (r.to === null || day <= r.to)
    }
  }
}

/* ---------- çip özeti (04 §3 · Değer özeti) ---------- */

export interface SummaryEnv {
  i18n: I18n
  fmt: Format
  /** Seçenek/kişi değeri → etiket (select, user, ajax). */
  labelOf: (value: string | number) => string
  today?: Date
}
export interface Summary {
  /** Çipte görünen metin; boş operatörlerde ''. */
  text: string
  /** Tooltip'teki tam metin (kısaltıldıysa). */
  full?: string
  /** Kişi filtrelerinde avatar yığını için. */
  people?: Array<{ value: string | number; label: string }>
}

const shortNum = (fmt: Format, n: number) =>
  Math.abs(n) >= 1000 ? fmt.compact(n) : fmt.decimal(n, Number.isInteger(n) ? 0 : 2)

export function summarize(chip: Chip, def: ColumnDef, env: SummaryEnv): Summary {
  const { i18n, fmt } = env
  const type = def.type
  const v = chip.value
  const unit = type === 'percentage' ? '%' : chip.currency ? ` ${chip.currency}` : ''
  const num = (n: number) => `${shortNum(fmt, n)}${unit}`
  switch (shapeOf(chip.op, type)) {
    case 'none':
      return { text: '' }
    case 'boolean':
      return { text: i18n.t(v ? 'common.yes' : 'common.no') }
    case 'number':
      return { text: typeof v === 'number' ? num(v) : '' }
    case 'text':
      return typeof v === 'string' && v ? { text: `“${v}”`, full: v } : { text: '' }
    case 'range': {
      if (!Array.isArray(v)) return { text: '' }
      const [min, max] = v as [number | null, number | null]
      if (min !== null && min !== undefined && max !== null && max !== undefined)
        return { text: `${shortNum(fmt, min)} – ${num(max)}` }
      if (min !== null && min !== undefined) return { text: `≥ ${num(min)}` }
      if (max !== null && max !== undefined) return { text: `≤ ${num(max)}` }
      return { text: '' }
    }
    case 'date': {
      if (typeof v === 'string' && v) return { text: fmt.date(v, env.today) }
      if (isObj(v) && v.preset === 'today') return { text: i18n.t('date.today') }
      return { text: '' }
    }
    case 'dateRange': {
      if (!isObj(v)) return { text: '' }
      if (typeof v.preset === 'string') return { text: i18n.t(`date.${v.preset}`) }
      const from = String(v.from)
      const to = String(v.to)
      const sameMonth = from.slice(0, 7) === to.slice(0, 7)
      const toText = sameMonth ? String(Number(to.slice(8, 10))) : fmt.date(to, env.today)
      return { text: `${fmt.date(from, env.today)} – ${toText}` }
    }
    case 'list': {
      const values = Array.isArray(v) ? (v as Array<string | number>) : []
      if (values.length === 0) return { text: '' }
      const labels = values.map((x) => (x === '@me' ? i18n.t('common.me') : env.labelOf(x)))
      if (type === 'user') {
        const people = values.map((value, i) => ({ value, label: labels[i]! }))
        return {
          text: values.length === 1 ? labels[0]! : i18n.t('chip.people', { count: values.length }),
          full: labels.join(', '),
          people,
        }
      }
      if (values.length <= 2) return { text: labels.join(', '), full: labels.join(', ') }
      const noun = def.filterNoun as Plural | undefined
      return {
        text: noun
          ? i18n.t('chip.noun', { count: values.length, noun })
          : i18n.t('chip.values', { count: values.length }),
        full: labels.join(', '),
      }
    }
  }
}
