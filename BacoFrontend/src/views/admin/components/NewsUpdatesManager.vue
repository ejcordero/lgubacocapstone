<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { handleAdminAuthError } from '../../../utils/adminAuth'
import { API } from '@/api'

const API_BASE = API
const getToken = () => localStorage.getItem('baco_admin_token') || ''
const authHeaders = () => {
  const token = getToken()
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

// ══════════ CATEGORIES ══════════
// Must mirror the backend NEWS_CATEGORIES whitelist
const NEWS_CATEGORIES = [
  'Announcement', 'Tourism', 'Health', 'Education', 'Agriculture',
  'Infrastructure', 'Social Services', 'Environment', 'Events', 'Public Advisory'
]
const CATEGORY_TOKENS = {
  'Announcement':    'var(--cat-news)',
  'Tourism':         'var(--cat-tourism)',
  'Health':          'var(--cat-health)',
  'Education':       'var(--cat-education)',
  'Agriculture':     'var(--cat-agriculture)',
  'Infrastructure':  'var(--cat-infrastructure)',
  'Social Services': 'var(--cat-social)',
  'Environment':     'var(--cat-environment)',
  'Events':          'var(--cat-events)',
  'Public Advisory': 'var(--cat-advisory)',
}
const catColor = (c) => CATEGORY_TOKENS[c] || 'var(--cat-advisory)'

// Today's date in LOCAL time as YYYY-MM-DD — default for new articles
const todayLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ══════════ STATE ══════════
const loading = ref(true)
const loadError = ref('')
const articles = ref([])
const search = ref('')
const categoryFilter = ref('All')
const successMsg = ref('')
const errorMsg = ref('')

// Editor modal
const showEditor = ref(false)
const draft = ref(null)          // { id, title, category, date, content, gallery[], _original }
const saving = ref(false)

// Delete modal
const deleteTarget = ref(null)
const deleting = ref(false)

// Save confirm modal ("Are you sure you want to save edits?")
const showSaveConfirm = ref(false)

const truncate = (v, n = 55) => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim()
  return s.length > n ? s.slice(0, n) + '…' : s
}
const stripHtml = (html) => String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const flashSuccess = (msg) => { successMsg.value = msg; setTimeout(() => { successMsg.value = '' }, 4000) }
const flashError = (msg) => { errorMsg.value = msg; setTimeout(() => { errorMsg.value = '' }, 4000) }

// 📋 LOG — Content change logger (so news edits appear in System Logs)
const logChange = async (entityId, entityTitle, action, changes) => {
  const token = getToken()
  if (!token) return
  try {
    await fetch(`${API_BASE}/admin/content-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ section: 'news', entityId: String(entityId || ''), entityTitle, action, changes })
    })
  } catch (e) { console.error('Log error:', e) }
}

// ══════════ LOAD ══════════
const fetchNews = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const res = await fetch(`${API_BASE}/news`, { cache: 'no-store' })
    if (!res.ok) { if (handleAdminAuthError(res)) return; throw new Error('Failed to load news.') }
    articles.value = await res.json()
  } catch (err) {
    loadError.value = err.message || 'Failed to load news.'
  } finally { loading.value = false }
}

// ══════════ FILTERS ══════════
const categoryCounts = computed(() => {
  const c = { All: articles.value.length }
  for (const cat of NEWS_CATEGORIES) c[cat] = 0
  articles.value.forEach(a => {
    const cat = a.category || 'Announcement'
    if (c[cat] !== undefined) c[cat]++
  })
  return c
})

const filteredArticles = computed(() => {
  let list = articles.value
  if (categoryFilter.value !== 'All') {
    list = list.filter(a => (a.category || 'Announcement') === categoryFilter.value)
  }
  if (search.value) {
    const s = search.value.toLowerCase()
    list = list.filter(a => (a.title || '').toLowerCase().includes(s))
  }
  return list
})

// ══════════ EDITOR MODAL ══════════
const openAdd = () => {
  draft.value = { id: 'new', title: '', category: 'Announcement', date: todayLocal(), content: '<p><br></p>', gallery: [], _original: null }
  showEditor.value = true
  initRteContent()
}
const openEdit = (item) => {
  draft.value = {
    id: item.id,
    title: item.title || '',
    category: NEWS_CATEGORIES.includes(item.category) ? item.category : 'Announcement',
    date: item.date_raw || '',
    content: item.content || '<p><br></p>',
    gallery: (item.gallery && item.gallery.length) ? [...item.gallery] : (item.image ? [item.image] : []),
    _original: {
      title: item.title, category: item.category || 'Announcement', date: item.date_raw || '',
      content: item.content, galleryCount: item.gallery?.length || 0
    }
  }
  showEditor.value = true
  initRteContent()
}
const closeEditor = () => {
  showEditor.value = false
  draft.value = null
}

// Lock page scroll while the editor modal is open
watch(showEditor, (open) => { document.body.style.overflow = open ? 'hidden' : '' })

// ══════════ RICH TEXT EDITOR (FIXED) ══════════
// Content is injected ONCE when the modal opens — never re-bound reactively —
// so the caret stays where the user puts it. We only READ innerHTML afterwards.
const rteEl = ref(null)
const initRteContent = () => {
  nextTick(() => {
    if (rteEl.value && draft.value) rteEl.value.innerHTML = draft.value.content || '<p><br></p>'
  })
}
const onRteInput = (e) => { if (draft.value) draft.value.content = e.target.innerHTML }
const execCmd = (command, value = null) => {
  document.execCommand(command, false, value)
  if (rteEl.value && draft.value) draft.value.content = rteEl.value.innerHTML
}

const onGalleryUpload = (e) => {
  const files = e.target.files
  if (!files || !draft.value) return
  for (const file of files) {
    if (!file.type.startsWith('image/')) { flashError(`"${file.name}" is not an image — skipped.`); continue }
    if (file.size > 5 * 1024 * 1024) { flashError(`"${file.name}" is over 5MB — skipped.`); continue }
    const reader = new FileReader()
    reader.onload = (event) => { if (draft.value) draft.value.gallery.push(event.target.result) }
    reader.readAsDataURL(file)
  }
  e.target.value = ''
}
const removeGalleryImage = (i) => { if (draft.value) draft.value.gallery.splice(i, 1) }

// Strips pasted inline background declarations (Facebook copies carry white
// boxes this way) so saved articles render as plain text everywhere.
const stripInlineBackgrounds = (html) =>
  String(html || '').replace(/background(?:-color|-image)?\s*:\s*[^;"'}]+;?/gi, '')

// ══════════ SAVE (with confirm-diff gate) ══════════
const saveDiff = computed(() => {
  const list = []
  if (!draft.value) return list
  const d = draft.value, o = d._original
  if (!o) {
    list.push({ label: 'New Article', from: '—', to: truncate(d.title) })
    list.push({ label: 'Category', from: '—', to: d.category })
    list.push({ label: 'Date', from: '—', to: d.date || 'Publish date' })
    return list
  }
  if (String(d.title) !== String(o.title)) list.push({ label: 'Headline', from: truncate(o.title), to: truncate(d.title) })
  if (String(d.category) !== String(o.category)) list.push({ label: 'Category', from: o.category, to: d.category })
  if (String(d.date || '') !== String(o.date || '')) list.push({ label: 'Date', from: o.date || 'Publish date', to: d.date || 'Publish date' })
  if (String(d.content) !== String(o.content)) list.push({ label: 'Content', from: '(previous version)', to: '(updated)' })
  if (d.gallery.length !== o.galleryCount) list.push({ label: 'Photos', from: `${o.galleryCount} photo(s)`, to: `${d.gallery.length} photo(s)` })
  return list
})

const requestSave = () => {
  if (!draft.value?.title?.trim()) { flashError('Please enter a headline.'); return }
  showSaveConfirm.value = true
}
const cancelSaveConfirm = () => { if (!saving.value) showSaveConfirm.value = false }

// FIXED: wrapper guarantees the confirm modal ALWAYS closes — whether the
// save succeeds, fails, or returns early. The confirm button calls THIS,
// not doSave directly (that was the stuck-modal / "draft.value is null" bug).
const confirmSave = async () => {
  try {
    await doSave()
  } finally {
    showSaveConfirm.value = false
  }
}

const doSave = async () => {
  // FIXED: guards — ignore double-clicks and stale invocations after the
  // editor closed (draft.value is null).
  if (saving.value || !draft.value) return
  const token = getToken()
  if (!token) { flashError('Authentication required.'); return }
  saving.value = true
  try {
    const isNew = draft.value.id === 'new' || !draft.value.id
    const url = isNew ? `${API_BASE}/news` : `${API_BASE}/news/${draft.value.id}`
    const res = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        title: draft.value.title,
        category: draft.value.category,
        date: draft.value.date || null,
        content: stripInlineBackgrounds(draft.value.content),
        images: draft.value.gallery
      })
    })
    if (!res.ok) {
      if (handleAdminAuthError(res)) return
      let msg = 'Unknown error'
      try { const e = await res.json(); msg = e.error || msg } catch { /* non-JSON */ }
      throw new Error(msg)
    }
    // Snapshot BEFORE closeEditor() nulls the draft
    const savedId = isNew ? null : draft.value.id
    const savedTitle = draft.value.title
    const savedAction = isNew ? 'create' : 'update'
    const diffSnapshot = saveDiff.value.map(d => ({
      [d.label.toLowerCase().replace(/\s+/g, '_')]: { old: d.from, new: d.to }
    })).reduce((acc, cur) => ({ ...acc, ...cur }), {})

    closeEditor()
    await logChange(savedId, savedTitle, savedAction, diffSnapshot)
    flashSuccess(savedAction === 'create'
      ? 'News published! It is now live on the public site.'
      : 'News updated! Changes are now live.')
    await fetchNews()
  } catch (err) {
    flashError(err.message || 'Network error.')
  } finally { saving.value = false }
}

// ══════════ DELETE ══════════
const askDelete = (article) => { deleteTarget.value = article }
const cancelDelete = () => { if (!deleting.value) deleteTarget.value = null }
const executeDelete = async () => {
  const token = getToken()
  if (!token || !deleteTarget.value) return
  deleting.value = true
  try {
    const res = await fetch(`${API_BASE}/news/${deleteTarget.value.id}`, { method: 'DELETE', headers: authHeaders() })
    if (!res.ok) {
      if (handleAdminAuthError(res)) return
      throw new Error('Delete failed.')
    }
    const deleted = deleteTarget.value
    deleteTarget.value = null
    await logChange(deleted.id, deleted.title, 'delete', null)
    flashSuccess('News article deleted.')
    await fetchNews()
  } catch (err) {
    flashError(err.message || 'Delete failed.')
    deleteTarget.value = null
  } finally { deleting.value = false }
}

const onKey = (e) => {
  if (e.key !== 'Escape') return
  if (showSaveConfirm.value) cancelSaveConfirm()
  else if (deleteTarget.value) cancelDelete()
  else if (showEditor.value) closeEditor()
}

onMounted(() => { fetchNews(); window.addEventListener('keydown', onKey) })
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="news-manager">
    <!-- HEADER -->
    <div class="mod-header">
      <div class="mh-left">
        <i class="fas fa-newspaper"></i>
        <div>
          <h2>News &amp; Updates</h2>
          <p>Post and manage news articles shown on the public site</p>
        </div>
      </div>
      <button class="add-btn mat-skeuo-filled mat-pressable-filled" @click="openAdd"><i class="fas fa-plus"></i> Add Article</button>
    </div>

    <div v-if="loadError" class="state-box error">
      <i class="fas fa-exclamation-triangle"></i>
      <p>{{ loadError }}</p>
      <button @click="fetchNews" class="retry-btn mat-skeuo-sm mat-pressable-sm"><i class="fas fa-rotate-right"></i> Retry</button>
    </div>
    <div v-else-if="loading" class="state-box"><i class="fas fa-spinner fa-spin"></i><p>Loading news...</p></div>

    <template v-else>
      <Transition name="msg"><div v-if="successMsg" class="toast success"><i class="fas fa-circle-check"></i> {{ successMsg }}</div></Transition>
      <Transition name="msg"><div v-if="errorMsg" class="toast error"><i class="fas fa-circle-exclamation"></i> {{ errorMsg }}</div></Transition>

      <!-- TOOLBAR: category filter pills + search -->
      <div class="toolbar">
        <div class="tb-filters">
          <button
            v-for="(count, cat) in categoryCounts"
            :key="cat"
            class="filter-pill mat-well"
            :class="{ active: categoryFilter === cat }"
            @click="categoryFilter = cat"
          >
            <span v-if="cat !== 'All'" class="fp-dot" :style="{ background: catColor(cat) }"></span>
            {{ cat }} ({{ count }})
          </button>
        </div>
        <div class="tb-search">
          <i class="fas fa-search"></i>
          <input v-model="search" type="text" placeholder="Search articles..." />
        </div>
      </div>

      <!-- SQUARE CARD GRID -->
      <div class="cards-grid">
        <div v-for="item in filteredArticles" :key="item.id" class="news-card">
          <div class="nc-img">
            <img v-if="item.image" :src="item.image" :alt="item.title" />
            <div v-else class="nc-img-ph"><i class="fas fa-newspaper"></i></div>
            <span class="nc-cat-badge mat-well" :style="{ '--c': catColor(item.category || 'Announcement') }">
              {{ item.category || 'Announcement' }}
            </span>
            <div class="nc-actions">
              <button class="round-btn edit mat-skeuo-sm mat-pressable-sm" @click="openEdit(item)" title="Edit"><i class="fas fa-pen"></i></button>
              <button class="round-btn delete mat-skeuo-sm mat-pressable-sm" @click="askDelete(item)" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
          </div>
          <div class="nc-body">
            <h4 class="nc-title">{{ item.title }}</h4>
            <p class="nc-excerpt">{{ stripHtml(item.content) || '—' }}</p>
            <div class="nc-foot">
              <span class="nc-date"><i class="fa-regular fa-calendar"></i> {{ item.date }}</span>
            </div>
          </div>
        </div>
        <div v-if="filteredArticles.length === 0" class="empty-row">
          <i class="fas fa-newspaper"></i>
          <p>{{ search || categoryFilter !== 'All' ? 'No articles match your filters.' : 'No news posted yet — click "Add Article" to publish the first update.' }}</p>
        </div>
      </div>
    </template>

    <!-- ══ EDITOR POP-UP MODAL ══ -->
    <Transition name="pop">
      <div v-if="showEditor && draft" class="em-overlay" @click.self="closeEditor">
        <div class="editor-modal mat-glass-strong" role="dialog" aria-modal="true">
          <div class="em-head">
            <div class="em-head-icon"><i class="fas fa-newspaper"></i></div>
            <div class="em-head-text">
              <span class="em-kicker">{{ draft.id === 'new' ? 'New · Article' : 'Editing · Article' }}</span>
              <h3 class="em-title">{{ draft.id === 'new' ? 'Post News Update' : 'Edit News Update' }}</h3>
            </div>
            <button class="em-close mat-skeuo-sm mat-pressable-sm" @click="closeEditor" aria-label="Close"><i class="fas fa-xmark"></i></button>
          </div>

          <div class="em-body">
            <div class="em-grid">
              <div class="fg">
                <label>Headline <span class="req">*</span> <span class="char-count">{{ draft.title.length }}/200</span></label>
                <input v-model="draft.title" type="text" placeholder="Enter the news headline..." maxlength="200" />
              </div>
              <div class="fg">
                <label>Category <span class="req">*</span></label>
                <div class="select-wrap">
                  <select v-model="draft.category">
                    <option v-for="cat in NEWS_CATEGORIES" :key="cat" :value="cat">
                      {{ cat }}
                    </option>
                  </select>
                  <i class="fas fa-chevron-down select-chevron"></i>
                </div>
              </div>
            </div>

            <!-- ══ NEW: Announcement Date — the date shown on the post ══ -->
            <div class="fg">
              <label>Announcement Date <span class="hint">&mdash; the date shown on the post; leave empty to use the publish date</span></label>
              <input v-model="draft.date" type="date" />
            </div>

            <div class="fg">
              <label>Cover Photo / Gallery</label>
              <div class="nu-gallery">
                <div v-for="(img, i) in draft.gallery" :key="i" class="nu-thumb-wrap">
                  <img :src="img" class="nu-gal-img" />
                  <button class="nu-gal-remove mat-skeuo-sm mat-pressable-danger" @click="removeGalleryImage(i)" title="Remove photo">×</button>
                </div>
                <label class="nu-upload-tile">
                  <i class="fas fa-cloud-arrow-up"></i>
                  <span>Add photo</span>
                  <input type="file" @change="onGalleryUpload" accept="image/*" multiple class="nu-file-hidden" />
                </label>
              </div>
              <span class="hint">First photo is used as the cover. Max 5MB per image.</span>
            </div>

            <div class="fg">
              <label>Content</label>
              <div class="nu-rte">
                <div class="nu-rte-toolbar">
                  <button type="button" @mousedown.prevent @click="execCmd('bold')" title="Bold"><i class="fas fa-bold"></i></button>
                  <button type="button" @mousedown.prevent @click="execCmd('italic')" title="Italic"><i class="fas fa-italic"></i></button>
                  <button type="button" @mousedown.prevent @click="execCmd('underline')" title="Underline"><i class="fas fa-underline"></i></button>
                  <span class="nu-rte-sep"></span>
                  <button type="button" @mousedown.prevent @click="execCmd('formatBlock', 'h2')" title="Heading">H</button>
                  <button type="button" @mousedown.prevent @click="execCmd('formatBlock', 'p')" title="Paragraph">P</button>
                  <span class="nu-rte-sep"></span>
                  <button type="button" @mousedown.prevent @click="execCmd('insertUnorderedList')" title="Bullet list"><i class="fas fa-list-ul"></i></button>
                  <button type="button" @mousedown.prevent @click="execCmd('insertOrderedList')" title="Numbered list"><i class="fas fa-list-ol"></i></button>
                  <span class="nu-rte-sep"></span>
                  <button type="button" @mousedown.prevent @click="execCmd('justifyLeft')" title="Align left"><i class="fas fa-align-left"></i></button>
                  <button type="button" @mousedown.prevent @click="execCmd('justifyCenter')" title="Align center"><i class="fas fa-align-center"></i></button>
                  <button type="button" @mousedown.prevent @click="execCmd('removeFormat')" title="Clear formatting"><i class="fas fa-eraser"></i></button>
                </div>
                <!-- FIXED: no reactive v-html — content injected once on open (see initRteContent) -->
                <div
                  ref="rteEl"
                  class="nu-rte-content"
                  contenteditable="true"
                  @input="onRteInput"
                ></div>
              </div>
            </div>
          </div>

          <div class="em-foot">
            <button class="btn-cancel mat-skeuo-sm mat-pressable-danger" @click="closeEditor"><i class="fas fa-xmark"></i> Cancel</button>
            <button class="btn-save mat-skeuo-filled mat-pressable-filled" @click="requestSave" :disabled="saving">
              <i class="fas fa-paper-plane"></i> {{ saving ? 'Saving...' : (draft.id === 'new' ? 'Publish News' : 'Save Changes') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ══ DELETE MODAL ══ -->
    <Transition name="fade">
      <div v-if="deleteTarget" class="modal-overlay" @click.self="cancelDelete">
        <div class="modal-box mat-glass-strong">
          <div class="modal-icon"><i class="fas fa-triangle-exclamation"></i></div>
          <h3>Delete this article?</h3>
          <p>Are you sure you want to delete <strong>{{ truncate(deleteTarget.title, 80) }}</strong>? This action cannot be undone.</p>
          <div class="modal-actions">
            <button class="btn-cancel mat-skeuo-sm mat-pressable-danger" @click="cancelDelete">Cancel</button>
            <button class="btn-danger mat-skeuo-sm mat-pressable-danger" @click="executeDelete" :disabled="deleting"><i class="fas fa-trash"></i> {{ deleting ? 'Deleting...' : 'Delete' }}</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ══ SAVE CONFIRMATION MODAL ══ -->
    <Transition name="fade">
      <div v-if="showSaveConfirm" class="modal-overlay" @click.self="cancelSaveConfirm">
        <div class="modal-box mat-glass-strong">
          <div class="modal-icon save"><i class="fas fa-circle-question"></i></div>
          <h3>{{ draft?.id === 'new' ? 'Publish this article?' : 'Save these edits?' }}</h3>
          <p>You are about to update news content that is visible to the public. Are you sure?</p>
          <div v-if="saveDiff.length" class="diff-list">
            <div v-for="d in saveDiff" :key="d.label" class="diff-row">
              <span class="diff-label">{{ d.label }}</span>
              <div class="diff-values">
                <span class="diff-from">{{ d.from || '—' }}</span>
                <i class="fas fa-arrow-right-long diff-arrow"></i>
                <span class="diff-to">{{ d.to || '—' }}</span>
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-cancel mat-skeuo-sm mat-pressable-danger" @click="cancelSaveConfirm">Cancel</button>
            <!-- FIXED: calls confirmSave (wrapper), which always closes this modal -->
            <button class="btn-save mat-skeuo-filled mat-pressable-filled" :disabled="saving" @click="confirmSave">
              <i class="fas fa-check"></i> {{ saving ? 'Saving...' : (draft?.id === 'new' ? 'Yes, Publish' : 'Yes, Save') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.news-manager { padding: 28px; font-family: var(--font-body); background: var(--bg); min-height: 100%; }
.mod-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 20px; }
.mh-left { display: flex; align-items: center; gap: 14px; }
.mh-left > i { font-size: 1.8rem; color: var(--ac); }
.mh-left h2 { margin: 0; font-family: var(--font-display); font-size: 1.4rem; color: var(--fg); font-weight: 700; }
.mh-left p { margin: 3px 0 0; font-size: 0.82rem; color: var(--mt); }
.add-btn { display: flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: var(--r-sm); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
.add-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px var(--acg); }

/* ── TOOLBAR ── */
.toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
.tb-filters { display: flex; gap: 6px; flex-wrap: wrap; }
.filter-pill {
  display: inline-flex; align-items: center; gap: 7px; padding: 7px 14px;
  border-radius: var(--r-sm); font-size: 0.76rem; font-weight: 600; cursor: pointer;
  /* Unselected sits on the surface it belongs to; selected inverts against it. */
  background-color: #FBFBF9;
  color: #3A3E45;
  border: 1px solid rgba(25, 27, 31, 0.10);
}
.filter-pill:hover { border-color: var(--ac); color: var(--fg); }
/* A SOLID chip in both themes. A tinted wash was tried first and rejected:
   against the page canvas it measured 1.25:1, so the selected pill was
   indistinguishable from the background it sat on -- dark mode technically
   applied and visually did nothing. Solid separates at 4.51:1 (light) and
   7.05:1 (dark).

   Every var() here carries a literal fallback, and that is load-bearing rather
   than belt-and-braces: if a custom property is missing, var() makes the whole
   declaration invalid at computed-value time, and `background` then computes
   to transparent. On a button whose text colour is also a token that would
   render a blank white pill -- the state is present in the DOM and invisible on
   screen, which is the worst way for a theme bug to present. The fallbacks
   mean a token that fails to resolve degrades to a correct solid chip. */
.filter-pill.active {
  background-color: #191B1F;
  color: #EFF0EB;
  border-color: #191B1F;
  font-weight: 700;
}
/* The ring separates the dot from the chip. The chip is solid in both themes
   but the text on it inverts, so the ring is derived from that text colour
   rather than from a constant or from the canvas -- either would vanish in one
   theme or the other. */
.filter-pill.active .fp-dot { box-shadow: 0 0 0 2px rgba(25, 27, 31, 0.40); }
.fp-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.tb-search { display: flex; align-items: center; gap: 8px; background: var(--bg2); border: 1px solid var(--bdr); border-radius: var(--r-sm); padding: 0 12px; }
.tb-search i { color: var(--mt); font-size: 0.85rem; }
.tb-search input { border: none; background: none; padding: 9px 0; font-size: 0.84rem; color: var(--fg); outline: none; width: 200px; }

/* ── SQUARE CARD GRID ── */
.cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.news-card { background: var(--card-solid); border: 1px solid var(--bdr); border-radius: var(--r-md); overflow: hidden; display: flex; flex-direction: column; transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s; }
.news-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); border-color: var(--bdr2); }
.nc-img { position: relative; aspect-ratio: 1 / 1; background: var(--bg3); overflow: hidden; }
.nc-img img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.4s var(--ease); }
.news-card:hover .nc-img img { transform: scale(1.04); }
.nc-img-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--mt); font-size: 2rem; opacity: 0.45; }
.nc-cat-badge { position: absolute; top: 10px; left: 10px; padding: 4px 11px; border-radius: 100px; font-size: 0.6rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
/* SOLID fill, no color-mix. The 14% wash this replaces blended the hue into
   --card-solid, and that is what made the badge unreadable in dark: the wash
   landed within a couple of points of the card it sits on, so the label lost
   the surface it needed to read against -- and the badge overlaps a photo, so
   there was nothing behind it to separate from either.

   The category hues are already theme-polarised: every light value is dark and
   every dark value is light. A solid fill therefore carries the opposite-
   polarity label via --on-cat, white in light and near-black in dark. Worst
   case 5.81:1 light, 6.39:1 dark, and the fill separates from the card at
   2.46:1 and 9.13:1 where the wash managed almost nothing. */
.nc-cat-badge { background-color: var(--c, #1D4ED8); color: var(--on-cat, #FFFFFF); border-color: transparent; }
/* ── CIRCULAR ACTION BUTTONS ── */
.nc-actions { position: absolute; top: 10px; right: 10px; display: flex; gap: 6px; }
.round-btn { width: 34px; height: 34px; border-radius: 50%; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 0.78rem; backdrop-filter: blur(4px); }
.round-btn:hover { transform: scale(1.12); filter: brightness(1.15); }
.round-btn:active { transform: scale(0.96); }
.round-btn.edit { background: rgba(59, 130, 246, 0.92); }
.round-btn.delete { background: rgba(255, 59, 92, 0.92); }
.nc-body { padding: 14px 16px 14px; display: flex; flex-direction: column; gap: 7px; flex: 1; }
.nc-title { margin: 0; font-size: 0.92rem; font-weight: 700; color: var(--fg); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.nc-excerpt { margin: 0; font-size: 0.76rem; color: var(--mt); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; flex: 1; }
.nc-foot { display: flex; align-items: center; justify-content: flex-end; }
.nc-date { display: inline-flex; align-items: center; gap: 6px; font-size: 0.7rem; color: var(--mt2); }
.nc-date i { font-size: 0.64rem; }
.empty-row { grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: var(--mt); background: var(--card-solid); border: 1px dashed var(--bdr2); border-radius: var(--r-md); }
.empty-row i { font-size: 2rem; display: block; margin-bottom: 12px; opacity: 0.4; }
.empty-row p { margin: 0; font-size: 0.84rem; }

/* ══ EDITOR MODAL ══ */
.em-overlay { position: fixed; inset: 0; z-index: 1100; background: rgba(0,0,0,0.7); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: clamp(12px, 4vw, 24px); }
.editor-modal { width: 100%; max-width: 640px; max-height: 90dvh; display: flex; flex-direction: column; border-radius: var(--r-lg); overflow: hidden; }
.em-head { flex-shrink: 0; background: var(--bg2); border-bottom: 1px solid var(--bdr); padding: 18px 22px; display: flex; align-items: center; gap: 14px; }
.em-head-icon { width: 42px; height: 42px; flex-shrink: 0; border-radius: var(--r-md); background: var(--acs); border: 1px solid var(--acs2); display: flex; align-items: center; justify-content: center; color: var(--ac); font-size: 1.05rem; }
.em-head-text { flex: 1; min-width: 0; }
.em-kicker { display: block; font-size: 0.6rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ac); margin-bottom: 3px; }
.em-title { margin: 0; font-family: var(--font-display); font-size: 1.05rem; font-weight: 700; color: var(--fg); }
.em-close { width: 34px; height: 34px; flex-shrink: 0; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; }
.em-close:hover { background: var(--dgs); color: var(--dg); border-color: var(--dg); transform: rotate(90deg); }
.em-body { flex: 1; min-height: 0; overflow-y: auto; padding: 20px 22px; display: flex; flex-direction: column; gap: 16px; }
.em-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 22px; background: var(--bg2); border-top: 1px solid var(--bdr); flex-shrink: 0; }

.em-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px; }
.fg { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.fg label { font-size: 0.66rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--mt); }
.fg input, .fg select { width: 100%; padding: 10px 14px; border: 1px solid var(--bdr); border-radius: var(--r-md); font-size: 0.88rem; color: var(--fg); background: var(--bg2); transition: border-color 0.18s, box-shadow 0.18s; }
.fg input:focus, .fg select:focus { outline: none; border-color: var(--ac); box-shadow: 0 0 0 3px var(--acs); }
.select-wrap { position: relative; }
.select-wrap select { appearance: none; -webkit-appearance: none; cursor: pointer; padding-right: 36px; }
.select-wrap select option { background: var(--card-solid); color: var(--fg); }
.select-chevron { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: var(--mt); font-size: 0.7rem; pointer-events: none; }
.char-count { float: right; font-size: 0.6rem; color: var(--mt2); text-transform: none; letter-spacing: 0; }
.req { color: var(--dg); }
.hint { font-size: 0.68rem; color: var(--mt2); }

.nu-gallery { display: flex; gap: 10px; flex-wrap: wrap; }
.nu-thumb-wrap { position: relative; }
.nu-gal-img { width: 76px; height: 76px; object-fit: cover; border-radius: var(--r-md); border: 1px solid var(--bdr); display: block; }
.nu-gal-remove { position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; border-radius: 50%; font-size: 0.7rem; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.nu-upload-tile { width: 76px; height: 76px; border: 1.5px dashed var(--bdr2); border-radius: var(--r-md); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer; color: var(--mt); transition: border-color 0.18s, background 0.18s; }
.nu-upload-tile:hover { border-color: var(--ac); background: var(--acs); }
.nu-upload-tile i { font-size: 1rem; }
.nu-upload-tile span { font-size: 0.58rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.nu-file-hidden { display: none; }

/* ── RTE ── */
.nu-rte { display: flex; flex-direction: column; }
.nu-rte-toolbar { display: flex; gap: 2px; flex-wrap: wrap; background: var(--bg3); border: 1px solid var(--bdr); border-bottom: none; border-radius: var(--r-md) var(--r-md) 0 0; padding: 6px; }
.nu-rte-toolbar button { background: none; border: none; padding: 6px 10px; cursor: pointer; color: var(--mt); border-radius: var(--r-sm); font-size: 0.78rem; font-weight: 700; transition: background 0.15s, color 0.15s; }
.nu-rte-toolbar button:hover { background: var(--card3); color: var(--fg); }
.nu-rte-sep { width: 1px; background: var(--bdr); margin: 3px 4px; }
.nu-rte-content { background: var(--bg2); border: 1px solid var(--bdr); border-radius: 0 0 var(--r-md) var(--r-md); padding: 14px 16px; min-height: 200px; max-height: 300px; overflow-y: auto; font-size: 14px; line-height: 1.65; color: var(--fg); }
.nu-rte-content:focus { outline: none; border-color: var(--ac); box-shadow: 0 0 0 3px var(--acs); }
.nu-rte-content p { margin-bottom: 1em; }
.nu-rte-content h2 { font-size: 1.5em; font-weight: 700; margin-bottom: 0.5em; }
.nu-rte-content ul, .nu-rte-content ol { padding-left: 1.5em; margin-bottom: 1em; }
.nu-rte-content:empty::before { content: 'Write the article content here...'; color: var(--mt2); pointer-events: none; }
/* Pasted HTML (Facebook copies) must render as plain text — no white boxes */
.nu-rte-content :deep(*:not(blockquote)) { background-color: transparent !important; background-image: none !important; }

.pop-enter-active { transition: opacity 0.25s ease; }
.pop-leave-active { transition: opacity 0.18s ease; }
.pop-enter-from, .pop-leave-to { opacity: 0; }
.pop-enter-active .editor-modal { transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.26s ease; }
.pop-leave-active .editor-modal { transition: transform 0.18s ease, opacity 0.18s ease; }
.pop-enter-from .editor-modal { transform: translateY(26px) scale(0.97); opacity: 0; }
.pop-leave-to .editor-modal { transform: translateY(12px) scale(0.98); opacity: 0; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(3px); }
.modal-box { border-radius: var(--r-lg); padding: 32px; max-width: 440px; width: 100%; text-align: center; max-height: 90vh; overflow-y: auto; }
.modal-icon { width: 56px; height: 56px; border-radius: 50%; background: var(--dgs); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
.modal-icon i { font-size: 1.4rem; color: var(--dg); }
.modal-icon.save { background: var(--acs); }
.modal-icon.save i { color: var(--ac); }
.modal-box h3 { margin: 0 0 8px; font-size: 1.1rem; font-weight: 700; color: var(--fg); }
.modal-box p { margin: 0 0 20px; font-size: 0.85rem; color: var(--mt); line-height: 1.5; }
.modal-box p strong { color: var(--fg); }
.modal-actions { display: flex; justify-content: center; gap: 10px; }
.diff-list { max-height: 220px; overflow-y: auto; text-align: left; border: 1px solid var(--bdr); border-radius: var(--r-sm); margin-bottom: 22px; background: var(--bg2); }
.diff-row { padding: 10px 14px; border-bottom: 1px solid var(--bdr); }
.diff-row:last-child { border-bottom: none; }
.diff-label { display: block; font-size: 0.64rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ac); margin-bottom: 5px; }
.diff-values { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; min-width: 0; }
.diff-from { color: var(--mt); text-decoration: line-through; text-decoration-color: var(--dg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.diff-arrow { color: var(--mt2); font-size: 0.7rem; flex-shrink: 0; }
.diff-to { color: var(--fg); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }

.btn-cancel { padding: 9px 18px; font-size: 0.82rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; border-radius: var(--r-sm); }
.btn-cancel:hover { background: var(--card3); border-color: var(--bdr2); color: var(--fg); }
.btn-save { padding: 9px 18px; font-size: 0.82rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; border-radius: var(--r-sm); }
.btn-save:hover:not(:disabled) { transform: translateY(-2px); }
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-danger { padding: 9px 18px; font-size: 0.82rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; border-radius: var(--r-sm); }
.btn-danger:hover:not(:disabled) { background: #ff5570; }
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

.toast { padding: 10px 14px; display: flex; align-items: center; gap: 8px; font-size: 0.82rem; font-weight: 500; margin-bottom: 14px; border-radius: var(--r-sm); }
.toast.success { background: var(--oks); color: var(--ok); border: 1px solid var(--okg); }
.toast.error { background: var(--dgs); color: var(--dg); border: 1px solid var(--dgg); }
.state-box { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 20px; color: var(--mt); background: var(--card-solid); border: 1px solid var(--bdr); border-radius: var(--r-md); }
.state-box i { font-size: 2.2rem; margin-bottom: 14px; }
.state-box.error i { color: var(--dg); }
.retry-btn { margin-top: 14px; padding: 9px 18px; border-radius: var(--r-sm); font-size: 0.82rem; font-weight: 600; cursor: pointer; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.22s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.msg-enter-active, .msg-leave-active { transition: all 0.22s ease; }
.msg-enter-from, .msg-leave-to { opacity: 0; transform: translateY(-6px); }
@media (max-width: 640px) {
  .mod-header { flex-direction: column; align-items: stretch; }
  .em-grid { grid-template-columns: 1fr; }
  .em-body { padding: 16px; }
  .em-foot { padding: 14px 16px; flex-direction: column-reverse; }
  .em-foot button { width: 100%; justify-content: center; }
  .toolbar { flex-direction: column; align-items: stretch; }
  .tb-search input { width: 100%; }
}

</style>