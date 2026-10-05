const TOKEN_KEY = 'baco_admin_token'

export const getAdminToken = () => localStorage.getItem(TOKEN_KEY) || ''

export const clearAdminSession = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem('baco_admin_role')
  localStorage.removeItem('baco_admin_data')
}

export const redirectToAdminLogin = () => {
  clearAdminSession()
  if (!window.location.pathname.startsWith('/admin/login')) {
    window.location.assign('/admin/login')
  }
}

export const handleAdminAuthError = (res) => {
  if (res && (res.status === 401 || res.status === 403)) {
    redirectToAdminLogin()
    return true
  }
  return false
}