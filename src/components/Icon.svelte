<script>
  let { name, size = 22 } = $props()
  const P = {
    proyek: '<path d="M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6"/>',
    input: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4"/>',
    riwayat: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    buku: '<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4zM5 17a3 3 0 013-3h11"/>',
    lainnya: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    peta: '<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    isu: '<path d="M12 4l9 16H3L12 4zM12 10v4M12 17.5v.01"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    kamera: '<path d="M4 8h3l2-3h6l2 3h3v11H4V8z"/><circle cx="12" cy="13" r="3.5"/>',
    galeri: '<rect x="4" y="5" width="16" height="14" rx="1"/><circle cx="9" cy="10" r="1.5"/><path d="M4 17l5-4 4 3 3-2 4 3"/>',
    kembali: '<path d="M15 5l-7 7 7 7"/>',
    panah: '<path d="M9 5l7 7-7 7"/>',
    offline: '<path d="M3 3l18 18M8.5 8.8A9 9 0 0121 12M5 12a9 9 0 013-2M8.5 16a5 5 0 017-1M12 20v.01"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1-4 4-6 8-6s7 2 8 6"/>',
    keluar: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    cari: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
    unduh: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    cerah: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
    berawan: '<path d="M7 18a4 4 0 010-8 5 5 0 019.6 1.2A3.4 3.4 0 0117 18H7z"/>',
    hujan: '<path d="M7 14a4 4 0 010-8 5 5 0 019.6 1.2A3.4 3.4 0 0117 14H7zM8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
    lapor: '<path d="M9 4h6v3H9zM7 5.5H6a1 1 0 00-1 1V20a1 1 0 001 1h12a1 1 0 001-1V6.5a1 1 0 00-1-1h-1M9 14l2.2 2.2L15.5 12"/>',
    minus: '<path d="M5 12h14"/>',
    jam: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  }
</script>

<svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" stroke-width="1.75"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">{@html P[name]}</svg>
