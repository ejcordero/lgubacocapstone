// src/api.js — single source of truth for the backend base URL
const RAW = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

// Always ends with /api, whether .env includes it or not
export const API = RAW.endsWith('/api') ? RAW : RAW.replace(/\/+$/, '') + '/api'

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || body.error || `HTTP error! status: ${res.status}`)
  }
  return res.json()
}