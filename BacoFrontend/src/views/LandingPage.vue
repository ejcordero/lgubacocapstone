<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'

// ═══ CONFIG ═══
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api'
const NEWS_API = `${API_BASE}/news`

// ═══ MAYOR'S MESSAGE ═══
const mayor = {
  name: 'Hon. Allan "AR" A. Roldan',
  title: 'Municipal Mayor',
  image: '/images/mayor-imgs.jpg',
  quote: 'Together, we are building a Baco that is socially just — where every citizen has access to quality services, education, and the opportunity to thrive.',
  body: 'Our administration remains steadfast in its commitment to transparent, accountable, and inclusive governance. Every decision is guided by the best interests of the people of Baco — from the foothills of Mt. Halcon to our coastal barangays.'
}

// ═══ SERVICES (bento) ═══
// Static content — links route to the relevant portals
const services = [
  { key: 'welfare', to: '/citizens-charter', icon: 'fa-solid fa-hands-holding-child', title: 'Social Welfare',
    desc: 'Assistance for families, senior citizens, persons with disabilities, and vulnerable communities across all 27 barangays.' },
  { key: 'health',  to: '/mho', icon: 'fa-solid fa-kit-medical', title: 'Health Services',
    desc: 'Rural health unit schedules, vaccination drives, and outreach programs for all residents of Baco.' },
  { key: 'permits', to: '/bplo', icon: 'fa-solid fa-file-signature', title: 'Permits & Licensing',
    desc: 'Business permits, civil registry documents, and municipal licensing through the BPLO.' },
  { key: 'agri',    to: '/citizens-charter', icon: 'fa-solid fa-wheat-awn', title: 'Agricultural Support',
    desc: 'Technical assistance, seed distribution, and market linkages for farmers and cooperatives.' },
]

// ═══ NEWS & UPDATES (from the database) ═══
const newsItems = ref([])
const newsLoaded = ref(false)

const CATS = [
  { label: 'Announcement',    color: '#0B198F', bg: 'rgba(11,25,143,0.09)' },
  { label: 'Tourism',         color: '#C98A2B', bg: 'rgba(201,138,43,0.09)' },
  { label: 'Health',          color: '#0d7a3e', bg: 'rgba(16,130,68,0.09)' },
  { label: 'Education',       color: '#3D6BD6', bg: 'rgba(61,107,214,0.09)' },
  { label: 'Agriculture',     color: '#1b7a3d', bg: 'rgba(27,122,61,0.09)' },
  { label: 'Infrastructure',  color: '#6b5b95', bg: 'rgba(107,91,149,0.09)' },
  { label: 'Social Services', color: '#0E7490', bg: 'rgba(14,116,144,0.09)' },
  { label: 'Environment',     color: '#1b7a3d', bg: 'rgba(27,122,61,0.09)' },
  { label: 'Events',          color: '#CE1126', bg: 'rgba(206,17,38,0.09)' },
  { label: 'Public Advisory', color: '#CE1126', bg: 'rgba(206,17,38,0.09)' },
]
const FALLBACK_CAT = { label: 'Bulletin', color: '#3D6BD6', bg: 'rgba(61,107,214,0.09)' }

const stripHtml = (html) => (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const readTimeFor = (item) => {
  const words = `${stripHtml(item.content)} ${item.title || ''}`.trim().split(/\s+/).filter(Boolean).length
  return `${Math.max(1, Math.ceil(words / 200))} min read`
}

const fetchNews = async () => {
  try {
    const res = await fetch(NEWS_API)
    if (res.ok) {
      const raw = await res.json()
      newsItems.value = raw.map((item) => {
        const cat = CATS.find(c => c.label === item.category) || FALLBACK_CAT
        const excerpt = stripHtml(item.content).slice(0, 220)
        return {
          ...item,
          title: item.title || 'Untitled announcement',
          categoryLabel: cat.label,
          categoryColor: cat.color,
          categoryBg: cat.bg,
          excerpt: excerpt || 'Stay tuned for more updates from the Municipality of Baco.',
          gallery: Array.isArray(item.gallery) && item.gallery.length ? item.gallery : (item.image ? [item.image] : []),
          readTime: readTimeFor(item),
        }
      })
    }
  } catch (e) {
    console.error('Error fetching news:', e)
  }
  newsLoaded.value = true
}

// ── STORY MODAL — full-screen article (same UX as the News page) ──
const storyModalOpen = ref(false)
const currentStory = ref(null)
const currentSlide = ref(0)

const storySlides = computed(() => {
  const item = currentStory.value
  if (!item) return []
  return item.gallery?.length ? item.gallery : (item.image ? [item.image] : [])
})

const openStory = (item) => {
  currentStory.value = item
  storyModalOpen.value = true
  lightboxOpen.value = false
  currentSlide.value = 0
  document.body.style.overflow = 'hidden'
  nextTick(() => {
    const el = document.querySelector('.story-modal')
    if (el) el.scrollTop = 0
  })
  startAutoSlide()
}

const closeStory = () => {
  storyModalOpen.value = false
  lightboxOpen.value = false
  document.body.style.overflow = ''
  stopAutoSlide()
}

const nextSlide = () => { const n = storySlides.value.length; if (n) currentSlide.value = (currentSlide.value + 1) % n }
const prevSlide = () => { const n = storySlides.value.length; if (!n) return; currentSlide.value = currentSlide.value === 0 ? n - 1 : currentSlide.value - 1; kickAutoSlide() }
const goToSlide = (i) => { currentSlide.value = i; kickAutoSlide() }
const manualNext = () => { nextSlide(); kickAutoSlide() }

let slideTimer = null
const AUTO_SLIDE_MS = 4000
const startAutoSlide = () => {
  stopAutoSlide()
  if (storySlides.value.length < 2) return
  slideTimer = setInterval(() => { nextSlide() }, AUTO_SLIDE_MS)
}
const stopAutoSlide = () => { if (slideTimer) { clearInterval(slideTimer); slideTimer = null } }
const kickAutoSlide = () => { if (storyModalOpen.value && storySlides.value.length > 1) startAutoSlide() }

// ── FULLSCREEN IMAGE VIEWER ──
const lightboxOpen = ref(false)
const lightboxIndex = ref(0)
const openLightbox = (i) => { lightboxIndex.value = i; lightboxOpen.value = true; stopAutoSlide() }
const closeLightbox = () => { lightboxOpen.value = false; kickAutoSlide() }
const lightboxNext = () => { const n = storySlides.value.length; if (n) lightboxIndex.value = (lightboxIndex.value + 1) % n }
const lightboxPrev = () => { const n = storySlides.value.length; if (!n) return; lightboxIndex.value = lightboxIndex.value === 0 ? n - 1 : lightboxIndex.value - 1 }

const storyBody = computed(() => {
  const item = currentStory.value
  if (!item) return ''
  if (item.content) return item.content
  return `<p>${item.excerpt}</p><p>This story is published by the Municipality of Baco, Oriental Mindoro. Follow the official channels of the municipality for more news and announcements.</p>`
})

const currentStoryIdx = computed(() => {
  const item = currentStory.value
  if (!item) return -1
  return newsItems.value.findIndex(x => x.id === item.id)
})
const prevStory = computed(() => { const i = currentStoryIdx.value; return i > 0 ? newsItems.value[i - 1] : null })
const nextStory = computed(() => { const i = currentStoryIdx.value; return i >= 0 && i < newsItems.value.length - 1 ? newsItems.value[i + 1] : null })

const relatedStories = computed(() => {
  const item = currentStory.value
  if (!item) return []
  return newsItems.value.filter(x => x.id !== item.id)
    .sort((a, b) => ((a.id * 7 + 3) % 5) - ((b.id * 7 + 3) % 5))
    .slice(0, 2)
})

// ── SHARE + TOASTS ──
let toastSeq = 0
const toasts = ref([])
const showToast = (message, icon = 'check') => {
  const id = ++toastSeq
  toasts.value.push({ id, message, icon })
  setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id) }, 3000)
}
const shareStory = () => {
  const title = currentStory.value?.title || 'Baco News & Updates'
  if (navigator.share) {
    navigator.share({ title, url: window.location.href }).catch(() => {})
  } else {
    navigator.clipboard.writeText(window.location.href)
      .then(() => showToast('Link copied to clipboard', 'link'))
      .catch(() => {})
  }
}

const handleEsc = (e) => {
  if (e.key === 'Escape') {
    if (lightboxOpen.value) closeLightbox()
    else if (storyModalOpen.value) closeStory()
  }
  if (lightboxOpen.value && e.key === 'ArrowRight') lightboxNext()
  if (lightboxOpen.value && e.key === 'ArrowLeft') lightboxPrev()
}

// ═══ STATS ("Baco at a Glance") ═══
const stats = [
  { label: 'Barangays',        value: 27,     display: '27',     icon: 'fa-solid fa-map' },
  { label: 'Population',       value: 40159,  display: '40,159', icon: 'fa-solid fa-users' },
  { label: 'Land Area (ha)',   value: 31126,  display: '31,126', icon: 'fa-solid fa-ruler-combined' },
  { label: 'First Capital',    value: 1575,   display: '1,575',  icon: 'fa-solid fa-landmark' },
]

// ═══ QUICK LINKS ═══
const quickLinks = [
  { to: '/tourism',          icon: 'fa-solid fa-umbrella-beach', title: 'Tourism' },
  { to: '/barangays',        icon: 'fa-solid fa-map-location-dot', title: 'Barangays' },
  { to: '/history',          icon: 'fa-solid fa-landmark-flag', title: 'History' },
  { to: '/officials',        icon: 'fa-solid fa-users', title: 'Officials' },
  { to: '/news',             icon: 'fa-solid fa-newspaper', title: 'News Archive' },
  { to: '/tala',             icon: 'fa-solid fa-file-shield', title: 'TALA Documents' },
  { to: '/schools',          icon: 'fa-solid fa-graduation-cap', title: 'Schools' },
  { to: '/citizens-charter', icon: 'fa-solid fa-file-lines', title: "Citizens Charter" },
]

// ═══ SCROLL / REVEAL / MOTION ═══
const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const scrollToId = (id) => {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' })
}

let revealIO = null
let statIO = null
let scrollHandler = null

onMounted(async () => {
  fetchNews()

  revealIO = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('active'); revealIO.unobserve(e.target) }
    }),
    { threshold: 0.08 }
  )
  document.querySelectorAll('.lp .reveal').forEach(el => revealIO.observe(el))

  // Stat counters — animate when visible
  statIO = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return
      const el = e.target
      const target = parseInt(el.dataset.target)
      const hasComma = (el.dataset.display || '').includes(',')
      const duration = 1800
      const start = performance.now()
      const frame = (now) => {
        const pct = Math.min((now - start) / duration, 1)
        const ease = 1 - Math.pow(1 - pct, 3)
        const val = Math.round(ease * target)
        el.textContent = hasComma ? val.toLocaleString() : val.toString()
        if (pct < 1) requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
      statIO.unobserve(el)
    })
  }, { threshold: 0.5 })
  document.querySelectorAll('.st-val[data-target]').forEach(el => statIO.observe(el))

  // Stats parallax deco
  const decos = document.querySelectorAll('.lp .st-deco-para')
  let tick = false
  scrollHandler = () => {
    if (tick || prefersReducedMotion) return
    tick = true
    requestAnimationFrame(() => {
      const sy = window.scrollY
      decos.forEach(el => {
        const speed = parseFloat(el.dataset.speed) || 0.1
        el.style.transform = `translateY(${sy * speed}px)`
      })
      tick = false
    })
  }
  window.addEventListener('scroll', scrollHandler, { passive: true })

  window.addEventListener('keydown', handleEsc)
})

onBeforeUnmount(() => {
  stopAutoSlide()
  window.removeEventListener('keydown', handleEsc)
  if (scrollHandler) window.removeEventListener('scroll', scrollHandler)
  if (revealIO) revealIO.disconnect()
  if (statIO) statIO.disconnect()
  if (storyModalOpen.value) document.body.style.overflow = ''
})
</script>

<template>
  <div class="lp">

    <!-- ═══════════ VIDEO HERO ═══════════ -->
    <section class="hero">
      <div class="hero__strip"></div>
      <div class="video-wrapper">
        <video class="hero-video" autoplay muted loop playsinline poster="/images/hero-imgs.jpg">
          <source src="/videos/herosection_vid.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>
      <div class="hero__overlay"></div>

      <div class="hero__content">
        <span class="hero__eyebrow">Republic of the Philippines &middot; Oriental Mindoro</span>
        <h1 class="hero__title">Municipality of <em>Baco</em></h1>
        <p class="hero__tagline">
          From the peaks of Mt. Halcon to the coastal barangays — transparent governance,
          thriving communities, and a home worth discovering.
        </p>
        <div class="hero__cta">
          <button class="btn btn--primary" @click="scrollToId('services')">
            Explore Services
            <i class="fa-solid fa-arrow-down"></i>
          </button>
          <router-link to="/tourism" class="btn btn--ghost">
            <i class="fa-solid fa-umbrella-beach"></i>
            Discover Baco
          </router-link>
        </div>
      </div>

      <button class="hero__scroll-cue" @click="scrollToId('mayor')" aria-label="Scroll down">
        <i class="fa-solid fa-chevron-down"></i>
      </button>
    </section>

    <!-- ═══════════ MAYOR'S MESSAGE ═══════════ -->
    <section id="mayor" class="mayor">
      <div class="deco deco-blob-primary"></div>
      <div class="deco deco-ring-sm"></div>
      <div class="deco deco-dot-1"></div>
      <div class="deco deco-dot-2"></div>

      <div class="sect-inner">
        <div class="mayor-label reveal">
          <span class="eyebrow">Executive Desk</span>
        </div>

        <div class="mayor-grid">
          <div class="mayor-photo-col reveal" style="--d:0.08s">
            <div class="mayor-photo-bg-ring"></div>
            <div class="mayor-photo-wrap">
              <img class="mayor-photo" :src="mayor.image" :alt="mayor.name" loading="lazy" />
              <div class="mayor-photo-footer">
                <strong class="mayor-name">{{ mayor.name }}</strong>
                <span class="mayor-pos">{{ mayor.title }}</span>
              </div>
            </div>
          </div>

          <div class="mayor-content">
            <h2 class="mayor-title reveal" style="--d:0.14s">Message from the Mayor</h2>
            <div class="mayor-glass reveal" style="--d:0.2s">
              <div class="mayor-glass-icon"><i class="fa-solid fa-quote-left"></i></div>
              <blockquote class="mayor-quote">"{{ mayor.quote }}"</blockquote>
            </div>
            <p class="mayor-body reveal" style="--d:0.27s">{{ mayor.body }}</p>
            <div class="mayor-footer reveal" style="--d:0.34s">
              <div class="mayor-stats">
                <div class="mayor-stat"><span class="mayor-stat-val">27</span><span class="mayor-stat-label">Barangays</span></div>
                <div class="mayor-stat-sep"></div>
                <div class="mayor-stat"><span class="mayor-stat-val">40,159</span><span class="mayor-stat-label">Population</span></div>
              </div>
              <router-link to="/officials" class="mayor-btn">
                Meet the Officials
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5h9M7.5 3l3.5 3.5-3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════ SERVICES ═══════════ -->
    <section id="services" class="services">
      <div class="deco deco-ring-1"></div>
      <div class="deco deco-blob-1"></div>
      <div class="deco deco-ring-2"></div>

      <div class="sect-inner">
        <div class="services-header reveal">
          <p class="eyebrow center">Municipality of Baco</p>
          <h2 class="services-title">Comprehensive Public Services</h2>
          <p class="services-desc">
            From civil registry to social welfare, health to agriculture — the Municipality of Baco
            delivers efficient, transparent, and accessible services for all citizens.
          </p>
        </div>

        <div class="services-grid">
          <router-link
            v-for="(s, i) in services" :key="s.key"
            :to="s.to"
            class="sc reveal"
            :class="{ 'sc--dark': i === 0, 'sc--wide': i === 1 }"
            :style="{ '--d': `${0.05 + i * 0.07}s` }"
          >
            <div v-if="i === 0" class="sc-number">01</div>
            <div class="sc-top-row">
              <div class="sc-icon-wrap" :class="`sc-icon-wrap--${s.key}`"><i :class="s.icon"></i></div>
              <svg v-if="i === 1" class="sc-ext" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 13L13 3M13 3H6M13 3v7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <h3 class="sc-title" :class="{ 'sc-title--sm': i !== 0 }">{{ s.title }}</h3>
            <p class="sc-desc" :class="{ 'sc-desc--sm': i !== 0 }">{{ s.desc }}</p>
            <span v-if="i === 0" class="sc-link">
              Access Service
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5h9M7.5 3l3.5 3.5-3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </router-link>
        </div>
      </div>
    </section>

    <!-- ═══════════ NEWS & ANNOUNCEMENTS (from DB) ═══════════ -->
    <section id="news" class="news">
      <div class="deco deco-ring"></div>
      <div class="deco deco-blob"></div>
      <div class="deco deco-dot deco-dot-1"></div>
      <div class="deco deco-dot deco-dot-2"></div>

      <div class="sect-inner">
        <div class="news-header reveal">
          <p class="eyebrow">Official Bulletins</p>
          <h2 class="news-title">News &amp; <em>Announcements</em></h2>
          <router-link to="/news" class="news-view-all">
            All News
            <span class="news-view-all__circle">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5h9M7.5 3l3.5 3.5-3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </router-link>
        </div>

        <div class="news-grid">
          <!-- Featured -->
          <article v-if="newsItems[0]" class="nc nc--featured reveal" style="--d:0.06s" @click="openStory(newsItems[0])">
            <div class="nc-img-wrap">
              <img class="nc-img" :src="newsItems[0].image" :alt="newsItems[0].title" loading="lazy" />
              <div class="nc-img-scrim"></div>
            </div>
            <div class="nc-body">
              <div class="nc-top">
                <span class="nc-badge" :style="{ background: newsItems[0].categoryBg, color: newsItems[0].categoryColor }">{{ newsItems[0].categoryLabel }}</span>
                <span class="nc-featured-tag">Featured</span>
              </div>
              <h3 class="nc-title"><a href="#" @click.prevent="openStory(newsItems[0])">{{ newsItems[0].title }}</a></h3>
              <p class="nc-excerpt">{{ newsItems[0].excerpt }}</p>
              <div class="nc-footer">
                <time class="nc-meta">{{ newsItems[0].date }} · {{ newsItems[0].readTime }}</time>
                <router-link to="/news" @click.stop class="nc-cta">
                  Read Article
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5h9M7.5 3l3.5 3.5-3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </router-link>
              </div>
            </div>
          </article>

          <!-- Secondary (horizontal) -->
          <article v-if="newsItems[1]" class="nc nc--horizontal reveal" style="--d:0.14s" @click="openStory(newsItems[1])">
            <div class="nc-img-wrap nc-img-wrap--sm">
              <img class="nc-img" :src="newsItems[1].image" :alt="newsItems[1].title" loading="lazy" />
            </div>
            <div class="nc-body nc-body--sm">
              <span class="nc-badge" :style="{ background: newsItems[1].categoryBg, color: newsItems[1].categoryColor }">{{ newsItems[1].categoryLabel }}</span>
              <h3 class="nc-title nc-title--sm"><a href="#" @click.prevent="openStory(newsItems[1])">{{ newsItems[1].title }}</a></h3>
              <p class="nc-excerpt nc-excerpt--sm">{{ newsItems[1].excerpt }}</p>
              <router-link to="/news" @click.stop class="nc-read-more">
                Read Article
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 6h9M7 3l3 3-3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </router-link>
            </div>
          </article>

          <!-- Small -->
          <article v-if="newsItems[2]" class="nc nc--small reveal" style="--d:0.22s" @click="openStory(newsItems[2])">
            <div class="nc-small-icon" :style="{ background: newsItems[2].categoryBg }">
              <i class="fa-solid fa-bullhorn" :style="{ color: newsItems[2].categoryColor }"></i>
            </div>
            <span class="nc-badge" :style="{ background: newsItems[2].categoryBg, color: newsItems[2].categoryColor }">{{ newsItems[2].categoryLabel }}</span>
            <h3 class="nc-title nc-title--sm"><a href="#" @click.prevent="openStory(newsItems[2])">{{ newsItems[2].title }}</a></h3>
            <router-link to="/news" @click.stop class="nc-read-more">
              Read Article
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 6h9M7 3l3 3-3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </router-link>
          </article>

          <!-- Empty state -->
          <article v-if="newsLoaded && newsItems.length === 0" class="nc nc--cta">
            <div class="nc-cta-icon"><i class="fa-solid fa-newspaper"></i></div>
            <p class="nc-cta-label">Stay informed</p>
            <h3 class="nc-cta-title">No announcements yet. Check back soon.</h3>
          </article>

          <!-- CTA card -->
          <article class="nc nc--cta reveal" style="--d:0.3s">
            <div class="nc-cta-icon"><i class="fa-solid fa-newspaper"></i></div>
            <p class="nc-cta-label">Stay informed</p>
            <h3 class="nc-cta-title">View all news &amp; announcements</h3>
            <router-link to="/news" class="nc-cta-btn">News Archive →</router-link>
          </article>
        </div>
      </div>

      <Teleport to="body">
        <!-- ══ STORY MODAL ══ -->
        <div class="story-modal" :class="{ 'story-modal--open': storyModalOpen }">
          <div class="story-modal__inner" v-if="currentStory">
            <div class="sm-bar">
              <button class="sm-back" @click="closeStory"><i class="fas fa-arrow-left"></i> Back</button>
              <div class="sm-actions">
                <button @click="shareStory" aria-label="Share this story"><i class="fas fa-share-nodes"></i></button>
              </div>
            </div>
            <article class="sm-article">
              <div class="sm-meta">
                <span class="sm-tag">Municipality of Baco, Oriental Mindoro</span>
                <span class="sm-tag">{{ currentStory.categoryLabel }}</span>
                <span class="sm-mi">{{ currentStory.readTime }}</span><span class="sm-mi">&middot;</span><span class="sm-mi">{{ currentStory.date }}</span>
              </div>
              <h1 class="sm-title">{{ currentStory.title }}<small>{{ currentStory.categoryLabel || 'Municipality of Baco' }}</small></h1>

              <div class="sm-slideshow" v-if="storySlides.length">
                <div class="sm-slideshow__viewport" @click="openLightbox(currentSlide)" title="Click to view fullscreen">
                  <div class="sm-slideshow__track" :style="{ transform: `translateX(-${currentSlide * 100}%)` }">
                    <img v-for="(img, i) in storySlides" :key="i" :src="img" :alt="`${currentStory.title} — photo ${i + 1}`" />
                  </div>
                </div>
                <button v-if="storySlides.length > 1" class="ss-arrow ss-arrow--prev" @click.stop="prevSlide" aria-label="Previous photo"><i class="fas fa-chevron-left"></i></button>
                <button v-if="storySlides.length > 1" class="ss-arrow ss-arrow--next" @click.stop="manualNext" aria-label="Next photo"><i class="fas fa-chevron-right"></i></button>
                <span class="ss-counter" v-if="storySlides.length > 1">{{ currentSlide + 1 }} / {{ storySlides.length }}</span>
                <span class="ss-zoom-hint"><i class="fas fa-expand"></i></span>
              </div>
              <div class="sm-dots" v-if="storySlides.length > 1">
                <span v-for="(_, i) in storySlides" :key="i" :class="{ 'is-on': currentSlide === i }" @click="goToSlide(i)"></span>
              </div>
              <div class="sm-filmstrip" v-if="storySlides.length > 1">
                <img v-for="(img, i) in storySlides" :key="i" :src="img" :class="{ 'is-active': currentSlide === i }" @click="goToSlide(i)" :alt="`Thumbnail ${i + 1}`" />
              </div>

              <div class="sm-body" v-html="storyBody"></div>

              <div class="sm-related" v-if="relatedStories.length">
                <h3>You may also like</h3>
                <div class="sm-related__grid">
                  <div v-for="rel in relatedStories" :key="rel.id" class="sm-related__item" @click="openStory(rel)">
                    <img :src="rel.image" :alt="rel.title" />
                    <div>
                      <h4>{{ rel.title }}</h4>
                      <span>{{ rel.readTime }} &middot; {{ rel.date }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="sm-pn">
                <button v-if="prevStory" @click="openStory(prevStory)"><i class="fas fa-arrow-left"></i> {{ prevStory.title }}</button><span v-else></span>
                <button v-if="nextStory" @click="openStory(nextStory)">{{ nextStory.title }} <i class="fas fa-arrow-right"></i></button><span v-else></span>
              </div>
            </article>
          </div>
        </div>

        <!-- ══ FULLSCREEN IMAGE VIEWER ══ -->
        <Transition name="lb">
          <div v-if="lightboxOpen" class="img-lightbox" @click="closeLightbox">
            <button class="lb-x" @click="closeLightbox" aria-label="Close viewer"><i class="fas fa-times"></i></button>
            <button v-if="storySlides.length > 1" class="lb-nav lb-nav--prev" @click.stop="lightboxPrev" aria-label="Previous photo"><i class="fas fa-chevron-left"></i></button>
            <img :src="storySlides[lightboxIndex]" :alt="`${currentStory?.title || ''} — photo ${lightboxIndex + 1}`" @click.stop />
            <button v-if="storySlides.length > 1" class="lb-nav lb-nav--next" @click.stop="lightboxNext" aria-label="Next photo"><i class="fas fa-chevron-right"></i></button>
            <div class="lb-counter">{{ lightboxIndex + 1 }} / {{ storySlides.length }}</div>
          </div>
        </Transition>

        <!-- ══ TOASTS ══ -->
        <div class="toast-stack">
          <TransitionGroup name="toast">
            <div v-for="t in toasts" :key="t.id" class="toast">
              <i :class="`fas fa-${t.icon}`"></i><span>{{ t.message }}</span>
            </div>
          </TransitionGroup>
        </div>
      </Teleport>
    </section>

    <!-- ═══════════ BACO AT A GLANCE ═══════════ -->
    <section class="glance">
      <div class="st-deco-para st-ring-1" data-speed="0.15" aria-hidden="true"></div>
      <div class="st-deco-para st-blob-1" data-speed="-0.08" aria-hidden="true"></div>
      <div class="st-deco-para st-dot-1" data-speed="0.35" aria-hidden="true"></div>
      <div class="st-deco-para st-dot-2" data-speed="0.28" aria-hidden="true"></div>
      <div class="st-deco-para st-dot-3" data-speed="0.45" aria-hidden="true"></div>

      <div class="glance-inner">
        <div class="glance-header reveal">
          <p class="glance-eyebrow">By the Numbers</p>
          <h2 class="glance-title">Baco at a <em>Glance</em></h2>
        </div>
        <div class="glance-grid">
          <div v-for="(stat, i) in stats" :key="i" class="glance-card reveal" :style="{ '--d': `${i * 0.08}s` }">
            <div class="glance-icon-wrap"><i :class="stat.icon"></i></div>
            <span class="st-val" :data-target="stat.value" :data-display="stat.display">{{ stat.display }}</span>
            <span class="glance-label">{{ stat.label }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════ QUICK LINKS ═══════════ -->
    <section class="explore">
      <div class="sect-inner">
        <div class="explore-header reveal">
          <p class="eyebrow center">Portal Directory</p>
          <h2 class="explore-title">Explore the Official Portal</h2>
        </div>
        <div class="explore-grid">
          <router-link v-for="(l, i) in quickLinks" :key="l.to" :to="l.to" class="xl-card reveal" :style="{ '--d': `${i * 0.05}s` }">
            <span class="xl-icon"><i :class="l.icon"></i></span>
            <span class="xl-title">{{ l.title }}</span>
            <svg class="xl-arrow" width="14" height="14" viewBox="0 0 13 13" fill="none"><path d="M2 6.5h9M7.5 3l3.5 3.5-3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </router-link>
        </div>
      </div>
    </section>

    <!-- ═══════════ FOOTER ═══════════ -->
    <footer class="lp-footer">
      <div class="lp-footer__inner">
        <div class="lp-footer__brand">
          <span class="lp-footer__seal"><i class="fa-solid fa-landmark-flag"></i></span>
          <div>
            <strong>Municipality of Baco</strong>
            <span>Oriental Mindoro, Philippines</span>
          </div>
        </div>
        <div class="lp-footer__links">
          <router-link to="/tourism">Tourism</router-link>
          <router-link to="/officials">Officials</router-link>
          <router-link to="/news">News</router-link>
          <router-link to="/citizens-charter">Citizens Charter</router-link>
          <router-link to="/auth">Sign In</router-link>
        </div>
      </div>
      <p class="lp-footer__credit">&copy; {{ new Date().getFullYear() }} Municipal Government of Baco. All rights reserved.</p>
    </footer>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700;1,900&family=Inter:wght@300;400;500;600;700&display=swap');
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css');

.lp {
  --navy: #0B198F;
  --red: #CE1126;
  --ink: #0f1628;
  --muted: #5a6480;
  --paper: #f5f7fb;
  --ease: cubic-bezier(0.16, 1, 0.3, 1);

  font-family: 'Inter', system-ui, sans-serif;
  color: var(--ink);
  background: #ffffff;
  width: 100%;
  min-height: 100vh;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}

.sect-inner {
  position: relative;
  z-index: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.eyebrow {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--red);
  margin: 0;
}
.eyebrow.center { text-align: center; }

.deco { position: absolute; pointer-events: none; z-index: 0; }

/* ── Reveal ── */
.reveal {
  opacity: 0;
  transform: translateY(26px);
  transition: opacity 0.75s var(--ease), transform 0.75s var(--ease);
  transition-delay: var(--d, 0s);
}
.reveal.active { opacity: 1; transform: none; }

@media (prefers-reduced-motion: reduce) {
  .lp *, .lp *::before, .lp *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .reveal { opacity: 1 !important; transform: none !important; }
}

/* ═══════════ HERO ═══════════ */
.hero {
  position: relative;
  width: 100%;
  height: 100vh;
  min-height: 560px;
  overflow: hidden;
  background-color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero__strip {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 5px;
  z-index: 5;
  background: linear-gradient(90deg, var(--red) 0%, var(--red) 33.3%, #F2B705 33.3%, #F2B705 66.6%, var(--navy) 66.6%, var(--navy) 100%);
}

.video-wrapper { position: absolute; inset: 0; width: 100%; height: 100%; }
.hero-video { width: 100%; height: 100%; object-fit: cover; display: block; }

.hero__overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(180deg, rgba(5, 15, 77, 0.55) 0%, rgba(5, 15, 77, 0.35) 40%, rgba(5, 15, 77, 0.75) 100%);
}

.hero__content {
  position: relative;
  z-index: 2;
  text-align: center;
  padding: 0 24px;
  max-width: 860px;
}

.hero__eyebrow {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 9px 26px;
  border-radius: 100px;
  margin-bottom: 26px;
}

.hero__title {
  font-family: 'Playfair Display', serif;
  font-weight: 900;
  font-size: clamp(2.8rem, 8vw, 6rem);
  line-height: 1.0;
  letter-spacing: -0.03em;
  color: #fff;
  margin: 0 0 22px;
  text-shadow: 0 8px 40px rgba(0, 0, 0, 0.4);
}
.hero__title em { font-style: italic; color: #F2B705; }

.hero__tagline {
  color: rgba(255, 255, 255, 0.85);
  font-size: clamp(0.95rem, 1.5vw, 1.1rem);
  line-height: 1.7;
  max-width: 560px;
  margin: 0 auto 34px;
}

.hero__cta { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }

.btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-family: inherit;
  font-weight: 700;
  font-size: 0.88rem;
  padding: 15px 32px;
  border-radius: 100px;
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: transform 0.3s var(--ease), box-shadow 0.3s var(--ease), background 0.25s, border-color 0.25s;
}
.btn--primary {
  background: linear-gradient(135deg, var(--red), #9c0d1e);
  color: #fff;
  box-shadow: 0 10px 32px rgba(206, 17, 38, 0.4);
}
.btn--primary:hover { transform: translateY(-3px); box-shadow: 0 16px 44px rgba(206, 17, 38, 0.5); }
.btn--ghost {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 2px solid rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.btn--ghost:hover { background: rgba(255, 255, 255, 0.2); border-color: #fff; transform: translateY(-3px); }

.hero__scroll-cue {
  position: absolute;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
  color: #fff;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: cueBounce 2.2s ease-in-out infinite;
  transition: background 0.25s, border-color 0.25s;
}
.hero__scroll-cue:hover { background: rgba(255, 255, 255, 0.2); border-color: #fff; }
@keyframes cueBounce {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(8px); }
}

@media (max-width: 640px) {
  .hero { min-height: 100svh; }
  .hero__title { font-size: clamp(2.4rem, 12vw, 4rem); }
  .hero__cta { flex-direction: column; align-items: stretch; }
  .btn { justify-content: center; }
}

/* ═══════════ MAYOR ═══════════ */
.mayor {
  position: relative;
  background: #ffffff;
  padding: 100px 0;
  overflow: hidden;
  z-index: 2;
}
.deco-blob-primary {
  width: 500px; height: 500px;
  background: radial-gradient(circle, rgba(11, 25, 143, 0.05) 0%, transparent 70%);
  border-radius: 50%;
  top: -100px; right: -120px;
}
.deco-ring-sm {
  width: 100px; height: 100px;
  border: 5px solid rgba(206, 17, 38, 0.1);
  border-radius: 50%;
  bottom: 60px; left: 60px;
}
.mayor .deco-dot-1 { width: 6px; height: 6px; background: rgba(11, 25, 143, 0.25); border-radius: 50%; top: 80px; left: 160px; }
.mayor .deco-dot-2 { width: 10px; height: 10px; background: rgba(206, 17, 38, 0.15); border-radius: 50%; bottom: 160px; right: 80px; }

.mayor-label { margin-bottom: 40px; }

.mayor-grid {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 64px;
  align-items: center;
}

.mayor-photo-col { position: relative; display: flex; justify-content: center; }
.mayor-photo-bg-ring {
  position: absolute;
  inset: -16px -16px 16px 16px;
  background: linear-gradient(135deg, rgba(11, 25, 143, 0.06) 0%, rgba(47, 75, 50, 0.05) 100%);
  border-radius: 28px;
  z-index: 0;
}
.mayor-photo-wrap {
  position: relative;
  z-index: 1;
  width: 100%;
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 12px 48px rgba(11, 25, 143, 0.14);
}
.mayor-photo {
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  object-position: top center;
  display: block;
  filter: saturate(0.9);
  transition: filter 0.35s;
}
.mayor-photo-wrap:hover .mayor-photo { filter: saturate(1); }
.mayor-photo-footer {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  background: linear-gradient(to top, rgba(11, 25, 143, 0.9) 0%, transparent 100%);
  padding: 36px 22px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mayor-name { font-family: 'Playfair Display', serif; font-size: 1rem; font-weight: 700; color: white; }
.mayor-pos { font-size: 0.72rem; color: rgba(255, 255, 255, 0.65); font-style: italic; }

.mayor-content { display: flex; flex-direction: column; }
.mayor-title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(1.7rem, 2.8vw, 2.6rem);
  font-weight: 900;
  color: var(--navy);
  line-height: 1.12;
  letter-spacing: -0.025em;
  margin: 0 0 28px;
}
.mayor-glass {
  position: relative;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 20px;
  padding: 28px 28px 28px 36px;
  box-shadow: 0 4px 24px rgba(11, 25, 143, 0.07);
  margin-bottom: 24px;
  border-left: 3px solid var(--red);
}
.mayor-glass-icon {
  position: absolute;
  top: -14px; left: 24px;
  width: 34px; height: 34px;
  background: var(--red);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 0.9rem;
  box-shadow: 0 4px 12px rgba(206, 17, 38, 0.3);
}
.mayor-quote {
  font-family: 'Playfair Display', serif;
  font-style: italic;
  font-size: clamp(1rem, 1.5vw, 1.18rem);
  line-height: 1.7;
  color: var(--ink);
  margin: 0;
}
.mayor-body { font-size: 0.94rem; line-height: 1.8; color: var(--muted); margin: 0 0 32px; }
.mayor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding-top: 24px;
  border-top: 1px solid rgba(11, 25, 143, 0.1);
  flex-wrap: wrap;
}
.mayor-stats { display: flex; align-items: center; gap: 20px; }
.mayor-stat { display: flex; flex-direction: column; gap: 2px; }
.mayor-stat-val { font-family: 'Playfair Display', serif; font-size: 1.55rem; font-weight: 900; color: var(--navy); line-height: 1; }
.mayor-stat-label { font-size: 0.68rem; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: #9aa0b8; }
.mayor-stat-sep { width: 1px; height: 36px; background: rgba(11, 25, 143, 0.12); }
.mayor-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  color: white;
  text-decoration: none;
  padding: 12px 24px;
  background: var(--navy);
  border-radius: 100px;
  box-shadow: 0 4px 18px rgba(11, 25, 143, 0.3);
  transition: background 0.22s, gap 0.22s var(--ease), transform 0.22s var(--ease);
}
.mayor-btn:hover { background: #07126a; gap: 12px; transform: translateY(-2px); }

@media (max-width: 960px) {
  .mayor-grid { grid-template-columns: 1fr; gap: 36px; }
  .mayor-photo-bg-ring { display: none; }
  .mayor-photo { aspect-ratio: 4 / 3; object-position: center 15%; max-height: 300px; }
}
@media (max-width: 540px) {
  .mayor { padding: 70px 0; }
  .sect-inner { padding: 0 1.25rem; }
  .mayor-footer { flex-direction: column; align-items: flex-start; gap: 16px; }
  .mayor-btn { width: 100%; justify-content: center; }
}

/* ═══════════ SERVICES ═══════════ */
.services {
  position: relative;
  background: #ffffff;
  padding: 100px 0;
  overflow: hidden;
  z-index: 2;
}
.services .deco-ring-1 { width: 280px; height: 280px; border: 10px solid rgba(11, 25, 143, 0.07); border-radius: 50%; top: 40px; left: -80px; }
.services .deco-blob-1 { width: 180px; height: 180px; background: rgba(206, 17, 38, 0.06); border-radius: 50%; filter: blur(2px); bottom: 100px; right: 120px; }
.services .deco-ring-2 { width: 140px; height: 140px; border: 5px dashed rgba(11, 25, 143, 0.12); border-radius: 20px; transform: rotate(14deg); top: 50%; right: 40px; }

.services-header { text-align: center; margin-bottom: 56px; }
.services-title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(1.9rem, 3.5vw, 2.8rem);
  font-weight: 900;
  color: var(--navy);
  letter-spacing: -0.025em;
  line-height: 1.12;
  margin: 14px 0 18px;
}
.services-desc { font-size: 0.97rem; line-height: 1.75; color: var(--muted); max-width: 580px; margin: 0 auto; }

.services-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: auto auto;
  gap: 1.25rem;
}

.sc {
  position: relative;
  border-radius: 24px;
  padding: 32px 28px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.3s var(--ease), box-shadow 0.3s var(--ease), background 0.25s;
}
.sc--dark {
  grid-column: span 2;
  grid-row: span 2;
  background: linear-gradient(145deg, #0B198F 0%, #050f4d 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  box-shadow: 0 8px 40px rgba(11, 25, 143, 0.25);
}
.sc--dark:hover { transform: scale(1.015); box-shadow: 0 20px 60px rgba(11, 25, 143, 0.35); }
.sc--glass {
  background: rgba(245, 247, 251, 0.7);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.75);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
}
.sc--glass:hover { background: rgba(255, 255, 255, 0.95); transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0, 0, 0, 0.1); }
.sc--wide { grid-column: span 2; }

.sc-number {
  position: absolute;
  top: 14px; right: 20px;
  font-family: 'Playfair Display', serif;
  font-style: italic;
  font-size: 3.2rem;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.12);
  line-height: 1;
  pointer-events: none;
  user-select: none;
}
.sc-top-row { display: flex; align-items: flex-start; justify-content: space-between; }
.sc-icon-wrap {
  width: 52px; height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 1.2rem;
  transition: transform 0.3s var(--ease);
}
.sc--glass:hover .sc-icon-wrap { transform: scale(1.08); }
.sc--dark .sc-icon-wrap { background: rgba(255, 255, 255, 0.12); color: rgba(255, 255, 255, 0.85); }
.sc-icon-wrap--health { background: rgba(13, 122, 62, 0.1); color: #0d7a3e; }
.sc-icon-wrap--permits { background: rgba(206, 17, 38, 0.1); color: var(--red); }
.sc-icon-wrap--agri { background: rgba(180, 130, 20, 0.1); color: #9a7410; }
.sc-ext { color: rgba(15, 22, 40, 0.25); flex-shrink: 0; margin-top: 4px; }

.sc-title { font-family: 'Playfair Display', serif; font-size: 1.35rem; font-weight: 700; color: white; line-height: 1.25; margin: 8px 0 0; flex-grow: 1; }
.sc-title--sm { font-size: 1.05rem; color: var(--ink); }
.sc-desc { font-size: 0.92rem; line-height: 1.7; color: rgba(255, 255, 255, 0.72); margin: 0; flex-grow: 1; }
.sc-desc--sm { color: var(--muted); font-size: 0.86rem; }
.sc-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 0.82rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  transition: gap 0.22s var(--ease), color 0.22s;
}
.sc:hover .sc-link { color: white; gap: 11px; }

@media (max-width: 1024px) {
  .services-grid { grid-template-columns: repeat(2, 1fr); }
  .sc--dark { grid-row: span 1; }
}
@media (max-width: 640px) {
  .services { padding: 70px 0; }
  .services-grid { grid-template-columns: 1fr; }
  .sc--dark, .sc--wide { grid-column: span 1; }
  .sc { border-radius: 18px; padding: 24px 22px; }
}

/* ═══════════ NEWS ═══════════ */
.news {
  position: relative;
  background: var(--paper);
  padding: 100px 0;
  overflow: hidden;
  z-index: 2;
}
.news .deco-ring { width: 200px; height: 200px; border: 5px solid rgba(11, 25, 143, 0.08); border-radius: 50%; top: 60px; right: 80px; }
.news .deco-blob { width: 120px; height: 120px; background: rgba(206, 17, 38, 0.07); border-radius: 50%; filter: blur(4px); top: 100px; left: 100px; }
.news .deco-dot { border-radius: 50%; background: rgba(11, 25, 143, 0.15); }
.news .deco-dot-1 { width: 6px; height: 6px; bottom: 120px; left: 60px; }
.news .deco-dot-2 { width: 10px; height: 10px; bottom: 200px; right: 40px; }

.news-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 48px;
  flex-wrap: wrap;
}
.news-title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  font-weight: 900;
  color: var(--navy);
  letter-spacing: -0.025em;
  line-height: 1.1;
  margin: 0;
  flex: 1;
  text-align: center;
}
.news-title em { font-style: italic; color: var(--red); }
.news-view-all {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--navy);
  text-decoration: none;
  flex-shrink: 0;
  transition: color 0.22s;
}
.news-view-all:hover { color: var(--red); }
.news-view-all__circle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px; height: 30px;
  border: 1.5px solid currentColor;
  border-radius: 50%;
  transition: background 0.22s, transform 0.22s var(--ease);
}
.news-view-all:hover .news-view-all__circle { background: var(--red); border-color: var(--red); color: white; transform: translateX(3px); }

.news-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: auto auto;
  gap: 1.25rem;
}

.nc {
  border-radius: 24px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.75);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: box-shadow 0.3s var(--ease), transform 0.3s var(--ease), background 0.25s;
}
.nc:hover { box-shadow: 0 20px 48px rgba(0, 0, 0, 0.1); background: rgba(255, 255, 255, 0.85); }

.nc--featured { grid-column: span 2; grid-row: span 2; }
.nc--featured:hover { transform: translateY(-5px); }

.nc-img-wrap { position: relative; height: 240px; overflow: hidden; flex-shrink: 0; }
.nc-img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.55s var(--ease), filter 0.35s; filter: saturate(0.88); }
.nc:hover .nc-img { transform: scale(1.06); filter: saturate(1.05); }
.nc-img-scrim { position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 40%, rgba(10, 18, 60, 0.45) 100%); pointer-events: none; }

.nc-body { padding: 22px; display: flex; flex-direction: column; flex-grow: 1; gap: 10px; }
.nc-top { display: flex; align-items: center; gap: 8px; }
.nc-badge {
  font-size: 0.64rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: 6px;
  line-height: 1.6;
  flex-shrink: 0;
}
.nc-featured-tag {
  font-size: 0.62rem;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #9aa0b8;
  border: 1px solid #dde1ee;
  padding: 2px 8px;
  border-radius: 6px;
}
.nc-title { font-family: 'Playfair Display', serif; font-size: clamp(1rem, 1.8vw, 1.42rem); font-weight: 700; line-height: 1.3; color: var(--ink); margin: 0; flex-grow: 1; }
.nc-title a { color: inherit; text-decoration: none; transition: color 0.2s; }
.nc:hover .nc-title a { color: var(--navy); }
.nc-title--sm { font-size: 0.98rem; }
.nc-excerpt { font-size: 0.88rem; line-height: 1.7; color: var(--muted); margin: 0; }
.nc-excerpt--sm { font-size: 0.82rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.nc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid rgba(11, 25, 143, 0.08);
  flex-wrap: wrap;
  margin-top: auto;
}
.nc-meta { font-size: 0.76rem; color: #9aa0b8; font-style: italic; }
.nc-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--navy);
  text-decoration: none;
  padding: 6px 14px;
  background: rgba(11, 25, 143, 0.07);
  border-radius: 8px;
  transition: background 0.22s, color 0.22s, gap 0.22s;
}
.nc-cta:hover { background: var(--navy); color: white; gap: 9px; }

.nc--horizontal { grid-column: span 2; flex-direction: row; gap: 0; }
.nc-img-wrap--sm { width: 130px; height: auto; min-height: 130px; flex-shrink: 0; border-radius: 0; }
.nc-body--sm { padding: 18px 20px; gap: 8px; }
.nc-read-more {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--navy);
  text-decoration: none;
  margin-top: auto;
  transition: color 0.2s, gap 0.2s;
}
.nc-read-more:hover { color: var(--red); gap: 8px; }

.nc--small { padding: 22px; gap: 10px; }
.nc-small-icon {
  width: 44px; height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  flex-shrink: 0;
}

.nc--cta {
  background: linear-gradient(145deg, #0B198F 0%, #050f4d 100%);
  border-color: rgba(255, 255, 255, 0.1);
  color: white;
  padding: 24px;
  gap: 10px;
  justify-content: flex-end;
  box-shadow: 0 8px 32px rgba(11, 25, 143, 0.22);
}
.nc--cta:hover { transform: translateY(-4px); box-shadow: 0 18px 48px rgba(11, 25, 143, 0.32); }
.nc-cta-icon { font-size: 1.8rem; color: rgba(255, 255, 255, 0.2); margin-top: auto; }
.nc-cta-label { font-size: 0.68rem; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255, 255, 255, 0.5); margin: 0; }
.nc-cta-title { font-family: 'Playfair Display', serif; font-size: 1.05rem; font-weight: 700; color: white; line-height: 1.3; margin: 0; }
.nc-cta-btn {
  display: inline-flex;
  font-size: 0.8rem;
  font-weight: 600;
  color: white;
  text-decoration: none;
  padding: 9px 18px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 100px;
  backdrop-filter: blur(8px);
  transition: background 0.22s;
  align-self: flex-start;
}
.nc-cta-btn:hover { background: rgba(255, 255, 255, 0.24); }

@media (max-width: 1024px) {
  .news-grid { grid-template-columns: repeat(2, 1fr); }
  .nc--featured { grid-row: span 1; }
}
@media (max-width: 640px) {
  .news { padding: 70px 0; }
  .news-header { flex-direction: column; align-items: flex-start; gap: 10px; }
  .news-title { text-align: left; font-size: 1.7rem; }
  .news-grid { grid-template-columns: 1fr; }
  .nc--featured, .nc--horizontal { grid-column: span 1; }
  .nc--horizontal { flex-direction: column; }
  .nc-img-wrap--sm { width: 100%; height: 160px; }
}

/* ═══════════ STORY MODAL ═══════════ */
.story-modal {
  position: fixed; inset: 0; z-index: 2000;
  background: #FBFAF7;
  overflow-y: auto;
  overscroll-behavior: contain;
  transform: translateX(100%);
  transition: transform 0.55s cubic-bezier(0.16, 1, 0.3, 1);
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.story-modal::-webkit-scrollbar { display: none; }
.story-modal--open { transform: translateX(0); }
.story-modal__inner { max-width: 1280px; margin: 0 auto; padding: 0 clamp(18px, 5vw, 56px) 60px; }

.sm-bar {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 16px clamp(18px, 5vw, 56px);
  background: rgba(251, 250, 247, 0.88);
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid #CBC8C1;
  margin-bottom: 28px;
}
.sm-back {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: 'Inter', system-ui, sans-serif; font-weight: 600; font-size: 0.82rem;
  color: #161616; background: #FFFFFF;
  border: 1px solid #CBC8C1;
  cursor: pointer; padding: 11px 22px; border-radius: 2px;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.15s, color 0.15s;
}
.sm-back:hover { transform: translateY(-2px); border-color: #0E2F8F; color: #0E2F8F; }
.sm-actions { display: flex; gap: 8px; }
.sm-actions button {
  width: 44px; height: 44px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid #CBC8C1; cursor: pointer; font-size: 15px;
  color: #161616; padding: 0; background: #FFFFFF;
  border-radius: 2px;
  transition: color 0.2s, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.15s;
}
.sm-actions button:hover { color: #0E2F8F; transform: translateY(-2px); border-color: #0E2F8F; }

.sm-article { border-top: 1px solid #CBC8C1; padding: 40px 0 64px; }

.sm-meta { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; margin-bottom: 22px; }
.sm-tag {
  font-size: 0.66rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
  color: #0E2F8F; background: #EDF1FA;
  border: 1px solid #CBD5F0;
  padding: 6px 12px; border-radius: 2px;
}
.sm-mi { font-size: 0.8rem; color: #9B9B9B; }

.sm-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-weight: 800;
  font-size: clamp(1.9rem, 3.4vw, 2.6rem);
  line-height: 1.12; letter-spacing: -0.012em;
  color: #161616; margin-bottom: 10px;
  text-align: center;
  text-wrap: balance;
}
.sm-title small {
  display: block; font-family: 'Inter', system-ui, sans-serif; font-weight: 600;
  font-size: 0.74rem; letter-spacing: 0.14em; text-transform: uppercase;
  color: #5B5B5B;
  margin-top: 18px; padding-top: 18px;
  border-top: 1px solid #E6E4DF;
}

.sm-slideshow {
  position: relative;
  overflow: hidden;
  margin: 30px auto 16px;
  max-width: 1000px;
  background: #FBFAF7;
  border: 1px solid #CBC8C1;
  border-radius: 2px;
}
.sm-slideshow__viewport { aspect-ratio: 16/9; max-height: 460px; cursor: zoom-in; }
.sm-slideshow__track { display: flex; height: 100%; transition: transform 0.55s cubic-bezier(0.16, 1, 0.3, 1); }
.sm-slideshow__track img { min-width: 100%; height: 100%; object-fit: cover; display: block; }
.ss-arrow {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 2;
  width: 44px; height: 44px;
  display: flex; align-items: center; justify-content: center;
  border: none; cursor: pointer; font-size: 15px; color: #fff;
  background: rgba(22, 22, 22, 0.45);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  border-radius: 2px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  transition: background 0.2s, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.ss-arrow:hover { background: rgba(14, 47, 143, 0.9); transform: translateY(-50%) scale(1.06); }
.ss-arrow--prev { left: 14px; }
.ss-arrow--next { right: 14px; }
.ss-counter {
  position: absolute; bottom: 16px; right: 16px; z-index: 2;
  font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em;
  color: #fff; background: rgba(22, 22, 22, 0.6);
  padding: 6px 14px; border-radius: 2px;
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
}
.ss-zoom-hint {
  position: absolute; bottom: 16px; left: 16px; z-index: 2;
  width: 34px; height: 34px;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; color: #fff; background: rgba(22, 22, 22, 0.6);
  border-radius: 2px;
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  opacity: 0.85; transition: opacity 0.2s;
}
.sm-slideshow:hover .ss-zoom-hint { opacity: 1; }

.sm-dots { display: flex; justify-content: center; gap: 7px; margin: 18px 0 14px; }
.sm-dots span { width: 8px; height: 8px; border-radius: 50%; background: #CBC8C1; cursor: pointer; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.sm-dots span.is-on { background: #0E2F8F; width: 28px; border-radius: 4px; }

.sm-filmstrip {
  display: flex; justify-content: center; gap: 10px;
  overflow-x: auto; padding: 4px 2px 12px; margin-bottom: 34px;
  scrollbar-width: none;
}
.sm-filmstrip::-webkit-scrollbar { display: none; }
.sm-filmstrip img {
  width: 84px; height: 58px; object-fit: cover;
  border-radius: 2px; cursor: pointer; flex-shrink: 0;
  opacity: 0.55;
  border: 2px solid transparent;
  transition: opacity 0.25s, border-color 0.25s, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.sm-filmstrip img:hover { opacity: 1; }
.sm-filmstrip img.is-active { opacity: 1; border-color: #0E2F8F; transform: translateY(-2px); }

.sm-body {
  font-family: Georgia, serif;
  font-size: 1.06rem; line-height: 1.9; color: #2C2C2C;
  max-width: 84ch;
  margin: 0 auto 36px;
  text-align: center;
}
.sm-body :deep(p) { margin-bottom: 1.15em; }
.sm-body :deep(p:first-of-type)::first-letter {
  font-family: 'Playfair Display', Georgia, serif; font-weight: 800;
  font-size: 3.2em; line-height: 0.8;
  float: left; padding: 7px 12px 0 0;
  color: #0E2F8F;
}
.sm-body :deep(h2), .sm-body :deep(h3) { font-family: 'Playfair Display', Georgia, serif; color: #161616; margin: 1.5em 0 0.5em; }
.sm-body :deep(img) { max-width: 100%; height: auto; margin: 20px 0; display: block; border-radius: 2px; }
.sm-body :deep(blockquote) { border-left: 3px solid #0E2F8F; padding-left: 18px; margin: 1.4em 0; font-style: italic; color: #3D3D3D; }
.sm-body :deep(a) { color: #0E2F8F; text-decoration: underline; text-underline-offset: 3px; }

.sm-related h3 {
  font-family: 'Inter', system-ui, sans-serif; font-weight: 700;
  font-size: 0.72rem; letter-spacing: 0.2em; text-transform: uppercase;
  color: #0E2F8F; margin-bottom: 18px; text-align: center;
  padding-bottom: 12px;
  border-bottom: 2px solid #161616;
}
.sm-related__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 30px; }
.sm-related__item {
  display: flex; gap: 14px; align-items: center; padding: 14px; cursor: pointer;
  background: #FBFAF7;
  border: 1px solid #E6E4DF;
  border-left: 3px solid #0E2F8F;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s;
}
.sm-related__item:hover { transform: translateY(-3px); border-color: #CBC8C1; }
.sm-related__item img { width: 68px; height: 68px; border-radius: 2px; object-fit: cover; flex-shrink: 0; border: 1px solid #CBC8C1; }
.sm-related__item h4 { font-family: 'Playfair Display', Georgia, serif; font-weight: 700; font-size: 0.9rem; color: #161616; margin-bottom: 4px; line-height: 1.4; }
.sm-related__item span { font-size: 0.76rem; color: #9B9B9B; }

.sm-pn { display: flex; justify-content: space-between; gap: 12px; margin-top: 10px; }
.sm-pn button {
  font-family: 'Inter', system-ui, sans-serif; font-weight: 600; font-size: 0.8rem; color: #161616;
  padding: 13px 22px; border: 1px solid #CBC8C1; background: #FFFFFF; cursor: pointer;
  border-radius: 2px; max-width: 46%;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  display: inline-flex; align-items: center; gap: 8px;
  transition: border-color 0.2s, color 0.2s, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.sm-pn button:hover { color: #0E2F8F; border-color: #0E2F8F; transform: translateY(-2px); }

.img-lightbox {
  position: fixed; inset: 0; z-index: 3000;
  background: rgba(16, 16, 16, 0.94);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  cursor: zoom-out;
}
.img-lightbox img {
  max-width: min(1100px, 94vw);
  max-height: 86vh;
  object-fit: contain;
  border-radius: 2px;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
  cursor: default;
}
.lb-x {
  position: absolute; top: 18px; right: 18px; z-index: 2;
  width: 42px; height: 42px;
  display: flex; align-items: center; justify-content: center;
  border: none; cursor: pointer; font-size: 16px; color: #fff;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  transition: background 0.2s;
}
.lb-x:hover { background: rgba(255, 255, 255, 0.28); }
.lb-nav {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 2;
  width: 48px; height: 48px;
  display: flex; align-items: center; justify-content: center;
  border: none; cursor: pointer; font-size: 17px; color: #fff;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 2px;
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  transition: background 0.2s;
}
.lb-nav:hover { background: rgba(255, 255, 255, 0.28); }
.lb-nav--prev { left: 20px; }
.lb-nav--next { right: 20px; }
.lb-counter {
  position: absolute; bottom: 22px; left: 50%; transform: translateX(-50%); z-index: 2;
  font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.1);
  padding: 7px 16px; border-radius: 2px;
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
}
.lb-enter-active, .lb-leave-active { transition: opacity 0.25s ease; }
.lb-enter-active img { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.lb-enter-from, .lb-leave-to { opacity: 0; }
.lb-enter-from img { transform: scale(0.95); }

.toast-stack {
  position: fixed; bottom: 24px; right: 24px; z-index: 4000;
  display: flex; flex-direction: column; gap: 8px;
}
.toast {
  display: flex; align-items: center; gap: 10px; padding: 14px 22px;
  font-family: 'Inter', system-ui, sans-serif; font-weight: 600; font-size: 0.84rem;
  color: #fff;
  background: rgba(22, 22, 22, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  border-radius: 2px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
}
.toast i { color: #6C8CFF; }
.toast-enter-active { transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(40px) scale(0.95); }

@media (max-width: 768px) {
  .sm-related__grid { grid-template-columns: 1fr; }
  .sm-slideshow__viewport { aspect-ratio: 4/3; max-height: 300px; }
  .sm-pn { flex-direction: column; }
  .sm-pn button { max-width: 100%; width: 100%; justify-content: center; }
  .lb-nav--prev { left: 10px; }
  .lb-nav--next { right: 10px; }
  .toast-stack { left: 16px; right: 16px; bottom: 16px; }
  .toast { justify-content: flex-start; }
}
@media (max-width: 480px) {
  .lb-nav { width: 40px; height: 40px; }
}

/* ═══════════ BACO AT A GLANCE ═══════════ */
.glance {
  position: relative;
  background: linear-gradient(135deg, #0B198F 0%, #050f4d 100%);
  padding: 100px 0;
  overflow: hidden;
  z-index: 2;
}
.st-deco-para { position: absolute; pointer-events: none; will-change: transform; }
.st-ring-1 { width: 340px; height: 340px; border: 10px solid rgba(255, 255, 255, 0.05); border-radius: 50%; top: 20px; left: 40px; }
.st-blob-1 { width: 200px; height: 200px; background: rgba(255, 255, 255, 0.06); border-radius: 50%; filter: blur(20px); bottom: 30px; right: 60px; }
.st-dot-1, .st-dot-2, .st-dot-3 { border-radius: 50%; }
.st-dot-1 { width: 8px; height: 8px; background: rgba(255, 255, 255, 0.22); top: 80px; right: 28%; }
.st-dot-2 { width: 12px; height: 12px; background: rgba(255, 255, 255, 0.14); bottom: 120px; left: 25%; }
.st-dot-3 { width: 6px; height: 6px; background: rgba(206, 17, 38, 0.5); top: 45%; left: 80px; }

.glance-inner {
  position: relative;
  z-index: 1;
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 2rem;
  text-align: center;
}
.glance-header { margin-bottom: 56px; }
.glance-eyebrow {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
  margin: 0 0 12px;
}
.glance-title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(1.9rem, 3.5vw, 2.8rem);
  font-weight: 900;
  color: white;
  letter-spacing: -0.025em;
  margin: 0;
  line-height: 1.1;
}
.glance-title em { font-style: italic; color: rgba(255, 255, 255, 0.55); }

.glance-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; }
.glance-card {
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 22px;
  padding: 36px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  transition: background 0.3s, transform 0.3s var(--ease), box-shadow 0.3s;
}
.glance-card:hover { background: rgba(255, 255, 255, 0.14); transform: translateY(-6px); box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2); }
.glance-icon-wrap {
  width: 52px; height: 52px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 1.2rem;
  color: rgba(255, 255, 255, 0.75);
  transition: background 0.3s, transform 0.3s;
}
.glance-card:hover .glance-icon-wrap { background: rgba(255, 255, 255, 0.18); transform: scale(1.08); }
.st-val {
  font-family: 'Playfair Display', serif;
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 900;
  color: white;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}
.glance-label {
  font-size: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
}

@media (max-width: 960px) { .glance-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 540px) {
  .glance { padding: 70px 0; }
  .glance-inner { padding: 0 1.25rem; }
  .glance-grid { grid-template-columns: 1fr; }
  .glance-card { padding: 28px 20px; }
}

/* ═══════════ EXPLORE / QUICK LINKS ═══════════ */
.explore {
  position: relative;
  background: #ffffff;
  padding: 90px 0;
  overflow: hidden;
  z-index: 2;
}
.explore-header { text-align: center; margin-bottom: 44px; }
.explore-title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(1.8rem, 3vw, 2.5rem);
  font-weight: 900;
  color: var(--navy);
  letter-spacing: -0.025em;
  margin: 14px 0 0;
}
.explore-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.1rem;
}
.xl-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  text-decoration: none;
  background: var(--paper);
  border: 1px solid rgba(11, 25, 143, 0.08);
  border-radius: 20px;
  padding: 24px;
  cursor: pointer;
  transition: transform 0.3s var(--ease), box-shadow 0.3s var(--ease), border-color 0.3s;
}
.xl-card:hover {
  transform: translateY(-5px);
  border-color: rgba(11, 25, 143, 0.3);
  box-shadow: 0 16px 40px rgba(11, 25, 143, 0.12);
}
.xl-icon {
  width: 46px; height: 46px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.05rem;
  background: rgba(11, 25, 143, 0.07);
  color: var(--navy);
  transition: background 0.25s, color 0.25s;
}
.xl-card:hover .xl-icon { background: var(--navy); color: #fff; }
.xl-title { font-weight: 700; font-size: 0.95rem; color: var(--ink); }
.xl-arrow { margin-top: auto; color: #9aa0b8; transition: transform 0.25s var(--ease), color 0.25s; align-self: flex-end; }
.xl-card:hover .xl-arrow { transform: translateX(4px); color: var(--red); }

@media (max-width: 1024px) { .explore-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 540px) {
  .explore { padding: 70px 0; }
  .explore-grid { grid-template-columns: 1fr; }
}

/* ═══════════ FOOTER ═══════════ */
.lp-footer {
  background: #050f4d;
  padding: 48px 2rem 26px;
}
.lp-footer__inner {
  max-width: 1200px;
  margin: 0 auto 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
}
.lp-footer__brand { display: flex; align-items: center; gap: 14px; }
.lp-footer__seal {
  width: 48px; height: 48px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #F2B705;
  font-size: 1.15rem;
  flex-shrink: 0;
}
.lp-footer__brand strong {
  display: block;
  font-family: 'Playfair Display', serif;
  font-size: 1.05rem;
  color: #fff;
}
.lp-footer__brand span { font-size: 0.76rem; color: rgba(255, 255, 255, 0.5); letter-spacing: 0.08em; text-transform: uppercase; }
.lp-footer__links { display: flex; gap: 22px; flex-wrap: wrap; }
.lp-footer__links a {
  font-size: 0.82rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.65);
  text-decoration: none;
  transition: color 0.2s;
}
.lp-footer__links a:hover { color: #F2B705; }
.lp-footer__credit {
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.35);
  padding-top: 22px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}
</style>