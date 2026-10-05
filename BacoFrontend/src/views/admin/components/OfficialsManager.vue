<script setup>
import { ref, onMounted } from 'vue'
import { API } from '@/api'

const token = () => localStorage.getItem('baco_admin_token') || ''
const headers = () => ({ 'Authorization': `Bearer ${token()}` })

const officials = ref([])
const loading = ref(true)
const error = ref('')
const showForm = ref(false)
const editing = ref(null)
const saving = ref(false)

const emptyForm = { name: '', position: '', term: '', bio: '', image: '' }
const form = ref({ ...emptyForm })
const photoPreview = ref('')
const photoDirty = ref(false)

const POSITION_SUGGESTIONS = [
  'Municipal Mayor', 'Municipal Vice Mayor', 'Sangguniang Bayan Member',
  'SK Federation President', 'Liga ng mga Barangay President', 'IP Mandatory Representative'
]

/* ═══════════════════════════════════════════
   OFFICIALS CRUD
   ═══════════════════════════════════════════ */

async function load () {
  loading.value = true
  try {
    const res = await fetch(`${API}/officials`)
    officials.value = res.ok ? await res.json() : []
  } catch (e) { error.value = 'Failed to load officials.' }
  loading.value = false
}

function openCreate () {
  editing.value = null
  form.value = { ...emptyForm }
  photoPreview.value = ''
  photoDirty.value = false
  error.value = ''
  showForm.value = true
}

function openEdit (o) {
  editing.value = o
  form.value = { name: o.name, position: o.position, term: o.term || '', bio: o.bio || '', image: '' }
  photoPreview.value = o.image || ''
  photoDirty.value = false
  error.value = ''
  showForm.value = true
}

function onPhotoChange (e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) { error.value = 'Photo must be 5MB or smaller.'; e.target.value = ''; return }
  const reader = new FileReader()
  reader.onload = () => { form.value.image = reader.result; photoPreview.value = reader.result; photoDirty.value = true }
  reader.readAsDataURL(file)
  e.target.value = ''
}

function removePhoto () {
  form.value.image = ''
  photoPreview.value = ''
  photoDirty.value = true
}

async function logHistory (action, title, changes) {
  try {
    await fetch(`${API}/admin/content-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify({ section: 'officials', action, entityTitle: title, changes })
    })
  } catch (e) { /* best-effort */ }
}

async function save () {
  if (!form.value.name.trim() || !form.value.position.trim()) {
    error.value = 'Name and position are required.'; return
  }
  saving.value = true; error.value = ''
  const payload = { ...form.value }
  if (!photoDirty.value) delete payload.image   // undefined → backend keeps current photo
  try {
    const res = await fetch(
      editing.value ? `${API}/officials/${editing.value.id}` : `${API}/officials`,
      {
        method: editing.value ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify(payload)
      }
    )
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.message || 'Save failed.') }
    await logHistory(editing.value ? 'update' : 'create', form.value.name,
      { name: { new: form.value.name }, position: { new: form.value.position } })
    showForm.value = false
    await load()
  } catch (e) { error.value = e.message }
  saving.value = false
}

async function remove (o) {
  if (!confirm(`Delete "${o.name}"? This cannot be undone.`)) return
  try {
    const res = await fetch(`${API}/officials/${o.id}`, { method: 'DELETE', headers: headers() })
    if (!res.ok) throw new Error('Delete failed.')
    await logHistory('delete', o.name, { name: { removed: o.name } })
    await load()
  } catch (e) { error.value = e.message }
}

/* ═══════════════════════════════════════════
   MAYOR'S MESSAGE TAB
   Feeds home_sections (section_key = 'mayor')
   via GET/PUT /api/mayor-message
   ═══════════════════════════════════════════ */

const tab = ref('officials')

const mayorData = ref(null)
const mayorLoading = ref(false)
const mayorSaving = ref(false)
const mayorFormBuilt = ref(false)

const emptyMayorForm = {
  title: 'Message from the Mayor',
  mayorName: '',
  mayorTitle: 'Municipal Mayor',
  message: '',
  bodyText: '',
  statBarangays: '',
  statPopulation: '',
  image: ''
}
const mayorForm = ref({ ...emptyMayorForm })
const mayorPhotoPreview = ref('')
const mayorPhotoDirty = ref(false)

const fmtNum = (n) => Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-US') : '—'

async function loadMayor () {
  mayorLoading.value = true
  try {
    const res = await fetch(`${API}/mayor-message`)
    if (res.ok) mayorData.value = await res.json()
  } catch (e) { /* ignore — panel shows defaults */ }
  mayorLoading.value = false
}

function openMayorForm () {
  const d = mayorData.value
  mayorForm.value = d ? {
    title: d.title || 'Message from the Mayor',
    mayorName: d.mayorName || '',
    mayorTitle: d.mayorTitle || '',
    message: d.message || '',
    bodyText: d.bodyText || '',
    statBarangays: d.overridden?.barangays ? d.stats.barangays : '',
    statPopulation: d.overridden?.population ? d.stats.population : '',
    image: ''
  } : { ...emptyMayorForm }
  mayorPhotoPreview.value = d?.image || ''
  mayorPhotoDirty.value = false
}

function switchTab (t) {
  tab.value = t
  if (t === 'mayor' && !mayorFormBuilt.value) {
    if (mayorData.value) {
      openMayorForm()
      mayorFormBuilt.value = true
    } else {
      loadMayor().then(() => {
        if (!mayorFormBuilt.value) { openMayorForm(); mayorFormBuilt.value = true }
      })
    }
  }
}

function onMayorPhotoChange (e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) { error.value = 'Photo must be 5MB or smaller.'; e.target.value = ''; return }
  const reader = new FileReader()
  reader.onload = () => { mayorForm.value.image = reader.result; mayorPhotoPreview.value = reader.result; mayorPhotoDirty.value = true }
  reader.readAsDataURL(file)
  e.target.value = ''
}

function removeMayorPhoto () {
  mayorForm.value.image = ''
  mayorPhotoPreview.value = ''
  mayorPhotoDirty.value = true   // '' → backend clears photo & falls back to Officials photo
}

async function saveMayor () {
  mayorSaving.value = true; error.value = ''
  const f = mayorForm.value
  const payload = {
    title: f.title,
    mayorName: f.mayorName,
    mayorTitle: f.mayorTitle,
    message: f.message,
    bodyText: f.bodyText,
    statBarangays: f.statBarangays === '' ? null : Number(f.statBarangays),
    statPopulation: f.statPopulation === '' ? null : Number(f.statPopulation)
  }
  // '' → clear photo · dataURL → replace · (omitted) → keep current
  if (mayorPhotoDirty.value) payload.image = f.image
  try {
    const res = await fetch(`${API}/mayor-message`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers() },
      body: JSON.stringify(payload)
    })
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.message || 'Save failed.') }
    mayorData.value = await res.json()
    openMayorForm()
    await logHistory('update', "Mayor's Message", { title: { new: f.title } })
  } catch (e) { error.value = e.message }
  mayorSaving.value = false
}

onMounted(() => {
  load()
  loadMayor()
})
</script>

<template>
  <div class="mgr">
    <div class="mgr-toolbar">
      <div>
        <h2 class="mgr-title">Officials Manager</h2>
        <p class="mgr-sub">These entries appear on the public Officials page.</p>
      </div>
      <button v-if="tab === 'officials'" class="btn mat-skeuo-filled mat-pressable-filled" @click="openCreate"><i class="fa-solid fa-plus"></i> Add Official</button>
    </div>

    <!-- ── Tabs ── -->
    <div class="mgr-tabs">
      <button :class="['mgr-tab', { active: tab === 'officials' }]" @click="switchTab('officials')">
        <i class="fa-solid fa-users"></i> Officials
      </button>
      <button :class="['mgr-tab', { active: tab === 'mayor' }]" @click="switchTab('mayor')">
        <i class="fa-solid fa-landmark"></i> Mayor's Message
      </button>
    </div>

    <!-- ═══ OFFICIALS TAB ═══ -->
    <template v-if="tab === 'officials'">
      <p v-if="error && !showForm" class="alert-error">{{ error }}</p>
      <p v-if="loading" class="mgr-loading">Loading…</p>

      <div v-else class="mgr-grid">
        <div v-for="o in officials" :key="o.id" class="mgr-card">
          <div class="mgr-photo">
            <img v-if="o.image" :src="o.image" :alt="o.name" />
            <div v-else class="mgr-photo-empty"><i class="fa-solid fa-user"></i></div>
          </div>
          <div class="mgr-card-body">
            <h3 class="mgr-card-name">{{ o.name }}</h3>
            <span class="mgr-card-pos">{{ o.position }}</span>
            <span v-if="o.term" class="mgr-card-term"><i class="fa-solid fa-calendar-alt"></i> {{ o.term }}</span>
            <p class="mgr-card-bio">{{ o.bio || 'No biography yet.' }}</p>
          </div>
          <div class="mgr-card-actions">
            <button class="btn mat-skeuo-sm mat-pressable-sm" @click="openEdit(o)"><i class="fa-solid fa-pen"></i> Edit</button>
            <button class="btn mat-skeuo-sm mat-pressable-danger" @click="remove(o)"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <p v-if="officials.length === 0" class="mgr-loading">No officials yet — add the first one.</p>
      </div>
    </template>

    <!-- ═══ MAYOR'S MESSAGE TAB ═══ -->
    <template v-else>
      <p v-if="mayorLoading" class="mgr-loading">Loading…</p>
      <div v-else class="mgr-card mayor-panel">
        <p class="mgr-sub" style="margin-bottom:12px">
          Feeds the “Message from the Mayor” section on the homepage. Leave the photo empty to reuse the Mayor's photo from the Officials list.
        </p>
        <p v-if="error" class="alert-error">{{ error }}</p>

        <div class="form-row photo-row">
          <div class="photo-box" @click="$refs.mayorPhotoInput.click()">
            <img v-if="mayorPhotoPreview" :src="mayorPhotoPreview" class="photo-preview" />
            <div v-else class="photo-placeholder"><i class="fa-solid fa-camera"></i><span>Upload photo</span></div>
          </div>
          <div class="photo-side">
            <input ref="mayorPhotoInput" type="file" accept="image/png,image/jpeg,image/jpg,image/webp" hidden @change="onMayorPhotoChange" />
            <button class="btn mat-skeuo-sm mat-pressable-sm" @click="$refs.mayorPhotoInput.click()"><i class="fa-solid fa-image"></i> {{ mayorPhotoPreview ? 'Replace photo' : 'Choose photo' }}</button>
            <button v-if="mayorPhotoPreview" class="btn mat-skeuo-sm mat-pressable-danger" @click="removeMayorPhoto"><i class="fa-solid fa-trash"></i> Use Officials photo</button>
            <p class="hint">JPG/PNG/WebP · max 5MB · shown as a 3:4 portrait on the homepage</p>
          </div>
        </div>

        <label class="form-label">Section Title</label>
        <input v-model="mayorForm.title" class="form-input" />

        <label class="form-label">Mayor Name</label>
        <input v-model="mayorForm.mayorName" class="form-input" placeholder="Hon. Allan A. Roldan" />

        <label class="form-label">Position</label>
        <input v-model="mayorForm.mayorTitle" class="form-input" placeholder="Municipal Mayor" />

        <label class="form-label">Quote</label>
        <textarea v-model="mayorForm.message" class="form-input" rows="3" placeholder="The highlighted quote in the glass card"></textarea>

        <label class="form-label">Body Text</label>
        <textarea v-model="mayorForm.bodyText" class="form-input" rows="4" placeholder="Paragraph shown below the quote"></textarea>

        <div class="mayor-stats-row">
          <div>
            <label class="form-label">Barangays</label>
            <input v-model="mayorForm.statBarangays" class="form-input" type="number"
              :placeholder="'Leave blank — auto (' + (mayorData?.stats?.barangays ?? '—') + ')'" />
          </div>
          <div>
            <label class="form-label">Population</label>
            <input v-model="mayorForm.statPopulation" class="form-input" type="number"
              :placeholder="'Leave blank — uses Stats value (' + (mayorData ? fmtNum(mayorData.stats?.population) : '—') + ')'" />
          </div>
        </div>

        <div class="modal-foot">
          <button class="btn mat-skeuo-sm mat-pressable-sm" @click="openMayorForm">Reset</button>
          <button class="btn mat-skeuo-filled mat-pressable-filled" :disabled="mayorSaving" @click="saveMayor">
            {{ mayorSaving ? 'Saving…' : 'Save Mayor’s Message' }}
          </button>
        </div>
      </div>
    </template>

    <!-- ═══ OFFICIALS FORM MODAL ═══ -->
    <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
      <div class="modal-panel mat-glass-strong">
        <div class="modal-head">
          <h3>{{ editing ? 'Edit Official' : 'Add Official' }}</h3>
          <button class="modal-x mat-skeuo-sm mat-pressable-sm" @click="showForm = false"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <p v-if="error" class="alert-error">{{ error }}</p>

        <div class="form-row photo-row">
          <div class="photo-box" @click="$refs.photoInput.click()">
            <img v-if="photoPreview" :src="photoPreview" class="photo-preview" />
            <div v-else class="photo-placeholder"><i class="fa-solid fa-camera"></i><span>Upload photo</span></div>
          </div>
          <div class="photo-side">
            <input ref="photoInput" type="file" accept="image/png,image/jpeg,image/jpg,image/webp" hidden @change="onPhotoChange" />
            <button class="btn mat-skeuo-sm mat-pressable-sm" @click="$refs.photoInput.click()"><i class="fa-solid fa-image"></i> {{ photoPreview ? 'Replace photo' : 'Choose photo' }}</button>
            <button v-if="photoPreview" class="btn mat-skeuo-sm mat-pressable-danger" @click="removePhoto"><i class="fa-solid fa-trash"></i> Remove photo</button>
            <p class="hint">JPG/PNG/WebP · max 5MB · shown as a 3:3.8 portrait on the public page</p>
          </div>
        </div>

        <label class="form-label">Full Name *</label>
        <input v-model="form.name" class="form-input" placeholder="Hon. Juan D. Dela Cruz" />

        <label class="form-label">Position *</label>
        <input v-model="form.position" class="form-input" list="posList" placeholder="Municipal Mayor" />
        <datalist id="posList"><option v-for="p in POSITION_SUGGESTIONS" :key="p" :value="p" /></datalist>
        <p class="hint">Tip: the public page auto-detects the Mayor (position contains "Mayor", not "Vice") and Vice Mayor.</p>

        <label class="form-label">Term</label>
        <input v-model="form.term" class="form-input" placeholder="2025 – 2028" />

        <label class="form-label">Biography</label>
        <textarea v-model="form.bio" class="form-input" rows="4" placeholder="Background, achievements, committees…"></textarea>

        <div class="modal-foot">
          <button class="btn mat-skeuo-sm mat-pressable-sm" @click="showForm = false">Cancel</button>
          <button class="btn mat-skeuo-filled mat-pressable-filled" :disabled="saving" @click="save">
            {{ saving ? 'Saving…' : (editing ? 'Save Changes' : 'Add Official') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mgr { padding: 32px 28px; font-family: var(--font-body); color: var(--fg); }
.mgr-toolbar { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
.mgr-title { font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; }
.mgr-sub { font-size: 0.78rem; color: var(--mt); margin-top: 2px; }
.mgr-loading { color: var(--mt); padding: 24px 0; font-size: 0.85rem; }
/* 5 per row on wide desktops, 4 on medium — min() keeps phones safe */
.mgr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr)); gap: 12px; }
.mgr-card { background: var(--card); border: 1px solid var(--bdr); border-radius: var(--r-sm); overflow: hidden; display: flex; flex-direction: column; }
.mgr-photo { aspect-ratio: 3 / 3.8; background: var(--card2); }
.mgr-photo img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
.mgr-photo-empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 2.4rem; color: var(--mt2); }
.mgr-card-body { padding: 10px 12px 4px; flex: 1; min-width: 0; }
.mgr-card-name { font-size: 0.85rem; font-weight: 700; line-height: 1.25; }
.mgr-card-pos { display: inline-block; font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--ac); margin-top: 2px; }
.mgr-card-term { display: block; font-size: 0.66rem; color: var(--mt); margin-top: 3px; }
.mgr-card-term i { color: var(--ac); margin-right: 3px; }
.mgr-card-bio { font-size: 0.72rem; color: var(--mt); line-height: 1.45; margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.mgr-card-actions { display: flex; gap: 6px; padding: 8px 12px 12px; }
.mgr-card-actions .btn { flex: 1; justify-content: center; padding: 7px 10px; font-size: 0.74rem; }

.btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 14px; border-radius: var(--r-sm); font-family: var(--font-body); font-size: 0.8rem; font-weight: 600; cursor: pointer; }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 900; display: flex; align-items: center; justify-content: center; padding: 20px; }
.modal-panel { border-radius: 14px; width: 100%; max-width: 560px; max-height: 90vh; max-height: 92dvh; overflow-y: auto; padding: 20px 22px; }
.modal-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.modal-head h3 { font-family: var(--font-display); font-size: 1.05rem; }
.modal-x { cursor: pointer; font-size: 1.1rem; }
.modal-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }

.form-label { display: block; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--mt); margin: 12px 0 5px; }
.form-input { width: 100%; padding: 10px 12px; background: var(--card2); border: 1px solid var(--bdr); border-radius: var(--r-sm); color: var(--fg); font-family: var(--font-body); font-size: 0.85rem; }
.form-input:focus { outline: none; border-color: var(--ac); }
textarea.form-input { resize: vertical; }
.hint { font-size: 0.68rem; color: var(--mt2); margin-top: 5px; line-height: 1.5; }

.photo-row { display: flex; gap: 14px; align-items: flex-start; margin-top: 4px; }
.photo-box { width: 110px; height: 140px; flex-shrink: 0; border: 1px dashed var(--bdr); border-radius: var(--r-sm); overflow: hidden; cursor: pointer; background: var(--card2); display: flex; align-items: center; justify-content: center; }
.photo-box:hover { border-color: var(--ac); }
.photo-preview { width: 100%; height: 100%; object-fit: cover; object-position: top center; }
.photo-placeholder { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--mt2); font-size: 0.68rem; }
.photo-placeholder i { font-size: 1.4rem; }
.photo-side { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }

.alert-error { background: var(--dgs); color: var(--dg); border: 1px solid transparent; border-radius: var(--r-sm); padding: 10px 12px; font-size: 0.78rem; margin: 10px 0; }

/* ── Tabs + Mayor panel ── */
.mgr-tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.mgr-tab { padding: 8px 14px; border-radius: var(--r-sm); border: 1px solid var(--bdr); background: var(--card); color: var(--mt); font-family: var(--font-body); font-size: 0.78rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.mgr-tab.active { background: var(--ac); border-color: var(--ac); color: #fff; }
.mayor-panel { padding: 16px 18px; max-width: 720px; }
.mayor-stats-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 640px) { .mayor-stats-row { grid-template-columns: 1fr; } }

/* ═══════════════════════════════════════════
   RESPONSIVE — phones & small tablets
   ═══════════════════════════════════════════ */
@media (max-width: 768px) {
  .mgr { padding: 16px 16px 28px; }
  .mgr-toolbar { flex-direction: column; align-items: stretch; gap: 10px; }
  .mgr-toolbar > .btn { width: 100%; justify-content: center; }

  /* 2 cards per row on phones — compact scale so both fit comfortably */
  .mgr-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .mgr-photo { aspect-ratio: 3 / 3.4; }              /* slightly shorter portrait */
  .mgr-card-body { padding: 8px 9px 3px; }
  .mgr-card-name { font-size: 0.76rem; }
  .mgr-card-pos { font-size: 0.55rem; letter-spacing: 0.05em; }
  .mgr-card-term { font-size: 0.6rem; margin-top: 2px; }
  .mgr-card-bio { font-size: 0.64rem; line-height: 1.4; margin-top: 3px; -webkit-line-clamp: 2; }
  .mgr-card-actions { padding: 6px 9px 9px; gap: 5px; }
  .mgr-card-actions .btn { padding: 6px 6px; font-size: 0.66rem; gap: 4px; }

  /* Modal */
  .modal-overlay { padding: 10px; }
  .modal-panel { padding: 16px 14px; }
  .photo-row { flex-direction: column; align-items: center; }
  .photo-side { width: 100%; align-items: stretch; }
  .photo-side .btn { width: 100%; justify-content: center; }
  .modal-foot { flex-direction: column-reverse; gap: 8px; }
  .modal-foot .btn { width: 100%; justify-content: center; }
}

@media (max-width: 380px) {
  .mgr { padding: 12px 10px 24px; }
  .mgr-grid { gap: 8px; }
  .mgr-photo { aspect-ratio: 3 / 3.2; }
  .mgr-card-name { font-size: 0.7rem; }
  .mgr-card-actions .btn { padding: 5px 4px; font-size: 0.6rem; }
}
</style>