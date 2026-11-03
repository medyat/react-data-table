// Tip başına sabitler (03 · Ortak kurallar, 05 · Sütun genişlikleri): hizalama, varsayılan genişlik, skeleton biçimi,
// sıralanabilirlik. Görünüm (render) ayrı dosyada: renderCell.ts.
import type { ColumnDef, ColumnType } from '../../types/columns'

/** px ya da minmax(min, fr) (05: metin sütunları esner, diğerleri sabit). */
export type Track = number | { min: number; fr: number }

export type SkeletonShape = 'text' | 'number' | 'badge' | 'person'

export interface TypeSpec {
  align: 'left' | 'right'
  width: Track
  skeleton: SkeletonShape
  sortable: boolean
  filterable: boolean
  /** Toolbar aramasına varsayılan dahil (api-draft `searchable`). */
  searchable: boolean
  /** Sayı ailesi: tabular-nums + sağa hizalı header. */
  numeric: boolean
}

const num = (width: number): TypeSpec => ({
  align: 'right',
  width,
  skeleton: 'number',
  sortable: true,
  filterable: true,
  searchable: false,
  numeric: true,
})
const txt = (width: Track, searchable = true): TypeSpec => ({
  align: 'left',
  width,
  skeleton: 'text',
  sortable: true,
  filterable: true,
  searchable,
  numeric: false,
})
const badge = (width: number): TypeSpec => ({
  align: 'left',
  width,
  skeleton: 'badge',
  sortable: true,
  filterable: true,
  searchable: false,
  numeric: false,
})

export const TYPE_SPECS: Record<ColumnType, TypeSpec> = {
  int: num(112),
  float: num(112),
  percentage: num(112),
  star: { ...txt(112, false), skeleton: 'text' },
  currency: num(148),
  string: txt({ min: 160, fr: 1.2 }),
  text: txt({ min: 160, fr: 1.2 }),
  uppercase: txt({ min: 160, fr: 1.2 }),
  lowercase: txt({ min: 160, fr: 1.2 }),
  phone: txt(156),
  color: { ...txt(132, false) },
  email: txt(200),
  url: { ...txt(180, false) },
  id: txt(128),
  boolean: badge(96),
  select: badge(140),
  multiselect: { ...badge(180), sortable: false },
  ajax: badge(180),
  user: { ...badge(156), skeleton: 'person' },
  date: txt(132, false),
  datetime: txt(156, false),
  object: { ...txt(180, false), sortable: false, filterable: false },
  array: { ...txt(160, false), sortable: false },
}

/** Varsayılan genişlik: birincil `id` 136 (expand oku için), birincil metin minmax(200, 1.6fr), percentage bar 156. */
export function defaultTrack(def: ColumnDef): Track {
  if (def.width !== undefined) return def.width
  if (def.type === 'percentage' && def.display === 'bar') return 156
  if (def.primary) return def.type === 'id' ? 136 : { min: 200, fr: 1.6 }
  return TYPE_SPECS[def.type].width
}

export const isNumericType = (type: ColumnType): boolean => TYPE_SPECS[type].numeric

export function alignOf(def: ColumnDef): 'left' | 'right' | 'center' {
  return def.align ?? TYPE_SPECS[def.type].align
}

/** Sütun menüsü başlığı (05 §4): tipin 09 `type.*` anahtarı. */
const TYPE_LABEL: Record<ColumnType, string> = {
  int: 'number',
  float: 'number',
  percentage: 'percentage',
  star: 'rating',
  currency: 'currency',
  string: 'text',
  text: 'longText',
  uppercase: 'text',
  lowercase: 'text',
  phone: 'phone',
  color: 'colour',
  email: 'email',
  url: 'link',
  id: 'id',
  boolean: 'boolean',
  select: 'option',
  multiselect: 'options',
  ajax: 'relation',
  user: 'person',
  date: 'date',
  datetime: 'datetime',
  object: 'object',
  array: 'list',
}
export const typeLabelKey = (type: ColumnType): string => `type.${TYPE_LABEL[type]}`
