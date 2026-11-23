// F1 F: FormGrid hız bütçesi, 1000 satır × 30 sütun, gerçek Chrome'da (form-grid.md §10). Süre olaydan DOM'un
// güncellenip yerleşimin bittiği ana kadar ölçülür (offsetHeight zorlar); boyama dahil değil, bir sonraki kareyi
// beklemek ölçüme kare gecikmesini katar. Ortanca bütçeyle karşılaştırılır, en kötüsü raporda görünür.
import { expect, test, type Page } from '@playwright/test'

const RUNS = 15

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!
const report = (name: string, xs: number[]) =>
  console.log(`${name}: ortanca ${median(xs).toFixed(1)} ms, en kötü ${Math.max(...xs).toFixed(1)} ms`)

async function openBig(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem('pg:settings', JSON.stringify({ theme: 'light', density: 'standard', locale: 'tr' })),
  )
  await page.goto('/#/f1')
  await expect(page.locator('.dt-form-grid .dt-row').first()).toBeVisible()
}

/** Veri seçicisini "1000 × 30"a çevirir; ızgara yeniden kurulur (key), ilk satır görünene kadar geçen süre. */
const firstRender = (page: Page, size: 'big' | 'small') =>
  page.evaluate(
    (size) =>
      new Promise<number>((resolve) => {
        const select = [...document.querySelectorAll('select')].find((s) => s.querySelector('option[value="big"]'))!
        const done = () =>
          document
            .querySelector('.dt-form-grid [data-row="0"][data-col="0"]')
            ?.textContent?.includes(size === 'big' ? 'P-0001' : 'RAY-AL')
        const t0 = performance.now()
        // React'in değer izleyicisi doğrudan atamayı görmez; yerleşik setter'la atanınca change işlenir.
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, size)
        select.dispatchEvent(new Event('change', { bubbles: true }))
        const check = () => {
          if (!done()) return
          observer.disconnect()
          void document.body.offsetHeight
          resolve(performance.now() - t0)
        }
        const observer = new MutationObserver(check)
        observer.observe(document.body, { childList: true, subtree: true, characterData: true })
        check()
      }),
    size,
  )

/** Aktif hücreye tuş gönderir; `until` doğru olana kadar (DOM değişimiyle) bekler, yerleşimi zorlar. */
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

test('ilk çizim < 300 ms', async ({ page }) => {
  await openBig(page)
  const xs: number[] = []
  for (let i = 0; i < 5; i++) {
    xs.push(await firstRender(page, 'big'))
    await firstRender(page, 'small')
  }
  report('ilk çizim', xs)
  expect(median(xs)).toBeLessThan(300)
})

test('ok tuşundan çizime < 16 ms', async ({ page }) => {
  await openBig(page)
  await firstRender(page, 'big')
  await page.locator('.dt-form-grid [data-row="0"][data-col="1"]').click()
  const xs: number[] = []
  for (let i = 0; i < RUNS; i++) {
    const right = i % 2 === 0
    const col = right ? '2' : '1'
    xs.push(await timedKey(page, right ? 'ArrowRight' : 'ArrowLeft', `${active}?.dataset.col === '${col}'`))
  }
  report('ok tuşu', xs)
  expect(median(xs)).toBeLessThan(16)
})

test('hücre onayından çizime < 50 ms', async ({ page }) => {
  await openBig(page)
  await firstRender(page, 'big')
  const xs: number[] = []
  for (let i = 0; i < RUNS; i++) {
    await page.locator(`.dt-form-grid [data-row="${i}"][data-col="2"]`).click()
    await page.keyboard.type(String(10 + i))
    await expect(page.locator('.dt-form-grid .dt-cell.is-editing')).toBeVisible()
    // Enter yazılanı onaylar, alt hücreye iner; bitiş: alt hücre aktif ve onaylanan değer satırda görünür.
    xs.push(
      await timedKey(
        page,
        'Enter',
        `${active}?.dataset.row === '${i + 1}' && document.querySelector('[data-row="${i}"][data-col="2"]').textContent.includes('${10 + i}')`,
      ),
    )
  }
  report('hücre onayı', xs)
  expect(median(xs)).toBeLessThan(50)
})
