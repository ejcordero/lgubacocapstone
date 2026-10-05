<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { API } from '../api'

// ── Fallback: identical to the old hardcoded content, used ONLY if the
//    API is unreachable. Once loaded, everything comes from the DB
//    (managed by admins in History Manager).
const DEFAULTS = {
  info: {
    title: 'History of Baco',
    heroSub: "The story of one of Mindoro's oldest towns — from being the province's first capital to the strong community it is today.",
    introText: `Baco is one of the oldest towns in Mindoro. After Minolo — now just a small village of Puerto Galera — Baco became the official capital of the province in 1575. Fr. Antoon Postma, a priest and historian who studied Mindoro, wrote that the island's first church was built here in 1567. Baco stayed as the capital for about a hundred years, until 1679, when the province was led by Corregidor Joseph de Chavez.

Where did the name Baco come from? There are two stories. Some say it came from paco, a fern that grows in the area and can be eaten. Others say it came from baku-bako — the holes left on the roads after heavy floods that used to last three to four days.

The first Spanish missionaries settled along the coast in Tabontabon. But Moro pirates attacked the shore almost every year, so the people moved inland — first to Libtong (now Lumangbayan), where they built a church, and later to San Andres. By 1733, the church itself had moved to Calapan, making it the church center for the whole island of Mindoro.

Baco lost the capital in 1679 but never gave up. It survived revolution, being joined with Calapan, and the slow sinking of its old town sites, before finally settling at Calabugao in 1948. Today, Baco stands as proof of the strength and rich heritage of its people.`,
    heritageNote: 'Baco is home to the <strong>Alangan and Iraya Mangyan</strong> — two of the eight Mangyan groups of Mindoro. Their traditions and right to their ancestral lands remain a big part of who the people of Baco are.',
    facts: [
      { label: 'Founded', value: '1575' },
      { label: 'Former Role', value: 'Capital of Mindoro (1575–1679)' },
      { label: 'First Church Settlement', value: 'Tabontabon' },
      { label: 'Classification', value: '1st Class Municipality' },
      { label: 'Province', value: 'Oriental Mindoro' },
    ],
    asideImage: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ9Ty9-hPDQVJw7lQGiFnuODTJ_8VBdgsfKUWf5-hDuTLnNHior4o1qVQ-v&s=10',
  },
}

const info = ref({ ...DEFAULTS.info, facts: [...DEFAULTS.info.facts] })

// Hero title is split so the final word can carry the red accent
const heroTitleWords = computed(() => (info.value.title || '').split(' ').filter(Boolean))
const heroTitleLead = computed(() => heroTitleWords.value.length > 1 ? heroTitleWords.value.slice(0, -1).join(' ') : (info.value.title || ''))
const heroTitleAccent = computed(() => heroTitleWords.value.length ? heroTitleWords.value[heroTitleWords.value.length - 1] + '.' : '')

const timeline = ref([])
const gallery = ref([])

const loadContent = async () => {
  try {
    const res = await fetch(`${API}/history-content`, { cache: 'no-store' })
        if (!res.ok) return // keep defaults
    const data = await res.json()
    if (data.info) info.value = { ...data.info }
    timeline.value = data.timeline || []
    gallery.value = data.gallery || []
  } catch (e) {
    console.warn('History content unavailable — using defaults.', e)
  }
}

const introParas = computed(() =>
  (info.value.introText || '').split('\n\n').map(p => p.trim()).filter(Boolean)
)

// Lightbox
const lightboxOpen = ref(false)
const activeImg = ref(null)
const openLightbox = (img) => { activeImg.value = img; lightboxOpen.value = true }
const closeLightbox = () => { lightboxOpen.value = false; activeImg.value = null }
const onLbKey = (e) => { if (e.key === 'Escape' && lightboxOpen.value) closeLightbox() }

let gsapMod = null, ScrollTriggerMod = null, lenisInst = null, tickerFn = null

const initAnimations = () => {
  const { gsap: g } = gsapMod
  const ST = ScrollTriggerMod
  g.registerPlugin(ST)

  lenisInst = new Lenis({ duration: 1.2, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true })
  tickerFn = (time) => { if (lenisInst) lenisInst.raf(time * 1000) }
  lenisInst.on('scroll', ST.update)
  g.ticker.add(tickerFn)
  g.ticker.lagSmoothing(0)

  g.to('.hero-bg', {
    yPercent: 20, ease: 'none',
    scrollTrigger: { trigger: '.history-hero', start: 'top top', end: 'bottom top', scrub: true }
  })
  g.fromTo(['.hero-kicker', '.hero-title', '.hero-divider', '.hero-sub'],
    { opacity: 0, y: 28 },
    { opacity: 1, y: 0, stagger: 0.1, duration: 1, ease: 'power2.out', delay: 0.25 })

  g.utils.toArray('.reveal').forEach(el => {
    g.fromTo(el, { opacity: 0, y: 32 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 86%', once: true } })
  })

  // Timeline rows exist now (loaded from DB before this runs)
  document.querySelectorAll('.tl-row').forEach(row => {
    const yearPanel = row.querySelector('.tl-year-panel')
    const textEl = row.querySelector('.tl-text-block')
    if (yearPanel) {
      g.fromTo(yearPanel, { clipPath: 'inset(0 100% 0 0)' },
        { clipPath: 'inset(0 0% 0 0)', ease: 'power2.inOut',
          scrollTrigger: { trigger: row, start: 'top 85%', end: 'top 15%', scrub: 1 } })
    }
    if (textEl) {
      g.fromTo(textEl, { opacity: 0, y: 36 },
        { opacity: 1, y: 0, ease: 'power2.out',
          scrollTrigger: { trigger: row, start: 'top 75%', end: 'top 20%', scrub: 0.9 } })
    }
  })

  g.utils.toArray('.gallery-card').forEach((card, i) => {
    g.fromTo(card, { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out', delay: (i % 3) * 0.06,
        scrollTrigger: { trigger: card, start: 'top 88%', once: true } })
  })
}

onMounted(async () => {
  window.addEventListener('keydown', onLbKey)
  const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
    import('gsap'), import('gsap/ScrollTrigger'), import('lenis'),
  ])
  gsapMod = { gsap }
  ScrollTriggerMod = ScrollTrigger

  await loadContent()
  await nextTick()          // timeline/gallery DOM now rendered from DB data
  initAnimations()          // THEN attach scroll animations
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onLbKey)
  if (gsapMod && tickerFn) gsapMod.gsap.ticker.remove(tickerFn)  // ← fixes the ticker leak
  if (lenisInst) lenisInst.destroy()
  if (ScrollTriggerMod) ScrollTriggerMod.getAll().forEach(t => t.kill())
})
</script>

<template>
  <div class="history-page">

    <!-- ══ HERO ══ -->
    <section class="history-hero">
      <div class="hero-bg"></div>
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <span class="hero-kicker">Municipality of Baco · Oriental Mindoro</span>
        <h1 class="hero-title">{{ heroTitleLead }} <em>{{ heroTitleAccent }}</em></h1>
        <div class="hero-divider"></div>
        <p class="hero-sub">{{ info.heroSub }}</p>
      </div>
    </section>

    <!-- ══ INTRO ══ -->
    <section class="intro-section">
      <div class="wrap">
        <h2 class="intro-heading reveal">{{ info.title }}</h2>
        <div class="intro-grid">
          <div class="intro-text reveal">
            <p
              v-for="(para, i) in introParas"
              :key="i"
              class="article-para"
              :class="{ 'has-dropcap': i === 0 }"
            >{{ para }}</p>

            <div v-if="info.facts && info.facts.length" class="inline-facts reveal">
              <div v-for="(f, i) in info.facts" :key="i" class="ifact">
                <span class="ifact-label">{{ f.label }}</span>
                <span class="ifact-val">{{ f.value }}</span>
              </div>
            </div>
          </div>

          <div class="intro-aside reveal">
            <div v-if="info.asideImage" class="intro-img-wrap">
              <img :src="info.asideImage" alt="Historic Baco" />
            </div>
            <div v-if="info.heritageNote" class="heritage-note">
              <span class="heritage-label">Indigenous Heritage</span>
              <p v-html="info.heritageNote"></p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══ TIMELINE ══ -->
    <section class="timeline-section">
      <div class="wrap">
        <h2 class="tl-section-heading reveal">Historical <em>Timeline</em></h2>
        <div class="tl-list">
          <div
            v-for="(item, i) in timeline"
            :key="item.id"
            class="tl-row"
            :class="{ 'tl-row--flip': i % 2 !== 0 }"
          >
            <div class="tl-divider" aria-hidden="true"></div>
            <div class="tl-row-inner">
              <div class="tl-year-side">
                <div class="tl-year-panel">
                  <span class="tl-year-num">{{ item.year }}</span>
                  <span class="tl-year-rule" aria-hidden="true"></span>
                </div>
              </div>
              <div class="tl-text-side">
                <div class="tl-text-block">
                  <span v-if="item.label" class="tl-label">{{ item.label }}</span>
                  <h3 class="tl-event">{{ item.event }}</h3>
                  <p class="tl-detail">{{ item.detail }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══ GALLERY ══ -->
    <section class="gallery-section">
      <div class="wrap">
        <div class="gallery-header reveal">
          <span class="section-tag">Visual Archive</span>
          <h2 class="gallery-heading">Historical Records</h2>
          <p class="gallery-sub">Old photos that keep the story and heritage of the Municipality of Baco alive.</p>
        </div>
        <div v-if="gallery.length" class="gallery-grid">
          <div
            v-for="img in gallery"
            :key="img.id"
            class="gallery-card"
            role="button"
            tabindex="0"
            :aria-label="`View: ${img.title}`"
            @click="openLightbox(img)"
            @keydown.enter="openLightbox(img)"
          >
            <div class="card-img"><img :src="img.image" :alt="img.title" loading="lazy" /></div>
            <div class="card-body">
              <span class="card-year">{{ img.year }}</span>
              <h3 class="card-title">{{ img.title }}</h3>
              <p class="card-desc">{{ img.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══ LIGHTBOX ══ -->
    <Transition name="fade">
      <div v-if="lightboxOpen" class="lightbox" role="dialog" aria-modal="true" @click="closeLightbox">
        <button class="lb-close" aria-label="Close" @click="closeLightbox">
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
        <div class="lb-content" @click.stop>
          <img :src="activeImg?.image" :alt="activeImg?.title" class="lb-img" />
          <p class="lb-cap">
            <span class="lb-badge">{{ activeImg?.year }}</span>
            {{ activeImg?.title }}
          </p>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

/* ═══════════════════════════════════════════
   TOKENS — scoped to .history-page so they
   don't leak into other pages (the old :root
   was polluting global scope)
   ═══════════════════════════════════════════ */
.history-page {
  --white:     #FFFFFF;
  --surface:   #F5F6F8;
  --border:    #E3E5EA;
  --navy:      #000c7b;
  --navy-deep: #07115E;
  --red:       #970718;
  --gold:      #C9862F;
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
  overflow-x: hidden; /* giant year numerals — keep */
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.history-page *,
.history-page *::before,
.history-page *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.history-page ::selection { background: var(--navy); color: #fff; }
.history-page :focus-visible { outline: 2px solid var(--red); outline-offset: 3px; border-radius: 3px; }

.wrap {
  max-width: var(--max-w);
  margin: 0 auto;
  padding: 0 var(--gutter);
}

/* shared editorial motif: small caps tag */
.section-tag {
  display: block;
  font-size: 0.6rem; font-weight: 700;
  letter-spacing: 0.24em; text-transform: uppercase;
  color: var(--red); margin-bottom: 12px;
}

/* ═══════════════════════════════════════════
   HERO — now perfectly aligned with .wrap
   (old version double-offset by one gutter)
   ═══════════════════════════════════════════ */
.history-hero {
  position: relative;
  height: 68svh; min-height: 460px; max-height: 640px;
  overflow: hidden;
  background: var(--navy-deep);
}

.hero-bg {
  position: absolute; inset: 0;
  background: url('/images/former-minicipal-img.jpg') center 35% / cover no-repeat;
  filter: grayscale(25%) brightness(0.45);
  will-change: transform;
}

/* archival grain, matching Municipality hero */
.history-hero::after {
  content: '';
  position: absolute; inset: 0; z-index: 3;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
  background-size: 180px;
  pointer-events: none;
  mix-blend-mode: overlay;
}

.hero-overlay {
  position: absolute; inset: 0; z-index: 1;
  background:
    linear-gradient(to right,
      rgba(4,10,60,0.97) 0%,
      rgba(7,17,94,0.92) 48%,
      rgba(11,25,143,0.22) 100%),
    linear-gradient(to top, rgba(4,10,60,0.55) 0%, transparent 40%);
}

/* same max-width + gutter as .wrap → title aligns
   with "The Story of Baco" and the content column */
.hero-content {
  position: relative; z-index: 2;
  width: 100%; max-width: var(--max-w);
  margin: 0 auto;
  padding: 0 var(--gutter);
  height: 100%;
  display: flex; flex-direction: column; justify-content: center;
}

.hero-kicker {
  display: block; font-size: 0.62rem; font-weight: 600;
  letter-spacing: 0.26em; text-transform: uppercase;
  color: rgba(255,255,255,0.5); margin-bottom: 18px;
  opacity: 0; /* GSAP */
}

.hero-title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(2.2rem, 6.5vw, 5rem); font-weight: 700;
  color: #F2F1EC;
  line-height: 1.04; letter-spacing: -0.025em;
  max-width: 640px;
  margin-bottom: 22px;
  text-wrap: balance;
  opacity: 0; /* GSAP */
}
.hero-title em { font-style: normal; color: var(--red); }

.hero-divider {
  width: 44px; height: 3px;
  background: var(--red);
  margin-bottom: 20px;
  opacity: 0; /* GSAP */
}

.hero-sub {
  font-family: 'EB Garamond', serif;
  font-size: clamp(1.05rem, 1.5vw, 1.22rem);
  color: rgba(255,255,255,0.66); line-height: 1.75;
  max-width: 46ch; font-style: italic;
  opacity: 0; /* GSAP */
}

/* ═══════════════════════════════════════════
   BREADCRUMB
   ═══════════════════════════════════════════ */
.breadcrumb-bar {
  background: var(--navy);
  border-bottom: 1px solid rgba(255,255,255,0.08);
  padding: 13px 0;
}
.breadcrumb-bar .wrap {
  display: flex; align-items: center; gap: 9px;
  font-size: 0.74rem; color: rgba(255,255,255,0.55);
}
.breadcrumb-bar a {
  color: #fff; text-decoration: none; font-weight: 500;
  padding: 7px 0; display: inline-block;
  transition: color 0.18s;
}
.breadcrumb-bar a:hover { color: var(--gold); }
.breadcrumb-bar i { font-size: 0.5rem; color: rgba(255,255,255,0.35); }
.breadcrumb-bar span { color: rgba(255,255,255,0.8); font-weight: 600; }

/* ═══════════════════════════════════════════
   INTRO
   ═══════════════════════════════════════════ */
.intro-section {
  padding: clamp(72px, 9vw, 108px) 0 clamp(56px, 7vw, 88px);
  background: var(--white);
}

/* unified section-heading motif: red rule above,
   navy-deep serif title (calmer than all-red) */
.intro-heading,
.tl-section-heading,
.gallery-heading {
  font-family: 'Playfair Display', serif;
  font-weight: 800;
  color: var(--navy-deep);
  letter-spacing: -0.02em;
  line-height: 0.95;
  text-transform: uppercase;
}
.tl-section-heading em,
.gallery-heading em { font-style: normal; color: var(--red); }
.intro-heading::before,
.tl-section-heading::before,
.gallery-heading::before {
  content: '';
  display: block;
  width: 44px; height: 3px;
  background: var(--red);
  margin-bottom: 20px;
}

.intro-heading {
  font-size: clamp(2rem, 4vw, 3rem);
  margin-bottom: clamp(40px, 6vw, 60px);
  max-width: 640px;
}

.intro-grid {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 0 clamp(48px, 6vw, 76px);
  align-items: start;
}

.article-para {
  font-family: 'EB Garamond', serif;
  font-size: 1.08rem; color: var(--ink-body);
  line-height: 1.9; margin-bottom: 22px;
}
.has-dropcap::first-letter {
  font-family: 'Playfair Display', serif;
  font-size: 4.1rem; font-weight: 700; color: var(--navy);
  float: left; line-height: 0.78; margin: 9px 13px 0 0;
}

/* facts — clean ruled table: every row bordered,
   one column divider, no dangling last-row line */
.inline-facts {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  border-top: 1px solid var(--border);
  margin-top: 36px;
}
.ifact {
  display: flex; flex-direction: column; gap: 4px;
  padding: 15px 0;
  border-bottom: 1px solid var(--border);
}
.ifact:nth-child(odd):not(:last-child) { border-right: 1px solid var(--border); }
.ifact:nth-child(even) { padding-left: 22px; }
.ifact-label {
  font-size: 0.6rem; font-weight: 600;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--ink-faint);
}
.ifact-val {
  font-size: 0.95rem; font-weight: 700; color: var(--navy);
  line-height: 1.4;
}

/* aside — photo-mount frame + heritage note */
.intro-aside {
  display: flex; flex-direction: column; gap: 24px;
  position: sticky; top: 32px;
}
.intro-img-wrap {
  width: 100%;
  padding: 10px;
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--r);
  box-shadow: var(--sh-1);
}
.intro-img-wrap img {
  width: 100%; aspect-ratio: 3/4;
  object-fit: cover; display: block;
  border-radius: 2px;
  filter: grayscale(100%);
  transition: filter 0.5s ease;
}
.intro-img-wrap:hover img { filter: grayscale(0%); }

.heritage-note {
  border-top: 3px solid var(--red);
  padding: 18px 2px 0;
}
.heritage-label {
  display: block; font-size: 0.58rem; font-weight: 700;
  letter-spacing: 0.24em; text-transform: uppercase;
  color: var(--red); margin-bottom: 10px;
}
.heritage-note p {
  font-family: 'EB Garamond', serif;
  font-size: 0.98rem; color: var(--ink-body);
  line-height: 1.7;
}
.heritage-note strong { color: var(--navy); }

/* ═══════════════════════════════════════════
   TIMELINE — true mirrored axis
   (year panel always 55%, text opposite,
    seam + node mark each entry)
   ═══════════════════════════════════════════ */
.timeline-section {
  padding: 0 0 clamp(72px, 9vw, 120px);
  background: var(--white);
  border-top: 1px solid var(--border);
}

.tl-section-heading {
  font-size: clamp(1.8rem, 3.5vw, 2.8rem);
  padding: clamp(56px, 7vw, 84px) 0 clamp(36px, 5vw, 56px);
}

.tl-list { display: flex; flex-direction: column; }

.tl-divider {
  width: 100%; height: 1px;
  background: linear-gradient(to right,
    transparent, var(--border) 8%, var(--border) 92%, transparent);
}

.tl-row-inner {
  /* grid geometry drives the seam position */
  --yr: 55%;
  --tl-gap: clamp(48px, 6vw, 80px);
  position: relative;
  display: grid;
  grid-template-columns: var(--yr) 1fr;
  column-gap: var(--tl-gap);
  align-items: start;
  padding: clamp(44px, 6vw, 68px) 0;
}

/* mirrored rows: year panel moves right, stays 55% */
.tl-row--flip .tl-year-side { order: 2; }
.tl-row--flip .tl-text-side { order: 1; }
.tl-row--flip .tl-row-inner {
  grid-template-columns: 1fr var(--yr);
}

/* center seam */
.tl-row-inner::before {
  content: '';
  position: absolute; top: 18px; bottom: 18px;
  left: calc(var(--yr) + var(--tl-gap) / 2);
  width: 1px;
  background: linear-gradient(to bottom,
    transparent, rgba(7,17,94,0.14) 18%, rgba(7,17,94,0.14) 82%, transparent);
  pointer-events: none;
}
.tl-row--flip .tl-row-inner::before {
  left: calc(100% - var(--yr) - var(--tl-gap) / 2);
}

/* node marking each entry */
.tl-row-inner::after {
  content: '';
  position: absolute; top: 50%;
  left: calc(var(--yr) + var(--tl-gap) / 2);
  transform: translate(-50%, -50%);
  width: 11px; height: 11px; border-radius: 50%;
  background: var(--red);
  box-shadow:
    0 0 0 4px var(--white),
    0 0 0 5px var(--border),
    0 4px 10px rgba(7,17,94,0.15);
  pointer-events: none;
}
.tl-row--flip .tl-row-inner::after {
  left: calc(100% - var(--yr) - var(--tl-gap) / 2);
}

.tl-year-side { width: 100%; min-width: 0; }

.tl-year-panel {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 2;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 18px;
  padding: 24px;
  text-align: center;
  background: linear-gradient(160deg, #FAFBFD, var(--surface));
  border: 1px solid var(--border);
  border-radius: var(--r);
  overflow: hidden;
  transition: border-color 0.4s ease, box-shadow 0.4s ease;
}
/* faint archival paper grain */
.tl-year-panel::before {
  content: '';
  position: absolute; inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
  background-size: 160px;
  pointer-events: none;
}
.tl-row:hover .tl-year-panel {
  border-color: rgba(7,17,94,0.32);
  box-shadow: var(--sh-1);
}

.tl-year-num {
  font-family: 'Playfair Display', serif;
  font-size: clamp(3.6rem, 8.5vw, 7.5rem);
  font-weight: 700;
  color: var(--red);
  line-height: 0.9;
  letter-spacing: -0.04em;
}

.tl-year-rule {
  width: 44px; height: 3px;
  background: var(--red);
  transition: width 0.4s var(--ease);
}
.tl-row:hover .tl-year-rule { width: 64px; }

.tl-text-side {
  display: flex; flex-direction: column;
  justify-content: flex-start;
  min-width: 0;
  /* gap provides the breathing room on both variants */
}

.tl-text-block { opacity: 0; } /* GSAP fromTo */

.tl-label {
  display: block;
  font-family: 'Playfair Display', serif;
  font-size: clamp(1rem, 1.8vw, 1.35rem);
  font-weight: 700; color: var(--red);
  line-height: 1.2; margin-bottom: 13px;
}

.tl-event {
  font-family: 'Playfair Display', serif;
  font-size: clamp(0.95rem, 1.4vw, 1.08rem);
  font-weight: 600; color: var(--ink);
  line-height: 1.45; letter-spacing: -0.01em;
  margin-bottom: 13px;
}

.tl-detail {
  font-family: 'EB Garamond', serif;
  font-size: 1rem; color: var(--ink-body);
  line-height: 1.78;
}

/* ═══════════════════════════════════════════
   GALLERY
   ═══════════════════════════════════════════ */
.gallery-section {
  background: var(--white);
  padding: clamp(64px, 8vw, 100px) 0 clamp(72px, 9vw, 112px);
  border-top: 1px solid var(--border);
}

.gallery-header { margin-bottom: clamp(36px, 5vw, 52px); }

.gallery-heading {
  font-size: clamp(1.6rem, 3vw, 2.4rem);
  line-height: 1.15;
  margin-bottom: 10px;
}
.gallery-sub {
  font-family: 'EB Garamond', serif;
  font-size: 1.05rem; color: var(--ink-muted);
  line-height: 1.68; font-style: italic;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 44px 28px;
}

.gallery-card {
  cursor: pointer;
  opacity: 0; /* GSAP stagger */
}
.gallery-card:focus-visible { outline: 2px solid var(--red); outline-offset: 3px; }

.card-img {
  width: 100%; aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--surface);
  border-radius: var(--r);
  border: 1px solid var(--border);
  margin-bottom: 16px;
  transition: box-shadow 0.4s ease;
}
.card-img img {
  width: 100%; height: 100%;
  object-fit: cover; display: block;
  filter: grayscale(100%);
  transition: filter 0.45s ease, transform 0.55s var(--ease);
}
.gallery-card:hover .card-img {
  box-shadow: var(--sh-1);
}
.gallery-card:hover .card-img img {
  filter: grayscale(0%); transform: scale(1.035);
}

.card-body { padding: 0 2px; }

.card-year {
  display: flex; align-items: center; gap: 8px;
  font-size: 0.7rem; font-weight: 600;
  color: var(--ink-muted); letter-spacing: 0.08em;
  margin-bottom: 7px;
}
.card-year::before {
  content: '';
  width: 16px; height: 2px;
  background: var(--red);
  flex-shrink: 0;
}
.card-title {
  font-family: 'Playfair Display', serif;
  font-size: 1.02rem; font-weight: 700;
  color: var(--ink); line-height: 1.3;
  margin-bottom: 6px;
}
.gallery-card:hover .card-title { color: var(--navy); }
.card-title { transition: color 0.2s; }

.card-desc {
  font-family: 'EB Garamond', serif;
  font-size: 0.94rem; color: var(--ink-muted);
  line-height: 1.62;
}

/* ═══════════════════════════════════════════
   LIGHTBOX
   ═══════════════════════════════════════════ */
.lightbox {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(7,17,94,0.93);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  display: flex; align-items: center; justify-content: center;
  padding: clamp(20px, 4vw, 40px);
  cursor: zoom-out;
}
.lb-close {
  position: absolute; top: 20px; right: 20px;
  width: 44px; height: 44px; border-radius: 50%;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.24);
  color: #fff; cursor: pointer; font-size: 0.95rem;
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  transition: background 0.2s, transform 0.25s var(--ease);
}
.lb-close:hover {
  background: var(--red); border-color: var(--red);
  transform: rotate(90deg);
}
.lb-content {
  max-width: 960px; width: 100%;
  text-align: center;
  cursor: default;
}
.lb-img {
  width: 100%; max-height: 76vh;
  object-fit: contain; display: block;
  margin: 0 auto 20px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px;
  box-shadow: 0 30px 80px rgba(0,0,0,0.5);
}
.lb-cap {
  display: flex; align-items: center; justify-content: center; gap: 14px;
  font-family: 'Playfair Display', serif;
  font-size: 1.02rem; color: rgba(255,255,255,0.78);
}
.lb-badge {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.62rem; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  background: var(--red); color: var(--white);
  padding: 4px 11px; border-radius: 100px;
}

/* ═══════════════════════════════════════════
   VUE TRANSITIONS
   ═══════════════════════════════════════════ */
.fade-enter-active, .fade-leave-active { transition: opacity 0.28s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.fade-enter-active .lb-content { transition: transform 0.35s var(--ease); }
.fade-enter-from .lb-content { transform: scale(0.96) translateY(10px); }

/* ═══════════════════════════════════════════
   RESPONSIVE
   ═══════════════════════════════════════════ */
@media (max-width: 1024px) {
  .intro-grid { grid-template-columns: 1fr 300px; }

  /* narrower year column, tighter seam */
  .tl-row-inner { --yr: 48%; }
}

@media (max-width: 860px) {
  .intro-grid { grid-template-columns: 1fr; gap: 48px 0; }
  .intro-aside { position: static; flex-direction: row; gap: 24px; align-items: flex-start; }
  .intro-img-wrap { max-width: 240px; flex-shrink: 0; }

  /* timeline stacks: panel above text, axis hidden */
  .tl-row-inner,
  .tl-row--flip .tl-row-inner {
    grid-template-columns: 1fr;
    padding: 44px 0;
  }
  .tl-row--flip .tl-year-side,
  .tl-row--flip .tl-text-side { order: unset; }
  .tl-row-inner::before,
  .tl-row-inner::after { display: none; }
  .tl-year-panel { aspect-ratio: auto; padding: 40px 24px; }
  .tl-year-num { font-size: clamp(3rem, 12vw, 5rem); }
  .tl-text-side { padding-top: 24px; }

  .gallery-grid { grid-template-columns: repeat(2, 1fr); gap: 36px 20px; }
}

@media (max-width: 580px) {
  .gallery-grid { grid-template-columns: 1fr; gap: 36px; }

  .inline-facts { grid-template-columns: 1fr; }
  .ifact:nth-child(odd):not(:last-child) { border-right: none; }
  .ifact:nth-child(even) { padding-left: 0; }

  .intro-aside { flex-direction: column; }
  .intro-img-wrap { max-width: 100%; }

  .tl-row-inner,
  .tl-row--flip .tl-row-inner { padding: 36px 0; }

  .lightbox { padding: 16px; }
  .lb-cap { flex-direction: column; gap: 8px; }
}

/* respect users who prefer less motion */
@media (prefers-reduced-motion: reduce) {
  .history-page *,
  .history-page *::before,
  .history-page *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
</style>