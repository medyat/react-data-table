import type { ColumnDef } from '../../types/columns'

/** Grup yolu, dıştan içe. */
export const groupPath = (def: Pick<ColumnDef, 'group'>): string[] =>
  def.group === undefined ? [] : typeof def.group === 'string' ? [def.group] : def.group

/** Sütunun ızgara dışındaki adı: grup yoluyla birlikte ("İndirim · Oran"). */
export const columnName = (def: Pick<ColumnDef, 'group' | 'header'>): string =>
  [...groupPath(def), def.header].join(' · ')

export const nameOf = (def: Pick<ColumnDef, 'group' | 'header'> | undefined): string | undefined =>
  def && columnName(def)
