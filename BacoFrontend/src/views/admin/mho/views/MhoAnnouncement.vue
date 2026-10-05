<script setup>
import { ref, computed, onMounted } from 'vue'
import MhoPanel from '../components/ui/MhoPanel.vue'
import { fetchContent, saveGoogleForm } from '../composables/useMhoApi.js'

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notice = ref('')

const formUrl = ref('')
const imageData = ref('')      // base64 payload, '' means "unchanged"
const clearImage = ref(false)
const removeUrl = ref(false)

/* The URL as the server currently holds it. Needed by the change check in
   save(), because the endpoint's contract is "omitted = keep", which cannot be
   expressed by comparing against the input alone. */
const currentUrl = ref('')
const currentImage = ref(null)
const fileInput = ref(null)

const preview = computed(() => imageData.value || (clearImage.value ? null : currentImage.value))

/* The backend normalises and validates the URL, and rejects anything that is
   not http(s). Checking here too keeps the officer from spending a round trip
   on a typo, but the server stays the authority. */
const urlError = computed(() => {
  const v = formUrl.value.trim()
  if (!v) return ''
  try {
    const u = new URL(v)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'Must start with http:// or https://'
    return ''
  } catch {
    return 'That is not a valid URL'
  }
})

const flash = (m) => { notice.value = m; setTimeout(() => { notice.value = '' }, 3000) }

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const data = await fetchContent()
    currentUrl.value = data.googleForm?.url || ''
    currentImage.value = data.googleForm?.image || null
    formUrl.value = currentUrl.value
    imageData.value = ''
    clearImage.value = false
    removeUrl.value = false
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

const onPickFile = (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { error.value = 'Please choose an image file.'; return }
  const reader = new FileReader()
  reader.onload = () => {
    imageData.value = String(reader.result)
    clearImage.value = false
  }
  reader.readAsDataURL(file)
  e.target.value = ''   // allow re-picking the same file
}

const clearBoth = () => {
  formUrl.value = ''
  removeUrl.value = true
}

const save = async () => {
  if (urlError.value) { error.value = urlError.value; return }

  /* Per-field semantics are the whole point of this endpoint:
       omitted -> keep · '' -> clear · base64 -> replace
     So the payload is built by asking what CHANGED, never by sending the form
     wholesale. Sending an untouched empty image as '' would silently delete the
     officer's existing picture. */
  const payload = {}
  if (removeUrl.value) payload.formUrl = ''
  else if (formUrl.value.trim() !== (currentUrl.value || '')) payload.formUrl = formUrl.value.trim()

  if (imageData.value) payload.image = imageData.value
  else if (clearImage.value) payload.image = ''

  if (Object.keys(payload).length === 0) {
    flash('Nothing to save.')
    return
  }

  saving.value = true
  error.value = ''
  try {
    const res = await saveGoogleForm(payload)
    currentImage.value = res.googleForm?.image ?? currentImage.value
    currentUrl.value = res.googleForm?.url ?? currentUrl.value
    imageData.value = ''
    clearImage.value = false
    removeUrl.value = false
    formUrl.value = currentUrl.value || ''
    flash(res.message || 'Announcement saved.')
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

const discard = async () => {
  await load()
  flash('Changes discarded.')
}
</script>

<template>
  <div class="mho-admin__page">
    <header>
      <h1 class="mho-admin__title">Announcement</h1>
      <p class="mho-admin__subtitle">
        The Google Form residents are sent to from the MHO page.
      </p>
    </header>

    <div v-if="notice" class="mho-toast mho-toast--ok">
      <i class="fa-solid fa-circle-check"></i>{{ notice }}
    </div>
    <div v-if="error" class="mho-toast mho-toast--danger">
      <i class="fa-solid fa-circle-exclamation"></i>{{ error }}
      <button type="button" @click="error = ''">Dismiss</button>
    </div>

    <MhoPanel title="Form link" subtitle="Paste a Google Form or any public URL" icon="fa-link">
      <div class="mho-field">
        <label for="gf-url">Destination URL</label>
        <input
          id="gf-url"
          v-model="formUrl"
          type="url"
          inputmode="url"
          placeholder="https://docs.google.com/forms/…"
          :aria-invalid="Boolean(urlError)"
        />
        <span v-if="urlError" class="mho-invalid">{{ urlError }}</span>
        <span v-else-if="formUrl" class="mho-valid">
          <i class="fa-solid fa-circle-check"></i> Valid link
        </span>
      </div>
      <div class="mho-actions">
        <button class="mho-btn mho-btn--ghost" type="button" :disabled="!formUrl" @click="clearBoth">
          <i class="fa-solid fa-eraser"></i> Clear link
        </button>
        <a
          v-if="formUrl"
          class="mho-btn mho-btn--ghost"
          :href="formUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <i class="fa-solid fa-arrow-up-right-from-square"></i> Open
        </a>
      </div>
    </MhoPanel>

    <MhoPanel title="Card image" subtitle="Shown beside the link on the public page" icon="fa-image">
      <div class="mho-media">
        <div class="mho-media__preview">
          <img v-if="preview" :src="preview" alt="Announcement card preview" />
          <div v-else class="mho-media__empty">
            <i class="fa-solid fa-image"></i>
            <span>No image set</span>
          </div>
        </div>

        <div class="mho-media__controls">
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="mho-hidden-input"
            @change="onPickFile"
          />
          <button class="mho-btn mho-btn--primary" type="button" @click="fileInput?.click()">
            <i class="fa-solid fa-upload"></i> Choose image
          </button>
          <button
            v-if="currentImage || imageData"
            class="mho-btn mho-btn--ghost"
            type="button"
            @click="imageData = ''; clearImage = true"
          >
            <i class="fa-solid fa-trash"></i> Remove on save
          </button>
          <p class="mho-note">
            Replacing or removing an image only takes effect when you press Save.
            Until then the published image stays as it is.
          </p>
        </div>
      </div>
    </MhoPanel>

    <div class="mho-savebar">
      <button class="mho-btn mho-btn--primary" type="button" :disabled="saving || loading" @click="save">
        {{ saving ? 'Saving…' : 'Save announcement' }}
      </button>
      <button class="mho-btn mho-btn--ghost" type="button" :disabled="saving || loading" @click="discard">
        Discard changes
      </button>
    </div>
  </div>
</template>

<style scoped>
.mho-toast {
  display: flex; align-items: center; gap: 11px;
  padding: 13px 16px;
  border-radius: var(--mho-radius);
  font-size: 0.85rem;
  font-weight: 500;
}
.mho-toast--ok     { background: var(--mho-ok-soft);     border: 1px solid var(--mho-ok); }
.mho-toast--danger { background: var(--mho-danger-soft); border: 1px solid var(--mho-danger); }
.mho-toast button {
  margin-left: auto; border: none; background: none; color: inherit;
  font-family: inherit; font-size: 0.8rem; font-weight: 700;
  text-decoration: underline; cursor: pointer;
}

.mho-field { display: flex; flex-direction: column; gap: 7px; }
.mho-field label { font-size: 0.76rem; font-weight: 650; color: var(--mho-fg-2); }
.mho-field input {
  width: 100%;
  padding: 11px 14px;
  border-radius: var(--mho-radius-sm);
  border: 1px solid var(--mho-border-2);
  background: var(--mho-bg-raised);
  color: var(--mho-fg);
  font-family: inherit;
  font-size: 0.9rem;
  box-shadow: var(--mho-well-shadow);
  transition: border-color 0.2s var(--mho-ease);
}
.mho-field input:focus { border-color: var(--mho-accent); }
.mho-field input[aria-invalid='true'] { border-color: var(--mho-danger); }
.mho-field input::placeholder { color: var(--mho-muted-2); }

.mho-invalid { font-size: 0.75rem; color: var(--mho-danger); font-weight: 600; }
.mho-valid   { font-size: 0.75rem; color: var(--mho-ok); font-weight: 600; }

.mho-actions { display: flex; align-items: center; gap: 10px; margin-top: 14px; }

/* ── Media ── */
.mho-media { display: flex; gap: 22px; align-items: flex-start; flex-wrap: wrap; }
.mho-media__preview {
  width: 260px;
  height: 170px;
  flex-shrink: 0;
  border-radius: var(--mho-radius);
  border: 1px solid var(--mho-border);
  background: var(--mho-bg-raised);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mho-media__preview img { width: 100%; height: 100%; object-fit: cover; }
.mho-media__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  color: var(--mho-muted-2);
  font-size: 0.78rem;
}
.mho-media__empty i { font-size: 1.5rem; }

.mho-media__controls { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.mho-hidden-input { display: none; }
.mho-note {
  margin: 2px 0 0;
  font-size: 0.76rem;
  color: var(--mho-muted);
  line-height: 1.5;
  max-width: 340px;
}

/* ── Save bar ── */
.mho-savebar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  border-radius: var(--mho-radius-lg);
  background: var(--mho-surface);
  border: 1px solid var(--mho-border);
}

.mho-btn {
  /* Canonical block — identical to MhoOverview, MhoServices, MhoPageContent
     and both Tourism views. */
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 36px;
  padding: 0 16px;
  border-radius: var(--mho-radius-sm);
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 650;
  line-height: 1;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s var(--mho-ease);
  white-space: nowrap;
}
.mho-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.mho-btn--primary {
  border: 1px solid transparent;
  background: linear-gradient(180deg, var(--mho-accent) 0%, var(--mho-accent-solid) 100%);
  color: #fff;
  box-shadow: var(--mho-key-shadow);
}
.mho-btn--primary:hover:not(:disabled) { transform: translateY(-2px); }
.mho-btn--primary:active:not(:disabled) { transform: translateY(0); box-shadow: var(--mho-key-pressed); }
.mho-btn--ghost {
  border: 1px solid var(--mho-border-2);
  background: transparent;
  color: var(--mho-fg-2);
}
.mho-btn--ghost:hover:not(:disabled) { color: var(--mho-fg); border-color: var(--mho-border-3); background: var(--mho-surface-3); }
</style>