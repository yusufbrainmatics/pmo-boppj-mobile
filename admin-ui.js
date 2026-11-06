export const BACKOFFICE_PAGES = Object.freeze([
  'dashboard', 'map', 'projects', 'regions', 'management', 'users',
  'daily', 'export', 'approval', 'missing', 'knowledge',
])

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

export function formatDate(iso) {
  if (!iso) return '—'
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? `${iso}T12:00:00+07:00` : iso)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta',
  }).format(date)
}

export function formatNumber(number, options = {}) {
  if (typeof number !== 'number' || !Number.isFinite(number)) return '—'
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2, ...options }).format(number)
}

export function parseBackofficeHash(hash = '') {
  const raw = String(hash).replace(/^#\/?/, '')
  const separator = raw.indexOf('?')
  const path = separator < 0 ? raw : raw.slice(0, separator)
  const query = separator < 0 ? '' : raw.slice(separator + 1)
  const [page = 'dashboard', ...parts] = (path || 'dashboard').split('/')
  let detail = parts.join('/')
  try { detail = decodeURIComponent(detail) } catch { /* Malformed bookmarks remain readable, not executable. */ }
  return { page, detail, params: new URLSearchParams(query), valid: BACKOFFICE_PAGES.includes(page) }
}

export function backofficeHash(page, detail = '', params = new URLSearchParams()) {
  const query = new URLSearchParams(params).toString()
  return `#${page}${detail ? `/${encodeURIComponent(detail)}` : ''}${query ? `?${query}` : ''}`
}

export function summarizeProjects(projects) {
  const stages = new Map()
  const groups = new Map()
  const values = []
  for (const project of projects) {
    const stage = project.tahap || 'Belum tersedia'
    stages.set(stage, (stages.get(stage) || 0) + 1)
    const group = groups.get(project.kelompok) || { count: 0, values: [] }
    group.count += 1
    if (typeof project.progres === 'number' && Number.isFinite(project.progres)) {
      values.push(project.progres)
      group.values.push(project.progres)
    }
    groups.set(project.kelompok, group)
  }
  const average = (numbers) => numbers.length ? numbers.reduce((sum, number) => sum + number, 0) / numbers.length : null
  return {
    total: projects.length,
    average: average(values),
    stages: [...stages].map(([name, count]) => ({ name, count })),
    groups: [...groups].map(([name, group]) => ({ name, count: group.count, average: average(group.values) })),
  }
}

export function csvCell(value) {
  let text = String(value ?? '')
  if (/^[\s\u0000-\u001f\u007f-\u009f]*[=+\-@]/u.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function createCsv(rows) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

export function downloadFile(name, contents, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const TAHAP_CLASS = { 'asesmen': 'asesmen', 'master plan': 'master-plan', 'pra-konstruksi': 'pra-konstruksi', 'pra konstruksi': 'pra-konstruksi', 'konstruksi': 'konstruksi', 'selesai': 'selesai' }
export function kelompokWarna(nama) {
  const teks = String(nama ?? '')
  if (teks.includes('NCICD')) return 'g-green'
  if (teks.includes('Tol')) return 'g-orange'
  return 'g-blue'
}
export function tahapClass(name) { return TAHAP_CLASS[String(name ?? '').toLowerCase().trim()] || 'asesmen' }
export function notify(message) {
  if (typeof document === 'undefined') return
  let region = document.querySelector('#admin-notifications')
  if (!region) {
    region = document.createElement('div')
    region.id = 'admin-notifications'
    region.className = 'admin-notification'
    region.setAttribute('role', 'status')
    region.setAttribute('aria-live', 'polite')
    document.body.append(region)
  }
  region.hidden = false
  region.textContent = String(message)
  clearTimeout(notify.timer)
  notify.timer = setTimeout(() => { region.hidden = true }, 6500)
}

export function openDialog(dialog, trigger = document.activeElement) {
  dialog.returnFocus = trigger
  if (!dialog.open) dialog.showModal()
  dialog.addEventListener('close', () => {
    if (dialog.returnFocus?.isConnected) dialog.returnFocus.focus()
  }, { once: true })
}
