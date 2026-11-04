<script>
  import Icon from './Icon.svelte'
  let { status } = $props()
  const M = {
    ANTRE: ['wait', 'offline', 'Antre kirim'],
    MENUNGGU: ['wait', 'jam', 'Menunggu verifikasi'],
    DITERIMA: ['ok', 'check', 'Diterima'],
    DITOLAK: ['bad', 'x', 'Ditolak'],
  }
  const [warna, ikon, teks] = $derived(M[status])
</script>

<span class="badge {warna}"><Icon name={ikon} size={14} />{teks}</span>
