<script>
  import Icon from '../components/Icon.svelte'
  import { login, akunDemo } from '../lib/store.svelte.js'

  let email = $state('')
  let sandi = $state('')
  let lihat = $state(false)
  let galat = $state('')
  let lupa = $state(false)

  function kirim(e) {
    e.preventDefault()
    galat = ''
    if (!email.trim() || !sandi) return (galat = 'Isi email dan kata sandi.')
    if (!login(email, sandi)) galat = 'Email atau kata sandi tidak cocok. Periksa lagi, atau hubungi Analis Monitoring BOPPJ.'
  }
</script>

<header class="hdr besar">
  <svg class="ombak" viewBox="0 0 240 64" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" aria-hidden="true">
    <path d="M0 18c40-26 80-26 120 0s80 26 120 0M0 44c40-26 80-26 120 0s80 26 120 0" />
  </svg>
  <div class="hdr-bar"><span class="merek"><img src={import.meta.env.BASE_URL + 'logo-boppj.png'} width="32" height="32" alt="" />PMO BOPPJ</span></div>
  <h1 tabindex="-1">Masuk ke PMO Kontraktor</h1>
  <p class="hdr-sub">Pelaporan progres harian proyek Pantura Jawa.</p>
</header>

<main class="tarik">
  <form class="card tumpuk" style="gap:var(--space-sm)" onsubmit={kirim} novalidate>
    <div class="field">
      <label for="email">Email</label>
      <input id="email" type="email" autocomplete="username" inputmode="email" placeholder="nama@perusahaan.co.id" bind:value={email} aria-invalid={galat ? 'true' : undefined} aria-describedby={galat ? 'galat-login' : undefined} />
    </div>
    <div class="field">
      <label for="sandi">Kata sandi</label>
      <input id="sandi" type={lihat ? 'text' : 'password'} autocomplete="current-password" placeholder="Masukkan kata sandi" bind:value={sandi} aria-invalid={galat ? 'true' : undefined} />
      <button type="button" class="chip" style="align-self:flex-start" aria-pressed={lihat} onclick={() => (lihat = !lihat)}>{lihat ? 'Sembunyikan' : 'Tampilkan'} kata sandi</button>
    </div>
    {#if galat}<p id="galat-login" class="galat" role="alert"><Icon name="isu" size={18} />{galat}</p>{/if}
    <button class="btn utama" type="submit">Masuk</button>
    <button type="button" class="btn" style="border-color:transparent;background:transparent" aria-expanded={lupa} onclick={() => (lupa = !lupa)}>Lupa kata sandi?</button>
    {#if lupa}<p class="peringatan info" role="status">Prototipe tidak menyediakan reset kata sandi. Gunakan akun demo yang ditampilkan di bawah.</p>{/if}
  </form>

  <section class="card tumpuk" style="gap:var(--space-3xs)" aria-label="Akun demo">
    <p class="tebal kecil">Akun demo prototipe</p>
    <p class="kecil muted">Email: <b style="color:var(--color-ink)">{akunDemo.email}</b></p>
    <p class="kecil muted">Kata sandi: <b style="color:var(--color-ink)">{akunDemo.sandi}</b></p>
  </section>

  <p class="kecil muted">Belum punya akun? Hubungi Analis Monitoring BOPPJ.</p>
</main>
