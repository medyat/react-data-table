import type { OptionDef, UserOption } from '@medyat/react-data-table'

export const statusOptions: OptionDef[] = [
  { value: 'draft', label: 'Draft', tone: 'gray' },
  { value: 'planned', label: 'Planned', tone: 'violet' },
  { value: 'released', label: 'Released', tone: 'teal' },
  { value: 'in_progress', label: 'In progress', tone: 'blue' },
  { value: 'on_hold', label: 'On hold', tone: 'amber' },
  { value: 'done', label: 'Done', tone: 'green' },
]

export const owners: UserOption[] = [
  { value: 'u1', label: 'Ayşe K.' },
  { value: 'u2', label: 'Emre T.' },
  { value: 'u3', label: 'Selin A.' },
  { value: 'u4', label: 'Burak Y.' },
  { value: 'u5', label: 'Deniz Ö.' },
  { value: 'u6', label: 'Murat S.' },
]
