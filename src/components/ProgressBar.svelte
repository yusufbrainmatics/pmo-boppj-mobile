<script>
  // rencana: planned cumulative % (S-curve) drawn as a tick so lag is visible without reading numbers.
  let { nilai, label, rencana } = $props()
  const pct = (v) => Math.min(100, Math.max(0, v))
</script>

<div class="bar" role="progressbar" aria-valuenow={nilai} aria-valuemin="0" aria-valuemax="100" aria-label={label}>
  <i style="width:{pct(nilai)}%"></i>
  {#if rencana != null}<span class="tanda" style="left:{pct(rencana)}%" aria-hidden="true"></span>{/if}
</div>
