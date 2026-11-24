import type { ReactNode } from 'react'
import type { ColumnDef } from './columns'
import type { RowFieldProps } from './form-grid'
import type { Messages } from './i18n'
import type { PreferencesAdapter, ViewsAdapter } from './views'

/** Uygulama genelinde bir kez: `<DataTableProvider locale="tr" viewsAdapter={…}>` (R7). */
export interface DataTableOptions {
  /** Varsayılan navigator.language. Sayı/tarih biçimi ve metin karşılaştırması bu locale ile. */
  locale?: string
  /** Sabit bir nesne verin (modül düzeyinde): her çizimde yeni nesne, bağlamı ve tüm tabloyu yeniden kurar. */
  messages?: Partial<Messages>
  /** Yoksa yalnızca `views` seçeneğindeki görünümler; kaydetme yok. */
  viewsAdapter?: ViewsAdapter
  /** Yoksa tercihler oturumluk (kalıcı değil) ve arayüz bunu "kaydedildi" gibi sunmaz. */
  preferences?: PreferencesAdapter
  /**
   * FormGrid satır penceresinin alanı (form-grid.md §7): uygulamanın form bileşeni, etiketi ve hatasıyla. `null` ya da
   * `undefined` → paketin alanı. Pencere sütunu (`editor.window`) buraya gelmez, paketin özet + kalemidir.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- her ızgaranın satırı başka
  renderField?: (column: ColumnDef<any>, field: RowFieldProps) => ReactNode
}
