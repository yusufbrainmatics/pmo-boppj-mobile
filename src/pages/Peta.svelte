<script>
  import L from 'leaflet'
  import Page from '../components/Page.svelte'
  import Icon from '../components/Icon.svelte'
  import { paketSaya, semuaProyek, isOnline } from '../lib/store.svelte.js'

  let el
  let pilih = $state(paketSaya[0].kode)
  let semua = $state(false)
  let map, layer
  const aktif = $derived(paketSaya.find((p) => p.kode === pilih))
  const milik = new Set(paketSaya.map((p) => p.kode))

  const token = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim()

  const pin = (kode, terpilih) =>
    L.divIcon({
      className: '',
      html: `<span class="pin${terpilih ? ' pilih' : ''}">${kode}</span>`,
      iconSize: null,
      iconAnchor: [0, 0],
    })

  $effect(() => {
    map = L.map(el, { zoomControl: false }).setView([-6.6, 109.5], 7)
    L.control.zoom({ position: 'topright' }).addTo(map)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '© OpenStreetMap',
    }).addTo(map)
    layer = L.layerGroup().addTo(map)
    return () => map.remove()
  })

  // Redraw on selection or toggle. Other BOPPJ projects are location-only context, never selectable.
  $effect(() => {
    if (!layer) return
    layer.clearLayers()
    if (semua) {
      semuaProyek.filter((p) => !milik.has(p.kode)).forEach((p) =>
        L.circleMarker([p.lat, p.lng], { radius: 5, color: token('--color-muted'), weight: 1, fillColor: token('--color-card'), fillOpacity: 1, interactive: false }).addTo(layer))
    }
    paketSaya.forEach((p) =>
      L.marker([p.lat, p.lng], { icon: pin(p.kode, p.kode === pilih), title: `${p.kode} ${p.nama}`, keyboard: true, zIndexOffset: p.kode === pilih ? 1000 : 0 })
        .on('click', () => (pilih = p.kode)).addTo(layer))
    const t = paketSaya.find((p) => p.kode === pilih)
    map.flyTo([t.lat, t.lng], Math.max(map.getZoom(), 11), { duration: 0.4 })
  })
</script>

<Page title="Peta proyek saya" back="/" tab="proyek" penuh>
  <div class="wrap">
    <div bind:this={el} class="peta" role="region" aria-label="Peta lokasi proyek. Daftar proyek tersedia di panel bawah peta."></div>

    <section class="sheet card tumpuk" style="gap:var(--space-2xs)" aria-label="Proyek dipilih">
      {#if !isOnline()}<p class="peringatan wait" role="status"><Icon name="offline" size={20} /><span>Peta dasar butuh koneksi. Lokasi proyek tetap tercantum di sini.</span></p>{/if}
      <div class="chips" role="group" aria-label="Pilih proyek">
        {#each paketSaya as p}<button class="chip" aria-pressed={pilih === p.kode} onclick={() => (pilih = p.kode)}>{p.kode}</button>{/each}
        <button class="chip" aria-pressed={semua} onclick={() => (semua = !semua)}>Semua BOPPJ</button>
      </div>
      <div aria-live="polite" class="tumpuk" style="gap:var(--space-3xs)">
        <p class="kode">{aktif.kode} · {aktif.tahap}</p>
        <h2 class="judul-kartu">{aktif.nama}</h2>
        <p class="kecil muted">Lintang {aktif.lat.toFixed(2)}, bujur {aktif.lng.toFixed(2)} · {aktif.kabupaten}, {aktif.provinsi}</p>
      </div>
      <a class="btn utama" href={'#/proyek/' + aktif.kode}>Buka detail proyek</a>
    </section>
  </div>
</Page>

<style>
  .wrap { position: relative; flex: 1; display: flex; flex-direction: column; margin-top: calc(-1 * var(--radius-l)); }
  .peta { flex: 1; min-height: 22rem; background: var(--color-track); z-index: 0; }
  .sheet { position: relative; z-index: 500; margin: calc(-1 * var(--space-lg)) var(--space-xs) 7.5rem; box-shadow: 0 4px 14px oklch(20% .05 265 / .18); }
  :global(.pin) {
    display: inline-block; translate: -50% -50%; background: var(--color-navy); color: var(--color-on-navy); font: 700 var(--text-xs)/1 var(--font-body);
    padding: var(--space-2xs); border-radius: var(--radius-s); border: 2px solid var(--color-card); white-space: nowrap;
  }
  :global(.pin.pilih) { background: var(--color-gold); color: var(--color-navy); border-color: var(--color-navy); }
</style>
