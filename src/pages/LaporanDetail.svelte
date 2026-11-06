<script>
  import Page from '../components/Page.svelte'
  import Icon from '../components/Icon.svelte'
  import Foto from '../components/Foto.svelte'
  import StatusBadge from '../components/StatusBadge.svelte'
  import { app, proyekByKode, sinkron, isOnline } from '../lib/store.svelte.js'
  import { tgl, angka } from '../lib/format.js'

  let { id } = $props()
  const l = $derived(app.laporan.find((x) => x.id === id))
  const fotoContoh = $derived((l?.evidenceRefs ?? []).filter((ref) => ref.url).map((ref) => ref.url))
</script>

<Page title="Detail laporan" back="/riwayat" tab="riwayat">
  {#if !l}
    <div class="kosong"><strong>Laporan tidak ditemukan</strong><a href="#/riwayat">Kembali ke riwayat</a></div>
  {:else}
    <div class="tumpuk" style="gap:var(--space-2xs)">
      <div class="baris sebar"><span class="kode">{l.kode} · versi {l.versi}</span><StatusBadge status={l.status} /></div>
      <h2 style="font-size:var(--text-lg)">{proyekByKode(l.kode)?.nama ?? l.kode}</h2>
      <p class="sub">Laporan tanggal {tgl(l.tanggal)}</p>
    </div>

    {#if l.status === 'ANTRE'}
      <p class="peringatan wait"><Icon name="offline" size={20} /><span>Laporan tersimpan di perangkat dan dikirim saat sinyal kembali.</span></p>
    {/if}
    <p class="bantu">Status Diterima berarti terverifikasi monitoring, bukan persetujuan pembayaran.</p>
    {#if l.legacyUnmapped}<p class="peringatan wait">Laporan dari sesi sebelumnya. Status bukan bukti pengiriman.</p>{/if}
    {#if l.syncError}
      <p class="peringatan bad" role="alert">Antrean belum tersinkron: {l.syncError}</p>
      <button class="btn" disabled={!isOnline()} onclick={sinkron}>Coba sinkron ulang</button>
    {/if}
    {#if l.status === 'DITOLAK' && !l.legacyUnmapped}
      <section class="peringatan bad" aria-label="Catatan verifikator">
        <Icon name="x" size={20} />
        <div><p>Input ditolak verifikator</p><p>{l.catatan}</p></div>
      </section>
      <a class="btn utama" href={'#/revisi/' + l.id}>Perbaiki dan kirim ulang</a>
    {:else if l.status === 'DITERIMA' && !l.legacyUnmapped}
      <a class="btn" href={'#/revisi/' + l.id}>Koreksi laporan</a>
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

    {#if l.riwayatVersi?.length > 1}
      <section class="card tumpuk" aria-labelledby="h-revisi">
        <h3 id="h-revisi" class="judul-kartu">Riwayat revisi</h3>
        <ol>
          {#each l.riwayatVersi as revisi}
            <li><strong>Versi {revisi.revisionNumber ?? revisi.versi} · {revisi.progres}%</strong><p>{revisi.uraian}</p>{#if revisi.reason}<p class="bantu">Alasan koreksi: {revisi.reason}</p>{/if}</li>
          {/each}
        </ol>
      </section>
    {/if}
    <section class="tumpuk" aria-labelledby="h-foto">
      <h3 id="h-foto" class="judul-kartu">Foto lapangan</h3>
      {#if l.fotoIds.length}
        <div class="foto-grid">{#each l.fotoIds as fid, i}<Foto id={fid} alt="Foto lapangan {i + 1}" />{/each}</div>
      {:else if fotoContoh.length}
        <div class="foto-grid">
          {#each fotoContoh as url, i}
            <a href={import.meta.env.BASE_URL + url} target="_blank" rel="noopener"><img src={import.meta.env.BASE_URL + url} alt="Foto lapangan {i + 1} (contoh)" loading="lazy" /></a>
          {/each}
        </div>
        <p class="bantu">Foto contoh ilustratif.</p>
      {:else if l.foto}
        <div class="foto-grid">{#each Array(l.foto) as _, i}<div class="foto"><span>Foto contoh {i + 1}</span></div>{/each}</div>
        <p class="bantu">Data contoh: foto tidak disertakan pada prototipe.</p>
      {:else}
        <p class="bantu">Tidak ada foto tersimpan di perangkat.</p>
      {/if}
    </section>
  {/if}
</Page>
