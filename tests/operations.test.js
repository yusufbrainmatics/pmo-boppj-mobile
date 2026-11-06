import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_LABEL } from '../src/lib/demo-domain.js';
import {
  REPORT_CATALOG, SNAPSHOT_TTL_MS, normalizeFilters, validateFilters, operationsRoute,
  filterOperationalReports, filterCompliance, createOperationsSnapshot, snapshotStatus,
  canReview, escapeSpreadsheetFormula, serializeCsv, formalTable, describeFilters,
  buildOperationsCsv, buildOperationsXlsx, buildPrintReport,
} from '../admin-operations.js';

function zipEntries(bytes) {
  const result = new Map(), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let cursor = 0;
  while (view.getUint32(cursor, true) === 0x04034b50) {
    const size = view.getUint32(cursor + 18, true), nameLength = view.getUint16(cursor + 26, true);
    const extra = view.getUint16(cursor + 28, true), start = cursor + 30;
    const name = new TextDecoder().decode(bytes.subarray(start, start + nameLength));
    const dataStart = start + nameLength + extra;
    result.set(name, new TextDecoder().decode(bytes.subarray(dataStart, dataStart + size)));
    cursor = dataStart + size;
  }
  return result;
}

const NOW = Date.parse('2026-11-06T14:00:00Z');
const ui = { escapeHtml: (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]) };

function fixture() {
  const projects = [
    { kode: 'TEST-A', nama: 'Proyek uji A', provinsi: 'Wilayah A', kabupaten: 'Kabupaten A' },
    { kode: 'TEST-B', nama: 'Proyek uji B', provinsi: 'Wilayah B', kabupaten: 'Kabupaten B' },
  ];
  const packages = [
    { kode: 'TEST-A', packageId: 'pkg:a:1', nama: 'Paket A pertama', contractorId: 'c:1', kontraktor: 'Kontraktor uji pertama' },
    { kode: 'TEST-A', packageId: 'pkg:a:2', nama: 'Paket A kedua', contractorId: 'c:2', kontraktor: 'Kontraktor uji kedua' },
    { kode: 'TEST-B', packageId: 'pkg:b:1', nama: 'Paket B pertama', contractorId: 'c:2', kontraktor: 'Kontraktor uji kedua' },
  ];
  const report = (id, overrides = {}) => ({
    id, reportId: id, revisionId: `${id}:v1`, version: 1, kode: 'TEST-A', packageId: 'pkg:a:1',
    tanggal: '2026-11-06', progres: 28, volume: 0, satuan: 'm³', tenaga: 10, cuaca: 'Cerah',
    uraian: 'Isi pengujian', delivery: 'delivered', reviewState: 'submitted', createdBy: 'contractor-test',
    receivedAt: '2026-11-06T12:00:00Z', updatedAt: '2026-11-06T12:00:00Z', evidenceAvailability: 'expired', referenceVersionId: null,
    ...overrides,
  });
  const reports = [
    report('r-new'), report('r-old', { tanggal: '2026-11-05', progres: 30, reviewState: 'accepted' }),
    report('r-package-2', { packageId: 'pkg:a:2', delivery: 'queued' }),
    report('r-other', { kode: 'TEST-B', packageId: 'pkg:b:1', reviewState: 'needs-revision' }),
  ];
  const filters = normalizeFilters({}, '2026-11-06');
  const raw = { snapshotId: 'snapshot-test', asOf: '2026-11-06T14:00:00Z', projects, reports, policyLabel: 'demo-policy-usulan-v1' };
  const progress = {
    'pkg:a:1': { reported: 28, verified: 28, baseline: null, deviation: null, asOf: '2026-11-06', source: 'accepted correction fixture' },
    'pkg:a:2': { reported: 28, verified: null, baseline: null, deviation: null, asOf: null, source: null },
    'pkg:b:1': { reported: 28, verified: 0, baseline: null, deviation: null, asOf: '2026-11-05', source: 'accepted zero fixture' },
  };
  const snapshot = createOperationsSnapshot(raw, { filters, packages, progress, createdAt: NOW });
  return { projects, packages, reports, filters, raw, progress, snapshot, report };
}

test('shared filters round-trip through query and preserve encoded detail IDs', () => {
  const filters = normalizeFilters(new URLSearchParams('q=laut+utara&packageId=pkg%3Aa%3A2&from=2026-11-01'), '2026-11-06');
  assert.equal(filters.q, 'laut utara');
  assert.equal(filters.to, '2026-11-06');
  const route = operationsRoute('approval', 'report/with?<id>', filters);
  assert.match(route, /^#approval\/report%2Fwith%3F%3Cid%3E\?/);
  const params = new URLSearchParams(route.slice(route.indexOf('?') + 1));
  assert.deepEqual(normalizeFilters(params), filters);
  assert.equal(operationsRoute('export', '', {}, 'progress'), '#export?kind=progress');
});

test('invalid ranges, impossible dates and unsupported status fail inline validation without clearing filters', () => {
  const filters = normalizeFilters({ from: '2026-11-08', to: '2026-11-06', kode: 'TEST-A' });
  assert.match(validateFilters(filters).from, /awal/);
  assert.equal(filters.kode, 'TEST-A');
  assert.ok(validateFilters(normalizeFilters({ from: '2026-02-29' })).from);
  assert.ok(validateFilters(normalizeFilters({ to: '2026-13-01' })).to);
  assert.ok(validateFilters(normalizeFilters({ status: 'bogus' })).status);
  assert.ok(validateFilters(normalizeFilters({}), true).to);
  assert.deepEqual(validateFilters(normalizeFilters({ from: '2028-02-29', to: '2028-02-29' })), {});
});

test('query filters project, package, region, contractor, dates and status together before counting', () => {
  const { projects, packages, reports } = fixture();
  const filters = normalizeFilters({ kode: 'TEST-A', packageId: 'pkg:a:1', provinsi: 'Wilayah A', contractor: 'c:1', from: '2026-11-06', to: '2026-11-06', status: 'submitted', q: 'kabupaten a' });
  const result = filterOperationalReports(reports, filters, projects, packages);
  assert.deepEqual(result.map((row) => row.id), ['r-new']);
  assert.equal(filterOperationalReports(reports, { ...filters, packageId: 'pkg:a:2' }, projects, packages).length, 0);
  assert.equal(filterOperationalReports(reports, { ...filters, q: 'tidak ada' }, projects, packages).length, 0);
});

test('two packages in one project remain distinct, and queued is not delivered', () => {
  const { projects, packages, reports, filters } = fixture();
  const package2 = filterOperationalReports(reports, { ...filters, packageId: 'pkg:a:2' }, projects, packages);
  assert.deepEqual(package2.map((row) => row.id), ['r-package-2']);
  assert.equal(filterOperationalReports(reports, { ...filters, status: 'delivered' }, projects, packages).some((row) => row.id === 'r-package-2'), false);
  assert.deepEqual(filterOperationalReports(reports, { ...filters, status: 'queued' }, projects, packages).map((row) => row.id), ['r-package-2']);
});

test('unknown or unauthorized master/package identities cannot leak through a row query', () => {
  const { projects, packages, reports, filters } = fixture();
  const scoped = projects.filter((project) => project.kode === 'TEST-A');
  const result = filterOperationalReports([...reports, { ...reports[0], packageId: 'unknown' }], filters, scoped, packages);
  assert.equal(result.length, 3);
  assert.equal(result.some((row) => row.kode === 'TEST-B'), false);
  assert.deepEqual(filterOperationalReports(reports, { ...filters, kode: 'TEST-B' }, scoped, packages), []);
});

test('compliance separates delivery from review and supports pending, revision, late, missing and queued', () => {
  const { projects, packages, filters } = fixture();
  const obligations = [
    { kode: 'TEST-A', packageId: 'pkg:a:1', deliveryStatus: 'on-time', reviewState: 'submitted' },
    { kode: 'TEST-A', packageId: 'pkg:a:2', deliveryStatus: 'queued', reviewState: 'submitted' },
    { kode: 'TEST-B', packageId: 'pkg:b:1', deliveryStatus: 'late', reviewState: 'needs-revision' },
    { kode: 'TEST-B', packageId: 'pkg:b:1', deliveryStatus: 'missing', reviewState: null },
  ];
  assert.equal(filterCompliance(obligations, { ...filters, status: 'missing' }, projects, packages).length, 1);
  assert.equal(filterCompliance(obligations, { ...filters, status: 'submitted' }, projects, packages).length, 2);
  assert.equal(filterCompliance(obligations, { ...filters, status: 'needs-revision' }, projects, packages)[0].deliveryStatus, 'late');
  assert.equal(filterCompliance(obligations, { ...filters, status: 'on-time' }, projects, packages)[0].reviewState, 'submitted');
  assert.equal(filterCompliance(obligations, { ...filters, status: 'queued', contractor: 'c:1' }, projects, packages).length, 0);
});

test('compliance report context retains last reports even when obligation filter is missing', () => {
  const { raw, packages, filters } = fixture();
  const complianceFilters = { ...filters, status: 'missing' };
  const snapshot = createOperationsSnapshot(raw, { filters: complianceFilters, reportFilters: { ...complianceFilters, status: '' }, packages, createdAt: NOW });
  assert.equal(snapshot.filters.status, 'missing');
  assert.equal(snapshot.reports.length, raw.reports.length);
});

test('snapshot is detached and deeply frozen, so later source or filter changes do not change exports', () => {
  const { raw, packages, progress, filters } = fixture();
  const snapshot = createOperationsSnapshot(raw, { filters, packages, progress, createdAt: NOW });
  const before = buildOperationsCsv(snapshot, 'implementation', NOW);
  const beforeXlsx = buildOperationsXlsx(snapshot, 'implementation', NOW);
  raw.reports[0].progres = 99;
  raw.projects[0].nama = 'Mutated';
  packages[0].nama = 'Mutated';
  progress['pkg:a:1'].verified = 99;
  filters.kode = 'TEST-B';
  assert.equal(buildOperationsCsv(snapshot, 'implementation', NOW), before);
  assert.deepEqual(buildOperationsXlsx(snapshot, 'implementation', NOW), beforeXlsx);
  assert.throws(() => { snapshot.reports[0].progres = 99; }, TypeError);
  assert.throws(() => { snapshot.progress['pkg:a:1'].verified = 99; }, TypeError);
  assert.throws(() => { snapshot.filters.q = 'changed'; }, TypeError);
});

test('snapshot expiry uses local preview lifetime, not the fixed demo business timestamp', () => {
  const { snapshot, raw, packages, filters } = fixture();
  assert.equal(snapshotStatus(snapshot, NOW + SNAPSHOT_TTL_MS - 1), 'ready');
  assert.equal(snapshotStatus(snapshot, NOW + SNAPSHOT_TTL_MS), 'expired');
  assert.throws(() => buildOperationsCsv(snapshot, 'progress', NOW + SNAPSHOT_TTL_MS), { code: 'SNAPSHOT_UNAVAILABLE' });
  assert.throws(() => buildOperationsXlsx(snapshot, 'progress', NOW + SNAPSHOT_TTL_MS), { code: 'SNAPSHOT_UNAVAILABLE' });
  assert.throws(() => buildPrintReport(snapshot, 'progress', ui, NOW + SNAPSHOT_TTL_MS), { code: 'SNAPSHOT_UNAVAILABLE' });
  const empty = createOperationsSnapshot({ ...raw, reports: [] }, { filters, packages, createdAt: NOW });
  assert.equal(snapshotStatus(empty, NOW), 'empty');
  assert.throws(() => buildOperationsCsv(empty, 'progress', NOW), { code: 'SNAPSHOT_UNAVAILABLE' });
  assert.throws(() => buildOperationsXlsx(empty, 'progress', NOW), { code: 'SNAPSHOT_UNAVAILABLE' });
  assert.throws(() => buildPrintReport(empty, 'progress', ui, NOW), { code: 'SNAPSHOT_UNAVAILABLE' });
});

test('review affordance denies self-review, contractor/admin substitution, cross-scope, queued and already decided revisions', () => {
  const { report } = fixture();
  const actor = { id: 'reviewer-test', role: 'reviewer', projectCodes: ['TEST-A'] };
  assert.equal(canReview(report('r'), actor).allowed, true);
  assert.equal(canReview(report('r', { createdBy: actor.id }), actor).allowed, false);
  assert.equal(canReview(report('r', { createdBy: { id: actor.id, nama: 'Nama uji' } }), actor).allowed, false);
  assert.equal(canReview(report('r'), { ...actor, role: 'contractor' }).allowed, false);
  assert.equal(canReview(report('r'), { ...actor, role: 'admin' }).allowed, false);
  assert.equal(canReview(report('r', { kode: 'TEST-B' }), actor).allowed, false);
  assert.equal(canReview(report('r', { delivery: 'queued' }), actor).allowed, false);
  assert.equal(canReview(report('r', { reviewState: 'accepted' }), actor).allowed, false);
  assert.equal(canReview(report('r', { reviewState: 'needs-revision' }), actor).allowed, false);
  assert.equal(canReview(report('r', { version: undefined }), actor).allowed, false);
});

test('spreadsheet text neutralizes formula operators behind whitespace, control and Unicode format prefixes', () => {
  for (const operator of ['=', '+', '-', '@']) {
    for (const prefix of ['', ' ', '\t', '\r\n', '\u0000', '\u001f', '\u007f', '\u0085', '\u00a0', '\u200b', '\ufeff', ' \t\u202e']) {
      const value = `${prefix}${operator}SUM(A1:A2)`;
      assert.equal(escapeSpreadsheetFormula(value), `'${value}`, JSON.stringify(value));
    }
  }
  assert.equal(escapeSpreadsheetFormula('\tplain text'), "'\tplain text");
  assert.equal(escapeSpreadsheetFormula(' \u0000plain text'), "' \u0000plain text");
  assert.equal(escapeSpreadsheetFormula('normal = text'), 'normal = text');
  assert.equal(escapeSpreadsheetFormula(0), '0');
  assert.equal(escapeSpreadsheetFormula(-5), '-5');
  assert.equal(escapeSpreadsheetFormula('-5'), "'-5");
  assert.equal(escapeSpreadsheetFormula(null), '');
  assert.equal(escapeSpreadsheetFormula(Number.NaN), '');
});

test('CSV is real UTF-8 BOM CSV with CRLF, quoted commas/newlines and doubled quotes', () => {
  const csv = serializeCsv([['Judul', 'Isi, "kutipan"\nbaris'], [' =1+1', 0]]);
  assert.equal(csv, '\uFEFF"Judul","Isi, ""kutipan""\nbaris"\r\n"\' =1+1","0"\r\n');
  assert.equal(csv.charCodeAt(0), 0xfeff);
});

test('formal progress takes latest work date, not maximum historical reported progress, and keeps canonical verified corrections', () => {
  const { snapshot } = fixture();
  const table = formalTable(snapshot, 'progress');
  const first = table.rows.find((row) => row[3] === 'Paket A pertama');
  assert.equal(first[6], 28);
  assert.equal(first[7], 28);
  assert.equal(first[9], 'Tidak tersedia');
  assert.equal(first[10], 'Tidak tersedia');
  assert.equal(table.rows.length, 3);
  assert.equal(table.rows.find((row) => row[3] === 'Paket A kedua')[7], 'Tidak tersedia');
  assert.equal(table.rows.find((row) => row[0] === 'TEST-B')[7], 0);
});

test('progress recap keeps obligated packages without any report in the period visible as missing', () => {
  const { raw, packages, filters, progress } = fixture();
  const snapshot = createOperationsSnapshot(raw, { filters, packages, progress, reportFilters: { ...filters, packageId: 'pkg:a:1' }, createdAt: NOW });
  assert.equal(snapshot.reports.every((report) => report.packageId === 'pkg:a:1'), true);
  const table = formalTable(snapshot, 'progress');
  assert.equal(table.rows.length, 3);
  const missing = table.rows.find((row) => row[3] === 'Paket A kedua');
  assert.equal(missing[5], 'Tidak tersedia');
  assert.match(missing[6], /Belum ada laporan/);
  assert.equal(missing[7], 'Tidak tersedia');
  assert.equal(missing[13], 'Tidak tersedia');
  assert.match(missing[14], /Belum ada review/);
  const reported = table.rows.find((row) => row[3] === 'Paket A pertama');
  assert.equal(reported[6], 28);
  assert.equal(table.rows.filter((row) => row[0] === 'TEST-A').length, 2);
});

test('formal report rows retain source IDs, unavailable legacy reference and expired evidence without fake images', () => {
  const { snapshot } = fixture();
  const table = formalTable(snapshot, 'implementation');
  assert.equal(table.rows.length, 4);
  assert.equal(table.rows[0].length, table.headers.length);
  assert.ok(table.rows.some((row) => row.includes('r-new:v1')));
  assert.ok(table.rows.every((row) => row.includes('Legacy, belum dipetakan')));
  assert.ok(table.rows.some((row) => row.includes('Kedaluwarsa (TTL foto demo 5 menit)')));
});


test('seed laporan membawa foto contoh foto-demo yang tervalidasi', async () => {
  const { provider } = await import('../admin-data.js');
  const actor = { id: 'reviewer-demo', role: 'reviewer', projectCodes: provider.getProjects().map((p) => p.kode) };
  const detail = provider.getReport('L-0911', actor);
  assert.equal(detail.evidenceAvailability, 'available');
  assert.ok(detail.evidenceRefs.length >= 2);
  assert.ok(detail.evidenceRefs.every((ref) => /^foto-demo\/[a-z0-9-]+\.jpg$/.test(ref.url)));
});
test('CSV and printable output carry the same snapshot, filter, period, policy, quality and authority disclaimer', () => {
  const { snapshot } = fixture();
  for (const kind of ['progress', 'implementation']) {
    const csv = buildOperationsCsv(snapshot, kind, NOW);
    const print = buildPrintReport(snapshot, kind, ui, NOW);
    for (const expected of ['snapshot-test', '2026-11-06', 'TEST-A', 'demo-policy-usulan-v1', 'Data demo (ilustratif)', DEMO_LABEL, 'Waktu dibuat', '20:00 WIB', 'BAST', 'persetujuan pembayaran', 'Badan Otorita Pengelola Pantai Utara Jawa']) {
      assert.ok(csv.includes(expected), `CSV ${kind}: ${expected}`);
      assert.ok(print.includes(expected), `print ${kind}: ${expected}`);
    }
    assert.ok(csv.includes(describeFilters(snapshot)));
    assert.ok(print.includes(ui.escapeHtml(describeFilters(snapshot))));
    assert.doesNotMatch(print, /<img|<script|<iframe/);
    assert.match(print, /ops-print-record/);
  }
});

test('all user strings are escaped in printable output and formula-safe in CSV, including project and filter metadata', () => {
  const { raw, packages, filters, progress } = fixture();
  raw.projects[0].nama = '=HYPERLINK("https://example.invalid")';
  raw.reports[0].uraian = '<img src=x onerror=alert(1)> & "danger"';
  packages[0].kontraktor = '\t@SUM(1,2)';
  filters.q = '';
  const snapshot = createOperationsSnapshot(raw, { filters, packages, progress, createdAt: NOW });
  const csv = buildOperationsCsv(snapshot, 'implementation', NOW);
  const print = buildPrintReport(snapshot, 'implementation', ui, NOW);
  const xlsxBytes = buildOperationsXlsx(snapshot, 'implementation', NOW);
  const sheet = zipEntries(xlsxBytes).get('xl/worksheets/sheet1.xml');
  assert.ok(csv.includes("'\t@SUM(1,2)"));
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(sheet.includes('&apos;\t@SUM(1,2)'));
  assert.ok(sheet.includes('&apos;=HYPERLINK'));
  assert.ok(sheet.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.doesNotMatch(sheet, /<f[ >]/);
  assert.doesNotMatch(print, /<img src|onerror=alert\(1\)>/);
  assert.ok(print.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(print.includes('&amp; &quot;danger&quot;'));
});

test('XLSX export is genuine OpenXML from the same frozen snapshot with required metadata rows', () => {
  const { snapshot } = fixture();
  const bytes = buildOperationsXlsx(snapshot, 'implementation', NOW);
  assert.equal(bytes instanceof Uint8Array, true);
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const files = zipEntries(bytes);
  assert.match(files.get('[Content_Types].xml'), /spreadsheetml\.sheet\.main\+xml/);
  const sheet = files.get('xl/worksheets/sheet1.xml');
  for (const expected of ['Laporan Pelaksanaan Proyek', 'Badan Otorita Pengelola Pantai Utara Jawa (BOPPJ)', DEMO_LABEL, 'Waktu dibuat', 'snapshot-test', 'Periode:', '20:00 WIB', 'BAST', 'r-new:v1', 'Kedaluwarsa (TTL foto demo 5 menit)']) {
    assert.ok(sheet.includes(expected), `XLSX metadata: ${expected}`);
  }
  assert.ok(sheet.includes('Progres terlapor (%)'));
  assert.doesNotMatch(sheet, /<f[ >]/);
  const recap = buildOperationsXlsx(snapshot, 'progress', NOW);
  assert.ok(zipEntries(recap).get('xl/worksheets/sheet1.xml').includes('Rekapitulasi Progres Proyek'));
});

test('formal catalog has exactly the agreed names and refuses prasarana and unsupported output kinds at helper boundary', () => {
  const { snapshot } = fixture();
  assert.deepEqual(REPORT_CATALOG.map((entry) => entry.title), ['Rekapitulasi Progres Proyek', 'Laporan Pelaksanaan Proyek', 'Laporan Prasarana Pendukung']);
  assert.equal(REPORT_CATALOG[2].enabled, false);
  for (const kind of ['infrastructure', 'xlsx', 'constructor', 'unknown']) {
    assert.throws(() => formalTable(snapshot, kind), { code: 'UNSUPPORTED' });
    assert.throws(() => buildOperationsCsv(snapshot, kind, NOW), { code: 'UNSUPPORTED' });
    assert.throws(() => buildOperationsXlsx(snapshot, kind, NOW), { code: 'UNSUPPORTED' });
    assert.throws(() => buildPrintReport(snapshot, kind, ui, NOW), { code: 'UNSUPPORTED' });
  }
});
