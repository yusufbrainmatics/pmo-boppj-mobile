import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { backofficeHash, escapeHtml, formatNumber } from './admin-ui.js'

const maps = new Map()

export function destroyMaps(root) {
  for (const [container, state] of maps) {
    if (root.contains(container) || !container.isConnected) {
      state.observer?.disconnect()
      cancelAnimationFrame(state.frame)
      state.map.remove()
      maps.delete(container)
    }
  }
}

export function renderProjectMap(container, projects, { compact = false } = {}) {
  if (!container) return
  destroyMaps(container)
  container.replaceChildren()
  const locations = projects.filter((project) => Number.isFinite(project.lat) && Number.isFinite(project.lng) && Math.abs(project.lat) <= 90 && Math.abs(project.lng) <= 180)
  if (!locations.length) {
    const empty = document.createElement('p')
    empty.className = 'empty'
    empty.textContent = 'Tidak ada koordinat proyek untuk filter ini. Data tetap dapat diperiksa melalui tabel.'
    container.append(empty)
    return
  }
  const map = L.map(container, {
    scrollWheelZoom: !compact,
    zoomControl: false,
    attributionControl: true,
  })
  L.control.zoom({ position: 'topleft', zoomInTitle: 'Perbesar peta', zoomOutTitle: 'Perkecil peta' }).addTo(map)
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map)
  const status = L.control({ position: 'bottomleft' })
  let message
  status.onAdd = () => {
    message = L.DomUtil.create('div', 'map-status')
    message.setAttribute('role', 'status')
    message.textContent = `${locations.length} lokasi ilustratif · WGS84`
    L.DomEvent.disableClickPropagation(message)
    return message
  }
  status.addTo(map)
  tiles.on('tileerror', () => {
    message.textContent = 'Peta dasar tidak tersedia. Gunakan tabel lokasi; titik tetap ilustratif.'
  })
  const bounds = []
  for (const project of locations) {
    const icon = L.divIcon({
      className: 'project-map-marker',
      html: '<span aria-hidden="true">●</span>',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    })
    const detail = backofficeHash('projects', project.kode)
    const reports = backofficeHash('daily', '', { kode: project.kode })
    L.marker([project.lat, project.lng], { icon, keyboard: true, title: `${project.kode} · ${project.nama}`, alt: `${project.kode} · ${project.nama}` })
      .addTo(map)
      .bindTooltip(escapeHtml(project.kode), { direction: 'top', offset: [0, -14] })
      .bindPopup(`<div class="map-popup"><strong>${escapeHtml(project.nama)}</strong><p>${escapeHtml(project.kode)} · ${escapeHtml(project.kabupaten)}, ${escapeHtml(project.provinsi)}</p><p>${escapeHtml(project.tahap)} · Progres seed ilustratif: ${escapeHtml(formatNumber(project.progres))}%</p><a href="${escapeHtml(detail)}">Detail proyek</a><a href="${escapeHtml(reports)}">Laporan proyek</a></div>`)
    bounds.push([project.lat, project.lng])
  }
  map.fitBounds(bounds, { padding: [32, 32], maxZoom: compact ? 8 : 11 })
  const state = { map, observer: null, frame: null }
  if (typeof ResizeObserver !== 'undefined') {
    state.observer = new ResizeObserver(() => {
      cancelAnimationFrame(state.frame)
      state.frame = requestAnimationFrame(() => {
        if (container.clientWidth && container.clientHeight) map.invalidateSize({ pan: false })
      })
    })
    state.observer.observe(container)
  }
  maps.set(container, state)
  state.frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }))
}
