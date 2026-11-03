import { useEffect, useState, type ReactNode } from 'react'
import { DataTableProvider, type Density } from '@medyat/react-data-table'
import { T7Actions } from './pages/t7-actions'
import { T8Cells } from './pages/t8-cells'
import { applySettings, loadSettings, type Settings, type Theme } from './settings'

const THEMES: Theme[] = ['light', 'dark-class', 'dark-attr']
const DENSITIES: Density[] = ['comfortable', 'standard', 'compact']
const LOCALES = ['en', 'tr', 'ru']

/** DESIGN-BRIEF görev paketleri; her biri bir rota. Sayfa ilgili fazda eklenir. */
const PAGES: Array<{ id: string; title: string; render: (s: Settings) => ReactNode }> = [
  { id: 't7', title: 'T7 · Cell actions', render: (s) => <T7Actions density={s.density} /> },
  { id: 't8', title: 'T8 · Cell types', render: (s) => <T8Cells density={s.density} /> },
]

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
    <DataTableProvider locale={settings.locale}>
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
        <Switch label="Density" value={settings.density} options={DENSITIES} onChange={(density) => set({ density })} />
        <Switch label="Locale" value={settings.locale} options={LOCALES} onChange={(locale) => set({ locale })} />
      </header>
      <main className="pg-stage">{active.render(settings)}</main>
    </DataTableProvider>
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
