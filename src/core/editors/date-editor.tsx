// Tarih editörü (04 §3, T2-04): `within` → solda hazır aralıklar + Custom range, sağda aralık takvimi; `eq/before/after` →
// Today + tek takvim. Hazır aralık tıklanınca uygulanır ve kapanır; özel aralıkta ikinci uç seçilince. Hafta başı yerel ayardan.
// Takvim react-day-picker (R10); başlık ve gün düğmesi Vue paketindeki reka takviminin sınıf ve nitelikleriyle çizilir, böylece
// filters.css aynen geçerli. Ay, gün adı ve okunuşlar Intl'den. Tembel yüklenir (FilterChip): takvim çekirdek pakete girmez.
import { CaretLeftIcon, CaretRightIcon, CheckIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { DayPicker, useDayPicker, type DayButtonProps, type MonthCaptionProps } from 'react-day-picker'
import type { DatePreset, FilterOp } from '../../types/query'
import { isoDay, weekStart } from '../filters/model'
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
const ordered = (a: Date, b: Date) => (a <= b ? { from: a, to: b } : { from: b, to: a })

/** Ay başlığı: ‹ Ay Yıl ›, reka takvimindeki `.dt-cal-head` düzeni. */
function Caption({ calendarMonth }: MonthCaptionProps) {
  const { i18n, locale } = useDataTableContext()
  const { goToMonth, previousMonth, nextMonth } = useDayPicker()
  return (
    <div className="dt-cal-head">
      <button
        type="button"
        className="dt-icon-btn-sm"
        aria-label={i18n.t('page.previous')}
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
      >
        <CaretLeftIcon size={16} aria-hidden="true" />
      </button>
      <span className="dt-cal-title">
        {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(calendarMonth.date)}
      </span>
      <button
        type="button"
        className="dt-icon-btn-sm"
        aria-label={i18n.t('page.next')}
        disabled={!nextMonth}
        onClick={() => nextMonth && goToMonth(nextMonth)}
      >
        <CaretRightIcon size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

/** Gün düğmesi: durumlar reka adlarıyla (`data-selected`, `data-selection-start` …). */
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
      data-highlighted={on('dtPreview')}
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
  onChange: (value: unknown) => void
  onDone: () => void
}) {
  const { i18n, locale } = useDataTableContext()
  const range = op === 'within'
  const obj = value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  const preset = typeof obj?.preset === 'string' ? obj.preset : undefined
  const from = dayOf(obj?.from)
  const to = dayOf(obj?.to)
  const single = dayOf(value)
  const [custom, setCustom] = useState(false)
  // Özel aralıkta ilk uç seçildi, ikincisi bekleniyor; fare ya da odak önizleme aralığını çizer.
  const [anchor, setAnchor] = useState<Date | null>(null)
  const [hover, setHover] = useState<Date | null>(null)

  const pick = (v: unknown) => {
    onChange(v)
    onDone()
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
  const modifiers = range
    ? {
        dtStart: anchor ?? from,
        dtEnd: anchor ? undefined : to,
        dtPreview: anchor && hover ? ordered(anchor, hover) : undefined,
      }
    : {}
  const full = new Intl.DateTimeFormat(locale, { dateStyle: 'full' })
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
  const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: 'long' })
  const month = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
  const presetItem = (p: DatePreset, onClick: () => void, on = preset === p) => (
    <button
      key={p}
      type="button"
      className={on ? 'dt-pop-item dt-date-preset is-on' : 'dt-pop-item dt-date-preset'}
      onClick={onClick}
    >
      {i18n.t(`date.${p}`)}
      {on && <CheckIcon size={14} className="dt-pop-end" aria-hidden="true" />}
    </button>
  )

  return (
    <div className="dt-editor-date">
      <div className="dt-date-presets">
        {range ? (
          <>
            {PRESETS.map((p) =>
              presetItem(p, () => {
                setCustom(false)
                pick({ preset: p })
              }),
            )}
            <div className="dt-pop-sep" />
            <button
              type="button"
              className={
                custom || (!preset && from) ? 'dt-pop-item dt-date-preset is-on' : 'dt-pop-item dt-date-preset'
              }
              onClick={() => setCustom(true)}
            >
              {i18n.t('date.customRange')}
            </button>
          </>
        ) : (
          presetItem('today', () => pick({ preset: 'today' }))
        )}
      </div>
      <DayPicker
        classNames={{
          root: 'dt-calendar',
          month_grid: 'dt-cal-grid',
          weekday: 'dt-cal-dow',
          day: 'dt-cal-cell',
          day_button: 'dt-cal-day',
        }}
        components={{ MonthCaption: Caption, DayButton: Day }}
        {...selection}
        onSelect={() => {}}
        hideNavigation
        showOutsideDays
        weekStartsOn={(weekStart(locale) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6}
        defaultMonth={(range ? from : single) ?? new Date()}
        modifiers={modifiers}
        onDayClick={onDay}
        onDayMouseEnter={(d) => anchor && setHover(d)}
        onDayFocus={(d) => anchor && setHover(d)}
        formatters={{ formatWeekdayName: (d) => weekday.format(d) }}
        labels={{
          labelDayButton: (d) => full.format(d),
          labelGrid: (d) => month.format(d),
          labelWeekday: (d) => weekdayLong.format(d),
        }}
      />
    </div>
  )
}
