<script>
  import { ambilFoto } from '../lib/photos.js'
  let { id, alt } = $props()
  let url = $state(null)
  let kedaluwarsa = $state(false)

  $effect(() => {
    let obj, timer, batal = false
    ambilFoto(id).then((rec) => {
      if (batal) return
      if (!rec || rec.expiresAt <= Date.now()) return (kedaluwarsa = true)
      obj = URL.createObjectURL(rec.blob)
      url = obj
      timer = setTimeout(() => { kedaluwarsa = true; url = null }, rec.expiresAt - Date.now())
    }).catch(() => (kedaluwarsa = true))
    return () => { batal = true; clearTimeout(timer); obj && URL.revokeObjectURL(obj) }
  })
</script>

<div class="foto">
  {#if url}<img src={url} {alt} />{:else if kedaluwarsa}<span>Foto sudah dihapus dari perangkat (disimpan 5 menit)</span>{:else}<span>Memuat…</span>{/if}
</div>
