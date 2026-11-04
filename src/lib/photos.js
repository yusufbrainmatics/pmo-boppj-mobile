// Photos live in IndexedDB only, with a hard expiry. The service worker never sees them.
const DB = 'pmo-photos'
const STORE = 'foto'
export const TTL_MS = 5 * 60 * 1000
const MAX_BYTES = 10 * 1024 * 1024
const MAX_SISI = 1280

const buka = () =>
  new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' })
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })

async function jalankan(mode, fn) {
  const db = await buka()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    t.oncomplete = () => (db.close(), resolve(req?.result))
    t.onerror = t.onabort = () => (db.close(), reject(t.error))
  })
}

async function kompres(file) {
  if (file.size > MAX_BYTES) throw new Error('Ukuran foto melebihi 10 MB.')
  let bmp
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('Format foto tidak dapat dibaca di perangkat ini. Gunakan JPG atau PNG.')
  }
  const skala = Math.min(1, MAX_SISI / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * skala)
  c.height = Math.round(bmp.height * skala)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height) // redraw drops EXIF, including GPS
  bmp.close()
  return new Promise((ok, gagal) =>
    c.toBlob((b) => (b ? ok(b) : gagal(new Error('Gagal mengompres foto.'))), 'image/jpeg', 0.72),
  )
}

export async function simpanFoto(file) {
  const blob = await kompres(file)
  const rec = { id: crypto.randomUUID(), blob, expiresAt: Date.now() + TTL_MS }
  await jalankan('readwrite', (s) => s.put(rec))
  return { id: rec.id, expiresAt: rec.expiresAt }
}

export const ambilFoto = (id) => jalankan('readonly', (s) => s.get(id))
export const hapusFoto = (id) => jalankan('readwrite', (s) => s.delete(id))
export const kosongkanFoto = () => jalankan('readwrite', (s) => s.clear())

// shortcut: getAll loads every blob to find expired ones, fine for a few photos, switch to an expiresAt index cursor if this grows.
export async function sapuBersih() {
  const semua = await jalankan('readonly', (s) => s.getAll())
  const kini = Date.now()
  await Promise.all(semua.filter((f) => f.expiresAt <= kini).map((f) => hapusFoto(f.id)))
}

export function mulaiPenyapu() {
  sapuBersih().catch(() => {})
  setInterval(() => sapuBersih().catch(() => {}), 15_000)
}
