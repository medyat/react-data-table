import type { RowAction } from '../../types/list'

/** Satırda inline çizilen aksiyonlar (D36): `inline` + `icon` + `when(row)`; ilk 2. Izgara genişlik için, menü düşmek için kullanır. */
export const inlineActionsOf = <Row extends object>(actions: Array<RowAction<Row>>, row: Row): Array<RowAction<Row>> =>
  actions.filter((a) => a.inline && a.icon && (!a.when || a.when(row))).slice(0, 2)
