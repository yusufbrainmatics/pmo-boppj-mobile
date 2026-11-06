import test from 'node:test'
import assert from 'node:assert/strict'
import projectsSeed from '../src/data/proyek.json' with { type: 'json' }
import reportsSeed from '../src/data/laporan.json' with { type: 'json' }
import contractorSeed from '../src/data/kontraktor.json' with { type: 'json' }
import knowledgeSeed from '../src/data/pengetahuan.json' with { type: 'json' }
import { createDemoProvider, businessDate, workDate, addDays, cutOffFor, STORAGE_KEY, IMPORT_MAPPING_VERSION } from '../src/lib/demo-domain.js'
import { provider as browserProvider, DEMO_TODAY, DEMO_LABEL, DEMO_ADMIN, DEMO_REVIEWER, DEMO_CONTRACTOR, projects, packages } from '../admin-data.js'

const TODAY = '2026-11-06'
const ALL = projectsSeed.map((p) => p.kode)
const REVIEWER = { id: 'reviewer-demo', role: 'reviewer', projectCodes: ALL }
const ADMIN = { id: 'admin-demo', role: 'admin', projectCodes: ALL }
const CONTRACTOR = { id: 'contractor-demo', role: 'contractor', projectCodes: contractorSeed.paket.map((p) => p.kode) }
const PKG = 'package:GSW-12:01'
const PKG2 = 'package:GSW-12:02'
const codeError = (code) => (error) => error.code === code && typeof error.message === 'string' && error.message.length > 0
const copy = (value) => structuredClone(value)

function memoryStorage(entries = {}) {
  const data = new Map(Object.entries(entries))
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) }
}
function fixture(options = {}) {
  let time = options.now ?? '2026-11-06T14:00:00Z'
  const provider = createDemoProvider({ projects: projectsSeed, reports: [], contractor: contractorSeed, knowledge: knowledgeSeed, ...options, now: () => time })
  return { provider, setNow: (value) => { time = value } }
}
function payload(overrides = {}) {
  return { kode: 'GSW-12', packageId: PKG, tanggal: TODAY, progres: 25, volume: 40, satuan: 'm³', uraian: 'Pekerjaan harian ilustratif untuk pengujian domain.', cuaca: 'Cerah', tenaga: 42, ...overrides }
}
function newProject(kode = 'DEMO-NEW') { return { ...projectsSeed[0], kode, nama: `Proyek ${kode} ilustratif` } }
function accept(provider, report, extra = {}) { return provider.decideReport(report.id, { action: 'accepted', expectedVersion: report.version, actor: REVIEWER, ...extra }) }

test('adapter uses the exact source master and preserves contractor assignments without official enrichment', () => {
  assert.equal(projects.length, projectsSeed.length)
  assert.equal(browserProvider.getProjects().length, projectsSeed.length)
  for (const original of projectsSeed) {
    const actual = projects.find((p) => p.kode === original.kode)
    for (const [field, value] of Object.entries(original)) assert.deepEqual(actual[field], value)
    assert.equal(actual.projectId, `project:${original.kode}`)
    assert.equal(actual.illustrative, true)
    assert.equal(actual.provenance.verificationStatus, 'illustrative-unverified')
  }
  for (const assignment of contractorSeed.paket) {
    const pkg = packages.find((p) => p.packageId === `package:${assignment.kode}:01`)
    assert.equal(pkg.packageCode, assignment.kontrak)
    assert.equal(pkg.contractorId, CONTRACTOR.id)
    assert.equal(pkg.kontraktor, contractorSeed.pengguna.perusahaan)
    assert.deepEqual(pkg.rencana, assignment.rencana)
    assert.equal('telepon' in pkg, false)
  }
  assert.equal(packages.filter((p) => p.kode === 'GSW-12').length, 2)
  assert.equal(DEMO_LABEL.includes('ilustratif'), true)
  assert.match(DEMO_TODAY, /^\d{4}-\d{2}-\d{2}$/)
  assert.deepEqual(DEMO_ADMIN.projectCodes, ALL)
  assert.deepEqual(DEMO_REVIEWER.projectCodes, ALL)
  assert.deepEqual(DEMO_CONTRACTOR.projectCodes, CONTRACTOR.projectCodes)
})

test('legacy seed dates, statuses, IDs, nullable references, and unavailable evidence survive adaptation', () => {
  const { provider } = fixture({ reports: reportsSeed })
  assert.equal(provider.getReports().length, reportsSeed.length)
  for (const seed of reportsSeed) {
    const report = provider.getReport(seed.id)
    assert.equal(report.id, seed.id)
    assert.equal(report.tanggal, addDays(TODAY, seed.offset))
    assert.equal(report.progres, seed.progres)
    assert.equal(report.status, seed.status)
    assert.equal(report.referenceVersionId, null)
    assert.equal(report.evidenceAvailability, 'unavailable')
    assert.equal(report.foto, seed.foto)
    assert.equal(report.revisions.length, 1)
    assert.equal(report.simulationOnly, true)
  }
})

test('WIB date math is deterministic across UTC midnight, year boundaries, and leap dates', () => {
  assert.equal(businessDate('2026-11-05T17:00:00Z'), TODAY)
  assert.equal(businessDate('2026-11-05T16:59:59.999Z'), '2026-11-05')
  assert.equal(businessDate('2026-12-31T17:00:00Z'), '2027-01-01')
  assert.equal(addDays('2024-03-01', -1), '2024-02-29')
  assert.equal(cutOffFor(TODAY), `${TODAY}T20:00:00+07:00`)
  for (const value of ['2026-02-29', '2026-11-31', '2026-1-01', '', null, 20261106]) assert.throws(() => workDate(value), codeError('VALIDATION'))
  assert.throws(() => businessDate('2026-11-06T13:00:00'), codeError('VALIDATION'))
})

test('project, package, report and state results are detached deep clones', () => {
  const { provider } = fixture({ reports: reportsSeed })
  const p = provider.getProjects(); p[0].nama = 'mutated'; p[0].provenance.source = 'mutated'
  const pk = provider.getPackages(); pk.find((p) => p.packageId === PKG).rencana[0] = 999
  const r = provider.getReport('L-0905'); r.revisions[0].uraian = 'mutated'; r.decisions[0].reason = 'mutated'
  const state = provider.getState(); state.reports.length = 0
  assert.equal(provider.getProjects()[0].nama, projectsSeed[0].nama)
  assert.equal(provider.getProjects()[0].provenance.source, 'src/data/proyek.json')
  assert.equal(provider.getPackages().find((p) => p.packageId === PKG).rencana[0], contractorSeed.paket[0].rencana[0])
  assert.notEqual(provider.getReport('L-0905').revisions[0].uraian, 'mutated')
  assert.equal(provider.getReports().length, reportsSeed.length)
})

test('scope is applied before search, detail and export; direct IDs do not bypass it', () => {
  const { provider } = fixture({ reports: reportsSeed })
  const scoped = { id: 'reviewer-scoped', role: 'reviewer', projectCodes: ['GSW-12'] }
  assert.equal(provider.getReports({}, scoped).length, reportsSeed.filter((r) => r.kode === 'GSW-12').length)
  assert.deepEqual(provider.getReports({ q: 'Kaligawe' }, scoped), [])
  assert.throws(() => provider.getReport('L-0884', scoped), codeError('FORBIDDEN'))
  assert.throws(() => provider.getReport('not-existing', scoped), codeError('NOT_FOUND'))
  const snapshot = provider.createSnapshot({}, scoped)
  assert.deepEqual(snapshot.projects.map((p) => p.kode), ['GSW-12'])
  assert.equal(snapshot.reports.every((r) => r.kode === 'GSW-12'), true)
  assert.equal(snapshot.packages.every((p) => p.kode === 'GSW-12'), true)
  assert.equal(provider.getCompliance({ date: TODAY, actor: scoped }).every((r) => r.kode === 'GSW-12'), true)
  assert.throws(() => provider.getReports({}, { id: 'none', role: 'reviewer' }), codeError('FORBIDDEN'))
  assert.deepEqual(provider.getReports({}, { ...scoped, projectCodes: [] }), [])
})

test('contractor scope respects organization and explicit package assignment within a multi-package project', () => {
  const { provider } = fixture()
  const own = provider.submitReport(payload())
  const other = provider.submitReport(payload({ packageId: PKG2 }), { actor: REVIEWER })
  assert.deepEqual(provider.getReports({}, CONTRACTOR).map((r) => r.id), [own.id])
  assert.throws(() => provider.getReport(other.id, CONTRACTOR), codeError('FORBIDDEN'))
  assert.throws(() => provider.submitReport(payload({ packageId: PKG2, tanggal: addDays(TODAY, -1) })), codeError('FORBIDDEN'))
  assert.deepEqual(provider.getReports({}, { ...CONTRACTOR, id: 'other-contractor' }), [])
  assert.equal(provider.getProjects({}, CONTRACTOR).length, contractorSeed.paket.length)
  const packageScoped = { ...REVIEWER, packageIds: [PKG] }
  assert.deepEqual(provider.getPackages({}, packageScoped).map((p) => p.packageId), [PKG])
  assert.deepEqual(provider.createSnapshot({}, packageScoped).projects.map((p) => p.kode), ['GSW-12'])
  assert.deepEqual(provider.createSnapshot({ packageId: PKG2 }, packageScoped).projects, [])
})

test('common filters share project identity, real regions, work-date range, delivery and status', () => {
  const { provider } = fixture({ reports: reportsSeed })
  assert.equal(provider.getProjects({ q: 'timbulsloko' })[0].kode, 'GSW-13')
  assert.equal(provider.getProjects({ provinsi: 'Banten' }).length, projectsSeed.filter((p) => p.provinsi === 'Banten').length)
  const reports = provider.getReports({ provinsi: 'Jawa Tengah', from: addDays(TODAY, -2), to: TODAY, status: 'DITERIMA' })
  assert.equal(reports.length, 2)
  assert.equal(reports.every((r) => r.kode === 'GSW-12'), true)
  assert.equal(provider.getReports({ packageId: PKG, reviewState: 'accepted' }).length, 2)
  assert.equal(provider.getReports({ contractorId: CONTRACTOR.id, delivery: 'delivered' }).length, reportsSeed.length)
  for (const query of [{ from: TODAY, to: addDays(TODAY, -1) }, { from: '2026-02-30' }, { q: {} }]) assert.throws(() => provider.getReports(query), codeError('VALIDATION'))
})

test('submission validates master identity, seven-day dates and adversarial numeric types', () => {
  const { provider } = fixture()
  const invalidPayloads = [
    { kode: 'UNKNOWN' }, { packageId: 'package:NCICD-A-03:01' }, { tanggal: '2026-02-30' },
    { tanggal: addDays(TODAY, 1) }, { tanggal: addDays(TODAY, -8) }, { progres: -1 }, { progres: 101 }, { progres: 2.001 },
    ...['25', true, [], {}, NaN, Infinity].map((progres) => ({ progres })),
    { volume: -1 }, { volume: '3' }, { tenaga: 0.5 }, { tenaga: 5001 }, { uraian: 'short' }, { delivery: 'uploading' },
  ]
  for (const patch of invalidPayloads) assert.throws(() => provider.submitReport(payload(patch)), codeError('VALIDATION'), JSON.stringify(patch))
  assert.equal(provider.getReports().length, 0)
  const report = provider.submitReport(payload({ tanggal: addDays(TODAY, -7), progres: 0, volume: 0, tenaga: 0 }))
  assert.equal(report.progres, 0)
  assert.equal(report.createdBy, CONTRACTOR.id)
  assert.equal(report.receivedAt, '2026-11-06T14:00:00.000Z')
})

test('one logical report per package/date survives rejection, while two packages remain independent', () => {
  const { provider } = fixture()
  const first = provider.submitReport(payload())
  provider.decideReport(first.id, { action: 'needs-revision', reason: 'Periksa kembali volume pekerjaan.', expectedVersion: first.version })
  assert.throws(() => provider.submitReport(payload({ progres: 26 })), codeError('CONFLICT'))
  const second = provider.submitReport(payload({ packageId: PKG2 }), { actor: { ...REVIEWER, id: 'author-other' } })
  assert.notEqual(first.id, second.id)
  assert.equal(provider.getReports().length, 2)
})

test('submission idempotency returns the original receipt, independent of key order or later decisions', () => {
  const { provider } = fixture()
  const original = provider.submitReport(payload(), { idempotencyKey: 'submit-one' })
  const reverse = Object.fromEntries(Object.entries(payload()).reverse())
  assert.deepEqual(provider.submitReport(reverse, { idempotencyKey: 'submit-one' }), original)
  accept(provider, original)
  assert.deepEqual(provider.submitReport(payload(), { idempotencyKey: 'submit-one' }), original)
  assert.throws(() => provider.submitReport(payload({ progres: 26 }), { idempotencyKey: 'submit-one' }), codeError('CONFLICT'))
  assert.equal(provider.getReports().length, 1)
})

test('a valid idempotent submission receipt remains retrievable after the backdate window moves', () => {
  const { provider, setNow } = fixture()
  const data = payload({ tanggal: addDays(TODAY, -7) })
  const original = provider.submitReport(data, { idempotencyKey: 'old-retry' })
  setNow('2026-11-07T14:00:00Z')
  assert.deepEqual(provider.submitReport(data, { idempotencyKey: 'old-retry' }), original)
})

test('retry authorization is rechecked and idempotency keys do not bypass scope', () => {
  const { provider } = fixture()
  provider.submitReport(payload(), { idempotencyKey: 'scoped-retry' })
  assert.throws(() => provider.submitReport(payload(), { actor: { ...CONTRACTOR, projectCodes: [] }, idempotencyKey: 'scoped-retry' }), codeError('FORBIDDEN'))
  assert.throws(() => provider.submitReport(payload({ tanggal: addDays(TODAY, -1) }), { idempotencyKey: ' ' }), codeError('VALIDATION'))
})

test('queued submission has no acknowledgment and cannot be decided', () => {
  const { provider } = fixture()
  const report = provider.submitReport(payload({ delivery: 'queued' }))
  assert.equal(report.status, 'ANTRE')
  assert.equal(report.delivery, 'queued')
  assert.equal(report.reviewState, 'submitted')
  assert.equal(report.receivedAt, null)
  assert.equal(report.firstReceivedAt, null)
  assert.equal(provider.getCompliance({ date: TODAY, filters: { packageId: PKG } })[0].deliveryStatus, 'queued')
  assert.throws(() => accept(provider, report), codeError('CONFLICT'))
  assert.equal(provider.getReport(report.id).decisions.length, 0)
})

test('review requires a scoped independent reviewer, not arbitrary admin or contractor', () => {
  const { provider } = fixture()
  const report = provider.submitReport(payload())
  assert.throws(() => accept(provider, report, { actor: CONTRACTOR }), codeError('FORBIDDEN'))
  assert.throws(() => accept(provider, report, { actor: ADMIN }), codeError('FORBIDDEN'))
  assert.throws(() => accept(provider, report, { actor: { ...REVIEWER, projectCodes: ['GSW-01'] } }), codeError('FORBIDDEN'))
  const self = { ...REVIEWER, id: CONTRACTOR.id }
  assert.throws(() => accept(provider, report, { actor: self }), codeError('FORBIDDEN'))
  assert.throws(() => accept(provider, report, { actor: { ...ADMIN, id: CONTRACTOR.id, canReview: true } }), codeError('FORBIDDEN'))
  assert.equal(provider.getReport(report.id).status, 'MENUNGGU')
  assert.equal(provider.getReport(report.id).decisions.length, 0)
})

test('author with reviewer role still cannot decide their own revision', () => {
  const { provider } = fixture()
  const report = provider.submitReport(payload(), { actor: REVIEWER })
  assert.throws(() => accept(provider, report), codeError('FORBIDDEN'))
})

test('review validates action, actionable reason and explicit expected version', () => {
  const { provider } = fixture()
  const report = provider.submitReport(payload())
  for (const reason of [undefined, '', '   ']) assert.throws(() => provider.decideReport(report.id, { action: 'needs-revision', expectedVersion: report.version, reason }), codeError('VALIDATION'))
  assert.throws(() => provider.decideReport(report.id, { action: 'paid', expectedVersion: report.version }), codeError('VALIDATION'))
  assert.throws(() => provider.decideReport(report.id, { action: 'accepted' }), codeError('VALIDATION'))
  assert.throws(() => provider.decideReport(report.id, { action: 'accepted', expectedVersion: String(report.version) }), codeError('VALIDATION'))
  assert.equal(provider.getReport(report.id).version, 1)
})

test('decisions increment optimistic version atomically and cannot silently reopen acceptance', () => {
  const { provider } = fixture()
  const report = provider.submitReport(payload())
  const accepted = accept(provider, report)
  assert.equal(accepted.version, report.version + 1)
  assert.equal(accepted.revisionId, report.revisionId)
  assert.equal(accepted.status, 'DITERIMA')
  assert.equal(accepted.decisions[0].revisionId, report.revisionId)
  assert.equal(accepted.decisions[0].simulationOnly, true)
  assert.throws(() => provider.decideReport(report.id, { action: 'needs-revision', reason: 'Keputusan bersamaan dari reviewer lain.', expectedVersion: report.version, actor: { ...REVIEWER, id: 'reviewer-two' } }), codeError('CONFLICT'))
  assert.throws(() => provider.decideReport(report.id, { action: 'needs-revision', reason: 'Tidak boleh membuka ulang revisi diterima.', expectedVersion: accepted.version }), codeError('CONFLICT'))
  assert.equal(provider.getReport(report.id).decisions.length, 1)
  assert.equal('payment' in provider.getState(), false)
})

test('decision retry reuses the original result and cannot change reason/action or duplicate decisions', () => {
  const { provider } = fixture()
  const report = provider.submitReport(payload())
  const request = { action: 'accepted', expectedVersion: report.version, idempotencyKey: 'review-once' }
  const original = provider.decideReport(report.id, request)
  assert.deepEqual(provider.decideReport(report.id, request), original)
  assert.throws(() => provider.decideReport(report.id, { ...request, reason: 'Different payload' }), codeError('CONFLICT'))
  assert.throws(() => provider.decideReport(report.id, { ...request, action: 'needs-revision', reason: 'Different action' }), codeError('CONFLICT'))
  assert.equal(provider.getReport(report.id).decisions.length, 1)
  const revision = provider.reviseReport(report.id, { progres: 24, reason: 'Koreksi volume hasil pemeriksaan lapangan.' }, { expectedVersion: original.version })
  assert.equal(revision.version, 3)
  assert.deepEqual(provider.decideReport(report.id, request), original)
})

test('revisions preserve logical identity, immutable content and all historical decisions', () => {
  const { provider } = fixture()
  const first = provider.submitReport(payload())
  const rejected = provider.decideReport(first.id, { action: 'needs-revision', reason: 'Perbaiki uraian dan periksa volume.', expectedVersion: first.version })
  const before = provider.getState().reports[0]
  const revised = provider.reviseReport(first.id, { progres: 26, uraian: 'Uraian pekerjaan yang telah diperbaiki oleh pelapor.' }, { expectedVersion: rejected.version, idempotencyKey: 'revision-one' })
  assert.equal(revised.reportId, first.reportId)
  assert.notEqual(revised.revisionId, first.revisionId)
  assert.equal(revised.revisions.length, 2)
  assert.equal(revised.status, 'MENUNGGU')
  assert.equal(revised.revisions[1].supersedesRevisionId, first.revisionId)
  assert.deepEqual(provider.getState().reports[0].revisions[0], before.revisions[0])
  assert.deepEqual(provider.getState().reports[0].decisions, before.decisions)
  assert.equal(revised.referenceVersionId, null)
  assert.throws(() => provider.reviseReport(first.id, { progres: 27 }, { expectedVersion: rejected.version }), codeError('CONFLICT'))
})

test('revision retry identifies the original request rather than merging with a later current revision', () => {
  const { provider } = fixture()
  const first = provider.submitReport(payload())
  const patch = { progres: 26 }
  const options = { expectedVersion: first.version, idempotencyKey: 'patch-retry' }
  const revised = provider.reviseReport(first.id, patch, options)
  provider.reviseReport(first.id, { uraian: 'A later revision changes a field omitted from the earlier patch.' }, { expectedVersion: revised.version })
  assert.deepEqual(provider.reviseReport(first.id, patch, options), revised)
  assert.throws(() => provider.reviseReport(first.id, { progres: 27 }, options), codeError('CONFLICT'))
})

test('accepted corrections require a fresh reason and never overwrite accepted snapshots', () => {
  const { provider } = fixture()
  const first = accept(provider, provider.submitReport(payload({ progres: 30 })))
  const before = provider.getState().reports[0]
  assert.throws(() => provider.reviseReport(first.id, { progres: 28 }, { expectedVersion: first.version }), codeError('VALIDATION'))
  const corrected = provider.reviseReport(first.id, { progres: 28, reason: 'Koreksi volume berdasarkan pemeriksaan ilustratif.' }, { expectedVersion: first.version })
  assert.equal(provider.getProgress('GSW-12', { packageId: PKG }).verified, 30)
  const accepted = accept(provider, corrected)
  assert.equal(provider.getProgress('GSW-12', { packageId: PKG }).verified, 28)
  assert.deepEqual(provider.getState().reports[0].revisions[0], before.revisions[0])
  assert.deepEqual(provider.getState().reports[0].decisions[0], before.decisions[0])
  assert.equal(accepted.decisions[1].previousDecisionId, accepted.decisions[0].decisionId)
  assert.throws(() => provider.reviseReport(first.id, { progres: 27 }, { expectedVersion: accepted.version }), codeError('VALIDATION'))
})

test('revision cannot move a report to another date or package, nor impersonate another author', () => {
  const { provider } = fixture()
  const report = provider.submitReport(payload())
  for (const patch of [{ tanggal: addDays(TODAY, -1) }, { packageId: PKG2 }]) assert.throws(() => provider.reviseReport(report.id, patch, { expectedVersion: report.version }), codeError('VALIDATION'))
  const changed = provider.reviseReport(report.id, { progres: 26, createdBy: 'spoofed', status: 'DITERIMA', version: 999, receivedAt: '2000-01-01T00:00:00Z' }, { expectedVersion: report.version })
  assert.equal(changed.createdBy, CONTRACTOR.id)
  assert.equal(changed.reviewState, 'submitted')
  assert.equal(changed.version, 2)
  assert.equal(changed.receivedAt, '2026-11-06T14:00:00.000Z')
})

test('effective verified progress uses work date and accepted corrections, not historical maximum or upload order', () => {
  const { provider } = fixture()
  accept(provider, provider.submitReport(payload({ tanggal: addDays(TODAY, -2), progres: 30 })))
  accept(provider, provider.submitReport(payload({ tanggal: addDays(TODAY, -1), progres: 28, reason: 'Koreksi progres menurun yang diterima untuk monitoring demo.' })))
  const backdated = provider.submitReport(payload({ tanggal: addDays(TODAY, -3), progres: 80 }))
  accept(provider, backdated)
  const pending = provider.submitReport(payload({ progres: 31 }))
  const actual = provider.getProgress('GSW-12', { packageId: PKG })
  assert.equal(actual.reported, pending.progres)
  assert.equal(actual.verified, 28)
  assert.equal(actual.source.workDate, addDays(TODAY, -1))
  assert.equal(actual.baseline, null)
  assert.equal(actual.deviation, null)
  assert.equal(provider.getProgress('GSW-12').verified, null)
  assert.equal(provider.getProgress('GSW-12').source.aggregation, 'unavailable-multiple-packages')
})

test('unknown progress/baseline is null, seed project progress remains explicitly separate', () => {
  const { provider } = fixture()
  const actual = provider.getProgress('NCICD-A-03')
  assert.equal(actual.verified, null)
  assert.equal(actual.reported, null)
  assert.equal(actual.baseline, null)
  assert.equal(actual.deviation, null)
  assert.equal(provider.getProjects({ kode: 'NCICD-A-03' })[0].progres, projectsSeed.find((p) => p.kode === 'NCICD-A-03').progres)
  assert.throws(() => provider.getProgress('GSW-12', { packageId: 'package:GSW-13:01' }), codeError('VALIDATION'))
})

test('compliance treats before/exact/after proposed WIB cutoff deterministically and inclusively', () => {
  const { provider } = fixture()
  const get = (asOf) => provider.getCompliance({ date: TODAY, asOf, filters: { packageId: PKG } })[0]
  assert.equal(get('2026-11-06T12:59:59.999Z').deliveryStatus, 'not-due')
  assert.equal(get('2026-11-06T13:00:00Z').deliveryStatus, 'not-due')
  assert.equal(get('2026-11-06T13:00:00.001Z').deliveryStatus, 'missing')
  assert.match(get('2026-11-06T14:00:00Z').policyLabel, /20\.00 WIB/)
  assert.equal(get('2026-11-06T14:00:00Z').illustrative, true)
  assert.equal(provider.getCompliance({ date: addDays(TODAY, 1) })[0].deliveryStatus, 'not-due')
})

test('delivered pending and needs-revision satisfy submission, exactly at cutoff is on-time', () => {
  const { provider, setNow } = fixture({ now: '2026-11-06T13:00:00Z' })
  const report = provider.submitReport(payload())
  const get = () => provider.getCompliance({ date: TODAY, filters: { packageId: PKG } })[0]
  assert.equal(get().deliveryStatus, 'on-time')
  assert.equal(get().reviewState, 'submitted')
  provider.decideReport(report.id, { action: 'needs-revision', reason: 'Volume perlu diperiksa kembali oleh pelapor.', expectedVersion: report.version })
  setNow('2026-11-06T14:00:00Z')
  assert.equal(get().deliveryStatus, 'on-time')
  assert.equal(get().reviewState, 'needs-revision')
})

test('late delivery remains late after review, and historical asOf does not see future delivery/decision', () => {
  const { provider, setNow } = fixture({ now: '2026-11-06T13:00:00.001Z' })
  const report = provider.submitReport(payload())
  const get = (asOf) => provider.getCompliance({ date: TODAY, asOf, filters: { packageId: PKG } })[0]
  assert.equal(get('2026-11-06T13:00:00Z').deliveryStatus, 'not-due')
  assert.equal(get('2026-11-06T13:30:00Z').deliveryStatus, 'late')
  assert.equal(get('2026-11-06T13:30:00Z').reviewState, 'submitted')
  setNow('2026-11-06T14:00:00Z')
  accept(provider, report)
  assert.equal(get('2026-11-06T13:30:00Z').reviewState, 'submitted')
  assert.equal(get('2026-11-06T14:00:00Z').reviewState, 'accepted')
  assert.equal(get('2026-11-06T14:00:00Z').deliveryStatus, 'late')
})

test('an offline correction cannot erase an earlier acknowledged submission', () => {
  const { provider, setNow } = fixture({ now: '2026-11-06T12:00:00Z' })
  const report = provider.submitReport(payload())
  setNow('2026-11-06T14:00:00Z')
  provider.reviseReport(report.id, { delivery: 'queued', progres: 24 }, { expectedVersion: report.version })
  const compliance = provider.getCompliance({ date: TODAY, filters: { packageId: PKG } })[0]
  assert.equal(compliance.deliveryStatus, 'on-time')
  assert.equal(compliance.receivedAt, '2026-11-06T12:00:00.000Z')
  assert.equal(compliance.reviewState, 'submitted')
})

test('compliance excludes inactive, completed, nonworking and excepted packages rather than inventing duties', () => {
  const customized = copy(contractorSeed)
  customized.paket[0].activeFrom = '2026-11-07'
  customized.paket[1].activeTo = '2026-11-05'
  customized.paket[2].excludedDates = [TODAY]
  const { provider } = fixture({ contractor: customized })
  assert.equal(provider.getCompliance({ date: TODAY }).some((r) => r.packageId === PKG), false)
  assert.equal(provider.getCompliance({ date: TODAY }).some((r) => r.packageId === 'package:NCICD-A-03:01'), false)
  assert.equal(provider.getCompliance({ date: TODAY }).some((r) => r.packageId === 'package:TOL-SMD-01:01'), false)
  const { provider: weekend } = fixture({ contractor: { ...contractorSeed, paket: contractorSeed.paket.map((p) => ({ ...p, workingDays: [0] })) } })
  assert.equal(weekend.getCompliance({ date: TODAY }).some((r) => r.packageId === PKG), false)
  const completed = copy(projectsSeed); completed.find((p) => p.kode === 'GSW-12').tahap = 'Selesai'
  const { provider: done } = fixture({ projects: completed })
  assert.equal(done.getCompliance({ date: TODAY }).some((r) => r.kode === 'GSW-12'), false)
})

test('follow-ups append actor/date/package history locally without external notifications', () => {
  const { provider } = fixture()
  const first = provider.addFollowUp(PKG, TODAY, 'Tindak lanjut melalui simulasi lokal.')
  const snapshot = copy(first)
  const second = provider.addFollowUp(PKG, TODAY, 'Catatan kedua tanpa pesan eksternal.')
  assert.notEqual(first.id, second.id)
  first.note = 'mutated'
  const compliance = provider.getCompliance({ date: TODAY, filters: { packageId: PKG } })[0]
  assert.equal(compliance.followUps.length, 2)
  assert.deepEqual(compliance.followUps[0], snapshot)
  assert.equal(snapshot.externalNotification, false)
  assert.equal(snapshot.actor.id, REVIEWER.id)
  assert.throws(() => provider.addFollowUp(PKG, TODAY, '   '), codeError('VALIDATION'))
  assert.throws(() => provider.addFollowUp(PKG, TODAY, 'Outside scope', { actor: { ...REVIEWER, projectCodes: [] } }), codeError('FORBIDDEN'))
  assert.throws(() => provider.addFollowUp(PKG, TODAY, 'Contractor note', { actor: CONTRACTOR }), codeError('FORBIDDEN'))
})

test('snapshot is deeply frozen, scoped and stable across subsequent acceptance and master changes', () => {
  const { provider } = fixture()
  const report = provider.submitReport(payload())
  const snapshot = provider.createSnapshot({ kode: 'GSW-12', from: TODAY, to: TODAY })
  assert.equal(Object.isFrozen(snapshot), true)
  assert.equal(Object.isFrozen(snapshot.reports[0]), true)
  assert.equal(Object.isFrozen(snapshot.filters), true)
  assert.throws(() => { snapshot.reports[0].progres = 999 }, TypeError)
  const serialized = JSON.stringify(snapshot)
  accept(provider, report)
  const changed = provider.getProjects(); changed[0].nama = 'Nama proyek berubah melalui demo impor'
  provider.commitImport(provider.previewImport(changed))
  assert.equal(JSON.stringify(snapshot), serialized)
  assert.equal(snapshot.reports[0].status, 'MENUNGGU')
  assert.equal(provider.createSnapshot({ kode: 'GSW-12', status: 'DITERIMA' }).reports[0].status, 'DITERIMA')
  assert.notEqual(provider.createSnapshot({ kode: 'GSW-12' }).snapshotId, snapshot.snapshotId)
  assert.throws(() => provider.createSnapshot({ from: TODAY, to: addDays(TODAY, -1) }), codeError('VALIDATION'))
})

test('snapshot search and period/status filters do not include unrelated project totals', () => {
  const { provider } = fixture()
  const report = provider.submitReport(payload({ uraian: 'Uraian unik untuk pencarian quartz di laporan.' }))
  const snapshot = provider.createSnapshot({ q: 'quartz' })
  assert.deepEqual(snapshot.projects.map((p) => p.kode), ['GSW-12'])
  assert.deepEqual(snapshot.reports.map((r) => r.id), [report.id])
  assert.deepEqual(provider.createSnapshot({ status: 'DITERIMA' }).projects, [])
  assert.deepEqual(provider.createSnapshot({ from: addDays(TODAY, -2), to: addDays(TODAY, -1) }).reports, [])
})

test('valid import preview is nonmutating, versioned and commits atomically with provenance', () => {
  const { provider } = fixture()
  const rows = provider.getProjects()
  rows[0].nama = 'Nama baru dari impor ilustratif'
  rows.push(newProject())
  const before = provider.getState()
  const preview = provider.previewImport(rows)
  assert.equal(preview.valid, true)
  assert.equal(preview.baseVersion, before.masterVersion)
  assert.equal(preview.mappingVersion, IMPORT_MAPPING_VERSION)
  assert.match(preview.sourceHash, /^fnv1a64:/)
  assert.equal(preview.summary.added, 1)
  assert.equal(preview.summary.changed, 1)
  assert.deepEqual(provider.getState(), before)
  const result = provider.commitImport(preview)
  assert.equal(result.length, projectsSeed.length + 1)
  assert.equal(provider.getProjects()[0].nama, rows[0].nama)
  assert.equal(provider.getState().masterVersion, before.masterVersion + 1)
  assert.equal(provider.getState().importHistory.length, 1)
  assert.equal(provider.getProjects()[0].provenance.sourceHash, preview.sourceHash)
  assert.equal(provider.getPackages({ kode: 'DEMO-NEW' }).length, 1)
  assert.equal(provider.getProjects().every((p) => p.illustrative), true)
})

test('invalid duplicate, numeric, coordinates and foreign-key imports reject the entire batch', () => {
  const { provider } = fixture()
  const before = provider.getState()
  const changes = [
    (rows) => rows.push(copy(rows[0])),
    ...[null, undefined, '106.15', true, [], {}, NaN, Infinity].map((value) => (rows) => { rows[0].lng = value }),
    (rows) => { rows[0].lat = -91 }, (rows) => { rows[0].lat = 45 }, (rows) => { rows[0].lng = 181 },
    (rows) => { rows[0].progres = '10' }, (rows) => { rows[0].projectId = 'project:OTHER' },
    (rows) => { rows[0].provinsi = 'Jawa Tengah' }, (rows) => { rows[0].packageId = PKG },
    (rows) => { rows[0].archived = true }, (rows) => { rows.shift() },
  ]
  for (const mutate of changes) {
    const rows = provider.getProjects(); mutate(rows)
    const preview = provider.previewImport(rows)
    assert.equal(preview.valid, false)
    assert.equal(preview.errors.length > 0, true)
    assert.throws(() => provider.commitImport(preview), codeError('VALIDATION'))
    assert.deepEqual(provider.getState(), before)
  }
})

test('imports cannot alter package/project identities or archive referenced reports/catalogs', () => {
  const { provider } = fixture({ reports: reportsSeed })
  provider.saveCatalog('references', [{ id: 'ref-demo', projectId: 'project:GSW-01' }])
  const rows = provider.getProjects()
  rows.find((p) => p.kode === 'GSW-12').archived = true
  rows.find((p) => p.kode === 'GSW-01').archived = true
  const preview = provider.previewImport(rows)
  assert.equal(preview.valid, false)
  assert.equal(preview.errors.filter((e) => e.code === 'REFERENCED').length, 2)
  const moved = provider.getProjects(); moved.find((p) => p.kode === 'GSW-12').kode = 'GSW-NEW'
  assert.equal(provider.previewImport(moved).valid, false)
  assert.equal(provider.getReport('L-0897').kode, 'GSW-12')
})

test('commit revalidates rows, hashes, issued preview, actor and base version rather than trusting valid=true', () => {
  const { provider } = fixture()
  const preview = provider.previewImport(provider.getProjects())
  const tampered = copy(preview); tampered.rows[0].nama = 'Tampered after preview'
  assert.throws(() => provider.commitImport(tampered), codeError('CONFLICT'))
  const invalid = copy(preview); invalid.rows[0].lng = '106'
  assert.throws(() => provider.commitImport(invalid), codeError('VALIDATION'))
  assert.throws(() => provider.commitImport({ ...preview, previewId: 'invented' }), codeError('CONFLICT'))
  assert.throws(() => provider.commitImport({ ...preview, sourceHash: 'fake' }), codeError('CONFLICT'))
  assert.throws(() => provider.commitImport({ ...preview, mappingVersion: 'v0' }), codeError('CONFLICT'))
  assert.throws(() => provider.commitImport(preview, { actor: { ...ADMIN, id: 'other-admin' } }), codeError('CONFLICT'))
  assert.throws(() => provider.previewImport(provider.getProjects(), { actor: REVIEWER }), codeError('FORBIDDEN'))
  assert.throws(() => provider.previewImport(provider.getProjects(), { actor: { ...ADMIN, projectCodes: ['GSW-01'] } }), codeError('FORBIDDEN'))
  provider.commitImport(preview)
  assert.throws(() => provider.commitImport(preview), codeError('CONFLICT'))
})

test('rollback is a reasoned versioned compensation, preserves reports and refuses duplicate/stale rollback', () => {
  const { provider } = fixture({ reports: reportsSeed })
  const before = provider.getState()
  const rows = provider.getProjects(); rows[0].nama = 'Demo change'; rows.push(newProject())
  provider.commitImport(provider.previewImport(rows))
  const batch = provider.getState().importHistory.at(-1)
  assert.throws(() => provider.rollbackImport(batch.batchId, {}), codeError('VALIDATION'))
  assert.throws(() => provider.rollbackImport(batch.batchId, { reason: 'Compensation', expectedVersion: 1 }), codeError('CONFLICT'))
  provider.rollbackImport(batch.batchId, { reason: 'Kompensasi perubahan demo yang keliru.', expectedVersion: 2 })
  assert.deepEqual(provider.getProjects(), before.projects)
  assert.deepEqual(provider.getState().reports, before.reports)
  assert.equal(provider.getState().masterVersion, 3)
  assert.equal(provider.getState().importHistory.length, 2)
  assert.equal(provider.getState().importHistory.at(-1).compensates, batch.batchId)
  assert.throws(() => provider.rollbackImport(batch.batchId, { reason: 'Again' }), codeError('CONFLICT'))
})

test('rollback will not orphan newly reported, followed-up or referenced imported projects', () => {
  for (const relation of ['report', 'catalog', 'follow-up']) {
    const { provider } = fixture()
    const rows = provider.getProjects(); rows.push(newProject())
    provider.commitImport(provider.previewImport(rows))
    const batch = provider.getState().importHistory.at(-1)
    const actor = { ...REVIEWER, projectCodes: [...ALL, 'DEMO-NEW'] }
    if (relation === 'report') provider.submitReport(payload({ kode: 'DEMO-NEW', packageId: 'package:DEMO-NEW:01' }), { actor })
    else if (relation === 'catalog') provider.saveCatalog('references', [{ projectCodes: ['DEMO-NEW'] }])
    else provider.addFollowUp('package:DEMO-NEW:01', TODAY, 'Imported project follow-up.', { actor })
    const before = provider.getState()
    assert.throws(() => provider.rollbackImport(batch.batchId, { reason: 'May not orphan references.' }), codeError('CONFLICT'))
    assert.deepEqual(provider.getState(), before)
  }
})

test('catalog seams clone, restrict kinds and preserve the other current collection', () => {
  const { provider } = fixture()
  const knowledge = [{ id: 'km-1', versions: [{ isi: 'Teks pengetahuan ilustratif.' }] }]
  provider.saveCatalog('knowledge', knowledge)
  knowledge[0].versions[0].isi = 'mutated'
  provider.saveCatalog('references', [{ id: 'ref-1' }])
  assert.equal(provider.getCatalog('knowledge')[0].versions[0].isi, 'Teks pengetahuan ilustratif.')
  const references = provider.getCatalog('references'); references[0].id = 'mutated'
  assert.equal(provider.getCatalog('references')[0].id, 'ref-1')
  assert.throws(() => provider.getCatalog('reports'), codeError('VALIDATION'))
  assert.throws(() => provider.saveCatalog('__proto__', []), codeError('VALIDATION'))
  assert.throws(() => provider.saveCatalog('knowledge', {}), codeError('VALIDATION'))
})

test('photo binaries, data URLs and fabricated geotag claims do not leak into session state', () => {
  const storage = memoryStorage()
  const { provider } = fixture({ storage })
  for (const patch of [{ fotoIds: [{ id: 'x', blob: 'binary' }] }, { evidenceRefs: [{ id: 'x', dataUrl: 'data:image/jpeg;base64,abc' }] }, { fotoIds: ['data:image/jpeg;base64,abc'] }, { photoData: 'data:image/jpeg;base64,abc' }]) assert.throws(() => provider.submitReport(payload(patch)), codeError('VALIDATION'))
  assert.throws(() => provider.saveCatalog('knowledge', [{ blob: 'binary' }]), codeError('VALIDATION'))
  const report = provider.submitReport(payload({ evidenceRefs: [{ id: 'photo-one', expiresAt: '2026-11-06T14:05:00Z' }] }))
  assert.equal(report.evidenceAvailability, 'unavailable')
  assert.equal('geotagVerified' in report, false)
  const saved = storage.data.get(STORAGE_KEY)
  assert.equal(saved.includes('data:image/'), false)
  assert.equal(saved.includes('blob'), false)
  assert.equal(saved.includes('photo-one'), true)
})

test('photo metadata expires without changing content or extending the existing five-minute lifetime', () => {
  const { provider, setNow } = fixture()
  const report = provider.submitReport(payload({ fotoIds: [{ id: 'photo-ttl', expiresAt: Date.parse('2026-11-06T14:05:00Z') }] }))
  assert.equal(report.evidenceAvailability, 'unavailable')
  const before = provider.getState().reports[0].revisions[0]
  setNow('2026-11-06T14:05:00Z')
  assert.equal(provider.getReport(report.id).evidenceAvailability, 'expired')
  assert.deepEqual(provider.getState().reports[0].revisions[0], before)
})

test('same-tab subscriptions emit only committed local changes and isolate faulty listeners', () => {
  const { provider } = fixture()
  const events = []
  const unsubscribe = provider.subscribe((event) => events.push(event))
  provider.subscribe(() => { throw new Error('Consumer failed') })
  const report = provider.submitReport(payload(), { idempotencyKey: 'event-once' })
  provider.submitReport(payload(), { idempotencyKey: 'event-once' })
  assert.equal(events.length, 1)
  assert.equal(events[0].localOnly, true)
  assert.equal(Object.isFrozen(events[0]), true)
  provider.previewImport(provider.getProjects())
  assert.equal(events.length, 1)
  unsubscribe()
  accept(provider, report)
  assert.equal(events.length, 1)
})

test('session persistence restores revisions, decisions, catalog seams and idempotent receipts', () => {
  const storage = memoryStorage({ unrelated: 'preserve-me' })
  const { provider } = fixture({ storage })
  const original = provider.submitReport(payload(), { idempotencyKey: 'persist-submit' })
  const accepted = accept(provider, original, { idempotencyKey: 'persist-decision' })
  provider.saveCatalog('references', [{ id: 'preserved-reference' }])
  const { provider: restored } = fixture({ storage })
  assert.deepEqual(restored.getReport(original.id), accepted)
  assert.deepEqual(restored.submitReport(payload(), { idempotencyKey: 'persist-submit' }), original)
  assert.equal(restored.getCatalog('references')[0].id, 'preserved-reference')
  assert.equal(restored.getState().persistence.status, 'ready')
  assert.equal(storage.getItem('unrelated'), 'preserve-me')
})

test('corrupt session storage recovers explicitly, with no service-error fallback or exception on import', () => {
  for (const raw of ['{invalid', 'null', '{}', JSON.stringify({ schemaVersion: 99 }), JSON.stringify({ schemaVersion: 1, masterVersion: 1, sequence: 0, projects: [], packages: [], reports: [], followUps: [], idempotency: [], importHistory: [], catalogs: { references: [], knowledge: [] } })]) {
    const storage = memoryStorage({ [STORAGE_KEY]: raw })
    const { provider } = fixture({ storage, reports: reportsSeed })
    assert.equal(provider.getProjects().length, projectsSeed.length)
    assert.equal(provider.getReports().length, reportsSeed.length)
    assert.equal(provider.getState().persistence.status, 'recovered')
    assert.match(provider.getState().persistence.warning, /tidak dapat dibaca/)
  }
})

test('storage failure rejects the mutation without fake success, state loss or emitted events', () => {
  const storage = memoryStorage()
  const { provider } = fixture({ storage })
  const events = []; provider.subscribe((event) => events.push(event))
  storage.setItem = () => { throw new Error('Quota exceeded') }
  assert.throws(() => provider.submitReport(payload()), codeError('STORAGE_UNAVAILABLE'))
  assert.equal(provider.getReports().length, 0)
  assert.equal(events.length, 0)
  assert.equal(provider.getState().sequence, 0)
  assert.equal(provider.getState().persistence.status, 'failed')
  const preview = provider.previewImport(provider.getProjects())
  assert.throws(() => provider.commitImport(preview), codeError('STORAGE_UNAVAILABLE'))
  assert.equal(provider.getState().masterVersion, 1)
  assert.equal(provider.getState().importHistory.length, 0)
})

test('memory-only capability boundaries and reset never erase unrelated browser session keys', () => {
  const storage = memoryStorage({ unrelated: 'preserve-me' })
  const { provider } = fixture({ storage })
  provider.submitReport(payload())
  provider.reset()
  assert.equal(provider.getReports().length, 0)
  assert.equal(storage.getItem('unrelated'), 'preserve-me')
  const { provider: memory } = fixture()
  assert.equal(memory.getState().persistence.mode, 'memory')
  assert.equal(memory.capabilities.production, false)
  assert.equal(memory.capabilities.permanentEvidence, false)
  assert.equal(memory.capabilities.crossUserSync, false)
  assert.equal(memory.capabilities.externalNotifications, false)
  assert.equal(memory.capabilities.prasarana, false)
})
