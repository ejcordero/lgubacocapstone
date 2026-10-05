<script setup>
import { ref, computed, onMounted } from 'vue'
import { handleAdminAuthError } from '../../../utils/adminAuth'
import { API } from '@/api'

const API_BASE = API
// ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ LOG ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Content change logger (client-side, for barangay CRUD)
const logChange = async (section, entityId, entityTitle, action, changes) => {
  const token = localStorage.getItem('baco_admin_token')
  if (!token) return
  try {
    await fetch(`${API_BASE}/admin/content-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ section, entityId: String(entityId || ''), entityTitle, action, changes })
    })
  } catch (e) { console.error('Log error:', e) }
}

const barangays = ref([])
const search = ref('')
const areaFilter = ref('All')
const sortField = ref('name')
const sortDir = ref('asc')
const loading = ref(true)
const fetchError = ref(null)
const successMsg = ref('')
const errorMsg = ref('')
const isDrawerOpen = ref(false)
const drawerMode = ref('edit')
const selectedId = ref(null)
const saving = ref(false)
const form = ref({
  name: '', lat: '', lng: '', population: '', elevation: '',
  area_type: 'Lowland', overview: '', sealImage: null
})
const sealPreview = ref(null)
const deleteTarget = ref(null)
const showDeleteModal = ref(false)
// ÃƒÂ°Ã…Â¸Ã¢â‚¬Å“Ã¢â‚¬Â¹ LOG ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â stores original values for diff tracking
const originalForm = ref(null)
const getToken = () => localStorage.getItem('baco_admin_token') || ''

// ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
// MUNICIPALITY PAGE CONTENT
// Edits the "Barangays in Baco" MAP + INFO panel on the public
// Municipality page. Read via GET /municipality-settings,
// saved via PUT /admin/municipality-settings (audit-logged
// server-side ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no client logChange needed here).
// ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
const CONTENT_FIELDS = ['heading', 'body', 'about', 'totalArea']
const pageContent = ref({ heading: '', body: '', about: '', totalArea: '' })
const pageOriginal = ref(null)
const pageLoading = ref(true)
const pageSaving = ref(false)
const pageError = ref('')
const pageSuccess = ref('')
const contentPanelOpen = ref(true)

const isContentDirty = computed(() => {
  if (!pageOriginal.value) return false
  return CONTENT_FIELDS.some(k => String(pageContent.value[k] ?? '') !== String(pageOriginal.value[k] ?? ''))
})

const fetchPageContent = async () => {
  pageLoading.value = true
  pageError.value = ''
  try {
    const res = await fetch(`${API_BASE}/municipality-settings`, { cache: 'no-store' })
    if (!res.ok) {
      if (handleAdminAuthError(res)) return
      throw new Error('Failed to load page content.')
    }
    const data = await res.json()
    pageContent.value = {
      heading: data.heading || '',
      body: data.body || '',
      about: data.about || '',
      totalArea: data.totalArea || ''
    }
    pageOriginal.value = JSON.parse(JSON.stringify(pageContent.value))
  } catch (err) {
    pageError.value = err.message || 'Failed to load page content.'
  } finally {
    pageLoading.value = false
  }
}

const savePageContent = async () => {
  if (!String(pageContent.value.heading || '').trim()) {
    pageError.value = 'Heading is required.'
    return
  }
  const token = getToken()
  if (!token) { pageError.value = 'Authentication required. Please log in.'; return }
  pageSaving.value = true
  pageError.value = ''
  pageSuccess.value = ''
  try {
    const res = await fetch(`${API_BASE}/admin/municipality-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        heading: pageContent.value.heading,
        body: pageContent.value.body,
        about: pageContent.value.about,
        totalArea: pageContent.value.totalArea
      })
    })
    const data = await res.json()
    if (!res.ok) {
      if (handleAdminAuthError(res)) return
      throw new Error(data.message || data.error || 'Save failed.')
    }
    if (data.content) {
      pageContent.value = {
        heading: data.content.heading || '',
        body: data.content.body || '',
        about: data.content.about || '',
        totalArea: data.content.totalArea || ''
      }
    }
    pageOriginal.value = JSON.parse(JSON.stringify(pageContent.value))
    pageSuccess.value = 'Municipality page content saved! Changes are now live on the public site.'
    setTimeout(() => { pageSuccess.value = '' }, 4000)
  } catch (err) {
    pageError.value = err.message
  } finally {
    pageSaving.value = false
  }
}

const discardPageContent = () => {
  if (!pageOriginal.value) return
  pageContent.value = JSON.parse(JSON.stringify(pageOriginal.value))
  pageError.value = ''
}

// ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Barangay CRUD (unchanged logic) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
const areaCounts = computed(() => {
  const c = { All: barangays.value.length, Lowland: 0, Coastal: 0, Upland: 0 }
  barangays.value.forEach(b => { if (c[b.area_type] !== undefined) c[b.area_type]++ })
  return c
})
const filteredBarangays = computed(() => {
  let list = [...barangays.value]
  if (areaFilter.value !== 'All') list = list.filter(b => b.area_type === areaFilter.value)
  if (search.value) {
    const s = search.value.toLowerCase()
    list = list.filter(b => b.name.toLowerCase().includes(s))
  }
  list.sort((a, b) => {
    let va = a[sortField.value], vb = b[sortField.value]
    if (va == null) va = ''
    if (vb == null) vb = ''
    if (typeof va === 'string') va = va.toLowerCase()
    if (typeof vb === 'string') vb = vb.toLowerCase()
    const na = parseFloat(va), nb = parseFloat(vb)
    if (!isNaN(na) && !isNaN(nb)) { va = na; vb = nb }
    if (va < vb) return sortDir.value === 'asc' ? -1 : 1
    if (va > vb) return sortDir.value === 'asc' ? 1 : -1
    return 0
  })
  return list
})
const fetchBarangays = async () => {
  loading.value = true
  fetchError.value = null
  try {
    const token = getToken()
    const headers = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${API_BASE}/admin/barangays`, { headers })
    if (!res.ok) {
      if (handleAdminAuthError(res)) return
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `HTTP ${res.status}: Failed to fetch`)
    }
    barangays.value = await res.json()
  } catch (err) {
    fetchError.value = err.message || 'Failed to load barangays.'
    console.error('fetchBarangays error:', err)
  } finally {
    loading.value = false
  }
}
const toggleSort = (field) => {
  if (sortField.value === field) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else { sortField.value = field; sortDir.value = 'asc' }
}
const sortIcon = (field) => {
  if (sortField.value !== field) return 'fa-sort'
  return sortDir.value === 'asc' ? 'fa-sort-up' : 'fa-sort-down'
}
const setSealPreview = (value) => {
  // Revoke previous blob URL to avoid memory leaks
  if (sealPreview.value && sealPreview.value.startsWith('blob:')) URL.revokeObjectURL(sealPreview.value)
  sealPreview.value = value
}
const openEdit = (brgy) => {
  selectedId.value = brgy.id
  drawerMode.value = 'edit'
  originalForm.value = {
    name: brgy.name, lat: brgy.lat, lng: brgy.lng,
    population: brgy.population, elevation: brgy.elevation,
    area_type: brgy.area_type, overview: brgy.overview || ''
  }
  form.value = {
    name: brgy.name, lat: brgy.lat, lng: brgy.lng,
    population: brgy.population, elevation: brgy.elevation,
    area_type: brgy.area_type, overview: brgy.overview || '', sealImage: null
  }
  setSealPreview(brgy.seal_image ? `/BACO- 27 BARANGAYS_ SEALS/${brgy.seal_image}` : null)
  errorMsg.value = ''
  successMsg.value = ''
  isDrawerOpen.value = true
}
const openAdd = () => {
  selectedId.value = null
  drawerMode.value = 'add'
  originalForm.value = null
  form.value = { name: '', lat: '', lng: '', population: '', elevation: '', area_type: 'Lowland', overview: '', sealImage: null }
  setSealPreview(null)
  errorMsg.value = ''
  successMsg.value = ''
  isDrawerOpen.value = true
}
const closeDrawer = () => {
  isDrawerOpen.value = false
  setSealPreview(null)
}
const onSealChange = (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) { errorMsg.value = 'Only PNG and JPG allowed.'; e.target.value = ''; return }
  if (file.size > 5 * 1024 * 1024) { errorMsg.value = 'Image size must be less than 5MB.'; e.target.value = ''; return }
  form.value.sealImage = file
  setSealPreview(URL.createObjectURL(file))
  errorMsg.value = ''
}
const save = async () => {
  if (!form.value.name) { errorMsg.value = 'Name is required.'; return }
  const token = getToken()
  if (!token) { errorMsg.value = 'Authentication required. Please log in.'; return }
  saving.value = true
  errorMsg.value = ''
  successMsg.value = ''
  const fd = new FormData()
  fd.append('name', form.value.name)
  fd.append('lat', form.value.lat || '0')
  fd.append('lng', form.value.lng || '0')
  fd.append('population', form.value.population || '0')
  fd.append('elevation', form.value.elevation || '0')
  fd.append('area_type', form.value.area_type)
  fd.append('overview', form.value.overview || '')
  if (form.value.sealImage) fd.append('sealImage', form.value.sealImage)
  try {
    const isAdd = drawerMode.value === 'add'
    const url = isAdd ? `${API_BASE}/admin/barangays` : `${API_BASE}/admin/barangays/${selectedId.value}`
    const res = await fetch(url, { method: isAdd ? 'POST' : 'PUT', headers: { 'Authorization': `Bearer ${token}` }, body: fd })
    const data = await res.json()
    if (!res.ok) {
      if (handleAdminAuthError(res)) return
      throw new Error(data.error || 'Save failed')
    }
    if (isAdd) {
      await logChange('barangays', data.id, form.value.name, 'create', {
        name: { new: form.value.name }, lat: { new: form.value.lat || '0' }, lng: { new: form.value.lng || '0' },
        population: { new: form.value.population || '0' }, elevation: { new: form.value.elevation || '0' },
        area_type: { new: form.value.area_type }
      })
    } else {
      const orig = originalForm.value || {}
      const changes = {}
      if (form.value.name !== orig.name) changes.name = { old: orig.name, new: form.value.name }
      if (String(form.value.lat) !== String(orig.lat)) changes.lat = { old: orig.lat, new: form.value.lat || '0' }
      if (String(form.value.lng) !== String(orig.lng)) changes.lng = { old: orig.lng, new: form.value.lng || '0' }
      if (String(form.value.population) !== String(orig.population)) changes.population = { old: orig.population, new: form.value.population || '0' }
      if (String(form.value.elevation) !== String(orig.elevation)) changes.elevation = { old: orig.elevation, new: form.value.elevation || '0' }
      if (form.value.area_type !== orig.area_type) changes.area_type = { old: orig.area_type, new: form.value.area_type }
      if (form.value.overview !== orig.overview) changes.overview = { old: (orig.overview || '').substring(0, 80) + '...', new: (form.value.overview || '').substring(0, 80) + '...' }
      if (form.value.sealImage) changes.seal_image = { new: form.value.sealImage.name }
      if (Object.keys(changes).length > 0) await logChange('barangays', selectedId.value, form.value.name, 'update', changes)
    }
    successMsg.value = isAdd ? `${form.value.name} added!` : `${form.value.name} updated!`
    await fetchBarangays()
    if (!isAdd) {
      const u = barangays.value.find(b => b.id === selectedId.value)
      if (u) openEdit(u)
    } else { closeDrawer() }
    setTimeout(() => { successMsg.value = '' }, 3000)
  } catch (err) { errorMsg.value = err.message }
  finally { saving.value = false }
}
const confirmDelete = (brgy) => { deleteTarget.value = brgy; showDeleteModal.value = true }
const cancelDelete = () => { deleteTarget.value = null; showDeleteModal.value = false }
const executeDelete = async () => {
  if (!deleteTarget.value) return
  const token = getToken()
  if (!token) { errorMsg.value = 'Authentication required.'; return }
  try {
    const res = await fetch(`${API_BASE}/admin/barangays/${deleteTarget.value.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } })
    if (!res.ok) {
      if (handleAdminAuthError(res)) return
      const errData = await res.json().catch(() => ({})); throw new Error(errData.error || 'Delete failed')
    }
    await logChange('barangays', deleteTarget.value.id, deleteTarget.value.name, 'delete', null)
    if (selectedId.value === deleteTarget.value.id) closeDrawer()
    await fetchBarangays()
    cancelDelete()
  } catch (err) { errorMsg.value = err.message }
}
const getAreaColor = (area) => {
  if (area === 'Coastal') return 'var(--ac)'
  if (area === 'Upland') return '#2d6e2d'
  return 'var(--dg)'
}
const formatPop = (v) => { const n = parseInt(v); return isNaN(n) ? '0' : n.toLocaleString() }
onMounted(() => {
  fetchBarangays()
  fetchPageContent()
})
</script>

<template>
  <div class="brgy-manager">
    <!-- HEADER -->
    <div class="mod-header">
      <div class="mh-left">
        <i class="fas fa-map"></i>
        <div>
          <h2>Barangay Management</h2>
          <p>Edit, add, and manage all 27 barangays of Baco</p>
        </div>
      </div>
    </div>

    <!-- ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â MUNICIPALITY PAGE CONTENT (edits the MAP + INFO panel on the public Municipality page) ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â -->
    <div class="content-editor">
      <button class="ce-toggle" @click="contentPanelOpen = !contentPanelOpen">
        <div class="ce-toggle-left">
          <i class="fas fa-file-pen"></i>
          <div class="ce-toggle-text">
            <span class="ce-title">Municipality Page Content</span>
            <span class="ce-sub">Edits the "Barangays in Baco" MAP + INFO panel on the public Municipality page</span>
          </div>
        </div>
        <div class="ce-toggle-right">
          <span v-if="isContentDirty" class="ce-dirty-badge mat-well"><i class="fas fa-circle"></i> Unsaved changes</span>
          <i class="fas fa-chevron-down ce-chevron" :class="{ rotated: contentPanelOpen }"></i>
        </div>
      </button>

      <Transition name="collapse">
        <div v-if="contentPanelOpen" class="ce-body">
          <Transition name="msg"><div v-if="pageSuccess" class="toast success"><i class="fas fa-circle-check"></i> {{ pageSuccess }}</div></Transition>
          <Transition name="msg"><div v-if="pageError" class="toast error"><i class="fas fa-circle-exclamation"></i> {{ pageError }}</div></Transition>

          <div v-if="pageLoading" class="ce-loading"><i class="fas fa-spinner fa-spin"></i> Loading current content...</div>

          <template v-else>
            <div class="ce-grid">
              <div class="fg full">
                <label>Panel Heading <span class="req">*</span> <span class="char-count">{{ (pageContent.heading || '').length }}/200</span></label>
                <textarea v-model="pageContent.heading" rows="2" maxlength="200" placeholder="Barangays&#10;in Baco"></textarea>
                <span class="hint">Press Enter for a line break ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â it renders on two lines, like "Barangays / in Baco".</span>
              </div>
              <div class="fg">
                <label>Total Area <span class="char-count">{{ (pageContent.totalArea || '').length }}/100</span></label>
                <input v-model="pageContent.totalArea" type="text" maxlength="100" placeholder="216 kmÃƒâ€šÃ‚Â²" />
                <span class="hint">Shown in the stats row and the hero pill (numbers only for the pill).</span>
              </div>
              <div class="fg">
                <label>Map Description <span class="char-count">{{ (pageContent.body || '').length }}/2000</span></label>
                <textarea v-model="pageContent.body" rows="4" maxlength="2000" placeholder="Locate and explore the barangays, landmarks, and communities of Baco..."></textarea>
                <span class="hint">The short paragraph under the heading.</span>
              </div>
              <div class="fg full">
                <label>About Baco Text <span class="char-count">{{ (pageContent.about || '').length }}/10000</span></label>
                <textarea v-model="pageContent.about" rows="6" maxlength="10000" placeholder="The Municipality of Baco is a 1st class municipality..."></textarea>
                <span class="hint">Separate paragraphs with one blank line.</span>
              </div>
            </div>
            <div class="ce-actions">
              <button v-if="isContentDirty" class="btn-cancel mat-skeuo-sm mat-pressable-danger" @click="discardPageContent"><i class="fas fa-rotate-left"></i> Discard Changes</button>
              <button class="btn-save mat-skeuo-filled mat-pressable-filled" @click="savePageContent" :disabled="pageSaving || !isContentDirty">
                <i class="fas fa-check"></i> {{ pageSaving ? 'Saving...' : 'Save Page Content' }}
              </button>
            </div>
          </template>
        </div>
      </Transition>
    </div>

    <!-- TOOLBAR -->
    <div class="toolbar">
      <div class="tb-filters">
        <button v-for="(count, type) in areaCounts" :key="type" class="filter-pill mat-well" :class="{ active: areaFilter === type }" @click="areaFilter = type">
          {{ type }} ({{ count }})
        </button>
      </div>
      <div class="tb-right">
        <div class="tb-search">
          <i class="fas fa-search"></i>
          <input v-model="search" type="text" placeholder="Search barangay..." />
        </div>
        <button class="add-btn mat-skeuo-filled mat-pressable-filled" @click="openAdd">
          <i class="fas fa-plus"></i> Add Barangay
        </button>
      </div>
    </div>
    <!-- ERROR -->
    <div v-if="fetchError" class="state-box error">
      <i class="fas fa-exclamation-triangle"></i>
      <p>{{ fetchError }}</p>
      <button @click="fetchBarangays" class="retry-btn mat-skeuo-sm mat-pressable-sm"><i class="fas fa-rotate-right"></i> Retry</button>
    </div>
    <!-- TABLE -->
    <template v-else>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-seal">Seal</th>
              <th class="sortable" :class="{ sorted: sortField === 'name' }" @click="toggleSort('name')">Name <i class="fas" :class="sortIcon('name')"></i></th>
              <th class="sortable" :class="{ sorted: sortField === 'area_type' }" @click="toggleSort('area_type')">Area Type <i class="fas" :class="sortIcon('area_type')"></i></th>
              <th class="sortable" :class="{ sorted: sortField === 'population' }" @click="toggleSort('population')">Population <i class="fas" :class="sortIcon('population')"></i></th>
              <th class="sortable" :class="{ sorted: sortField === 'elevation' }" @click="toggleSort('elevation')">Elevation <i class="fas" :class="sortIcon('elevation')"></i></th>
              <th>Coordinates</th>
              <th class="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="brgy in filteredBarangays" :key="brgy.id" class="data-row" :class="{ selected: selectedId === brgy.id }" @click="openEdit(brgy)">
              <td class="td-seal">
                <div class="seal-circle">
                  <img v-if="brgy.seal_image" :src="`/BACO- 27 BARANGAYS_ SEALS/${brgy.seal_image}`" :alt="brgy.name" />
                  <i v-else class="fas fa-map-pin"></i>
                </div>
              </td>
              <td class="td-name">{{ brgy.name }}</td>
              <td>
                <span class="area-badge mat-well" :style="{ background: getAreaColor(brgy.area_type) }">{{ brgy.area_type }}</span>
              </td>
              <td class="td-num">{{ formatPop(brgy.population) }}</td>
              <td class="td-num">{{ brgy.elevation || 'ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â' }}<span v-if="brgy.elevation" class="unit">m</span></td>
              <td class="td-coords">
                <span v-if="brgy.lat && brgy.lng">{{ Number(brgy.lat).toFixed(4) }}, {{ Number(brgy.lng).toFixed(4) }}</span>
                <span v-else class="na">ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â</span>
              </td>
              <td class="td-actions">
                <button class="row-btn edit" @click.stop="openEdit(brgy)" title="Edit"><i class="fas fa-pen"></i></button>
                <button class="row-btn delete" @click.stop="confirmDelete(brgy)" title="Delete"><i class="fas fa-trash"></i></button>
              </td>
            </tr>
            <tr v-if="filteredBarangays.length === 0">
              <td colspan="7" class="empty-row"><i class="fas fa-search"></i> No barangays match your search.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="table-footer">Showing {{ filteredBarangays.length }} of {{ barangays.length }} barangays</div>
    </template>
    <!-- DRAWER OVERLAY -->
    <Transition name="fade">
      <div v-if="isDrawerOpen" class="drawer-overlay" @click="closeDrawer"></div>
    </Transition>
    <!-- DRAWER PANEL -->
    <Transition name="slide-right">
      <div v-if="isDrawerOpen" class="drawer-panel mat-glass-strong">
        <div class="drawer-head">
          <div class="dh-left">
            <i class="fas fa-map"></i>
            <span>{{ drawerMode === 'add' ? 'Add New Barangay' : 'Edit Barangay' }}</span>
          </div>
          <button class="dh-close mat-skeuo-sm mat-pressable-sm" @click="closeDrawer"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="drawer-body">
          <Transition name="msg"><div v-if="successMsg" class="toast success"><i class="fas fa-circle-check"></i> {{ successMsg }}</div></Transition>
          <Transition name="msg"><div v-if="errorMsg" class="toast error"><i class="fas fa-circle-exclamation"></i> {{ errorMsg }}</div></Transition>
          <div class="drawer-seal mat-glass-strong">
            <div class="ds-circle">
              <img v-if="sealPreview" :src="sealPreview" :alt="form.name" />
              <i v-else class="fas fa-map-pin"></i>
            </div>
            <span class="ds-label">{{ form.name || 'New Barangay' }}</span>
          </div>
          <div class="form-grid">
            <div class="fg full"><label>Barangay Name</label><input v-model="form.name" type="text" placeholder="e.g. Agos" /></div>
            <div class="fg"><label>Latitude</label><input v-model="form.lat" type="number" step="0.0000001" placeholder="13.3500" /></div>
            <div class="fg"><label>Longitude</label><input v-model="form.lng" type="number" step="0.0000001" placeholder="121.1000" /></div>
            <div class="fg"><label>Population</label><input v-model="form.population" type="number" placeholder="0" /></div>
            <div class="fg"><label>Elevation (m)</label><input v-model="form.elevation" type="number" step="0.1" placeholder="0.0" /></div>
            <div class="fg full">
              <label>Area Type</label>
              <div class="radio-group">
                <label class="radio-label" style="--c: var(--dg);" :class="{ active: form.area_type === 'Lowland' }" @click="form.area_type = 'Lowland'"><span class="radio-dot"></span> Lowland</label>
                <label class="radio-label" style="--c: var(--ac);" :class="{ active: form.area_type === 'Coastal' }" @click="form.area_type = 'Coastal'"><span class="radio-dot"></span> Coastal</label>
                <label class="radio-label" style="--c: var(--ok);" :class="{ active: form.area_type === 'Upland' }" @click="form.area_type = 'Upland'"><span class="radio-dot"></span> Upland</label>
              </div>
            </div>
            <div class="fg full"><label>Overview</label><textarea v-model="form.overview" rows="4" placeholder="Brief description of the barangay..."></textarea></div>
            <div class="fg full">
              <label>Seal Image</label>
              <div class="seal-upload" @click="$refs.sealInput.click()">
                <input ref="sealInput" type="file" accept="image/png,image/jpeg,image/jpg" class="hidden-input" @change="onSealChange" />
                <i class="fas fa-cloud-arrow-up"></i>
                <span>{{ form.sealImage ? form.sealImage.name : 'Click to upload seal image' }}</span>
              </div>
            </div>
          </div>
        </div>
       <div class="drawer-foot">
          <button class="btn-cancel mat-skeuo-sm mat-pressable-danger" @click="closeDrawer"><i class="fas fa-xmark"></i> Cancel</button>
          <button class="btn-save mat-skeuo-filled mat-pressable-filled" @click="save" :disabled="saving">
            <i class="fas fa-check"></i>
            {{ drawerMode === 'add' ? 'Add Barangay' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </Transition>
    <!-- DELETE MODAL -->
    <Transition name="fade">
      <div v-if="showDeleteModal" class="modal-overlay" @click.self="cancelDelete">
        <div class="modal-box mat-glass-strong">
          <div class="modal-icon"><i class="fas fa-triangle-exclamation"></i></div>
          <h3>Delete Barangay?</h3>
          <p>Are you sure you want to delete <strong>{{ deleteTarget?.name }}</strong>? This action cannot be undone.</p>
          <div class="modal-actions">
            <button class="btn-cancel mat-skeuo-sm mat-pressable-danger" @click="cancelDelete">Cancel</button>
            <button class="btn-danger mat-skeuo-sm mat-pressable-danger" @click="executeDelete"><i class="fas fa-trash"></i> Delete</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.brgy-manager { padding: 28px; font-family: var(--font-body); background: var(--bg); min-height: 100%; }
.mod-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.mh-left { display: flex; align-items: center; gap: 14px; }
.mh-left > i { font-size: 1.8rem; color: var(--ac); }
.mh-left h2 { margin: 0; font-family: var(--font-display); font-size: 1.4rem; color: var(--fg); font-weight: 700; }
.mh-left p { margin: 3px 0 0; font-size: 0.82rem; color: var(--mt); }

/* ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â MUNICIPALITY PAGE CONTENT panel ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â */
.content-editor { background: var(--card-solid); border: 1px solid var(--bdr); border-left: 3px solid var(--ac); border-radius: var(--r-md); margin-bottom: 20px; overflow: hidden; }
.ce-toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 18px; background: var(--bg2); border: none; cursor: pointer; text-align: left; font-family: var(--font-body); transition: background 0.15s; }
.ce-toggle:hover { background: var(--card3); }
.ce-toggle-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ce-toggle-left > i { color: var(--ac); font-size: 1.1rem; flex-shrink: 0; }
.ce-title { display: block; font-size: 0.9rem; font-weight: 700; color: var(--fg); }
.ce-sub { display: block; font-size: 0.72rem; color: var(--mt); margin-top: 2px; }
.ce-toggle-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.ce-dirty-badge { font-size: 0.68rem; font-weight: 700; display: flex; align-items: center; gap: 5px; }
.ce-dirty-badge i { font-size: 0.4rem; }
.ce-chevron { color: var(--mt); transition: transform 0.25s var(--ease); }
.ce-chevron.rotated { transform: rotate(180deg); }
.ce-body { padding: 18px; border-top: 1px solid var(--bdr); }
.ce-loading { display: flex; align-items: center; gap: 8px; color: var(--mt); font-size: 0.82rem; padding: 10px 0; }
.ce-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.ce-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--bdr); }
.char-count { float: right; font-size: 0.64rem; font-weight: 600; color: var(--mt2); }
.hint { font-size: 0.68rem; color: var(--mt2); line-height: 1.4; }
.req { color: var(--dg); }

.toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
.tb-filters { display: flex; gap: 6px; flex-wrap: wrap; }
.filter-pill { padding: 7px 14px; border-radius: var(--r-sm); font-family: var(--font-body); font-size: 0.78rem; font-weight: 600; cursor: pointer; }
.filter-pill:hover { border-color: var(--ac); color: var(--fg); }
.filter-pill.active { background-color: #191B1F; color: #EFF0EB; border-color: #191B1F; font-weight: 700; }
.tb-right { display: flex; align-items: center; gap: 10px; }
.tb-search { display: flex; align-items: center; gap: 8px; background: var(--bg2); border: 1px solid var(--bdr); border-radius: var(--r-sm); padding: 0 12px; }
.tb-search i { color: var(--mt); font-size: 0.85rem; }
.tb-search input { border: none; background: none; padding: 9px 0; font-family: var(--font-body); font-size: 0.84rem; color: var(--fg); outline: none; width: 180px; }
.tb-search input::placeholder { color: var(--mt2); }
.add-btn { display: flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: var(--r-sm); font-family: var(--font-body); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
.add-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px var(--acg); }
.state-box { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 20px; color: var(--mt); background: var(--card-solid); border: 1px solid var(--bdr); border-radius: var(--r-md); }
.state-box i { font-size: 2.2rem; margin-bottom: 14px; }
.state-box.error i { color: var(--dg); }
.state-box p { font-size: 0.88rem; margin: 0; }
.retry-btn { margin-top: 14px; padding: 9px 18px; border-radius: var(--r-sm); font-family: var(--font-body); font-size: 0.82rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
.retry-btn:hover { background: var(--ac2); transform: translateY(-2px); }
.table-wrap { background: var(--card-solid); border: 1px solid var(--bdr); border-radius: var(--r-md); overflow: hidden; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table thead { background: var(--bg2); border-bottom: 1px solid var(--bdr); }
.data-table th { padding: 12px 16px; text-align: left; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--mt); white-space: nowrap; }
.data-table th.sortable { cursor: pointer; user-select: none; transition: color 0.15s; }
.data-table th.sortable:hover { color: var(--fg); }
.data-table th.sorted { color: var(--ac); }
.data-table th i { margin-left: 5px; font-size: 0.65rem; opacity: 0.6; }
.data-table th.sorted i { opacity: 1; }
.data-table td { padding: 12px 16px; border-bottom: 1px solid var(--bdr); font-size: 0.85rem; color: var(--fg2); vertical-align: middle; }
.data-row { cursor: pointer; transition: background 0.12s; }
.data-row:hover { background: var(--card2); }
.data-row.selected { background: var(--acs); border-left: 3px solid var(--ac); }
.col-seal { width: 52px; }
.col-actions { width: 100px; }
.td-seal { padding: 8px 16px; }
.seal-circle { width: 36px; height: 36px; border-radius: 50%; overflow: hidden; background: var(--bg2); border: 2px solid var(--bdr2); display: flex; align-items: center; justify-content: center; }
.seal-circle img { width: 100%; height: 100%; object-fit: cover; }
.seal-circle i { color: var(--mt); font-size: 0.85rem; }
.td-name { font-weight: 600; color: var(--fg); }
.area-badge { display: inline-block; padding: 3px 10px; border-radius: var(--r-sm); font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.td-num { font-variant-numeric: tabular-nums; }
.unit { font-size: 0.72rem; color: var(--mt); margin-left: 2px; }
.td-coords { font-size: 0.78rem; color: var(--mt); font-variant-numeric: tabular-nums; }
.na { color: var(--mt2); }
.td-actions { padding: 8px 12px; display: flex; align-items: center; gap: 4px; }
.row-btn { width: 32px; height: 32px; border: 1px solid var(--bdr); border-radius: var(--r-sm); background: var(--bg2); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 0.78rem; color: var(--mt); transition: all 0.15s; flex-shrink: 0; }
.row-btn.edit:hover { background: var(--m-accent-solid); color: white; border-color: var(--m-accent-solid); }
.row-btn.delete:hover { background: var(--dg-solid); color: white; border-color: var(--dg-solid); }
.empty-row { text-align: center; padding: 40px 20px !important; color: var(--mt); }
.empty-row i { margin-right: 6px; }
.table-footer { padding: 10px 16px; font-size: 0.75rem; color: var(--mt); text-align: right; }
.drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000; backdrop-filter: blur(2px); }
.drawer-panel { position: fixed; top: 0; right: 0; bottom: 0; width: 440px; z-index: 1001; display: flex; flex-direction: column; border-left: 1px solid var(--bdr); }
.drawer-head { background: var(--bg2); padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--ac); flex-shrink: 0; }
.dh-left { display: flex; align-items: center; gap: 10px; color: var(--fg); font-size: 0.85rem; font-weight: 700; }
.dh-left i { color: var(--ac); font-size: 1.1rem; }
.dh-close { width: 32px; height: 32px; border-radius: var(--r-sm); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; }
.dh-close:hover { background: var(--dgs); color: var(--dg); border-color: var(--dg); }
.drawer-body { flex: 1; overflow-y: auto; padding: 20px; }
.drawer-seal { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--bdr); }
.ds-circle { width: 56px; height: 56px; border-radius: 50%; overflow: hidden; background: var(--bg2); border: 3px solid var(--ac); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ds-circle img { width: 100%; height: 100%; object-fit: cover; }
.ds-circle i { color: var(--mt); font-size: 1.3rem; }
.ds-label { font-size: 1.1rem; font-weight: 700; color: var(--fg); }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.fg { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.fg.full { grid-column: 1 / -1; }
.fg label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--mt); }
.fg input, .fg textarea { padding: 9px 12px; border: 1px solid var(--bdr); border-radius: var(--r-sm); font-family: var(--font-body); font-size: 0.85rem; color: var(--fg); transition: border-color 0.15s; background: var(--bg2); }
.fg input:focus, .fg textarea:focus { outline: none; border-color: var(--ac); background: var(--bg3); box-shadow: 0 0 0 3px var(--acs); }
.fg textarea { resize: vertical; min-height: 60px; }
.radio-group { display: flex; gap: 10px; }
.radio-label { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border: 1px solid var(--bdr); border-radius: var(--r-sm); font-size: 0.84rem; color: var(--mt); cursor: pointer; transition: all 0.15s; background: var(--bg2); }
.radio-label.active { border-color: var(--c); background: color-mix(in srgb, var(--c) 12%, var(--bg2)); color: var(--fg); font-weight: 600; }
.radio-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--c); position: relative; flex-shrink: 0; }
.radio-label.active .radio-dot::after { content: ''; position: absolute; top: 2px; left: 2px; width: 6px; height: 6px; border-radius: 50%; background: var(--c); }
.seal-upload { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border: 2px dashed var(--bdr2); border-radius: var(--r-sm); cursor: pointer; transition: all 0.15s; position: relative; background: var(--bg2); }
.seal-upload:hover { border-color: var(--ac); background: var(--acs); }
.seal-upload i { color: var(--mt); font-size: 1rem; }
.seal-upload span { font-size: 0.84rem; color: var(--mt); }
.hidden-input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.drawer-foot { padding: 16px 20px; border-top: 1px solid var(--bdr); display: flex; justify-content: flex-end; gap: 10px; background: var(--bg2); flex-shrink: 0; }
.btn-cancel { padding: 9px 18px; font-family: var(--font-body); font-size: 0.82rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; border-radius: var(--r-sm); }
.btn-cancel:hover { background: var(--card3); border-color: var(--bdr2); color: var(--fg); }
.btn-save { padding: 9px 18px; font-family: var(--font-body); font-size: 0.82rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; border-radius: var(--r-sm); }
.btn-save:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px var(--acg); }
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-danger { padding: 9px 18px; font-family: var(--font-body); font-size: 0.82rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; border-radius: var(--r-sm); }
.btn-danger:hover { background: #ff5570; transform: translateY(-2px); }
.toast { padding: 10px 14px; display: flex; align-items: center; gap: 8px; font-size: 0.82rem; font-weight: 500; margin-bottom: 14px; border-radius: var(--r-sm); }
.toast.success { background: var(--oks); color: var(--ok); border: 1px solid var(--okg); }
.toast.error { background: var(--dgs); color: var(--dg); border: 1px solid var(--dgg); }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(3px); }
.modal-box { border-radius: var(--r-lg); padding: 32px; max-width: 400px; width: 100%; text-align: center; }
.modal-icon { width: 56px; height: 56px; border-radius: 50%; background: var(--dgs); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
.modal-icon i { font-size: 1.4rem; color: var(--dg); }
.modal-box h3 { margin: 0 0 8px; font-size: 1.1rem; font-weight: 700; color: var(--fg); }
.modal-box p { margin: 0 0 24px; font-size: 0.85rem; color: var(--mt); line-height: 1.5; }
.modal-box p strong { color: var(--fg); }
.modal-actions { display: flex; justify-content: center; gap: 10px; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.22s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-right-enter-active, .slide-right-leave-active { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.slide-right-enter-from, .slide-right-leave-to { transform: translateX(100%); }
.msg-enter-active, .msg-leave-active { transition: all 0.22s ease; }
.msg-enter-from, .msg-leave-to { opacity: 0; transform: translateY(-6px); }
.collapse-enter-active, .collapse-leave-active { transition: all 0.25s ease; overflow: hidden; }
.collapse-enter-from, .collapse-leave-to { opacity: 0; transform: translateY(-8px); }
@media (max-width: 900px) {
  .toolbar { flex-direction: column; align-items: stretch; }
  .tb-right { flex-direction: column; }
  .tb-search input { width: 100%; }
  .drawer-panel { width: 100%; }
  .table-wrap { overflow-x: auto; }
  .data-table { min-width: 700px; }
  .ce-grid { grid-template-columns: 1fr; }
}

</style>