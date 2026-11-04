<script>
  import Page from '../components/Page.svelte'
  import StatusBadge from '../components/StatusBadge.svelte'
  import { app } from '../lib/store.svelte.js'
  import { tglRelatif } from '../lib/format.js'

  const FILTER = [['SEMUA', 'Semua'], ['MENUNGGU', 'Menunggu'], ['DITERIMA', 'Diterima'], ['DITOLAK', 'Ditolak']]
  let aktif = $state('SEMUA')

  // "Menunggu" covers queued-offline reports too: both are not yet verified.
  const cocok = (l, k) => k === 'SEMUA' || l.status === k || (k === 'MENUNGGU' && l.status === 'ANTRE')
  const urut = $derived([...app.laporan].sort((a, b) => b.tanggal.localeCompare(a.tanggal)))
  const tampil = $derived(urut.filter((l) => cocok(l, aktif)))
  const grup = $derived(
    tampil.reduce((acc, l) => {
      const g = acc.find((x) => x.tanggal === l.tanggal)
      g ? g.baris.push(l) : acc.push({ tanggal: l.tanggal, baris: [l] })
      return acc
    }, []),
  )
</script>

<Page title="Riwayat input" sub="{app.laporan.length} laporan terkirim" tab="riwayat">
  <div class="segmen" role="group" aria-label="Filter status">
    {#each FILTER as [k, label]}
      <button aria-pressed={aktif === k} onclick={() => (aktif = k)}><b>{app.laporan.filter((l) => cocok(l, k)).length}</b>{label}</button>
    {/each}
  </div>

  {#each grup as g (g.tanggal)}
    <section class="tumpuk" aria-label={tglRelatif(g.tanggal)}>
      <h2 class="tgl-grup">{tglRelatif(g.tanggal)}</h2>
      {#each g.baris as l (l.id)}
        <a class="card tumpuk" href={'#/riwayat/' + l.id} style="gap:var(--space-3xs)">
          <div class="baris sebar"><span class="kode">{l.kode}</span><StatusBadge status={l.status} /></div>
          <p class="tebal">Progres {l.progres}% · {l.cuaca} · {l.tenaga} pekerja</p>
          {#if l.status === 'DITOLAK'}<span class="kecil" style="color:var(--color-bad);font-weight:700;text-decoration:underline">Lihat catatan dan revisi</span>{/if}
        </a>
      {/each}
    </section>
  {:else}
    <div class="kosong"><strong>Belum ada laporan di filter ini</strong>Kirim laporan harian dari tombol Input.</div>
  {/each}
</Page>
