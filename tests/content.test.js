import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  isContentDate, validateWorkTree, effectiveReferencePeriod, validateReferenceVersion,
  seedKakCatalog, createKakService, initKak,
} from '../admin-kak.js';
import {
  KNOWLEDGE_TYPES, normalizeKnowledgeCatalog, queryKnowledgeCatalog, validateKnowledgeVersion,
  createKnowledgeService, initKnowledge,
} from '../admin-knowledge.js';

/* Fixtures ----------------------------------------------------------------- */

const PROJECTS = [
  { kode: 'A', projectId: 'project:A', nama: 'Proyek uji A' },
  { kode: 'B', projectId: 'project:B', nama: 'Proyek uji B' },
  { kode: 'C', projectId: 'project:C', nama: 'Proyek uji C' },
];
const PACKAGES = [
  { kode: 'A', packageId: 'package:A:01', nama: 'Paket A pertama', contractorId: 'c:1', kontraktor: 'Kontraktor uji' },
  { kode: 'A', packageId: 'package:A:02', nama: 'Paket A kedua', contractorId: 'c:2', kontraktor: 'Kontraktor uji' },
  { kode: 'B', packageId: 'package:B:01', nama: 'Paket B pertama', contractorId: 'c:2', kontraktor: 'Kontraktor uji' },
];
const ADMIN = { id: 'admin-test', role: 'admin', projectCodes: ['A', 'B'] };
const REVIEWER_A = { id: 'rev-a', role: 'reviewer', projectCodes: ['A'] };
const REVIEWER_B = { id: 'rev-b', role: 'reviewer', projectCodes: ['B'] };
const AUTHOR = { id: 'author-1', role: 'author', projectCodes: ['A', 'B'] };
const EDITOR = { id: 'editor-1', role: 'reviewer', projectCodes: ['A', 'B'] };
const EDITOR2 = { id: 'editor-2', role: 'reviewer', projectCodes: ['A', 'B'] };
const CONTRACTOR = { id: 'kontraktor-1', role: 'contractor', projectCodes: ['A'] };
const NOW = '2026-11-06T07:00:00Z';
const error = (code) => (issue) => issue.code === code && typeof issue.message === 'string' && issue.message.length > 0;
const problems = (errors, field) => errors.filter((row) => row.field === field);

function tree({ weights = [60, 40], secondCode = 'I.1.2' } = {}) {
  return [
    { id: 's1', kind: 'section', parentId: null, code: 'I', description: 'Section uji', unit: '', targetVolume: null, weightPercent: null },
    { id: 'ss1', kind: 'subsection', parentId: 's1', code: 'I.1', description: 'Subsection uji', unit: '', targetVolume: null, weightPercent: null },
    { id: 'i1', kind: 'item', parentId: 'ss1', code: 'I.1.1', description: 'Item pertama', unit: 'm', targetVolume: 100, weightPercent: weights[0] },
    { id: 'i2', kind: 'item', parentId: 'ss1', code: secondCode, description: 'Item kedua', unit: 'dokumen', targetVolume: 5, weightPercent: weights[1] },
  ];
}

function kakVersion(overrides = {}) {
  return {
    referenceVersionId: 'acuan:UJI:v1', version: 1, status: 'draft', measurement: 'quantitative', supersedesVersionId: null,
    document: { documentId: 'dokumen:uji', title: 'KAK uji', number: '', version: '1', owner: 'Pemilik uji', source: 'Sumber uji', attachment: null },
    template: { templateId: 'template:uji', title: 'Template uji', version: 1, nodes: tree() },
    assignment: { projectId: 'project:A', kode: 'A', packageId: 'package:A:01', metric: 'm1', validFrom: '2026-01-01', validTo: null },
    createdBy: 'author-1', createdAt: NOW, reason: 'Alasan uji',
    ...overrides,
  };
}

function catalogProvider({ references = [], knowledge = [], projects = PROJECTS, packages = PACKAGES } = {}) {
  const state = { references, knowledge };
  const listeners = new Set();
  const kinds = { references: 'references', knowledge: 'knowledge' };
  return {
    getCatalog: (kind) => structuredClone(state[kinds[kind] ?? kind] ?? []),
    saveCatalog: (kind, rows) => { state[kind] = structuredClone(rows); listeners.forEach((listener) => listener()); },
    getProjects: () => structuredClone(projects),
    getPackages: (filters = {}) => structuredClone(packages.filter((row) => !filters.kode || row.kode === filters.kode)),
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
  };
}

function kmVersion(overrides = {}) {
  return {
    versionId: 'km:v1', version: 1, status: 'published', type: 'BASIS_PENGETAHUAN', title: 'Materi uji', summary: 'Ringkasan',
    body: 'Isi materi', owner: 'Pemilik uji', source: 'Sumber uji', tags: ['uji'], visibility: 'organization', kode: null,
    packageId: null, question: '', answer: '', context: '', event: '', impact: '', action: '', learning: '',
    authorId: 'author-1', lastEditedBy: 'author-1', reviewerId: 'editor-2', createdAt: NOW, submittedAt: NOW,
    reviewedAt: NOW, publishedAt: NOW, reason: 'alasan uji', contribution: false, attachmentRefs: [],
    validityNote: 'ilustratif', ...overrides,
  };
}

const kmEntry = (entryId, versions, extra = {}) => ({ entryId, revision: 1, illustrative: true, versions, archives: [], editorialHistory: [], ...extra });

/* KAK: content dates ------------------------------------------------------- */

test('isContentDate only accepts real calendar dates in ISO form', () => {
  assert.equal(isContentDate('2026-11-06'), true);
  assert.equal(isContentDate('2026-02-30'), false);
  assert.equal(isContentDate('2026-13-01'), false);
  assert.equal(isContentDate('26-11-06'), false);
  assert.equal(isContentDate(20261106), false);
});

/* KAK: tree validation ------------------------------------------------------ */

test('a valid quantitative tree passes with no errors', () => {
  assert.deepEqual(validateWorkTree(tree()), []);
});

test('cycle in parent chain is detected', () => {
  const nodes = tree();
  nodes[0].parentId = 'ss1'; // s1 -> ss1 -> s1 closes a cycle.
  const errors = validateWorkTree(nodes);
  assert.ok(errors.some((row) => row.field.startsWith('nodes.') && row.field.endsWith('.parentId') && row.message.includes('Siklus')), JSON.stringify(errors));
});

test('missing parent reference is rejected', () => {
  const nodes = tree();
  nodes[2].parentId = 'tidak-ada';
  const errors = validateWorkTree(nodes);
  assert.ok(problems(errors, 'nodes.2.parentId').some((row) => row.message.includes('tidak ditemukan')));
  assert.ok(errors.every((row) => !row.message.includes('Siklus')));
});

test('duplicate leaf codes are rejected', () => {
  const errors = validateWorkTree(tree({ secondCode: 'I.1.1' }));
  assert.ok(problems(errors, 'nodes.3.code').some((row) => row.message.includes('harus unik')));
});

test('quantitative weights must sum to 100% within 0.01 tolerance', () => {
  assert.deepEqual(validateWorkTree(tree({ weights: [50, 49.99] })), []);
  const tooLow = validateWorkTree(tree({ weights: [50, 49.98] }));
  assert.ok(problems(tooLow, 'nodes').some((row) => row.message.includes('100%')));
  const tooHigh = validateWorkTree(tree({ weights: [50, 50.02] }));
  assert.ok(problems(tooHigh, 'nodes').some((row) => row.message.includes('100%')));
  assert.ok(problems(validateWorkTree(tree({ weights: [101, 40] })), 'nodes.2.weightPercent').some((row) => row.message.includes('0 sampai 100')));
  assert.ok(problems(validateWorkTree(tree({ weights: [60, -20] })), 'nodes.3.weightPercent').some((row) => row.message.includes('0 sampai 100')));
});

test('qualitative templates skip weight and unit rules but keep structure rules', () => {
  const nodes = [
    { id: 's1', kind: 'section', parentId: null, code: 'I', description: 'Section kualitatif' },
    { id: 'ss1', kind: 'subsection', parentId: 's1', code: 'I.1', description: 'Subsection kualitatif' },
    { id: 'i1', kind: 'item', parentId: 'ss1', code: 'I.1.1', description: 'Item dokumen', unit: '', targetVolume: null, weightPercent: null },
  ];
  assert.deepEqual(validateWorkTree(nodes, 'qualitative'), []);
  assert.ok(problems(validateWorkTree([{ ...nodes[2], parentId: 'parent-hilang', code: 'I.1.1', kind: 'item' }, nodes[0], nodes[1]], 'qualitative'), 'nodes.0.parentId').length > 0);
});

test('groups without children and leaves with children are rejected', () => {
  const orphanSection = [{ id: 's1', kind: 'section', parentId: null, code: 'I', description: 'Tanpa rincian' }];
  assert.ok(validateWorkTree(orphanSection).some((row) => row.message.includes('Kelompok harus memiliki rincian')));
  const nodes = tree();
  nodes.push({ id: 'sub', kind: 'item', parentId: 'i1', code: 'I.1.1.1', description: 'Turunan ilegal', unit: 'm', targetVolume: 1, weightPercent: 0 });
  assert.ok(validateWorkTree(nodes).some((row) => row.message.includes('Item leaf tidak boleh mempunyai turunan')));
});

/* KAK: baseline periods and overlap ---------------------------------------- */

test('effectiveReferencePeriod ends the day before a replacement starts', () => {
  const first = kakVersion({ referenceVersionId: 'acuan:UJI:v1', validFrom: '2026-01-01' });
  const second = kakVersion({ referenceVersionId: 'acuan:UJI:v2', version: 2, status: 'published', supersedesVersionId: 'acuan:UJI:v1', assignment: { ...first.assignment, validFrom: '2026-07-01' } });
  const entry = { referenceId: 'acuan:UJI', versions: [first, second], archives: [] };
  assert.deepEqual(effectiveReferencePeriod(entry, first), { from: '2026-01-01', to: '2026-06-30' });
  assert.deepEqual(effectiveReferencePeriod(entry, second), { from: '2026-07-01', to: null });
});

test('overlapping published baselines on the same package and metric are rejected', () => {
  const existing = kakVersion({
    referenceVersionId: 'acuan:LAMA:v1', status: 'published',
    assignment: { projectId: 'project:A', kode: 'A', packageId: 'package:A:01', metric: 'm1', validFrom: '2025-01-01', validTo: null },
  });
  const references = [kmFreeze({ referenceId: 'acuan:LAMA', versions: [existing] })];
  const overlap = validateReferenceVersion(kakVersion({ referenceVersionId: 'acuan:BARU:v1', assignment: { projectId: 'project:A', kode: 'A', packageId: 'package:A:01', metric: 'm1', validFrom: '2026-06-01', validTo: null } }), { projects: PROJECTS, packages: PACKAGES, references, referenceId: 'acuan:BARU' });
  assert.ok(problems(overlap, 'assignment.validFrom').some((row) => row.message.includes('bertabrakan')), JSON.stringify(overlap));

  const before = validateReferenceVersion(kakVersion({ referenceVersionId: 'acuan:BARU:v1', assignment: { projectId: 'project:A', kode: 'A', packageId: 'package:A:01', metric: 'm1', validFrom: '2024-01-01', validTo: '2024-12-31' } }), { projects: PROJECTS, packages: PACKAGES, references, referenceId: 'acuan:BARU' });
  assert.deepEqual(problems(before, 'assignment.validFrom'), []);

  const otherMetric = validateReferenceVersion(kakVersion({ assignment: { projectId: 'project:A', kode: 'A', packageId: 'package:A:01', metric: 'm2', validFrom: '2026-06-01', validTo: null } }), { projects: PROJECTS, packages: PACKAGES, references, referenceId: 'acuan:BARU' });
  assert.ok(!problems(otherMetric, 'assignment.validFrom').some((row) => row.message.includes('bertabrakan')));

  const otherPackage = validateReferenceVersion(kakVersion({ assignment: { projectId: 'project:A', kode: 'A', packageId: 'package:A:02', metric: 'm1', validFrom: '2026-06-01', validTo: null } }), { projects: PROJECTS, packages: PACKAGES, references, referenceId: 'acuan:BARU' });
  assert.ok(!problems(otherPackage, 'assignment.validFrom').some((row) => row.message.includes('bertabrakan')));
});

test('archived or qualitative baselines do not block new quantitative versions', () => {
  const archivedVersion = kakVersion({ referenceVersionId: 'acuan:LAMA:v1', status: 'published', assignment: { projectId: 'project:A', kode: 'A', packageId: 'package:A:01', metric: 'm1', validFrom: '2025-01-01', validTo: null } });
  const qualitative = kakVersion({ referenceVersionId: 'acuan:KUAL:v1', status: 'published', measurement: 'qualitative', template: { templateId: 'template:kual', title: 'Kualitatif', version: 1, nodes: [{ id: 's1', kind: 'section', parentId: null, code: 'I', description: 'Dokumen' }] }, assignment: { projectId: 'project:A', kode: 'A', packageId: 'package:A:01', metric: 'm1', validFrom: '2025-01-01', validTo: null } });
  const references = [
    { referenceId: 'acuan:LAMA', versions: [archivedVersion], archives: [{ versionId: 'acuan:LAMA:v1', reason: 'usang', actorId: 'admin-test', at: NOW }] },
    kmFreeze({ referenceId: 'acuan:KUAL', versions: [qualitative] }),
  ];
  const errors = validateReferenceVersion(kakVersion(), { projects: PROJECTS, packages: PACKAGES, references, referenceId: 'acuan:UJI' });
  assert.ok(!problems(errors, 'assignment.validFrom').some((row) => row.message.includes('bertabrakan')), JSON.stringify(errors));
});

function kmFreeze(entry) { return { revision: 1, illustrative: true, archives: [], ...entry }; }

/* KAK: seed catalog ---------------------------------------------------------- */

test('seedKakCatalog builds two distinct valid references for the first two projects', () => {
  const entries = seedKakCatalog(PROJECTS, PACKAGES, '2026-11-06');
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((entry) => entry.referenceId), ['acuan:A:contoh', 'acuan:B:contoh']);
  assert.notEqual(entries[0].versions[0].template.nodes, entries[1].versions[0].template.nodes);
  for (const entry of entries) {
    const version = entry.versions[0];
    assert.equal(version.status, 'published');
    assert.deepEqual(validateWorkTree(version.template.nodes, version.measurement), []);
    assert.deepEqual(validateReferenceVersion(version, { projects: PROJECTS, packages: PACKAGES, references: entries, referenceId: entry.referenceId }), []);
    assert.equal(version.illustrative ?? entry.illustrative, true);
  }
});

/* KAK: service workflow ------------------------------------------------------ */

test('KAK service enforces reason, weight validation, immutability, and rebaseline', () => {
  const stub = catalogProvider();
  const service = createKakService({ provider: stub, now: () => NOW });
  const payload = (weights) => ({
    measurement: 'quantitative', reason: 'Draft awal uji',
    document: { title: 'KAK uji', number: '', version: '1', owner: 'Pemilik uji', source: 'Sumber uji' },
    template: { title: 'Template uji', nodes: tree({ weights }) },
    assignment: { kode: 'A', packageId: 'package:A:01', metric: 'm1', validFrom: '2026-01-01', validTo: '' },
  });
  const draft = service.saveDraft(payload([60, 30]), { actor: ADMIN });
  assert.equal(draft.revision, 1);
  assert.equal(draft.versions.at(-1).status, 'draft');

  assert.throws(() => service.publish(draft.referenceId, { expectedRevision: 1, reason: '', actor: ADMIN }), error('VALIDATION'));
  assert.throws(() => service.publish(draft.referenceId, { expectedRevision: 1, reason: 'Terbit', actor: ADMIN }), (issue) => issue.code === 'VALIDATION' && issue.fieldErrors.some((row) => row.field === 'nodes' && row.message.includes('100%')));

  const fixed = service.saveDraft(payload([60, 40]), { id: draft.referenceId, expectedRevision: 1, actor: ADMIN });
  assert.equal(fixed.revision, 2);
  const published = service.publish(draft.referenceId, { expectedRevision: 2, reason: 'Terbit demo', actor: ADMIN });
  assert.equal(published.versions.at(-1).status, 'published');
  assert.equal(published.versions.at(-1).publishedBy, ADMIN.id);

  assert.throws(() => service.saveDraft(payload([60, 40]), { id: draft.referenceId, expectedRevision: 3, actor: ADMIN }), error('IMMUTABLE'));
  assert.throws(() => service.publish(draft.referenceId, { expectedRevision: 99, reason: 'basil', actor: ADMIN }), error('CONFLICT'));

  assert.throws(() => service.rebaseline(draft.referenceId, { expectedRevision: 3, validFrom: '2026-01-01', reason: 'tanggal mundur', actor: ADMIN }), error('VALIDATION'));
  const rebased = service.rebaseline(draft.referenceId, { expectedRevision: 3, validFrom: '2026-02-01', reason: 'Perubahan lingkup demo', actor: ADMIN });
  assert.equal(rebased.versions.length, 2);
  assert.equal(rebased.versions.at(-1).status, 'draft');
  assert.equal(rebased.versions.at(-1).supersedesVersionId, published.versions.at(-1).referenceVersionId);
  assert.throws(() => service.rebaseline(draft.referenceId, { expectedRevision: 4, validFrom: '2026-03-01', reason: 'masih ada draft pengganti', actor: ADMIN }), error('CONFLICT'));
  const republished = service.publish(draft.referenceId, { expectedRevision: 4, reason: 'Rebaseline terbit', actor: ADMIN });
  const first = republished.versions[0];
  assert.deepEqual(effectiveReferencePeriod(republished, first), { from: '2026-01-01', to: '2026-01-31' });

  const archived = service.archive(draft.referenceId, { expectedRevision: 5, versionId: first.referenceVersionId, reason: 'Arsip demo', actor: ADMIN });
  assert.equal(archived.archives.length, 1);
});

test('KAK service requires scoped demo admin and only touches the references catalog', () => {
  const stub = catalogProvider({ references: [kmFreeze({ referenceId: 'acuan:A:contoh', versions: [kakVersion({ status: 'published' })] })] });
  const service = createKakService({ provider: stub, now: () => NOW });
  const payload = {
    measurement: 'qualitative', reason: 'uji',
    document: { title: 't', version: '1', owner: 'o', source: 's' },
    template: { title: 'T', nodes: [{ id: 's1', kind: 'section', parentId: null, code: 'I', description: 'd' }] },
    assignment: { kode: 'A', packageId: 'package:A:01', metric: 'dokumen', validFrom: '2026-06-01', validTo: '' },
  };
  assert.throws(() => service.saveDraft(payload, { actor: REVIEWER_A }), error('FORBIDDEN'));
  assert.throws(() => service.saveDraft({ ...payload, assignment: { ...payload.assignment, kode: 'C' } }, { actor: ADMIN }), error('FORBIDDEN'));
  const saved = service.saveDraft(payload, { actor: ADMIN });
  assert.deepEqual(stub.getCatalog('references').map((row) => row.referenceId), ['acuan:A:contoh', saved.referenceId]);
  assert.deepEqual(stub.getCatalog('knowledge'), []);
  assert.equal(service.get('acuan:A:contoh', REVIEWER_A).referenceId, 'acuan:A:contoh');
  assert.throws(() => service.get('acuan:A:contoh', REVIEWER_B), error('NOT_FOUND'));
  assert.equal(service.list({ kode: 'A' }, REVIEWER_A).length, 2);
  assert.equal(service.list({ kode: 'A' }, REVIEWER_B).length, 0);
});

/* KM: catalog shape --------------------------------------------------------- */

test('knowledge catalog exposes exactly the three mandated types with exact labels', () => {
  assert.deepEqual(Object.keys(KNOWLEDGE_TYPES), ['BASIS_PENGETAHUAN', 'LESSON_LEARNED', 'FAQ']);
  assert.deepEqual(KNOWLEDGE_TYPES, { BASIS_PENGETAHUAN: 'Basis Pengetahuan', LESSON_LEARNED: 'Lesson Learned Proyek', FAQ: 'Tanya Jawab (FAQ)' });
  assert.ok(problems(validateKnowledgeVersion({ type: 'PENGUMUMAN', visibility: 'organization' }), 'type').length > 0);
});

test('normalizeKnowledgeCatalog maps legacy seed rows and adds labelled examples without inventing rows', () => {
  const rows = normalizeKnowledgeCatalog([
    { id: 'p1', jenis: 'Panduan', judul: 'Panduan uji', ringkas: 'Ringkas p1', isi: ['Baris 1', 'Baris 2'], offset: -3 },
    { id: 'q1', jenis: 'Tanya jawab', judul: 'Apa itu cut-off?', ringkas: 'Ringkas q1', isi: ['Jawaban q1'], offset: -1 },
  ], { projects: PROJECTS, packages: PACKAGES, today: '2026-11-06' });
  const byId = new Map(rows.map((row) => [row.entryId, row]));
  assert.equal(byId.get('p1').versions[0].type, 'BASIS_PENGETAHUAN');
  assert.equal(byId.get('q1').versions[0].type, 'FAQ');
  assert.equal(byId.get('p1').versions[0].status, 'published');
  assert.equal(byId.get('q1').versions[0].question, 'Apa itu cut-off?');
  assert.ok(byId.has('KM-DEMO-PROGRES'));
  const lesson = rows.find((row) => row.entryId === 'KM-DEMO-ANTRE');
  assert.equal(lesson.versions[0].type, 'LESSON_LEARNED');
  assert.equal(lesson.versions[0].kode, PROJECTS[0].kode);
  assert.ok(lesson.versions[0].packageId === PACKAGES[0].packageId);
  for (const row of rows) assert.ok(row.illustrative === true && typeof row.versions[0].source === 'string' && row.versions[0].source.length > 0);
  assert.throws(() => normalizeKnowledgeCatalog('bukan array', { projects: PROJECTS }), error('CORRUPT_CATALOG'));
});

/* KM: validation ------------------------------------------------------------ */

test('FAQ contributions may omit an answer at submission but never at publication', () => {
  const base = kmVersion({ type: 'FAQ', status: 'draft', title: 't', owner: 'o', source: 's', reason: 'r', question: 'Q?', answer: '', contribution: true });
  assert.deepEqual(validateKnowledgeVersion(base, { projects: PROJECTS, packages: PACKAGES, submission: true }), []);
  const publication = validateKnowledgeVersion(base, { projects: PROJECTS, packages: PACKAGES, publication: true });
  assert.ok(problems(publication, 'answer').some((row) => row.message.includes('Jawaban')));
  assert.deepEqual(validateKnowledgeVersion({ ...base, answer: 'Jawaban terkurasi.' }, { projects: PROJECTS, packages: PACKAGES, publication: true }), []);
});

test('private visibility and attachments are blocked from direct publication', () => {
  const errors = validateKnowledgeVersion(kmVersion({ visibility: 'private' }), { projects: PROJECTS, packages: PACKAGES, publication: true });
  assert.ok(problems(errors, 'visibility').some((row) => row.message.includes('privat')));
  const attachment = validateKnowledgeVersion(kmVersion({ attachmentRefs: ['file:x'] }), { projects: PROJECTS, packages: PACKAGES });
  assert.ok(problems(attachment, 'attachments').length > 0);
});

/* KM: publish workflow permissions ------------------------------------------ */

test('publish workflow enforces author/editor separation and review status', () => {
  const service = createKnowledgeService({ provider: catalogProvider(), now: () => NOW });
  const draft = service.saveDraft({ type: 'BASIS_PENGETAHUAN', title: 'Materi uji', summary: 's', body: 'Isi', owner: 'Pemilik', source: 'Sumber', visibility: 'organization', reason: 'draft awal', tags: ['uji'] }, { actor: AUTHOR });
  assert.equal(draft.versions.at(-1).status, 'draft');

  assert.throws(() => service.publish(draft.entryId, { expectedRevision: 1, reason: 'langsung', actor: EDITOR2 }), error('CONFLICT'));
  assert.throws(() => service.submit(draft.entryId, { expectedRevision: 1, reason: '', actor: AUTHOR }), error('VALIDATION'));
  const review = service.submit(draft.entryId, { expectedRevision: 1, reason: 'siap direview', actor: AUTHOR });
  assert.equal(review.versions.at(-1).status, 'in-review');
  assert.ok(review.editorialHistory.some((row) => row.action === 'submit'));

  assert.throws(() => service.publish(draft.entryId, { expectedRevision: 2, reason: 'bukan editor', actor: AUTHOR }), error('FORBIDDEN'));

  const ownRows = catalogProvider();
  const ownService = createKnowledgeService({ provider: ownRows, now: () => NOW });
  const ownDraft = ownService.saveDraft({ type: 'BASIS_PENGETAHUAN', title: 'Materi editor', body: 'Isi', owner: 'Pemilik', source: 'Sumber', visibility: 'organization', reason: 'r', tags: [] }, { actor: EDITOR });
  ownService.submit(ownDraft.entryId, { expectedRevision: 1, reason: 'review', actor: EDITOR });
  assert.throws(() => ownService.publish(ownDraft.entryId, { expectedRevision: 2, reason: 'materi sendiri', actor: EDITOR }), error('SELF_REVIEW'));

  const returned = service.returnToDraft(draft.entryId, { expectedRevision: 2, reason: 'perlu data', actor: EDITOR2 });
  assert.equal(returned.versions.at(-1).status, 'draft');
  service.submit(draft.entryId, { expectedRevision: 3, reason: 'ajukan lagi', actor: AUTHOR });
  const published = service.publish(draft.entryId, { expectedRevision: 4, reason: 'layak terbit', actor: EDITOR2 });
  assert.equal(published.versions.at(-1).status, 'published');
  assert.equal(published.versions.at(-1).reviewerId, EDITOR2.id);
  assert.notEqual(published.versions.at(-1).authorId, EDITOR2.id);
});

test('published knowledge versions are immutable and revisions supersede', () => {
  const stub = catalogProvider({ knowledge: [kmEntry('km-fixed', [kmVersion({ versionId: 'km-fixed:v1' })])] });
  const service = createKnowledgeService({ provider: stub, now: () => NOW });
  assert.throws(() => service.saveDraft({ type: 'BASIS_PENGETAHUAN', title: 'x', body: 'y', owner: 'o', source: 's', visibility: 'organization', reason: 'r', tags: [] }, { id: 'km-fixed', expectedRevision: 1, actor: EDITOR2 }), error('IMMUTABLE'));
  const next = service.revise('km-fixed', { expectedRevision: 1, reason: 'pembaruan', actor: EDITOR2 });
  assert.equal(next.versions.length, 2);
  assert.equal(next.versions.at(-1).status, 'draft');
  assert.equal(next.versions.at(-1).supersedesVersionId, 'km-fixed:v1');
  assert.equal(next.versions[0].status, 'published');
});

test('contractor role is limited to private FAQ or lesson proposals on own projects', () => {
  const service = createKnowledgeService({ provider: catalogProvider(), now: () => NOW });
  const allowed = service.saveDraft({ type: 'FAQ', title: 'Pertanyaan lapangan', question: 'Q?', owner: 'Kontraktor', source: 'Sumber', visibility: 'private', kode: 'A', reason: 'usulan', tags: [] }, { actor: CONTRACTOR });
  assert.equal(allowed.versions.at(-1).contribution, true);
  assert.throws(() => service.saveDraft({ type: 'BASIS_PENGETAHUAN', title: 'x', owner: 'o', source: 's', visibility: 'organization', reason: 'r', tags: [] }, { actor: CONTRACTOR }), error('FORBIDDEN'));
  assert.throws(() => service.saveDraft({ type: 'FAQ', title: 'x', question: 'q', owner: 'o', source: 's', visibility: 'organization', reason: 'r', tags: [] }, { actor: CONTRACTOR }), error('FORBIDDEN'));
  assert.throws(() => service.saveDraft({ type: 'FAQ', title: 'x', question: 'q', owner: 'o', source: 's', visibility: 'private', kode: 'C', reason: 'r', tags: [] }, { actor: CONTRACTOR }), error('FORBIDDEN'));
});

/* KM: scoped search --------------------------------------------------------- */

test('scoped search and counts are computed after reader scope is applied', () => {
  const rows = [
    kmEntry('km-org', [kmVersion({ versionId: 'km-org:v1', title: 'Panduan umum demo' })]),
    kmEntry('km-a', [kmVersion({ versionId: 'km-a:v1', title: 'Panduan khusus proyek A', visibility: 'project', kode: 'A' })]),
    kmEntry('km-b', [kmVersion({ versionId: 'km-b:v1', title: 'Panduan khusus proyek B', visibility: 'project', kode: 'B' })]),
    kmEntry('km-draft', [kmVersion({ versionId: 'km-draft:v1', title: 'Panduan umum draft', status: 'draft', authorId: 'author-1' })]),
  ];
  const forA = queryKnowledgeCatalog(rows, {}, REVIEWER_A);
  assert.deepEqual(forA.map((row) => row.entryId).sort(), ['km-a', 'km-draft', 'km-org']);
  const forB = queryKnowledgeCatalog(rows, {}, REVIEWER_B);
  assert.deepEqual(forB.map((row) => row.entryId).sort(), ['km-b', 'km-draft', 'km-org']); // reviewer editorial role sees drafts without project binding
  const publicReader = queryKnowledgeCatalog(rows, {}, null, { publishedOnly: true });
  assert.deepEqual(publicReader.map((row) => row.entryId), ['km-org']);

  assert.deepEqual(queryKnowledgeCatalog(rows, { q: 'KHUSUS PROYEK A' }, REVIEWER_A).map((row) => row.entryId), ['km-a']);
  assert.deepEqual(queryKnowledgeCatalog(rows, { q: 'KHUSUS PROYEK A' }, REVIEWER_B).map((row) => row.entryId), []);
  assert.deepEqual(queryKnowledgeCatalog(rows, { kode: 'B' }, REVIEWER_B).map((row) => row.entryId), ['km-b']);
  assert.deepEqual(queryKnowledgeCatalog(rows, { status: 'draft' }, null, { publishedOnly: true }).map((row) => row.entryId), []);
  assert.equal(queryKnowledgeCatalog(rows, { tag: 'uji' }, REVIEWER_A).length, 3);
});

test('service detail resolves readable versions only', () => {
  const service = createKnowledgeService({ provider: catalogProvider(), now: () => NOW });
  const draft = service.saveDraft({ type: 'BASIS_PENGETAHUAN', title: 'Materi uji', body: 'Isi', owner: 'Pemilik', source: 'Sumber', visibility: 'organization', reason: 'r', tags: ['uji'] }, { actor: AUTHOR });
  assert.equal(service.get(draft.entryId, AUTHOR).entryId, draft.entryId);
  assert.throws(() => service.get(draft.entryId, null), error('NOT_FOUND'));
  const stub = catalogProvider({ knowledge: [kmEntry('km-x', [kmVersion({ versionId: 'km-x:v1' })])] });
  const reader = createKnowledgeService({ provider: stub, now: () => NOW });
  assert.equal(reader.get('km-x', null).displayVersion.versionId, 'km-x:v1');
  assert.throws(() => reader.get('km-x', null, 'km-x:v9'), error('NOT_FOUND'));
});

/* Init guard ---------------------------------------------------------------- */

test('init functions are DOM-guarded and safe to import under Node without a root', () => {
  assert.equal(typeof initKak, 'function');
  assert.equal(typeof initKnowledge, 'function');
  const offKak = initKak(null);
  const offKnowledge = initKnowledge(null);
  assert.equal(typeof offKak, 'function');
  assert.equal(typeof offKnowledge, 'function');
  assert.doesNotThrow(() => { offKak(); offKnowledge(); });
});

/* Styling contract ----------------------------------------------------------- */

test('admin-content.css exists, uses tokens only, and honors a11y/responsive rules', () => {
  const css = readFileSync(fileURLToPath(new URL('../admin-content.css', import.meta.url)), 'utf8');
  assert.ok(css.length > 1000);
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(css), 'no raw hex colors');
  assert.ok(!/\b(?:oklch|rgb|hsl|rgba|hsla)\(/i.test(css), 'no raw color functions');
  assert.ok(css.includes('min-height: 44px'));
  assert.ok(css.includes(':focus-visible'));
  assert.ok(css.includes('prefers-reduced-motion'));
  assert.ok(css.includes('max-width: 480px'));
  assert.ok(css.includes('--color-field'));
  for (const match of css.matchAll(/var\((--[a-z0-9-]+)/gi)) {
    assert.match(match[1], /^--(color|font|space|text|radius)-/, `unknown token family: ${match[1]}`);
  }
});
