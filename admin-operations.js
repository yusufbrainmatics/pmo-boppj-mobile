import { makeXlsx } from './src/lib/xlsx.js';
import { DEMO_LABEL } from './src/lib/demo-domain.js';

export const SNAPSHOT_TTL_MS = 15 * 60 * 1000;
export const REPORT_CATALOG = Object.freeze([
  Object.freeze({ id: 'progress', title: 'Rekapitulasi Progres Proyek', enabled: true, description: 'Progres per paket, tanpa agregasi lintas paket yang belum disahkan.' }),
  Object.freeze({ id: 'implementation', title: 'Laporan Pelaksanaan Proyek', enabled: true, description: 'Rincian laporan, revisi sumber, acuan dan hasil monitoring.' }),
  Object.freeze({ id: 'infrastructure', title: 'Laporan Prasarana Pendukung', enabled: false, description: 'Belum aktif: pemilik data, master, alokasi proyek dan definisi status belum disahkan.' }),
]);

const DISCLAIMER = 'Data demo (ilustratif)';
const AUTHORITY = 'Status Diterima berarti terverifikasi monitoring; bukan persetujuan pembayaran dan bukan berita acara serah terima (BAST).';
const STATUS_DEFINITION = "Status 'Diterima' berarti hasil verifikasi monitoring; bukan persetujuan pembayaran dan bukan berita acara serah terima (BAST).";
const POLICY = 'Batas kirim 20:00 WIB (Asia/Jakarta); pengiriman tepat pada batas dihitung tepat waktu.';
const FILTER_KEYS = ['q', 'from', 'to', 'kode', 'packageId', 'provinsi', 'contractor', 'status'];
const REPORT_STATUSES = [
  ['', 'Semua status'], ['queued', 'Antre di perangkat'], ['delivered', 'Terkirim'],
  ['submitted', 'Menunggu verifikasi'], ['needs-revision', 'Perlu revisi'], ['accepted', 'Diterima untuk monitoring'],
];
const COMPLIANCE_STATUSES = [
  ['', 'Semua tindak lanjut'], ['not-due', 'Belum jatuh tempo'], ['missing', 'Belum mengirim'],
  ['queued', 'Antre, belum diterima'], ['on-time', 'Mengirim tepat waktu'], ['late', 'Mengirim terlambat'],
  ['submitted', 'Menunggu verifikasi'], ['needs-revision', 'Perlu revisi'], ['accepted', 'Diterima untuk monitoring'],
];
const TITLES = { daily: 'Performa Harian', approval: 'Verifikasi dan Persetujuan Laporan', missing: 'Kepatuhan Pelaporan', export: 'Pelaporan dan Rekapitulasi' };

export function normalizeFilters(input = {}, today = '') {
  const get = (key) => String((typeof input.get === 'function' ? input.get(key) : input[key]) ?? '').trim();
  return Object.fromEntries(FILTER_KEYS.map((key) => [key, get(key) || (key === 'to' ? today : '')]));
}

export function validateFilters(filters, compliance = false) {
  const errors = {};
  for (const key of ['from', 'to']) {
    const value = filters[key];
    if (!value) continue;
    const date = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      errors[key] = 'Gunakan tanggal kalender yang valid.';
    }
  }
  if (compliance && !filters.to) errors.to = 'Pilih tanggal kewajiban.';
  if (!errors.from && !errors.to && filters.from && filters.to && filters.from > filters.to) {
    errors.from = 'Tanggal awal tidak boleh melampaui tanggal akhir.';
  }
  const statuses = compliance ? COMPLIANCE_STATUSES : REPORT_STATUSES;
  if (!statuses.some(([value]) => value === filters.status)) errors.status = 'Status filter tidak didukung.';
  return errors;
}

export function operationsRoute(page, id = '', filters = {}, kind = '') {
  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) if (filters[key]) query.set(key, filters[key]);
  if (kind) query.set('kind', kind);
  return `#${page}${id ? `/${encodeURIComponent(id)}` : ''}${query.size ? `?${query}` : ''}`;
}

function contractorKey(pkg) { return String(pkg?.contractorId || pkg?.kontraktor || ''); }
function identity(value) {
  if (value && typeof value === 'object') return String(value.nama || value.name || value.id || 'Tidak tersedia');
  return value == null || value === '' ? 'Tidak tersedia' : String(value);
}
function reportId(report) { return report.reportId || report.id; }
function reviewState(report) {
  return report.reviewState || ({ MENUNGGU: 'submitted', DITERIMA: 'accepted', DITOLAK: 'needs-revision' })[report.status] || 'submitted';
}
function deliveryState(report) { return report.delivery || (report.status === 'ANTRE' ? 'queued' : 'delivered'); }
function reviewLabel(report) {
  return ({ submitted: 'Menunggu verifikasi', 'in-review': 'Dalam pemeriksaan', accepted: 'Diterima untuk monitoring', 'needs-revision': 'Perlu revisi' })[reviewState(report)] || 'Status review tidak tersedia';
}
function deliveryLabel(report) { return deliveryState(report) === 'queued' ? 'Antre di perangkat, belum terkirim' : 'Terkirim'; }
function evidenceLabel(report) {
  return ({ expired: 'Kedaluwarsa (TTL foto demo 5 menit)', available: 'Foto lapangan (contoh) tersedia', unavailable: 'Tidak tersedia' })[report.evidenceAvailability] || 'Tidak tersedia';
}
function deliveryComplianceLabel(row) {
  return ({ 'not-due': 'Belum jatuh tempo', missing: 'Belum mengirim', queued: 'Antre, belum diterima', 'on-time': 'Mengirim tepat waktu', late: 'Mengirim terlambat' })[row.deliveryStatus] || 'Tidak tersedia';
}
function lookups(projects, packages) {
  return { projects: new Map(projects.map((row) => [row.kode, row])), packages: new Map(packages.map((row) => [row.packageId, row])) };
}
function matchesContext(row, filters, maps, report = false) {
  const project = maps.projects.get(row.kode);
  const pkg = maps.packages.get(row.packageId);
  if (!project || !pkg) return false;
  if (filters.kode && row.kode !== filters.kode) return false;
  if (filters.packageId && row.packageId !== filters.packageId) return false;
  if (filters.provinsi && project.provinsi !== filters.provinsi) return false;
  if (filters.contractor && contractorKey(pkg) !== filters.contractor) return false;
  if (report && filters.from && row.tanggal < filters.from) return false;
  if (report && filters.to && row.tanggal > filters.to) return false;
  const text = [row.kode, project.nama, project.kabupaten, project.provinsi, pkg.nama, pkg.packageCode, pkg.kontraktor, report ? row.uraian : '', report ? identity(row.createdBy) : ''].join(' ').toLocaleLowerCase('id-ID');
  return !filters.q || text.includes(filters.q.toLocaleLowerCase('id-ID'));
}

export function filterOperationalReports(reports, filters, projects, packages) {
  const maps = lookups(projects, packages);
  return reports.filter((row) => matchesContext(row, filters, maps, true) && (!filters.status || filters.status === deliveryState(row) || filters.status === reviewState(row)))
    .sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)) || a.kode.localeCompare(b.kode) || String(a.packageId).localeCompare(String(b.packageId)) || String(reportId(a)).localeCompare(String(reportId(b))));
}

export function filterCompliance(obligations, filters, projects, packages) {
  const maps = lookups(projects, packages);
  return obligations.filter((row) => matchesContext(row, filters, maps) && (!filters.status || filters.status === row.deliveryStatus || filters.status === row.reviewState))
    .sort((a, b) => a.kode.localeCompare(b.kode) || String(a.packageId).localeCompare(String(b.packageId)));
}

function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

export function createOperationsSnapshot(raw, { filters, packages, progress = {}, createdAt = Date.now(), reportFilters = filters }) {
  const projects = structuredClone(raw.projects);
  const scopedPackages = structuredClone(packages.filter((pkg) => projects.some((project) => project.kode === pkg.kode)));
  const reports = filterOperationalReports(structuredClone(raw.reports), reportFilters, projects, scopedPackages);
  return freezeDeep({
    snapshotId: raw.snapshotId, asOf: raw.asOf, filters: structuredClone(filters), projects,
    packages: scopedPackages, reports, progress: structuredClone(progress), createdAt,
    expiresAt: createdAt + SNAPSHOT_TTL_MS, illustrative: true, policyLabel: raw.policyLabel || POLICY,
  });
}

export function snapshotStatus(snapshot, now = Date.now()) {
  if (!snapshot) return 'empty';
  if (now >= snapshot.expiresAt) return 'expired';
  return snapshot.reports.length ? 'ready' : 'empty';
}

export function canReview(report, actor) {
  if (!actor || actor.role !== 'reviewer' || !actor.projectCodes?.includes(report.kode) || (actor.packageIds && !actor.packageIds.includes(report.packageId))) return { allowed: false, reason: 'Tidak ada penugasan reviewer untuk laporan ini.' };
  if (identity(report.createdBy) === actor.id || report.createdBy?.id === actor.id) return { allowed: false, reason: 'Pembuat revisi tidak boleh memutus laporannya sendiri.' };
  if (deliveryState(report) !== 'delivered') return { allowed: false, reason: 'Laporan masih antre di perangkat dan belum dapat diputus.' };
  if (!['submitted', 'in-review'].includes(reviewState(report))) return { allowed: false, reason: 'Revisi ini sudah diputus. Koreksi harus melalui revisi pengganti, bukan menimpa keputusan lama.' };
  if (!Number.isInteger(report.version) || report.version < 1) return { allowed: false, reason: 'Versi laporan tidak tersedia. Muat ulang sebelum memutus.' };
  return { allowed: true, reason: '' };
}

export function escapeSpreadsheetFormula(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  const text = String(value ?? '');
  const prefix = text.match(/^[\s\p{Cc}\p{Cf}]*/u)[0];
  return /^[\s\p{Cc}\p{Cf}]*[=+\-@]/u.test(text) || /[\p{Cc}\p{Cf}]/u.test(prefix) ? `'${text}` : text;
}

export function serializeCsv(rows) {
  return '\uFEFF' + rows.map((row) => row.map((cell) => `"${escapeSpreadsheetFormula(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n';
}

function reportType(kind) {
  const item = REPORT_CATALOG.find((entry) => entry.id === kind);
  if (!item?.enabled) throw Object.assign(new Error('Jenis laporan belum didukung. Prasarana tetap nonaktif sampai domain disahkan.'), { code: 'UNSUPPORTED' });
  return item;
}
function scalar(value) { return value == null || value === '' ? 'Tidak tersedia' : value; }
function sourceText(value) {
  if (value == null) return 'Tidak tersedia';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function describeFilters(snapshot) {
  const { filters } = snapshot;
  const project = snapshot.projects.find((row) => row.kode === filters.kode);
  const pkg = snapshot.packages.find((row) => row.packageId === filters.packageId);
  const contractor = snapshot.packages.find((row) => contractorKey(row) === filters.contractor);
  const status = [...REPORT_STATUSES, ...COMPLIANCE_STATUSES].find(([key]) => key === filters.status)?.[1];
  return [
    `Periode: ${filters.from || 'seluruh tanggal awal'} s.d. ${filters.to || 'seluruh tanggal akhir'}`,
    `Proyek: ${project ? `${project.kode} ${project.nama}` : filters.kode || 'semua dalam penugasan'}`,
    `Paket: ${pkg?.nama || filters.packageId || 'semua'}`, `Wilayah: ${filters.provinsi || 'semua'}`,
    `Kontraktor: ${contractor?.kontraktor || filters.contractor || 'semua'}`, `Status: ${status || 'semua'}`,
    `Pencarian: ${filters.q || 'tidak dibatasi'}`,
  ].join('; ');
}

export function formalTable(snapshot, kind) {
  reportType(kind);
  const maps = lookups(snapshot.projects, snapshot.packages);
  if (kind === 'implementation') {
    return {
      headers: ['Kode proyek', 'Proyek', 'Wilayah', 'Paket', 'Perusahaan penanggung jawab', 'Tanggal kerja', 'ID laporan', 'ID revisi', 'Versi', 'Pembuat laporan', 'Progres terlapor (%)', 'Volume harian', 'Satuan', 'Tenaga kerja', 'Cuaca', 'Uraian', 'Pengiriman', 'Review', 'Bukti', 'Acuan', 'Waktu penerimaan', 'Pembaruan'],
      rows: snapshot.reports.map((report) => {
        const project = maps.projects.get(report.kode);
        const pkg = maps.packages.get(report.packageId);
        return [report.kode, scalar(project?.nama), scalar(project?.provinsi), scalar(pkg?.nama), scalar(pkg?.kontraktor), report.tanggal, reportId(report), scalar(report.revisionId), report.version, identity(report.createdBy), scalar(report.progres), scalar(report.volume), scalar(report.satuan), scalar(report.tenaga), scalar(report.cuaca), scalar(report.uraian), deliveryLabel(report), reviewLabel(report), evidenceLabel(report), report.referenceVersionId || 'Legacy, belum dipetakan', scalar(report.receivedAt), scalar(report.updatedAt)];
      }),
    };
  }
  const latest = new Map();
  for (const report of snapshot.reports) {
    const previous = latest.get(report.packageId);
    if (!previous || report.tanggal > previous.tanggal || (report.tanggal === previous.tanggal && report.version > previous.version)) latest.set(report.packageId, report);
  }
  // Paket wajib tanpa laporan pada periode/filter tetap terlihat sebagai belum ada laporan, tidak hilang dari rekap.
  const rows = [...snapshot.packages].sort((a, b) => a.kode.localeCompare(b.kode) || String(a.packageId).localeCompare(String(b.packageId))).map((pkg) => {
    const report = latest.get(pkg.packageId);
    const project = maps.projects.get(pkg.kode);
    const progress = snapshot.progress[pkg.packageId] || {};
    return [pkg.kode, scalar(project?.nama), scalar(project?.provinsi), scalar(pkg.nama), scalar(pkg.kontraktor),
      report ? report.tanggal : 'Tidak tersedia', report ? scalar(report.progres) : 'Belum ada laporan pada periode/filter ini',
      scalar(progress.verified), scalar(progress.source?.workDate), scalar(progress.baseline), scalar(progress.deviation), sourceText(progress.source),
      report ? reportId(report) : 'Tidak tersedia', report ? scalar(report.revisionId) : 'Tidak tersedia', report ? reviewLabel(report) : 'Belum ada review'];
  });
  return {
    headers: ['Kode proyek', 'Proyek', 'Wilayah', 'Paket', 'Perusahaan penanggung jawab', 'Tanggal terakhir dalam periode', 'Terakhir terlapor dalam periode (%)', 'Progres terverifikasi (%)', 'Tanggal keadaan terverifikasi', 'Baseline (%)', 'Deviasi (poin %)', 'Sumber progres terverifikasi', 'ID laporan terakhir', 'ID revisi', 'Review laporan terakhir'],
    rows,
  };
}

function exportMetadata(snapshot, kind, now = Date.now()) {
  return [
    [reportType(kind).title], ['Badan Otorita Pengelola Pantai Utara Jawa (BOPPJ)'], [DISCLAIMER], ['Label data', DEMO_LABEL],
    ['Snapshot', snapshot.snapshotId], ['Waktu data (Asia/Jakarta)', dateTime(snapshot.asOf)], ['Waktu dibuat (Asia/Jakarta)', dateTime(now)], ['Waktu sumber ISO', snapshot.asOf], ['Filter', describeFilters(snapshot)],
    ['Kebijakan', snapshot.policyLabel], ['Cut-off usulan', POLICY],
    ['Definisi status', STATUS_DEFINITION],
    ['Definisi', 'Antre belum memenuhi kewajiban kirim; delivered/sudah terkirim adalah simulasi lokal. Review menunggu tetap memenuhi kewajiban kirim jika delivered.'],
    ['Definisi progres', 'Terlapor mengikuti periode. Terverifikasi adalah keadaan efektif terkini per paket pada snapshot, bukan maksimum historis atau rata-rata lintas paket. Paket wajib tanpa laporan pada periode/filter tetap tercantum dengan penanda belum ada laporan.'],
    ['Baseline/deviasi', 'Tidak tersedia bila acuan pembanding belum disahkan; bukan nol.'], ['Batas kewenangan', AUTHORITY],
    ['Retensi preview', 'Preview di memori berlaku 15 menit; bukan kebijakan retensi bukti.'], [],
  ];
}

export function buildOperationsCsv(snapshot, kind, now = Date.now()) {
  reportType(kind);
  if (snapshotStatus(snapshot, now) !== 'ready') throw Object.assign(new Error('Preview kosong atau kedaluwarsa. Bentuk preview baru sebelum mengunduh.'), { code: 'SNAPSHOT_UNAVAILABLE' });
  const table = formalTable(snapshot, kind);
  return serializeCsv([...exportMetadata(snapshot, kind, now), table.headers, ...table.rows]);
}

export function buildOperationsXlsx(snapshot, kind, now = Date.now()) {
  reportType(kind);
  if (snapshotStatus(snapshot, now) !== 'ready') throw Object.assign(new Error('Preview kosong atau kedaluwarsa. Bentuk preview baru sebelum mengunduh.'), { code: 'SNAPSHOT_UNAVAILABLE' });
  const table = formalTable(snapshot, kind);
  const metadata = exportMetadata(snapshot, kind, now).filter((row) => row.length).map(([label, value]) => (value === undefined ? String(label) : `${label}: ${value}`)).slice(1);
  return makeXlsx({ title: reportType(kind).title, metadata, headers: table.headers, rows: table.rows });
}

export function buildPrintReport(snapshot, kind, ui, now = Date.now()) {
  reportType(kind);
  if (snapshotStatus(snapshot, now) !== 'ready') throw Object.assign(new Error('Preview kosong atau kedaluwarsa. Bentuk preview baru sebelum mencetak.'), { code: 'SNAPSHOT_UNAVAILABLE' });
  const e = ui.escapeHtml;
  const table = formalTable(snapshot, kind);
  return `<header><h1>${e(reportType(kind).title)}</h1><p>Badan Otorita Pengelola Pantai Utara Jawa (BOPPJ)</p></header>
    <dl>${exportMetadata(snapshot, kind, now).slice(2).filter((row) => row.length).map(([label, value]) => `<div><dt>${e(label)}</dt><dd>${e(value ?? '')}</dd></div>`).join('')}</dl>
    <p>${e(table.rows.length)} baris ilustratif pada snapshot ${e(snapshot.snapshotId)}.</p>
    ${table.rows.map((row, index) => `<section class="ops-print-record"><h2>${e(index + 1)}. ${e(row[0])} · ${e(row[3])}</h2><dl>${table.headers.map((label, column) => `<div><dt>${e(label)}</dt><dd>${e(row[column])}</dd></div>`).join('')}</dl></section>`).join('')}
    <footer><p>${e(AUTHORITY)}</p><p>PDF dibuat melalui dialog cetak browser, pilih Simpan sebagai PDF. Tidak ada pengiriman atau arsip produksi.</p></footer>`;
}

function currentRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const separator = hash.indexOf('?');
  const path = separator < 0 ? hash : hash.slice(0, separator);
  const query = new URLSearchParams(separator < 0 ? '' : hash.slice(separator + 1));
  const [page, ...segments] = path.split('/');
  let id = '';
  try { id = decodeURIComponent(segments.join('/')); } catch { id = '\uFFFD'; }
  return { page, id, query };
}
function providerFilters(filters) {
  // Periode diterapkan ulang secara lokal pada filterOperationalReports; from/to tidak diteruskan ke provider
  // agar snapshot master tetap memuat paket wajib tanpa laporan pada periode tersebut.
  return Object.fromEntries(['kode', 'packageId', 'provinsi'].filter((key) => filters[key]).map((key) => [key, filters[key]]));
}
function safeError(error) {
  if (['CONFLICT', 'STALE', 'STALE_VERSION', 'VERSION_CONFLICT'].includes(error?.code)) return 'Konflik versi: data telah berubah. Muat ulang detail dan periksa revisi terbaru sebelum memutus kembali.';
  if (error?.code === 'FORBIDDEN') return 'Akses ditolak. Laporan atau tindakan ini berada di luar penugasan reviewer demo.';
  if (error?.code === 'NOT_FOUND') return 'Laporan tidak tersedia atau tidak dapat dibaca dalam penugasan ini.';
  if (error?.code === 'UNSUPPORTED' || error?.code === 'SNAPSHOT_UNAVAILABLE') return error.message;
  return 'Operasi gagal. Data tidak diganti dengan fixture lain. Muat ulang dan coba kembali; bila tetap gagal, periksa provider demo.';
}
function dateTime(value) {
  if (!value) return 'Tidak tersedia';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(date) + ' WIB' : String(value);
}

export async function initOperations({ daily, approval, missing, exportRoot } = {}, dependencies = {}) {
  const roots = Object.fromEntries(Object.entries({ daily, approval, missing, export: exportRoot }).filter(([, root]) => root));
  for (const root of Object.values(roots)) {
    root.classList.add('ops');
    root.setAttribute('aria-busy', 'true');
    root.innerHTML = '<p role="status">Memuat laporan dan penugasan demo…</p>';
  }
  let data, ui;
  try {
    [data, ui] = await Promise.all([dependencies.data || import('./admin-data.js'), dependencies.ui || import('./admin-ui.js')]);
  } catch {
    for (const root of Object.values(roots)) {
      root.setAttribute('aria-busy', 'false');
      root.textContent = 'Modul operasional gagal dimuat. Tidak ada fallback data. Muat ulang halaman setelah provider dan admin-ui tersedia.';
    }
    return () => {};
  }
  const { provider, DEMO_REVIEWER: actor, DEMO_TODAY: today } = data;
  const { escapeHtml: e, formatDate, formatNumber, notify } = ui;
  const states = Object.fromEntries(Object.keys(roots).map((page) => [page, { filters: normalizeFilters({}, today), kind: 'progress', snapshot: null, stale: false, detail: null, keys: new Map(), busy: false }]));
  const listeners = [];
  let disposed = false;
  const number = (value, suffix = '') => value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : `${formatNumber(Number(value))}${suffix}`;
  const date = (value) => value ? formatDate(value) : 'Tidak tersedia';
  const options = (rows, selected) => rows.map(([value, label]) => `<option value="${e(value)}"${selected === String(value) ? ' selected' : ''}>${e(label)}</option>`).join('');
  const button = (action, label, primary = false) => `<button type="button" class="ops-button${primary ? ' ops-primary' : ''}" data-action="${action}">${label}</button>`;
  const status = (label, tone = '') => `<span class="ops-status ${tone}">${e(label)}</span>`;
  function metadata() {
    const projects = provider.getProjects({}, actor).filter((project) => actor.projectCodes?.includes(project.kode));
    const codes = new Set(projects.map((project) => project.kode));
    return { projects, packages: provider.getPackages({}, actor).filter((pkg) => codes.has(pkg.kode) && (!actor.packageIds || actor.packageIds.includes(pkg.packageId))) };
  }
  function pageHeader(page) {
    const descriptions = {
      daily: 'Baca laporan per paket dan tanggal kerja. Progres terlapor tidak otomatis menjadi progres terverifikasi.',
      approval: 'Pemeriksaan oleh reviewer yang ditugaskan.',
      missing: 'Kewajiban dihitung per paket aktif. Status pengiriman dipisahkan dari hasil review.',
      export: 'Bentuk preview, lalu unduh Excel atau cetak PDF dari data yang sama.',
    };
    return `<header class="ops-head"><h1 tabindex="-1">${TITLES[page]}</h1><p>${descriptions[page]}</p></header><p class="ops-notice">${e(data.DEMO_LABEL || DISCLAIMER)} ${e(DISCLAIMER)} Data hanya pada sesi/tab ini, tanpa sinkronisasi lintas pengguna.</p>`;
  }
  function filtersForm(page, state, meta) {
    const f = state.filters;
    const packages = meta.packages.filter((pkg) => !f.kode || pkg.kode === f.kode);
    const contractors = [...new Map(meta.packages.filter((pkg) => contractorKey(pkg)).map((pkg) => [contractorKey(pkg), pkg.kontraktor || pkg.contractorId])).entries()];
    return `<form class="ops-filters" aria-label="Filter ${TITLES[page]}" novalidate>
      <label class="ops-search">Cari proyek, paket atau uraian<input name="q" type="search" value="${e(f.q)}" maxlength="200"></label>
      ${page !== 'missing' ? `<label>Dari tanggal kerja<input name="from" type="date" value="${e(f.from)}" aria-describedby="${page}-filter-error"></label>` : ''}
      <label>${page === 'missing' ? 'Tanggal kewajiban' : 'Sampai tanggal kerja'}<input name="to" type="date" value="${e(f.to)}" aria-describedby="${page}-filter-error"${page === 'missing' ? ' required' : ''}></label>
      <label>Proyek<select name="kode">${options([['', 'Semua proyek dalam penugasan'], ...meta.projects.map((project) => [project.kode, `${project.kode} · ${project.nama}`])], f.kode)}</select></label>
      <label>Paket<select name="packageId">${options([['', 'Semua paket'], ...packages.map((pkg) => [pkg.packageId, `${pkg.kode} · ${pkg.nama}`])], f.packageId)}</select></label>
      <label>Wilayah (provinsi)<select name="provinsi">${options([['', 'Semua wilayah'], ...[...new Set(meta.projects.map((project) => project.provinsi))].sort().map((value) => [value, value])], f.provinsi)}</select></label>
      <label>Kontraktor<select name="contractor">${options([['', 'Semua kontraktor'], ...contractors], f.contractor)}</select></label>
      <label>${page === 'missing' ? 'Tindak lanjut' : 'Status pengiriman / review'}<select name="status">${options(page === 'missing' ? COMPLIANCE_STATUSES : REPORT_STATUSES, f.status)}</select></label>
      <div class="ops-actions"><button class="ops-button ops-primary" type="submit">${page === 'export' ? 'Bentuk preview' : 'Terapkan filter'}</button>${button('reset', 'Reset filter')}</div>
      <p id="${page}-filter-error" class="ops-error ops-wide" role="alert" hidden></p>
    </form>`;
  }
  function snapshotMeta(state) {
    const snap = state.snapshot;
    return `<div class="ops-snapshot"><p><b>Snapshot ${e(snap.snapshotId)}</b> · Waktu data ${e(dateTime(snap.asOf))}</p><p>${e(describeFilters(snap))}</p><p class="ops-stale" role="status"${state.stale ? '' : ' hidden'}>Data berubah setelah dibaca. Unduhan tetap memakai data preview sampai diperbarui.</p>${button('refresh', 'Perbarui data')}</div>`;
  }
  function tableWrap(label, headers, rows, caption) {
    return `<div class="ops-table-scroll" role="region" aria-label="${e(label)}" tabindex="0"><table class="ops-table"><caption>${e(caption)}</caption><thead><tr>${headers.map((header) => `<th scope="col">${e(header)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  }
  function emptyState(page, state) {
    return `<div class="ops-empty"><h2>${page === 'missing' ? 'Tidak ada kewajiban yang cocok' : 'Tidak ada laporan yang cocok'}</h2><p>${e(describeFilters(state.snapshot))}</p><p>${page === 'missing' ? 'Paket di luar masa aktif tidak dianggap wajib lapor.' : 'Ubah periode atau paket. Tidak ada nilai nol resmi atau dokumen kosong yang diterbitkan.'}</p>${button('reset', 'Reset filter')}</div>`;
  }
  function capture(state, meta, page) {
    const source = provider.createSnapshot(providerFilters(state.filters), actor);
    const raw = page === 'missing' ? { ...source, projects: meta.projects } : source;
    const reportFilters = page === 'missing' ? { ...state.filters, status: '' } : state.filters;
    const reports = filterOperationalReports(raw.reports, reportFilters, raw.projects, meta.packages);
    const progress = {};
    for (const pkg of meta.packages) {
      progress[pkg.packageId] = provider.getProgress(pkg.kode, { packageId: pkg.packageId, actor });
    }
    state.snapshot = createOperationsSnapshot(raw, { filters: state.filters, reportFilters, packages: meta.packages, progress });
    state.stale = false;
  }
  function operationalList(page, state) {
    const snap = state.snapshot;
    const reports = page === 'approval' ? snap.reports.filter((report) => deliveryState(report) === 'delivered') : snap.reports;
    const maps = lookups(snap.projects, snap.packages);
    if (!reports.length) return emptyState(page, state) + (page === 'approval' ? '<p>Antre di perangkat bukan objek review. Lihat pengiriman yang belum diakui di Performa Harian.</p>' : '');
    const accepted = reports.filter((report) => reviewState(report) === 'accepted').length;
    const pending = reports.filter((report) => reviewState(report) === 'submitted' && deliveryState(report) === 'delivered').length;
    const revision = reports.filter((report) => reviewState(report) === 'needs-revision').length;
    const rows = reports.map((report) => {
      const project = maps.projects.get(report.kode);
      const pkg = maps.packages.get(report.packageId);
      const progress = snap.progress[report.packageId] || {};
      return `<tr><td class="ops-nowrap">${e(date(report.tanggal))}</td>
        <td class="ops-project">${e(project?.nama || 'Nama proyek tidak tersedia')}</td>
        <td class="ops-nowrap">${e(pkg?.packageCode || 'Kode paket tidak tersedia')}</td>
        <td class="ops-company">${e(pkg?.kontraktor || 'Perusahaan belum tersedia')}</td><td class="ops-numeric">${e(number(report.progres, '%'))}</td>
        <td class="ops-numeric">${e(number(progress.verified, '%'))}<small>${e(progress.verified == null ? 'Belum ada revisi diterima' : progress.source?.workDate ? date(progress.source.workDate) : 'Tanggal efektif tidak tersedia')}</small></td>
        <td class="ops-numeric">${e(number(report.volume))} ${e(report.satuan || '')}</td><td class="ops-numeric">${e(number(report.tenaga))} orang</td><td>${e(report.cuaca || 'Cuaca tidak tersedia')}</td>
        <td>${status(deliveryLabel(report), deliveryState(report) === 'queued' ? 'ops-wait' : '')}</td><td>${status(reviewLabel(report), reviewState(report) === 'accepted' ? 'ops-ok' : reviewState(report) === 'needs-revision' ? 'ops-bad' : 'ops-wait')}</td>
        <td>${e(evidenceLabel(report))}</td><td><a class="ops-link" href="${e(operationsRoute(page, reportId(report), state.filters))}" aria-label="Detail laporan ${e(reportId(report))}">Detail laporan</a></td></tr>`;
    });
    return `<p class="ops-summary"><b>${e(reports.length)} laporan pada filter ini.</b> ${e(pending)} menunggu verifikasi · ${e(revision)} perlu revisi · ${e(accepted)} diterima untuk monitoring.</p>
      <p>Progres terverifikasi adalah keadaan efektif terkini per paket pada waktu snapshot, bukan nilai maksimum atau rata-rata. Baseline: —. Deviasi: belum dapat dihitung tanpa acuan sebanding.</p>
      ${tableWrap(TITLES[page], ['Tanggal kerja', 'Proyek', 'Paket', 'Perusahaan penanggung jawab', 'Terlapor', 'Terverifikasi terkini', 'Volume harian', 'Tenaga kerja', 'Cuaca', 'Pengiriman', 'Review', 'Bukti', 'Tindakan'], rows, `${reports.length} laporan sesuai filter`)}`;
  }
  function history(report) {
    const revisions = report.revisions || [];
    const decisions = report.decisions || [];
    const revisionRows = revisions.map((revision) => `<tr><td>${e(revision.version ?? revision.revisionNumber ?? 'Tidak tersedia')}<small>${e(revision.revisionId || revision.id || '')}</small><small>${revision.supersedesRevisionId ? `Menggantikan ${e(revision.supersedesRevisionId)}` : 'Revisi awal'}</small></td><td>${e(number(revision.progres ?? revision.progressReported, '%'))}</td><td>${e(dateTime(revision.createdAt || revision.updatedAt))}</td><td>${e(identity(revision.createdBy))}</td><td>${e(revision.correctionReason || revision.reason || revision.uraian || 'Tidak tersedia')}</td></tr>`);
    const decisionRows = decisions.map((decision) => `<tr><td>${e(decision.decisionId || 'Tidak tersedia')}<small>Sebelumnya: ${e(decision.previousDecisionId || 'Tidak ada')}</small></td><td>${e(decision.revisionId || 'Tidak tersedia')}</td><td>${e(({ accepted: 'Diterima untuk monitoring', 'needs-revision': 'Perlu revisi' })[decision.action] || decision.action || 'Tidak tersedia')}</td><td>${e(identity(decision.actor || decision.reviewer || decision.reviewerId || decision.createdBy))}</td><td>${e(dateTime(decision.decidedAt || decision.createdAt))}</td><td>${e(decision.reason || 'Tanpa catatan tambahan')}</td></tr>`);
    return `<section class="ops-section"><h2>Riwayat revisi</h2>${revisionRows.length ? tableWrap('Riwayat revisi immutable', ['Revisi', 'Progres', 'Dibuat', 'Pembuat revisi', 'Catatan revisi'], revisionRows, 'Revisi lama tidak ditimpa oleh koreksi') : '<p>Riwayat revisi belum tersedia pada adapter.</p>'}</section>
      <section class="ops-section"><h2>Riwayat keputusan</h2>${decisionRows.length ? tableWrap('Riwayat keputusan monitoring', ['Keputusan / sebelumnya', 'Revisi', 'Hasil', 'Reviewer', 'Waktu', 'Alasan'], decisionRows, 'Keputusan merujuk revisi tertentu, tanpa efek pembayaran') : '<p>Belum ada keputusan untuk laporan ini.</p>'}</section>`;
  }
  const BASE = import.meta.env.BASE_URL
  function fotoBukti(report) {
    const urls = (report.evidenceRefs ?? []).filter((ref) => ref.url)
    if (!urls.length) return ''
    return `<div class="ops-foto-grid">${urls.map((ref, index) => `<a href="${e(BASE + ref.url)}" target="_blank" rel="noopener"><img src="${e(BASE + ref.url)}" alt="Foto lapangan ${index + 1} (contoh)" loading="lazy"></a>`).join('')}</div>`
  }
  function detailView(page, state, id) {
    const report = provider.getReport(id, actor);
    state.detail = report;
    const snap = state.snapshot;
    const project = snap.projects.find((row) => row.kode === report.kode);
    const pkg = snap.packages.find((row) => row.packageId === report.packageId);
    const progress = provider.getProgress(report.kode, { packageId: report.packageId });
    const permission = canReview(report, actor);
    const down = progress.verified != null && report.progres < progress.verified;
    const measurements = report.itemMeasurements || [];
    return `<nav class="ops-breadcrumb" aria-label="Breadcrumb"><a class="ops-link" href="${e(operationsRoute(page, '', state.filters))}">Kembali ke daftar</a><span>${e(reportId(report))}</span></nav>
      <section class="ops-detail"><h2 tabindex="-1" data-detail-heading>Laporan ${e(reportId(report))}</h2><p>${e(report.kode)} · ${e(project?.nama || 'Nama proyek tidak tersedia')} · ${e(pkg?.nama || report.packageId)} · ${e(date(report.tanggal))}</p>
      <div class="ops-stale" role="status"${state.stale ? '' : ' hidden'}>Detail berubah. Muat ulang sebelum memutus; formulir ini tetap terikat versi yang dibaca.</div>
      <div class="ops-actions">${button('reload-detail', 'Muat ulang detail')}${page === 'daily' ? `<a class="ops-link" href="${e(operationsRoute('approval', reportId(report), state.filters))}">Buka pemeriksaan</a>` : ''}</div>
      <dl class="ops-facts">${[
        ['Revisi / versi', `${report.revisionId} / v${report.version}`], ['Pelapor', identity(report.createdBy)], ['Kontraktor', pkg?.kontraktor || 'Tidak tersedia'],
        ['Progres terlapor', number(report.progres, '%')], ['Terverifikasi terkini per paket', `${number(progress.verified, '%')} (${progress.verified == null ? 'belum ada keputusan diterima' : progress.source?.workDate ? date(progress.source.workDate) : 'tanggal efektif tidak tersedia'})`],
        ['Baseline', number(progress.baseline, '%')], ['Deviasi', progress.deviation == null ? '— (belum dapat dihitung)' : number(progress.deviation, ' poin %')],
        ['Volume harian', `${number(report.volume)} ${report.satuan || ''}`], ['Tenaga kerja', `${number(report.tenaga)} orang`], ['Cuaca', report.cuaca || 'Tidak tersedia'],
        ['Pengiriman', deliveryLabel(report)], ['Review', reviewLabel(report)], ['Waktu penerimaan', dateTime(report.receivedAt)], ['Pembaruan', dateTime(report.updatedAt)],
        ['Acuan', report.referenceVersionId || 'Legacy, belum dipetakan. Tidak otomatis memakai KAK terbaru.'], ['Sumber progres', sourceText(progress.source)],
      ].map(([label, value]) => `<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>
      <h3>Uraian pekerjaan</h3><p class="ops-prose">${e(report.uraian || 'Tidak tersedia')}</p>
      <h3>Item dan acuan</h3>${measurements.length ? `<ul>${measurements.map((item) => `<li>${e(item.itemId || item.kode || 'Item belum dipetakan')}: ${e(item.volume ?? item.value ?? 'Tidak tersedia')} ${e(item.satuan || '')}</li>`).join('')}</ul>` : '<p>Belum ada pengukuran item terikat acuan pada laporan legacy ini.</p>'}
      <h3>Bukti dan konteks pemeriksaan</h3>${fotoBukti(report)}<p>${e(evidenceLabel(report))}.</p>
      <p>Metadata lokasi/EXIF tidak tersedia pada adapter ini; geotag tidak diklaim terverifikasi.</p>
      ${down ? '<p class="ops-notice">Progres laporan lebih rendah dari progres efektif yang diterima. Periksa alasan koreksi dan riwayat; penurunan bukan penolakan otomatis.</p>' : ''}
      ${report.anomali?.length ? `<ul>${report.anomali.map((item) => `<li>${e(typeof item === 'object' ? item.message || item.reason || sourceText(item) : item)}</li>`).join('')}</ul>` : ''}
      ${report.catatan ? `<p class="ops-notice">Catatan: ${e(report.catatan)}</p>` : ''}
      ${page === 'approval' ? `<section class="ops-section"><h3>Keputusan simulasi</h3><p>${e(AUTHORITY)}</p><p>Bukti tidak dapat diverifikasi permanen. Tidak ada keputusan produksi. Aktor: ${e(actor.id)}, reviewer demo dalam penugasan.</p>
        ${permission.allowed ? `<form class="ops-decision" novalidate><label>Alasan keputusan (wajib untuk perlu revisi)<textarea name="reason" rows="3" maxlength="2000" aria-describedby="ops-decision-error" placeholder="Tuliskan koreksi yang dapat ditindaklanjuti"></textarea></label><p id="ops-decision-error" class="ops-error" role="alert" hidden></p><div class="ops-actions"><button type="submit" name="decision" value="accepted" class="ops-button ops-primary">Terima</button><button type="submit" name="decision" value="needs-revision" class="ops-button">Simulasi: perlu revisi</button></div><p>Keputusan mengunci revisi ${e(report.revisionId)} pada versi ${e(report.version)} yang sedang dibaca.</p></form>` : `<p class="ops-notice">${e(permission.reason)}</p>`}</section>` : ''}
      ${history(report)}</section>`;
  }
  function complianceView(state) {
    const snap = state.snapshot;
    const obligations = provider.getCompliance({ date: state.filters.to, asOf: snap.asOf, filters: providerFilters(state.filters), actor });
    const rows = filterCompliance(obligations, state.filters, snap.projects, snap.packages);
    const maps = lookups(snap.projects, snap.packages);
    const counts = (predicate) => rows.filter(predicate).length;
    const summary = `<p class="ops-summary"><b>${e(rows.length)} kewajiban paket pada filter ini.</b> ${e(counts((row) => row.deliveryStatus === 'missing'))} belum mengirim · ${e(counts((row) => row.deliveryStatus === 'queued'))} antre · ${e(counts((row) => row.deliveryStatus === 'late'))} mengirim terlambat · ${e(counts((row) => row.reviewState === 'submitted' && ['on-time', 'late'].includes(row.deliveryStatus)))} menunggu verifikasi · ${e(counts((row) => row.reviewState === 'needs-revision'))} perlu revisi.</p>`;
    const tableRows = rows.map((row) => {
      const pkg = maps.packages.get(row.packageId);
      const project = maps.projects.get(row.kode);
      const last = snap.reports.find((report) => report.packageId === row.packageId);
      const followUps = row.followUps || [];
      return `<tr><td class="ops-project">${e(project?.nama || 'Nama proyek tidak tersedia')}</td>
        <td class="ops-nowrap">${e(pkg?.packageCode || 'Kode paket tidak tersedia')}</td><td class="ops-company">${e(pkg?.kontraktor || 'Perusahaan belum tersedia')}</td>
        <td>${status(deliveryComplianceLabel(row), ['late', 'missing', 'queued'].includes(row.deliveryStatus) ? 'ops-wait' : 'ops-ok')}</td><td>${e(row.reviewState ? reviewLabel({ reviewState: row.reviewState }) : 'Belum ada review')}</td><td>${e(dateTime(row.receivedAt))}</td>
        <td>${e(identity(row.pic))}</td><td>${e(row.cutOff ? dateTime(row.cutOff) : '20:00 WIB, usulan')}</td><td><details><summary>Dasar kewajiban</summary><p>${e(row.obligationReason || row.reason || 'Kewajiban demo berdasarkan masa aktif paket; kalender/pengecualian resmi belum disahkan.')}</p></details></td>
        <td>${row.reportId ? `<a class="ops-link" href="${e(operationsRoute('daily', row.reportId, { ...state.filters, from: '', status: '' }))}">Laporan tanggal ini</a>` : 'Belum ada kiriman diterima'}${last ? `<small>Terakhir ${e(date(last.tanggal))}, ${e(deliveryLabel(last))}</small>` : '<small>Belum ada laporan sampai tanggal ini.</small>'}</td>
        <td><details><summary>Catatan tindak lanjut (${e(followUps.length)})</summary>${followUps.length ? `<ol>${followUps.map((note) => `<li><p class="ops-prose">${e(note.note || note.catatan || '')}</p><small>${e(identity(note.actor || note.createdBy))} · ${e(dateTime(note.createdAt || note.at))}</small></li>`).join('')}</ol>` : '<p>Belum ada catatan lokal.</p>'}
        <form class="ops-follow-up" data-package="${e(row.packageId)}" data-date="${e(row.date || state.filters.to)}" novalidate><label>Catatan untuk paket/tanggal ini<textarea name="note" rows="3" maxlength="2000" required></textarea></label><p class="ops-error" role="alert" hidden></p><button type="submit" class="ops-button">Simpan catatan lokal</button></form></details></td></tr>`;
    });
    return `<p class="ops-notice">${e(POLICY)} Evaluasi ${e(dateTime(snap.asOf))}. Versi kebijakan: ${e(rows[0]?.policyVersion || snap.policyLabel)}.</p>
      <p>Kiriman delivered yang menunggu verifikasi tetap memenuhi kewajiban kirim. Antrean perangkat tidak memenuhi kewajiban layanan. Catatan tindak lanjut hanya lokal, tidak mengirim WhatsApp, email atau notifikasi eksternal.</p>
      ${rows.length ? summary + tableWrap('Kepatuhan paket aktif', ['Proyek', 'Paket', 'Perusahaan penanggung jawab', 'Pengiriman', 'Review', 'Diterima pada', 'PIC', 'Batas waktu', 'Dasar kewajiban', 'Laporan', 'Tindak lanjut lokal'], tableRows, `${rows.length} paket eligible pada ${state.filters.to}; paket di luar masa aktif dikecualikan oleh provider`) : emptyState('missing', state)}`;
  }
  function exportView(state) {
    const snap = state.snapshot;
    const lifecycle = snapshotStatus(snap);
    const table = REPORT_CATALOG.some((item) => item.id === state.kind && item.enabled) ? formalTable(snap, state.kind) : null;
    const ready = lifecycle === 'ready' && table;
    return `<fieldset class="ops-catalog"><legend>Katalog laporan</legend>${REPORT_CATALOG.map((item) => `<label class="ops-catalog-item${item.enabled ? '' : ' ops-disabled'}"><input type="radio" name="reportKind" value="${item.id}"${state.kind === item.id ? ' checked' : ''}${item.enabled ? '' : ' disabled'}><span><b>${item.title}</b><small>${item.description}</small></span></label>`).join('')}</fieldset>
      <section class="ops-section" aria-labelledby="ops-preview-title"><h2 id="ops-preview-title">Preview ${e(table ? reportType(state.kind).title : 'tidak didukung')}</h2>
      <p class="ops-lifecycle" role="status">${lifecycle === 'expired' ? 'Kedaluwarsa: bentuk preview baru.' : ready ? `Siap: ${table.rows.length} baris data.` : 'Kosong: tidak ada dokumen yang dapat diterbitkan.'}</p>
      <p class="ops-dirty" role="status" hidden>Pilihan filter berubah. Bentuk preview baru sebelum mengunduh.</p>
      <div class="ops-actions"><button type="button" class="ops-button ops-primary" data-action="xlsx"${ready ? '' : ' disabled'}>Unduh XLSX</button><button type="button" class="ops-button" data-action="csv"${ready ? '' : ' disabled'}>Unduh CSV (opsional)</button><button type="button" class="ops-button" data-action="print"${ready ? '' : ' disabled'}>Cetak / Simpan PDF</button></div>
      <p>XLSX OpenXML nyata dibuat lokal di perangkat ini dari snapshot yang sama dengan preview. CSV opsional, UTF-8 kompatibel Excel. PDF menggunakan dialog cetak browser. Tidak ada job server, link unduh produksi atau arsip bukti. Preview tidak menyegarkan diri saat data berubah.</p>
      <p>${e(AUTHORITY)} Baseline/deviasi yang tidak tersedia bukan nol. Progres diverifikasi terkini per paket ditampilkan terpisah dari laporan dalam periode.</p>
      <p class="ops-export-error ops-error" role="alert" hidden></p>
      ${table?.rows.length ? tableWrap('Preview laporan formal', table.headers, table.rows.map((row) => `<tr>${row.map((cell) => `<td>${e(cell)}</td>`).join('')}</tr>`), `${table.rows.length} baris, sama dengan unduhan`) : emptyState('export', state)}</section>`;
  }
  function filterError(page, errors) {
    const root = roots[page];
    const form = root.querySelector('.ops-filters');
    const message = form.querySelector('.ops-error');
    message.textContent = Object.values(errors).join(' ');
    message.hidden = !Object.keys(errors).length;
    for (const key of FILTER_KEYS) form.elements.namedItem(key)?.setAttribute('aria-invalid', errors[key] ? 'true' : 'false');
    form.elements.namedItem(Object.keys(errors)[0])?.focus();
  }
  function render(page, id = '', focus = false) {
    if (disposed || !roots[page]) return;
    const root = roots[page];
    const state = states[page];
    root.setAttribute('aria-busy', 'true');
    try {
      const meta = metadata();
      const errors = validateFilters(state.filters, page === 'missing');
      root.innerHTML = pageHeader(page) + filtersForm(page, state, meta);
      if (Object.keys(errors).length) { filterError(page, errors); return; }
      capture(state, meta, page);
      const content = id && ['daily', 'approval'].includes(page) ? detailView(page, state, id) : page === 'missing' ? complianceView(state) : page === 'export' ? exportView(state) : operationalList(page, state);
      root.insertAdjacentHTML('beforeend', snapshotMeta(state) + content);
      if (focus) root.querySelector(id ? '[data-detail-heading]' : 'h1')?.focus();
    } catch (error) {
      root.innerHTML = pageHeader(page) + `<div class="ops-error" role="alert"><h2>${error?.code === 'FORBIDDEN' ? 'Akses ditolak' : 'Data tidak dapat dimuat'}</h2><p>${e(safeError(error))}</p>${button('refresh', 'Coba muat ulang')}<a class="ops-link" href="${e(operationsRoute(page, '', state.filters))}">Kembali ke daftar</a></div>`;
    } finally { root.setAttribute('aria-busy', 'false'); }
  }
  function navigate(page, filters, id = '', kind = '') {
    const hash = operationsRoute(page, id, filters, kind);
    if (window.location.hash === hash) {
      states[page].filters = filters;
      render(page, id, true);
    } else window.location.hash = hash;
  }
  function applyRoute(focus = true) {
    const route = currentRoute();
    if (!roots[route.page]) return;
    const state = states[route.page];
    state.filters = normalizeFilters(route.query, today);
    if (route.page === 'missing') state.filters.from = '';
    if (route.page === 'export') state.kind = route.query.get('kind') || state.kind;
    render(route.page, route.id, focus);
  }
  function showInline(root, selector, message) {
    const node = root.querySelector(selector);
    if (node) { node.textContent = message; node.hidden = false; }
    else notify(message);
  }
  function changedFilters(page) {
    const state = states[page];
    const form = roots[page].querySelector('.ops-filters');
    if (!form || !state.snapshot) return false;
    return JSON.stringify(normalizeFilters(new FormData(form), today)) !== JSON.stringify(state.snapshot.filters);
  }
  function markExportDirty() {
    const root = roots.export;
    if (!root) return;
    const dirty = changedFilters('export');
    const hint = root.querySelector('.ops-dirty');
    if (hint) hint.hidden = !dirty;
    root.querySelectorAll('[data-action="xlsx"], [data-action="csv"], [data-action="print"]').forEach((node) => { node.disabled = dirty || snapshotStatus(states.export.snapshot) !== 'ready'; });
  }
  function exportFileName(state, extension) {
    return `BOPPJ-${state.kind}-${state.snapshot.filters.to || 'semua'}-${String(state.snapshot.snapshotId).replace(/[^a-zA-Z0-9_-]/g, '_')}.${extension}`;
  }
  function downloadBlob(name, contents, type) {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function printSnapshot(state) {
    const markup = buildPrintReport(state.snapshot, state.kind, ui);
    document.querySelector('#ops-print-host')?.remove();
    const host = document.createElement('main');
    host.id = 'ops-print-host';
    host.className = 'ops-print';
    host.innerHTML = markup;
    const oldTitle = document.title;
    document.title = `${reportType(state.kind).title} · ${state.snapshot.snapshotId}`;
    document.body.append(host);
    document.body.classList.add('ops-printing');
    const cleanup = () => { document.body.classList.remove('ops-printing'); host.remove(); document.title = oldTitle; window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup, { once: true });
    try { window.print(); } catch (error) { cleanup(); throw error; }
  }
  async function submit(page, event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    const state = states[page];
    if (form.matches('.ops-filters')) {
      const filters = normalizeFilters(new FormData(form), today);
      const errors = validateFilters(filters, page === 'missing');
      if (Object.keys(errors).length) { filterError(page, errors); return; }
      navigate(page, filters, '', page === 'export' ? state.kind : '');
      return;
    }
    if (state.busy) return;
    const values = new FormData(form);
    if (form.matches('.ops-decision')) {
      const action = event.submitter?.value;
      if (!['accepted', 'needs-revision'].includes(action)) return;
      const reason = String(values.get('reason') || '').trim();
      if (action === 'needs-revision' && !reason) {
        showInline(form, '.ops-error', 'Jelaskan koreksi yang harus dilakukan kontraktor. Alasan perlu revisi wajib diisi.');
        form.elements.namedItem('reason').setAttribute('aria-invalid', 'true');
        form.elements.namedItem('reason').focus();
        return;
      }
      const report = state.detail;
      const payload = JSON.stringify([reportId(report), report.revisionId, report.version, action, reason]);
      if (!state.keys.has(payload)) state.keys.set(payload, globalThis.crypto?.randomUUID?.() || `ops-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      state.busy = true;
      form.querySelectorAll('button').forEach((node) => { node.disabled = true; });
      try {
        await provider.decideReport(reportId(report), { action, reason, expectedVersion: report.version, idempotencyKey: state.keys.get(payload), actor });
        notify('Keputusan tersimpan.');
        render(page, reportId(report), true);
      } catch (error) {
        showInline(form, '.ops-error', safeError(error));
        if (['CONFLICT', 'STALE', 'STALE_VERSION', 'VERSION_CONFLICT'].includes(error?.code)) state.stale = true;
        form.querySelectorAll('button').forEach((node) => { node.disabled = false; });
      } finally { state.busy = false; }
    } else if (form.matches('.ops-follow-up')) {
      const note = String(values.get('note') || '').trim();
      if (!note) {
        showInline(form, '.ops-error', 'Isi catatan tindak lanjut sebelum menyimpan.');
        form.elements.namedItem('note').setAttribute('aria-invalid', 'true');
        form.elements.namedItem('note').focus();
        return;
      }
      state.busy = true;
      const save = form.querySelector('button');
      save.disabled = true;
      try {
        await provider.addFollowUp(form.dataset.package, form.dataset.date, note, { actor });
        notify('Catatan lokal tersimpan. Tidak ada pesan eksternal yang dikirim.');
        render(page);
        const replacement = [...roots[page].querySelectorAll('.ops-follow-up')].find((item) => item.dataset.package === form.dataset.package);
        if (replacement) { replacement.closest('details').open = true; replacement.elements.namedItem('note').focus(); }
      } catch (error) { showInline(form, '.ops-error', safeError(error)); save.disabled = false; }
      finally { state.busy = false; }
    }
  }
  function click(page, event) {
    const trigger = event.target.closest('[data-action]');
    if (!trigger || !roots[page].contains(trigger)) return;
    const state = states[page];
    const action = trigger.dataset.action;
    if (action === 'reset') {
      const filters = normalizeFilters({}, today);
      navigate(page, filters, '', page === 'export' ? state.kind : '');
    } else if (action === 'refresh' || action === 'reload-detail') {
      const route = currentRoute();
      render(page, route.page === page ? route.id : '', true);
    } else if (page === 'export' && ['xlsx', 'csv', 'print'].includes(action)) {
      if (changedFilters(page)) { showInline(roots[page], '.ops-export-error', 'Filter berubah. Bentuk preview baru sebelum mengunduh atau mencetak.'); markExportDirty(); return; }
      try {
        if (action === 'print') printSnapshot(state);
        else if (action === 'xlsx') {
          downloadBlob(exportFileName(state, 'xlsx'), buildOperationsXlsx(state.snapshot, state.kind), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          notify('Berkas Excel diunduh.');
        } else {
          downloadBlob(exportFileName(state, 'csv'), buildOperationsCsv(state.snapshot, state.kind), 'text/csv;charset=utf-8');
          notify('Berkas CSV diunduh.');
        }
      } catch (error) {
        showInline(roots[page], '.ops-export-error', safeError(error));
        const lifecycle = roots[page].querySelector('.ops-lifecycle');
        if (lifecycle) lifecycle.textContent = 'Gagal membentuk keluaran. Tidak ada berkas parsial. Coba lagi atau bentuk preview baru.';
      }
    }
  }
  for (const [page, root] of Object.entries(roots)) {
    const onSubmit = (event) => { void submit(page, event); };
    const onClick = (event) => click(page, event);
    const onInput = () => { if (page === 'export') markExportDirty(); };
    const onChange = (event) => {
      if (event.target.name === 'kode') {
        const packageSelect = root.querySelector('[name="packageId"]');
        const meta = metadata();
        packageSelect.innerHTML = options([['', 'Semua paket'], ...meta.packages.filter((pkg) => !event.target.value || pkg.kode === event.target.value).map((pkg) => [pkg.packageId, `${pkg.kode} · ${pkg.nama}`])], '');
      }
      if (page === 'export' && event.target.name === 'reportKind') {
        states.export.kind = event.target.value;
        const form = root.querySelector('.ops-filters');
        const filters = normalizeFilters(new FormData(form), today);
        const errors = validateFilters(filters);
        if (Object.keys(errors).length) { filterError(page, errors); return; }
        navigate(page, filters, '', states.export.kind);
      }
      if (page === 'export') markExportDirty();
    };
    root.addEventListener('submit', onSubmit);
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    listeners.push(() => { root.removeEventListener('submit', onSubmit); root.removeEventListener('click', onClick); root.removeEventListener('input', onInput); root.removeEventListener('change', onChange); });
    render(page);
  }
  window.addEventListener('hashchange', applyRoute);
  const unsubscribe = provider.subscribe(() => {
    for (const [page, state] of Object.entries(states)) {
      state.stale = true;
      roots[page].querySelectorAll('.ops-stale').forEach((node) => { node.hidden = false; });
    }
  });
  const expiryTimer = window.setInterval(() => {
    const state = states.export;
    if (state && snapshotStatus(state.snapshot) === 'expired') {
      const lifecycle = roots.export.querySelector('.ops-lifecycle');
      if (lifecycle) lifecycle.textContent = 'Preview kedaluwarsa setelah 15 menit di memori. Bentuk preview baru; berkas lama tidak diterbitkan.';
      markExportDirty();
    }
  }, 15000);
  applyRoute(false);
  return () => { disposed = true; unsubscribe?.(); listeners.forEach((stop) => stop()); window.removeEventListener('hashchange', applyRoute); window.clearInterval(expiryTimer); };
}
