<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'

// ── INSTALL:  npm install leaflet lenis gsap
// ── In main.js add:  import 'leaflet/dist/leaflet.css'

// ── Scroll reveal observer ──
let observer = null

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
  document.querySelectorAll(
    '.reveal-up, .reveal-left, .reveal-right, .reveal-fade, .stagger-item'
  ).forEach((el) => observer.observe(el))
}

let gsapInst = null
let ScrollTriggerInst = null
let lenisTicker = null  // stored reference so we can remove it

const isLoading        = ref(true)
const searchQuery      = ref('')
const selectedBarangay = ref(null)

const barangays = ref([
  { id: 1,  name: 'Alag',           lat: 13.2850, lng: 121.0420, pop: 1166,  area: 'Upland'   },
  { id: 2,  name: 'Bangkatan',      lat: 13.3780, lng: 121.0850, pop: 2387,  area: 'Lowland'  },
  { id: 3,  name: 'Baras',          lat: 13.3100, lng: 121.0300, pop: 1563,  area: 'Upland'   },
  { id: 4,  name: 'Bayanan',        lat: 13.2500, lng: 121.0000, pop: 1518,  area: 'Upland'   },
  { id: 5,  name: 'Burbuli',        lat: 13.3200, lng: 121.0550, pop: 594,   area: 'Upland'   },
  { id: 6,  name: 'Catwiran I',     lat: 13.3480, lng: 121.0780, pop: 1466,  area: 'Lowland'  },
  { id: 7,  name: 'Catwiran II',    lat: 13.3420, lng: 121.0700, pop: 1507,  area: 'Lowland'  },
  { id: 8,  name: 'Dulangan I',     lat: 13.3600, lng: 121.1050, pop: 1774,  area: 'Lowland'  },
  { id: 9,  name: 'Dulangan II',    lat: 13.3550, lng: 121.0980, pop: 2749,  area: 'Lowland'  },
  { id: 10, name: 'Lantuyang',      lat: 13.2700, lng: 120.9800, pop: 1281,  area: 'Upland'   },
  { id: 11, name: 'Lumang Bayan',   lat: 13.3900, lng: 121.0950, pop: 647,   area: 'Coastal'  },
  { id: 12, name: 'Malapad',        lat: 13.3700, lng: 121.1100, pop: 505,   area: 'Coastal'  },
  { id: 13, name: 'Mangangan I',    lat: 13.3480, lng: 121.0900, pop: 2689,  area: 'Lowland'  },
  { id: 14, name: 'Mangangan II',   lat: 13.3400, lng: 121.0860, pop: 799,   area: 'Lowland'  },
  { id: 15, name: 'Mayabig',        lat: 13.3300, lng: 121.0650, pop: 1701,  area: 'Lowland'  },
  { id: 16, name: 'Pambisan',       lat: 13.3750, lng: 121.1050, pop: 1201,  area: 'Coastal'  },
  { id: 17, name: 'Poblacion',      lat: 13.3580, lng: 121.0965, pop: 2860,  area: 'Lowland'  },
  { id: 18, name: 'Pulang-Tubig',   lat: 13.3650, lng: 121.1080, pop: 962,   area: 'Coastal'  },
  { id: 19, name: 'Putican-Cabulo', lat: 13.3500, lng: 121.1020, pop: 502,   area: 'Lowland'  },
  { id: 20, name: 'San Andres',     lat: 13.3800, lng: 121.0700, pop: 321,   area: 'Coastal'  },
  { id: 21, name: 'San Ignacio',    lat: 13.3000, lng: 121.0400, pop: 2392,  area: 'Upland'   },
  { id: 22, name: 'Santa Cruz',     lat: 13.3450, lng: 121.0820, pop: 1150,  area: 'Lowland'  },
  { id: 23, name: 'Santo Niño',     lat: 13.3620, lng: 121.0800, pop: 890,   area: 'Lowland'  },
  { id: 24, name: 'Tabon-Tabon',    lat: 13.3850, lng: 121.0900, pop: 743,   area: 'Coastal'  },
  { id: 25, name: 'Tagumpay',       lat: 13.3700, lng: 121.0830, pop: 1020,  area: 'Lowland'  },
  { id: 26, name: 'Vista Bella',    lat: 13.3820, lng: 121.0960, pop: 1250,  area: 'Coastal'  },
  { id: 27, name: 'Gulod',          lat: 13.3680, lng: 121.0750, pop: 980,   area: 'Lowland'  },
])

const filteredBarangays = computed(() => {
  if (!searchQuery.value) return barangays.value
  return barangays.value.filter(b =>
    b.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    b.area.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const totalPop = computed(() =>
  barangays.value.reduce((s, b) => s + b.pop, 0).toLocaleString()
)

// Returns color hex based on area type
const areaColor = (area) => {
  if (area === 'Coastal') return '#0B198F'
  if (area === 'Upland')  return '#2d6e2d'
  return '#CE1126' // Lowland
}

let map     = null
let markers = []
let lenis   = null

onMounted(async () => {
  // ── GSAP + ScrollTrigger ──
  const [{ gsap }, { ScrollTrigger }, LenisModule] = await Promise.all([
    import('gsap'),
    import('gsap/ScrollTrigger'),
    import('lenis'),
  ])
  gsapInst = gsap
  ScrollTriggerInst = ScrollTrigger
  gsap.registerPlugin(ScrollTrigger)

  // ── Lenis smooth scroll ──
  const Lenis = LenisModule.default ?? LenisModule.Lenis
  lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  })
  lenis.on('scroll', ScrollTrigger.update)
  lenisTicker = (time) => { if (lenis) lenis.raf(time * 1000) }
  gsap.ticker.add(lenisTicker)
  gsap.ticker.lagSmoothing(0)

  // ── Hero background parallax ──
  gsap.to('.hero-bg', {
    yPercent: 22,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      scrub: true,
    },
  })

  // ── Hero content fades + rises on scroll ──
  gsap.to('.hero-inner', {
    yPercent: 10,
    opacity: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: '55% top',
      scrub: true,
    },
  })

  // ── Leaflet ──
  const L = await import('leaflet')
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
    iconUrl:       new URL('leaflet/dist/images/marker-icon.png',    import.meta.url).href,
    shadowUrl:     new URL('leaflet/dist/images/marker-shadow.png',  import.meta.url).href,
  })

  map = L.map('baco-map', {
    center: [13.3580, 121.0965],
    zoom: 12,
    zoomControl: false,
    attributionControl: true,
    scrollWheelZoom: false,   // ← disabled by default
    touchZoom: false,
  })

  // Re-enable scroll zoom only when map is clicked/focused;
  // disable again when user clicks outside
  const mapEl = document.getElementById('baco-map')
  const overlay = document.getElementById('map-scroll-guard')

  mapEl.addEventListener('click', () => {
    map.scrollWheelZoom.enable()
    map.touchZoom.enable()
    if (overlay) overlay.style.display = 'none'
  })

  document.addEventListener('click', (e) => {
    if (!mapEl.contains(e.target)) {
      map.scrollWheelZoom.disable()
      map.touchZoom.disable()
      if (overlay) overlay.style.display = 'flex'
    }
  })

  L.control.zoom({ position: 'bottomright' }).addTo(map)

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a> © <a href="https://carto.com/">CARTO</a>',
    maxZoom: 18,
    subdomains: 'abcd',
  }).addTo(map)

  const createIcon = (color = '#0B198F', isSelected = false) => L.divIcon({
    className: '',
    html: `<div style="
      width: ${isSelected ? '28px' : '22px'};
      height: ${isSelected ? '28px' : '22px'};
      background: ${color};
      border-radius: 50%;
      border: 2.5px solid #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      transition: transform 0.15s;
    "></div>`,
    iconSize: isSelected ? [28, 28] : [22, 22],
    iconAnchor: isSelected ? [14, 14] : [11, 11],
    popupAnchor: [0, isSelected ? -18 : -14],
  })

  barangays.value.forEach(b => {
    const color = areaColor(b.area)
    const marker = L.marker([b.lat, b.lng], { icon: createIcon(color, false) })
      .addTo(map)
      .bindPopup(`
        <div style="font-family:'Inter',sans-serif; padding:4px 0; min-width:160px;">
          <div style="font-size:0.6rem; font-weight:600; color:#CE1126; letter-spacing:0.14em; text-transform:uppercase; margin-bottom:4px;">${b.area}</div>
          <div style="font-size:0.95rem; font-weight:600; color:#0B198F; margin-bottom:3px; font-family:'Playfair Display',serif;">${b.name}</div>
          <div style="width:18px; height:2px; background:#CE1126; margin-bottom:6px;"></div>
          <div style="font-size:0.72rem; color:#666;">${b.pop.toLocaleString()} residents</div>
        </div>`,
        { maxWidth: 200, className: 'baco-popup' }
      )
      .on('click', () => {
        // Reset all markers to default
        markers.forEach(mk => {
          const c = areaColor(barangays.value.find(x => x.id === mk.id)?.area || 'Lowland')
          mk.marker.setIcon(createIcon(c, false))
        })
        // Highlight selected
        marker.setIcon(createIcon('#CE1126', true))
        selectedBarangay.value = b
        const el = document.getElementById(`brgy-${b.id}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    markers.push({ id: b.id, marker })
  })

  isLoading.value = false

  // Small delay so DOM is ready with all reveal elements
  setTimeout(initScrollReveal, 80)
})

onUnmounted(() => {
  // Remove ticker first — before destroying lenis — so no more raf calls fire
  if (gsapInst && lenisTicker) { gsapInst.ticker.remove(lenisTicker); lenisTicker = null }
  if (lenis)              { lenis.destroy();                        lenis = null }
  if (ScrollTriggerInst)  { ScrollTriggerInst.getAll().forEach(t => t.kill()) }
  if (map)                { map.remove();                           map = null }
  if (observer)           { observer.disconnect();                  observer = null }
})

const flyTo = (b) => {
  selectedBarangay.value = b
  if (map) {
    // Reset all markers
    markers.forEach(mk => {
      const c = areaColor(barangays.value.find(x => x.id === mk.id)?.area || 'Lowland')
      const L_marker = mk.marker
      import('leaflet').then(({ default: L }) => {
        L_marker.setIcon(createIconExternal(L, c, false))
      })
    })
    map.flyTo([b.lat, b.lng], 14, { animate: true, duration: 1 })
    const m = markers.find(mk => mk.id === b.id)
    if (m) {
      import('leaflet').then(({ default: L }) => {
        m.marker.setIcon(createIconExternal(L, '#CE1126', true))
        m.marker.openPopup()
      })
    }
  }
}

// Helper for flyTo (needs L reference)
const createIconExternal = (L, color, isSelected) => L.divIcon({
  className: '',
  html: `<div style="
    width: ${isSelected ? '28px' : '22px'};
    height: ${isSelected ? '28px' : '22px'};
    background: ${color};
    border-radius: 50%;
    border: 2.5px solid #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  "></div>`,
  iconSize: isSelected ? [28, 28] : [22, 22],
  iconAnchor: isSelected ? [14, 14] : [11, 11],
  popupAnchor: [0, isSelected ? -18 : -14],
})

const clearSelection = () => {
  selectedBarangay.value = null
  markers.forEach(mk => {
    const b = barangays.value.find(x => x.id === mk.id)
    if (!b) return
    const color = areaColor(b.area)
    import('leaflet').then(({ default: L }) => {
      mk.marker.setIcon(createIconExternal(L, color, false))
      mk.marker.closePopup()
    })
  })
}
</script>

<template>
  <div class="page">

    <!-- ── HERO ── -->
    <div class="hero">
      <div class="hero-bg"></div>
      <div class="hero-overlay"></div>
      <div class="hero-inner reveal-fade">
        <div class="hero-eyebrow">
          <span class="hero-eyebrow-line"></span>
          <span class="hero-eyebrow-text">Oriental Mindoro</span>
          <span class="hero-eyebrow-line"></span>
        </div>
        <h1 class="hero-title">Our Barangays<span class="hero-dot">.</span></h1>
        <p class="hero-sub">27 barangays spanning 216 km² across upland, lowland, and coastal zones.</p>
      </div>
    </div>

    <!-- ── BREADCRUMB ── -->
    <div class="breadcrumb-bar">
      <div class="breadcrumb-inner">
        <a href="/" class="bc-link">Home</a>
        <span class="bc-sep">›</span>
        <a href="/about" class="bc-link">About</a>
        <span class="bc-sep">›</span>
        <strong class="bc-current">Our Barangays</strong>
      </div>
    </div>

    <!-- ── MAIN CONTENT ── -->
    <div class="main">

      <!-- Section heading -->
      <div class="section-head reveal-up">
        <div class="section-eyebrow">Overview</div>
        <h2 class="section-title">Barangays of Baco</h2>
      </div>

      <!-- Stats strip -->
      <div class="stats-strip">
        <div class="stat-card stat-navy stagger-item" style="--stagger: 0">
          <div class="stat-val">{{ totalPop }}</div>
          <div class="stat-lbl">Total Residents</div>
        </div>
        <div class="stat-card stat-red stagger-item" style="--stagger: 1">
          <div class="stat-val">27</div>
          <div class="stat-lbl">Barangays</div>
        </div>
        <div class="stat-card stat-navy stagger-item" style="--stagger: 2">
          <div class="stat-val">216 km²</div>
          <div class="stat-lbl">Total Area</div>
        </div>
      </div>

      <!-- Two-column layout -->
      <div class="body-grid">

        <!-- ── LEFT SIDEBAR ── -->
        <aside class="sidebar reveal-left">

          <!-- Detail card / hint -->
          <Transition name="fade-up">
            <div v-if="selectedBarangay" class="detail-card" key="detail">
              <div class="detail-eyebrow">{{ selectedBarangay.area }}</div>
              <div class="detail-name">{{ selectedBarangay.name }}</div>
              <div class="detail-rule"></div>
              <div class="detail-pop">{{ selectedBarangay.pop.toLocaleString() }} residents</div>
              <button class="btn-clear" @click="clearSelection">Clear selection</button>
            </div>
            <div v-else class="detail-hint" key="hint">
              <i class="fas fa-map-marker-alt hint-icon"></i>
              Click any marker on the map to view barangay details.
            </div>
          </Transition>

          <div class="rule"></div>

          <!-- Search -->
          <div class="search-wrap">
            <i class="fas fa-search search-icon"></i>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search barangay…"
              class="search-input"
            />
          </div>

          <!-- List -->
          <ul class="brgy-list">
            <li
              v-for="b in filteredBarangays"
              :key="b.id"
              :id="`brgy-${b.id}`"
              class="brgy-row"
              :class="{ active: selectedBarangay?.id === b.id }"
              @click="flyTo(b)"
            >
              <span class="row-name">{{ b.name }}</span>
              <span class="row-area">{{ b.area }}</span>
            </li>
            <li v-if="filteredBarangays.length === 0" class="row-empty">No results found.</li>
          </ul>

          <div class="rule"></div>

          <!-- Legend -->
          <div class="legend">
            <span class="leg"><span class="dot dot-lowland"></span>Lowland</span>
            <span class="leg"><span class="dot dot-coastal"></span>Coastal</span>
            <span class="leg"><span class="dot dot-upland"></span>Upland</span>
          </div>

        </aside>

        <!-- ── MAP ── -->
        <div class="map-col reveal-right">
          <div class="map-wrap">
            <div id="baco-map">
              <div v-if="isLoading" class="map-loader">
                <i class="fas fa-spinner fa-spin"></i>
              </div>
              <!-- Scroll guard overlay -->
              <div id="map-scroll-guard" class="map-scroll-guard">
                <i class="fas fa-hand-pointer"></i>
                <span>Click to interact with map</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@300;400;500;600&display=swap');

/* ── Leaflet popup overrides ── */
:global(.baco-popup .leaflet-popup-content-wrapper) {
  border-radius: 0 !important;
  border: 1px solid #e2e5f5 !important;
  border-top: 3px solid #0B198F !important;
  box-shadow: 0 4px 20px rgba(11,25,143,0.10) !important;
  padding: 0 !important;
}
:global(.baco-popup .leaflet-popup-content) {
  margin: 14px 16px !important;
}
:global(.baco-popup .leaflet-popup-tip-container) {
  display: none !important;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.page {
  font-family: 'Inter', sans-serif;
  background: #fff;
  color: #1a1a2e;
  min-height: 100vh;
}

/* ── HERO ── */
.hero {
  position: relative;
  height: 68svh;
  min-height: 380px;
  max-height: 520px;
  overflow: hidden;
  background: #07115E;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background: url('/images/hero-imgs.jpg') center 35% / cover no-repeat;
  filter: grayscale(25%) brightness(0.45);
  will-change: transform;
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(4, 10, 60, 0.88) 0%,
    rgba(7, 17, 94, 0.80) 50%,
    rgba(11, 25, 143, 0.75) 100%
  );
}

.hero-inner {
  position: relative;
  z-index: 2;
  max-width: 680px;
  margin: 0 auto;
  padding: 0 48px;
  text-align: center;
}

.hero-eyebrow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 18px;
}
.hero-eyebrow-line {
  display: inline-block;
  width: 28px;
  height: 2px;
  background: #CE1126;
  flex-shrink: 0;
}
.hero-eyebrow-text {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.75);
}

.hero-title {
  font-family: 'Playfair Display', serif;
  font-size: 3rem;
  font-weight: 700;
  color: #fff;
  line-height: 1.05;
  margin-bottom: 14px;
  letter-spacing: -0.01em;
}
.hero-dot {
  color: #CE1126;
}

.hero-sub {
  font-size: 1rem;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.82);
  line-height: 1.65;
}

/* ── BREADCRUMB ── */
.breadcrumb-bar {
  background: #fff;
  border-bottom: 1px solid #eaecf5;
  padding: 9px 48px;
}
.breadcrumb-inner {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.72rem;
}
.bc-link {
  color: #888;
  text-decoration: none;
  padding: 7px 0;
  display: inline-block;
  transition: color 0.15s;
}
.bc-link:hover { color: #0B198F; }
.bc-sep { color: #ccc; }
.bc-current { color: #0B198F; font-weight: 500; }

/* ── MAIN ── */
.main {
  max-width: 1400px;
  margin: 0 auto;
  padding: 44px 48px 80px;
}

/* Section head */
.section-head {
  margin-bottom: 24px;
}
.section-eyebrow {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #CE1126;
  margin-bottom: 6px;
}
.section-title {
  font-family: 'Playfair Display', serif;
  font-size: 1.9rem;
  font-weight: 700;
  color: #0B198F;
  line-height: 1.1;
}

/* Stats strip */
.stats-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 32px;
}
.stat-card {
  border: 1px solid #eaecf5;
  border-radius: 2px;
  padding: 16px 18px;
}
.stat-navy { border-top: 3px solid #0B198F; }
.stat-red  { border-top: 3px solid #CE1126; }

.stat-val {
  font-family: 'Playfair Display', serif;
  font-size: 1.7rem;
  line-height: 1.1;
  margin-bottom: 4px;
}
.stat-navy .stat-val { color: #0B198F; }
.stat-red  .stat-val { color: #CE1126; }

.stat-lbl {
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  color: #666;
  text-transform: uppercase;
}

/* ── TWO-COLUMN ── */
.body-grid {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 40px;
  align-items: start;
}

/* ── SIDEBAR ── */
.sidebar {
  position: sticky;
  top: 28px;
}

.rule {
  width: 100%;
  height: 1px;
  background: #eaecf5;
  margin: 18px 0;
}

/* Detail card */
.detail-card {
  border: 1px solid #eaecf5;
  border-top: 3px solid #0B198F;
  border-radius: 2px;
  padding: 18px;
  background: #fff;
}
.detail-eyebrow {
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #CE1126;
  margin-bottom: 5px;
}
.detail-name {
  font-family: 'Playfair Display', serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: #0B198F;
  line-height: 1.1;
  margin-bottom: 8px;
}
.detail-rule {
  width: 20px;
  height: 2px;
  background: #CE1126;
  margin-bottom: 10px;
}
.detail-pop {
  font-size: 0.85rem;
  color: #444;
  margin-bottom: 16px;
}
.btn-clear {
  font-family: 'Inter', sans-serif;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #0B198F;
  background: transparent;
  border: 1px solid #0B198F;
  padding: 13px 16px;
  border-radius: 2px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.btn-clear:hover {
  background: #0B198F;
  color: #fff;
}

/* Hint */
.detail-hint {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.78rem;
  color: #bbb;
  line-height: 1.7;
  min-height: 80px;
  border: 1px dashed #e0e3f0;
  border-radius: 2px;
  padding: 16px;
}
.hint-icon {
  color: #d0d4e8;
  font-size: 1rem;
  flex-shrink: 0;
}

/* Search */
.search-wrap {
  position: relative;
}
.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.65rem;
  color: #ccc;
  pointer-events: none;
}
.search-input {
  width: 100%;
  padding: 12px 10px 12px 28px;
  border: 1px solid #e0e3f0;
  border-radius: 2px;
  font-size: 0.78rem;
  font-family: 'Inter', sans-serif;
  color: #1a1a2e;
  background: #f8f9fd;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
}
.search-input::placeholder { color: #bbb; }
.search-input:focus {
  border-color: #0B198F;
  background: #fff;
}

/* List */
.brgy-list {
  list-style: none;
  margin-top: 10px;
  max-height: 280px;
  overflow-y: auto;
}
.brgy-list::-webkit-scrollbar { width: 3px; }
.brgy-list::-webkit-scrollbar-track { background: transparent; }
.brgy-list::-webkit-scrollbar-thumb { background: #e0e3f0; border-radius: 2px; }

.brgy-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 8px;
  border-bottom: 1px solid #f3f4fb;
  cursor: pointer;
  border-radius: 2px;
  transition: background 0.12s;
}
.brgy-row:last-child { border-bottom: none; }
.brgy-row:hover { background: #f3f5ff; }
.brgy-row.active { background: #edf0ff; }

.row-name {
  font-size: 0.88rem;
  color: #222;
  transition: color 0.12s;
}
.brgy-row:hover .row-name { color: #0B198F; }
.brgy-row.active .row-name {
  color: #0B198F;
  font-weight: 500;
}

.row-area {
  font-size: 0.68rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}
.row-empty {
  font-size: 0.85rem;
  color: #aaa;
  padding: 14px 8px;
}

/* Legend */
.legend {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.leg {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.76rem;
  color: #555;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.dot-lowland { background: #CE1126; }
.dot-coastal { background: #0B198F; }
.dot-upland  { background: #2d6e2d; }

/* ── MAP ── */
.map-col { width: 100%; }
.map-wrap {
  border: 1px solid #eaecf5;
  border-radius: 2px;
  overflow: hidden;
}
#baco-map {
  width: 100%;
  height: 300px;
  background: #f0f2f8;
  position: relative;
}
.map-loader {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  color: #c0c5e0;
  background: #f8f9fd;
}

/* Scroll guard overlay */
.map-scroll-guard {
  position: absolute;
  inset: 0;
  z-index: 999;
  background: rgba(7, 17, 94, 0.45);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: background 0.2s;
  pointer-events: none; /* let clicks pass through to the map */
}
.map-scroll-guard i {
  font-size: 1.3rem;
  color: rgba(255, 255, 255, 0.9);
}
.map-scroll-guard span {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.9);
}

/* ── SCROLL REVEAL ANIMATIONS ── */

/* Base hidden states */
.reveal-up,
.reveal-left,
.reveal-right,
.reveal-fade,
.stagger-item {
  opacity: 0;
  will-change: opacity, transform;
}
.reveal-up    { transform: translateY(32px); }
.reveal-left  { transform: translateX(-28px); }
.reveal-right { transform: translateX(28px); }
.reveal-fade  { transform: translateY(10px); }
.stagger-item { transform: translateY(24px); }

/* Visible state — fired by IntersectionObserver */
.reveal-up.is-visible,
.reveal-fade.is-visible {
  animation: scrub-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.reveal-left.is-visible {
  animation: scrub-left 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.reveal-right.is-visible {
  animation: scrub-right 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.stagger-item.is-visible {
  animation: scrub-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: calc(var(--stagger, 0) * 90ms + 60ms);
}

@keyframes scrub-up {
  to { opacity: 1; transform: translateY(0); }
}
@keyframes scrub-left {
  to { opacity: 1; transform: translateX(0); }
}
@keyframes scrub-right {
  to { opacity: 1; transform: translateX(0); }
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .reveal-up, .reveal-left, .reveal-right, .reveal-fade, .stagger-item {
    opacity: 1 !important;
    transform: none !important;
    animation: none !important;
  }
}

/* ── TRANSITIONS ── */
.fade-up-enter-active,
.fade-up-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

/* ── RESPONSIVE ── */
@media (max-width: 1024px) {
  .hero-inner   { padding: 0 24px; }
  .hero-title   { font-size: 2.4rem; }
  .breadcrumb-bar { padding: 9px 24px; }
  .main         { padding: 36px 24px 60px; }
  .body-grid    { grid-template-columns: 1fr; gap: 28px; }
  .sidebar      { position: static; }
  #baco-map     { height: 260px; }
}
@media (max-width: 600px) {
  .hero-inner   { padding: 0 20px; }
  .hero-title   { font-size: 2rem; }
  .breadcrumb-bar { padding: 9px 20px; }
  .main         { padding: 28px 20px 48px; }
  .stats-strip  { grid-template-columns: 1fr; gap: 10px; }
  #baco-map     { height: 220px; }
}
</style>