<script>
  import Icon from './Icon.svelte'
  import Foto from './Foto.svelte'
  import { simpanFoto, hapusFoto, TTL_MS } from '../lib/photos.js'

  let { ids = $bindable([]), maks = 5, galat = '', labelId } = $props()
  let pesan = $state('')
  let sibuk = $state(false)

  async function tambah(e) {
    const files = [...e.currentTarget.files]
    e.currentTarget.value = ''
    pesan = ''
    sibuk = true
    for (const f of files) {
      if (ids.length >= maks) { pesan = `Maksimal ${maks} foto.`; break }
      try { ids.push((await simpanFoto(f)).id) } catch (err) { pesan = err.message }
    }
    sibuk = false
  }
  function buang(id) {
    ids = ids.filter((x) => x !== id)
    hapusFoto(id)
  }
</script>

<div class="tumpuk" aria-labelledby={labelId}>
  {#if ids.length}
    <div class="foto-grid">
      {#each ids as id, i (id)}
        <div style="position:relative">
          <Foto {id} alt="Foto lapangan {i + 1}" />
          <button type="button" class="hapus" onclick={() => buang(id)} aria-label="Hapus foto {i + 1}"><span><Icon name="x" size={14} /></span></button>
        </div>
      {/each}
    </div>
  {/if}
  <div class="dua">
    <label class="btn sedang" style="width:100%">
      <Icon name="kamera" size={20} /> Kamera
      <input class="sr" type="file" accept="image/*" capture="environment" onchange={tambah} disabled={sibuk} />
    </label>
    <label class="btn sedang" style="width:100%">
      <Icon name="galeri" size={20} /> Galeri
      <input class="sr" type="file" accept="image/jpeg,image/png,image/heic,image/heif" multiple onchange={tambah} disabled={sibuk} />
    </label>
  </div>
  <p class="bantu">JPG, PNG, atau HEIC, maksimal 10 MB per foto. Foto dikompres otomatis dan hanya disimpan sementara di perangkat ini ({TTL_MS / 60000} menit, prototipe).</p>
  {#if sibuk}<p class="bantu" role="status">Memproses foto…</p>{/if}
  {#if pesan || galat}<p class="galat" role="alert">{pesan || galat}</p>{/if}
</div>

<style>
  label.btn:focus-within { outline: 3px solid var(--color-blue); outline-offset: 2px; }
</style>
