<script>
  import Page from '../components/Page.svelte'
  import { kirimTanya, kabari } from '../lib/store.svelte.js'
  import { go } from '../lib/router.svelte.js'

  let judul = $state('')
  let isi = $state('')
  let galat = $state({})

  function kirim(e) {
    e.preventDefault()
    const g = {}
    if (judul.trim().length < 5) g.judul = 'Tuliskan pertanyaan singkat minimal 5 karakter.'
    if (isi.trim().length < 10) g.isi = 'Jelaskan pertanyaan minimal 10 karakter.'
    galat = g
    if (Object.keys(g).length) return
    kirimTanya({ judul: judul.trim(), isi: isi.trim() })
    kabari('Pertanyaan terkirim ke Analis Monitoring BOPPJ.')
    go('/pengetahuan?jenis=' + encodeURIComponent('Tanya jawab'))
  }
</script>

<Page title="Tulis pertanyaan" back="/pengetahuan" tab="buku">
  <form class="tumpuk" style="gap:var(--space-sm)" onsubmit={kirim} novalidate>
    <div class="field">
      <label for="q-judul">Pertanyaan singkat</label>
      <input id="q-judul" placeholder="contoh: Bagaimana melaporkan lembur malam?" bind:value={judul} aria-invalid={galat.judul ? 'true' : undefined} aria-describedby={galat.judul ? 'e-qj' : undefined} />
      {#if galat.judul}<p id="e-qj" class="galat" role="alert">{galat.judul}</p>{/if}
    </div>
    <div class="field">
      <label for="q-isi">Detail</label>
      <textarea id="q-isi" bind:value={isi} aria-invalid={galat.isi ? 'true' : undefined} aria-describedby={galat.isi ? 'e-qi' : undefined}></textarea>
      {#if galat.isi}<p id="e-qi" class="galat" role="alert">{galat.isi}</p>{/if}
    </div>
    <p class="bantu">Analis Monitoring BOPPJ akan menjawab. Jawaban yang umum dapat diterbitkan sebagai FAQ tanpa nama.</p>
    <button class="btn utama" type="submit">Kirim pertanyaan</button>
  </form>
</Page>
