<script setup>
import { ref, onMounted } from 'vue'
import { handleAdminAuthError } from '../../../utils/adminAuth'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api'
const getToken = () => localStorage.getItem('baco_admin_token') || ''

const loading   = ref(true)
const loadError = ref('')
const successMsg = ref('')
const errorMsg   = ref('')

const offices     = ref([])
const expandedId  = ref(null)
const showAddForm = ref(false)

const savingAdd = ref(false)
const savingRow = ref({})
const moving    = ref(false)

const newOffice = ref({ name: '', location: '', contact: '', email: '', linkPage: '', logo: '' })

let toastTimer = null
const flash = (msg, isError = false) => {
  if (isError) { errorMsg.value = msg; successMsg.value = '' }
  else { successMsg.value = msg; errorMsg.value = '' }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { successMsg.value = ''; errorMsg.value = '' }, 4000)
}

// 📋 LOG — content change logger
const logChange = async (entityId, entityTitle, action, changes) => {
  const token = getToken()
  if (!token) return
  try {
    await fetch(`${API_BASE}/admin/content-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ section: 'offices', entityId: String(entityId || ''), entityTitle, action, changes })
    })
  } catch (e) { console.error('Log error:', e) }
}

const fetchOffices = async () => {
  loading.value = true; loadError.value = ''
  try {
    const res = await fetch(`${API_BASE}/offices`, { cache: 'no-store' })
    if (!res.ok) { if (handleAdminAuthError(res)) return; throw new Error('Failed to load offices.') }
    offices.value = (await res.json()).map(o => ({ ...o, _logoNew: null, _logoClear: false, _original: null }))
  } catch (e) { loadError.value = e.message || 'Failed to load.' }
  finally { loading.value = false }
}

// ── expand / collapse ──
const toggleExpand = (o) => {
  if (expandedId.value === o.id) { expandedId.value = null; o._original = null; return }
  expandedId.value = o.id
  o._original = { name: o.name, location: o.location, contact: o.contact, email: o.email, linkPage: o.linkPage, hasLogo: !!o.logo }
}

// ── logo pickers (label-wrapped inputs — no refs needed) ──
const handleAddLogo = (e) => {
  const file = e.target.files[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { flash('Please choose an image file.', true); return }
  const reader = new FileReader()
  reader.onload = (ev) => { newOffice.value.logo = ev.target.result }
  reader.readAsDataURL(file)
  e.target.value = ''
}
const handleRowLogo = (e, o) => {
  const file = e.target.files[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { flash('Please choose an image file.', true); return }
  const reader = new FileReader()
  reader.onload = (ev) => { o._logoNew = ev.target.result; o._logoClear = false }
  reader.readAsDataURL(file)
  e.target.value = ''
}
const rowLogoPreview = (o) => o._logoNew || o.logo

// ── add ──
const addOffice = async () => {
  const token = getToken()
  if (!token) { flash('Authentication required. Please log in.', true); return }
  if (!newOffice.value.name.trim()) { flash('Office name is required.', true); return }
  const link = newOffice.value.linkPage.trim()
  if (link && !/^https?:\/\//i.test(link)) { flash('Link page must start with http:// or https://.', true); return }
  savingAdd.value = true
  try {
    const body = {
      name: newOffice.value.name.trim(),
      location: newOffice.value.location.trim(),
      contact: newOffice.value.contact,
      email: newOffice.value.email,
      linkPage: link
    }
    if (newOffice.value.logo) body.logo = newOffice.value.logo
    const res = await fetch(`${API_BASE}/admin/offices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { if (handleAdminAuthError(res)) return; throw new Error(data.message || 'Add failed.') }
    newOffice.value = { name: '', location: '', contact: '', email: '', linkPage: '', logo: '' }
    showAddForm.value = false
    await fetchOffices()
    flash('Office added.')
  } catch (e) { flash(e.message, true) }
  finally { savingAdd.value = false }
}

// ── edit / save row ──
const saveOffice = async (o) => {
  const token = getToken()
  if (!token) { flash('Authentication required. Please log in.', true); return }
  if (!o.name.trim()) { flash('Office name is required.', true); return }
  const link = (o.linkPage || '').trim()
  if (link && !/^https?:\/\//i.test(link)) { flash('Link page must start with http:// or https://.', true); return }
  savingRow.value = { ...savingRow.value, [o.id]: true }
  try {
    const body = {
      name: o.name.trim(),
      location: o.location || '',
      contact: o.contact || '',
      email: o.email || '',
      linkPage: link
    }
    if (o._logoNew) body.logo = o._logoNew
    else if (o._logoClear) body.logo = ''
    const res = await fetch(`${API_BASE}/admin/offices/${o.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { if (handleAdminAuthError(res)) return; throw new Error(data.message || 'Save failed.') }
    // diff log
    const orig = o._original || {}
    const changes = {}
    if (o.name.trim() !== orig.name) changes.name = { old: orig.name, new: o.name.trim() }
    if ((o.location || '') !== (orig.location || '')) changes.location = { old: orig.location || '—', new: o.location || '—' }
    if ((o.contact || '') !== (orig.contact || '')) changes.contact = { old: 'previous', new: 'updated' }
    if ((o.email || '') !== (orig.email || '')) changes.email = { old: 'previous', new: 'updated' }
    if (link !== (orig.linkPage || '')) changes.linkPage = { old: orig.linkPage || '—', new: link || '—' }
    if (o._logoNew) changes.logo = { new: 'Updated' }
    if (o._logoClear) changes.logo = { new: 'Removed' }
    if (Object.keys(changes).length) await logChange(o.id, o.name.trim(), 'update', changes)
    expandedId.value = null
    await fetchOffices()
    flash('Office updated.')
  } catch (e) { flash(e.message, true) }
  finally { const c = { ...savingRow.value }; delete c[o.id]; savingRow.value = c }
}

// ── delete ──
const removeOffice = async (o) => {
  const token = getToken()
  if (!token) { flash('Authentication required. Please log in.', true); return }
  if (!window.confirm(`Delete "${o.name}"? This cannot be undone.`)) return
  try {
    const res = await fetch(`${API_BASE}/admin/offices/${o.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { if (handleAdminAuthError(res)) return; throw new Error(data.message || 'Delete failed.') }
    if (expandedId.value === o.id) expandedId.value = null
    await logChange(o.id, o.name, 'delete', null)
    await fetchOffices()
    flash('Office deleted.')
  } catch (e) { flash(e.message, true) }
}

// ── reorder ──
const moveOffice = async (index, dir) => {
  const arr = [...offices.value]
  const target = index + dir
  if (target < 0 || target >= arr.length) return
  ;[arr[index], arr[target]] = [arr[target], arr[index]]
  offices.value = arr
  const token = getToken()
  if (!token) return
  moving.value = true
  try {
    const res = await fetch(`${API_BASE}/admin/offices/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ids: arr.map(o => o.id) })
    })
    if (!res.ok) { if (handleAdminAuthError(res)) return; throw new Error('Reorder failed.') }
  } catch (e) { flash(e.message, true); await fetchOffices() }
  finally { moving.value = false }
}

onMounted(fetchOffices)
</script>

<template>
  <div class="off-admin">
    <div class="mod-header">
      <div class="mh-left">
        <i class="fas fa-building-columns"></i>
        <div>
          <h2>LGU Offices Directory</h2>
          <p>Offices shown on the public "All Offices" page — logo, location, contacts, Facebook link</p>
        </div>
      </div>
    </div>

    <div v-if="loadError" class="state-box error">
      <i class="fas fa-exclamation-triangle"></i>
      <p>{{ loadError }}</p>
      <button @click="fetchOffices" class="retry-btn mat-skeuo-sm mat-pressable-sm"><i class="fas fa-rotate-right"></i> Retry</button>
    </div>

    <div v-else class="off-content">
      <div class="toasts">
        <Transition name="msg"><div v-if="successMsg" class="toast success"><i class="fas fa-circle-check"></i> {{ successMsg }}</div></Transition>
        <Transition name="msg"><div v-if="errorMsg" class="toast error"><i class="fas fa-circle-exclamation"></i> {{ errorMsg }}</div></Transition>
      </div>

      <div v-if="loading" class="state-box">
        <i class="fas fa-spinner fa-spin"></i><p>Loading offices…</p>
      </div>

      <template v-else>
        <!-- ══ DIRECTORY (accordion rows) ══ -->
        <div class="panel">
          <div class="panel-head">
            <i class="fas fa-list"></i>
            <div class="ph-text"><h3>Offices</h3><p>{{ offices.length }} office(s) — click a row to edit</p></div>
          </div>
          <div class="panel-body panel-body-flush">
            <div v-if="offices.length === 0" class="empty-note">No offices yet — add the first one below.</div>

            <div
              v-for="(o, i) in offices"
              :key="o.id"
              class="svc"
              :class="{ open: expandedId === o.id }"
            >
              <!-- collapsed strip -->
              <div class="svc-row" @click="toggleExpand(o)">
                <img v-if="rowLogoPreview(o)" :src="rowLogoPreview(o)" class="row-logo" alt="" />
                <span v-else class="row-logo row-logo-ph"><i class="fas fa-building-columns"></i></span>
                <span class="svc-name">
                  {{ o.name }}
                  <small class="row-sub">{{ o.location || o.linkPage || '—' }}</small>
                </span>
                <span class="svc-tools" @click.stop>
                  <button class="tool-btn mat-skeuo-sm mat-pressable-sm" :disabled="i === 0 || moving" @click="moveOffice(i, -1)" title="Move up"><i class="fas fa-arrow-up"></i></button>
                  <button class="tool-btn mat-skeuo-sm mat-pressable-sm" :disabled="i === offices.length - 1 || moving" @click="moveOffice(i, 1)" title="Move down"><i class="fas fa-arrow-down"></i></button>
                  <button class="tool-btn danger mat-skeuo-sm mat-pressable-sm" @click="removeOffice(o)" title="Delete"><i class="fas fa-trash"></i></button>
                </span>
                <i class="fas fa-chevron-down chev" :class="{ flip: expandedId === o.id }"></i>
              </div>

              <!-- expanded editor -->
              <div v-if="expandedId === o.id" class="svc-body" @click.stop>
                <div class="grid-2">
                  <div class="field">
                    <label>Office Name <span class="req">*</span></label>
                    <input v-model="o.name" type="text" maxlength="255" />
                  </div>
                  <div class="field">
                    <label>Location</label>
                    <input v-model="o.location" type="text" maxlength="500" placeholder="e.g. Poblacion, Baco, Oriental Mindoro 5201" />
                  </div>
                </div>
                <div class="grid-2">
                  <div class="field">
                    <label>Contact No. <span class="hint">(one per line — supports multiple hotlines)</span></label>
                    <textarea v-model="o.contact" rows="2" placeholder="09985985815 – Smart&#10;09546243714 – Globe"></textarea>
                  </div>
                  <div class="field">
                    <label>Email <span class="hint">(one per line)</span></label>
                    <textarea v-model="o.email" rows="2" placeholder="office@example.gov.ph"></textarea>
                  </div>
                </div>
                <div class="field">
                  <label>Facebook Page Link</label>
                  <input v-model="o.linkPage" type="url" placeholder="https://www.facebook.com/..." />
                </div>
                <div class="field">
                  <label>Office Logo</label>
                  <div class="logo-edit">
                    <div class="logo-edit-preview" :style="rowLogoPreview(o) ? { backgroundImage: `url(${rowLogoPreview(o)})` } : {}">
                      <span v-if="!rowLogoPreview(o)" class="le-empty"><i class="fas fa-image"></i> No logo</span>
                      <span v-if="o._logoNew" class="le-newtag">New</span>
                    </div>
                    <div class="le-actions">
                      <label class="tool-btn gf-btn mat-skeuo-sm mat-pressable-sm">
                        <i class="fas fa-upload"></i> {{ rowLogoPreview(o) ? 'Replace' : 'Upload' }}
                        <input type="file" accept="image/*" class="le-hidden" @change="(e) => handleRowLogo(e, o)" />
                      </label>
                      <button v-if="o._logoNew" type="button" class="tool-btn gf-btn" @click="o._logoNew = null"><i class="fas fa-rotate-left"></i> Undo</button>
                      <button v-else-if="o.logo" type="button" class="tool-btn gf-btn danger" @click="o._logoClear = true; o._logoNew = null"><i class="fas fa-trash"></i> Remove</button>
                      <button v-if="o._logoClear" type="button" class="tool-btn gf-btn" @click="o._logoClear = false"><i class="fas fa-rotate-left"></i> Undo removal</button>
                    </div>
                  </div>
                </div>
                <div class="actions-row">
                  <button class="primary-btn sm mat-skeuo-filled mat-pressable-filled" :disabled="savingRow[o.id]" @click="saveOffice(o)">
                    <i class="fas fa-floppy-disk"></i> {{ savingRow[o.id] ? 'Saving…' : 'Save Changes' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ══ ADD OFFICE (collapsed by default) ══ -->
        <div class="panel">
          <div class="panel-head clickable" @click="showAddForm = !showAddForm">
            <i class="fas fa-circle-plus"></i>
            <div class="ph-text"><h3>Add New Office</h3><p>Appended to the end of the list</p></div>
            <i class="fas fa-chevron-down chev head-chev" :class="{ flip: showAddForm }"></i>
          </div>
          <div v-if="showAddForm" class="panel-body">
            <div class="grid-2">
              <div class="field">
                <label>Office Name <span class="req">*</span></label>
                <input v-model="newOffice.name" type="text" maxlength="255" />
              </div>
              <div class="field">
                <label>Location</label>
                <input v-model="newOffice.location" type="text" maxlength="500" />
              </div>
            </div>
            <div class="grid-2">
              <div class="field">
                <label>Contact No. <span class="hint">(one per line)</span></label>
                <textarea v-model="newOffice.contact" rows="2"></textarea>
              </div>
              <div class="field">
                <label>Email <span class="hint">(one per line)</span></label>
                <textarea v-model="newOffice.email" rows="2"></textarea>
              </div>
            </div>
            <div class="field">
              <label>Facebook Page Link</label>
              <input v-model="newOffice.linkPage" type="url" placeholder="https://www.facebook.com/..." />
            </div>
            <div class="field">
              <label>Office Logo</label>
              <div class="logo-edit">
                <div class="logo-edit-preview" :style="newOffice.logo ? { backgroundImage: `url(${newOffice.logo})` } : {}">
                  <span v-if="!newOffice.logo" class="le-empty"><i class="fas fa-image"></i> No logo</span>
                  <span v-else class="le-newtag">New</span>
                </div>
                <div class="le-actions">
                  <label class="tool-btn gf-btn mat-skeuo-sm mat-pressable-sm">
                    <i class="fas fa-upload"></i> {{ newOffice.logo ? 'Replace' : 'Upload' }}
                    <input type="file" accept="image/*" class="le-hidden" @change="handleAddLogo" />
                  </label>
                  <button v-if="newOffice.logo" type="button" class="tool-btn gf-btn" @click="newOffice.logo = ''"><i class="fas fa-xmark"></i> Clear</button>
                </div>
              </div>
            </div>
            <div class="actions-row">
              <button class="primary-btn mat-skeuo-filled mat-pressable-filled" :disabled="savingAdd" @click="addOffice">
                <i class="fas fa-plus"></i> {{ savingAdd ? 'Adding…' : 'Add Office' }}
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.off-admin { padding: 32px 28px; font-family: var(--font-body); background: var(--bg); min-height: 100%; }
.mod-header { display: flex; justify-content: space-between; align-items: flex-start; margin: 0 auto 20px; width: 100%; max-width: 1240px; }
.mh-left { display: flex; align-items: center; gap: 14px; }
.mh-left > i { font-size: 1.8rem; color: var(--ac); }
.mh-left h2 { margin: 0; font-family: var(--font-display); font-size: 1.4rem; color: var(--fg); font-weight: 700; }
.mh-left p { margin: 3px 0 0; font-size: 0.82rem; color: var(--mt); }

.off-content { width: 100%; max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
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

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field label { font-size: 0.72rem; font-weight: 700; color: var(--mt); letter-spacing: 0.03em; }
.field label .hint, .field label .req { font-weight: 500; }
.field label .hint { color: var(--mt2); }
.field label .req { color: var(--dg); }
.field input, .field textarea {
  width: 100%; padding: 8px 11px;
  background: var(--bg); border: 1px solid var(--bdr2); border-radius: var(--r-sm);
  font-family: var(--font-body); font-size: 0.84rem; color: var(--fg);
  resize: vertical; transition: border-color 0.2s, box-shadow 0.2s;
}
.field input:focus, .field textarea:focus { outline: none; border-color: var(--ac); box-shadow: 0 0 0 3px var(--acg); }
.field textarea { line-height: 1.5; }

.svc { border: 1px solid var(--bdr); border-radius: var(--r-sm); background: var(--bg); overflow: hidden; transition: border-color 0.2s, box-shadow 0.2s; }
.svc + .svc { margin-top: 7px; }
.svc.open { border-color: var(--ac); box-shadow: 0 2px 12px var(--acg); }

.svc-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; cursor: pointer; user-select: none; transition: background 0.15s; }
.svc-row:hover { background: var(--card2); }
.svc.open .svc-row { background: var(--acs); }

.row-logo { width: 36px; height: 36px; border-radius: var(--r-sm); object-fit: cover; flex-shrink: 0; background: var(--card-solid); border: 1px solid var(--bdr2); }
.row-logo-ph { display: flex; align-items: center; justify-content: center; color: var(--mt2); font-size: 0.8rem; }

.svc-name { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; font-size: 0.85rem; font-weight: 600; color: var(--fg); }
.row-sub { font-size: 0.7rem; font-weight: 500; color: var(--mt); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.svc-tools { display: flex; gap: 4px; flex-shrink: 0; }
.tool-btn { width: 26px; height: 26px; border-radius: var(--r-sm); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.68rem; }
.tool-btn:hover:not(:disabled) { color: var(--ac); border-color: var(--ac); background: var(--acs); }
.tool-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.tool-btn.danger:hover:not(:disabled) { color: var(--dg); border-color: var(--dg); background: var(--dgs); }

.chev { font-size: 0.7rem; color: var(--mt); flex-shrink: 0; transition: transform 0.25s var(--ease); }
.chev.flip { transform: rotate(180deg); }

.svc-body { padding: 14px 12px 12px; border-top: 1px solid var(--bdr); display: flex; flex-direction: column; gap: 12px; background: var(--card-solid); }
.svc-body .field input, .svc-body .field textarea { background: var(--bg); }

/* ── logo editor ── */
.logo-edit { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.logo-edit-preview {
  position: relative; width: 84px; height: 84px; border-radius: var(--r-sm);
  background-size: cover; background-position: center; background-color: var(--bg3);
  border: 1px solid var(--bdr); display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.le-empty { display: flex; flex-direction: column; align-items: center; gap: 4px; color: var(--mt2); font-size: 0.62rem; }
.le-empty i { font-size: 1rem; opacity: .6; }
.le-newtag { position: absolute; top: 4px; right: 4px; padding: 2px 7px; border-radius: var(--r-sm); font-size: .56rem; font-weight: 800; text-transform: uppercase; background: var(--tl); color: #fff; }
.le-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.gf-btn { width: auto; padding: 6px 14px; font-weight: 700; }
.gf-btn.danger { color: var(--dg); }
.gf-btn.danger:hover:not(:disabled) { color: var(--dg); border-color: var(--dg); background: var(--dgs); }
.le-hidden { display: none; }

.actions-row { display: flex; justify-content: flex-end; }
.empty-note { font-size: 0.82rem; color: var(--mt); font-style: italic; padding: 10px 6px; }

.primary-btn { display: inline-flex; align-items: center; gap: 8px; padding: 9px 20px; border-radius: var(--r-sm); font-family: var(--font-body); font-size: 0.82rem; font-weight: 700; cursor: pointer; }
.primary-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 18px var(--acg); }
.primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.primary-btn.sm { padding: 8px 16px; font-size: 0.78rem; }

@media (max-width: 640px) {
  .off-admin { padding: 16px; }
  .grid-2 { grid-template-columns: 1fr; }
  .svc-row { flex-wrap: wrap; }
  .svc-name { flex-basis: calc(100% - 110px); }
  .actions-row { justify-content: stretch; }
  .primary-btn { width: 100%; justify-content: center; }
}
</style>