<script>
  import Page from '../components/Page.svelte'
  import Icon from '../components/Icon.svelte'
  import FotoPicker from '../components/FotoPicker.svelte'
  import {
    app, paketSaya, progresDiterima, laporanAktifPada, kirimLaporan, revisiLaporan, kabari, isOnline,
  } from '../lib/store.svelte.js'
  import { query, go } from '../lib/router.svelte.js'
  import { isoHariIni, tgl } from '../lib/format.js'

  let { revisiId } = $props()
  // The route remounts this page per revisiId, so reading it once is intended.
  // svelte-ignore state_referenced_locally
  const lama = revisiId ? app.laporan.find((l) => l.id === revisiId) : null
  const kodeAwal = lama?.kode ?? query().kode ?? paketSaya[0].kode
  const SATUAN = ['m³', 'm²', 'm', 'ton', 'titik']
  const CUACA = [['Cerah', 'cerah'], ['Berawan', 'berawan'], ['Hujan', 'hujan']]

  // Smart defaults: today, last weather, last unit. Revision starts from the rejected values.
  let f = $state({
    kode: kodeAwal,
    tanggal: lama?.tanggal ?? isoHariIni(),
    progres: lama ? String(lama.progres) : '',
    volume: lama ? String(lama.volume) : '',
    satuan: lama?.satuan ?? app.satuanTerakhir,
    uraian: lama?.uraian ?? '',
    cuaca: lama?.cuaca ?? app.cuacaTerakhir,
    tenaga: lama ? String(lama.tenaga) : '',
  })
  let fotoIds = $state([])
  let dicoba = $state(false)
  let ringkas = $state([])
  let kirimDiklik = $state(false)

  const diterima = $derived(progresDiterima(f.kode))
  const regresi = $derived(f.progres !== '' && Number(f.progres) < diterima)
  const fotoLama = lama?.foto ?? 0

  function validasi() {
    const e = {}
    const kini = isoHariIni()
    if (!f.tanggal) e.tanggal = 'Pilih tanggal laporan.'
    else if (f.tanggal > kini) e.tanggal = 'Tanggal tidak boleh di masa depan.'
    else if (f.tanggal < isoHariIni(-7)) e.tanggal = 'Laporan hanya dapat dikirim untuk 7 hari terakhir.'
    else if (laporanAktifPada(f.kode, f.tanggal, revisiId)) e.tanggal = `Laporan ${f.kode} tanggal ${tgl(f.tanggal)} sudah ada dan masih berjalan.`
    const p = Number(f.progres)
    if (f.progres === '' || Number.isNaN(p) || p < 0 || p > 100) e.progres = 'Isi angka antara 0 dan 100.'
    const v = Number(f.volume)
    if (f.volume === '' || Number.isNaN(v) || v < 0) e.volume = 'Isi volume pekerjaan hari ini (0 jika tidak ada).'
    if (f.uraian.trim().length < 10) e.uraian = 'Tuliskan kegiatan minimal 10 karakter.'
    const t = Number(f.tenaga)
    if (f.tenaga === '' || !Number.isInteger(t) || t < 0) e.tenaga = 'Isi jumlah tenaga kerja sebagai bilangan bulat.'
    if (fotoIds.length + fotoLama < 1) e.foto = 'Tambahkan minimal satu foto lapangan.'
    return e
  }

  function geser(d) {
    const dasar = f.progres === '' ? diterima : Number(f.progres)
    f.progres = String(Math.min(100, Math.max(0, +(dasar + d).toFixed(1))))
  }

  async function kirim(e) {
    e.preventDefault()
    if (kirimDiklik) return
    dicoba = true
    const g = validasi()
    if (Object.keys(g).length) {
      ringkas = Object.keys(g)
      queueMicrotask(() => document.getElementById('ringkas-galat')?.focus())
      return
    }
    kirimDiklik = true
    const data = {
      kode: f.kode, tanggal: f.tanggal, progres: Number(f.progres), volume: Number(f.volume), satuan: f.satuan,
      uraian: f.uraian.trim(), cuaca: f.cuaca, tenaga: Number(f.tenaga), fotoIds: [...(lama?.fotoIds ?? []), ...fotoIds],
      anomali: regresi ? [`Progres ${Number(f.progres)}% lebih rendah dari progres diterima (${diterima}%)`] : [],
    }
    let id = revisiId
    if (revisiId) revisiLaporan(revisiId, data)
    else id = kirimLaporan(data)
    kabari(isOnline() ? 'Laporan terkirim, menunggu verifikasi.' : 'Tidak ada koneksi. Laporan antre dan terkirim otomatis.')
    go('/riwayat/' + id)
  }

  // Field errors revalidate live after the first submit; the summary only shrinks, so screen readers are not re-announced per keystroke.
  const galat = $derived(dicoba ? validasi() : {})
  const daftarGalat = $derived(ringkas.filter((k) => galat[k]).map((k) => galat[k]))
</script>

<Page title={revisiId ? 'Revisi input' : 'Input progres'} sub={revisiId ? undefined : 'Isi sekali sehari, selesai dalam 2 menit.'} back={revisiId ? '/riwayat' : undefined} tab={revisiId ? undefined : 'input'}>
  {#if revisiId && !lama}
    <div class="kosong"><strong>Laporan tidak ditemukan</strong><a href="#/riwayat">Kembali ke riwayat</a></div>
  {:else}
    {#if lama?.status === 'DITOLAK'}
      <section class="peringatan bad" aria-label="Catatan verifikator" style="margin-bottom:var(--space-sm)">
        <Icon name="x" size={20} />
        <div><p>Input ditolak verifikator</p><p>Catatan verifikator: {lama.catatan}</p></div>
      </section>
    {/if}

    <form class="tumpuk" style="gap:var(--space-sm)" onsubmit={kirim} novalidate>
      {#if daftarGalat.length}
        <div id="ringkas-galat" class="peringatan bad" role="alert" tabindex="-1">
          <Icon name="isu" size={20} />
          <div><p>{daftarGalat.length} isian perlu diperbaiki:</p>
            <ul style="margin:var(--space-3xs) 0 0;padding-left:1.1rem;font-weight:400">{#each daftarGalat as m}<li>{m}</li>{/each}</ul></div>
        </div>
      {/if}

      <section class="card tumpuk" aria-labelledby="s-proyek">
        <h2 id="s-proyek" class="judul-kartu">Proyek dan tanggal</h2>
        <div class="field">
          <label for="kode">Proyek</label>
          <select id="kode" bind:value={f.kode} disabled={!!revisiId}>
            {#each paketSaya as p}<option value={p.kode}>{p.kode} · {p.nama}</option>{/each}
          </select>
        </div>
        <div class="field">
          <label for="tgl">Tanggal laporan</label>
          <input id="tgl" type="date" bind:value={f.tanggal} min={isoHariIni(-7)} max={isoHariIni()} aria-invalid={galat.tanggal ? 'true' : undefined} aria-describedby={galat.tanggal ? 'e-tgl' : undefined} />
          {#if galat.tanggal}<p id="e-tgl" class="galat">{galat.tanggal}</p>{/if}
        </div>
      </section>

      <section class="card tumpuk" aria-labelledby="s-capaian">
        <h2 id="s-capaian" class="judul-kartu">Capaian hari ini</h2>
        <div class="field">
          <label for="prog">Progres kumulatif (%)</label>
          <div class="stepper">
            <button type="button" aria-label="Kurangi 1 persen" onclick={() => geser(-1)}><Icon name="minus" /></button>
            <input id="prog" inputmode="decimal" type="number" min="0" max="100" step="0.1" placeholder={String(diterima)} bind:value={f.progres} aria-invalid={galat.progres ? 'true' : undefined} aria-describedby={galat.progres ? 'prog-bantu e-prog' : 'prog-bantu'} />
            <button type="button" aria-label="Tambah 1 persen" onclick={() => geser(1)}><Icon name="plus" /></button>
          </div>
          <p id="prog-bantu" class="bantu">Terverifikasi terakhir: <b>{diterima}%</b>.</p>
          {#if galat.progres}<p id="e-prog" class="galat">{galat.progres}</p>{/if}
        </div>
        {#if regresi}
          <p class="peringatan wait" role="status"><Icon name="isu" size={20} /><span>Progres lebih rendah dari {diterima}%. Laporan tetap dapat dikirim dan akan ditandai untuk diperiksa. Jelaskan alasannya pada uraian.</span></p>
        {/if}
        <div class="dua">
          <div class="field">
            <label for="vol">Volume hari ini</label>
            <input id="vol" inputmode="decimal" type="number" min="0" step="any" placeholder="contoh: 120" bind:value={f.volume} aria-invalid={galat.volume ? 'true' : undefined} aria-describedby={galat.volume ? 'e-vol' : undefined} />
          </div>
          <div class="field">
            <label for="sat">Satuan</label>
            <select id="sat" bind:value={f.satuan}>{#each SATUAN as s}<option>{s}</option>{/each}</select>
          </div>
        </div>
        {#if galat.volume}<p id="e-vol" class="galat">{galat.volume}</p>{/if}
        <div class="field">
          <label for="ur">Uraian kegiatan</label>
          <textarea id="ur" placeholder="Tuliskan kegiatan yang dikerjakan" bind:value={f.uraian} aria-invalid={galat.uraian ? 'true' : undefined} aria-describedby={galat.uraian ? 'e-ur' : undefined}></textarea>
          {#if galat.uraian}<p id="e-ur" class="galat">{galat.uraian}</p>{/if}
        </div>
      </section>

      <section class="card tumpuk" aria-labelledby="s-kondisi">
        <h2 id="s-kondisi" class="judul-kartu">Kondisi lapangan</h2>
        <fieldset>
          <legend>Cuaca</legend>
          <div class="opsi-grup" style="margin-top:var(--space-2xs)">
            {#each CUACA as [nama, ikon]}
              <label class="opsi"><input type="radio" name="cuaca" value={nama} bind:group={f.cuaca} /><span><Icon name={ikon} size={18} />{nama}</span></label>
            {/each}
          </div>
        </fieldset>
        <div class="field">
          <label for="tk">Jumlah tenaga kerja</label>
          <input id="tk" inputmode="numeric" type="number" min="0" step="1" placeholder="0" bind:value={f.tenaga} aria-invalid={galat.tenaga ? 'true' : undefined} aria-describedby={galat.tenaga ? 'e-tk' : undefined} />
          {#if galat.tenaga}<p id="e-tk" class="galat">{galat.tenaga}</p>{/if}
        </div>
      </section>

      <section class="card tumpuk" aria-labelledby="lbl-foto">
        <h2 id="lbl-foto" class="judul-kartu">Foto lapangan</h2>
        {#if fotoLama}<p class="bantu">{fotoLama} foto contoh dari laporan sebelumnya. Tambahkan foto baru untuk menggantinya.</p>{/if}
        <FotoPicker bind:ids={fotoIds} galat={galat.foto} labelId="lbl-foto" />
      </section>

      <button class="btn utama" type="submit" disabled={kirimDiklik}>{revisiId ? 'Kirim ulang' : 'Kirim progres'}</button>
      {#if revisiId}<a class="btn" href="#/riwayat">Batal</a>{/if}
    </form>
  {/if}
</Page>

<style>
  .stepper input::-webkit-inner-spin-button, .stepper input::-webkit-outer-spin-button { appearance: none; margin: 0; }
  .stepper input { appearance: textfield; -moz-appearance: textfield; }
</style>
