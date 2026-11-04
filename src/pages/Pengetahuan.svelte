<script>
  import Page from '../components/Page.svelte'
  import Icon from '../components/Icon.svelte'
  import data from '../data/pengetahuan.json'
  import { app } from '../lib/store.svelte.js'
  import { isoHariIni, tgl } from '../lib/format.js'
  import { query } from '../lib/router.svelte.js'

  const JENIS = ['Semua', 'Panduan', 'Tanya jawab', 'Lesson learned']
  // A deep link (?jenis=) lets Tanya land the user on their own question after sending.
  const awal = query().jenis
  let jenis = $state(JENIS.includes(awal) ? awal : 'Panduan')
  let cari = $state('')

  const tanggal = (offset) => isoHariIni(offset)
  const kueri = $derived(cari.trim().toLowerCase())
  const daftar = $derived(
    data.filter((a) => (jenis === 'Semua' || a.jenis === jenis) &&
      (!kueri || (a.judul + a.ringkas + a.isi.join(' ')).toLowerCase().includes(kueri))),
  )
  const milik = $derived(
    app.tanya.filter((q) => (jenis === 'Semua' || jenis === 'Tanya jawab') && (!kueri || (q.judul + q.isi).toLowerCase().includes(kueri))),
  )
</script>

<Page title="Pengetahuan" sub="Panduan, tanya jawab, dan pelajaran lapangan" tab="buku">
  <div class="field">
    <label for="cari" class="sr">Cari panduan, pertanyaan, atau pelajaran</label>
    <div style="position:relative">
      <input id="cari" type="search" placeholder="Cari panduan atau pertanyaan" bind:value={cari} style="padding-left:2.5rem" />
      <span style="position:absolute;left:.75rem;top:50%;transform:translateY(-50%);color:var(--color-muted)"><Icon name="cari" size={20} /></span>
    </div>
  </div>
  <div class="chips" role="group" aria-label="Jenis konten">
    {#each JENIS as j}<button class="chip" aria-pressed={jenis === j} onclick={() => (jenis = j)}>{j}</button>{/each}
  </div>

  <div class="tumpuk">
    {#each milik as q (q.id)}
      <article class="card tumpuk" style="gap:var(--space-3xs)">
        <p class="kode">Pertanyaan saya · {tgl(q.tanggal)}</p>
        <h2 class="judul-kartu">{q.judul}</h2>
        <p class="kecil muted">{q.isi}</p>
        <span class="badge wait" style="align-self:flex-start"><Icon name="jam" size={14} />Menunggu jawaban Analis</span>
      </article>
    {/each}
    {#each daftar as a (a.id)}
      <a class="card tumpuk" href={'#/pengetahuan/' + a.id} style="gap:var(--space-3xs)">
        <p class="kode">{a.jenis} · {tgl(tanggal(a.offset))}</p>
        <h2 class="judul-kartu">{a.judul}</h2>
        <p class="kecil muted">{a.ringkas}</p>
      </a>
    {/each}
    {#if !daftar.length && !milik.length}
      <div class="kosong"><strong>Tidak ada hasil</strong>Coba kata kunci lain atau pilih jenis "Semua".</div>
    {/if}
  </div>
  <p class="kecil muted">Konten di atas adalah contoh (ilustratif) untuk prototipe.</p>

  <a class="btn utama" href="#/tanya"><Icon name="plus" size={20} />Tulis baru</a>
</Page>
