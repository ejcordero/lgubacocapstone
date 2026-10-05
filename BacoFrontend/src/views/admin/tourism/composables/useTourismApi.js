/**
 * TOURISM ADMIN — API bindings
 * -----------------------------------------------------------------------------
 * Every endpoint this console talks to already exists in the backend; this
 * module only names them in one place so no page hand-writes a URL.
 *
 * Sources:
 *   BacoBackend/routes/tourismRoutes.js — destinations (public) + analytics
 *   BacoBackend/routes/adminRoutes.js    — arrivals admin + section backgrounds
 *
 * ⚠️ AUTH CAVEAT — read before relying on the destinations endpoints.
 *
 * `/destinations` and its POST/PUT/DELETE siblings in tourismRoutes.js are
 * registered WITHOUT `authenticateAdmin`. They are reachable by anyone who can
 * reach the API. That is a pre-existing condition in the backend, not something
 * introduced here, and this console does not change it. Flagging it because a
 * console that looks role-gated while writing through unauthenticated endpoints
 * is a false sense of protection — worth fixing server-side separately.
 *
 * The arrivals endpoints below DO require `authenticateAdmin`, so they are the
 * genuinely protected half of this console.
 */

import { API } from '../../../../api'
import { authFetch } from './useTourismAdminAuth.js'

const BASE = API

/* ── Destinations (currently unauthenticated server-side — see note above) ── */

export const fetchDestinations = () =>
  fetch(`${BASE}/destinations`).then((r) => {
    if (!r.ok) throw new Error('Failed to load destinations.')
    return r.json()
  })

export const createDestination = (payload) =>
  fetch(`${BASE}/destinations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(async (r) => {
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(body.message || 'Failed to create destination.')
    return body
  })

export const updateDestination = (id, payload) =>
  fetch(`${BASE}/destinations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(async (r) => {
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(body.message || 'Failed to update destination.')
    return body
  })

export const deleteDestination = (id) =>
  fetch(`${BASE}/destinations/${id}`, { method: 'DELETE' }).then(async (r) => {
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(body.message || 'Failed to delete destination.')
    return body
  })

/* ── Analytics (public read, used for the overview's 8-quarter trend) ── */

export const fetchAnalytics = () =>
  fetch(`${BASE}/tourism/analytics`)
    .then((r) => (r.ok ? r.json() : { quarters: [], total: 0 }))
    .catch(() => ({ quarters: [], total: 0 }))

/* ── Arrivals — these DO require the admin bearer token ── */

/** GET /admin/tourism/arrivals?year=&quarter= */
export const fetchArrivals = ({ year, quarter }) => {
  const qs = new URLSearchParams()
  if (year) qs.set('year', year)
  if (quarter) qs.set('quarter', quarter)
  const suffix = qs.toString() ? `?${qs}` : ''
  return authFetch(`/admin/tourism/arrivals${suffix}`, { baseUrl: BASE })
}

/**
 * POST /admin/tourism/arrivals
 * An EMPTY save (no total, no attractions) is not an error — the backend
 * interprets it as "unpublish this quarter" and removes the row so the public
 * page hides the section instead of rendering a zero.
 */
export const saveArrivals = (payload) =>
  authFetch('/admin/tourism/arrivals', {
    baseUrl: BASE,
    options: { method: 'POST', body: JSON.stringify(payload) }
  })

/**
 * PUT /admin/tourism/arrivals/backgrounds
 * Per-field semantics, same contract as the MHO google-form endpoint:
 *   omitted -> keep · '' -> reset to default · base64 -> replace
 */
export const saveArrivalBackgrounds = (payload) =>
  authFetch('/admin/tourism/arrivals/backgrounds', {
    baseUrl: BASE,
    options: { method: 'PUT', body: JSON.stringify(payload) }
  })