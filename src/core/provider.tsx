import { createContext, use, type ReactNode } from 'react'
import type { DataTableOptions } from '../types/provider'
import type { PreferencesAdapter, ViewsAdapter } from '../types/views'
import { createI18n, type I18n } from './i18n'

export interface DataTableContext {
  locale: string
  i18n: I18n
  /** null → yalnızca `views` seçeneğindeki görünümler, kaydetme yok (01 · plugin). */
  viewsAdapter: ViewsAdapter | null
  /** null → tercihler oturumluk; arayüz "kaydedildi" demez. */
  preferences: PreferencesAdapter | null
}

export function createDataTableContext(options: DataTableOptions = {}): DataTableContext {
  const i18n = createI18n({ locale: options.locale, messages: options.messages })
  return {
    locale: i18n.locale,
    i18n,
    viewsAdapter: options.viewsAdapter ?? null,
    preferences: options.preferences ?? null,
  }
}

const Context = createContext<DataTableContext | null>(null)

/** Vue'daki `createDataTable` plugin'inin karşılığı (R7). İç içe kullanılırsa en yakın sağlayıcı geçerlidir. */
export function DataTableProvider({ children, ...options }: DataTableOptions & { children: ReactNode }) {
  return <Context value={createDataTableContext(options)}>{children}</Context>
}

let fallback: DataTableContext | undefined

/** Sağlayıcı yoksa varsayılanlar: navigator.language, paket metinleri, adapter yok. */
export function useDataTableContext(): DataTableContext {
  return use(Context) ?? (fallback ??= createDataTableContext())
}
