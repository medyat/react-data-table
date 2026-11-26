// DS1: DataSheet hız bütçesi, 10.000 satır (data-sheet.md §8), gerçek Chrome'da. Ölçüm form-grid-perf.spec.ts ile
// aynı: olaydan DOM'un güncellenip yerleşimin bittiği ana kadar, ortanca bütçeyle karşılaştırılır.
import { expect, test, type Page } from '@playwright/test'

const RUNS = 15

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!
const report = (name: string, xs: number[]) =>
  console.log(`${name}: ortanca ${median(xs).toFixed(1)} ms, en kötü ${Math.max(...xs).toFixed(1)} ms`)

async function open10k(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem('pg:settings', JSON.stringify({ theme: 'light', density: 'standard', locale: 'tr' })),
  )
  await page.goto('/#/ds1')
  await page.locator('.pg-page select').selectOption('10000')
  // Playground'un araç çubuğu: yükleme bitince durum "Değişiklik yok"a döner.
  await expect(page.locator('.pg-sheet-status')).toHaveText('Değişiklik yok', { timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Tümü 10000' })).toBeVisible()
}

const timedKey = (page: Page, key: string, until: string) =>
  page.evaluate(
    ([key, until]) =>
      new Promise<number>((resolve) => {
        const target = document.activeElement!
        const ok = new Function(`return (${until})`) as () => boolean
        const t0 = performance.now()
        target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
        const check = () => {
          if (!ok()) return false
          observer.disconnect()
          void document.body.offsetHeight
          resolve(performance.now() - t0)
          return true
        }
        const observer = new MutationObserver(check)
        if (!check())
          observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
      }),
    [key, until] as const,
  )

const active = `document.activeElement?.closest?.('[data-row]')`

test('10.000 satırda ok tuşu < 16 ms', async ({ page }) => {
  await open10k(page)
  await page.locator('.dt-data-sheet [data-row="0"][data-col="1"]').click()
  const xs: number[] = []
  for (let i = 0; i < RUNS; i++) {
    const right = i % 2 === 0
    xs.push(await timedKey(page, right ? 'ArrowRight' : 'ArrowLeft', `${active}?.dataset.col === '${right ? 2 : 1}'`))
  }
  report('ok tuşu', xs)
  expect(median(xs)).toBeLessThan(16)
})

test('10.000 satırda hücre onayı < 50 ms', async ({ page }) => {
  await open10k(page)
  const xs: number[] = []
  for (let i = 0; i < RUNS; i++) {
    await page.locator(`.dt-data-sheet [data-row="${i}"][data-col="1"]`).click()
    await page.keyboard.type(`Ad ${i}`)
    await expect(page.locator('.dt-data-sheet .dt-cell.is-editing')).toBeVisible()
    xs.push(
      await timedKey(
        page,
        'Enter',
        `${active}?.dataset.row === '${i + 1}' && document.querySelector('[data-row="${i}"][data-col="1"]').textContent.includes('Ad ${i}')`,
      ),
    )
  }
  report('hücre onayı', xs)
  expect(median(xs)).toBeLessThan(50)
})
