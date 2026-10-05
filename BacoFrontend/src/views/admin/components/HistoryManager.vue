<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { handleAdminAuthError } from '../../../utils/adminAuth'
import { API } from '@/api'

const API_BASE = API
const getToken = () => localStorage.getItem('baco_admin_token') || ''

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â STATE Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
const loading = ref(true)
const loadError = ref('')
// (reorder fix) in-flight guard + non-fatal action toast
const reordering = ref(null)   // 'timeline' | 'gallery' | null
const actionError = ref('')

// Page info
const panelOpen = ref(true)
const infoForm = ref({ title: '', heroSub: '', introText: '', heritageNote: '', facts: [] })
const infoOriginal = ref(null)
const infoAsideFile = ref(null)
const infoAsidePreview = ref('')
const infoSaving = ref(false)
const infoError = ref('')
const infoSuccess = ref('')

// Timeline & gallery
const timeline = ref([])
const gallery = ref([])

// Item modal (shared by timeline + gallery)
// CHANGED: was a side drawer Ã¢â‚¬â€ now a centered pop-up modal
const drawer = ref({ open: false, section: null, mode: 'add', id: null })
const itemForm = ref({})
const itemOriginal = ref(null)
const itemFile = ref(null)
const itemPreview = ref('')
const itemSaving = ref(false)

// Delete modal
const deleteTarget = ref(null) // { section, id, label }

// Save confirm modal
const showSaveConfirm = ref(false)
const confirmCtx = ref(null) // 'page' | 'item'

const truncate = (v) => { const s = String(v ?? '').replace(/\s+/g, ' ').trim(); return s.length > 55 ? s.slice(0, 55) + 'Ã¢â‚¬Â¦' : s }
const setPreview = (cur, next) => { if (cur && cur.startsWith('blob:')) URL.revokeObjectURL(cur); return next }
const flashActionError = (msg) => {
  actionError.value = msg
  setTimeout(() => { actionError.value = '' }, 4000)
}

// CHANGED: modal header text + lock page scroll while the modal is open
const modalTitle = computed(() => {
  const action = drawer.value.mode === 'add' ? 'Add' : 'Edit'
  return `${action} ${drawer.value.section === 'timeline' ? 'Timeline Entry' : 'Gallery Item'}`
})
const modalKicker = computed(() => {
  const section = drawer.value.section === 'timeline' ? 'Timeline' : 'Gallery'
  return drawer.value.mode === 'add' ? `New Ã‚Â· ${section}` : `Editing Ã‚Â· ${section}`
})
watch(() => drawer.value.open, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â LOAD Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// (reorder fix) silent=true refreshes ONLY timeline & gallery Ã¢â‚¬â€
// never flashes the UI and never overwrites unsaved Page Content edits.
const loadContent = async ({ silent = false } = {}) => {
  if (!silent) loading.value = true
  loadError.value = ''
  try {
    const res = await fetch(`${API_BASE}/history-content`, { cache: 'no-store' })
    if (!res.ok) { if (handleAdminAuthError(res)) return; throw new Error('Failed to load History content.') }
    const data = await res.json()
    timeline.value = data.timeline || []
    gallery.value = data.gallery || []
    if (!silent) {
      const i = data.info || {}
      infoForm.value = {
        title: i.title || '', heroSub: i.heroSub || '',
        introText: i.introText || '', heritageNote: i.heritageNote || '',
        facts: (i.facts || []).map(f => ({ label: f.label, value: f.value }))
      }
      infoAsidePreview.value = setPreview(infoAsidePreview.value, i.asideImage || '')
      infoOriginal.value = JSON.parse(JSON.stringify({ ...infoForm.value, asideRaw: i.asideImageRaw || null }))
    }
  } catch (err) {
    if (silent) {
      flashActionError('Refresh failed Ã¢â‚¬â€ showing last known data.')
    } else {
      loadError.value = err.message
    }
  } finally { if (!silent) loading.value = false }
}

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â PAGE INFO Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
const infoDirty = computed(() => {
  if (!infoOriginal.value) return false
  const f = infoForm.value, o = infoOriginal.value
  return f.title !== o.title || f.heroSub !== o.heroSub || f.introText !== o.introText ||
         f.heritageNote !== o.heritageNote || !!infoAsideFile.value ||
         JSON.stringify(cleanFacts(f.facts)) !== JSON.stringify(o.facts)
})
const cleanFacts = (arr) => (arr || [])
  .map(f => ({ label: String(f.label || '').trim(), value: String(f.value || '').trim() }))
  .filter(f => f.label && f.value)
const addFact = () => infoForm.value.facts.push({ label: '', value: '' })
const removeFact = (i) => infoForm.value.facts.splice(i, 1)

const onAsideChange = (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) { infoError.value = 'Only PNG, JPG, or WebP allowed.'; e.target.value = ''; return }
  if (file.size > 5 * 1024 * 1024) { infoError.value = 'Image must be under 5MB.'; e.target.value = ''; return }
  infoAsideFile.value = file
  infoAsidePreview.value = setPreview(infoAsidePreview.value, URL.createObjectURL(file))
  infoError.value = ''
}

const infoDiff = computed(() => {
  const list = []
  if (!infoOriginal.value) return list
  const f = infoForm.value, o = infoOriginal.value
  const push = (label, a, b) => { if (String(a ?? '') !== String(b ?? '')) list.push({ label, from: truncate(a), to: truncate(b) }) }
  push('Title', o.title, f.title)
  push('Hero Subtitle', o.heroSub, f.heroSub)
  push('Intro Text', o.introText, f.introText)
  push('Heritage Note', o.heritageNote, f.heritageNote)
  if (JSON.stringify(cleanFacts(f.facts)) !== JSON.stringify(o.facts))
    list.push({ label: 'Facts', from: `${o.facts.length} item(s)`, to: `${cleanFacts(f.facts).length} item(s)` })
  if (infoAsideFile.value) list.push({ label: 'Aside Image', from: '(current image)', to: infoAsideFile.value.name })
  return list
})

const requestSaveInfo = () => {
  if (!infoForm.value.title.trim()) { infoError.value = 'Title is required.'; return }
  if (!infoDirty.value) return
  confirmCtx.value = 'page'
  showSaveConfirm.value = true
}

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
  reader.readAsDataURL(file)
})

const doSaveInfo = async () => {
  const token = getToken()
  if (!token) { infoError.value = 'Authentication required.'; return }
  infoSaving.value = true
  infoError.value = ''
  try {
    const payload = {
      title: infoForm.value.title,
      heroSub: infoForm.value.heroSub,
      introText: infoForm.value.introText,
      heritageNote: infoForm.value.heritageNote,
      facts: cleanFacts(infoForm.value.facts)
    }
    if (infoAsideFile.value) payload.asideImage = await fileToDataUrl(infoAsideFile.value)
    const res = await fetch(`${API_BASE}/admin/history-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (!res.ok) { if (handleAdminAuthError(res)) return; throw new Error(data.message || 'Save failed.') }
    infoSuccess.value = 'History page content saved! Changes are now live.'
    infoAsideFile.value = null
    setTimeout(() => { infoSuccess.value = '' }, 4000)
    await loadContent()
  } catch (err) { infoError.value = err.message }
  finally { infoSaving.value = false }
}

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â ITEM MODAL (timeline / gallery) Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
const openItemAdd = (section) => {
  drawer.value = { open: true, section, mode: 'add', id: null }
  itemOriginal.value = null
  itemFile.value = null
  itemPreview.value = setPreview(itemPreview.value, '')
  itemForm.value = section === 'timeline'
    ? { year: '', label: '', event: '', detail: '' }
    : { title: '', year: '', description: '', imageRaw: null }
}
const openItemEdit = (section, item) => {
  drawer.value = { open: true, section, mode: 'edit', id: item.id }
  itemFile.value = null
  itemPreview.value = setPreview(itemPreview.value, section === 'gallery' ? (item.image || '') : '')
  itemForm.value = section === 'timeline'
    ? { year: item.year, label: item.label || '', event: item.event, detail: item.detail || '' }
    : { title: item.title, year: item.year || '', description: item.description || '', imageRaw: item.imageRaw || null }
  itemOriginal.value = JSON.parse(JSON.stringify(itemForm.value))
}
const closeDrawer = () => {
  drawer.value.open = false
  itemFile.value = null
  itemPreview.value = setPreview(itemPreview.value, '')
}
const onItemImageChange = (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) { itemForm.value._err = 'Only PNG, JPG, or WebP allowed.'; e.target.value = ''; return }
  if (file.size > 5 * 1024 * 1024) { itemForm.value._err = 'Image must be under 5MB.'; e.target.value = ''; return }
  itemFile.value = file
  itemPreview.value = setPreview(itemPreview.value, URL.createObjectURL(file))
  itemForm.value._err = ''
}

const itemDiff = computed(() => {
  const list = []
  if (drawer.value.mode === 'add') {
    if (drawer.value.section === 'timeline') list.push({ label: 'New Entry', from: 'Ã¢â‚¬â€', to: `${itemForm.value.year || '?'} Ã¢â‚¬â€ ${truncate(itemForm.value.event)}` })
    else list.push({ label: 'New Item', from: 'Ã¢â‚¬â€', to: `${truncate(itemForm.value.title)}${itemForm.value.year ? ` (${itemForm.value.year})` : ''}` })
    return list
  }
  if (!itemOriginal.value) return list
  const f = itemForm.value, o = itemOriginal.value
  const push = (label, a, b) => { if (String(a ?? '') !== String(b ?? '')) list.push({ label, from: truncate(a), to: truncate(b) }) }
  if (drawer.value.section === 'timeline') {
    push('Year', o.year, f.year); push('Label', o.label, f.label)
    push('Event', o.event, f.event); push('Detail', o.detail, f.detail)
  } else {
    push('Title', o.title, f.title); push('Year', o.year, f.year); push('Description', o.description, f.description)
    if (itemFile.value) list.push({ label: 'Image', from: '(current image)', to: itemFile.value.name })
  }
  return list
})

const itemHasChanges = computed(() => {
  if (drawer.value.mode === 'add') return true
  return itemDiff.value.length > 0
})

const requestSaveItem = () => {
  if (drawer.value.section === 'timeline') {
    if (!itemForm.value.year?.trim()) { itemForm.value._err = 'Year is required.'; return }
    if (!itemForm.value.event?.trim()) { itemForm.value._err = 'Event is required.'; return }
  } else {
    if (!itemForm.value.title?.trim()) { itemForm.value._err = 'Title is required.'; return }
  }
  if (!itemHasChanges.value) { itemForm.value._err = 'No changes detected.'; return }
  itemForm.value._err = ''
  confirmCtx.value = 'item'
  showSaveConfirm.value = true
}

const doSaveItem = async () => {
  const token = getToken()
  if (!token) return
  itemSaving.value = true
  try {
    const { section, mode, id } = drawer.value
    let payload, url, method
    if (section === 'timeline') {
      payload = { year: itemForm.value.year, label: itemForm.value.label, event: itemForm.value.event, detail: itemForm.value.detail }
      url = `${API_BASE}/admin/history/timeline`
      method = 'POST'
      if (mode === 'edit') { url += `/${id}`; method = 'PUT' }
    } else {
      payload = { title: itemForm.value.title, year: itemForm.value.year, description: itemForm.value.description }
      if (itemFile.value) payload.image = await fileToDataUrl(itemFile.value)
      else if (mode === 'edit' && itemForm.value.imageRaw !== itemOriginal.value.imageRaw) payload.image = itemForm.value.imageRaw
      url = `${API_BASE}/admin/history/gallery`
      method = 'POST'
      if (mode === 'edit') { url += `/${id}`; method = 'PUT' }
    }
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (!res.ok) { if (handleAdminAuthError(res)) return; throw new Error(data.message || 'Save failed.') }
    closeDrawer()
    await loadContent({ silent: true })
  } catch (err) { itemForm.value._err = err.message }
  finally { itemSaving.value = false }
}

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â REORDER Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// (reorder fix) optimistic swap + guard + silent re-sync + revert on failure
const moveItem = async (section, index, dir) => {
  if (reordering.value) return
  const listRef = section === 'timeline' ? timeline : gallery
  const list = listRef.value
  const ni = index + dir
  if (ni < 0 || ni >= list.length) return

  const optimistic = [...list]
  ;[optimistic[index], optimistic[ni]] = [optimistic[ni], optimistic[index]]
  listRef.value = optimistic

  reordering.value = section
  actionError.value = ''
  const token = getToken()
  if (!token) {
    listRef.value = list
    reordering.value = null
    flashActionError('Authentication required.')
    return
  }
  try {
    const res = await fetch(`${API_BASE}/admin/history/${section}/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ ids: optimistic.map(x => x.id) })
    })
    if (!res.ok) {
      if (handleAdminAuthError(res)) { listRef.value = list; return }
      throw new Error('Reorder failed.')
    }
    await loadContent({ silent: true })
  } catch (err) {
    listRef.value = list
    flashActionError(err.message || 'Reorder failed.')
  } finally {
    reordering.value = null
  }
}

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â DELETE Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
const askDelete = (section, item) => {
  const label = section === 'timeline' ? `${item.year} Ã¢â‚¬â€ ${item.event}` : item.title
  deleteTarget.value = { section, id: item.id, label }
}
const cancelDelete = () => { deleteTarget.value = null }
const executeDelete = async () => {
  if (!deleteTarget.value) return
  const token = getToken()
  if (!token) return
  try {
    const res = await fetch(`${API_BASE}/admin/history/${deleteTarget.value.section}/${deleteTarget.value.id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) { if (handleAdminAuthError(res)) return; const d = await res.json().catch(() => ({})); throw new Error(d.message || 'Delete failed.') }
    deleteTarget.value = null
    await loadContent({ silent: true })
  } catch (err) {
    flashActionError(err.message || 'Delete failed.')
    deleteTarget.value = null
  }
}

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â SAVE CONFIRM Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
const confirmDiff = computed(() => confirmCtx.value === 'page' ? infoDiff.value : itemDiff.value)
const confirmTitle = computed(() => {
  if (confirmCtx.value === 'page') return 'Save page content edits?'
  return drawer.value.mode === 'add' ? 'Confirm this new entry?' : 'Save these edits?'
})
const confirmSubtitle = computed(() => {
  if (confirmCtx.value === 'page') return 'You are about to update the History page content that is visible to the public. Are you sure?'
  if (drawer.value.mode === 'add') return 'Please review the new entry below. Are you sure?'
  return itemDiff.value.length === 0 ? 'No changes detected Ã¢â‚¬â€ nothing to save.' : 'Please review the changes below. Are you sure?'
})
const confirmDisabled = computed(() =>
  infoSaving.value || itemSaving.value ||
  (confirmCtx.value === 'item' && drawer.value.mode === 'edit' && itemDiff.value.length === 0)
)
const confirmButtonText = computed(() => {
  if (infoSaving.value || itemSaving.value) return 'Saving...'
  return (confirmCtx.value === 'item' && drawer.value.mode === 'add') ? 'Yes, Add' : 'Yes, Save'
})
const cancelSaveConfirm = () => {
  if (infoSaving.value || itemSaving.value) return
  showSaveConfirm.value = false
  confirmCtx.value = null
}
const confirmSave = async () => {
  const ctx = confirmCtx.value
  try {
    if (ctx === 'page') await doSaveInfo()
    else if (ctx === 'item') await doSaveItem()
  } finally {
    showSaveConfirm.value = false
    confirmCtx.value = null
  }
}
const onKey = (e) => {
  if (e.key !== 'Escape') return
  if (showSaveConfirm.value) cancelSaveConfirm()
  else if (deleteTarget.value) cancelDelete()
  else if (drawer.value.open) closeDrawer()
}

onMounted(() => { loadContent(); window.addEventListener('keydown', onKey) })
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = '' // CHANGED: safety unlock on unmount
})
</script>

<template>
  <div class="history-manager">
    <!-- HEADER -->
    <div class="mod-header">
      <div class="mh-left">
        <i class="fas fa-landmark"></i>
        <div>
          <h2>History Page Management</h2>
          <p>Manage the public History page Ã¢â‚¬â€ intro, facts, timeline & gallery</p>
        </div>
      </div>
    </div>

    <div v-if="loadError" class="state-box error">
      <i class="fas fa-exclamation-triangle"></i>
      <p>{{ loadError }}</p>
      <button @click="loadContent()" class="retry-btn mat-skeuo-sm mat-pressable-sm"><i class="fas fa-rotate-right"></i> Retry</button>
    </div>
    <div v-else-if="loading" class="state-box"><i class="fas fa-spinner fa-spin"></i><p>Loading History content...</p></div>

    <template v-else>
      <Transition name="msg"><div v-if="actionError" class="toast error"><i class="fas fa-circle-exclamation"></i> {{ actionError }}</div></Transition>

      <!-- Ã¢â€¢ÂÃ¢â€¢Â PAGE CONTENT PANEL Ã¢â€¢ÂÃ¢â€¢Â -->
      <div class="panel">
        <button class="panel-toggle" @click="panelOpen = !panelOpen">
          <div class="pt-left">
            <i class="fas fa-file-pen"></i>
            <div><span class="pt-title">Page Content</span><span class="pt-sub">Hero, intro text, facts & heritage note</span></div>
          </div>
          <div class="pt-right">
            <span v-if="infoDirty" class="dirty-badge mat-well"><i class="fas fa-circle"></i> Unsaved</span>
            <i class="fas fa-chevron-down pt-chev" :class="{ rotated: panelOpen }"></i>
          </div>
        </button>
        <Transition name="collapse">
          <div v-if="panelOpen" class="panel-body">
            <Transition name="msg"><div v-if="infoSuccess" class="toast success"><i class="fas fa-circle-check"></i> {{ infoSuccess }}</div></Transition>
            <Transition name="msg"><div v-if="infoError" class="toast error"><i class="fas fa-circle-exclamation"></i> {{ infoError }}</div></Transition>

            <div class="grid">
              <div class="fg"><label>Page Title <span class="req">*</span></label><input v-model="infoForm.title" maxlength="255" placeholder="History of Baco" /></div>
              <div class="fg"><label>Hero Subtitle</label><input v-model="infoForm.heroSub" maxlength="500" placeholder="The story of one of Mindoro's oldest towns..." /></div>
              <div class="fg full"><label>Intro Text</label><textarea v-model="infoForm.introText" rows="7" placeholder="Main article text Ã¢â‚¬â€ separate paragraphs with one blank line."></textarea><span class="hint">Blank lines become paragraph breaks on the public page.</span></div>
              <div class="fg full">
                <label>Facts <button type="button" class="mini-add mat-skeuo-filled mat-pressable-filled" @click="addFact"><i class="fas fa-plus"></i> Add Fact</button></label>
                <div v-for="(f, i) in infoForm.facts" :key="i" class="fact-row">
                  <input v-model="f.label" placeholder="Label (e.g. Founded)" />
                  <input v-model="f.value" placeholder="Value (e.g. 1575)" />
                  <button type="button" class="fact-remove mat-skeuo-sm mat-pressable-danger" @click="removeFact(i)" title="Remove"><i class="fas fa-xmark"></i></button>
                </div>
                <span v-if="infoForm.facts.length === 0" class="hint">No facts yet Ã¢â‚¬â€ click "Add Fact". Empty rows are ignored on save.</span>
              </div>
              <div class="fg full"><label>Heritage Note</label><textarea v-model="infoForm.heritageNote" rows="3" placeholder="Indigenous heritage paragraph..."></textarea><span class="hint">Supports &lt;strong&gt;...&lt;/strong&gt; for bold (rendered as-is on the page).</span></div>
              <div class="fg full">
                <label>Aside Image</label>
                <div class="img-upload-row">
                  <div class="img-thumb">
                    <img v-if="infoAsidePreview" :src="infoAsidePreview" alt="" />
                    <i v-else class="fas fa-image"></i>
                  </div>
                  <div class="img-upload" @click="$refs.asideInput.click()">
                    <input ref="asideInput" type="file" accept="image/png,image/jpeg,image/jpg,image/webp" class="hidden-input" @change="onAsideChange" />
                    <i class="fas fa-cloud-arrow-up"></i>
                    <span>{{ infoAsideFile ? infoAsideFile.name : 'Click to replace image (5MB max)' }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="panel-actions">
              <button v-if="infoDirty" class="btn-cancel mat-skeuo-sm mat-pressable-danger" @click="loadContent()"><i class="fas fa-rotate-left"></i> Discard</button>
              <button class="btn-save mat-skeuo-filled mat-pressable-filled" @click="requestSaveInfo" :disabled="infoSaving || !infoDirty"><i class="fas fa-check"></i> {{ infoSaving ? 'Saving...' : 'Save Page Content' }}</button>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Ã¢â€¢ÂÃ¢â€¢Â TIMELINE PANEL Ã¢â€¢ÂÃ¢â€¢Â -->
      <div class="panel">
        <div class="panel-head-row">
          <div class="pt-left"><i class="fas fa-timeline"></i><div><span class="pt-title">Timeline Entries</span><span class="pt-sub">{{ timeline.length }} entr{{ timeline.length === 1 ? 'y' : 'ies' }} Ã¢â‚¬â€ shown in order on the public page</span></div></div>
          <button class="add-btn" @click="openItemAdd('timeline')"><i class="fas fa-plus"></i> Add Entry</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th class="w-order">Order</th><th>Year</th><th>Label</th><th>Event</th><th class="w-actions">Actions</th></tr></thead>
            <tbody>
              <tr v-for="(t, i) in timeline" :key="t.id" class="data-row">
                <td class="td-order">
                  <button class="ord-btn mat-skeuo-sm mat-pressable-sm" :disabled="reordering === 'timeline' || i === 0" @click="moveItem('timeline', i, -1)" title="Move up"><i class="fas fa-arrow-up"></i></button>
                  <button class="ord-btn mat-skeuo-sm mat-pressable-sm" :disabled="reordering === 'timeline' || i === timeline.length - 1" @click="moveItem('timeline', i, 1)" title="Move down"><i class="fas fa-arrow-down"></i></button>
                </td>
                <td class="td-year">{{ t.year }}</td>
                <td>{{ t.label || 'Ã¢â‚¬â€' }}</td>
                <td class="td-event">{{ t.event }}</td>
                <td class="td-actions-cell">
                  <button class="row-btn edit" @click="openItemEdit('timeline', t)" title="Edit"><i class="fas fa-pen"></i></button>
                  <button class="row-btn delete" @click="askDelete('timeline', t)" title="Delete"><i class="fas fa-trash"></i></button>
                </td>
              </tr>
              <tr v-if="timeline.length === 0"><td colspan="5" class="empty-row"><i class="fas fa-timeline"></i> No timeline entries yet.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Ã¢â€¢ÂÃ¢â€¢Â GALLERY PANEL Ã¢â€¢ÂÃ¢â€¢Â -->
      <div class="panel">
        <div class="panel-head-row">
          <div class="pt-left"><i class="fas fa-images"></i><div><span class="pt-title">Historical Gallery</span><span class="pt-sub">{{ gallery.length }} item(s)</span></div></div>
          <button class="add-btn" @click="openItemAdd('gallery')"><i class="fas fa-plus"></i> Add Item</button>
        </div>
        <div class="gal-grid">
          <div v-for="(g, i) in gallery" :key="g.id" class="gal-card">
            <div class="gal-img">
              <img v-if="g.image" :src="g.image" :alt="g.title" />
              <i v-else class="fas fa-image"></i>
            </div>
            <div class="gal-body">
              <span class="gal-year">{{ g.year || 'Ã¢â‚¬â€' }}</span>
              <h4>{{ g.title }}</h4>
              <p>{{ g.description || 'Ã¢â‚¬â€' }}</p>
            </div>
            <div class="gal-actions">
              <button class="ord-btn mat-skeuo-sm mat-pressable-sm" :disabled="reordering === 'gallery' || i === 0" @click="moveItem('gallery', i, -1)" title="Move up"><i class="fas fa-arrow-up"></i></button>
              <button class="ord-btn mat-skeuo-sm mat-pressable-sm" :disabled="reordering === 'gallery' || i === gallery.length - 1" @click="moveItem('gallery', i, 1)" title="Move down"><i class="fas fa-arrow-down"></i></button>
              <button class="row-btn edit" @click="openItemEdit('gallery', g)" title="Edit"><i class="fas fa-pen"></i></button>
              <button class="row-btn delete" @click="askDelete('gallery', g)" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
          </div>
          <div v-if="gallery.length === 0" class="gal-empty"><i class="fas fa-images"></i> No gallery items yet.</div>
        </div>
      </div>
    </template>

    <!-- Ã¢â€¢ÂÃ¢â€¢Â ITEM POP-UP MODAL (was a side drawer) Ã¢â€¢ÂÃ¢â€¢Â -->
    <Transition name="pop">
      <div v-if="drawer.open" class="im-overlay" @click.self="closeDrawer">
        <div class="item-modal mat-glass-strong" role="dialog" aria-modal="true" :aria-label="modalTitle">
          <div class="im-head">
            <div class="im-head-icon">
              <i class="fas" :class="drawer.section === 'timeline' ? 'fa-timeline' : 'fa-images'"></i>
            </div>
            <div class="im-head-text">
              <span class="im-kicker">{{ modalKicker }}</span>
              <h3 class="im-title">{{ modalTitle }}</h3>
            </div>
            <button class="im-close mat-skeuo-sm mat-pressable-sm" @click="closeDrawer" aria-label="Close"><i class="fas fa-xmark"></i></button>
          </div>

          <div class="im-body">
            <Transition name="msg"><div v-if="itemForm._err" class="toast error"><i class="fas fa-circle-exclamation"></i> {{ itemForm._err }}</div></Transition>

            <template v-if="drawer.section === 'timeline'">
              <div class="im-grid">
                <div class="fg"><label>Year <span class="req">*</span></label><input v-model="itemForm.year" maxlength="50" placeholder="e.g. 1575 or Today" /></div>
                <div class="fg"><label>Label</label><input v-model="itemForm.label" maxlength="100" placeholder="e.g. The Capital" /></div>
              </div>
              <div class="fg"><label>Event <span class="req">*</span></label><input v-model="itemForm.event" maxlength="255" placeholder="Short headline for this entry" /></div>
              <div class="fg"><label>Detail</label><textarea v-model="itemForm.detail" rows="6" placeholder="Fuller story shown under the event..."></textarea></div>
            </template>
            <template v-else>
              <div class="img-upload-row">
                <div class="img-thumb"><img v-if="itemPreview" :src="itemPreview" alt="" /><i v-else class="fas fa-image"></i></div>
                <div class="img-upload" @click="$refs.itemImgInput.click()">
                  <input ref="itemImgInput" type="file" accept="image/png,image/jpeg,image/jpg,image/webp" class="hidden-input" @change="onItemImageChange" />
                  <i class="fas fa-cloud-arrow-up"></i>
                  <span>{{ itemFile ? itemFile.name : 'Click to upload image (5MB max)' }}</span>
                </div>
              </div>
              <div class="im-grid">
                <div class="fg"><label>Title <span class="req">*</span></label><input v-model="itemForm.title" maxlength="255" placeholder="e.g. Old Municipal Hall" /></div>
                <div class="fg"><label>Year</label><input v-model="itemForm.year" maxlength="50" placeholder="e.g. c. 1900s" /></div>
              </div>
              <div class="fg"><label>Description</label><textarea v-model="itemForm.description" rows="4" placeholder="Caption shown under the card..."></textarea></div>
            </template>
          </div>

          <div class="im-foot">
            <button class="btn-cancel mat-skeuo-sm mat-pressable-danger" @click="closeDrawer"><i class="fas fa-xmark"></i> Cancel</button>
            <button class="btn-save mat-skeuo-filled mat-pressable-filled" @click="requestSaveItem" :disabled="itemSaving">
              <i class="fas fa-check"></i> {{ drawer.mode === 'add' ? 'Add Entry' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Ã¢â€¢ÂÃ¢â€¢Â DELETE MODAL Ã¢â€¢ÂÃ¢â€¢Â -->
    <Transition name="fade">
      <div v-if="deleteTarget" class="modal-overlay" @click.self="cancelDelete">
        <div class="modal-box mat-glass-strong">
          <div class="modal-icon"><i class="fas fa-triangle-exclamation"></i></div>
          <h3>Delete this item?</h3>
          <p>Are you sure you want to delete <strong>{{ deleteTarget.label }}</strong>? This action cannot be undone.</p>
          <div class="modal-actions">
            <button class="btn-cancel mat-skeuo-sm mat-pressable-danger" @click="cancelDelete">Cancel</button>
            <button class="btn-danger mat-skeuo-sm mat-pressable-danger" @click="executeDelete"><i class="fas fa-trash"></i> Delete</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Ã¢â€¢ÂÃ¢â€¢Â SAVE CONFIRMATION MODAL Ã¢â€¢ÂÃ¢â€¢Â -->
    <Transition name="fade">
      <div v-if="showSaveConfirm" class="modal-overlay" @click.self="cancelSaveConfirm">
        <div class="modal-box mat-glass-strong">
          <div class="modal-icon save"><i class="fas fa-circle-question"></i></div>
          <h3>{{ confirmTitle }}</h3>
          <p>{{ confirmSubtitle }}</p>
          <div v-if="confirmDiff.length" class="diff-list">
            <div v-for="d in confirmDiff" :key="d.label" class="diff-row">
              <span class="diff-label">{{ d.label }}</span>
              <div class="diff-values">
                <span class="diff-from">{{ d.from || 'Ã¢â‚¬â€' }}</span>
                <i class="fas fa-arrow-right-long diff-arrow"></i>
                <span class="diff-to">{{ d.to || 'Ã¢â‚¬â€' }}</span>
              </div>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-cancel mat-skeuo-sm mat-pressable-danger" @click="cancelSaveConfirm">Cancel</button>
            <button class="btn-save mat-skeuo-filled mat-pressable-filled" :disabled="confirmDisabled" @click="confirmSave"><i class="fas fa-check"></i> {{ confirmButtonText }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.history-manager { padding: 28px; font-family: var(--font-body); background: var(--bg); min-height: 100%; }
.mod-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.mh-left { display: flex; align-items: center; gap: 14px; }
.mh-left > i { font-size: 1.8rem; color: var(--ac); }
.mh-left h2 { margin: 0; font-family: var(--font-display); font-size: 1.4rem; color: var(--fg); font-weight: 700; }
.mh-left p { margin: 3px 0 0; font-size: 0.82rem; color: var(--mt); }

.panel { background: var(--card-solid); border: 1px solid var(--bdr); border-left: 3px solid var(--ac); border-radius: var(--r-md); margin-bottom: 20px; overflow: hidden; }
.panel-toggle, .panel-head-row { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 18px; background: var(--bg2); border: none; text-align: left; font-family: var(--font-body); }
button.panel-toggle { cursor: pointer; transition: background 0.15s; }
button.panel-toggle:hover { background: var(--card3); }
.pt-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.pt-left > i { color: var(--ac); font-size: 1.1rem; flex-shrink: 0; }
.pt-title { display: block; font-size: 0.9rem; font-weight: 700; color: var(--fg); }
.pt-sub { display: block; font-size: 0.72rem; color: var(--mt); margin-top: 2px; }
.pt-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.dirty-badge { font-size: 0.68rem; font-weight: 700; display: flex; align-items: center; gap: 5px; }
.dirty-badge i { font-size: 0.4rem; }
.pt-chev { color: var(--mt); transition: transform 0.25s var(--ease); }
.pt-chev.rotated { transform: rotate(180deg); }
.panel-body { padding: 18px; border-top: 1px solid var(--bdr); }
.panel-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--bdr); }

.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.fg { display: flex; flex-direction: column; gap: 5px; min-width: 0; margin-bottom: 4px; }
.fg.full { grid-column: 1 / -1; }
.fg label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--mt); }
.fg input, .fg textarea { padding: 9px 12px; border: 1px solid var(--bdr); border-radius: var(--r-sm); font-family: var(--font-body); font-size: 0.85rem; color: var(--fg); background: var(--bg2); transition: border-color 0.15s; }
.fg input:focus, .fg textarea:focus { outline: none; border-color: var(--ac); background: var(--bg3); box-shadow: 0 0 0 3px var(--acs); }
.fg textarea { resize: vertical; }
.hint { font-size: 0.68rem; color: var(--mt2); line-height: 1.4; }
.req { color: var(--dg); }
.mini-add { float: right; padding: 2px 8px; border-radius: var(--r-sm); font-size: 0.64rem; font-weight: 700; cursor: pointer; font-family: var(--font-body); }
.mini-add:hover { background: var(--acs2); }
.fact-row { display: grid; grid-template-columns: 1fr 1.6fr auto; gap: 8px; margin-bottom: 6px; }
.fact-remove { width: 34px; border-radius: var(--r-sm); cursor: pointer; }
.fact-remove:hover { color: var(--dg); border-color: var(--dg); }

.img-upload-row { display: flex; gap: 12px; align-items: stretch; margin-bottom: 12px; }
.img-thumb { width: 84px; height: 84px; border-radius: var(--r-sm); overflow: hidden; background: var(--bg2); border: 2px solid var(--bdr2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.img-thumb img { width: 100%; height: 100%; object-fit: cover; }
.img-thumb i { color: var(--mt); font-size: 1.3rem; }
.img-upload { flex: 1; display: flex; align-items: center; gap: 10px; padding: 12px 16px; border: 2px dashed var(--bdr2); border-radius: var(--r-sm); cursor: pointer; position: relative; background: var(--bg2); }
.img-upload:hover { border-color: var(--ac); background: var(--acs); }
.img-upload i { color: var(--mt); }
.img-upload span { font-size: 0.84rem; color: var(--mt); }
.hidden-input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

.table-wrap { background: var(--card-solid); border: 1px solid var(--bdr); border-radius: var(--r-md); overflow: hidden; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table thead { background: var(--bg2); border-bottom: 1px solid var(--bdr); }
.data-table th { padding: 12px 16px; text-align: left; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--mt); white-space: nowrap; }
.data-table td { padding: 11px 16px; border-bottom: 1px solid var(--bdr); font-size: 0.85rem; color: var(--fg2); vertical-align: middle; }
.data-row:hover { background: var(--card2); }
.w-order { width: 90px; } .w-actions { width: 100px; }
.td-order { white-space: nowrap; }
.td-year { font-weight: 700; color: var(--ac); font-variant-numeric: tabular-nums; }
.td-event { max-width: 420px; }
.td-actions-cell { display: flex; gap: 4px; align-items: center; }
.ord-btn { width: 28px; height: 28px; border-radius: var(--r-sm); cursor: pointer; font-size: 0.7rem; }
.ord-btn:hover:not(:disabled) { color: var(--ac); border-color: var(--ac); }
.ord-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.row-btn { width: 32px; height: 32px; border: 1px solid var(--bdr); border-radius: var(--r-sm); background: var(--bg2); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 0.78rem; color: var(--mt); transition: all 0.15s; }
.row-btn.edit:hover { background: var(--m-accent-solid); color: white; border-color: var(--m-accent-solid); }
.row-btn.delete:hover { background: var(--dg-solid); color: white; border-color: var(--dg-solid); }
.empty-row { text-align: center; padding: 36px 20px !important; color: var(--mt); }
.empty-row i { margin-right: 6px; }

.gal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
.gal-card { background: var(--card-solid); border: 1px solid var(--bdr); border-radius: var(--r-md); overflow: hidden; display: flex; flex-direction: column; }
.gal-img { aspect-ratio: 4 / 3; background: var(--bg2); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.gal-img img { width: 100%; height: 100%; object-fit: cover; }
.gal-img i { color: var(--mt2); font-size: 1.8rem; }
.gal-body { padding: 12px 14px 6px; flex: 1; }
.gal-year { font-size: 0.64rem; font-weight: 700; color: var(--ac); letter-spacing: 0.08em; }
.gal-body h4 { margin: 4px 0 4px; font-size: 0.88rem; color: var(--fg); }
.gal-body p { margin: 0; font-size: 0.74rem; color: var(--mt); line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.gal-actions { display: flex; gap: 4px; padding: 10px 12px; border-top: 1px solid var(--bdr); margin-top: 8px; }
.gal-empty { grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--mt); background: var(--card-solid); border: 1px dashed var(--bdr2); border-radius: var(--r-md); }

/* Ã¢â€¢ÂÃ¢â€¢Â ITEM POP-UP MODAL (CHANGED: replaces the old side drawer) Ã¢â€¢ÂÃ¢â€¢Â */
.im-overlay {
  position: fixed; inset: 0; z-index: 1100;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: clamp(16px, 4vw, 32px);
}
.item-modal { width: 100%; max-width: 560px; max-height: 90dvh; border-radius: var(--r-lg); display: flex; flex-direction: column; overflow: hidden; }
.im-head {
  display: flex; align-items: center; gap: 14px;
  padding: 18px 22px;
  background: var(--bg2);
  border-bottom: 1px solid var(--bdr);
  flex-shrink: 0;
}
.im-head-icon {
  width: 42px; height: 42px; flex-shrink: 0;
  border-radius: var(--r-md);
  background: var(--acs);
  border: 1px solid var(--acs2);
  display: flex; align-items: center; justify-content: center;
  color: var(--ac); font-size: 1.05rem;
}
.im-head-text { flex: 1; min-width: 0; }
.im-kicker {
  display: block;
  font-size: 0.6rem; font-weight: 800;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--ac);
  margin-bottom: 3px;
}
.im-title { margin: 0; font-family: var(--font-display); font-size: 1.05rem; font-weight: 700; color: var(--fg); }
.im-close { width: 34px; height: 34px; flex-shrink: 0; border-radius: var(--r-sm); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; }
.im-close:hover { background: var(--dgs); color: var(--dg); border-color: var(--dg); transform: rotate(90deg); }

.im-body {
  flex: 1; min-height: 0;
  overflow-y: auto;
  padding: 22px;
}
.im-body .fg { margin-bottom: 14px; }
.im-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.im-grid .fg { margin-bottom: 14px; }

.im-foot {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 16px 22px;
  background: var(--bg2);
  border-top: 1px solid var(--bdr);
  flex-shrink: 0;
}

/* pop transition Ã¢â‚¬â€ spring-in scale + fade */
.pop-enter-active { transition: opacity 0.25s ease; }
.pop-leave-active { transition: opacity 0.18s ease; }
.pop-enter-from, .pop-leave-to { opacity: 0; }
.pop-enter-active .item-modal { transition: transform 0.32s var(--ease), opacity 0.25s ease; }
.pop-leave-active .item-modal { transition: transform 0.18s ease, opacity 0.15s ease; }
.pop-enter-from .item-modal { transform: translateY(22px) scale(0.95); opacity: 0; }
.pop-leave-to .item-modal { transform: translateY(12px) scale(0.98); opacity: 0; }

.btn-cancel { padding: 9px 18px; font-size: 0.82rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; border-radius: var(--r-sm); font-family: var(--font-body); }
.btn-cancel:hover { background: var(--card3); border-color: var(--bdr2); color: var(--fg); }
.btn-save { padding: 9px 18px; font-size: 0.82rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; border-radius: var(--r-sm); font-family: var(--font-body); }
.btn-save:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px var(--acg); }
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-danger { padding: 9px 18px; font-size: 0.82rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; border-radius: var(--r-sm); font-family: var(--font-body); }
.btn-danger:hover { background: #ff5570; }

.toast { padding: 10px 14px; display: flex; align-items: center; gap: 8px; font-size: 0.82rem; font-weight: 500; margin-bottom: 14px; border-radius: var(--r-sm); }
.toast.success { background: var(--oks); color: var(--ok); border: 1px solid var(--okg); }
.toast.error { background: var(--dgs); color: var(--dg); border: 1px solid var(--dgg); }
.state-box { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 20px; color: var(--mt); background: var(--card-solid); border: 1px solid var(--bdr); border-radius: var(--r-md); }
.state-box i { font-size: 2.2rem; margin-bottom: 14px; }
.state-box.error i { color: var(--dg); }
.retry-btn { margin-top: 14px; padding: 9px 18px; border-radius: var(--r-sm); font-size: 0.82rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: var(--font-body); }

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

.fade-enter-active, .fade-leave-active { transition: opacity 0.22s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.msg-enter-active, .msg-leave-active { transition: all 0.22s ease; }
.msg-enter-from, .msg-leave-to { opacity: 0; transform: translateY(-6px); }
.collapse-enter-active, .collapse-leave-active { transition: all 0.25s ease; overflow: hidden; }
.collapse-enter-from, .collapse-leave-to { opacity: 0; transform: translateY(-8px); }
@media (max-width: 640px) {
  .im-grid { grid-template-columns: 1fr; }
  .im-body { padding: 18px; }
  .im-head { padding: 14px 16px; }
  .im-foot { padding: 14px 16px; }
}
@media (max-width: 900px) {
  .grid { grid-template-columns: 1fr; }
  .data-table { min-width: 600px; }
  .table-wrap { overflow-x: auto; }
  .fact-row { grid-template-columns: 1fr; }
}

</style>