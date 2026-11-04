<script>
  import Page from '../components/Page.svelte'
  import Icon from '../components/Icon.svelte'
  import ProgressBar from '../components/ProgressBar.svelte'
  import { app, paketSaya, progresDiterima, statusHariIni } from '../lib/store.svelte.js'
  import { deviasi, statusKesehatan } from '../lib/kurva.js'
  import { tgl, isoHariIni } from '../lib/format.js'

  const SEL = { SUDAH: ['ok', 'check', 'Sudah lapor'], BELUM: ['wait', 'jam', 'Belum lapor'], REVISI: ['bad', 'x', 'Perlu revisi'] }
  const status = $derived(paketSaya.map((p) => ({ p, s: statusHariIni(p.kode) })))
  const sudah = $derived(status.filter(({ s }) => s.kode === 'SUDAH').length)
  // First thing that needs the contractor: a rejected report beats a missing one.
  const berikut = $derived(status.find(({ s }) => s.kode === 'REVISI') ?? status.find(({ s }) => s.kode === 'BELUM'))
  const tujuan = $derived(
    !berikut ? '' : berikut.s.kode === 'REVISI' ? '#/revisi/' + berikut.s.laporan.id : '#/input?kode=' + berikut.p.kode,
  )
</script>

<Page title="Proyek Saya" sub="{app.user.perusahaan} · {paketSaya.length} proyek" tab="proyek">
  <section class="card tumpuk" aria-labelledby="h-hari">
    <div class="baris sebar" style="align-items:flex-start">
      <div>
        <p class="kecil muted">Laporan hari ini · {tgl(isoHariIni())}</p>
        <h2 id="h-hari" class="stat" style="margin-top:var(--space-3xs)">{sudah}<span class="muted" style="font-size:var(--text-lg);font-weight:700;margin-left:var(--space-2xs)">dari {paketSaya.length}</span></h2>
      </div>
      <span class="tahap baris" style="gap:var(--space-3xs)"><Icon name="jam" size={14} />Batas 20.00 WIB</span>
    </div>
    <div class="sel-hari">
      {#each status as { p, s }}
        {@const [warna, ikon, teks] = SEL[s.kode]}
        <span class="sel {warna}"><Icon name={ikon} size={16} /><b>{p.kode}</b>{teks}</span>
      {/each}
    </div>
    {#if berikut}
      <a class="btn utama" href={tujuan}><Icon name="lapor" size={20} />{berikut.s.kode === 'REVISI' ? 'Perbaiki' : 'Lapor'} {berikut.p.kode}</a>
    {:else}
      <p class="peringatan info"><Icon name="check" size={20} />Semua proyek sudah lapor hari ini.</p>
    {/if}
  </section>

  <div class="tumpuk">
    {#each status as { p, s } (p.kode)}
      {@const prog = progresDiterima(p.kode)}
      {@const sehat = statusKesehatan(deviasi(p, prog))}
      <a class="card tumpuk" href={'#/proyek/' + p.kode} style="gap:var(--space-2xs)">
        <div class="baris sebar"><span class="kode">{p.kode}</span><span class="tahap">{p.tahap}</span></div>
        <h2 class="judul-kartu">{p.nama}</h2>
        <div class="baris sebar">
          <span><b class="tebal" style="font-size:var(--text-lg)">{prog}%</b> <span class="kecil muted">terverifikasi</span></span>
          <span class="badge {sehat.kode === 'SESUAI' ? 'ok' : sehat.kode === 'WASPADA' ? 'wait' : 'bad'}">{sehat.label}</span>
        </div>
        <ProgressBar nilai={prog} rencana={p.rencana.at(-1)} label="Progres {p.kode}" />
        <p class="kecil muted">Garis hitam: rencana {p.rencana.at(-1)}%</p>
        <div class="kartu-aksi">
          {#if s.kode === 'BELUM'}
            <span class="perlu"><span class="titik-emas" aria-hidden="true">!</span>Belum input hari ini</span>
          {:else if s.kode === 'SUDAH'}
            <span class="perlu ok"><Icon name="check" size={18} />Sudah input hari ini</span>
          {:else}
            <span class="perlu bad"><Icon name="x" size={18} />Revisi input diperlukan</span>
          {/if}
          <Icon name="panah" size={18} />
        </div>
      </a>
    {/each}
  </div>

  <p class="kecil muted">Data contoh (ilustratif) untuk prototipe. Nama dan koordinat proyek bukan data resmi BOPPJ.</p>
</Page>
