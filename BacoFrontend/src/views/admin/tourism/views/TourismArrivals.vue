<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import TourismPanel from '../components/ui/TourismPanel.vue'
import { fetchArrivals, saveArrivals, saveArrivalBackgrounds } from '../composables/useTourismApi.js'

const loading = ref(true)
const saving = ref(false)
const bgSaving = ref(false)
const error = ref('')
const notice = ref('')

/* ── Period selection ──
   Defaults to the current quarter, which is what an officer almost always
   wants to edit. The backend validates the range regardless. */
const now = new Date()
const form = ref({
  quarterYear: now.getFullYear(),
  quarterNum: Math.floor(now.getMonth() / 3) + 1,
  totalArrivals: '',
  domesticPct: '',
  peakLabel: '',
  attractions: []
})

const backgrounds = ref({ heroBg: null, top5Bg: null })
const bgDraft = ref({ heroData: '', top5Data: '' })
const bgReset = ref({ hero: false, top5: false })

const YEARS = Array.from({ length: 8 }, (_, i) => now.getFullYear() - i)
const QUARTERS = [1, 2, 3, 4]

const flash = (m) => { notice.value = m; setTimeout(() => { notice.value = '' }, 3200) }

const periodLabel = computed(() => `Q${form.value.quarterNum} ${form.value.quarterYear}`)

const published = ref(false)

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const data = await fetchArrivals({
      year: form.value.quarterYear,
      quarter: form.value.quarterNum
    })
    published.value = Boolean(data.summary)
    form.value.totalArrivals = data.summary ? data.summary.totalArrivals : ''
    form.value.domesticPct  = data.summary ? data.summary.domesticPct : ''
    form.value.peakLabel    = data.summary ? (data.summary.peakLabel || '') : ''
    form.value.attractions  = (data.attractions || []).map((a) => ({
      name: a.name,
      visitors: a.visitors
    }))
    backgrounds.value = data.backgrounds || { heroBg: null, top5Bg: null }
    bgDraft.value = { heroData: '', top5Data: '' }
    bgReset.value = { hero: false, top5: false }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

/* Reload whenever the officer switches period — the form always reflects the
   quarter on screen, never a stale carry-over from the previous one. */
watch(() => [form.value.quarterYear, form.value.quarterNum], load)
onMounted(load)

const addAttraction = () => {
  form.value.attractions.push({ name: '', visitors: 0 })
}
const removeAttraction = (i) => {
  form.value.attractions.splice(i, 1)
}

/* An empty save is a documented FEATURE on this endpoint: the backend treats
   "no total and no attractions" as unpublish and deletes the quarter, so the
   public page hides the section instead of rendering a zero. Surfaced as an
   explicit choice rather than an accident. */
const isEmptySave = computed(() => {
  const named = form.value.attractions.filter((a) => a.name.trim()).length
  return named === 0 && !(Number(form.value.totalArrivals) > 0)
})

const save = async () => {
  saving.value = true
  error.value = ''
  try {
    const res = await saveArrivals({
      quarterYear: Number(form.value.quarterYear),
      quarterNum: Number(form.value.quarterNum),
      totalArrivals: Number(form.value.totalArrivals) || 0,
      domesticPct: Number(form.value.domesticPct) || 0,
      peakLabel: form.value.peakLabel.trim(),
      attractions: form.value.attractions
        .filter((a) => a.name.trim())
        .map((a) => ({ name: a.name.trim(), visitors: Number(a.visitors) || 0 }))
    })
    published.value = res.hasData
    flash(res.message || 'Arrivals saved.')
    await load()
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

/* ── Backgrounds ──
   Same per-field contract as the rest: omitted keeps, '' resets, base64
   replaces. So only the fields the officer actually touched are sent. */
const readImage = (file, apply) => {
  if (!file) return
  if (!file.type.startsWith('image/')) { error.value = 'Please choose an image file.'; return }
  const reader = new FileReader()
  reader.onload = () => apply(String(reader.result))
  reader.readAsDataURL(file)
}

const pickHero = (e) => {
  const f = e.target.files?.[0]
  readImage(f, (d) => { bgDraft.value.heroData = d; bgReset.value.hero = false })
  e.target.value = ''
}
const pickTop5 = (e) => {
  const f = e.target.files?.[0]
  readImage(f, (d) => { bgDraft.value.top5Data = d; bgReset.value.top5 = false })
  e.target.value = ''
}

const heroPreview = computed(() =>
  bgDraft.value.heroData || (bgReset.value.hero ? null : backgrounds.value.heroBg)
)
const top5Preview = computed(() =>
  bgDraft.value.top5Data || (bgReset.value.top5 ? null : backgrounds.value.top5Bg)
)

const saveBackgrounds = async () => {
  const payload = {}
  if (bgDraft.value.heroData) payload.heroBg = bgDraft.value.heroData
  else if (bgReset.value.hero) payload.heroBg = ''
  if (bgDraft.value.top5Data) payload.top5Bg = bgDraft.value.top5Data
  else if (bgReset.value.top5) payload.top5Bg = ''

  if (Object.keys(payload).length === 0) { flash('No background changes to save.'); return }

  bgSaving.value = true
  error.value = ''
  try {
    const res = await saveArrivalBackgrounds(payload)
    backgrounds.value = res.backgrounds || backgrounds.value
    bgDraft.value = { heroData: '', top5Data: '' }
    bgReset.value = { hero: false, top5: false }
    flash(res.message || 'Backgrounds updated.')
  } catch (e) {
    error.value = e.message
  } finally {
    bgSaving.value = false
  }
}

const domestic = computed(() => Math.min(100, Math.max(0, Number(form.value.domesticPct) || 0)))
const foreign = computed(() => 100 - domestic.value)
</script>

<template>
  <div class="tourism-admin__page">
    <header>
      <h1 class="tourism-admin__title">Tourist Arrivals</h1>
      <p class="tourism-admin__subtitle">
        Quarterly figures and section backgrounds for the public Tourism page.
      </p>
    </header>

    <div v-if="notice" class="tr-toast tr-toast--ok">
      <i class="fa-solid fa-circle-check"></i>{{ notice }}
    </div>
    <div v-if="error" class="tr-toast tr-toast--danger">
      <i class="fa-solid fa-circle-exclamation"></i>{{ error }}
      <button type="button" @click="error = ''">Dismiss</button>
    </div>

    <!-- PERIOD -->
    <TourismPanel title="Period" :subtitle="periodLabel" icon="fa-calendar">
      <template #actions>
        <span class="tr-state" :data-on="published">
          {{ published ? 'Published' : 'Not published' }}
        </span>
      </template>

      <div class="tr-period">
        <div class="tr-field">
          <label for="ar-year">Year</label>
          <select id="ar-year" v-model.number="form.quarterYear">
            <option v-for="y in YEARS" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>
        <div class="tr-field">
          <label for="ar-q">Quarter</label>
          <select id="ar-q" v-model.number="form.quarterNum">
            <option v-for="q in QUARTERS" :key="q" :value="q">Q{{ q }}</option>
          </select>
        </div>
      </div>
    </TourismPanel>

    <!-- FIGURES -->
    <TourismPanel
      :title="`${periodLabel} figures`"
      :subtitle="published ? 'Currently live on the public page' : 'Not yet published'"
      icon="fa-chart-simple"
    >
      <form class="tr-form" @submit.prevent="save">
        <div class="tr-field">
          <label for="ar-total">Total arrivals</label>
          <input id="ar-total" v-model="form.totalArrivals" type="number" min="0" inputmode="numeric" />
        </div>
        <div class="tr-field">
          <label for="ar-dom">Domestic share <span class="tr-hint">percent</span></label>
          <input id="ar-dom" v-model="form.domesticPct" type="number" min="0" max="100" inputmode="numeric" />
        </div>
        <div class="tr-field">
          <label for="ar-peak">Peak label <span class="tr-hint">max 30 characters</span></label>
          <input id="ar-peak" v-model="form.peakLabel" type="text" maxlength="30" placeholder="e.g. Sempeak sa Kasalipan" />
        </div>

        <!-- Domestic / foreign split, shown so the percentage is legible
             rather than being an abstract number in a field. -->
        <div class="tr-field tr-field--wide">
          <label>Split</label>
          <div class="tr-split-bar">
            <span class="tr-split-bar__dom" :style="{ width: domestic + '%' }">
              {{ domestic }}% domestic
            </span>
            <span class="tr-split-bar__for" :style="{ width: foreign + '%' }">
              {{ foreign }}% foreign
            </span>
          </div>
        </div>

        <!-- ATTRACTIONS -->
        <div class="tr-field tr-field--wide">
          <label>Top attractions <span class="tr-hint">shown on the public page</span></label>
          <ul class="tr-acts">
            <li v-for="(a, i) in form.attractions" :key="i">
              <input
                v-model="a.name"
                type="text"
                placeholder="Attraction name"
                :aria-label="`Attraction ${i + 1} name`"
              />
              <input
                v-model="a.visitors"
                type="number"
                min="0"
                inputmode="numeric"
                placeholder="Visitors"
                :aria-label="`Attraction ${i + 1} visitors`"
              />
              <button class="tr-btn tr-btn--ghost is-danger" type="button" title="Remove" @click="removeAttraction(i)">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </li>
          </ul>
          <button class="tr-btn tr-btn--ghost tr-acts__add" type="button" @click="addAttraction">
            <i class="fa-solid fa-plus"></i> Add attraction
          </button>
        </div>

        <div class="tr-form__actions tr-field--wide">
          <button class="tr-btn tr-btn--primary" type="submit" :disabled="saving || loading">
            <i class="fa-solid fa-floppy-disk"></i>
            {{ saving ? 'Saving…' : (isEmptySave && published ? 'Clear this quarter' : 'Publish figures') }}
          </button>
          <button class="tr-btn tr-btn--ghost" type="button" :disabled="saving" @click="load">Discard</button>
        </div>

        <!-- Only warn about the destructive meaning of an empty save when it
             would actually remove something already live. -->
        <p v-if="isEmptySave && published" class="tr-warn tr-field--wide">
          <i class="fa-solid fa-triangle-exclamation"></i>
          This quarter has no total and no attractions. Saving will
          <strong>unpublish</strong> it and remove the section from the public page.
        </p>
      </form>
    </TourismPanel>

    <!-- BACKGROUNDS -->
    <TourismPanel
      title="Section backgrounds"
      subtitle="Photos behind the arrivals hero and the top-attractions list"
      icon="fa-image"
    >
      <div class="tr-bgs">
        <div class="tr-bg">
          <label>Arrivals hero</label>
          <div class="tr-bg__preview">
            <img v-if="heroPreview" :src="heroPreview" alt="Hero background preview" />
            <div v-else class="tr-bg__empty"><i class="fa-solid fa-image"></i><span>Using page default</span></div>
          </div>
          <div class="tr-bg__ctrl">
            <input type="file" accept="image/*" class="tr-hidden" @change="pickHero" />
            <button class="tr-btn tr-btn--ghost" type="button" @click="$event.currentTarget.previousElementSibling.click()">
              <i class="fa-solid fa-upload"></i> Replace
            </button>
            <button
              v-if="backgrounds.heroBg && !bgReset.hero"
              class="tr-btn tr-btn--ghost"
              type="button"
              @click="bgDraft.heroData = ''; bgReset.hero = true"
            >
              <i class="fa-solid fa-rotate-left"></i> Reset
            </button>
          </div>
        </div>

        <div class="tr-bg">
          <label>Top 5 list</label>
          <div class="tr-bg__preview">
            <img v-if="top5Preview" :src="top5Preview" alt="Top 5 background preview" />
            <div v-else class="tr-bg__empty"><i class="fa-solid fa-image"></i><span>Using page default</span></div>
          </div>
          <div class="tr-bg__ctrl">
            <input type="file" accept="image/*" class="tr-hidden" @change="pickTop5" />
            <button class="tr-btn tr-btn--ghost" type="button" @click="$event.currentTarget.previousElementSibling.click()">
              <i class="fa-solid fa-upload"></i> Replace
            </button>
            <button
              v-if="backgrounds.top5Bg && !bgReset.top5"
              class="tr-btn tr-btn--ghost"
              type="button"
              @click="bgDraft.top5Data = ''; bgReset.top5 = true"
            >
              <i class="fa-solid fa-rotate-left"></i> Reset
            </button>
          </div>
        </div>
      </div>

      <div class="tr-bg__save">
        <button class="tr-btn tr-btn--primary" type="button" :disabled="bgSaving" @click="saveBackgrounds">
          <i class="fa-solid fa-floppy-disk"></i>
          {{ bgSaving ? 'Saving…' : 'Save backgrounds' }}
        </button>
        <span class="tr-note">Only images you changed will be uploaded.</span>
      </div>
    </TourismPanel>
  </div>
</template>

<style scoped>
.tr-muted { color: var(--tr-muted); font-size: 0.85rem; margin: 0; }
.tr-note  { font-size: 0.76rem; color: var(--tr-muted); }

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

.tr-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.tr-field--wide { grid-column: 1 / -1; }
.tr-field label {
  font-size: 0.76rem; font-weight: 650; color: var(--tr-fg-2);
  display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap;
}
.tr-hint { font-weight: 400; color: var(--tr-muted); font-size: 0.72rem; }

.tr-field input,
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
}
.tr-field select { cursor: pointer; }
.tr-field input:focus,
.tr-field select:focus { border-color: var(--tr-accent); }
.tr-field input::placeholder { color: var(--tr-muted-2); }

.tr-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
.tr-form__actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.tr-period { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 220px)); gap: 16px; }

.tr-state {
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  background: var(--tr-surface-3);
  color: var(--tr-muted);
  border: 1px solid var(--tr-border-2);
}
.tr-state[data-on='true'] { background: var(--tr-ok-soft); color: var(--tr-ok); border-color: var(--tr-ok); }

/* ── Split bar ── */
.tr-split-bar {
  display: flex;
  height: 34px;
  border-radius: var(--tr-radius-sm);
  overflow: hidden;
  background: var(--tr-bg-raised);
  border: 1px solid var(--tr-border);
  font-size: 0.72rem;
  font-weight: 700;
}
.tr-split-bar__dom,
.tr-split-bar__for {
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  overflow: hidden;
  transition: width 0.35s var(--tr-ease);
}
.tr-split-bar__dom { background: var(--tr-accent-soft); color: var(--tr-fg); }
.tr-split-bar__for { background: var(--tr-info-soft); color: var(--tr-fg); }

/* ── Attractions ── */
.tr-acts { list-style: none; margin: 0 0 10px; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.tr-acts li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 130px auto;
  gap: 9px;
  align-items: center;
}
.tr-acts li input {
  width: 100%;
  padding: 9px 12px;
  border-radius: var(--tr-radius-sm);
  border: 1px solid var(--tr-border-2);
  background: var(--tr-bg-raised);
  color: var(--tr-fg);
  font-family: inherit;
  font-size: 0.85rem;
}
.tr-acts li input:focus { border-color: var(--tr-accent); }
.tr-acts__add { align-self: flex-start; }

/* ── Warn ── */
.tr-warn {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 4px 0 0;
  padding: 13px 15px;
  border-radius: var(--tr-radius);
  background: var(--tr-warn-soft);
  border: 1px solid var(--tr-warn);
  color: var(--tr-fg);
  font-size: 0.81rem;
  line-height: 1.5;
}
.tr-warn i { color: var(--tr-warn); flex-shrink: 0; margin-top: 2px; }

/* ── Backgrounds ── */
.tr-bgs { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
.tr-bg { display: flex; flex-direction: column; gap: 10px; }
.tr-bg > label { font-size: 0.76rem; font-weight: 650; color: var(--tr-fg-2); }
.tr-bg__preview {
  height: 150px;
  border-radius: var(--tr-radius);
  border: 1px solid var(--tr-border);
  background: var(--tr-bg-raised);
  overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.tr-bg__preview img { width: 100%; height: 100%; object-fit: cover; }
.tr-bg__empty {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  color: var(--tr-muted-2); font-size: 0.76rem;
}
.tr-bg__empty i { font-size: 1.4rem; }
.tr-bg__ctrl { display: flex; gap: 9px; flex-wrap: wrap; }
.tr-hidden { display: none; }
.tr-bg__save {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
  padding-top: 18px;
  border-top: 1px solid var(--tr-border);
  flex-wrap: wrap;
}

/* ── Buttons ── */
/* Canonical block, duplicated verbatim in TourismDestinations.vue. These two
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

@media (max-width: 620px) {
  .tr-acts li { grid-template-columns: minmax(0, 1fr) auto; }
  .tr-acts li input:nth-child(2) { grid-column: 1 / 2; }
}
</style>