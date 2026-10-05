<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { API as API_BASE } from '@/api'

// 📋 LOG — Content change logger
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

const API = `${API_BASE}/destinations`

const loading = ref(false)
const notif = ref(null)
const destinations = ref([])
const searchQuery = ref('')
const filterStatus = ref('all')
const filterBarangay = ref('all')
const sortBy = ref('newest')
const viewMode = ref('grid') // grid | list | compact

// 📋 LOG — stores original values for diff tracking
const originalForm = ref(null)

const barangays = [
  'Brgy. Baco', 'Brgy. Bangkatan', 'Brgy. Bayanan I', 'Brgy. Bayanan II',
  'Brgy. Dulangan I', 'Brgy. Dulangan II', 'Brgy. Mangangan I', 'Brgy. Mangangan II',
  'Brgy. Maribudjoc', 'Brgy. Pambisan Malaki', 'Brgy. Pambisan Munti',
  'Brgy. Parang', 'Brgy. Poblacion I', 'Brgy. Poblacion II', 'Brgy. Poblacion III',
  'Brgy. San Andres', 'Brgy. San Ignacio', 'Brgy. Santa Cruz', 'Brgy. Tabon-Tabon',
  'Brgy. Tagumpay', 'Brgy. Water'
]

const usedBarangays = computed(() => {
  const set = new Set(destinations.value.map(d => d.location).filter(Boolean))
  return [...set].sort()
})

const filtered = computed(() => {
  let list = [...destinations.value]
  const q = searchQuery.value.toLowerCase().trim()
  if (q) list = list.filter(d => d.name.toLowerCase().includes(q) || (d.location || '').toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q) || (d.contact || '').toLowerCase().includes(q))
  if (filterStatus.value !== 'all') list = list.filter(d => (d.status || 'Active') === filterStatus.value)
  if (filterBarangay.value !== 'all') list = list.filter(d => d.location === filterBarangay.value)
  if (sortBy.value === 'newest') list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  else if (sortBy.value === 'oldest') list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  else if (sortBy.value === 'name') list.sort((a, b) => a.name.localeCompare(b.name))
  else if (sortBy.value === 'name-desc') list.sort((a, b) => b.name.localeCompare(a.name))
  return list
})

const stats = computed(() => ({
  total: destinations.value.length,
  active: destinations.value.filter(d => (d.status || 'Active') === 'Active').length,
  closed: destinations.value.filter(d => d.status === 'Closed').length,
  withCoords: destinations.value.filter(d => d.lat && d.lng).length,
  withContact: destinations.value.filter(d => d.contact).length
}))

const activeFilterCount = computed(() => {
  let c = 0
  if (filterStatus.value !== 'all') c++
  if (filterBarangay.value !== 'all') c++
  if (sortBy.value !== 'newest') c++
  if (searchQuery.value.trim()) c++
  return c
})

function clearAllFilters() {
  searchQuery.value = ''
  filterStatus.value = 'all'
  filterBarangay.value = 'all'
  sortBy.value = 'newest'
}

// ─── Modal State ───
const showModal = ref(false)
const isEditing = ref(false)
const submitting = ref(false)
const form = ref(getDefaultForm())
const showDeleteModal = ref(false)
const deleteTarget = ref(null)

function getDefaultForm() {
  return { id: null, name: '', location: '', image: '', status: 'Active', description: '', contact: '', fb_page: '', lat: '', lng: '', total_arrivals: '', activities: [] }
}

// ─── Fetch ───
async function fetchDestinations() {
  loading.value = true
  try {
    const res = await fetch(API)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    destinations.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error(e)
    showNotif('Failed to load destinations.', 'warning')
    destinations.value = []
  }
  loading.value = false
}

// ─── CRUD ───
function openAdd() {
  form.value = getDefaultForm()
  // 📋 LOG — no original for new items
  originalForm.value = null
  isEditing.value = false
  showModal.value = true
  initPicker() // 🗺️ map picker — no pin yet, centers on Baco
}

function openEdit(item) {
  // 📋 LOG — snapshot original values before editing
  originalForm.value = {
    name: item.name || '',
    location: item.location || '',
    status: item.status || 'Active',
    description: item.description || '',
    contact: item.contact || '',
    fb_page: item.fb_page || '',
    lat: (item.lat ?? '') === '' ? '' : Number(item.lat),
    lng: (item.lng ?? '') === '' ? '' : Number(item.lng),
    total_arrivals: (item.total_arrivals ?? '') === '' ? '' : Number(item.total_arrivals),
    activities: item.activities ? item.activities.map(a => a.name || a) : []
  }
  form.value = {
    id: item.id,
    name: item.name || '',
    location: item.location || '',
    image: item.image || '',
    status: item.status || 'Active',
    description: item.description || '',
    contact: item.contact || '',
    fb_page: item.fb_page || '',
    lat: (item.lat ?? '') === '' ? '' : Number(item.lat),
    lng: (item.lng ?? '') === '' ? '' : Number(item.lng),
    total_arrivals: (item.total_arrivals ?? '') === '' ? '' : Number(item.total_arrivals),
    activities: item.activities ? [...item.activities] : []
  }
  isEditing.value = true
  showModal.value = true
  initPicker() // 🗺️ map picker — drops a pin if the destination has coordinates
}

function closeModal() {
  showModal.value = false
  // the modal's v-if removes the Google map container — just drop stale references
  pickerMap = null
  pickerMarker = null
  // reset map-search state too
  mapSearchQuery.value = ''
  mapSearchResults.value = []
  mapSearchError.value = ''
}

async function save() {
  if (!form.value.name.trim()) return showNotif('Name is required.', 'warning')
  submitting.value = true
  try {
    const body = {
      name: form.value.name.trim(),
      location: form.value.location,
      image: form.value.image,
      status: form.value.status,
      description: form.value.description,
      contact: form.value.contact,
      fb_page: form.value.fb_page,
      lat: form.value.lat ? Number(form.value.lat) : null,
      lng: form.value.lng ? Number(form.value.lng) : null,
      total_arrivals: (form.value.total_arrivals === '' || form.value.total_arrivals == null) ? null : Number(form.value.total_arrivals),
      activities: form.value.activities
    }
    const url = isEditing.value ? `${API}/${form.value.id}` : API
    const method = isEditing.value ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) throw new Error('Save failed')
    // 📋 LOG — after successful save
    if (isEditing.value) {
      const orig = originalForm.value || {}
      const changes = {}
      if (form.value.name !== orig.name) changes.name = { old: orig.name, new: form.value.name }
      if (form.value.location !== orig.location) changes.location = { old: orig.location, new: form.value.location }
      if (form.value.status !== orig.status) changes.status = { old: orig.status, new: form.value.status }
      if (form.value.contact !== orig.contact) changes.contact = { old: orig.contact, new: form.value.contact }
      if (form.value.fb_page !== orig.fb_page) changes.fb_page = { old: orig.fb_page, new: form.value.fb_page }
      if (String(form.value.lat) !== String(orig.lat)) changes.lat = { old: orig.lat, new: form.value.lat || 'null' }
      if (String(form.value.lng) !== String(orig.lng)) changes.lng = { old: orig.lng, new: form.value.lng || 'null' }
      if (String(form.value.total_arrivals) !== String(orig.total_arrivals)) changes.total_arrivals = { old: orig.total_arrivals === '' ? 'Not set' : orig.total_arrivals, new: form.value.total_arrivals === '' ? 'Not set' : form.value.total_arrivals }
      const descChanged = form.value.description !== orig.description
      if (descChanged) changes.description = { old: (orig.description || '').substring(0, 80) + '...', new: (form.value.description || '').substring(0, 80) + '...' }
      const currentActivities = form.value.activities.map(a => a.name || a)
      const origActivities = orig.activities || []
      if (JSON.stringify(currentActivities) !== JSON.stringify(origActivities)) {
        changes.activities = { old: origActivities.join(', ') || 'None', new: currentActivities.join(', ') || 'None' }
      }
      if (form.value.image && form.value.image.startsWith('data:image')) changes.image = { new: 'Updated' }
      if (Object.keys(changes).length > 0) {
        await logChange('tourism', form.value.id, form.value.name, 'update', changes)
      }
    } else {
      await logChange('tourism', null, form.value.name, 'create', {
        name: { new: form.value.name },
        location: { new: form.value.location || 'Not set' },
        status: { new: form.value.status },
        contact: { new: form.value.contact || 'Not set' },
        fb_page: { new: form.value.fb_page || 'Not set' }
      })
    }
    // 📋 END LOG
    showNotif(isEditing.value ? 'Destination updated.' : 'Destination added.', 'success')
    closeModal()
    await fetchDestinations()
  } catch (e) {
    showNotif('Failed to save destination.', 'warning')
  }
  submitting.value = false
}

function confirmDelete(item) {
  deleteTarget.value = item
  showDeleteModal.value = true
}

function cancelDelete() { showDeleteModal.value = false }

async function executeDelete() {
  if (!deleteTarget.value) return
  try {
    const res = await fetch(`${API}/${deleteTarget.value.id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Delete failed')
    // 📋 LOG — after successful delete
    await logChange('tourism', deleteTarget.value.id, deleteTarget.value.name, 'delete', null)
    // 📋 END LOG
    showNotif(`"${deleteTarget.value.name}" removed.`, 'success')
    await fetchDestinations()
  } catch (e) {
    showNotif('Failed to delete.', 'warning')
  }
  cancelDelete()
}

// ─── Image ───
function handleImage(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => { form.value.image = ev.target.result }
  reader.readAsDataURL(file)
}

// ─── Activities ───
function addActivity() { form.value.activities.push({ name: '', image: '' }) }
function removeActivity(i) { form.value.activities.splice(i, 1) }
function handleActivityImage(e, i) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => { form.value.activities[i].image = ev.target.result }
  reader.readAsDataURL(file)
}

// ─── 🗺️ Map Location Picker (Google Maps JS API — VITE_GOOGLE_MAPS_KEY) ───
const pickerMapEl = ref(null)
let pickerMap = null
let pickerMarker = null

const mapSearchQuery = ref('')
const mapSearching = ref(false)
const mapSearchResults = ref([])
const mapSearchError = ref('')
const mapLocating = ref(false)

// Google Maps preview of the pinned spot (plain URL — not the paid API)
const gmapsPreviewUrl = computed(() => {
  if (form.value.lat === '' || form.value.lat == null || form.value.lng === '' || form.value.lng == null) return null
  return `https://www.google.com/maps/search/?api=1&query=${Number(form.value.lat)},${Number(form.value.lng)}`
})

// ─── Baco local gazetteer — all 27 barangays + key landmarks (instant offline results) ───
const BACO_BARANGAYS = [
  { name: 'Alag Baco', lat: 13.3667, lng: 121.0839 },
  { name: 'Bangkatan', lat: 13.3294, lng: 121.0609 },
  { name: 'Baras', lat: 13.3695, lng: 120.9932 },
  { name: 'Bayanan', lat: 13.3357, lng: 121.0444 },
  { name: 'Burbuli', lat: 13.3771, lng: 121.0794 },
  { name: 'Catwiran I', lat: 13.3811, lng: 121.1152 },
  { name: 'Catwiran II', lat: 13.3708, lng: 121.1133 },
  { name: 'Dulangan I', lat: 13.3319, lng: 121.1073 },
  { name: 'Dulangan II', lat: 13.3142, lng: 121.0891 },
  { name: 'Lantuyang', lat: 13.3068, lng: 121.0640 },
  { name: 'Lumang Bayan', lat: 13.3972, lng: 121.0969 },
  { name: 'Malapad', lat: 13.3941, lng: 121.1041 },
  { name: 'Mangangan I', lat: 13.3577, lng: 121.0407 },
  { name: 'Mangangan II', lat: 13.3682, lng: 121.0456 },
  { name: 'Mayabig', lat: 13.3549, lng: 121.0640 },
  { name: 'Pambisan', lat: 13.4097, lng: 121.1354 },
  { name: 'Poblacion', lat: 13.3592, lng: 121.0974 },
  { name: 'Pulang-Tubig', lat: 13.4140, lng: 121.1028 },
  { name: 'Putican-Cabulo', lat: 13.4064, lng: 121.1071 },
  { name: 'San Andres', lat: 13.4084, lng: 121.1199 },
  { name: 'San Ignacio', lat: 13.2988, lng: 121.0699 },
  { name: 'Santa Cruz', lat: 13.3849, lng: 121.0969 },
  { name: 'Santa Rosa I', lat: 13.3728, lng: 121.0649 },
  { name: 'Santa Rosa II', lat: 13.3777, lng: 121.0400 },
  { name: 'Tabon-Tabon', lat: 13.3922, lng: 121.1217 },
  { name: 'Tagumpay', lat: 13.3465, lng: 121.0987 },
  { name: 'Water', lat: 13.4014, lng: 121.0830 },
]
const BACO_LANDMARKS = [
  { name: 'Mt. Halcon (Summit)', lat: 13.2706, lng: 121.0611 },
  { name: 'Baco Municipal Hall', lat: 13.3592, lng: 121.0974 },
]

// ─── Open Location Code (Google Plus Code) decoder — tiny built-in implementation ───
const OLC_ALPHABET = '23456789CFGHJMPQRVWX'
const OLC_RES = [20, 1.0, 0.05, 0.0025, 0.000125]

function olcEncodeRef(lat, lng) {
  lat = Math.min(Math.max(lat, -90), 89.999999)
  lng = ((lng + 180) % 360 + 360) % 360 - 180
  let latVal = lat + 90, lngVal = lng + 180, code = ''
  for (const r of OLC_RES) {
    const la = Math.min(19, Math.floor(latVal / r))
    const ln = Math.min(19, Math.floor(lngVal / r))
    code += OLC_ALPHABET[la] + OLC_ALPHABET[ln]
    latVal -= la * r
    lngVal -= ln * r
  }
  return code // 10 chars, e.g. "7M53942222" for Baco center
}

function olcDecode(code) {
  code = code.replace(/\+/g, '').toUpperCase()
  let lat = -90, lng = -180, latRes = 0.0025, lngRes = 0.0025
  for (let i = 0; i + 1 < code.length && i / 2 < OLC_RES.length; i += 2) {
    const r = OLC_RES[i / 2]
    lat += OLC_ALPHABET.indexOf(code[i]) * r
    lng += OLC_ALPHABET.indexOf(code[i + 1]) * r
    latRes = lngRes = r
  }
  // 11th char = finer latitude precision
  if (code.length % 2 === 1 && code.length >= 11) {
    const r = OLC_RES[4] / 20
    lat += OLC_ALPHABET.indexOf(code[10]) * r
    latRes = r
  }
  return { lat: lat + latRes / 2, lng: lng + lngRes / 2 }
}

// Recover a short Plus Code ("8347+8X") into a full one using Baco as the reference area
function olcRecoverNearest(shortCode, refLat, refLng) {
  const code = shortCode.replace(/\+/g, '').toUpperCase()
  if (code.length >= 10) return code.slice(0, 11)
  const missing = 10 - code.length
  const refCode = olcEncodeRef(refLat, refLng)
  if (missing % 2 === 0) return refCode.slice(0, missing) + code
  // Odd number of missing chars — test the 3 candidate latitude-band prefixes, keep the nearest
  const base = refCode.slice(0, missing)
  const idx = OLC_ALPHABET.indexOf(base[0])
  let best = base, bestDist = Infinity
  for (const d of [-1, 0, 1]) {
    const i2 = idx + d
    if (i2 < 0 || i2 >= 20) continue
    const candidate = OLC_ALPHABET[i2] + base.slice(1)
    const p = olcDecode(candidate + code)
    const dist = (p.lat - refLat) ** 2 + (p.lng - refLng) ** 2
    if (dist < bestDist) { bestDist = dist; best = candidate }
  }
  return best + code
}

// Pull a Plus Code token out of free text like "8347+8XP, Baco, Oriental Mindoro"
function extractPlusCode(raw) {
  const m = raw.toUpperCase().match(/([23456789CFGHJMPQRVWX]{4,8})\+([23456789CFGHJMPQRVWX]{2,3})/)
  if (!m) return null
  return m[1] + m[2]
}

// Pull coordinates straight out of a pasted Google Maps link
function extractCoordsFromGoogleUrl(raw) {
  let m = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  m = raw.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  m = raw.match(/[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  return null
}

const sourceLabel = (s) => s === 'dest' ? 'My data' : s === 'brgy' ? 'Baco' : 'OSM'

// Shared Google Maps loader — injected once per page, reused by every mount
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''
const loadGoogleMaps = () => {
  if (window.google && window.google.maps) return Promise.resolve(window.google.maps)
  if (window.__gmapsLoadPromise) return window.__gmapsLoadPromise
  window.__gmapsLoadPromise = new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_KEY) { reject(new Error('VITE_GOOGLE_MAPS_KEY missing — add it to your frontend .env and restart the dev server')); return }
    window.__gmapsReady = () => resolve(window.google.maps)
    const sc = document.createElement('script')
    sc.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&v=weekly&loading=async&callback=__gmapsReady`
    sc.async = true
    sc.onerror = () => { window.__gmapsLoadPromise = null; reject(new Error('Google Maps script failed to load')) }
    document.head.appendChild(sc)
  })
  return window.__gmapsLoadPromise
}

// ─── Free geocoders (NO billing, NO API key) — search instead of Google Geocoding ───
// Nominatim = OpenStreetMap's official geocoder · Photon = Komoot's OSM search,
// much better at fuzzy/local POI names. Both run in parallel and get merged.
async function geocodeOnline(address) {
  const results = []
  const nominatim = fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=ph&q=${encodeURIComponent(address)}`,
    { headers: { 'Accept': 'application/json' } }
  ).then(r => r.ok ? r.json() : [])
  const photon = fetch(
    `https://photon.komoot.io/api/?limit=6&lat=13.35&lon=121.10&q=${encodeURIComponent(address)}`
  ).then(r => r.ok ? r.json() : { features: [] })

  const [nRes, pRes] = await Promise.allSettled([nominatim, photon])

  if (nRes.status === 'fulfilled' && Array.isArray(nRes.value)) {
    for (const r of nRes.value) {
      const la = parseFloat(r.lat), ln = parseFloat(r.lon)
      if (isNaN(la) || isNaN(ln)) continue
      results.push({
        label: (r.display_name || '').split(',').slice(0, 3).join(', '),
        sub: r.display_name || 'OpenStreetMap',
        lat: la, lng: ln, source: 'osm'
      })
    }
  }
  if (pRes.status === 'fulfilled' && Array.isArray(pRes.value?.features)) {
    for (const f of pRes.value.features) {
      const c = f.geometry?.coordinates
      if (!Array.isArray(c) || c.length < 2) continue
      const la = parseFloat(c[1]), ln = parseFloat(c[0])
      if (isNaN(la) || isNaN(ln)) continue
      const pr = f.properties || {}
      const label = [pr.name, pr.street, pr.district, pr.city, pr.state].filter(Boolean).slice(0, 3).join(', ') || 'Place'
      results.push({ label, sub: 'Photon · OpenStreetMap', lat: la, lng: ln, source: 'osm' })
    }
  }
  return results
}

async function initPicker() {
  await nextTick()
  if (!pickerMapEl.value) return
  let maps
  try { maps = await loadGoogleMaps() } catch (e) { console.warn(e.message); return }
  // the modal's v-if always gives us a fresh container — just drop stale references
  pickerMap = null
  pickerMarker = null

  const hasPin = form.value.lat !== '' && form.value.lat != null && form.value.lng !== '' && form.value.lng != null
  const center = { lat: hasPin ? Number(form.value.lat) : 13.35, lng: hasPin ? Number(form.value.lng) : 121.10 }

  // gestureHandling 'cooperative' → ctrl+scroll to zoom, so the modal body keeps scrolling naturally
  pickerMap = new maps.Map(pickerMapEl.value, {
    center,
    zoom: hasPin ? 14 : 11,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    gestureHandling: 'cooperative',
  })

  pickerMap.addListener('click', (e) => { if (e.latLng) setPin(e.latLng.lat(), e.latLng.lng()) })
  if (hasPin) setPin(Number(form.value.lat), Number(form.value.lng))
}

function setPin(lat, lng) {
  form.value.lat = Number(lat)
  form.value.lng = Number(lng)
  const maps = window.google && window.google.maps
  if (!maps || !pickerMap) return // modal may have closed while a search/geolocation was in flight
  const pos = { lat: form.value.lat, lng: form.value.lng }
  if (!pickerMarker) {
    pickerMarker = new maps.Marker({ position: pos, map: pickerMap, draggable: true, title: 'Destination location' })
    pickerMarker.addListener('dragend', () => {
      const p = pickerMarker.getPosition()
      setPin(p.lat(), p.lng())
    })
  } else {
    pickerMarker.setPosition(pos)
  }
  pickerMap.panTo(pos)
}

function clearPin() {
  form.value.lat = ''
  form.value.lng = ''
  if (pickerMarker) { pickerMarker.setMap(null); pickerMarker = null }
}

// ─── Smart place search — layered ───
// 1) Google Maps link pasted → coordinates straight from the URL
// 2) Google Plus Code ("8347+8X") → decoded locally to coordinates (instant, works offline)
// 3) "lat, lng" pasted → pin
// 4) Local matches: your saved destinations + all 27 Baco barangays (instant, offline)
// 5) Online: Nominatim + Photon (free, no key, no billing)
async function searchPlace() {
  const raw = mapSearchQuery.value.trim()
  if (!raw) return
  mapSearchError.value = ''
  mapSearchResults.value = []
  mapSearching.value = true

  // 1) Google Maps link
  const urlCoords = extractCoordsFromGoogleUrl(raw)
  if (urlCoords && !isNaN(urlCoords.lat) && !isNaN(urlCoords.lng) && Math.abs(urlCoords.lat) <= 90 && Math.abs(urlCoords.lng) <= 180) {
    setPin(urlCoords.lat, urlCoords.lng)
    pickerMap?.setCenter({ lat: urlCoords.lat, lng: urlCoords.lng })
    pickerMap?.setZoom(16)
    mapSearching.value = false
    showNotif('Pin placed from Google Maps link — drag to fine-tune.', 'success')
    return
  }

  // 2) Google Plus Code (works with or without the locality text after it)
  const plusCode = extractPlusCode(raw)
  if (plusCode) {
    const full = olcRecoverNearest(plusCode, 13.35, 121.10)
    const p = olcDecode(full)
    setPin(p.lat, p.lng)
    pickerMap?.setCenter({ lat: p.lat, lng: p.lng })
    pickerMap?.setZoom(16)
    mapSearching.value = false
    showNotif('Pin placed from Plus Code — drag to fine-tune if needed.', 'success')
    return
  }

  // 3) Pasted "lat, lng"
  const coordMatch = raw.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (coordMatch) {
    const la = parseFloat(coordMatch[1]), ln = parseFloat(coordMatch[2])
    if (Math.abs(la) <= 90 && Math.abs(ln) <= 180) {
      setPin(la, ln)
      pickerMap?.setCenter({ lat: la, lng: ln })
      pickerMap?.setZoom(15)
      mapSearching.value = false
      return
    }
  }

  // 4) Local matches first — saved destinations + barangays (instant, no network)
  const q = raw.toLowerCase()
  const local = []
  for (const d of destinations.value) {
    if (d.lat == null || d.lat === '' || d.lng == null || d.lng === '') continue
    const hay = `${d.name} ${d.location || ''} ${d.description || ''}`.toLowerCase()
    if (hay.includes(q)) {
      const la = Number(d.lat), ln = Number(d.lng)
      if (!isNaN(la) && !isNaN(ln)) local.push({ label: d.name, sub: d.location || 'Saved destination', lat: la, lng: ln, source: 'dest' })
    }
  }
  for (const b of [...BACO_BARANGAYS, ...BACO_LANDMARKS]) {
    if (b.name.toLowerCase().includes(q)) {
      local.push({
        label: b.name,
        sub: b.name.startsWith('Mt.') ? 'Landmark · Baco' : 'Barangay · Baco, Oriental Mindoro',
        lat: b.lat, lng: b.lng, source: 'brgy'
      })
    }
  }

  // 5) Online: Nominatim + Photon (free, no key, no billing)
  let online = []
  try { online = await geocodeOnline(raw) } catch (e) { /* offline — local results may still show */ }

  // Merge, dropping duplicates (anything within ~100 m of an earlier hit)
  const results = []
  const push = (r) => {
    if (results.some(x => Math.abs(x.lat - r.lat) < 0.001 && Math.abs(x.lng - r.lng) < 0.001)) return
    results.push(r)
  }
  local.forEach(push)
  online.forEach(push)

  if (results.length === 0) {
    mapSearchError.value = 'Nothing found. Try the place name (e.g. "Tagbungan"), a barangay, a Google Plus Code (e.g. "8347+8X"), a Google Maps link, or paste "13.35, 121.10".'
  } else {
    mapSearchResults.value = results.slice(0, 12)
  }
  mapSearching.value = false
}

function applySearchResult(r) {
  setPin(r.lat, r.lng)
  pickerMap?.setCenter({ lat: r.lat, lng: r.lng })
  pickerMap?.setZoom(16)
  mapSearchResults.value = []
  mapSearchQuery.value = r.label
}

// ─── Drop a pin on the admin's current location ───
function useMyLocation() {
  if (!('geolocation' in navigator)) return showNotif('Geolocation is not supported by this browser.', 'warning')
  mapLocating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      mapLocating.value = false
      if (!pickerMap) return // modal closed meanwhile
      setPin(pos.coords.latitude, pos.coords.longitude)
      pickerMap.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      pickerMap.setZoom(16)
      showNotif('Pin set to your current location.', 'success')
    },
    () => {
      mapLocating.value = false
      showNotif('Could not get your location. Check browser permissions.', 'warning')
    },
    { enableHighAccuracy: true, timeout: 10000 }
  )
}

// Keep the pin glued to the lat/lng inputs when they're typed by hand
watch(() => [form.value.lat, form.value.lng], ([la, ln]) => {
  if (pickerMap && pickerMarker && la !== '' && la != null && ln !== '' && ln != null) {
    pickerMarker.setPosition({ lat: Number(la), lng: Number(ln) })
  }
})

onBeforeUnmount(() => {
  // Google Maps needs no explicit teardown — the modal's v-if removes the container
  pickerMap = null
  pickerMarker = null
})

// ─── Notification ───
function showNotif(message, type = 'info') {
  notif.value = { message, type }
  setTimeout(() => { notif.value = null }, 3500)
}

// ─── Helpers ───
function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

function galleryImages(item) {
  return (item.activities || []).map(a => a.image).filter(Boolean)
}
const ARRIVALS_API = `${API_BASE}/admin/tourism/arrivals`
const arrYear = ref(new Date().getFullYear())
const arrQuarter = ref(Math.floor(new Date().getMonth() / 3) + 1)
const arrTotal = ref(0)
const arrDomestic = ref(0)
const arrPeak = ref('')
const arrAttractions = ref([]) // [{ name, visitors }]
const arrLoading = ref(false)
const arrSaving = ref(false)
const arrHasData = ref(false)

const arrForeignPct = computed(() => Math.max(0, 100 - (Number(arrDomestic.value) || 0)))
const arrPeriodLabel = computed(() => `Q${arrQuarter.value} ${arrYear.value}`)

async function fetchArrivals() {
  if (!arrYear.value) arrYear.value = new Date().getFullYear()
  arrLoading.value = true
  try {
    const token = localStorage.getItem('baco_admin_token')
    const res = await fetch(`${ARRIVALS_API}?year=${arrYear.value}&quarter=${arrQuarter.value}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('load failed')
    const data = await res.json()
    arrTotal.value = data.summary?.totalArrivals ?? 0
    arrDomestic.value = data.summary?.domesticPct ?? 0
    arrPeak.value = data.summary?.peakLabel ?? ''
    arrAttractions.value = (data.attractions || []).map(a => ({ name: a.name, visitors: a.visitors }))
    arrHasData.value = !!data.summary
    if (data.backgrounds) applyBackgrounds(data.backgrounds)
  } catch (e) { /* keep what's on screen */ }
  arrLoading.value = false
}

function setArrPeriod(q) {
  if (arrQuarter.value === q) return
  arrQuarter.value = q
  fetchArrivals()
}
function addArrAttraction() { arrAttractions.value.push({ name: '', visitors: 0 }) }
function removeArrAttraction(i) { arrAttractions.value.splice(i, 1) }

async function saveArrivals() {
  const rows = arrAttractions.value.filter(a => a.name.trim())
  // No "must have data" gate — saving a quarter with no total and no
  // attractions CLEARS (unpublishes) it, which hides the public section.
  const names = rows.map(a => a.name.trim().toLowerCase())
  if (new Set(names).size !== names.length) return showNotif('Duplicate attraction names in the list.', 'warning')
  arrSaving.value = true
  try {
    const token = localStorage.getItem('baco_admin_token')
    const res = await fetch(ARRIVALS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        quarterYear: arrYear.value,
        quarterNum: arrQuarter.value,
        totalArrivals: Number(arrTotal.value) || 0,
        domesticPct: Math.min(100, Math.max(0, Number(arrDomestic.value) || 0)),
        peakLabel: arrPeak.value,
        attractions: rows
      })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || 'Save failed')
    showNotif(data.message || 'Arrivals data saved.', 'success')
    arrHasData.value = !!data.hasData
  } catch (e) {
    showNotif(e.message || 'Failed to save arrivals data.', 'warning')
  }
  arrSaving.value = false
}

// ─── Arrivals Section Backgrounds (hero + top5 photos on the public page) ───
const BG_API = `${API_BASE}/admin/tourism/arrivals/backgrounds`
const bgHeroCurrent = ref(null)  // saved URL (null = built-in default in use)
const bgTop5Current = ref(null)
const bgHeroNew = ref(null)      // base64 preview of a newly picked file
const bgTop5New = ref(null)
const bgHeroClear = ref(false)   // true = reset to default on save
const bgTop5Clear = ref(false)
const bgSaving = ref(false)
const bgHeroInput = ref(null)
const bgTop5Input = ref(null)

const bgHeroPreview = computed(() => bgHeroClear.value ? null : (bgHeroNew.value || bgHeroCurrent.value))
const bgTop5Preview = computed(() => bgTop5Clear.value ? null : (bgTop5New.value || bgTop5Current.value))

function applyBackgrounds(b) {
  bgHeroCurrent.value = b?.heroBg || null
  bgTop5Current.value = b?.top5Bg || null
  bgHeroNew.value = null; bgTop5New.value = null
  bgHeroClear.value = false; bgTop5Clear.value = false
}

function pickBgImage(which) {
  ;(which === 'hero' ? bgHeroInput : bgTop5Input).value?.click()
}
function handleBgFile(e, which) {
  const file = e.target.files[0]
  if (!file) return
  if (!file.type.startsWith('image/')) return showNotif('Please choose an image file.', 'warning')
  const reader = new FileReader()
  reader.onload = (ev) => {
    if (which === 'hero') { bgHeroNew.value = ev.target.result; bgHeroClear.value = false }
    else { bgTop5New.value = ev.target.result; bgTop5Clear.value = false }
  }
  reader.readAsDataURL(file)
  e.target.value = ''
}
function resetBgDefault(which) {
  if (which === 'hero') { bgHeroClear.value = true; bgHeroNew.value = null }
  else { bgTop5Clear.value = true; bgTop5New.value = null }
}
function undoBgChange(which) {
  if (which === 'hero') { bgHeroNew.value = null; bgHeroClear.value = false }
  else { bgTop5New.value = null; bgTop5Clear.value = false }
}

async function saveBackgrounds() {
  const hasChange = bgHeroNew.value || bgHeroClear.value || bgTop5New.value || bgTop5Clear.value
  if (!hasChange) return showNotif('No background changes to save.', 'info')
  bgSaving.value = true
  try {
    const token = localStorage.getItem('baco_admin_token')
    const body = {}
    if (bgHeroNew.value) body.heroBg = bgHeroNew.value
    else if (bgHeroClear.value) body.heroBg = ''
    if (bgTop5New.value) body.top5Bg = bgTop5New.value
    else if (bgTop5Clear.value) body.top5Bg = ''
    const res = await fetch(BG_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || 'Save failed')
    applyBackgrounds(data.backgrounds)
    showNotif(data.message || 'Backgrounds updated.', 'success')
  } catch (e) {
    showNotif(e.message || 'Failed to save backgrounds.', 'warning')
  }
  bgSaving.value = false
}

onMounted(() => { fetchDestinations(); fetchArrivals() })
</script>

<template>
  <div class="td">
    <!-- Toast -->
    <Transition name="toast">
      <div v-if="notif" class="toast" :class="notif.type">
        <i class="fa-solid" :class="{ 'fa-circle-check': notif.type==='success', 'fa-circle-info': notif.type==='info', 'fa-triangle-exclamation': notif.type==='warning' }"></i>
        <span>{{ notif.message }}</span>
      </div>
    </Transition>

    <!-- Header -->
    <div class="td-header">
      <div>
        <div class="td-eyebrow"><span class="eyebrow-line"></span> Tourism Module</div>
        <h1 class="td-title">Tourism <span class="td-accent">Destinations</span></h1>
        <p class="td-sub">Manage resorts, attractions, and historical sites across Baco.</p>
      </div>
      <button class="btn-add mat-skeuo-filled mat-pressable-filled" @click="openAdd"><i class="fa-solid fa-plus"></i> Add Destination</button>
    </div>

    <!-- Stats -->
    <div class="td-stats">
      <div class="td-stat">
        <div class="td-stat-icon navy"><i class="fa-solid fa-map-location-dot"></i></div>
        <div class="td-stat-body"><span class="td-stat-val">{{ stats.total }}</span><span class="td-stat-label">Total</span></div>
      </div>
      <div class="td-stat">
        <div class="td-stat-icon green"><i class="fa-solid fa-circle-check"></i></div>
        <div class="td-stat-body"><span class="td-stat-val">{{ stats.active }}</span><span class="td-stat-label">Active</span></div>
      </div>
      <div class="td-stat">
        <div class="td-stat-icon red"><i class="fa-solid fa-circle-pause"></i></div>
        <div class="td-stat-body"><span class="td-stat-val">{{ stats.closed }}</span><span class="td-stat-label">Closed</span></div>
      </div>
      <div class="td-stat">
        <div class="td-stat-icon gold"><i class="fa-solid fa-location-crosshairs"></i></div>
        <div class="td-stat-body"><span class="td-stat-val">{{ stats.withCoords }}</span><span class="td-stat-label">Pinned</span></div>
      </div>
      <div class="td-stat">
        <div class="td-stat-icon teal"><i class="fa-solid fa-phone"></i></div>
        <div class="td-stat-body"><span class="td-stat-val">{{ stats.withContact }}</span><span class="td-stat-label">With Contact</span></div>
      </div>
    </div>

    <!-- Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â Tourist Arrivals (Quarterly Ã¢â‚¬â€ official statistics on the public Tourism page) Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â -->
    <div class="td-analytics td-arrivals">
      <div class="td-analytics-head">
        <div>
          <div class="td-analytics-eyebrow td-arr-eyebrow"><i class="fa-solid fa-ranking-star"></i> Public Statistics</div>
          <h2>Tourist Arrivals &mdash; Quarterly</h2>
          <p>The official numbers shown on the public Tourism page. Saving a quarter instantly replaces the previously published one.</p>
        </div>
        <div class="td-arr-period">
          <input v-model.number="arrYear" type="number" min="2000" max="2100" class="td-arr-year" @change="fetchArrivals" />
          <button v-for="q in 4" :key="q" type="button" class="td-arr-q" :class="{ active: arrQuarter === q }" @click="setArrPeriod(q)">Q{{ q }}</button>
        </div>
      </div>

      <div v-if="arrLoading" class="td-analytics-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading {{ arrPeriodLabel }}&hellip;</div>

      <div v-else class="td-arr-body">
        <p v-if="!arrHasData" class="td-arr-note"><i class="fa-solid fa-circle-info"></i> No data saved for {{ arrPeriodLabel }} yet. Fill in the fields below and save to publish it.</p>

        <div class="td-arr-fields">
          <div class="td-fg td-arr-field">
            <label>Total Arrivals</label>
            <small class="td-arr-help">The big animated counter on the public Tourism page (was 5,954)</small>
            <input v-model.number="arrTotal" type="number" min="0" placeholder="0" />
          </div>
          <div class="td-fg td-arr-field">
            <label>Domestic Visitors %</label>
            <small class="td-arr-help">"Domestic" tile &middot; Foreign shows {{ arrForeignPct }}% automatically (was 72 / 28)</small>
            <input v-model.number="arrDomestic" type="number" min="0" max="100" placeholder="72" />
          </div>
          <div class="td-fg td-arr-field">
            <label>Peak Month</label>
            <small class="td-arr-help">"Peak Month" tile in the story modal, e.g. Apr (was Apr)</small>
            <input v-model="arrPeak" type="text" maxlength="12" placeholder="e.g. Apr" />
          </div>
        </div>

        <div class="td-arr-attr">
          <div class="td-activities-header">
            <label>Top Attractions for {{ arrPeriodLabel }} <span class="td-arr-help-inline">Ã¢â‚¬â€ the public Top 5 list (ranked by visitors automatically)</span></label>
            <button type="button" class="td-btn-sm mat-skeuo-sm mat-pressable-sm" @click="addArrAttraction"><i class="fa-solid fa-plus"></i> Add Attraction</button>
          </div>
          <div v-if="arrAttractions.length === 0" class="td-activities-empty">No attractions for this period yet.</div>
          <div v-for="(a, i) in arrAttractions" :key="i" class="td-arr-row">
            <span class="td-arr-rank">{{ i + 1 }}</span>
            <input v-model="a.name" type="text" :placeholder="`Attraction ${i + 1} name (was: Tiboy Rapids)`" />
            <input v-model.number="a.visitors" type="number" min="0" class="td-arr-vis" placeholder="Visitors" />
            <button type="button" class="td-activity-remove mat-skeuo-sm mat-pressable-danger" @click="removeArrAttraction(i)"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>

        <div class="td-arr-actions">
          <span class="td-arr-hint"><i class="fa-solid fa-circle-info"></i> Public page always shows the latest saved quarter, top 5 by visitors. Saving a quarter with no total and no attractions clears (hides) it.</span>
          <button class="td-btn-save mat-skeuo-filled mat-pressable-filled" @click="saveArrivals" :disabled="arrSaving">
            <span><i class="fa-solid fa-floppy-disk"></i> Save {{ arrPeriodLabel }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="td-analytics td-arrivals">
      <div class="td-analytics-head">
        <div>
          <div class="td-analytics-eyebrow td-arr-eyebrow"><i class="fa-solid fa-images"></i> Public Statistics</div>
          <h2>Arrivals Section Backgrounds</h2>
          <p>Replace the photos behind the arrivals counter and the Top 5 attractions list on the public Tourism page.</p>
        </div>
      </div>
      <div class="td-bg-grid">
        <div class="td-bg-item">
          <label>Arrivals Counter Background</label>
          <div class="td-bg-preview" :style="bgHeroPreview ? { backgroundImage: `url(${bgHeroPreview})` } : {}">
            <div v-if="!bgHeroPreview" class="td-bg-empty"><i class="fa-solid fa-water"></i><span>Using default photo</span></div>
            <span v-if="bgHeroNew" class="td-bg-newtag mat-well">New</span>
            <span v-else-if="bgHeroClear" class="td-bg-newtag clear mat-well">Default</span>
          </div>
          <div class="td-bg-actions">
            <button type="button" class="td-btn-sm mat-skeuo-sm mat-pressable-sm" @click="pickBgImage('hero')"><i class="fa-solid fa-upload"></i> {{ bgHeroPreview ? 'Replace' : 'Upload' }}</button>
            <button v-if="bgHeroNew || bgHeroClear" type="button" class="btn-clear-filters mat-skeuo-sm mat-pressable-danger" @click="undoBgChange('hero')"><i class="fa-solid fa-rotate-left"></i> Undo</button>
            <button v-else-if="bgHeroCurrent" type="button" class="btn-clear-filters mat-skeuo-sm mat-pressable-danger" @click="resetBgDefault('hero')"><i class="fa-solid fa-arrow-rotate-left"></i> Use Default</button>
          </div>
          <input ref="bgHeroInput" type="file" accept="image/*" class="td-hidden" @change="(e) => handleBgFile(e, 'hero')" />
        </div>
        <div class="td-bg-item">
          <label>Top 5 Attractions Background</label>
          <div class="td-bg-preview" :style="bgTop5Preview ? { backgroundImage: `url(${bgTop5Preview})` } : {}">
            <div v-if="!bgTop5Preview" class="td-bg-empty"><i class="fa-solid fa-mountain-sun"></i><span>Using default photo</span></div>
            <span v-if="bgTop5New" class="td-bg-newtag mat-well">New</span>
            <span v-else-if="bgTop5Clear" class="td-bg-newtag clear mat-well">Default</span>
          </div>
          <div class="td-bg-actions">
            <button type="button" class="td-btn-sm mat-skeuo-sm mat-pressable-sm" @click="pickBgImage('top5')"><i class="fa-solid fa-upload"></i> {{ bgTop5Preview ? 'Replace' : 'Upload' }}</button>
            <button v-if="bgTop5New || bgTop5Clear" type="button" class="btn-clear-filters mat-skeuo-sm mat-pressable-danger" @click="undoBgChange('top5')"><i class="fa-solid fa-rotate-left"></i> Undo</button>
            <button v-else-if="bgTop5Current" type="button" class="btn-clear-filters mat-skeuo-sm mat-pressable-danger" @click="resetBgDefault('top5')"><i class="fa-solid fa-arrow-rotate-left"></i> Use Default</button>
          </div>
          <input ref="bgTop5Input" type="file" accept="image/*" class="td-hidden" @change="(e) => handleBgFile(e, 'top5')" />
        </div>
      </div>
      <div class="td-arr-actions">
        <span class="td-arr-hint"><i class="fa-solid fa-circle-info"></i> Wide landscape photos work best Ã¢â‚¬â€ they sit behind dark overlays. "Use Default" reverts to the built-in photo.</span>
        <button class="td-btn-save mat-skeuo-filled mat-pressable-filled" @click="saveBackgrounds" :disabled="bgSaving">
          <span><i class="fa-solid fa-floppy-disk"></i> Save Backgrounds</span>
        </button>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="td-toolbar">
      <div class="td-toolbar-left">
        <div class="td-search">
          <i class="fa-solid fa-magnifying-glass td-search-icon"></i>
          <input v-model="searchQuery" type="text" class="td-search-input" placeholder="Search name, location, descriptionÃ¢â‚¬Â¦" />
          <button v-if="searchQuery" class="td-search-clear mat-skeuo-sm mat-pressable-danger" @click="searchQuery = ''"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="td-filters">
          <div class="td-filter-wrap">
            <label class="td-filter-label">Barangay</label>
            <select v-model="filterBarangay" class="td-select">
              <option value="all">All</option>
              <option v-for="b in usedBarangays" :key="b" :value="b">{{ b }}</option>
            </select>
          </div>
          <div class="td-filter-wrap">
            <label class="td-filter-label">Status</label>
            <select v-model="filterStatus" class="td-select">
              <option value="all">All</option>
              <option value="Active">Active</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
          <div class="td-filter-wrap">
            <label class="td-filter-label">Sort</label>
            <select v-model="sortBy" class="td-select">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
            </select>
          </div>
        </div>
      </div>
      <div class="td-toolbar-right">
        <button v-if="activeFilterCount > 0" class="btn-clear-filters mat-skeuo-sm mat-pressable-danger" @click="clearAllFilters">
          <i class="fa-solid fa-filter-circle-xmark"></i> Clear ({{ activeFilterCount }})
        </button>
        <div class="td-view-toggle">
          <button class="td-view-btn mat-skeuo-sm mat-pressable-sm" :class="{ active: viewMode === 'grid' }" @click="viewMode = 'grid'" title="Grid view">
            <i class="fa-solid fa-grip"></i>
          </button>
          <button class="td-view-btn mat-skeuo-sm mat-pressable-sm" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'" title="List view">
            <i class="fa-solid fa-list"></i>
          </button>
          <button class="td-view-btn mat-skeuo-sm mat-pressable-sm" :class="{ active: viewMode === 'compact' }" @click="viewMode = 'compact'" title="Compact view">
            <i class="fa-solid fa-table-cells"></i>
          </button>
        </div>
      </div>
    </div>

    <div v-if="viewMode === 'grid'" class="td-grid">
      <div v-if="filtered.length === 0" class="td-empty">
        <i class="fa-solid fa-umbrella-beach"></i>
        <p v-if="destinations.length === 0">No destinations added yet.</p>
        <p v-else>No destinations match your filters.</p>
        <button v-if="destinations.length === 0" class="btn-add-inline mat-skeuo-filled mat-pressable-filled" @click="openAdd"><i class="fa-solid fa-plus"></i> Add First Destination</button>
        <button v-else class="btn-add-inline mat-skeuo-filled mat-pressable-filled" @click="clearAllFilters"><i class="fa-solid fa-rotate-left"></i> Clear Filters</button>
      </div>
      <div v-else v-for="item in filtered" :key="item.id" class="td-card">
        <div class="td-card-img" :style="item.image ? { backgroundImage: `url(${item.image})` } : {}">
          <span class="td-badge mat-well" :class="(item.status || 'Active').toLowerCase()">{{ item.status || 'Active' }}</span>
          <div class="td-card-overlay">
            <button class="td-ov-btn edit mat-skeuo-sm mat-pressable-sm" @click="openEdit(item)" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button class="td-ov-btn delete mat-skeuo-sm mat-pressable-sm" @click="confirmDelete(item)" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
          <div v-if="!item.image" class="td-card-placeholder"><i class="fa-solid fa-umbrella-beach"></i></div>
        </div>
        <div class="td-card-body" @click="openEdit(item)">
          <h3 class="td-card-name">{{ item.name }}</h3>
          <div class="td-card-meta">
            <span class="td-card-loc" v-if="item.location"><i class="fa-solid fa-location-dot"></i> {{ item.location }}</span>
            <span class="td-card-coords" v-if="item.lat && item.lng"><i class="fa-solid fa-location-crosshairs"></i> {{ item.lat }}, {{ item.lng }}</span>
          </div>
          <p class="td-card-desc" v-if="item.description">{{ item.description }}</p>
          <div class="td-card-activities" v-if="item.activities && item.activities.length">
            <span v-for="(a, i) in item.activities.slice(0, 3)" :key="i" class="td-act-tag mat-well">{{ a.name || a }}</span>
            <span v-if="item.activities.length > 3" class="td-act-more">+{{ item.activities.length - 3 }}</span>
          </div>
          <div class="td-card-gallery" v-if="galleryImages(item).length">
            <div v-for="(img, gi) in galleryImages(item).slice(0, 4)" :key="gi" class="td-card-gallery-thumb" :style="{ backgroundImage: `url(${img})` }" :title="`Gallery photo ${gi + 1}`"></div>
            <span v-if="galleryImages(item).length > 4" class="td-card-gallery-more">+{{ galleryImages(item).length - 4 }}</span>
          </div>
          <div class="td-card-footer">
            <span class="td-card-date">{{ formatDate(item.created_at) }}</span>
            <span class="td-card-contact" v-if="item.contact || item.fb_page">
              <span v-if="item.contact"><i class="fa-solid fa-phone"></i> {{ item.contact }}</span>
              <a v-if="item.fb_page" :href="item.fb_page.startsWith('http') ? item.fb_page : 'https://www.facebook.com/' + item.fb_page" target="_blank" rel="noopener noreferrer" @click.stop><i class="fa-brands fa-facebook-f"></i> Facebook</a>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â LIST VIEW Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â -->
    <div v-else-if="viewMode === 'list'" class="td-list-wrap">
      <div v-if="filtered.length === 0" class="td-empty">
        <i class="fa-solid fa-umbrella-beach"></i>
        <p v-if="destinations.length === 0">No destinations added yet.</p>
        <p v-else>No destinations match your filters.</p>
        <button v-if="destinations.length === 0" class="btn-add-inline mat-skeuo-filled mat-pressable-filled" @click="openAdd"><i class="fa-solid fa-plus"></i> Add First Destination</button>
        <button v-else class="btn-add-inline mat-skeuo-filled mat-pressable-filled" @click="clearAllFilters"><i class="fa-solid fa-rotate-left"></i> Clear Filters</button>
      </div>
      <div v-else class="td-list-table">
        <div class="td-list-header">
          <span class="td-lh-col td-lh-img"></span>
          <span class="td-lh-col td-lh-name">Name</span>
          <span class="td-lh-col td-lh-loc">Location</span>
          <span class="td-lh-col td-lh-coords">Coordinates</span>
          <span class="td-lh-col td-lh-contact">Contact</span>
          <span class="td-lh-col td-lh-status">Status</span>
          <span class="td-lh-col td-lh-date">Added</span>
          <span class="td-lh-col td-lh-actions">Actions</span>
        </div>
        <div v-for="item in filtered" :key="item.id" class="td-list-row" @click="openEdit(item)">
          <span class="td-lr-col td-lr-img">
            <div class="td-list-thumb" :style="item.image ? { backgroundImage: `url(${item.image})` } : {}">
              <i v-if="!item.image" class="fa-solid fa-umbrella-beach"></i>
            </div>
          </span>
          <span class="td-lr-col td-lr-name">
            <strong>{{ item.name }}</strong>
            <small v-if="item.description">{{ item.description.substring(0, 60) }}{{ item.description.length > 60 ? 'Ã¢â‚¬Â¦' : '' }}</small>
          </span>
          <span class="td-lr-col td-lr-loc">{{ item.location || 'Ã¢â‚¬â€' }}</span>
          <span class="td-lr-col td-lr-coords" v-if="item.lat && item.lng">{{ item.lat }}, {{ item.lng }}</span>
          <span class="td-lr-col td-lr-coords" v-else>Ã¢â‚¬â€</span>
          <span class="td-lr-col td-lr-contact">{{ item.contact || 'Ã¢â‚¬â€' }}</span>
          <span class="td-lr-col td-lr-status">
            <span class="td-status-pill mat-well" :class="(item.status || 'Active').toLowerCase()">{{ item.status || 'Active' }}</span>
          </span>
          <span class="td-lr-col td-lr-date">{{ formatDate(item.created_at) }}</span>
          <span class="td-lr-col td-lr-actions" @click.stop>
            <button class="td-act-btn edit mat-skeuo-sm mat-pressable-sm" @click="openEdit(item)" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button class="td-act-btn delete mat-skeuo-sm mat-pressable-sm" @click="confirmDelete(item)" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </span>
        </div>
      </div>
    </div>

    <!-- Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â COMPACT VIEW Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â -->
    <div v-else-if="viewMode === 'compact'" class="td-compact-wrap">
      <div v-if="filtered.length === 0" class="td-empty">
        <i class="fa-solid fa-umbrella-beach"></i>
        <p v-if="destinations.length === 0">No destinations added yet.</p>
        <p v-else>No destinations match your filters.</p>
        <button v-if="destinations.length === 0" class="btn-add-inline mat-skeuo-filled mat-pressable-filled" @click="openAdd"><i class="fa-solid fa-plus"></i> Add First Destination</button>
        <button v-else class="btn-add-inline mat-skeuo-filled mat-pressable-filled" @click="clearAllFilters"><i class="fa-solid fa-rotate-left"></i> Clear Filters</button>
      </div>
      <div v-else v-for="item in filtered" :key="item.id" class="td-compact-row" @click="openEdit(item)">
        <div class="td-compact-thumb" :style="item.image ? { backgroundImage: `url(${item.image})` } : {}">
          <i v-if="!item.image" class="fa-solid fa-umbrella-beach"></i>
        </div>
        <div class="td-compact-body">
          <span class="td-compact-name">{{ item.name }}</span>
          <span class="td-compact-meta">
            <span v-if="item.location"><i class="fa-solid fa-location-dot"></i> {{ item.location }}</span>
            <span v-if="item.contact"> Ã‚Â· <i class="fa-solid fa-phone"></i> {{ item.contact }}</span>
            <span v-if="item.fb_page"> Ã‚Â· <i class="fa-brands fa-facebook-f"></i> Facebook</span>
          </span>
        </div>
        <span class="td-status-pill mat-well" :class="(item.status || 'Active').toLowerCase()">{{ item.status || 'Active' }}</span>
        <div class="td-compact-actions" @click.stop>
          <button class="td-act-btn edit mat-skeuo-sm mat-pressable-sm" @click="openEdit(item)"><i class="fa-solid fa-pen"></i></button>
          <button class="td-act-btn delete mat-skeuo-sm mat-pressable-sm" @click="confirmDelete(item)"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    </div>

    <!-- Footer count -->
    <div v-if="destinations.length > 0" class="td-footer">
      Showing <strong>{{ filtered.length }}</strong> of <strong>{{ destinations.length }}</strong> destinations
      <span class="td-footer-view">View: <strong>{{ viewMode }}</strong></span>
    </div>

    <!-- Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â ADD/EDIT MODAL Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â -->
    <Transition name="modal">
      <div v-if="showModal" class="td-modal-overlay" @click.self="closeModal">
        <div class="td-modal mat-glass-strong">
          <div class="td-modal-head">
            <div class="td-modal-head-left">
              <div class="td-modal-icon"><i class="fa-solid fa-umbrella-beach"></i></div>
              <div>
                <h2 class="td-modal-title">{{ isEditing ? 'Edit Destination' : 'Add New Destination' }}</h2>
                <p class="td-modal-sub">{{ isEditing ? 'Update destination details' : 'Register a new tourist spot' }}</p>
              </div>
            </div>
            <button class="td-modal-close" @click="closeModal"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="td-modal-body">
            <div class="td-form-row">
              <div class="td-fg">
                <label>Destination Name <span class="td-req">*</span></label>
                <input v-model="form.name" type="text" placeholder="e.g. Infinity Farm" />
              </div>
              <div class="td-fg">
                <label>Status</label>
                <select v-model="form.status">
                  <option value="Active">Active</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
            </div>
            <div class="td-form-row">
              <div class="td-fg">
                <label>Barangay / Location</label>
                <select v-model="form.location">
                  <option value="">Select barangayÃ¢â‚¬Â¦</option>
                  <option v-for="b in barangays" :key="b" :value="b">{{ b }}</option>
                </select>
              </div>
              <div class="td-fg">
                <label>Contact Number</label>
                <input v-model="form.contact" type="text" placeholder="0912-345-6789" />
              </div>
            </div>
            <div class="td-fg">
              <label>Facebook Page</label>
              <input v-model="form.fb_page" type="text" placeholder="Facebook page link (URL) or page name" />
            </div>
            <div class="td-form-row">
              <div class="td-fg">
                <label>Total Tourist Arrivals <span class="td-arr-help-inline">&mdash; shown in this destination's story; blank = hidden</span></label>
                <input v-model.number="form.total_arrivals" type="number" min="0" placeholder="e.g. 8696" />
              </div>
              <div></div>
            </div>
            <div class="td-form-row">
              <div class="td-fg">
                <label>Latitude</label>
                <input v-model="form.lat" type="number" step="any" placeholder="13.3500" />
              </div>
              <div class="td-fg">
                <label>Longitude</label>
                <input v-model="form.lng" type="number" step="any" placeholder="121.1000" />
              </div>
            </div>
            <div class="td-fg">
              <label>Map Location <span class="td-arr-help-inline">Ã¢â‚¬â€ search by name, barangay, Google Plus Code (e.g. "8347+8X"), Google Maps link, or "lat, lng"</span></label>

              <div class="td-map-search">
                <input v-model="mapSearchQuery" type="text" placeholder='Search "Tagbungan", "San Ignacio", a Plus Code "8347+8X", a Google link, or "13.35, 121.10"' @keyup.enter="searchPlace" />
                <button type="button" class="td-btn-sm mat-skeuo-sm mat-pressable-sm" @click="searchPlace" :disabled="mapSearching">
                  <i class="fa-solid" :class="mapSearching ? 'fa-spinner fa-spin' : 'fa-magnifying-glass'"></i> Search
                </button>
                <button type="button" class="td-btn-sm td-btn-loc mat-skeuo-sm mat-pressable-sm" @click="useMyLocation" :disabled="mapLocating">
                  <i class="fa-solid" :class="mapLocating ? 'fa-spinner fa-spin' : 'fa-crosshairs'"></i> My Location
                </button>
              </div>

              <ul v-if="mapSearchResults.length" class="td-map-results">
                <li v-for="(r, i) in mapSearchResults" :key="i" @click="applySearchResult(r)">
                  <i class="fa-solid fa-location-dot"></i>
                  <span class="td-map-res-text">
                    <strong>{{ r.label }}</strong>
                    <small>{{ r.sub }}</small>
                  </span>
                  <span class="td-map-res-tag mat-well" :class="'src-' + r.source">{{ sourceLabel(r.source) }}</span>
                </li>
              </ul>
              <p v-if="mapSearchError" class="td-map-error"><i class="fa-solid fa-triangle-exclamation"></i> {{ mapSearchError }}</p>

              <div ref="pickerMapEl" class="td-picker-map"></div>

              <div v-if="form.lat && form.lng" class="td-pin-chip mat-well">
                <i class="fa-solid fa-location-dot"></i>
                <span>Pinned: {{ form.lat }}, {{ form.lng }}</span>
                                <a v-if="gmapsPreviewUrl" :href="gmapsPreviewUrl" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-google"></i> Preview</a>
                <button type="button" @click="clearPin"><i class="fa-solid fa-xmark"></i> Clear</button>
              </div>
            </div>
            <div class="td-fg">
              <label>Description</label>
              <textarea v-model="form.description" rows="3" placeholder="A serene destination known forÃ¢â‚¬Â¦"></textarea>
            </div>
            <div class="td-fg">
              <label>Main Image</label>
              <div class="td-upload" @click="$refs.mainImgInput.click()">
                <div v-if="form.image" class="td-upload-preview">
                  <img :src="form.image" alt="Preview" />
                  <button class="td-upload-remove mat-skeuo-sm mat-pressable-danger" @click.stop="form.image = ''"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div v-else class="td-upload-placeholder">
                  <i class="fa-solid fa-cloud-arrow-up"></i>
                  <span>Click to upload image</span>
                </div>
              </div>
              <input ref="mainImgInput" type="file" accept="image/*" class="td-hidden" @change="handleImage" />
            </div>
            <div class="td-activities-section">
              <div class="td-activities-header">
                <label>Key Features / Activities</label>
                <button type="button" class="td-btn-sm mat-skeuo-sm mat-pressable-sm" @click="addActivity"><i class="fa-solid fa-plus"></i> Add</button>
              </div>
              <div v-if="form.activities.length === 0" class="td-activities-empty">No activities added yet.</div>
              <div v-for="(act, i) in form.activities" :key="i" class="td-activity-row">
                <div class="td-activity-inputs">
                  <input v-model="act.name" type="text" :placeholder="`Activity ${i + 1} name`" />
                  <input type="file" accept="image/*" @change="(e) => handleActivityImage(e, i)" />
                </div>
                <button class="td-activity-remove mat-skeuo-sm mat-pressable-danger" @click="removeActivity(i)"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          </div>
          <div class="td-modal-footer">
            <button class="td-btn-cancel mat-skeuo-sm mat-pressable-danger" @click="closeModal">Cancel</button>
            <button class="td-btn-save mat-skeuo-filled mat-pressable-filled" @click="save" :disabled="submitting || !form.name.trim()">
              <span><i class="fa-solid fa-floppy-disk"></i> {{ isEditing ? 'Update' : 'Create' }} Destination</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â DELETE MODAL Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â -->
    <Transition name="modal">
      <div v-if="showDeleteModal" class="td-modal-overlay" @click.self="cancelDelete">
        <div class="td-modal td-modal-sm mat-glass-strong">
          <div class="td-modal-head">
            <div class="td-modal-head-left">
              <div class="td-modal-icon danger"><i class="fa-solid fa-trash-can"></i></div>
              <div>
                <h2 class="td-modal-title">Confirm Removal</h2>
                <p class="td-modal-sub">This action cannot be undone</p>
              </div>
            </div>
            <button class="td-modal-close" @click="cancelDelete"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="td-modal-body">
            <p>Are you sure you want to remove <strong>"{{ deleteTarget?.name }}"</strong>?</p>
          </div>
          <div class="td-modal-footer">
            <button class="td-btn-cancel mat-skeuo-sm mat-pressable-danger" @click="cancelDelete">Cancel</button>
            <button class="td-btn-delete mat-skeuo-sm mat-pressable-danger" @click="executeDelete" :disabled="submitting">
              <span><i class="fa-solid fa-trash-can"></i> Yes, Remove</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
.td {
  font-family: var(--font-body);
  height: 100%;
  overflow-y: auto;
  padding: 28px 32px 48px;
  background: var(--bg);
  position: relative;
  color: var(--fg2);
}
.td::-webkit-scrollbar { width: 5px; }
.td::-webkit-scrollbar-track { background: transparent; }
.td::-webkit-scrollbar-thumb { background: var(--bdr2); border-radius: 3px; }
.td::-webkit-scrollbar-thumb:hover { background: var(--bdr3); }

/* Toast */
.toast {
  position: fixed; top: 24px; right: 24px; z-index: 9999;
  display: flex; align-items: center; gap: 10px;
  padding: 12px 20px; border-radius: var(--r-md);
  font-size: .84rem; font-weight: 600;
  box-shadow: var(--shadow-md);
  font-family: var(--font-body);
  background: var(--card-solid);
  border: 1px solid var(--bdr);
}
.toast.success { color: var(--ok); border-left: 3px solid var(--ok); }
.toast.info { color: var(--tl); border-left: 3px solid var(--tl); }
.toast.warning { color: var(--wn); border-left: 3px solid var(--wn); }
.toast-enter-active, .toast-leave-active { transition: all .3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-12px); }

/* Header */
.td-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
.td-eyebrow { display: flex; align-items: center; gap: 8px; font-size: .62rem; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; color: var(--ac); margin-bottom: 5px; }
.eyebrow-line { width: 20px; height: 2px; background: var(--ac); border-radius: 1px; }
.td-title { font-family: var(--font-display); font-size: 1.75rem; font-weight: 700; color: var(--fg); line-height: 1.1; }
.td-accent { color: var(--ac); }
.td-sub { font-size: .82rem; color: var(--mt); margin-top: 4px; }
.btn-add { display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: var(--r-sm); font-family: var(--font-body); font-size: .78rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; cursor: pointer; flex-shrink: 0; }
.btn-add:hover { transform: translateY(-2px); box-shadow: 0 6px 20px var(--acg); }
.btn-add-inline { display: inline-flex; align-items: center; gap: 7px; padding: 10px 20px; border-radius: var(--r-sm); font-family: var(--font-body); font-size: .78rem; font-weight: 700; cursor: pointer; margin-top: 14px; }

/* Stats */
.td-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 22px; }
.td-stat {
  background: var(--card-solid); border-radius: var(--r-md); border: 1px solid var(--bdr);
  padding: 14px 16px; display: flex; align-items: center; gap: 12px;
  box-shadow: var(--shadow-sm);
}
.td-stat-icon { width: 40px; height: 40px; border-radius: var(--r-sm); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 1rem; }
.td-stat-icon.navy { background: var(--acs); color: var(--ac); }
.td-stat-icon.green { background: var(--oks); color: var(--ok); }
.td-stat-icon.red { background: var(--dgs); color: var(--dg); }
.td-stat-icon.gold { background: var(--wns); color: var(--wn); }
.td-stat-icon.teal { background: var(--tls); color: var(--tl); }
.td-stat-val { display: block; font-size: 1.2rem; font-weight: 800; color: var(--fg); line-height: 1; }
.td-stat-label { display: block; font-size: .64rem; color: var(--mt); font-weight: 600; text-transform: uppercase; letter-spacing: .06em; margin-top: 2px; }

/* Shared analytics-card shell (used by Tourist Arrivals + Backgrounds cards) */
.td-analytics { background: var(--card-solid); border: 1px solid var(--bdr); border-radius: var(--r-md); box-shadow: var(--shadow-sm); padding: 18px 20px; margin-bottom: 20px; }
.td-analytics-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
.td-analytics-eyebrow { display: flex; align-items: center; gap: 7px; font-size: .62rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--tl); margin-bottom: 4px; }
.td-analytics-head h2 { font-size: 1.05rem; font-weight: 700; color: var(--fg); margin: 0 0 3px; }
.td-analytics-head p { font-size: .78rem; color: var(--mt); margin: 0; }
.td-analytics-loading { display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--mt); font-size: .84rem; padding: 20px 0; }

/* Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â Tourist Arrivals (quarterly) Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â */
.td-arr-eyebrow { color: var(--wn); }
.td-arr-period { display: flex; gap: 6px; align-items: center; flex-shrink: 0; flex-wrap: wrap; }
.td-arr-year { width: 84px; padding: 8px 10px; border: 1px solid var(--bdr); border-radius: var(--r-sm); background: var(--bg2); color: var(--fg); font-family: var(--font-body); font-size: .84rem; font-weight: 700; outline: none; text-align: center; }
.td-arr-year:focus { border-color: var(--ac); }
.td-arr-q { padding: 8px 13px; border: 1px solid var(--bdr); background: var(--bg2); color: var(--mt); border-radius: var(--r-sm); font-family: var(--font-body); font-size: .78rem; font-weight: 700; cursor: pointer; transition: all .15s; }
.td-arr-q:hover { color: var(--fg); border-color: var(--bdr2); }
.td-arr-q.active { background: linear-gradient(135deg, var(--m-accent-hi), var(--m-accent-solid)); color: #fff; border-color: transparent; }
.td-arr-note { font-size: .78rem; color: var(--wn); background: var(--wns); border-radius: var(--r-sm); padding: 8px 12px; margin-bottom: 14px; display: flex; align-items: center; gap: 7px; }
.td-arr-fields { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
.td-arr-fields .td-fg { margin-bottom: 0; }
.td-arr-field small.td-arr-help { display: block; font-size: .66rem; color: var(--mt2); line-height: 1.4; margin-bottom: 4px; }
.td-arr-help-inline { font-weight: 600; text-transform: none; letter-spacing: 0; font-size: .72rem; color: var(--mt2); margin-left: 6px; }
.td-arr-attr { border: 1px solid var(--bdr); border-radius: var(--r-sm); padding: 14px; background: var(--bg2); }
.td-arr-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.td-arr-row:last-child { margin-bottom: 0; }
.td-arr-row input { padding: 8px 12px; border: 1px solid var(--bdr); border-radius: var(--r-sm); font-family: var(--font-body); font-size: .84rem; color: var(--fg); background: var(--card-solid); outline: none; transition: border-color .15s; min-width: 0; }
.td-arr-row input:focus { border-color: var(--ac); }
.td-arr-row input:first-of-type { flex: 1; }
.td-arr-vis { width: 110px; flex-shrink: 0; }
.td-arr-rank { width: 26px; height: 26px; border-radius: 50%; background: var(--acs); color: var(--ac); font-size: .72rem; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.td-arr-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 14px; flex-wrap: wrap; }
.td-arr-hint { font-size: .74rem; color: var(--mt); display: flex; align-items: center; gap: 6px; }
.td-arr-hint i { color: var(--tl); }
@media (max-width: 900px) { .td-arr-fields { grid-template-columns: 1fr; } }
@media (max-width: 560px) { .td-arr-row { flex-wrap: wrap; } .td-arr-row input:first-of-type { flex: 1 1 100%; order: 2; } .td-arr-vis { flex: 1; order: 3; width: auto; } }

/* Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â Arrivals Section Backgrounds Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â */
.td-bg-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 6px; }
.td-bg-item label { font-size: .68rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--mt); display: block; margin-bottom: 6px; }
.td-bg-preview { position: relative; height: 130px; border-radius: var(--r-sm); background-size: cover; background-position: center; background-color: var(--bg3); border: 1px solid var(--bdr); overflow: hidden; display: flex; align-items: center; justify-content: center; }
.td-bg-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--mt2); font-size: .78rem; }
.td-bg-empty i { font-size: 1.4rem; opacity: .6; }
.td-bg-newtag { position: absolute; top: 8px; right: 8px; padding: 3px 10px; border-radius: var(--r-sm); font-size: .62rem; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }
.td-bg-newtag.clear { background: var(--wn); color: var(--fg); }
.td-bg-actions { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
@media (max-width: 700px) { .td-bg-grid { grid-template-columns: 1fr; } }

/* Toolbar */
.td-toolbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 20px; flex-wrap: wrap; }
.td-toolbar-left { display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0; flex-wrap: wrap; }
.td-toolbar-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.td-search { position: relative; flex: 1; min-width: 220px; }
.td-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--mt); font-size: .85rem; pointer-events: none; }
.td-search-input {
  width: 100%; padding: 9px 32px 9px 36px;
  border: 1px solid var(--bdr); border-radius: var(--r-sm);
  font-family: var(--font-body); font-size: .84rem; color: var(--fg);
  background: var(--bg2); outline: none; transition: border-color .15s;
}
.td-search-input:focus { border-color: var(--ac); }
.td-search-input::placeholder { color: var(--mt2); }
.td-search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); cursor: pointer; font-size: .8rem; padding: 4px; display: flex; align-items: center; justify-content: center; }
.td-search-clear:hover { color: var(--dg); }
.td-filters { display: flex; gap: 8px; flex-wrap: wrap; }
.td-filter-wrap { display: flex; flex-direction: column; gap: 3px; }
.td-filter-label { font-size: .6rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--mt2); }
.td-select {
  padding: 8px 10px; border: 1px solid var(--bdr); border-radius: var(--r-sm);
  font-family: var(--font-body); font-size: .8rem; color: var(--fg);
  background: var(--bg2); cursor: pointer; outline: none; min-width: 110px;
}
.td-select:focus { border-color: var(--ac); }
.btn-clear-filters { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: var(--r-sm); font-family: var(--font-body); font-size: .76rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn-clear-filters:hover { border-color: var(--dg); color: var(--dg); background: var(--dgs); }

/* View Toggle */
.td-view-toggle { display: flex; border: 1px solid var(--bdr); border-radius: var(--r-sm); overflow: hidden; }
.td-view-btn { width: 36px; height: 36px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: .82rem; border-right: 1px solid var(--bdr); }
.td-view-btn:last-child { border-right: none; }
.td-view-btn:hover { color: var(--fg); background: var(--card3); }
.td-view-btn.active { background: linear-gradient(135deg, var(--m-accent-hi), var(--m-accent-solid)); color: white; }

/* Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â GRID VIEW Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â */
.td-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; }
.td-empty { grid-column: 1 / -1; text-align: center; padding: 56px 20px; color: var(--mt); }
.td-empty i { font-size: 2.5rem; display: block; margin-bottom: 12px; opacity: .3; }
.td-empty p { font-size: .88rem; }
.td-card {
  background: var(--card-solid); border-radius: var(--r-md); overflow: hidden;
  border: 1px solid var(--bdr); cursor: pointer;
  transition: all .2s var(--ease); box-shadow: var(--shadow-sm);
}
.td-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); border-color: var(--ac); }
.td-card-img { position: relative; height: 190px; background-size: cover; background-position: center; background-color: var(--bg3); }
.td-card-placeholder { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; color: var(--mt2); }
.td-badge { position: absolute; top: 10px; right: 10px; padding: 3px 10px; border-radius: var(--r-sm); font-size: .62rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
.td-badge.active { background: var(--ok); color: var(--fg); }
.td-badge.closed { background: var(--dg-solid); color: white; }
.td-card-overlay { position: absolute; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; gap: 10px; opacity: 0; transition: opacity .2s; }
.td-card:hover .td-card-overlay { opacity: 1; }
.td-ov-btn { width: 38px; height: 38px; border-radius: var(--r-sm); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: .85rem; }
.td-ov-btn.edit:hover { background: var(--m-accent-solid); border-color: var(--m-accent-solid); color: white; }
.td-ov-btn.delete:hover { background: var(--dg-solid); border-color: var(--dg-solid); }
.td-card-body { padding: 16px; }
.td-card-name { font-size: .95rem; font-weight: 700; color: var(--fg); margin: 0 0 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.td-card-meta { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 8px; }
.td-card-loc { font-size: .78rem; color: var(--ac); font-weight: 600; display: flex; align-items: center; gap: 4px; }
.td-card-loc i { font-size: .7rem; }
.td-card-coords { font-size: .72rem; color: var(--mt); font-weight: 500; display: flex; align-items: center; gap: 4px; font-family: var(--font-mono); }
.td-card-coords i { font-size: .7rem; }
.td-card-desc { font-size: .78rem; color: var(--mt); margin: 0 0 10px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.5; }
.td-card-activities { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
.td-act-tag { padding: 2px 8px; border-radius: var(--r-sm); font-size: .68rem; font-weight: 600; }
.td-act-more { padding: 2px 8px; border-radius: var(--r-sm); font-size: .68rem; font-weight: 700; background: var(--bdr); color: var(--mt); }
.td-card-gallery { display: flex; gap: 6px; margin-bottom: 10px; }
.td-card-gallery-thumb { width: 44px; height: 44px; border-radius: var(--r-sm); background-size: cover; background-position: center; background-color: var(--bg3); border: 1px solid var(--bdr); flex-shrink: 0; }
.td-card-gallery-more { width: 44px; height: 44px; border-radius: var(--r-sm); background: var(--bg2); border: 1px solid var(--bdr); color: var(--mt); font-size: .72rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.td-card-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid var(--bdr); }
.td-card-date { font-size: .7rem; color: var(--mt2); }
.td-card-contact { font-size: .7rem; color: var(--mt); display: flex; align-items: center; gap: 4px; }
.td-card-contact i { font-size: .6rem; }


/* Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â LIST VIEW Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â */
.td-list-wrap { background: var(--card-solid); border-radius: var(--r-md); border: 1px solid var(--bdr); overflow: hidden; }
.td-list-header { display: flex; align-items: center; padding: 10px 16px; background: var(--bg3); border-bottom: 1px solid var(--bdr); gap: 12px; }
.td-lh-col { font-size: .62rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--mt); white-space: nowrap; }
.td-lh-img { width: 48px; flex-shrink: 0; }
.td-lh-name { flex: 2; min-width: 160px; }
.td-lh-loc { flex: 1; min-width: 120px; }
.td-lh-coords { flex: 1; min-width: 130px; }
.td-lh-contact { flex: 1; min-width: 100px; }
.td-lh-status { width: 80px; flex-shrink: 0; text-align: center; }
.td-lh-date { width: 100px; flex-shrink: 0; }
.td-lh-actions { width: 80px; flex-shrink: 0; text-align: center; }
.td-list-row { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--bdr); cursor: pointer; transition: background .12s; gap: 12px; }
.td-list-row:last-child { border-bottom: none; }
.td-list-row:hover { background: var(--card2); }
.td-lr-col { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.td-lr-img { width: 48px; flex-shrink: 0; }
.td-list-thumb { width: 40px; height: 40px; border-radius: var(--r-sm); flex-shrink: 0; background-size: cover; background-position: center; background-color: var(--bg3); display: flex; align-items: center; justify-content: center; color: var(--mt2); font-size: .85rem; }
.td-lr-name { flex: 2; min-width: 160px; display: flex; flex-direction: column; gap: 2px; }
.td-lr-name strong { font-size: .86rem; color: var(--fg); font-weight: 700; }
.td-lr-name small { font-size: .72rem; color: var(--mt); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.td-lr-loc { flex: 1; min-width: 120px; font-size: .82rem; color: var(--fg2); }
.td-lr-coords { flex: 1; min-width: 130px; font-size: .76rem; color: var(--mt); font-family: var(--font-mono); }
.td-lr-contact { flex: 1; min-width: 100px; font-size: .82rem; color: var(--fg2); }
.td-lr-status { width: 80px; flex-shrink: 0; display: flex; justify-content: center; }
.td-lr-date { width: 100px; flex-shrink: 0; font-size: .76rem; color: var(--mt); }
.td-lr-actions { width: 80px; flex-shrink: 0; display: flex; justify-content: center; gap: 6px; }
.td-status-pill { display: inline-block; padding: 3px 10px; border-radius: 10px; font-size: .66rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.td-status-pill.active { background: var(--oks); color: var(--ok); }
.td-status-pill.closed { background: var(--dgs); color: var(--dg); }
.td-act-btn { width: 30px; height: 30px; border-radius: var(--r-sm); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: .78rem; }
.td-act-btn.edit:hover { background: var(--m-accent-solid); color: white; border-color: var(--m-accent-solid); }
.td-act-btn.delete:hover { background: var(--dg-solid); border-color: var(--dg-solid); color: white; }

/* Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â COMPACT VIEW Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â */
.td-compact-wrap { display: flex; flex-direction: column; gap: 6px; }
.td-compact-row { display: flex; align-items: center; gap: 14px; padding: 10px 16px; background: var(--card-solid); border: 1px solid var(--bdr); border-radius: var(--r-sm); cursor: pointer; transition: all .15s; }
.td-compact-row:hover { border-color: var(--ac); box-shadow: var(--shadow-sm); }
.td-compact-thumb { width: 42px; height: 42px; border-radius: var(--r-sm); flex-shrink: 0; background-size: cover; background-position: center; background-color: var(--bg3); display: flex; align-items: center; justify-content: center; color: var(--mt2); font-size: 1rem; }
.td-compact-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.td-compact-name { font-size: .86rem; font-weight: 700; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.td-compact-meta { font-size: .72rem; color: var(--mt); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.td-compact-meta i { font-size: .65rem; margin-right: 2px; }
.td-compact-actions { display: flex; gap: 6px; flex-shrink: 0; }

/* Footer */
.td-footer { padding: 10px 16px; font-size: .78rem; color: var(--mt); margin-top: 16px; background: var(--card-solid); border-radius: var(--r-sm); border: 1px solid var(--bdr); display: flex; justify-content: space-between; }
.td-footer-view { color: var(--mt2); }
.td-footer-view strong { color: var(--fg); }

/* Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â MODAL Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â */
.td-modal-overlay { position: fixed; inset: 0; z-index: 500; background: rgba(0,0,0,.7); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 20px; }
.td-modal { border-radius: var(--r-lg); width: 100%; max-width: 680px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; }
.td-modal-sm { max-width: 420px; }
.td-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid var(--bdr); flex-shrink: 0; background: var(--bg2); }
.td-modal-head-left { display: flex; align-items: center; gap: 14px; }
.td-modal-icon { width: 42px; height: 42px; border-radius: var(--r-sm); flex-shrink: 0; background: var(--acs); color: var(--ac); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
.td-modal-icon.danger { background: var(--dgs); color: var(--dg); }
.td-modal-title { font-family: var(--font-display); font-size: 1.1rem; font-weight: 700; color: var(--fg); margin: 0; }
.td-modal-sub { font-size: .78rem; color: var(--mt); margin-top: 2px; }
.td-modal-close { width: 32px; height: 32px; border: 1px solid var(--bdr); border-radius: var(--r-sm); background: var(--card3); color: var(--mt); font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .15s; }
.td-modal-close:hover { background: var(--dgs); color: var(--dg); border-color: var(--dg); }
.td-modal-body { flex: 1; overflow-y: auto; padding: 20px 22px; }
.td-modal-body::-webkit-scrollbar { width: 4px; }
.td-modal-body::-webkit-scrollbar-track { background: transparent; }
.td-modal-body::-webkit-scrollbar-thumb { background: var(--bdr2); border-radius: 2px; }
.td-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.td-fg { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
.td-form-row .td-fg { margin-bottom: 0; }
.td-fg label { font-size: .68rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--mt); }
.td-req { color: var(--dg); }
.td-fg input, .td-fg select, .td-fg textarea { width: 100%; padding: 9px 12px; border: 1px solid var(--bdr); border-radius: var(--r-sm); font-family: var(--font-body); font-size: .84rem; color: var(--fg); background: var(--bg2); outline: none; transition: border-color .15s; }
.td-fg input:focus, .td-fg select:focus, .td-fg textarea:focus { border-color: var(--ac); background: var(--bg3); }
.td-fg textarea { resize: vertical; }
.td-upload { border: 2px dashed var(--bdr2); border-radius: var(--r-sm); padding: 24px; text-align: center; cursor: pointer; transition: all .15s; color: var(--mt); }
.td-upload:hover { border-color: var(--ac); color: var(--fg); background: var(--acs); }
.td-upload-preview { position: relative; display: inline-block; }
.td-upload-preview img { max-height: 140px; border-radius: var(--r-sm); display: block; }
.td-upload-remove { position: absolute; top: -6px; right: -6px; width: 22px; height: 22px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: .7rem; }
.td-upload-placeholder { display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: .82rem; }
.td-upload-placeholder i { font-size: 1.5rem; }
.td-hidden { display: none; }
.td-activities-section { border: 1px solid var(--bdr); border-radius: var(--r-sm); padding: 14px; background: var(--bg2); }
.td-activities-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.td-activities-header label { font-size: .68rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--mt); }
.td-btn-sm { padding: 4px 10px; border-radius: var(--r-sm); font-size: .75rem; cursor: pointer; font-weight: 700; font-family: var(--font-body); display: flex; align-items: center; gap: 5px; }
.td-btn-sm:hover { background: var(--m-accent-solid); color: white; }
.td-activities-empty { text-align: center; color: var(--mt); font-size: .82rem; padding: 8px 0; }
.td-activity-row { display: flex; gap: 10px; margin-bottom: 8px; align-items: flex-start; }
.td-activity-inputs { flex: 1; display: flex; flex-direction: column; gap: 5px; }
.td-activity-inputs input { width: 100%; }
.td-activity-remove { width: 34px; height: 34px; border-radius: var(--r-sm); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: .8rem; flex-shrink: 0; margin-top: 1px; }
.td-activity-remove:hover { background: var(--dg-solid); color: white; }
.td-modal-footer { padding: 16px 22px; border-top: 1px solid var(--bdr); display: flex; justify-content: flex-end; gap: 10px; background: var(--bg2); flex-shrink: 0; }
.td-btn-cancel { padding: 9px 20px; border-radius: var(--r-sm); cursor: pointer; font-size: .84rem; font-weight: 600; font-family: var(--font-body); }
.td-btn-cancel:hover { border-color: var(--bdr2); color: var(--fg); }
.td-btn-save { padding: 9px 22px; border-radius: var(--r-sm); font-family: var(--font-body); font-size: .84rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; }
.td-btn-save:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px var(--acg); }
.td-btn-save:disabled { opacity: .6; cursor: not-allowed; }
.td-btn-delete { padding: 9px 22px; border-radius: var(--r-sm); font-family: var(--font-body); font-size: .84rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; }
.td-btn-delete:hover:not(:disabled) { filter: brightness(1.1); }
.td-btn-delete:disabled { opacity: .6; cursor: not-allowed; }
.modal-enter-from .td-modal, .modal-leave-to .td-modal { transform: translateY(16px) scale(.98); opacity: 0; }
.modal-enter-from, .modal-leave-to { background: transparent; }

/* Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â Ã°Å¸â€”ÂºÃ¯Â¸Â Map Location Picker Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â */
.td-picker-map { width: 100%; height: 260px; border-radius: var(--r-sm); border: 1px solid var(--bdr); background: var(--bg3); }

/* Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â Ã°Å¸â€”ÂºÃ¯Â¸Â Map search (Google Geocoding) Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â */
.td-map-search { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.td-map-search input {
  flex: 1; min-width: 200px; padding: 9px 12px;
  border: 1px solid var(--bdr); border-radius: var(--r-sm);
  font-family: var(--font-body); font-size: .84rem; color: var(--fg);
  background: var(--bg2); outline: none; transition: border-color .15s;
}
.td-map-search input:focus { border-color: var(--ac); }
.td-map-search .td-btn-sm { padding: 8px 12px; }
.td-btn-loc:hover { background: var(--tl); color: #fff; }
.td-map-results {
  list-style: none; border: 1px solid var(--bdr); border-radius: var(--r-sm);
  background: var(--card-solid); max-height: 180px; overflow-y: auto;
  margin: -4px 0 8px; padding: 0;
}
.td-map-results li {
  display: flex; align-items: flex-start; gap: 8px; padding: 9px 12px;
  font-size: .8rem; color: var(--fg2); cursor: pointer;
  border-bottom: 1px solid var(--bdr); transition: background .12s;
}
.td-map-results li:last-child { border-bottom: none; }
.td-map-results li:hover { background: var(--acs); }
.td-map-results li i { color: var(--dg); margin-top: 2px; font-size: .7rem; flex-shrink: 0; }
.td-map-error { font-size: .76rem; color: var(--wn); margin: 0 0 8px; display: flex; align-items: center; gap: 6px; }

/* Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â Ã°Å¸â€”ÂºÃ¯Â¸Â Search result rows Ã¢â‚¬â€ two-line with source badge Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â */
.td-map-res-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.td-map-res-text strong { font-size: .8rem; color: var(--fg); font-weight: 700; }
.td-map-res-text small { font-size: .7rem; color: var(--mt); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.td-map-res-tag { flex-shrink: 0; font-size: .58rem; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; padding: 3px 8px; border-radius: var(--r-sm); }
.td-map-res-tag.src-dest { background: var(--oks); color: var(--ok); }
.td-map-res-tag.src-brgy { background: var(--acs); color: var(--ac); }
.td-map-res-tag.src-osm { background: var(--tls); color: var(--tl); }

/* Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â Pin chip Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â */
.td-pin-chip { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 8px; padding: 8px 14px; border-radius: var(--r-sm); font-size: .78rem; font-weight: 700; font-family: var(--font-mono); width: fit-content; }
.td-pin-chip button {
  background: none; border: none; color: var(--dg); cursor: pointer;
  font-size: .72rem; font-weight: 800; display: inline-flex; align-items: center;
  gap: 4px; font-family: var(--font-body); padding: 0;
}
.td-pin-chip button:hover { text-decoration: underline; }
.td-pin-chip a {
  display: inline-flex; align-items: center; gap: 4px; color: var(--tl);
  text-decoration: none; font-size: .72rem; font-weight: 800;
}
.td-pin-chip a:hover { text-decoration: underline; }

/* Responsive */
@media (max-width: 1200px) { .td-stats { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 1024px) { .td-stats { grid-template-columns: repeat(2, 1fr); } .td-lh-coords, .td-lh-contact, .td-lr-coords, .td-lr-contact { display: none; } }
@media (max-width: 768px) {
  .td { padding: 20px 16px; }
  .td-stats { grid-template-columns: repeat(2, 1fr); }
  .td-form-row { grid-template-columns: 1fr; }
  .td-grid { grid-template-columns: 1fr; }
  .td-filters { flex-wrap: wrap; }
  .td-select { flex: 1; min-width: 100px; }
  .td-toolbar { flex-direction: column; }
  .td-toolbar-left { flex-direction: column; width: 100%; }
  .td-search { min-width: 0; width: 100%; }
  .td-toolbar-right { width: 100%; justify-content: space-between; }
  .td-lh-loc, .td-lr-loc, .td-lh-date, .td-lr-date { display: none; }
  .td-picker-map { height: 200px; }
}

</style>