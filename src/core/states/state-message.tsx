// Durum mesajı bloğu (handoff 02-ortak §9, T9): gövdenin ortasında, en fazla 440 px; ikon kutusu 40, başlık 15/600, satırlar 13.
import { FileIcon, FunnelIcon, MagnifyingGlassIcon, PackageIcon, WarningCircleIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

const ICONS = {
  empty: PackageIcon,
  noResults: FunnelIcon,
  noResultsSearch: MagnifyingGlassIcon,
  error: WarningCircleIcon,
  noRowsOnPage: FileIcon,
}

export function StateMessage({
  kind,
  title,
  lines = [],
  actions,
  after,
}: {
  kind: keyof typeof ICONS
  title: string
  lines?: string[]
  actions?: ReactNode
  after?: ReactNode
}) {
  const Icon = ICONS[kind]
  return (
    <div className={`dt-state is-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span className="dt-state-icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <strong className="dt-state-title">{title}</strong>
      {lines.map((line) => (
        <p key={line} className="dt-state-line">
          {line}
        </p>
      ))}
      {actions && <div className="dt-state-actions">{actions}</div>}
      {after}
    </div>
  )
}
