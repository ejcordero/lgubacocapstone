<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import Lenis from 'lenis'
import { animate, inView, stagger } from '@motionone/dom'

// ── state ──
const offices = ref([])
const loading = ref(true)
const loadError = ref('')

let lenis = null

onMounted(async () => {
  // Lenis smooth scroll (same feel as MHO.vue)
  lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 0.9,
  })
  const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf) }
  requestAnimationFrame(raf)


  // Load offices from the DB
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/offices`)
    if (res.ok) offices.value = await res.json()
    else loadError.value = `Failed to load offices (HTTP ${res.status}).`
  } catch (e) {
    loadError.value = 'Could not reach the server. Please try again later.'
  } finally { loading.value = false }

  // Cards scroll-in
  inView('.offices-grid', ({ target }) => {
    const cards = target.querySelectorAll('.office-card')
    if (cards.length) {
      animate(cards, { opacity: [0, 1], transform: ['translateY(24px)', 'translateY(0px)'] }, {
        duration: 0.5, delay: stagger(0.08), easing: [0.16, 1, 0.3, 1]
      })
    }
  }, { margin: '-60px' })
})

onUnmounted(() => lenis?.destroy())

const mailtoOf = (o) => {
  const first = String(o.email || '').split('\n').map(s => s.trim()).filter(Boolean)[0]
  return first ? `mailto:${first}` : null
}
const fbHost = (url) => { try { return new URL(url).hostname } catch (e) { return 'Facebook' } }
</script>

<template>
  <div class="off-page">

    <section class="offices-hero">
      <div class="hero-bg"></div>
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <span class="hero-kicker">Municipality of Baco &middot; Oriental Mindoro</span>
        <h1 class="hero-title">LGU Offices</h1>
        <div class="hero-divider"></div>
        <p class="hero-sub">The official directory of local government offices serving the people of Baco — locations, hotlines, and Facebook pages in one place.</p>
      </div>
    </section>

    <!-- ══ OFFICES DIRECTORY — 3 per grid, rounded cards ══ -->
    <section class="offices-section">
      <div class="off-wrap">



        <div v-if="loading" class="state-note">
          <i class="fa-solid fa-spinner fa-spin"></i> Loading offices…
        </div>

        <div v-else-if="loadError" class="state-note error">
          <i class="fa-solid fa-triangle-exclamation"></i> {{ loadError }}
        </div>

        <div v-else-if="offices.length === 0" class="state-note">
          <i class="fa-solid fa-building-columns"></i> No offices published yet.
        </div>

        <div v-else class="offices-grid">
          <article v-for="o in offices" :key="o.id" class="office-card">
            <div class="oc-logo">
              <img v-if="o.logo" :src="o.logo" :alt="o.name + ' logo'" loading="lazy" />
              <i v-else class="fa-solid fa-building-columns"></i>
            </div>
            <h3 class="oc-name">{{ o.name }}</h3>

            <ul class="oc-info">
              <li v-if="o.location">
                <i class="fa-solid fa-location-dot"></i>
                <span class="oc-text">{{ o.location }}</span>
              </li>
              <li v-if="o.contact">
                <i class="fa-solid fa-phone"></i>
                <span class="oc-text pre">{{ o.contact }}</span>
              </li>
              <li v-if="o.email">
                <i class="fa-solid fa-envelope"></i>
                <span class="oc-text pre">{{ o.email }}</span>
              </li>
            </ul>

            <a
              v-if="o.linkPage"
              class="oc-link"
              :href="o.linkPage"
              target="_blank"
              rel="noopener noreferrer"
              :title="fbHost(o.linkPage)"
            >
              <i class="fa-brands fa-facebook-f"></i> Visit Facebook Page
            </a>
          </article>
        </div>

      </div>
    </section>

  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600;700&display=swap');

/* ═══ TOKENS — same system as MHO.vue ═══ */
.off-page {
  --white:     #FFFFFF;
  --surface:   #F5F6F8;
  --border:    #E3E5EA;
  --navy:      #000c7b;
  --navy-deep: #07115E;
  --red:       #970718;
  --red-bright:#C42B3A;
  --ink:       #111827;
  --ink-body:  #3D4451;
  --ink-muted: #6B7280;
  --ink-faint: #A0A9B8;
  --gutter:    clamp(20px, 5vw, 80px);
  --max-w:     1140px;
  --r-sm:   10px;
  --r-md:   14px;
  --r-lg:   20px;
  --r-pill: 999px;
  --sh-1: 0 1px 2px rgba(7,17,94,0.05), 0 10px 28px rgba(7,17,94,0.07);
  --sh-2: 0 18px 50px rgba(7,17,94,0.16), 0 4px 12px rgba(7,17,94,0.06);
  --ease: cubic-bezier(0.16, 1, 0.3, 1);

  font-family: 'DM Sans', sans-serif;
  background: var(--surface);
  color: var(--ink);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.off-page *, .off-page *::before, .off-page *::after { box-sizing: border-box; margin: 0; padding: 0; }
.off-page ::selection { background: var(--navy); color: #fff; }
.off-page :focus-visible { outline: 2px solid var(--red); outline-offset: 3px; border-radius: 4px; }

.offices-hero {
  position: relative;
  height: 68vh;      /* fallback for older browsers */
  height: 68svh;     /* same as Schools.vue hero */
  min-height: 440px;
  max-height: 620px;
  overflow: hidden;
  background: var(--navy-deep);
}
/* ═══ HERO — identical geometry/typography to Schools.vue ═══ */
.hero-bg {
  position: absolute; inset: 0;
  background: url('/images/hero-imgs.jpg') center 35% / cover no-repeat;
  filter: grayscale(25%) brightness(0.45);
}
.hero-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to right, rgba(4,10,60,0.97) 0%, rgba(7,17,94,0.92) 48%, rgba(11,25,143,0.22) 100%);
}
.hero-content {
  position: relative; z-index: 2; height: 100%;
  padding: 0 var(--gutter);
  display: flex; flex-direction: column; justify-content: center;
  max-width: 680px;
  margin-left: max(var(--gutter), calc(50vw - var(--max-w) / 2));
}
.hero-kicker {
  display: block; font-size: 0.62rem; font-weight: 600;
  letter-spacing: 0.26em; text-transform: uppercase;
  color: rgba(255,255,255,0.46); margin-bottom: 18px;
}
.hero-title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(3rem, 7vw, 5.4rem);
  font-weight: 700; color: #ececec;
  line-height: 1.03; letter-spacing: -0.025em;
  margin: 0 0 22px;
}
.hero-divider { width: 44px; height: 3px; background: var(--red); margin-bottom: 20px; }
.hero-sub {
  font-family: 'EB Garamond', Georgia, serif;
  font-size: 1.18rem; line-height: 1.75;
  color: rgba(255,255,255,0.66);
  margin: 0; max-width: 560px;
}
/* ═══ DIRECTORY ═══ */
.offices-section { padding: clamp(48px, 7vw, 88px) var(--gutter) clamp(64px, 8vw, 104px); }
.off-wrap { max-width: var(--max-w); margin: 0 auto; }

.section-head { display: flex; align-items: center; gap: 18px; margin-bottom: clamp(26px, 4vw, 40px); }
.section-head h2 {
  font-family: 'Playfair Display', serif;
  font-size: clamp(1.5rem, 3vw, 2.1rem);
  font-weight: 700; color: var(--ink);
}
.section-line { flex: 1; height: 2px; background: linear-gradient(90deg, var(--red) 0%, var(--border) 100%); border-radius: 1px; }

.state-note {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 64px 20px; color: var(--ink-muted); font-size: 0.92rem;
  background: var(--white); border: 1px dashed var(--border); border-radius: var(--r-lg);
}
.state-note.error { color: var(--red); border-color: rgba(151,7,24,0.3); }

/* 3 per grid */
.offices-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
@media (max-width: 1024px) { .offices-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px)  { .offices-grid { grid-template-columns: 1fr; } }

.office-card {
  display: flex; flex-direction: column;
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 28px 24px 24px;
  box-shadow: var(--sh-1);
  transition: transform 0.35s var(--ease), box-shadow 0.35s var(--ease), border-color 0.35s var(--ease);
}
.office-card:hover { transform: translateY(-6px); box-shadow: var(--sh-2); border-color: rgba(0,12,123,0.25); }

.oc-logo {
  width: 76px; height: 76px; border-radius: 50%;
  overflow: hidden; flex-shrink: 0;
  background: var(--surface);
  border: 2px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 18px;
}
.oc-logo img { width: 100%; height: 100%; object-fit: contain; display: block; padding: 6px; }
.oc-logo i { font-size: 1.6rem; color: var(--ink-faint); }

.oc-name {
  font-family: 'Playfair Display', serif;
  font-size: 1.08rem; font-weight: 700;
  color: var(--ink); line-height: 1.3;
  margin-bottom: 16px;
}

.oc-info { list-style: none; display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; flex: 1; }
.oc-info li { display: flex; align-items: flex-start; gap: 10px; }
.oc-info i {
  font-size: 0.78rem; color: var(--navy);
  margin-top: 3px; width: 16px; text-align: center; flex-shrink: 0;
}
.oc-text { font-size: 0.84rem; color: var(--ink-body); line-height: 1.55; word-break: break-word; }
.oc-text.pre { white-space: pre-line; }

.oc-link {
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  padding: 12px 22px; border-radius: var(--r-pill);
  background: var(--navy); color: #fff;
  font-weight: 700; font-size: 0.84rem;
  text-decoration: none; transition: all 0.25s var(--ease);
  box-shadow: 0 8px 22px rgba(0,12,123,0.25);
  margin-top: auto;
}
.oc-link:hover { transform: translateY(-2px); background: var(--navy-deep); box-shadow: 0 12px 28px rgba(0,12,123,0.35); }
.oc-link i { font-size: 0.85rem; }

@media (prefers-reduced-motion: reduce) {
  .off-page *, .off-page *::before, .off-page *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
  .hero-bg { animation: none !important; }
}
</style>