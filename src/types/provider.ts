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
}
