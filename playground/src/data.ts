import { ArrowSquareOutIcon, CopyIcon } from '@phosphor-icons/react'
import type { ColumnDef, OptionDef, UserOption, View } from '@medyat/react-data-table'
import type { Order } from '../server/mock-api.ts'

export type { Order }

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

/** Production orders (T1): Vue playground'undaki orderColumns ile aynı. Veri sahte API'den. */
export const orderColumns: Array<ColumnDef<Order>> = [
  { id: 'number', header: 'Order no.', type: 'id', primary: true, href: (r) => `/orders/${r.id}` },
  {
    id: 'product.name',
    header: 'Product',
    type: 'string',
    secondary: (r) => r.product.sku,
    actions: [
      { id: 'copy', label: 'Copy name', icon: CopyIcon, run: (r) => navigator.clipboard?.writeText(r.product.name) },
      {
        id: 'open',
        label: 'Open product',
        icon: ArrowSquareOutIcon,
        run: (r) => console.log('open product', r.product.sku),
      },
    ],
  },
  { id: 'customer', header: 'Customer', type: 'string' },
  {
    id: 'status',
    header: 'Status',
    type: 'select',
    options: statusOptions,
    width: 124,
    suggested: true,
    filterNoun: { one: 'status', other: 'statuses' },
  },
  {
    id: 'produced',
    header: 'Produced',
    type: 'percentage',
    display: 'bar',
    width: 176,
    description: 'Completed share of the ordered quantity',
  },
  {
    id: 'owner',
    header: 'Owner',
    type: 'user',
    accessor: (r) => r.owner?.id ?? null,
    options: owners,
    suggested: true,
    filterNoun: { one: 'person', other: 'people' },
  },
  { id: 'dueAt', header: 'Due date', type: 'date', overdue: (r) => r.status !== 'done' },
  { id: 'value', header: 'Value', type: 'currency', currency: 'TRY' },
  {
    id: 'plant',
    header: 'Plant',
    type: 'select',
    options: [
      { value: 'Gebze', label: 'Gebze', tone: 'teal' },
      { value: 'Dilovası', label: 'Dilovası', tone: 'violet' },
    ],
    hidden: true,
    suggested: true,
    filterNoun: { one: 'plant', other: 'plants' },
  },
  { id: 'createdAt', header: 'Created', type: 'datetime', relative: true, hidden: true },
]

/** Vue playground'uyla aynı system görünümleri; kişisel görünümler app'teki localStorage adapter'ında. */
export const orderViews: View[] = [
  { id: 'all', name: 'All orders', kind: 'system', state: {}, default: true },
  {
    id: 'late',
    name: 'Late orders',
    kind: 'system',
    state: {
      filters: [
        { column: 'dueAt', op: 'within', value: { preset: 'overdue' } },
        { column: 'status', op: 'not_in', value: ['done'] },
      ],
      sort: [{ column: 'dueAt', dir: 'asc' }],
    },
  },
  {
    id: 'on-hold',
    name: 'On hold',
    kind: 'system',
    state: { filters: [{ column: 'status', op: 'in', value: ['on_hold'] }], sort: [{ column: 'dueAt', dir: 'asc' }] },
  },
]
