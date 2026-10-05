<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Lenis from 'lenis'
import { animate } from '@motionone/dom'

const API_BASE = 'http://localhost:3000/api'

const charterData = ref(null)
const loading = ref(true)
const error = ref(null)
const zoom = ref(100)

const fetchCharter = async () => {
  loading.value = true
  error.value = null
  try {
    const res = await fetch(`${API_BASE}/citizens-charter`)
    const data = await res.json()
    charterData.value = data
  } catch (err) {
    console.error('Failed to fetch charter:', err)
    error.value = 'Failed to load Citizens Charter. Please try again later.'
  } finally {
    loading.value = false
  }
}

const zoomIn = () => { if (zoom.value < 150) zoom.value += 10 }
const zoomOut = () => { if (zoom.value > 60) zoom.value -= 10 }
const resetZoom = () => { zoom.value = 100 }

const doPrint = () => {
  const iframe = document.querySelector('.pdf-frame')
  if (iframe) {
    iframe.contentWindow.print()
  } else {
    window.print()
  }
}

const downloadPdf = () => {
  if (charterData.value?.pdfUrl) {
    const link = document.createElement('a')
    link.href = charterData.value.pdfUrl
    link.download = charterData.value.originalName || 'Citizens_Charter.pdf'
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

const formatFileSize = (bytes) => {
  if (!bytes) return ''
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

let lenis = null

onMounted(() => {
  lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 0.9,
  })
  const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf) }
  requestAnimationFrame(raf)

  animate('.charter-hero .hero-eyebrow', { opacity: [0, 1], transform: ['translateY(20px)', 'translateY(0px)'] }, { duration: 0.65, delay: 0.1, easing: [0.16, 1, 0.3, 1] })
  animate('.charter-hero .hero-title', { opacity: [0, 1], transform: ['translateY(28px)', 'translateY(0px)'] }, { duration: 0.75, delay: 0.2, easing: [0.16, 1, 0.3, 1] })
  animate('.charter-hero .hero-sub', { opacity: [0, 1], transform: ['translateY(20px)', 'translateY(0px)'] }, { duration: 0.65, delay: 0.32, easing: [0.16, 1, 0.3, 1] })

  fetchCharter()
})

onUnmounted(() => {
  lenis?.destroy()
})
</script>

<template>
  <div class="charter-page">

    <!-- HERO -->
    <section class="charter-hero">
      <div class="hero-bg"></div>
      <div class="hero-grid-overlay"></div>
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <div class="hero-eyebrow">
          <span class="eyebrow-line"></span>
          Municipality of Baco
          <span class="eyebrow-line"></span>
        </div>
        <h1 class="hero-title">Citizen's <em>Charter</em><span class="period">.</span></h1>
        <p class="hero-sub">Our commitment to transparent, efficient, and accessible public service for every Bacoeño.</p>
        <div class="hero-badges">
        </div>
      </div>
    </section>


    <!-- PDF VIEWER -->
    <div class="pdf-viewer-container">

      <!-- Loading -->
      <div v-if="loading" class="state-box loading-state">
        <div class="state-icon"><i class="fas fa-spinner fa-spin"></i></div>
        <p>Loading Citizens Charter...</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="state-box error-state">
        <div class="state-icon"><i class="fas fa-exclamation-triangle"></i></div>
        <h3>{{ error }}</h3>
        <button class="action-btn" @click="fetchCharter"><i class="fas fa-redo"></i> Try Again</button>
      </div>

      <!-- No Charter -->
      <div v-else-if="!charterData?.exists" class="state-box empty-state">
        <div class="state-icon"><i class="fas fa-file-circle-question"></i></div>
        <h3>Citizens Charter Not Yet Available</h3>
        <p>The document is currently being prepared. Please check back soon or contact the Municipal Hall for inquiries.</p>
      </div>

      <!-- PDF Ready -->
      <div v-else class="pdf-display">

      
        <!-- PDF Frame -->
        <div class="pdf-frame-wrap" :style="{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }">
          <iframe
            :src="charterData.pdfUrl"
            class="pdf-frame"
            frameborder="0"
            allowfullscreen
          ></iframe>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* same font stack as History.vue */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

/* ═══════════════════════════════════════════
   TOKENS — identical to History.vue
   ═══════════════════════════════════════════ */
.charter-page {
  --white:     #FFFFFF;
  --surface:   #F5F6F8;
  --border:    #E3E5EA;
  --navy:      #000c7b;
  --navy-deep: #07115E;
  --red:       #970718;
  --ink:       #111827;
  --ink-body:  #3D4451;
  --ink-muted: #6B7280;
  --ink-faint: #A0A9B8;
  --gutter:    clamp(20px, 5vw, 80px);
  --max-w:     1140px;
  --r:         4px;
  --sh-1: 0 1px 2px rgba(7,17,94,0.05), 0 10px 28px rgba(7,17,94,0.07);
  --sh-2: 0 18px 50px rgba(7,17,94,0.16), 0 4px 12px rgba(7,17,94,0.06);
  --ease: cubic-bezier(0.16, 1, 0.3, 1);

  font-family: 'DM Sans', sans-serif;
  background: var(--white);
  color: var(--ink);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.charter-page *,
.charter-page *::before,
.charter-page *::after { box-sizing: border-box; margin: 0; padding: 0; }

.charter-page ::selection { background: var(--navy); color: #fff; }
.charter-page :focus-visible { outline: 2px solid var(--red); outline-offset: 3px; border-radius: 3px; }

/* ═══════════════════════════════════════════
   HERO — same size & treatment as History.vue
   ═══════════════════════════════════════════ */
.charter-hero {
  position: relative;
  height: 68vh;
  height: 68svh;
  min-height: 460px;
  max-height: 640px;
  overflow: hidden;
  background: var(--navy-deep);
}

.hero-bg {
  position: absolute; inset: 0;
  background: url('/images/hero-imgs.jpg') center 35% / cover no-repeat;
  filter: grayscale(25%) brightness(0.45);
  will-change: transform;
  animation: heroDrift 26s ease-in-out infinite alternate;
}
@keyframes heroDrift {
  from { transform: scale(1.02); }
  to   { transform: scale(1.09); }
}

/* archival grain — same as History hero */
.charter-hero::after {
  content: '';
  position: absolute; inset: 0; z-index: 3;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
  background-size: 180px;
  pointer-events: none;
  mix-blend-mode: overlay;
}

/* element exists in template but History has no grid — hide it */
.hero-grid-overlay { display: none; }

/* exact overlay from History.vue */
.hero-overlay {
  position: absolute; inset: 0; z-index: 1;
  background:
    linear-gradient(to right,
      rgba(4,10,60,0.97) 0%,
      rgba(7,17,94,0.92) 48%,
      rgba(11,25,143,0.22) 100%),
    linear-gradient(to top, rgba(4,10,60,0.55) 0%, transparent 40%);
}

/* same container formula as History's .wrap →
   title shares a left edge with the document card below */
.hero-content {
  position: relative; z-index: 2;
  width: 100%; max-width: var(--max-w);
  margin: 0 auto;
  padding: 0 var(--gutter);
  height: 100%;
  display: flex; flex-direction: column; justify-content: center;
}

/* initial states required by the Motion One entrance */
.hero-eyebrow, .hero-title, .hero-sub { opacity: 0; }

/* = History's .hero-kicker treatment */
.hero-eyebrow {
  display: flex; align-items: center; gap: 10px;
  font-size: 0.62rem; font-weight: 500;
  letter-spacing: 0.26em; text-transform: uppercase;
  color: rgba(255,255,255,0.5);
  margin-bottom: 18px;
}
.eyebrow-line {
  width: 24px; height: 1px;
  background: rgba(255,255,255,0.25);
  flex-shrink: 0;
}

/* = History's .hero-title treatment */
.hero-title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(2.6rem, 6.5vw, 5rem);
  font-weight: 800;
  text-transform: uppercase;
  color: #F2F1EC;
  line-height: 1.04; letter-spacing: -0.025em;
  max-width: 640px;
  margin-bottom: 22px;
  text-wrap: balance;
}
.hero-title em {
  font-style: normal; font-weight: 800;
  color: #C42B3A;
}
/* brightened crimson so the dot reads on the deep navy */
.period { color: #C42B3A; }

/* = History's .hero-divider — recreated via ::after
   since the template has no divider element */
.hero-title::after {
  content: '';
  display: block;
  width: 44px; height: 3px;
  background: var(--red);
  margin-top: 20px;
}

/* = History's .hero-sub treatment */
.hero-sub {
  font-family: 'EB Garamond', serif;
  font-size: clamp(1.05rem, 1.5vw, 1.22rem);
  color: rgba(255,255,255,0.66);
  line-height: 1.75;
  max-width: 46ch; font-style: italic;
  margin-top: 20px;
}

.hero-badges { display: flex; gap: 10px; flex-wrap: wrap; }

/* ═══════════════════════════════════════════
   VIEWER CONTAINER — same .wrap formula as History
   ═══════════════════════════════════════════ */
.pdf-viewer-container {
  max-width: var(--max-w);
  margin: 0 auto;
  padding: clamp(56px, 8vw, 96px) var(--gutter) clamp(72px, 9vw, 112px);
  min-height: 600px;
}

/* ── State boxes — History's editorial card language:
      white card, red top rule, Playfair + Garamond ── */
.state-box {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  min-height: 440px; gap: 14px;
  text-align: center;
  background: var(--white);
  border: 1px solid var(--border);
  border-top: 3px solid var(--red);
  border-radius: var(--r);
  box-shadow: var(--sh-1);
  padding: 48px 24px;
}

.state-icon {
  width: 68px; height: 68px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.5rem; margin-bottom: 6px;
  border-radius: var(--r);
  background: var(--surface);
  border: 1px solid var(--border);
}

.loading-state .state-icon { color: var(--navy); }
.loading-state p {
  font-family: 'EB Garamond', serif; font-style: italic;
  font-size: 1.05rem; color: var(--ink-muted);
}

.error-state .state-icon {
  color: var(--red);
  background: rgba(151,7,24,0.05);
  border-color: rgba(151,7,24,0.18);
}
.error-state h3 {
  font-family: 'Playfair Display', serif;
  font-size: 1.35rem; font-weight: 700; color: var(--navy-deep);
  max-width: 40ch; line-height: 1.4; letter-spacing: -0.01em;
}

.empty-state .state-icon {
  color: #C6CEE2;
  border-style: dashed;
  border-color: rgba(16,21,43,0.18);
  background: transparent;
}
.empty-state h3 {
  font-family: 'Playfair Display', serif;
  font-size: 1.5rem; font-weight: 700; color: var(--navy-deep);
  margin-bottom: 2px; letter-spacing: -0.01em;
}
.empty-state p {
  font-family: 'EB Garamond', serif;
  font-size: 1.05rem; color: var(--ink-muted);
  max-width: 44ch; line-height: 1.7; font-style: italic;
}

.action-btn {
  margin-top: 14px; padding: 12px 26px;
  background: var(--red); color: #fff; border: none;
  font-family: 'DM Sans', sans-serif; font-size: 0.8rem; font-weight: 700;
  letter-spacing: 0.08em; text-transform: uppercase;
  cursor: pointer;
  display: inline-flex; align-items: center; gap: 8px;
  border-radius: var(--r);
  transition: background 0.2s, transform 0.2s var(--ease);
}
.action-btn:hover { background: #7A0513; transform: translateY(-2px); }
.action-btn i { font-size: 0.72rem; }

/* ═══════════════════════════════════════════
   PDF DISPLAY — navy toolbar w/ red rule
   (sticky kept), sharp editorial corners
   ═══════════════════════════════════════════ */
.pdf-display {
  /* no overflow:hidden — it would break the sticky toolbar */
  border-radius: var(--r);
}

.pdf-info-bar {
  position: sticky; top: 0; z-index: 50;
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; flex-wrap: wrap;
  background: var(--navy-deep);
  padding: 14px 20px;
  border-radius: var(--r) var(--r) 0 0;
  border-bottom: 3px solid var(--red);
  box-shadow: 0 -6px 24px rgba(7,17,94,0.10);
}

.pdf-info-left {
  display: flex; align-items: center; gap: 14px;
  color: #fff; min-width: 0;
}
.pdf-info-left > i {
  font-size: 1.4rem; color: rgba(255,255,255,0.92); flex-shrink: 0;
}
.pdf-name {
  font-family: 'DM Sans', sans-serif;
  font-weight: 600; font-size: 0.88rem; margin-bottom: 3px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 52vw;
}
.pdf-meta {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.72rem; color: rgba(255,255,255,0.55);
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.meta-sep { opacity: 0.4; }

.pdf-info-right {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}

/* zoom cluster — History's lb-close border language */
.zoom-controls {
  display: flex; align-items: center; gap: 2px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.22);
  border-radius: var(--r);
  padding: 4px 10px;
}
.zoom-controls button {
  background: none; border: none;
  color: rgba(255,255,255,0.6);
  cursor: pointer; font-size: 0.72rem;
  padding: 11px 12px; border-radius: 3px;
  display: flex; align-items: center; justify-content: center;
  transition: color 0.15s, background 0.15s;
}
.zoom-controls button:hover:not(:disabled) {
  color: #fff; background: rgba(255,255,255,0.1);
}
.zoom-controls button:disabled { opacity: 0.3; cursor: not-allowed; }
.zoom-controls span {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.78rem; font-weight: 600;
  color: rgba(255,255,255,0.72);
  min-width: 44px; text-align: center;
  font-variant-numeric: tabular-nums;
}

/* square tool buttons — mirrors History's .lb-close */
.tool-btn {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.22);
  color: rgba(255,255,255,0.72);
  width: 40px; height: 40px; border-radius: var(--r);
  cursor: pointer; font-size: 0.85rem;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.2s, border-color 0.2s;
}
.tool-btn:hover {
  background: rgba(255,255,255,0.12);
  border-color: rgba(255,255,255,0.45);
  color: #fff;
}

/* document surface — flat editorial corners */
.pdf-frame-wrap {
  background: #E9EBF0;
  border-radius: 0 0 var(--r) var(--r);
  box-shadow: var(--sh-2);
  transition: transform 0.25s var(--ease);
}
.pdf-frame {
  width: 100%; height: min(88vh, 940px); display: block;
  background: #fff;
  border-radius: 0 0 var(--r) var(--r);
}

/* ═══════════════════════════════════════════
   RESPONSIVE — same breakpoints as History
   ═══════════════════════════════════════════ */
@media (max-width: 860px) {
  .pdf-info-bar {
    flex-direction: column; align-items: stretch; gap: 12px;
    padding: 14px 16px;
  }
  .pdf-name { max-width: 100%; white-space: normal; }
  .pdf-info-right { justify-content: space-between; }
  .pdf-frame { height: 72vh; }
  .state-box { min-height: 360px; }
}

@media (max-width: 580px) {
  .hero-title { font-size: clamp(2.2rem, 10vw, 3rem); }
  .hero-sub { font-size: 1rem; }

  .pdf-info-right { gap: 6px; }
  .zoom-controls { padding: 3px 6px; }
  .zoom-controls span { min-width: 36px; font-size: 0.72rem; }
  /* the mobile rule was shrinking these to 36px, below the 40px tap target */
  .tool-btn { width: 40px; height: 40px; }
  .pdf-info-left > i { font-size: 1.15rem; }

  .pdf-frame-wrap,
  .pdf-frame { border-radius: 0 0 3px 3px; }
  .pdf-info-bar { border-radius: 3px 3px 0 0; }
}

/* respect users who prefer less motion */
@media (prefers-reduced-motion: reduce) {
  .charter-page *,
  .charter-page *::before,
  .charter-page *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
  .hero-bg { animation: none !important; }
}
</style>