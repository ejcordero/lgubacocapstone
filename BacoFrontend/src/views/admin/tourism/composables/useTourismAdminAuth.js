/**
 * TOURISM ADMIN — auth + session composable
 * -----------------------------------------------------------------------------
 * Same session as the native admin and the MHO console (one sign-in screen at
 * /admin/login, one token), but an INDEPENDENT role gate: this console admits
 * `tourism_admin` and `main_controller` only.
 *
 * The keys are intentionally identical across all three consoles. Reusing them
 * is what lets a single login serve every console without inventing a parallel
 * credential store that would then need its own logout story.
 */

const TOKEN_KEY = 'baco_admin_token'
const ROLE_KEY = 'baco_admin_role'
const DATA_KEY = 'baco_admin_data'

/** Roles allowed to open this console. */
export const TOURISM_ALLOWED_ROLES = ['tourism_admin', 'main_controller']

export const getToken = () => localStorage.getItem(TOKEN_KEY) || ''

export const getRole = () => localStorage.getItem(ROLE_KEY) || ''

export const getAdmin = () => {
  try {
    return JSON.parse(localStorage.getItem(DATA_KEY) || 'null')
  } catch {
    return null
  }
}

export const hasToken = () => Boolean(getToken())

export const isAllowed = (role) => TOURISM_ALLOWED_ROLES.includes(role)

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ROLE_KEY)
  localStorage.removeItem(DATA_KEY)
}

/** Send the officer back to the shared sign-in screen, session cleared. */
export const goToLogin = () => {
  clearSession()
  window.location.assign('/admin/login')
}

/**
 * Guard for the `/tourism-admin` route tree.
 * No token -> login. Token but wrong role -> login as well, because leaving
 * someone on a blank page with no explanation is worse than a re-login.
 */
export const guard = () => {
  if (!hasToken()) {
    window.location.assign('/admin/login')
    return false
  }
  if (!isAllowed(getRole())) {
    clearSession()
    window.location.assign('/admin/login')
    return false
  }
  return true
}

/**
 * Fetch wrapper that attaches the admin bearer token and treats 401/403 as a
 * dead session. Returns parsed JSON, or throws an Error carrying `.status`.
 */
export const authFetch = async (path, { baseUrl, options = {} } = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers || {})
    }
  })
  if (res.status === 401 || res.status === 403) {
    goToLogin()
    throw new Error('Session expired. Please sign in again.')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(body.message || `Request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return body
}

/** Sign out of BOTH consoles — one session, so one logout. */
export const logout = () => {
  clearSession()
  window.location.assign('/admin/login')
}