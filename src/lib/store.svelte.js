import proyek from '../data/proyek.json'
import kontraktor from '../data/kontraktor.json'
import laporanSeed from '../data/laporan.json'
import isuSeed from '../data/isu.json'
import { isoHariIni } from './format.js'
import { kosongkanFoto } from './photos.js'

const KEY = 'pmo.demo.v1'
const ISO = isoHariIni

export const semuaProyek = proyek
export const proyekByKode = (kode) => proyek.find((p) => p.kode === kode)
export const paketSaya = kontraktor.paket.map((p) => ({ ...proyekByKode(p.kode), ...p }))
export const paketByKode = (kode) => paketSaya.find((p) => p.kode === kode)
export const akunDemo = kontraktor.akun

function seed() {
  return {
    user: null,
    laporan: laporanSeed.map(({ offset, ...r }) => ({
      ...r, tanggal: ISO(offset), versi: 1, anomali: [], fotoIds: [],
    })),
    isu: isuSeed.map(({ offset, ...r }) => ({ ...r, tanggal: ISO(offset) })),
    tanya: [],
    cuacaTerakhir: 'Cerah',
    satuanTerakhir: 'm³',
  }
}

let tersimpan = null
try { tersimpan = JSON.parse(sessionStorage.getItem(KEY)) } catch { /* corrupt session data, start fresh */ }

// Session-scoped on purpose: closing the tab clears every prototype record.
export const app = $state(tersimpan ?? seed())
const simpan = () => sessionStorage.setItem(KEY, JSON.stringify(app))

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

// Session
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

// Reports
export const progresDiterima = (kode) => {
  const p = app.laporan.filter((l) => l.kode === kode && l.status === 'DITERIMA').map((l) => l.progres)
  return p.length ? Math.max(...p) : proyekByKode(kode).progres
}

// REVISI > SUDAH > BELUM: a rejected report blocks everything until it is fixed.
export function statusHariIni(kode) {
  const mine = app.laporan.filter((l) => l.kode === kode)
  const ditolak = mine.find((l) => l.status === 'DITOLAK')
  if (ditolak) return { kode: 'REVISI', laporan: ditolak }
  const hariIni = mine.find((l) => l.tanggal === ISO())
  return hariIni ? { kode: 'SUDAH', laporan: hariIni } : { kode: 'BELUM' }
}

export const laporanAktifPada = (kode, tanggal, kecuali) =>
  app.laporan.find(
    (l) => l.kode === kode && l.tanggal === tanggal && l.id !== kecuali && l.status !== 'DITOLAK',
  )

export function kirimLaporan(data) {
  const id = `L-${String(Date.now()).slice(-5)}`
  app.laporan.unshift({
    ...data, id, versi: 1, status: isOnline() ? 'MENUNGGU' : 'ANTRE', foto: 0, catatan: undefined,
  })
  app.cuacaTerakhir = data.cuaca
  app.satuanTerakhir = data.satuan
  simpan()
  return id
}

export function revisiLaporan(id, data) {
  const l = app.laporan.find((x) => x.id === id)
  Object.assign(l, data, {
    versi: l.versi + 1,
    status: isOnline() ? 'MENUNGGU' : 'ANTRE',
    catatanLama: l.catatan,
    catatan: undefined,
  })
  simpan()
}

export function sinkron() {
  if (!isOnline()) return
  const antre = app.laporan.filter((l) => l.status === 'ANTRE')
  antre.forEach((l) => (l.status = 'MENUNGGU'))
  if (antre.length) { simpan(); kabari(`${antre.length} laporan terkirim, menunggu verifikasi.`) }
}
addEventListener('online', () => { net.nyata = true; sinkron() })
addEventListener('offline', () => (net.nyata = false))

// Issues and questions
export function kirimIsu(data) {
  app.isu.unshift({ ...data, id: `I-${String(Date.now()).slice(-5)}`, status: 'Baru', tanggal: ISO() })
  simpan()
}
export function kirimTanya(data) {
  app.tanya.unshift({ ...data, id: `Q-${String(Date.now()).slice(-5)}`, tanggal: ISO() })
  simpan()
}
