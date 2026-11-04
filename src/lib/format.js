const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export const isoHariIni = (offset = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('sv-SE') // yyyy-mm-dd in local time
}

export const tgl = (iso) => {
  const [y, m, d] = iso.split('-')
  return `${+d} ${BULAN[m - 1]} ${y}`
}

export const tglRelatif = (iso) =>
  iso === isoHariIni() ? 'Hari ini' : iso === isoHariIni(-1) ? 'Kemarin' : tgl(iso)

export const angka = (n) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(n)
