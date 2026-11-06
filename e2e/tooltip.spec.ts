// Kesilen hücrenin tooltip'i metnin tamamını gösterir: tooltip'in kendisi kesmez, uzun metni satırlara böler.
import { expect, test } from '@playwright/test'

const LONG =
  "per_part('ceil(max(en, 100) / 10) * 10 * ceil(max(boy, 200) / 10) * 10 / 10000', adet) + fire(en, boy, 0.05)"

test('uzun hücre metni tooltip’te kesilmeden görünür', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('pg:settings', JSON.stringify({ theme: 'light', density: 'standard', locale: 'en' })),
  )
  await page.goto('/#/r21')
  const cell = page.locator('.dt-row [data-col="code"] .dt-cell-content').first()
  // Oyun alanında bu uzunlukta metin yok; hücreye yazılır, tooltip metni hücreden okur.
  await cell.evaluate((el, text) => (el.textContent = text), LONG)
  await cell.hover()

  const tip = page.getByRole('tooltip')
  await expect(tip).toHaveText(LONG)
  const clipped = await tip.evaluate((el) => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)
  expect(clipped).toBe(false)
})
