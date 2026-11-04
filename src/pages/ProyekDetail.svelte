<script>
  import Page from '../components/Page.svelte'
  import Icon from '../components/Icon.svelte'
  import ProgressBar from '../components/ProgressBar.svelte'
  import KurvaS from '../components/KurvaS.svelte'
  import StatusBadge from '../components/StatusBadge.svelte'
  import { app, paketByKode, progresDiterima } from '../lib/store.svelte.js'
  import { deviasi, statusKesehatan } from '../lib/kurva.js'
  import { tglRelatif } from '../lib/format.js'

  let { kode } = $props()
  const p = $derived(paketByKode(kode))
  const prog = $derived(p ? progresDiterima(kode) : 0)
  const dev = $derived(p ? deviasi(p, prog) : 0)
  const sehat = $derived(statusKesehatan(dev))
  const terbaru = $derived(app.laporan.filter((l) => l.kode === kode).slice(0, 3))
</script>

<Page title={p?.kode ?? "Detail proyek"} back="/" tab="proyek">
  {#if !p}
    <div class="kosong"><strong>Proyek tidak ada dalam penugasan Anda</strong>Kembali ke daftar proyek.</div>
  {:else}
    <div class="tumpuk" style="gap:var(--space-2xs)">
      <div class="baris"><span class="tahap">{p.tahap}</span></div>
      <h2 style="font-size:var(--text-lg);line-height:1.25">{p.nama}</h2>
      <p class="sub">{p.lokasiKerja} · {p.kabupaten}, {p.provinsi}</p>
      <p class="kecil muted">Kontrak {p.kontrak}</p>
    </div>

    <section class="card tumpuk" aria-labelledby="h-prog">
      <h3 id="h-prog" class="judul-kartu">Realisasi terhadap rencana, Jun–Nov 2026</h3>
      <div class="baris" style="align-items:baseline;gap:var(--space-xs)">
        <span class="stat">{prog}%</span>
        <span class="muted kecil">terverifikasi · rencana {p.rencana.at(-1)}%</span>
      </div>
      <ProgressBar nilai={prog} rencana={p.rencana.at(-1)} label="Progres {p.kode}" />
      <KurvaS paket={p} progres={prog} />
      <p class="baris kecil" style="gap:var(--space-2xs)">
        <span class="badge {sehat.kode === 'SESUAI' ? 'ok' : sehat.kode === 'WASPADA' ? 'wait' : 'bad'}">{sehat.label}</span>
        <span>Selisih {dev > 0 ? '+' : ''}{dev} poin dari rencana.</span>
      </p>
      <p class="bantu">Hanya laporan berstatus Diterima yang dihitung ke progres.</p>
    </section>

    <div class="dua">
      <a class="btn utama" href={'#/input?kode=' + p.kode}><Icon name="input" size={20} />Input progres</a>
      <a class="btn" href={'#/isu?kode=' + p.kode}><Icon name="isu" size={20} />Lapor isu</a>
    </div>

    <section class="tumpuk" aria-labelledby="h-lap">
      <h3 id="h-lap" class="judul-kartu">Laporan terbaru</h3>
      {#each terbaru as l (l.id)}
        <a class="card tumpuk" href={'#/riwayat/' + l.id} style="gap:var(--space-2xs)">
          <div class="baris sebar"><span class="tebal">{tglRelatif(l.tanggal)}</span><StatusBadge status={l.status} /></div>
          <p class="kecil muted">Progres {l.progres}% · {l.cuaca} · {l.tenaga} pekerja</p>
        </a>
      {:else}
        <p class="kosong">Belum ada laporan untuk proyek ini.</p>
      {/each}
    </section>
  {/if}
</Page>
