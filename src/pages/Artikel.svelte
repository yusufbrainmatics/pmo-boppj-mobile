<script>
  import Page from '../components/Page.svelte'
  import data from '../data/pengetahuan.json'
  import { isoHariIni, tgl } from '../lib/format.js'

  let { id } = $props()
  const a = $derived(data.find((x) => x.id === id))
</script>

<Page title={a?.jenis ?? 'Pengetahuan'} back="/pengetahuan" tab="buku">
  {#if !a}
    <div class="kosong"><strong>Artikel tidak ditemukan</strong><a href="#/pengetahuan">Kembali ke Pengetahuan</a></div>
  {:else}
    <p class="kode">{a.jenis} · {tgl(isoHariIni(a.offset))}</p>
    <h2 style="font-size:var(--text-lg);line-height:1.25">{a.judul}</h2>
    <article class="card tumpuk">
      {#each a.isi as para}<p>{para}</p>{/each}
    </article>
    <p class="kecil muted">Konten contoh (ilustratif) untuk prototipe.</p>
  {/if}
</Page>
