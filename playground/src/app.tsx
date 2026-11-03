import { useEffect, useState } from 'react'
import { DataTableProvider, useDataTableContext, type Density } from '@medyat/react-data-table'
import { applySettings, loadSettings, type Settings, type Theme } from './settings'

const THEMES: Theme[] = ['light', 'dark-class', 'dark-attr']
const DENSITIES: Density[] = ['comfortable', 'standard', 'compact']
const LOCALES = ['en', 'tr', 'ru']

export function App() {
  const [settings, setSettings] = useState(loadSettings)
  // Tema <html>'e yazılır: paket tokenları :root / .dark üzerinden okur.
  useEffect(() => applySettings(settings), [settings])
  const set = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }))

  return (
    <DataTableProvider locale={settings.locale}>
      <header className="pg-bar">
        <strong>react-data-table</strong>
        <Switch label="Theme" value={settings.theme} options={THEMES} onChange={(theme) => set({ theme })} />
        <Switch label="Density" value={settings.density} options={DENSITIES} onChange={(density) => set({ density })} />
        <Switch label="Locale" value={settings.locale} options={LOCALES} onChange={(locale) => set({ locale })} />
      </header>
      <main className="pg-main">
        <Phase0 density={settings.density} />
      </main>
    </DataTableProvider>
  )
}

function Switch<T extends string>(props: { label: string; value: T; options: T[]; onChange: (value: T) => void }) {
  return (
    <label className="pg-switch">
      {props.label}
      <select value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
        {props.options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  )
}

const SWATCHES = [
  'surface',
  'surface-2',
  'surface-3',
  'line',
  'text',
  'text-2',
  'text-3',
  'ink',
  'accent',
  'accent-soft',
]
const TONES = ['n', 'b', 'g', 'a', 'r', 'v', 'p', 'c']

/** Faz 0 tanığı: token'lar, tema, yoğunluk ve dil. Izgara Faz 1'de gelir. */
function Phase0({ density }: { density: Density }) {
  const { i18n, locale } = useDataTableContext()
  const entity = { one: 'order', other: 'orders' }
  return (
    <div className="dt pg-card" data-density={density}>
      <p className="pg-row-h">
        locale <code>{locale}</code> · density <code>{density}</code> · row height follows <code>--dt-row-h</code>
      </p>
      <ul className="pg-swatches">
        {SWATCHES.map((s) => (
          <li key={s} style={{ background: `var(--dt-${s})` }}>
            {s}
          </li>
        ))}
      </ul>
      <ul className="pg-swatches">
        {TONES.map((t) => (
          <li key={t} style={{ background: `var(--dt-${t}-bg)`, color: `var(--dt-${t}-fg)` }}>
            {t}
          </li>
        ))}
      </ul>
      <ul className="pg-messages">
        <li>{i18n.t('state.emptyTitle', { entity })}</li>
        <li>{i18n.t('state.noResults', { count: 1, entity })}</li>
        <li>{i18n.t('state.noResults', { count: 3, entity })}</li>
        <li>
          {i18n.t('common.cancel')} · {i18n.t('common.apply')}
        </li>
      </ul>
    </div>
  )
}
