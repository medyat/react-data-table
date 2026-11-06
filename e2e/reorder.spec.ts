// R21: satır sıralama gerçek tarayıcıda (jsdom ölçmez): fareyle ve klavyeyle taşıma, iyimser sıra, ret ve pasif tutamak.
import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('pg:settings', JSON.stringify({ theme: 'light', density: 'standard', locale: 'en' })),
  )
  await page.goto('/#/r21')
  await expect(page.locator('.dt-row-handle[aria-roledescription="sortable"]').first()).toBeVisible()
})

const titles = (page: Page) => page.locator('.dt-row [data-col="title"]').allTextContents()
const handle = (page: Page, title: string) => page.getByRole('button', { name: `Move ${title}` })

async function drag(page: Page, from: string, onto: string) {
  const a = (await handle(page, from).boundingBox())!
  const b = (await page.locator('.dt-row', { hasText: onto }).boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.mouse.up()
}

test('fareyle taşınan satır hemen yerinde görünür; uygulamaya komşusu bildirilir', async ({ page }) => {
  await drag(page, 'Origin', 'Weight')

  expect((await titles(page)).slice(0, 3)).toEqual(['Fabric width', 'Origin', 'Weight'])
  await expect(page.getByRole('list', { name: 'Moves' })).toContainText('Origin → after Fabric width')
  expect((await titles(page)).slice(0, 3)).toEqual(['Fabric width', 'Origin', 'Weight'])
})

test('klavyeyle: Boşluk al, aşağı ok, Boşluk bırak', async ({ page }) => {
  await handle(page, 'Fabric width').focus()
  // Her ok tuşundan sonra satır yeni yerine kayar (geçiş); kullanıcı gibi bekleyerek basılır.
  for (const key of ['Space', 'ArrowDown', 'ArrowDown', 'Space']) {
    await page.keyboard.press(key)
    await page.waitForTimeout(250)
  }

  await expect(page.getByRole('list', { name: 'Moves' })).toContainText('Fabric width → after Pattern')
  expect((await titles(page)).slice(0, 3)).toEqual(['Weight', 'Pattern', 'Fabric width'])
})

test('istek reddedilirse eski sıraya döner', async ({ page }) => {
  await page.getByLabel('Fail next move').check()
  await drag(page, 'Pattern', 'Fabric width')

  expect((await titles(page))[0]).toBe('Pattern')
  await expect(handle(page, 'Weight')).toHaveAttribute('aria-disabled', 'true')
  await expect.poll(async () => (await titles(page))[0]).toBe('Fabric width')
  await expect(handle(page, 'Weight')).not.toHaveAttribute('aria-disabled')
})

test("arama varken tutamak pasif, gerekçe tooltip'te", async ({ page }) => {
  await page.getByRole('searchbox').first().fill('o')
  const h = page.locator('.dt-row-handle').first()
  await expect(h).toHaveAttribute('aria-disabled', 'true')
  await expect(h).toHaveAttribute('data-dt-tip', 'Clear the search and sorting to reorder')
})

test('uzun listede kenara sürükleyince liste kayar; satır ekranda görünen yere bırakılır', async ({ page }) => {
  await page.getByLabel('300 fields').check()
  const scroller = page.locator('.dt-scroll').first()
  const box = (await scroller.boundingBox())!
  const a = (await page.getByRole('button', { name: 'Move Field 1', exact: true }).boundingBox())!
  const x = a.x + a.width / 2
  await page.mouse.move(x, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(x, box.y + box.height - 8, { steps: 12 })
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop), { timeout: 10_000 }).toBeGreaterThan(2000)
  await page.mouse.move(x, box.y + box.height / 2, { steps: 6 })
  await page.waitForTimeout(300)
  // Kullanıcının gördüğü: sürüklenen satırın hemen üstündeki satır.
  const above = await page.locator('.dt-item').evaluateAll((items) => {
    const mid = (el: Element) => {
      const b = el.getBoundingClientRect()
      return (b.top + b.bottom) / 2
    }
    const drag = items.find((el) => el.classList.contains('is-dragging'))!
    const y = mid(drag)
    const over = items.filter((el) => el !== drag && mid(el) < y).sort((p, q) => mid(q) - mid(p))[0]
    return over?.querySelector('[data-col="title"]')?.textContent
  })
  await page.mouse.up()

  await expect(page.getByRole('list', { name: 'Moves' })).toContainText(`Field 1 → after ${above}`)
})
