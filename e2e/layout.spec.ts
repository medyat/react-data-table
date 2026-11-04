// Gerçek tarayıcıda yerleşim: jsdom'un hesaplamadığı CSS (`:has`, kardeş seçicileri, köşe yarıçapları).
import { expect, test } from '@playwright/test'

// Base UI popover açıkken tetikleyicinin önüne ve arkasına gizli odak bekçileri ve portal bağı ekler; düğme grubu
// onları kardeş saymamalı (R9).
test('Display açılınca düğme grubunun köşeleri ve konumu değişmez', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('pg:settings', JSON.stringify({ theme: 'light', density: 'standard', locale: 'en' })),
  )
  await page.goto('/#/t1')
  const display = page.getByRole('button', { name: 'Display' })
  await expect(display).toBeVisible()
  const geometry = () =>
    display.evaluate((e) => {
      const s = getComputedStyle(e)
      return { radius: [s.borderTopLeftRadius, s.borderTopRightRadius], x: e.getBoundingClientRect().x }
    })
  const closed = await geometry()
  await display.click()
  await expect(page.locator('.dt-display')).toBeVisible()
  expect(await geometry()).toEqual(closed)
})

// Sistem görünümü notu menünün genişliğini belirlememeli: öğelerin genişliğinde kırılır.
test('görünüm satır menüsü notla genişlemez', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('pg:settings', JSON.stringify({ theme: 'light', density: 'standard', locale: 'en' })),
  )
  await page.goto('/#/t1')
  await page.locator('.dt-view-trigger').click()
  await page.locator('.dt-view-row').first().locator('.dt-view-more').click()
  const note = page.locator('.dt-view-note')
  await expect(note).toBeVisible()
  const { menu, lines } = await note.evaluate((e) => ({
    menu: e.closest<HTMLElement>('.dt-view-row-menu')!.getBoundingClientRect().width,
    lines: Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)),
  }))
  expect(menu).toBeLessThan(240)
  expect(lines).toBeGreaterThan(1)
})
