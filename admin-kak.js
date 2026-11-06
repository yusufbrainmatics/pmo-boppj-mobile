import { provider, DEMO_ADMIN, DEMO_REVIEWER, DEMO_TODAY } from './admin-data.js';
import { escapeHtml, formatDate, formatNumber, notify } from './admin-ui.js';

const clone = (value) => structuredClone(value);
const text = (value) => String(value ?? '').trim();
const latest = (entry) => entry.versions.at(-1);
const archived = (entry, version) => entry.archives?.some((event) => event.versionId === version.referenceVersionId);
const statusOf = (entry, version = latest(entry)) => archived(entry, version) ? 'archived' : version.status;
const statusLabel = { draft: 'Draft', published: 'Terbit (demo)', archived: 'Diarsipkan' };
let sequence = 0;
const newId = (prefix) => `${prefix}:${Date.now().toString(36)}:${++sequence}`;

function fail(code, message, fieldErrors = []) {
  throw Object.assign(new Error(message), { code, fieldErrors });
}

export function isContentDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function shiftDate(value, days) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function validateWorkTree(nodes, measurement = 'quantitative') {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  if (!Array.isArray(nodes) || !nodes.length) return [{ field: 'nodes', message: 'Tambahkan section, subsection, dan item acuan.' }];
  const byId = new Map();
  nodes.forEach((node, index) => {
    if (!text(node.id)) add(`nodes.${index}.id`, 'ID struktur wajib diisi.');
    else if (byId.has(node.id)) add(`nodes.${index}.id`, `ID ${node.id} sudah dipakai.`);
    else byId.set(node.id, node);
  });
  const leafCodes = new Set();
  let totalUnits = 0;
  let quantitativeLeaves = 0;
  nodes.forEach((node, index) => {
    const field = (name) => `nodes.${index}.${name}`;
    if (!['section', 'subsection', 'item'].includes(node.kind)) add(field('kind'), 'Pilih section, subsection, atau item.');
    if (!text(node.code)) add(field('code'), 'Kode struktur wajib diisi.');
    if (!text(node.description)) add(field('description'), 'Uraian struktur wajib diisi.');
    const parent = byId.get(node.parentId);
    if (node.kind === 'section' && node.parentId) add(field('parentId'), 'Section harus tanpa parent.');
    if (node.kind !== 'section' && !parent) add(field('parentId'), `Parent ${node.parentId || '(kosong)'} tidak ditemukan.`);
    if (parent && ((node.kind === 'subsection' && parent.kind !== 'section') || (node.kind === 'item' && parent.kind !== 'subsection'))) {
      add(field('parentId'), 'Subsection berada di bawah section; item berada di bawah subsection.');
    }
    const path = new Set([node.id]);
    let cursor = parent;
    while (cursor) {
      if (path.has(cursor.id)) { add(field('parentId'), `Siklus struktur pada ${node.code || node.id}.`); break; }
      path.add(cursor.id);
      cursor = byId.get(cursor.parentId);
    }
    for (const name of ['targetVolume', 'weightPercent']) {
      const value = node[name];
      if (value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) add(field(name), 'Gunakan angka finite, tidak negatif.');
    }
    if (node.kind !== 'item') {
      if (!nodes.some((child) => child.parentId === node.id)) add(field('id'), 'Kelompok harus memiliki rincian; gunakan jenis item untuk leaf.');
      return;
    }
    if (nodes.some((child) => child.parentId === node.id)) add(field('id'), 'Item leaf tidak boleh mempunyai turunan.');
    const code = text(node.code).toUpperCase();
    if (code && leafCodes.has(code)) add(field('code'), `Kode leaf ${node.code} harus unik dalam versi ini.`);
    leafCodes.add(code);
    if (measurement === 'quantitative') {
      quantitativeLeaves++;
      if (!text(node.unit)) add(field('unit'), 'Satuan item terukur wajib diisi.');
      if (typeof node.targetVolume !== 'number' || !Number.isFinite(node.targetVolume) || node.targetVolume <= 0) add(field('targetVolume'), 'Target perhitungan harus lebih dari nol.');
      if (typeof node.weightPercent !== 'number' || !Number.isFinite(node.weightPercent) || node.weightPercent < 0 || node.weightPercent > 100) add(field('weightPercent'), 'Bobot item harus 0 sampai 100 persen.');
      else totalUnits += Math.round(node.weightPercent * 1_000_000);
    }
  });
  if (measurement === 'quantitative' && (!quantitativeLeaves || Math.abs(totalUnits - 100_000_000) > 10_000)) {
    const total = totalUnits / 1_000_000;
    add('nodes', `Total bobot leaf ${total}%; selisih ${Math.abs(100 - total).toFixed(6)} poin persen. Wajib 100% ±0,01 dalam baseline ini.`);
  }
  return errors;
}

export function effectiveReferencePeriod(entry, version) {
  const replacementStarts = entry.versions.filter((candidate) => candidate.status === 'published' && candidate.supersedesVersionId === version.referenceVersionId)
    .map((candidate) => candidate.assignment.validFrom).sort();
  const replacedTo = replacementStarts.length ? shiftDate(replacementStarts[0], -1) : null;
  const to = [version.assignment.validTo, replacedTo].filter(Boolean).sort()[0] || null;
  return { from: version.assignment.validFrom, to };
}

export function validateReferenceVersion(version, { projects = [], packages = [], references = [], referenceId } = {}) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  const assignment = version.assignment || {};
  const project = projects.find((row) => row.kode === assignment.kode);
  const paket = packages.find((row) => row.packageId === assignment.packageId && row.kode === assignment.kode);
  if (!project) add('assignment.kode', 'Pilih proyek dari master yang tersedia.');
  if (!paket) add('assignment.packageId', 'Paket harus berasal dari proyek yang dipilih.');
  if (!isContentDate(assignment.validFrom)) add('assignment.validFrom', 'Tanggal mulai tidak valid.');
  if (assignment.validTo && !isContentDate(assignment.validTo)) add('assignment.validTo', 'Tanggal akhir tidak valid.');
  if (assignment.validTo && assignment.validTo < assignment.validFrom) add('assignment.validTo', 'Tanggal akhir tidak boleh mendahului mulai.');
  if (!text(assignment.metric)) add('assignment.metric', 'Metrik acuan wajib diisi.');
  for (const [field, value] of [
    ['document.title', version.document?.title], ['document.owner', version.document?.owner], ['document.source', version.document?.source],
    ['document.version', version.document?.version], ['template.title', version.template?.title], ['reason', version.reason],
  ]) if (!text(value)) add(field, 'Wajib diisi untuk jejak acuan demo.');
  if (!['quantitative', 'qualitative'].includes(version.measurement)) add('measurement', 'Pilih kuantitatif atau kualitatif.');
  errors.push(...validateWorkTree(version.template?.nodes, version.measurement));
  const own = references.find((entry) => entry.referenceId === referenceId);
  if (version.supersedesVersionId) {
    const previous = own?.versions.find((row) => row.referenceVersionId === version.supersedesVersionId && row.status === 'published');
    if (!previous || archived(own, previous)) add('assignment.validFrom', 'Versi yang diganti tidak tersedia sebagai acuan terbit.');
    else {
      if (['kode', 'packageId', 'metric'].some((key) => previous.assignment[key] !== assignment[key]) || previous.measurement !== version.measurement) add('assignment.packageId', 'Rebaseline wajib memakai proyek, paket, metrik, dan mode yang sama. Buat acuan terpisah untuk lingkup lain.');
      if (assignment.validFrom <= previous.assignment.validFrom) add('assignment.validFrom', 'Rebaseline harus dimulai setelah awal versi sebelumnya.');
      if (own.versions.some((row) => row.status === 'published' && row.referenceVersionId !== version.referenceVersionId && row.supersedesVersionId === previous.referenceVersionId)) add('assignment.validFrom', 'Versi ini telah diganti. Muat ulang acuan terbaru.');
    }
  }
  if (version.measurement === 'quantitative' && isContentDate(assignment.validFrom)) {
    const candidate = clone(version);
    candidate.status = 'published';
    const combined = references.map((entry) => entry.referenceId === referenceId ? { ...entry, versions: [...entry.versions.filter((row) => row.referenceVersionId !== candidate.referenceVersionId), candidate] } : entry);
    if (!combined.some((entry) => entry.referenceId === referenceId)) combined.push({ referenceId, versions: [candidate], archives: [] });
    const candidateEntry = combined.find((entry) => entry.referenceId === referenceId);
    const range = effectiveReferencePeriod(candidateEntry, candidate);
    for (const entry of combined) for (const existing of entry.versions) {
      if (existing.referenceVersionId === version.referenceVersionId || existing.status !== 'published' || archived(entry, existing) || existing.measurement !== 'quantitative') continue;
      const scope = existing.assignment;
      if (scope.packageId !== assignment.packageId || scope.metric !== assignment.metric) continue;
      const other = effectiveReferencePeriod(entry, existing);
      if (range.from <= (other.to || '9999-12-31') && other.from <= (range.to || '9999-12-31')) add('assignment.validFrom', `Baseline bertabrakan dengan ${existing.referenceVersionId}, paket ${scope.packageId}, metrik ${scope.metric}, ${other.from} sampai ${other.to || 'tanpa akhir'}.`);
    }
  }
  return errors;
}

export function seedKakCatalog(projects, packages, today) {
  return projects.slice(0, 2).map((project, index) => {
    const paket = packages.find((row) => row.kode === project.kode);
    if (!paket) return null;
    const referenceId = `acuan:${project.kode}:contoh`;
    const nodes = [
      { id: 's1', kind: 'section', parentId: null, code: 'I', description: index ? 'Pengamatan pesisir (contoh)' : 'Persiapan tanggul (contoh)', unit: '', targetVolume: null, weightPercent: null },
      { id: 'ss1', kind: 'subsection', parentId: 's1', code: 'I.1', description: 'Rincian monitoring ilustratif', unit: '', targetVolume: null, weightPercent: null },
      { id: 'i1', kind: 'item', parentId: 'ss1', code: 'I.1.1', description: index ? 'Titik observasi contoh' : 'Pengukuran segmen contoh', unit: index ? 'titik' : 'm', targetVolume: index ? 8 : 120, weightPercent: index ? 65 : 40 },
      { id: 'i2', kind: 'item', parentId: 'ss1', code: 'I.1.2', description: index ? 'Catatan kondisi contoh' : 'Dokumentasi pengukuran contoh', unit: 'dokumen', targetVolume: index ? 4 : 2, weightPercent: index ? 35 : 60 },
    ];
    return {
      referenceId, revision: 1, illustrative: true, archives: [],
      versions: [{
        referenceVersionId: `${referenceId}:v1`, version: 1, status: 'published', measurement: 'quantitative', supersedesVersionId: null,
        document: { documentId: `dokumen:${project.kode}:contoh`, title: `Contoh KAK ${project.kode}`, number: '', version: '1 (ilustratif)', owner: 'Pemilik dokumen demo', source: 'Fixture BrainDevs; bukan dokumen atau target resmi BOPPJ.', attachment: null },
        template: { templateId: `template:${project.kode}:contoh`, title: `Struktur contoh ${project.kode}`, version: 1, nodes },
        assignment: { projectId: project.projectId || `project:${project.kode}`, kode: project.kode, packageId: paket.packageId, metric: 'wbs-volume-demo', validFrom: `${today.slice(0, 7)}-01`, validTo: null },
        createdBy: 'kak-author-demo', createdAt: `${today}T00:00:00Z`, publishedBy: 'admin-demo', publishedAt: `${today}T00:00:00Z`, reason: 'Snapshot ilustratif untuk menguji dua proyek dengan rincian yang berbeda.',
      }],
    };
  }).filter(Boolean);
}

export function createKakService({ provider: source, now = () => new Date().toISOString() }) {
  const timestamp = () => new Date(typeof now === 'function' ? now() : now).toISOString();
  const read = () => source.getCatalog('references');
  const scoped = (entry, actor) => !!actor && actor.projectCodes?.includes(latest(entry).assignment.kode);
  function authorized(actor, kode) {
    if (actor?.role !== 'admin' || !actor.projectCodes?.includes(kode)) fail('FORBIDDEN', 'Hanya admin dalam lingkup proyek yang dapat mengubah acuan.');
  }
  function writable(id, expectedRevision, actor) {
    const rows = read();
    const entry = rows.find((row) => row.referenceId === id);
    if (!entry || !scoped(entry, actor)) fail('NOT_FOUND', 'Acuan tidak ditemukan dalam lingkup pembaca.');
    authorized(actor, latest(entry).assignment.kode);
    if (entry.revision !== expectedRevision) fail('CONFLICT', 'Acuan berubah sejak dibuka. Muat ulang sebelum menyimpan; input belum diterapkan.');
    return { rows, entry };
  }
  function persist(rows, entry) {
    source.saveCatalog('references', rows);
    return clone(entry);
  }
  return {
    list(filters = {}, actor) {
      return read().filter((entry) => scoped(entry, actor)).filter((entry) => {
        const version = latest(entry);
        return (!filters.kode || version.assignment.kode === filters.kode) && (!filters.status || statusOf(entry) === filters.status) &&
          (!filters.q || `${entry.referenceId} ${version.document.title} ${version.template.title} ${version.assignment.kode}`.toLowerCase().includes(text(filters.q).toLowerCase()));
      }).map(clone);
    },
    get(id, actor) {
      const entry = read().find((row) => row.referenceId === id && scoped(row, actor));
      if (!entry) fail('NOT_FOUND', 'Acuan tidak ditemukan dalam lingkup pembaca.');
      return clone(entry);
    },
    saveDraft(payload, { id, expectedRevision = 0, actor } = {}) {
      authorized(actor, payload.assignment?.kode);
      let rows = read();
      let entry;
      if (id) {
        const hasil = writable(id, expectedRevision, actor)
        rows = hasil.rows
        entry = hasil.entry
      } else {
        const referenceId = newId('acuan');
        entry = { referenceId, revision: 0, illustrative: true, versions: [], archives: [] };
        rows.push(entry);
      }
      const previous = latest(entry);
      if (previous && (previous.status !== 'draft' || archived(entry, previous))) fail('IMMUTABLE', 'Versi terbit/arsip tidak dapat ditimpa. Buat rebaseline beralasan.');
      const number = previous?.version || 1;
      const project = source.getProjects().find((row) => row.kode === payload.assignment?.kode);
      const version = {
        referenceVersionId: previous?.referenceVersionId || `${entry.referenceId}:v${number}`, version: number, status: 'draft',
        measurement: payload.measurement,
        document: { documentId: previous?.document.documentId || newId('dokumen'), title: text(payload.document?.title), number: text(payload.document?.number), version: text(payload.document?.version), owner: text(payload.document?.owner), source: text(payload.document?.source), attachment: null },
        template: { templateId: previous?.template.templateId || newId('template'), title: text(payload.template?.title), version: number, nodes: clone(payload.template?.nodes || []) },
        assignment: { projectId: project?.projectId || (project ? `project:${project.kode}` : null), kode: text(payload.assignment?.kode), packageId: text(payload.assignment?.packageId), metric: text(payload.assignment?.metric), validFrom: text(payload.assignment?.validFrom), validTo: text(payload.assignment?.validTo) || null },
        reason: text(payload.reason), createdBy: previous?.createdBy || actor.id, createdAt: previous?.createdAt || timestamp(), updatedBy: actor.id, updatedAt: timestamp(), supersedesVersionId: previous?.supersedesVersionId || null,
      };
      const errors = validateReferenceVersion(version, { projects: source.getProjects(), packages: source.getPackages() }).filter((error) => !error.field.startsWith('nodes') && !(version.supersedesVersionId && error.field === 'assignment.validFrom' && error.message.startsWith('Versi yang')));
      if (errors.length) fail('VALIDATION', 'Lengkapi metadata draft. Struktur dapat diperbaiki sebelum publikasi.', errors);
      if (previous) entry.versions[entry.versions.length - 1] = version;
      else entry.versions.push(version);
      entry.revision++;
      return persist(rows, entry);
    },
    publish(id, { expectedRevision, reason, actor } = {}) {
      const { rows, entry } = writable(id, expectedRevision, actor);
      const draft = latest(entry);
      if (draft.status !== 'draft' || archived(entry, draft)) fail('IMMUTABLE', 'Hanya draft aktif yang dapat dipublikasikan.');
      if (!text(reason)) fail('VALIDATION', 'Alasan publikasi demo wajib diisi.', [{ field: 'reason', message: 'Isi alasan publikasi.' }]);
      const version = { ...clone(draft), reason: text(reason) };
      const errors = validateReferenceVersion(version, { projects: source.getProjects(), packages: source.getPackages(), references: rows, referenceId: id });
      if (errors.length) fail('VALIDATION', 'Publikasi ditahan. Perbaiki struktur, periode, atau lingkup.', errors);
      version.status = 'published';
      version.publishedAt = timestamp();
      version.publishedBy = actor.id;
      entry.versions[entry.versions.length - 1] = version;
      entry.revision++;
      return persist(rows, entry);
    },
    rebaseline(id, { expectedRevision, validFrom, reason, actor } = {}) {
      const { rows, entry } = writable(id, expectedRevision, actor);
      const previous = latest(entry);
      if (previous.status !== 'published' || archived(entry, previous)) fail('CONFLICT', 'Rebaseline membutuhkan versi terbit aktif tanpa draft pengganti.');
      if (!text(reason) || !isContentDate(validFrom) || validFrom <= previous.assignment.validFrom) fail('VALIDATION', 'Isi alasan dan tanggal rebaseline setelah awal versi sebelumnya.', [{ field: 'reason', message: 'Alasan wajib diisi.' }, { field: 'validFrom', message: 'Tanggal pengganti harus valid dan setelah awal versi sebelumnya.' }]);
      const number = previous.version + 1;
      entry.versions.push({ ...clone(previous), referenceVersionId: `${id}:v${number}`, version: number, status: 'draft', template: { ...clone(previous.template), version: number }, assignment: { ...clone(previous.assignment), validFrom, validTo: null }, reason: text(reason), supersedesVersionId: previous.referenceVersionId, createdBy: actor.id, createdAt: timestamp(), updatedAt: timestamp(), updatedBy: actor.id, publishedAt: null, publishedBy: null });
      entry.revision++;
      return persist(rows, entry);
    },
    archive(id, { expectedRevision, versionId, reason, actor } = {}) {
      const { rows, entry } = writable(id, expectedRevision, actor);
      const version = entry.versions.find((row) => row.referenceVersionId === versionId);
      if (!version || archived(entry, version)) fail('CONFLICT', 'Versi tidak tersedia atau telah diarsipkan.');
      if (!text(reason)) fail('VALIDATION', 'Alasan arsip wajib diisi.', [{ field: 'reason', message: 'Isi alasan arsip.' }]);
      entry.archives.push({ versionId, reason: text(reason), actorId: actor.id, at: timestamp() });
      entry.revision++;
      return persist(rows, entry);
    },
  };
}

const e = escapeHtml;
const input = (name, label, value = '', type = 'text', extra = '') => `<label>${e(label)}<input name="${e(name)}" type="${type}" value="${e(value)}" ${extra} aria-describedby="kak-error-${e(name)}"><small class="content-field-error" id="kak-error-${e(name)}" data-field-error="${e(name)}"></small></label>`;
const options = (rows, value) => rows.map(([id, label]) => `<option value="${e(id)}" ${id === value ? 'selected' : ''}>${e(label)}</option>`).join('');

export function initKak(root) {
  if (!root) return () => {};
  const service = createKakService({ provider });
  const actor = DEMO_ADMIN;
  let initialized = false;
  function route() {
    const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
    const [prefix, id] = path.split('/');
    return { matches: prefix === 'management', id: id ? decodeURIComponent(id) : null, params: new URLSearchParams(query) };
  }
  function url(id, updates = {}) {
    const params = new URLSearchParams(route().params);
    params.delete('edit'); params.delete('action'); params.delete('version');
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    return `#management${id ? `/${encodeURIComponent(id)}` : ''}${params.size ? `?${params}` : ''}`;
  }
  function move(id, updates) { location.hash = url(id, updates); }
  function projects() { return provider.getProjects().filter((row) => actor.projectCodes.includes(row.kode)); }
  function header(title, subtitle, action = '') {
    return `<div class="content-module"><header class="content-heading"><div><h1 tabindex="-1">${e(title)}</h1><p>${e(subtitle)}</p></div>${action}</header><p class="content-notice" data-content-stale hidden>Data sesi berubah. Input belum ditimpa. <button type="button" data-content-refresh>Muat ulang</button></p><div class="content-errors" role="alert" tabindex="-1" hidden></div>`;
  }
  function errors(error) {
    const target = root.querySelector('.content-errors');
    if (!target) return;
    target.hidden = false;
    target.textContent = `${error.code || 'ERROR'}: ${error.message}`;
    for (const field of root.querySelectorAll('[data-field-error]')) field.textContent = '';
    for (const problem of error.fieldErrors || []) {
      const field = [...root.querySelectorAll('[data-field-error]')].find((element) => element.dataset.fieldError === problem.field);
      if (field) field.textContent = problem.message;
      const line = document.createElement('p'); line.textContent = `${problem.field}: ${problem.message}`; target.append(line);
    }
    target.focus();
  }
  function drawList(params) {
    const filters = Object.fromEntries(params);
    const rows = service.list(filters, actor);
    root.innerHTML = `${header('Kerangka Acuan Kerja', 'Dokumen KAK, template struktur, dan snapshot acuan proyek/paket adalah objek berbeda.', `<a class="content-button primary" href="${e(url('new'))}">Buat draft acuan</a>`)}
      <form class="content-filters" data-kak-form="filters">${input('q', 'Cari dokumen atau kode', filters.q, 'search')}<label>Proyek<select name="kode">${options([['', 'Semua proyek'], ...projects().map((row) => [row.kode, `${row.kode} · ${row.nama}`])], filters.kode)}</select></label><label>Status<select name="status">${options([['', 'Semua status'], ...Object.entries(statusLabel)], filters.status)}</select></label><button class="content-button" type="submit">Terapkan filter</button><a class="content-button" href="#management">Reset filter</a></form>
      <section class="content-section"><h2>Daftar acuan proyek/paket</h2><p role="status">${e(rows.length)} acuan sesuai filter dan lingkup admin demo.</p>${rows.length ? `<div class="content-table-scroll" role="region" aria-label="Daftar acuan KAK, dapat digulir mendatar" tabindex="0"><table><thead><tr><th scope="col">Dokumen / snapshot</th><th scope="col">Proyek dan paket</th><th scope="col">Template dan versi</th><th scope="col">Perhitungan</th><th scope="col">Status</th><th scope="col">Mulai</th></tr></thead><tbody>${rows.map((entry) => {
        const version = latest(entry);
        return `<tr><td><a href="${e(url(entry.referenceId))}">${e(version.document.title)}</a><small>${e(entry.referenceId)}</small></td><td>${e(version.assignment.kode)}<small>${e(provider.getPackages().find((row) => row.packageId === version.assignment.packageId)?.nama || version.assignment.packageId)}</small></td><td>${e(version.template.title)}<small>Snapshot v${e(version.version)}</small></td><td>${version.measurement === 'quantitative' ? 'Kuantitatif contoh' : 'Kualitatif, tanpa persentase'}</td><td><span class="content-status ${e(statusOf(entry))}">${e(statusLabel[statusOf(entry)])}</span></td><td>${e(formatDate(version.assignment.validFrom))}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<div class="content-empty"><h3>Tidak ada acuan sesuai filter</h3><p>Ubah filter atau buat draft acuan untuk proyek yang ditugaskan.</p></div>'}</section><p class="content-footnote">Laporan tanpa referenceVersionId tetap berstatus Legacy, belum dipetakan. Publikasi di sini tidak memasangkan laporan lama atau mengisi baseline progres resmi.</p></div>`;
  }
  function nodeEditor(node, index) {
    const prefix = `nodes.${index}.`;
    const field = (key, label, value, type = 'text') => input(prefix + key, label, value, type, type === 'number' ? 'min="0" step="any"' : '');
    return `<fieldset class="content-node" data-node><legend>Struktur ${index + 1}</legend><div class="content-editor-grid">${field('id', 'ID unik', node.id)}<label>Jenis<select name="${prefix}kind">${options([['section', 'Section'], ['subsection', 'Subsection'], ['item', 'Item leaf']], node.kind)}</select><small class="content-field-error" data-field-error="${prefix}kind"></small></label>${field('parentId', 'ID parent (section kosong)', node.parentId)}${field('code', 'Kode', node.code)}${field('description', 'Uraian', node.description)}${field('unit', 'Satuan item', node.unit)}${field('targetVolume', 'Target volume', node.targetVolume, 'number')}${field('weightPercent', 'Bobot (%)', node.weightPercent, 'number')}</div><button class="content-button" type="button" data-remove-node>Hapus baris struktur</button></fieldset>`;
  }
  function drawEditor(id) {
    const entry = id === 'new' ? null : service.get(id, actor);
    const version = entry ? latest(entry) : { document: { version: '1', owner: '', source: '' }, template: { nodes: [] }, assignment: { kode: '', packageId: '', metric: 'wbs-volume-demo', validFrom: DEMO_TODAY }, measurement: 'quantitative' };
    if (entry && statusOf(entry) !== 'draft') throw Object.assign(new Error('Versi terbit/arsip tidak dapat ditimpa. Gunakan rebaseline.'), { code: 'IMMUTABLE' });
    root.innerHTML = `${header(entry ? 'Edit draft acuan' : 'Draft acuan baru', 'Isi metadata terpisah; validasi struktur dan benturan baseline dijalankan saat publikasi.')}<nav class="content-breadcrumb" aria-label="Breadcrumb"><a href="${e(url())}">Daftar acuan</a>${entry ? `<a href="${e(url(id))}">Detail acuan</a>` : '<span>Draft baru</span>'}</nav><form data-kak-form="editor" data-id="${e(entry?.referenceId || '')}" data-revision="${entry?.revision || 0}"><section class="content-section"><h2>Dokumen KAK</h2><div class="content-editor-grid">${input('document.title', 'Judul dokumen *', version.document.title, 'text', 'required')}${input('document.number', 'Nomor dokumen (bila ada)', version.document.number)}${input('document.version', 'Versi dokumen *', version.document.version, 'text', 'required')}${input('document.owner', 'Pemilik dokumen *', version.document.owner, 'text', 'required')}${input('document.source', 'Sumber dan status *', version.document.source, 'text', 'required')}</div><p>Dokumen berupa metadata/sumber teks. Lampiran dokumen tidak tersedia.</p></section><section class="content-section"><h2>Penugasan snapshot</h2><div class="content-editor-grid"><label>Proyek *<select name="assignment.kode" required>${options([['', 'Pilih proyek'], ...projects().map((row) => [row.kode, `${row.kode} · ${row.nama}`])], version.assignment.kode)}</select><small class="content-field-error" data-field-error="assignment.kode"></small></label><label>Paket *<select name="assignment.packageId" required>${packageOptions(version.assignment.kode, version.assignment.packageId)}</select><small class="content-field-error" data-field-error="assignment.packageId"></small></label>${input('assignment.metric', 'Kode metrik baseline *', version.assignment.metric, 'text', 'required')}${input('assignment.validFrom', 'Berlaku mulai *', version.assignment.validFrom, 'date', 'required')}${input('assignment.validTo', 'Berlaku sampai (kosong: terbuka)', version.assignment.validTo, 'date')}<label>Mode acuan<select name="measurement">${options([['quantitative', 'Kuantitatif (target dan bobot)'], ['qualitative', 'Kualitatif (tanpa perhitungan)']], version.measurement)}</select></label></div></section><section class="content-section"><h2>Template rincian pekerjaan</h2>${input('template.title', 'Nama template *', version.template.title, 'text', 'required')}<p>Urutan: section tanpa parent, subsection di bawah section, lalu item leaf. Bobot hanya dijumlahkan pada leaf baseline ini. Isi target dan bobot sesuai dokumen KAK.</p><div data-nodes>${version.template.nodes.map(nodeEditor).join('')}</div><button class="content-button" type="button" data-add-node>Tambah baris struktur</button><small class="content-field-error" data-field-error="nodes"></small></section><section class="content-section"><h2>Jejak perubahan lokal</h2>${input('reason', 'Alasan penyimpanan draft *', version.reason, 'text', 'required')}<div class="content-actions"><button class="content-button primary" type="submit">Simpan draft</button><a class="content-button" href="${e(url(entry?.referenceId))}">Batal</a></div></section></form></div>`;
  }
  function packageOptions(kode, selected) {
    return options([['', 'Pilih paket proyek'], ...provider.getPackages({ kode }).filter((row) => row.kode === kode).map((row) => [row.packageId, row.nama])], selected);
  }

  function hasChild(node, version) {
    return version.template.nodes.some((row) => row.parentId === node.id);
  }
  function kakTreeRows(version) {
    const nodes = version.template.nodes;
    const byParent = new Map();
    for (const node of nodes) {
      const key = node.parentId && nodes.some((row) => row.id === node.parentId) ? node.parentId : null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(node);
    }
    const rows = [];
    const walk = (node, depth) => {
      const leaf = !hasChild(node, version);
      const kelas = leaf ? 'item' : depth === 0 ? 'section' : 'sub';
      const isi = leaf
        ? `<td>${e(node.unit || '—')}</td><td class="kak-angka">${e(node.targetVolume == null ? '—' : formatNumber(node.targetVolume))}</td><td class="kak-angka">${e(version.measurement === 'qualitative' || node.weightPercent == null ? '—' : `${formatNumber(node.weightPercent)}%`)}</td>`
        : '<td colspan="3" class="kak-info">' + (depth === 0 ? 'Bagian pekerjaan' : 'Rincian bagian') + '</td>';
      rows.push(`<tr class="kak-row ${kelas}"><th scope="row">${e(node.code || '—')}</th><td class="kak-uraian" style="padding-left:calc(var(--space-xs) + ${depth} * var(--space-md))">${e(node.description)}</td>${isi}</tr>`);
      for (const child of byParent.get(node.id) || []) walk(child, depth + 1);
    };
    for (const root of byParent.get(null) || []) walk(root, 0);
    return rows.join('') || '<tr><td colspan="5" class="content-empty">Belum ada struktur pekerjaan.</td></tr>';
  }
  function drawDetail(id, params) {
    const entry = service.get(id, actor);
    const version = params.get('version') ? entry.versions.find((row) => row.referenceVersionId === params.get('version')) : latest(entry);
    if (!version) throw Object.assign(new Error('Versi acuan tidak ditemukan.'), { code: 'NOT_FOUND' });
    const state = statusOf(entry, version);
    const period = effectiveReferencePeriod(entry, version);
    const action = params.get('action');
    const actionLabels = { publish: 'Publikasikan acuan', rebaseline: 'Buat draft rebaseline', archive: 'Arsipkan versi' };
    const editable = version.referenceVersionId === latest(entry).referenceVersionId;
    const packages = provider.getPackages();
    const reports = provider.getReports({ kode: version.assignment.kode, packageId: version.assignment.packageId }, DEMO_REVIEWER);
    const legacy = reports.filter((row) => !row.referenceVersionId).length;
    root.innerHTML = `${header(version.document.title, `Snapshot v${version.version} · ${version.assignment.kode} · ${statusLabel[state]}`)}<nav class="content-breadcrumb" aria-label="Breadcrumb"><a href="${e(url())}">Daftar acuan</a><span>${e(entry.referenceId)}</span></nav><div class="content-actions">${editable && state === 'draft' ? `<a class="content-button" href="${e(url(id, { edit: '1' }))}">Edit draft</a><a class="content-button primary" href="${e(url(id, { action: 'publish' }))}">Publikasikan</a>` : ''}${editable && state === 'published' ? `<a class="content-button primary" href="${e(url(id, { action: 'rebaseline' }))}">Rebaseline beralasan</a>` : ''}${state !== 'archived' ? `<a class="content-button" href="${e(url(id, { action: 'archive', version: version.referenceVersionId }))}">Arsipkan versi</a>` : ''}</div>
      <section class="content-section"><h2>Dokumen KAK</h2><dl class="content-metadata"><dt>ID dokumen</dt><dd>${e(version.document.documentId)}</dd><dt>Nomor / versi</dt><dd>${e(version.document.number || 'Nomor belum tersedia')} / ${e(version.document.version)}</dd><dt>Pemilik</dt><dd>${e(version.document.owner)}</dd><dt>Sumber</dt><dd>${e(version.document.source)}</dd><dt>Lampiran</dt><dd>Tidak tersedia.</dd></dl></section>
      <section class="content-section"><h2>Acuan proyek/paket</h2><dl class="content-metadata"><dt>Versi snapshot</dt><dd>${e(version.referenceVersionId)}</dd><dt>Proyek</dt><dd>${e(version.assignment.kode)} · ${e(provider.getProjects().find((row) => row.kode === version.assignment.kode)?.nama || 'Master tidak tersedia')}</dd><dt>Paket</dt><dd>${e(packages.find((row) => row.packageId === version.assignment.packageId)?.nama || version.assignment.packageId)}</dd><dt>Metrik / mode</dt><dd>${e(version.assignment.metric)} / ${version.measurement === 'quantitative' ? 'Kuantitatif' : 'Kualitatif, tidak menghasilkan persentase'}</dd><dt>Periode snapshot asli</dt><dd>${e(formatDate(version.assignment.validFrom))} sampai ${e(version.assignment.validTo ? formatDate(version.assignment.validTo) : 'tanpa akhir')}</dd><dt>Periode efektif demo</dt><dd>${e(formatDate(period.from))} sampai ${e(period.to ? formatDate(period.to) : 'tanpa akhir')}${state === 'archived' ? '; arsip, bukan acuan aktif' : ''}</dd><dt>Alasan</dt><dd>${e(version.reason)}</dd><dt>Pembuat / penerbit</dt><dd>${e(version.createdBy)} / ${e(version.publishedBy || 'Belum terbit')}</dd><dt>Dibuat / terbit</dt><dd>${e(formatDate(version.createdAt))} / ${e(version.publishedAt ? formatDate(version.publishedAt) : 'Belum terbit')}</dd></dl><p class="content-notice">${e(legacy)} laporan pada lingkup ini belum terhubung ke acuan (Legacy).</p></section>
      <section class="content-section"><h2>Rincian pekerjaan: ${e(version.template.title)}</h2><div class="content-table-scroll" role="region" aria-label="Struktur hirarkis section, subsection, dan item pekerjaan" tabindex="0"><table class="kak-table"><caption class="sr-only">Struktur pekerjaan menurut section, subsection, dan item</caption><thead><tr><th scope="col">Kode</th><th scope="col">Uraian pekerjaan</th><th scope="col">Satuan</th><th scope="col">Target</th><th scope="col">Bobot</th></tr></thead><tbody>${kakTreeRows(version)}</tbody><tfoot><tr><th scope="row" colspan="4">Total bobot leaf</th><td>${version.measurement === 'quantitative' ? `${formatNumber(version.template.nodes.filter((node) => !hasChild(node, version) && node.weightPercent != null).reduce((sum, node) => sum + (node.weightPercent || 0), 0))}%` : 'Kualitatif — tanpa bobot'}</td></tr></tfoot></table></div></section>
      <section class="content-section"><h2>Riwayat versi dan arsip lokal</h2><ul class="content-history">${entry.versions.map((row) => `<li><a href="${e(url(id, { version: row.referenceVersionId }))}">Snapshot v${e(row.version)}</a> · ${e(statusLabel[statusOf(entry, row)])} · ${e(row.reason)}${row.supersedesVersionId ? ` · mengganti ${e(row.supersedesVersionId)}` : ''}</li>`).join('')}${entry.archives.map((event) => `<li>Arsip ${e(event.versionId)} · ${e(event.reason)} · ${e(event.actorId)} · ${e(formatDate(event.at))}</li>`).join('')}</ul><p>Arsip menyimpan versi dan relasinya.</p></section>
      ${actionLabels[action] ? `<section class="content-section"><h2>${e(actionLabels[action])}</h2><p>Dilakukan oleh ${e(actor.id)}.</p><form data-kak-form="action" data-action="${e(action)}" data-id="${e(id)}" data-version="${e(version.referenceVersionId)}" data-revision="${entry.revision}">${input('reason', 'Alasan tindakan *', '', 'text', 'required')}${action === 'rebaseline' ? input('validFrom', 'Berlaku mulai versi pengganti *', shiftDate(DEMO_TODAY > version.assignment.validFrom ? DEMO_TODAY : version.assignment.validFrom, 1), 'date', 'required') : ''}<div class="content-actions"><button class="content-button primary" type="submit">${e(actionLabels[action])}</button><a class="content-button" href="${e(url(id))}">Batal</a></div></form></section>` : ''}</div>`;
  }
  function render(focus = false) {
    let current;
    try {
      current = route();
      if (!current.matches) return;
      if (!initialized) {
        const existing = provider.getCatalog('references');
        if (!existing.length) provider.saveCatalog('references', seedKakCatalog(provider.getProjects(), provider.getPackages(), DEMO_TODAY));
        initialized = true;
      }
      if (!current.id) drawList(current.params);
      else if (current.id === 'new' || current.params.get('edit') === '1') drawEditor(current.id);
      else drawDetail(current.id, current.params);
      if (focus) root.querySelector('h1')?.focus();
    } catch (error) {
      root.innerHTML = `${header('Acuan tidak dapat ditampilkan', 'Data tidak tersedia, di luar lingkup, atau gagal dibaca. Tidak diganti dengan data sukses palsu.')}<button class="content-button" data-content-refresh>Coba lagi</button><a class="content-button" href="#management">Daftar acuan</a></div>`;
      errors(error);
    }
  }
  function editorPayload(form) {
    const data = new FormData(form);
    const value = (name) => text(data.get(name));
    const number = (name) => value(name) === '' ? null : Number(value(name));
    return {
      measurement: value('measurement'), reason: value('reason'),
      document: Object.fromEntries(['title', 'number', 'version', 'owner', 'source'].map((key) => [key, value(`document.${key}`)])),
      assignment: Object.fromEntries(['kode', 'packageId', 'metric', 'validFrom', 'validTo'].map((key) => [key, value(`assignment.${key}`)])),
      template: { title: value('template.title'), nodes: [...form.querySelectorAll('[data-node]')].map((_, index) => ({
        ...Object.fromEntries(['id', 'kind', 'parentId', 'code', 'description', 'unit'].map((key) => [key, value(`nodes.${index}.${key}`)])),
        targetVolume: number(`nodes.${index}.targetVolume`), weightPercent: number(`nodes.${index}.weightPercent`),
      })) },
    };
  }
  function reindexNodes() {
    root.querySelectorAll('[data-node]').forEach((fieldset, index) => {
      fieldset.querySelector('legend').textContent = `Struktur ${index + 1}`;
      for (const element of fieldset.querySelectorAll('[name], [data-field-error], [id], [aria-describedby]')) {
        for (const attribute of ['name', 'data-field-error', 'id', 'aria-describedby']) if (element.hasAttribute(attribute)) element.setAttribute(attribute, element.getAttribute(attribute).replace(/nodes\.\d+\./g, `nodes.${index}.`));
      }
    });
  }
  function click(event) {
    if (event.target.closest('[data-content-refresh]')) render(true);
    if (event.target.closest('[data-add-node]')) {
      const container = root.querySelector('[data-nodes]');
      container.insertAdjacentHTML('beforeend', nodeEditor({ id: newId('item'), kind: 'item', parentId: '', code: '', description: '', unit: '', targetVolume: null, weightPercent: null }, container.children.length));
      container.lastElementChild.querySelector('input').focus();
    }
    const remove = event.target.closest('[data-remove-node]');
    if (remove) { remove.closest('[data-node]').remove(); reindexNodes(); root.querySelector('[data-add-node]').focus(); }
  }
  function change(event) {
    if (event.target.name === 'assignment.kode') root.querySelector('[name="assignment.packageId"]').innerHTML = packageOptions(event.target.value, '');
  }
  function submit(event) {
    const form = event.target.closest('[data-kak-form]');
    if (!form) return;
    event.preventDefault();
    try {
      if (form.dataset.kakForm === 'filters') return move(null, Object.fromEntries(new FormData(form)));
      const revision = Number(form.dataset.revision);
      let entry;
      if (form.dataset.kakForm === 'editor') entry = service.saveDraft(editorPayload(form), { id: form.dataset.id || undefined, expectedRevision: revision, actor });
      else {
        const data = new FormData(form);
        entry = service[form.dataset.action](form.dataset.id, { expectedRevision: revision, versionId: form.dataset.version, validFrom: text(data.get('validFrom')), reason: text(data.get('reason')), actor });
      }
      notify('Perubahan acuan disimpan.');
      move(entry.referenceId); render(true);
    } catch (error) { errors(error); }
  }
  root.innerHTML = '<div class="content-module" role="status">Memuat acuan…</div>';
  root.addEventListener('click', click); root.addEventListener('change', change); root.addEventListener('submit', submit);
  const hashchange = () => render(true);
  window.addEventListener('hashchange', hashchange);
  const unsubscribe = provider.subscribe(() => {
    if (!initialized || !route().matches) return;
    if (root.querySelector('form[data-kak-form="editor"], form[data-kak-form="action"]')) root.querySelector('[data-content-stale]')?.removeAttribute('hidden');
    else render();
  });
  render();
  return () => { root.removeEventListener('click', click); root.removeEventListener('change', change); root.removeEventListener('submit', submit); window.removeEventListener('hashchange', hashchange); unsubscribe(); };
}
