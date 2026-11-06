export const DEMO_LABEL = 'Data ilustratif — simulasi lokal, bukan data resmi BOPPJ'
export const POLICY_LABEL = 'Batas kirim laporan: 20.00 WIB (Asia/Jakarta)'
export const STORAGE_KEY = 'pmo.demo.domain.v1'
export const IMPORT_MAPPING_VERSION = 'boppj-projects-v1'
const SCHEMA_VERSION = 1
const DAY = 86400000
const PHASES = new Set(['Asesmen', 'Master Plan', 'Pra-Konstruksi', 'Konstruksi', 'Selesai'])
const PROJECT_FIELDS = ['kode', 'nama', 'kelompok', 'kabupaten', 'provinsi', 'lat', 'lng', 'tahap', 'progres']
const clone = (value) => structuredClone(value)
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key)
const plain = (value) => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype

export class DomainError extends Error {
  constructor(code, message, fieldErrors = {}) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

const fail = (code, message, fields) => { throw new DomainError(code, message, fields) }
const invalid = (field, message) => fail('VALIDATION', message, { [field]: message })

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

function instant(value, field = 'asOf') {
  if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') invalid(field, 'Waktu tidak valid.')
  if (typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) invalid(field, 'Gunakan waktu ISO dengan zona waktu.')
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) invalid(field, 'Waktu tidak valid.')
  if (typeof value === 'string') workDate(value.slice(0, 10), field)
  return d.toISOString()
}

export function businessDate(value = new Date()) {
  return new Date(new Date(instant(value)).getTime() + 7 * 3600000).toISOString().slice(0, 10)
}

export function workDate(value, field = 'tanggal') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid(field, 'Tanggal harus YYYY-MM-DD.')
  const date = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) invalid(field, 'Tanggal kalender tidak valid.')
  return value
}

export function addDays(date, offset) {
  workDate(date)
  if (!Number.isInteger(offset)) invalid('offset', 'Offset tanggal harus bilangan bulat.')
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + offset * DAY).toISOString().slice(0, 10)
}

export function cutOffFor(date) {
  return `${workDate(date)}T20:00:00+07:00`
}

function text(value, field, { required = false, min = 0, max = 2000 } = {}) {
  if (value == null && !required) return null
  if (typeof value !== 'string') invalid(field, `${field} harus berupa teks.`)
  const result = value.trim()
  if (result.length < (required ? Math.max(1, min) : min) || result.length > max) invalid(field, `${field} harus ${required ? Math.max(1, min) : min}–${max} karakter.`)
  return result || null
}

function number(value, field, { min = 0, max = Infinity, integer = false, required = true } = {}) {
  if (value == null && !required) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) invalid(field, `${field} harus angka ${integer ? 'bulat ' : ''}dalam rentang yang valid.`)
  return value
}

function jsonData(value, path = 'data') {
  if (typeof value === 'string') {
    if (/data:image\//i.test(value)) invalid(path, 'Konten foto tidak boleh disimpan di sessionStorage.')
    return value
  }
  if (value === null || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value)) return value.map((v, i) => jsonData(v, `${path}.${i}`))
  if (plain(value)) {
    const result = {}
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype', 'blob', 'base64', 'dataUrl', 'photoData'].includes(key)) invalid(path, 'Konten biner atau properti tidak aman tidak diizinkan.')
      if (item !== undefined) result[key] = jsonData(item, `${path}.${key}`)
    }
    return result
  }
  invalid(path, 'Data harus berupa nilai JSON biasa dan angka finite.')
}

const canonical = (value) => JSON.stringify(value, (_, v) => plain(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v)
function hash(value) {
  let result = 0xcbf29ce484222325n
  for (const byte of new TextEncoder().encode(canonical(value))) result = BigInt.asUintN(64, (result ^ BigInt(byte)) * 0x100000001b3n)
  return `fnv1a64:${result.toString(16).padStart(16, '0')}`
}
const searchText = (value) => String(value ?? '').normalize('NFKC').toLocaleLowerCase('id-ID')
const matches = (value, query) => !query || query === 'all' || value === query

export function createDemoProvider({ projects = [], reports = [], contractor = {}, knowledge = [], storage = null, now = () => new Date() } = {}) {
  const clock = () => instant(typeof now === 'function' ? now() : now, 'now')
  const initialTime = clock()
  const initialDate = businessDate(initialTime)
  const originalProjects = jsonData(projects)
  const contractorData = jsonData(contractor)
  const assignments = contractorData.paket ?? []
  if (!Array.isArray(originalProjects) || !Array.isArray(assignments)) invalid('projects', 'Master dan penugasan harus berupa daftar.')
  const knownRegions = new Set(originalProjects.map((p) => `${p.provinsi}\u0000${p.kabupaten}`))
  const knownGroups = new Set(originalProjects.map((p) => p.kelompok))
  const subscribers = new Set()
  const previews = new Map()
  let previewSequence = 0
  let persistence = { mode: storage ? 'session' : 'memory', status: storage ? 'ready' : 'memory-only', warning: null }

  function projectRows(rows, current = []) {
    const errors = []
    const normalized = []
    const seen = new Set()
    if (!Array.isArray(rows) || !rows.length) return { errors: [{ row: 0, field: 'rows', code: 'VALIDATION', message: 'Impor memerlukan sedikitnya satu proyek.' }], rows: [] }
    rows.forEach((row, index) => {
      const error = (field, message, code = 'VALIDATION') => errors.push({ row: index + 1, field, code, message })
      if (!plain(row)) { error('row', 'Baris harus berupa objek biasa.'); return }
      const p = {}
      for (const field of PROJECT_FIELDS) p[field] = row[field]
      for (const field of ['kode', 'nama', 'kelompok', 'kabupaten', 'provinsi', 'tahap']) {
        if (typeof p[field] !== 'string' || !p[field].trim() || p[field].length > 300) error(field, `${field} wajib berupa teks.`)
      }
      if (typeof p.kode !== 'string' || !/^[A-Z0-9][A-Z0-9-]{0,63}$/.test(p.kode)) error('kode', 'Kode proyek tidak valid.')
      if (seen.has(p.kode)) error('kode', 'Kode proyek duplikat.', 'DUPLICATE')
      seen.add(p.kode)
      if (typeof p.lat !== 'number' || !Number.isFinite(p.lat) || p.lat < -11 || p.lat > 6.5) error('lat', 'Latitude harus angka WGS84 di Indonesia (−11 sampai 6,5).')
      if (typeof p.lng !== 'number' || !Number.isFinite(p.lng) || p.lng < 95 || p.lng > 141) error('lng', 'Longitude harus angka WGS84 di Indonesia (95 sampai 141).')
      if (typeof p.progres !== 'number' || !Number.isFinite(p.progres) || p.progres < 0 || p.progres > 100) error('progres', 'Progres harus angka finite 0–100.')
      if (!PHASES.has(p.tahap)) error('tahap', 'Tahap tidak dikenal.')
      if (knownRegions.size && (typeof p.provinsi !== 'string' || typeof p.kabupaten !== 'string' || !knownRegions.has(`${p.provinsi}\u0000${p.kabupaten}`))) error('kabupaten', 'Relasi provinsi/kabupaten belum terdaftar pada master demo.', 'FOREIGN_KEY')
      if (knownGroups.size && !knownGroups.has(p.kelompok)) error('kelompok', 'Kelompok belum terdaftar pada master demo.', 'FOREIGN_KEY')
      const projectId = `project:${typeof p.kode === 'string' ? p.kode : 'invalid'}`
      if (row.projectId !== undefined && row.projectId !== projectId) error('projectId', 'Identitas proyek tidak boleh dipetakan ulang.', 'FOREIGN_KEY')
      if (['packageId', 'packageIds', 'packages', 'contractorId'].some((key) => own(row, key))) error('packageId', 'Impor proyek tidak boleh mengubah relasi paket/penugasan.', 'FOREIGN_KEY')
      if (row.archived !== undefined && typeof row.archived !== 'boolean') error('archived', 'Status arsip harus boolean.')
      const previous = current.find((item) => item.kode === p.kode)
      for (const field of PROJECT_FIELDS) if ((['lat', 'lng', 'progres'].includes(field) && (typeof p[field] !== 'number' || !Number.isFinite(p[field]))) || (!['lat', 'lng', 'progres'].includes(field) && typeof p[field] !== 'string')) p[field] = null
      normalized.push({ ...p, projectId, illustrative: true, archived: typeof row.archived === 'boolean' ? row.archived : previous?.archived ?? false, provenance: clone(previous?.provenance ?? { source: 'src/data/proyek.json', asOf: null, retrievedAt: initialTime, validator: null, verificationStatus: 'illustrative-unverified' }) })
    })
    return { errors, rows: normalized }
  }

  const seedMaster = projectRows(originalProjects)
  if (originalProjects.length && seedMaster.errors.length) fail('VALIDATION', 'Seed proyek tidak valid.', { projects: seedMaster.errors })
  const seedProjects = seedMaster.rows
  const multiPackageCode = assignments.find((a) => seedProjects.some((p) => p.kode === a.kode))?.kode ?? seedProjects[0]?.kode

  function makePackage(project, index = '01', assignment) {
    return {
      ...clone(assignment ?? {}), packageId: `package:${project.kode}:${index}`, projectId: project.projectId, kode: project.kode,
      packageCode: index === '01' ? assignment?.kontrak ?? `${project.kode}-P01` : `${project.kode}-P${index}`,
      nama: index === '01' ? `Paket ${project.kode}` : `Paket ${index} ${project.kode} — ilustratif`,
      contractorId: assignment ? 'contractor-demo' : null, kontraktor: assignment ? contractorData.pengguna?.perusahaan ?? null : null,
      activeFrom: assignment?.activeFrom ?? (assignment || index !== '01' ? addDays(initialDate, -30) : null), activeTo: assignment?.activeTo ?? null,
      reportingRequired: assignment?.reportingRequired ?? Boolean(assignment || index !== '01'), workingDays: clone(assignment?.workingDays ?? [0, 1, 2, 3, 4, 5, 6]),
      excludedDates: clone(assignment?.excludedDates ?? []), pic: assignment ? contractorData.pengguna?.nama ?? null : null,
      illustrative: true, provenance: { source: assignment ? 'src/data/kontraktor.json' : 'fixture paket demo; bukan penugasan resmi', verificationStatus: 'illustrative-unverified' },
    }
  }

  const seedPackages = seedProjects.flatMap((project) => {
    const result = [makePackage(project, '01', assignments.find((a) => a.kode === project.kode))]
    if (project.kode === multiPackageCode) result.push(makePackage(project, '02'))
    return result
  })
  let state = { schemaVersion: SCHEMA_VERSION, masterVersion: 1, sequence: 0, projects: seedProjects, packages: seedPackages, reports: [], followUps: [], catalogs: { references: [], knowledge: jsonData(knowledge) }, idempotency: [], importHistory: [] }

  const defaultReviewer = () => ({ id: 'reviewer-demo', role: 'reviewer', projectCodes: state.projects.map((p) => p.kode) })
  const defaultAdmin = () => ({ id: 'admin-demo', role: 'admin', projectCodes: state.projects.map((p) => p.kode) })
  const defaultContractor = () => ({ id: 'contractor-demo', role: 'contractor', projectCodes: assignments.map((p) => p.kode) })

  function actorValid(actor) {
    if (!plain(actor) || typeof actor.id !== 'string' || !actor.id.trim() || !['reviewer', 'admin', 'contractor', 'head', 'partner'].includes(actor.role) || !Array.isArray(actor.projectCodes) || actor.projectCodes.some((v) => typeof v !== 'string')) fail('FORBIDDEN', 'Aktor dan cakupan penugasan demo diperlukan.')
    return actor
  }
  function projectAllowed(actor, project) {
    actorValid(actor)
    if (!actor.projectCodes.includes(project.kode)) return false
    if (actor.role !== 'contractor' && actor.packageIds === undefined) return true
    return state.packages.some((p) => p.kode === project.kode && packageAllowed(actor, p))
  }
  function packageAllowed(actor, pkg) {
    actorValid(actor)
    if (!pkg || !actor.projectCodes.includes(pkg.kode) || (actor.packageIds !== undefined && (!Array.isArray(actor.packageIds) || !actor.packageIds.includes(pkg.packageId)))) return false
    return actor.role !== 'contractor' || pkg.contractorId === (actor.contractorId ?? actor.id)
  }
  const requirePackage = (actor, pkg) => { if (!pkg || !packageAllowed(actor, pkg)) fail('FORBIDDEN', 'Paket di luar cakupan penugasan demo.') }
  function requireWrite(actor) {
    actorValid(actor)
    if (!['contractor', 'reviewer', 'admin'].includes(actor.role)) fail('FORBIDDEN', 'Peran ini hanya dapat membaca.')
  }
  function requireReviewer(actor) {
    actorValid(actor)
    if (actor.role !== 'reviewer' && !(actor.role === 'admin' && actor.canReview === true)) fail('FORBIDDEN', 'Peran reviewer yang ditugaskan diperlukan; admin teknis tidak otomatis berwenang.')
  }
  function requireAdmin(actor) {
    actorValid(actor)
    if (actor.role !== 'admin' || state.projects.some((p) => !actor.projectCodes.includes(p.kode))) fail('FORBIDDEN', 'Impor seluruh master memerlukan admin dengan cakupan seluruh master demo.')
  }
  function reportFor(id, actor) {
    actorValid(actor)
    const report = state.reports.find((r) => r.reportId === id || r.revisions.some((v) => v.revisionId === id))
    if (!report) fail('NOT_FOUND', 'Laporan tidak ditemukan.')
    requirePackage(actor, state.packages.find((p) => p.packageId === report.packageId))
    return report
  }
  function evidenceRefs(payload) {
    const raw = payload.evidenceRefs ?? payload.fotoIds ?? []
    if (!Array.isArray(raw) || raw.length > 10) invalid('evidenceRefs', 'Maksimal sepuluh referensi foto, tanpa konten foto.')
    return raw.map((ref) => {
      const item = typeof ref === 'string' ? { id: ref } : ref
      if (!plain(item) || Object.keys(item).some((key) => !['id', 'evidenceId', 'expiresAt', 'url'].includes(key))) invalid('evidenceRefs', 'Simpan hanya ID, waktu kedaluwarsa, atau berkas foto contoh.')
      const id = text(item.id ?? item.evidenceId, 'evidenceId', { required: true, max: 200 })
      const expiresAt = item.expiresAt == null ? null : instant(item.expiresAt, 'expiresAt')
      const url = item.url == null ? null : text(item.url, 'url', { max: 200 })
      if (url && !/^foto-demo\/[a-z0-9-]+\.jpg$/.test(url)) invalid('url', 'Berkas foto contoh hanya dari folder foto-demo.')
      return { id, expiresAt, url }
    })
  }
  function content(payload, { base, seed = false } = {}) {
    if (!plain(payload)) invalid('payload', 'Isi laporan harus berupa objek biasa.')
    jsonData(payload)
    const value = base ? { ...base, ...payload } : payload
    const kode = text(value.kode ?? value.projectCode ?? (typeof value.projectId === 'string' && value.projectId.startsWith('project:') ? value.projectId.slice(8) : null) ?? state.packages.find((p) => p.packageId === value.packageId)?.kode, 'kode', { required: true, max: 64 })
    const project = state.projects.find((p) => p.kode === kode)
    if (!project || project.archived) invalid('kode', 'Proyek master aktif tidak ditemukan.')
    const packageId = value.packageId ?? `package:${kode}:01`
    const pkg = state.packages.find((p) => p.packageId === packageId && p.kode === kode)
    if (!pkg) invalid('packageId', 'Paket tidak cocok dengan proyek master.')
    const tanggal = workDate(value.tanggal ?? value.workDate)
    if (!seed && (tanggal > businessDate(clock()) || tanggal < addDays(businessDate(clock()), -7))) invalid('tanggal', 'Laporan hanya untuk hari ini sampai tujuh hari sebelumnya (kebijakan demo existing).')
    if (!seed && ((pkg.activeFrom && tanggal < pkg.activeFrom) || (pkg.activeTo && tanggal > pkg.activeTo))) invalid('packageId', 'Tanggal di luar masa aktif paket demo.')
    const progres = number(value.progres ?? value.progressReported, 'progres', { max: 100 })
    if (Math.abs(progres * 100 - Math.round(progres * 100)) > 1e-8) invalid('progres', 'Progres maksimal dua angka desimal.')
    const delivery = own(payload, 'delivery') ? payload.delivery : own(payload, 'status') ? (payload.status === 'ANTRE' ? 'queued' : 'delivered') : base?.delivery ?? 'delivered'
    if (!['queued', 'delivered'].includes(delivery)) invalid('delivery', 'Status pengiriman demo tidak valid.')
    const reason = text(value.reason ?? value.alasanKoreksi, 'reason', { max: 2000 })
    return {
      kode, packageId, tanggal, progres, volume: number(value.volume ?? value.volumeDaily, 'volume', { required: false }),
      satuan: text(value.satuan, 'satuan', { max: 40 }), uraian: text(value.uraian, 'uraian', { required: true, min: 10, max: 2000 }),
      cuaca: text(value.cuaca, 'cuaca', { max: 100 }), tenaga: number(value.tenaga ?? value.tenagaKerja, 'tenaga', { max: 5000, integer: true, required: false }),
      delivery, reason, referenceVersionId: text(value.referenceVersionId, 'referenceVersionId', { max: 200 }),
      evidenceRefs: evidenceRefs(own(payload, 'fotoIds') && !own(payload, 'evidenceRefs') ? { fotoIds: payload.fotoIds } : value),
      foto: number(value.foto ?? (value.evidenceRefs ?? value.fotoIds ?? []).length, 'foto', { max: 10, integer: true }),
      itemMeasurements: jsonData(value.itemMeasurements ?? []), anomali: jsonData(value.anomali ?? []),
    }
  }
  function evidenceAvailability(revision, at = clock()) {
    const refs = revision.evidenceRefs
    if (refs.some((r) => r.url)) return 'available'
    if (refs.length && refs.every((r) => r.expiresAt && r.expiresAt <= at)) return 'expired'
    return 'unavailable'
  }
  function decisionFor(report, revision, asOf) {
    return report.decisions.filter((d) => d.revisionId === revision.revisionId && (!asOf || d.decidedAt <= asOf)).at(-1)
  }
  function revisionView(report, revision, asOf) {
    const decision = decisionFor(report, revision, asOf)
    const reviewState = decision?.action ?? 'submitted'
    return { ...clone(revision), reviewState, status: revision.delivery === 'queued' ? 'ANTRE' : reviewState === 'accepted' ? 'DITERIMA' : reviewState === 'needs-revision' ? 'DITOLAK' : 'MENUNGGU', catatan: decision?.reason ?? null, evidenceAvailability: evidenceAvailability(revision, asOf), illustrative: true, simulationOnly: true }
  }
  function reportView(report, history = false, asOf = clock()) {
    const revision = report.revisions.at(-1)
    const result = { ...revisionView(report, revision, asOf), id: report.reportId, reportId: report.reportId, version: report.version, versi: revision.revisionNumber, updatedAt: report.updatedAt, firstReceivedAt: report.firstReceivedAt, deliveryLabel: '' }
    if (history) { result.revisions = report.revisions.map((r) => revisionView(report, r, asOf)); result.decisions = clone(report.decisions) }
    return result
  }
  function nextId(draft, prefix) {
    let id
    do { id = `${prefix}:demo:${++draft.sequence}` } while (draft.reports.some((r) => r.reportId === id))
    return id
  }
  function revisionRecord(data, reportId, revisionNumber, actor, at, previous = null) {
    return { ...clone(data), reportId, revisionId: `${reportId}:r${revisionNumber}`, revisionNumber, createdBy: actor.id, createdAt: at, receivedAt: data.delivery === 'delivered' ? at : null, supersedesRevisionId: previous?.revisionId ?? null }
  }
  function change(type, mutate) {
    const draft = clone(state)
    const result = mutate(draft)
    if (storage) {
      try { storage.setItem(STORAGE_KEY, JSON.stringify(jsonData(draft))); persistence = { mode: 'session', status: 'ready', warning: null } }
      catch { persistence = { mode: 'session', status: 'failed', warning: 'Penyimpanan sesi gagal; perubahan tidak diterapkan.' }; fail('STORAGE_UNAVAILABLE', persistence.warning) }
    }
    state = draft
    const event = deepFreeze({ type, at: clock(), masterVersion: state.masterVersion, localOnly: true })
    for (const listener of subscribers) { try { listener(event) } catch { /* A local subscriber cannot undo a committed change. */ } }
    return clone(result)
  }
  function idemKey(key) {
    return key === undefined ? null : text(key, 'idempotencyKey', { required: true, max: 200 })
  }
  function retry(actor, operation, key, payload) {
    const token = idemKey(key)
    const fingerprint = canonical(payload)
    const existing = token && state.idempotency.find((r) => r.actorId === actor.id && r.key === token)
    if (existing && (existing.operation !== operation || existing.fingerprint !== fingerprint)) fail('CONFLICT', 'Kunci idempotensi sudah dipakai untuk permintaan berbeda.')
    return { token, fingerprint, existing }
  }
  function remember(draft, actor, operation, idem, result) {
    if (idem.token) draft.idempotency.push({ actorId: actor.id, operation, key: idem.token, fingerprint: idem.fingerprint, result: clone(result) })
  }
  function checkVersion(report, expectedVersion) {
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) invalid('expectedVersion', 'Versi yang dibaca wajib disertakan.')
    if (report.version !== expectedVersion) fail('CONFLICT', 'Laporan telah berubah. Muat ulang sebelum melanjutkan.')
  }
  function range(filters = {}) {
    if (!plain(filters)) invalid('filters', 'Filter harus berupa objek.')
    const result = jsonData(filters)
    if (result.from) workDate(result.from, 'from')
    if (result.to) workDate(result.to, 'to')
    if (result.from && result.to && result.from > result.to) invalid('to', 'Tanggal akhir tidak boleh mendahului tanggal awal.')
    for (const key of ['q', 'kode', 'packageId', 'provinsi', 'kelompok', 'kabupaten', 'tahap', 'status', 'delivery', 'reviewState', 'contractorId', 'kontraktor']) if (result[key] != null && typeof result[key] !== 'string') invalid(key, 'Nilai filter harus berupa teks.')
    return result
  }
  function projectMatches(project, filters, includeSearch = true) {
    return matches(project.kode, filters.kode) && matches(project.projectId, filters.projectId) && matches(project.provinsi, filters.provinsi) && matches(project.kelompok, filters.kelompok) && matches(project.kabupaten, filters.kabupaten) && matches(project.tahap, filters.tahap)
      && (!filters.packageId || filters.packageId === 'all' || state.packages.some((p) => p.kode === project.kode && p.packageId === filters.packageId))
      && (!includeSearch || !filters.q || searchText(`${project.kode} ${project.nama} ${project.provinsi} ${project.kabupaten} ${project.kelompok}`).includes(searchText(filters.q)))
  }
  function packageMatches(pkg, filters) {
    return matches(pkg.packageId, filters.packageId) && matches(pkg.contractorId, filters.contractorId) && matches(pkg.kontraktor, filters.kontraktor)
  }

  function validateRestored(saved) {
    jsonData(saved)
    if (!plain(saved) || saved.schemaVersion !== SCHEMA_VERSION || !Number.isInteger(saved.masterVersion) || saved.masterVersion < 1 || !Number.isInteger(saved.sequence) || saved.sequence < 0) throw new Error('schema')
    for (const key of ['projects', 'packages', 'reports', 'followUps', 'idempotency', 'importHistory']) if (!Array.isArray(saved[key])) throw new Error(key)
    if (!plain(saved.catalogs) || !Array.isArray(saved.catalogs.references) || !Array.isArray(saved.catalogs.knowledge)) throw new Error('catalogs')
    const validated = projectRows(saved.projects)
    if (validated.errors.length || (seedProjects.length && !saved.projects.length)) throw new Error('projects')
    const ids = new Set()
    for (const pkg of saved.packages) {
      if (!pkg.packageId || ids.has(pkg.packageId) || !saved.projects.some((p) => p.kode === pkg.kode && p.projectId === pkg.projectId)) throw new Error('packages')
      ids.add(pkg.packageId)
    }
    const logical = new Set()
    const reportIds = new Set()
    for (const report of saved.reports) {
      if (!report.reportId || reportIds.has(report.reportId) || !Number.isInteger(report.version) || report.version < 1 || !Array.isArray(report.revisions) || !report.revisions.length || !Array.isArray(report.decisions)) throw new Error('reports')
      reportIds.add(report.reportId)
      const key = `${report.packageId}:${workDate(report.tanggal)}`
      if (logical.has(key) || !saved.packages.some((p) => p.packageId === report.packageId && p.kode === report.kode)) throw new Error('logical report')
      logical.add(key)
      const revisionIds = new Set()
      report.revisions.forEach((revision, index) => {
        if (revision.kode !== report.kode || revision.packageId !== report.packageId || revision.tanggal !== report.tanggal || revision.reportId !== report.reportId || revision.revisionNumber !== index + 1 || revisionIds.has(revision.revisionId) || !Array.isArray(revision.evidenceRefs) || !['queued', 'delivered'].includes(revision.delivery)) throw new Error('revision')
        number(revision.progres, 'progres', { max: 100 })
        instant(revision.createdAt)
        if (revision.delivery === 'delivered') instant(revision.receivedAt)
        revisionIds.add(revision.revisionId)
      })
      if (report.decisions.some((d) => !revisionIds.has(d.revisionId) || !['accepted', 'needs-revision'].includes(d.action) || !d.actor?.id)) throw new Error('decision')
      instant(report.updatedAt)
    }
    return saved
  }

  for (const raw of jsonData(reports)) {
    const tanggal = raw.tanggal ?? addDays(initialDate, raw.offset ?? 0)
    const data = content({ ...raw, tanggal }, { seed: true })
    if (state.reports.some((r) => r.packageId === data.packageId && r.tanggal === tanggal)) fail('CONFLICT', 'Seed berisi laporan logis duplikat.')
    const reportId = text(raw.reportId ?? raw.id ?? nextId(state, 'report'), 'reportId', { required: true, max: 200 })
    if (state.reports.some((r) => r.reportId === reportId)) fail('CONFLICT', 'Seed berisi ID laporan duplikat.')
    const seedTime = instant(`${tanggal}T12:00:00+07:00`)
    const at = raw.createdAt ? instant(raw.createdAt) : seedTime > initialTime ? initialTime : seedTime
    const actor = { id: raw.createdBy ?? 'contractor-demo' }
    const revision = revisionRecord(data, reportId, 1, actor, at)
    if (data.delivery === 'delivered' && raw.receivedAt) revision.receivedAt = instant(raw.receivedAt)
    const report = { reportId, kode: data.kode, packageId: data.packageId, tanggal, version: 1, createdBy: actor.id, createdAt: at, updatedAt: at, firstReceivedAt: revision.receivedAt, revisions: [revision], decisions: [] }
    if (['DITERIMA', 'DITOLAK'].includes(raw.status)) {
      report.decisions.push({ decisionId: `${reportId}:decision:seed`, reportId, revisionId: revision.revisionId, action: raw.status === 'DITERIMA' ? 'accepted' : 'needs-revision', reason: raw.catatan ?? 'Keputusan reviewer demo.', actor: { id: 'reviewer-demo', role: 'reviewer' }, decidedAt: at, expectedVersion: 1, previousDecisionId: null, simulationOnly: true })
      report.version = 2
    }
    state.reports.push(report)
  }
  const initialState = clone(state)
  if (storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY)
      if (raw !== null && raw !== undefined) state = clone(validateRestored(JSON.parse(raw)))
    } catch {
      persistence = { mode: 'session', status: 'recovered', warning: 'Data sesi tidak dapat dibaca; dimuat ulang dari data awal.' }
    }
  }

  function getProjects(filters = {}, actor = defaultReviewer()) {
    const f = range(filters)
    actorValid(actor)
    return clone(state.projects.filter((p) => projectAllowed(actor, p)).filter((p) => projectMatches(p, f) && (!f.packageId && !f.contractorId && !f.kontraktor || state.packages.some((pkg) => pkg.kode === p.kode && packageAllowed(actor, pkg) && packageMatches(pkg, f)))))
  }
  function getPackages(filters = {}, actor = defaultReviewer()) {
    const f = range(filters)
    actorValid(actor)
    return clone(state.packages.filter((p) => packageAllowed(actor, p)).filter((p) => matches(p.kode, f.kode) && packageMatches(p, f) && projectMatches(state.projects.find((project) => project.kode === p.kode), f)))
  }
  function getReports(filters = {}, actor = defaultReviewer(), asOf = clock()) {
    const f = range(filters)
    actorValid(actor)
    return state.reports.filter((report) => packageAllowed(actor, state.packages.find((p) => p.packageId === report.packageId)))
      .map((report) => reportView(report, false, asOf)).filter((report) => {
        const project = state.projects.find((p) => p.kode === report.kode)
        const pkg = state.packages.find((p) => p.packageId === report.packageId)
        return projectMatches(project, f, false) && packageMatches(pkg, f) && (!f.from || report.tanggal >= f.from) && (!f.to || report.tanggal <= f.to)
          && (!f.status || f.status === 'all' || [report.status, report.reviewState, report.delivery].includes(f.status)) && matches(report.delivery, f.delivery) && matches(report.reviewState, f.reviewState)
          && (!f.q || searchText(`${project.kode} ${project.nama} ${project.provinsi} ${pkg.nama} ${pkg.kontraktor ?? ''} ${report.reportId} ${report.uraian}`).includes(searchText(f.q)))
      }).sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.updatedAt.localeCompare(a.updatedAt) || a.reportId.localeCompare(b.reportId))
  }
  function getReport(id, actor = defaultReviewer()) { return reportView(reportFor(id, actor), true) }

  function submitReport(payload, { actor = defaultContractor(), idempotencyKey } = {}) {
    requireWrite(actor)
    const request = jsonData(payload)
    const idem = retry(actor, 'submit', idempotencyKey, request)
    if (idem.existing) { reportFor(idem.existing.result.reportId, actor); return clone(idem.existing.result) }
    const data = content(request)
    requirePackage(actor, state.packages.find((p) => p.packageId === data.packageId))
    if (state.reports.some((r) => r.packageId === data.packageId && r.tanggal === data.tanggal)) fail('CONFLICT', 'Satu laporan logis per paket/tanggal; buka dan revisi laporan yang ada.')
    const at = clock()
    return change('report:submitted', (draft) => {
      const reportId = nextId(draft, 'report')
      const revision = revisionRecord(data, reportId, 1, actor, at)
      const report = { reportId, kode: data.kode, packageId: data.packageId, tanggal: data.tanggal, version: 1, createdBy: actor.id, createdAt: at, updatedAt: at, firstReceivedAt: revision.receivedAt, revisions: [revision], decisions: [] }
      draft.reports.push(report)
      const result = reportView(report, true)
      remember(draft, actor, 'submit', idem, result)
      return result
    })
  }

  function reviseReport(id, payload, { actor = defaultContractor(), idempotencyKey, expectedVersion } = {}) {
    requireWrite(actor)
    const report = reportFor(id, actor)
    const previous = report.revisions.at(-1)
    if (actor.role === 'contractor' && ![report.createdBy, previous.createdBy].includes(actor.id)) fail('FORBIDDEN', 'Hanya pelapor yang ditugaskan dapat merevisi laporan demo ini.')
    const request = jsonData(payload)
    const idem = retry(actor, 'revise', idempotencyKey, { reportId: report.reportId, expectedVersion, payload: request })
    if (idem.existing) return clone(idem.existing.result)
    checkVersion(report, expectedVersion)
    const data = content(request, { base: previous })
    if (data.kode !== report.kode || data.packageId !== report.packageId || data.tanggal !== report.tanggal) invalid('packageId', 'Revisi tidak boleh mengganti identitas paket atau tanggal laporan logis.')
    if (decisionFor(report, previous)?.action === 'accepted' && !text(request.reason ?? request.alasanKoreksi, 'reason', { max: 2000 })) invalid('reason', 'Koreksi laporan diterima wajib memiliki alasan baru; keputusan lama dipertahankan.')
    const at = clock()
    return change('report:revised', (draft) => {
      const target = draft.reports.find((r) => r.reportId === report.reportId)
      const revision = revisionRecord(data, report.reportId, previous.revisionNumber + 1, actor, at, previous)
      target.revisions.push(revision)
      target.version++
      target.updatedAt = at
      target.firstReceivedAt ??= revision.receivedAt
      const result = reportView(target, true)
      remember(draft, actor, 'revise', idem, result)
      return result
    })
  }

  function decideReport(id, { action, reason, expectedVersion, idempotencyKey, actor = defaultReviewer() } = {}) {
    requireReviewer(actor)
    const report = reportFor(id, actor)
    const revision = report.revisions.at(-1)
    if (revision.createdBy === actor.id || report.createdBy === actor.id) fail('FORBIDDEN', 'Pelapor tidak dapat memutus laporannya sendiri.')
    if (!['accepted', 'needs-revision'].includes(action)) invalid('action', 'Keputusan harus accepted atau needs-revision.')
    const note = text(reason, 'reason', { required: action === 'needs-revision', max: 2000 })
    const idem = retry(actor, 'decide', idempotencyKey, { reportId: report.reportId, action, reason: note, expectedVersion })
    if (idem.existing) return clone(idem.existing.result)
    checkVersion(report, expectedVersion)
    if (revision.delivery !== 'delivered' || !revision.receivedAt) fail('CONFLICT', 'Laporan antre perangkat belum dapat diputus.')
    if (decisionFor(report, revision)) fail('CONFLICT', 'Revisi sudah diputus; koreksi harus menjadi revisi baru.')
    const at = clock()
    return change('report:decided', (draft) => {
      const target = draft.reports.find((r) => r.reportId === report.reportId)
      target.decisions.push({ decisionId: nextId(draft, 'decision'), reportId: report.reportId, revisionId: revision.revisionId, action, reason: note, actor: { id: actor.id, role: actor.role }, decidedAt: at, expectedVersion, previousDecisionId: target.decisions.at(-1)?.decisionId ?? null, simulationOnly: true })
      target.version++
      target.updatedAt = at
      const result = reportView(target, true)
      remember(draft, actor, 'decide', idem, result)
      return result
    })
  }

  function getProgress(kode, { packageId, actor = defaultReviewer() } = {}) {
    actorValid(actor)
    const project = state.projects.find((p) => p.kode === kode)
    if (!project) fail('NOT_FOUND', 'Proyek tidak ditemukan.')
    if (!projectAllowed(actor, project)) fail('FORBIDDEN', 'Proyek di luar cakupan penugasan demo.')
    const packages = state.packages.filter((p) => p.kode === kode && packageAllowed(actor, p))
    if (packageId) {
      const requested = state.packages.find((p) => p.packageId === packageId)
      if (!requested || requested.kode !== kode) invalid('packageId', 'Paket tidak cocok dengan proyek master.')
      requirePackage(actor, requested)
    }
    const source = { kind: 'demo-reports', aggregation: packageId || packages.length === 1 ? 'per-package' : 'unavailable-multiple-packages', reportId: null, revisionId: null, policyLabel: POLICY_LABEL }
    const result = { reported: null, verified: null, baseline: null, deviation: null, asOf: clock(), source }
    if (!packageId && packages.length !== 1) return result
    const targetId = packageId ?? packages[0].packageId
    const candidates = state.reports.filter((r) => r.packageId === targetId).sort((a, b) => b.tanggal.localeCompare(a.tanggal))
    result.reported = candidates[0]?.revisions.at(-1).progres ?? null
    for (const report of candidates) {
      const accepted = report.revisions.filter((r) => decisionFor(report, r)?.action === 'accepted').at(-1)
      if (accepted) { result.verified = accepted.progres; result.source.reportId = report.reportId; result.source.revisionId = accepted.revisionId; result.source.workDate = accepted.tanggal; break }
    }
    return result
  }

  function getCompliance({ date = businessDate(clock()), asOf = clock(), filters = {}, actor = defaultReviewer() } = {}) {
    workDate(date)
    const evaluatedAt = instant(asOf)
    const cutOff = cutOffFor(date)
    const f = range(filters)
    actorValid(actor)
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
    return state.packages.filter((pkg) => packageAllowed(actor, pkg)).filter((pkg) => {
      const project = state.projects.find((p) => p.kode === pkg.kode)
      return !project.archived && !['Selesai', 'Dihentikan', 'Dibatalkan'].includes(project.tahap) && pkg.reportingRequired && (!pkg.activeFrom || pkg.activeFrom <= date) && (!pkg.activeTo || pkg.activeTo >= date) && pkg.workingDays.includes(weekday) && !pkg.excludedDates.includes(date) && projectMatches(project, f) && packageMatches(pkg, f)
    }).map((pkg) => {
      const report = state.reports.find((r) => r.packageId === pkg.packageId && r.tanggal === date)
      const visibleRevisions = report?.revisions.filter((r) => r.createdAt <= evaluatedAt) ?? []
      const current = visibleRevisions.at(-1)
      const received = visibleRevisions.filter((r) => r.delivery === 'delivered' && r.receivedAt <= evaluatedAt).map((r) => r.receivedAt).sort()[0] ?? null
      const reviewState = current ? decisionFor(report, current, evaluatedAt)?.action ?? 'submitted' : null
      const deliveryStatus = received ? received <= instant(cutOff) ? 'on-time' : 'late' : current?.delivery === 'queued' ? 'queued' : evaluatedAt <= instant(cutOff) ? 'not-due' : 'missing'
      return { kode: pkg.kode, packageId: pkg.packageId, date, deliveryStatus, reviewState, reportId: current ? report.reportId : null, cutOff, pic: pkg.pic, followUps: clone(state.followUps.filter((note) => note.packageId === pkg.packageId && note.date === date && note.createdAt <= evaluatedAt)), receivedAt: received, asOf: evaluatedAt, policyVersion: 'demo-policy-v1', policyLabel: POLICY_LABEL, obligationReason: 'Paket fixture aktif; kalender demo, bukan kewajiban resmi.', illustrative: true }
    }).filter((row) => !f.status || f.status === 'all' || [row.deliveryStatus, row.reviewState].includes(f.status)).map(clone)
  }

  function addFollowUp(packageId, date, note, { actor = defaultReviewer() } = {}) {
    actorValid(actor)
    if (!['reviewer', 'admin'].includes(actor.role)) fail('FORBIDDEN', 'Tindak lanjut memerlukan analis/reviewer atau admin yang ditugaskan.')
    const pkg = state.packages.find((p) => p.packageId === packageId)
    requirePackage(actor, pkg)
    workDate(date)
    const message = text(note, 'note', { required: true, max: 2000 })
    const at = clock()
    return change('compliance:follow-up', (draft) => {
      const result = { id: nextId(draft, 'follow-up'), packageId, kode: pkg.kode, date, note: message, actor: { id: actor.id, role: actor.role }, createdAt: at, illustrative: true, externalNotification: false }
      draft.followUps.push(result)
      return result
    })
  }

  function createSnapshot(filters = {}, actor = defaultReviewer()) {
    const f = range(filters)
    actorValid(actor)
    const asOf = clock()
    const snapshotReports = getReports(f, actor, asOf)
    const reportCodes = new Set(snapshotReports.map((r) => r.kode))
    // Snapshot filters are applied consistently: report-scoped filters (status/reviewState/delivery/period) only keep projects with matched reports; q also keeps direct master matches.
    const reportScoped = ['status', 'reviewState', 'delivery', 'from', 'to'].some((key) => f[key] != null)
    const snapshotProjects = getProjects({ ...f, q: undefined }, actor).filter((p) => (!reportScoped || reportCodes.has(p.kode)) && (!f.q || projectMatches(p, f) || reportCodes.has(p.kode)))
    const codes = new Set(snapshotProjects.map((p) => p.kode))
    const snapshot = { snapshotId: `snapshot:${hash({ asOf, filters: f, actor: { id: actor.id, projectCodes: actor.projectCodes, packageIds: actor.packageIds ?? null }, masterVersion: state.masterVersion, reports: snapshotReports })}`, asOf, filters: f, projects: snapshotProjects, reports: snapshotReports, packages: getPackages({ ...f, q: undefined }, actor).filter((p) => codes.has(p.kode)), sourceVersions: snapshotReports.map((r) => ({ reportId: r.reportId, revisionId: r.revisionId, version: r.version })), masterVersion: state.masterVersion, illustrative: true, policyLabel: POLICY_LABEL }
    return deepFreeze(clone(snapshot))
  }

  function catalogReferences(kode) {
    const packageIds = new Set(state.packages.filter((p) => p.kode === kode).map((p) => p.packageId))
    const visit = (value) => {
      if (Array.isArray(value)) return value.some(visit)
      if (!plain(value)) return false
      return Object.entries(value).some(([key, item]) => ['kode', 'projectCode'].includes(key) ? item === kode : key === 'projectId' ? item === `project:${kode}` : key === 'packageId' ? packageIds.has(item) : key === 'projectCodes' ? Array.isArray(item) && item.includes(kode) : key === 'projectIds' ? Array.isArray(item) && item.includes(`project:${kode}`) : key === 'packageIds' ? Array.isArray(item) && item.some((id) => packageIds.has(id)) : visit(item))
    }
    return visit(state.catalogs)
  }
  function referenced(kode, includePackages = true) {
    return (includePackages && state.packages.some((p) => p.kode === kode)) || state.reports.some((r) => r.kode === kode) || state.followUps.some((f) => f.kode === kode) || assignments.some((a) => a.kode === kode) || catalogReferences(kode)
  }
  function validateImport(rows) {
    const validation = projectRows(rows, state.projects)
    for (const previous of state.projects) {
      if (!validation.rows.some((p) => p.kode === previous.kode) && referenced(previous.kode)) validation.errors.push({ row: 0, field: 'kode', code: 'REFERENCED', message: `Proyek ${previous.kode} masih dirujuk; penghapusan tidak diizinkan.` })
    }
    for (const [index, row] of validation.rows.entries()) if (row.archived && !state.projects.find((p) => p.kode === row.kode)?.archived && referenced(row.kode)) validation.errors.push({ row: index + 1, field: 'archived', code: 'REFERENCED', message: `Proyek ${row.kode} masih dirujuk; arsip tidak diizinkan melalui impor.` })
    return validation
  }
  function previewImport(rows, { actor = defaultAdmin() } = {}) {
    requireAdmin(actor)
    const validation = validateImport(rows)
    const normalized = validation.rows
    const summary = { total: Array.isArray(rows) ? rows.length : 0, valid: 0, invalid: new Set(validation.errors.filter((e) => e.row > 0).map((e) => e.row)).size, batchErrors: validation.errors.filter((e) => e.row === 0).length, added: 0, changed: 0, unchanged: 0, archived: 0 }
    for (const row of normalized) {
      const previous = state.projects.find((p) => p.kode === row.kode)
      if (!previous) summary.added++
      else if (PROJECT_FIELDS.some((key) => row[key] !== previous[key]) || row.archived !== previous.archived) summary.changed++
      else summary.unchanged++
      if (row.archived) summary.archived++
    }
    summary.valid = Math.max(0, summary.total - summary.invalid)
    const sourceHash = validation.errors.length ? null : hash(normalized)
    const previewId = `import-preview:${state.masterVersion}:${++previewSequence}`
    const preview = { valid: !validation.errors.length, errors: validation.errors, rows: normalized, sourceHash, mappingVersion: IMPORT_MAPPING_VERSION, baseVersion: state.masterVersion, summary, previewId }
    previews.set(previewId, { actorId: actor.id, sourceHash, baseVersion: state.masterVersion, valid: preview.valid })
    return clone(preview)
  }
  function commitImport(preview, { actor = defaultAdmin() } = {}) {
    requireAdmin(actor)
    if (!plain(preview) || !preview.valid) invalid('preview', 'Pratinjau valid wajib tersedia; seluruh batch ditolak bila ada kesalahan.')
    const issued = previews.get(preview.previewId)
    if (!issued || !issued.valid || issued.actorId !== actor.id || preview.mappingVersion !== IMPORT_MAPPING_VERSION || preview.baseVersion !== state.masterVersion || issued.baseVersion !== state.masterVersion) fail('CONFLICT', 'Pratinjau tidak dikenal atau master telah berubah; buat pratinjau ulang.')
    const validation = validateImport(preview.rows)
    if (validation.errors.length) fail('VALIDATION', 'Validasi ulang gagal; tidak ada baris yang diterapkan.', { rows: validation.errors })
    if (hash(validation.rows) !== preview.sourceHash || preview.sourceHash !== issued.sourceHash) fail('CONFLICT', 'Baris atau hash berubah sejak pratinjau.')
    const at = clock()
    return change('master:imported', (draft) => {
      const batchId = nextId(draft, 'import')
      const batch = { batchId, kind: 'import', beforeProjects: clone(draft.projects), beforePackages: clone(draft.packages), beforeMasterVersion: draft.masterVersion, masterVersion: draft.masterVersion + 1, sourceHash: preview.sourceHash, mappingVersion: IMPORT_MAPPING_VERSION, actor: { id: actor.id, role: actor.role }, createdAt: at }
      draft.projects = validation.rows.map((row) => {
        const previous = draft.projects.find((p) => p.kode === row.kode)
        const changed = !previous || PROJECT_FIELDS.some((key) => row[key] !== previous[key]) || row.archived !== previous.archived
        return { ...row, provenance: changed ? { source: 'Import demo terotorisasi lokal', sourceHash: preview.sourceHash, importBatchId: batchId, asOf: at, retrievedAt: at, validator: actor.id, verificationStatus: 'illustrative-unverified' } : row.provenance }
      })
      draft.packages = draft.packages.filter((p) => draft.projects.some((project) => project.kode === p.kode))
      for (const project of draft.projects) if (!draft.packages.some((p) => p.kode === project.kode)) draft.packages.push(makePackage(project))
      draft.masterVersion++
      draft.importHistory.push(batch)
      return draft.projects
    })
  }
  function rollbackImport(batchId, { actor = defaultAdmin(), reason, expectedVersion } = {}) {
    requireAdmin(actor)
    const note = text(reason, 'reason', { required: true, max: 2000 })
    const batch = state.importHistory.find((item) => item.batchId === batchId && item.kind === 'import')
    if (!batch) fail('NOT_FOUND', 'Batch impor tidak ditemukan.')
    if ((expectedVersion !== undefined && expectedVersion !== state.masterVersion) || batch.masterVersion !== state.masterVersion || state.importHistory.some((b) => b.compensates === batchId)) fail('CONFLICT', 'Hanya batch terakhir yang belum dikompensasi dapat dibalik; muat ulang master.')
    const removed = state.projects.filter((p) => !batch.beforeProjects.some((old) => old.kode === p.kode))
    if (removed.some((p) => referenced(p.kode, false))) fail('CONFLICT', 'Proyek baru sudah dirujuk; rollback tidak boleh menghapus riwayat.')
    const at = clock()
    return change('master:compensated', (draft) => {
      const compensation = { batchId: nextId(draft, 'import'), kind: 'rollback', compensates: batchId, reason: note, actor: { id: actor.id, role: actor.role }, createdAt: at, beforeProjects: clone(draft.projects), beforePackages: clone(draft.packages), beforeMasterVersion: draft.masterVersion, masterVersion: draft.masterVersion + 1 }
      draft.projects = clone(batch.beforeProjects)
      draft.packages = clone(batch.beforePackages)
      draft.masterVersion++
      draft.importHistory.push(compensation)
      return draft.projects
    })
  }
  function catalogKind(kind) { if (!['references', 'knowledge'].includes(kind)) invalid('kind', 'Koleksi hanya references atau knowledge.') }
  function getCatalog(kind) { catalogKind(kind); return clone(state.catalogs[kind]) }
  function saveCatalog(kind, rows) {
    catalogKind(kind)
    if (!Array.isArray(rows)) invalid('rows', 'Koleksi harus berupa daftar.')
    const data = jsonData(rows)
    return change(`catalog:${kind}`, (draft) => { draft.catalogs[kind] = data; return data })
  }
  function subscribe(listener) {
    if (typeof listener !== 'function') invalid('listener', 'Listener harus berupa fungsi.')
    subscribers.add(listener)
    return () => subscribers.delete(listener)
  }
  return Object.freeze({ getProjects, getPackages, getReports, getReport, submitReport, reviseReport, decideReport, getProgress, getCompliance, addFollowUp, createSnapshot, previewImport, commitImport, rollbackImport, getCatalog, saveCatalog, subscribe,
    getState: () => ({ ...clone(state), persistence: clone(persistence) }),
    reset: () => change('demo:reset', (draft) => { Object.assign(draft, clone(initialState)); return draft }),
    capabilities: deepFreeze({ mode: 'demo', production: false, authorization: 'local-simulation', delivery: 'local-simulation', permanentEvidence: false, crossUserSync: false, externalNotifications: false, prasarana: false }),
  })
}
