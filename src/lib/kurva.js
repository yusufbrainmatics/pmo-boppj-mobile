// Gap between verified progress and the planned S-curve at the latest month, in percentage points.
export const deviasi = (paket, progres) =>
  +(progres - paket.rencana[paket.rencana.length - 1]).toFixed(1)

// Policy knob: where "on plan" ends and "behind" begins. Thresholds are placeholders for BOPPJ to confirm.
export function statusKesehatan(dev) {
  if (dev >= -2) return { kode: 'SESUAI', label: 'Sesuai rencana' }
  if (dev >= -5) return { kode: 'WASPADA', label: 'Waspada' }
  return { kode: 'TERLAMBAT', label: 'Terlambat' }
}
