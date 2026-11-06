import kontraktor from '../data/kontraktor.json'
import isuSeed from '../data/isu.json'
import { provider, DEMO_CONTRACTOR } from '../../admin-data.js'
import { isoHariIni } from './format.js'
import { kosongkanFoto } from './photos.js'

const KEY = 'pmo.demo.v1'
const ISO = isoHariIni

export const semuaProyek = provider.getProjects()
export const proyekByKode = (kode) => semuaProyek.find((p) => p.kode === kode)
export const paketSaya = kontraktor.paket.map((p) => ({ ...proyekByKode(p.kode), ...p }))
export const paketByKode = (kode) => paketSaya.find((p) => p.kode === kode)
export const akunDemo = kontraktor.akun

function laporanDomain(lama = []) {
  const terkini = provider.getReports({}, DEMO_CONTRACTOR).map((r) => provider.getReport(r.id, DEMO_CONTRACTOR))
  const ids = new Set(terkini.map((r) => r.id))
  const hasil = terkini.map((r) => {
    const lokal = lama.find((l) => l.domainId === r.id && l.id !== r.id) ?? lama.find((l) => (l.domainId ?? l.id) === r.id)
    if (lokal?.queuedAction) return lokal
    return {
      ...r, id: lokal?.id ?? r.id, domainId: r.id,
      fotoIds: r.evidenceRefs.map((foto) => foto.id),
      riwayatVersi: r.revisions,
    }
  })
  // Unmapped legacy records stay readable; they are never silently asserted as delivered to this provider.
  return [...hasil, ...lama.filter((l) => !ids.has(l.domainId ?? l.id)).map((l) => l.queuedAction ? l : { ...l, legacyUnmapped: true })]
}

function seed() {
  return {
    user: null, laporan: laporanDomain(),
    isu: isuSeed.map(({ offset, ...r }) => ({ ...r, tanggal: ISO(offset) })),
    tanya: [], cuacaTerakhir: 'Cerah', satuanTerakhir: 'm³',
  }
}

let tersimpan = null
try {
  const data = JSON.parse(sessionStorage.getItem(KEY))
  if (data && Array.isArray(data.laporan) && Array.isArray(data.isu) && Array.isArray(data.tanya)) tersimpan = data
} catch { /* A corrupt demo session cannot replace the shared master. */ }

export const app = $state(tersimpan ?? seed())
app.laporan = laporanDomain(app.laporan)
const simpan = () => sessionStorage.setItem(KEY, JSON.stringify(app))
provider.subscribe(() => { app.laporan = laporanDomain(app.laporan); simpan() })

export const net = $state({ nyata: navigator.onLine })
export const isOnline = () => net.nyata
export const toast = $state({ pesan: '', n: 0 })
let timer
export function kabari(pesan) {
  toast.pesan = pesan
  toast.n++
  clearTimeout(timer)
  timer = setTimeout(() => (toast.pesan = ''), 4000)
}

export function login(email, sandi) {
  const ok = email.trim().toLowerCase() === akunDemo.email && sandi === akunDemo.sandi
  if (ok) { app.user = { ...kontraktor.pengguna, email: akunDemo.email }; simpan() }
  return ok
}
export function logout() {
  app.user = null
  simpan()
  kosongkanFoto().catch(() => {})
}

export const progresDiterima = (kode) => provider.getProgress(kode).verified ?? proyekByKode(kode)?.progres ?? 0

export function statusHariIni(kode) {
  const mine = app.laporan.filter((l) => l.kode === kode)
  const ditolak = mine.find((l) => l.status === 'DITOLAK')
  if (ditolak) return { kode: 'REVISI', laporan: ditolak }
  const hariIni = mine.find((l) => l.tanggal === ISO())
  return hariIni ? { kode: 'SUDAH', laporan: hariIni } : { kode: 'BELUM' }
}

export const laporanAktifPada = (kode, tanggal, kecuali) =>
  app.laporan.find((l) => l.kode === kode && l.tanggal === tanggal && l.id !== kecuali && l.status !== 'DITOLAK')

function perbaruiDefault(data) {
  app.cuacaTerakhir = data.cuaca
  app.satuanTerakhir = data.satuan
  simpan()
}

export function kirimLaporan(data, clientSubmissionId = crypto.randomUUID()) {
  let id
  if (isOnline()) {
    const report = provider.submitReport({ ...data, delivery: 'delivered' }, { actor: DEMO_CONTRACTOR, idempotencyKey: clientSubmissionId })
    id = report.id
    app.laporan = laporanDomain(app.laporan)
  } else {
    id = `L-${crypto.randomUUID()}`
    app.laporan.unshift({ ...data, id, versi: 1, status: 'ANTRE', foto: 0, queuedAction: 'submit', clientSubmissionId, riwayatVersi: [] })
  }
  perbaruiDefault(data)
  return id
}

export function revisiLaporan(id, data, clientSubmissionId = crypto.randomUUID()) {
  const lokal = app.laporan.find((l) => l.id === id)
  if (!lokal || lokal.legacyUnmapped) throw new Error('Laporan belum dipetakan. Simpan salinan isinya dan buat laporan pada paket yang sesuai.')
  if (lokal.queuedAction) throw new Error('Selesaikan antrean laporan ini sebelum membuat revisi berikutnya.')
  if (isOnline()) {
    provider.reviseReport(lokal.domainId ?? id, { ...data, delivery: 'delivered' }, { actor: DEMO_CONTRACTOR, expectedVersion: lokal.version, idempotencyKey: clientSubmissionId })
    app.laporan = laporanDomain(app.laporan)
  } else {
    const sebelumnya = structuredClone($state.snapshot(lokal))
    Object.assign(lokal, data, { versi: lokal.versi + 1, status: 'ANTRE', catatan: null, catatanLama: lokal.catatan, queuedAction: 'revise', clientSubmissionId, riwayatVersi: [...(lokal.riwayatVersi ?? []), sebelumnya] })
  }
  perbaruiDefault(data)
}

export function sinkron() {
  if (!isOnline()) return
  const antre = app.laporan.filter((l) => l.queuedAction)
  let selesai = 0
  for (const lokal of antre) {
    try {
      const payload = { ...$state.snapshot(lokal), delivery: 'delivered' }
      const opts = { actor: DEMO_CONTRACTOR, idempotencyKey: lokal.clientSubmissionId, expectedVersion: lokal.version }
      const report = lokal.queuedAction === 'revise'
        ? provider.reviseReport(lokal.domainId ?? lokal.id, payload, opts)
        : provider.submitReport(payload, opts)
      lokal.domainId = report.id
      delete lokal.queuedAction
      delete lokal.syncError
      selesai++
      app.laporan = laporanDomain(app.laporan)
    } catch (error) {
      lokal.syncError = error.message
    }
  }
  if (antre.length) {
    simpan()
    kabari(selesai === antre.length ? `${selesai} laporan terkirim, menunggu verifikasi.` : 'Sebagian antrean belum terkirim. Buka detail laporan untuk melihat kendala.')
  }
}
addEventListener('online', () => { net.nyata = true; sinkron() })
addEventListener('offline', () => (net.nyata = false))
if (isOnline()) sinkron()

export function kirimIsu(data) {
  app.isu.unshift({ ...data, id: `I-${crypto.randomUUID()}`, status: 'Baru', tanggal: ISO() })
  simpan()
}
export function kirimTanya(data) {
  app.tanya.unshift({ ...data, id: `Q-${crypto.randomUUID()}`, tanggal: ISO() })
  simpan()
}
