<script>
  import { tick } from 'svelte'
  import { nav, path, go } from './lib/router.svelte.js'
  import { app, toast } from './lib/store.svelte.js'
  import Login from './pages/Login.svelte'
  import Proyek from './pages/Proyek.svelte'
  import ProyekDetail from './pages/ProyekDetail.svelte'
  import Input from './pages/Input.svelte'
  import Riwayat from './pages/Riwayat.svelte'
  import LaporanDetail from './pages/LaporanDetail.svelte'
  import Isu from './pages/Isu.svelte'
  import Peta from './pages/Peta.svelte'
  import Pengetahuan from './pages/Pengetahuan.svelte'
  import Artikel from './pages/Artikel.svelte'
  import Tanya from './pages/Tanya.svelte'
  import Lainnya from './pages/Lainnya.svelte'

  const ROUTES = [
    [/^\/$/, Proyek, []],
    [/^\/proyek\/([^/]+)$/, ProyekDetail, ['kode']],
    [/^\/input$/, Input, []],
    [/^\/revisi\/([^/]+)$/, Input, ['revisiId']],
    [/^\/riwayat$/, Riwayat, []],
    [/^\/riwayat\/([^/]+)$/, LaporanDetail, ['id']],
    [/^\/isu$/, Isu, []],
    [/^\/peta$/, Peta, []],
    [/^\/pengetahuan$/, Pengetahuan, []],
    [/^\/pengetahuan\/([^/]+)$/, Artikel, ['id']],
    [/^\/tanya$/, Tanya, []],
    [/^\/lainnya$/, Lainnya, []],
  ]

  const cocok = $derived.by(() => {
    const p = path()
    for (const [re, comp, names] of ROUTES) {
      const m = p.match(re)
      if (m) return { comp, params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) }
    }
    return null
  })

  // Guard: signed-out users only see /login; signed-in users never land on it.
  $effect(() => {
    if (!app.user && path() !== '/login') go('/login')
    else if (app.user && path() === '/login') go('/')
  })

  // Move focus to the page heading on navigation so keyboard and screen-reader users start at the top.
  $effect(() => {
    nav.raw
    tick().then(() => {
      scrollTo(0, 0)
      document.querySelector('.hdr h1, main h1')?.focus({ preventScroll: true })
    })
  })
</script>

<div class="app">
  {#if path() === '/login'}
    <Login />
  {:else if app.user && cocok}
    {#key nav.raw}
      <cocok.comp {...cocok.params} />
    {/key}
  {:else if app.user}
    <main>
      <h1 tabindex="-1">Halaman tidak ditemukan</h1>
      <a class="btn utama" href="#/">Kembali ke Proyek Saya</a>
    </main>
  {/if}
  {#if toast.pesan}<div class="toast" role="status" aria-live="polite">{toast.pesan}</div>{/if}
</div>
