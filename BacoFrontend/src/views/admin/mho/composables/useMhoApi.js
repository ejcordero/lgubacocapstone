/**
 * MHO ADMIN — API bindings
 * -----------------------------------------------------------------------------
 * Every endpoint the MHO console talks to already exists in the backend; this
 * module only names them in one place so no page has to hand-write a URL.
 *
 * Sources:
 *   BacoBackend/routes/mhoRoutes.js  — content + admin CRUD
 *
 * Note on `/mho-content`: it is the PUBLIC aggregate read. The console reuses
 * it for its initial load because it returns exactly the shape the editor
 * needs (`info`, `services[]`, `googleForm`) in a single round trip, and the
 * public page must render from the same source anyway — so what the officer
 * sees on load is genuinely what the public page is showing.
 */

import { API } from '../../../../api'
import { authFetch } from './useMhoAdminAuth.js'

const BASE = API

/** Public aggregate: { info, services[], googleForm }. No auth needed. */
export const fetchContent = () =>
  fetch(`${BASE}/mho-content`).then((r) => {
    if (!r.ok) throw new Error('Failed to load MHO content.')
    return r.json()
  })

/** PUT /admin/mho/settings — { title, posterTitle, badges[] } */
export const saveSettings = (payload) =>
  authFetch('/admin/mho/settings', {
    baseUrl: BASE,
    options: { method: 'PUT', body: JSON.stringify(payload) }
  })

/**
 * PUT /admin/mho/google-form
 * Field semantics are per-field and deliberate:
 *   omitted -> keep current · '' -> clear · base64 data URL -> replace
 * So a partial save must OMIT untouched fields rather than send empty strings.
 */
export const saveGoogleForm = (payload) =>
  authFetch('/admin/mho/google-form', {
    baseUrl: BASE,
    options: { method: 'PUT', body: JSON.stringify(payload) }
  })

/** POST /admin/mho/services — { name, description, bullets[], detail } */
export const createService = (payload) =>
  authFetch('/admin/mho/services', {
    baseUrl: BASE,
    options: { method: 'POST', body: JSON.stringify(payload) }
  })

/** PUT /admin/mho/services/reorder — { ids: number[] } in display order. */
export const reorderServices = (ids) =>
  authFetch('/admin/mho/services/reorder', {
    baseUrl: BASE,
    options: { method: 'PUT', body: JSON.stringify({ ids }) }
  })

/** PUT /admin/mho/services/:id — any subset of the editable fields. */
export const updateService = (id, payload) =>
  authFetch(`/admin/mho/services/${id}`, {
    baseUrl: BASE,
    options: { method: 'PUT', body: JSON.stringify(payload) }
  })

/** DELETE /admin/mho/services/:id */
export const deleteService = (id) =>
  authFetch(`/admin/mho/services/${id}`, {
    baseUrl: BASE,
    options: { method: 'DELETE' }
  })