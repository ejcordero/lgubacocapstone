<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import MhoPanel from '../components/ui/MhoPanel.vue'
import {
  fetchContent, createService, updateService, deleteService, reorderServices
} from '../composables/useMhoApi.js'

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notice = ref('')
const services = ref([])

/* Which service is open in the editor. `null` = list-only. */
const editingId = ref(null)
const draft = ref(null)
const formEl = ref(null)

/* New-service form */
const creating = ref(false)
const blankDraft = () => ({
  name: '', description: '', bulletsText: '', detail: ''
})
const newDraft = ref(blankDraft())

const flash = (msg) => {
  notice.value = msg
  setTimeout(() => { notice.value = '' }, 3000)
}

const fail = (e) => { error.value = e.message || 'Something went wrong.' }

/* Bullets are stored as a JSON array but edited as one-per-line, which is how
   the officer thinks about them. Parse on save, join on load. */
const bulletsToText = (arr) => (arr || []).join('\n')
const textToBullets = (text) =>
  String(text || '').split('\n').map((s) => s.trim()).filter(Boolean)

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const data = await fetchContent()
    services.value = data.services || []
  } catch (e) {
    fail(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)

/* ── Edit an existing service ── */
const openEdit = (s) => {
  editingId.value = s.id
  draft.value = {
    name: s.name || '',
    description: s.desc || '',
    bulletsText: bulletsToText(s.bullets),
    detail: s.detail || ''
  }
  nextTick(() => formEl.value?.querySelector('input')?.focus())
}

const closeEdit = () => {
  editingId.value = null
  draft.value = null
}

const saveEdit = async () => {
  if (!draft.value.name.trim()) { error.value = 'Service name is required.'; return }
  saving.value = true
  error.value = ''
  try {
    await updateService(editingId.value, {
      name: draft.value.name.trim(),
      description: draft.value.description.trim(),
      bullets: textToBullets(draft.value.bulletsText),
      detail: draft.value.detail.trim()
    })
    flash('Service updated.')
    closeEdit()
    await load()
  } catch (e) {
    fail(e)
  } finally {
    saving.value = false
  }
}

/* ── Create ── */
const openCreate = () => {
  creating.value = true
  newDraft.value = blankDraft()
}

const cancelCreate = () => {
  creating.value = false
  newDraft.value = blankDraft()
}

const saveCreate = async () => {
  if (!newDraft.value.name.trim()) { error.value = 'Service name is required.'; return }
  saving.value = true
  error.value = ''
  try {
    await createService({
      name: newDraft.value.name.trim(),
      description: newDraft.value.description.trim(),
      bullets: textToBullets(newDraft.value.bulletsText),
      detail: newDraft.value.detail.trim()
    })
    flash('Service added.')
    cancelCreate()
    await load()
  } catch (e) {
    fail(e)
  } finally {
    saving.value = false
  }
}

/* ── Delete ── */
const confirmId = ref(null)

const askDelete = (s) => { confirmId.value = s.id }

const doDelete = async () => {
  const id = confirmId.value
  confirmId.value = null
  saving.value = true
  error.value = ''
  try {
    await deleteService(id)
    if (editingId.value === id) closeEdit()
    flash('Service deleted.')
    await load()
  } catch (e) {
    fail(e)
  } finally {
    saving.value = false
  }
}

/* ── Reorder ──
   Moves are local and optimistic-looking, then persisted as a single ordered
   id array. The backend rewrites sort_order for the whole list in one
   transaction, so there is no partial-order state to reconcile. */
const move = async (index, delta) => {
  const target = index + delta
  if (target < 0 || target >= services.value.length) return
  const next = [...services.value]
  const [row] = next.splice(index, 1)
  next.splice(target, 0, row)
  services.value = next
  try {
    await reorderServices(next.map((s) => s.id))
    flash('Order saved.')
  } catch (e) {
    fail(e)
    await load()   // put the server's order back
  }
}

const totalBullets = computed(() =>
  services.value.reduce((n, s) => n + (s.bullets || []).length, 0)
)
</script>

<template>
  <div class="mho-admin__page">
    <header>
      <h1 class="mho-admin__title">Health Services</h1>
      <p class="mho-admin__subtitle">
        The order here is the order residents see on the public MHO page.
      </p>
    </header>

    <div v-if="notice" class="mho-toast mho-toast--ok">
      <i class="fa-solid fa-circle-check"></i>{{ notice }}
    </div>
    <div v-if="error" class="mho-toast mho-toast--danger">
      <i class="fa-solid fa-circle-exclamation"></i>{{ error }}
      <button type="button" @click="error = ''">Dismiss</button>
    </div>

    <!-- CREATE -->
    <MhoPanel
      v-if="creating"
      title="New service"
      subtitle="Appears at the bottom of the list until you move it"
      icon="fa-plus"
    >
      <form ref="formEl" class="mho-form" @submit.prevent="saveCreate">
        <div class="mho-field">
          <label for="ns-name">Service name <span class="mho-req">*</span></label>
          <input id="ns-name" v-model="newDraft.name" type="text" maxlength="255" placeholder="e.g. Health Certificate" />
        </div>
        <div class="mho-field">
          <label for="ns-desc">Short description</label>
          <input id="ns-desc" v-model="newDraft.description" type="text" placeholder="One line shown under the name" />
        </div>
        <div class="mho-field mho-field--wide">
          <label for="ns-bullets">Details <span class="mho-hint">one per line</span></label>
          <textarea id="ns-bullets" v-model="newDraft.bulletsText" rows="5" placeholder="What the resident needs to bring&#10;Where to apply&#10;Processing time"></textarea>
        </div>
        <div class="mho-field mho-field--wide">
          <label for="ns-detail">Note <span class="mho-hint">optional, max 500 characters</span></label>
          <textarea id="ns-detail" v-model="newDraft.detail" rows="2" maxlength="500"></textarea>
        </div>
        <div class="mho-form__actions mho-field--wide">
          <button class="mho-btn mho-btn--primary" type="submit" :disabled="saving">
            {{ saving ? 'Saving…' : 'Add service' }}
          </button>
          <button class="mho-btn mho-btn--ghost" type="button" @click="cancelCreate">Cancel</button>
        </div>
      </form>
    </MhoPanel>

    <!-- LIST -->
    <MhoPanel
      :title="`Services (${services.length})`"
      :subtitle="`${totalBullets} detail lines across all services`"
      icon="fa-kit-medical"
      flush
    >
      <template #actions>
        <button v-if="!creating" class="mho-btn mho-btn--primary" type="button" @click="openCreate">
          <i class="fa-solid fa-plus"></i> Add service
        </button>
      </template>

      <p v-if="loading" class="mho-pad mho-muted">Loading…</p>
      <p v-else-if="services.length === 0" class="mho-pad mho-muted">
        No services yet. The public page is showing its built-in defaults.
      </p>

      <ul v-else class="mho-rows">
        <li v-for="(s, i) in services" :key="s.id">
          <!-- ROW -->
          <div class="mho-row">
            <div class="mho-row__order">
              <button type="button" :disabled="i === 0" title="Move up" @click="move(i, -1)">
                <i class="fa-solid fa-chevron-up"></i>
              </button>
              <span>{{ i + 1 }}</span>
              <button type="button" :disabled="i === services.length - 1" title="Move down" @click="move(i, 1)">
                <i class="fa-solid fa-chevron-down"></i>
              </button>
            </div>

            <div class="mho-row__main">
              <strong>{{ s.name }}</strong>
              <span v-if="s.desc">{{ s.desc }}</span>
              <span v-else class="mho-row__none">No description</span>
              <span class="mho-row__meta">
                {{ (s.bullets || []).length }} detail{{ (s.bullets || []).length === 1 ? '' : 's' }}
              </span>
            </div>

            <div class="mho-row__tools">
              <button type="button" title="Edit" @click="openEdit(s)">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button type="button" title="Delete" class="is-danger" @click="askDelete(s)">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>

          <!-- CONFIRM DELETE -->
          <div v-if="confirmId === s.id" class="mho-confirm">
            <span>Delete <strong>{{ s.name }}</strong>? This cannot be undone.</span>
            <div>
              <button class="mho-btn mho-btn--danger" type="button" :disabled="saving" @click="doDelete">
                Delete
              </button>
              <button class="mho-btn mho-btn--ghost" type="button" @click="confirmId = null">Keep</button>
            </div>
          </div>

          <!-- INLINE EDITOR -->
          <form v-if="editingId === s.id" class="mho-editor" @submit.prevent="saveEdit">
            <div class="mho-field">
              <label :for="`e-name-${s.id}`">Service name <span class="mho-req">*</span></label>
              <input :id="`e-name-${s.id}`" v-model="draft.name" type="text" maxlength="255" />
            </div>
            <div class="mho-field">
              <label :for="`e-desc-${s.id}`">Short description</label>
              <input :id="`e-desc-${s.id}`" v-model="draft.description" type="text" />
            </div>
            <div class="mho-field mho-field--wide">
              <label :for="`e-bul-${s.id}`">Details <span class="mho-hint">one per line</span></label>
              <textarea :id="`e-bul-${s.id}`" v-model="draft.bulletsText" rows="5"></textarea>
            </div>
            <div class="mho-field mho-field--wide">
              <label :for="`e-det-${s.id}`">Note <span class="mho-hint">optional, max 500 characters</span></label>
              <textarea :id="`e-det-${s.id}`" v-model="draft.detail" rows="2" maxlength="500"></textarea>
            </div>
            <div class="mho-form__actions mho-field--wide">
              <button class="mho-btn mho-btn--primary" type="submit" :disabled="saving">
                {{ saving ? 'Saving…' : 'Save changes' }}
              </button>
              <button class="mho-btn mho-btn--ghost" type="button" @click="closeEdit">Cancel</button>
            </div>
          </form>
        </li>
      </ul>
    </MhoPanel>
  </div>
</template>

<style scoped>
.mho-pad   { padding: 22px; }
.mho-muted { color: var(--mho-muted); font-size: 0.85rem; margin: 0; }

/* ── Toasts ── */
.mho-toast {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 13px 16px;
  border-radius: var(--mho-radius);
  font-size: 0.85rem;
  font-weight: 500;
}
.mho-toast--ok     { background: var(--mho-ok-soft);     border: 1px solid var(--mho-ok); }
.mho-toast--danger { background: var(--mho-danger-soft); border: 1px solid var(--mho-danger); }
.mho-toast button {
  margin-left: auto;
  border: none;
  background: none;
  color: inherit;
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

/* ── Form ── */
.mho-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}
.mho-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.mho-field--wide { grid-column: 1 / -1; }
.mho-field label {
  font-size: 0.76rem;
  font-weight: 650;
  color: var(--mho-fg-2);
  display: flex;
  align-items: baseline;
  gap: 7px;
}
.mho-req { color: var(--mho-danger); }
.mho-hint { font-weight: 400; color: var(--mho-muted); font-size: 0.72rem; }

.mho-field input,
.mho-field textarea {
  width: 100%;
  padding: 10px 13px;
  border-radius: var(--mho-radius-sm);
  border: 1px solid var(--mho-border-2);
  background: var(--mho-bg-raised);
  color: var(--mho-fg);
  font-family: inherit;
  font-size: 0.87rem;
  box-shadow: var(--mho-well-shadow);
  transition: border-color 0.2s var(--mho-ease);
  resize: vertical;
}
.mho-field input:focus,
.mho-field textarea:focus { border-color: var(--mho-accent); }
.mho-field input::placeholder,
.mho-field textarea::placeholder { color: var(--mho-muted-2); }

/* flex-wrap matches the Tourism form rows — without it a narrow viewport
   pushed the trailing button onto its own line, out of the row's alignment. */
.mho-form__actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

/* ── Buttons ── */
.mho-btn {
  /* Canonical block — identical to MhoOverview, MhoPageContent,
     MhoAnnouncement and both Tourism views. */
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
.mho-btn--danger {
  border: 1px solid var(--mho-danger);
  background: var(--mho-danger-soft);
  color: var(--mho-danger);
}
.mho-btn--danger:hover:not(:disabled) { background: var(--mho-danger); color: #fff; }

/* ── Rows ── */
.mho-rows { list-style: none; margin: 0; padding: 0; }
.mho-rows > li + li { border-top: 1px solid var(--mho-border); }

.mho-row { display: flex; align-items: center; gap: 16px; padding: 14px 22px; }
.mho-row:hover { background: var(--mho-surface-2); }

.mho-row__order {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  flex-shrink: 0;
}
.mho-row__order button {
  width: 20px; height: 15px;
  border: none;
  background: none;
  color: var(--mho-muted);
  font-size: 0.6rem;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.15s var(--mho-ease);
}
.mho-row__order button:hover:not(:disabled) { color: var(--mho-accent); background: var(--mho-surface-3); }
.mho-row__order button:disabled { opacity: 0.25; cursor: not-allowed; }
.mho-row__order span {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--mho-fg-2);
  font-variant-numeric: tabular-nums;
}

.mho-row__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.mho-row__main strong {
  font-size: 0.9rem;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mho-row__main > span { font-size: 0.79rem; color: var(--mho-muted); }
.mho-row__main .mho-row__none { font-style: italic; color: var(--mho-muted-2); }
.mho-row__meta { font-size: 0.72rem !important; color: var(--mho-muted-2) !important; }

.mho-row__tools { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.mho-row__tools button {
  width: 32px; height: 32px;
  border: 1px solid var(--mho-border);
  border-radius: var(--mho-radius-sm);
  background: transparent;
  color: var(--mho-muted);
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.2s var(--mho-ease);
}
.mho-row__tools button:hover { color: var(--mho-accent); border-color: var(--mho-accent); background: var(--mho-accent-soft); }
.mho-row__tools button.is-danger:hover { color: var(--mho-danger); border-color: var(--mho-danger); background: var(--mho-danger-soft); }

/* ── Inline confirm ── */
.mho-confirm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 13px 22px;
  background: var(--mho-danger-soft);
  border-top: 1px solid var(--mho-danger);
  font-size: 0.83rem;
}
.mho-confirm > div { display: flex; gap: 8px; flex-shrink: 0; }

/* ── Inline editor ── */
.mho-editor {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
  padding: 20px 22px 22px;
  background: var(--mho-bg-raised);
  border-top: 1px solid var(--mho-border);
}

@media (max-width: 620px) {
  .mho-row { flex-wrap: wrap; }
  .mho-row__tools { width: 100%; justify-content: flex-end; }
  .mho-confirm { flex-direction: column; align-items: flex-start; }
}
</style>