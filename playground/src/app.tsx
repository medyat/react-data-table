import { useEffect, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createLocalStoragePreferences,
  createLocalStorageViews,
  DataTableProvider,
  type Density,
} from '@medyat/react-data-table'
import { T1List } from './pages/t1-list'
import { T7Actions } from './pages/t7-actions'
import { T8Cells } from './pages/t8-cells'
import { R21Reorder } from './pages/r21-reorder'
import { applySettings, loadSettings, type Settings, type Theme } from './settings'

const THEMES: Theme[] = ['light', 'dark-class', 'dark-attr']
const DENSITIES: Density[] = ['comfortable', 'standard', 'compact']
const LOCALES = ['en', 'tr', 'ru']

/** DESIGN-BRIEF görev paketleri; her biri bir rota. Sayfa ilgili fazda eklenir. */
const PAGES: Array<{ id: string; title: string; render: (s: Settings) => ReactNode }> = [
  { id: 't1', title: 'T1 · List', render: () => <T1List /> },
  { id: 't7', title: 'T7 · Cell actions', render: (s) => <T7Actions density={s.density} /> },
  { id: 't8', title: 'T8 · Cell types', render: (s) => <T8Cells density={s.density} /> },
  { id: 'r21', title: 'R21 · Reorder', render: (s) => <R21Reorder density={s.density} /> },
]

const queryClient = new QueryClient()
// Vue playground'uyla aynı: kişisel görünümler ve tercihler localStorage'da.
const viewsAdapter = createLocalStorageViews({ scope: 'playground' })
const preferences = createLocalStoragePreferences({ scope: 'playground' })

const currentPage = () => location.hash.slice(2) || PAGES[0]!.id

export function App() {
  const [settings, setSettings] = useState(loadSettings)
  const [page, setPage] = useState(currentPage)
  // Tema <html>'e yazılır: paket token'ları :root / .dark üzerinden okur.
  useEffect(() => applySettings(settings), [settings])
  useEffect(() => {
    const onHash = () => setPage(currentPage())
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])
  const set = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }))
  const active = PAGES.find((p) => p.id === page) ?? PAGES[0]!

  return (
    <QueryClientProvider client={queryClient}>
      <DataTableProvider locale={settings.locale} viewsAdapter={viewsAdapter} preferences={preferences}>
        <header className="pg-bar">
          <a href="#/" className="pg-brand">
            @medyat/react-data-table
          </a>
          <nav className="pg-nav">
            {PAGES.map((p) => (
              <a key={p.id} href={`#/${p.id}`} aria-current={p.id === active.id ? 'page' : undefined}>
                {p.title}
              </a>
            ))}
          </nav>
          <Switch label="Theme" value={settings.theme} options={THEMES} onChange={(theme) => set({ theme })} />
          <Switch
            label="Density"
            value={settings.density}
            options={DENSITIES}
            onChange={(density) => set({ density })}
          />
          <Switch label="Locale" value={settings.locale} options={LOCALES} onChange={(locale) => set({ locale })} />
        </header>
        <main className="pg-stage">{active.render(settings)}</main>
      </DataTableProvider>
    </QueryClientProvider>
  )
}

function Switch<T extends string>(props: { label: string; value: T; options: T[]; onChange: (value: T) => void }) {
  return (
    <label>
      {props.label}
      <select value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
        {props.options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  )
}
