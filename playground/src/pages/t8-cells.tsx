// T8 · Cell types: 23 tip, her grupta default / varyant / boş satırları (design/T08-cell-types).
import { DataTable, useDataTable, type ColumnDef, type DataTableResult, type Density } from '@medyat/react-data-table'
import { owners, statusOptions } from '../data'

interface Sample {
  id: number
  [key: string]: unknown
}

const remote = {
  search: async () => ({ items: [], hasMore: false }),
  resolve: async (ids: Array<string | number>) =>
    ids.map((id) => ({ value: id, label: id === 'c1' ? 'Kuzey Otomotiv' : String(id) })),
}

const groups: Array<{ title: string; columns: Array<ColumnDef<Sample>>; rows: Sample[] }> = [
  {
    title: 'Number · 5 types',
    columns: [
      { id: 'int', header: 'int', type: 'int' },
      { id: 'float', header: 'float', type: 'float' },
      { id: 'pct', header: 'percentage', type: 'percentage' },
      { id: 'bar', header: 'percentage · bar', type: 'percentage', display: 'bar' },
      { id: 'star', header: 'star', type: 'star' },
      { id: 'cur', header: 'currency', type: 'currency', currency: 'TRY' },
    ],
    rows: [
      { id: 1, int: 12400, float: 1284.5, pct: 68, bar: 68, star: 4, cur: 412800 },
      { id: 2, int: -320, float: 0, pct: 100, bar: 12, star: 1, cur: -12450 },
      { id: 3 },
    ],
  },
  {
    title: 'Text · 9 types',
    columns: [
      { id: 'string', header: 'string', type: 'string' },
      { id: 'text', header: 'text', type: 'text' },
      { id: 'upper', header: 'uppercase', type: 'uppercase' },
      { id: 'lower', header: 'lowercase', type: 'lowercase' },
      { id: 'phone', header: 'phone', type: 'phone' },
      { id: 'color', header: 'color', type: 'color' },
      { id: 'fill', header: 'color · fill', type: 'color', display: 'fill' },
      { id: 'email', header: 'email', type: 'email', width: 240 },
      { id: 'url', header: 'url', type: 'url' },
      { id: 'code', header: 'id', type: 'id', href: () => '#' },
    ],
    rows: [
      {
        id: 1,
        string: 'Hydraulic cylinder HC-80',
        text: 'Customer asked for zinc-plated rods on this batch.\nSecond line of the note.',
        upper: 'GEBZE-2',
        lower: 'hydraulics',
        phone: '+905324121807',
        color: '#1F4E8C',
        fill: '#F2C230',
        email: 'satinalma@kuzeyotomotiv.com.tr',
        url: 'https://kuzeyotomotiv.com.tr/urunler',
        code: 'HC-080-S',
      },
      {
        id: 2,
        string: 'Cylinder mounting bracket CB-80 with a very long name that gets cut',
        fill: '#1F4E8C',
        color: '#F2C230',
      },
      { id: 3 },
    ],
  },
  {
    title: 'Choice · 6 types',
    columns: [
      { id: 'bool', header: 'boolean', type: 'boolean' },
      { id: 'boolD', header: 'boolean · destructive', type: 'boolean', falseTone: 'destructive' },
      { id: 'select', header: 'select', type: 'select', options: statusOptions },
      {
        id: 'multi',
        header: 'multiselect',
        type: 'multiselect',
        options: [
          { value: 'welding', label: 'Welding', tone: 'amber' },
          { value: 'cnc', label: 'CNC', tone: 'violet' },
          { value: 'paint', label: 'Paint', tone: 'teal' },
          { value: 'qa', label: 'QA', tone: 'green' },
        ],
      },
      { id: 'ajax', header: 'ajax', type: 'ajax', remote, href: (r) => (r.ajax === 'c1' ? '#' : undefined) },
      { id: 'user', header: 'user', type: 'user', options: owners },
      { id: 'users', header: 'user · multiple', type: 'user', options: owners, multiple: true },
    ],
    rows: [
      {
        id: 1,
        bool: true,
        boolD: true,
        select: 'in_progress',
        multi: ['welding', 'cnc', 'paint', 'qa'],
        ajax: 'c1',
        user: 'u1',
        users: ['u1', 'u2', 'u5', 'u4', 'u3'],
      },
      {
        id: 2,
        bool: false,
        boolD: false,
        select: 'qc_hold',
        multi: ['welding'],
        ajax: 'c2',
        user: 'u4',
        users: ['u2'],
      },
      { id: 3 },
    ],
  },
  {
    title: 'Date · 2 types',
    columns: [
      { id: 'date', header: 'date', type: 'date' },
      { id: 'late', header: 'date · overdue', type: 'date', overdue: true },
      { id: 'dt', header: 'datetime', type: 'datetime' },
      { id: 'rel', header: 'datetime · relative', type: 'datetime', relative: true },
    ],
    rows: [
      {
        id: 1,
        date: '2026-10-24',
        late: '2026-10-18',
        dt: '2026-10-17T09:42:00',
        rel: new Date(Date.now() - 2 * 3600_000).toISOString(),
      },
      {
        id: 2,
        date: '2025-03-03',
        late: '2026-10-30',
        dt: '2025-03-03T14:05:00',
        rel: new Date(Date.now() + 3 * 86400_000).toISOString(),
      },
      { id: 3 },
    ],
  },
  {
    title: 'Structure · 2 types',
    columns: [
      {
        id: 'obj',
        header: 'object · summary',
        type: 'object',
        summary: (v) => `${(v as { material: string }).material} · ${(v as { kg: number }).kg} kg`,
      },
      { id: 'obj2', header: 'object', type: 'object' },
      { id: 'arr', header: 'array', type: 'array', itemType: 'int' },
    ],
    rows: [
      { id: 1, obj: { material: 'Steel', kg: 12.4 }, obj2: { a: 1, b: 2, c: 3, d: 4 }, arr: [40, 63, 80, 90, 100] },
      { id: 2, obj: { material: 'Brass', kg: 2 }, obj2: { x: 1 }, arr: [1] },
      { id: 3 },
    ],
  },
]

const pending: DataTableResult<Sample> = { status: 'pending' }

function Group({
  title,
  columns,
  rows,
  density,
  loading,
}: (typeof groups)[number] & { density: Density; loading?: boolean }) {
  const table = useDataTable({ id: `t8-${title}`, columns, rows: loading ? undefined : rows, density })
  return (
    <section className="pg-group">
      <h2>{title}</h2>
      <div className="pg-fixed" style={{ height: 4 * 53 + 2 + 49 }}>
        <DataTable table={table} result={loading ? pending : undefined} label={title} />
      </div>
    </section>
  )
}

export function T8Cells({ density }: { density: Density }) {
  return (
    <div className="pg-page pg-scroll">
      <h1>Cell types · 23</h1>
      <p className="pg-sub">Every column has exactly one type · empty is always “—”, never a blank or a fake 0</p>
      {groups.map((g) => (
        <Group key={g.title} {...g} density={density} />
      ))}
      <Group {...groups[2]!} title="Skeleton · first load" density={density} loading />
    </div>
  )
}
