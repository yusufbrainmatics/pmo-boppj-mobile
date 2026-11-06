import { provider, DEMO_ADMIN, DEMO_REVIEWER, DEMO_TODAY } from './admin-data.js'
import { initKak } from './admin-kak.js'
import { initKnowledge } from './admin-knowledge.js'
import { initOperations } from './admin-operations.js'
import { initRegions } from './admin-regions.js'
import { destroyMaps, renderProjectMap } from './admin-map.js'
import { kelompokWarna, tahapClass,
  escapeHtml as esc, formatDate, formatNumber as number, notify, openDialog,
  parseBackofficeHash, backofficeHash, summarizeProjects, createCsv, downloadFile,
} from './admin-ui.js'
import './admin-content.css'
import './admin-operations.css'

const portal = document.querySelector('#admin-portal')
const workspace = document.querySelector('#workspace')
const navigation = [...document.querySelectorAll('.menu-item[data-page]')]
const pages = [...workspace.querySelectorAll(':scope > .page')]
const memory = new Map()
const owned = new Set(['dashboard', 'projects', 'map'])
const labels = Object.fromEntries(navigation.map((link) => [link.dataset.page, link.querySelector('span').textContent]))
let current = parseBackofficeHash(location.hash)
let projectPageRows = []
let editorBaseline = ''
let editingCode = null
let pendingImport = null

const href = (page, detail = '', params = current.params) => esc(backofficeHash(page, detail, params))
const percent = (value) => value == null ? '—' : `${number(value)}%`
const progressBar = (value) => `<span class="progress-track" aria-hidden="true"><i style="width:${typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0}%"></i></span>`
const errorText = (error) => `${error.code ? `${error.code}: ` : ''}${error.message || 'Data tidak dapat dimuat. Coba muat ulang.'}`
const option = (value, selected) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(value)}</option>`

function allProjects() {
  return provider.getProjects()
}

function filteredProjects(route = current) {
  const result = provider.getProjects({
    q: route.params.get('q') || '',
    provinsi: route.params.get('provinsi') || '',
    kelompok: route.params.get('kelompok') || '',
  }).filter((project) => (!route.params.get('tahap') || project.tahap === route.params.get('tahap')) && (!route.params.get('kode') || project.kode === route.params.get('kode')))
  const sort = route.params.get('sort') || 'kode'
  return result.sort((left, right) => sort === 'nama'
    ? left.nama.localeCompare(right.nama, 'id')
    : sort === 'progres-desc'
      ? (right.progres ?? -1) - (left.progres ?? -1) || left.kode.localeCompare(right.kode)
      : left.kode.localeCompare(right.kode, 'id', { numeric: true }))
}

function filters(page, { sort = false } = {}) {
  const projects = allProjects()
  const values = (key) => [...new Set(projects.map((project) => project[key]))].sort((a, b) => a.localeCompare(b, 'id'))
  return `<form class="shell-filters" data-project-filters="${page}" aria-label="Filter ${esc(labels[page])}">
    <label for="${page}-q">Cari proyek<input id="${page}-q" name="q" type="search" value="${esc(current.params.get('q'))}" placeholder="Kode atau nama proyek" /></label>
    <label for="${page}-province">Provinsi<select id="${page}-province" name="provinsi"><option value="">Semua provinsi</option>${values('provinsi').map((value) => option(value, current.params.get('provinsi'))).join('')}</select></label>
    <label for="${page}-group">Kelompok<select id="${page}-group" name="kelompok"><option value="">Semua kelompok</option>${values('kelompok').map((value) => option(value, current.params.get('kelompok'))).join('')}</select></label>
    <label for="${page}-stage">Tahap<select id="${page}-stage" name="tahap"><option value="">Semua tahap</option>${values('tahap').map((value) => option(value, current.params.get('tahap'))).join('')}</select></label>
    ${sort ? `<label for="projects-sort">Urutan<select id="projects-sort" name="sort">${[['kode', 'Kode proyek'], ['nama', 'Nama proyek'], ['progres-desc', 'Progres seed tertinggi']].map(([value, label]) => `<option value="${value}"${(current.params.get('sort') || 'kode') === value ? ' selected' : ''}>${label}</option>`).join('')}</select></label>` : ''}
    <div class="filter-actions"><button class="p-primary" type="submit">Terapkan</button><a class="p-outline" href="${esc(backofficeHash(page))}">Reset</a></div>
    ${current.params.get('kode') ? `<p class="filter-context">Cakupan kode: <strong>${esc(current.params.get('kode'))}</strong>. Reset untuk melihat seluruh proyek.</p>` : ''}
  </form>`
}

function table(projects, { id = 'projects-body', caption = 'Proyek dalam filter aktif · seluruh nilai seed ilustratif' } = {}) {
  return `<div class="table-scroll" role="region" aria-label="${esc(caption)}" tabindex="0"><table class="shell-table"><caption>${esc(caption)}</caption><thead><tr><th scope="col">Kode / proyek</th><th scope="col">Kelompok</th><th scope="col">Wilayah sumber</th><th scope="col">Tahap seed</th><th scope="col">Progres seed</th><th scope="col">Tindakan</th></tr></thead><tbody id="${id}">${projects.length ? projects.map((project) => `<tr><th scope="row"><a href="${href('projects', project.kode)}">${esc(project.kode)}</a><span class="cell-subtitle">${esc(project.nama)}</span></th><td>${esc(project.kelompok)}</td><td>${esc(project.kabupaten)}<span class="cell-subtitle">${esc(project.provinsi)}</span></td><td><span class="tahap-badge ${tahapClass(project.tahap)}">${esc(project.tahap)}</span></td><td>${progressBar(project.progres)}<b>${percent(project.progres)}</b></td><td><a class="row-link" href="${esc(backofficeHash('daily', '', { kode: project.kode }))}">Laporan</a></td></tr>`).join('') : '<tr><td colspan="6" class="empty">Tidak ada proyek untuk filter ini. Gunakan Reset untuk memperluas cakupan.</td></tr>'}</tbody></table></div>`
}

function dashboard(root) {
  const projects = filteredProjects()
  const summary = summarizeProjects(projects)
  const canonical = ['Asesmen', 'Master Plan', 'Pra-Konstruksi', 'Konstruksi', 'Selesai']
  const stages = canonical.map((name) => summary.stages.find((stage) => stage.name === name) ?? { name, count: 0 })
  const stageTotal = Math.max(1, ...stages.map((stage) => stage.count))
  const bars = [...projects].sort((a, b) => (b.progres ?? -1) - (a.progres ?? -1) || a.kode.localeCompare(b.kode))
  const tahap = summary.stages.find((stage) => stage.name === 'Konstruksi')?.count ?? 0
  const pra = summary.stages.find((stage) => stage.name === 'Pra-Konstruksi')?.count ?? 0
  root.innerHTML = `<header class="page-heading"><div><h1 tabindex="-1">Monitoring Proyek BOPPJ</h1><p>Proyek pada koridor Pantai Utara Jawa · ${esc(formatDate(DEMO_TODAY))} WIB.</p></div></header>
    <dl class="metrics">
      <div><dt>Total proyek</dt><dd>${number(summary.total)}</dd></div>
      <div><dt>Rata-rata progres (%)</dt><dd>${number(summary.average)}</dd></div>
      <div><dt>Sedang konstruksi</dt><dd>${number(tahap)}</dd></div>
      <div><dt>Pra-konstruksi</dt><dd>${number(pra)}</dd></div>
    </dl>
    <section class="dash-card" id="dashboard-map"><header class="section-heading"><div><h2>Peta Sebaran Proyek</h2><p>${number(projects.length)} proyek pada master data.</p></div><a class="p-outline" href="${href('map')}">Buka peta penuh</a></header><div class="dashboard-map" role="region" aria-label="Peta lokasi proyek"></div></section>
    <section class="dash-card"><h2>Progres per proyek (%)</h2><div class="legend"><span class="g-blue-dot"></span>Tanggul Laut Pantura (GSW)<span class="g-green-dot"></span>NCICD<span class="g-orange-dot"></span>Integrasi Tol Semarang-Demak</div><div class="bar-chart" id="project-bars" aria-label="Progres per proyek">${bars.length ? bars.map((project) => `<div class="chart-row"><a href="${href('projects', project.kode)}">${esc(project.kode)}<span>${esc(project.nama)}</span></a><span class="progress-track" aria-hidden="true"><i class="${kelompokWarna(project.kelompok)}" style="width:${Math.max(0, Math.min(100, project.progres ?? 0))}%"></i></span><b>${percent(project.progres)}</b></div>`).join('') : '<p class="empty">Belum ada data untuk grafik ini.</p>'}</div></section>
    <section class="dash-card"><h2>Jumlah proyek per tahap</h2><div class="stage-chart" role="img" aria-label="${esc(stages.map((stage) => `${stage.name} ${stage.count}`).join(', '))}">${stages.map((stage) => `<div class="stage-col ${tahapClass(stage.name)}"><b>${number(stage.count)}</b><i style="height:${Math.round(4 + stage.count / stageTotal * 148)}px"></i><span>${esc(stage.name)}</span></div>`).join('')}</div></section>
    <section class="dash-card"><h2>Rata-rata progres per kelompok</h2><div class="group-chart">${summary.groups.map((group) => `<div class="chart-row"><label>${esc(group.name)}</label><span class="progress-track" aria-hidden="true"><i class="${kelompokWarna(group.name)}" style="width:${Math.max(0, Math.min(100, group.average ?? 0))}%"></i></span><b>${percent(group.average)}</b></div>`).join('')}</div></section>
    <section class="dash-card"><h2>Daftar proyek</h2>${table(bars, { caption: 'Daftar proyek pada filter aktif' })}</section>`
  if (!portal.hidden) renderProjectMap(root.querySelector('.dashboard-map'), projects, { compact: true })
}

function projectList(root) {
  const projects = filteredProjects()
  projectPageRows = projects
  const perPage = 10
  const requested = Number(current.params.get('page'))
  const count = Math.max(1, Math.ceil(projects.length / perPage))
  const page = Math.min(count, Number.isSafeInteger(requested) && requested > 0 ? requested : 1)
  const pageLink = (target) => { const params = new URLSearchParams(current.params); params.set('page', target); return href('projects', '', params) }
  root.innerHTML = `<header class="page-heading"><div><h1 tabindex="-1">Data Proyek</h1><p>Master data proyek untuk dashboard, peta, paket, dan laporan.</p></div><div class="toolbar"><button class="p-outline" type="button" id="import-project">Impor master JSON</button><button class="p-primary" type="button" id="add-project">Tambah proyek demo</button></div></header>
    <section class="project-card"><header class="section-heading"><div><h2>Daftar proyek</h2><p>${number(projects.length)} hasil filter dari ${number(allProjects().length)} proyek master. Paket tetap mempunyai identitas terpisah.</p></div><button class="p-outline" type="button" id="export-project">Unduh CSV terfilter</button></header>${filters('projects', { sort: true })}${table(projects.slice((page - 1) * perPage, page * perPage), { id: 'project-list' })}<footer class="pagination"><span>Halaman ${number(page)} dari ${number(count)} · ${number(projects.length)} hasil</span><div>${page > 1 ? `<a class="p-outline" href="${pageLink(page - 1)}" aria-label="Halaman proyek sebelumnya">Sebelumnya</a>` : '<button class="p-outline" disabled>Sebelumnya</button>'}${page < count ? `<a class="p-outline" href="${pageLink(page + 1)}" aria-label="Halaman proyek berikutnya">Berikutnya</a>` : '<button class="p-outline" disabled>Berikutnya</button>'}</div></footer></section>
    <p class="help-text">Perubahan master harus melalui pratinjau dan commit atomik demo. Penghapusan record berelasi ditolak. Arsip/otorisasi produksi tidak diaktifkan.</p>`
  root.querySelector('#add-project').onclick = () => editProject()
  root.querySelector('#import-project').onclick = openImport
  root.querySelector('#export-project').onclick = () => {
    const rows = [['Status data', 'Kode', 'Nama', 'Kelompok', 'Wilayah sumber', 'Provinsi', 'Latitude WGS84', 'Longitude WGS84', 'Tahap seed', 'Progres seed (%)'], ...projectPageRows.map((project) => ['Data demo', project.kode, project.nama, project.kelompok, project.kabupaten, project.provinsi, project.lat, project.lng, project.tahap, project.progres])]
    downloadFile('proyek-terfilter.csv', createCsv(rows), 'text/csv;charset=utf-8')
    notify('CSV diunduh sesuai filter.')
  }
}

function projectDetail(root, code) {
  const project = allProjects().find((item) => item.kode === code)
  if (!project) {
    root.innerHTML = `<h1 tabindex="-1">Proyek tidak ditemukan</h1><p>Kode tidak ada pada master demo saat ini. Tidak ada data alternatif yang dimuat.</p><a class="p-outline" href="${href('projects')}">Kembali ke daftar terfilter</a>`
    return
  }
  const packages = provider.getPackages({ kode: code })
  const provenance = project.provenance || {}
  root.innerHTML = `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="${href('projects')}">Data Proyek</a><span aria-hidden="true">/</span><span>${esc(code)}</span></nav><header class="page-heading"><div><h1 tabindex="-1">${esc(project.nama)}</h1><p>${esc(code)} · ${esc(project.projectId)}</p></div><button type="button" class="p-outline" id="edit-project">Edit master demo</button></header>
    <section class="dash-card"><h2>Ringkasan master</h2><dl class="detail-grid"><dt>Kelompok</dt><dd>${esc(project.kelompok)}</dd><dt>Wilayah sumber</dt><dd>${esc(project.kabupaten)}, ${esc(project.provinsi)}</dd><dt>Koordinat WGS84</dt><dd>${esc(project.lat)}, ${esc(project.lng)}</dd><dt>Tahap seed</dt><dd>${esc(project.tahap)}</dd><dt>Progres seed ilustratif</dt><dd>${percent(project.progres)}</dd><dt>Nilai kontrak / instansi resmi</dt><dd>Belum tersedia — tidak ada bukti sumber</dd><dt>Baseline / deviasi</dt><dd>— / — · belum tersedia</dd></dl><div class="toolbar"><a class="p-outline" href="${esc(backofficeHash('map', '', { kode: code }))}">Lokasi pada peta</a><a class="p-outline" href="${esc(backofficeHash('daily', '', { kode: code }))}">Performa dan riwayat</a><a class="p-outline" href="${esc(backofficeHash('management', '', { kode: code }))}">Acuan KAK</a></div></section>
    <section class="dash-card"><h2>Paket pekerjaan dan progres laporan</h2><p class="help-text">Progres dipisahkan per paket. Agregasi lintas paket belum disahkan; nilai seed proyek tidak menggantikan laporan terverifikasi.</p><div class="table-scroll" role="region" tabindex="0" aria-label="Paket proyek dan progres laporan demo"><table><caption>Paket proyek ${esc(code)}</caption><thead><tr><th scope="col">Paket / ID</th><th scope="col">Pelaksana fixture</th><th scope="col">Masa aktif</th><th scope="col">Progres terlapor</th><th scope="col">Diterima untuk monitoring</th><th scope="col">Laporan</th></tr></thead><tbody>${packages.map((item) => {
      const progress = provider.getProgress(code, { packageId: item.packageId })
      return `<tr><th scope="row">${esc(item.nama)}<span class="cell-subtitle">${esc(item.packageCode)} · ${esc(item.packageId)}</span></th><td>${esc(item.kontraktor || 'Belum tersedia (fixture)')}</td><td>${esc(formatDate(item.activeFrom))} – ${esc(formatDate(item.activeTo))}</td><td>${percent(progress.reported)}</td><td>${percent(progress.verified)}<span class="cell-subtitle">${esc(formatDate(progress.asOf))}</span></td><td><a class="row-link" href="${esc(backofficeHash('daily', '', { kode: code, packageId: item.packageId }))}">Buka laporan paket</a></td></tr>`
    }).join('') || '<tr><td colspan="6" class="empty">Belum ada paket untuk proyek ini.</td></tr>'}</tbody></table></div></section>
    <section class="dash-card"><h2>Asal data dan batas penggunaan</h2><p>Nama, kode, dan koordinat bersumber dari master proyek PMO BOPPJ. Metadata di bawah berasal dari provider; bukan validasi organisasi.</p><dl class="detail-grid">${Object.entries(provenance).map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(typeof value === 'object' ? JSON.stringify(value) : value)}</dd>`).join('') || '<dt>Verifikasi</dt><dd>Belum diverifikasi sebagai data resmi.</dd>'}</dl><p class="help-text">Review demo bukan persetujuan pembayaran. Bukti foto mengikuti TTL lima menit existing; tidak tersedia sebagai arsip permanen.</p></section>`
  root.querySelector('#edit-project').onclick = () => editProject(project)
}

function fullMap(root) {
  const projects = filteredProjects()
  root.innerHTML = `<header class="page-heading"><div><h1 tabindex="-1">Peta Sebaran Proyek</h1><p>${number(projects.length)} proyek terfilter dari master seed yang sama · koordinat WGS84 ilustratif.</p></div><a class="p-outline" href="${href('projects')}">Buka tabel proyek</a></header>${filters('map')}<section class="dash-card"><div class="map-canvas" role="region" aria-label="Peta lokasi proyek"></div><p class="help-text">Titik dapat dibuka dengan keyboard untuk detail proyek. Peta dasar memerlukan koneksi; tabel di bawah tetap tersedia tanpa tile peta.</p></section>${table(projects, { id: 'map-projects', caption: 'Daftar lokasi proyek sesuai filter peta' })}`
  if (!portal.hidden) renderProjectMap(root.querySelector('.map-canvas'), projects)
}

function setupDialogs() {
  const host = document.createElement('div')
  host.id = 'shell-dialogs'
  host.innerHTML = `<dialog id="project-modal" class="shell-dialog" aria-labelledby="modal-title"><header class="section-heading"><h2 id="modal-title">Master proyek demo</h2><button type="button" class="p-outline" data-shell-close aria-label="Tutup editor proyek">Tutup</button></header><p class="help-text">Pratinjau terlebih dahulu sebelum menerapkan perubahan master.</p><form id="project-form"><div class="p-grid">${[
    ['kode', 'Kode proyek', 'text', ''], ['nama', 'Nama proyek', 'text', ''],
    ['kelompok', 'Kelompok', 'text', 'list="project-groups"'], ['provinsi', 'Provinsi', 'text', ''],
    ['kabupaten', 'Wilayah sumber', 'text', ''], ['tahap', 'Tahap seed', 'text', 'list="project-stages"'],
    ['lat', 'Latitude WGS84', 'number', 'min="-90" max="90" step="any"'], ['lng', 'Longitude WGS84', 'number', 'min="-180" max="180" step="any"'],
    ['progres', 'Progres (%)', 'number', 'min="0" max="100" step="any"'],
  ].map(([name, label, type, attributes]) => `<label for="project-${name}">${label}<input id="project-${name}" name="${name}" type="${type}" ${attributes} required aria-describedby="project-form-error" ${type === 'text' ? 'maxlength="240"' : ''} /></label>`).join('')}</div><datalist id="project-groups"></datalist><datalist id="project-stages"></datalist><p class="form-error" id="project-form-error" role="alert"></p><footer class="p-actions"><button type="button" class="p-outline" data-shell-close>Batal</button><button class="p-primary" type="submit">Pratinjau perubahan</button></footer></form></dialog>
    <dialog id="project-import" class="shell-dialog" aria-labelledby="import-title"><header class="section-heading"><h2 id="import-title">Impor master JSON · demo</h2><button type="button" class="p-outline" data-shell-close>Tutup</button></header><p>Gunakan array JSON master lengkap dengan kode, nama, kelompok, kabupaten, provinsi, lat, lng, tahap, dan progres. Tidak ada commit parsial. Record yang masih dirujuk laporan/paket tidak boleh dihapus atau diganti identitasnya.</p><button type="button" class="p-outline" id="download-master">Unduh master JSON lengkap</button><form id="project-import-form"><label for="master-file">Baca file JSON (maks. 1 MB)<input id="master-file" type="file" accept=".json,application/json" /></label><label for="master-json">Isi master lengkap<textarea id="master-json" name="json" rows="10" spellcheck="false" required aria-describedby="master-import-error"></textarea></label><p class="form-error" id="master-import-error" role="alert"></p><footer class="p-actions"><button type="button" class="p-outline" data-shell-close>Batal</button><button class="p-primary" type="submit">Validasi dan pratinjau</button></footer></form></dialog>
    <dialog id="master-preview" class="shell-dialog" aria-labelledby="master-preview-title"><header class="section-heading"><h2 id="master-preview-title">Pratinjau master demo</h2><button type="button" class="p-outline" data-shell-close>Tutup</button></header><div id="master-preview-body"></div><p id="master-preview-error" class="form-error" role="alert"></p><footer class="p-actions"><button type="button" class="p-outline" data-shell-close>Batal</button><button class="p-primary" type="button" id="commit-master">Terapkan atomik di demo</button></footer></dialog>`
  portal.append(host)
  host.querySelectorAll('[data-shell-close]').forEach((button) => button.onclick = () => button.closest('dialog').close())
  host.querySelector('#project-form').onsubmit = (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const error = host.querySelector('#project-form-error')
    error.textContent = ''
    if (JSON.stringify(allProjects()) !== editorBaseline) {
      error.textContent = 'STALE: Master berubah sejak editor dibuka. Tutup editor dan buka kembali sebelum menyimpan.'
      return
    }
    const values = Object.fromEntries(new FormData(form))
    for (const key of Object.keys(values)) values[key] = ['lat', 'lng', 'progres'].includes(key) ? Number(values[key]) : values[key].trim()
    const records = allProjects()
    if (editingCode) records[records.findIndex((project) => project.kode === editingCode)] = { ...records.find((project) => project.kode === editingCode), ...values }
    else records.push(values)
    showPreview(records, error)
  }
  host.querySelector('#download-master').onclick = () => downloadFile('master-proyek.json', JSON.stringify(allProjects(), null, 2), 'application/json;charset=utf-8')
  host.querySelector('#master-file').onchange = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    const error = host.querySelector('#master-import-error')
    error.textContent = ''
    if (file.size > 1024 * 1024) { error.textContent = 'Ukuran file melebihi 1 MB. Tidak ada data diterapkan.'; return }
    try { host.querySelector('#master-json').value = await file.text() } catch { error.textContent = 'File tidak dapat dibaca. Pilih ulang file JSON.' }
  }
  host.querySelector('#project-import-form').onsubmit = (event) => {
    event.preventDefault()
    const error = host.querySelector('#master-import-error')
    error.textContent = ''
    try {
      const text = host.querySelector('#master-json').value
      if (text.length > 1024 * 1024) throw new Error('Isi JSON melebihi 1 MB.')
      const records = JSON.parse(text)
      if (!Array.isArray(records)) throw new Error('Master harus berupa array JSON, bukan objek tunggal.')
      showPreview(records, error)
    } catch (issue) { error.textContent = `Impor belum diterapkan. ${errorText(issue)}` }
  }
  host.querySelector('#commit-master').onclick = () => {
    if (!pendingImport?.valid) return
    const error = host.querySelector('#master-preview-error')
    error.textContent = ''
    try {
      provider.commitImport(pendingImport, { actor: DEMO_ADMIN })
      pendingImport = null
      host.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close())
      notify('Master proyek diperbarui.')
      renderOwned()
    } catch (issue) {
      error.textContent = `${errorText(issue)} Tidak ada commit parsial. Tutup pratinjau dan validasi ulang.`
      host.querySelector('#commit-master').disabled = true
    }
  }
}

function editProject(project = null) {
  const dialog = document.querySelector('#project-modal')
  const form = dialog.querySelector('form')
  form.reset()
  editorBaseline = JSON.stringify(allProjects())
  editingCode = project?.kode || null
  dialog.querySelector('h2').textContent = project ? `Edit ${project.kode} · demo` : 'Tambah proyek ilustratif'
  dialog.querySelector('#project-form-error').textContent = ''
  for (const input of form.querySelectorAll('input[name]')) input.value = project?.[input.name] ?? ''
  form.elements.kode.readOnly = Boolean(project)
  for (const [id, key] of [['project-groups', 'kelompok'], ['project-stages', 'tahap']]) dialog.querySelector(`#${id}`).innerHTML = [...new Set(allProjects().map((item) => item[key]))].map((value) => `<option value="${esc(value)}"></option>`).join('')
  openDialog(dialog)
}

function openImport() {
  const dialog = document.querySelector('#project-import')
  dialog.querySelector('form').reset()
  dialog.querySelector('#master-import-error').textContent = ''
  openDialog(dialog)
}

function showPreview(records, error) {
  try {
    pendingImport = provider.previewImport(records, { actor: DEMO_ADMIN })
    const dialog = document.querySelector('#master-preview')
    const issues = pendingImport.errors || []
    dialog.querySelector('#master-preview-body').innerHTML = `<p class="${pendingImport.valid ? 'status-ok' : 'status-bad'}"><strong>${pendingImport.valid ? '✓ Valid — siap diterapkan' : '× Tidak valid — seluruh batch ditolak'}</strong></p><dl class="detail-grid"><dt>Versi master dasar</dt><dd>${esc(pendingImport.baseVersion)}</dd><dt>Hash sumber</dt><dd>${esc(pendingImport.sourceHash)}</dd><dt>Versi pemetaan</dt><dd>${esc(pendingImport.mappingVersion)}</dd><dt>Ringkasan</dt><dd>${esc(JSON.stringify(pendingImport.summary || {}))}</dd></dl>${issues.length ? `<ul class="validation-errors">${issues.map((issue) => `<li>${esc(typeof issue === 'string' ? issue : JSON.stringify(issue))}</li>`).join('')}</ul>` : ''}<div class="table-scroll" tabindex="0" role="region" aria-label="Baris pratinjau master proyek"><table><caption>Pratinjau master · belum diterapkan</caption><thead><tr><th scope="col">Kode</th><th scope="col">Nama</th><th scope="col">Provinsi</th><th scope="col">Koordinat WGS84</th></tr></thead><tbody>${records.slice(0, 1000).map((record) => `<tr><th scope="row">${esc(record?.kode)}</th><td>${esc(record?.nama)}</td><td>${esc(record?.provinsi)}</td><td>${esc(record?.lat)}, ${esc(record?.lng)}</td></tr>`).join('')}</tbody></table></div><p class="help-text">Penerapan hanya ke master demo tab ini; bukan pengesahan data organisasi. Versi/hash diperiksa ulang saat commit.</p>`
    dialog.querySelector('#master-preview-error').textContent = ''
    dialog.querySelector('#commit-master').disabled = !pendingImport.valid
    openDialog(dialog)
  } catch (issue) { error.textContent = errorText(issue) }
}

function renderOwned() {
  if (!current.valid || !owned.has(current.page)) return
  const root = document.getElementById(current.page)
  destroyMaps(root)
  root.setAttribute('aria-busy', 'true')
  try {
    if (current.page === 'dashboard') dashboard(root)
    else if (current.page === 'map') fullMap(root)
    else if (current.detail) projectDetail(root, current.detail)
    else projectList(root)
  } catch (issue) {
    root.innerHTML = `<h1 tabindex="-1">${esc(labels[current.page])}</h1><div class="shell-error" role="alert"><p>${esc(errorText(issue))}</p><p>Tidak ada data alternatif yang dimuat.</p><button type="button" class="p-outline" data-shell-retry>Coba muat ulang data</button></div>`
  } finally { root.removeAttribute('aria-busy') }
}

function route({ focus = false } = {}) {
  current = parseBackofficeHash(location.hash)
  if (current.valid) memory.set(current.page, location.hash || '#dashboard')
  const error = document.querySelector('#shell-error')
  error.hidden = current.valid
  if (!current.valid) error.innerHTML = '<h1 tabindex="-1">Halaman tidak ditemukan</h1><p>Bookmark tidak dikenali. Data tidak diubah.</p><a class="p-outline" href="#dashboard">Kembali ke Dashboard Monitoring</a>'
  for (const page of pages) {
    const active = current.valid && page.id === current.page
    page.hidden = !active
    page.classList.toggle('active', active)
  }
  for (const link of navigation) {
    const active = current.valid && link.dataset.page === current.page
    link.classList.toggle('active', active)
    if (active) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
    link.href = memory.get(link.dataset.page) || `#${link.dataset.page}`
  }
  document.querySelector('#workspace-context').textContent = labels[current.page] || 'Halaman tidak ditemukan'
  document.title = `${labels[current.page] || 'Halaman tidak ditemukan'} · Demo PMO BOPPJ`
  renderOwned()
  if (focus && !portal.hidden) queueMicrotask(() => {
    const heading = document.querySelector(current.valid ? `#${current.page} h1` : '#shell-error h1')
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }) }
  })
  window.dispatchEvent(new CustomEvent('pmo:pagechange', { detail: { page: current.page } }))
}

function updateBadge() {
  const badge = document.querySelector('#approval-count')
  try {
    const count = provider.getReports({}, DEMO_REVIEWER).filter((report) => report.delivery === 'delivered' && report.reviewState === 'submitted').length
    badge.textContent = number(count)
    badge.setAttribute('aria-label', `${count} kiriman demo menunggu review`)
  } catch { badge.textContent = '—'; badge.setAttribute('aria-label', 'Antrean belum tersedia') }
}

workspace.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-project-filters]')
  if (!form) return
  event.preventDefault()
  const params = new URLSearchParams(current.params)
  for (const [key, value] of new FormData(form)) {
    if (String(value).trim()) params.set(key, String(value).trim())
    else params.delete(key)
  }
  params.delete('page')
  location.hash = backofficeHash(form.dataset.projectFilters, '', params)
})
workspace.addEventListener('click', (event) => { if (event.target.closest('[data-shell-retry]')) renderOwned() })
const mobileToggle = document.querySelector('#mobile-menu-toggle')
const closeMenu = () => { portal.dataset.menuOpen = 'false'; mobileToggle.setAttribute('aria-expanded', 'false') }
mobileToggle.onclick = () => {
  const open = portal.dataset.menuOpen !== 'true'
  portal.dataset.menuOpen = String(open)
  mobileToggle.setAttribute('aria-expanded', String(open))
}
portal.addEventListener('click', (event) => {
  if (portal.dataset.menuOpen === 'true' && event.target === portal) closeMenu()
})
const sidebarToggle = document.querySelector('#sidebar-toggle')
sidebarToggle.onclick = () => {
  const collapsed = portal.dataset.sidebarCollapsed !== 'true'
  portal.dataset.sidebarCollapsed = String(collapsed)
  sidebarToggle.setAttribute('aria-expanded', String(!collapsed))
  sidebarToggle.textContent = collapsed ? 'Perluas navigasi' : 'Lipat navigasi'
}
navigation.forEach((link) => link.addEventListener('click', closeMenu))
window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && portal.dataset.menuOpen === 'true') { closeMenu(); mobileToggle.focus() } })
window.addEventListener('hashchange', () => route({ focus: true }))
window.addEventListener('pmo:authchange', (event) => {
  if (event.detail.authenticated) window.dispatchEvent(new HashChangeEvent('hashchange'))
  else { closeMenu(); pages.forEach((page) => destroyMaps(page)) }
})
document.querySelector('#skip-workspace')?.addEventListener('click', (event) => { event.preventDefault(); (portal.hidden ? document.querySelector('#admin-email') : workspace).focus() })

function initialize(root, callback) {
  try { callback() } catch (issue) {
    root.innerHTML = `<h1 tabindex="-1">${esc(labels[root.id])}</h1><p role="alert">${esc(errorText(issue))} Muat ulang halaman untuk mencoba kembali. Tidak ada fixture pengganti yang dimuat.</p>`
  }
}

setupDialogs()
route()
initialize(document.querySelector('#management'), () => initKak(document.querySelector('#management')))
initialize(document.querySelector('#knowledge'), () => initKnowledge(document.querySelector('#knowledge')))
initialize(document.querySelector('#daily'), () => initOperations({
  daily: document.querySelector('#daily'), approval: document.querySelector('#approval'),
  missing: document.querySelector('#missing'), exportRoot: document.querySelector('#export'),
}))
initialize(document.querySelector('#regions'), () => initRegions(document.querySelector('#regions'), { provider, actor: DEMO_ADMIN }))
updateBadge()
provider.subscribe(() => { updateBadge(); renderOwned() })
