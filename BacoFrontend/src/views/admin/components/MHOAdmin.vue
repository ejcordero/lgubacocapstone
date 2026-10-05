<script setup>
import { ref, computed, onMounted } from 'vue'
import { handleAdminAuthError } from '../../../utils/adminAuth'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api'
const getToken = () => localStorage.getItem('baco_admin_token') || ''

const loading    = ref(true)
const error      = ref(null)
const successMsg = ref('')
const errorMsg   = ref('')

const savingSettings = ref(false)
const addingService  = ref(false)
const savingSvc      = ref({})
const moving         = ref(false)

// ══════════ NEW — MHO GOOGLE FORM (link + picture) ══════════
const gfLoading      = ref(false)
const gfUrl          = ref('')     // the link input
const gfImageNew     = ref(null)   // base64 preview of a newly picked file
const gfImageCurrent = ref(null)   // saved image URL (null = none)
const gfImageInput   = ref(null)

const gfPreview = computed(() => gfImageNew.value || gfImageCurrent.value)

const pickGfImage = () => gfImageInput.value?.click()

const handleGfFile = (e) => {
  const file = e.target.files[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { flash('Please choose an image file.', true); return }
  const reader = new FileReader()
  reader.onload = (ev) => { gfImageNew.value = ev.target.result }
  reader.readAsDataURL(file)
  e.target.value = ''
}

const undoGfImage = () => { gfImageNew.value = null }

// Mark current image for removal (applied on Save)
const clearGfImage = () => { gfImageNew.value = null; gfImageCurrent.value = null }

const saveGoogleForm = async () => {
  const token = getToken()
  if (!token) { flash('Authentication required. Please log in.', true); return }
  const link = gfUrl.value.trim()
  if (link && !/^https?:\/\//i.test(link)) {
    flash('The link must start with http:// or https:// (paste the Google Form URL).', true)
    return
  }
  gfLoading.value = true
  try {
    const body = { formUrl: link }   // '' clears the link; value sets it
    if (gfImageNew.value) body.image = gfImageNew.value                    // new upload
    else if (gfImageCurrent.value === null) body.image = ''                // explicit clear
    const res = await fetch(`${API_BASE}/admin/mho/google-form`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { if (handleAdminAuthError(res)) return; throw new Error(data.message || 'Save failed.') }
    if (data.googleForm) {
      gfUrl.value = data.googleForm.url || ''
      gfImageCurrent.value = data.googleForm.image || null
    }
    gfImageNew.value = null
    flash(data.message || 'Google Form saved.')
  } catch (e) { flash(e.message, true) }
  finally { gfLoading.value = false }
}
// ══════════ END NEW — MHO GOOGLE FORM ══════════

// ── UI state ──
const expandedId  = ref(null)   // which service row is open (accordion)
const showAddForm = ref(false)  // add-service form collapsed by default

// ── data ──
const title       = ref('')
const posterTitle = ref('')
const badges      = ref([])   // string[]
const services    = ref([])   // { id, name, description, bulletsText, detail }
const newService  = ref({ name: '', description: '', bulletsText: '', detail: '' })

let toastTimer = null
const flash = (msg, isError = false) => {
  if (isError) { errorMsg.value = msg; successMsg.value = '' }
  else { successMsg.value = msg; errorMsg.value = '' }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { successMsg.value = ''; errorMsg.value = '' }, 4000)
}

const toLines = (arr) => (arr || []).join('\n')
const toArr   = (text) => String(text || '').split('\n').map(s => s.trim()).filter(Boolean)

const toggleExpand = (id) => { expandedId.value = expandedId.value === id ? null : id }

const fetchContent = async () => {
  loading.value = true; error.value = null
  try {
    const res = await fetch(`${API_BASE}/mho-content`)
    if (!res.ok) throw new Error('Failed to load MHO content.')
    const data = await res.json()
    title.value       = data.info?.title || ''
    posterTitle.value = data.info?.posterTitle || ''
    badges.value      = [...(data.info?.badges || [])]
    services.value    = (data.services || []).map(s => ({
      id: s.id,
      name: s.name || '',
      description: s.desc || '',
      bulletsText: toLines(s.bullets),
      detail: s.detail || ''
    }))
    // ══════════ NEW — Google Form ══════════
    gfUrl.value          = data.googleForm?.url || ''
    gfImageCurrent.value = data.googleForm?.image || null
    gfImageNew.value     = null
    // ══════════ END NEW ══════════
  } catch (e) {
    console.error('MHO fetch error:', e)
    error.value = e.message || 'Failed to load.'
  } finally { loading.value = false }
}

// ── badges ──
const addBadge    = () => { if (badges.value.length < 6) badges.value.push('') }
const removeBadge = (i) => badges.value.splice(i, 1)

// ── page settings ──
const saveSettings = async () => {
  const token = getToken()
  if (!token) { flash('Authentication required. Please log in.', true); return }
  if (!title.value.trim()) { flash('Hero title is required.', true); return }
  savingSettings.value = true
  try {
    const res = await fetch(`${API_BASE}/admin/mho/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: title.value.trim(),
        posterTitle: posterTitle.value.trim(),
        badges: badges.value.map(b => b.trim()).filter(Boolean)
      })
    })
    const data = await res.json()
    if (!res.ok) { if (handleAdminAuthError(res)) return; throw new Error(data.message || 'Save failed.') }
    flash('Page settings saved.')
  } catch (e) { flash(e.message, true) }
  finally { savingSettings.value = false }
}

// ── services ──
const saveService = async (svc) => {
  const token = getToken()
  if (!token) { flash('Authentication required. Please log in.', true); return }
  if (!svc.name.trim()) { flash('Service name is required.', true); return }
  savingSvc.value = { ...savingSvc.value, [svc.id]: true }
  try {
    const res = await fetch(`${API_BASE}/admin/mho/services/${svc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: svc.name.trim(),
        description: svc.description.trim(),
        bullets: toArr(svc.bulletsText),
        detail: svc.detail.trim()
      })
    })
    const data = await res.json()
    if (!res.ok) { if (handleAdminAuthError(res)) return; throw new Error(data.message || 'Save failed.') }
    flash('Service updated.')
  } catch (e) { flash(e.message, true) }
  finally { const c = { ...savingSvc.value }; delete c[svc.id]; savingSvc.value = c }
}

const addService = async () => {
  const token = getToken()
  if (!token) { flash('Authentication required. Please log in.', true); return }
  if (!newService.value.name.trim()) { flash('Service name is required.', true); return }
  addingService.value = true
  try {
    const res = await fetch(`${API_BASE}/admin/mho/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: newService.value.name.trim(),
        description: newService.value.description.trim(),
        bullets: toArr(newService.value.bulletsText),
        detail: newService.value.detail.trim()
      })
    })
    const data = await res.json()
    if (!res.ok) { if (handleAdminAuthError(res)) return; throw new Error(data.message || 'Add failed.') }
    newService.value = { name: '', description: '', bulletsText: '', detail: '' }
    await fetchContent()
    // open the newly added service (last in the list) so it can be reviewed immediately
    if (services.value.length > 0) expandedId.value = services.value[services.value.length - 1].id
    flash('Service added.')
  } catch (e) { flash(e.message, true) }
  finally { addingService.value = false }
}

const removeService = async (svc) => {
  const token = getToken()
  if (!token) { flash('Authentication required. Please log in.', true); return }
  if (!window.confirm(`Delete "${svc.name}"? This cannot be undone.`)) return
  try {
    const res = await fetch(`${API_BASE}/admin/mho/services/${svc.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json()
    if (!res.ok) { if (handleAdminAuthError(res)) return; throw new Error(data.message || 'Delete failed.') }
    if (expandedId.value === svc.id) expandedId.value = null
    services.value = services.value.filter(s => s.id !== svc.id)
    flash('Service deleted.')
  } catch (e) { flash(e.message, true) }
}

const moveService = async (index, dir) => {
  const arr = [...services.value]
  const target = index + dir
  if (target < 0 || target >= arr.length) return
  ;[arr[index], arr[target]] = [arr[target], arr[index]]
  services.value = arr
  const token = getToken()
  if (!token) return
  moving.value = true
  try {
    const res = await fetch(`${API_BASE}/admin/mho/services/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids: arr.map(s => s.id) })
    })
    if (!res.ok) { if (handleAdminAuthError(res)) return; throw new Error('Reorder failed.') }
  } catch (e) { flash(e.message, true); await fetchContent() }
  finally { moving.value = false }
}

onMounted(fetchContent)
</script>

<template>
  <div class="mho-admin">
    <div class="mho-shell">
      <div class="mod-header">
        <div class="mh-left">
          <i class="fas fa-hospital"></i>
          <div>
            <h2>MHO Page Content</h2>
            <p>Hero title, badges, and Citizen Charter services shown on the public page</p>
          </div>
        </div>
      </div>

      <div v-if="error" class="state-box error">
        <i class="fas fa-exclamation-triangle"></i>
        <p>{{ error }}</p>
        <button @click="fetchContent" class="retry-btn mat-skeuo-sm mat-pressable-sm"><i class="fas fa-rotate-right"></i> Retry</button>
      </div>

      <div v-else class="mho-content">
        <div class="toasts">
          <Transition name="msg"><div v-if="successMsg" class="toast success"><i class="fas fa-circle-check"></i> {{ successMsg }}</div></Transition>
          <Transition name="msg"><div v-if="errorMsg" class="toast error"><i class="fas fa-circle-exclamation"></i> {{ errorMsg }}</div></Transition>
        </div>

        <div v-if="loading" class="state-box">
          <i class="fas fa-spinner fa-spin"></i><p>Loading content…</p>
        </div>

        <template v-else>
          <!-- ══ PAGE SETTINGS ══ -->
          <div class="panel">
            <div class="panel-head">
              <i class="fas fa-sliders"></i>
              <div class="ph-text"><h3>Page Settings</h3><p>Hero title, poster title, badges</p></div>
            </div>
            <div class="panel-body">
              <div class="grid-2">
                <div class="field">
                  <label>Hero Title</label>
                  <input v-model="title" type="text" maxlength="255" placeholder="Municipal Health Office" />
                </div>
                <div class="field">
                  <label>Poster Title <span class="hint">(Enter = line break)</span></label>
                  <textarea v-model="posterTitle" rows="2" maxlength="255" placeholder="Municipal Health&#10;Office Services"></textarea>
                </div>
              </div>
              <div class="field">
                <label>Hero Badges <span class="hint">(max 6 — empty ones ignored)</span></label>
                <div class="badges-wrap mat-well">
                  <span v-for="(b, i) in badges" :key="i" class="badge-chip mat-well">
                    <input v-model="badges[i]" type="text" maxlength="60" placeholder="Badge text" />
                    <button class="chip-x mat-well" @click="removeBadge(i)" title="Remove"><i class="fas fa-xmark"></i></button>
                  </span>
                  <button class="chip-add mat-skeuo-filled mat-pressable-filled" @click="addBadge" :disabled="badges.length >= 6">
                    <i class="fas fa-plus"></i> Badge
                  </button>
                </div>
              </div>
              <div class="actions-row">
                <button class="primary-btn mat-skeuo-filled mat-pressable-filled" :disabled="savingSettings" @click="saveSettings">
                  <i class="fas fa-floppy-disk"></i> {{ savingSettings ? 'Saving…' : 'Save Settings' }}
                </button>
              </div>
            </div>
          </div>

          <!-- ══ NEW — MHO GOOGLE FORM ══ -->
          <div class="panel">
            <div class="panel-head">
              <i class="fas fa-file-pen"></i>
              <div class="ph-text"><h3>MHO Google Form</h3><p>Public page links here for online health service requests</p></div>
            </div>
            <div class="panel-body">
              <div class="field">
                <label>Google Form Link <span class="hint">(must start with https:// — paste the form's share URL)</span></label>
                <input v-model="gfUrl" type="url" placeholder="https://docs.google.com/forms/d/e/..." />
              </div>
              <div class="field">
                <label>Form Picture <span class="hint">(shown as the preview on the public page)</span></label>
                <div class="gf-preview" :style="gfPreview ? { backgroundImage: `url(${gfPreview})` } : {}">
                  <div v-if="!gfPreview" class="gf-empty"><i class="fas fa-image"></i><span>No picture set</span></div>
                  <span v-if="gfImageNew" class="gf-newtag">New</span>
                </div>
                <div class="gf-actions">
                  <button type="button" class="tool-btn gf-btn" @click="pickGfImage">
                    <i class="fas fa-upload"></i> {{ gfPreview ? 'Replace' : 'Upload' }}
                  </button>
                  <button v-if="gfImageNew" type="button" class="tool-btn gf-btn" @click="undoGfImage"><i class="fas fa-rotate-left"></i> Undo</button>
                  <button v-else-if="gfImageCurrent" type="button" class="tool-btn gf-btn gf-danger" @click="clearGfImage"><i class="fas fa-trash"></i> Remove picture</button>
                </div>
                <input ref="gfImageInput" type="file" accept="image/*" class="gf-hidden" @change="handleGfFile" />
              </div>
              <div class="actions-row">
                <button class="primary-btn mat-skeuo-filled mat-pressable-filled" :disabled="gfLoading" @click="saveGoogleForm">
                  <i class="fas fa-floppy-disk"></i> {{ gfLoading ? 'Saving…' : 'Save Google Form' }}
                </button>
              </div>
            </div>
          </div>
          <!-- ══ END NEW — MHO GOOGLE FORM ══ -->

          <!-- ══ CHARTER SERVICES (compact accordion) ══ -->
          <div class="panel">
            <div class="panel-head">
              <i class="fas fa-list-check"></i>
              <div class="ph-text"><h3>Charter Services</h3><p>{{ services.length }} service(s) — click a row to edit</p></div>
            </div>
            <div class="panel-body panel-body-flush">
              <div v-if="services.length === 0" class="empty-note">No services yet — add the first one below.</div>

              <div
                v-for="(svc, i) in services"
                :key="svc.id"
                class="svc"
                :class="{ open: expandedId === svc.id }"
              >
                <!-- collapsed strip -->
                <div class="svc-row" @click="toggleExpand(svc.id)">
                  <span class="svc-num">{{ i + 1 }}</span>
                  <span class="svc-name">{{ svc.name || 'Untitled service' }}</span>
                  <span class="svc-tags mat-well">
                    <span v-if="svc.bulletsText" class="mini-tag mat-well" title="Has bullet points"><i class="fas fa-list-ul"></i></span>
                    <span v-if="svc.detail" class="mini-tag mat-well" title="Has detail line"><i class="fas fa-circle-info"></i></span>
                  </span>
                  <span class="svc-tools" @click.stop>
                    <button class="tool-btn mat-skeuo-sm mat-pressable-sm" :disabled="i === 0 || moving" @click="moveService(i, -1)" title="Move up"><i class="fas fa-arrow-up"></i></button>
                    <button class="tool-btn mat-skeuo-sm mat-pressable-sm" :disabled="i === services.length - 1 || moving" @click="moveService(i, 1)" title="Move down"><i class="fas fa-arrow-down"></i></button>
                    <button class="tool-btn danger mat-skeuo-sm mat-pressable-sm" @click="removeService(svc)" title="Delete"><i class="fas fa-trash"></i></button>
                  </span>
                  <i class="fas fa-chevron-down chev" :class="{ flip: expandedId === svc.id }"></i>
                </div>

                <!-- expanded editor -->
                <div v-if="expandedId === svc.id" class="svc-body">
                  <div class="grid-2">
                    <div class="field">
                      <label>Service Name</label>
                      <input v-model="svc.name" type="text" maxlength="255" />
                    </div>
                    <div class="field">
                      <label>Detail Line <span class="hint">(optional, • separated)</span></label>
                      <input v-model="svc.detail" type="text" maxlength="500" />
                    </div>
                  </div>
                  <div class="field">
                    <label>Description</label>
                    <textarea v-model="svc.description" rows="3"></textarea>
                  </div>
                  <div class="field">
                    <label>Bullet Points <span class="hint">(one per line — optional)</span></label>
                    <textarea v-model="svc.bulletsText" rows="2" placeholder="Tooth Examination&#10;Tooth Extraction (if needed)"></textarea>
                  </div>
                  <div class="actions-row">
                    <button class="primary-btn sm mat-skeuo-filled mat-pressable-filled" :disabled="savingSvc[svc.id]" @click="saveService(svc)">
                      <i class="fas fa-floppy-disk"></i> {{ savingSvc[svc.id] ? 'Saving…' : 'Save Changes' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ══ ADD SERVICE (collapsed by default) ══ -->
          <div class="panel">
            <div class="panel-head clickable" @click="showAddForm = !showAddForm">
              <i class="fas fa-circle-plus"></i>
              <div class="ph-text"><h3>Add New Service</h3><p>Appended to the end of the list</p></div>
              <i class="fas fa-chevron-down chev head-chev" :class="{ flip: showAddForm }"></i>
            </div>
            <div v-if="showAddForm" class="panel-body">
              <div class="grid-2">
                <div class="field">
                  <label>Service Name</label>
                  <input v-model="newService.name" type="text" maxlength="255" />
                </div>
                <div class="field">
                  <label>Detail Line <span class="hint">(optional)</span></label>
                  <input v-model="newService.detail" type="text" maxlength="500" />
                </div>
              </div>
              <div class="field">
                <label>Description</label>
                <textarea v-model="newService.description" rows="3"></textarea>
              </div>
              <div class="field">
                <label>Bullet Points <span class="hint">(one per line — optional)</span></label>
                <textarea v-model="newService.bulletsText" rows="2"></textarea>
              </div>
              <div class="actions-row">
                <button class="primary-btn mat-skeuo-filled mat-pressable-filled" :disabled="addingService" @click="addService">
                  <i class="fas fa-plus"></i> {{ addingService ? 'Adding…' : 'Add Service' }}
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mho-admin {
  width: 100%;
  box-sizing: border-box;
  flex: 1 1 auto;
  min-width: 0;
  padding: 32px 28px;
  font-family: var(--font-body);
  background: var(--bg);
  min-height: 100%;
}
/* ── shared shell — single width constraint for header + content ── */
.mho-shell { width: 100%; max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }

.mod-header { display: flex; justify-content: space-between; align-items: flex-start; }
.mh-left { display: flex; align-items: center; gap: 14px; }
.mh-left > i { font-size: 1.8rem; color: var(--ac); }
.mh-left h2 { margin: 0; font-family: var(--font-display); font-size: 1.4rem; color: var(--fg); font-weight: 700; }
.mh-left p { margin: 3px 0 0; font-size: 0.82rem; color: var(--mt); }

.mho-content { display: flex; flex-direction: column; gap: 16px; }
.toasts { display: flex; flex-direction: column; gap: 8px; }
.toast { padding: 10px 14px; display: flex; align-items: center; gap: 10px; font-size: 0.84rem; font-weight: 500; border-radius: var(--r-sm); }
.toast.success { background: var(--oks); color: var(--ok); border: 1px solid var(--okg); }
.toast.error { background: var(--dgs); color: var(--dg); border: 1px solid var(--dgg); }
.msg-enter-active, .msg-leave-active { transition: all 0.22s ease; }
.msg-enter-from, .msg-leave-to { opacity: 0; transform: translateY(-6px); }

.state-box { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 70px 20px; gap: 12px; color: var(--mt); background: var(--card-solid); border: 1px solid var(--bdr); border-radius: var(--r-md); }
.state-box i { font-size: 2rem; }
.state-box.error i { color: var(--dg); }
.state-box p { font-size: 0.88rem; margin: 0; }
.retry-btn { margin-top: 10px; padding: 9px 20px; border-radius: var(--r-sm); font-family: var(--font-body); font-size: 0.82rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 7px; }
.retry-btn:hover { background: var(--ac2); transform: translateY(-2px); }

/* ── panels ── */
.panel { background: var(--card-solid); border: 1px solid var(--bdr); border-radius: var(--r-md); overflow: hidden; }
.panel-head { display: flex; align-items: center; gap: 12px; padding: 14px 20px; background: var(--bg2); border-bottom: 1px solid var(--bdr); }
.panel-head > i { font-size: 1.05rem; color: var(--ac); }
.panel-head.clickable { cursor: pointer; user-select: none; }
.panel-head.clickable:hover { background: var(--card2); }
.ph-text { flex: 1; }
.panel-head h3 { margin: 0; font-size: 0.9rem; font-weight: 700; color: var(--fg); }
.panel-head p { margin: 1px 0 0; font-size: 0.74rem; color: var(--mt); }
.head-chev { color: var(--mt); font-size: 0.75rem; }
.panel-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 13px; }
.panel-body-flush { padding: 10px 12px; }

/* ── fields ── */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field label { font-size: 0.72rem; font-weight: 700; color: var(--mt); letter-spacing: 0.03em; }
.field label .hint { font-weight: 500; color: var(--mt2); }
.field input, .field textarea {
  width: 100%; padding: 8px 11px;
  background: var(--bg); border: 1px solid var(--bdr2); border-radius: var(--r-sm);
  font-family: var(--font-body); font-size: 0.84rem; color: var(--fg);
  resize: vertical; transition: border-color 0.2s, box-shadow 0.2s;
}
.field input:focus, .field textarea:focus { outline: none; border-color: var(--ac); box-shadow: 0 0 0 3px var(--acg); }
.field textarea { line-height: 1.5; }

/* ── badges chips ── */
.badges-wrap { display: flex; flex-wrap: wrap; gap: 8px; }
.badge-chip { display: inline-flex; align-items: center; gap: 4px; border-radius: var(--r-pill); padding: 3px 6px 3px 12px; }
.badge-chip input {
  border: none; background: transparent; padding: 3px 0;
  font-family: var(--font-body); font-size: 0.8rem; color: var(--fg);
  width: 150px; outline: none;
}
.chip-x { width: 20px; height: 20px; border-radius: 50%; cursor: pointer; font-size: 0.65rem; display: flex; align-items: center; justify-content: center; }
.chip-x:hover { background: var(--dgs); color: var(--dg); }
.chip-add { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 6px 14px; border-radius: var(--r-pill); font-family: var(--font-body); font-size: 0.78rem; font-weight: 600; cursor: pointer; }
.chip-add:hover:not(:disabled) { border-color: var(--ac); background: var(--acs); }
.chip-add:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── MHO Google Form panel ── */
.gf-preview {
  position: relative; height: 150px; border-radius: var(--r-sm);
  background-size: cover; background-position: center; background-color: var(--bg3);
  border: 1px solid var(--bdr); overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.gf-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--mt2); font-size: 0.8rem; }
.gf-empty i { font-size: 1.4rem; opacity: .6; }
.gf-newtag { position: absolute; top: 8px; right: 8px; padding: 3px 10px; border-radius: var(--r-sm); font-size: .62rem; font-weight: 800; text-transform: uppercase; background: var(--tl); color: #fff; }
.gf-actions { display: flex; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
.gf-btn { width: auto; min-width: 132px; min-height: 34px; padding: 7px 14px; font-weight: 700; justify-content: center; }
.gf-btn.gf-danger { color: var(--dg); }
.gf-btn.gf-danger:hover:not(:disabled) { color: var(--dg); border-color: var(--dg); background: var(--dgs); }
.gf-hidden { display: none; }

/* ── compact service accordion ── */
.svc { border: 1px solid var(--bdr); border-radius: var(--r-sm); background: var(--bg); overflow: hidden; transition: border-color 0.2s, box-shadow 0.2s; }
.svc + .svc { margin-top: 7px; }
.svc.open { border-color: var(--ac); box-shadow: 0 2px 12px var(--acg); }

.svc-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; cursor: pointer; user-select: none;
  transition: background 0.15s;
}
.svc-row:hover { background: var(--card2); }
.svc.open .svc-row { background: var(--acs); }

.svc-num {
  font-family: var(--font-display); font-weight: 700; font-size: 0.82rem;
  color: var(--ac); background: var(--card-solid);
  border: 1px solid var(--bdr2); border-radius: var(--r-sm);
  width: 28px; height: 28px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.svc.open .svc-num { border-color: var(--ac); }

.svc-name {
  flex: 1; min-width: 0;
  font-size: 0.85rem; font-weight: 600; color: var(--fg);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.svc-tags { display: flex; gap: 5px; flex-shrink: 0; }
.mini-tag { width: 22px; height: 22px; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; font-size: 0.62rem; }

.svc-tools { display: flex; gap: 6px; flex-shrink: 0; align-items: center; }
.tool-btn { width: 30px; height: 30px; border-radius: var(--r-sm); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 0.68rem; }
.tool-btn:hover:not(:disabled) { color: var(--ac); border-color: var(--ac); background: var(--acs); }
.tool-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.tool-btn.danger:hover:not(:disabled) { color: var(--dg); border-color: var(--dg); background: var(--dgs); }
.gf-actions .tool-btn { width: auto; min-width: 132px; max-width: 180px; }
.gf-actions .tool-btn.gf-btn { width: auto; min-width: 132px; }

.chev { font-size: 0.7rem; color: var(--mt); flex-shrink: 0; transition: transform 0.25s var(--ease); }
.chev.flip { transform: rotate(180deg); }

/* expanded editor */
.svc-body {
  padding: 14px 12px 12px;
  border-top: 1px solid var(--bdr);
  display: flex; flex-direction: column; gap: 12px;
  background: var(--card-solid);
}
.svc-body .field input, .svc-body .field textarea { background: var(--bg); }

/* ── shared ── */
.actions-row { display: flex; justify-content: flex-end; }
.empty-note { font-size: 0.82rem; color: var(--mt); font-style: italic; padding: 10px 6px; }

.primary-btn { display: inline-flex; align-items: center; gap: 8px; padding: 9px 20px; border-radius: var(--r-sm); font-family: var(--font-body); font-size: 0.82rem; font-weight: 700; cursor: pointer; }
.primary-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 18px var(--acg); }
.primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.primary-btn.sm { padding: 8px 16px; font-size: 0.78rem; }

@media (max-width: 640px) {
  .mho-admin { padding: 16px; }
  .grid-2 { grid-template-columns: 1fr; }
  .svc-tags { display: none; }
  .svc-row { flex-wrap: wrap; }
  .svc-name { flex-basis: calc(100% - 110px); }
  .actions-row { justify-content: stretch; }
  .primary-btn { width: 100%; justify-content: center; }
}
</style>