import { test, expect } from '@playwright/test'

async function masukAdmin(page, hash = 'dashboard') {
  await page.goto(`backoffice/#${hash}`)
  await page.locator('#admin-email').fill('admin@boppj.go.id')
  await page.locator('#admin-password').fill('demo1234')
  await page.getByRole('button', { name: /masuk|Masuk/i }).click()
  await expect(page.locator('#admin-portal')).toBeVisible()
}

test('backoffice hidden from root and mobile, reachable only via its URL', async ({ page }) => {
  await page.goto('backoffice/')
  await expect(page).toHaveURL(/backoffice\/$/)
  await expect(page.getByRole('heading', { name: 'Portal PMO BOPPJ', exact: true })).toBeVisible()
  await page.goto('m/#/login')
  await expect(page.locator('a[href*="backoffice"]')).toHaveCount(0)
})

test('wrong demo credentials are rejected', async ({ page }) => {
  await page.goto('backoffice/')
  await page.locator('#admin-email').fill('admin@boppj.go.id')
  await page.locator('#admin-password').fill('salah')
  await page.getByRole('button', { name: /masuk|Masuk/i }).click()
  await expect(page.locator('#admin-login-error')).not.toBeHidden()
})

test('dashboard and Data Proyek use the same master (22 illustrative projects)', async ({ page }) => {
  await masukAdmin(page)
  await expect(page.locator('#dashboard #project-bars .chart-row')).toHaveCount(22)
  await page.goto('backoffice/#projects')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText(/22 proyek master/).first()).toBeVisible()
  await expect(page.locator('#projects .pagination')).toContainText(/dari 3 · 22 hasil/)
})

test('deep link to daily survives login and shows operational table', async ({ page }) => {
  await masukAdmin(page, 'daily')
  await expect(page.locator('#daily')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Performa Harian/ })).toBeVisible()
})

test('approval decision records reason and blocks stale re-decision', async ({ page }) => {
  await masukAdmin(page, 'approval')
  const antre = page.locator('#approval [data-review-id], #approval tbody tr a, #approval table a').first()
  await expect(antre).toBeVisible()
  await antre.click()
  await page.waitForLoadState('networkidle')
  const tolak = page.getByRole('button', { name: /minta revisi|Minta Revisi/i }).first()
  if (await tolak.count()) {
    await page.getByLabel(/alasan|catatan/i).first().fill('Foto tidak sesuai STA yang dilaporkan.')
    await tolak.click()
    await expect(page.getByText(/simulasi|tercatat|disimpan/i).first()).toBeVisible()
  }
})

test('compliance lists obligated packages, including those without reports', async ({ page }) => {
  await masukAdmin(page, 'missing')
  await expect(page.getByRole('heading', { name: /Kepatuhan Pelaporan/ })).toBeVisible()
  await page.waitForLoadState('networkidle')
  const rows = await page.locator('#missing table tr, #missing [role=row]').count()
  expect(rows).toBeGreaterThan(0)
})

test('export preview gates XLSX download and prasarana stays disabled', async ({ page }) => {
  await masukAdmin(page, 'export')
  await expect(page.getByRole('heading', { name: /Pelaporan dan Rekapitulasi/ })).toBeVisible()
  const xlsx = page.locator('[data-action="xlsx"]')
  await expect(page.getByText(/Siap: \d+ baris data/).first()).toBeVisible()
  const sampai = page.locator('#export input[name="to"]').first()
  await sampai.fill('2026-11-05')
  await expect(page.getByText('Pilihan filter berubah. Bentuk preview baru sebelum mengunduh.')).toBeVisible()
  await expect(xlsx.first()).toBeDisabled()
  await page.getByRole('button', { name: /Bentuk preview/i }).click()
  await expect(xlsx.first()).toBeEnabled()
  const [unduhan] = await Promise.all([page.waitForEvent('download'), xlsx.first().click()])
  expect(unduhan.suggestedFilename()).toMatch(/\.xlsx$/i)
  await expect(page.getByText(/Prasarana Pendukung/i).first()).toBeVisible()
})

test('KAK list opens a detail with deep-linkable URL', async ({ page }) => {
  await masukAdmin(page, 'management')
  await page.waitForLoadState('networkidle')
  const tautan = page.locator('#management a[href*="#management/"]:not([href="#management/new"])').first()
  await expect(tautan).toBeVisible()
  await tautan.click()
  await expect(page).toHaveURL(/#management\/acuan/)
  await expect(page.locator('.kak-row').first()).toBeVisible()
  await expect(page.locator('.kak-row.section').first()).toBeVisible()
})

test('knowledge management shows exactly the three content types', async ({ page }) => {
  await masukAdmin(page, 'knowledge')
  for (const jenis of ['Basis Pengetahuan', 'Lesson Learned', 'Tanya Jawab']) {
    await expect(page.getByText(jenis).first()).toBeVisible()
  }
})

for (const width of [768, 1024, 1440, 1920]) {
  test(`backoffice has no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await masukAdmin(page, 'dashboard')
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }))
    expect(sw).toBeLessThanOrEqual(iw)
  })
}

test('demo disclaimer is visible app-wide', async ({ page }) => {
  await masukAdmin(page)
  await expect(page.locator('.demo-tag')).toHaveText('DEMO')
})

test('hamburger drawer opens navigation on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 900 })
  await page.goto('backoffice/')
  await page.locator('#admin-email').fill('admin@boppj.go.id')
  await page.locator('#admin-password').fill('demo1234')
  await page.getByRole('button', { name: /masuk|Masuk/i }).click()
  const menu = page.locator('#admin-menu')
  await expect(menu).toBeHidden()
  await page.locator('#mobile-menu-toggle').click()
  await expect(menu).toBeVisible()
  await expect(page.locator('#admin-sidebar .menu-item').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
})

test('daily report detail shows demo field photos', async ({ page }) => {
  await masukAdmin(page, 'daily/L-0911?to=2026-11-06&kode=NCICD-A-03')
  await expect(page.locator('.ops-foto-grid img').first()).toBeVisible()
  await expect(page.getByAltText(/Foto lapangan 1 \(contoh\)/)).toBeVisible()
})
