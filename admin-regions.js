import {
  escapeHtml as esc, formatNumber as number, parseBackofficeHash, backofficeHash,
  createCsv, downloadFile, openDialog, notify,
} from './admin-ui.js'

const LEVELS = ['Provinsi', 'Wilayah sumber', 'Kabupaten', 'Kota', 'Kota Administrasi', 'Kecamatan', 'Kelurahan', 'Desa']
const PARENTS = {
  'Wilayah sumber': ['Provinsi'], Kabupaten: ['Provinsi'], Kota: ['Provinsi'], 'Kota Administrasi': ['Provinsi'],
  Kecamatan: ['Kabupaten', 'Kota', 'Kota Administrasi'], Kelurahan: ['Kecamatan'], Desa: ['Kecamatan'],
}
const STORAGE_KEY = 'pmo-admin-region-references-v1'

export function regionsFromProjects(projects) {
  const regions = new Map()
  for (const project of projects) {
    const provinceId = `seed:province:${encodeURIComponent(project.provinsi)}`
    const areaId = `seed:area:${encodeURIComponent(project.provinsi)}:${encodeURIComponent(project.kabupaten)}`
    if (!regions.has(provinceId)) regions.set(provinceId, {
      id: provinceId, code: '', name: project.provinsi, level: 'Provinsi', parentId: null,
      status: 'Aktif', note: 'Nama provinsi mengikuti master proyek.',
      source: 'Master proyek ilustratif', seedKind: 'province', projectCodes: [],
    })
    if (!regions.has(areaId)) regions.set(areaId, {
      id: areaId, code: '', name: project.kabupaten, level: 'Wilayah sumber', parentId: provinceId,
      status: 'Aktif', note: 'Nama wilayah sumber, bukan klasifikasi kabupaten/kota yang sudah diverifikasi.',
      source: 'Master proyek ilustratif', seedKind: 'area', projectCodes: [],
    })
    regions.get(provinceId).projectCodes.push(project.kode)
    regions.get(areaId).projectCodes.push(project.kode)
  }
  return [...regions.values()].sort((a, b) => a.name.localeCompare(b.name, 'id'))
}

export function validateRegions(rows, projects, previous = []) {
  const errors = []
  if (!Array.isArray(rows) || rows.length > 2000) return { valid: false, errors: ['Master wilayah harus berupa array JSON, maksimal 2.000 baris.'] }
  const ids = new Set()
  const codes = new Set()
  const masterCodes = new Set(projects.map((project) => project.kode))
  const byId = new Map(rows.filter((row) => row && typeof row === 'object').map((row) => [row.id, row]))
  rows.forEach((row, index) => {
    const fail = (message) => errors.push(`Baris ${index + 1}: ${message}`)
    if (!row || typeof row !== 'object' || Array.isArray(row)) { fail('Record harus berupa objek.'); return }
    if (typeof row.id !== 'string' || !row.id.trim() || ids.has(row.id)) fail('ID lokal wajib unik.')
    ids.add(row.id)
    if (typeof row.name !== 'string' || !row.name.trim() || row.name.length > 240) fail('Nama wajib diisi, maksimal 240 karakter.')
    if (typeof row.code !== 'string') fail('Kode lokal harus berupa teks (boleh kosong).')
    const code = String(row.code || '').trim().toLowerCase()
    if (code && codes.has(code)) fail('Kode lokal duplikat.')
    if (code) codes.add(code)
    if (!LEVELS.includes(row.level)) fail('Tingkat wilayah tidak dikenal.')
    if (!['Aktif', 'Nonaktif'].includes(row.status)) fail('Status harus Aktif atau Nonaktif.')
    if (row.level === 'Provinsi' && row.parentId) fail('Provinsi tidak boleh memiliki induk.')
    if (row.level !== 'Provinsi') {
      const parent = byId.get(row.parentId)
      if (!parent || !(PARENTS[row.level] || []).includes(parent.level)) fail('Induk hilang atau tingkat induk tidak sesuai.')
      if (row.status === 'Aktif' && parent?.status !== 'Aktif') fail('Induk harus aktif sebelum anak diaktifkan.')
    }
    const visited = new Set([row.id])
    let parent = byId.get(row.parentId)
    while (parent) {
      if (visited.has(parent.id)) { fail('Hierarki mengandung siklus.'); break }
      visited.add(parent.id)
      parent = byId.get(parent.parentId)
    }
    if (!Array.isArray(row.projectCodes) || row.projectCodes.some((code) => typeof code !== 'string' || !masterCodes.has(code))) fail('Relasi proyek tidak dikenal pada master.')
    if (Array.isArray(row.projectCodes) && new Set(row.projectCodes).size !== row.projectCodes.length) fail('Relasi proyek duplikat.')
    if (row.status === 'Nonaktif' && row.projectCodes?.length) fail('Wilayah berelasi proyek tidak dapat dinonaktifkan.')
    if (row.note != null && (typeof row.note !== 'string' || row.note.length > 2000)) fail('Keterangan maksimal 2.000 karakter.')
    if (typeof row.id === 'string' && row.id.startsWith('seed:') && !previous.some((item) => item.id === row.id && item.seedKind)) fail('Identitas seed tidak boleh dibuat melalui impor referensi.')
  })
  for (const original of previous) {
    const replacement = byId.get(original.id)
    if (!replacement && (original.seedKind || original.projectCodes?.length)) errors.push(`${original.name}: referensi seed atau berelasi tidak boleh dihapus.`)
    if (replacement && original.seedKind && ['name', 'level', 'parentId', 'seedKind'].some((key) => original[key] !== replacement[key])) errors.push(`${original.name}: identitas wilayah sumber harus tetap mengikuti master proyek.`)
    if (replacement && original.seedKind && JSON.stringify(original.projectCodes) !== JSON.stringify(replacement.projectCodes)) errors.push(`${original.name}: relasi seed tidak boleh diubah melalui editor wilayah.`)
  }
  return { valid: errors.length === 0, errors }
}

export function initRegions(root, { provider } = {}) {
  if (!root || !provider) return
  let rows = regionsFromProjects(provider.getProjects())
  let storageNotice = ''
  let corrupt = false
  let preview = null
  let previewBase = ''
  let editing = null
  let route = parseBackofficeHash(location.hash)
  let stored = null
  try { stored = sessionStorage.getItem(STORAGE_KEY) } catch {
    storageNotice = 'Penyimpanan sesi tidak tersedia. Perubahan referensi wilayah hanya berada di memori tab ini.'
  }
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      const validation = validateRegions(parsed, provider.getProjects(), rows)
      if (!validation.valid) throw new Error('INVALID_REGION_STATE')
      rows = parsed
    } catch {
      corrupt = true
      storageNotice = 'Data referensi wilayah sesi tidak valid. Pulihkan dari master seed untuk melanjutkan; data tersebut tidak diterapkan.'
    }
  }
  const dialogs = document.createElement('div')
  dialogs.innerHTML = `<dialog class="shell-dialog" id="region-modal" aria-labelledby="region-modal-title"><header class="section-heading"><h2 id="region-modal-title">Referensi wilayah demo</h2><button class="p-outline" type="button" data-region-close>Tutup</button></header><p class="help-text">Ini referensi lokal, bukan penetapan wilayah administratif resmi. Identitas seed dan relasi proyek sumber tidak dapat diubah di sini.</p><form id="region-form"><div class="p-grid"><label for="r-name">Nama wilayah<input name="name" id="r-name" required maxlength="240" aria-describedby="region-error" /></label><label for="r-code">Kode lokal (opsional)<input name="code" id="r-code" maxlength="120" aria-describedby="region-error" /></label><label for="r-level">Tingkat<select name="level" id="r-level">${LEVELS.map((level) => `<option>${esc(level)}</option>`).join('')}</select></label><label for="r-parent">Induk<select name="parentId" id="r-parent"></select></label><label for="r-status">Status<select name="status" id="r-status"><option>Aktif</option><option>Nonaktif</option></select></label><label for="r-projects">Proyek terkait (pilihan jamak)<select name="projectCodes" id="r-projects" multiple size="5"></select></label><label class="wide" for="r-note">Keterangan<textarea name="note" id="r-note" maxlength="2000"></textarea></label></div><p class="form-error" id="region-error" role="alert"></p><footer class="p-actions"><button class="p-outline" type="button" data-region-close>Batal</button><button type="submit" class="p-primary">Simpan referensi lokal</button></footer></form></dialog>
    <dialog class="shell-dialog" id="region-import" aria-labelledby="region-import-title"><header class="section-heading"><h2 id="region-import-title">Impor referensi wilayah · demo</h2><button class="p-outline" type="button" data-region-close>Tutup</button></header><p>Impor JSON lengkap dengan ID, nama, tingkat, induk, status, dan relasi kode proyek. Ini tidak mengubah lokasi pada master proyek. Semua baris divalidasi sebelum penerapan.</p><button class="p-outline" type="button" id="region-template">Unduh JSON referensi lengkap</button><form id="region-import-form"><label for="region-json">Array JSON referensi<textarea id="region-json" rows="10" required aria-describedby="region-import-error"></textarea></label><p class="form-error" id="region-import-error" role="alert"></p><button class="p-primary" type="submit">Validasi pratinjau</button></form><div id="region-import-preview"></div><button class="p-primary" type="button" id="region-import-commit" hidden>Terapkan seluruh referensi demo</button></dialog>`
  document.querySelector('#admin-portal').append(dialogs)
  dialogs.querySelectorAll('[data-region-close]').forEach((button) => button.onclick = () => button.closest('dialog').close())

  const save = (next) => {
    rows = structuredClone(next)
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rows)) } catch { storageNotice = 'Perubahan hanya berada di memori tab ini; penyimpanan sesi tidak tersedia.' }
  }
  const hash = (id = '', params = route.params) => esc(backofficeHash('regions', id, params))
  const provinceOf = (row) => {
    let node = row
    const visited = new Set()
    while (node && node.level !== 'Provinsi' && !visited.has(node.id)) { visited.add(node.id); node = rows.find((item) => item.id === node.parentId) }
    return node?.level === 'Provinsi' ? node.name : ''
  }
  const filtered = () => rows.filter((row) => {
    const q = (route.params.get('q') || '').toLocaleLowerCase('id')
    return `${row.name} ${row.code}`.toLocaleLowerCase('id').includes(q)
      && (!route.params.get('level') || row.level === route.params.get('level'))
      && (!route.params.get('status') || row.status === route.params.get('status'))
      && (!route.params.get('provinsi') || provinceOf(row) === route.params.get('provinsi'))
  })
  function header() {
    return `<header class="page-heading"><div><h1 tabindex="-1">Data Wilayah</h1><p>Referensi hierarki wilayah dari master proyek.</p></div><div class="toolbar"><button class="p-outline" type="button" id="import-region"${corrupt ? ' disabled' : ''}>Impor JSON</button><button class="p-primary" type="button" id="add-region"${corrupt ? ' disabled' : ''}>Tambah referensi</button></div></header><p class="demo-notice">Nama seed yang belum diklasifikasikan ditampilkan sebagai <strong>Wilayah sumber</strong>, bukan diasumsikan kabupaten/kota. Kode resmi tidak tersedia. Perubahan hanya lokal dan tidak mengubah master proyek.</p>${storageNotice ? `<p class="shell-error" role="status">${esc(storageNotice)}</p>` : ''}${corrupt ? '<button class="p-outline" type="button" id="region-recover">Pulihkan referensi dari master</button>' : ''}`
  }
  function render() {
    if (route.page !== 'regions') return
    if (route.detail && !corrupt) { detail(route.detail); return }
    const data = corrupt ? [] : filtered()
    const projects = new Set(data.flatMap((row) => row.projectCodes))
    const provinces = rows.filter((row) => row.level === 'Provinsi')
    const params = new URLSearchParams(route.params)
    const view = route.params.get('view') === 'tree' ? 'tree' : 'table'
    const viewHash = (value) => { const query = new URLSearchParams(params); query.set('view', value); query.delete('page'); return hash('', query) }
    const totalPages = Math.max(1, Math.ceil(data.length / 10))
    const page = Math.min(totalPages, Math.max(1, Number.parseInt(params.get('page'), 10) || 1))
    const pageHash = (value) => { const query = new URLSearchParams(params); query.set('page', value); return hash('', query) }
    root.innerHTML = `${header()}<section class="region-card"><header class="section-heading"><div><h2>Daftar referensi wilayah</h2><p>${number(data.length)} hasil filter dari ${number(corrupt ? 0 : rows.length)} referensi · ${number(projects.size)} proyek unik terkait.</p></div><button class="p-outline" type="button" id="export-region"${corrupt ? ' disabled' : ''}>Unduh CSV terfilter</button></header><form class="shell-filters" id="region-filters"><label for="region-search">Cari nama / kode lokal<input type="search" id="region-search" name="q" value="${esc(params.get('q'))}" /></label><label for="province-filter">Provinsi<select id="province-filter" name="provinsi"><option value="">Semua provinsi</option>${provinces.map((row) => `<option${params.get('provinsi') === row.name ? ' selected' : ''}>${esc(row.name)}</option>`).join('')}</select></label><label for="level-filter">Tingkat<select id="level-filter" name="level"><option value="">Semua tingkat</option>${LEVELS.map((level) => `<option${params.get('level') === level ? ' selected' : ''}>${esc(level)}</option>`).join('')}</select></label><label for="rstatus-filter">Status<select id="rstatus-filter" name="status"><option value="">Semua status</option><option${params.get('status') === 'Aktif' ? ' selected' : ''}>Aktif</option><option${params.get('status') === 'Nonaktif' ? ' selected' : ''}>Nonaktif</option></select></label><div class="filter-actions"><button class="p-primary" type="submit">Terapkan</button><a class="p-outline" href="#regions">Reset</a></div></form><nav class="view-tabs" aria-label="Tampilan wilayah"><a class="p-outline" href="${viewHash('table')}"${view === 'table' ? ' aria-current="page"' : ''}>Tabel</a><a class="p-outline" href="${viewHash('tree')}"${view === 'tree' ? ' aria-current="page"' : ''}>Hierarki</a></nav>${view === 'table' ? `<div class="table-scroll" role="region" tabindex="0" aria-label="Tabel referensi wilayah"><table class="shell-table"><caption>Wilayah dan referensi</caption><thead><tr><th scope="col">Wilayah</th><th scope="col">Kode lokal</th><th scope="col">Tingkat</th><th scope="col">Induk</th><th scope="col">Proyek terkait</th><th scope="col">Status</th><th scope="col">Tindakan</th></tr></thead><tbody>${data.slice((page - 1) * 10, page * 10).map((row) => `<tr><th scope="row"><a href="${hash(row.id)}">${esc(row.name)}</a></th><td>${esc(row.code || 'Kode resmi belum tersedia')}</td><td>${esc(row.level)}</td><td>${esc(rows.find((item) => item.id === row.parentId)?.name || '—')}</td><td>${number(row.projectCodes.length)}</td><td><span class="badge ${row.status === 'Aktif' ? 'ok' : 'neutral'}">${row.status === 'Aktif' ? '✓' : '–'} ${esc(row.status)}</span></td><td><a class="row-link" href="${hash(row.id)}">Detail</a></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Tidak ada wilayah untuk filter ini.</td></tr>'}</tbody></table></div><footer class="pagination"><span>Halaman ${number(page)} / ${number(totalPages)}</span><div>${page > 1 ? `<a class="p-outline" href="${pageHash(page - 1)}">Sebelumnya</a>` : '<button class="p-outline" disabled>Sebelumnya</button>'}${page < totalPages ? `<a class="p-outline" href="${pageHash(page + 1)}">Berikutnya</a>` : '<button class="p-outline" disabled>Berikutnya</button>'}</div></footer>` : tree(data)}</section>`
    bindHeader()
    root.querySelector('#region-filters').onsubmit = (event) => {
      event.preventDefault()
      const query = new URLSearchParams(route.params)
      for (const [key, value] of new FormData(event.currentTarget)) { if (value) query.set(key, value); else query.delete(key) }
      query.delete('page')
      location.hash = backofficeHash('regions', '', query)
    }
    root.querySelector('#export-region').onclick = () => downloadFile('referensi-wilayah.csv', createCsv([
      ['Status data', 'ID lokal', 'Kode lokal', 'Nama', 'Tingkat', 'Induk', 'Status', 'Proyek terkait', 'Sumber'],
      ...data.map((row) => ['Data demo', row.id, row.code, row.name, row.level, rows.find((item) => item.id === row.parentId)?.name || '', row.status, row.projectCodes.join('; '), row.source || 'Referensi demo lokal']),
    ]), 'text/csv;charset=utf-8')
  }
  function tree(data) {
    if (!data.length) return '<p class="empty">Tidak ada wilayah untuk filter ini.</p>'
    const visible = new Set(data.map((row) => row.id))
    for (const row of data) {
      let parent = rows.find((item) => item.id === row.parentId)
      const visited = new Set()
      while (parent && !visited.has(parent.id)) { visited.add(parent.id); visible.add(parent.id); parent = rows.find((item) => item.id === parent.parentId) }
    }
    const matches = new Set(data.map((row) => row.id))
    const branch = (row) => {
      const children = rows.filter((item) => item.parentId === row.id && visible.has(item.id))
      const text = `<a class="row-link" href="${hash(row.id)}">${esc(row.name)}</a><span class="help-text">${esc(row.level)} · ${number(row.projectCodes.length)} proyek${matches.has(row.id) ? '' : ' · induk konteks filter'}</span>`
      return `<li>${children.length ? `<details open><summary>${esc(row.name)} · ${number(children.length)} turunan terlihat</summary><div class="region-branch">${text}</div><ul>${children.map(branch).join('')}</ul></details>` : `<div class="region-branch">${text}</div>`}</li>`
    }
    return `<p class="help-text">Hanya hasil filter beserta induk konteksnya yang ditampilkan. Buka/tutup cabang dengan Enter atau Spasi.</p><div class="region-tree"><ul>${rows.filter((row) => !row.parentId && visible.has(row.id)).map(branch).join('')}</ul></div>`
  }
  function detail(id) {
    const row = rows.find((item) => item.id === id)
    if (!row) { root.innerHTML = `<h1 tabindex="-1">Referensi tidak ditemukan</h1><a class="p-outline" href="${hash()}">Kembali ke daftar wilayah</a>`; return }
    const master = provider.getProjects()
    const linked = master.filter((project) => row.projectCodes.includes(project.kode))
    const children = rows.filter((item) => item.parentId === id)
    root.innerHTML = `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="${hash()}">Data Wilayah</a><span aria-hidden="true">/</span><span>${esc(row.name)}</span></nav><header class="page-heading"><div><h1 tabindex="-1">${esc(row.name)}</h1><p>${esc(row.level)}</p></div><div class="toolbar"><button class="p-outline" type="button" id="edit-region">Edit referensi</button><button class="p-outline danger" type="button" id="delete-region"${row.seedKind || linked.length || children.length ? ' disabled' : ''}>Hapus referensi</button></div></header><section class="dash-card"><h2>Identitas dan relasi</h2><dl class="detail-grid"><dt>ID lokal</dt><dd>${esc(row.id)}</dd><dt>Kode lokal</dt><dd>${esc(row.code || 'Belum tersedia; bukan kode resmi')}</dd><dt>Induk</dt><dd>${row.parentId ? `<a href="${hash(row.parentId)}">${esc(rows.find((item) => item.id === row.parentId)?.name)}</a>` : '—'}</dd><dt>Status</dt><dd>${esc(row.status)}</dd><dt>Sumber</dt><dd>${esc(row.source || 'Referensi wilayah')}</dd><dt>Keterangan</dt><dd>${esc(row.note || 'Belum tersedia')}</dd></dl><p class="help-text">Referensi seed, referensi berelasi proyek, dan induk yang memiliki turunan tidak dapat dihapus. Wilayah berelasi tidak dapat dinonaktifkan.</p></section><section class="dash-card"><h2>Wilayah turunan</h2>${children.length ? `<ul>${children.map((child) => `<li><a class="row-link" href="${hash(child.id)}">${esc(child.name)}</a> · ${esc(child.level)}</li>`).join('')}</ul>` : '<p>Tidak ada wilayah turunan.</p>'}</section><section class="dash-card"><h2>Proyek terkait</h2>${linked.length ? `<ul>${linked.map((project) => `<li><a class="row-link" href="${esc(backofficeHash('projects', project.kode))}">${esc(project.kode)} · ${esc(project.nama)}</a></li>`).join('')}</ul>` : '<p>Belum ada proyek terkait.</p>'}</section>`
    root.querySelector('#edit-region').onclick = () => edit(row)
    root.querySelector('#delete-region').onclick = () => {
      if (row.seedKind || linked.length || children.length) return
      if (!window.confirm(`Hapus referensi lokal “${row.name}”? Master proyek tidak berubah.`)) return
      save(rows.filter((item) => item.id !== row.id))
      notify('Referensi lokal dihapus dari demo tab ini.')
      location.hash = backofficeHash('regions', '', route.params)
    }
  }
  function bindHeader() {
    root.querySelector('#add-region').onclick = () => edit()
    root.querySelector('#import-region').onclick = () => {
      preview = null
      dialogs.querySelector('#region-import-form').reset()
      dialogs.querySelector('#region-import-preview').replaceChildren()
      dialogs.querySelector('#region-import-error').textContent = ''
      dialogs.querySelector('#region-import-commit').hidden = true
      openDialog(dialogs.querySelector('#region-import'))
    }
    root.querySelector('#region-recover')?.addEventListener('click', () => {
      if (!window.confirm('Pulihkan referensi dari master proyek dan ganti referensi sesi yang tidak valid?')) return
      corrupt = false
      storageNotice = ''
      save(regionsFromProjects(provider.getProjects()))
      render()
    })
  }
  function parentOptions(value = '') {
    const form = dialogs.querySelector('#region-form')
    const level = form.elements.level.value
    const select = form.elements.parentId
    select.innerHTML = `<option value="">${level === 'Provinsi' ? 'Tidak memerlukan induk' : 'Pilih induk'}</option>${rows.filter((row) => row.id !== editing?.id && (PARENTS[level] || []).includes(row.level)).map((row) => `<option value="${esc(row.id)}">${esc(row.name)}</option>`).join('')}`
    select.value = value
    select.required = level !== 'Provinsi'
    select.disabled = level === 'Provinsi' || Boolean(editing?.seedKind)
  }
  function edit(row = null) {
    editing = row
    const form = dialogs.querySelector('#region-form')
    form.reset()
    form.dataset.base = JSON.stringify(rows)
    dialogs.querySelector('#region-modal-title').textContent = row ? `Edit ${row.name} · demo` : 'Tambah referensi wilayah demo'
    dialogs.querySelector('#region-error').textContent = ''
    for (const key of ['name', 'code', 'level', 'status', 'note']) form.elements[key].value = row?.[key] ?? (key === 'level' ? 'Provinsi' : key === 'status' ? 'Aktif' : '')
    form.elements.name.readOnly = Boolean(row?.seedKind)
    form.elements.level.disabled = Boolean(row?.seedKind)
    form.elements.projectCodes.innerHTML = provider.getProjects().map((project) => `<option value="${esc(project.kode)}"${row?.projectCodes.includes(project.kode) ? ' selected' : ''}>${esc(project.kode)} · ${esc(project.nama)}</option>`).join('')
    form.elements.projectCodes.disabled = Boolean(row?.seedKind)
    parentOptions(row?.parentId || '')
    openDialog(dialogs.querySelector('#region-modal'))
  }
  dialogs.querySelector('#r-level').onchange = () => parentOptions()
  dialogs.querySelector('#region-form').onsubmit = (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const error = dialogs.querySelector('#region-error')
    if (form.dataset.base !== JSON.stringify(rows)) { error.textContent = 'STALE: Referensi berubah sejak editor dibuka. Tutup dan buka kembali.'; return }
    const data = new FormData(form)
    const record = {
      ...editing,
      id: editing?.id || `local:${crypto.randomUUID()}`,
      code: String(data.get('code') || '').trim(), name: String(data.get('name') || '').trim(),
      level: editing?.seedKind ? editing.level : data.get('level'),
      parentId: editing?.seedKind ? editing.parentId : data.get('parentId') || null,
      projectCodes: editing?.seedKind ? [...editing.projectCodes] : data.getAll('projectCodes'),
      status: data.get('status'), note: String(data.get('note') || '').trim(),
      source: editing?.source || 'Referensi wilayah',
    }
    const next = editing ? rows.map((row) => row.id === editing.id ? record : row) : [...rows, record]
    const validation = validateRegions(next, provider.getProjects(), rows)
    if (!validation.valid) { error.textContent = validation.errors.join(' '); return }
    save(next)
    dialogs.querySelector('#region-modal').close()
    render()
    notify('Referensi wilayah disimpan lokal. Master proyek dan data resmi tidak berubah.')
  }
  dialogs.querySelector('#region-template').onclick = () => downloadFile('referensi-wilayah-demo.json', JSON.stringify(rows, null, 2), 'application/json;charset=utf-8')
  dialogs.querySelector('#region-import-form').onsubmit = (event) => {
    event.preventDefault()
    const error = dialogs.querySelector('#region-import-error')
    const button = dialogs.querySelector('#region-import-commit')
    error.textContent = ''
    button.hidden = true
    preview = null
    dialogs.querySelector('#region-import-preview').replaceChildren()
    try {
      const text = dialogs.querySelector('#region-json').value
      if (text.length > 1024 * 1024) throw new Error('Isi JSON melebihi 1 MB.')
      const next = JSON.parse(text)
      const validation = validateRegions(next, provider.getProjects(), rows)
      if (!validation.valid) { error.textContent = `${validation.errors.join(' ')} Seluruh batch ditolak.`; return }
      preview = structuredClone(next)
      previewBase = JSON.stringify(rows)
      dialogs.querySelector('#region-import-preview').innerHTML = `<p class="status-ok">✓ ${number(preview.length)} referensi valid. Belum diterapkan.</p><ul>${preview.map((row) => `<li>${esc(row.name)} · ${esc(row.level)} · ${number(row.projectCodes.length)} proyek · ${esc(row.status)}</li>`).join('')}</ul>`
      button.hidden = false
    } catch (issue) { error.textContent = `Impor belum diterapkan. ${issue.message}` }
  }
  dialogs.querySelector('#region-import-commit').onclick = () => {
    const error = dialogs.querySelector('#region-import-error')
    if (!preview || previewBase !== JSON.stringify(rows)) { error.textContent = 'STALE: Data berubah. Validasi ulang pratinjau sebelum menerapkan.'; return }
    const validation = validateRegions(preview, provider.getProjects(), rows)
    if (!validation.valid) { error.textContent = validation.errors.join(' '); return }
    save(preview)
    preview = null
    dialogs.querySelector('#region-import').close()
    render()
    notify('Seluruh referensi wilayah demo diterapkan atomik pada tab ini.')
  }
  const onHash = () => {
    route = parseBackofficeHash(location.hash)
    render()
    if (route.page === 'regions' && !document.querySelector('#admin-portal').hidden) {
      const heading = root.querySelector('h1')
      heading?.focus({ preventScroll: true })
    }
  }
  window.addEventListener('hashchange', onHash)
  const unsubscribe = provider.subscribe(() => {
    if (corrupt) return
    const derived = regionsFromProjects(provider.getProjects())
    const previous = new Map(rows.map((row) => [row.id, row]))
    rows = [...derived.map((row) => ({ ...row, code: previous.get(row.id)?.code || '', note: previous.get(row.id)?.note ?? row.note })), ...rows.filter((row) => !row.seedKind)]
    save(rows)
    render()
  })
  render()
  return () => { unsubscribe(); window.removeEventListener('hashchange', onHash); dialogs.remove() }
}
