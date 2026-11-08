// Tablo modal bir Sheet içinde olabilir (Swors): menüsü Sheet'in arkasında açılmamalı. Sheet uygulamanın katmanıdır
// (shadcn z-50) ve menüden önce açılır; DOM'da menüden öncedir.
import { expect, test } from '@playwright/test'

test('menü, önceden açılmış z-50 katmanın önünde görünür', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('pg:settings', JSON.stringify({ theme: 'light', density: 'standard', locale: 'en' })),
  )
  await page.goto('/#/r21')
  await page.getByRole('button', { name: 'More actions' }).click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()

  const onTop = await menu.evaluate((el) => {
    const box = el.getBoundingClientRect()
    const sheet = document.createElement('div')
    sheet.style.cssText = `position:fixed;z-index:50;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px`
    document.body.prepend(sheet)
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    return el.contains(hit)
  })
  expect(onTop).toBe(true)
})
