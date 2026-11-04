<script>
  import Icon from './Icon.svelte'
  import { back } from '../lib/router.svelte.js'
  import { app, isOnline } from '../lib/store.svelte.js'

  // back: fallback path for the compact (detail) header. tab: current bottom-nav item.
  // Pages with a surface as first child overlap the large header via `tarik`.
  let { title, sub, back: kembali, tab, tarik = !!tab && !kembali, penuh = false, children, aksi } = $props()
</script>

<header class="hdr {kembali ? 'kecil' : 'besar'}">
  <svg class="ombak" viewBox="0 0 240 64" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" aria-hidden="true">
    <path d="M0 18c40-26 80-26 120 0s80 26 120 0M0 44c40-26 80-26 120 0s80 26 120 0" />
  </svg>
  <div class="hdr-bar">
    {#if kembali}
      <button class="bulat" onclick={() => back(kembali)} aria-label="Kembali"><Icon name="kembali" /></button>
      <h1 tabindex="-1">{title}</h1>
    {:else}
      <span class="merek"><img src={import.meta.env.BASE_URL + 'logo-boppj.png'} width="32" height="32" alt="" />PMO BOPPJ</span>
    {/if}
    <div class="aksi">
      {#if !isOnline()}<span class="pil-hdr" role="status"><Icon name="offline" size={18} />Offline</span>{/if}
      {#if aksi}{@render aksi()}{/if}
      {#if !kembali && tab !== 'lainnya'}<a class="avatar" href="#/lainnya" aria-label="Profil {app.user?.nama}"><img src={import.meta.env.BASE_URL + 'logo-braindevs.png'} alt="" /></a>{/if}
    </div>
  </div>
  {#if !kembali}
    <h1 tabindex="-1">{title}</h1>
    {#if sub}<p class="hdr-sub">{sub}</p>{/if}
  {/if}
</header>

<main class:tarik class:penuh>{@render children()}</main>

{#if tab}
  <nav class="nav" aria-label="Menu utama">
    <a href="#/" aria-current={tab === 'proyek' ? 'page' : undefined}><Icon name="proyek" size={26} />Proyek</a>
    <a href="#/riwayat" aria-current={tab === 'riwayat' ? 'page' : undefined}><Icon name="riwayat" size={26} />Riwayat</a>
    <a class="utama" href="#/input" aria-current={tab === 'input' ? 'page' : undefined}>
      <span class="fab"><Icon name="lapor" size={34} /></span>Input
    </a>
    <a href="#/pengetahuan" aria-current={tab === 'buku' ? 'page' : undefined}><Icon name="buku" size={26} />Pustaka</a>
    <a href="#/lainnya" aria-current={tab === 'lainnya' ? 'page' : undefined}><Icon name="lainnya" size={26} />Lainnya</a>
  </nav>
{/if}
