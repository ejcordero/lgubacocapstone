<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  title: { type: String, default: 'Elected Officials' }
})

// CHANGED: env-driven API base (was hardcoded http://localhost:3000)
const API = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api'
const titleWords = computed(() => (props.title || 'Elected Officials').split(' '))

// CHANGED: data now comes from the database (name, position, term, bio, image)
const officials = ref([])

// CHANGED: if the animation library fails to load, this flag forces all
// content visible via CSS (previously everything stayed at opacity: 0)
const animFailed = ref(false)

const MAYOR_PLACEHOLDER = {
  id: 'placeholder-mayor',
  name: 'Hon. Mayor Name',
  position: 'Municipal Mayor',
  image: null,
  term: null,
  bio: 'Biography and background information will be added here once available.'
}
const VICE_MAYOR_PLACEHOLDER = {
  id: 'placeholder-vice-mayor',
  name: 'Hon. Vice Mayor Name',
  position: 'Municipal Vice Mayor',
  image: null,
  term: null,
  bio: 'Biography and background information will be added here once available.'
}

const fetchOfficials = async () => {
  try {
    const response = await fetch(`${API}/officials`)
    if (response.ok) {
      officials.value = await response.json()
      // Councilor cards only exist in the DOM after data arrives —
      // animate them now that they've rendered (no-op if GSAP not ready yet;
      // initAnimations() re-calls this when GSAP finishes loading).
      await nextTick()
      animateCouncilorCards()
    } else {
      console.error('Failed to fetch officials')
    }
  } catch (error) {
    console.error('Error fetching officials:', error)
  }
}

const mayor = computed(() => {
  return officials.value.find(o =>
    o.position?.toLowerCase().includes('mayor') && !o.position?.toLowerCase().includes('vice')
  ) || MAYOR_PLACEHOLDER
})

const viceMayor = computed(() => {
  return officials.value.find(o =>
    o.position?.toLowerCase().includes('vice')
  ) || VICE_MAYOR_PLACEHOLDER
})

// CHANGED: real officials only — the 12 invented "Hon. SB Member N"
// placeholders are gone. An empty-state note shows instead.
const councilors = computed(() => {
  return officials.value.filter(o =>
    o.id !== mayor.value.id && o.id !== viceMayor.value.id
  )
})

// CHANGED: Vue-native image error handler (replaces inline onerror attribute)
const hideImg = (e) => { e.target.style.display = 'none' }

// ── ANIMATION ────────────────────────────────────────────────
// CHANGED: instances stored so they can be fully cleaned up on unmount
// (the original leaked a gsap.ticker callback every visit)
let gsapInst = null
let ScrollTriggerInst = null
let lenisInst = null
let tickerRaf = null

// CHANGED: councilors render asynchronously (after fetch), so animation is
// applied on demand and guarded with data-anim to never double-animate a card
const animateCouncilorCards = () => {
  if (!gsapInst || animFailed.value) return
  gsapInst.utils.toArray('.councilor-col:not([data-anim])').forEach((card, i) => {
    card.dataset.anim = '1'
    gsapInst.fromTo(card,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
        delay: (i % 3) * 0.06,
        scrollTrigger: { trigger: card, start: 'top 88%', once: true } }
    )
  })
}

onMounted(async () => {
  fetchOfficials()

  try {
    const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
      import('@studio-freight/lenis'),
    ])

    gsapInst = gsap
    ScrollTriggerInst = ScrollTrigger
    gsap.registerPlugin(ScrollTrigger)

    lenisInst = new Lenis({
      duration: 1.2,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })
    lenisInst.on('scroll', ScrollTrigger.update)
    // CHANGED: named handler so it can be removed on unmount; guarded so a
    // destroyed Lenis is never driven by a stray frame
    tickerRaf = (time) => { if (lenisInst) lenisInst.raf(time * 1000) }
    gsap.ticker.add(tickerRaf)
    gsap.ticker.lagSmoothing(0)

    /* ── Hero parallax ── */
    gsap.to('.hero-bg', {
      yPercent: 20, ease: 'none',
      scrollTrigger: { trigger: '.history-hero', start: 'top top', end: 'bottom top', scrub: true }
    })

    /* ── Hero content: stagger in on load ── */
    gsap.fromTo(
      ['.hero-kicker', '.hero-title', '.hero-divider'],
      { opacity: 0, y: 28 },
      { opacity: 1, y: 0, stagger: 0.1, duration: 1, ease: 'power2.out', delay: 0.25 }
    )

    /* ── Generic fade-up for .reveal elements ── */
    gsap.utils.toArray('.reveal').forEach(el => {
      gsap.fromTo(el,
        { opacity: 0, y: 32 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 86%', once: true } }
      )
    })

    /* ── Leader cols: staggered fade + rise ── */
    gsap.utils.toArray('.leader-col').forEach((col, i) => {
      gsap.fromTo(col,
        { opacity: 0, y: 48 },
        { opacity: 1, y: 0, duration: 0.9, ease: 'power2.out',
          delay: i * 0.15,
          scrollTrigger: { trigger: '.leaders-row', start: 'top 85%', once: true } }
      )
    })

    /* ── District header: slide from left ── */
    gsap.fromTo('.district-header',
      { opacity: 0, x: -40 },
      { opacity: 1, x: 0, duration: 0.8, ease: 'power2.out',
        scrollTrigger: { trigger: '.district-header', start: 'top 88%', once: true } }
    )

    /* ── Councilor cards already in the DOM (if data beat GSAP) ── */
    animateCouncilorCards()
  } catch (e) {
    // CHANGED: GSAP/Lenis failed to load — show all content statically
    animFailed.value = true
  }
})

onBeforeUnmount(() => {
  // CHANGED: full cleanup — Lenis, ticker callback, and ScrollTriggers
  if (lenisInst) { lenisInst.destroy(); lenisInst = null }
  if (gsapInst && tickerRaf) gsapInst.ticker.remove(tickerRaf)
  if (ScrollTriggerInst) ScrollTriggerInst.getAll().forEach(t => t.kill())
})
</script>

<template>
  <div class="officials-page" :class="{ 'no-anim': animFailed }">

    <!-- ── HERO ── -->
    <section class="history-hero">
      <div class="hero-bg"></div>
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <span class="hero-kicker">Municipality of Baco · Oriental Mindoro</span>
        <h1 class="hero-title">{{ titleWords.length > 1 ? titleWords.slice(0, -1).join(' ') : title }} <em>{{ titleWords[titleWords.length - 1] }}.</em></h1>
        <div class="hero-divider"></div>
      </div>
      <div class="hero-scroll">
        <span>Scroll</span>
        <div class="scroll-bar"></div>
      </div>
    </section>

    <!-- ── BREADCRUMB ── -->
    <nav class="breadcrumb-bar" aria-label="Breadcrumb">
      <div class="wrap">
        <router-link to="/">Home</router-link>
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
        <router-link to="/municipality">Municipality</router-link>
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
        <span aria-current="page">{{ title }}</span>
      </div>
    </nav>

    <!-- ── MAIN CONTENT ── -->
    <div class="page-body">
      <div class="wrap">

        <h2 class="page-section-title reveal">ELECTED OFFICIALS</h2>

        <!-- MAYOR + VICE MAYOR side by side -->
        <div class="leaders-row">

          <!-- MAYOR -->
          <div class="leader-col">
            <div class="portrait-card">
              <div class="portrait-photo-wrap">
                <img v-if="mayor.image" :src="mayor.image" :alt="mayor.name" class="portrait-photo" />
                <div v-else class="portrait-placeholder">
                  <i class="fas fa-user"></i>
                </div>
                <div class="portrait-seal">
                  <img src="/images/BACO-SEAL.png" alt="Seal" @error="hideImg" />
                </div>
                <div class="portrait-name-badge">
                  <span class="badge-name">{{ mayor.name }}</span>
                  <span class="badge-pos">MUNICIPAL MAYOR</span>
                </div>
              </div>
            </div>
            <div class="leader-info">
              <p class="official-full-name">{{ mayor.name }}</p>
              <p class="official-title-text">Municipal Mayor</p>
              <!-- CHANGED: term/bio only render when the admin actually entered them
                   (previously faked '2022 – 2025' on every official) -->
              <p class="official-term" v-if="mayor.term">
                <i class="fas fa-calendar-alt"></i>
                {{ mayor.term }}
              </p>
              <p class="official-bio" v-if="mayor.bio">{{ mayor.bio }}</p>
            </div>
          </div>

          <!-- VICE MAYOR -->
          <div class="leader-col">
            <div class="portrait-card">
              <div class="portrait-photo-wrap">
                <img v-if="viceMayor.image" :src="viceMayor.image" :alt="viceMayor.name" class="portrait-photo" />
                <div v-else class="portrait-placeholder">
                  <i class="fas fa-user"></i>
                </div>
                <div class="portrait-seal">
                  <img src="/images/BACO-SEAL.png" alt="Seal" @error="hideImg" />
                </div>
                <div class="portrait-name-badge">
                  <span class="badge-name">{{ viceMayor.name }}</span>
                  <span class="badge-pos">VICE MAYOR</span>
                </div>
              </div>
            </div>
            <div class="leader-info">
              <p class="official-full-name">{{ viceMayor.name }}</p>
              <p class="official-title-text">Municipal Vice Mayor</p>
              <p class="official-term" v-if="viceMayor.term">
                <i class="fas fa-calendar-alt"></i>
                {{ viceMayor.term }}
              </p>
              <p class="official-bio" v-if="viceMayor.bio">{{ viceMayor.bio }}</p>
            </div>
          </div>

        </div>

        <!-- SANGGUNIANG BAYAN MEMBERS -->
        <div class="district-block">
          <div class="district-header">SANGGUNIANG BAYAN MEMBERS</div>
          <div class="councilor-grid">
            <div
              v-for="(sb, index) in councilors"
              :key="sb.id || index"
              class="councilor-col"
              :class="{ 'is-placeholder': !sb.image }"
            >
              <div class="portrait-card">
                <div class="portrait-photo-wrap">
                  <img v-if="sb.image" :src="sb.image" :alt="sb.name" class="portrait-photo" />
                  <div v-else class="portrait-placeholder">
                    <i class="fas fa-user"></i>
                  </div>
                  <div class="portrait-seal">
                    <img src="/images/BACO-SEAL.png" alt="Seal" @error="hideImg" />
                  </div>
                  <div class="portrait-name-badge">
                    <span class="badge-name">{{ sb.name }}</span>
                    <span class="badge-pos">{{ sb.position }}</span>
                  </div>
                </div>
              </div>
              <div class="councilor-info">
                <p class="official-full-name">{{ sb.name }}</p>
                <p class="official-term" v-if="sb.term">
                  <i class="fas fa-calendar-alt"></i>
                  {{ sb.term }}
                </p>
                <p class="official-bio" v-if="sb.bio">{{ sb.bio }}</p>
              </div>
            </div>
          </div>

          <!-- CHANGED: empty state replaces the fabricated 12 SB placeholders -->
          <p v-if="councilors.length === 0" class="empty-roster">
            The complete roster of Sangguniang Bayan members will be published soon.
          </p>
        </div>

      </div>
    </div>

  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

:root {
  --white:      #FFFFFF;
  --surface:    #F5F6F8;
  --border:     #DDDFE4;
  --navy:       #000c7b;
  --navy-deep:  #07115E;
  --red:        #970718;
  --gold:       #C9862F;
  --ink:        #111827;
  --ink-body:   #3D4451;
  --ink-muted:  #6B7280;
  --ink-faint:  #A0A9B8;
  --gutter:     clamp(20px, 5vw, 80px);
  --max-w:      1140px;
}
</style>

<style scoped>

.officials-page {
  font-family: 'DM Sans', sans-serif;
  background: var(--white);
  color: var(--ink);
  min-height: 100vh;
  overflow-x: hidden;
}

.wrap {
  max-width: var(--max-w);
  margin: 0 auto;
  padding: 0 var(--gutter);
}

/* ══ HERO ══ */
.history-hero {
  position: relative;
  height: 68vh; height: 68svh; min-height: 460px; max-height: 640px;
  overflow: hidden; background: var(--navy-deep);
}
.hero-bg {
  position: absolute; inset: 0;
  background: url('/images/hero-imgs.jpg') center 35% / cover no-repeat;
  filter: grayscale(25%) brightness(0.45);
  will-change: transform;
}
.hero-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to right,
    rgba(4,10,60,0.97) 0%,
    rgba(7,17,94,0.92) 48%,
    rgba(11,25,143,0.22) 100%);
}
.hero-content {
  position: relative; z-index: 2; height: 100%;
  padding: 0 var(--gutter);
  display: flex; flex-direction: column; justify-content: center;
  max-width: 680px;
  margin-left: max(var(--gutter), calc(50vw - var(--max-w) / 2));
}
.hero-kicker {
  display: block; 
  font-size: 0.66rem; font-weight: 500;
  letter-spacing: 0.28em; text-transform: uppercase;
  color: rgba(255,255,255,0.46); margin-bottom: 18px;
  opacity: 0;
}
.hero-title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(2.7rem, 6.4vw, 5.2rem); font-weight: 800;
  color: #ececec;
  line-height: 0.9; letter-spacing: -0.035em;
  text-transform: uppercase;
  margin-bottom: 22px;
  opacity: 0;
}
.hero-title em { font-style: normal; color: var(--red); }
.period { color: var(--red); }
.hero-divider {
  width: 44px; height: 3px; background: var(--red);
  margin-bottom: 20px;
  opacity: 0;
}
.hero-sub {
  font-family: 'EB Garamond', serif;
  font-size: clamp(1.05rem, 1.5vw, 1.22rem);
  color: rgba(255,255,255,0.62); line-height: 1.75;
  max-width: 460px; font-style: italic;
  opacity: 0;
}
.hero-scroll {
  position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
  z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 6px;
}
.hero-scroll span {
  font-size: 0.58rem; letter-spacing: 0.22em; text-transform: uppercase;
  color: rgba(255,255,255,0.3);
}
.scroll-bar {
  width: 1px; height: 32px;
  background: linear-gradient(to bottom, rgba(151,7,24,0.6), transparent);
  animation: scrollAnim 2s ease-in-out infinite;
}
@keyframes scrollAnim { 0%,100%{opacity:0.4} 50%{opacity:1} }

/* ══ BREADCRUMB ══ */
.breadcrumb-bar {
  background: var(--navy); border-bottom: 1px solid rgba(255,255,255,0.08); padding: 12px 0;
}
.breadcrumb-bar .wrap {
  display: flex; align-items: center; gap: 8px;
  font-size: 0.72rem; color: rgba(255,255,255,0.55);
}
.breadcrumb-bar a { color: #fff; text-decoration: none; font-weight: 500; transition: color 0.18s; }
.breadcrumb-bar a:hover { color: var(--gold); }
.breadcrumb-bar i { font-size: 0.5rem; color: rgba(255,255,255,0.35); }
.breadcrumb-bar span { color: rgba(255,255,255,0.8); font-weight: 600; }

/* ══ PAGE BODY ══ */
.page-body { padding: 72px 0 96px; }

.page-section-title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(1.5rem, 2.8vw, 2.3rem);
  font-weight: 800;
  color: var(--red);
  letter-spacing: -0.02em;
  text-transform: uppercase;
  text-align: center;
  margin-bottom: 48px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
}

/* ══ LEADERS ROW ══ */
.leaders-row {
  display: flex;
  justify-content: center;
  gap: 40px;
  flex-wrap: wrap;
  margin-bottom: 56px;
}

.leader-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 310px;
  opacity: 0;
}

.leader-info {
  text-align: center;
  margin-top: 12px;
  width: 100%;
}

/* ══ PORTRAIT CARD ══ */
.portrait-card { width: 100%; }

.portrait-photo-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 3.8;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--surface);
}

.portrait-placeholder {
  width: 100%; height: 100%;
  background: linear-gradient(160deg, #d1d5e0 0%, var(--surface) 100%);
  display: flex; align-items: center; justify-content: center;
}
.portrait-placeholder i { font-size: 3rem; color: var(--ink-faint); }
.is-placeholder .portrait-placeholder i { font-size: 2.4rem; }

.portrait-photo {
  width: 100%; height: 100%;
  object-fit: cover; object-position: top center; display: block;
  transition: transform 0.45s cubic-bezier(0.16,1,0.3,1);
}
.portrait-card:hover .portrait-photo { transform: scale(1.04); }

/* Seal */
.portrait-seal {
  position: absolute; top: 6px; right: 6px;
  width: 28px; height: 28px;
  border-radius: 50%; overflow: hidden;
  background: var(--white);
  border: 1.5px solid rgba(255,255,255,0.9);
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  display: flex; align-items: center; justify-content: center;
}
.portrait-seal img { width: 100%; height: 100%; object-fit: contain; }

/* Name badge */
.portrait-name-badge {
  position: absolute; bottom: 0; left: 0; right: 0;
  background: var(--navy-deep);
  padding: 5px 8px 7px;
  display: flex; flex-direction: column; gap: 1px;
}
.badge-name {
  font-size: 0.6rem; font-weight: 700; color: var(--white);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;
}
.badge-pos {
  font-size: 0.48rem; font-weight: 600;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--ink-faint); line-height: 1.2;
}

/* ══ INFO BELOW CARD ══ */
.official-full-name {
  font-family: 'Playfair Display', serif;
  font-size: 0.9rem; font-weight: 700;
  color: var(--ink); line-height: 1.35;
  margin-bottom: 2px;
}
.official-title-text {
  font-size: 0.75rem; color: var(--ink-muted); margin-bottom: 6px;
}
.official-term {
  font-size: 0.7rem; color: var(--ink-faint);
  display: flex; align-items: center; gap: 5px;
  margin-bottom: 6px;
}
.leader-info .official-term { justify-content: center; }
.official-term i { font-size: 0.6rem; color: var(--red); }
.official-bio {
  font-family: 'EB Garamond', serif;
  font-size: 0.88rem; color: var(--ink-body);
  line-height: 1.65;
}

/* ══ DISTRICT BANNER ══ */
.district-block { margin-bottom: 48px; }
.district-header {
  background: var(--navy-deep);
  color: var(--white);
  text-align: center;
  font-size: 0.75rem; font-weight: 700;
  letter-spacing: 0.22em; text-transform: uppercase;
  padding: 11px 20px; margin-bottom: 28px;
}

/* ══ COUNCILOR GRID ══ */
.councilor-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px 24px;
}

.councilor-col {
  display: flex; flex-direction: column; align-items: flex-start;
  width: 100%; max-width: 260px; margin: 0 auto;
  opacity: 0;
}
.councilor-col .portrait-card { width: 100%; }

.councilor-info { margin-top: 10px; width: 100%; }
.councilor-info .official-full-name { font-size: 0.85rem; margin-bottom: 3px; }
.councilor-info .official-term { justify-content: flex-start; }

/* ══ ADDED: no-JS-animation fallback ══
   If gsap/lenis fail to load, every element that starts at opacity:0
   must still be visible — otherwise the page renders blank. */
.no-anim .hero-kicker,
.no-anim .hero-title,
.no-anim .hero-divider,
.no-anim .reveal,
.no-anim .leader-col,
.no-anim .councilor-col { opacity: 1 !important; }

/* ══ ADDED: empty roster note ══ */
.empty-roster {
  text-align: center;
  color: var(--ink-muted);
  font-family: 'EB Garamond', serif;
  padding: 24px 0 8px;
}

/* ══ RESPONSIVE ══ */
@media (max-width: 860px) {
  .councilor-grid { grid-template-columns: repeat(2, 1fr); }
  .leaders-row { gap: 24px; }
}
@media (max-width: 580px) {
  .leaders-row { gap: 16px; }
  .leader-col { width: 160px; }
  .councilor-grid { grid-template-columns: repeat(2, 1fr); gap: 16px 12px; }
}
</style>