<script>
  import Page from '../components/Page.svelte'
  import Icon from '../components/Icon.svelte'
  import FotoPicker from '../components/FotoPicker.svelte'
  import { app, paketSaya, kirimIsu, kabari } from '../lib/store.svelte.js'
  import { query } from '../lib/router.svelte.js'
  import { tglRelatif } from '../lib/format.js'

  let tab = $state('baru')
  let f = $state({ kode: query().kode ?? paketSaya[0].kode, judul: '', prioritas: 'Sedang', deskripsi: '' })
  let fotoIds = $state([])
  let galat = $state({})

  function kirim(e) {
    e.preventDefault()
    const g = {}
    if (f.judul.trim().length < 5) g.judul = 'Tuliskan judul isu minimal 5 karakter.'
    if (f.deskripsi.trim().length < 10) g.deskripsi = 'Jelaskan isu minimal 10 karakter.'
    galat = g
    if (Object.keys(g).length) return
    kirimIsu({ ...f, judul: f.judul.trim(), deskripsi: f.deskripsi.trim(), fotoIds: [...fotoIds] })
    kabari('Isu terkirim ke Analis Monitoring BOPPJ.')
    f.judul = ''; f.deskripsi = ''; fotoIds = []; tab = 'saya'
  }
</script>

<Page title="Lapor isu" back="/lainnya">
  <div class="chips" role="group" aria-label="Tampilan">
    <button class="chip" aria-pressed={tab === 'baru'} onclick={() => (tab = 'baru')}>Lapor baru</button>
    <button class="chip" aria-pressed={tab === 'saya'} onclick={() => (tab = 'saya')}>Isu saya ({app.isu.length})</button>
  </div>

  {#if tab === 'baru'}
    <form class="tumpuk" style="gap:var(--space-sm)" onsubmit={kirim} novalidate>
      <div class="field">
        <label for="i-kode">Proyek</label>
        <select id="i-kode" bind:value={f.kode}>{#each paketSaya as p}<option value={p.kode}>{p.kode} · {p.nama}</option>{/each}</select>
      </div>
      <div class="field">
        <label for="i-judul">Judul isu</label>
        <input id="i-judul" placeholder="contoh: Akses jalan terhambat" bind:value={f.judul} aria-invalid={galat.judul ? 'true' : undefined} aria-describedby={galat.judul ? 'e-judul' : undefined} />
        {#if galat.judul}<p id="e-judul" class="galat" role="alert">{galat.judul}</p>{/if}
      </div>
      <fieldset>
        <legend>Tingkat prioritas</legend>
        <div class="opsi-grup" style="margin-top:var(--space-2xs)">
          {#each ['Rendah', 'Sedang', 'Tinggi'] as n}
            <label class="opsi"><input type="radio" name="prio" value={n} bind:group={f.prioritas} /><span>{n}</span></label>
          {/each}
        </div>
      </fieldset>
      <div class="field">
        <label for="i-desk">Deskripsi</label>
        <textarea id="i-desk" placeholder="Jelaskan isu di lapangan" bind:value={f.deskripsi} aria-invalid={galat.deskripsi ? 'true' : undefined} aria-describedby={galat.deskripsi ? 'e-desk' : undefined}></textarea>
        {#if galat.deskripsi}<p id="e-desk" class="galat" role="alert">{galat.deskripsi}</p>{/if}
      </div>
      <div class="field">
        <span id="lbl-i-foto" class="tebal kecil">Foto pendukung (opsional)</span>
        <FotoPicker bind:ids={fotoIds} labelId="lbl-i-foto" />
      </div>
      <button class="btn utama" type="submit">Kirim laporan isu</button>
    </form>
  {:else}
    <div class="tumpuk">
      {#each app.isu as i (i.id)}
        <article class="card tumpuk" style="gap:var(--space-2xs)">
          <div class="baris sebar"><span class="kode">{i.kode} · {tglRelatif(i.tanggal)}</span>
            <span class="badge {i.prioritas === 'Tinggi' ? 'bad' : 'wait'}"><Icon name="isu" size={14} />{i.prioritas}</span></div>
          <h2 class="judul-kartu">{i.judul}</h2>
          <p class="sub">{i.deskripsi}</p>
          <p class="kecil"><b>Status:</b> {i.status}</p>
          {#if i.tanggapan}<p class="kecil muted">Tanggapan BOPPJ: {i.tanggapan}</p>{/if}
        </article>
      {:else}
        <div class="kosong"><strong>Belum ada isu</strong>Gunakan tab Lapor baru untuk melaporkan kendala lapangan.</div>
      {/each}
    </div>
  {/if}
</Page>
