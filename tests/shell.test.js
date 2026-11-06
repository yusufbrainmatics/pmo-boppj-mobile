import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BACKOFFICE_PAGES, escapeHtml, formatDate, formatNumber,
  parseBackofficeHash, backofficeHash, summarizeProjects, csvCell, createCsv,
} from '../admin-ui.js'
import { isValidDemoAccount } from '../admin-auth.js'

test('BACKOFFICE_PAGES mempertahankan sebelas ID halaman', () => {
  assert.deepEqual(BACKOFFICE_PAGES, [
    'dashboard', 'map', 'projects', 'regions', 'management', 'users',
    'daily', 'export', 'approval', 'missing', 'knowledge',
  ])
})

test('parseBackofficeHash membaca halaman, detail, dan query', () => {
  const route = parseBackofficeHash('#daily/PK-01?kode=PK-01&status=DITERIMA')
  assert.equal(route.page, 'daily')
  assert.equal(route.detail, 'PK-01')
  assert.equal(route.params.get('kode'), 'PK-01')
  assert.equal(route.params.get('status'), 'DITERIMA')
  assert.equal(route.valid, true)
})

test('parseBackofficeHash default ke dashboard dan menandai hash tidak dikenal', () => {
  assert.equal(parseBackofficeHash('').page, 'dashboard')
  assert.equal(parseBackofficeHash('#').valid, true)
  const unknown = parseBackofficeHash('#bogus-page')
  assert.equal(unknown.valid, false)
  assert.equal(unknown.page, 'bogus-page')
})

test('parseBackofficeHash men-decode detail dan menoleransi URI rusak', () => {
  assert.equal(parseBackofficeHash('#projects/PK%2F01').detail, 'PK/01')
  assert.equal(parseBackofficeHash('#projects/%E0%A4%A').detail, '%E0%A4%A')
})

test('backofficeHash menghasilkan hash dan mempertahankan query params', () => {
  assert.equal(backofficeHash('dashboard'), '#dashboard')
  assert.equal(backofficeHash('projects', 'PK-01'), '#projects/PK-01')
  const params = new URLSearchParams([['kode', 'PK 01'], ['tahap', '']])
  assert.equal(backofficeHash('daily', '', params), '#daily?kode=PK+01&tahap=')
})

test('backofficeHash dan parseBackofficeHash saling kebalikan untuk detail terenkripsi', () => {
  const hash = backofficeHash('management', 'doc/01?x', new URLSearchParams({ q: 'a b' }))
  const route = parseBackofficeHash(hash)
  assert.equal(route.page, 'management')
  assert.equal(route.detail, 'doc/01?x')
  assert.equal(route.params.get('q'), 'a b')
})

test('escapeHtml meng-escape seluruh karakter HTML berbahaya dan null', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;')
  assert.equal(escapeHtml("a'b&c"), 'a&#39;b&amp;c')
  assert.equal(escapeHtml(null), '')
  assert.equal(escapeHtml(0), '0')
})

test('formatDate memakai lokal id-ID tanpa bergeser zona', () => {
  assert.equal(formatDate('2026-11-06'), '6 Nov 2026')
  assert.equal(formatDate(''), '—')
  assert.equal(formatDate('not-a-date'), '—')
})

test('formatNumber menolak nilai non-finite', () => {
  assert.equal(formatNumber(1234.5), '1.234,5')
  assert.equal(formatNumber('12'), '—')
  assert.equal(formatNumber(Number.NaN), '—')
})

test('summarizeProjects menghitung total, rerata, tahap, dan kelompok', () => {
  const summary = summarizeProjects([
    { kode: 'A', kelompok: 'Jalan', tahap: 'Konstruksi', progres: 40 },
    { kode: 'B', kelompok: 'Jalan', tahap: 'Konstruksi', progres: 60 },
    { kode: 'C', kelompok: 'Jembatan', tahap: 'Asesmen', progres: null },
  ])
  assert.equal(summary.total, 3)
  assert.equal(summary.average, 50)
  assert.deepEqual(summary.stages, [
    { name: 'Konstruksi', count: 2 },
    { name: 'Asesmen', count: 1 },
  ])
  assert.deepEqual(summary.groups.map((g) => [g.name, g.count, g.average]), [
    ['Jalan', 2, 50],
    ['Jembatan', 1, null],
  ])
})

test('summarizeProjects menampilkan null untuk daftar kosong/tanpa angka', () => {
  assert.equal(summarizeProjects([]).total, 0)
  assert.equal(summarizeProjects([{ kelompok: 'X', tahap: 'Asesmen' }]).average, null)
})

test('csvCell mencegah injeksi formula termasuk prefiks whitespace/kontrol', () => {
  assert.equal(csvCell('=SUM(A1:A2)'), '"\'=SUM(A1:A2)"')
  assert.equal(csvCell(' +CMD(1)'), '"\' +CMD(1)"')
  assert.equal(csvCell('\t-1'), '"\'\t-1"')
  assert.equal(csvCell('@x'), '"\'@x"')
  assert.equal(csvCell('aman "dengan" koma, titik'), '"aman ""dengan"" koma, titik"')
})

test('createCsv menambahkan BOM UTF-8 dan CRLF', () => {
  const csv = createCsv([['a', 'b'], ['1', '2']])
  assert.ok(csv.startsWith('\uFEFF'))
  assert.equal(csv, '\uFEFF"a","b"\r\n"1","2"\r\n')
})

test('isValidDemoAccount hanya menerima akun demo yang ditampilkan', () => {
  assert.equal(isValidDemoAccount('admin@boppj.go.id', 'demo1234'), true)
  assert.equal(isValidDemoAccount('  ADMIN@BOPPJ.GO.ID ', 'demo1234'), true)
  assert.equal(isValidDemoAccount('admin@boppj.go.id', 'wrong'), false)
  assert.equal(isValidDemoAccount('other@example.com', 'demo1234'), false)
  assert.equal(isValidDemoAccount(null, undefined), false)
})
