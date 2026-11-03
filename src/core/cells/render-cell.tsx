// 23 tipin hücre içeriği (03, brief §5.1, T8). Kabuk (hizalama, kesme, yoğunluk, zemin) grid/row.tsx'te; burada yalnızca içerik.
import { ArrowUpRightIcon, ArrowsOutSimpleIcon, CheckIcon, MinusIcon, StarIcon, XIcon } from '@phosphor-icons/react'
import type { CSSProperties, ReactNode } from 'react'
import type { ColumnDef, IconComponent, OptionDef, UserOption } from '../../types/columns'
import type { Density, Tone } from '../../types/core'
import { currencyCode, formatArrayItem, formatCell, isEmptyValue, optionLabel, urlHost, type FormatEnv } from './format'

export interface RenderEnv extends FormatEnv {
  density: Density
  /** `pointer: coarse`: telefon numarası tel: linki olur. */
  coarse: boolean
}

type ToneRef = Tone | { light: string; dark: string } | undefined

const toneClass = (tone: ToneRef): string => (typeof tone === 'object' ? 'dt-tone-custom' : `dt-tone-${tone ?? 'gray'}`)
const toneStyle = (tone: ToneRef) =>
  typeof tone === 'object'
    ? ({ '--dt-tone-light': tone.light, '--dt-tone-dark': tone.dark } as CSSProperties)
    : undefined

/** Avatar rengi kişiye sabit: id hash'i → 6 tondan biri (02). */
const AVATAR_TONES: Tone[] = ['blue', 'green', 'amber', 'violet', 'pink', 'teal']
export function avatarTone(id: string | number): Tone {
  let hash = 0
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_TONES[hash % AVATAR_TONES.length]!
}
export const initialsOf = (label: string): string =>
  label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase())
    .join('')

export function Badge({ tone, label, icon: Icon }: { tone: ToneRef; label: string; icon?: IconComponent }) {
  return (
    <span className={`dt-badge ${toneClass(tone)}`} style={toneStyle(tone)}>
      {Icon ? (
        <Icon className="dt-badge-icon" size={11} weight="bold" aria-hidden="true" />
      ) : (
        <span className="dt-badge-dot" aria-hidden="true" />
      )}
      <span className="dt-badge-label">{label}</span>
    </span>
  )
}

const More = ({ count, tip, pill }: { count: number; tip: string; pill?: boolean }) => (
  <span className={pill ? 'dt-more dt-more-pill' : 'dt-more'} data-dt-tip={tip}>
    +{count}
  </span>
)
const Mono = ({ children }: { children: string }) => <span className="dt-mono">{children}</span>

export function Avatar({ user }: { user: Partial<UserOption> & { value: string | number; label: string } }) {
  return (
    <span
      className={`dt-avatar dt-tone-${avatarTone(user.value)}`}
      style={user.avatarUrl ? { backgroundImage: `url("${user.avatarUrl}")` } : undefined}
      aria-hidden="true"
    >
      {user.avatarUrl ? '' : (user.initials ?? initialsOf(user.label))}
    </span>
  )
}

function Stars({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <span className="dt-stars" role="img" aria-label={label} data-dt-tip={label}>
      {Array.from({ length: max }, (_, i) => (
        <StarIcon
          key={i}
          size={14}
          weight={i < value ? 'fill' : 'regular'}
          className={i < value ? 'is-on' : undefined}
        />
      ))}
    </span>
  )
}

function Bar({ pct, label }: { pct: number; label: string }) {
  return (
    <span className="dt-bar">
      <span className="dt-bar-track" aria-hidden="true">
        <span className="dt-bar-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </span>
      <span className="dt-bar-label">{label}</span>
    </span>
  )
}

const Link = ({ href, external, children }: { href: string; external?: boolean; children: ReactNode }) => (
  <a className="dt-link" href={href} {...(external && { target: '_blank', rel: 'noopener' })}>
    {children}
  </a>
)

/** `color` + `display: 'fill'`: hücre boyanır, yazı rengi kontrasta göre (03). */
export function cellFillStyle<Row extends object>(def: ColumnDef<Row>, value: unknown): CSSProperties | undefined {
  if (def.type !== 'color' || def.display !== 'fill' || typeof value !== 'string') return undefined
  const m = /^#?([0-9a-f]{6})$/i.exec(value)
  if (!m) return { background: value }
  const n = parseInt(m[1]!, 16)
  const lum = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
  return { background: value, color: lum > 0.55 ? 'var(--dt-fill-text-dark)' : 'var(--dt-fill-text-light)' }
}

function resolveUsers<Row extends object>(
  def: Extract<ColumnDef<Row>, { type: 'user' }>,
  ids: Array<string | number>,
  env: RenderEnv,
): UserOption[] {
  return ids.map((id) => {
    const o =
      def.options?.find((u) => u.value === id) ??
      (env.labels.option(def.id as string, def.remote, id) as UserOption | undefined)
    return o ?? { value: id, label: String(id) }
  })
}

const optionBadge = (options: OptionDef[], v: unknown) => {
  const opt = options.find((o) => o.value === v)
  return opt ? (
    <Badge key={String(v)} tone={opt.tone} label={opt.label} />
  ) : (
    <Badge key={String(v)} tone="gray" label={String(v)} />
  )
}

export function renderCellContent<Row extends object>(
  def: ColumnDef<Row>,
  row: Row,
  value: unknown,
  env: RenderEnv,
): ReactNode {
  const formatted = formatCell(def, row, value, env)
  if (def.cell) {
    // Tipli bağlam: `value` tipe göre daralır; burada tek yerde `unknown`dan geçilir.
    return (def.cell as (ctx: unknown) => ReactNode)({
      row,
      value,
      formatted,
      column: { id: def.id, type: def.type },
      density: env.density,
    })
  }
  if (isEmptyValue(value)) {
    if (def.type === 'user') {
      return (
        <span className="dt-user is-empty">
          <span className="dt-avatar is-empty" aria-hidden="true" />
          {env.i18n.t('common.unassigned')}
        </span>
      )
    }
    return <span className="dt-empty">{formatted}</span>
  }
  const { fmt, i18n } = env
  switch (def.type) {
    case 'int':
    case 'float':
    case 'string':
    case 'uppercase':
    case 'lowercase':
    case 'email':
      return formatted
    case 'percentage':
      return def.display === 'bar' ? <Bar pct={Number(value)} label={formatted} /> : formatted
    case 'star':
      return <Stars value={Number(value)} max={def.max ?? 5} label={formatted} />
    case 'currency':
      return (
        <>
          {fmt.decimal(Number(value), def.decimalPlaces ?? 2)}
          <span className="dt-ccy">{currencyCode(def, row)}</span>
        </>
      )
    case 'phone':
      return env.coarse ? <Link href={`tel:${formatted}`}>{formatted}</Link> : formatted
    case 'text':
      return (
        <span className="dt-text">
          <span className="dt-text-first">{formatted.split('\n')[0]}</span>
          <button
            type="button"
            className="dt-text-expand"
            aria-label={i18n.t('cell.expandText')}
            data-dt-tip={formatted}
          >
            <ArrowsOutSimpleIcon size={14} aria-hidden="true" />
          </button>
        </span>
      )
    case 'color':
      return def.display === 'fill' ? (
        <Mono>{formatted}</Mono>
      ) : (
        <>
          <span className="dt-swatch" style={{ background: formatted }} aria-hidden="true" />
          <Mono>{formatted}</Mono>
        </>
      )
    case 'url':
      return (
        <Link href={String(value)} external>
          {urlHost(String(value))}
          <ArrowUpRightIcon size={12} className="dt-link-icon" aria-hidden="true" />
        </Link>
      )
    case 'id': {
      const href = def.href?.(row)
      return href ? (
        <Link href={href}>
          <Mono>{formatted}</Mono>
        </Link>
      ) : (
        <Mono>{formatted}</Mono>
      )
    }
    case 'boolean': {
      if (value) return <Badge tone="green" label={formatted} icon={CheckIcon} />
      const destructive = def.falseTone === 'destructive'
      return <Badge tone={destructive ? 'red' : 'gray'} label={formatted} icon={destructive ? XIcon : MinusIcon} />
    }
    case 'select':
      return optionBadge(def.options, value)
    case 'multiselect': {
      const vals = value as Array<string | number>
      return (
        <span className="dt-badges">
          {vals.slice(0, 2).map((v) => optionBadge(def.options, v))}
          {vals.length > 2 && (
            <More count={vals.length - 2} tip={fmt.list(vals.slice(2).map((v) => optionLabel(def.options, v)))} />
          )}
        </span>
      )
    }
    case 'ajax': {
      const href = def.href?.(row)
      return href ? <Link href={href}>{formatted}</Link> : formatted
    }
    case 'user': {
      const ids = (Array.isArray(value) ? value : [value]) as Array<string | number>
      const users = resolveUsers(def, ids, env)
      if (users.length === 1)
        return (
          <span className="dt-user">
            <Avatar user={users[0]!} />
            <span className="dt-user-name">{users[0]!.label}</span>
          </span>
        )
      return (
        <span className="dt-user dt-avatars">
          {users.slice(0, 3).map((u) => (
            <Avatar key={String(u.value)} user={u} />
          ))}
          {users.length > 3 && (
            <More count={users.length - 3} tip={fmt.list(users.slice(3).map((u) => u.label))} pill />
          )}
        </span>
      )
    }
    case 'date':
    case 'datetime': {
      const overdue = typeof def.overdue === 'function' ? def.overdue(row) : def.overdue
      const late = overdue ? fmt.daysLate(value as string | Date, env.today) : 0
      const tip = def.type === 'datetime' ? fmt.dateTimeFull(value as string | Date) : undefined
      if (late > 0)
        return (
          <span className="dt-late" data-dt-tip={tip}>
            {`${formatted} · ${i18n.t('cell.late', { count: late })}`}
          </span>
        )
      return tip ? <span data-dt-tip={tip}>{formatted}</span> : formatted
    }
    case 'object':
      return (
        <>
          <span className="dt-struct" aria-hidden="true">
            {'{ }'}
          </span>
          {formatted}
        </>
      )
    case 'array': {
      const items = value as unknown[]
      return (
        <>
          <span className="dt-struct" aria-hidden="true">
            [ ]
          </span>
          {items
            .slice(0, 3)
            .map((v) => formatArrayItem(def.itemType, v, fmt))
            .join(', ')}
          {items.length > 3 && (
            <>
              {' '}
              <More count={items.length - 3} tip={formatted} />
            </>
          )}
        </>
      )
    }
  }
}
