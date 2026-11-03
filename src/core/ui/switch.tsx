// Anahtar (handoff 02-ortak): Base UI Switch + `dt-switch`. Stil sözleşmesi `data-state` (R9): Base UI'nin `data-checked`'i
// yerine Vue'daki reka ile aynı öznitelik yazılır, ui.css aynen geçerli.
import { Switch } from '@base-ui/react/switch'

export function DtSwitch({
  checked,
  onChange,
  disabled,
  className,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
  /** Etiketsiz kullanımda erişilebilir ad. */
  label?: string
}) {
  return (
    <Switch.Root
      className={className ? `dt-switch ${className}` : 'dt-switch'}
      checked={checked}
      onCheckedChange={(v) => onChange(v)}
      disabled={disabled}
      aria-label={label}
      data-state={checked ? 'checked' : 'unchecked'}
    >
      <Switch.Thumb className="dt-switch-thumb" />
    </Switch.Root>
  )
}
