import { ref, computed } from 'vue'

const TOKEN_KEY = 'tourism_token'
const USER_KEY = 'tourism_user'

// ── singleton refs (shared across all components) ──
const token = ref(localStorage.getItem(TOKEN_KEY))

let _cachedUser = null
try { _cachedUser = JSON.parse(localStorage.getItem(USER_KEY)) } catch { /* ignore */ }
const user = ref(_cachedUser)

export function useAuth() {
  const isAuthenticated = computed(() => !!token.value)

  function setToken(t) {
    token.value = t
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  }

  function setUser(u) {
    user.value = u
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u))
    else localStorage.removeItem(USER_KEY)
  }

  function logout() {
    setToken(null)
    setUser(null)
  }

  /** Returns headers object or null if not logged in */
  function authHeaders() {
    if (!token.value) return null
    return { Authorization: `Bearer ${token.value}` }
  }

  return {
    token,
    user,
    isAuthenticated,
    setToken,
    setUser,
    logout,
    authHeaders,
  }
}