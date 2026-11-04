<script>
  // Question this chart answers: is verified progress keeping pace with the contract plan?
  let { paket, progres } = $props()
  const W = 300, H = 150, L = 28, B = 22, T = 8, R = 8
  const n = $derived(paket.bulan.length)
  const x = (i) => L + (i * (W - L - R)) / (n - 1)
  const y = (v) => T + (1 - v / 100) * (H - T - B)
  const garis = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const real = $derived([...paket.realisasi.slice(0, -1), progres])
</script>

<figure style="margin:0" class="kurva">
  <svg viewBox="0 0 {W} {H}" width="100%" role="img"
    aria-label="Kurva-S {paket.kode}: rencana {paket.rencana.at(-1)} persen, realisasi {progres} persen pada {paket.bulan.at(-1)}">
    {#each [0, 25, 50, 75, 100] as g}
      <line class="grid" x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke-width="1" />
      <text x={L - 4} y={y(g) + 3} text-anchor="end" font-size="9">{g}</text>
    {/each}
    {#each paket.bulan as b, i}
      <text x={x(i)} y={H - 6} text-anchor="middle" font-size="9">{b}</text>
    {/each}
    <path class="garis-rencana" d={garis(paket.rencana)} fill="none" stroke-width="2" stroke-dasharray="5 4" />
    <path class="garis-real" d={garis(real)} fill="none" stroke-width="2.5" stroke-linecap="round" />
    <circle class="titik-real" cx={x(n - 1)} cy={y(real[n - 1])} r="4" />
  </svg>
  <figcaption class="baris kecil muted" style="gap:var(--space-sm);margin-top:var(--space-3xs);flex-wrap:wrap">
    <span><b class="legenda-real">━</b> Realisasi terverifikasi</span>
    <span><b>┅</b> Rencana kontrak</span>
  </figcaption>
</figure>
