// Playground'un kendi ayarları: tema, yoğunluk, dil. localStorage'da kalır.
import type { Density } from '@medyat/react-data-table'

// Paket iki mekanizmayı da destekler (01 · Tema): .dark sınıfı ve data-theme="dark".
export type Theme = 'light' | 'dark-class' | 'dark-attr'
export interface Settings {
  theme: Theme
  density: Density
  locale: string
}

const KEY = 'pg:settings'

export function loadSettings(): Settings {
  let saved: Partial<Settings> = {}
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    // bozuk kayıt: varsayılanlar
  }
  return { theme: 'light', density: 'standard', locale: 'en', ...saved }
}

export function applySettings(settings: Settings) {
  localStorage.setItem(KEY, JSON.stringify(settings))
  const html = document.documentElement
  html.classList.toggle('dark', settings.theme === 'dark-class')
  if (settings.theme === 'dark-attr') html.setAttribute('data-theme', 'dark')
  else html.removeAttribute('data-theme')
}
