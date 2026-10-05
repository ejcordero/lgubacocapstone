import { defineStore } from 'pinia'
import axios from 'axios'

const TOKEN_KEY = 'baco_user_token'

// Normalize: API must ALWAYS end with /api.
// Handles both "http://localhost:3000/api" (our .env) and "http://localhost:3000".
const RAW = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const API = RAW.endsWith('/api') ? RAW : RAW.replace(/\/$/, '') + '/api'

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null,
    token: localStorage.getItem(TOKEN_KEY) || null,
    isLoading: false,
    error: null,
  }),

  getters: {
    isLoggedIn: (state) => !!state.token && !!state.user,
    initials: (state) => {
      if (!state.user?.fullName) return '?'
      const parts = state.user.fullName.trim().split(/\s+/)
      if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      return parts[0][0].toUpperCase()
    },
    displayName: (state) => {
      if (!state.user?.fullName) return 'User'
      return state.user.fullName.trim().split(/\s+/)[0]
    },
  },

  actions: {
    async fetchUser() {
      if (!this.token) return false
      this.isLoading = true
      this.error = null
      try {
        const res = await axios.get(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${this.token}` },
        })
        this.user = res.data
        return true
      } catch (err) {
        this.user = null
        // A 401/403 means the stored token is dead — clear it so the
        // messaging api() helper doesn't keep sending a zombie token.
        if (err.response?.status === 401 || err.response?.status === 403) {
          this.logout()
        } else {
          this.error = 'Session expired. Please log in again.'
        }
        return false
      } finally {
        this.isLoading = false
      }
    },

    setToken(token) {
      this.token = token
      localStorage.setItem(TOKEN_KEY, token)
    },

    async loginWithEmail(email, password) {
      this.isLoading = true
      this.error = null
      try {
        const res = await axios.post(`${API}/auth/login`, { email, password })
        this.setToken(res.data.token)
        await this.fetchUser()
        return { success: true }
      } catch (err) {
        const msg = err.response?.data?.message || 'Login failed.'
        this.error = msg
        return { success: false, message: msg }
      } finally {
        this.isLoading = false
      }
    },

    async loginWithGoogle(idToken) {
      this.isLoading = true
      this.error = null
      try {
        const res = await axios.post(`${API}/auth/google`, { idToken })
        this.setToken(res.data.token)
        await this.fetchUser()
        return { success: true, needsPassword: !!res.data.needsPassword }
      } catch (err) {
        const msg = err.response?.data?.message || 'Google sign-in failed.'
        this.error = msg
        return { success: false, message: msg }
      } finally {
        this.isLoading = false
      }
    },

    async setPassword(password) {
      try {
        await axios.post(
          `${API}/auth/set-password`,
          { password },
          { headers: { Authorization: `Bearer ${this.token}` } }
        )
        await this.fetchUser()
        return { success: true }
      } catch (err) {
        return { success: false, message: err.response?.data?.message || 'Failed to set password.' }
      }
    },

    async sendOtp(email) {
      try {
        await axios.post(`${API}/auth/send-otp`, { email })
        return { success: true }
      } catch (err) {
        return { success: false, message: err.response?.data?.message || 'Failed to send code.' }
      }
    },

    async register(data) {
      this.isLoading = true
      this.error = null
      try {
        const res = await axios.post(`${API}/auth/register`, data)
        this.setToken(res.data.token)
        await this.fetchUser()
        return { success: true }
      } catch (err) {
        const msg = err.response?.data?.message || 'Registration failed.'
        this.error = msg
        return { success: false, message: msg }
      } finally {
        this.isLoading = false
      }
    },

    logout() {
      this.token = null
      this.user = null
      this.error = null
      localStorage.removeItem(TOKEN_KEY)
    },
  },
})