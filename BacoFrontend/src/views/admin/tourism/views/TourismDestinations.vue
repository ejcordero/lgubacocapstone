<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import TourismPanel from '../components/ui/TourismPanel.vue'
import {
  fetchDestinations, createDestination, updateDestination, deleteDestination
} from '../composables/useTourismApi.js'

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const destinations = ref([])

const editingId = ref(null)
const creating = ref(false)
const draft = ref(null)
const confirmId = ref(null)
const firstField = ref(null)

const STATUSES = ['published', 'draft', 'archived']

const flash = (m) => { notice.value = m; setTimeout(() => { notice.value = '' }, 3000) }
const fail = (e) => { error.value = e.message || 'Something went wrong.' }

const blank = () => ({
  name: '', location: '', status: 'draft', description: '', contact: '',
  lat: '', lng: '', total_arrivals: '',
  imageData: '', clearImage: false,
  activities: []   // { name, imageData, existingUrl }
})

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    destinations.value = await fetchDestinations()
  } catch (e) {
    fail(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

/* ── Read model ──
   The GET already flattens main_image and activities into absolute URLs, so
   the editor only has to decide, per image, whether it is keeping an existing
   file or sending a new base64 payload. */
const openEdit = (d) => {
  editingId.value = d.id
  draft.value = {
    name: d.name || '',
    location: d.location || '',
    status: d.status || 'draft',
    description: d.description || '',
    contact: d.contact || '',
    lat: d.lat ?? '',
    lng: d.lng ?? '',
    total_arrivals: d.total_arrivals ?? '',
    imageData: '',
    clearImage: false,
    activities: (d.activities || []).map((a) => ({
      name: a.name || '',
      imageData: '',
      existingUrl: a.image || ''
    }))
  }
  nextTick(() => firstField.value?.focus())
}

const closeEdit = () => { editingId.value = null; draft.value = null }

const openCreate = () => {
  creating.value = true
  draft.value = blank()
  nextTick(() => firstField.value?.focus())
}

const cancelCreate = () => { creating.value = false; draft.value = null }

/* ── Images ── */
const readImage = (file, apply) => {
  if (!file) return
  if (!file.type.startsWith('image/')) { error.value = 'Please choose an image file.'; return }
  const reader = new FileReader()
  reader.onload = () => apply(String(reader.result))
  reader.readAsDataURL(file)
}

const pickMain = (e) => {
  const f = e.target.files?.[0]
  readImage(f, (data) => { draft.value.imageData = data; draft.value.clearImage = false })
  e.target.value = ''
}

const pickActivity = (index, e) => {
  const f = e.target.files?.[0]
  readImage(f, (data) => { draft.value.activities[index].imageData = data })
  e.target.value = ''
}

const addActivity = () => {
  draft.value.activities.push({ name: '', imageData: '', existingUrl: '' })
}

const removeActivity = (index) => {
  draft.value.activities.splice(index, 1)
}

const activityPreview = (a) => a.imageData || a.existingUrl || null

/* Opens the file picker belonging to the button that was clicked. Done by
   walking up to the row and querying its file input, because an activity row
   holds two inputs and only the `type="file"` one is the target. */
const pickFileIn = (e) => {
  const scope = e.currentTarget.closest('div, li')
  scope?.querySelector('input[type="file"]')?.click()
}

/* ── Payload ──
   total_arrivals follows the backend's convention: blank/null hides the stat
   on the public page, so an empty string is sent as null rather than 0 —
   sending 0 would render a "0 arrivals" tile that should not exist. */
const toPayload = () => ({
  name: draft.value.name.trim(),
  location: draft.value.location.trim(),
  status: draft.value.status,
  description: draft.value.description.trim(),
  contact: draft.value.contact.trim(),
  lat: draft.value.lat === '' ? null : Number(draft.value.lat),
  lng: draft.value.lng === '' ? null : Number(draft.value.lng),
  total_arrivals: draft.value.total_arrivals === '' ? '' : Number(draft.value.total_arrivals),
  image: draft.value.imageData
    ? draft.value.imageData
    : (draft.value.clearImage ? null : undefined),
  activities: draft.value.activities
    .filter((a) => a.name.trim() || a.imageData || a.existingUrl)
    .map((a) => ({
      name: a.name.trim(),
      // Existing URL → the backend strips /uploads/ back to its stored
      // filename; a data URL → saved as a new file.
      image: a.imageData || a.existingUrl || null
    }))
})

const validate = () => {
  if (!draft.value.name.trim()) { error.value = 'Destination name is required.'; return false }
  const { lat, lng } = draft.value
  if ((lat === '' && lng !== '') || (lat !== '' && lng === '')) {
    error.value = 'Provide both latitude and longitude, or neither.'
    return false
  }
  return true
}

const saveCreate = async () => {
  if (!validate()) return
  saving.value = true
  error.value = ''
  try {
    await createDestination(toPayload())
    flash('Destination added.')
    cancelCreate()
    await load()
  } catch (e) {
    fail(e)
  } finally {
    saving.value = false
  }
}

const saveEdit = async () => {
  if (!validate()) return
  saving.value = true
  error.value = ''
  try {
    await updateDestination(editingId.value, toPayload())
    flash('Destination updated.')
    closeEdit()
    await load()
  } catch (e) {
    fail(e)
  } finally {
    saving.value = false
  }
}

const askDelete = (d) => { confirmId.value = d.id }

const doDelete = async () => {
  const id = confirmId.value
  confirmId.value = null
  saving.value = true
  error.value = ''
  try {
    await deleteDestination(id)
    if (editingId.value === id) closeEdit()
    flash('Destination deleted.')
    await load()
  } catch (e) {
    fail(e)
  } finally {
    saving.value = false
  }
}

const statusTone = (s) => {
  const v = (s || '').toLowerCase()
  if (v === 'published') return 'ok'
  if (v === 'draft') return 'warn'
  return 'neutral'
}

const publishedCount = computed(() =>
  destinations.value.filter((d) => (d.status || '').toLowerCase() === 'published').length
)
</script>

<template>
  <div class="tourism-admin__page">
    <header>
      <h1 class="tourism-admin__title">Destinations</h1>
      <p class="tourism-admin__subtitle">
        The grid on the public Tourism page. Only published entries appear there.
      </p>
    </header>

    <div v-if="notice" class="tr-toast tr-toast--ok">
      <i class="fa-solid fa-circle-check"></i>{{ notice }}
    </div>
    <div v-if="error" class="tr-toast tr-toast--danger">
      <i class="fa-solid fa-circle-exclamation"></i>{{ error }}
      <button type="button" @click="error = ''">Dismiss</button>
    </div>

    <!-- CREATE -->
    <TourismPanel
      v-if="creating"
      title="New destination"
      subtitle="Starts as a draft until you publish it"
      icon="fa-plus"
    >
      <form class="tr-form" @submit.prevent="saveCreate">
        <div class="tr-field">
          <label for="nd-name">Name <span class="tr-req">*</span></label>
          <input id="nd-name" ref="firstField" v-model="draft.name" type="text" placeholder="e.g. Maguindao Falls" />
        </div>
        <div class="tr-field">
          <label for="nd-loc">Location</label>
          <input id="nd-loc" v-model="draft.location" type="text" placeholder="Barangay, Baco" />
        </div>
        <div class="tr-field">
          <label for="nd-status">Status</label>
          <select id="nd-status" v-model="draft.status">
            <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="tr-field">
          <label for="nd-arr">Total arrivals <span class="tr-hint">blank hides the stat</span></label>
          <input id="nd-arr" v-model="draft.total_arrivals" type="number" min="0" inputmode="numeric" />
        </div>
        <div class="tr-field">
          <label for="nd-lat">Latitude</label>
          <input id="nd-lat" v-model="draft.lat" type="number" step="any" inputmode="decimal" />
        </div>
        <div class="tr-field">
          <label for="nd-lng">Longitude</label>
          <input id="nd-lng" v-model="draft.lng" type="number" step="any" inputmode="decimal" />
        </div>
        <div class="tr-field">
          <label for="nd-contact">Contact</label>
          <input id="nd-contact" v-model="draft.contact" type="text" placeholder="Phone or email" />
        </div>
        <div class="tr-field tr-field--wide">
          <label for="nd-desc">Description</label>
          <textarea id="nd-desc" v-model="draft.description" rows="4"></textarea>
        </div>

        <div class="tr-field tr-field--wide">
          <label>Main image</label>
          <div class="tr-media">
            <div class="tr-media__preview">
              <img v-if="draft.imageData" :src="draft.imageData" alt="" />
              <div v-else class="tr-media__empty"><i class="fa-solid fa-image"></i><span>No image</span></div>
            </div>
            <div class="tr-media__ctrl">
              <input type="file" accept="image/*" class="tr-hidden" @change="pickMain" />
              <button class="tr-btn tr-btn--ghost" type="button" @click="pickFileIn($event)">
                <i class="fa-solid fa-upload"></i> Choose image
              </button>
              <button
                v-if="draft.imageData"
                class="tr-btn tr-btn--ghost"
                type="button"
                @click="draft.imageData = ''; draft.clearImage = true"
              >
                <i class="fa-solid fa-trash"></i> Remove on save
              </button>
            </div>
          </div>
        </div>

        <div class="tr-field tr-field--wide">
          <label>Activities <span class="tr-hint">name and photo per entry</span></label>
          <ul class="tr-acts">
            <li v-for="(a, i) in draft.activities" :key="i">
              <div class="tr-acts__thumb">
                <img v-if="activityPreview(a)" :src="activityPreview(a)" alt="" />
                <span v-else><i class="fa-solid fa-image"></i></span>
              </div>
              <input v-model="a.name" type="text" placeholder="Activity name" :aria-label="`Activity ${i + 1} name`" />
              <input type="file" accept="image/*" class="tr-hidden" @change="pickActivity(i, $event)" />
              <button class="tr-btn tr-btn--ghost" type="button" @click="pickFileIn($event)">
                Photo
              </button>
              <button class="tr-btn tr-btn--ghost is-danger" type="button" @click="removeActivity(i)" title="Remove">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </li>
          </ul>
          <button class="tr-btn tr-btn--ghost tr-acts__add" type="button" @click="addActivity">
            <i class="fa-solid fa-plus"></i> Add activity
          </button>
        </div>

        <div class="tr-form__actions tr-field--wide">
          <button class="tr-btn tr-btn--primary" type="submit" :disabled="saving">
            {{ saving ? 'Saving…' : 'Add destination' }}
          </button>
          <button class="tr-btn tr-btn--ghost" type="button" @click="cancelCreate">Cancel</button>
        </div>
      </form>
    </TourismPanel>

    <!-- LIST -->
    <TourismPanel
      :title="`All destinations (${destinations.length})`"
      :subtitle="`${publishedCount} published`"
      icon="fa-umbrella-beach"
      flush
    >
      <template #actions>
        <button v-if="!creating" class="tr-btn tr-btn--primary" type="button" @click="openCreate">
          <i class="fa-solid fa-plus"></i> Add destination
        </button>
      </template>

      <p v-if="loading" class="tr-pad tr-muted">Loading…</p>
      <p v-else-if="destinations.length === 0" class="tr-pad tr-muted">
        No destinations yet. The public page has an empty grid.
      </p>

      <ul v-else class="tr-rows">
        <li v-for="d in destinations" :key="d.id">
          <div class="tr-row">
            <div class="tr-row__thumb">
              <img v-if="d.image" :src="d.image" :alt="d.name" />
              <span v-else><i class="fa-solid fa-image"></i></span>
            </div>

            <div class="tr-row__main">
              <strong>{{ d.name }}</strong>
              <span v-if="d.location"><i class="fa-solid fa-location-dot"></i> {{ d.location }}</span>
              <span class="tr-row__meta">
                {{ (d.activities || []).length }} activit{{ (d.activities || []).length === 1 ? 'y' : 'ies' }}
                <template v-if="Number(d.total_arrivals) > 0">
                  · {{ Number(d.total_arrivals).toLocaleString() }} arrivals
                </template>
              </span>
            </div>

            <span class="tr-chip" :data-tone="statusTone(d.status)">{{ d.status || 'draft' }}</span>

            <div class="tr-row__tools">
              <button type="button" title="Edit" @click="openEdit(d)"><i class="fa-solid fa-pen"></i></button>
              <button type="button" title="Delete" class="is-danger" @click="askDelete(d)"><i class="fa-solid fa-trash"></i></button>
            </div>
          </div>

          <div v-if="confirmId === d.id" class="tr-confirm">
            <span>Delete <strong>{{ d.name }}</strong> and its activity photos? This cannot be undone.</span>
            <div>
              <button class="tr-btn tr-btn--danger" type="button" :disabled="saving" @click="doDelete">Delete</button>
              <button class="tr-btn tr-btn--ghost" type="button" @click="confirmId = null">Keep</button>
            </div>
          </div>

          <!-- INLINE EDITOR: reuses the same field set as create -->
          <form v-if="editingId === d.id" class="tr-editor" @submit.prevent="saveEdit">
            <div class="tr-field">
              <label :for="`ed-name-${d.id}`">Name <span class="tr-req">*</span></label>
              <input :id="`ed-name-${d.id}`" ref="firstField" v-model="draft.name" type="text" />
            </div>
            <div class="tr-field">
              <label :for="`ed-loc-${d.id}`">Location</label>
              <input :id="`ed-loc-${d.id}`" v-model="draft.location" type="text" />
            </div>
            <div class="tr-field">
              <label :for="`ed-status-${d.id}`">Status</label>
              <select :id="`ed-status-${d.id}`" v-model="draft.status">
                <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
            <div class="tr-field">
              <label :for="`ed-arr-${d.id}`">Total arrivals <span class="tr-hint">blank hides the stat</span></label>
              <input :id="`ed-arr-${d.id}`" v-model="draft.total_arrivals" type="number" min="0" inputmode="numeric" />
            </div>
            <div class="tr-field">
              <label :for="`ed-lat-${d.id}`">Latitude</label>
              <input :id="`ed-lat-${d.id}`" v-model="draft.lat" type="number" step="any" inputmode="decimal" />
            </div>
            <div class="tr-field">
              <label :for="`ed-lng-${d.id}`">Longitude</label>
              <input :id="`ed-lng-${d.id}`" v-model="draft.lng" type="number" step="any" inputmode="decimal" />
            </div>
            <div class="tr-field">
              <label :for="`ed-contact-${d.id}`">Contact</label>
              <input :id="`ed-contact-${d.id}`" v-model="draft.contact" type="text" />
            </div>
            <div class="tr-field tr-field--wide">
              <label :for="`ed-desc-${d.id}`">Description</label>
              <textarea :id="`ed-desc-${d.id}`" v-model="draft.description" rows="4"></textarea>
            </div>

            <div class="tr-field tr-field--wide">
              <label>Main image</label>
              <div class="tr-media">
                <div class="tr-media__preview">
                  <img v-if="draft.imageData || (!draft.clearImage && d.image)" :src="draft.imageData || d.image" alt="" />
                  <div v-else class="tr-media__empty"><i class="fa-solid fa-image"></i><span>No image</span></div>
                </div>
                <div class="tr-media__ctrl">
                  <input type="file" accept="image/*" class="tr-hidden" @change="pickMain" />
                  <button class="tr-btn tr-btn--ghost" type="button" @click="pickFileIn($event)">
                    <i class="fa-solid fa-upload"></i> Replace image
                  </button>
                  <button
                    v-if="d.image && !draft.clearImage"
                    class="tr-btn tr-btn--ghost"
                    type="button"
                    @click="draft.imageData = ''; draft.clearImage = true"
                  >
                    <i class="fa-solid fa-trash"></i> Remove on save
                  </button>
                </div>
              </div>
            </div>

            <div class="tr-field tr-field--wide">
              <label>Activities <span class="tr-hint">{{ draft.activities.length }}</span></label>
              <ul class="tr-acts">
                <li v-for="(a, i) in draft.activities" :key="i">
                  <div class="tr-acts__thumb">
                    <img v-if="activityPreview(a)" :src="activityPreview(a)" alt="" />
                    <span v-else><i class="fa-solid fa-image"></i></span>
                  </div>
                  <input v-model="a.name" type="text" placeholder="Activity name" :aria-label="`Activity ${i + 1} name`" />
                  <input type="file" accept="image/*" class="tr-hidden" @change="pickActivity(i, $event)" />
                  <button class="tr-btn tr-btn--ghost" type="button" @click="pickFileIn($event)">Photo</button>
                  <button class="tr-btn tr-btn--ghost is-danger" type="button" @click="removeActivity(i)" title="Remove">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </li>
              </ul>
              <button class="tr-btn tr-btn--ghost tr-acts__add" type="button" @click="addActivity">
                <i class="fa-solid fa-plus"></i> Add activity
              </button>
            </div>

            <div class="tr-form__actions tr-field--wide">
              <button class="tr-btn tr-btn--primary" type="submit" :disabled="saving">
                {{ saving ? 'Saving…' : 'Save changes' }}
              </button>
              <button class="tr-btn tr-btn--ghost" type="button" @click="closeEdit">Cancel</button>
            </div>
          </form>
        </li>
      </ul>
    </TourismPanel>
  </div>
</template>

<style scoped>
.tr-pad   { padding: 22px; }
.tr-muted { color: var(--tr-muted); font-size: 0.85rem; margin: 0; }

.tr-toast {
  display: flex; align-items: center; gap: 11px;
  padding: 13px 16px;
  border-radius: var(--tr-radius);
  font-size: 0.85rem;
  font-weight: 500;
}
.tr-toast--ok     { background: var(--tr-ok-soft);     border: 1px solid var(--tr-ok); }
.tr-toast--danger { background: var(--tr-danger-soft); border: 1px solid var(--tr-danger); }
.tr-toast button {
  margin-left: auto; border: none; background: none; color: inherit;
  font-family: inherit; font-size: 0.8rem; font-weight: 700;
  text-decoration: underline; cursor: pointer;
}

/* ── Form ── */
.tr-form, .tr-editor {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}
.tr-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.tr-field--wide { grid-column: 1 / -1; }
.tr-field label {
  font-size: 0.76rem; font-weight: 650; color: var(--tr-fg-2);
  display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap;
}
.tr-req  { color: var(--tr-danger); }
.tr-hint { font-weight: 400; color: var(--tr-muted); font-size: 0.72rem; }

.tr-field input,
.tr-field textarea,
.tr-field select {
  width: 100%;
  padding: 10px 13px;
  border-radius: var(--tr-radius-sm);
  border: 1px solid var(--tr-border-2);
  background: var(--tr-bg-raised);
  color: var(--tr-fg);
  font-family: inherit;
  font-size: 0.87rem;
  box-shadow: var(--tr-well-shadow);
  transition: border-color 0.2s var(--tr-ease);
  resize: vertical;
}
.tr-field select { cursor: pointer; }
.tr-field input:focus,
.tr-field textarea:focus,
.tr-field select:focus { border-color: var(--tr-accent); }
.tr-field input::placeholder,
.tr-field textarea::placeholder { color: var(--tr-muted-2); }

/* flex-wrap matches TourismArrivals — without it a narrow viewport pushed the
   trailing button onto its own line and out of the row's alignment. */
.tr-form__actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

/* ── Media ── */
.tr-media { display: flex; gap: 18px; align-items: flex-start; flex-wrap: wrap; }
.tr-media__preview {
  width: 210px; height: 140px;
  flex-shrink: 0;
  border-radius: var(--tr-radius);
  border: 1px solid var(--tr-border);
  background: var(--tr-bg-raised);
  overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.tr-media__preview img { width: 100%; height: 100%; object-fit: cover; }
.tr-media__empty {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  color: var(--tr-muted-2); font-size: 0.76rem;
}
.tr-media__empty i { font-size: 1.4rem; }
.tr-media__ctrl { display: flex; flex-direction: column; gap: 9px; align-items: flex-start; }
.tr-hidden { display: none; }

/* ── Activities ── */
.tr-acts { list-style: none; margin: 0 0 10px; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.tr-acts li {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) auto auto;
  gap: 9px;
  align-items: center;
  padding: 9px;
  border-radius: var(--tr-radius-sm);
  background: var(--tr-bg-raised);
  border: 1px solid var(--tr-border);
}
.tr-acts__thumb {
  width: 46px; height: 38px;
  border-radius: 5px;
  overflow: hidden;
  background: var(--tr-surface-3);
  display: flex; align-items: center; justify-content: center;
  color: var(--tr-muted-2);
  font-size: 0.85rem;
}
.tr-acts__thumb img { width: 100%; height: 100%; object-fit: cover; }
.tr-acts__add { align-self: flex-start; }

/* ── Buttons ── */
/* Canonical block, duplicated verbatim in TourismArrivals.vue. These two
   files previously disagreed on padding (8px/9px) and font-size
   (0.8/0.81rem), so a button in one view sat a couple of pixels off a button
   in the other, and neither matched the 36px .tr-top__ghost beside it. */
.tr-btn {
  /* Nothing in this project resets box-sizing, so a bare `height` would apply
     to the content box and the rendered height would still drift with padding.
     Declaring it here makes `height` mean what it looks like it means. */
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  /* 36px = .tr-top__ghost, so buttons align with the topbar controls. */
  height: 36px;
  padding: 0 16px;
  border-radius: var(--tr-radius-sm);
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 650;
  /* 1, not inherited: :root sets 1.5, which made the content box height a
     function of font-size and knocked icons off the label's baseline. */
  line-height: 1;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s var(--tr-ease);
  white-space: nowrap;
}
.tr-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.tr-btn--primary {
  border: 1px solid transparent;
  background: linear-gradient(180deg, var(--tr-accent) 0%, var(--tr-accent-solid) 100%);
  /* Was #1a1409 — dark brown left over from the deleted amber accent, which
     is now near-illegible on the navy accent. */
  color: #fff;
  box-shadow: var(--tr-key-shadow);
}
.tr-btn--primary:hover:not(:disabled) { transform: translateY(-2px); }
.tr-btn--primary:active:not(:disabled) { transform: translateY(0); box-shadow: var(--tr-key-pressed); }
.tr-btn--ghost {
  border: 1px solid var(--tr-border-2);
  background: transparent;
  color: var(--tr-fg-2);
}
.tr-btn--ghost:hover:not(:disabled) { color: var(--tr-fg); border-color: var(--tr-border-3); background: var(--tr-surface-3); }
.tr-btn--ghost.is-danger:hover:not(:disabled) { color: var(--tr-danger); border-color: var(--tr-danger); background: var(--tr-danger-soft); }
.tr-btn--danger {
  border: 1px solid var(--tr-danger);
  background: var(--tr-danger-soft);
  color: var(--tr-danger);
}
.tr-btn--danger:hover:not(:disabled) { background: var(--tr-danger); color: #fff; }

/* ── Rows ── */
.tr-rows { list-style: none; margin: 0; padding: 0; }
.tr-rows > li + li { border-top: 1px solid var(--tr-border); }
.tr-row { display: flex; align-items: center; gap: 16px; padding: 14px 22px; }
.tr-row:hover { background: var(--tr-surface-2); }
.tr-row__thumb {
  width: 56px; height: 46px;
  flex-shrink: 0;
  border-radius: var(--tr-radius-sm);
  overflow: hidden;
  background: var(--tr-surface-3);
  display: flex; align-items: center; justify-content: center;
  color: var(--tr-muted-2);
}
.tr-row__thumb img { width: 100%; height: 100%; object-fit: cover; }
.tr-row__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.tr-row__main strong {
  font-size: 0.9rem; font-weight: 650;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tr-row__main > span { font-size: 0.79rem; color: var(--tr-muted); }
.tr-row__main > span i { font-size: 0.7rem; }
.tr-row__meta { font-size: 0.72rem !important; color: var(--tr-muted-2) !important; }

.tr-chip {
  flex-shrink: 0;
  padding: 4px 11px;
  border-radius: 20px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  background: var(--tr-surface-3);
  color: var(--tr-muted);
  border: 1px solid var(--tr-border-2);
}
.tr-chip[data-tone='ok']   { background: var(--tr-ok-soft);     color: var(--tr-ok);     border-color: var(--tr-ok); }
.tr-chip[data-tone='warn'] { background: var(--tr-warn-soft);   color: var(--tr-warn);   border-color: var(--tr-warn); }

.tr-row__tools { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.tr-row__tools button {
  width: 32px; height: 32px;
  border: 1px solid var(--tr-border);
  border-radius: var(--tr-radius-sm);
  background: transparent;
  color: var(--tr-muted);
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.2s var(--tr-ease);
}
.tr-row__tools button:hover { color: var(--tr-accent); border-color: var(--tr-accent); background: var(--tr-accent-soft); }
.tr-row__tools button.is-danger:hover { color: var(--tr-danger); border-color: var(--tr-danger); background: var(--tr-danger-soft); }

/* ── Confirm ── */
.tr-confirm {
  display: flex; align-items: center; justify-content: space-between;
  gap: 14px;
  padding: 13px 22px;
  background: var(--tr-danger-soft);
  border-top: 1px solid var(--tr-danger);
  font-size: 0.83rem;
}
.tr-confirm > div { display: flex; gap: 8px; flex-shrink: 0; }

/* ── Inline editor ── */
.tr-editor {
  padding: 20px 22px 22px;
  background: var(--tr-bg-raised);
  border-top: 1px solid var(--tr-border);
}

@media (max-width: 700px) {
  .tr-row { flex-wrap: wrap; }
  .tr-row__tools { width: 100%; justify-content: flex-end; }
  .tr-confirm { flex-direction: column; align-items: flex-start; }
  .tr-acts li { grid-template-columns: 40px minmax(0, 1fr) auto; }
  .tr-acts li .tr-btn:last-child { grid-column: 3; }
}
</style>