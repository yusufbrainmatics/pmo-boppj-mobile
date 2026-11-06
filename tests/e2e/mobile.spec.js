import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const FOTO = fileURLToPath(new URL('../../public/icon-192.png', import.meta.url))

async function masuk(page) {
  await page.goto('m/#/login')
  await page.getByLabel('Email').fill('karno@braindevs.com')
  await page.getByLabel('Kata sandi', { exact: true }).fill('demo1234')
  await page.getByRole('button', { name: 'Masuk' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
}

async function isiLaporan(page, { kode, progres = '23', uraian = 'Pemasangan geotekstil segmen barat STA 1+200.' }) {
  await page.goto('m/#/input')
  await page.getByLabel('Proyek', { exact: true }).selectOption(kode)
  await page.getByLabel('Progres kumulatif (%)').fill(progres)
  await page.getByLabel('Volume hari ini').fill('40')
  await page.getByLabel('Uraian kegiatan').fill(uraian)
  await page.getByLabel('Jumlah tenaga kerja').fill('25')
  await page.locator('input[type=file][multiple]').setInputFiles(FOTO)
  await expect(page.getByRole('img', { name: 'Foto lapangan 1' })).toBeVisible()
}

test('root opens contractor reporting, never the backoffice', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveURL(/\/m\/#\/login$/)
  await expect(page.getByRole('heading', { name: 'Masuk ke PMO Kontraktor' })).toBeVisible()
  await expect(page.locator('a[href*="backoffice"]')).toHaveCount(0)
})

test('login, submit a report with photo, see it in history', async ({ page }) => {
  await masuk(page)
  await isiLaporan(page, { kode: 'GSW-12' })
  await page.getByRole('button', { name: 'Kirim progres' }).click()
  await expect(page).toHaveURL(/#\/riwayat\/report/)
  await expect(page.getByText('Pemasangan geotekstil segmen barat')).toBeVisible()
  await expect(page.getByText(/bukan persetujuan pembayaran/)).toBeVisible()
  await page.goto('m/#/riwayat')
  await expect(page.getByRole('heading', { name: 'Riwayat input' })).toBeVisible()
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toMatch(/blob|image|jpeg/i)
})

test('duplicate report for the same package and date is refused inline', async ({ page }) => {
  await masuk(page)
  await isiLaporan(page, { kode: 'NCICD-A-03' })
  await page.getByRole('button', { name: 'Kirim progres' }).click()
  await expect(page.getByText(/sudah ada dan masih berjalan/).first()).toBeVisible()
})

test('offline submit queues on device, then syncs into review simulation', async ({ page, context }) => {
  await masuk(page)
  await isiLaporan(page, { kode: 'TOL-SMD-01', progres: '35' })
  await context.setOffline(true)
  await page.evaluate(() => dispatchEvent(new Event('offline')))
  await page.getByRole('button', { name: 'Kirim progres' }).click()
  await expect(page.getByText(/Laporan antre/).first()).toBeVisible()
  await context.setOffline(false)
  await page.evaluate(() => dispatchEvent(new Event('online')))
  await expect(page.getByText(/antre di perangkat/)).toHaveCount(0)
})

test('rejected report can be revised and keeps revision history', async ({ page }) => {
  await masuk(page)
  await page.goto('m/#/riwayat/L-0884')
  await expect(page.getByText('Input ditolak verifikator')).toBeVisible()
  await page.getByRole('link', { name: 'Perbaiki dan kirim ulang' }).click()
  await page.getByLabel('Uraian kegiatan').fill('Perbaikan data: pengecoran pile cap P3 sesuai catatan verifikator.')
  await page.locator('input[type=file][multiple]').setInputFiles(FOTO)
  await page.getByRole('button', { name: 'Kirim ulang' }).click()
  await expect(page).toHaveURL(/#\/riwayat\//)
  await expect(page.getByText('Riwayat revisi')).toBeVisible()
})

for (const width of [320, 390, 768]) {
  test(`no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await masuk(page)
    for (const route of ['#/', '#/input', '#/riwayat', '#/pengetahuan', '#/lainnya']) {
      await page.goto(`m/${route}`)
      await page.waitForLoadState('networkidle')
      const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }))
      expect(sw, route).toBeLessThanOrEqual(iw)
    }
  })
}

test('seed report detail shows demo photos', async ({ page }) => {
  await masuk(page)
  await page.goto('m/#/riwayat/L-0897')
  await expect(page.getByAltText(/Foto lapangan 1 \(contoh\)/)).toBeVisible()
})
