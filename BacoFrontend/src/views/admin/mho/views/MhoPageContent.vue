<script setup>
import { ref, onMounted } from 'vue'
import MhoPanel from '../components/ui/MhoPanel.vue'
import { fetchContent, saveSettings } from '../composables/useMhoApi.js'

const loading = ref(true)
const saving = ref(false)
const error = ref('')
const notice = ref('')

const form = ref({ title: '', posterTitle: '', badgesText: '' })

/* Badges are one-per-line for editing. The backend caps them at 6, so the hint
   has to state that up front rather than silently dropping the extras. */
const MAX_BADGES = 6

const toText = (arr) => (arr || []).join('\n')
const parse = (text) =>
  String(text || '').split('\n').map((s) => s.trim()).filter(Boolean)

const badgeCount = ref(0)

const flash = (m) => { notice.value = m; setTimeout(() => { notice.value = '' }, 3000) }

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const data = await fetchContent()
    form.value = {
      title: data.info?.title || '',
      posterTitle: data.info?.posterTitle || '',
      badgesText: toText(data.info?.badges)
    }
    badgeCount.value = (data.info?.badges || []).length
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

const save = async () => {
  if (!form.value.title.trim()) { error.value = 'Hero title is required.'; return }
  saving.value = true
  error.value = ''
  try {
    const badges = parse(form.value.badgesText).slice(0, MAX_BADGES)
    await saveSettings({
      title: form.value.title.trim(),
      posterTitle: form.value.posterTitle.trim(),
      badges
    })
    badgeCount.value = badges.length
    flash('Page content saved.')
    await load()
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mho-admin__page">
    <header>
      <h1 class="mho-admin__title">Page Content</h1>
      <p class="mho-admin__subtitle">The hero block at the top of the public MHO page.</p>
    </header>

    <div v-if="notice" class="mho-toast mho-toast--ok">
      <i class="fa-solid fa-circle-check"></i>{{ notice }}
    </div>
    <div v-if="error" class="mho-toast mho-toast--danger">
      <i class="fa-solid fa-circle-exclamation"></i>{{ error }}
      <button type="button" @click="error = ''">Dismiss</button>
    </div>

    <MhoPanel title="Hero" subtitle="Title and quick-fact badges" icon="fa-file-lines">
      <form v-if="!loading" class="mho-form" @submit.prevent="save">
        <div class="mho-field mho-field--wide">
          <label for="pc-title">Hero title <span class="mho-req">*</span></label>
          <input id="pc-title" v-model="form.title" type="text" maxlength="255" placeholder="Municipal Health Office" />
        </div>

        <div class="mho-field mho-field--wide">
          <label for="pc-poster">Poster title <span class="mho-hint">the large display heading; a line break is allowed</span></label>
          <textarea id="pc-poster" v-model="form.posterTitle" rows="2" maxlength="255" placeholder="Municipal Health&#10;Office Services"></textarea>
        </div>

        <div class="mho-field mho-field--wide">
          <label for="pc-badges">
            Badges
            <span class="mho-hint">one per line · max {{ MAX_BADGES }} · {{ badgeCount }} in use</span>
          </label>
          <textarea
            id="pc-badges"
            v-model="form.badgesText"
            rows="5"
            placeholder="24/7 Emergency&#10;Free Consultation&#10;Medical Certificate"
          ></textarea>
        </div>

        <div class="mho-form__actions mho-field--wide">
          <button class="mho-btn mho-btn--primary" type="submit" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save content' }}
          </button>
          <button class="mho-btn mho-btn--ghost" type="button" :disabled="saving" @click="load">
            Discard changes
          </button>
        </div>
      </form>
      <p v-else class="mho-muted">Loading…</p>
    </MhoPanel>
  </div>
</template>

<style scoped>
.mho-muted { color: var(--mho-muted); font-size: 0.85rem; margin: 0; }

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

.mho-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; }
.mho-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.mho-field--wide { grid-column: 1 / -1; }
.mho-field label {
  font-size: 0.76rem; font-weight: 650; color: var(--mho-fg-2);
  display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap;
}
.mho-req  { color: var(--mho-danger); }
.mho-hint { font-weight: 400; color: var(--mho-muted); font-size: 0.72rem; }

.mho-field input,
.mho-field textarea {
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
  resize: vertical;
}
.mho-field input:focus,
.mho-field textarea:focus { border-color: var(--mho-accent); }
.mho-field input::placeholder,
.mho-field textarea::placeholder { color: var(--mho-muted-2); }

.mho-form__actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.mho-btn {
  /* Canonical block — identical to MhoOverview, MhoServices, MhoAnnouncement
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