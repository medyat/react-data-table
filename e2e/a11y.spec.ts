// Faz 7c kabul kriteri (Vue e2e/a11y.spec.ts ve phone.spec.ts'in karşılığı): axe-core taramasında kritik/ciddi ihlal yok
// (WCAG 2.1 A/AA); masaüstü liste, seçim, sütun seçici, Columns dialog'u ve telefon alt sayfaları. Hareket azaltma ve yüksek
// kontrast medya kuralları gerçek tarayıcıda.
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const settings = (page: Page, theme = 'light') =>
  page.addInitScript(
    ([t]) => localStorage.setItem('pg:settings', JSON.stringify({ theme: t, density: 'standard', locale: 'en' })),
    [theme],
  )
const open = async (page: Page, theme = 'light') => {
  await settings(page, theme)
  await page.goto('/?size=100#/t1')
  await expect(page.locator('.dt-row[data-index="0"]')).toBeVisible()
}
const scan = async (page: Page, label: string) => {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const bad = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
  const summary = bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes[0]?.target.join(' ')}`)
  expect(summary, label).toEqual([])
}

for (const theme of ['light', 'dark-class']) {
  test(`axe · T1 liste ve seçim (${theme})`, async ({ page }) => {
    await open(page, theme)
    await scan(page, 'T1')
    await page.locator('.dt-row[data-index="1"] .dt-select-box').check()
    await page.waitForTimeout(400) // bulk bar kayma animasyonu bitsin; axe ara kareyi ölçmesin
    await scan(page, 'T1 seçim + bulk bar')
  })

  test(`axe · Columns dialog'u (${theme})`, async ({ page }) => {
    await open(page, theme)
    await page.getByRole('button', { name: 'Display' }).click()
    await page.getByRole('button', { name: /^Columns/ }).click()
    await expect(page.locator('.dt-cols-dialog')).toBeVisible()
    await page.waitForTimeout(200)
    await scan(page, 'Columns dialog')
  })
}

test('axe · sütun seçici, filtre çipi ve görünüm menüsü', async ({ page }) => {
  await open(page)
  await page.locator('.dt-filter-trigger').first().click()
  await expect(page.locator('.dt-picker')).toBeVisible()
  await scan(page, 'sütun seçici')
  await page.keyboard.type('Status')
  await page.keyboard.press('Enter')
  await expect(page.locator('.dt-chip-pop')).toBeVisible()
  await scan(page, 'çip editörü')
  await page.locator('.dt-chip-pop .dt-option').first().click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.dt-filter-trigger .dt-counter').first()).toBeVisible()
  await scan(page, 'aktif filtre (sayaçlı Filter düğmesi)')
  await page.locator('.dt-view-trigger').click()
  await expect(page.locator('.dt-views')).toBeVisible()
  await scan(page, 'görünüm menüsü')
})

test.describe('telefon', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('axe · liste ve alt sayfalar (Filters, ⋯, görünümler, bulk More)', async ({ page }) => {
    test.setTimeout(60_000) // altı axe taraması
    await open(page)
    await expect(page.locator('.dt-list')).toHaveClass(/is-phone/)
    await scan(page, 'telefon liste')
    const sheets: Array<[string, string]> = [
      ['.dt-filter-trigger', 'Filters'],
      ['.dt-more-trigger', '⋯'],
      ['.dt-view-trigger', 'görünümler'],
    ]
    for (const [trigger, label] of sheets) {
      await page.locator(trigger).click()
      await expect(page.locator('.dt-bsheet')).toBeVisible()
      await page.waitForTimeout(300)
      await scan(page, label)
      await page.keyboard.press('Escape')
      await expect(page.locator('.dt-bsheet')).toHaveCount(0)
    }
    await page.locator('.dt-filter-trigger').click()
    await page.locator('.dt-bsheet .dt-bsheet-row', { hasText: 'Status' }).first().click() // Suggested
    await page.locator('.dt-bsheet .dt-option').first().click()
    await page.locator('.dt-bsheet-foot button').click() // Done ("Done" bir durum seçeneğinin de adı)
    await page.getByRole('button', { name: 'Show results' }).click()
    await expect(page.locator('.dt-chip')).toBeVisible()
    await page.waitForTimeout(300)
    await scan(page, 'telefon aktif filtre')
    await page.locator('.dt-row[data-index="0"] .dt-select-box').check()
    await page.locator('.dt-row[data-index="1"] .dt-select-box').check()
    await page.locator('.dt-bulk .dt-bulk-more').click()
    await expect(page.locator('.dt-bsheet')).toBeVisible()
    await page.waitForTimeout(300)
    await scan(page, 'bulk More')
  })
})

test('hareket azaltma: bulk bar ve yükleme animasyonları kapanır', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page)
  await page.locator('.dt-row[data-index="0"] .dt-select-box').check()
  await expect(page.locator('.dt-bulk')).toHaveCSS('animation-name', 'none')
})

test('yüksek kontrast: düğme ve çip çerçeveleri sistem rengiyle', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' })
  await open(page)
  await expect(page.locator('.dt-filter-trigger').first()).toHaveCSS('border-top-style', 'solid')
  await scan(page, 'forced-colors')
})
