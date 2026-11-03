// Satır menüsü (05 §4, handoff 03 §8, T6-03; 268 px): Open ↵ (gerçek <a href>) · Open in new tab · Copy {birincil} · ─ ·
// uygulamanın `rowActions`'ı (pasif olan gerekçesiyle iki satır; yıkıcı en altta, kırmızı). `run` beklenmez (D20).
import { Menu } from '@base-ui/react/menu'
import { DotsThreeIcon } from '@phosphor-icons/react'
import { Fragment, type MouseEvent } from 'react'
import type { RowAction } from '../../types/list'
import { useDataTableContext } from '../provider'
import { DtMenu, DtMenuItem, DtMenuSeparator } from '../ui/menu'
import { inlineActionsOf } from './inline-actions'

export function RowMenu<Row extends object>({
  row,
  label,
  primaryHeader,
  href,
  actions,
  onOpen,
  onCopy,
}: {
  row: Row
  /** Birincil hücre metni (aria etiketleri). */
  label: string
  /** Birincil sütun başlığı: "Copy Order no."; yoksa Copy öğesi yok. */
  primaryHeader?: string
  href?: string
  actions: Array<RowAction<Row>>
  onOpen: (event: MouseEvent) => void
  onCopy: () => void
}) {
  const { i18n } = useDataTableContext()
  // `when(row)` false olan yok (D34); satırda inline çizilen menüde yok (D36); yıkıcılar en altta.
  const inline = new Set(inlineActionsOf(actions, row))
  const shown = actions.filter((a) => !inline.has(a) && (!a.when || a.when(row)))
  const ordered = [...shown.filter((a) => !a.destructive), ...shown.filter((a) => a.destructive)]
  // Menüde bir şey yoksa ⋯ çizilmez; hizalama için yeri kalır.
  if (!href && !primaryHeader && !ordered.length) return <span className="dt-row-more-space" aria-hidden="true" />
  const firstDestructive = ordered.findIndex((a) => a.destructive)
  const subOf = (a: RowAction<Row>): string | null => {
    const d = a.disabled?.(row)
    return typeof d === 'string' ? d : (a.description ?? null)
  }
  const isDisabled = (a: RowAction<Row>) => !!a.disabled?.(row)

  return (
    <DtMenu
      className="dt-row-menu"
      trigger={
        <button type="button" className="dt-row-more" aria-label={i18n.t('row.actionsAria', { id: label })}>
          <DotsThreeIcon size={16} weight="bold" aria-hidden="true" />
        </button>
      }
    >
      {href && (
        <>
          <Menu.LinkItem
            className="dt-menu-item"
            href={href}
            closeOnClick
            onClick={(e) => {
              // Düz sol tık `onRowOpen`; ⌘/Ctrl, orta ve sağ tık tarayıcıya kalır (D6).
              if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) onOpen(e)
            }}
          >
            {i18n.t('row.open')}
            <kbd className="dt-kbd">↵</kbd>
          </Menu.LinkItem>
          <Menu.LinkItem className="dt-menu-item" href={href} target="_blank" rel="noopener" closeOnClick>
            {i18n.t('row.openNewTab')}
          </Menu.LinkItem>
        </>
      )}
      {primaryHeader && <DtMenuItem onSelect={onCopy}>{i18n.t('row.copyId', { column: primaryHeader })}</DtMenuItem>}
      {(href || primaryHeader) && ordered.length > 0 && <DtMenuSeparator />}
      {ordered.map((a, i) => {
        const Icon = a.icon
        const sub = subOf(a)
        return (
          <Fragment key={a.id}>
            {(a.separatorBefore || i === firstDestructive) && <DtMenuSeparator />}
            <DtMenuItem
              destructive={a.destructive}
              twoLine={!!sub}
              disabled={isDisabled(a)}
              onSelect={() => {
                if (!isDisabled(a)) void a.run(row)
              }}
            >
              {Icon && <Icon size={16} aria-hidden="true" />}
              <span className="dt-menu-text">
                <span>{a.label}</span>
                {sub && <span className="dt-menu-sub">{sub}</span>}
              </span>
              {a.shortcut && <kbd className="dt-kbd">{a.shortcut}</kbd>}
            </DtMenuItem>
          </Fragment>
        )
      })}
    </DtMenu>
  )
}
