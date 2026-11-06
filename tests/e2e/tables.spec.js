import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const projects = JSON.parse(readFileSync(new URL('../../src/data/proyek.json', import.meta.url), 'utf8'))
const contractor = JSON.parse(readFileSync(new URL('../../src/data/kontraktor.json', import.meta.url), 'utf8'))
const assignment = contractor.paket[0]
const project = projects.find((row) => row.kode === assignment.kode)

async function login(page, route) {
  await page.goto(`backoffice/#${route}`)
  await page.locator('#admin-email').fill('admin@boppj.go.id')
  await page.locator('#admin-password').fill('demo1234')
  await page.getByRole('button', { name: /masuk/i }).click()
  await expect(page.locator('#admin-portal')).toBeVisible()
}

for (const route of ['daily', 'approval', 'missing']) {
  test(`${route} shows one project name and the package company, not the actor ID`, async ({ page }) => {
    await login(page, `${route}?to=2026-11-06`)
    const table = page.locator(`#${route} .ops-table`)
    const headers = await table.locator('thead th').allTextContents()
    expect(headers).toContain('Proyek')
    expect(headers).toContain('Paket')
    expect(headers).toContain('Perusahaan penanggung jawab')
    expect(headers).not.toContain('Pelapor')
    expect(headers).not.toContain('Pengiriman / review')
    const row = table.locator('tbody tr').filter({ has: page.getByRole('cell', { name: assignment.kontrak, exact: true }) }).first()
    const projectCell = row.locator('td').nth(headers.indexOf('Proyek'))
    const companyCell = row.locator('td').nth(headers.indexOf('Perusahaan penanggung jawab'))
    await expect(projectCell).toHaveText(project.nama)
    await expect(projectCell.locator('small')).toHaveCount(0)
    await expect(companyCell).toHaveText(contractor.pengguna.perusahaan)
    await expect(companyCell).not.toContainText('contractor-demo')
  })
}

test('unassigned package has a stable sample company without changing its assignment', async ({ page }) => {
  await login(page, `missing?to=2026-11-06&kode=${assignment.kode}`)
  const table = page.locator('#missing .ops-table')
  const headers = await table.locator('thead th').allTextContents()
  const row = table.locator('tbody tr').filter({ has: page.getByRole('cell', { name: `${assignment.kode}-P02`, exact: true }) })
  await expect(row).toHaveCount(1)
  await expect(row.locator('td').nth(headers.indexOf('Proyek'))).toHaveText(project.nama)
  const companyCell = row.locator('td').nth(headers.indexOf('Perusahaan penanggung jawab'))
  const company = await companyCell.textContent()
  expect(contractor.perusahaanContoh).toContain(company)
  expect(company).not.toMatch(/ilustratif/i)
  expect(company).not.toBe(contractor.pengguna.perusahaan)
  await page.reload()
  await expect(companyCell).toHaveText(company)
})

test('report detail retains its author and revision audit trail', async ({ page }) => {
  await login(page, 'daily?to=2026-11-06')
  await page.locator('#daily .ops-table a').first().click()
  await expect(page.locator('#daily .ops-facts')).toContainText('contractor-demo')
  await expect(page.getByRole('columnheader', { name: 'Pembuat revisi', exact: true })).toBeVisible()
})

const routes = ['dashboard', 'projects', `projects/${assignment.kode}`, 'daily?to=2026-11-06', 'approval?to=2026-11-06', 'missing?to=2026-11-06', 'export?to=2026-11-06', 'management', 'knowledge', 'regions', 'users']

for (const width of [320, 390, 768, 1440, 1920]) {
  test(`tables retain aligned columns and contained scrolling at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(90000)
    await page.setViewportSize({ width, height: 1000 })
    await login(page, 'dashboard')
    for (const route of routes) {
      await page.goto(`backoffice/#${route}`)
      const id = route.split(/[/?]/)[0]
      await expect(page.locator(`#${id}`)).toBeVisible()
      const tables = page.locator(`#${id} table:visible`)
      await expect(tables.first()).toBeVisible()
      const result = await tables.evaluateAll((elements) => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        mismatched: elements.flatMap((table) => {
          const columns = [...table.tHead.rows[0].cells].reduce((sum, cell) => sum + cell.colSpan, 0)
          return [...table.tBodies].flatMap((body) => [...body.rows].filter((row) => [...row.cells].reduce((sum, cell) => sum + cell.colSpan, 0) !== columns).map((row) => row.textContent.trim().slice(0, 100)))
        }),
      }))
      expect(result, route).toEqual({ overflow: false, mismatched: [] })
      if (width === 1440) {
        await page.screenshot({ path: testInfo.outputPath(`${id}-table.jpg`), type: 'jpeg', quality: 65, fullPage: true })
      }
      if (id === 'users') {
        await page.locator('.account-tabs [data-tab="permissions"]').click()
        await expect(page.locator('#permissions .permission-table')).toBeVisible()
        const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth)
        expect(documentWidth).toBeLessThanOrEqual(width)
        await expect(page.getByRole('checkbox', { name: /Lihat/ }).first()).toBeVisible()
      }
    }
  })
}

test('other listings keep distinct subjects in dedicated columns', async ({ page }) => {
  await login(page, 'projects')
  const checks = [
    ['projects', ['Kode proyek', 'Proyek', 'Kabupaten / kota', 'Provinsi']],
    [`projects/${assignment.kode}`, ['Kode paket', 'Paket', 'Perusahaan penanggung jawab']],
    ['management', ['Dokumen', 'Proyek', 'Paket', 'Template', 'Versi acuan']],
    ['knowledge', ['Materi', 'Sumber', 'Jenis', 'Topik', 'Proyek', 'Visibilitas', 'Pemilik', 'Direview pada']],
    ['regions', ['Wilayah', 'Kode lokal']],
    ['users', ['Nama Pengguna', 'Email', 'Instansi']],
  ]
  for (const [route, columns] of checks) {
    await page.goto(`backoffice/#${route}`)
    const id = route.split('/')[0]
    const table = page.locator(`#${id} table:visible`).first()
    for (const name of columns) {
      await expect(table.getByRole('columnheader', { name, exact: true })).toBeVisible()
    }
  }
})
