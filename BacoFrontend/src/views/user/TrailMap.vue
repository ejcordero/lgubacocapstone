<template>
  <div class="trail-map-content">

    <!-- Header -->
    <div class="page-header">
      <div class="header-eyebrow">
        <Mountain size="16" />
        Mt. Halcon Trail System
      </div>
      <h2 class="section-title">Maps & Trails</h2>
      <p class="section-subtitle">Explore the trails and navigate Mt. Halcon's terrain.</p>
    </div>

    <!-- Map Container -->
    <div class="map-card">
      <!-- Controls -->
      <div class="map-controls">
        <button class="control-btn" :class="{ active: activeLayer === 'terrain' }" @click="setLayer('terrain')">
          <Layers size="16" /> Terrain
        </button>
        <button class="control-btn" :class="{ active: activeLayer === 'satellite' }" @click="setLayer('satellite')">
          <Map size="16" /> Satellite
        </button>
        <button class="control-btn" :class="{ active: activeLayer === 'trails' }" @click="setLayer('trails')">
          <Navigation size="16" /> Trails
        </button>
        <div class="controls-divider"></div>
        <button class="control-btn icon-only" title="Zoom In" @click="zoomIn">
          <ZoomIn size="16" />
        </button>
        <button class="control-btn icon-only" title="Zoom Out" @click="zoomOut">
          <ZoomOut size="16" />
        </button>
        <button class="control-btn icon-only locate" title="My Location" @click="locate">
          <Crosshair size="16" />
        </button>
      </div>

      <!-- Map View -->
      <div id="halcon-trail-map" class="map-view">
        <!-- Legend -->
        <div class="map-legend">
          <div class="legend-item">
            <span class="legend-line red"></span>
            <span>Lantuyan Trail</span>
          </div>
          <div class="legend-item">
            <span class="legend-line blue"></span>
            <span>Aplaya Trail</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Info Grid -->
    <div class="info-grid">

      <!-- Trail Stats -->
      <div class="info-card">
        <div class="info-card-header">
          <div class="info-card-icon">
            <TrendingUp size="18" />
          </div>
          <h3 class="info-card-title">Trail Statistics</h3>
        </div>
        <div class="stats-list">
          <div v-for="stat in stats" :key="stat.label" class="stat-row">
            <span class="stat-label">{{ stat.label }}</span>
            <span class="stat-value">{{ stat.value }}</span>
          </div>
        </div>
      </div>

      <!-- Trail Guide -->
      <div class="info-card">
        <div class="info-card-header">
          <div class="info-card-icon">
            <BookOpen size="18" />
          </div>
          <h3 class="info-card-title">Trail Guide</h3>
        </div>
        <div class="guide-list">
          <div v-for="guide in guides" :key="guide.title" class="guide-row">
            <div :class="['guide-icon-box', guide.color]">
              <component :is="guide.icon" size="15" />
            </div>
            <div>
              <p class="guide-title">{{ guide.title }}</p>
              <p class="guide-desc">{{ guide.desc }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Difficulty Card -->
      <div class="info-card difficulty-card">
        <div class="info-card-header">
          <div class="info-card-icon red">
            <AlertTriangle size="18" />
          </div>
          <h3 class="info-card-title">Difficulty Rating</h3>
        </div>
        <div class="difficulty-body">
          <div class="difficulty-score">
            <span class="score-num">8.5</span>
            <span class="score-label">/ 10</span>
          </div>
          <p class="difficulty-tag">Very Challenging</p>
          <div class="difficulty-bars">
            <div v-for="bar in difficultyBars" :key="bar.label" class="bar-row">
              <span class="bar-label">{{ bar.label }}</span>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: bar.pct }"></div>
              </div>
              <span class="bar-pct">{{ bar.pct }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Emergency Card -->
      <div class="info-card emergency-card">
        <div class="info-card-header">
          <div class="info-card-icon red">
            <Phone size="18" />
          </div>
          <h3 class="info-card-title">Emergency Contacts</h3>
        </div>
        <div class="contact-list">
          <div v-for="contact in contacts" :key="contact.name" class="contact-row">
            <div class="contact-info">
              <p class="contact-name">{{ contact.name }}</p>
              <p class="contact-role">{{ contact.role }}</p>
            </div>
            <a :href="`tel:${contact.number}`" class="call-btn">
              <Phone size="13" />
              {{ contact.number }}
            </a>
          </div>
        </div>
      </div>

    </div>

  </div>
</template>

<script setup>
import { ref, markRaw, onMounted, onBeforeUnmount } from 'vue'
import {
  Mountain, Layers, Map, Navigation, ZoomIn, ZoomOut,
  Crosshair, TrendingUp, BookOpen, Info, AlertTriangle,
  Phone, Sun, Compass
} from 'lucide-vue-next'

const activeLayer = ref('terrain')

let mapInstance = null
let baseLayer = null
let userMarker = null

/* ── Trail geometry (approx. coordinates on Mt. Halcon) ── */
const lantuyanRoute = [
  [13.2680, 121.0420], [13.2635, 121.0290], [13.2585, 121.0185], [13.2546, 121.0074],
]
const aplayaRoute = [
  [13.2510, 121.0160], [13.2585, 121.0185], [13.2546, 121.0074],
]

const MARKER_ICONS = {
  start: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  camp: '<path d="M3.5 21 14 3l10.5 18"/><path d="M3.5 21H24"/>',
  summit: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
}
const MARKER_COLORS = { start: 'var(--navy)', camp: '#f59e0b', summit: '#93273A' }

const waypoints = [
  { lat: 13.2680, lng: 121.0420, title: 'Lantuyan Trailhead', desc: 'Starting point for the main trail', label: 'Start', type: 'start' },
  { lat: 13.2635, lng: 121.0290, title: 'Campsite 1', desc: 'First overnight camping area (~4hrs)', label: 'Camp', type: 'camp' },
  { lat: 13.2585, lng: 121.0185, title: 'Campsite 2', desc: 'Second overnight stop (~7hrs)', label: 'Camp', type: 'camp' },
  { lat: 13.2546, lng: 121.0074, title: 'Mt. Halcon Summit', desc: 'Peak elevation: 1,773m AMSL', label: 'Summit', type: 'summit' },
  { lat: 13.2510, lng: 121.0160, title: 'Aplaya Trailhead', desc: 'Alternative entry/exit point', label: 'Alt. Start', type: 'start' },
]

function tileLayer(L) {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  if (activeLayer.value === 'satellite') {
    return L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '<a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
      maxZoom: 18,
    })
  }
  if (activeLayer.value === 'trails') {
    return L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors · © OpenTopoMap (CC-BY-SA)',
      maxZoom: 17,
    })
  }
  if (dark) {
    return L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    })
  }
  return L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  })
}

function setLayer(mode) {
  activeLayer.value = mode
  if (!mapInstance) return
  import('leaflet').then((L) => {
    if (baseLayer) mapInstance.removeLayer(baseLayer)
    baseLayer = tileLayer(L)
    baseLayer.addTo(mapInstance)
  })
}

function pinIcon(L, wp) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${MARKER_ICONS[wp.type] || MARKER_ICONS.start}</svg>`
  const html = `<div class="hlc-pin" style="background:${MARKER_COLORS[wp.type] || 'var(--navy)'}">${svg}</div>`
  return L.divIcon({ className: 'hlc-pin-wrap', html, iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -36] })
}

function initMap() {
  import('leaflet').then((L) => {
    if (mapInstance) return
    mapInstance = L.map('halcon-trail-map', {
      zoomControl: false,
      scrollWheelZoom: true,
      minZoom: 10,
      maxZoom: 18,
    })

    baseLayer = tileLayer(L)
    baseLayer.addTo(mapInstance)

    /* Trails */
    L.polyline(lantuyanRoute, { color: '#93273A', weight: 3, opacity: 0.9 }).addTo(mapInstance)
    L.polyline(aplayaRoute, { color: '#101B3D', weight: 2.5, opacity: 0.8, dashArray: '4 7' }).addTo(mapInstance)

    /* Waypoint markers with popups */
    waypoints.forEach((wp) => {
      const popup = L.popup({ className: 'hlc-popup', offset: [0, -6] }).setContent(
        `<div class="hlc-popup-body">
          <p class="hlc-pt">${wp.title}</p>
          <p class="hlc-td">${wp.desc}</p>
          <span class="hlc-tb ${wp.type}">${wp.label}</span>
        </div>`
      )
      L.marker([wp.lat, wp.lng], { icon: pinIcon(L, wp) }).bindPopup(popup).addTo(mapInstance)
    })

    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(mapInstance)

    mapInstance.fitBounds(lantuyanRoute.concat(aplayaRoute), { padding: [40, 40] })
  })
}

const zoomIn  = () => mapInstance && mapInstance.zoomIn()
const zoomOut = () => mapInstance && mapInstance.zoomOut()
const locate  = () => {
  if (!mapInstance) return
  mapInstance.locate({ setView: true, maxZoom: 15 })
  import('leaflet').then((L) => {
    mapInstance.on('locationfound', (e) => {
      if (userMarker) mapInstance.removeLayer(userMarker)
      userMarker = L.circleMarker(e.latlng, {
        radius: 8, color: '#93273A', weight: 3, fillColor: '#93273A', fillOpacity: 0.85,
      }).addTo(mapInstance)
    })
    mapInstance.on('locationerror', () => {
      mapInstance.flyTo([13.2600, 121.0200], 11)
    })
  })
}

onMounted(initMap)
onBeforeUnmount(() => {
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
    baseLayer = null
    userMarker = null
  }
})

const stats = [
  { label: 'Total Distance',  value: '12.5 km' },
  { label: 'Elevation Gain',  value: '1,500 m' },
  { label: 'Highest Point',   value: '1,773 m' },
  { label: 'Difficulty',      value: 'Challenging' },
  { label: 'Est. Duration',   value: '2 – 3 Days' },
  { label: 'Trail Type',      value: 'Out & Back' },
]

const guides = [
  {
    title: 'Best Season',
    desc: 'November to February (dry season)',
    icon: markRaw(Sun),
    color: 'yellow',
  },
  {
    title: 'Permit Required',
    desc: 'Apply at least 3 days before trek',
    icon: markRaw(Info),
    color: 'blue',
  },
  {
    title: 'Trail Condition',
    desc: 'Steep, rocky — proper footwear required',
    icon: markRaw(Compass),
    color: 'blue',
  },
  {
    title: 'Safety Warning',
    desc: 'Always check weather before ascending',
    icon: markRaw(AlertTriangle),
    color: 'red',
  },
]

const difficultyBars = [
  { label: 'Terrain',   pct: '90%' },
  { label: 'Endurance', pct: '85%' },
  { label: 'Technical', pct: '70%' },
]

const contacts = [
  { name: 'Tourism Office',       role: 'Permits & General Info',  number: '0912-345-6789' },
  { name: 'Baco MDRRMO',          role: 'Disaster Risk & Rescue',  number: '0917-123-4567' },
  { name: 'Halcon Trail Rangers', role: 'On-trail Assistance',     number: '0921-987-6543' },
]
</script>

<style scoped>

.trail-map-content {
  max-width: 1500px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  font-family: var(--bb-font-body);
}

/* Header */
.header-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--rust);
  margin-bottom: 0.375rem;
}

.section-title {
  font-size: var(--bb-text-3xl);
  font-weight: var(--bb-weight-extrabold);
  color: var(--bb-ink);
  margin: 0 0 0.25rem;
}

.section-subtitle {
  font-size: var(--bb-text-base);
  color: var(--muted);
  margin: 0;
}

/* Map Card */
.map-card {
  background: var(--bb-surface);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--bb-shadow-md);
  border: 1px solid var(--bb-border);
}

/* Controls */
.map-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--sand-2);
  flex-wrap: wrap;
}

.controls-divider {
  width: 1px;
  height: 24px;
  background: var(--border);
  margin: 0 0.25rem;
}

.control-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  background: var(--sand);
  border: 1.5px solid var(--border);
  border-radius: 0.625rem;
  font-family: var(--bb-font-body);
  font-size: var(--bb-text-sm);
  font-weight: var(--bb-weight-semibold);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s;
}

.control-btn:hover { border-color: var(--bb-accent); color: var(--bb-accent-ink); background: var(--bb-accent-soft); }
.control-btn.active { background: var(--bb-accent); color: var(--bb-on-accent); border-color: var(--bb-accent); }
.control-btn.icon-only { padding: 0.5rem; }
.control-btn.locate.active { background: var(--rust); border-color: var(--rust); }

/* Map View */
.map-view {
  position: relative;
  width: 100%;
  height: 460px;
  overflow: hidden;
  background: var(--bb-bg-subtle);
}

.map-view .leaflet-container {
  width: 100%;
  height: 100%;
  background: var(--bb-bg-subtle);
  font-family: var(--bb-font-body);
}

/* Legend */
.map-legend {
  position: absolute;
  z-index: 700;
  bottom: 1rem;
  left: 1rem;
  background: var(--bb-surface);
  border-radius: var(--radius-sm);
  padding: 0.625rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  border: 1px solid var(--border);
  box-shadow: 0 4px 12px rgba(0,0,0,0.18);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-semibold);
  color: var(--bb-text-secondary);
}

.legend-line {
  display: inline-block;
  width: 24px;
  height: 3px;
  border-radius: var(--radius-pill);
}

.legend-line.red  { background: var(--rust); }
.legend-line.blue { background: var(--navy); opacity: 0.7; }

/* Info Grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
}

/* Info Card */
.info-card {
  background: var(--bb-surface);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  border: 1px solid var(--bb-border);
  box-shadow: var(--bb-shadow-md);
}

.info-card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.info-card-icon {
  width: 36px;
  height: 36px;
  border-radius: 0.625rem;
  background: var(--bb-bg-subtle);
  color: var(--bb-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.info-card-icon.red { background: rgba(147, 39, 58,0.08); color: var(--rust); }

.info-card-title {
  font-size: var(--bb-text-lg);
  font-weight: var(--bb-weight-bold);
  color: var(--bb-ink);
  margin: 0;
}

/* Stats */
.stats-list { display: flex; flex-direction: column; gap: 0; }

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--sand-2);
}

.stat-row:last-child { border-bottom: none; }

.stat-label { font-size: var(--bb-text-base); color: var(--muted); }
.stat-value { font-size: var(--bb-text-base); font-weight: var(--bb-weight-bold); color: var(--bb-ink); }

/* Guide */
.guide-list { display: flex; flex-direction: column; gap: 1rem; }

.guide-row {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
}

.guide-icon-box {
  width: 32px;
  height: 32px;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.guide-icon-box.blue   { background: var(--bb-bg-subtle);  color: var(--bb-ink); }
.guide-icon-box.yellow { background: rgba(234,179,8,0.12);  color: var(--bb-warning); }
.guide-icon-box.red    { background: rgba(147, 39, 58,0.08);  color: var(--rust); }

.guide-title { font-size: var(--bb-text-base); font-weight: var(--bb-weight-bold); color: var(--bb-ink); margin: 0 0 0.1rem; }
.guide-desc  { font-size: var(--bb-text-xs); color: var(--muted); margin: 0; line-height: 1.4; }

/* Difficulty */
.difficulty-body { display: flex; flex-direction: column; gap: 1rem; }

.difficulty-score {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
}

.score-num   { font-size: var(--bb-text-4xl); font-weight: var(--bb-weight-extrabold); color: var(--rust); line-height: 1; }
.score-label { font-size: var(--bb-text-base); color: var(--bb-text-tertiary); font-weight: var(--bb-weight-semibold); }

.difficulty-tag {
  display: inline-block;
  padding: 0.25rem 0.875rem;
  background: rgba(147, 39, 58,0.1);
  color: var(--rust);
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-bold);
  border-radius: var(--radius-pill);
  align-self: flex-start;
  margin-top: -0.5rem;
}

.difficulty-bars { display: flex; flex-direction: column; gap: 0.625rem; }

.bar-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.bar-label { font-size: var(--bb-text-xs); color: var(--muted); width: 70px; flex-shrink: 0; }

.bar-track {
  flex: 1;
  height: 7px;
  background: var(--sand-2);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(to right, var(--navy), var(--rust));
  border-radius: var(--radius-pill);
  transition: width 0.8s ease;
}

.bar-pct { font-size: var(--bb-text-xs); font-weight: var(--bb-weight-bold); color: var(--bb-text-secondary); width: 36px; text-align: right; flex-shrink: 0; }

/* Emergency */
.contact-list { display: flex; flex-direction: column; gap: 0.875rem; }

.contact-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1rem;
  background: var(--sand);
  border-radius: 0.875rem;
  border: 1px solid var(--sand-2);
}

.contact-name { font-size: var(--bb-text-base); font-weight: var(--bb-weight-bold); color: var(--bb-ink); margin: 0 0 0.15rem; }
.contact-role { font-size: var(--bb-text-xs); color: var(--bb-text-tertiary); margin: 0; }

.call-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.45rem 0.875rem;
  background: var(--bb-accent);
  color: var(--bb-on-accent);
  font-family: var(--bb-font-body);
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-bold);
  border-radius: 0.625rem;
  text-decoration: none;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
  box-shadow: 0 3px 8px var(--bb-accent-soft);
}

.call-btn:hover {
  background: var(--bb-accent-hover);
  transform: translateY(-1px);
  box-shadow: var(--bb-shadow-md);
}

/* Responsive */
/* ── Mobile ── */
@media (max-width: 768px) {
  .trail-map-content { gap: 1rem; }
  .section-title { font-size: var(--bb-text-2xl); }

  .map-controls {
    padding: 0.625rem 0.75rem;
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .map-controls::-webkit-scrollbar { display: none; }
  .control-btn { white-space: nowrap; }
  .control-btn:not(.icon-only) { padding: 0.4rem 0.75rem; font-size: var(--bb-text-xs); }

  .map-view { height: 300px; }
  .map-legend { padding: 0.5rem 0.75rem; gap: 0.3rem; }
  .legend-item { font-size: var(--bb-text-2xs); }

  .info-grid { grid-template-columns: 1fr; gap: 0.875rem; }
  .info-card { padding: 1.25rem; }
  .info-card-header { margin-bottom: 1rem; }
  .info-card-icon { width: 32px; height: 32px; }

  .contact-row { flex-direction: column; align-items: flex-start; }
  .call-btn { width: 100%; justify-content: center; }
}

@media (max-width: 480px) {
  .header-eyebrow { font-size: var(--bb-text-2xs); }
  .section-title { font-size: var(--bb-text-2xl); }
  .section-subtitle { font-size: var(--bb-text-xs); }

  .map-view { height: 260px; }
  .map-controls { gap: 0.35rem; }
  .control-btn { font-size: var(--bb-text-2xs); }
  .control-btn:not(.icon-only) { padding: 0.35rem 0.6rem; }
  .control-btn.icon-only { padding: 0.4rem; }
  .map-legend { bottom: 0.75rem; left: 0.75rem; padding: 0.4rem 0.625rem; }

  .info-card { padding: 1rem; border-radius: 16px; }
  .info-card-header { gap: 0.6rem; margin-bottom: 0.85rem; }
  .info-card-icon { width: 30px; height: 30px; border-radius: 0.55rem; }
  .info-card-title { font-size: var(--bb-text-md); }

  .stat-row { padding: 0.6rem 0; }
  .stat-label { font-size: var(--bb-text-xs); }
  .stat-value { font-size: var(--bb-text-base); }

  .guide-title { font-size: var(--bb-text-sm); }
  .guide-desc { font-size: var(--bb-text-xs); }
  .guide-icon-box { width: 28px; height: 28px; }

  .score-num { font-size: var(--bb-text-3xl); }
  .difficulty-tag { font-size: var(--bb-text-xs); }
  .bar-label { width: 60px; font-size: var(--bb-text-xs); }
  .bar-pct { width: 32px; font-size: var(--bb-text-2xs); }

  .contact-row { padding: 0.75rem; }
  .contact-name { font-size: var(--bb-text-sm); }
}
</style>

<style>
/* ══ Leaflet theming for the Halcon trail map ══ */
.hlc-pin-wrap { background: transparent; border: none; }
.hlc-pin {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  border: 3px solid #fff;
  box-shadow: 0 6px 16px rgba(0,0,0,0.35);
  box-sizing: border-box;
}

#halcon-trail-map .leaflet-container { background: var(--bb-bg-subtle); font-family: var(--bb-font-body); }
#halcon-trail-map .leaflet-popup-content-wrapper {
  background: var(--bb-surface);
  color: var(--bb-ink);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.25);
}
#halcon-trail-map .leaflet-popup-tip { background: var(--bb-surface); }
#halcon-trail-map .leaflet-popup-content { margin: 14px 16px; }
#halcon-trail-map .leaflet-popup-close-button { color: var(--bb-text-tertiary); }
#halcon-trail-map .leaflet-control-attribution {
  background: var(--bb-glass-bg-strong);
  color: var(--bb-text-tertiary);
  font-size: var(--bb-text-2xs);
}

.hlc-popup-body { min-width: 150px; }
.hlc-pt { font-size: var(--bb-text-base); font-weight: var(--bb-weight-bold); color: var(--bb-ink); margin: 0 0 2px; }
.hlc-td { font-size: var(--bb-text-xs); color: var(--muted); margin: 0 0 8px; line-height: 1.4; }
.hlc-tb { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-bold); text-transform: uppercase; letter-spacing: 0.05em; }
.hlc-tb.start  { background: var(--bb-accent-soft); color: var(--bb-ink); }
.hlc-tb.camp   { background: rgba(245,158,11,0.14); color: var(--bb-warning); }
.hlc-tb.summit { background: rgba(147,39,58,0.1); color: var(--rust); }
</style>
