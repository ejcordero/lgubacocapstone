/**
 * MHO ADMIN — auth + session composable
 * -----------------------------------------------------------------------------
 * This module has its OWN session copy on purpose.
 *
 * The single sign-in screen at /admin/login is shared, so the token it writes
 * is the same one the native admin reads (`baco_admin_token`). What is NOT
 * shared is the role gate: this console admits `mho_admin` and
 * `main_controller` only, and an MHO officer landing here must never be able to
 * wander into the native admin's other modules.
 *
 * The keys are deliberately identical to the native admin's. Reusing them means
 * one sign-in serves both consoles without a second login form — which is the
 * agreed design — instead of inventing a parallel credential store that would
 * then need its own logout story.
 */

const TOKEN_KEY = 'baco_admin_token'
const ROLE_KEY = 'baco_admin_role'
const DATA_KEY = 'baco_admin_data'

/** Roles allowed to open this console. */
export const MHO_ALLOWED_ROLES = ['mho_admin', 'main_controller']

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

export const isAllowed = (role) => MHO_ALLOWED_ROLES.includes(role)

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
 * Guard for the `/mho-admin` route tree.
 * No token -> login. Token but wrong role -> login as well, because leaving
 * them on a blank page with no explanation is worse than a re-login.
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