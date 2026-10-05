<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'


const props = defineProps({
  eyebrow:   { type: String, default: 'By the Numbers' },
  title:     { type: String, default: 'Baco at a Glance' },
  isEditing: { type: Boolean, default: false },
  useApi:    { type: Boolean, default: true },
  stats: {
    type: Array,
    default: () => [
      { key: 'barangays',  label: 'Barangays',       value: 27,    icon: 'fa-solid fa-map' },
      { key: 'population', label: 'Population',      value: 41417, icon: 'fa-solid fa-users' },
      { key: 'households', label: 'Households',      value: 8450,  icon: 'fa-solid fa-house-chimney' },
      { key: 'land_area',  label: 'Land Area (km²)', value: 216,   icon: 'fa-solid fa-ruler-combined' }
    ]
  }
})

const liveData = ref(null)
const rootEl   = ref(null)

const shownEyebrow = computed(() =>
  (props.isEditing || !liveData.value) ? props.eyebrow : (liveData.value.eyebrow || props.eyebrow))
const shownTitle = computed(() =>
  (props.isEditing || !liveData.value) ? props.title : (liveData.value.title || props.title))
const shownStats = computed(() => {
  if (props.isEditing) return props.stats
  const s = liveData.value?.stats
  return (Array.isArray(s) && s.length) ? s : props.stats
})

const titleWords  = computed(() => String(shownTitle.value || '').trim().split(/\s+/).filter(Boolean))
const titleLead   = computed(() => titleWords.value.length > 1 ? titleWords.value.slice(0, -1).join(' ') : (shownTitle.value || ''))
const titleAccent = computed(() => titleWords.value.length ? titleWords.value[titleWords.value.length - 1] : '')

const numberFmt = new Intl.NumberFormat('en-US')
const formatDisplay = (s) => {
  if (s.display) return s.display
  const n = Number(s.value)
  return Number.isFinite(n) ? numberFmt.format(n) : String(s.value ?? '')
}
const counterTarget = (s) => {
  const n = Number(s.value)
  return Number.isFinite(n) ? Math.round(n) : 0
}

async function loadStats () {
  try {
    const res = await fetch('/api/stats/home', { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data && Array.isArray(data.stats) && data.stats.length) liveData.value = data
  } catch (e) { /* backend not ready → props fallback stays */ }
}

let revealIO = null
let counterIO = null

function animateCounter (el) {
  const target   = parseInt(el.dataset.target, 10) || 0
  const hasComma = (el.dataset.display || '').includes(',')
  const duration = 1800
  const start    = performance.now()
  const frame = (now) => {
    const pct  = Math.min((now - start) / duration, 1)
    const ease = 1 - Math.pow(1 - pct, 3)
    const val  = Math.round(ease * target)
    el.textContent = hasComma ? val.toLocaleString('en-US') : String(val)
    if (pct < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

function bindObservers () {
  if (revealIO) revealIO.disconnect()
  if (counterIO) counterIO.disconnect()
  if (!rootEl.value) return

  revealIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('active'); revealIO.unobserve(e.target) }
    })
  }, { threshold: 0.15 })
  rootEl.value.querySelectorAll('.reveal').forEach(el => revealIO.observe(el))

  counterIO = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return
      animateCounter(e.target)
      counterIO.unobserve(e.target)
    })
  }, { threshold: 0.5 })
  rootEl.value.querySelectorAll('.st-val-num[data-target]').forEach(el => counterIO.observe(el))
}

watch(shownStats, () => nextTick(bindObservers), { deep: true })

let onScroll = null
let ticking = false

function attachParallax () {
  const decos = rootEl.value ? Array.from(rootEl.value.querySelectorAll('.st-deco-para')) : []
  onScroll = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      const sy = window.scrollY
      decos.forEach(el => {
        const speed = parseFloat(el.dataset.speed) || 0.1
        el.style.transform = 'translateY(' + (sy * speed) + 'px)'
      })
      ticking = false
    })
  }
  window.addEventListener('scroll', onScroll, { passive: true })
}

onMounted(() => {
  attachParallax()
  bindObservers()
  if (props.useApi && !props.isEditing) loadStats()
})

onBeforeUnmount(() => {
  if (onScroll) window.removeEventListener('scroll', onScroll)
  if (revealIO) revealIO.disconnect()
  if (counterIO) counterIO.disconnect()
})
</script>

<template>
  <section ref="rootEl" class="st">
    <div v-if="isEditing" class="editor-mode-badge">📊 Statistics</div>

    <div class="st-deco-para st-ring-1" data-speed="0.15" aria-hidden="true"></div>
    <div class="st-deco-para st-blob-1" data-speed="-0.08" aria-hidden="true"></div>
    <div class="st-deco-para st-dot-1" data-speed="0.35" aria-hidden="true"></div>
    <div class="st-deco-para st-dot-2" data-speed="0.28" aria-hidden="true"></div>
    <div class="st-deco-para st-dot-3" data-speed="0.45" aria-hidden="true"></div>

    <div class="st-inner">
      <div class="st-header reveal">
        <p class="st-eyebrow">{{ shownEyebrow }}</p>
        <h2 class="st-title">{{ titleLead }} <em>{{ titleAccent }}</em></h2>
      </div>

      <div class="st-grid">
        <div
          v-for="(stat, i) in shownStats"
          :key="stat.key || i"
          class="stat-card reveal"
          :style="{ '--d': (i * 0.08) + 's' }"
        >
          <div class="stat-icon-wrap">
            <i :class="stat.icon" class="stat-icon"></i>
          </div>
          <span class="st-val">
            <span
              class="st-val-num"
              :data-target="counterTarget(stat)"
              :data-display="formatDisplay(stat)"
            >{{ formatDisplay(stat) }}</span><span v-if="stat.suffix" class="st-suffix">{{ stat.suffix }}</span>
          </span>
          <span class="stat-label">{{ stat.label }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.st {
  position: relative;
  background: linear-gradient(135deg, #0B198F 0%, #050f4d 100%);
  padding: 100px 0 100px;
  overflow: hidden;
  z-index: 10;
}

.st-ring-1 {
  position: absolute;
  width: 340px; height: 340px;
  border: 10px solid rgba(255,255,255,0.05);
  border-radius: 50%;
  top: 20px; left: 40px;
  pointer-events: none;
  will-change: transform;
}

.st-blob-1 {
  position: absolute;
  width: 200px; height: 200px;
  background: rgba(255,255,255,0.06);
  border-radius: 50%;
  filter: blur(20px);
  bottom: 30px; right: 60px;
  pointer-events: none;
  will-change: transform;
}

.st-dot-1, .st-dot-2, .st-dot-3 {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  will-change: transform;
}
.st-dot-1 { width: 8px;  height: 8px;  background: rgba(255,255,255,0.22); top: 80px;     right: 28%; }
.st-dot-2 { width: 12px; height: 12px; background: rgba(255,255,255,0.14); bottom: 120px; left: 25%; }
.st-dot-3 { width: 6px;  height: 6px;  background: rgba(206,17,38,0.5);   top: 45%;       left: 80px; }

.st-inner {
  position: relative;
  z-index: 1;
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 2rem;
  text-align: center;
}

.st-header { margin-bottom: 56px; }

.st-eyebrow {
  font-family: 'Inter', sans-serif;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  margin: 0 0 12px;
}

.st-title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(1.9rem, 3.5vw, 2.8rem);
  font-weight: 900;
  color: white;
  letter-spacing: -0.025em;
  margin: 0;
  line-height: 1.1;
}

.st-title em { font-style: italic; color: rgba(255,255,255,0.55); }

.st-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
}

.stat-card {
  background: rgba(255,255,255,0.08);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 22px;
  padding: 36px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  transition: background 0.3s, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s;
}

.stat-card:hover {
  background: rgba(255,255,255,0.14);
  transform: translateY(-6px);
  box-shadow: 0 24px 48px rgba(0,0,0,0.2);
}

.stat-icon-wrap {
  width: 52px; height: 52px;
  background: rgba(255,255,255,0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.3s, transform 0.3s;
}

.stat-card:hover .stat-icon-wrap {
  background: rgba(255,255,255,0.18);
  transform: scale(1.08);
}

.stat-icon {
  font-size: 1.2rem;
  color: rgba(255,255,255,0.75);
}

.st-val {
  font-family: 'Playfair Display', serif;
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 900;
  color: white;
  line-height: 1;
  letter-spacing: -0.02em;
}

.st-suffix {
  font-size: 0.45em;
  font-weight: 700;
  color: rgba(255,255,255,0.6);
  margin-left: 2px;
}

.stat-label {
  font-family: 'Inter', sans-serif;
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
}

.reveal {
  opacity: 0;
  transform: translateY(26px);
  transition: opacity 0.75s cubic-bezier(0.16, 1, 0.3, 1), transform 0.75s cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: var(--d, 0s);
}
.reveal.active { opacity: 1; transform: none; }

.editor-mode-badge {
  position: absolute;
  top: 20px; left: 20px;
  background: rgba(15, 23, 42, 0.85);
  color: #38bdf8;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  font-family: 'Inter', sans-serif;
  z-index: 50;
  pointer-events: none;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(56, 189, 248, 0.3);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

@media (max-width: 960px) {
  .st-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 540px) {
  .st { padding: 60px 0; }
  .st-inner { padding: 0 1.25rem; }
  .st-grid { grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
  .stat-card { padding: 18px 12px; gap: 8px; }
  .st-val { font-size: 1.7rem; }
  .stat-label { font-size: 0.58rem; letter-spacing: 0.08em; }
}
</style>