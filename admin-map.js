import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Seluruh titik adalah data ilustratif untuk presentasi BOPPJ, bukan koordinat proyek resmi.
const jenisPembangunan = {
  gsw: { nama: 'Giant Sea Wall', warna: '#2f7bd0' },
  ncicd: { nama: 'Tanggul Pantai NCICD', warna: '#1dad7b' },
  tol: { nama: 'Integrasi Tol Semarang–Demak', warna: '#e27635' },
  pendukung: { nama: 'Infrastruktur Pendukung', warna: '#8064c8' },
}

const proyek = [
  ['NCICD-A-01', 'Tanggul Pantai Muara Angke', -6.112, 106.775, 'ncicd', 'Konstruksi', 55],
  ['NCICD-A-02', 'Tanggul Pantai Marunda', -6.095, 106.975, 'ncicd', 'Konstruksi', 48],
  ['NCICD-A-03', 'Tanggul Pantai Kalibaru', -6.105, 106.895, 'ncicd', 'Konstruksi', 62],
  ['JLN-01', 'Perbaikan Jalan Akses Pelabuhan', -6.756, 108.555, 'pendukung', 'Konstruksi', 35],
  ['GSW-01', 'Giant Sea Wall Cirebon', -6.731, 108.568, 'gsw', 'Asesmen', 10],
  ['GSW-05', 'Giant Sea Wall Tegal', -6.851, 109.142, 'gsw', 'Asesmen', 8],
  ['GSW-07', 'Giant Sea Wall Pekalongan', -6.871, 109.675, 'gsw', 'Asesmen', 5],
  ['TOL-SMD-01', 'Jalan Tol Semarang–Demak Seksi 1C', -6.961, 110.392, 'tol', 'Pra-konstruksi', 30],
  ['GSW-10', 'Giant Sea Wall Semarang', -6.960, 110.445, 'gsw', 'Asesmen', 10],
  ['GSW-13', 'Giant Sea Wall Sayung', -6.966, 110.620, 'gsw', 'Pra-konstruksi', 25],
  ['TOL-SMD-02', 'Jalan Tol Semarang–Demak Seksi 1B', -6.932, 110.505, 'tol', 'Pra-konstruksi', 20],
  ['GSW-15', 'Giant Sea Wall Rembang', -6.708, 111.493, 'gsw', 'Asesmen', 3],
]

function tambahLegenda(peta) {
  const legenda = L.control({ position: 'bottomright' })
  legenda.onAdd = () => {
    const div = L.DomUtil.create('div', 'peta-legenda')
    div.innerHTML = `<strong>Jenis pembangunan</strong>${Object.values(jenisPembangunan)
      .map(({ nama, warna }) => `<span><i style="background:${warna}"></i>${nama}</span>`)
      .join('')}`
    return div
  }
  legenda.addTo(peta)
}

function tampilkanPeta(wadah, ringkas = false) {
  if (!wadah || wadah.dataset.mapReady) return
  wadah.dataset.mapReady = 'true'
  wadah.innerHTML = ''

  const peta = L.map(wadah, { scrollWheelZoom: !ringkas, zoomControl: !ringkas, attributionControl: !ringkas })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(peta)

  const batas = []
  proyek.forEach(([kode, nama, lat, lng, jenis, tahap, progres]) => {
    const kategori = jenisPembangunan[jenis]
    L.circleMarker([lat, lng], {
      radius: ringkas ? 8 : 10,
      color: '#ffffff',
      weight: 2,
      fillColor: kategori.warna,
      fillOpacity: 1,
    })
      .addTo(peta)
      .bindTooltip(kode, { direction: 'top', offset: [0, -8] })
      .bindPopup(`<strong>${nama}</strong><br><small>${kode} · ${kategori.nama}</small><br>Tahap: ${tahap}<br>Progres: ${progres}%`)
    batas.push([lat, lng])
  })

  peta.fitBounds(batas, { padding: ringkas ? [20, 20] : [50, 50], maxZoom: ringkas ? 8 : 9 })
  if (ringkas) L.control.zoom({ position: 'bottomleft' }).addTo(peta)
  tambahLegenda(peta)
  setTimeout(() => peta.invalidateSize(), 100)
}

const petaDashboard = document.querySelector('#dashboard-map .dashboard-map')
if (petaDashboard) tampilkanPeta(petaDashboard, true)

const tombolPeta = document.querySelector('[data-page="map"]')
const petaPenuh = document.querySelector('#map .map-canvas')
tombolPeta?.addEventListener('click', () => setTimeout(() => tampilkanPeta(petaPenuh), 0))
