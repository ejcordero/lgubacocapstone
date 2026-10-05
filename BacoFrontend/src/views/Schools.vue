<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const API = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api'

// ═══ GOOGLE MAPS — key comes from frontend .env (VITE_GOOGLE_MAPS_KEY) ═══
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''

// Shared loader — Google must only be injected once per page
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

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const schools = ref([])
const loading = ref(true)
const activeFilter = ref('all')
const selected = ref(null)
const mapFailed = ref(false)

const modalMapEl = ref(null)
let miniMap = null
let modalMap = null

const TYPE_META = {
  elementary: { label: '🏫 Elementary',          cls: 'type-elementary', color: '#3b82f6', emoji: '🏫' },
  highschool: { label: '🎓 High School',         cls: 'type-highschool', color: '#f59e0b', emoji: '🎓' },
  college:    { label: '🏛️ College / Tertiary',  cls: 'type-college',    color: '#10b981', emoji: '🏛️' },
  ipded:      { label: '🌿 IPEd / Mangyan',      cls: 'type-ipded',      color: '#8b5cf6', emoji: '🌿' }
}
const CATEGORIES = [
  { key: 'all',        label: 'All Schools' },
  { key: 'elementary', label: 'Elementary Schools' },
  { key: 'highschool', label: 'High Schools' },
  { key: 'college',    label: 'Colleges & Tertiary' },
  { key: 'ipded',      label: 'IPEd / Mangyan Schools' }
]

const filtered = computed(() =>
  activeFilter.value === 'all' ? schools.value : schools.value.filter(s => s.type === activeFilter.value)
)
const stats = computed(() => ({
  total: schools.value.length,
  elementary: schools.value.filter(s => s.type === 'elementary').length,
  highschool: schools.value.filter(s => s.type === 'highschool').length,
  college: schools.value.filter(s => s.type === 'college').length,
  ipded: schools.value.filter(s => s.type === 'ipded').length
}))
const typeMeta = (s) => TYPE_META[s.type] || TYPE_META.elementary
const isClosed = (s) => s?.status === 'closed'
const hasCoords = (s) => s?.lat != null && s?.lng != null && !isNaN(Number(s.lat)) && !isNaN(Number(s.lng))
const has = (v) => v != null && String(v).trim() !== ''

const placeholderFor = (type) => {
  const c = typeMeta({ type }).color
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='96' height='96' rx='48' fill='${c}26'/><text x='48' y='62' font-size='42' text-anchor='middle'>${typeMeta({ type }).emoji}</text></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}
// Card badge = the admin-uploaded LOGO; school photos appear only in the modal
const logoFor = (s) => s.logo || placeholderFor(s.type)

// Tags tolerate both array and pipe-separated string shapes
const tagsOf = (s) => Array.isArray(s?.tags) ? s.tags : (typeof s?.tags === 'string' && s.tags ? s.tags.split('|').filter(Boolean) : [])

// Modal hero banner — starts as the school photo; gallery clicks swap it
const modalHeroImg = ref(null)
const setHeroImage = (img) => { modalHeroImg.value = img }

// ═══ DISTANCE & DIRECTIONS — same UX as Tourism.vue's story modal ═══
const userLocation = ref(null)   // { lat, lng } from browser Geolocation API
const locating = ref(false)
const locationError = ref('')

// Haversine — straight-line distance between two coordinates (km)
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const toRad = (v) => v * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const schoolDistanceKm = computed(() => {
  const s = selected.value
  if (!s || !userLocation.value || !hasCoords(s)) return null
  const km = haversineKm(userLocation.value.lat, userLocation.value.lng, Number(s.lat), Number(s.lng))
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km).toLocaleString()} km`
})

const gmapsCoord = (lat, lng) => `${Number(lat)},${Number(lng)}`

// Google Maps handoff — auto-fills the origin when the user has located themselves
const gmapsDirUrl = computed(() => {
  const s = selected.value
  if (!hasCoords(s)) return '#'
  const origin = userLocation.value ? `&origin=${gmapsCoord(userLocation.value.lat, userLocation.value.lng)}` : ''
  return `https://www.google.com/maps/dir/?api=1&destination=${gmapsCoord(s.lat, s.lng)}${origin}&travelmode=driving`
})
// Fallback for schools without pinned coordinates — search by name + barangay
const gmapsSearchUrl = computed(() => {
  const s = selected.value
  if (!s) return '#'
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name}, ${s.location || 'Baco'}, Oriental Mindoro`)}`
})

const findMe = () => {
  if (!('geolocation' in navigator)) { locationError.value = 'Your browser does not support location detection.'; return }
  locating.value = true
  locationError.value = ''
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation.value = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      locating.value = false
    },
    (err) => {
      locating.value = false
      locationError.value = err.code === 1
        ? 'Location permission denied. Enable it in your browser settings to see the distance.'
        : 'Could not determine your location. Try again.'
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  )
}

async function fetchSchools () {
  try {
    const res = await fetch(`${API}/schools`)
    if (res.ok) schools.value = await res.json()
  } catch (e) { console.error('Error fetching schools:', e) }
  loading.value = false
  nextTick(() => initMiniMap())
}

// Self-loading — same pattern as Tourism.vue's initMap()
async function initMiniMap () {
  if (miniMap) return
  const el = document.getElementById('miniMap')
  if (!el) return
  let maps
  try { maps = await loadGoogleMaps() } catch (e) { console.warn(e.message); mapFailed.value = true; return }

  miniMap = new maps.Map(el, {
    center: { lat: 13.35, lng: 121.06 },
    zoom: 11,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    gestureHandling: 'cooperative',
  })
  const bounds = new maps.LatLngBounds()
  let pinned = 0
  schools.value.forEach(s => {
    if (!hasCoords(s)) return
    const color = typeMeta(s).color
    const marker = new maps.Marker({
      position: { lat: Number(s.lat), lng: Number(s.lng) },
      map: miniMap,
      title: s.name,
      icon: { path: maps.SymbolPath.CIRCLE, scale: 7, fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 },
    })
    // InfoWindow with a Directions handoff, like the Tourism map
    const iw = new maps.InfoWindow({
      content: `
        <strong style="display:block;font-size:13px;color:#1a202c;margin-bottom:2px">${escapeHtml(s.name)}</strong>
        <span style="display:block;font-size:11px;color:#64748b;margin-bottom:8px">${escapeHtml(s.location || 'Baco, Oriental Mindoro')}</span>
        <a href="https://www.google.com/maps/dir/?api=1&destination=${gmapsCoord(s.lat, s.lng)}" target="_blank" rel="noopener"
           style="display:inline-block;text-decoration:none;background:#0d9488;color:#fff;font-family:system-ui,sans-serif;font-weight:700;font-size:11px;padding:7px 12px;border-radius:100px">Get Directions</a>`,
      maxWidth: 250,
    })
    marker.addListener('click', () => iw.open({ anchor: marker, map: miniMap }))
    bounds.extend(marker.getPosition())
    pinned++
  })
  if (pinned === 1) { miniMap.setCenter(bounds.getCenter()); miniMap.setZoom(12) }
  else if (pinned > 1) miniMap.fitBounds(bounds, 30)
}

async function openModal (s) {
  selected.value = s
  modalHeroImg.value = s.image || null
  userLocation.value = null   // fresh distance per school
  locationError.value = ''
  document.body.style.overflow = 'hidden'
  await nextTick()
  // Small delay so the modal has layout before the map binds to it
  setTimeout(async () => {
    const el = modalMapEl.value
    if (!el || !hasCoords(s)) return
    let maps
    try { maps = await loadGoogleMaps() } catch (e) { return }
    modalMap = new maps.Map(el, {
      center: { lat: Number(s.lat), lng: Number(s.lng) },
      zoom: 16,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'cooperative',
    })
    new maps.Marker({ position: { lat: Number(s.lat), lng: Number(s.lng) }, map: modalMap, title: s.name })
  }, 120)
}

function closeModal () {
  selected.value = null
  document.body.style.overflow = ''
  modalMap = null // the v-if removes the container — just drop the reference
}

const onKey = (e) => { if (e.key === 'Escape' && selected.value) closeModal() }

onMounted(() => {
  document.addEventListener('keydown', onKey)
  fetchSchools()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
  miniMap = null
  modalMap = null
})
</script>

<template>
  <div class="schools-page">
    <!-- Hero -->
    <section class="schools-hero">
      <div class="hero-bg"></div>
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <span class="hero-kicker">Municipality of Baco &middot; Oriental Mindoro</span>
        <h1 class="hero-title">Educational Institutions</h1>
        <div class="hero-divider"></div>
      </div>
    </section>


    <!-- Main Layout -->
    <div class="main-layout">
      <div class="content-area">
        <p v-if="loading" class="loading-note">Loading schools…</p>
        <p v-else-if="filtered.length === 0" class="loading-note">No schools found for this category.</p>
        <div v-else class="school-grid">
          <div v-for="s in filtered" :key="s.id" class="school-card" @click="openModal(s)">
            <div class="school-card-header">
              <img class="school-logo" :src="logoFor(s)" :alt="s.name" />
              <div class="school-title-area">
                <div class="school-name">{{ s.name }}</div>
                <div class="school-location">
                  <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {{ s.location }}
                </div>
              </div>
            </div>
            <span class="type-badge" :class="typeMeta(s).cls">{{ typeMeta(s).label }}</span>
            <span v-if="isClosed(s)" class="closed-badge">Permanently Closed</span>
            <div class="school-info-row" v-if="has(s.address)">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>{{ s.address }}</span>
            </div>
            <div class="school-info-row" v-if="has(s.contactPerson)">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>{{ s.contactPerson }}</span>
            </div>
            <div class="school-info-row" v-if="has(s.phone)">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
              <span class="phone-link">{{ s.phone }}</span>
            </div>
            <div class="school-info-row" v-if="has(s.email)">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <span>{{ s.email }}</span>
            </div>
            <div class="school-info-row" v-if="has(s.hours)">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>{{ s.hours }}</span>
            </div>
            <div class="school-info-row" v-if="hasCoords(s)">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              <span class="map-hint">Click to view on the map</span>
            </div>
          </div>
        </div>
      </div>

      <div class="sidebar">
        <!-- Categories -->
        <div class="sidebar-card">
          <div class="sidebar-title">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
            BROWSE CATEGORIES
          </div>
          <ul class="category-list">
            <li v-for="c in CATEGORIES" :key="c.key" :class="{ active: activeFilter === c.key }" @click="activeFilter = c.key">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              {{ c.label }}
            </li>
          </ul>
        </div>

        <!-- Mini Map (Google) -->
        <div class="sidebar-card">
          <div class="sidebar-title">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            SCHOOL LOCATIONS MAP
          </div>
          <div class="mini-map">
            <div v-if="mapFailed" class="map-fallback">Map unavailable</div>
            <div id="miniMap"></div>
          </div>
          <p class="mini-map-hint"><i class="fa-solid fa-hand-pointer"></i> Click a pin for details &amp; directions</p>
        </div>

        <!-- Quick Stats (live) -->
        <div class="sidebar-card">
          <div class="sidebar-title">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            QUICK STATS
          </div>
          <div class="stats-row"><span class="stats-label">Total Schools</span><span class="stats-value">{{ stats.total }}</span></div>
          <div class="stats-row"><span class="stats-label">Elementary</span><span class="stats-value">{{ stats.elementary }}</span></div>
          <div class="stats-row"><span class="stats-label">High Schools</span><span class="stats-value">{{ stats.highschool }}</span></div>
          <div class="stats-row"><span class="stats-label">Colleges / Tertiary</span><span class="stats-value">{{ stats.college }}</span></div>
          <div class="stats-row"><span class="stats-label">IPEd Schools</span><span class="stats-value">{{ stats.ipded }}</span></div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div v-if="selected" class="modal-overlay active" @click.self="closeModal">
      <div class="modal-content">
        <button class="modal-close" @click="closeModal">✕</button>
        <div class="modal-hero" :style="!modalHeroImg ? { background: `linear-gradient(135deg, ${typeMeta(selected).color}, #0f172a)` } : {}">
          <img v-if="modalHeroImg" :src="modalHeroImg" :alt="selected.name" />
          <div v-else class="hero-emoji">{{ typeMeta(selected).emoji }}</div>
          <div class="modal-hero-overlay">
            <span v-if="isClosed(selected)" class="closed-badge hero">Permanently Closed</span>
            <div class="school-name">{{ selected.name }}</div>
            <div class="school-location">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="display:inline;vertical-align:middle;margin-right:4px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>{{ selected.location }}
            </div>
          </div>
        </div>
        <div class="modal-body">

          <!-- ══ MAP CARD — Tourism-style: canvas + coords + distance + Google handoff ══ -->
          <div class="modal-section" v-if="hasCoords(selected) && !mapFailed">
            <div class="modal-section-title">Location Map</div>
            <div class="mmap-card">
              <div ref="modalMapEl" class="mmap-canvas"></div>
              <div class="mmap-info">
                <span class="mmap-coord">
                  <i class="fa-solid fa-location-crosshairs"></i>
                  {{ selected.lat }}, {{ selected.lng }}
                </span>

                <div class="mmap-actions">
                  <button class="mmap-btn mmap-btn--ghost" @click="findMe" :disabled="locating">
                    <i class="fa-solid" :class="locating ? 'fa-spinner fa-spin' : 'fa-street-view'"></i>
                    {{ locating ? 'Locating…' : (userLocation ? 'Refresh my location' : 'How far am I?') }}
                  </button>
                  <a class="mmap-btn mmap-btn--google" :href="gmapsDirUrl" target="_blank" rel="noopener noreferrer">
                    <i class="fa-solid fa-diamond-turn-right"></i> Get Directions
                  </a>
                </div>

                <div v-if="schoolDistanceKm" class="mmap-distance">
                  <i class="fa-solid fa-route"></i>
                  <span>You are about <strong>{{ schoolDistanceKm }}</strong> from {{ selected.name }}.</span>
                  <small>Straight-line distance — tap "Get Directions" for the actual driving route in Google Maps.</small>
                </div>
                <p v-else-if="locationError" class="mmap-error"><i class="fa-solid fa-triangle-exclamation"></i> {{ locationError }}</p>
              </div>
            </div>
          </div>

          <!-- No coordinates → Google Maps name search fallback -->
          <div class="modal-section" v-else-if="!hasCoords(selected)">
            <div class="modal-section-title">Location</div>
            <div class="mmap-card mmap-card--empty">
              <i class="fa-solid fa-map-location-dot"></i>
              <p>This school has no pinned map coordinates yet.</p>
              <a class="mmap-btn mmap-btn--google" :href="gmapsSearchUrl" target="_blank" rel="noopener noreferrer">
                <i class="fa-brands fa-google"></i> Search it on Google Maps
              </a>
            </div>
          </div>

          <div class="modal-section">
            <div class="modal-section-title">School Information</div>
            <div class="modal-info-grid">
              <div class="modal-info-item" v-if="has(selected.address)">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <div><div class="label">Address</div><div class="value">{{ selected.address }}</div></div>
              </div>
              <div class="modal-info-item" v-if="has(selected.contactPerson)">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <div><div class="label">Contact Person</div><div class="value">{{ selected.contactPerson }}</div></div>
              </div>
              <div class="modal-info-item" v-if="has(selected.phone)">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
                <div><div class="label">Phone</div><div class="value">{{ selected.phone }}</div></div>
              </div>
              <div class="modal-info-item" v-if="has(selected.email)">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <div><div class="label">Email</div><div class="value">{{ selected.email }}</div></div>
              </div>
              <div class="modal-info-item" v-if="has(selected.hours)">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <div><div class="label">Office Hours</div><div class="value">{{ selected.hours }}</div></div>
              </div>
              <div class="modal-info-item">
                <div><div class="label">Type</div><div class="value"><span class="type-badge" :class="typeMeta(selected).cls" style="margin:0">{{ typeMeta(selected).label }}</span></div></div>
              </div>
              <div class="modal-info-item" v-if="hasCoords(selected)">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <div><div class="label">Coordinates</div><div class="value coords">{{ selected.lat }}, {{ selected.lng }}</div></div>
              </div>
              <div class="modal-info-item" v-if="isClosed(selected)">
                <div><div class="label">Status</div><div class="value closed-text">Permanently Closed</div></div>
              </div>
            </div>
          </div>

          <!-- ══ FACEBOOK PAGE — only when the admin set a link ══ -->
          <div class="modal-section" v-if="has(selected.fbLink)">
            <div class="modal-section-title">Connect Online</div>
            <div class="modal-links">
              <a class="link-chip link-chip--fb" :href="selected.fbLink" target="_blank" rel="noopener noreferrer">
                <i class="fa-brands fa-facebook-f"></i> Visit Facebook Page
              </a>
            </div>
          </div>

          <div class="modal-section">
            <div class="modal-section-title">About This School</div>
            <div class="modal-description">
              <p>{{ selected.description }}</p>
            </div>
          </div>

          <!-- Gallery — click a photo to use it as the banner -->
          <div class="modal-section" v-if="selected.gallery && selected.gallery.length">
            <div class="modal-section-title">Photo Gallery <span class="gal-tip">— click a photo to view it as the banner</span></div>
            <div class="modal-gallery">
              <button
                v-for="(img, gi) in selected.gallery"
                :key="gi"
                type="button"
                class="mg-item"
                :class="{ active: modalHeroImg === img }"
                @click="setHeroImage(img)"
              >
                <img :src="img" :alt="`${selected.name} photo ${gi + 1}`" loading="lazy" />
              </button>
            </div>
          </div>

          <div class="modal-section" v-if="tagsOf(selected).length">
            <div class="modal-section-title">
              {{ selected.type === 'college' ? 'Programs / Courses' : (selected.type === 'highschool' ? 'SHS Strand / Offering' : 'Programs & Features') }}
            </div>
            <div class="modal-tags">
              <span v-for="t in tagsOf(selected)" :key="t" class="modal-tag">{{ t }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

.schools-page { font-family: 'Inter', 'DM Sans', sans-serif; background: #f0f4f8; color: #1a202c; min-height: 100vh; --gutter: clamp(20px, 5vw, 80px); --max-w: 1240px; --navy-deep: #07115E; --red: #970718; --teal: #0d9488; }

.schools-hero { position: relative; height: 68vh; height: 68svh; min-height: 440px; max-height: 620px; overflow: hidden; background: var(--navy-deep); }
.hero-bg { position: absolute; inset: 0; background: url('/images/hero-imgs.jpg') center 35% / cover no-repeat; filter: grayscale(25%) brightness(0.45); }
.hero-overlay { position: absolute; inset: 0; background: linear-gradient(to right, rgba(4,10,60,0.97) 0%, rgba(7,17,94,0.92) 48%, rgba(11,25,143,0.22) 100%); }
.hero-content { position: relative; z-index: 2; height: 100%; padding: 0 var(--gutter); display: flex; flex-direction: column; justify-content: center; max-width: 680px; margin-left: max(var(--gutter), calc(50vw - var(--max-w) / 2)); }
.hero-kicker { display: block; font-size: 0.62rem; font-weight: 600; letter-spacing: 0.26em; text-transform: uppercase; color: rgba(255,255,255,0.46); margin-bottom: 18px; }
.hero-title { font-family: 'Playfair Display', serif; font-size: clamp(3rem, 7vw, 5.4rem); font-weight: 700; color: #ececec; line-height: 1.03; letter-spacing: -0.025em; margin: 0 0 22px; }
.hero-divider { width: 44px; height: 3px; background: var(--red); margin-bottom: 20px; }
.hero-sub { font-family: 'EB Garamond', Georgia, serif; font-size: 1.18rem; line-height: 1.75; color: rgba(255,255,255,0.66); margin: 0; max-width: 560px; }

/* ═══ HERO — responsive ladder ═══ */
@media (max-width: 1024px) {
  .schools-hero { min-height: 400px; }
  .hero-title { font-size: clamp(2.6rem, 6vw, 4.4rem); }
}
@media (max-width: 768px) {
  /* Compact on phones: ~55% of a short screen, not a 440px+ empty slab —
     the hero only carries kicker + title + divider now */
  .schools-hero { height: auto; min-height: 340px; max-height: 420px; }
  .hero-content { padding: 48px var(--gutter); justify-content: center; }
  .hero-title { font-size: clamp(2.1rem, 9.5vw, 3rem); letter-spacing: -0.02em; margin-bottom: 16px; }
  .hero-kicker { font-size: 0.58rem; letter-spacing: 0.2em; margin-bottom: 14px; }
  .hero-divider { margin-bottom: 0; }
  /* Weight the scrim toward the bottom so the title keeps contrast over the photo */
  .hero-overlay {
    background:
      linear-gradient(to right, rgba(4,10,60,0.97) 0%, rgba(7,17,94,0.9) 48%, rgba(11,25,143,0.35) 100%),
      linear-gradient(to top, rgba(4,10,60,0.72) 0%, transparent 55%);
  }
}
@media (max-width: 380px) {
  .schools-hero { min-height: 300px; }
  .hero-content { padding: 40px 20px; }
  .hero-title { font-size: clamp(1.9rem, 10vw, 2.4rem); }
}
/* Short landscape phones — don't let 68svh collapse below the content */
@media (max-height: 480px) and (orientation: landscape) {
  .schools-hero { height: auto; min-height: 300px; }
}
.breadcrumb { padding: 16px 32px; background: white; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b; display: flex; align-items: center; gap: 8px; }
.breadcrumb a { color: var(--teal); text-decoration: none; }
.breadcrumb a:hover { text-decoration: underline; }
.breadcrumb .current { color: #1a202c; font-weight: 500; }

.filter-bar { padding: 20px 32px; background: white; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.filter-select { flex: 1; min-width: 280px; padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; font-family: inherit; background: white; color: #1a202c; cursor: pointer; }
.filter-select:focus { outline: none; border-color: var(--teal); box-shadow: 0 0 0 3px rgba(13,148,136,0.1); }
.btn-back { padding: 12px 20px; border: 1px solid var(--teal); background: white; color: var(--teal); border-radius: 8px; font-size: 14px; font-family: inherit; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; white-space: nowrap; }
.btn-back:hover { background: var(--teal); color: white; }

.main-layout { display: flex; gap: 24px; padding: 24px 32px; max-width: 1600px; margin: 0 auto; }
.content-area { flex: 1; min-width: 0; }
.sidebar { width: 320px; flex-shrink: 0; }
.loading-note { padding: 40px; text-align: center; color: #64748b; }

/* 3 cards per grid */
.school-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.school-card { background: white; border-radius: 12px; padding: 22px; border: 1px solid #e2e8f0; cursor: pointer; transition: all 0.25s ease; position: relative; overflow: hidden; }
.school-card:hover { box-shadow: 0 8px 30px rgba(0,0,0,0.08); border-color: var(--teal); transform: translateY(-2px); }
.school-card-header { display: flex; gap: 14px; margin-bottom: 14px; }
/* Logo never cropped — contained on a clean disc */
.school-logo { width: 60px; height: 60px; border-radius: 50%; object-fit: contain; padding: 4px; flex-shrink: 0; border: 2px solid #e2e8f0; background: #f8fafc; }
.school-title-area { flex: 1; min-width: 0; }
.school-name { font-size: 15px; font-weight: 700; color: #1a202c; line-height: 1.3; margin-bottom: 6px; }
.school-location { display: flex; align-items: flex-start; gap: 4px; font-size: 12px; color: var(--teal); font-weight: 500; line-height: 1.4; }

.type-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 12px; margin-right: 6px; }
.type-elementary { background: #dbeafe; color: #1d4ed8; }
.type-highschool { background: #fef3c7; color: #92400e; }
.type-college { background: #d1fae5; color: #065f46; }
.type-ipded { background: #ede9fe; color: #5b21b6; }

.closed-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 12px; background: #fee2e2; color: #b91c1c; }

.school-info-row { display: flex; align-items: flex-start; gap: 10px; padding: 6px 0; font-size: 13px; color: #475569; line-height: 1.5; overflow-wrap: anywhere; }
.school-info-row .icon { width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; color: #94a3b8; }
.school-info-row .phone-link { color: var(--teal); font-weight: 500; }
.map-hint { color: var(--teal); font-weight: 500; }

.sidebar-card { background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; margin-bottom: 20px; }
.sidebar-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.sidebar-title svg { color: var(--teal); }

.category-list { list-style: none; }
.category-list li { padding: 10px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-size: 14px; color: #334155; transition: all 0.2s; margin-bottom: 2px; }
.category-list li:hover { background: #f0fdfa; color: var(--teal); }
.category-list li.active { background: #f0fdfa; color: var(--teal); font-weight: 600; }
.category-list li svg { width: 18px; height: 18px; flex-shrink: 0; }

.stats-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
.stats-row:last-child { border-bottom: none; }
.stats-label { color: #475569; }
.stats-value { background: var(--teal); color: white; padding: 3px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }

.mini-map { height: 220px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
.mini-map-hint { margin-top: 10px; font-size: 11px; color: #94a3b8; display: flex; align-items: center; gap: 6px; }
#miniMap { height: 100%; width: 100%; }
.map-fallback { display: flex; align-items: center; justify-content: center; height: 100%; color: #94a3b8; font-size: 13px; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px); }
.modal-content { background: white; border-radius: 16px; max-width: 900px; width: 100%; max-height: 90vh; overflow-y: auto; position: relative; animation: modalIn 0.3s ease; }
@keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
.modal-close { position: absolute; top: 16px; right: 16px; width: 40px; height: 40px; border-radius: 50%; border: none; background: rgba(255,255,255,0.9); cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10; font-size: 20px; color: #1a202c; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
.modal-close:hover { background: white; transform: scale(1.1); }

.modal-hero { height: 280px; border-radius: 16px 16px 0 0; overflow: hidden; position: relative; }
.modal-hero img { width: 100%; height: 100%; object-fit: cover; }
.hero-emoji { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 90px; }
.modal-hero-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 30px; background: linear-gradient(transparent, rgba(0,0,0,0.7)); color: white; }
.modal-hero-overlay .school-name { font-size: 28px; color: white; margin-bottom: 8px; }
.modal-hero-overlay .school-location { color: #a7f3d0; font-size: 15px; }
.modal-hero-overlay .closed-badge { margin-bottom: 8px; background: #b91c1c; color: #fff; }

.modal-body { padding: 32px; }
.modal-section { margin-bottom: 28px; }
.modal-section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--teal); margin-bottom: 14px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
.modal-section-title .gal-tip { font-weight: 500; text-transform: none; letter-spacing: 0; color: #94a3b8; font-size: 12px; }
.modal-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.modal-info-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: #f8fafc; border-radius: 10px; }
.modal-info-item .icon { width: 20px; height: 20px; color: var(--teal); flex-shrink: 0; margin-top: 2px; }
.modal-info-item .label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
.modal-info-item .value { font-size: 14px; color: #1a202c; font-weight: 500; margin-top: 2px; }
.modal-info-item .value.coords { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; word-break: break-all; }
.modal-info-item .value.closed-text { color: #b91c1c; font-weight: 600; }

.modal-description { font-size: 15px; line-height: 1.7; color: #475569; }
.modal-description p { margin-bottom: 12px; }

/* Gallery grid — full photo visible (contained), click swaps the banner */
.modal-gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.mg-item { position: relative; border: 2px solid transparent; border-radius: 10px; overflow: hidden; cursor: pointer; padding: 0; background: #f8fafc; aspect-ratio: 4 / 3; transition: border-color 0.2s, transform 0.2s; }
.mg-item img { width: 100%; height: 100%; object-fit: contain; background: #f8fafc; display: block; }
.mg-item:hover { transform: translateY(-2px); }
.mg-item.active { border-color: var(--teal); }

/* Facebook link chip */
.modal-links { display: flex; flex-wrap: wrap; gap: 10px; }
.link-chip { display: inline-flex; align-items: center; gap: 10px; padding: 12px 22px; border-radius: 100px; font-size: 13px; font-weight: 700; text-decoration: none; transition: all 0.25s; }
.link-chip--fb { background: #e7f0fe; color: #1d4ed8; border: 1px solid #c7dafc; }
.link-chip--fb:hover { background: #1d4ed8; color: #fff; transform: translateY(-2px); }

.modal-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.modal-tag { padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; background: #f0fdfa; color: var(--teal); border: 1px solid #99f6e4; }

/* ═══ MAP CARD (Tourism-style) ═══ */
.mmap-card { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #f8fafc; }
.mmap-canvas { height: 280px; width: 100%; background: #eef2f7; }
.mmap-info { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.mmap-coord { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #1a202c; font-family: ui-monospace, Menlo, Consolas, monospace; background: #eef2f7; border-radius: 100px; padding: 8px 16px; width: fit-content; word-break: break-all; }
.mmap-coord i { color: var(--teal); }
.mmap-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.mmap-btn { display: inline-flex; align-items: center; gap: 9px; padding: 12px 22px; border-radius: 100px; font-family: inherit; font-weight: 700; font-size: 13px; text-decoration: none; cursor: pointer; border: none; transition: all 0.25s; }
.mmap-btn--ghost { background: #eef2f7; color: #1a202c; border: 1px solid #dbe3ec; }
.mmap-btn--ghost:hover { background: var(--teal); color: #fff; transform: translateY(-2px); }
.mmap-btn--ghost:disabled { opacity: 0.6; cursor: wait; transform: none; }
.mmap-btn--google { background: linear-gradient(135deg, #4285F4, #1a73e8); color: #fff; box-shadow: 0 6px 18px rgba(66,133,244,0.3); }
.mmap-btn--google:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(66,133,244,0.45); }
.mmap-distance { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 14px; color: #1a202c; background: #f0fdfa; border: 1px dashed rgba(13,148,136,0.35); border-radius: 10px; padding: 12px 16px; }
.mmap-distance i { color: var(--teal); }
.mmap-distance strong { color: var(--teal); font-size: 16px; }
.mmap-distance small { color: #94a3b8; font-size: 11px; width: 100%; }
.mmap-error { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #b91c1c; margin: 0; }
.mmap-card--empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 40px 20px; gap: 12px; }
.mmap-card--empty i { font-size: 2rem; color: #94a3b8; }
.mmap-card--empty p { font-size: 14px; color: #475569; margin: 0; }

@media (max-width: 1024px) {
  .main-layout { flex-direction: column; }
  .sidebar { width: 100%; }
  .school-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .filter-bar { padding: 16px; }
  .main-layout { padding: 16px; }
  .breadcrumb { padding: 12px 16px; }
  .school-grid { grid-template-columns: 1fr; }
  .modal-info-grid { grid-template-columns: 1fr; }
  .modal-hero { height: 200px; }
  .modal-hero-overlay .school-name { font-size: 20px; }
  .mmap-canvas { height: 220px; }
  .modal-gallery { grid-template-columns: repeat(2, 1fr); }
  .mmap-actions .mmap-btn { flex: 1; justify-content: center; min-width: 140px; }
}
.modal-content::-webkit-scrollbar { width: 6px; }
.modal-content::-webkit-scrollbar-track { background: transparent; }
.modal-content::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
</style>