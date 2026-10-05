<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import Lenis from 'lenis'
import { animate, inView, stagger } from '@motionone/dom'

const props = defineProps({
  title: { type: String, default: 'Municipal Health Office' }
})

// ── Built-in defaults (shown until the DB content loads, and used as
//    fallback if the API is unreachable — page never goes blank) ──
const DEFAULT_POSTER_TITLE = 'Municipal Health\nOffice Services'
const DEFAULT_BADGES = ['Free Consultation', 'Mon–Fri Open']
const DEFAULT_SERVICES = [
  {
    name: 'Consultation of Outpatients',
    desc: 'Diagnose, treat disease and give appropriate medical services available at the Municipal Health Office to any person who needs medical assistance.'
  },
  {
    name: 'Availment of Maternal Care Services',
    desc: 'Comprehensive maternal care program for Pregnant and Lactating Mothers. Includes Hemoglobin and Urinalysis. Prenatal and postnatal care.'
  },
  {
    name: 'Availment of Immunization Services',
    desc: 'Immunize 0–11 months old from immunizable diseases. Also immunizes pregnant mothers against Tetanus Neonatorum in Infants.'
  },
  {
    name: 'Availment of Family Planning Services',
    desc: 'Basic Family Planning Education, Provision of Family Planning Commodities, Information of Family Planning Methods and Health Education/Counseling.'
  },
  {
    name: 'Availment of Dental Services',
    desc: 'Prevent and treat dental diseases.',
    bullets: ['Tooth Examination', 'Tooth Extraction (if needed)', 'Post-Extraction instruction about oral health']
  },
  {
    name: 'Securing Sanitary Permit and Health Card',
    desc: "Permit issued prior to operation of business establishments after inspection. Health card for operators and employees after physical exam and Food Handler's class."
  },
  {
    name: 'Availment of Laboratory Services',
    desc: 'Available to all who seek medical consultation at the MHO Laboratory Room. Monday to Friday.',
    detail: 'Fecalysis • Urinalysis • Blood Chemistry • CBC • Blood Typing • Sputum Examination • Chest Xray'
  }
]

// ── Dynamic state ──
const heroTitle   = ref(props.title)
const posterTitle = ref(DEFAULT_POSTER_TITLE)
const badges      = ref([...DEFAULT_BADGES])
const services    = ref(DEFAULT_SERVICES)
// Admin-published MHO Google Form (link + preview image) — null = card hidden
const googleForm  = ref(null)

let lenis = null

onMounted(async () => {
  // Lenis
  lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    wheelMultiplier: 0.9,
  })
  const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf) }
  requestAnimationFrame(raf)

  // Hero entrance
  animate('.hero-title',   { opacity: [0, 1], transform: ['translateY(32px)', 'translateY(0px)'] }, { duration: 0.75, delay: 0.22, easing: [0.16, 1, 0.3, 1] })
  animate('.hero-badges',  { opacity: [0, 1], transform: ['translateY(20px)', 'translateY(0px)'] }, { duration: 0.6,  delay: 0.44, easing: [0.16, 1, 0.3, 1] })

  // Poster rows scroll-in (plays once — guard prevents re-hiding on re-entry)
  let posterAnimated = false
  inView('.mhp-services', ({ target }) => {
    if (posterAnimated) return
    posterAnimated = true
    const rows = target.querySelectorAll('.mhp-row')
    if (rows.length) {
      animate(rows, { opacity: [0, 1], transform: ['translateY(16px)', 'translateY(0px)'] }, {
        duration: 0.45, delay: stagger(0.07), easing: [0.16, 1, 0.3, 1]
      })
    }
  }, { margin: '-60px' })

  // Load editable content from the DB (defaults stay if this fails)
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/mho-content`)
    if (res.ok) {
      const data = await res.json()
      if (data.info?.title)       heroTitle.value   = data.info.title
      if (data.info?.posterTitle) posterTitle.value = data.info.posterTitle
      if (Array.isArray(data.info?.badges) && data.info.badges.length) badges.value = data.info.badges
      if (Array.isArray(data.services) && data.services.length) {
        services.value = data.services.map(s => ({
          name: s.name,
          desc: s.desc,
          bullets: Array.isArray(s.bullets) && s.bullets.length ? s.bullets : null,
          detail: s.detail || null
        }))
      }
      // Google Form — only when the admin published at least a link or an image
      if (data.googleForm && (data.googleForm.url || data.googleForm.image)) {
        googleForm.value = data.googleForm
      }
    } else {
      console.warn('⚠️ MHO content fetch failed:', res.status, '— using built-in defaults')
    }
  } catch (e) {
    console.warn('⚠️ MHO content fetch error:', e.message, '— using built-in defaults')
  }

  // Hero form card entrance — runs after it renders (it appears once data lands)
  if (googleForm.value) {
    nextTick(() => {
      animate('.gform-card', { opacity: [0, 1], transform: ['translateY(24px)', 'translateY(0px)'] }, {
        duration: 0.6, delay: 0.15, easing: [0.16, 1, 0.3, 1]
      })
    })
  }
})

onUnmounted(() => lenis?.destroy())
</script>

<template>
  <div class="mho-page">

    <!-- ══ HERO (left: title + badges · right: Google Form card) ══ -->
    <section class="mho-hero">
      <div class="hero-bg"></div>
      <div class="hero-grid-overlay"></div>
      <div class="hero-overlay"></div>

      <div class="hero-inner">
        <div class="hero-content">
          <h1 class="hero-title">{{ heroTitle }}<span class="period">.</span></h1>
          <div class="hero-badges">
            <span v-for="(b, i) in badges" :key="i" class="badge"><span class="badge-sq"></span> {{ b }}</span>
          </div>
        </div>

        <!-- Google Form card — rendered only when the admin published something -->
        <aside v-if="googleForm" class="gform-card">
          <h2 class="gform-title">Request a health service online</h2>

          <div class="gform-visual" v-if="googleForm.image">
            <a v-if="googleForm.url" :href="googleForm.url" target="_blank" rel="noopener noreferrer">
              <img :src="googleForm.image" alt="MHO Google Form preview" />
            </a>
            <img v-else :src="googleForm.image" alt="MHO Google Form preview" />
          </div>
          <div class="gform-visual gform-visual--empty" v-else>
            <i class="fa-solid fa-file-lines"></i>
            <span>Form preview unavailable</span>
          </div>

          <a v-if="googleForm.url" class="gform-btn" :href="googleForm.url" target="_blank" rel="noopener noreferrer">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Open the Google Form
          </a>
        </aside>
      </div>
    </section>

    <!-- ══ SERVICES AT A GLANCE (main content) ══ -->
    <section class="poster-section">

      <div class="mho-poster">
        <!-- background layers -->
        <div class="mhp-sky"></div>
        <div class="mhp-clouds"></div>
        <div class="mhp-mountains">
          <div class="mhp-mountain-left"></div>
          <div class="mhp-mountain-center"></div>
          <div class="mhp-mountain-right"></div>
        </div>
        <div class="mhp-river"></div>
        <div class="mhp-river-water"></div>
        <div class="mhp-footer-bar"></div>

        <!-- content -->
        <div class="mhp-content">
          <h3 class="mhp-title">{{ posterTitle }}</h3>

          <div class="mhp-services">

            <div
              v-for="(svc, i) in services"
              :key="svc.name"
              class="mhp-row"
            >
              <span class="mhp-num">{{ i + 1 }}</span>
              <span class="mhp-sep">|</span>
              <div class="mhp-row-body">
                <div class="mhp-name">{{ svc.name }}</div>
                <div class="mhp-desc">{{ svc.desc }}</div>
                <ul v-if="svc.bullets" class="mhp-bullets">
                  <li v-for="b in svc.bullets" :key="b">{{ b }}</li>
                </ul>
                <div v-if="svc.detail" class="mhp-detail">{{ svc.detail }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- footer strip -->
        <div class="mhp-footer-content">
          <div class="mhp-logos">
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Roboto:wght@400;500;700;900&display=swap');

/* ═══════════════════════════════════════════
   TOKENS
   ═══════════════════════════════════════════ */
.mho-page {
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
  /* rounded system */
  --r-sm:   10px;
  --r-md:   14px;
  --r-lg:   20px;
  --r-pill: 999px;
  --sh-1: 0 1px 2px rgba(7,17,94,0.05), 0 10px 28px rgba(7,17,94,0.07);
  --sh-2: 0 18px 50px rgba(7,17,94,0.16), 0 4px 12px rgba(7,17,94,0.06);
  --ease: cubic-bezier(0.16, 1, 0.3, 1);

  font-family: 'DM Sans', sans-serif;
  background: #0A1233;
  color: var(--ink);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

/* scoped reset */
.mho-page *,
.mho-page *::before,
.mho-page *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.mho-page ::selection { background: var(--navy); color: #fff; }
.mho-page :focus-visible { outline: 2px solid var(--red); outline-offset: 3px; border-radius: 4px; }

/* ═══════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════ */
.mho-hero {
  position: relative;
  /* min-height (not fixed height) so the hero can grow when the
     Google Form card is present — identical look when it isn't. */
  min-height: max(460px, 68vh);
  min-height: max(460px, 68svh);
  overflow: hidden;
  background: var(--navy-deep);
  display: flex;
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

/* archival grain */
.mho-hero::after {
  content: '';
  position: absolute; inset: 0; z-index: 3;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
  background-size: 180px;
  pointer-events: none;
  mix-blend-mode: overlay;
}

.hero-grid-overlay { display: none; }

.hero-overlay {
  position: absolute; inset: 0; z-index: 1;
  background:
    linear-gradient(to right,
      rgba(4,10,60,0.97) 0%,
      rgba(7,17,94,0.92) 48%,
      rgba(11,25,143,0.35) 100%),
    linear-gradient(to top, rgba(4,10,60,0.55) 0%, transparent 40%);
}

/* NEW — two-column hero shell: title/badges left, form card right */
.hero-inner {
  position: relative; z-index: 2;
  flex: 1;
  width: 100%; max-width: var(--max-w);
  margin: 0 auto;
  padding: clamp(32px, 5vw, 56px) var(--gutter);
  display: flex; align-items: center; justify-content: space-between;
  gap: clamp(24px, 4vw, 48px);
}

.hero-content {
  flex: 1 1 auto; min-width: 0;
  display: flex; flex-direction: column; justify-content: center;
}

/* initial states required by the Motion One entrance */
.hero-title, .hero-badges { opacity: 0; }

.hero-title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(2.6rem, 6.5vw, 5rem);
  font-weight: 700;
  color: #F2F1EC;
  line-height: 1.04; letter-spacing: -0.025em;
  max-width: 720px;
  margin-bottom: 0;
  text-wrap: balance;
}
.period { color: #C42B3A; }

.hero-title::after {
  content: '';
  display: block;
  width: 44px; height: 3px;
  background: var(--red);
  margin-top: 20px;
}

.hero-badges { display: flex; gap: 10px; flex-wrap: wrap; }

/* ── Breadcrumb ── */
.bc-strip { background: #0B198F; }
.bc-inner {
  max-width: var(--max-w); margin: 0 auto;
  padding: 14px var(--gutter);
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  font-size: 0.78rem; color: rgba(255,255,255,0.6);
}
.bc-inner a { color: rgba(255,255,255,0.72); text-decoration: none; padding: 11px 0; display: inline-block; transition: color 0.2s; }
.bc-inner a:hover { color: #fff; text-decoration: underline; }
.bc-sep { color: rgba(255,255,255,0.35); }
.bc-current { color: #fff; font-weight: 600; }
.badge {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 7px 16px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.22);
  border-radius: var(--r-pill);
  font-family: 'DM Sans', sans-serif;
  font-size: 0.7rem; font-weight: 600; letter-spacing: 0.06em;
  color: rgba(255,255,255,0.72);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
}
.badge-sq {
  width: 6px; height: 6px;
  background: #C42B3A;
  border-radius: 50%; flex-shrink: 0;
  box-shadow: 0 0 8px rgba(196,43,58,0.7);
}

/* ═══════════════════════════════════════════
   GOOGLE FORM CARD (hero, right column)
   Title → Picture → Button, nothing else
   ═══════════════════════════════════════════ */
.gform-card {
  width: 320px; flex-shrink: 0;
  display: flex; flex-direction: column; gap: 14px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.22);
  border-radius: var(--r-lg);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  padding: 20px;
  box-shadow: 0 18px 50px rgba(0,0,0,0.35);
  /* initial state for the Motion One entrance */
  opacity: 0;
}
.gform-title {
  font-family: 'Playfair Display', serif;
  font-size: 1.2rem; font-weight: 700;
  color: #F2F1EC; line-height: 1.25;
}
.gform-visual {
  border-radius: var(--r-md); overflow: hidden;
  border: 1px solid rgba(255,255,255,0.25);
  background: rgba(255,255,255,0.06);
}
.gform-visual a { display: block; }
.gform-visual img {
  width: 100%; height: auto; max-height: 300px;
  object-fit: cover; object-position: top;
  display: block;
}
.gform-visual--empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 44px 16px; color: rgba(255,255,255,0.55);
}
.gform-visual--empty i { font-size: 2rem; opacity: 0.6; }
.gform-visual--empty span { font-size: 0.78rem; }
.gform-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  padding: 13px 22px; border-radius: var(--r-pill);
  background: var(--red-bright); color: #fff;
  font-family: 'DM Sans', sans-serif; font-weight: 700; font-size: 0.88rem;
  text-decoration: none; transition: all 0.25s var(--ease);
  box-shadow: 0 8px 22px rgba(196,43,58,0.4);
}
.gform-btn:hover { transform: translateY(-2px); background: #a9202f; box-shadow: 0 12px 28px rgba(196,43,58,0.5); }

/* ═══════════════════════════════════════════
   SERVICES AT A GLANCE — main content
   ═══════════════════════════════════════════ */
.poster-section {
  /* shade of blue at 70% opacity — the dark page base shows through 30% */
  background: rgba(164, 232, 118, 0.7);
  padding: clamp(56px, 8vw, 96px) var(--gutter) clamp(72px, 9vw, 112px);
}

.mho-poster {
  position: relative;
  width: min(800px, 100%);
  margin: 0 auto;
  border-radius: var(--r-lg);
  overflow: hidden;
  box-shadow: 0 24px 70px rgba(0,0,0,0.55);
  font-family: 'Roboto', sans-serif;
  isolation: isolate;
}

/* ── background layers ── */
.mhp-sky {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 55%;
  background: linear-gradient(180deg,
    #f5e6a3 0%, #f0d878 10%, #e8c85a 20%, #d4a843 30%, #c4943a 40%,
    #b8862d 50%, #a07025 60%, #8a6020 70%, #7a5520 80%, #6a4a1a 90%, #5a4015 100%);
}
.mhp-clouds {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 40%;
  background:
    radial-gradient(ellipse 300px 80px at 15% 20%, rgba(255,255,255,0.6) 0%, transparent 70%),
    radial-gradient(ellipse 250px 60px at 70% 15%, rgba(255,255,255,0.5) 0%, transparent 70%),
    radial-gradient(ellipse 200px 50px at 45% 30%, rgba(255,255,255,0.4) 0%, transparent 70%),
    radial-gradient(ellipse 350px 70px at 85% 25%, rgba(255,255,255,0.45) 0%, transparent 70%);
}
.mhp-mountains {
  position: absolute; top: 40%; left: 0;
  width: 100%; height: 35%;
}
.mhp-mountain-left {
  position: absolute; bottom: 0; left: 0;
  width: 45%; height: 100%;
  background: linear-gradient(135deg, #2d5a1e 0%, #1a3d10 40%, #0f2a08 100%);
  clip-path: polygon(0% 100%, 0% 30%, 15% 10%, 30% 20%, 45% 5%, 60% 25%, 75% 15%, 90% 30%, 100% 50%, 100% 100%);
}
.mhp-mountain-right {
  position: absolute; bottom: 0; right: 0;
  width: 50%; height: 90%;
  background: linear-gradient(225deg, #1a4a12 0%, #0f3008 50%, #0a2005 100%);
  clip-path: polygon(0% 60%, 10% 40%, 25% 20%, 40% 30%, 55% 10%, 70% 25%, 85% 15%, 100% 35%, 100% 100%, 0% 100%);
}
.mhp-mountain-center {
  position: absolute; bottom: 0; left: 20%;
  width: 60%; height: 70%;
  background: linear-gradient(180deg, #3a6a28 0%, #2a5018 50%, #1a3a0e 100%);
  clip-path: polygon(0% 100%, 10% 50%, 25% 30%, 40% 40%, 50% 20%, 60% 35%, 75% 25%, 90% 45%, 100% 60%, 100% 100%);
}
.mhp-river {
  position: absolute; bottom: 0; left: 0;
  width: 100%; height: 30%;
  background: linear-gradient(180deg,
    #8a9a7a 0%, #7a8a6a 10%, #6a7a5a 20%, #5a6a4a 30%, #4a5a3a 40%,
    #3a4a2a 50%, #2a3a1a 60%, #1a2a0a 70%, #0f1f05 80%, #0a1500 100%);
}
.mhp-river-water {
  position: absolute; bottom: 0; left: 0;
  width: 100%; height: 20%;
  background: linear-gradient(180deg,
    #6a8a5a 0%, #5a7a4a 20%, #4a6a3a 40%, #3a5a2a 60%, #2a4a1a 80%, #1a3a0a 100%);
}
.mhp-footer-bar {
  position: absolute; bottom: 0; left: 0;
  width: 100%; height: 110px;
  background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%);
  z-index: 5; pointer-events: none;
}

/* ── content ── */
.mhp-content {
  position: relative; z-index: 10;
  padding: clamp(28px, 5vw, 44px) clamp(20px, 5vw, 50px) 140px;
}
.mhp-title {
  font-family: 'Oswald', sans-serif; font-weight: 700;
  font-size: clamp(1.9rem, 6.5vw, 52px);
  color: #4a6a1a; line-height: 1.1;
  text-transform: uppercase; letter-spacing: 2px;
  text-align: center; margin-bottom: 15px;
  text-shadow: 1px 1px 2px rgba(255,255,255,0.3);
  white-space: pre-line; /* renders admin-entered line breaks */
}
.mhp-subtitle {
  text-align: center; font-weight: 700;
  font-size: clamp(0.7rem, 1.6vw, 14px);
  color: #5a7a2a; text-transform: uppercase; letter-spacing: 1px;
  margin-bottom: 5px;
}
.mhp-source {
  text-align: center; font-weight: 500;
  font-size: clamp(0.65rem, 1.4vw, 12px);
  color: #6a8a3a; font-style: italic;
  margin-bottom: clamp(16px, 3vw, 30px);
}

.mhp-col-header {
  text-align: right; font-weight: 500;
  font-size: 0.66rem; color: rgba(255,255,255,0.7);
  text-transform: uppercase; letter-spacing: 2px;
  margin-bottom: 10px; padding-right: 6px;
}

/* ── service rows — uniform yellow chips ── */
.mhp-row {
  display: flex; align-items: flex-start;
  margin-bottom: 14px; padding: 10px 14px;
  background: rgba(255, 230, 50, 0.88);
  border-radius: 6px;
}
.mhp-num {
  font-family: 'Oswald', sans-serif; font-weight: 700;
  font-size: clamp(1.3rem, 3.2vw, 26px);
  color: #3a5a10; min-width: 30px; text-align: center;
}
.mhp-sep {
  font-family: 'Oswald', sans-serif; font-weight: 400;
  font-size: clamp(1.3rem, 3.2vw, 26px);
  color: #3a5a10; margin: 0 8px;
}
.mhp-row-body { flex: 1; min-width: 0; }

.mhp-name {
  font-family: 'Oswald', sans-serif; font-weight: 700;
  font-size: clamp(1.05rem, 3vw, 24px);
  color: #3a5a10; text-transform: uppercase; letter-spacing: 1px;
  line-height: 1.2;
}
.mhp-desc {
  font-weight: 400; font-size: clamp(0.7rem, 1.6vw, 20px);
  color: #4a6a1a;
  margin-top: 4px; line-height: 1.45;
}
.mhp-bullets {
  margin: 4px 0 0 16px; padding: 0; list-style: disc;
}
.mhp-bullets li {
  font-size: 0.75rem; margin-bottom: 2px;
  color: #4a6a1a;
}
.mhp-detail {
  font-size: 0.7rem; color: #5a7a2a;
  margin-top: 4px; line-height: 1.4;
}

/* ── footer strip ── */
.mhp-footer-content {
  position: absolute; bottom: clamp(12px, 2.5vw, 18px);
  left: clamp(16px, 4vw, 44px); right: clamp(16px, 4vw, 44px);
  z-index: 10;
  display: flex; justify-content: space-between; align-items: flex-end;
  gap: 12px; flex-wrap: wrap;
}
.mhp-logos { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.mhp-logo-item {
  background: rgba(0,0,0,0.7);
  border: 2px solid rgba(255,255,255,0.3);
  padding: 6px 10px; border-radius: 4px; text-align: center;
}
.mhp-logo-item .l1 {
  font-family: 'Oswald', sans-serif; font-weight: 700;
  font-size: 12px; color: #e8c85a;
}
.mhp-logo-item .l2 { font-family: 'Roboto', sans-serif; font-size: 8px; color: #fff; }
.mhp-credit {
  font-family: 'Roboto', sans-serif; font-size: 10px; color: #fff;
  text-shadow: 1px 1px 3px rgba(0,0,0,0.9);
  display: flex; align-items: center; gap: 6px;
}
.mhp-credit-dot {
  width: 8px; height: 8px; background: #fff;
  border-radius: 50%; display: inline-block;
}

/* ═══════════════════════════════════════════
   RESPONSIVE
   ═══════════════════════════════════════════ */
@media (max-width: 900px) {
  /* stack: title/badges on top, form card below, both full width */
  .hero-inner { flex-direction: column; align-items: stretch; justify-content: center; gap: 28px; }
  .hero-content { align-items: flex-start; }
  .gform-card { width: 100%; max-width: 420px; margin: 0 auto; }
}
@media (max-width: 640px) {
  .mhp-content { padding-bottom: 32px; }
  .mhp-footer-bar { height: 180px; }
  .mhp-footer-content {
    position: relative; bottom: auto;
    left: auto; right: auto;
    padding: 8px 18px 18px;
  }
  .mhp-row { padding: 7px 9px; }
  .gform-card { padding: 16px; }
}

/* respect users who prefer less motion */
@media (prefers-reduced-motion: reduce) {
  .mho-page *,
  .mho-page *::before,
  .mho-page *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
  .hero-bg { animation: none !important; }
}
</style>