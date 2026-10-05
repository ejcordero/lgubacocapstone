<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { API } from '../api'

gsap.registerPlugin(ScrollTrigger)

const props = defineProps({
  title: { type: String, default: 'The Municipality' },
})

// Hero title is split so the final word can carry the red accent
const titleWords = computed(() => (props.title || '').split(' ').filter(Boolean))
const heroTitleLead = computed(() => titleWords.value.length > 1 ? titleWords.value.slice(0, -1).join(' ') : (props.title || ''))
const heroTitleAccent = computed(() => titleWords.value.length ? titleWords.value[titleWords.value.length - 1] + '.' : '')


// ── Editable MAP + INFO panel content ──
// Managed by admins in Barangay Manager → "Municipality Page Content".
const DEFAULT_CONTENT = {
  heading: 'Barangays\nin Baco',
  body: 'Locate and explore the barangays, landmarks, and communities of Baco. This interactive map lets you discover each subdivision — from coastal villages to highland settlements.',
  about: `The Municipality of Baco is a 1st class municipality in the province of Oriental Mindoro, Philippines. As of July 1, 2024, the total population of the municipality of Baco in Oriental Mindoro is 40,159 people, according to census data.

Baco is known for its rich natural resources, including the vast agricultural lands that produce high-quality rice and fruits. The town is also the gateway to the majestic Mount Halcon, one of the toughest mountain climbs in the country.

The municipality is politically subdivided into 27 barangays. It is home to a diverse population, including the indigenous Alangan Mangyan tribes.`,
  totalArea: '216 km²',
}

const pageContent = ref({ ...DEFAULT_CONTENT })

const fetchPageContent = async () => {
  try {
    const res = await fetch(`${API}/municipality-settings`, { cache: 'no-store' })
    if (!res.ok) return
    const data = await res.json()
    pageContent.value = {
      heading: data.heading || DEFAULT_CONTENT.heading,
      body: data.body || DEFAULT_CONTENT.body,
      about: data.about || DEFAULT_CONTENT.about,
      totalArea: data.totalArea || DEFAULT_CONTENT.totalArea,
    }
  } catch (e) {
    console.warn('Municipality page content unavailable — using defaults.', e)
  }
}

// Hero pill shows just the numeric part of totalArea ("216" from "216 km²")
const heroAreaValue = computed(() => {
  const m = String(pageContent.value.totalArea).match(/[\d.]+/)
  return m ? m[0] : '216'
})

const isLoading        = ref(true)
const isFetchingData   = ref(true)
const selectedBarangay = ref(null)
const barangays        = ref([])
const fetchError       = ref(null)
const mapFailed        = ref(false)

// Seals come straight from the database (seal_image column),
// which stores filenames in the frontend public seals folder.
const getSeal = (b) => (b && b.seal_image) ? `/BACO- 27 BARANGAYS_ SEALS/${b.seal_image}` : ''

const transformBarangay = (dbRecord) => ({
  id: dbRecord.id,
  name: dbRecord.name,
  lat: parseFloat(dbRecord.lat),
  lng: parseFloat(dbRecord.lng),
  pop: Number(dbRecord.population) || 0,
  elev: parseFloat(dbRecord.elevation) || 0,
  area: dbRecord.area_type,
  overview: dbRecord.overview || '',
  seal_image: dbRecord.seal_image || ''
})

const totalPop = computed(() =>
  barangays.value.reduce((s, b) => s + b.pop, 0).toLocaleString()
)

const areaColor = (area) => {
  if (area === 'Coastal') return '#0B198F'
  if (area === 'Upland')  return '#2d6e2d'
  return '#CE1126'
}

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

let lenis     = null
let map       = null
let markers   = []
let observer  = null

const lenisTickerFn = (time) => { if (lenis) lenis.raf(time * 1000) }

const initScrollReveal = () => {
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  )
  document.querySelectorAll('.reveal-up, .stagger-item').forEach((el) => observer.observe(el))
}

// ── SEAL MARKER ICONS (canvas) ──
// Google markers can't render HTML, so each circular seal is drawn onto a
// canvas (seal image clipped in a circle + colored zone ring) and handed to
// Google as a PNG data-URL icon. Seals are same-origin → canvas is untainted.
const MAP_CENTER = { lat: 13.3580, lng: 121.0965 }

const sealImgCache = new Map()   // src → Promise<Image|null>
const sealIconCache = new Map()  // `${seal}|${color}|${size}` → dataURL|null

const loadSealImage = (src) => {
  if (sealImgCache.has(src)) return sealImgCache.get(src)
  const p = new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
  sealImgCache.set(src, p)
  return p
}

const makeSealIcon = async (brgy, color, size) => {
  const key = `${brgy.seal_image || 'none'}|${color}|${size}`
  if (sealIconCache.has(key)) return sealIconCache.get(key)

  const src = getSeal(brgy)
  const img = src ? await loadSealImage(src) : null
  const dpr = (window.devicePixelRatio || 1) > 1 ? 2 : 1
  const canvas = document.createElement('canvas')
  canvas.width = size * dpr
  canvas.height = size * dpr
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  const r = size / 2

  // white outer ring
  ctx.beginPath(); ctx.arc(r, r, r - 1, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'; ctx.fill()

  // seal clipped inside
  ctx.save()
  ctx.beginPath(); ctx.arc(r, r, r - 4, 0, Math.PI * 2); ctx.clip()
  if (img) {
    const inner = size - 8
    const scale = Math.max(inner / img.width, inner / img.height)
    const w = img.width * scale, h = img.height * scale
    ctx.drawImage(img, r - w / 2, r - h / 2, w, h)
  } else {
    ctx.fillStyle = '#E9EDF7'; ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = '#9AA3BD'
    ctx.font = `${Math.round(size * 0.42)}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('📍', r, r + 1)
  }
  ctx.restore()

  // colored zone border
  ctx.beginPath(); ctx.arc(r, r, r - 1.5, 0, Math.PI * 2)
  ctx.lineWidth = 3; ctx.strokeStyle = color; ctx.stroke()

  const url = canvas.toDataURL('image/png')
  sealIconCache.set(key, url)
  return url
}

const applyIcon = async (maps, mk, brgy, selected) => {
  const size = selected ? 54 : 40
  const color = selected ? '#CE1126' : areaColor(brgy.area)
  const url = await makeSealIcon(brgy, color, size)
  if (url) {
    mk.marker.setIcon({ url, scaledSize: new maps.Size(size, size), anchor: new maps.Point(size / 2, size / 2) })
  } else {
    mk.marker.setIcon({ path: maps.SymbolPath.CIRCLE, scale: selected ? 12 : 9, fillColor: color, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 })
  }
}

const fetchBarangays = async () => {
  try {
    isFetchingData.value = true
    fetchError.value = null

    const response = await fetch(`${API}/barangays`, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    barangays.value = data.map(transformBarangay)

    console.log(`✅ Loaded ${barangays.value.length} barangays from database`)
  } catch (err) {
    console.error('❌ Failed to fetch barangays:', err)
    fetchError.value = err.message
    barangays.value = []
  } finally {
    isFetchingData.value = false
  }
}

const initMapMarkers = async (maps) => {
  markers.forEach(mk => mk.marker.setMap(null))
  markers = []

  for (const b of barangays.value) {
    const color = areaColor(b.area)
    const url = await makeSealIcon(b, color, 40)
    const marker = new maps.Marker({
      position: { lat: b.lat, lng: b.lng },
      map,
      title: b.name,
      icon: url
        ? { url, scaledSize: new maps.Size(40, 40), anchor: new maps.Point(20, 20) }
        : { path: maps.SymbolPath.CIRCLE, scale: 9, fillColor: color, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
    })
    marker.addListener('click', () => selectBarangay(b))
    markers.push({ id: b.id, marker })
  }
}

const selectBarangay = async (b) => {
  selectedBarangay.value = b
  locationError.value = ''
  const maps = window.google && window.google.maps
  if (maps) {
    // re-render icons: deselect every marker, select the clicked one
    for (const mk of markers) {
      const bx = barangays.value.find(x => x.id === mk.id)
      if (!bx) continue
      await applyIcon(maps, mk, bx, bx.id === b.id)
    }
    if (map) {
      map.panTo({ lat: b.lat, lng: b.lng })
      map.setZoom(14)
    }
  }
}

// ═══ DISTANCE & DIRECTIONS (modal) — same UX as Tourism/Schools ═══
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

const brgyHasCoords = computed(() => {
  const b = selectedBarangay.value
  return !!b && !isNaN(Number(b.lat)) && !isNaN(Number(b.lng))
})

const brgyDistanceKm = computed(() => {
  const b = selectedBarangay.value
  if (!b || !userLocation.value || !brgyHasCoords.value) return null
  const km = haversineKm(userLocation.value.lat, userLocation.value.lng, Number(b.lat), Number(b.lng))
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km).toLocaleString()} km`
})

const gmapsCoord = (lat, lng) => `${Number(lat)},${Number(lng)}`

const gmapsDirUrl = computed(() => {
  const b = selectedBarangay.value
  if (!brgyHasCoords.value) return '#'
  const origin = userLocation.value ? `&origin=${gmapsCoord(userLocation.value.lat, userLocation.value.lng)}` : ''
  return `https://www.google.com/maps/dir/?api=1&destination=${gmapsCoord(b.lat, b.lng)}${origin}&travelmode=driving`
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

onMounted(async () => {
  lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smooth: true,
  })
  gsap.ticker.add(lenisTickerFn)
  gsap.ticker.lagSmoothing(0)

  gsap.to('.hero-bg', {
    yPercent: 20, ease: 'none',
    scrollTrigger: { trigger: '.hero-panel', start: 'top top', end: 'bottom top', scrub: true },
  })
  gsap.to('.hero-content', {
    yPercent: 10, opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '.hero-panel', start: 'top top', end: '45% top', scrub: true },
  })

  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .from('.hero-badge',     { opacity: 0, y: -14, duration: 0.6 })
    .from('.hero-eyebrow',   { opacity: 0, y: 10,  duration: 0.5 }, '-=0.2')
    .from('.hero-title',     { opacity: 0, y: 32,  duration: 0.8, ease: 'power4.out' }, '-=0.25')
    .from('.hero-sub',       { opacity: 0, y: 16,  duration: 0.6 }, '-=0.4')
    .from('.hero-pill',      { opacity: 0, y: 20,  duration: 0.5, stagger: 0.1 }, '-=0.3')
    .from('.hero-grid span', { scaleY: 0, transformOrigin: 'top center', duration: 0.9, stagger: 0.07, ease: 'power2.out' }, 0)

  ScrollTrigger.create({
    trigger: '.hero-panel',
    start: 'top top',
    end: 'bottom top',
    pin: true,
    pinSpacing: false,
  })

  gsap.from('.territory-left', {
    x: -30, opacity: 0, duration: 0.9, ease: 'power2.out',
    scrollTrigger: { trigger: '.territory-block', start: 'top 82%' },
  })
  gsap.from('.territory-right', {
    x: 30, opacity: 0, duration: 0.9, delay: 0.1, ease: 'power2.out',
    scrollTrigger: { trigger: '.territory-block', start: 'top 82%' },
  })
  initScrollReveal()

  document.addEventListener('keydown', onKeydown)

  // data first — the modal, distance & list work even if the map fails
  await Promise.all([fetchPageContent(), fetchBarangays()])

  try {
    const maps = await loadGoogleMaps()
    map = new maps.Map(document.getElementById('baco-map'), {
      center: MAP_CENTER,
      zoom: 12,
      zoomControl: true,
      zoomControlOptions: { position: maps.ControlPosition.RIGHT_BOTTOM },
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'cooperative', // built-in "use Ctrl+scroll to zoom" hint
    })
    if (barangays.value.length > 0) {
      await initMapMarkers(maps)
    }
  } catch (e) {
    console.warn(e.message)
    mapFailed.value = true
  }

  isLoading.value = false
})

onUnmounted(() => {
  gsap.ticker.remove(lenisTickerFn)
  ScrollTrigger.getAll().forEach(st => st.kill())
  if (lenis)    { lenis.destroy(); lenis = null }
  map = null   // Google Maps needs no explicit teardown — drop the reference
  if (observer) { observer.disconnect(); observer = null }
  markers = []
  document.removeEventListener('keydown', onKeydown)
})

const clearSelection = async () => {
  selectedBarangay.value = null
  const maps = window.google && window.google.maps
  if (!map || !maps) return
  for (const mk of markers) {
    const b = barangays.value.find(x => x.id === mk.id)
    if (!b) continue
    await applyIcon(maps, mk, b, false)
  }
  map.panTo(MAP_CENTER)
  map.setZoom(12)
}

const onKeydown = (e) => {
  if (e.key === 'Escape' && selectedBarangay.value) clearSelection()
}
</script>

<template>
  <div class="municipality-page">

    <!-- ══ PANEL 1: HERO ══ -->
    <section class="hero-panel">
      <div class="hero-bg"></div>
      <div class="hero-noise"></div>
      <div class="hero-overlay"></div>
      <div class="hero-grid" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="hero-content">
        <div class="hero-badge">
          <span class="badge-dot"></span>
          <span class="badge-text">Oriental Mindoro, Philippines</span>
        </div>
        <div class="hero-title-block">

          <h1 class="hero-title">
            <span class="title-word">{{ heroTitleLead }}</span> <em>{{ heroTitleAccent }}</em>
          </h1>
          <p class="hero-sub">A municipality rich in heritage, natural wonder, and the spirit of its people.</p>
        </div>
        <div class="hero-pills">
          <div class="hero-pill"><span class="pill-val">1<sup>st</sup></span><span class="pill-lbl">Class Municipality</span></div>
          <div class="pill-sep"></div>
          <div class="hero-pill"><span class="pill-val">27</span><span class="pill-lbl">Barangays</span></div>
          <div class="pill-sep"></div>
          <div class="hero-pill"><span class="pill-val">{{ totalPop || '40K+' }}</span><span class="pill-lbl">Residents</span></div>
          <div class="pill-sep"></div>
          <div class="hero-pill"><span class="pill-val">{{ heroAreaValue }}</span><span class="pill-lbl">km² Total Area</span></div>
        </div>
      </div>

    </section>

    <!-- ══ BREADCRUMB ══ -->
    <nav class="breadcrumb-bar" aria-label="Breadcrumb">
      <div class="breadcrumb-inner">
        <router-link to="/">Home</router-link>
        <span class="bc-sep">&gt;</span>
        <router-link to="/municipality">Municipality</router-link>
        <span class="bc-sep">&gt;</span>
        <span aria-current="page">{{ title }}</span>
      </div>
    </nav>

    <!-- ══ PANEL 2: MAP + INFO ══ -->
    <section class="brgy-panel">
      <div class="brgy-panel-bg" aria-hidden="true"></div>
      <div class="brgy-panel-overlay" aria-hidden="true"></div>

      <div class="panel-body">
        <div class="body-inner">
          <div class="territory-block">

            <!-- Left: Info sidebar -->
            <div class="territory-left">
              <h2 class="territory-heading">{{ pageContent.heading }}</h2>
              <div class="territory-rule"></div>
              <p class="territory-body">{{ pageContent.body }}</p>
              <div class="territory-about">
                <p
                  v-for="(para, i) in pageContent.about.split('\n\n').filter(p => p.trim())"
                  :key="i"
                  class="territory-about-para"
                >{{ para.trim() }}</p>
              </div>
              <div class="territory-stats">
                <div class="t-stat stagger-item" style="--stagger:0">
                  <div class="t-stat-val">{{ totalPop }}</div>
                  <div class="t-stat-lbl">Total Residents</div>
                </div>
                <div class="t-stat-sep"></div>
                <div class="t-stat stagger-item" style="--stagger:1">
                  <div class="t-stat-val">{{ barangays.length }}</div>
                  <div class="t-stat-lbl">Barangays</div>
                </div>
                <div class="t-stat-sep"></div>
                <div class="t-stat stagger-item" style="--stagger:2">
                  <div class="t-stat-val">{{ pageContent.totalArea }}</div>
                  <div class="t-stat-lbl">Total Area</div>
                </div>
              </div>
              <div class="territory-legend">
                <span class="leg"><span class="leg-ring" style="border-color:#CE1126;"></span>Lowland</span>
                <span class="leg"><span class="leg-ring" style="border-color:#0B198F;"></span>Coastal</span>
                <span class="leg"><span class="leg-ring" style="border-color:#2d6e2d;"></span>Upland</span>
              </div>

              <!-- Error message if fetch fails -->
              <div v-if="fetchError" class="territory-error">
                <i class="fas fa-exclamation-triangle"></i>
                <span>Failed to load barangay data: {{ fetchError }}</span>
              </div>

              <!-- Loading indicator -->
              <div v-if="isFetchingData && !fetchError" class="territory-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Loading barangay data...</span>
              </div>

              <p v-if="!isFetchingData && !fetchError && !mapFailed" class="territory-hint">
                <i class="fas fa-mouse-pointer"></i>
                Click any barangay seal on the map to view details
              </p>
            </div>

            <!-- Right: Map -->
            <div class="territory-right">
              <div class="map-card">
                <div class="map-wrap">
                  <div id="baco-map">
                    <div v-if="mapFailed" class="map-no-data">
                      <i class="fas fa-triangle-exclamation"></i>
                      <span>Map unavailable — check the Maps API key or your connection.</span>
                    </div>
                    <div v-else-if="isLoading || isFetchingData" class="map-loader">
                      <i class="fas fa-spinner fa-spin"></i>
                    </div>
                    <div v-else-if="barangays.length === 0 && !fetchError" class="map-no-data">
                      <i class="fas fa-map-marked-alt"></i>
                      <span>No barangay data available</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>

    <!-- ══ BARANGAY DETAIL MODAL ══ -->
    <Transition name="modal">
      <div
        v-if="selectedBarangay"
        class="modal-overlay"
        @click.self="clearSelection"
      >
        <div class="modal-card">
          <button class="modal-close" @click="clearSelection" aria-label="Close">
            <i class="fas fa-times"></i>
          </button>

          <div class="modal-seal-wrap">
            <div class="modal-seal-ring" :style="{ borderColor: areaColor(selectedBarangay.area) }">
              <img
                v-if="getSeal(selectedBarangay)"
                :src="getSeal(selectedBarangay)"
                :alt="selectedBarangay.name + ' Seal'"
                class="modal-seal-img"
              />
              <i v-else class="fas fa-map-pin modal-seal-fallback"></i>
            </div>
          </div>

          <span class="modal-zone-badge" :style="{ background: areaColor(selectedBarangay.area) }">
            {{ selectedBarangay.area }}
          </span>

          <h3 class="modal-name">{{ selectedBarangay.name }}</h3>
          <div class="modal-coords">
            {{ selectedBarangay.lat.toFixed(4) }}°N · {{ selectedBarangay.lng.toFixed(4) }}°E
          </div>

          <div class="modal-stats-row">
            <div class="modal-stat">
              <div class="modal-stat-val">{{ selectedBarangay.pop.toLocaleString() }}</div>
              <div class="modal-stat-lbl">Population (2020)</div>
            </div>
            <div class="modal-stat-divider"></div>
            <div class="modal-stat">
              <div class="modal-stat-val">{{ selectedBarangay.elev }} m</div>
              <div class="modal-stat-lbl">Elevation (AMSL)</div>
            </div>
            <div class="modal-stat-divider"></div>
            <div class="modal-stat">
              <div class="modal-stat-val">{{ selectedBarangay.area }}</div>
              <div class="modal-stat-lbl">Zone Type</div>
            </div>
          </div>

          <div class="modal-divider"></div>

          <p class="modal-overview">{{ selectedBarangay.overview }}</p>

          <!-- ══ DISTANCE + DIRECTIONS (Google Maps handoff) ══ -->
          <div class="modal-map-actions" v-if="brgyHasCoords">
            <button class="dist-btn" @click="findMe" :disabled="locating">
              <i class="fas" :class="locating ? 'fa-spinner fa-spin' : 'fa-street-view'"></i>
              {{ locating ? 'Locating…' : (userLocation ? 'Refresh my location' : 'How far am I?') }}
            </button>
            <a class="dist-btn dist-btn--google" :href="gmapsDirUrl" target="_blank" rel="noopener noreferrer">
              <i class="fas fa-diamond-turn-right"></i> Get Directions
            </a>
          </div>

          <div v-if="brgyDistanceKm" class="dist-line">
            <i class="fas fa-route"></i>
            <span>You are about <strong>{{ brgyDistanceKm }}</strong> from Barangay {{ selectedBarangay.name }}.</span>
            <small>Straight-line distance — "Get Directions" opens the driving route in Google Maps.</small>
          </div>
          <p v-else-if="locationError" class="dist-error">
            <i class="fas fa-exclamation-triangle"></i> {{ locationError }}
          </p>

          <div class="modal-footer-hint">
            <i class="fas fa-map-marker-alt"></i>
            <span>Pinned on map at {{ selectedBarangay.lat.toFixed(4) }}°N, {{ selectedBarangay.lng.toFixed(4) }}°E</span>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap');

/* ═══════════════════════════════════════════
   TOKENS
   ════════════════════════════════════════════ */
.municipality-page {
  --navy-deep: #070f5c;
  --navy:      #0B198F;
  --red:       #CE1126;
  --gold:      #C9A84C;
  --ink:       #10152B;
  --body-c:    #3E4763;
  --muted:     #667089;
  --faint:     #9AA3BD;
  --line:      rgba(16, 21, 43, 0.10);
  --surface:   #F2F5FC;
  --white:     #ffffff;

  --gutter: clamp(20px, 4vw, 40px);

  --r-md: 14px;
  --r-lg: 20px;
  --r-xl: 26px;

  --sh-1: 0 1px 2px rgba(7,15,92,0.05), 0 10px 30px rgba(7,15,92,0.08);
  --sh-2: 0 24px 70px rgba(7,15,92,0.18), 0 6px 18px rgba(7,15,92,0.07);
  --ease: cubic-bezier(0.22, 1, 0.36, 1);

  font-family: 'Lora', serif;
  background: var(--white);
  color: var(--ink);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.municipality-page *,
.municipality-page *::before,
.municipality-page *::after { box-sizing: border-box; margin: 0; padding: 0; }

.municipality-page ::selection { background: var(--navy); color: #fff; }
.municipality-page :focus-visible { outline: 2px solid var(--red); outline-offset: 3px; border-radius: 4px; }

/* ═══════════════════════════════════════════
   HERO
   ════════════════════════════════════════════ */
.hero-panel {
  position: relative; width: 100%;
  height: 100vh;
  height: 100svh;
  min-height: 640px;
  overflow: hidden;
  background: var(--navy-deep);
  display: flex; align-items: center;
  z-index: 1;
}
.hero-bg {
  position: absolute; inset: 0;
  background: url('/images/hero-imgs.jpg') center 40% / cover no-repeat;
  filter: grayscale(60%) brightness(0.28);
  mix-blend-mode: luminosity;
  will-change: transform;
}
.hero-noise {
  position: absolute; inset: 0; z-index: 1;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  background-size: 180px; opacity: 0.45; pointer-events: none;
}
.hero-overlay {
  position: absolute; inset: 0; z-index: 2;
  background:
    linear-gradient(to right, rgba(7,15,92,0.98) 0%, rgba(11,25,143,0.88) 40%, rgba(11,25,143,0.45) 70%, rgba(11,25,143,0.10) 100%),
    linear-gradient(to top, rgba(7,15,92,0.88) 0%, transparent 55%);
}
.hero-grid {
  position: absolute; inset: 0; z-index: 2;
  display: flex; justify-content: space-evenly;
  pointer-events: none;
}
.hero-grid span {
  display: block; width: 1px; height: 100%;
  background: linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent 100%);
}

.hero-content {
  position: relative; z-index: 3;
  width: 100%; max-width: 1320px;
  margin: 0 auto;
  padding: 0 var(--gutter);
  display: flex; flex-direction: column; justify-content: center;
}

.hero-badge {
  display: inline-flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.09);
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 100px;
  padding: 6px 15px 6px 11px;
  margin-bottom: 26px; width: fit-content;
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
}
.badge-dot {
  width: 6px; height: 6px; background: var(--red); border-radius: 50%; flex-shrink: 0;
  box-shadow: 0 0 6px rgba(206,17,38,0.7);
  animation: pulseDot 2.4s ease-in-out infinite;
}
@keyframes pulseDot {
  0%, 100% { box-shadow: 0 0 4px rgba(206,17,38,0.6); }
  50%      { box-shadow: 0 0 12px rgba(206,17,38,0.9); }
}
.badge-text {
  font-size: 0.68rem; letter-spacing: 0.14em;
  text-transform: uppercase; color: rgba(255,255,255,0.6); line-height: 1;
}

.hero-title-block { margin-bottom: 0; }
.hero-eyebrow {
  display: flex; align-items: center; gap: 12px;
  font-size: 0.66rem; letter-spacing: 0.22em;
  text-transform: uppercase; color: rgba(255,255,255,0.38); margin-bottom: 14px;
}
.eyebrow-line { flex: 0 0 24px; height: 1px; background: rgba(255,255,255,0.25); }

.hero-title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(2.5rem, 6.2vw, 5rem);
  font-weight: 800; color: #ffffff;
  line-height: 1.02; letter-spacing: -0.015em;
  text-transform: uppercase;
  margin-bottom: 18px;
  text-shadow: 0 8px 48px rgba(0,0,0,0.4);
  text-wrap: balance;
}
.hero-title em { font-style: normal; color: var(--red); }
.period { color: var(--gold); }

.hero-sub {
  font-family: 'Cormorant Garamond', serif; font-style: italic;
  font-size: clamp(1.1rem, 1.6vw, 1.3rem);
  color: rgba(255,255,255,0.72); line-height: 1.7;
  max-width: 46ch; font-weight: 300;
}

.hero-pills {
  display: flex; align-items: stretch; flex-wrap: wrap; row-gap: 14px;
  margin-top: 38px;
  padding-top: 30px;
  border-top: 1px solid rgba(255,255,255,0.14);
  max-width: 780px;
}
.hero-pill {
  display: flex; flex-direction: column; justify-content: center; gap: 5px;
  padding: 2px 28px 2px 0;
}
.hero-pill:first-child { padding-left: 0; }
.pill-val {
  font-family: 'Playfair Display', serif;
  font-size: clamp(1.4rem, 2.2vw, 1.65rem);
  font-weight: 700; color: #ffffff; line-height: 1;
}
.pill-val sup { font-size: 0.62em; vertical-align: super; color: var(--gold); }
.pill-lbl {
  font-size: 0.66rem; letter-spacing: 0.14em;
  text-transform: uppercase; color: rgba(255,255,255,0.48); line-height: 1.4;
}
.pill-sep {
  width: 1px; align-self: stretch;
  background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.22), transparent);
  margin-right: 28px; flex-shrink: 0;
}

.hero-scroll {
  position: absolute; bottom: 72px; right: 48px; z-index: 4;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.hero-scroll span {
  font-size: 0.58rem; letter-spacing: 0.22em;
  text-transform: uppercase; color: rgba(255,255,255,0.32);
  writing-mode: vertical-rl;
}
.scroll-track {
  width: 1px; height: 48px;
  background: rgba(255,255,255,0.16);
  position: relative; overflow: hidden;
}
.scroll-thumb {
  position: absolute; top: 0; left: 0; width: 100%; height: 40%;
  background: var(--red);
  animation: scrollThumb 2s ease-in-out infinite;
}
@keyframes scrollThumb { 0% { top: -40%; } 100% { top: 140%; } }

/* ═══════════════════════════════════════════
   BREADCRUMB
   ════════════════════════════════════════════ */
.breadcrumb-bar {
  background: var(--navy);
  border-bottom: 1px solid rgba(255,255,255,0.08);
  padding: 13px 0;
}
.breadcrumb-inner {
  max-width: 1320px;
  margin: 0 auto;
  padding: 0 var(--gutter);
  display: flex; align-items: center; gap: 9px;
  font-size: 0.74rem; color: rgba(255,255,255,0.55);
}
.breadcrumb-inner a { color: #fff; text-decoration: none; font-weight: 500; padding: 11px 0; display: inline-block; transition: color 0.18s; }
.breadcrumb-inner a:hover { color: var(--gold); }
.bc-sep { font-size: 0.72rem; color: rgba(255,255,255,0.35); }
.breadcrumb-inner > span:last-child { color: rgba(255,255,255,0.8); font-weight: 600; }

/* ═══════════════════════════════════════════
   BARANGAY PANEL
   ════════════════════════════════════════════ */
.brgy-panel { position: relative; z-index: 1; }
.brgy-panel-bg {
  position: absolute; inset: 0; z-index: 0;
  background: url('/images/Baco_Mahalta.jpg') center / cover no-repeat;
}
.brgy-panel-overlay {
  position: absolute; inset: 0; z-index: 1;
  background: linear-gradient(to bottom, rgba(242,245,252,0.62) 0%, rgba(242,245,252,0.88) 100%);
}
.panel-body {
  position: relative; z-index: 2;
  padding: clamp(56px, 8vw, 96px) var(--gutter) clamp(64px, 9vw, 110px);
}
.body-inner { max-width: 1320px; margin: 0 auto; }

.territory-block {
  display: grid;
  grid-template-columns: minmax(380px, 440px) minmax(0, 1fr);
  gap: 0;
  background: var(--surface);
  border: 1px solid rgba(255,255,255,0.7);
  border-top: 3px solid var(--navy);
  border-radius: var(--r-xl);
  overflow: hidden;
  box-shadow: var(--sh-2);
}

.territory-left {
  min-width: 0;
  padding: clamp(36px, 4.5vw, 60px) clamp(28px, 3.2vw, 48px);
  display: flex; flex-direction: column; justify-content: center;
  background: rgba(255,255,255,0.62);
  backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
  border-right: 1px solid rgba(11,25,143,0.08);
}

.territory-heading {
  font-family: 'Playfair Display', serif;
  font-size: clamp(1.8rem, 2.4vw, 2.5rem);
  font-weight: 800; color: var(--navy-deep);
  line-height: 1.12; letter-spacing: -0.01em;
  text-transform: uppercase;
  margin-bottom: 16px;
  white-space: pre-line;
}
.territory-heading em { font-style: normal; color: var(--red); }
.territory-rule {
  width: 44px; height: 3px;
  background: var(--red); border-radius: 2px;
  margin-bottom: 22px;
}
.territory-body {
  font-size: 0.95rem; color: var(--muted);
  line-height: 1.85; margin-bottom: 28px;
  white-space: pre-line;
}

.territory-about { margin-bottom: 28px; }
.territory-about-para {
  font-size: 0.88rem; color: var(--body-c);
  line-height: 1.85; margin-bottom: 12px;
}
.territory-about-para:last-child { margin-bottom: 0; }

.territory-eyebrow {
  font-size: 0.66rem; letter-spacing: 0.2em;
  text-transform: uppercase; color: var(--red); margin-bottom: 14px;
}

.territory-stats {
  display: flex; align-items: stretch;
  margin-bottom: 26px;
  padding: 18px 22px;
  background: rgba(255,255,255,0.88);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  box-shadow: var(--sh-1);
}
.t-stat {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 5px;
}
.t-stat-val {
  font-family: 'Playfair Display', serif;
  font-size: 1.5rem; font-weight: 700;
  color: var(--navy); line-height: 1.05;
}
.t-stat-lbl {
  font-size: 0.64rem; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--faint); line-height: 1.4;
}
.t-stat-sep {
  width: 1px; background: var(--line);
  margin: 2px 18px; flex-shrink: 0;
}

.territory-legend {
  display: flex; flex-wrap: wrap; gap: 12px 20px;
  margin-bottom: 18px;
}
.leg {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 0.8rem; color: var(--muted); line-height: 1;
}
.leg-ring {
  width: 13px; height: 13px; border-radius: 50%;
  border: 2.5px solid var(--red);
  background: rgba(255,255,255,0.6);
  box-shadow: 0 1px 3px rgba(16,21,43,0.12);
  display: inline-block; flex-shrink: 0;
}

.territory-loading {
  display: flex; align-items: center; gap: 9px;
  font-size: 0.76rem; color: var(--navy);
  padding: 10px 0;
}
.territory-loading i { font-size: 0.75rem; flex-shrink: 0; }

.territory-error {
  display: flex; align-items: flex-start; gap: 9px;
  font-size: 0.76rem; color: var(--red); line-height: 1.55;
  padding: 11px 14px;
  background: rgba(206,17,38,0.06);
  border: 1px solid rgba(206,17,38,0.16);
  border-radius: var(--r-md);
  margin-bottom: 12px;
}
.territory-error i { font-size: 0.75rem; flex-shrink: 0; margin-top: 2px; }

.territory-hint {
  display: flex; align-items: center; gap: 8px;
  font-size: 0.74rem; color: var(--faint);
  font-style: italic;
}
.territory-hint i { font-size: 0.7rem; color: var(--navy); flex-shrink: 0; }

/* ── MAP ── */
.territory-right { display: flex; flex-direction: column; min-width: 0; }
.map-card { width: 100%; height: 100%; min-height: 640px; }
.map-wrap { width: 100%; height: 100%; }
#baco-map {
  width: 100%; height: 100%; min-height: 640px;
  background: #E9EDF7; position: relative;
}
.map-loader {
  position: absolute; inset: 0; z-index: 998;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.25rem; color: var(--faint);
  background: #E9EDF7;
}
.map-no-data {
  position: absolute; inset: 0; z-index: 997;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
  font-size: 0.88rem; color: var(--faint);
  text-align: center; padding: 0 24px;
}
.map-no-data i { font-size: 2rem; color: #C6CEE2; }

/* ═══════════════════════════════════════════
   SCROLL REVEAL (JS depends on these — unchanged)
   ═══════════════════════════════════════════ */
.reveal-up, .stagger-item { opacity: 0; will-change: opacity, transform; }
.reveal-up    { transform: translateY(32px); }
.stagger-item { transform: translateY(24px); }
.reveal-up.is-visible { animation: scrub-up 0.6s var(--ease) forwards; }
.stagger-item.is-visible {
  animation: scrub-up 0.55s var(--ease) forwards;
  animation-delay: calc(var(--stagger, 0) * 90ms + 60ms);
}
@keyframes scrub-up { to { opacity: 1; transform: translateY(0); } }

/* ═══════════════════════════════════════════
   MODAL
   ═══════════════════════════════════════════ */
.modal-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(7, 15, 92, 0.5);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  display: flex; align-items: center; justify-content: center;
  padding: clamp(16px, 4vw, 28px);
}
.modal-card {
  position: relative;
  background: var(--white);
  border: 1px solid var(--line);
  border-top: 4px solid var(--navy);
  border-radius: var(--r-lg);
  box-shadow: 0 32px 90px rgba(7,15,92,0.28), 0 8px 24px rgba(7,15,92,0.10);
  max-width: 540px; width: 100%;
  max-height: calc(100dvh - 48px);
  overflow-y: auto;
  padding: 44px 38px 30px;
  display: flex; flex-direction: column; align-items: center;
  text-align: center;
}
.modal-close {
  position: absolute; top: 16px; right: 16px;
  width: 40px; height: 40px; border-radius: 50%;
  background: rgba(11,25,143,0.06);
  border: 1px solid var(--line);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--muted); font-size: 0.75rem;
  transition: all 0.25s var(--ease);
}
.modal-close:hover {
  background: var(--red); color: #fff;
  border-color: var(--red); transform: rotate(90deg);
}

.modal-seal-wrap { margin-bottom: 18px; }
.modal-seal-ring {
  width: 100px; height: 100px; border-radius: 50%;
  border: 4px solid var(--red); padding: 5px;
  background: #fff;
  box-shadow: 0 10px 28px rgba(7,15,92,0.16), 0 0 0 1px var(--line);
  transition: border-color 0.3s;
}
.modal-seal-img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; }
.modal-seal-fallback {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: #9AA3BD; font-size: 1.6rem;
}

.modal-zone-badge {
  display: inline-block;
  font-size: 0.6rem; letter-spacing: 0.16em;
  text-transform: uppercase; color: #fff; line-height: 1;
  padding: 5px 14px; border-radius: 100px;
  margin-bottom: 14px;
}
.modal-name {
  font-family: 'Playfair Display', serif;
  font-size: clamp(1.6rem, 4vw, 2rem);
  font-weight: 700; color: var(--navy-deep);
  line-height: 1.15; margin-bottom: 6px;
  text-wrap: balance;
}
.modal-coords {
  font-size: 0.72rem; color: var(--faint);
  letter-spacing: 0.05em; margin-bottom: 22px;
}

.modal-stats-row {
  display: flex; align-items: stretch; width: 100%;
  padding: 18px 4px 16px;
}
.modal-stat {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; justify-content: center; gap: 5px;
}
.modal-stat-val {
  font-family: 'Playfair Display', serif;
  font-size: 1.2rem; font-weight: 700;
  color: var(--navy); line-height: 1;
}
.modal-stat-lbl {
  font-size: 0.6rem; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--faint); line-height: 1.4;
}
.modal-stat-divider {
  width: 1px; background: var(--line);
  margin: 4px 6px; flex-shrink: 0;
}

.modal-divider {
  width: 44px; height: 3px;
  background: var(--red); border-radius: 2px;
  margin: 4px auto 20px;
}
.modal-overview {
  font-size: 0.9rem; color: var(--body-c);
  line-height: 1.9; text-align: left;
  margin-bottom: 20px; width: 100%;
}
.modal-footer-hint {
  display: flex; align-items: center; gap: 7px;
  font-size: 0.68rem; color: var(--faint);
  letter-spacing: 0.02em; line-height: 1.4;
}
.modal-footer-hint i { font-size: 0.64rem; color: var(--navy); flex-shrink: 0; }

/* ═══ DISTANCE + DIRECTIONS (modal) ═══ */
.modal-map-actions {
  display: flex; flex-wrap: wrap; gap: 10px;
  width: 100%; margin-bottom: 16px;
}
.dist-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 9px;
  padding: 12px 22px; border-radius: 100px;
  font-family: 'Lora', serif; font-weight: 600; font-size: 0.82rem;
  cursor: pointer; border: 1px solid rgba(11,25,143,0.25);
  background: rgba(11,25,143,0.05); color: var(--navy-deep);
  text-decoration: none; transition: all 0.25s var(--ease);
  flex: 1; min-width: 150px;
}
.dist-btn:hover:not(:disabled) { background: var(--navy); color: #fff; transform: translateY(-2px); }
.dist-btn:disabled { opacity: 0.6; cursor: wait; transform: none; }
.dist-btn--google {
  background: linear-gradient(135deg, #4285F4, #1a73e8);
  color: #fff; border: none;
  box-shadow: 0 6px 18px rgba(66,133,244,0.3);
}
.dist-btn--google:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(66,133,244,0.45); }

.dist-line {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  font-size: 0.84rem; color: var(--body-c);
  background: rgba(11,25,143,0.05);
  border: 1px dashed rgba(11,25,143,0.3);
  border-radius: var(--r-md);
  padding: 12px 16px;
  width: 100%; margin-bottom: 16px;
  text-align: left;
}
.dist-line i { color: var(--navy); flex-shrink: 0; }
.dist-line strong { color: var(--navy); font-size: 1rem; }
.dist-line small { color: var(--faint); font-size: 0.68rem; width: 100%; }
.dist-error {
  display: flex; align-items: center; gap: 8px;
  font-size: 0.78rem; color: var(--red);
  width: 100%; margin-bottom: 16px; text-align: left;
}

/* modal transitions */
.modal-enter-active { transition: opacity 0.3s ease; }
.modal-leave-active { transition: opacity 0.22s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-active .modal-card {
  transition: transform 0.4s var(--ease), opacity 0.35s ease;
}
.modal-leave-active .modal-card {
  transition: transform 0.2s ease, opacity 0.18s ease;
}
.modal-enter-from .modal-card { transform: translateY(28px) scale(0.96); opacity: 0; }
.modal-leave-to   .modal-card { transform: translateY(14px) scale(0.98); opacity: 0; }

/* ═══════════════════════════════════════════
   RESPONSIVE — TABLET
   ════════════════════════════════════════════ */
@media (max-width: 1100px) {
  .territory-block { grid-template-columns: 1fr; }
  .territory-left  {
    border-right: none;
    border-bottom: 1px solid rgba(11,25,143,0.08);
    padding: 40px 36px;
  }
  .map-card, #baco-map { min-height: 500px; }
}

/* ═══════════════════════════════════════════
   RESPONSIVE — SMALL TABLET
   ════════════════════════════════════════════ */
@media (max-width: 860px) {
  .municipality-page { --gutter: 24px; }
  .hero-scroll       { right: 24px; bottom: 56px; }
  .modal-card        { padding: 34px 26px 26px; }
  .modal-stats-row   { padding: 16px 0 14px; }
}

/* ═══════════════════════════════════════════
   RESPONSIVE — MOBILE
   ════════════════════════════════════════════ */
@media (max-width: 640px) {
  .municipality-page { --gutter: 20px; }

  /* hero */
  .hero-panel       { min-height: 100svh; }
  .hero-content     { padding: 84px var(--gutter) 44px; }
  .hero-scroll      { display: none; }
  .hero-badge       { margin-bottom: 18px; }
  .badge-text       { font-size: 0.6rem; }
  .hero-title       { font-size: clamp(2.2rem, 10vw, 3rem); margin-bottom: 12px; }
  .hero-sub         { font-size: 1rem; max-width: 100%; }

  /* stats become a clean 2×2 grid.
     NOTE: .pill-sep elements still exist in the DOM (display:none),
     so nth-child selectors must account for them:
     pills are children 1, 3, 5, 7 → 4n+3 = right column,
     nth-last-child(-n+3) = bottom row (5 & 7). */
  .hero-pills {
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin-top: 28px;
    padding-top: 10px;
    max-width: none;
  }
  .pill-sep  { display: none; }
  .hero-pill { padding: 14px 12px 14px 0; border-bottom: 1px solid rgba(255,255,255,0.10); }
  .hero-pill:nth-child(4n+3) {
    border-left: 1px solid rgba(255,255,255,0.10);
    padding-left: 16px;
  }
  .hero-pill:nth-last-child(-n+3) { border-bottom: none; }
  .pill-val  { font-size: 1.3rem; }
  .pill-lbl  { font-size: 0.58rem; }

  /* panel */
  .territory-left    { padding: 28px 20px; }
  .territory-heading { font-size: 1.9rem; }

  /* stats stack: value + label on one baseline */
  .territory-stats { flex-direction: column; gap: 14px; padding: 16px 18px; }
  .t-stat          { flex-direction: row; align-items: baseline; gap: 10px; }
  .t-stat-val      { font-size: 1.25rem; }
  .t-stat-sep      { display: none; }

  /* map */
  .map-card, #baco-map, .territory-right { min-height: 420px; }

  /* modal */
  .modal-card         { padding: 30px 20px 24px; }
  .modal-seal-ring    { width: 78px; height: 78px; border-width: 3px; }
  .modal-name         { font-size: 1.45rem; }
  .modal-stats-row    { flex-wrap: wrap; gap: 2px; padding: 14px 0 12px; }
  .modal-stat-divider { display: none; }
  .modal-stat {
    flex: 0 0 100%;
    flex-direction: row; align-items: baseline; gap: 8px;
    padding: 7px 0;
    border-bottom: 1px solid rgba(16,21,43,0.06);
  }
  .modal-stat:last-child { border-bottom: none; }
  .modal-stat-val        { font-size: 1.05rem; }
  .modal-overview        { font-size: 0.84rem; }
}

/* respect users who prefer less motion */
@media (prefers-reduced-motion: reduce) {
  .reveal-up, .stagger-item { opacity: 1 !important; transform: none !important; animation: none !important; }
  .badge-dot, .scroll-thumb { animation: none !important; }
}
</style>