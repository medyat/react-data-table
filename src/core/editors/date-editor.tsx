// Tarih editörü (04 §3, T2-04): `within` → solda hazır aralıklar, sağda aralık takvimi; `eq/before/after` → bugün, dün,
// evvelsi gün, yarın, öbür gün + tek takvim. Hazır tıklanınca uygulanır ve kapanır; takvimde aralık ikinci uç seçilince. Hafta başı yerel ayardan.
// Vue'dan sapma: hazır aralık göreli kalmaz, seçildiği günün tarihleriyle yazılır (çip ve görünüm sabit tarih taşır);
// başlangıcı olmayan Overdue `before <bugün>` olur. Custom range düğmesi yok: takvim her zaman aralık seçer.
// Takvim react-day-picker (R10); gün düğmesi Vue paketindeki reka takviminin nitelikleriyle çizilir. Başlık editörün:
// tıklanınca gün → ay → yıl ızgarası açılır (hızlı gezinme), seçim bir alt görünüme döner. Izgara gizlenen gün takviminin
// üstüne oturur, popover boyu oynamaz. Ay, gün adı ve okunuşlar Intl'den. Tembel yüklenir (FilterChip).
import { CaretDownIcon, CaretLeftIcon, CaretRightIcon, CheckIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { DayPicker, type DayButtonProps } from 'react-day-picker'
import type { DatePreset, FilterOp } from '../../types/query'
import { isoDay, resolvePreset, weekStart } from '../filters/model'
import { useDataTableContext } from '../provider'

const PRESETS: DatePreset[] = [
  'today',
  'this_week',
  'next_7_days',
  'this_month',
  'last_30_days',
  'this_quarter',
  'overdue',
]

/** 'Y-m-d' → yerel gün; `new Date(text)` UTC okur ve günü kaydırır. */
function dayOf(v: unknown): Date | undefined {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) return undefined
  const [y, m, d] = v.slice(0, 10).split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}
/** Tek gün hazırları: bugünden gün farkı; adları Intl'den (tr: bugün, dün, evvelsi gün, yarın, öbür gün). */
const DAY_OFFSETS = [0, -1, -2, 1, 2]
const ordered = (a: Date, b: Date) => (a <= b ? { from: a, to: b } : { from: b, to: a })

type View = 'days' | 'months' | 'years'
interface Cell {
  key: number
  label: string
  aria: string
  today: boolean
  selected: boolean
  pick: () => void
}

/** Ay ya da yıl ızgarası (3 × 4): oklar odağı taşır, Esc bir üst görünüme döner; açılınca seçili (yoksa bugünkü) hücre odakta. */
function PickGrid({ cells, onBack }: { cells: Cell[]; onBack: () => void }) {
  const focus = cells.find((c) => c.selected) ?? cells.find((c) => c.today) ?? cells[0]!
  const STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }
  return (
    <div
      className="dt-cal-pick"
      role="group"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          // Popover'ı kapatmasın: Esc önce görünümden çıkar.
          e.stopPropagation()
          return onBack()
        }
        const step = STEP[e.key]
        if (!step) return
        e.preventDefault()
        const buttons = [...e.currentTarget.querySelectorAll('button')]
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
        buttons[Math.min(buttons.length - 1, Math.max(0, i + step))]?.focus()
      }}
    >
      {cells.map((c) => (
        <button
          key={c.key}
          type="button"
          className="dt-cal-day"
          aria-label={c.aria}
          aria-pressed={c.selected}
          autoFocus={c === focus}
          data-today={c.today ? '' : undefined}
          data-selected={c.selected ? '' : undefined}
          onClick={c.pick}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

/** Gün düğmesi: durumlar reka adlarıyla (`data-selected`, `data-selection-start` …); aralık bandı hücrede (`is-band`). */
function Day({ day, modifiers, ...props }: DayButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)
  // Klavye gezinmesinde odak DayPicker'ın `focused` işaretiyle taşınır; özel düğme bunu kendisi yapar.
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])
  const on = (name: string) => (modifiers[name] ? '' : undefined)
  return (
    <button
      ref={ref}
      {...props}
      data-value={isoDay(day.date)}
      data-today={on('today')}
      data-outside-view={on('outside')}
      data-selected={on('selected')}
      data-selection-start={on('dtStart')}
      data-selection-end={on('dtEnd')}
    />
  )
}

export default function DateEditor({
  op,
  value,
  onChange,
  onDone,
}: {
  op: FilterOp
  value: unknown
  /** `op` yalnızca Overdue'da verilir: aralık `before`'a döner. */
  onChange: (value: unknown, op?: FilterOp) => void
  onDone: () => void
}) {
  const { i18n, locale } = useDataTableContext()
  const range = op === 'within'
  const obj = value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  const from = dayOf(obj?.from)
  const to = dayOf(obj?.to)
  const single = dayOf(value)
  // Özel aralıkta ilk uç seçildi, ikincisi bekleniyor; fare ya da odak önizleme aralığını çizer.
  const [anchor, setAnchor] = useState<Date | null>(null)
  const [hover, setHover] = useState<Date | null>(null)
  const [month, setMonth] = useState(() => {
    const d = (range ? from : single) ?? new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [view, setView] = useState<View>('days')
  const title = useRef<HTMLButtonElement>(null)

  const pick = (v: unknown, nextOp?: FilterOp) => {
    onChange(v, nextOp)
    onDone()
  }
  const now = new Date()
  const today = isoDay(now)
  const applyPreset = (p: DatePreset) => {
    const r = resolvePreset(p, locale)
    if (r.from === null) pick(today, 'before')
    else pick(r)
  }
  // Değer hazır aralığın bugünkü tarihleriyle aynıysa o aralık işaretli görünür.
  const presetOn = (p: DatePreset) => {
    const r = resolvePreset(p, locale)
    return r.from !== null && obj?.from === r.from && obj?.to === r.to
  }
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const dayAt = (n: number) => isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + n))
  const dayName = (n: number) => {
    const s = relative.format(n, 'day')
    return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1)
  }
  const onDay = (day: Date) => {
    if (!range) return pick(isoDay(day))
    if (!anchor) {
      setAnchor(day)
      setHover(day)
      return
    }
    const r = ordered(anchor, day)
    setAnchor(null)
    pick({ from: isoDay(r.from), to: isoDay(r.to) })
  }
  // Seçim `mode` ile verilir ki Tab takvimde seçili güne (yoksa bugüne) girsin; tıklamayı `onDayClick` yönetir, bu yüzden
  // `onSelect` boştur ve seçim tamamen kontrollüdür.
  const selection = range
    ? {
        mode: 'range' as const,
        selected: anchor ? { from: anchor, to: undefined } : from && to ? { from, to } : undefined,
      }
    : { mode: 'single' as const, selected: single }
  // Bant: kaydedilmiş aralık ya da ikinci uç beklenirken önizleme; hücreye çizilir ki günler arasında kesilmesin.
  const band = anchor && hover ? ordered(anchor, hover) : from && to ? { from, to } : undefined
  const modifiers = range
    ? {
        dtBand: band,
        dtStart: band?.from,
        dtEnd: band?.to,
      }
    : {}
  const full = new Intl.DateTimeFormat(locale, { dateStyle: 'full' })
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: 'long' })
  const monthFmt = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
  const y = month.getFullYear()
  const m = month.getMonth()
  const first = y - (y % 12)
  const shown = range ? from : single
  const shift = (n: number) =>
    setMonth(new Date(view === 'years' ? y + 12 * n : view === 'months' ? y + n : y, view === 'days' ? m + n : m, 1))
  const back = () => {
    setView(view === 'years' ? 'months' : 'days')
    title.current?.focus()
  }
  const monthShort = new Intl.DateTimeFormat(locale, { month: 'short' })
  const yearFmt = new Intl.DateTimeFormat(locale, { year: 'numeric' })
  const cells: Cell[] =
    view === 'months'
      ? Array.from({ length: 12 }, (_, i) => ({
          key: i,
          label: monthShort.format(new Date(y, i, 1)),
          aria: monthFmt.format(new Date(y, i, 1)),
          today: now.getFullYear() === y && now.getMonth() === i,
          selected: shown?.getFullYear() === y && shown.getMonth() === i,
          pick: () => {
            setMonth(new Date(y, i, 1))
            back()
          },
        }))
      : Array.from({ length: 12 }, (_, i) => ({
          key: first + i,
          label: yearFmt.format(new Date(first + i, 0, 1)),
          aria: yearFmt.format(new Date(first + i, 0, 1)),
          today: now.getFullYear() === first + i,
          selected: shown?.getFullYear() === first + i,
          pick: () => {
            setMonth(new Date(first + i, m, 1))
            setView('months')
          },
        }))
  const heading =
    view === 'days'
      ? monthFmt.format(new Date(y, m, 1))
      : view === 'months'
        ? yearFmt.format(new Date(y, 0, 1))
        : `${yearFmt.format(new Date(first, 0, 1))} – ${yearFmt.format(new Date(first + 11, 0, 1))}`
  const presetItem = (key: string, label: string, on: boolean, onClick: () => void) => (
    <button
      key={key}
      type="button"
      className={on ? 'dt-pop-item dt-date-preset is-on' : 'dt-pop-item dt-date-preset'}
      onClick={onClick}
    >
      {label}
      {on && <CheckIcon size={14} className="dt-pop-end" aria-hidden="true" />}
    </button>
  )

  return (
    <div className="dt-editor-date">
      <div className="dt-date-presets">
        {range
          ? PRESETS.map((p) => presetItem(p, i18n.t(`date.${p}`), presetOn(p), () => applyPreset(p)))
          : DAY_OFFSETS.map((n) => presetItem(String(n), dayName(n), value === dayAt(n), () => pick(dayAt(n))))}
      </div>
      <div className="dt-calendar">
        <div className="dt-cal-head">
          {view === 'years' ? (
            <span className="dt-cal-title">{heading}</span>
          ) : (
            <button
              ref={title}
              type="button"
              className="dt-cal-title"
              onClick={() => setView(view === 'days' ? 'months' : 'years')}
            >
              {heading}
              <CaretDownIcon size={12} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className="dt-icon-btn-sm"
            aria-label={i18n.t('page.previous')}
            onClick={() => shift(-1)}
          >
            <CaretLeftIcon size={16} aria-hidden="true" />
          </button>
          <button type="button" className="dt-icon-btn-sm" aria-label={i18n.t('page.next')} onClick={() => shift(1)}>
            <CaretRightIcon size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="dt-cal-body">
          <div className={view === 'days' ? undefined : 'dt-cal-hidden'} inert={view !== 'days'}>
            <DayPicker
              classNames={{
                root: 'dt-cal-days',
                month_grid: 'dt-cal-grid',
                weekday: 'dt-cal-dow',
                day: 'dt-cal-cell',
                day_button: 'dt-cal-day',
              }}
              modifiersClassNames={{ dtBand: 'is-band', dtStart: 'is-band-start', dtEnd: 'is-band-end' }}
              components={{ MonthCaption: () => <></>, DayButton: Day }}
              {...selection}
              onSelect={() => {}}
              hideNavigation
              showOutsideDays
              fixedWeeks
              weekStartsOn={(weekStart(locale) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6}
              month={month}
              onMonthChange={setMonth}
              modifiers={modifiers}
              onDayClick={onDay}
              onDayMouseEnter={(d) => anchor && setHover(d)}
              onDayFocus={(d) => anchor && setHover(d)}
              formatters={{ formatWeekdayName: (d) => weekday.format(d) }}
              labels={{
                labelDayButton: (d) => full.format(d),
                labelGrid: (d) => monthFmt.format(d),
                labelWeekday: (d) => weekdayLong.format(d),
              }}
            />
          </div>
          {view !== 'days' && <PickGrid key={view} cells={cells} onBack={back} />}
        </div>
      </div>
    </div>
  )
}
