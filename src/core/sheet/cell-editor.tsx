// Hücre editörleri (form-grid.md §8, Vue 07 §5): hücrenin yerinde açılır; metin her tuşta çözümlenir ve depoya taslak
// olarak yazılır. Enter / Tab / Esc'i ızgara yönetir; açık liste ya da takvimdeyken tuş önce onlara gider (ızgara
// `aria-expanded` ve `defaultPrevented`'a bakar). Listeden ya da takvimden seçmek onaylar. Portallı içerik
// `dt-sheet-layer` taşır: oradaki tık ızgara dışı sayılmaz.
import { isDecimalType, isDecimalValue } from '../format/decimal'
import { Combobox } from '@base-ui/react/combobox'
import { Popover } from '@base-ui/react/popover'
import type { BaseUIEvent } from '@base-ui/react/types'
import { CalendarBlankIcon, PlusIcon, SpinnerGapIcon } from '@phosphor-icons/react'
import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type UIEvent,
} from 'react'
import type { ColumnDef, OptionDef } from '../../types/columns'
import { decimalPlaces, isEmptyValue } from '../cells/format'
import type { RemoteLabels } from '../cells/remote-labels'
import { Badge } from '../cells/render-cell'
import { useDelay } from '../interaction/use-delay'
import { TYPE_SPECS } from '../cells/specs'
import { cleanNumber, plainNumber } from '../format/parse'
import { useDataTableContext } from '../provider'
import {
  dateMask,
  fillMask,
  fold,
  inputText,
  maskText,
  parseDateInput,
  parseDateTimeInput,
  parseInput,
  type ParseEnv,
} from './parse'
import { columnName } from '../columns/column-name'

// Takvim ayrı parçadır: tarih editörü açılınca yüklenir, popover açılmadan hazırdır. `lazy` yüklüyken de ilk çizimde
// askıya alıp kutuyu boş açıyordu; yüklenmişse bileşen doğrudan çizilir.
let loadedDate: typeof import('../editors/date-editor').default | null = null
const loadDate = () => import('../editors/date-editor').then((m) => (loadedDate = m.default))
const LazyDate = lazy(() => loadDate().then((d) => ({ default: d })))

export interface CellEditorProps<Row extends object> {
  def: ColumnDef<Row>
  row: Row | undefined
  /** Bütün satırlar (`optionEnabled`). */
  rows: readonly Row[]
  /** `ajax` etiketleri: hücrenin gösterdiği ad ve aramanın döndürdüğü seçenekler (`onChange`'e gider). */
  labels: RemoteLabels
  /** Açılıştaki metin: yazarak açılışta yazılan harf, kaydırmayla yeniden çizilince son yazılan. */
  text: string | undefined
  value: unknown
  onDraft: (value: unknown, text: string) => void
  /** Listeden / takvimden seçim: taslağı yazıp onaylar; klavyeyle seçildiyse alt hücreye iner. */
  onPick: (value: unknown, down: boolean) => void
  /** `ajax` "yeni kayıt"tan dönen seçenek: editör o sırada kapanmış olabilir, yazma çağıranın işidir. */
  onCreated?: (value: unknown, option: OptionDef) => void
  /** Satır penceresinin alanı: açılışta odak almaz, liste kendiliğinden açılmaz, uzun metin yerinde yazılır. */
  field?: boolean
  /** Pencere alanı: etiketin bağlandığı id ve hata (`aria-invalid`). */
  id?: string
  invalid?: boolean
}

export function useParseEnv(): ParseEnv {
  const { i18n, locale } = useDataTableContext()
  return {
    locale,
    today: new Date(),
    todayWord: i18n.t('date.today'),
    yesWord: i18n.t('common.yes'),
    noWord: i18n.t('common.no'),
  }
}

/**
 * Editörün ilk metni: sayı ve ondalık metin yerel ondalıkla. Sunucunun metninde `.` her zaman ondalıktır; tahmin eden
 * temizleyiciye verilseydi "123.456" binlik sayılıp 123456 okunurdu.
 */
function initialText(def: ColumnDef, value: unknown, locale: string): string {
  if (typeof value === 'number' && TYPE_SPECS[def.type].numeric) return plainNumber(locale, value)
  if (isDecimalType(def.type) && isDecimalValue(value))
    return String(value).replace('.', plainNumber(locale, 0.5).replace(/\d/g, ''))
  return inputText(def, value)
}

/**
 * `select` / `ajax` hücresinde liste düzenlemeyle kendiliğinden açılır, ikisi tek şeydir: Esc listeyi kapatmakla
 * kalmaz, düzenlemeyi iptal eder (Excel gibi; Vue 07 §5'teki iki Esc'ten sapma, form-grid.md §8). Base UI Esc'i
 * kendisi işleyip yayılımı durdurur; onun işleyicisi atlanır, tuş ızgaraya gider.
 */
const escapeToGrid = (e: BaseUIEvent<KeyboardEvent<HTMLInputElement>>) => {
  if (e.key === 'Escape') e.preventBaseUIHandler()
}

/** Pencere alanında liste input'a değil çerçeveli kutuya bağlanır: kenarları ve genişliği kutuyla aynı olsun. */
const fieldBox = (input: HTMLElement | null): HTMLElement | null => input?.closest('.dt-rd-input') ?? input

/** Odak editöre, imleç sonda (F2 ve yazarak açılış aynı: yazılan harften sonra devam edilir). */
function focusEnd(el: HTMLInputElement | HTMLTextAreaElement | null) {
  if (!el) return
  el.focus({ preventScroll: true })
  el.setSelectionRange(el.value.length, el.value.length)
}

export function CellEditor<Row extends object>(props: CellEditorProps<Row>) {
  const { def } = props
  if (def.type === 'select') return <OptionCell {...props} options={def.options} />
  if (def.type === 'ajax') return <AjaxCell {...props} />
  if (def.type === 'date' || def.type === 'datetime') return <DateCell {...props} />
  if (def.type === 'text') return <TextCell {...props} />
  return <InputCell {...props} />
}

function InputCell<Row extends object>({
  def,
  row,
  text: start,
  value,
  onDraft,
  field,
  id,
  invalid,
}: CellEditorProps<Row>) {
  const env = useParseEnv()
  const numeric = TYPE_SPECS[def.type].numeric
  const clean = (t: string) => (numeric ? cleanNumber(env.locale, t, decimalPlaces(def) === 0) : t)
  const [text, setText] = useState(() => start ?? initialText(def, value, env.locale))
  const el = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const change = (t: string) => {
    setText(t)
    onDraft(parseInput(def, t, env), t)
  }
  useLayoutEffect(() => {
    if (!field) focusEnd(el.current)
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
        aria-label={columnName(def)}
        id={id}
        aria-invalid={invalid || undefined}
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
  row,
  rows,
  text: start,
  value,
  options,
  onDraft,
  onPick,
  field,
  id,
  invalid,
}: CellEditorProps<Row> & { options: OptionDef[] }) {
  const { i18n } = useDataTableContext()
  const env = useParseEnv()
  const [text, setText] = useState(() => start ?? inputText(def, value))
  const [open, setOpen] = useState(!field)
  const input = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => {
    if (!field) focusEnd(input.current)
    if (start !== undefined) onDraft(parseInput(def, start, env), start)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Yazılanla süzülür (İ/ı ve büyük/küçük harf duyarsız); F2 ya da tıkla açılınca kutuda değerin etiketi durur, liste
  // tam kalır. Yazıldı mı metinden çıkarılmaz: yazarak açılışta taslak değer ham harftir ("4"), etiketi de "4" okunur.
  const [typed, setTyped] = useState(start !== undefined)
  const needle = fold(text, env.locale)
  // Değerin tam yazımı da eşleşir (taksit 1 → Tek çekim), yapıştırmadaki gibi; değer parçası aranmaz (kod gürültüsü).
  const shown = typed
    ? options.filter((o) => fold(o.label, env.locale).includes(needle) || String(o.value) === text.trim())
    : options
  return (
    <Combobox.Root<unknown>
      open={open}
      onOpenChange={setOpen}
      value={value ?? null}
      onValueChange={(v, details) => {
        if (v === null || v === undefined) return
        // Pencere alanı açık kalır: kutuda seçilenin adı durur.
        if (field) setText(inputText(def, v))
        onPick(v, details.event instanceof globalThis.KeyboardEvent)
      }}
      inputValue={text}
      onInputValueChange={(t, details) => {
        // Seçim etiketi input'a kendisi yazar; yalnız kullanıcının yazdığı taslağa gider.
        if (details.reason !== 'input-change') return
        setText(t)
        setTyped(true)
        setOpen(true)
        onDraft(parseInput(def, t, env), t)
      }}
      items={shown}
      itemToStringLabel={(v) => inputText(def, v)}
      filter={null}
      // Yazarak açılışta ilk eşleşen hemen vurgulu: tek Enter seçer (yoksa Enter yalnız listeyi kapatırdı).
      // shortcut: ComboboxRoot tipi 'always'u gizler ama AriaCombobox'a iletir; Base UI yükselince test kırılırsa
      // onItemHighlighted + Enter'da ilk seçeneği seçmeye geçilir.
      autoHighlight={(typed ? 'always' : true) as boolean}
    >
      <Combobox.Input
        ref={input}
        className="dt-cell-input"
        aria-label={columnName(def)}
        id={id}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        onKeyDown={field ? undefined : escapeToGrid}
      />
      <Combobox.Portal>
        <Combobox.Positioner
          className="dt-positioner"
          align={field ? 'start' : 'end'}
          sideOffset={field ? 4 : 2}
          anchor={field ? () => fieldBox(input.current) : input}
        >
          <Combobox.Popup className="dt-pop dt-cell-list dt-sheet-layer" aria-label={columnName(def)}>
            <Combobox.List>
              {shown.map((o) => (
                <Combobox.Item
                  key={String(o.value)}
                  value={o.value}
                  className="dt-pop-item dt-cell-option"
                  disabled={!!def.optionEnabled && !def.optionEnabled(o, row ?? ({} as Row), rows)}
                >
                  {def.type === 'select' && def.display === 'text' ? (
                    <span>{o.label}</span>
                  ) : (
                    <Badge tone={o.tone} label={o.label} />
                  )}
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

/**
 * Sunucuda aranan seçenek (form-grid.md §3.2): yazdıkça 250 ms sonra arar, aramaya satırı da verir. Yazılan metin
 * değer değildir; listeden seçilene kadar hücre eski değerini korur (Enter listede bir şey yoksa değişiklik yapmaz).
 * Liste ekranda kalan yükseklikte kayar; sona bir liste boyu kala sonraki sayfa istenir.
 */
/** `ajax` listesinde "yeni kayıt" öğesinin değeri; hiçbir seçenekle çakışmaz. */
const CREATE = Symbol('create')

function AjaxCell<Row extends object>({
  def,
  row,
  labels,
  text: start,
  value,
  onPick,
  onCreated,
  field,
  id,
  invalid,
}: CellEditorProps<Row>) {
  const { i18n } = useDataTableContext()
  const { remote, Item } = def as Extract<ColumnDef<Row>, { type: 'ajax' }>
  const labelOf = (v: unknown) => (isEmptyValue(v) ? '' : labels.label(def.id, remote, v as string | number))
  const [text, setText] = useState(() => start ?? labelOf(value))
  // null: ilk sayfa aranıyor.
  const [found, setFound] = useState<{ items: OptionDef[]; hasMore: boolean; page: number } | null>(null)
  // Sonraki sayfa yolda: ref tekrar istemeyi önler (kaydırma olayları render'dan hızlı), state alttaki satırı çizer.
  const loadingMore = useRef(false)
  const [more, setMore] = useState(false)
  const query = useRef('')
  const [open, setOpen] = useState(!field)
  const input = useRef<HTMLInputElement>(null)
  const ctl = useRef<AbortController | null>(null)
  const delay = useDelay(250)
  const load = (q: string, page = 1) => {
    query.current = q
    ctl.current?.abort()
    const c = new AbortController()
    ctl.current = c
    remote
      .search(q, page, { signal: c.signal, row })
      .then((res) => {
        if (c.signal.aborted) return
        labels.seed(def.id, res.items)
        setFound((f) => ({
          items: page > 1 && f ? [...f.items, ...res.items] : res.items,
          hasMore: res.hasMore,
          page,
        }))
      })
      // Hata uygulamanındır (D18); ilk sayfada liste boş kalır, sonrakinde eldeki durur.
      .catch(() => !c.signal.aborted && page === 1 && setFound({ items: [], hasMore: false, page }))
      .finally(() => {
        if (c.signal.aborted) return
        loadingMore.current = false
        setMore(false)
      })
  }
  // Sona bir liste boyu kala sonraki sayfa: satırlar kullanıcı sona varmadan gelir, liste sonda çarpıp sıçramaz.
  const onScroll = (e: UIEvent<HTMLElement>) => {
    const el = e.currentTarget
    if (!found?.hasMore || loadingMore.current) return
    if (el.scrollTop + el.clientHeight < el.scrollHeight - el.clientHeight) return
    loadingMore.current = true
    setMore(true)
    load(query.current, found.page + 1)
  }
  useLayoutEffect(() => {
    if (!field) focusEnd(input.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    // Pencere alanında arama liste açılınca (yazınca ya da ok tuşuyla) başlar.
    if (!field) load(start ?? '')
    return () => ctl.current?.abort()
    // Açılışta bir kez; sonrası yazdıkça.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const items = found?.items ?? []
  // "Yeni kayıt" listenin son öğesi: ↓ ile ulaşılır (ızgarada Tab hücre değiştirir), altta yapışık durur.
  const creatable = !!remote.create && found !== null
  const create = () => {
    const typed = text.trim() === labelOf(value) ? '' : text.trim()
    setOpen(false)
    void remote.create?.(typed).then((option) => {
      if (!option) return
      labels.seed(def.id, [option])
      onCreated?.(option.value, option)
    })
  }
  return (
    <Combobox.Root<unknown>
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next && found === null) load('')
      }}
      value={value ?? null}
      onValueChange={(v, details) => {
        if (v === null || v === undefined) return
        if (v === CREATE) return create()
        if (field) setText(labelOf(v))
        onPick(v, details.event instanceof globalThis.KeyboardEvent)
      }}
      inputValue={text}
      onInputValueChange={(t, details) => {
        if (details.reason !== 'input-change') return
        setText(t)
        setOpen(true)
        setFound(null)
        delay.run(() => load(t))
      }}
      items={creatable ? [...items.map((o) => o.value), CREATE] : items.map((o) => o.value)}
      itemToStringLabel={(v) => (v === CREATE ? '' : labelOf(v))}
      filter={null}
      autoHighlight
    >
      <Combobox.Input
        ref={input}
        className="dt-cell-input"
        aria-label={columnName(def)}
        id={id}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        onKeyDown={field ? undefined : escapeToGrid}
      />
      <Combobox.Portal>
        <Combobox.Positioner
          className="dt-positioner"
          align="start"
          sideOffset={field ? 4 : 2}
          anchor={field ? () => fieldBox(input.current) : input}
        >
          <Combobox.Popup
            className="dt-pop dt-cell-list dt-sheet-layer"
            aria-label={columnName(def)}
            onScroll={onScroll}
          >
            <Combobox.List>
              {items.map((o) => (
                <Combobox.Item key={String(o.value)} value={o.value} className="dt-pop-item dt-cell-option">
                  {Item ? (
                    <Item option={o} search={text} />
                  ) : (
                    <span className="dt-cell-option-label">
                      {o.label}
                      {o.description && <span className="dt-cell-option-desc">{o.description}</span>}
                    </span>
                  )}
                  <kbd className="dt-kbd dt-cell-option-enter" aria-hidden="true">
                    ↵
                  </kbd>
                </Combobox.Item>
              ))}
            </Combobox.List>
            {found === null && <div className="dt-options-empty">{i18n.t('remote.searching')}</div>}
            {found?.items.length === 0 && <div className="dt-options-empty">{i18n.t('remote.noResults')}</div>}
            {more && (
              <div className="dt-cell-list-more" role="status" aria-label={i18n.t('common.loading')}>
                <SpinnerGapIcon size={16} className="dt-spin" aria-hidden="true" />
              </div>
            )}
            {creatable && (
              <Combobox.Item value={CREATE} className="dt-pop-item dt-cell-create">
                <PlusIcon size={16} aria-hidden="true" />
                {text.trim() && text.trim() !== labelOf(value)
                  ? i18n.t('remote.createWith', { text: text.trim() })
                  : i18n.t('remote.create')}
              </Combobox.Item>
            )}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}

const MASK_KEYS: Record<string, string> = {
  dd: 'maskDay',
  MM: 'maskMonth',
  yyyy: 'maskYear',
  HH: 'maskHour',
  mm: 'maskMinute',
}
function DateCell<Row extends object>({
  def,
  text: start,
  value,
  onDraft,
  onPick,
  field,
  id,
  invalid,
}: CellEditorProps<Row>) {
  const { i18n, locale } = useDataTableContext()
  const env = useParseEnv()
  // Elle yazım dilin kalıbıyla maskelenir; değer ve yapıştırma çözümleyicinin kurallarıyla kalır.
  const mask = dateMask(locale, def.type === 'datetime' ? 'datetime' : 'date')
  const pattern = mask.replace(/dd|MM|yyyy|HH|mm/g, (tok) => i18n.t(`sheet.${MASK_KEYS[tok]}`))
  const [text, setText] = useState(() => (start === undefined ? fillMask(mask, value) : maskText(start, mask)))
  const caret = useRef<number | null>(null)
  const hintId = useId()
  useEffect(() => void loadDate(), [])
  const Calendar = loadedDate ?? LazyDate
  const [open, setOpen] = useState(false)
  const el = useRef<HTMLInputElement>(null)
  // Takvimden seçim onaylar ve editör kapanır: odak input'a değil hücreye döner. Esc ile kapanınca input'a.
  const picked = useRef(false)
  const draft = parseInput(def, text, env)
  // Takvim yerel günle çalışır; tarih-saatte değer andır, gün ve saat editör metninden (yerel) okunur.
  const local = typeof draft === 'string' ? inputText(def, draft) : ''
  const day = local ? local.slice(0, 10) : undefined
  const clock = local.slice(11) || '00:00'
  useLayoutEffect(() => {
    if (!field) focusEnd(el.current)
    if (start !== undefined) onDraft(draft, text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useLayoutEffect(() => {
    if (caret.current === null) return
    el.current?.setSelectionRange(caret.current, caret.current)
    caret.current = null
  }, [text])
  const change = (t: string) => {
    setText(t)
    onDraft(parseInput(def, t, env), t)
  }
  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    const kind = (e.nativeEvent as InputEvent).inputType ?? ''
    // Yapıştırılan metin süzülmez: Excel'in "Nov 24, 2026"'sı çözümleyicinin kurallarıyla okunur.
    if (kind === 'insertFromPaste') return change(e.target.value)
    const raw = e.target.value
    const digitsOf = (s: string) => s.replace(/\D/g, '')
    let digits = digitsOf(raw)
    let pos = digitsOf(raw.slice(0, e.target.selectionStart ?? raw.length)).length
    // Silinen ayraçsa maske onu geri koyardı: yerine silme yönündeki rakam gider.
    if (kind.startsWith('delete') && digits.length === digitsOf(text).length) {
      const drop = kind === 'deleteContentBackward' ? pos - 1 : pos
      if (drop >= 0 && drop < digits.length) {
        digits = digits.slice(0, drop) + digits.slice(drop + 1)
        pos = drop
      }
    }
    const next = maskText(digits, mask)
    let at = 0
    for (let n = 0; n < pos && at < next.length; at++) if (/\d/.test(next[at]!)) n++
    caret.current = at
    change(next)
  }
  const when = def.type === 'datetime' ? parseDateTimeInput(text, env) : parseDateInput(text, env)
  const hint = when
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: 'full',
        timeStyle: def.type === 'datetime' ? 'short' : undefined,
      }).format(def.type === 'datetime' ? new Date(when) : new Date(`${when}T00:00`))
    : i18n.t('sheet.dateHint', { pattern })
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
        placeholder={pattern}
        aria-label={columnName(def)}
        aria-describedby={field ? undefined : hintId}
        id={id}
        aria-invalid={invalid || undefined}
        aria-expanded={open}
        onChange={onInput}
        onKeyDown={onKeyDown}
      />
      {/* Yazılanın nasıl anlaşıldığı; ızgarada hücrenin üstünde, takvim açıkken gizli. */}
      {!field && !open && text && (
        <span id={hintId} className="dt-cell-tip is-warning dt-date-hint">
          {hint}
        </span>
      )}
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
                <Calendar
                  op="eq"
                  value={day}
                  onChange={(v) => {
                    // Tarih-saatte gün seçimi saati korur ve editör açık kalır: saat yazılabilsin.
                    if (def.type === 'datetime') return change(fillMask(mask, parseDateTimeInput(`${v} ${clock}`, env)))
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
function TextCell<Row extends object>(props: CellEditorProps<Row>) {
  return props.field ? <TextField {...props} /> : <TextPop {...props} />
}

function TextField<Row extends object>({ def, value, onDraft, id, invalid }: CellEditorProps<Row>) {
  const env = useParseEnv()
  const [text, setText] = useState(() => inputText(def, value))
  return (
    <textarea
      className="dt-rd-textarea"
      value={text}
      aria-label={columnName(def)}
      id={id}
      aria-invalid={invalid || undefined}
      rows={3}
      onChange={(e) => {
        setText(e.target.value)
        onDraft(parseInput(def, e.target.value, env), e.target.value)
      }}
    />
  )
}

function TextPop<Row extends object>({ def, text: start, value, onDraft }: CellEditorProps<Row>) {
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
                aria-label={columnName(def)}
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
