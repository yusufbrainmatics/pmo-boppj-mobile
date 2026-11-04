<script>
  import Page from '../components/Page.svelte'
  import Icon from '../components/Icon.svelte'
  import { app, logout } from '../lib/store.svelte.js'

  const inisial = $derived(app.user.nama.split(' ').map((k) => k[0]).slice(0, 2).join(''))
</script>

<Page title="Lainnya" sub="Profil dan pintasan" tab="lainnya">
  <section class="card baris" style="gap:var(--space-sm)" aria-label="Profil">
    <span class="avatar-besar" aria-hidden="true">{inisial}</span>
    <div style="min-width:0">
      <p class="tebal">{app.user.nama}</p>
      <p class="kecil muted">{app.user.peran} · {app.user.perusahaan}</p>
      <p class="kecil muted">{app.user.email}</p>
    </div>
  </section>

  <nav class="tumpuk" aria-label="Pintasan" style="gap:var(--space-2xs)">
    <a class="card baris sebar" href="#/peta"><span class="baris"><Icon name="peta" />Peta proyek saya</span><Icon name="panah" size={18} /></a>
    <a class="card baris sebar" href="#/isu"><span class="baris"><Icon name="isu" />Lapor isu lapangan</span><Icon name="panah" size={18} /></a>
  </nav>

  <button class="btn bahaya" onclick={logout}><Icon name="keluar" size={20} />Keluar</button>
  <p class="kecil muted">PMO Kontraktor · prototipe 0.1 · Badan Otorita Pengelola Pantai Utara Jawa</p>
</Page>
