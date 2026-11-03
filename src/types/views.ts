// api-draft.ts §5'ten türetildi: görünümler (D4, D5) ve tercihler.
import type { Density, IsoDate, TableId } from './core'
import type { ColumnLayout, FilterCondition, SortRule } from './query'

/** D5: görünüm = filtre + sıralama + sütun düzeni. Arama, yoğunluk, tema, sayfa yazılmaz. Kaydedilen tam snapshot. */
export interface ViewState {
  filters: FilterCondition[]
  sort: SortRule[]
  columns: ColumnLayout
}

/** Kısmi görünüm (system view tanımı ve adapter'dan gelen kayıtlar). Eksik alanlar tablonun varsayılanlarıyla tamamlanır. */
export interface ViewPatch {
  filters?: FilterCondition[]
  sort?: SortRule[]
  columns?: Partial<ColumnLayout>
}

/** Tek görünüm tipi (D4, D30). system: kodla tanımlı, değiştirilemez (Duplicate, Set as default). personal: yalnızca sahibine. */
export interface View {
  id: string
  name: string
  kind: 'system' | 'personal'
  state: ViewPatch
  /** Ekranın varsayılanı (system içinde en fazla bir tane). Kullanıcı varsayılanı tercihlerde (`defaultViewId`). */
  default?: boolean
  updatedAt?: IsoDate
  /** Sunucu sürüm numarası (çakışma tespiti için, opsiyonel). */
  v?: number
}

export interface ViewsAdapter {
  list: (tableId: TableId) => Promise<View[]>
  create: (tableId: TableId, input: { name: string; state: ViewState }) => Promise<View>
  update: (tableId: TableId, id: string, patch: { name?: string; state?: ViewState }) => Promise<View>
  remove: (tableId: TableId, id: string) => Promise<void>
}

export interface Preferences {
  density: Density
  verticalLines: boolean
  pageSize: number
  /** Kullanıcının "Set as default" seçtiği görünüm (system veya personal). */
  defaultViewId: string | null
}

export interface PreferencesAdapter {
  get: (tableId: TableId) => Partial<Preferences> | Promise<Partial<Preferences>>
  set: (tableId: TableId, prefs: Partial<Preferences>) => void | Promise<void>
}
