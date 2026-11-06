import { notify } from './admin-ui.js'

export function isValidDemoAccount(email, password) {
  return String(email ?? '').trim().toLowerCase() === 'admin@boppj.go.id' && password === 'demo1234'
}

export function initAdminAuth(root = document) {
  const login = root.querySelector('#admin-login')
  const portal = root.querySelector('#admin-portal')
  const form = root.querySelector('#admin-login-form')
  const error = root.querySelector('#admin-login-error')
  const logout = root.querySelector('#admin-logout')
  if (!login || !portal || !form || !error || !logout) return

  const fields = [root.querySelector('#admin-email'), root.querySelector('#admin-password')]
  function showPortal() {
    login.hidden = true
    portal.hidden = false
    if (!window.location.hash) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#dashboard`)
    window.dispatchEvent(new CustomEvent('pmo:authchange', { detail: { authenticated: true } }))
  }
  function showLogin() {
    root.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close())
    root.querySelectorAll('.account-modal.open').forEach((modal) => {
      modal.classList.remove('open')
      modal.setAttribute('aria-hidden', 'true')
    })
    portal.hidden = true
    login.hidden = false
    fields[1].value = ''
    fields[0].focus()
    window.dispatchEvent(new CustomEvent('pmo:authchange', { detail: { authenticated: false } }))
  }

  try {
    if (sessionStorage.getItem('pmo-admin-demo') === 'authenticated') showPortal()
  } catch {
    notify('Penyimpanan sesi tidak tersedia. Demo tetap terbatas pada tab ini.')
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const data = new FormData(form)
    if (!isValidDemoAccount(data.get('email'), data.get('password'))) {
      error.textContent = 'Akun tidak cocok. Gunakan email dan kata sandi demo yang ditampilkan di bawah.'
      error.hidden = false
      fields.forEach((field) => field.setAttribute('aria-invalid', 'true'))
      fields[0].focus()
      return
    }
    try {
      sessionStorage.setItem('pmo-admin-demo', 'authenticated')
    } catch {
      notify('Sesi demo hanya berlaku di memori tab karena penyimpanan browser tidak tersedia.')
    }
    error.hidden = true
    fields.forEach((field) => field.removeAttribute('aria-invalid'))
    fields[1].value = ''
    showPortal()
    root.querySelector('.page.active h1')?.focus()
  })

  logout.textContent = 'Keluar'
  logout.addEventListener('click', () => {
    try { sessionStorage.removeItem('pmo-admin-demo') } catch { /* Login remains a local demo gate even without storage. */ }
    showLogin()
  })
}

if (typeof document !== 'undefined') initAdminAuth()
