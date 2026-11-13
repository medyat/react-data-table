import type { RowAction } from '../../types/list'

/** Satırda inline çizilen aksiyonlar (D36, R23): `inline` + `when(row)`; ilk 2. Izgara genişlik için, menü düşmek için kullanır. */
export const inlineActionsOf = <Row extends object>(actions: Array<RowAction<Row>>, row: Row): Array<RowAction<Row>> =>
  actions.filter((a) => a.inline && (!a.when || a.when(row))).slice(0, 2)

const VARIANT = {
  default: 'dt-btn dt-btn-sm dt-btn-primary',
  outline: 'dt-btn dt-btn-sm',
  field: 'dt-btn dt-btn-sm dt-btn-field',
  secondary: 'dt-btn dt-btn-sm dt-btn-secondary',
  ghost: 'dt-btn dt-btn-sm dt-btn-ghost',
  destructive: 'dt-btn dt-btn-sm dt-btn-danger',
  link: 'dt-btn dt-btn-sm dt-btn-link',
} as const

/** Inline düğmenin sınıfı (R23). Variant'sız ikon ⋯ ile aynı düğmedir (D36); ölçü yuvası da aynı sınıfı giyer. */
export const inlineClass = (a: RowAction): string => {
  const variant = a.variant ?? 'ghost'
  if (!a.icon) return VARIANT[variant]
  return variant === 'ghost' ? 'dt-row-inline' : `${VARIANT[variant]} dt-btn-icon`
}
