<script setup>
import { ref, watch, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const props = defineProps({
  isEditorMode: { type: Boolean, default: false }
})

const router = useRouter()

// ═══ AUTH ═══
const TOKEN_KEY = 'baco_user_token'
const isAuthenticated = ref(false)
const authChecked = ref(false)

const checkAuth = async () => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) { isAuthenticated.value = false; authChecked.value = true; return }
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) { isAuthenticated.value = true } else { localStorage.removeItem(TOKEN_KEY); isAuthenticated.value = false }
  } catch { isAuthenticated.value = !!token } finally { authChecked.value = true }
}

const onStorageAuth = () => checkAuth()

onMounted(() => {
  checkAuth()
  window.addEventListener('storage', onStorageAuth)
})
onBeforeUnmount(() => window.removeEventListener('storage', onStorageAuth))

const handleAuth = (role = 'traveler', intent = 'login') => {
  if (props.isEditorMode) return

  if (role === 'owner') {
    router.push({ name: intent === 'register' ? 'owner-register' : 'owner-login' })
    return
  }

  router.push('/auth')
}

// ═══ DESTINATIONS DATA ═══
const destinations = ref([])
const searchQuery = ref('')
const activeCategory = ref('All')
const categories = ['All', 'Beach', 'Mountain', 'River', 'Resort']

const filteredDestinations = computed(() => {
  let r = destinations.value
  if (activeCategory.value !== 'All') { const c = activeCategory.value.toLowerCase(); r = r.filter(d => d.name?.toLowerCase().includes(c) || d.description?.toLowerCase().includes(c)) }
  if (searchQuery.value) { const q = searchQuery.value.toLowerCase(); r = r.filter(d => d.name?.toLowerCase().includes(q) || d.location?.toLowerCase().includes(q)) }
  return r
})

const featuredDestinations = computed(() => destinations.value.slice(0, 8))

// Gathers main image + all activity images (falls back to [null] so callers stay safe)
const getImagesArray = (dest) => {
  if (!dest) return [null]
  const set = []
  if (dest.image) set.push(dest.image)
  ;(dest.activities || []).forEach(a => { if (a.image && !set.includes(a.image)) set.push(a.image) })
  return set.length ? set : [null]
}

// ═══ DESTINATION SHOWCASE CAROUSEL (Premium) ═══
const carouselIdx = ref(0)
const carouselTotal = computed(() => filteredDestinations.value.length)
const destProgressBarEl = ref(null)
const CAROUSEL_DURATION = 2000
const CAROUSEL_ANIMATION = 1400
let carouselTimer = null
let carouselRaf = null
let carouselProgressStart = 0
let carouselIsAnimating = false
let carouselTouchStartX = 0

const carouselPosition = (i) => {
  const total = carouselTotal.value
  if (!total) return ''
  let offset = i - carouselIdx.value
  if (offset > Math.floor(total / 2)) offset -= total
  if (offset < -Math.floor(total / 2)) offset += total
  if (offset === 0) return 'pos-featured'
  if (offset === -1) return 'pos-left-1'
  if (offset === -2) return 'pos-left-2'
  if (offset === 1) return 'pos-right-1'
  if (offset === 2) return 'pos-right-2'
  return ''
}

const carouselGoTo = (index) => {
  const total = carouselTotal.value
  if (!total || carouselIsAnimating) return
  carouselIsAnimating = true
  carouselIdx.value = (index + total) % total
  resetCarouselAuto()
  setTimeout(() => { carouselIsAnimating = false }, CAROUSEL_ANIMATION)
}

const carouselNext = () => carouselGoTo(carouselIdx.value + 1)
const carouselPrev = () => carouselGoTo(carouselIdx.value - 1)

const carouselUpdateProgress = () => {
  if (prefersReducedMotion || carouselTotal.value <= 1) { if (destProgressBarEl.value) destProgressBarEl.value.style.width = '0%'; return }
  const elapsed = Date.now() - carouselProgressStart
  const pct = Math.min((elapsed / CAROUSEL_DURATION) * 100, 100)
  if (destProgressBarEl.value) destProgressBarEl.value.style.width = pct + '%'
  if (pct >= 100) {
    carouselGoTo(carouselIdx.value + 1)
    return
  }
  carouselRaf = requestAnimationFrame(carouselUpdateProgress)
}

const resetCarouselAuto = () => {
  clearInterval(carouselTimer)
  cancelAnimationFrame(carouselRaf)
  carouselProgressStart = Date.now()
  carouselUpdateProgress()
}

const carouselTouchStart = (e) => { carouselTouchStartX = e.touches[0].clientX }
const carouselTouchEnd = (e) => {
  const diff = carouselTouchStartX - e.changedTouches[0].clientX
  if (Math.abs(diff) > 50) diff > 0 ? carouselNext() : carouselPrev()
}

watch(carouselTotal, (n) => { if (carouselIdx.value >= n) carouselIdx.value = 0; resetCarouselAuto() })

// ═══ GOOGLE MAPS (JS API — uses VITE_GOOGLE_MAPS_KEY from your frontend .env) ═══
// Richer/accurate PH map data & POIs. Enable "Maps JavaScript API" in Google Cloud Console.
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY || ''

// Shared across every component/mount — Google must only be injected once per page
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

// Escape user content before injecting it into InfoWindow HTML
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

// ── Main "Find Your Way" map ──
const mapInstance = ref(null)
const gmapMarkers = {}       // destination id → google.maps.Marker
const gmapInfoWindows = {}   // destination id → google.maps.InfoWindow
let mapDidInitialFit = false
const pinnedDestinations = computed(() => destinations.value.filter(d => d.lat != null && d.lat !== '' && d.lng != null && d.lng !== ''))
const unpinnedCount = computed(() => destinations.value.length - pinnedDestinations.value.length)

watch(filteredDestinations, () => { if (mapInstance.value) updateMapMarkers() })

const fetchDestinations = async () => {
  try { const res = await fetch(`${import.meta.env.VITE_API_BASE}/destinations`); if (res.ok) destinations.value = await res.json() } catch {}
  // after the v-for has rendered, so the <img>s the parallax targets exist
  nextTick(() => { initDestParallaxOnce(); initMap() })
}

const initMap = async () => {
  if (mapInstance.value) { updateMapMarkers(); return }
  const el = document.getElementById('minimap')
  if (!el) return
  let maps
  try { maps = await loadGoogleMaps() } catch (e) { console.warn(e.message); return }

  mapInstance.value = new maps.Map(el, {
    center: { lat: 13.35, lng: 121.10 },
    zoom: 11,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    gestureHandling: 'cooperative', // ctrl/⌘ + scroll to zoom — the page keeps scrolling naturally
  })
  mapDidInitialFit = false
  updateMapMarkers()
}

const updateMapMarkers = () => {
  const maps = window.google && window.google.maps
  if (!maps || !mapInstance.value) return
  Object.values(gmapMarkers).forEach(m => m.setMap(null))
  Object.keys(gmapMarkers).forEach(k => { delete gmapMarkers[k]; delete gmapInfoWindows[k] })

  const bounds = new maps.LatLngBounds()
  filteredDestinations.value.forEach(d => {
    if (d.lat == null || d.lat === '' || d.lng == null || d.lng === '') return
    const lat = Number(d.lat), lng = Number(d.lng)
    if (isNaN(lat) || isNaN(lng)) return

    const marker = new maps.Marker({ position: { lat, lng }, map: mapInstance.value, title: d.name })

    // InfoWindow content is a real DOM node → listeners can call Vue methods directly
    const content = document.createElement('div')
    content.style.cssText = 'font-family:system-ui,sans-serif;min-width:170px'
    content.innerHTML = `
      <strong style="display:block;font-size:13px;color:#1A3310;margin-bottom:2px">${escapeHtml(d.name)}</strong>
      <span style="display:block;font-size:11px;color:#5A5A5A;margin-bottom:8px">${escapeHtml(d.location || 'Baco, Oriental Mindoro')}</span>
      <div style="display:flex;gap:6px">
        <button type="button" data-act="details" style="flex:1;border:none;background:#1A3310;color:#fff;font-family:inherit;font-weight:700;font-size:11px;padding:7px 10px;border-radius:100px;cursor:pointer">Details</button>
        <a href="https://www.google.com/maps/dir/?api=1&destination=${gmapsCoord(lat, lng)}" target="_blank" rel="noopener" style="flex:1;text-align:center;text-decoration:none;background:#F2B705;color:#fff;font-family:inherit;font-weight:700;font-size:11px;padding:7px 10px;border-radius:100px">Directions</a>
              </div>`
    content.querySelector('[data-act="details"]').addEventListener('click', () => openStoryModal(d))

    const iw = new maps.InfoWindow({ content, maxWidth: 250 })
    marker.addListener('click', () => iw.open({ anchor: marker, map: mapInstance.value }))

    gmapMarkers[d.id] = marker
    gmapInfoWindows[d.id] = iw
    bounds.extend({ lat, lng })
  })

  // Fit the camera once (first render) so typing in search never makes the map jump
  const count = Object.keys(gmapMarkers).length
  if (count && !mapDidInitialFit) {
    mapDidInitialFit = true
    if (count === 1) { mapInstance.value.setCenter(bounds.getCenter()); mapInstance.value.setZoom(14) }
    else mapInstance.value.fitBounds(bounds, 40)
  }
}

const flyToMarker = (id) => {
  const m = gmapMarkers[id]
  if (!m || !mapInstance.value) return
  mapInstance.value.panTo(m.getPosition())
  mapInstance.value.setZoom(15)
  gmapInfoWindows[id]?.open({ anchor: m, map: mapInstance.value })
}

// ═══ BACO TOURIST ARRIVALS — LIVE DATA ONLY (published by the Tourism Office) ═══
// Everything renders from GET /tourism/arrivals (saved via the admin panel).
// There is NO fallback demo data anymore: while nothing is published the whole
// block stays hidden (v-if="arrivalsData" in the template).
const arrivalsData = ref(null)
const formatNum = (n) => Number(n || 0).toLocaleString('en-US')

const QUARTER_MONTHS = { 1: 'Jan – Mar', 2: 'Apr – Jun', 3: 'Jul – Sep', 4: 'Oct – Dec' }

const heroTotal = computed(() => Number(arrivalsData.value?.summary?.totalArrivals) || 0)
const heroPeriodText = computed(() => {
  const s = arrivalsData.value?.summary
  if (!s) return ''
  return `As of Q${s.quarter} ${s.year} (${QUARTER_MONTHS[s.quarter] || ''})`
})
const top5PeriodText = computed(() => {
  const s = arrivalsData.value?.summary
  if (!s) return ''
  return `Based on Number of Tourist Arrivals in Baco | Q${s.quarter} ${s.year}`
})
const topAttractions = computed(() => (arrivalsData.value?.attractions || []).slice(0, 5))
// Admin-uploaded section backgrounds — when null, the built-in default photos in CSS remain
const heroBgStyle = computed(() => {
  const url = arrivalsData.value?.backgrounds?.heroBg
  return url ? { backgroundImage: `url('${url}')` } : {}
})
const top5BgStyle = computed(() => {
  const url = arrivalsData.value?.backgrounds?.top5Bg
  return url ? { backgroundImage: `url('${url}')` } : {}
})

const fetchArrivalsPublic = async () => {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/tourism/arrivals`)
    if (res.ok) {
      const data = await res.json()
      if (data && data.hasData) arrivalsData.value = data
    }
  } catch { /* offline / nothing published yet → sections stay hidden */ }
}

const animateArrivalCounters = () => {
  const counters = [...document.querySelectorAll('.count-animate')]
    .map(el => ({ el, target: parseInt(el.getAttribute('data-target'), 10), shown: -1 }))
    .filter(c => Number.isFinite(c.target))
  if (!counters.length) return

  const duration = 1500
  const startTime = performance.now()

  // One rAF chain drives every counter. Each counter previously owned its own
  // loop, so N counters meant N text writes (and N layouts) per frame.
  const step = (currentTime) => {
    const progress = Math.min((currentTime - startTime) / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)

    for (const counter of counters) {
      const value = progress < 1 ? Math.floor(eased * counter.target) : counter.target
      if (value === counter.shown) continue
      counter.shown = value
      counter.el.textContent = value.toLocaleString()
    }

    if (progress < 1) requestAnimationFrame(step)
  }

  requestAnimationFrame(step)
}

let arrivalsObserver = null
let arrivalsScrollHandler = null
let countersAnimated = false

// Run the count-up exactly once, only after live data is present
const tryAnimateCounters = () => {
  if (countersAnimated) return
  countersAnimated = true
  animateArrivalCounters()
}

// Element refs are resolved once. Querying the DOM on every scroll event was
// the single biggest cost here.
let parallaxRefs = null
const collectParallaxRefs = () => {
  const heroSection = document.querySelector('.hero-section')
  const top5Section = document.querySelector('.top5-section')
  parallaxRefs = {
    heroBg: heroSection ? heroSection.querySelector('.hero-bg-image') : null,
    top5Bg: top5Section ? top5Section.querySelector('.top5-bg-image') : null,
  }
}

let parallaxRaf = 0
const applyArrivalsParallax = () => {
  if (parallaxRaf) return
  parallaxRaf = requestAnimationFrame(() => {
    parallaxRaf = 0
    if (!parallaxRefs) collectParallaxRefs()
    const { heroBg, top5Bg } = parallaxRefs
    if (!heroBg && !top5Bg) return
    const vh = window.innerHeight

    // Read every rect first, then write. Interleaving a read and a write forces
    // a synchronous layout for each pair, which is what made scrolling stutter.
    let heroOffset = null
    let top5Offset = null
    if (heroBg) {
      const rect = heroBg.parentElement.getBoundingClientRect()
      if (rect.bottom > 0 && rect.top < vh) heroOffset = Math.min(Math.max((vh - rect.top) * 0.12, 0), 90)
    }
    if (top5Bg) {
      const rect = top5Bg.parentElement.getBoundingClientRect()
      if (rect.bottom > 0 && rect.top < vh) top5Offset = Math.min((vh - rect.top) * 0.08, 100)
    }

    if (heroOffset !== null) heroBg.style.transform = `translateY(${heroOffset}px)`
    if (top5Offset !== null) top5Bg.style.transform = `translateY(${-top5Offset}px)`
  })
}

let storyHeroScrollHandler = null
let storyHeroRaf = 0
// Writes a custom property on the shared stage rather than transforming the
// .is-active cover, so every slide sits at the same offset and an autoplay or
// arrow slide change can't jump mid-crossfade. No scale() — the cover is already
// viewport-sized, and the hero scrolls up faster than the image moves down, so
// it stays fully covering at any scroll position without extra zoom.
const applyStoryHeroParallax = () => {
  if (prefersReducedMotion) return
  if (storyHeroRaf) return
  storyHeroRaf = requestAnimationFrame(() => {
    storyHeroRaf = 0
    const modal = document.querySelector('.story-modal')
    const stage = modal ? modal.querySelector('.car-hero__stage') : null
    if (modal && stage) stage.style.setProperty('--hero-shift', `${modal.scrollTop * 0.2}px`)
  })
}

// Once the hero scrolls away, its looping video and ~15 infinite CSS animations
// keep costing frames for the rest of the page. Pause them until it returns.
let heroIdleObserver = null
const initHeroIdle = () => {
  const hero = document.querySelector('.hero')
  if (!hero) return
  const video = hero.querySelector('video')
  heroIdleObserver = new IntersectionObserver(([entry]) => {
    const idle = !entry.isIntersecting
    hero.classList.toggle('hero--idle', idle)
    if (!video) return
    if (idle) video.pause()
    else if (video.autoplay) video.play().catch(() => {})
  }, { threshold: 0 })
  heroIdleObserver.observe(hero)
}

const attachArrivalsObserver = () => {
  if (arrivalsObserver) return
  const sectionWrapper = document.querySelector('.section-wrapper')
  if (!sectionWrapper) return // section hidden — nothing published yet
  arrivalsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        tryAnimateCounters()
        arrivalsObserver.unobserve(entry.target)
      }
    })
  }, { threshold: 0.15 })
  arrivalsObserver.observe(sectionWrapper)
}

const initArrivalsEffects = () => {
  // Scroll-driven parallax — attach once; safe even while the section is hidden
  if (!arrivalsScrollHandler) {
    arrivalsScrollHandler = applyArrivalsParallax
    window.addEventListener('scroll', arrivalsScrollHandler, { passive: true })
  }
  attachArrivalsObserver()
}

// Live data just landed → the section is rendering for the first time. Reset the
// cached parallax nodes (they didn't exist before) and attach the observer.
watch(arrivalsData, async (v) => {
  if (!v) return
  await nextTick()
  parallaxRefs = null
  attachArrivalsObserver()
})

const normalizeFb = (v) => {
  if (!v) return ''
  return v.startsWith('http') ? v : `https://www.facebook.com/${v}`
}

onMounted(() => { fetchDestinations() })


// ═══ REVEAL / SCROLL / REDUCED MOTION ═══
const prefersReducedMotion = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false

// One shared observer for every v-reveal target. Previously each element built
// its own IntersectionObserver and none of them were ever disconnected.
let revealObserver = null
const ensureRevealObserver = () => {
  if (revealObserver) return revealObserver
  revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-revealed')
      revealObserver.unobserve(entry.target)
    })
  }, { threshold: 0.1 })
  return revealObserver
}

const vReveal = {
  mounted(el) {
    if (prefersReducedMotion) { el.classList.add('is-revealed'); return }
    ensureRevealObserver().observe(el)
  },
  unmounted(el) { if (revealObserver) revealObserver.unobserve(el) },
}

const scrollToId = (id) => {
  nextTick(() => {
    const el = document.getElementById(id)
    if (!el) return
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: prefersReducedMotion ? 0 : 1.4 })
    else el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' })
  })
}

// ═══ LENIS SMOOTH SCROLL + PARALLAX (FIXED) ═══
let lenis = null
const stInstances = [] // Track ScrollTriggers created by this component
const lenisTicker = (time) => { if (lenis) lenis.raf(time * 1000) }
let destParallaxDone = false

// The destination <img>s only exist once the API response has rendered, so this
// is called from the fetch rather than from onMounted. Guarded so a second fetch
// (retry, filter change) cannot stack duplicate triggers on the same elements.
const initDestParallaxOnce = () => {
  if (destParallaxDone || prefersReducedMotion) return
  const imgs = document.querySelectorAll('.dest__bg img')
  if (!imgs.length) return
  destParallaxDone = true

  const st3 = gsap.fromTo(imgs, { yPercent: -6 }, {
    yPercent: 6, ease: 'none',
    scrollTrigger: { trigger: '.dest', start: 'top bottom', end: 'bottom top', scrub: true },
  })
  if (st3.scrollTrigger) stInstances.push(st3.scrollTrigger)

  // Destination slope parallax - drifts up over the hero seam so the two crests
  // overlap and hide the gap line
  const st4 = gsap.fromTo('.dest__skyline', { yPercent: 0 }, {
    yPercent: -40, ease: 'none',
    scrollTrigger: { trigger: '.dest', start: 'top bottom', end: 'bottom top', scrub: true },
  })
  if (st4.scrollTrigger) stInstances.push(st4.scrollTrigger)
}

const initSmoothScroll = () => {
  lenis = new Lenis({
    duration: prefersReducedMotion ? 0 : 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    autoRaf: false, // CRITICAL: Prevents double RAF loop conflict with GSAP ticker
  })

  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add(lenisTicker)
  // Let GSAP smooth over occasional dropped frames. lagSmoothing(0) played every
  // hitch back verbatim, which made normal main-thread work look like jank.
  gsap.ticker.lagSmoothing(500, 33)

  if (prefersReducedMotion) return

  // Hero background parallax
  const st1 = gsap.fromTo('.hero__bg', { yPercent: -18 }, {
    yPercent: 24, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  })
  stInstances.push(st1.scrollTrigger)

  // Hero mountains parallax — separate layer, drifts more than the bg
  const st1b = gsap.fromTo('.hero__mountains', { yPercent: 0 }, {
    yPercent: 28, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  })
  stInstances.push(st1b.scrollTrigger)

  const st2 = gsap.to('.hero__content', {
    yPercent: -30, opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: '40% top', scrub: true },
  })
  stInstances.push(st2.scrollTrigger)

    // Destination parallax is NOT set up here. The <img> elements it animates
    // live inside a v-for over the API response, so at mount time they do not
    // exist yet and GSAP would warn and then attach to nothing. It runs from
    // initDestParallax() once the data has landed.
    initDestParallaxOnce()

    // Safe refresh: handles cases where 'load' already fired before component mounted
    if (document.readyState === 'complete') {
      ScrollTrigger.refresh()
  } else {
    window.addEventListener('load', () => ScrollTrigger.refresh())
  }
}

// ═══ STORY MODAL ═══
const storyModalOpen = ref(false)
const showStoryDetails = ref(false)
const currentStoryDest = ref(null)
const storyWishlist = ref([])
let toastSeq = 0
const toasts = ref([])

const isInStoryWishlist = (id) => storyWishlist.value.includes(id)

const toggleStoryWishlist = (id) => {
  if (!id && id !== 0) return
  const idx = storyWishlist.value.indexOf(id)
  if (idx > -1) { storyWishlist.value.splice(idx, 1); showToast('Removed from wishlist', 'heart-crack') }
  else { storyWishlist.value.push(id); showToast('Added to wishlist!', 'heart') }
}

const showToast = (message, icon = 'check') => {
  const id = ++toastSeq
  toasts.value.push({ id, message, icon })
  setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id) }, 3100)
}

const shareStory = () => {
  const title = currentStoryDest.value?.name || 'Baco Tourism'
  if (navigator.share) { navigator.share({ title, url: window.location.href }) }
  else { navigator.clipboard.writeText(window.location.href).catch(() => {}); showToast('Link copied to clipboard', 'link') }
}

const generateStoryBody = (dest) => {
  if (!dest) return ''
  const acts = (dest.activities || []).map(a => a.name).filter(Boolean)
  const actsStr = acts.length > 0 ? acts.join(', ') : 'various outdoor activities'
  const location = dest.location || 'the municipality of Baco'
  const description = dest.description || 'A natural destination in Baco, Oriental Mindoro offering unique experiences for visitors.'

  return `<p><strong>${dest.name}</strong> ${description}</p>
  ${acts.length > 0 ? `<p>Visitors can enjoy ${actsStr} at this location. Each activity offers a different way to experience the natural beauty of Baco.</p>` : ''}
  <p>Located in ${location}, this destination showcases the diverse landscapes of Oriental Mindoro — from mountain foothills to coastal areas.</p>
  <p>Plan your visit and discover what makes this corner of Oriental Mindoro special.</p>`
}

const storyBody = computed(() => generateStoryBody(currentStoryDest.value))
const storyHeroImages = computed(() => getImagesArray(currentStoryDest.value))
const storyHeroCount = computed(() => storyHeroImages.value.length)
const storyHeroIdx = ref(0)
let storyHeroTimer = null
const clearStoryHeroTimer = () => { if (storyHeroTimer) { clearInterval(storyHeroTimer); storyHeroTimer = null } }
const restartStoryHeroTimer = () => {
  clearStoryHeroTimer()
  if (storyHeroCount.value < 2 || prefersReducedMotion) return
  storyHeroTimer = setInterval(() => { storyHeroIdx.value = (storyHeroIdx.value + 1) % storyHeroCount.value }, 6000)
}
const goStoryHero = (i) => {
  if (storyHeroCount.value < 2) return
  storyHeroIdx.value = (i + storyHeroCount.value) % storyHeroCount.value
  restartStoryHeroTimer()
}

// Swipe fallback for the hero now that the prev/next buttons are hidden on phones
let storyHeroTouchStartX = 0
const storyHeroTouchStart = (e) => { storyHeroTouchStartX = e.touches[0].clientX }
const storyHeroTouchEnd = (e) => {
  const diff = storyHeroTouchStartX - e.changedTouches[0].clientX
  if (Math.abs(diff) > 50) goStoryHero(storyHeroIdx.value + (diff > 0 ? 1 : -1))
}

// ═══ STORY MODAL GALLERY — BENTO GRID ═══
const storyGalleryImages = computed(() => {
  const d = currentStoryDest.value
  if (!d) return []
  const set = []
  const push = (u) => { if (u && !set.includes(u)) set.push(u) }
  push(d.image)
  ;(d.images || []).forEach(push)
  ;(d.activities || []).forEach(a => push(a.image))
  return set
})
const storyGalleryCount = computed(() => storyGalleryImages.value.length)
const smBentoOpen = (i) => {
  if (storyHeroCount.value > 1) goStoryHero(i)
}
// Per-destination arrivals — set via the admin destination form ("Total Tourist Arrivals").
// null → the arrivals UI in the story modal hides itself (v-if="storyTotal").
const storyTotal = computed(() => {
  const d = currentStoryDest.value
  if (!d) return null
  if (d.total_arrivals == null || d.total_arrivals === '') return null
  const n = Number(d.total_arrivals)
  if (!Number.isFinite(n)) return null
  return n.toLocaleString('en-US')
})
const storyTags = computed(() => {
  const d = currentStoryDest.value
  if (!d) return []
  const tags = ['Oriental Mindoro']
  ;(d.activities || []).slice(0, 2).forEach(a => { if (a.name) tags.push(a.name) })
  return tags
})

const storyReadTimeForDest = (d) => {
  if (!d) return ''
  const w = (d.description || '').split(/\s+/).length
  return `${Math.max(1, Math.ceil(w / 200))} min read`
}

const storyReadTime = computed(() => storyReadTimeForDest(currentStoryDest.value))
// Publish month/year of the destination record — fully dynamic, no input needed
const storyDate = computed(() => {
  const d = currentStoryDest.value
  if (!d?.created_at) return ''
  return new Date(d.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

const currentStoryIdx = computed(() => {
  const d = currentStoryDest.value
  if (!d) return -1
  return featuredDestinations.value.findIndex(x => x.id === d.id)
})

const relatedStoryDests = computed(() => {
  const d = currentStoryDest.value
  if (!d) return []
  return featuredDestinations.value.filter(x => x.id !== d.id).sort((a, b) => ((a.id * 7 + 3) % 5) - ((b.id * 7 + 3) % 5)).slice(0, 2)
})

// ═══ STORY MODAL — DESTINATION MAP + GOOGLE MAPS DIRECTIONS ═══
const hasStoryCoords = computed(() => {
  const d = currentStoryDest.value
  if (!d) return false
  return d.lat != null && d.lat !== '' && d.lng != null && d.lng !== '' && !isNaN(Number(d.lat)) && !isNaN(Number(d.lng))
})

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

const destDistanceKm = computed(() => {
  const d = currentStoryDest.value
  if (!d || !userLocation.value || !hasStoryCoords.value) return null
  const km = haversineKm(userLocation.value.lat, userLocation.value.lng, Number(d.lat), Number(d.lng))
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km).toLocaleString()} km`
})

const gmapsCoord = (lat, lng) => `${Number(lat)},${Number(lng)}`

const gmapsDirUrl = computed(() => {
  const d = currentStoryDest.value
  if (!hasStoryCoords.value) return '#'
  const origin = userLocation.value ? `&origin=${gmapsCoord(userLocation.value.lat, userLocation.value.lng)}` : ''
  return `https://www.google.com/maps/dir/?api=1&destination=${gmapsCoord(d.lat, d.lng)}${origin}&travelmode=driving`
})
// Fallback when a destination has no pinned coordinates yet — search Google Maps by name.
// Uses the saved barangay (not just "Baco") so the name guess lands as close as possible.
const gmapsSearchUrl = computed(() => {
  const d = currentStoryDest.value
  if (!d) return '#'
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.name}, ${d.location || 'Baco'}, Oriental Mindoro`)}`
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

// ── Mini Google map inside the story modal ──
let storyMap = null
let storyMarker = null
let storyMapDestId = null

const destroyStoryMap = () => {
  // Google Maps needs no explicit teardown — dropping the DOM node frees it.
  // Null the refs so a stale map is never reused for the next destination.
  storyMap = null
  storyMarker = null
  storyMapDestId = null
}

const initStoryMap = async () => {
  const d = currentStoryDest.value
  if (!d || !hasStoryCoords.value) return
  let maps
  try { maps = await loadGoogleMaps() } catch (e) { return }
  await nextTick()
  const el = document.getElementById('smMapCanvas')
  if (!el) return

  // Same destination already rendered → nothing to do (section was re-shown)
  if (storyMap && storyMapDestId === d.id) return

  destroyStoryMap()
  const center = { lat: Number(d.lat), lng: Number(d.lng) }
  storyMap = new maps.Map(el, {
    center, zoom: 14,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    gestureHandling: 'cooperative',
  })
  storyMarker = new maps.Marker({ position: center, map: storyMap, title: d.name })
  storyMapDestId = d.id
}

const openStoryModal = (dest) => {
  currentStoryDest.value = dest
  storyModalOpen.value = true
  showStoryDetails.value = false
  storyHeroIdx.value = 0
  destroyStoryMap()       // fresh map per destination
  locationError.value = ''
  document.body.style.overflow = 'hidden'
  lenis?.stop()
  restartStoryHeroTimer()
  nextTick(() => {
    const el = document.querySelector('.story-modal')
    if (el) el.scrollTop = 0
    const stage = document.querySelector('.car-hero__stage')
    if (stage) stage.style.setProperty('--hero-shift', '0px')
  })
}
const closeStoryModal = () => { storyModalOpen.value = false; clearStoryHeroTimer(); destroyStoryMap(); document.body.style.overflow = 'auto'; lenis?.start() }
const revealStoryDetails = () => {
  showStoryDetails.value = true
  nextTick(() => {
    const el = document.querySelector('.sm-details')
    if (el) el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' })
    initStoryMap()   // map lives inside "See more" details — init once it's visible
  })
}

const toggleStoryDetails = () => {
  if (showStoryDetails.value) {
    showStoryDetails.value = false
    const modal = document.querySelector('.story-modal')
    if (modal) modal.scrollTo({ top: 0, behavior: 'smooth' })
  } else {
    revealStoryDetails()
  }
}

const handleStoryModalScroll = () => {
  applyStoryHeroParallax()
}

// ═══ BOOK NOW CTA (story modal → resort booking) ═══
const handleBookNow = () => {
  if (props.isEditorMode) return
  const destName = currentStoryDest.value?.name || ''
  closeStoryModal()
  if (isAuthenticated.value) {
    router.push({ path: '/user/hotels', query: destName ? { q: destName } : {} })
  } else {
    router.push({ path: '/auth', query: { redirect: destName ? `/user/hotels?q=${encodeURIComponent(destName)}` : '/user/hotels' } })
  }
}

// ═══ HALCON AVAILABILITY (admin-controlled toggle) ═══
const halconEnabled = ref(false)

const loadHalconStatus = async () => {
  try {
    const r = await fetch(`${import.meta.env.VITE_API_BASE}/halcon/status`)
    if (r.ok) halconEnabled.value = !!(await r.json()).bookingEnabled
  } catch {}
}

const goHalconBooking = () => {
  if (props.isEditorMode) return
  if (isAuthenticated.value) {
    router.push('/user/permits/apply')
  } else {
    router.push({ path: '/auth', query: { redirect: '/user/permits/apply' } })
  }
}

// ═══ PORTAL FLIP STATE ═══
const isOwnerMode = ref(false)
const togglePortalMode = () => {
  isOwnerMode.value = !isOwnerMode.value
}

// ═══ MT. HALCON — GUIDE MODAL ═══
const halconModalOpen = ref(false)
const openHalconModal = () => { halconModalOpen.value = true; document.body.style.overflow = 'hidden'; lenis?.stop() }
const closeHalconModal = () => { halconModalOpen.value = false; document.body.style.overflow = 'auto'; lenis?.start() }

const halconFacts = [
  { label: 'Elevation', value: '2,582 MASL (est. — 2022 surveys indicate up to 2,616 m)' },
  { label: 'Local Name', value: 'Sialdang — "High Above the Clouds" (Mangyan-Alangan)' },
  { label: 'Rank', value: '23rd-highest peak in the Philippines' },
  { label: 'Trek Time', value: '15–18 hrs to summit · 3.5–4 days round trip' },
  { label: 'Climb Season', value: 'February 1 – May 31 (closed the rest of the year)' },
  { label: 'Jump-off', value: 'Brgy. Lantuyan (main) · Brgy. Bayanan (alternate)' },
  { label: 'Key Campsites', value: 'Aplaya (~1,100 MASL) · Dulangan River Camp · Summit Camp' },
  { label: 'Registration', value: 'Baco Municipal Tourism Office, Baco Municipal Hall' },
  { label: 'Biodiversity', value: 'Key Biodiversity Area — 509.34 km² (tamaraw, Mindoro imperial pigeon)' },
  { label: 'Most Stable Window', value: 'February – early March' },
]

const halconRequirements = [
  'Climbing permit from the Baco Municipal Tourism Office — around ₱350–375 per person, issued individually with your photo printed on the permit',
  'No walk-ins: confirmed reservation required — daily capacity is capped at ~100 hikers, so book 2–3 months in advance (earlier for Holy Week)',
  'Medical certificate explicitly stating "Fit to Climb"',
  'Basic Mountaineering Course (BMC) certificate or proof of a prior major climb (e.g., Pulag via Akiki Trail, Guiting-Guiting, Apo)',
  'Licensed local guide is mandatory — roughly ₱500–700/day, plus meals or a ₱150–200/day food allowance',
  'Valid ID photocopy per climber for permit processing',
]

const halconHazards = [
  { icon: 'fa-water', title: 'Dulangan River crossing', text: 'Swells to 2–3× its normal size after heavy rain and can strand teams for days. Unbuckle your hip belt and sternum strap before entering the water.' },
  { icon: 'fa-mountain', title: 'The Knife Edge (Azotea)', text: 'A rock spine barely a meter wide with drops on both sides — and it is not the true summit. The peak is about an hour further.' },
  { icon: 'fa-bug', title: 'Leeches (limatik)', text: 'Unavoidable from base to treeline. Leech socks, gaiters, and DEET help but will not fully prevent attachment.' },
  { icon: 'fa-temperature-low', title: 'Hypothermia', text: 'The leading cause of fatalities on tropical mountains. Ridge temperatures can drop to single digits °C with wind chill — keep one dry thermal set sealed in a dry bag.' },
]

const halconSources = [
  { name: 'Lakbay Pinas — Guide to Mt. Halcon, Baco', url: 'https://lakbaypinas.com/guide-to-mt-halcon-baco-oriental-mindoro-hike/' },
  { name: 'Island Hopping in the Philippines — Mt. Halcon', url: 'https://islandhoppinginthephilippines.com/luzon/mount-halcon/' },
]

// ═══ GLOBAL ESC — closes whichever modal is open ═══
const handleEsc = (e) => {
  if (e.key !== 'Escape') return
  if (halconModalOpen.value) { closeHalconModal(); return }
  if (storyModalOpen.value) closeStoryModal()
}

const handleCarouselKeys = (e) => {
  if (storyModalOpen.value || halconModalOpen.value) return
  if (e.key === 'ArrowRight') carouselNext()
  else if (e.key === 'ArrowLeft') carouselPrev()
}

// ═══ WEATHER WIDGET (floating, lower-left) ═══
const weather = ref(null)
const weatherLoading = ref(true)
const weatherOpen = ref(true)

const widgetPos = ref(null)
const weatherDragMoved = ref(false)
let weatherDrag = null

const widgetStyle = computed(() => widgetPos.value
  ? { left: widgetPos.value.x + 'px', top: widgetPos.value.y + 'px' }
  : {})

const weatherDragStart = (e) => {
  const el = e.currentTarget.closest('.weather-widget')
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (!widgetPos.value) widgetPos.value = { x: rect.left, y: rect.top }
  weatherDrag = {
    startX: widgetPos.value.x,
    startY: widgetPos.value.y,
    offsetX: e.clientX - widgetPos.value.x,
    offsetY: e.clientY - widgetPos.value.y,
    w: el.offsetWidth,
    h: el.offsetHeight,
  }
  e.currentTarget.setPointerCapture?.(e.pointerId)
}

const weatherDragMove = (e) => {
  if (!weatherDrag) return
  const nx = e.clientX - weatherDrag.offsetX
  const ny = e.clientY - weatherDrag.offsetY
  if (Math.abs(nx - weatherDrag.startX) > 3 || Math.abs(ny - weatherDrag.startY) > 3) weatherDragMoved.value = true
  const maxX = Math.max(8, window.innerWidth - weatherDrag.w - 8)
  const maxY = Math.max(8, window.innerHeight - weatherDrag.h - 8)
  widgetPos.value = {
    x: Math.min(Math.max(nx, 8), maxX),
    y: Math.min(Math.max(ny, 8), maxY),
  }
}

const weatherDragEnd = () => { weatherDrag = null }

const weatherToggle = () => {
  if (weatherDragMoved.value) { weatherDragMoved.value = false; return }
  weatherOpen.value = !weatherOpen.value
}

const weatherIconMap = {
  0: { label: 'Clear', icon: 'fa-sun' },
  1: { label: 'Mostly Clear', icon: 'fa-sun' },
  2: { label: 'Partly Cloudy', icon: 'fa-cloud-sun' },
  3: { label: 'Overcast', icon: 'fa-cloud' },
  45: { label: 'Foggy', icon: 'fa-smog' },
  48: { label: 'Foggy', icon: 'fa-smog' },
  51: { label: 'Light Drizzle', icon: 'fa-cloud-rain' },
  53: { label: 'Drizzle', icon: 'fa-cloud-rain' },
  55: { label: 'Heavy Drizzle', icon: 'fa-cloud-showers-heavy' },
  61: { label: 'Light Rain', icon: 'fa-cloud-rain' },
  63: { label: 'Rain', icon: 'fa-cloud-rain' },
  65: { label: 'Heavy Rain', icon: 'fa-cloud-showers-heavy' },
  71: { label: 'Light Snow', icon: 'fa-snowflake' },
  73: { label: 'Snow', icon: 'fa-snowflake' },
  75: { label: 'Heavy Snow', icon: 'fa-snowflake' },
  80: { label: 'Rain Showers', icon: 'fa-cloud-showers-heavy' },
  81: { label: 'Rain Showers', icon: 'fa-cloud-showers-heavy' },
  82: { label: 'Heavy Showers', icon: 'fa-cloud-showers-heavy' },
  95: { label: 'Thunderstorm', icon: 'fa-cloud-bolt' },
  96: { label: 'Storm + Hail', icon: 'fa-cloud-bolt' },
}

const weatherCurrent = computed(() => {
  const c = weather.value?.current
  if (!c) return null
  const info = weatherIconMap[c.weather_code] || { label: 'N/A', icon: 'fa-cloud' }
  return { ...c, label: info.label, icon: info.icon }
})

const fetchWeather = async () => {
  weatherLoading.value = true
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/weather`)
    if (res.ok) weather.value = await res.json()
  } catch {} finally { weatherLoading.value = false }
}

onMounted(() => {
  initSmoothScroll()
  resetCarouselAuto()
  window.addEventListener('keydown', handleEsc)
  window.addEventListener('keydown', handleCarouselKeys)
  loadHalconStatus()
  fetchArrivalsPublic()
  initArrivalsEffects()
  initHeroIdle()
  storyHeroScrollHandler = handleStoryModalScroll
  document.querySelector('.story-modal')?.addEventListener('scroll', storyHeroScrollHandler, { passive: true })
  if (!props.isEditorMode) fetchWeather()
})

onBeforeUnmount(() => {
  if (lenis) {
    gsap.ticker.remove(lenisTicker)
    // Safely kill only the ScrollTriggers created by this component
    stInstances.forEach(st => st.kill())
    lenis.destroy()
    lenis = null
  }
  clearInterval(carouselTimer)
  cancelAnimationFrame(carouselRaf)
  window.removeEventListener('keydown', handleEsc)
  window.removeEventListener('keydown', handleCarouselKeys)
  if (arrivalsObserver) arrivalsObserver.disconnect()
  if (arrivalsScrollHandler) window.removeEventListener('scroll', arrivalsScrollHandler)
  if (storyHeroScrollHandler) document.querySelector('.story-modal')?.removeEventListener('scroll', storyHeroScrollHandler)
  if (revealObserver) { revealObserver.disconnect(); revealObserver = null }
  if (heroIdleObserver) { heroIdleObserver.disconnect(); heroIdleObserver = null }
  cancelAnimationFrame(parallaxRaf)
  cancelAnimationFrame(storyHeroRaf)
  clearStoryHeroTimer()
  // Google Maps doesn't need explicit teardown — just drop our references
  mapInstance.value = null
  Object.keys(gmapMarkers).forEach(k => delete gmapMarkers[k])
  Object.keys(gmapInfoWindows).forEach(k => delete gmapInfoWindows[k])
  destroyStoryMap()
  if (halconModalOpen.value) document.body.style.overflow = 'auto'
})
</script>

<template>
  <div class="eco-page">

    <!-- ═══ HERO with Particle + Glow ═══ -->
    <header class="hero">
      <video
  class="hero__bg"
  autoplay
  muted
  loop
  playsinline
  preload="metadata"
  aria-hidden="true"
  disablepictureinpicture
  disableremoteplayback
  controlslist="nodownload nofullscreen noplaybackrate noremoteplayback"
  tabindex="-1"
>
  <source src="/videos/tourism-vid.mp4" type="video/mp4" />
</video>
      <div class="hero__overlay"></div>
      <div class="hero__grain"></div>

      <!-- Glow / Bloom Effects -->
      <div class="hero__glow hero__glow--1"></div>
      <div class="hero__glow hero__glow--2"></div>
      <div class="hero__glow hero__glow--3"></div>

      <!-- Particle Background -->
      <div class="hero__particles">
        <span></span><span></span><span></span><span></span><span></span>
        <span></span><span></span><span></span><span></span><span></span>
        <span></span><span></span>
      </div>

      <!-- Mountain Silhouette SVG - part of banner -->
      <div class="hero__mountains">
        <svg viewBox="0 0 1440 500" preserveAspectRatio="none" class="hero__mountain-svg">
          <path d="M0,500 L0,300 Q120,180 240,240 Q360,300 480,200 Q600,100 720,180 Q840,260 960,140 Q1080,20 1200,180 Q1320,340 1440,280 L1440,500 Z" fill="rgba(15,43,10,0.25)"/>
          <path d="M0,500 L0,360 Q180,260 360,320 Q540,380 720,280 Q900,180 1080,260 Q1260,340 1440,300 L1440,500 Z" fill="rgba(15,43,10,0.45)"/>
          <path d="M0,500 L0,420 Q200,360 400,400 Q600,440 800,380 Q1000,320 1200,380 Q1360,420 1440,400 L1440,500 Z" fill="var(--eco-forest)"/>
        </svg>
      </div>

      <div class="hero__content">
        <span class="hero__label">Oriental Mindoro &middot; Philippines</span>
        <h1 class="hero__heading">Discover Baco's<br><em>Wonders</em></h1>
        <div class="hero__search neu-raised">
          <i class="fa-solid fa-leaf"></i>
          <input type="text" v-model="searchQuery" placeholder="Search destinations..." @keyup.enter="scrollToId('destinations')" />
          <button @click="scrollToId('destinations')">Explore</button>
        </div>
      </div>
    </header>

    <main>
<!-- ═══ DESTINATIONS with Premium Carousel ═══ -->
      <section id="destinations" class="dest">
        <div class="dest__bg" aria-hidden="true">
          <img v-for="(d, i) in filteredDestinations" :key="'bg-' + d.id" :src="getImagesArray(d)[0]" :class="{ 'is-active': i === carouselIdx }" :alt="d.name" loading="lazy" />
        </div>
        <div class="dest__skyline" aria-hidden="true">
          <svg viewBox="0 0 1440 500" preserveAspectRatio="none" class="dest__skyline-svg">
            <path d="M0,0 L0,80 Q200,140 400,100 Q600,60 800,120 Q1000,180 1200,120 Q1360,80 1440,100 L1440,0 Z" fill="var(--eco-forest)"/>
          </svg>
        </div>
        <div class="dest__overlay"></div>

        <div class="dest__navdots" v-if="filteredDestinations.length > 1">
          <button v-for="(d, i) in filteredDestinations" :key="'dot-' + d.id" class="dest__navdot" :class="{ 'is-active': i === carouselIdx }" :data-tip="d.name" :aria-label="`View ${d.name}`" @click="carouselGoTo(i)"></button>
        </div>

        <div class="dest__stage" v-if="filteredDestinations.length > 0" @touchstart.passive="carouselTouchStart" @touchend.passive="carouselTouchEnd">
          <div class="dest__content">
            <div class="dest__trending">
              <span class="dest__trend-dot"></span>
              <span>Trending Destination</span>
            </div>
            <h1 class="dest__name">{{ filteredDestinations[carouselIdx].name }}</h1>
            <p class="dest__desc">{{ filteredDestinations[carouselIdx].description }}</p>
            <button class="dest__cta" @click="openStoryModal(filteredDestinations[carouselIdx])">
              <span>Explore Now</span>
              <span class="dest__cta-icon">→</span>
            </button>
          </div>

          <div class="dest__carousel" v-if="filteredDestinations.length > 0">
            <article v-for="(d, i) in filteredDestinations" :key="d.id"
                 class="dest__card" :class="carouselPosition(i)"
                 @click="openStoryModal(d)">
              <img :src="getImagesArray(d)[0]" :alt="d.name" loading="lazy" />
              <div class="dest__card-overlay"></div>
              <div class="dest__card-top">
                <span class="dest__card-loc">{{ d.location }}</span>
                <button class="dest__card-book" :class="{ 'is-saved': isInStoryWishlist(d.id) }" :aria-label="isInStoryWishlist(d.id) ? 'Remove from wishlist' : 'Add to wishlist'" @click.stop="toggleStoryWishlist(d.id)"><i class="fa-solid" :class="isInStoryWishlist(d.id) ? 'fa-heart' : 'fa-bookmark'"></i></button>
              </div>
              <div class="dest__card-bottom">
                <div class="dest__card-stars">
                  <span v-for="s in 5" :key="s" class="dest__star" :class="{ 'is-empty': s > (d.rating || 5) }">★</span>
                  <span class="dest__card-rating">{{ storyReadTimeForDest(d) || 'Guest favorite' }}</span>
                </div>
                <div class="dest__card-name">{{ d.name }}</div>
              </div>
            </article>
          </div>
        </div>

        <div class="dest__pagination" v-if="filteredDestinations.length > 1">
          <div class="dest__pagination-dots">
            <button v-for="(d, i) in filteredDestinations" :key="'pg-' + d.id" class="dest__pagination-dot" :class="{ 'is-active': i === carouselIdx }" :aria-label="`Go to ${d.name}`" @click="carouselGoTo(i)"></button>
          </div>
          <span class="dest__counter">{{ String(carouselIdx + 1).padStart(2, '0') }} / {{ String(filteredDestinations.length).padStart(2, '0') }}</span>
        </div>

        <div v-if="destinations.length === 0" class="state-empty">
          <i class="fa-solid fa-compass fa-spin"></i>
          <span>Loading destinations&hellip;</span>
        </div>

        <div v-else-if="filteredDestinations.length === 0" class="state-empty">
          <i class="fa-solid fa-magnifying-glass"></i>
          <span>No destinations match your search.</span>
        </div>
      </section>

      <!-- ═══ MAP — Google Maps (JS API) ═══ -->
      <section id="map-section" class="mapsec">
        <div class="mapsec__ambient-glow"></div>
        <div class="container">
          <div class="mapsec__head" v-reveal>
            <div>
              <span class="tag tag--sage">Interactive Map</span>
              <h2 class="heading heading--lg">Find Your Way</h2>
            </div>
            <p class="mapsec__hint"><i class="fa-solid fa-hand-pointer"></i> Click a pin for details &amp; directions</p>
          </div>
          <div class="mapsec__frame neu-inset" v-reveal>
            <div id="minimap" class="mapsec__canvas" data-lenis-prevent></div>
          </div>
          <div class="mapsec__pinned" v-if="pinnedDestinations.length" v-reveal>
            <span class="mapsec__pinned-label"><i class="fa-solid fa-location-dot"></i> Jump to:</span>
            <button v-for="d in pinnedDestinations" :key="'pin-' + d.id" class="mapsec__chip" @click="flyToMarker(d.id)">{{ d.name }}</button>
          </div>
          <p v-if="unpinnedCount > 0" class="mapsec__note" v-reveal><i class="fa-solid fa-circle-info"></i> {{ unpinnedCount }} destination{{ unpinnedCount > 1 ? 's are' : ' is' }} not pinned on the map yet.</p>
        </div>
      </section>

      <!-- ═══ BACO TOURIST ARRIVALS (live — only rendered when the Tourism Office has published data) ═══ -->
      <div class="section-wrapper" v-if="arrivalsData">

        <!-- HERO SECTION -->
        <div class="hero-section" v-if="arrivalsData.summary">
          <div class="hero-bg-image" :style="heroBgStyle" role="img" aria-label="Tourist arrivals in Baco, Oriental Mindoro"></div>
          <div class="hero-overlay"></div>

          <div class="hero-content">
            <div class="hero-number count-animate" id="heroCount" :data-target="heroTotal">{{ formatNum(heroTotal) }}</div>
            <div class="hero-subtitle">
              Total Tourist Arrivals in Baco
              <div class="date-line">{{ heroPeriodText }}</div>
            </div>
          </div>
        </div>

        <!-- TOP 5 SECTION -->
        <div class="top5-section" v-if="topAttractions.length">
          <div class="top5-bg-image" :style="top5BgStyle" role="img" aria-label="Top tourist attractions in Baco, Oriental Mindoro"></div>
          <div class="top5-overlay"></div>

          <div class="top5-content">
            <div class="top5-title">Top 5 Tourist<br>Attractions</div>
            <div class="top5-subtitle">{{ top5PeriodText }}</div>
            <div class="top5-source">Source: Baco Municipal Tourism Office</div>

            <div class="top5-list">
              <div v-for="(a, i) in topAttractions" :key="'att-' + i" class="top5-item" :class="'rank-' + (i + 1)">
                <div class="rank-number">{{ i + 1 }}</div>
                <div class="rank-name">{{ a.name }}<small v-if="a.sub">{{ a.sub }}</small></div>
                <div class="rank-count count-animate" :data-target="a.visitors">{{ formatNum(a.visitors) }}</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- ═══ MT. HALCON with Glow ═══ -->
      <section id="halcon" class="halcon">
        <div class="halcon__ambient-glow halcon__ambient-glow--1"></div>
        <div class="halcon__ambient-glow halcon__ambient-glow--2"></div>

        <div class="container">
          <div class="halcon__grid">
            <div class="halcon__visual" v-reveal>
              <!-- 2 MAIN IMAGES — stacked full width (stretch to match text column height on desktop) -->
              <div class="halcon__main-imgs">
                <div class="halcon__main-img">
                  <img src="https://lakbaypinas.com/wp-content/uploads/2024/05/36594221_1841206092604924_2712149204632862720_n-1.jpg" alt="Mt. Halcon trail" />
                  <div class="halcon__elev neu-raised-dark">
                    <span class="halcon__elev-num">2,582</span>
                    <span class="halcon__elev-unit">MASL</span>
                  </div>
                </div>
                <div class="halcon__main-img">
                  <img src="https://timogkatagalugan.com/wp-content/uploads/2023/04/photo_2023-04-04_14-55-30-1.jpg" alt="Sea of clouds over the Halcon range" />
                </div>
              </div>
              <!-- 3-IMAGE GALLERY (original) -->
              <div class="halcon__gallery">
                <img src="https://ineedtoreminisce.wordpress.com/wp-content/uploads/2014/08/img_62041.jpg" alt="Ridgeline" />
                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR1_goYsfaEXJMCHrJ2UgrAnRuJYUL_lxuimxSnAlJhLV_9qNjuLYi9nYI&s=10" alt="Forest canopy" />
                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQtSsm8aGAN-VN6WmKOAyu5GsMoTGyrNTa-MtBd_wooI8yrWe-92IJBcMng&s=10" alt="Summit view" />
              </div>
            </div>
            <div class="halcon__info" v-reveal>
              <span class="tag" :class="halconEnabled ? 'tag--green' : 'tag--amber'">
                <i class="fa-solid" :class="halconEnabled ? 'fa-circle-check' : 'fa-hourglass-half'"></i>
                {{ halconEnabled ? 'Available' : 'Not Yet Available' }}
              </span>
              <h2 class="heading heading--xl">Mt. Halcon</h2>
              <p class="halcon__desc">The highest peak in Oriental Mindoro and one of the most technically demanding climbs in the Philippines — a route of deep river crossings, vertical scrambling, mossy forest, and cold summit ridges on the way to a windswept peak.</p>
              <div class="halcon__stats">
                <div class="halcon__stat neu-dark-raised">
                  <span>2,582m</span>
                  <small>Elevation</small>
                </div>
                <div class="halcon__stat neu-dark-raised">
                  <span>3.5&ndash;4</span>
                  <small>Days</small>
                </div>
                <div class="halcon__stat neu-dark-raised">
                  <span>9/9</span>
                  <small>Difficulty</small>
                </div>
                <div class="halcon__stat neu-dark-raised">
                  <span>~100</span>
                  <small>Daily cap</small>
                </div>
              </div>
              <div class="halcon__trail neu-dark-inset">
                <h3>Trail Information</h3>
                <ul>
                  <li><span>Difficulty</span><b>9/9 &middot; Major Climb</b></li>
                  <li><span>Trail Class</span><b>2&ndash;4</b></li>
                  <li><span>Duration</span><b>3.5&ndash;4 days</b></li>
                  <li><span>Summit Push</span><b>15&ndash;18 hrs</b></li>
                  <li><span>Best Season</span><b>Feb 1 &ndash; May 31</b></li>
                  <li><span>Permit</span><b>Required</b></li>
                  <li><span>Guide</span><b>Mandatory &middot; Licensed</b></li>
                  <li><span>Experience</span><b>BMC or prior major climb</b></li>
                </ul>
                <p class="halcon__note"><i class="fa-solid fa-circle-info"></i> No walk-ins — reserve 2&ndash;3 months ahead. Permits are issued individually at the Baco Municipal Tourism Office, and daily capacity is capped at ~100 hikers.</p>
              </div>

              <div class="halcon__cta-row">
                <button class="halcon__more-toggle" @click="openHalconModal" aria-haspopup="dialog">
                  <i class="fa-solid fa-book-open"></i>
                  Read the full Mt. Halcon guide
                </button>
                <button v-if="halconEnabled" class="halcon__book-btn" @click="goHalconBooking">
                  <i class="fa-solid fa-ticket"></i>
                  Book Your Climb
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ ECO-FESTIVE FLIPPING PORTAL ═══ -->
      <section id="portal" class="portal-festive" v-reveal>
        <!-- Festive Eco Background Decorations -->
        <div class="portal-festive__deco portal-festive__deco--leaf-1"></div>
        <div class="portal-festive__deco portal-festive__deco--leaf-2"></div>
        <div class="portal-festive__deco portal-festive__deco--sun"></div>

        <div class="container">
          <div class="portal-festive__header">
            <span class="tag tag--amber">Welcome to Baco</span>
            <h5 class="heading heading--lg">Resorts/Accommodations</h5>
          </div>

          <div class="flip-container">
            <div class="flipper" :class="{ 'is-flipped': isOwnerMode }">

              <!-- FRONT: Traveler -->
              <div class="flip-face flip-face--front neu-card-large">
                <div class="portal-content">
                  <img class="portal-content__logo" src="/images/TARA-SEAL.png" alt="Baco Tourism" />
                  <h3>Traveler Portal</h3>
                  <p>Book resort entrances and accommodations across Baco, save your favorite destinations, and manage your bookings — all in one place.</p>
                  <div class="portal-feats">
                    <span class="neu-flat"><i class="fa-solid fa-ticket"></i> Entrance fees</span>
                    <span class="neu-flat"><i class="fa-solid fa-bed"></i> Accommodations</span>
                    <span class="neu-flat"><i class="fa-solid fa-calendar-check"></i> Manage bookings</span>
                    <span class="neu-flat" :class="{ 'portal-feats--soon': !halconEnabled }"><i class="fa-solid fa-mountain"></i> Climb permits <em v-if="!halconEnabled">soon</em></span>
                  </div>

                  <div class="portal-actions">
                    <div v-if="!authChecked" class="portal__loading"><i class="fa-solid fa-spinner fa-spin"></i></div>
                    <template v-else>
                      <button v-if="!isAuthenticated" class="btn btn--amber neu-btn-raised" @click="handleAuth('traveler')">
                        <i class="fa-solid fa-right-to-bracket"></i> Sign in / Register
                      </button>
                      <div v-else class="portal__welcome">
                        <button class="btn btn--amber neu-btn-raised" @click="router.push('/user/dashboard')">
                          <i class="fa-solid fa-gauge-high"></i> Go to My Account
                        </button>
                      </div>
                    </template>
                  </div>

                  <button class="flip-trigger" @click="togglePortalMode">
                    <span>Are you a Resort Owner?</span>
                  </button>
                </div>
              </div>

              <!-- BACK: Resort Owner -->
              <div class="flip-face flip-face--back neu-card-large">
                <div class="portal-content">
                  <img class="portal-content__logo" src="/images/TARA-SEAL.png" alt="Baco Tourism" />
                  <h3>Resort Owner Portal</h3>
                  <p>Create owner account, manage bookings, and grow your sustainable tourism business with Baco's official platform.</p>
                  <div class="portal-feats">
                    <span class="neu-flat"><i class="fa-solid fa-store"></i> List property</span>
                    <span class="neu-flat"><i class="fa-solid fa-calendar-check"></i> Manage bookings</span>
                    <span class="neu-flat"><i class="fa-solid fa-chart-line"></i> Analytics</span>
                    <span class="neu-flat"><i class="fa-solid fa-ticket"></i> Entrance fees</span>
                  </div>

                  <div class="portal-actions">
                    <button class="btn btn--sage neu-btn-raised" @click="handleAuth('owner', 'login')">
                      <i class="fa-solid fa-registered"></i> Create an Account
                    </button>
                  </div>

                  <button class="flip-trigger" @click="togglePortalMode">
                    <i class="fa-solid fa-arrow-left-arrow-right"></i>
                    <span>Back to Traveler View</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

    </main>

    <!-- ═══ STORY MODAL ═══ -->

    <!-- Widget — compact floating action pill, sibling of .story-modal (not a descendant)
         so position:fixed pins to the viewport instead of the modal's transformed scroll box. -->
    <nav class="sm-widget" :class="{ 'sm-widget--open': storyModalOpen }" v-if="currentStoryDest" aria-label="Destination actions">
      <div class="sm-widget__actions">
        <button class="sm-widget__btn" @click="shareStory" aria-label="Share this destination" title="Share"><i class="fa-solid fa-share-nodes"></i></button>
        <button class="sm-widget__btn" @click="toggleStoryWishlist(currentStoryDest.id)" :class="{ 'sm-heart--on': isInStoryWishlist(currentStoryDest.id) }" :aria-label="isInStoryWishlist(currentStoryDest.id) ? 'Remove from wishlist' : 'Add to wishlist'" title="Save"><i class="fa-solid fa-heart"></i></button>
        <button class="sm-widget__btn sm-widget__btn--close" @click="closeStoryModal" aria-label="Close" title="Close"><i class="fa-solid fa-xmark"></i></button>
      </div>
    </nav>

    <div class="story-modal" :class="{ 'story-modal--open': storyModalOpen }" data-lenis-prevent>
      <div class="story-modal__inner" v-if="currentStoryDest">
        <article class="sm-article">

          <!-- HERO -->
          <div class="car-hero" @touchstart.passive="storyHeroTouchStart" @touchend.passive="storyHeroTouchEnd">
            <div class="car-hero__stage">
              <div v-for="(img, i) in storyHeroImages" :key="i" class="car-hero__slide" :class="{ 'is-active': i === storyHeroIdx }">
                <div class="car-hero__cover" :style="{ backgroundImage: `url('${img}')` }"></div>
              </div>
            </div>
            <div class="car-hero__overlay"></div>

            <div class="car-hero__main">
              <div class="car-hero__content">
                <div class="sm-meta">
                  <span v-for="tag in storyTags" :key="tag" class="sm-tag">{{ tag }}</span>
                  <span>{{ storyReadTime }}</span>
                  <template v-if="storyDate"><span>&middot;</span><span>{{ storyDate }}</span></template>
                </div>
                <h1 class="sm-title">{{ currentStoryDest.name }}<small>{{ currentStoryDest.location }}</small></h1>

                <div class="sm-hero-stats">
                  <div class="sm-hero-stat">
                    <span class="sm-hero-stars">
                      <span v-for="s in 5" :key="s" class="is-empty" :class="{ 'is-on': s <= (currentStoryDest.rating || 5) }">★</span>
                    </span>
                    <span class="sm-hero-stat__val">{{ currentStoryDest.rating || '5.0' }}</span>
                    <span class="sm-hero-stat__lbl">Rating</span>
                  </div>
                  <div class="sm-hero-stat" v-if="storyTotal">
                    <span class="sm-hero-stat__val">{{ storyTotal }}</span>
                    <span class="sm-hero-stat__lbl">Arrivals</span>
                  </div>
                  <div class="sm-hero-stat">
                    <span class="sm-hero-stat__val">{{ storyGalleryCount }}</span>
                    <span class="sm-hero-stat__lbl">Photos</span>
                  </div>
                </div>

                <button class="sm-see-more" @click="toggleStoryDetails">
                  {{ showStoryDetails ? 'See less details' : 'See more details' }}
                  <span class="arrow"><i class="fa-solid" :class="showStoryDetails ? 'fa-chevron-up' : 'fa-arrow-right'"></i></span>
                </button>
              </div>
            </div>

            <div v-if="storyHeroCount > 1" class="car-hero__dots">
              <button v-for="(img, i) in storyHeroImages" :key="i" class="car-hero__dot" :class="{ 'is-active': i === storyHeroIdx }" :aria-label="`Go to photo ${i + 1}`" @click="goStoryHero(i)"></button>
            </div>
            <div v-if="storyHeroCount > 1" class="car-hero__count" aria-hidden="true">
              <span>{{ String(storyHeroIdx + 1).padStart(2, '0') }}</span> / {{ String(storyHeroCount).padStart(2, '0') }}
            </div>
          </div>

          <!-- DETAILS -->
          <div class="sm-details" v-show="showStoryDetails">
            <div class="sm-split">
              <div class="sm-split__main">
                <section class="sm-section" id="smAbout">
                  <header class="sm-section__head">
                    <h2 class="sm-section__title">About {{ currentStoryDest.name }}</h2>
                  </header>
                  <div class="sm-body" v-html="storyBody"></div>

                  <div class="sm-stats">
                    <div class="sm-stat" v-if="storyTotal">
                      <span class="sm-stat__num">{{ storyTotal }}</span>
                      <span class="sm-stat__lbl">Tourist arrivals</span>
                    </div>
                    <div class="sm-stat">
                      <span class="sm-stat__num">{{ currentStoryDest.activities?.length || 0 }}</span>
                      <span class="sm-stat__lbl">Activities</span>
                    </div>
                    <div class="sm-stat">
                      <span class="sm-stat__num">{{ storyGalleryCount }}</span>
                      <span class="sm-stat__lbl">Captured</span>
                    </div>
                    <div class="sm-stat">
                      <span class="sm-stat__num">{{ currentStoryDest.rating || '5.0' }}</span>
                      <span class="sm-stat__lbl">Visitor rating</span>
                    </div>
                  </div>
                </section>

                <section class="sm-section" id="smThings" v-if="currentStoryDest.activities && currentStoryDest.activities.length">
                  <header class="sm-section__head">
                    <h2 class="sm-section__title">Things to do</h2>
                  </header>
                  <div class="sm-things">
                    <div v-for="(a, i) in currentStoryDest.activities" :key="'act-' + i" class="sm-things__item">
                      <span class="sm-things__num">{{ String(i + 1).padStart(2, '0') }}</span>
                      <div class="sm-things__thumb" v-if="a.image"><img :src="a.image" :alt="a.name" loading="lazy" /></div>
                      <div class="sm-things__icon" v-else><i class="fa-solid fa-leaf"></i></div>
                      <h3 class="sm-things__name">{{ a.name }}</h3>
                    </div>
                  </div>
                </section>

                <section class="sm-section" id="smContact" v-if="currentStoryDest.contact || currentStoryDest.fb_page">
                  <header class="sm-section__head">
                    <h2 class="sm-section__title">Contact &amp; Visits</h2>
                  </header>
                  <div class="sm-contact">
                    <a v-if="currentStoryDest.contact" class="sm-chip" :href="`tel:${currentStoryDest.contact}`"><i class="fa-solid fa-phone"></i> {{ currentStoryDest.contact }}</a>
                    <a v-if="currentStoryDest.fb_page" class="sm-chip sm-chip--fb" :href="normalizeFb(currentStoryDest.fb_page)" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-facebook-f"></i> Visit Facebook Page</a>
                  </div>
                </section>

                <!-- ═══ MAP & DIRECTIONS (Google Maps handoff) — lives in the right column ═══ -->

                <section class="sm-section sm-section--gallery" id="smGallery" v-if="storyGalleryCount > 0">
                  <header class="sm-section__head">
                    <h2 class="sm-section__title">Gallery</h2>
                  </header>
                  <div class="sm-bento">
                    <div v-for="(img, g) in storyGalleryImages" :key="'bento-' + g" class="sm-bento__item" @click="smBentoOpen(g)">
                      <img :src="img" :alt="`${currentStoryDest.name} photo ${g + 1}`" loading="lazy" />
                      <div class="sm-bento__tile">
                        <span class="sm-bento__tile-num">{{ String(g + 1).padStart(2, '0') }}</span>
                        <span class="sm-bento__tile-caption">{{ currentStoryDest.location }}</span>
                      </div>
                    </div>
                  </div>
                </section>

                <section class="sm-section sm-section--related" id="smRelated" v-if="relatedStoryDests.length">
                  <header class="sm-section__head">
                    <h2 class="sm-section__title">You may also like</h2>
                  </header>
                  <div class="sm-ranklist">
                    <button v-for="(rel, ri) in relatedStoryDests" :key="rel.id" class="sm-rank" @click="openStoryModal(rel)">
                      <span class="sm-rank__no">{{ ri + 1 }}</span>
                      <span class="sm-rank__thumb"><img :src="getImagesArray(rel)[0]" :alt="rel.name" loading="lazy" /></span>
                      <span class="sm-rank__name">{{ rel.name }}<small>{{ rel.location }}</small></span>
                      <span class="sm-rank__meta">{{ storyReadTimeForDest(rel) }}</span>
                      <i class="fa-solid fa-arrow-right sm-rank__arrow"></i>
                    </button>
                  </div>
                </section>
              </div>

              <div class="sm-split__aside">
                <aside class="sm-aside">
                  <div class="dest-total" v-if="storyTotal">
                    <div class="dest-total__inner">
                      <span class="dest-total__kicker"><i class="fa-solid fa-chart-simple"></i> Tourist Arrivals</span>
                      <span class="dest-total__num">{{ storyTotal }}</span>
                      <span class="dest-total__label">Total visitors recorded at {{ currentStoryDest.name }}</span>
                      <span class="dest-total__src">Source: Baco Municipal Tourism Office</span>
                    </div>
                  </div>

                  <section class="sm-section sm-section--map" id="smMap">
                    <header class="sm-section__head">
                      <h2 class="sm-section__title">Find it on the map</h2>
                    </header>

                    <div v-if="hasStoryCoords" class="sm-map-card neu-card">
                      <div id="smMapCanvas" class="sm-map-canvas" data-lenis-prevent></div>
                      <div class="sm-map-info">
                        <span class="sm-map-coord">
                          <i class="fa-solid fa-location-crosshairs"></i>
                          {{ currentStoryDest.lat }}, {{ currentStoryDest.lng }}
                        </span>

                        <div class="sm-map-actions">
                          <button class="sm-map-btn sm-map-btn--ghost" @click="findMe" :disabled="locating">
                            <i class="fa-solid" :class="locating ? 'fa-spinner fa-spin' : 'fa-street-view'"></i>
                            {{ locating ? 'Locating…' : (userLocation ? 'Refresh my location' : 'How far am I?') }}
                          </button>
                          <a class="sm-map-btn sm-map-btn--google" :href="gmapsDirUrl" target="_blank" rel="noopener noreferrer">
                            <i class="fa-solid fa-diamond-turn-right"></i> Get Directions
                          </a>
                        </div>

                        <div v-if="destDistanceKm" class="sm-map-distance">
                          <i class="fa-solid fa-route"></i>
                          <span>You are about <strong>{{ destDistanceKm }}</strong> from {{ currentStoryDest.name }}.</span>
                          <small>Straight-line distance — tap "Get Directions" for the actual driving route in Google Maps.</small>
                        </div>
                        <p v-else-if="locationError" class="sm-map-error"><i class="fa-solid fa-triangle-exclamation"></i> {{ locationError }}</p>
                      </div>
                    </div>

                    <div v-else class="sm-map-card sm-map-card--empty neu-card">
                      <i class="fa-solid fa-map-location-dot"></i>
                      <p>This destination has no pinned map coordinates yet.</p>
                      <a class="sm-map-btn sm-map-btn--google" :href="gmapsSearchUrl" target="_blank" rel="noopener noreferrer">
                        <i class="fa-brands fa-google"></i> Search it on Google Maps
                      </a>
                    </div>
                  </section>

                  <div class="sm-guide neu-card">
                    <div class="sm-guide__media">
                      <img :src="getImagesArray(currentStoryDest)[0]" :alt="currentStoryDest.name" />
                    </div>
                    <div class="sm-guide__info">
                      <span class="sm-guide__eyebrow">Guest Information</span>
                      <h4>{{ currentStoryDest.name }}, Oriental Mindoro</h4>
                      <span v-if="currentStoryDest.rating"><i class="fa-solid fa-star"></i> {{ currentStoryDest.rating }} rated by visitors</span>
                    </div>
                    <div class="sm-guide__actions">
                      <button class="btn btn--sage sm-book" @click="handleBookNow">
                        <i class="fa-solid fa-ticket"></i> Interested? Book Now
                      </button>
                      <button class="btn btn--coral sm-save" :class="{ 'is-saved': isInStoryWishlist(currentStoryDest.id) }" @click="toggleStoryWishlist(currentStoryDest.id)">
                        <i class="fa-solid fa-heart"></i>{{ isInStoryWishlist(currentStoryDest.id) ? 'Saved' : 'Save' }}
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>

        </article>
      </div>
    </div>

    <!-- ═══ MT. HALCON GUIDE MODAL ═══ -->
    <Transition name="mfade">
      <div v-if="halconModalOpen" class="halcon-modal-backdrop" @click.self="closeHalconModal">
        <div class="halcon-modal" role="dialog" aria-modal="true" aria-label="Mt. Halcon full guide">
          <div class="halcon-modal__head">
            <div class="halcon-modal__title">
              <h3>Mt. Halcon Field Guide</h3>
              <span><i class="fa-solid fa-mountain"></i> 2,582 MASL &middot; 9/9 &middot; Baco, Oriental Mindoro</span>
            </div>
            <button class="halcon-modal__close" @click="closeHalconModal" aria-label="Close guide"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="halcon-modal__scroll" data-lenis-prevent>
            <div class="halcon__facts neu-dark-raised">
              <h4><i class="fa-solid fa-circle-info"></i> Quick Facts</h4>
              <div class="halcon__facts-grid">
                <div class="halcon__fact" v-for="f in halconFacts" :key="f.label">
                  <span>{{ f.label }}</span><b>{{ f.value }}</b>
                </div>
              </div>
            </div>

            <div class="halcon__reqs neu-dark-raised">
              <h4><i class="fa-solid fa-clipboard-check"></i> Permits &amp; Requirements</h4>
              <ul>
                <li v-for="(r, i) in halconRequirements" :key="i"><i class="fa-solid fa-check"></i><span>{{ r }}</span></li>
              </ul>
            </div>

            <div class="halcon__hazards">
              <h4><i class="fa-solid fa-triangle-exclamation"></i> Know Before You Go</h4>
              <div class="halcon__hazard neu-dark-inset" v-for="h in halconHazards" :key="h.title">
                <h5><i class="fa-solid" :class="h.icon"></i> {{ h.title }}</h5>
                <p>{{ h.text }}</p>
              </div>
            </div>

            <div class="halcon__sources neu-dark-raised">
              <h4><i class="fa-solid fa-book-open"></i> Full Guides &amp; Sources</h4>
              <a v-for="s in halconSources" :key="s.url" :href="s.url" target="_blank" rel="noopener noreferrer">
                {{ s.name }} <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </a>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ═══ TOASTS ═══ -->
    <div class="toast-stack">
      <TransitionGroup name="toast">
        <div v-for="t in toasts" :key="t.id" class="toast neu-raised">
          <i :class="`fa-solid fa-${t.icon}`"></i><span>{{ t.message }}</span>
        </div>
      </TransitionGroup>
    </div>

    <!-- ═══ WEATHER WIDGET (floating, lower-left · movable & retractable) ═══ -->
    <div class="weather-widget" :class="{ 'weather-widget--open': weatherOpen, 'weather-widget--moved': !!widgetPos }" :style="widgetStyle">
      <button class="weather-widget__toggle"
        @pointerdown="weatherDragStart"
        @pointermove="weatherDragMove"
        @pointerup="weatherDragEnd"
        @pointercancel="weatherDragEnd"
        @click="weatherToggle"
        :aria-label="weatherOpen ? 'Hide weather' : 'Show weather'">
        <template v-if="weatherCurrent">
          <i class="fa-solid" :class="weatherCurrent.icon"></i>
          <span class="weather-widget__temp">{{ Math.round(weatherCurrent.temperature_2m) }}&deg;</span>
        </template>
        <template v-else>
          <i class="fa-solid fa-location-dot"></i>
          <span>Weather</span>
        </template>
        <i class="fa-solid weather-widget__chev" :class="weatherOpen ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
      </button>

      <div class="weather-widget__panel">
        <div v-if="weatherLoading" class="weather-widget__loading">
          <i class="fa-solid fa-spinner fa-spin"></i>
          <span>Loading weather&hellip;</span>
        </div>
        <div v-else-if="weatherCurrent" class="weather-widget__body">
          <div class="weather-widget__head">
            <span class="weather-widget__place">{{ weather?.location?.name || 'Baco, Oriental Mindoro' }}</span>
            <span class="weather-widget__cond"><i class="fa-solid" :class="weatherCurrent.icon"></i> {{ weatherCurrent.label }}</span>
          </div>
          <div class="weather-widget__now">
            <span class="weather-widget__big">{{ Math.round(weatherCurrent.temperature_2m) }}&deg;C</span>
            <span class="weather-widget__feels">Feels like {{ Math.round(weatherCurrent.apparent_temperature) }}&deg;</span>
          </div>
          <div class="weather-widget__extra">
            <span><i class="fa-solid fa-droplet"></i> {{ weatherCurrent.relative_humidity_2m }}%</span>
            <span><i class="fa-solid fa-wind"></i> {{ Math.round(weatherCurrent.wind_speed_10m) }} km/h</span>
          </div>
        </div>
        <div v-else class="weather-widget__loading">Weather unavailable</div>
      </div>
    </div>

  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Playfair+Display:ital,wght@0,700;0,800;0,900;1,700&display=swap');

:root {
  --eco-forest: #1A3310;
  --eco-deep: #0F2B0A;
  --eco-moss: #3D6B1E;
  --eco-sage: #4A7A28;
  --eco-mint: #ABD904;
  --eco-pale: #EFF8D8;
  --eco-amber: #F2B705;
  --eco-amber-deep: #C49200;
  --eco-amber-light: #FFF4D6;
  --eco-cream: #F2F2F2;
  --eco-white: #FAFAFA;
  --eco-dark: #1A1A1A;
  --eco-text: #2A2A2A;
  --eco-soft: #5A5A5A;
  --eco-muted: #8A8A8A;
  --fiesta-blue: #0597F2;
  --fiesta-blue-deep: #0472B8;
  --fiesta-blue-light: #E0F0FF;
  --fiesta-red: #F20505;
  --fiesta-red-deep: #C00404;
  --fiesta-red-light: #FFE0E0;
  --eco-border: rgba(0,0,0,0.08);
  --eco-border-soft: rgba(0,0,0,0.04);
  --eco-shadow-sm: 0 2px 12px rgba(0,0,0,0.06);
  --eco-shadow-md: 0 8px 30px rgba(0,0,0,0.08);
  --eco-shadow-lg: 0 20px 50px rgba(0,0,0,0.12);
  --eco-radius: 16px;
  --eco-radius-lg: 24px;
  --eco-radius-xl: 32px;
  --eco-max: 1200px;
  --font-display: 'Playfair Display', Georgia, serif;
  --font-body: 'Outfit', system-ui, sans-serif;
  --neu-bg: #F2F2F2;
  --neu-shadow-light: rgba(255,255,255,0.8);
  --neu-shadow-dark: rgba(180,180,180,0.3);
  --neu-distance: 8px;
  --neu-blur: 20px;
  --neu-dark-bg: rgba(255,255,255,0.06);
  --neu-dark-shadow-light: rgba(255,255,255,0.06);
  --neu-dark-shadow-dark: rgba(0,0,0,0.35);
}
</style>

<style scoped>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
img{display:block;max-width:100%;height:auto}
button,input,textarea,select{font-family:inherit;font-size:inherit}
ul{list-style:none}
a{color:inherit;text-decoration:none}

.eco-page{font-family:var(--font-body);color:var(--eco-text);-webkit-font-smoothing:antialiased;background:var(--eco-cream);overflow-x:hidden}
.container{width:100%;max-width:var(--eco-max);margin:0 auto;padding:0 24px}
@media(min-width:768px){.container{padding:0 40px}}
@media(min-width:1100px){.container{padding:0 56px}}

/* ═══ NEUMORPHISM SYSTEM ═══ */
.neu-flat{background:var(--neu-bg);border-radius:14px;box-shadow:var(--neu-distance) var(--neu-distance) calc(var(--neu-distance)*2.5) var(--neu-shadow-dark),calc(var(--neu-distance)*-1) calc(var(--neu-distance)*-1) calc(var(--neu-distance)*2.5) var(--neu-shadow-light);transition:all .35s cubic-bezier(.16,1,.3,1)}
.neu-flat:hover{transform:translateY(-2px);box-shadow:calc(var(--neu-distance)*1.2) calc(var(--neu-distance)*1.2) calc(var(--neu-distance)*3) var(--neu-shadow-dark),calc(var(--neu-distance)*-1.2) calc(var(--neu-distance)*-1.2) calc(var(--neu-distance)*3) var(--neu-shadow-light)}
.neu-raised{background:var(--neu-bg);border-radius:20px;box-shadow:8px 8px 16px var(--neu-shadow-dark),-8px -8px 16px var(--neu-shadow-light);transition:all .35s cubic-bezier(.16,1,.3,1)}
.neu-pressed{background:var(--neu-bg);border-radius:14px;box-shadow:inset 5px 5px 10px var(--neu-shadow-dark),inset -5px -5px 10px var(--neu-shadow-light)}
.neu-inset{background:var(--neu-bg);border-radius:var(--eco-radius-xl);box-shadow:inset 8px 8px 16px var(--neu-shadow-dark),inset -8px -8px 16px var(--neu-shadow-light)}
.neu-card{background:var(--neu-bg);border-radius:var(--eco-radius-xl);box-shadow:10px 10px 20px var(--neu-shadow-dark),-10px -10px 20px var(--neu-shadow-light);transition:all .45s cubic-bezier(.16,1,.3,1);border:1px solid rgba(0,0,0,0.03);position:relative;overflow:hidden}
.neu-card:hover{box-shadow:16px 16px 32px rgba(180,180,180,0.35),-16px -16px 32px rgba(255,255,255,0.9);transform:translateY(-10px) scale(1.02)}
.neu-card-large{background:var(--neu-bg);border-radius:var(--eco-radius-xl);box-shadow:12px 12px 24px var(--neu-shadow-dark),-12px -12px 24px var(--neu-shadow-light);border:1px solid rgba(0,0,0,0.03)}
.neu-dark-raised{background:var(--neu-dark-bg);border-radius:var(--eco-radius);box-shadow:6px 6px 12px var(--neu-dark-shadow-dark),-6px -6px 12px var(--neu-dark-shadow-light);transition:all .35s cubic-bezier(.16,1,.3,1);border:1px solid rgba(255,255,255,0.05)}
.neu-dark-raised:hover{box-shadow:8px 8px 16px var(--neu-dark-shadow-dark),-8px -8px 16px var(--neu-dark-shadow-light);transform:translateY(-4px) scale(1.04)}
.neu-dark-inset{background:var(--neu-dark-bg);border-radius:var(--eco-radius);box-shadow:inset 6px 6px 12px var(--neu-dark-shadow-dark),inset -6px -6px 12px var(--neu-dark-shadow-light);border:1px solid rgba(255,255,255,0.05)}
.neu-raised-dark{background:rgba(15,43,10,0.92);border-radius:var(--eco-radius);box-shadow:6px 6px 12px rgba(0,0,0,0.4),-6px -6px 12px rgba(255,255,255,0.08);border:1px solid rgba(171,217,4,0.15)}
.neu-btn-raised{box-shadow:6px 6px 14px rgba(0,0,0,0.22),-4px -4px 10px rgba(255,255,255,0.08);transition:all .35s cubic-bezier(.16,1,.3,1)}
.neu-btn-raised:hover{box-shadow:8px 8px 20px rgba(0,0,0,0.28),-6px -6px 14px rgba(255,255,255,0.12);transform:translateY(-4px) scale(1.03)}
.neu-btn-raised:active{box-shadow:inset 3px 3px 6px rgba(0,0,0,0.25),inset -3px -3px 6px rgba(255,255,255,0.08);transform:translateY(0) scale(0.98)}

/* ═══ TYPOGRAPHY ═══ */
.heading{font-family:var(--font-display);font-weight:900;line-height:0.95;letter-spacing:-0.02em;color:var(--eco-dark)}
.heading em{font-style:italic;font-weight:800;color:var(--eco-amber)}
.heading--lg{font-size:clamp(32px,8vw,82px)}
.heading--xl{font-size:clamp(56px,9.5vw,108px)}

.tag{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-body);font-weight:800;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;padding:10px 22px;border-radius:100px;margin-bottom:16px}
.tag--green{background:var(--eco-pale);color:var(--eco-moss)}
.tag--sage{background:var(--fiesta-blue-light);color:var(--fiesta-blue-deep)}
.tag--amber{background:var(--eco-amber-light);color:var(--eco-amber-deep)}

.btn{display:inline-flex;align-items:center;gap:12px;font-family:var(--font-body);font-weight:800;font-size:14px;letter-spacing:0.03em;color:#fff;padding:16px 34px;border:none;border-radius:100px;cursor:pointer;transition:transform .35s cubic-bezier(.16,1,.3,1),box-shadow .35s;box-shadow:var(--eco-shadow-md)}
.btn:hover{transform:translateY(-4px);box-shadow:var(--eco-shadow-lg)}
.btn--amber{background:linear-gradient(135deg,var(--eco-amber),var(--eco-amber-deep))}
.btn--coral{background:linear-gradient(135deg,var(--fiesta-red),var(--fiesta-red-deep))}
.btn--sage{background:linear-gradient(135deg,var(--fiesta-blue),var(--fiesta-blue-deep))}
.btn.is-saved{background:linear-gradient(135deg,var(--eco-moss),var(--eco-forest))}
.btn--ghost{display:inline-flex;align-items:center;gap:10px;font-family:var(--font-body);font-weight:800;font-size:13px;color:var(--eco-white);background:rgba(255,255,255,0.1);border:2px solid rgba(171,217,4,0.35);border-radius:100px;padding:14px 28px;cursor:pointer;transition:all .35s;box-shadow:none}
.btn--ghost:hover{background:rgba(171,217,4,0.15);border-color:var(--eco-mint);transform:translateY(-3px);box-shadow:0 8px 24px rgba(171,217,4,0.15)}

/* ═══ REVEAL ANIMATION ═══ */
[v-reveal]{opacity:0;transform:translateY(50px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1);transition-delay:calc(var(--i,0)*0.08s)}
[v-reveal].is-revealed{opacity:1;transform:translateY(0)}
@media(prefers-reduced-motion:reduce){[v-reveal]{opacity:1;transform:none;transition:none}}

/* ═══ HERO ═══ */
.hero{position:relative;min-height:120vh;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;background:var(--eco-deep)}
/* Set by initHeroIdle() once the hero leaves the viewport: freeze the looping
   video and every infinite animation so they cost nothing for the rest of the page. */
.hero--idle::before,.hero--idle::after,.hero--idle .hero__particles span,.hero--idle .hero__glow{animation-play-state:paused}
.hero::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--fiesta-red) 0%,var(--fiesta-red) 14.28%,var(--eco-amber) 14.28%,var(--eco-amber) 28.57%,var(--eco-mint) 28.57%,var(--eco-mint) 42.85%,var(--fiesta-blue) 42.85%,var(--fiesta-blue) 57.14%,var(--fiesta-red) 57.14%,var(--fiesta-red) 71.42%,var(--eco-amber) 71.42%,var(--eco-amber) 85.71%,var(--eco-mint) 85.71%,var(--eco-mint) 100%);z-index:20;animation:buntingSlide 12s linear infinite}
@keyframes buntingSlide{0%{background-position:0 0}100%{background-position:400px 0}}
.hero::after{content:'';position:absolute;top:4px;left:0;right:0;height:16px;z-index:20;background:linear-gradient(135deg,var(--fiesta-red) 33.33%,transparent 33.33%) 0 0/32px 16px repeat-x,linear-gradient(225deg,var(--eco-amber) 33.33%,transparent 33.33%) 16px 0/32px 16px repeat-x;opacity:0.5;animation:buntingSlide 12s linear infinite}
.hero__bg{position:absolute;top:-20%;left:0;width:100%;height:140%;object-fit:cover;object-position:center 30%;display:block;will-change:transform;pointer-events:none}
.hero__overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,43,10,0.30) 0%,rgba(15,43,10,0.50) 40%,rgba(15,43,10,0.85) 80%,rgba(15,43,10,0.95) 100%)}
.hero__grain{position:absolute;inset:0;opacity:0.03;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:200px;pointer-events:none}
.hero__glow{position:absolute;border-radius:50%;pointer-events:none;z-index:1}
.hero__glow--1{width:600px;height:600px;top:-200px;right:-200px;background:radial-gradient(circle,rgba(242,183,5,0.25),transparent 70%);animation:glowDrift1 10s ease-in-out infinite alternate;will-change:transform}
.hero__glow--2{width:500px;height:500px;bottom:-150px;left:-150px;background:radial-gradient(circle,rgba(171,217,4,0.20),transparent 70%);animation:glowDrift2 12s ease-in-out infinite alternate;will-change:transform}
.hero__glow--3{width:400px;height:400px;top:35%;left:50%;transform:translateX(-50%);background:radial-gradient(circle,rgba(5,151,242,0.15),transparent 70%);animation:glowPulse 8s ease-in-out infinite alternate;will-change:transform,opacity}
@keyframes glowDrift1{0%{transform:translate(0,0) scale(1);opacity:0.6}50%{transform:translate(-40px,30px) scale(1.2);opacity:0.9}100%{transform:translate(20px,-20px) scale(1.1);opacity:0.7}}
@keyframes glowDrift2{0%{transform:translate(0,0) scale(1);opacity:0.5}50%{transform:translate(30px,-25px) scale(1.15);opacity:0.8}100%{transform:translate(-15px,15px) scale(1.05);opacity:0.6}}
@keyframes glowPulse{0%{transform:translateX(-50%) scale(1);opacity:0.4}100%{transform:translateX(-50%) scale(1.4);opacity:0.7}}
.hero__particles{position:absolute;inset:0;pointer-events:none;z-index:2;overflow:hidden}
.hero__particles span{position:absolute;display:block;width:3px;height:3px;border-radius:50%;background:rgba(171,217,4,0.5);animation:particleRise linear infinite}
.hero__particles span:nth-child(1){left:8%;animation-duration:14s;animation-delay:0s;width:2px;height:2px;opacity:0.4}
.hero__particles span:nth-child(2){left:15%;animation-duration:18s;animation-delay:2s;width:4px;height:4px;opacity:0.3;background:rgba(242,183,5,0.4)}
.hero__particles span:nth-child(3){left:22%;animation-duration:12s;animation-delay:4s;width:2px;height:2px;opacity:0.6}
.hero__particles span:nth-child(4){left:30%;animation-duration:20s;animation-delay:1s;width:3px;height:3px;opacity:0.3;background:rgba(5,151,242,0.4)}
.hero__particles span:nth-child(5){left:38%;animation-duration:15s;animation-delay:6s;width:2px;height:2px;opacity:0.5}
.hero__particles span:nth-child(6){left:45%;animation-duration:17s;animation-delay:3s;width:4px;height:4px;opacity:0.25;background:rgba(242,183,5,0.5)}
.hero__particles span:nth-child(7){left:52%;animation-duration:13s;animation-delay:7s;width:2px;height:2px;opacity:0.5}
.hero__particles span:nth-child(8){left:60%;animation-duration:19s;animation-delay:0.5s;width:3px;height:3px;opacity:0.35;background:rgba(171,217,4,0.6)}
.hero__particles span:nth-child(9){left:67%;animation-duration:16s;animation-delay:5s;width:2px;height:2px;opacity:0.45}
.hero__particles span:nth-child(10){left:75%;animation-duration:21s;animation-delay:2.5s;width:3px;height:3px;opacity:0.3;background:rgba(5,151,242,0.5)}
.hero__particles span:nth-child(11){left:82%;animation-duration:14s;animation-delay:8s;width:2px;height:2px;opacity:0.55}
@keyframes particleRise{0%{bottom:-10%;opacity:0;transform:translateX(0)}10%{opacity:1}90%{opacity:1}100%{bottom:110%;opacity:0;transform:translateX(40px)}}
@media(prefers-reduced-motion:reduce){.hero__particles span,.hero__glow,.hero::before,.hero::after{animation:none !important}}
.hero__mountains{position:absolute;bottom:0;left:0;right:0;height:35%;z-index:3;pointer-events:none}
.hero__mountain-svg{width:100%;height:100%;display:block}
.hero__content{position:relative;z-index:10;text-align:center;padding:0 24px;max-width:800px}
.hero__label{display:inline-block;font-family:var(--font-body);font-weight:800;font-size:12px;letter-spacing:0.25em;text-transform:uppercase;color:var(--eco-mint);margin-bottom:20px;padding:8px 24px;border:1px solid rgba(171,217,4,0.3);border-radius:100px;background:rgba(171,217,4,0.08)}
.hero__heading{font-family:var(--font-display);font-weight:900;font-size:clamp(52px,10vw,120px);line-height:0.92;letter-spacing:-0.03em;color:#fff;margin-bottom:20px}
.hero__heading em{font-style:italic;font-weight:800;color:var(--eco-amber);display:inline-block}
.hero__search{display:flex;align-items:center;gap:12px;padding:8px 8px 8px 24px;max-width:480px;margin:0 auto;width:100%}
.hero__search i{color:var(--eco-moss);font-size:18px;flex-shrink:0}
.hero__search input{flex:1;min-width:0;border:none;outline:none;background:transparent;font-family:var(--font-body);font-size:15px;color:var(--eco-text);padding:8px 0}
.hero__search input::placeholder{color:var(--eco-muted)}
.hero__search button{font-family:var(--font-body);font-weight:800;font-size:13px;letter-spacing:0.04em;color:#fff;background:linear-gradient(135deg,var(--eco-sage),var(--eco-moss));border:none;padding:14px 28px;border-radius:100px;cursor:pointer;transition:all .3s;white-space:nowrap;flex-shrink:0}
.hero__search button:hover{transform:scale(1.05);box-shadow:0 4px 16px rgba(74,122,40,0.3)}
@media(max-width:400px){
  .hero__search{flex-wrap:wrap;padding:16px 20px;border-radius:24px}
  .hero__search input{width:100%;order:1;padding:4px 0 8px}
  .hero__search i{order:0}
  .hero__search button{order:2;width:100%;justify-content:center;text-align:center}
}

/* ═══ DESTINATIONS — Premium Carousel ═══ */
.dest{position:relative;width:100%;height:100vh;min-height:700px;overflow:hidden;background:var(--eco-deep);color:#fff}
.dest__bg{position:absolute;inset:0;z-index:0}
.dest__bg img{position:absolute;top:-15%;left:0;width:100%;height:130%;object-fit:cover;opacity:0;transition:opacity 2s ease;filter:brightness(0.75);will-change:transform}
.dest__bg img.is-active{opacity:1}
.dest__skyline{position:absolute;left:0;right:0;top:0;height:18%;z-index:2;pointer-events:none}
.dest__skyline-svg{width:100%;height:100%;display:block}
.dest__overlay{position:absolute;inset:0;z-index:1;background:linear-gradient(90deg,rgba(15,43,10,0.85) 0%,rgba(15,43,10,0.1) 45%,rgba(15,43,10,0.45) 100%)}
.dest__progress-bar{position:absolute;bottom:0;left:0;height:3px;background:linear-gradient(90deg,var(--eco-amber),var(--eco-amber-deep));z-index:100;box-shadow:0 0 10px rgba(242,183,5,0.5)}
.dest__navdots{position:absolute;left:28px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:16px;z-index:100}
.dest__navdot{width:12px;height:12px;border-radius:50%;background:rgba(255,255,255,0.3);cursor:pointer;transition:all .3s ease;position:relative;border:none;padding:0}
.dest__navdot::after{content:attr(data-tip);position:absolute;left:24px;top:50%;transform:translateY(-50%);padding:6px 12px;background:rgba(0,0,0,0.9);border-radius:6px;font-size:12px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .3s ease}
.dest__navdot:hover::after{opacity:1}
.dest__navdot.is-active{background:var(--eco-amber);transform:scale(1.3)}
.dest__navdot:hover{background:rgba(255,255,255,0.6)}
.dest__stage{position:relative;z-index:10;width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:80px;padding:60px 40px}
.dest__content{width:100%;max-width:480px}
.dest__trending{display:inline-flex;align-items:center;gap:8px;background:rgba(38,58,20,0.72);border:1px solid rgba(171,217,4,0.25);border-radius:50px;padding:8px 18px;margin-bottom:24px;font-size:13px;font-weight:600;color:var(--eco-mint);font-family:var(--font-body)}
.dest__trend-dot{width:8px;height:8px;background:var(--eco-mint);border-radius:50%;animation:destPulse 2s infinite}
@keyframes destPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.2)}}
.dest__name{font-family:var(--font-display);font-weight:900;font-size:clamp(52px,7vw,88px);letter-spacing:-0.03em;line-height:0.92;margin-bottom:20px;background:linear-gradient(to bottom,#ffffff,#cccccc);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;text-fill-color:transparent}
.dest__desc{font-size:17px;line-height:1.6;color:rgba(255,255,255,0.85);margin-bottom:36px;text-shadow:0 2px 10px rgba(0,0,0,0.5);font-family:var(--font-body)}
.dest__cta{display:inline-flex;align-items:center;gap:12px;padding:16px 32px;background:linear-gradient(135deg,var(--eco-amber),var(--eco-amber-deep));border:none;border-radius:50px;color:#fff;font-size:16px;font-weight:800;letter-spacing:0.03em;cursor:pointer;transition:all .3s ease;box-shadow:var(--eco-shadow-md);font-family:var(--font-body)}
.dest__cta:hover{transform:translateY(-4px);box-shadow:var(--eco-shadow-lg)}
.dest__cta-icon{width:32px;height:32px;background:rgba(255,255,255,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1}
.dest__carousel{position:relative;width:650px;height:450px;flex-shrink:0;display:flex;align-items:center;justify-content:center;perspective:1200px}
.dest__card{position:absolute;top:50%;left:50%;width:260px;height:350px;margin-left:-130px;margin-top:-175px;border-radius:20px;overflow:hidden;cursor:pointer;background:#1a1a1a;box-shadow:0 25px 70px rgba(0,0,0,0.7);transition:all 1.4s cubic-bezier(.16,1,.3,1);opacity:0;transform:scale(0.5) rotateY(0deg);pointer-events:none;will-change:transform,opacity,filter}
.dest__card img{width:100%;height:100%;object-fit:cover;display:block}
.dest__card-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0.1) 0%,transparent 30%,transparent 60%,rgba(0,0,0,0.8) 100%);z-index:1;pointer-events:none}
.dest__card-top{position:absolute;top:14px;left:14px;right:14px;z-index:3;display:flex;align-items:flex-start;justify-content:space-between}
.dest__card-loc{color:#fff;font-size:11px;font-weight:700;text-shadow:0 2px 8px rgba(0,0,0,0.5);letter-spacing:0.5px;text-transform:uppercase;background:rgba(0,0,0,0.62);padding:5px 10px;border-radius:20px}
.dest__card-book{width:40px;height:40px;background:rgba(255,255,255,0.95);border:none;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--eco-dark);box-shadow:0 4px 12px rgba(0,0,0,0.3);cursor:pointer;transition:transform .3s ease}
.dest__card:hover .dest__card-book{transform:scale(1.1) rotate(10deg)}
.dest__card-book.is-saved{background:var(--eco-amber);color:#fff}
.dest__card-bottom{position:absolute;bottom:16px;left:16px;right:16px;z-index:3}
.dest__card-stars{display:flex;align-items:center;gap:3px;margin-bottom:6px}
.dest__star{color:var(--eco-amber);font-size:12px}
.dest__star.is-empty{color:rgba(255,255,255,0.3)}
.dest__card-rating{color:rgba(255,255,255,0.8);font-size:11px;font-weight:600;margin-left:6px}
.dest__card-name{font-family:var(--font-display);font-weight:800;letter-spacing:-0.01em;color:#fff;font-size:16px;text-shadow:0 2px 8px rgba(0,0,0,0.5)}
.dest__card.pos-featured{transform:translateX(0) scale(1.15) rotateY(0deg);z-index:5;opacity:1;filter:brightness(1) blur(0px);pointer-events:auto}
.dest__card.pos-left-1{transform:translateX(-180px) scale(0.7) rotateY(20deg);z-index:3;opacity:0.6;filter:brightness(0.6) blur(1px);pointer-events:auto}
.dest__card.pos-left-2{transform:translateX(-320px) scale(0.45) rotateY(30deg);z-index:2;opacity:0.3;filter:brightness(0.4) blur(2.5px)}
.dest__card.pos-right-1{transform:translateX(180px) scale(0.7) rotateY(-20deg);z-index:3;opacity:0.6;filter:brightness(0.6) blur(1px);pointer-events:auto}
.dest__card.pos-right-2{transform:translateX(320px) scale(0.45) rotateY(-30deg);z-index:2;opacity:0.3;filter:brightness(0.4) blur(2.5px)}
.dest__pagination{position:absolute;bottom:40px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:16px;padding:12px 24px;background:rgba(38,58,20,0.82);border:1px solid rgba(171,217,4,0.2);border-radius:50px;z-index:100}
.dest__pagination-dots{display:flex;gap:8px;align-items:center}
.dest__pagination-dot{position:relative;width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.3);cursor:pointer;border:none;padding:0;transition:all .4s ease}
/* Invisible 40px-tall tap area so the 8px dot stays visually unchanged on mobile */
.dest__pagination-dot::after{content:'';position:absolute;inset:-16px -10px}
.dest__pagination-dot.is-active{width:28px;border-radius:4px;background:var(--eco-amber)}
.dest__pagination-dot:hover{background:rgba(255,255,255,0.6)}
.dest__counter{font-size:14px;font-weight:600;color:rgba(255,255,255,0.8)}
.dest .state-empty{position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:rgba(255,255,255,0.85);font-size:15px}
@media(max-width:1200px){
  .dest__stage{gap:40px;padding:60px 20px}
  .dest__name{font-size:64px}
  .dest__content{max-width:350px}
  .dest__carousel{width:480px}
  .dest__card{width:220px;height:300px;margin-left:-110px;margin-top:-150px}
  .dest__card.pos-left-1{transform:translateX(-140px) scale(0.7) rotateY(20deg)}
  .dest__card.pos-right-1{transform:translateX(140px) scale(0.7) rotateY(-20deg)}
  .dest__card.pos-left-2,.dest__card.pos-right-2{display:none}
}
@media(max-width:768px){
  .dest{height:auto;min-height:100vh}
  .dest__stage{flex-direction:column;justify-content:center;gap:40px;padding:60px 16px 100px}
  .dest__content{display:none}
  .dest__navdots{display:none}
  .dest__carousel{width:90%;height:400px}
  .dest__pagination{bottom:26px}
}

/* ═══ MAP SECTION ═══ */
.mapsec{position:relative;padding:40px 0 36px;overflow:hidden;background:linear-gradient(180deg,var(--eco-pale) 0%,#dce8f0 50%,var(--fiesta-blue-light) 100%)}
.mapsec::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(ellipse 70% 60% at 70% 40%,rgba(5,151,242,0.06),transparent),radial-gradient(ellipse 50% 40% at 30% 80%,rgba(74,122,40,0.05),transparent);pointer-events:none;z-index:0}
.mapsec__ambient-glow{position:absolute;bottom:-15%;left:-10%;width:500px;height:500px;background:radial-gradient(circle,rgba(5,151,242,0.08),transparent 70%);pointer-events:none;z-index:0}
.mapsec .container{position:relative;z-index:1}
.mapsec__head{display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px}
.mapsec__hint{font-size:13px;color:var(--eco-soft);display:flex;align-items:center;gap:8px}
.mapsec__frame{height:420px;overflow:hidden}
.mapsec__canvas{width:100%;height:100%;border-radius:var(--eco-radius-xl)}
@media(max-width:768px){.mapsec__frame{height:280px}}
.mapsec__pinned{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:16px}
.mapsec__pinned-label{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--eco-moss);display:inline-flex;align-items:center;gap:6px}
.mapsec__chip{font-family:var(--font-body);font-weight:700;font-size:12px;color:var(--eco-forest);background:var(--eco-pale);border:1px solid rgba(74,122,40,.18);border-radius:100px;padding:7px 14px;cursor:pointer;transition:all .25s}
.mapsec__chip:hover{background:var(--eco-moss);color:#fff;transform:translateY(-2px);box-shadow:0 6px 16px rgba(74,122,40,.25)}
.mapsec__note{margin-top:10px;font-size:12px;color:var(--eco-muted);display:flex;align-items:center;gap:6px}

/* ═══ MT. HALCON ═══ */
.halcon{position:relative;padding:40px 0 36px;overflow:hidden;background:linear-gradient(180deg,var(--eco-forest) 0%,var(--eco-deep) 50%,#0a1f06 100%)}
.halcon::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(ellipse 60% 50% at 80% 20%,rgba(171,217,4,0.06),transparent),radial-gradient(ellipse 50% 60% at 20% 80%,rgba(242,183,5,0.04),transparent);pointer-events:none;z-index:0}
.halcon__ambient-glow{position:absolute;border-radius:50%;pointer-events:none;z-index:0}
.halcon__ambient-glow--1{top:-20%;right:-10%;width:500px;height:500px;background:radial-gradient(circle,rgba(171,217,4,0.08),transparent 70%)}
.halcon__ambient-glow--2{bottom:-15%;left:-5%;width:400px;height:400px;background:radial-gradient(circle,rgba(242,183,5,0.06),transparent 70%)}
.halcon .container{position:relative;z-index:1}
.halcon__grid{display:grid;grid-template-columns:1fr;gap:24px}
@media(min-width:900px){.halcon__grid{grid-template-columns:1.1fr 1fr;gap:32px;align-items:stretch}}
.halcon__main-imgs{display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:12px}
.halcon__main-img{position:relative;border-radius:var(--eco-radius-xl);overflow:hidden}
.halcon__main-img img{width:100%;height:240px;object-fit:cover;display:block}
@media(min-width:600px){.halcon__main-img img{height:280px}}
@media(min-width:900px){
  .halcon__visual{display:flex;flex-direction:column;gap:12px;height:100%}
  .halcon__main-imgs{flex:1 1 auto;min-height:0;margin-bottom:0;grid-template-rows:1fr 1fr}
  .halcon__main-img img{position:absolute;inset:0;width:100%;height:100%}
  .halcon__gallery{flex-shrink:0}
}
.halcon__elev{position:absolute;bottom:16px;right:16px;padding:14px 20px;text-align:center}
.halcon__elev-num{display:block;font-family:var(--font-display);font-weight:900;font-size:32px;color:var(--eco-mint);line-height:1}
.halcon__elev-unit{display:block;font-family:var(--font-body);font-weight:800;font-size:11px;letter-spacing:0.15em;color:rgba(255,255,255,0.6);margin-top:4px}
.halcon__gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.halcon__gallery img{width:100%;height:90px;object-fit:cover;border-radius:var(--eco-radius);display:block}
@media(min-width:900px){.halcon__gallery img{height:110px}}
.halcon__info .tag{margin-bottom:12px}
.halcon__info .heading{color:var(--eco-white);margin-bottom:14px}
.halcon__desc{font-size:15px;color:rgba(255,255,255,0.7);line-height:1.6;margin-bottom:16px}
.halcon__stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}
.halcon__stat{padding:14px 8px;text-align:center}
.halcon__stat span{display:block;font-family:var(--font-display);font-weight:900;font-size:20px;color:var(--eco-mint);line-height:1}
.halcon__stat small{display:block;font-family:var(--font-body);font-weight:700;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-top:6px}
.halcon__trail{padding:18px;margin-bottom:16px}
.halcon__trail h3{font-family:var(--font-body);font-weight:800;font-size:14px;letter-spacing:0.05em;color:var(--eco-mint);margin-bottom:12px}
.halcon__trail ul{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
.halcon__trail li{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:rgba(255,255,255,0.7)}
.halcon__trail li span{color:rgba(255,255,255,0.45);font-weight:600}
.halcon__trail li b{color:var(--eco-white);font-weight:700}
.halcon__note{font-size:12px;color:rgba(255,255,255,0.5);display:flex;align-items:flex-start;gap:8px;line-height:1.5}
.halcon__note i{color:var(--eco-amber);margin-top:2px;flex-shrink:0}

/* ═══ MT. HALCON CTA ROW ═══ */
.halcon__cta-row{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.halcon__more-toggle{display:inline-flex;align-items:center;gap:10px;font-family:var(--font-body);font-weight:800;font-size:13px;color:var(--eco-mint);background:transparent;border:2px dashed rgba(171,217,4,0.35);border-radius:100px;padding:14px 26px;cursor:pointer;transition:all .3s}
.halcon__more-toggle:hover{border-color:var(--eco-mint);background:rgba(171,217,4,0.08);transform:translateY(-2px)}
.halcon__book-btn{display:inline-flex;align-items:center;gap:10px;font-family:var(--font-body);font-weight:800;font-size:13px;letter-spacing:.02em;color:var(--eco-deep);background:linear-gradient(135deg,var(--eco-mint),#8FBC03);border:none;border-radius:100px;padding:14px 26px;cursor:pointer;transition:all .3s;box-shadow:0 8px 24px rgba(171,217,4,.25)}
.halcon__book-btn:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(171,217,4,.4)}

/* ═══ MT. HALCON GUIDE MODAL ═══ */
.halcon-modal-backdrop{position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px}
.halcon-modal{position:relative;width:100%;max-width:620px;max-height:88vh;display:flex;flex-direction:column;background:linear-gradient(180deg,var(--eco-deep) 0%,#0a1f06 100%);border:1px solid rgba(171,217,4,0.18);border-radius:var(--eco-radius-xl);box-shadow:0 30px 80px rgba(0,0,0,0.5);overflow:hidden}
.halcon-modal::before{content:'';position:absolute;top:-80px;right:-80px;width:260px;height:260px;background:radial-gradient(circle,rgba(171,217,4,0.12),transparent 70%);filter:blur(40px);pointer-events:none}
.halcon-modal__head{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03)}
.halcon-modal__title h3{font-family:var(--font-display);font-weight:900;font-size:22px;color:var(--eco-white);line-height:1.1}
.halcon-modal__title span{display:flex;align-items:center;gap:6px;font-family:var(--font-body);font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--eco-mint);margin-top:6px}
.halcon-modal__title span i{font-size:10px}
.halcon-modal__close{width:40px;height:40px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;font-size:16px;color:rgba(255,255,255,0.6);background:rgba(255,255,255,0.06);border-radius:50%;transition:all .3s}
.halcon-modal__close:hover{color:#fff;background:rgba(242,5,5,0.7);transform:rotate(90deg)}
.halcon-modal__scroll{position:relative;z-index:1;overflow-y:auto;padding:20px 24px 28px;display:flex;flex-direction:column;gap:12px;-webkit-overflow-scrolling:touch}
@media(max-width:600px){.halcon-modal__scroll{padding:16px 16px 24px}}
.halcon-modal__scroll h4{font-family:var(--font-body);font-weight:800;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:var(--eco-mint);margin-bottom:12px;display:flex;align-items:center;gap:8px}
.halcon__facts{padding:16px}
.halcon__facts-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px}
/* kept 2-up on phones: each fact is just an 11px label over a 12.5px value,
   which fits comfortably in ~140px and halves the list height */
@media(max-width:600px){.halcon__facts-grid{grid-template-columns:1fr 1fr;gap:8px 12px}}
.halcon__fact span{display:block;font-size:11px;font-weight:600;color:rgba(255,255,255,0.45);margin-bottom:2px}
.halcon__fact b{font-size:12.5px;font-weight:700;color:var(--eco-white);line-height:1.4}
.halcon__reqs{padding:16px}
.halcon__reqs ul{display:flex;flex-direction:column;gap:8px}
.halcon__reqs li{display:flex;gap:10px;font-size:13px;color:rgba(255,255,255,0.75);line-height:1.55}
.halcon__reqs li i{color:var(--eco-amber);margin-top:3px;flex-shrink:0;font-size:12px}
.halcon__hazards{display:flex;flex-direction:column;gap:8px}
.halcon__hazard{padding:14px 16px}
.halcon__hazard h5{font-family:var(--font-body);font-weight:800;font-size:13px;color:var(--eco-white);margin-bottom:4px;display:flex;align-items:center;gap:8px}
.halcon__hazard h5 i{color:var(--fiesta-red);font-size:12px}
.halcon__hazard p{font-size:12px;color:rgba(255,255,255,0.6);line-height:1.5}
.halcon__sources{padding:16px;display:flex;flex-direction:column;gap:8px}
.halcon__sources a{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--eco-mint);transition:color .2s;width:fit-content}
.halcon__sources a:hover{color:#fff;text-decoration:underline}
.halcon__sources a i{font-size:10px;opacity:0.6}

/* ═══ ECO-FESTIVE FLIPPING PORTAL ═══ */
.portal-festive{position:relative;padding:60px 0 80px;overflow:hidden;background:linear-gradient(180deg, #0a1f06 0%, var(--eco-forest) 40%, var(--eco-moss) 100%)}
.portal-festive::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(ellipse 60% 50% at 50% 30%,rgba(242,183,5,0.08),transparent),radial-gradient(ellipse 40% 40% at 80% 80%,rgba(171,217,4,0.06),transparent);pointer-events:none;z-index:0}
.portal-festive__deco{position:absolute;pointer-events:none;z-index:0}
.portal-festive__deco--leaf-1{top:10%;left:5%;width:120px;height:120px;background:radial-gradient(circle,rgba(171,217,4,0.15),transparent 70%);border-radius:40% 60% 70% 30% / 40% 50% 60% 50%;transform:rotate(-15deg);animation:leafFloat 8s ease-in-out infinite alternate}
.portal-festive__deco--leaf-2{bottom:15%;right:8%;width:160px;height:160px;background:radial-gradient(circle,rgba(242,183,5,0.12),transparent 70%);border-radius:60% 40% 30% 70% / 60% 30% 70% 40%;transform:rotate(20deg);animation:leafFloat 10s ease-in-out infinite alternate-reverse}
.portal-festive__deco--sun{top:-50px;right:-50px;width:200px;height:200px;background:radial-gradient(circle,rgba(242,183,5,0.2),transparent 70%);filter:blur(40px);animation:sunPulse 6s ease-in-out infinite alternate}
@keyframes leafFloat{0%{transform:rotate(-15deg) translateY(0)}100%{transform:rotate(-5deg) translateY(-20px)}}
@keyframes sunPulse{0%{transform:scale(1);opacity:0.6}100%{transform:scale(1.2);opacity:0.9}}

.portal-festive .container{position:relative;z-index:1}
.portal-festive__header{text-align:center;margin-bottom:40px}
.portal-festive__header .heading{color:var(--eco-white);margin-bottom:12px}
.portal-festive__subtitle{font-size:16px;color:rgba(255,255,255,0.7);max-width:600px;margin:0 auto;line-height:1.6}

/* 3D Flip Container */
.flip-container{perspective:1200px;width:100%;max-width:800px;margin:0 auto;min-height:480px}
.flipper{position:relative;width:100%;min-height:480px;display:grid;transition:transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275);transform-style:preserve-3d}
.flipper.is-flipped{transform:rotateY(180deg)}

.flip-face{grid-area:1/1;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:var(--eco-radius-xl);overflow:hidden}
.flip-face--back{transform:rotateY(180deg)}

/* Portal Content inside Flip Faces */
.portal-content{padding:40px;display:flex;flex-direction:column;align-items:center;text-align:center;height:100%;justify-content:flex-start;background:linear-gradient(145deg, rgba(255,255,255,0.97), rgba(242,242,242,0.95))}
@media(max-width:768px){.portal-content{padding:28px 20px}}

.portal-content__icon{width:70px;height:70px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:16px;background:linear-gradient(135deg,var(--eco-amber),var(--eco-amber-deep));color:#fff;box-shadow:0 8px 20px rgba(242,183,5,0.3)}
.portal-content__icon--owner{background:linear-gradient(135deg,var(--fiesta-blue),var(--fiesta-blue-deep));box-shadow:0 8px 20px rgba(5,151,242,0.3)}
/* Replaces both portal icon discs, so it carries none of their chrome and is
   centred by the parent's align-items instead. Same logo on both faces. */
.portal-content__logo{width:190px;height:auto;object-fit:contain;display:block;margin-bottom:16px}
@media(max-width:768px){.portal-content__logo{width:150px}}

.portal-content h3{font-family:var(--font-display);font-weight:900;font-size:28px;color:var(--eco-dark);margin-bottom:12px}
.portal-content p{font-size:15px;color:var(--eco-soft);line-height:1.6;max-width:500px;margin-bottom:20px}

.portal-feats{display:flex;flex-wrap:wrap;justify-content:center;align-content:flex-start;gap:10px;margin-bottom:24px;min-height:92px;flex-shrink:0}
.portal-feats span{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--eco-moss);padding:10px 18px;background:rgba(255,255,255,0.6)}
.portal-feats span i{color:var(--eco-amber)}

.portal-actions{width:100%;display:flex;flex-direction:column;align-items:center;gap:16px;flex-shrink:0}
.portal__loading{font-size:28px;color:var(--eco-muted)}
.portal__welcome{text-align:center}
.portal__welcome-icon{font-size:40px;color:var(--eco-moss);margin-bottom:12px}
.portal__welcome p{font-size:16px;font-weight:700;color:var(--eco-dark);margin-bottom:12px}
.portal-owner__note{font-size:12px;color:var(--eco-muted);display:flex;align-items:center;gap:6px;margin-top:8px}
.portal-owner__note i{color:var(--fiesta-blue)}
.flip-trigger{margin-top:auto;padding:12px 24px;background:transparent;border:2px dashed var(--eco-border);border-radius:100px;color:var(--eco-soft);font-family:var(--font-body);font-weight:700;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all .3s}
.flip-trigger:hover{border-color:var(--eco-amber);color:var(--eco-amber-deep);background:rgba(242,183,5,0.05)}

/* ═══ STORY MODAL ═══ */
.story-modal{position:fixed;inset:0;z-index:1000;background:var(--eco-cream);overflow-y:auto;overflow-x:hidden;transform:translateX(100%);transition:transform .5s cubic-bezier(.16,1,.3,1);-webkit-overflow-scrolling:touch}
.story-modal--open{transform:translateX(0)}
/* No max-width here: the padding below already caps the content column at 1080.
   Adding max-width:1080px made the 50% in the children's calc(50% - 50vw)
   resolve against 1080px instead of the viewport, shifting .car-hero and
   .sm-details off-screen and leaving a dead gap down the right-hand side. */
.story-modal__inner{width:100%;margin:0 auto;padding:0 max(clamp(18px,5vw,56px),calc((100vw - 1080px)/2))}

/* -- Widget (compact floating action pill, replaces the old sticky topbar) --
   Floats over the content instead of taking layout space, so the hero and the
   split-screen body both stay full width. */
.sm-widget{position:fixed;top:24px;right:24px;z-index:1001;display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:100px;background:rgba(242,242,242,.97);border:1px solid var(--eco-border);box-shadow:0 12px 40px rgba(15,30,8,.18);transform:translateY(calc(-100% - 40px));opacity:0;pointer-events:none;transition:transform .5s cubic-bezier(.16,1,.3,1),opacity .3s ease}
.sm-widget--open{transform:translateY(0);opacity:1;pointer-events:auto}
.sm-widget__actions{display:flex;align-items:center;gap:6px}
.sm-widget__btn{width:40px;height:40px;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;font-size:14px;color:var(--eco-text);background:var(--neu-bg);border-radius:50%;box-shadow:4px 4px 9px var(--neu-shadow-dark),-4px -4px 9px var(--neu-shadow-light);transition:all .25s ease;flex-shrink:0}
.sm-widget__btn:hover{color:var(--eco-sage);transform:translateY(-2px)}
.sm-widget__btn--close:hover{color:var(--fiesta-red);transform:rotate(90deg)}
.sm-heart--on{color:var(--fiesta-red) !important}
@media(max-width:899px){
  .sm-widget{top:16px;right:16px;transform:translateY(calc(-100% - 32px))}
  .sm-widget--open{transform:translateY(0)}
}

/* -- Hero -- */
.sm-article{padding:0}
.sm-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:16px}
.sm-tag{display:inline-flex;font-size:11px;font-weight:800;color:var(--eco-sage);padding:6px 14px;border-radius:100px;background:var(--eco-pale);border:1px solid rgba(74,122,40,.15)}
.sm-meta span:not(.sm-tag){font-size:13px;color:var(--eco-muted)}
.sm-title{font-family:var(--font-display);font-weight:900;font-size:clamp(40px,6vw,64px);line-height:.98;color:var(--eco-dark);margin-bottom:8px;letter-spacing:-1px}
.sm-title small{display:block;font-family:var(--font-body);font-weight:600;font-size:14px;color:var(--eco-muted);margin-top:10px;letter-spacing:.03em}

.car-hero{position:relative;height:100vh;height:100svh;min-height:640px;width:100vw;margin-left:calc(50% - 50vw);overflow:hidden;background:var(--eco-sage)}
.car-hero__stage{position:absolute;inset:0;z-index:0;--hero-shift:0px}
.car-hero__slide{position:absolute;inset:0;opacity:0;visibility:hidden;transition:opacity 1s cubic-bezier(.16,1,.3,1);z-index:0;will-change:opacity}
.car-hero__slide.is-active{opacity:1;visibility:visible}
/* Full-bleed cover. The 100vw + negative-margin trick resolves 50% against the
   parent, so .story-modal__inner must stay width:100% for this to actually reach
   the viewport edges. --hero-shift is set on .car-hero__stage by the scroll
   handler, so every slide shares one offset and a slide change can't jump. */
.car-hero__cover{position:absolute;inset:0;background:center/cover no-repeat;transform:translate3d(0,var(--hero-shift),0);will-change:transform}
.car-hero__overlay{position:absolute;inset:0;z-index:1;background:linear-gradient(90deg,rgba(0,0,0,.72) 0%,rgba(0,0,0,.5) 35%,rgba(0,0,0,.22) 55%,rgba(0,0,0,.06) 75%,transparent 100%)}
.car-hero__overlay::after{content:'';position:absolute;left:0;right:0;bottom:0;height:34%;background:linear-gradient(180deg,transparent 0%,rgba(0,0,0,.45) 100%)}
.car-hero__main{position:relative;z-index:10;height:100%;max-width:1440px;margin:0 auto;display:flex;align-items:center;justify-content:flex-start;padding:0 clamp(24px,7vw,100px)}
.car-hero__content{height:100%;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;flex:1 1 auto;min-width:0;max-width:700px}
.car-hero .sm-meta{margin-bottom:18px;animation:fadeInUp 1s cubic-bezier(.16,1,.3,1) .4s both}
.car-hero .sm-tag{color:#fff;background:rgba(255,255,255,.22);border-color:rgba(255,255,255,.25)}
.car-hero .sm-meta span:not(.sm-tag){color:rgba(255,255,255,.8);font-weight:600}
.car-hero .sm-title{color:#fff;font-size:clamp(52px,9vw,92px);font-weight:900;line-height:.95;letter-spacing:-3px;text-shadow:0 8px 40px rgba(0,0,0,.6),0 2px 10px rgba(0,0,0,.4);margin-bottom:18px;animation:countUp 1.2s cubic-bezier(.16,1,.3,1) both}
.car-hero .sm-title small{color:#fff;font-size:14px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;line-height:1.5;text-shadow:0 2px 12px rgba(0,0,0,.6);margin-top:12px}

.sm-hero-stats{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:28px;animation:fadeInUp 1s cubic-bezier(.16,1,.3,1) .55s both}
.sm-hero-stat{display:flex;flex-direction:column;gap:4px;padding:12px 18px;border-radius:var(--eco-radius);background:rgba(20,34,12,0.55);border:1px solid rgba(255,255,255,.2)}
.sm-hero-stars{display:inline-flex;gap:2px;font-size:12px;letter-spacing:1.5px;line-height:1}
.sm-hero-stars .is-on{color:var(--eco-amber)}
.sm-hero-stars .is-empty{color:rgba(255,255,255,.35)}
.sm-hero-stat__val{font-family:var(--font-display);font-weight:900;font-size:22px;color:#fff;line-height:1}
.sm-hero-stat__lbl{font-size:9px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.65)}

.sm-see-more{display:inline-flex;align-items:center;gap:12px;padding:12px 22px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.32);border-radius:100px;color:#fff;font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;font-family:var(--font-body);transition:all .3s ease;animation:fadeInUp 1s cubic-bezier(.16,1,.3,1) .7s both}
.sm-see-more .arrow{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:var(--eco-amber);color:#fff;transition:transform .3s ease}
.sm-see-more:hover{background:rgba(255,255,255,.24);transform:translateY(-2px)}
.sm-see-more:hover .arrow{transform:rotate(90deg)}

.car-hero__dots{position:absolute;bottom:28px;left:clamp(24px,7vw,100px);z-index:11;display:flex;gap:8px}
.car-hero__dot{position:relative;width:9px;height:9px;border-radius:100px;border:none;padding:0;background:rgba(255,255,255,.45);cursor:pointer;transition:all .3s ease}
/* Invisible 41px-tall tap area so the 9px dot stays visually unchanged on mobile */
.car-hero__dot::after{content:'';position:absolute;inset:-16px -10px}
.car-hero__dot.is-active{width:26px;background:#ffd700}
.car-hero__count{position:absolute;bottom:32px;right:clamp(24px,7vw,100px);z-index:12;display:inline-flex;gap:4px;font-family:var(--font-body);font-weight:800;font-size:13px;letter-spacing:2px;color:rgba(255,255,255,.85);font-variant-numeric:tabular-nums}
.car-hero__count span{color:#ffd700}

/* -- Details -- */
.sm-details{animation:smDetailsReveal .5s cubic-bezier(.16,1,.3,1) both;width:100vw;margin-left:calc(50% - 50vw);padding:48px max(clamp(18px,5vw,56px),calc((100vw - 1080px)/2)) 72px;background:linear-gradient(180deg,var(--eco-cream) 0%,#fff 30%,#f6fbf2 100%)}
.sm-split{display:grid;grid-template-columns:1.25fr .75fr;gap:40px;align-items:start;max-width:1080px;margin:0 auto}
.sm-split__main{display:flex;flex-direction:column;gap:6px;min-width:0}
.sm-split__main .sm-body{max-width:none}
.sm-split__aside{min-width:0}
/* No position:sticky here — the column now carries the map, which pushes the
   stack past the viewport height and would pin its lower half out of reach. */
.sm-aside{display:flex;flex-direction:column;gap:20px}
.sm-body{font-size:16px;line-height:1.8;color:var(--eco-text);margin-bottom:24px;text-align:justify}
.sm-body :deep(p){margin-bottom:16px;text-align:justify;text-align-last:left;hyphens:auto}
.sm-body :deep(p:last-child){margin-bottom:0;text-align-last:left}

.sm-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:6px;padding:12px;border-radius:22px;background:var(--neu-bg);box-shadow:inset 6px 6px 14px var(--neu-shadow-dark),inset -6px -6px 14px var(--neu-shadow-light)}
.sm-stat{display:flex;flex-direction:column;gap:4px;padding:16px 12px;text-align:center;background:var(--neu-bg);border-radius:14px;box-shadow:4px 4px 10px var(--neu-shadow-dark),-4px -4px 10px var(--neu-shadow-light)}
.sm-stat__num{font-family:var(--font-display);font-weight:900;font-size:clamp(22px,3vw,30px);color:var(--eco-forest);line-height:1}
.sm-stat__lbl{font-size:9px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:var(--eco-muted);margin-top:4px}

.sm-things{display:flex;flex-direction:column;gap:10px}
.sm-things__item{display:flex;align-items:center;gap:14px;padding:12px 16px;background:var(--neu-bg);border-radius:var(--eco-radius-lg);box-shadow:4px 4px 12px var(--neu-shadow-dark),-4px -4px 12px var(--neu-shadow-light);border:1px solid rgba(0,0,0,.03);transition:transform .35s cubic-bezier(.16,1,.3,1),box-shadow .35s}
.sm-things__item:hover{transform:translateY(-3px);box-shadow:8px 8px 20px rgba(180,180,180,.3),-8px -8px 20px rgba(255,255,255,.9)}
.sm-things__num{font-family:var(--font-display);font-weight:900;font-size:22px;color:var(--eco-amber);min-width:36px;opacity:.85}
.sm-things__thumb{width:56px;height:56px;border-radius:14px;overflow:hidden;flex-shrink:0;box-shadow:var(--eco-shadow-sm)}
.sm-things__thumb img{width:100%;height:100%;object-fit:cover}
.sm-things__icon{width:56px;height:56px;border-radius:14px;background:var(--eco-pale);color:var(--eco-sage);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.sm-things__name{font-family:var(--font-body);font-weight:800;font-size:15px;color:var(--eco-dark);margin:0}

/* ═══ STORY MODAL GALLERY — MASONRY ═══ */
.sm-bento{column-count:3;column-gap:14px}
.sm-bento__item{position:relative;border-radius:var(--eco-radius-lg);overflow:hidden;cursor:pointer;box-shadow:var(--eco-shadow-sm);break-inside:avoid;margin-bottom:14px;transition:transform .35s cubic-bezier(.16,1,.3,1),box-shadow .35s}
.sm-bento__item:hover{transform:translateY(-3px);box-shadow:var(--eco-shadow-lg)}
.sm-bento__item img{width:100%;display:block;object-fit:cover;transition:transform .6s cubic-bezier(.16,1,.3,1)}
.sm-bento__item:hover img{transform:scale(1.04)}
.sm-bento__tile{position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,transparent 35%,rgba(15,30,8,.78) 100%);display:flex;align-items:flex-end;justify-content:flex-start;gap:8px}
.sm-bento__tile-num{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:30px;padding:0 8px;border-radius:100px;background:var(--eco-amber);color:#fff;font-family:var(--font-display);font-weight:900;font-size:12px;line-height:1;margin:0 0 10px 10px}
.sm-bento__tile-caption{color:#fff;font-size:12px;font-weight:700;text-shadow:0 2px 8px rgba(0,0,0,.6);margin:0 0 10px 0;align-self:flex-end}
.sm-bento__item:nth-child(2n){margin-top:22px}
@media(max-width:600px){.sm-bento{column-count:2;column-gap:10px}.sm-bento__item{margin-bottom:10px}.sm-bento__item:nth-child(2n){margin-top:14px}}

.dest-total{position:relative;overflow:hidden;border-radius:var(--eco-radius-xl);background:linear-gradient(135deg,#1e3a0f 0%,#2a5a20 55%,#37702b 100%);padding:44px 28px 40px;text-align:center}
.dest-total::before{content:'';position:absolute;top:-80px;right:-80px;width:240px;height:240px;background:radial-gradient(circle,rgba(242,183,5,.18),transparent 70%);pointer-events:none}
.dest-total::after{content:'';position:absolute;bottom:-70px;left:-70px;width:220px;height:220px;background:radial-gradient(circle,rgba(171,217,4,.14),transparent 70%);pointer-events:none}
.dest-total__inner{position:relative;z-index:1;max-width:520px;margin:0 auto}
.dest-total__kicker{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#ffd76a;margin-bottom:12px;animation:fadeInUp .9s cubic-bezier(.16,1,.3,1) .2s both}
.dest-total__num{display:block;font-size:clamp(64px,14vw,104px);font-weight:900;color:#fff;line-height:.95;letter-spacing:-2px;font-variant-numeric:tabular-nums;text-shadow:0 8px 40px rgba(0,0,0,.4);animation:countUp 1.2s cubic-bezier(.16,1,.3,1) both}
.dest-total__label{display:block;margin-top:14px;font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#f4ffd6;line-height:1.5;animation:fadeInUp 1s cubic-bezier(.16,1,.3,1) .4s both}
.dest-total__src{display:block;margin-top:22px;padding-top:14px;border-top:1px solid rgba(255,255,255,.18);font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.55);animation:fadeInUp 1s cubic-bezier(.16,1,.3,1) .6s both}

.sm-guide{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center;padding:18px;margin:0}
.sm-guide__media{position:relative;width:84px;height:84px;flex-shrink:0}
.sm-guide__media::after{content:'';position:absolute;inset:0;border-radius:var(--eco-radius);box-shadow:inset 0 0 0 2px rgba(255,255,255,.45)}
.sm-guide__media img{width:100%;height:100%;border-radius:var(--eco-radius);object-fit:cover;display:block}
.sm-guide__info{min-width:0}
.sm-guide__info h4{font-family:var(--font-body);font-weight:800;font-size:16px;color:var(--eco-dark);margin-bottom:4px;line-height:1.3}
.sm-guide__info span{font-size:12px;color:var(--eco-muted)}
.sm-guide__info span i{color:var(--eco-amber);margin-right:4px}
.sm-guide__eyebrow{display:block;font-size:9px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:var(--eco-moss);margin-bottom:4px}
.sm-guide__actions{grid-column:1/-1;display:flex;flex-direction:row;flex-wrap:wrap;gap:8px}
.sm-guide__actions .btn{flex:1;justify-content:center;min-width:120px}

.sm-section{margin-bottom:42px}
.sm-section__head{display:flex;align-items:center;gap:12px;margin-bottom:18px}
.sm-section__title{font-family:var(--font-body);font-weight:800;font-size:18px;color:var(--eco-dark);text-transform:uppercase;letter-spacing:1px;display:flex;align-items:center;gap:10px;margin:0}
.sm-section--related{max-width:1080px;margin-left:auto;margin-right:auto;padding-top:28px}
.sm-section--gallery{max-width:1080px;margin-left:auto;margin-right:auto;padding-top:14px}
@media(min-width:900px){.sm-section--related .sm-ranklist{grid-template-columns:1fr 1fr}}
@media(max-width:899px){
  .sm-split{grid-template-columns:1fr;gap:0}
  .sm-split__aside{order:-1;padding-bottom:6px}
  .sm-split__aside .dest-total{padding:28px 22px 26px}
  .sm-section--related .sm-ranklist{grid-template-columns:1fr}
}
@keyframes smDetailsReveal{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:899px){
  .car-hero__main{flex-direction:column;justify-content:center;gap:24px;text-align:left}
  .car-hero__content{align-items:flex-start;justify-content:flex-start;padding-top:96px}
}
@media(max-width:600px){.car-hero{min-height:560px}.car-hero__content{padding:0 6% 0 14%}.car-hero .sm-title{font-size:clamp(42px,13vw,68px);letter-spacing:-2px}.car-hero .sm-title small{font-size:12px;letter-spacing:1.5px}.sm-see-more{gap:10px}.sm-see-more .arrow{width:32px;height:32px;font-size:14px}}
.sm-ranklist{display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:24px}
@media(min-width:600px){.sm-ranklist{grid-template-columns:1fr 1fr}}
.sm-rank{display:flex;align-items:center;gap:12px;padding:10px 12px;border:none;background:var(--eco-pale);border-radius:var(--eco-radius-lg);cursor:pointer;text-align:left;font-family:var(--font-body);box-shadow:var(--eco-shadow-sm);transition:transform .35s cubic-bezier(.16,1,.3,1),box-shadow .35s}
.sm-rank:hover{transform:translateY(-3px);box-shadow:var(--eco-shadow-lg)}
.sm-rank__no{font-family:var(--font-display);font-size:26px;font-weight:900;color:var(--eco-amber);line-height:1;min-width:30px;opacity:.85}
.sm-rank__thumb{width:60px;height:60px;border-radius:12px;overflow:hidden;flex-shrink:0}
.sm-rank__thumb img{width:100%;height:100%;object-fit:cover}
.sm-rank__name{flex:1;font-weight:800;font-size:14px;color:var(--eco-dark);line-height:1.25}
.sm-rank__name small{display:block;font-size:11px;font-weight:600;color:var(--eco-muted);margin-top:2px}
.sm-rank__meta{font-size:11px;font-weight:700;color:var(--eco-moss)}
.sm-rank__arrow{color:var(--eco-moss);transition:transform .3s ease}
.sm-rank:hover .sm-rank__arrow{transform:translateX(3px)}

/* ═══ STORY MODAL — DESTINATION MAP CARD ═══ */
.sm-section--map{margin-bottom:0;padding-top:0}
.sm-map-card{padding:16px;display:flex;flex-direction:column;gap:14px}
.sm-map-canvas{width:100%;height:260px;border-radius:var(--eco-radius);z-index:0;box-shadow:var(--eco-shadow-sm);background:var(--eco-pale)}
.sm-map-info{display:flex;flex-direction:column;gap:12px}
.sm-map-coord{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--eco-forest);font-family:ui-monospace,Menlo,Consolas,monospace;background:var(--eco-pale);border-radius:100px;padding:8px 16px;width:fit-content}
.sm-map-coord i{color:var(--eco-moss)}
.sm-map-actions{display:flex;flex-wrap:wrap;gap:10px}
.sm-map-btn{display:inline-flex;align-items:center;gap:9px;padding:12px 22px;border-radius:100px;font-family:var(--font-body);font-weight:800;font-size:13px;text-decoration:none;cursor:pointer;border:none;transition:all .3s}
.sm-map-btn--ghost{background:var(--eco-pale);color:var(--eco-forest);border:1px solid rgba(74,122,40,.25)}
.sm-map-btn--ghost:hover{background:var(--eco-moss);color:#fff;transform:translateY(-2px)}
.sm-map-btn--ghost:disabled{opacity:.6;cursor:wait;transform:none}
.sm-map-btn--google{background:linear-gradient(135deg,#4285F4,#1a73e8);color:#fff;box-shadow:0 6px 18px rgba(66,133,244,.3)}
.sm-map-btn--google:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(66,133,244,.45)}
.sm-map-distance{display:flex;align-items:center;flex-wrap:wrap;gap:8px;font-size:14px;color:var(--eco-text);background:linear-gradient(135deg,rgba(171,217,4,.12),rgba(74,122,40,.08));border:1px dashed rgba(74,122,40,.3);border-radius:var(--eco-radius);padding:12px 16px}
.sm-map-distance i{color:var(--eco-moss)}
.sm-map-distance strong{color:var(--eco-forest);font-size:16px}
.sm-map-distance small{color:var(--eco-muted);font-size:11px;width:100%}
.sm-map-error{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--fiesta-red-deep)}
.sm-map-card--empty{align-items:center;text-align:center;padding:36px 20px;gap:12px}
.sm-map-card--empty i{font-size:2rem;color:var(--eco-muted)}
.sm-map-card--empty p{font-size:14px;color:var(--eco-soft);margin:0}
@media(max-width:600px){
  .sm-map-canvas{height:260px}
  .sm-map-actions .sm-map-btn{flex:1;justify-content:center;min-width:140px}
}

/* ═══ BACO TOURIST ARRIVALS ═══ */
.section-wrapper{width:100%;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;align-items:stretch}

/* HERO SECTION */
.hero-section{position:relative;width:100%;min-height:640px;overflow:hidden;background:#2a5a20}
.hero-bg-image{position:absolute;top:-15%;left:0;right:0;height:130%;z-index:0;background:url('https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=960&h=640&fit=crop&crop=center') center/cover no-repeat;will-change:transform}
.hero-overlay{position:absolute;inset:0;background:transparent;z-index:1}
.hero-content{position:relative;z-index:10;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:50px;height:100%}
.hero-number{font-size:130px;font-weight:900;color:#fff;line-height:1;letter-spacing:-4px;text-shadow:0 6px 30px rgba(0,0,0,.5),0 2px 8px rgba(0,0,0,.3);margin-bottom:16px;font-variant-numeric:tabular-nums}
.hero-subtitle{text-align:center;color:#fff;font-size:15px;font-weight:800;letter-spacing:3px;text-transform:uppercase;line-height:1.7;text-shadow:0 2px 12px rgba(0,0,0,.5)}
.hero-subtitle .date-line{font-size:11px;font-weight:700;letter-spacing:2px;opacity:.9;margin-top:2px}
.hero-bottom{position:absolute;bottom:0;left:0;right:0;z-index:10;background:rgba(255,255,255,.97);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(0,0,0,.06)}
.hero-logos{display:flex;align-items:center;gap:10px}
.logo-love-ph{background:linear-gradient(135deg,#1a7a3a,#2d9f5e);color:#fff;font-size:9px;font-weight:900;padding:7px 14px;border-radius:8px;letter-spacing:.5px;line-height:1.3;box-shadow:0 2px 8px rgba(26,122,58,.3)}
.logo-love-ph .love-text{font-size:14px;display:block;letter-spacing:1px}
.logo-love-ph .ph-text{font-size:8px;display:block;opacity:.9;letter-spacing:1.5px}
.logo-baco{background:linear-gradient(135deg,#e85d26,#f5a623);color:#fff;font-size:9px;font-weight:900;padding:7px 14px;border-radius:8px;letter-spacing:.5px;line-height:1.3;box-shadow:0 2px 8px rgba(232,93,38,.3)}
.logo-baco .baco-text{font-size:16px;display:block;letter-spacing:2px}
.logo-baco .baco-sub{font-size:7px;display:block;opacity:.9;letter-spacing:1px;font-weight:700}
.logo-manilite{background:linear-gradient(135deg,#1a237e,#283593);color:#fff;font-size:9px;font-weight:900;padding:7px 12px;border-radius:8px;letter-spacing:1px;box-shadow:0 2px 8px rgba(26,35,126,.3)}
.logo-manilite .mani-icon{font-size:14px;display:block;text-align:center}
.logo-manilite .mani-text{font-size:8px;display:block;letter-spacing:1px}
.hero-photo-credit{font-size:9px;color:#888;font-weight:700;letter-spacing:.8px;text-transform:uppercase}
.hero-photo-credit::before{content:'📷 '}

/* TOP 5 SECTION */
.top5-section{position:relative;width:100%;min-height:700px;overflow:hidden}
.top5-bg-image{position:absolute;top:-15%;left:0;right:0;height:130%;z-index:0;background:url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=960&h=700&fit=crop&crop=center') center/cover no-repeat;will-change:transform}
.top5-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(212,168,67,.3) 0%,rgba(224,188,85,.2) 15%,rgba(232,204,112,.12) 30%,rgba(240,218,138,.06) 45%,rgba(200,192,96,.12) 55%,rgba(160,176,80,.22) 65%,rgba(128,152,64,.32) 75%,rgba(96,128,48,.42) 85%,rgba(64,96,32,.52) 95%,rgba(53,80,24,.62) 100%);z-index:1}
.top5-content{position:relative;z-index:10;padding:45px 50px 90px}
.top5-title{text-align:center;font-size:40px;font-weight:900;color:#1e3a0f;line-height:1.1;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;text-shadow:0 1px 6px rgba(255,255,255,.3)}
.top5-subtitle{text-align:center;font-size:11px;font-weight:800;color:#2a4a18;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px}
.top5-source{text-align:center;font-size:10px;font-weight:700;color:#4a6a30;letter-spacing:.8px;margin-bottom:35px}
.top5-list{max-width:620px;margin:0 auto;display:flex;flex-direction:column;gap:6px}
.top5-item{display:flex;align-items:center;padding:14px 22px;border-radius:10px;transition:all .3s cubic-bezier(.4,0,.2,1);cursor:default}
.top5-item:hover{transform:translateX(6px);box-shadow:0 4px 20px rgba(0,0,0,.1)}
.top5-item.rank-1{background:rgba(255,235,59,.92);box-shadow:0 2px 16px rgba(200,180,0,.35)}
.top5-item.rank-2,.top5-item.rank-3,.top5-item.rank-4,.top5-item.rank-5{background:rgba(20,34,12,0.55);border:1px solid rgba(255,255,255,.15)}
.top5-item.rank-1:hover{background:rgba(255,235,59,1)}
.top5-item.rank-2:hover,.top5-item.rank-3:hover,.top5-item.rank-4:hover,.top5-item.rank-5:hover{background:rgba(255,255,255,.28)}
.rank-number{font-size:24px;font-weight:900;color:#1e3a0f;min-width:32px;margin-right:14px;opacity:.7}
.rank-number::after{content:'|';margin-left:10px;opacity:.3;font-weight:400}
.rank-name{flex:1;font-size:17px;font-weight:800;color:#1e3a0f;text-transform:uppercase;letter-spacing:1.2px;line-height:1.3}
.rank-name small{display:block;font-size:12px;font-weight:700;opacity:.75;margin-top:2px;letter-spacing:.8px}
.rank-count{font-size:40px;font-weight:900;color:#1e3a0f;min-width:110px;text-align:right;text-shadow:0 1px 4px rgba(255,255,255,.4);font-variant-numeric:tabular-nums}
.top5-item.rank-1 .rank-count{color:#1a3a0a}
.top5-bottom{position:absolute;bottom:0;left:0;right:0;z-index:10;background:rgba(255,255,255,.97);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(0,0,0,.06)}

/* ANIMATIONS */
@keyframes fadeInUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
@keyframes countUp{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
@keyframes slideInLeft{from{opacity:0;transform:translateX(-30px)}to{opacity:1;transform:translateX(0)}}
.hero-number{animation:countUp 1.2s cubic-bezier(.16,1,.3,1) both}
.hero-subtitle{animation:fadeInUp 1s cubic-bezier(.16,1,.3,1) .4s both}
.top5-title{animation:fadeInUp 1s cubic-bezier(.16,1,.3,1) .2s both}
.top5-subtitle,.top5-source{animation:fadeInUp .8s cubic-bezier(.16,1,.3,1) .4s both}
.top5-item{opacity:0;animation:slideInLeft .7s cubic-bezier(.16,1,.3,1) both}
.top5-item:nth-child(1){animation-delay:.5s}
.top5-item:nth-child(2){animation-delay:.65s}
.top5-item:nth-child(3){animation-delay:.8s}
.top5-item:nth-child(4){animation-delay:.95s}
.top5-item:nth-child(5){animation-delay:1.1s}

/* RESPONSIVE */
@media (max-width:768px){
  .section-wrapper{display:block;grid-template-columns:none}
  .hero-number{font-size:80px;letter-spacing:-2px}
  .hero-section{height:480px}
  .top5-title{font-size:28px}
  .rank-count{font-size:30px;min-width:80px}
  .rank-name{font-size:14px}
  .top5-content{padding:30px 20px 90px}
  .hero-bottom,.top5-bottom{flex-direction:column;gap:10px;text-align:center;padding:12px 16px}
  .hero-logos{flex-wrap:wrap;justify-content:center}
}
@media (max-width:480px){
  .hero-number{font-size:60px}
  .top5-title{font-size:22px}
  .rank-count{font-size:24px;min-width:65px}
  .rank-name{font-size:12px}
  .rank-number{font-size:18px;min-width:24px}
  .top5-item{padding:10px 14px}
}

/* ═══ STORY MODAL CONTACT / GALLERY ═══ */
.sm-contact{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:28px}
.sm-chip{display:inline-flex;align-items:center;gap:8px;font-family:var(--font-body);font-weight:800;font-size:13px;color:var(--eco-moss);background:var(--eco-pale);padding:12px 20px;border-radius:100px;transition:all .3s}
.sm-chip i{font-size:12px;color:var(--eco-moss)}
.sm-chip:hover{transform:translateY(-2px);box-shadow:var(--eco-shadow-sm)}
.sm-chip--fb{color:var(--fiesta-blue-deep);background:var(--fiesta-blue-light)}
.sm-chip--fb i{color:var(--fiesta-blue-deep)}

/* ═══ MODAL TRANSITIONS ═══ */
.mfade-enter-active{transition:opacity .3s ease}
.mfade-leave-active{transition:opacity .25s ease}
.mfade-enter-from,.mfade-leave-to{opacity:0}

/* ═══ TOASTS ═══ */
.toast-stack{position:fixed;bottom:24px;right:24px;z-index:2000;display:flex;flex-direction:column;gap:8px}
.toast{display:flex;align-items:center;gap:10px;padding:14px 22px;font-family:var(--font-body);font-weight:700;font-size:13px;color:var(--eco-moss)}
.toast-enter-active{transition:all .4s cubic-bezier(.16,1,.3,1)}
.toast-leave-active{transition:all .3s ease}
.toast-enter-from{opacity:0;transform:translateX(40px) scale(0.9)}
.toast-leave-to{opacity:0;transform:translateX(40px) scale(0.9)}

/* ═══ MOBILE ENHANCEMENTS ═══ */
@media(max-width:480px){
  .container{padding:0 16px}
}
@media(max-width:600px){
  .hero{min-height:100svh}
  .hero__heading{font-size:clamp(42px,13vw,64px);line-height:0.95}
  .hero__content{padding:0 16px}
  .hero__label{font-size:11px;padding:7px 18px}
  .mapsec__head{flex-direction:column;align-items:flex-start}
  .mapsec__hint{font-size:12px}
  .halcon__stats{grid-template-columns:repeat(2,1fr);gap:8px}
  .halcon__stat{padding:16px 10px}
  .halcon__stat span{font-size:18px}
  .sm-stats{grid-template-columns:repeat(2,1fr)}

  /* These two lists were one full-width row per item, so a destination with
     8 activities became a very long scroll. 2-up compact tiles instead.
     Selector specificity must match .sm-section--related .sm-ranklist at
     line 2142, otherwise that rule wins and the grid stays 1-up. */
  .sm-things{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
  .sm-things__item{flex-direction:column;align-items:stretch;gap:5px;padding:9px 10px}
  .sm-things__num{font-size:14px;min-width:0}
  .sm-things__thumb,.sm-things__icon{width:100%;height:76px;border-radius:10px;font-size:16px}
  .sm-things__name{font-size:12px;line-height:1.3}

  .sm-section--related .sm-ranklist{grid-template-columns:repeat(2,1fr);gap:8px}
  .sm-rank{flex-direction:column;align-items:stretch;gap:5px;padding:9px 10px}
  .sm-rank__no{font-size:15px;min-width:0}
  .sm-rank__thumb{width:100%;height:72px;border-radius:10px}
  .sm-rank__name{font-size:12px}
  .sm-rank__name small{font-size:10px;margin-top:1px}
  .sm-rank__meta{font-size:10px}
  .sm-rank__arrow{display:none}

  .sm-chip{font-size:11.5px;padding:10px 14px;gap:6px}
  .halcon__trail li{flex-direction:column;align-items:flex-start;gap:2px;padding:8px 0;border-bottom:1px dashed rgba(255,255,255,0.08)}
  .halcon__trail li:last-child{border-bottom:none}
  .halcon__cta-row{flex-direction:column}
  .halcon__cta-row>*{width:100%;justify-content:center}
  .flip-container,.flipper{min-height:640px}

  .story-modal__inner{padding:0 16px}
  .sm-article{padding:0 0 48px}
  .sm-title{font-size:clamp(32px,11vw,44px)}

  .car-hero__content{justify-content:flex-end;padding:0 20px 84px}
  .car-hero__main{align-items:flex-end;padding:0 16px}
  .car-hero__dots{bottom:20px;left:16px}
  .car-hero__count{bottom:22px;right:16px}
  .car-hero .sm-meta{gap:6px;margin-bottom:10px}
  .car-hero .sm-meta span:not(.sm-tag){font-size:11px}
  .car-hero .sm-tag{font-size:10px;padding:4px 10px}
  .car-hero .sm-title{font-size:clamp(28px,8.5vw,38px);letter-spacing:-1px;margin-bottom:12px}
  .car-hero .sm-title small{font-size:11px;letter-spacing:.8px;margin-top:6px}
  .sm-hero-stats{gap:8px;margin-bottom:14px}
  .sm-hero-stat{gap:2px;padding:8px 12px}
  .sm-hero-stat__val{font-size:17px}
  .sm-hero-stat__lbl{font-size:8px;letter-spacing:.6px}
  .sm-hero-stars{font-size:10px;letter-spacing:.8px}
  .sm-see-more{gap:8px;padding:9px 16px;font-size:11.5px;letter-spacing:.8px}
  .sm-see-more .arrow{width:24px;height:24px;font-size:12px}
  .car-hero__dot{width:7px;height:7px}
  .car-hero__dot::after{inset:-17px -12px}
  .car-hero__dot.is-active{width:20px}
  .car-hero__count{font-size:11px;letter-spacing:1px}
  .sm-tag{font-size:10px;padding:5px 11px}
  .sm-stats{gap:8px;padding:9px;border-radius:18px}
  .sm-stat{padding:10px 6px}
  .sm-stat__num{font-size:18px}
  .sm-stat__lbl{letter-spacing:.3px}
  .sm-guide{gap:10px;padding:12px}
  .sm-guide__media{width:58px;height:58px}
  .sm-chip{font-size:12px;padding:10px 16px}

  .halcon-modal__scroll{gap:8px}
  .halcon__gallery{gap:6px}
  .halcon__gallery img{height:64px}
  .halcon__elev{padding:8px 12px}
  .halcon__elev-num{font-size:22px}
  .halcon__stats{gap:6px;margin-bottom:12px}
  .halcon__stat{padding:9px 5px}
  .halcon__stat span{font-size:16px}
  .halcon__stat small{font-size:9px;letter-spacing:.06em;margin-top:3px}
  .halcon__facts,.halcon__reqs,.halcon__sources{padding:12px}
  .halcon__facts-grid{gap:6px 10px}
  .halcon__reqs ul,.halcon__sources{gap:6px}
  .halcon__trail{padding:12px;margin-bottom:12px}
  .halcon__trail ul{gap:4px}
  .halcon__trail li{padding:6px 0}
  .halcon__hazards{gap:6px}
  .halcon__hazard{padding:10px 12px}
  .halcon__cta-row{gap:8px}
  .halcon__more-toggle,.halcon__book-btn{padding:12px 20px}

  .toast-stack{left:16px;right:16px;bottom:16px;align-items:center}
  .toast{width:100%;justify-content:center;text-align:center}
}
@media(max-width:360px){
  .hero__heading{font-size:40px}
  .halcon__elev-num{font-size:26px}
  .sm-things__thumb,.sm-things__icon{height:62px}
  .sm-rank__thumb{height:60px}
  .sm-things,.sm-section--related .sm-ranklist{gap:6px}
  .sm-guide__media{width:52px;height:52px}
  .sm-stat{padding:8px 4px}
  .halcon__gallery img{height:54px}
  .halcon__stat{padding:8px 4px}
}

/* ═══ WEATHER WIDGET ═══ */
.weather-widget{position:fixed;left:24px;bottom:24px;z-index:900;display:flex;flex-direction:column;align-items:flex-start;gap:10px}
.weather-widget--moved{bottom:auto}
.weather-widget__toggle{display:flex;align-items:center;gap:10px;padding:12px 18px;border:none;cursor:grab;border-radius:100px;background:linear-gradient(135deg,var(--eco-forest),var(--eco-moss));color:#fff;font-family:var(--font-body);font-weight:800;font-size:14px;box-shadow:0 10px 30px rgba(15,43,10,0.35);border:1px solid rgba(171,217,4,0.25);transition:all .3s;touch-action:none;user-select:none;-webkit-user-select:none}
.weather-widget__toggle:active{cursor:grabbing}
.weather-widget__toggle:hover{transform:translateY(-3px);box-shadow:0 14px 36px rgba(15,43,10,0.45)}
.weather-widget__toggle i{font-size:15px;color:var(--eco-mint);pointer-events:none}
.weather-widget__chev{font-size:11px !important;color:rgba(255,255,255,0.65);transition:transform .3s;margin-left:2px}
.weather-widget__temp{font-variant-numeric:tabular-nums}
.weather-widget__panel{width:240px;padding:16px;border-radius:18px;background:rgba(15,43,10,0.96);border:1px solid rgba(171,217,4,0.18);box-shadow:0 16px 40px rgba(0,0,0,0.25);color:#fff;font-family:var(--font-body);display:none}
.weather-widget--open .weather-widget__panel{display:block}
.weather-widget__loading{display:flex;align-items:center;justify-content:center;gap:8px;font-size:12px;color:rgba(255,255,255,0.7);padding:8px}
.weather-widget__head{display:flex;flex-direction:column;gap:2px;margin-bottom:12px}
.weather-widget__place{font-size:13px;font-weight:800;letter-spacing:0.02em;color:var(--eco-mint)}
.weather-widget__cond{font-size:11px;color:rgba(255,255,255,0.7);display:flex;align-items:center;gap:6px}
.weather-widget__now{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px}
.weather-widget__big{font-weight:900;font-size:34px;line-height:1;font-variant-numeric:tabular-nums}
.weather-widget__feels{font-size:11px;color:rgba(255,255,255,0.6)}
.weather-widget__extra{display:flex;justify-content:space-between;gap:8px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.12);font-size:12px;color:rgba(255,255,255,0.85)}
.weather-widget__extra i{color:var(--eco-amber);margin-right:4px}
@media(max-width:640px){
  .weather-widget{left:16px;bottom:76px}
  .weather-widget--moved{bottom:auto}
}
</style>
