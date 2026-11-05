const login = document.querySelector('#admin-login')
const portal = document.querySelector('#admin-portal')
const form = document.querySelector('#admin-login-form')
const error = document.querySelector('#admin-login-error')
const logout = document.querySelector('#admin-logout')

logout.textContent = 'Keluar'

const tampilkanPortal = () => {
  login.hidden = true
  portal.hidden = false
  if (window.location.hash !== '#dashboard') window.location.hash = 'dashboard'
}

const tampilkanLogin = () => {
  portal.hidden = true
  login.hidden = false
  document.querySelector('#admin-password').value = ''
  document.querySelector('#admin-email').focus()
}

if (sessionStorage.getItem('pmo-admin-demo') === 'authenticated') tampilkanPortal()

form.addEventListener('submit', (event) => {
  event.preventDefault()
  const data = new FormData(form)
  const valid = String(data.get('email')).trim() !== '' && String(data.get('password')).trim() !== ''

  if (!valid) {
    error.textContent = 'Email dan kata sandi wajib diisi.'
    error.hidden = false
    return
  }

  sessionStorage.setItem('pmo-admin-demo', 'authenticated')
  error.hidden = true
  tampilkanPortal()
})

logout.addEventListener('click', () => {
  sessionStorage.removeItem('pmo-admin-demo')
  tampilkanLogin()
})
