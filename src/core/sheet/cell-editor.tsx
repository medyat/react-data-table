// Hücre editörleri (form-grid.md §8, Vue 07 §5): hücrenin yerinde açılır; metin her tuşta çözümlenir ve depoya taslak
// olarak yazılır. Enter / Tab / Esc'i ızgara yönetir; açık liste ya da takvimdeyken tuş önce onlara gider (ızgara
// `aria-expanded` ve `defaultPrevented`'a bakar). Listeden ya da takvimden seçmek onaylar. Portallı içerik
// `dt-sheet-layer` taşır: oradaki tık ızgara dışı sayılmaz.
import { Combobox } from '@base-ui/react/combobox'
import { Popover } from '@base-ui/react/popover'
import { CalendarBlankIcon } from '@phosphor-icons/react'
import { lazy, Suspense, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { ColumnDef, OptionDef } from '../../types/columns'
import { decimalPlaces } from '../cells/format'
import { Badge } from '../cells/render-cell'
import { TYPE_SPECS } from '../cells/specs'
import { cleanNumber, plainNumber } from '../format/parse'
import { useDataTableContext } from '../provider'
import { fold, inputText, parseInput, type ParseEnv } from './parse'

const DateEditor = lazy(() => import('../editors/date-editor'))

export interface CellEditorProps<Row extends object> {
  def: ColumnDef<Row>
  row: Row | undefined
  /** Açılıştaki metin: yazarak açılışta yazılan harf, kaydırmayla yeniden çizilince son yazılan. */
  text: string | undefined
  value: unknown
  onDraft: (value: unknown, text: string) => void
  /** Listeden / takvimden seçim: taslağı yazıp onaylar; klavyeyle seçildiyse alt hücreye iner. */
  onPick: (value: unknown, down: boolean) => void
}

function useParseEnv(): ParseEnv {
  const { i18n, locale } = useDataTableContext()
  return {
    locale,
    today: new Date(),
    todayWord: i18n.t('date.today'),
    yesWord: i18n.t('common.yes'),
    noWord: i18n.t('common.no'),
  }
}

/** Editörün ilk metni; sayı yerel ondalıkla ("1200.5" tr'de 12005 okunurdu). */
function initialText(def: ColumnDef, value: unknown, locale: string): string {
  if (typeof value === 'number' && TYPE_SPECS[def.type].numeric) return plainNumber(locale, value)
  return inputText(def, value)
}

/** Odak editöre, imleç sonda (F2 ve yazarak açılış aynı: yazılan harften sonra devam edilir). */
function focusEnd(el: HTMLInputElement | HTMLTextAreaElement | null) {
  if (!el) return
  el.focus({ preventScroll: true })
  el.setSelectionRange(el.value.length, el.value.length)
}

export function CellEditor<Row extends object>(props: CellEditorProps<Row>) {
  const { def } = props
  if (def.type === 'select') return <OptionCell {...props} options={def.options} />
  if (def.type === 'date') return <DateCell {...props} />
  if (def.type === 'text') return <TextCell {...props} />
  return <InputCell {...props} />
}

function InputCell<Row extends object>({ def, row, text: start, value, onDraft }: CellEditorProps<Row>) {
  const env = useParseEnv()
  const numeric = TYPE_SPECS[def.type].numeric
  const clean = (t: string) => (numeric ? cleanNumber(env.locale, t, decimalPlaces(def) === 0) : t)
  const [text, setText] = useState(() => clean(start ?? initialText(def, value, env.locale)))
  const el = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const change = (t: string) => {
    setText(t)
    onDraft(parseInput(def, t, env), t)
  }
  useLayoutEffect(() => {
    focusEnd(el.current)
    // Yazarak açılışta taslak ham harftir; çözümlenmiş hali yazılır.
    if (start !== undefined) onDraft(parseInput(def, text, env), text)
    // Yalnız açılışta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currency =
    def.type === 'currency' ? (typeof def.currency === 'function' ? row && def.currency(row) : def.currency) : null
  const suffix = def.type === 'percentage' ? '%' : currency
  return (
    <span className={numeric ? 'dt-cell-editor is-number' : 'dt-cell-editor'}>
      <input
        ref={el}
        className={numeric ? 'dt-cell-input is-right' : 'dt-cell-input'}
        type="text"
        inputMode={numeric ? 'decimal' : undefined}
        autoComplete="off"
        value={text}
        aria-label={def.header}
        onChange={(e) => change(clean(e.target.value))}
      />
      {suffix && (
        <span className="dt-ccy" aria-hidden="true">
          {suffix}
        </span>
      )}
    </span>
  )
}

function OptionCell<Row extends object>({
  def,
  text: start,
  value,
  options,
  onDraft,
  onPick,
}: CellEditorProps<Row> & { options: OptionDef[] }) {
  const { i18n } = useDataTableContext()
  const env = useParseEnv()
  const [text, setText] = useState(() => start ?? inputText(def, value))
  const [open, setOpen] = useState(true)
  const input = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => {
    focusEnd(input.current)
    if (start !== undefined) onDraft(parseInput(def, start, env), start)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Yazılanla süzülür (İ/ı ve büyük/küçük harf duyarsız); değer eşleşen etiketi gösterirken liste tam kalır.
  const needle = fold(text, env.locale)
  const shown =
    text === inputText(def, value) ? options : options.filter((o) => fold(o.label, env.locale).includes(needle))
  return (
    <Combobox.Root<unknown>
      open={open}
      onOpenChange={setOpen}
      value={value ?? null}
      onValueChange={(v, details) => {
        if (v === null || v === undefined) return
        onPick(v, details.event instanceof globalThis.KeyboardEvent)
      }}
      inputValue={text}
      onInputValueChange={(t, details) => {
        // Seçim etiketi input'a kendisi yazar; yalnız kullanıcının yazdığı taslağa gider.
        if (details.reason !== 'input-change') return
        setText(t)
        setOpen(true)
        onDraft(parseInput(def, t, env), t)
      }}
      items={shown}
      itemToStringLabel={(v) => inputText(def, v)}
      filter={null}
      autoHighlight
    >
      <Combobox.Input ref={input} className="dt-cell-input" aria-label={def.header} autoComplete="off" />
      <Combobox.Portal>
        <Combobox.Positioner className="dt-positioner" align="end" sideOffset={2} anchor={input}>
          <Combobox.Popup className="dt-pop dt-cell-list dt-sheet-layer" aria-label={def.header}>
            <Combobox.List>
              {shown.map((o) => (
                <Combobox.Item key={String(o.value)} value={o.value} className="dt-pop-item dt-cell-option">
                  <Badge tone={o.tone} label={o.label} />
                  <kbd className="dt-kbd dt-cell-option-enter" aria-hidden="true">
                    ↵
                  </kbd>
                </Combobox.Item>
              ))}
            </Combobox.List>
            {shown.length === 0 && <div className="dt-options-empty">{i18n.t('remote.noResults')}</div>}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}

function DateCell<Row extends object>({ def, text: start, value, onDraft, onPick }: CellEditorProps<Row>) {
  const { i18n } = useDataTableContext()
  const env = useParseEnv()
  const [text, setText] = useState(() => start ?? inputText(def, value))
  const [open, setOpen] = useState(false)
  const el = useRef<HTMLInputElement>(null)
  // Takvimden seçim onaylar ve editör kapanır: odak input'a değil hücreye döner. Esc ile kapanınca input'a.
  const picked = useRef(false)
  const draft = parseInput(def, text, env)
  useLayoutEffect(() => {
    focusEnd(el.current)
    if (start !== undefined) onDraft(draft, start)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const change = (t: string) => {
    setText(t)
    onDraft(parseInput(def, t, env), t)
  }
  // ⌥↓ takvimi açar (combobox'la aynı tuş); takvim açıkken tuşlar ona gider.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
    }
  }
  return (
    <span className="dt-cell-editor is-date">
      <input
        ref={el}
        className="dt-cell-input"
        type="text"
        autoComplete="off"
        value={text}
        aria-label={def.header}
        aria-expanded={open}
        onChange={(e) => change(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger className="dt-cell-editor-btn" tabIndex={-1} aria-label={i18n.t('type.date')}>
          <CalendarBlankIcon size={14} aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner className="dt-positioner" align="start" sideOffset={4} anchor={el}>
            <Popover.Popup
              className="dt-pop dt-chip-pop is-date dt-sheet-layer"
              finalFocus={() => (picked.current ? false : el.current)}
            >
              <Suspense>
                <DateEditor
                  op="eq"
                  value={typeof draft === 'string' ? draft : undefined}
                  onChange={(v) => {
                    picked.current = true
                    onPick(v, false)
                  }}
                  onDone={() => setOpen(false)}
                />
              </Suspense>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </span>
  )
}

/**
 * Uzun metin: hücre ilk satırı gösterir, metin hücrenin altında açılan kutuda yazılır (satırların üstüne taşmaz, dar
 * sütunda sıkışmaz; hücredeki ⤢ de bunu açar). Tuşlar ızgaranınki: Enter onaylar, ⇧↵ / ⌥↵ satır atlatır, Esc iptal.
 */
function TextCell<Row extends object>({ def, text: start, value, onDraft }: CellEditorProps<Row>) {
  const env = useParseEnv()
  const [text, setText] = useState(() => start ?? inputText(def, value))
  const cell = useRef<HTMLSpanElement>(null)
  const el = useRef<HTMLTextAreaElement>(null)
  const change = (t: string) => {
    setText(t)
    onDraft(parseInput(def, t, env), t)
  }
  // Kutu portalda, açılış animasyonundan sonra yerleşir: odak bir kare sonra.
  useLayoutEffect(() => {
    if (start !== undefined) onDraft(parseInput(def, start, env), start)
    const id = requestAnimationFrame(() => focusEnd(el.current))
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // ⇧↵ tarayıcının kendisiyle, ⌥↵ burada satır atlatır (Mac'te ⌥↵ textarea'ya satır yazmaz).
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || !e.altKey) return
    e.preventDefault()
    const t = e.currentTarget
    t.setRangeText('\n', t.selectionStart, t.selectionEnd, 'end')
    change(t.value)
  }
  return (
    <>
      <span ref={cell} className="dt-cell-content">
        {text.split('\n')[0]}
      </span>
      <Popover.Root open>
        <Popover.Portal>
          <Popover.Positioner
            className="dt-positioner"
            align="start"
            sideOffset={2}
            anchor={() => cell.current?.closest('.dt-cell') ?? null}
          >
            <Popover.Popup className="dt-pop dt-text-pop dt-sheet-layer" initialFocus={false} finalFocus={false}>
              <textarea
                ref={el}
                className="dt-text-pop-input"
                value={text}
                aria-label={def.header}
                rows={5}
                onChange={(e) => change(e.target.value)}
                onKeyDown={onKeyDown}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </>
  )
}
