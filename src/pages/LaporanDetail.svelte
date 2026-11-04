<script>
  import Page from '../components/Page.svelte'
  import Icon from '../components/Icon.svelte'
  import Foto from '../components/Foto.svelte'
  import StatusBadge from '../components/StatusBadge.svelte'
  import { app, proyekByKode } from '../lib/store.svelte.js'
  import { tgl, angka } from '../lib/format.js'

  let { id } = $props()
  const l = $derived(app.laporan.find((x) => x.id === id))
</script>

<Page title="Detail laporan" back="/riwayat" tab="riwayat">
  {#if !l}
    <div class="kosong"><strong>Laporan tidak ditemukan</strong><a href="#/riwayat">Kembali ke riwayat</a></div>
  {:else}
    <div class="tumpuk" style="gap:var(--space-2xs)">
      <div class="baris sebar"><span class="kode">{l.kode} · versi {l.versi}</span><StatusBadge status={l.status} /></div>
      <h2 style="font-size:var(--text-lg)">{proyekByKode(l.kode).nama}</h2>
      <p class="sub">Laporan tanggal {tgl(l.tanggal)}</p>
    </div>

    {#if l.status === 'ANTRE'}
      <p class="peringatan wait"><Icon name="offline" size={20} /><span>Laporan tersimpan di perangkat dan dikirim saat sinyal kembali.</span></p>
    {/if}
    {#if l.status === 'DITOLAK'}
      <section class="peringatan bad" aria-label="Catatan verifikator">
        <Icon name="x" size={20} />
        <div><p>Input ditolak verifikator</p><p>{l.catatan}</p></div>
      </section>
      <a class="btn utama" href={'#/revisi/' + l.id}>Perbaiki dan kirim ulang</a>
    {/if}
    {#if l.anomali?.length}
      <p class="peringatan wait"><Icon name="isu" size={20} /><span>Ditandai untuk diperiksa: {l.anomali.join('; ')}.</span></p>
    {/if}

    <section class="card tumpuk">
      <dl class="rinci">
        <dt>Progres kumulatif</dt><dd>{l.progres}%</dd>
        <dt>Volume hari ini</dt><dd>{angka(l.volume)} {l.satuan}</dd>
        <dt>Cuaca</dt><dd>{l.cuaca}</dd>
        <dt>Tenaga kerja</dt><dd>{l.tenaga} orang</dd>
      </dl>
      <div><p class="kecil muted">Uraian kegiatan</p><p>{l.uraian}</p></div>
    </section>

    <section class="tumpuk" aria-labelledby="h-foto">
      <h3 id="h-foto" class="judul-kartu">Foto lapangan</h3>
      {#if l.fotoIds.length}
        <div class="foto-grid">{#each l.fotoIds as fid, i}<Foto id={fid} alt="Foto lapangan {i + 1}" />{/each}</div>
      {:else if l.foto}
        <div class="foto-grid">{#each Array(l.foto) as _, i}<div class="foto"><span>Foto contoh {i + 1}</span></div>{/each}</div>
        <p class="bantu">Data contoh: foto tidak disertakan pada prototipe.</p>
      {:else}
        <p class="bantu">Tidak ada foto tersimpan di perangkat.</p>
      {/if}
    </section>
  {/if}
</Page>
