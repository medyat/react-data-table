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

test('sağ kenardaki öğenin tooltip’i daralmaz, ekranda kalır', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('pg:settings', JSON.stringify({ theme: 'light', density: 'standard', locale: 'en' })),
  )
  await page.goto('/#/r21')
  // Satır hatası ikonu gibi: sağ kenara dayalı, dar öğe. Kök dinleyicisine ulaşsın diye listenin içinde.
  await page.locator('.dt-list').evaluate((list) => {
    const icon = document.createElement('span')
    icon.id = 'edge'
    icon.dataset.dtTip = 'The category “PACKED PRODUCTS” is in use. Active products: 499.'
    icon.style.cssText = 'position:fixed;right:8px;top:200px;width:16px;height:16px'
    list.append(icon)
  })
  // Sabit konumlu öğenin üstünü satır içeriği örter; fare olayı doğrudan öğeye verilir.
  await page.locator('#edge').dispatchEvent('mouseover')

  const tip = page.getByRole('tooltip')
  await expect(tip).toBeVisible()
  const box = (await tip.boundingBox())!
  const viewport = page.viewportSize()!
  expect(box.width).toBeGreaterThan(240)
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
})
