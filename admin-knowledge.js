import { provider, DEMO_ADMIN, DEMO_REVIEWER, DEMO_CONTRACTOR, DEMO_TODAY } from './admin-data.js';
import { escapeHtml, formatDate, notify } from './admin-ui.js';

export const KNOWLEDGE_TYPES = Object.freeze({ BASIS_PENGETAHUAN: 'Basis Pengetahuan', LESSON_LEARNED: 'Lesson Learned Proyek', FAQ: 'Tanya Jawab (FAQ)' });
const LEGACY_TYPES = { Panduan: 'BASIS_PENGETAHUAN', 'Tanya jawab': 'FAQ', 'Lesson learned': 'LESSON_LEARNED' };
const MOBILE_TYPES = { BASIS_PENGETAHUAN: 'Panduan', FAQ: 'Tanya jawab', LESSON_LEARNED: 'Lesson learned' };
const STATUS = { draft: 'Draft', 'in-review': 'Dalam review', published: 'Terbit (demo)', archived: 'Diarsipkan' };
const VISIBILITY = { organization: 'Organisasi (terbit: dapat dibaca publik demo)', project: 'Proyek sesuai penugasan', private: 'Usulan privat penulis dan editor' };
const clone = (value) => structuredClone(value);
const text = (value) => String(value ?? '').trim();
const last = (entry) => entry.versions.at(-1);
const isEditor = (actor) => actor?.role === 'reviewer';
const inScope = (version, actor) => !version.kode || !!actor?.projectCodes?.includes(version.kode);
const isArchived = (entry, version) => entry.archives?.some((event) => event.versionId === version.versionId);
const versionStatus = (entry, version) => isArchived(entry, version) ? 'archived' : version.status;
let sequence = 0;
const newId = () => `KM-${Date.now().toString(36)}-${++sequence}`;

function fail(code, message, fieldErrors = []) {
  throw Object.assign(new Error(message), { code, fieldErrors });
}

function dateOffset(today, offset = 0) {
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(offset || 0));
  return date.toISOString();
}

export function normalizeKnowledgeCatalog(rows, { projects = [], packages = [], today = new Date().toISOString().slice(0, 10) } = {}) {
  if (!Array.isArray(rows)) fail('CORRUPT_CATALOG', 'Katalog pengetahuan bukan daftar yang valid. Tidak diganti diam-diam dengan fixture.');
  const entries = rows.map((row) => {
    if (row.entryId && Array.isArray(row.versions)) return clone(row);
    const type = LEGACY_TYPES[row.jenis];
    if (!type || !row.id || !Array.isArray(row.isi)) fail('CORRUPT_CATALOG', 'Bentuk seed pengetahuan tidak dikenal. Periksa adapter, bukan mengarang artikel pengganti.');
    const kode = type === 'LESSON_LEARNED' ? projects.find((project) => String(row.ringkas).includes(project.kode))?.kode || null : null;
    const publishedAt = dateOffset(today, row.offset);
    const version = {
      versionId: `${row.id}:v1`, version: 1, status: 'published', type, title: text(row.judul), summary: text(row.ringkas), body: row.isi.map(String).join('\n\n'),
      owner: 'Tim konten demo BrainDevs', source: `src/data/pengetahuan.json · ${row.id} · seed ilustratif`, tags: ['seed-mobile', 'ilustratif'],
      visibility: kode ? 'project' : 'organization', kode, packageId: null, authorId: 'knowledge-seed-author-demo', lastEditedBy: 'knowledge-seed-author-demo',
      reviewerId: 'knowledge-seed-editor-demo', createdAt: publishedAt, submittedAt: publishedAt, reviewedAt: publishedAt, publishedAt,
      question: type === 'FAQ' ? text(row.judul) : '', answer: type === 'FAQ' ? row.isi.join('\n\n') : '',
      context: type === 'LESSON_LEARNED' ? text(row.ringkas) : '', event: type === 'LESSON_LEARNED' ? text(row.isi.find((line) => line.startsWith('Kejadian:'))) : '',
      impact: type === 'LESSON_LEARNED' ? 'Gangguan pekerjaan pada narasi contoh; besaran dampak tidak dicatat sumber.' : '',
      action: type === 'LESSON_LEARNED' ? text(row.isi.find((line) => line.startsWith('Tindakan:'))) : '',
      learning: type === 'LESSON_LEARNED' ? text(row.isi.find((line) => line.startsWith('Saran:'))) : '',
      validityNote: 'Narasi seed ilustratif, bukan kebijakan resmi. Cut-off 20.00 WIB hanya usulan demo. Tidak ada pemeriksaan usia foto/EXIF, upload server, atau pemindaian lampiran. Paket historis tidak dicatat sumber; tidak dipetakan otomatis.',
      reason: 'Pemetaan jenis seed mobile, ID sumber dipertahankan.', contribution: false, attachmentRefs: [],
    };
    return { entryId: row.id, revision: 1, illustrative: true, versions: [version], archives: [], editorialHistory: [] };
  });
  const example = (entryId, values) => ({
    entryId, revision: 1, illustrative: true, archives: [], editorialHistory: [],
    versions: [{
      versionId: `${entryId}:v1`, version: 1, status: 'published', owner: 'Pemilik materi demo BrainDevs', authorId: 'knowledge-example-author-demo', lastEditedBy: 'knowledge-example-author-demo', reviewerId: 'knowledge-example-editor-demo',
      type: 'BASIS_PENGETAHUAN', title: '', summary: '', body: '', source: 'Materi contoh PMO BOPPJ.',
      tags: ['ilustratif', 'monitoring'], visibility: 'organization', kode: null, packageId: null, question: '', answer: '', context: '', event: '', impact: '', action: '', learning: '',
      createdAt: `${today}T00:00:00Z`, submittedAt: `${today}T00:00:00Z`, reviewedAt: `${today}T00:00:00Z`, publishedAt: `${today}T00:00:00Z`,
      validityNote: 'Materi contoh monitoring proyek.', reason: 'Materi contoh PMO.', contribution: false, attachmentRefs: [], ...values,
    }],
  });
  if (!entries.some((entry) => entry.entryId === 'KM-DEMO-PROGRES')) entries.push(example('KM-DEMO-PROGRES', {
    title: 'Membedakan progres terlapor, terverifikasi, dan baseline', summary: 'Cara membaca nilai yang tersedia tanpa mengubah unknown menjadi nol.',
    body: 'Progres terlapor berasal dari laporan kontraktor. Progres terverifikasi berasal dari revisi yang diterima pada tanggal kerja efektif terbaru.\n\nBaseline dan deviasi tetap tidak tersedia bila acuan resmi belum disahkan. Target contoh KAK tidak otomatis menjadi baseline proyek.\n\nAntre kirim berarti salinan lokal, bukan pengakuan layanan. Penerimaan demo hanya untuk monitoring simulasi, bukan dasar pembayaran.',
  }));
  const project = projects[0];
  const paket = project && packages.find((row) => row.kode === project.kode);
  if (project && paket && !entries.some((entry) => entry.entryId === 'KM-DEMO-ANTRE')) entries.push(example('KM-DEMO-ANTRE', {
    type: 'LESSON_LEARNED', title: 'Pelajaran: laporan antre belum berarti diterima', summary: 'Skenario hipotetis untuk membedakan status pengiriman dan review.',
    visibility: 'project', kode: project.kode, packageId: paket.packageId,
    context: `Skenario latihan pada ${project.kode}, ${paket.nama}. Bukan kejadian aktual.`, event: 'Perangkat kehilangan koneksi ketika formulir disimpan.',
    impact: 'Pengawas belum mempunyai pengakuan penerimaan layanan; tidak ada angka keterlambatan lapangan yang diklaim.',
    action: 'Periksa status antre lokal secara terpisah dari status review dan ketersediaan foto.', learning: 'Jangan menghitung antre lokal sebagai kewajiban kirim terpenuhi. Bukti foto tetap mengikuti TTL lima menit demo.', body: '',
  }));
  return entries;
}

function readable(entry, version, actor, publishedOnly = false) {
  const editorial = inScope(version, actor) && (isEditor(actor) || actor?.id === version.authorId);
  if (isArchived(entry, version)) return !publishedOnly && editorial;
  if (version.status !== 'published') return !publishedOnly && editorial;
  if (version.visibility === 'organization') return true;
  if (version.visibility === 'project') return !!actor && inScope(version, actor);
  return !publishedOnly && editorial;
}

export function queryKnowledgeCatalog(rows, filters = {}, actor = null, { publishedOnly = false } = {}) {
  return rows.flatMap((entry) => {
    const versions = entry.versions.filter((version) => readable(entry, version, actor, publishedOnly));
    const candidates = versions.filter((version) => !filters.status || versionStatus(entry, version) === filters.status);
    const version = candidates.at(-1);
    if (!version) return [];
    const q = text(filters.q).toLowerCase();
    const searchable = [version.title, version.summary, version.body, version.question, version.answer, version.context, version.event, version.impact, version.action, version.learning, ...(version.tags || [])].join(' ').toLowerCase();
    if ((filters.type && version.type !== filters.type) || (filters.kode && version.kode !== filters.kode) || (filters.tag && !version.tags.includes(filters.tag)) || (q && !searchable.includes(q))) return [];
    const allowedIds = new Set(versions.map((row) => row.versionId));
    return [{ ...clone(entry), versions: clone(versions), archives: clone((entry.archives || []).filter((row) => allowedIds.has(row.versionId))), editorialHistory: isEditor(actor) || versions.some((row) => row.authorId === actor?.id) ? clone(entry.editorialHistory || []) : [], displayVersion: clone(version) }];
  });
}

export function validateKnowledgeVersion(version, { projects = [], packages = [], submission = false, publication = false } = {}) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });
  if (!Object.hasOwn(KNOWLEDGE_TYPES, version.type)) add('type', 'Pilih salah satu dari tiga jenis konten.');
  for (const field of ['title', 'owner', 'source', 'reason']) if (!text(version[field])) add(field, 'Wajib diisi untuk asal dan jejak materi.');
  if (!Object.hasOwn(VISIBILITY, version.visibility)) add('visibility', 'Visibilitas tidak valid.');
  if (version.kode && !projects.some((row) => row.kode === version.kode)) add('kode', 'Proyek tidak ditemukan pada master.');
  if (version.packageId && !packages.some((row) => row.packageId === version.packageId && row.kode === version.kode)) add('packageId', 'Paket harus berasal dari proyek yang dipilih.');
  if (version.visibility === 'project' && !version.kode) add('kode', 'Visibilitas proyek memerlukan penugasan proyek.');
  if (version.attachmentRefs?.length) add('attachments', 'Lampiran produksi belum tersedia; tidak ada pemeriksaan/pemindaian file di demo.');
  if (publication && version.visibility === 'private') add('visibility', 'Usulan privat tidak boleh langsung terbit. Editor harus mengkurasi draft dan memilih lingkup pembaca terlebih dahulu.');
  if (!submission && !publication) return errors;
  if (version.type === 'BASIS_PENGETAHUAN' && !text(version.body)) add('body', 'Isi Basis Pengetahuan wajib diisi.');
  if (version.type === 'LESSON_LEARNED') {
    for (const field of ['kode', 'packageId', 'context', 'event', 'impact', 'action', 'learning']) if (!text(version[field])) add(field, 'Lesson Learned memerlukan proyek/paket, konteks, kejadian, dampak, tindakan, dan pembelajaran.');
  }
  if (version.type === 'FAQ') {
    if (!text(version.question)) add('question', 'Pertanyaan wajib diisi.');
    if ((!version.contribution || publication) && !text(version.answer)) add('answer', 'Jawaban terkurasi wajib diisi sebelum FAQ dipublikasikan.');
  }
  return errors;
}

export function createKnowledgeService({ provider: source, now = () => new Date().toISOString() }) {
  const timestamp = () => new Date(typeof now === 'function' ? now() : now).toISOString();
  const read = () => normalizeKnowledgeCatalog(source.getCatalog('knowledge'), { projects: source.getProjects(), packages: source.getPackages(), today: timestamp().slice(0, 10) });
  function assertWrite(actor, version) {
    if (!actor?.id || !['author', 'contractor', 'reviewer', 'admin'].includes(actor.role) || !inScope(version, actor)) fail('FORBIDDEN', 'Penulis/editor tidak mempunyai lingkup untuk materi ini.');
    if (actor.role === 'contractor' && (version.type === 'BASIS_PENGETAHUAN' || version.visibility !== 'private' || !version.kode)) fail('FORBIDDEN', 'Kontraktor hanya dapat mengusulkan pertanyaan atau Lesson Learned privat pada proyeknya.');
  }
  function writable(id, expectedRevision, actor) {
    const rows = read();
    const entry = rows.find((row) => row.entryId === id);
    if (!entry || !entry.versions.some((version) => readable(entry, version, actor))) fail('NOT_FOUND', 'Materi tidak ditemukan dalam lingkup pembaca.');
    if (entry.revision !== expectedRevision) fail('CONFLICT', 'Materi berubah sejak dibuka. Muat ulang; perubahan ini belum diterapkan.');
    return { rows, entry };
  }
  function persist(rows, entry) { source.saveCatalog('knowledge', rows); return clone(entry); }
  function validate(version, publication = false) {
    const fieldErrors = validateKnowledgeVersion(version, { projects: source.getProjects(), packages: source.getPackages(), submission: !publication, publication });
    if (fieldErrors.length) fail('VALIDATION', 'Materi belum lengkap untuk tahap editorial ini.', fieldErrors);
  }
  function editorialActor(actor, version) {
    if (!isEditor(actor) || !inScope(version, actor)) fail('FORBIDDEN', 'Hanya reviewer editorial demo dalam lingkup materi yang berwenang.');
  }
  return {
    query(filters = {}, actor = null, options = {}) { return queryKnowledgeCatalog(read(), filters, actor, options); },
    get(id, actor = null, versionId) {
      const entry = queryKnowledgeCatalog(read(), {}, actor).find((row) => row.entryId === id);
      if (!entry) fail('NOT_FOUND', 'Materi tidak ditemukan dalam lingkup pembaca.');
      if (versionId) {
        const version = entry.versions.find((row) => row.versionId === versionId);
        if (!version) fail('NOT_FOUND', 'Versi tidak tersedia dalam lingkup pembaca.');
        entry.displayVersion = clone(version);
      }
      return entry;
    },
    saveDraft(payload, { id, expectedRevision = 0, actor } = {}) {
      assertWrite(actor, payload);
      let rows = read();
      let entry;
      if (id) {
        const hasil = writable(id, expectedRevision, actor)
        rows = hasil.rows
        entry = hasil.entry
      } else { entry = { entryId: newId(), revision: 0, illustrative: true, versions: [], archives: [], editorialHistory: [] }; rows.push(entry); }
      const previous = last(entry);
      if (previous && (previous.status !== 'draft' || isArchived(entry, previous))) fail('IMMUTABLE', 'Versi review/terbit/arsip tidak dapat ditimpa. Kembalikan review atau buat versi pengganti.');
      if (previous && previous.authorId !== actor.id && !isEditor(actor)) fail('FORBIDDEN', 'Draft hanya dapat diubah penulisnya atau editor dalam lingkup.');
      const number = previous?.version || 1;
      const version = {
        versionId: previous?.versionId || `${entry.entryId}:v${number}`, version: number, status: 'draft',
        ...Object.fromEntries(['type', 'title', 'summary', 'body', 'owner', 'source', 'visibility', 'question', 'answer', 'context', 'event', 'impact', 'action', 'learning', 'reason'].map((key) => [key, text(payload[key])])),
        kode: text(payload.kode) || null, packageId: text(payload.packageId) || null, tags: [...new Set((Array.isArray(payload.tags) ? payload.tags : []).map(text).filter(Boolean))],
        authorId: previous?.authorId || actor.id, lastEditedBy: actor.id, createdAt: previous?.createdAt || timestamp(), updatedAt: timestamp(),
        submittedAt: null, publishedAt: null, reviewedAt: null, reviewerId: null, supersedesVersionId: previous?.supersedesVersionId || null,
        contribution: (actor.role === 'contractor' || previous?.contribution === true) && payload.visibility === 'private',
        validityNote: 'Materi contoh.', attachmentRefs: [],
      };
      if (payload.attachmentRefs?.length) fail('UNSUPPORTED', 'Upload lampiran dinonaktifkan sampai pemeriksaan dan penyimpanan produksi tersedia.');
      const fieldErrors = validateKnowledgeVersion(version, { projects: source.getProjects(), packages: source.getPackages() });
      if (fieldErrors.length) fail('VALIDATION', 'Lengkapi metadata draft dan lingkup materi.', fieldErrors);
      if (previous) entry.versions[entry.versions.length - 1] = version; else entry.versions.push(version);
      entry.revision++;
      return persist(rows, entry);
    },
    submit(id, { expectedRevision, reason, actor } = {}) {
      const { rows, entry } = writable(id, expectedRevision, actor);
      const version = last(entry);
      assertWrite(actor, version);
      if ((version.authorId !== actor.id && !isEditor(actor)) || version.status !== 'draft' || isArchived(entry, version)) fail('FORBIDDEN', 'Hanya draft yang dapat diajukan penulis/editor.');
      if (!text(reason)) fail('VALIDATION', 'Alasan pengajuan wajib diisi.', [{ field: 'reason', message: 'Isi alasan pengajuan.' }]);
      validate(version);
      version.status = 'in-review'; version.submittedAt = timestamp();
      entry.editorialHistory.push({ versionId: version.versionId, action: 'submit', reason: text(reason), actorId: actor.id, at: timestamp() });
      entry.revision++;
      return persist(rows, entry);
    },
    publish(id, { expectedRevision, reason, actor } = {}) {
      const { rows, entry } = writable(id, expectedRevision, actor);
      const version = last(entry);
      editorialActor(actor, version);
      if (version.authorId === actor.id || version.lastEditedBy === actor.id) fail('SELF_REVIEW', 'Penulis atau editor terakhir tidak boleh menerbitkan pekerjaannya sendiri. Pilih reviewer demo lain.');
      if (version.status !== 'in-review' || isArchived(entry, version)) fail('CONFLICT', 'Publikasi harus melewati status Dalam review.');
      if (!text(reason)) fail('VALIDATION', 'Alasan review/publikasi wajib diisi.', [{ field: 'reason', message: 'Isi alasan publikasi.' }]);
      validate(version, true);
      version.status = 'published'; version.reviewerId = actor.id; version.reviewedAt = timestamp(); version.publishedAt = timestamp();
      entry.editorialHistory.push({ versionId: version.versionId, action: 'publish', reason: text(reason), actorId: actor.id, at: timestamp() });
      entry.revision++;
      return persist(rows, entry);
    },
    returnToDraft(id, { expectedRevision, reason, actor } = {}) {
      const { rows, entry } = writable(id, expectedRevision, actor);
      const version = last(entry);
      editorialActor(actor, version);
      if (version.status !== 'in-review' || isArchived(entry, version)) fail('CONFLICT', 'Hanya materi dalam review yang dapat dikembalikan.');
      if (!text(reason)) fail('VALIDATION', 'Catatan pengembalian wajib diisi.', [{ field: 'reason', message: 'Jelaskan perbaikan yang diminta.' }]);
      version.status = 'draft';
      entry.editorialHistory.push({ versionId: version.versionId, action: 'return-to-draft', reason: text(reason), actorId: actor.id, at: timestamp() });
      entry.revision++;
      return persist(rows, entry);
    },
    revise(id, { expectedRevision, reason, actor } = {}) {
      const { rows, entry } = writable(id, expectedRevision, actor);
      const previous = last(entry);
      if (previous.status !== 'published' || isArchived(entry, previous)) fail('CONFLICT', 'Selesaikan draft/review yang ada sebelum membuat versi berikutnya.');
      assertWrite(actor, previous);
      if (!text(reason)) fail('VALIDATION', 'Alasan versi pengganti wajib diisi.', [{ field: 'reason', message: 'Isi alasan revisi.' }]);
      const number = previous.version + 1;
      entry.versions.push({ ...clone(previous), versionId: `${id}:v${number}`, version: number, status: 'draft', authorId: actor.id, lastEditedBy: actor.id, reason: text(reason), supersedesVersionId: previous.versionId, createdAt: timestamp(), updatedAt: timestamp(), submittedAt: null, publishedAt: null, reviewedAt: null, reviewerId: null });
      entry.revision++;
      return persist(rows, entry);
    },
    archive(id, { expectedRevision, versionId, reason, actor } = {}) {
      const { rows, entry } = writable(id, expectedRevision, actor);
      const version = entry.versions.find((row) => row.versionId === versionId);
      if (!version) fail('NOT_FOUND', 'Versi tidak ditemukan.');
      editorialActor(actor, version);
      if (isArchived(entry, version)) fail('CONFLICT', 'Versi telah diarsipkan.');
      if (!text(reason)) fail('VALIDATION', 'Alasan arsip wajib diisi.', [{ field: 'reason', message: 'Isi alasan arsip.' }]);
      entry.archives.push({ versionId, reason: text(reason), actorId: actor.id, at: timestamp() });
      entry.revision++;
      return persist(rows, entry);
    },
  };
}

export function readPublishedKnowledge(filters = {}, actor = null, source = provider) {
  return createKnowledgeService({ provider: source }).query({ ...filters, status: 'published' }, actor, { publishedOnly: true }).map((entry) => {
    const version = entry.displayVersion;
    const paragraphs = version.type === 'FAQ' ? [version.question, version.answer] : version.type === 'LESSON_LEARNED' ? [version.context, version.event, version.impact, version.action, version.learning] : [version.body];
    return { id: entry.entryId, entryId: entry.entryId, versionId: version.versionId, version: version.version, type: version.type, jenis: MOBILE_TYPES[version.type], judul: version.title, ringkas: version.summary, isi: [...paragraphs.filter(Boolean), version.validityNote], tags: clone(version.tags), kode: version.kode, packageId: version.packageId, source: version.source, owner: version.owner, publishedAt: version.publishedAt, reviewerId: version.reviewerId, illustrative: true, visibility: version.visibility };
  });
}

const e = escapeHtml;
const options = (rows, value) => rows.map(([id, label]) => `<option value="${e(id)}" ${id === value ? 'selected' : ''}>${e(label)}</option>`).join('');
const input = (name, label, value = '', required = false) => `<label>${e(label)}<input name="${e(name)}" value="${e(value)}" ${required ? 'required' : ''} aria-describedby="km-error-${e(name)}"><small class="content-field-error" id="km-error-${e(name)}" data-field-error="${e(name)}"></small></label>`;
const area = (name, label, value = '') => `<label>${e(label)}<textarea name="${e(name)}" rows="4" aria-describedby="km-error-${e(name)}">${e(value)}</textarea><small class="content-field-error" id="km-error-${e(name)}" data-field-error="${e(name)}"></small></label>`;

export function initKnowledge(root) {
  if (!root) return () => {};
  const service = createKnowledgeService({ provider });
  const actors = {
    author: { id: 'knowledge-author-demo', role: 'author', projectCodes: [...DEMO_ADMIN.projectCodes] },
    editor: DEMO_REVIEWER,
    editor2: { ...DEMO_REVIEWER, id: 'knowledge-second-reviewer-demo' },
    contractor: DEMO_CONTRACTOR,
    public: null,
  };
  const actorLabels = [['author', 'Penulis demo'], ['editor', 'Reviewer editorial A (demo)'], ['editor2', 'Reviewer editorial B (demo)'], ['contractor', 'Kontraktor demo'], ['public', 'Pembaca publik demo']];
  function route() {
    const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
    const [prefix, id] = path.split('/');
    const params = new URLSearchParams(query);
    const actorKey = Object.hasOwn(actors, params.get('actor')) ? params.get('actor') : 'author';
    return { matches: prefix === 'knowledge', id: id ? decodeURIComponent(id) : null, params, actor: actors[actorKey], actorKey };
  }
  function url(id, updates = {}) {
    const params = new URLSearchParams(route().params);
    params.delete('edit'); params.delete('action'); params.delete('version');
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    return `#knowledge${id ? `/${encodeURIComponent(id)}` : ''}${params.size ? `?${params}` : ''}`;
  }
  function move(id, updates) { location.hash = url(id, updates); }
  function availableProjects(actor) { return provider.getProjects().filter((row) => !actor || actor.projectCodes?.includes(row.kode)); }
  function packageOptions(kode, selected) { return options([['', 'Paket belum dipilih'], ...provider.getPackages({ kode }).filter((row) => row.kode === kode).map((row) => [row.packageId, row.nama])], selected); }
  function header(title, subtitle, action = '') {
    const current = route();
    return `<div class="content-module"><header class="content-heading"><div><h1 tabindex="-1">${e(title)}</h1><p>${e(subtitle)}</p></div>${action}</header><label class="content-actor">Pilih pembaca / pelaksana<select data-knowledge-actor>${options(actorLabels, current.actorKey)}</select></label><p class="content-footnote">Penulis dan editor terakhir tidak boleh menerbitkan materinya sendiri. Gunakan reviewer A/B yang berbeda untuk menguji pemisahan editorial.</p><p class="content-notice" data-content-stale hidden>Data sesi berubah. Input belum ditimpa. <button class="content-button" data-content-refresh>Muat ulang</button></p><div class="content-errors" role="alert" tabindex="-1" hidden></div>`;
  }
  function errors(error) {
    const target = root.querySelector('.content-errors');
    if (!target) return;
    target.hidden = false; target.textContent = `${error.code || 'ERROR'}: ${error.message}`;
    root.querySelectorAll('[data-field-error]').forEach((field) => { field.textContent = ''; });
    for (const problem of error.fieldErrors || []) {
      const field = [...root.querySelectorAll('[data-field-error]')].find((element) => element.dataset.fieldError === problem.field);
      if (field) field.textContent = problem.message;
      const line = document.createElement('p'); line.textContent = `${problem.field}: ${problem.message}`; target.append(line);
    }
    target.focus();
  }
  function drawList(current) {
    const filters = Object.fromEntries(current.params);
    const rows = service.query(filters, current.actor);
    const allowed = service.query({}, current.actor);
    const tags = [...new Set(allowed.flatMap((entry) => entry.displayVersion.tags))].sort();
    const canDraft = !!current.actor;
    const statuses = isEditor(current.actor) || current.actorKey === 'author' || current.actorKey === 'contractor' ? Object.entries(STATUS) : [['published', STATUS.published]];
    root.innerHTML = `${header('Manajemen Pengetahuan', 'Basis Pengetahuan, Lesson Learned Proyek, dan Tanya Jawab (FAQ).', canDraft ? `<a class="content-button primary" href="${e(url('new'))}">${current.actorKey === 'contractor' ? 'Buat usulan privat' : 'Buat draft materi'}</a>` : '')}<form class="content-filters" data-knowledge-form="filters">${input('q', 'Cari materi yang dapat dibaca', filters.q)}<label>Jenis<select name="type">${options([['', 'Semua jenis'], ...Object.entries(KNOWLEDGE_TYPES)], filters.type)}</select></label><label>Proyek<select name="kode">${options([['', 'Semua proyek yang dapat dibaca'], ...availableProjects(current.actor).map((row) => [row.kode, `${row.kode} · ${row.nama}`])], filters.kode)}</select></label><label>Topik / tag<select name="tag">${options([['', 'Semua topik'], ...tags.map((tag) => [tag, tag])], filters.tag)}</select></label><label>Status<select name="status">${options([['', 'Semua status yang dapat dibaca'], ...statuses], filters.status)}</select></label><button class="content-button" type="submit">Terapkan filter</button><a class="content-button" href="#knowledge?actor=${e(current.actorKey)}">Reset filter</a></form><section class="content-section"><h2>Daftar materi</h2><p role="status">${e(rows.length)} materi sesuai izin dan filter. Judul, cuplikan, tag, dan hit count dihitung setelah scope pembaca.</p>${rows.length ? `<div class="content-table-scroll" role="region" aria-label="Daftar pengetahuan, dapat digulir mendatar" tabindex="0"><table><thead><tr><th scope="col">Materi dan sumber</th><th scope="col">Jenis / topik</th><th scope="col">Lingkup</th><th scope="col">Status versi</th><th scope="col">Pemilik / review</th></tr></thead><tbody>${rows.map((entry) => {
      const version = entry.displayVersion;
      return `<tr><td><a href="${e(url(entry.entryId))}">${e(version.title)}</a><p>${e(version.summary)}</p><small>${e(version.source)}</small></td><td>${e(KNOWLEDGE_TYPES[version.type])}<small>${e(version.tags.join(', ') || 'Tanpa tag')}</small></td><td>${e(version.kode || 'Organisasi')}<small>${e(VISIBILITY[version.visibility])}</small></td><td><span class="content-status ${e(versionStatus(entry, version))}">${e(STATUS[versionStatus(entry, version)])}</span><small>v${e(version.version)}</small></td><td>${e(version.owner)}<small>${e(version.reviewedAt ? formatDate(version.reviewedAt) : 'Belum direview')}</small></td></tr>`;
    }).join('')}</tbody></table></div>` : '<div class="content-empty"><h3>Tidak ada materi sesuai izin dan filter</h3><p>Ubah kata pencarian, jenis, topik, proyek, atau status. Materi di luar penugasan tidak ikut dihitung.</p></div>'}</section></div>`;
  }
  function drawEditor(current) {
    if (!current.actor) fail('FORBIDDEN', 'Pembaca publik tidak dapat membuat draft.');
    const entry = current.id === 'new' ? null : service.get(current.id, current.actor);
    const version = entry ? entry.displayVersion : { type: current.actorKey === 'contractor' ? 'FAQ' : current.params.get('type') || 'BASIS_PENGETAHUAN', visibility: current.actorKey === 'contractor' ? 'private' : 'organization', tags: [], kode: '', packageId: '' };
    if (entry && (version.status !== 'draft' || isArchived(entry, version) || (version.authorId !== current.actor.id && !isEditor(current.actor)))) fail('FORBIDDEN', 'Draft ini tidak dapat diedit oleh aktor yang dipilih.');
    const types = Object.entries(KNOWLEDGE_TYPES).filter(([id]) => current.actorKey !== 'contractor' || id !== 'BASIS_PENGETAHUAN');
    const visibility = current.actorKey === 'contractor' ? [['private', VISIBILITY.private]] : Object.entries(VISIBILITY);
    root.innerHTML = `${header(entry ? 'Edit draft materi' : 'Draft materi baru', 'Isi teks biasa. Markup dan script ditampilkan sebagai teks, bukan HTML aktif.')}<nav class="content-breadcrumb" aria-label="Breadcrumb"><a href="${e(url())}">Daftar pengetahuan</a>${entry ? `<a href="${e(url(entry.entryId))}">Detail materi</a>` : '<span>Draft baru</span>'}</nav><form data-knowledge-form="editor" data-id="${e(entry?.entryId || '')}" data-revision="${entry?.revision || 0}"><section class="content-section"><h2>Identitas dan pembaca</h2><div class="content-editor-grid"><label>Jenis<select name="type">${options(types, version.type)}</select><small class="content-field-error" data-field-error="type"></small></label>${input('title', 'Judul *', version.title, true)}${input('summary', 'Ringkasan', version.summary)}${input('owner', 'Pemilik materi *', version.owner, true)}${input('source', 'Sumber / rujukan *', version.source, true)}${input('tags', 'Tag, pisahkan dengan koma', version.tags.join(', '))}<label>Visibilitas<select name="visibility">${options(visibility, version.visibility)}</select><small class="content-field-error" data-field-error="visibility"></small></label><label>Proyek (wajib untuk Lesson Learned/usulan privat)<select name="kode">${options([['', 'Tidak terkait proyek tertentu'], ...availableProjects(current.actor).map((row) => [row.kode, `${row.kode} · ${row.nama}`])], version.kode)}</select><small class="content-field-error" data-field-error="kode"></small></label><label>Paket (wajib untuk Lesson Learned)<select name="packageId">${packageOptions(version.kode, version.packageId)}</select><small class="content-field-error" data-field-error="packageId"></small></label></div></section><section class="content-section"><h2>Isi sesuai jenis</h2><div data-type-fields="BASIS_PENGETAHUAN">${area('body', 'Isi Basis Pengetahuan', version.body)}</div><div data-type-fields="FAQ">${area('question', 'Pertanyaan', version.question)}${area('answer', 'Jawaban terkurasi (wajib untuk publikasi)', version.answer)}<p>Usulan pertanyaan kontraktor boleh tanpa jawaban. Tidak otomatis menjadi FAQ terbit.</p></div><div data-type-fields="LESSON_LEARNED" class="content-editor-grid">${area('context', 'Konteks proyek/paket', version.context)}${area('event', 'Kejadian', version.event)}${area('impact', 'Dampak', version.impact)}${area('action', 'Tindakan', version.action)}${area('learning', 'Pembelajaran', version.learning)}</div></section><section class="content-section"><h2>Lampiran dan jejak draft</h2><label>Lampiran produksi (belum tersedia)<input type="file" disabled aria-describedby="km-upload-explanation"></label><p id="km-upload-explanation">Upload dinonaktifkan. Demo tidak menyediakan pemeriksaan MIME, batas ukuran, pemindaian, atau penyimpanan lampiran produksi. Tidak ada klaim file aman.</p>${input('reason', 'Alasan penyimpanan draft *', version.reason, true)}<div class="content-actions"><button class="content-button primary" type="submit">Simpan draft lokal</button><a class="content-button" href="${e(url(entry?.entryId))}">Batal</a></div></section></form></div>`;
    showType(version.type);
  }
  function showType(type) { root.querySelectorAll('[data-type-fields]').forEach((section) => { section.hidden = section.dataset.typeFields !== type; }); }
  function articleContent(version) {
    if (version.type === 'FAQ') return `<h2>Pertanyaan</h2><p class="content-plain">${e(version.question)}</p><h2>Jawaban terkurasi</h2><p class="content-plain">${e(version.answer || 'Belum dijawab; ini usulan privat, bukan FAQ resmi.')}</p>`;
    if (version.type === 'LESSON_LEARNED') return [['Konteks', version.context], ['Kejadian', version.event], ['Dampak', version.impact], ['Tindakan', version.action], ['Pembelajaran', version.learning]].map(([label, value]) => `<h2>${e(label)}</h2><p class="content-plain">${e(value || 'Belum dicatat sumber')}</p>`).join('');
    return `<h2>Isi Basis Pengetahuan</h2><p class="content-plain">${e(version.body)}</p>`;
  }
  function drawDetail(current) {
    const entry = service.get(current.id, current.actor, current.params.get('version'));
    const version = entry.displayVersion;
    const state = versionStatus(entry, version);
    const writable = !!current.actor && inScope(version, current.actor) && (version.authorId === current.actor.id || isEditor(current.actor));
    const newestVisible = version.versionId === last(entry).versionId;
    const action = current.params.get('action');
    const actions = { submit: 'Ajukan untuk review', publish: 'Terbitkan versi demo', returnToDraft: 'Kembalikan ke draft', revise: 'Buat versi pengganti', archive: 'Arsipkan versi' };
    const published = entry.versions.filter((row) => row.status === 'published' && !isArchived(entry, row)).at(-1);
    root.innerHTML = `${header(version.title, `${KNOWLEDGE_TYPES[version.type]} · v${version.version} · ${STATUS[state]}`)}<nav class="content-breadcrumb" aria-label="Breadcrumb"><a href="${e(url())}">Daftar pengetahuan</a><span>${e(entry.entryId)}</span></nav><div class="content-actions">${writable && state === 'draft' && newestVisible ? `<a class="content-button" href="${e(url(entry.entryId, { edit: '1' }))}">Edit draft</a><a class="content-button primary" href="${e(url(entry.entryId, { action: 'submit' }))}">Ajukan review</a>` : ''}${isEditor(current.actor) && inScope(version, current.actor) && state === 'in-review' && newestVisible ? `<a class="content-button primary" href="${e(url(entry.entryId, { action: 'publish' }))}">Publikasikan demo</a><a class="content-button" href="${e(url(entry.entryId, { action: 'returnToDraft' }))}">Kembalikan ke draft</a>` : ''}${current.actor && current.actorKey !== 'contractor' && state === 'published' && newestVisible && inScope(version, current.actor) ? `<a class="content-button" href="${e(url(entry.entryId, { action: 'revise' }))}">Buat versi pengganti</a>` : ''}${isEditor(current.actor) && inScope(version, current.actor) && state !== 'archived' ? `<a class="content-button" href="${e(url(entry.entryId, { action: 'archive', version: version.versionId }))}">Arsipkan versi</a>` : ''}<button class="content-button" data-knowledge-download data-id="${e(entry.entryId)}" data-version="${e(version.versionId)}">Unduh teks versi</button></div>
      ${state === 'archived' ? '<p class="content-notice">Versi arsip, bukan pedoman aktif. Snapshot disimpan untuk riwayat.</p>' : ''}${published && published.versionId !== version.versionId ? `<p class="content-notice">Anda membaca versi ${e(version.version)}. Versi terbit terakhir yang dapat dibaca: <a href="${e(url(entry.entryId, { version: published.versionId }))}">v${e(published.version)}</a>. Draft tidak mengganti tautan terbit.</p>` : ''}<section class="content-section"><h2>Asal, lingkup, dan versi</h2><dl class="content-metadata"><dt>Pemilik / penulis</dt><dd>${e(version.owner)} / ${e(version.authorId)}</dd><dt>Editor terakhir / reviewer</dt><dd>${e(version.lastEditedBy)} / ${e(version.reviewerId || 'Belum direview')}</dd><dt>Sumber</dt><dd>${e(version.source)}</dd><dt>Proyek / paket</dt><dd>${e(version.kode || 'Tidak terkait proyek tertentu')} / ${e(provider.getPackages().find((row) => row.packageId === version.packageId)?.nama || 'Paket belum dicatat sumber')}</dd><dt>Pembaca</dt><dd>${e(VISIBILITY[version.visibility])}</dd><dt>Tag</dt><dd>${e(version.tags.join(', ') || 'Tanpa tag')}</dd><dt>ID versi</dt><dd>${e(version.versionId)}</dd><dt>Terbit / review</dt><dd>${e(version.publishedAt ? formatDate(version.publishedAt) : 'Belum terbit')} / ${e(version.reviewedAt ? formatDate(version.reviewedAt) : 'Belum direview')}</dd><dt>Alasan versi</dt><dd>${e(version.reason)}</dd></dl><p class="content-notice">${e(version.validityNote)}</p></section><article class="content-section content-article">${articleContent(version)}</article><section class="content-section"><h2>Versi yang dapat dibaca</h2><ul class="content-history">${entry.versions.map((row) => `<li><a href="${e(url(entry.entryId, { version: row.versionId }))}">v${e(row.version)} · ${e(STATUS[versionStatus(entry, row)])}</a> · ${e(row.source)}</li>`).join('')}</ul>${entry.editorialHistory.length || entry.archives.length ? `<h3>Jejak editorial</h3><ul class="content-history">${entry.editorialHistory.map((event) => `<li>${e(event.action)} · ${e(event.versionId)} · ${e(event.reason)} · ${e(event.actorId)} · ${e(formatDate(event.at))}</li>`).join('')}${entry.archives.map((event) => `<li>Arsip ${e(event.versionId)} · ${e(event.reason)} · ${e(event.actorId)} · ${e(formatDate(event.at))}</li>`).join('')}</ul>` : ''}<p>Lampiran tidak tersedia. Tidak ada pemindaian atau arsip permanen produksi.</p></section>${actions[action] ? `<section class="content-section"><h2>${e(actions[action])}</h2><form data-knowledge-form="action" data-action="${e(action)}" data-id="${e(entry.entryId)}" data-version="${e(version.versionId)}" data-revision="${entry.revision}">${input('reason', 'Alasan / catatan editorial *', '', true)}<div class="content-actions"><button class="content-button primary" type="submit">${e(actions[action])}</button><a class="content-button" href="${e(url(entry.entryId))}">Batal</a></div></form></section>` : ''}</div>`;
  }
  function render(focus = false) {
    try {
      const current = route();
      if (!current.matches) return;
      if (!current.id) drawList(current);
      else if (current.id === 'new' || current.params.get('edit') === '1') drawEditor(current);
      else drawDetail(current);
      if (focus) root.querySelector('h1')?.focus();
    } catch (error) {
      root.innerHTML = `${header('Materi tidak dapat ditampilkan', 'Materi mungkin di luar lingkup, tidak tersedia, atau gagal dibaca. Judul/isi terlarang tidak ditampilkan.')}<button class="content-button" data-content-refresh>Coba lagi</button><a class="content-button" href="${e(url())}">Daftar pengetahuan</a></div>`;
      errors(error);
    }
  }
  function click(event) {
    if (event.target.closest('[data-content-refresh]')) render(true);
    const button = event.target.closest('[data-knowledge-download]');
    if (button) {
      try {
        const current = route();
        const entry = service.get(button.dataset.id, current.actor, button.dataset.version);
        const version = entry.displayVersion;
        const content = ['PMO BOPPJ', version.title, `${KNOWLEDGE_TYPES[version.type]} · v${version.version} · ${STATUS[versionStatus(entry, version)]}`, `Sumber: ${version.source}`, `Pemilik: ${version.owner}; penulis: ${version.authorId}; reviewer: ${version.reviewerId || 'Belum direview'}`, `Lingkup: ${version.visibility}; proyek: ${version.kode || 'Tidak terkait'}; paket: ${version.packageId || 'Belum dicatat'}`, `Versi: ${version.versionId}; terbit: ${version.publishedAt || 'Belum terbit'}`, version.validityNote, ...[version.body, version.question, version.answer, version.context, version.event, version.impact, version.action, version.learning].filter(Boolean), 'Salinan teks versi materi.'].join('\n\n');
        const objectUrl = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
        const link = document.createElement('a'); link.href = objectUrl; link.download = `pengetahuan-${entry.entryId.replace(/[^a-z0-9-]/gi, '-')}-v${version.version}.txt`; link.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        notify('Salinan teks versi diunduh.');
      } catch (error) { errors(error); }
    }
  }
  function change(event) {
    if (event.target.matches('[data-knowledge-actor]')) { move(route().id, { actor: event.target.value }); render(true); }
    if (event.target.name === 'type') showType(event.target.value);
    if (event.target.name === 'kode') root.querySelector('[name="packageId"]').innerHTML = packageOptions(event.target.value, '');
  }
  function submit(event) {
    const form = event.target.closest('[data-knowledge-form]');
    if (!form) return;
    event.preventDefault();
    try {
      const data = new FormData(form);
      if (form.dataset.knowledgeForm === 'filters') return move(null, Object.fromEntries(data));
      const current = route();
      const settings = { actor: current.actor, expectedRevision: Number(form.dataset.revision), reason: text(data.get('reason')), versionId: form.dataset.version };
      let entry;
      if (form.dataset.knowledgeForm === 'editor') entry = service.saveDraft({ ...Object.fromEntries(data), tags: text(data.get('tags')).split(',').map(text).filter(Boolean) }, { ...settings, id: form.dataset.id || undefined });
      else entry = service[form.dataset.action](form.dataset.id, settings);
      notify('Tahapan editorial tersimpan.');
      move(entry.entryId); render(true);
    } catch (error) { errors(error); }
  }
  root.innerHTML = '<div class="content-module" role="status">Memuat materi…</div>';
  root.addEventListener('click', click); root.addEventListener('change', change); root.addEventListener('submit', submit);
  const hashchange = () => render(true);
  window.addEventListener('hashchange', hashchange);
  const unsubscribe = provider.subscribe(() => {
    if (!route().matches) return;
    if (root.querySelector('form[data-knowledge-form="editor"], form[data-knowledge-form="action"]')) root.querySelector('[data-content-stale]')?.removeAttribute('hidden'); else render();
  });
  render();
  return () => { root.removeEventListener('click', click); root.removeEventListener('change', change); root.removeEventListener('submit', submit); window.removeEventListener('hashchange', hashchange); unsubscribe(); };
}
