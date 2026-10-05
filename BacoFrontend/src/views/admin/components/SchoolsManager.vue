<script setup>
import { ref, onMounted } from 'vue'
import { API } from '@/api'

const token = () => localStorage.getItem('baco_admin_token') || ''
const headers = () => ({ 'Authorization': `Bearer ${token()}` })

const TYPES = [
  { key: 'elementary', label: '🏫 Elementary' },
  { key: 'highschool', label: '🎓 High School' },
  { key: 'college',    label: '🏛️ College / Tertiary' },
  { key: 'ipded',      label: '🌿 IPEd / Mangyan' }
]

const schools = ref([])
const loading = ref(true)
const error = ref('')
const showForm = ref(false)
const editing = ref(null)
const saving = ref(false)
const search = ref('')

// logoVal / imageVal: '' = cleared · base64 = new upload · existing URL = unchanged
// galleryDraft: array of existing URLs + new base64 entries (always sent → removals stick)
const emptyForm = {
  name: '', type: 'elementary', status: 'active', location: '', address: '',
  contactPerson: '', phone: '', email: '', fbLink: '', hours: '',
  lat: '', lng: '', description: '', tagsInput: '',
  logoVal: '', imageVal: '', galleryDraft: []
}
const form = ref({ ...emptyForm })

const visibleSchools = () => {
  const q = search.value.trim().toLowerCase()
  if (!q) return schools.value
  return schools.value.filter(s =>
    s.name.toLowerCase().includes(q) || (s.location || '').toLowerCase().includes(q))
}

// DB tags are pipe-separated "A|B|C"; the form edits a comma list
const tagsToInput = (tags) => Array.isArray(tags) ? tags.join(', ') : String(tags || '').split('|').join(', ')
const inputToTags = (text) => text.split(',').map(t => t.trim()).filter(Boolean)

async function load () {
  loading.value = true
  try {
    const res = await fetch(`${API}/schools`)
    schools.value = res.ok ? await res.json() : []
  } catch (e) { error.value = 'Failed to load schools.' }
  loading.value = false
}

function typeLabel (t) { return (TYPES.find(x => x.key === t) || TYPES[0]).label }

function openCreate () {
  editing.value = null
  form.value = { ...emptyForm }
  error.value = ''
  showForm.value = true
}

function openEdit (s) {
  editing.value = s
  form.value = {
    name: s.name, type: s.type, status: s.status || 'active',
    location: s.location || '', address: s.address || '',
    contactPerson: s.contactPerson || '', phone: s.phone || '',
    email: s.email || '', fbLink: s.fbLink || '', hours: s.hours || '',
    lat: s.lat ?? '', lng: s.lng ?? '',
    description: s.description || '',
    tagsInput: tagsToInput(s.tags),
    logoVal: s.logo || '',
    imageVal: s.image || '',
    galleryDraft: Array.isArray(s.gallery) ? [...s.gallery] : []
  }
  error.value = ''
  showForm.value = true
}

const readImageTo = (file, target) => {
  if (file.size > 5 * 1024 * 1024) { error.value = 'Image must be 5MB or smaller.'; return false }
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => { form.value[target] = reader.result; resolve(true) }
    reader.onerror = () => resolve(false)
    reader.readAsDataURL(file)
  })
}

async function onLogoChange (e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (file) await readImageTo(file, 'logoVal')
}
async function onImageChange (e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (file) await readImageTo(file, 'imageVal')
}
async function onGalleryAdd (e) {
  const files = Array.from(e.target.files || [])
  e.target.value = ''
  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) { error.value = `"${file.name}" is over 5MB — skipped.`; continue }
    await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => { form.value.galleryDraft.push(reader.result); resolve() }
      reader.onerror = () => resolve()
      reader.readAsDataURL(file)
    })
  }
}
const removeGalleryItem = (i) => form.value.galleryDraft.splice(i, 1)

async function logHistory (action, title, changes) {
  try {
    await fetch(`${API}/admin/content-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ section: 'schools', action, entityTitle: title, changes })
    })
  } catch (e) { /* best-effort */ }
}

async function save () {
  if (!form.value.name.trim()) { error.value = 'School name is required.'; return }
  if (form.value.lat !== '' && isNaN(Number(form.value.lat))) { error.value = 'Latitude must be a number.'; return }
  if (form.value.lng !== '' && isNaN(Number(form.value.lng))) { error.value = 'Longitude must be a number.'; return }
  const fb = (form.value.fbLink || '').trim()
  if (fb && !/^https?:\/\//i.test(fb)) { error.value = 'Facebook link must start with http:// or https://.'; return }
  saving.value = true; error.value = ''

  const payload = {
    name: form.value.name.trim(),
    type: form.value.type,
    status: form.value.status,
    location: form.value.location,
    address: form.value.address,
    contactPerson: form.value.contactPerson,
    phone: form.value.phone,
    email: form.value.email,
    fbLink: fb,
    hours: form.value.hours,
    lat: form.value.lat === '' ? null : Number(form.value.lat),
    lng: form.value.lng === '' ? null : Number(form.value.lng),
    description: form.value.description,
    tags: inputToTags(form.value.tagsInput),
    logo: form.value.logoVal,        // '' clears · URL keeps · base64 replaces
    image: form.value.imageVal,
    gallery: form.value.galleryDraft // full array → removals + additions persist
  }

  const original = editing.value
  try {
    const res = await fetch(
      editing.value ? `${API}/admin/schools/${editing.value.id}` : `${API}/admin/schools`,
      {
        method: editing.value ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify(payload)
      }
    )
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.message || 'Save failed.') }

    // 📋 LOG — diff against the original record
    const changes = {}
    if (original) {
      if (payload.name !== original.name) changes.name = { old: original.name, new: payload.name }
      if (payload.type !== original.type) changes.type = { old: original.type, new: payload.type }
      if (payload.status !== (original.status || 'active')) changes.status = { old: original.status || 'active', new: payload.status }
      if ((payload.location || '') !== (original.location || '')) changes.location = { old: original.location || '—', new: payload.location || '—' }
      if ((payload.address || '') !== (original.address || '')) changes.address = { old: 'previous', new: 'updated' }
      if ((payload.contactPerson || '') !== (original.contactPerson || '')) changes.contactPerson = { old: 'previous', new: 'updated' }
      if ((payload.phone || '') !== (original.phone || '')) changes.phone = { old: 'previous', new: 'updated' }
      if ((payload.email || '') !== (original.email || '')) changes.email = { old: 'previous', new: 'updated' }
      if ((payload.fbLink || '') !== (original.fbLink || '')) changes.fbLink = { old: original.fbLink || '—', new: payload.fbLink || '—' }
      if ((payload.hours || '') !== (original.hours || '')) changes.hours = { old: 'previous', new: 'updated' }
      if (String(payload.lat ?? '') !== String(original.lat ?? '')) changes.lat = { old: original.lat ?? 'none', new: payload.lat ?? 'none' }
      if (String(payload.lng ?? '') !== String(original.lng ?? '')) changes.lng = { old: original.lng ?? 'none', new: payload.lng ?? 'none' }
      if ((payload.description || '') !== (original.description || '')) changes.description = { old: 'previous', new: 'updated' }
      if (JSON.stringify(payload.tags) !== JSON.stringify(Array.isArray(original.tags) ? original.tags : String(original.tags || '').split('|').filter(Boolean))) changes.tags = { old: 'previous', new: 'updated' }
      if (payload.logo !== (original.logo || '')) changes.logo = { new: payload.logo ? (payload.logo.startsWith('data:') ? 'Updated' : 'Kept') : 'Removed' }
      if (payload.image !== (original.image || '')) changes.image = { new: payload.image ? (payload.image.startsWith('data:') ? 'Updated' : 'Kept') : 'Removed' }
      if (JSON.stringify(payload.gallery) !== JSON.stringify(original.gallery || [])) changes.gallery = { old: `${(original.gallery || []).length} photo(s)`, new: `${payload.gallery.length} photo(s)` }
    } else {
      changes.name = { new: payload.name }
      changes.type = { new: payload.type }
    }
    await logHistory(editing.value ? 'update' : 'create', payload.name, changes)
    showForm.value = false
    await load()
  } catch (e) { error.value = e.message }
  saving.value = false
}

async function remove (s) {
  if (!confirm(`Delete "${s.name}" from the Schools Directory?`)) return
  try {
    const res = await fetch(`${API}/admin/schools/${s.id}`, { method: 'DELETE', headers: headers() })
    if (!res.ok) throw new Error('Delete failed.')
    await logHistory('delete', s.name, { name: { removed: s.name } })
    await load()
  } catch (e) { error.value = e.message }
}

onMounted(load)
</script>

<template>
  <div class="mgr">
    <div class="mgr-toolbar">
      <div>
        <h2 class="mgr-title">Schools Directory Manager</h2>
        <p class="mgr-sub">{{ schools.length }} schools · shown on the public Schools page (map, cards &amp; modal)</p>
      </div>
      <div class="toolbar-right">
        <input v-model="search" class="form-input search" placeholder="Search name or location…" />
        <button class="btn btn-primary mat-skeuo-filled mat-pressable-filled" @click="openCreate"><i class="fa-solid fa-plus"></i> Add School</button>
      </div>
    </div>

    <p v-if="error && !showForm" class="alert-error">{{ error }}</p>
    <p v-if="loading" class="mgr-loading">Loading…</p>

    <div v-else class="mgr-table-wrap">
      <table class="mgr-table">
        <thead>
          <tr><th>Logo</th><th>Name</th><th>Type</th><th>Status</th><th>Location</th><th>Contact</th><th>Coords</th><th>Photos</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="s in visibleSchools()" :key="s.id">
            <td data-label="Logo">
              <img v-if="s.logo" :src="s.logo" class="row-photo" />
              <div v-else class="row-photo row-photo-empty"><i class="fa-solid fa-school"></i></div>
            </td>
            <td data-label="Name" class="cell-name">{{ s.name }}</td>
            <td data-label="Type"><span class="pill mat-well">{{ typeLabel(s.type) }}</span></td>
            <td data-label="Status">
              <span class="pill mat-well" :class="s.status === 'closed' ? 'pill-closed' : 'pill-active'">
                {{ s.status === 'closed' ? 'Closed' : 'Active' }}
              </span>
            </td>
            <td data-label="Location">{{ s.location || '—' }}</td>
            <td data-label="Contact">
              <template v-if="s.contactPerson">{{ s.contactPerson }}</template>
              <template v-else-if="s.phone"><span class="dim">{{ s.phone }}</span></template>
              <template v-else-if="s.email"><span class="dim">{{ s.email }}</span></template>
              <template v-else>—</template>
            </td>
            <td data-label="Coordinates" class="dim">{{ (s.lat != null && s.lng != null) ? `${Number(s.lat).toFixed(5)}, ${Number(s.lng).toFixed(5)}` : '—' }}</td>
            <td data-label="Photos" class="dim">{{ (s.gallery?.length || 0) + (s.image ? 1 : 0) }}</td>
            <td data-label="Actions" class="cell-actions">
              <button class="btn btn-ghost mat-skeuo-sm mat-pressable-sm" @click="openEdit(s)"><i class="fa-solid fa-pen"></i></button>
              <button class="btn btn-danger mat-skeuo-sm mat-pressable-danger" @click="remove(s)"><i class="fa-solid fa-trash"></i></button>
            </td>
          </tr>
          <tr v-if="visibleSchools().length === 0"><td colspan="9" class="mgr-loading">No schools match.</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Form Modal -->
    <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
      <div class="modal-panel mat-glass-strong">
        <div class="modal-head">
          <h3>{{ editing ? 'Edit School' : 'Add School' }}</h3>
          <button class="modal-x mat-glass-strong" @click="showForm = false"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <p v-if="error" class="alert-error">{{ error }}</p>

        <!-- ══ LOGO (card badge) ══ -->
        <div class="form-row photo-row">
          <div class="photo-box" @click="$refs.logoInput.click()">
            <img v-if="form.logoVal" :src="form.logoVal" class="photo-preview" />
            <div v-else class="photo-placeholder"><i class="fa-solid fa-stamp"></i><span>Upload logo</span></div>
          </div>
          <div class="photo-side">
            <input ref="logoInput" type="file" accept="image/png,image/jpeg,image/jpg,image/webp" hidden @change="onLogoChange" />
            <button class="btn btn-ghost mat-skeuo-sm mat-pressable-sm" @click="$refs.logoInput.click()"><i class="fa-solid fa-image"></i> {{ form.logoVal ? 'Replace logo' : 'Choose logo' }}</button>
            <button v-if="form.logoVal" class="btn btn-danger mat-skeuo-sm mat-pressable-danger" @click="form.logoVal = ''"><i class="fa-solid fa-trash"></i> Remove logo</button>
            <p class="hint"><strong>Logo</strong> — the round badge on the public card. Optional; a colored type placeholder is used otherwise. Max 5MB.</p>
          </div>
        </div>

        <!-- ══ MAIN PHOTO (modal hero banner) ══ -->
        <div class="form-row photo-row">
          <div class="photo-box" @click="$refs.photoInput.click()">
            <img v-if="form.imageVal" :src="form.imageVal" class="photo-preview" />
            <div v-else class="photo-placeholder"><i class="fa-solid fa-camera"></i><span>Upload photo</span></div>
          </div>
          <div class="photo-side">
            <input ref="photoInput" type="file" accept="image/png,image/jpeg,image/jpg,image/webp" hidden @change="onImageChange" />
            <button class="btn btn-ghost mat-skeuo-sm mat-pressable-sm" @click="$refs.photoInput.click()"><i class="fa-solid fa-image"></i> {{ form.imageVal ? 'Replace photo' : 'Choose photo' }}</button>
            <button v-if="form.imageVal" class="btn btn-danger mat-skeuo-sm mat-pressable-danger" @click="form.imageVal = ''"><i class="fa-solid fa-trash"></i> Remove photo</button>
            <p class="hint"><strong>Photo</strong> — the wide banner at the top of the public modal. Optional. Max 5MB.</p>
          </div>
        </div>

        <!-- ══ GALLERY (modal gallery grid) ══ -->
        <label class="form-label">Gallery Photos <span class="dim">(shown in the modal gallery — click a photo there to use it as the banner)</span></label>
        <div class="gal-grid">
          <div v-for="(img, i) in form.galleryDraft" :key="i" class="gal-thumb">
            <img :src="img" alt="Gallery preview" />
            <button type="button" class="gal-remove" @click="removeGalleryItem(i)" title="Remove"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <label class="gal-add">
            <i class="fa-solid fa-cloud-arrow-up"></i>
            <span>Add photos</span>
            <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" multiple hidden @change="onGalleryAdd" />
          </label>
        </div>
        <p class="hint">Max 5MB per image. Removing one here and saving deletes it from the school's gallery.</p>

        <label class="form-label">School Name *</label>
        <input v-model="form.name" class="form-input" placeholder="Baco National High School" />

        <div class="form-cols">
          <div>
            <label class="form-label">Type *</label>
            <select v-model="form.type" class="form-input">
              <option v-for="t in TYPES" :key="t.key" :value="t.key">{{ t.label }}</option>
            </select>
          </div>
          <div>
            <label class="form-label">Status</label>
            <select v-model="form.status" class="form-input">
              <option value="active">Active</option>
              <option value="closed">Permanently Closed</option>
            </select>
          </div>
        </div>

        <div class="form-cols">
          <div>
            <label class="form-label">Location / Barangay</label>
            <input v-model="form.location" class="form-input" placeholder="Poblacion, Baco, Oriental Mindoro" />
          </div>
          <div>
            <label class="form-label">Street / Road</label>
            <input v-model="form.address" class="form-input" placeholder="Western Nautical Highway" />
          </div>
        </div>

        <div class="form-cols">
          <div>
            <label class="form-label">Contact Person</label>
            <input v-model="form.contactPerson" class="form-input" placeholder="School Principal" />
          </div>
          <div>
            <label class="form-label">Phone</label>
            <input v-model="form.phone" class="form-input" placeholder="0917 123 4567" />
          </div>
        </div>

        <div class="form-cols">
          <div>
            <label class="form-label">Email</label>
            <input v-model="form.email" class="form-input" placeholder="school@example.gov.ph" />
          </div>
          <div>
            <label class="form-label">Office Hours</label>
            <input v-model="form.hours" class="form-input" placeholder="Mon–Fri, 7:00 AM – 5:00 PM" />
          </div>
        </div>

        <!-- ══ Facebook Page Link ══ -->
        <div class="fg-full">
          <label class="form-label">Facebook Page Link</label>
          <input v-model="form.fbLink" class="form-input" type="url" placeholder="https://www.facebook.com/YourSchoolPage" />
          <p class="hint">Shown as a Facebook chip in the public modal. Leave blank to hide. Must start with https://</p>
        </div>

        <p class="hint">Leave any contact field blank and it is simply not shown on the public page — no placeholder dashes are rendered.</p>

        <div class="form-cols">
          <div>
            <label class="form-label">Latitude (for map)</label>
            <input v-model="form.lat" class="form-input" placeholder="13.39" />
          </div>
          <div>
            <label class="form-label">Longitude (for map)</label>
            <input v-model="form.lng" class="form-input" placeholder="121.03" />
          </div>
        </div>
        <p class="hint">Leave lat/lng blank for schools with no map listing — they get no pin. Right-click the location in Google Maps to copy coordinates; paste the full value, do not shorten it.</p>

        <label class="form-label">Description</label>
        <textarea v-model="form.description" class="form-input" rows="4" placeholder="About this school…"></textarea>

        <label class="form-label">Programs / Features (comma-separated, optional)</label>
        <input v-model="form.tagsInput" class="form-input" placeholder="GAS, STEM, ABM" />

        <div class="modal-foot">
          <button class="btn btn-ghost mat-skeuo-sm mat-pressable-sm" @click="showForm = false">Cancel</button>
          <button class="btn btn-primary mat-skeuo-filled mat-pressable-filled" :disabled="saving" @click="save">
            {{ saving ? 'Saving…' : (editing ? 'Save Changes' : 'Add School') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mgr { padding: 32px 28px; font-family: var(--font-body); color: var(--fg); }
.mgr-toolbar { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.toolbar-right { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.mgr-title { font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; }
.mgr-sub { font-size: 0.78rem; color: var(--mt); margin-top: 2px; }
.mgr-loading { color: var(--mt); padding: 24px 0; font-size: 0.85rem; }
.dim { color: var(--mt); font-size: 0.72rem; font-weight: 400; text-transform: none; letter-spacing: 0; }

.mgr-table-wrap { background: var(--card); border: 1px solid var(--bdr); border-radius: var(--r-sm); overflow-x: auto; }
.mgr-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; min-width: 900px; }
.mgr-table th { text-align: left; font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--mt2); padding: 10px 12px; border-bottom: 1px solid var(--bdr); }
.mgr-table td { padding: 9px 12px; border-bottom: 1px solid var(--bdr); vertical-align: middle; }
.mgr-table tr:last-child td { border-bottom: none; }
.mgr-table tr:hover td { background: var(--card2); }
.cell-name { font-weight: 700; }
.cell-actions { white-space: nowrap; }
.cell-actions .btn { padding: 6px 9px; margin-right: 5px; }

.row-photo { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; border: 1px solid var(--bdr); background: var(--card2); }
.row-photo-empty { display: flex; align-items: center; justify-content: center; color: var(--mt2); font-size: 0.9rem; }
.pill { padding: 3px 9px; border-radius: 20px; font-size: 0.64rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
.pill-active { background: var(--oks); color: var(--ok); }
.pill-closed { background: var(--dgs); color: var(--dg); }

.btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 14px; border-radius: var(--r-sm); border: 1px solid transparent; font-family: var(--font-body); font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.15s; }
.btn-primary:hover { background: var(--ac); color: var(--card-solid); }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-ghost:hover { border-color: var(--ac); color: var(--ac); }
.btn-danger:hover { background: var(--dg-solid); color: #fff; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 900; display: flex; align-items: center; justify-content: center; padding: 20px; }
.modal-panel { border-radius: 14px; width: 100%; max-width: 660px; max-height: 90vh; max-height: 92dvh; overflow-y: auto; padding: 20px 22px; }
.modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.modal-head h3 { font-family: var(--font-display); font-size: 1.05rem; }
.modal-x { cursor: pointer; font-size: 1.1rem; }
.modal-x:hover { color: var(--fg); }
.modal-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }

.form-label { display: block; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--mt); margin: 12px 0 5px; }
.form-input { width: 100%; padding: 10px 12px; background: var(--card2); border: 1px solid var(--bdr); border-radius: var(--r-sm); color: var(--fg); font-family: var(--font-body); font-size: 0.85rem; }
.form-input:focus { outline: none; border-color: var(--ac); }
.form-input.search { width: 220px; }
textarea.form-input { resize: vertical; }
.form-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.hint { font-size: 0.68rem; color: var(--mt2); margin-top: 5px; line-height: 1.5; }

.photo-row { display: flex; gap: 14px; align-items: flex-start; margin-top: 4px; }
.photo-box { width: 110px; height: 110px; flex-shrink: 0; border: 1px dashed var(--bdr); border-radius: var(--r-sm); overflow: hidden; cursor: pointer; background: var(--card2); display: flex; align-items: center; justify-content: center; }
.photo-box:hover { border-color: var(--ac); }
.photo-preview { width: 100%; height: 100%; object-fit: contain; background: var(--card2); }
.photo-placeholder { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--mt2); font-size: 0.68rem; }
.photo-placeholder i { font-size: 1.4rem; }
.photo-side { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }

/* ── gallery editor ── */
.gal-grid { display: flex; flex-wrap: wrap; gap: 10px; }
.gal-thumb { position: relative; width: 84px; height: 84px; border-radius: var(--r-sm); overflow: hidden; border: 1px solid var(--bdr); background: var(--card2); }
.gal-thumb img { width: 100%; height: 100%; object-fit: contain; background: var(--card2); display: block; }
.gal-remove { position: absolute; top: 2px; right: 2px; width: 20px; height: 20px; border: none; border-radius: 50%; background: rgba(0,0,0,.65); color: #fff; font-size: 0.62rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.gal-remove:hover { background: var(--dg-solid); }
.gal-add { width: 84px; height: 84px; border: 1.5px dashed var(--bdr); border-radius: var(--r-sm); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer; color: var(--mt); font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; transition: border-color .15s, background .15s; }
.gal-add:hover { border-color: var(--ac); background: var(--acs); }
.gal-add i { font-size: 1rem; }

/* ── FB link field wrapper ── */
.fg-full { display: flex; flex-direction: column; }

.alert-error { background: var(--dgs); color: var(--dg); border-radius: var(--r-sm); padding: 10px 12px; font-size: 0.78rem; margin: 10px 0; }

/* ═══════════════════════════════════════════
   RESPONSIVE — phones & small tablets
   ═══════════════════════════════════════════ */
   @media (max-width: 768px) {
    .mgr { padding: 16px 16px 28px; }
  .mgr-toolbar { flex-direction: column; align-items: stretch; gap: 10px; }
  .toolbar-right { flex-direction: column; align-items: stretch; gap: 8px; }
  .form-input.search { width: 100%; }
  .toolbar-right .btn { width: 100%; justify-content: center; }

  /* Table → stacked cards: each row becomes a bordered card, and every
     cell labels itself via its data-label attribute (pure CSS, no JS). */
  .mgr-table-wrap { overflow-x: visible; background: transparent; border: none; border-radius: 0; }
  .mgr-table { min-width: 0; }
  .mgr-table thead { display: none; }
  .mgr-table tbody, .mgr-table tr, .mgr-table td { display: block; width: 100%; }
  .mgr-table tr { background: var(--card); border: 1px solid var(--bdr); border-radius: var(--r-sm); margin-bottom: 10px; padding: 4px 0; }
  .mgr-table tr:last-child { margin-bottom: 0; }
  .mgr-table td { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 12px; border-bottom: 1px solid var(--bdr); text-align: right; }
  .mgr-table td::before { content: attr(data-label); font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--mt2); text-align: left; flex-shrink: 0; }
  .mgr-table tr:last-child td { border-bottom: 1px solid var(--bdr); }
  .mgr-table tr td:last-child { border-bottom: none; }
  .mgr-table tr:hover td { background: transparent; }
  .mgr-table td.cell-actions { flex-wrap: wrap; justify-content: flex-end; }
  .mgr-table td.mgr-loading { display: block; text-align: center; }
  .mgr-table td.mgr-loading::before { content: none; }

  /* Modal */
  .modal-overlay { padding: 10px; }
  .modal-panel { padding: 16px 14px; }
  .photo-row { flex-direction: column; align-items: center; }
  .photo-side { width: 100%; align-items: stretch; }
  .photo-side .btn { width: 100%; justify-content: center; }
  .modal-foot { flex-direction: column-reverse; gap: 8px; }
  .modal-foot .btn { width: 100%; justify-content: center; }
  .form-cols { grid-template-columns: 1fr; }
}

@media (max-width: 380px) {
  .mgr { padding: 10px 8px 24px; }
  .cell-actions .btn { margin-right: 3px; }
  .gal-thumb, .gal-add { width: 72px; height: 72px; }
}
</style>