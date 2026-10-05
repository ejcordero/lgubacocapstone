<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { API } from '../api'


// ══════════ DYNAMIC CATEGORIES (mirror of the backend/admin whitelist) ══════════
const NEWS_CATEGORIES = [
  'Announcement', 'Tourism', 'Health', 'Education', 'Agriculture',
  'Infrastructure', 'Social Services', 'Environment', 'Events', 'Public Advisory'
]
const CATEGORY_COLORS = {
  'Announcement':    '#0B198F',
  'Tourism':         '#10b981',
  'Health':          '#ef4444',
  'Education':       '#5B21B6',
  'Agriculture':     '#84cc16',
  'Infrastructure':  '#f59e0b',
  'Social Services': '#ec4899',
  'Environment':     '#14b8a6',
  'Events':          '#f97316',
  'Public Advisory': '#64748b',
}
const catColor = (c) => CATEGORY_COLORS[c] || '#64748b'
const catOf = (item) => {
  const c = item?.category
  return c || 'Announcement'
}

const newsItems = ref([])

// Effective date = the admin-picked announcement date, falling back to the
// publish date. One master "newest-first" order drives the ticker, the
// carousel AND the grid, so they always agree.
const effectiveDateOf = (item) => new Date(item?.date_sort || item?.created_at || 0)
const sortedNews = computed(() => [...newsItems.value].sort((a, b) => effectiveDateOf(b) - effectiveDateOf(a)))

const tickerItems = computed(() => sortedNews.value.slice(0, 8))
const loading = ref(true)
const filter = ref('all')
const dateFilter = ref('all')
const visibleCount = ref(6)
const overlayOpen = ref(false)
const currentArticle = ref(null)
const readingProgress = ref(0)
const articleRatio = ref(1.5)
const toastMsg = ref('')
const toastShow = ref(false)
const overlayEl = ref(null)

const bookmarks = ref(new Set(_loadBookmarks()))

// ── Data ───────────────────────────────────────────
const fetchNews = async () => {
  try {
    const res = await fetch(`${API}/news`)
    if (res.ok) newsItems.value = await res.json()
  } catch (e) {
    console.error('Error fetching news:', e)
  } finally {
    loading.value = false
  }
}

const stripHtml = (html) => (html || '').replace(/<[^>]*>/g, ' ')
const plainOf = (item) => stripHtml(item?.content || item?.description || '').replace(/\s+/g, ' ').trim()

const hasRealImage = (item) => !!item?.image && !item.image.includes('via.placeholder.com')

// ── Tags for the article overlay (still DB-category-driven) ──
const CATEGORY_TAGS = {
  'Announcement':    ['Announcement', 'Municipality', 'Baco'],
  'Tourism':         ['Tourism', 'Travel', 'Mount Halcon', 'Destinations'],
  'Health':          ['Health', 'Medical', 'Kalusugan', 'Vaccination'],
  'Education':       ['Education', 'Schools', 'Students', 'Scholarship'],
  'Agriculture':     ['Agriculture', 'Farmers', 'Farming', 'Livelihood'],
  'Infrastructure':  ['Infrastructure', 'Projects', 'Construction'],
  'Social Services': ['Social Services', 'Assistance', 'Community'],
  'Environment':     ['Environment', 'Sustainability', 'Clean-up'],
  'Events':          ['Events', 'Celebration', 'Activities'],
  'Public Advisory': ['Advisory', 'Public Notice', 'Weather'],
}

// Filter list: only categories that actually have articles, in canonical order
const categories = computed(() => {
  const present = new Set(newsItems.value.map((item) => catOf(item)))
  return NEWS_CATEGORIES.filter((c) => present.has(c))
})

const categoryCounts = computed(() => {
  const counts = {}
  for (const item of newsItems.value) {
    const c = catOf(item)
    counts[c] = (counts[c] || 0) + 1
  }
  return counts
})

// ── Date filter — distinct announcement months, newest first ──
const monthKey = (item) => {
  const d = effectiveDateOf(item)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
const dateOptions = computed(() => {
  const keys = new Set()
  for (const item of newsItems.value) { const k = monthKey(item); if (k) keys.add(k) }
  return [...keys].sort().reverse()
})
const setDateFilter = (k) => { dateFilter.value = k; visibleCount.value = 6 }

// ── Grid ──
// The grid pool is EVERYTHING — carousel items included — so the "All" filter
// and every category/date filter operate over the complete list.
const gridPool = computed(() => sortedNews.value)

const filteredPool = computed(() => {
  return gridPool.value.filter((item) => {
    const inCat = filter.value === 'all' || catOf(item) === filter.value
    const inDate = dateFilter.value === 'all' || monthKey(item) === dateFilter.value
    return inCat && inDate
  })
})
const gridItems = computed(() => filteredPool.value.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < filteredPool.value.length)
const loadMore = () => { visibleCount.value += 6 }

const setFilter = (c) => { filter.value = c; visibleCount.value = 6 }

// ── Sidebar (Trending only — Popular Tags removed) ──
const trending = computed(() => {
  const hash = (id) => { const s = String(id); let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h }
  return [...newsItems.value].sort((a, b) => hash(a.id) - hash(b.id)).slice(0, 5)
})

const AUTHOR_NAME = 'Baco Information Office'
const AUTHOR_INITIALS = 'BCO'
const AUTHOR_ROLE = 'Municipal Information Office'
const authorOf = () => AUTHOR_NAME
const authorInitials = () => AUTHOR_INITIALS
const authorRole = () => AUTHOR_ROLE

const readTimeFor = (item) => {
  const words = `${plainOf(item)} ${item?.title || ''}`.trim().split(/\s+/).filter(Boolean).length
  return `${Math.max(1, Math.ceil(words / 200))} min read`
}

const timeAgo = (item) => {
  const d = item?.created_at ? new Date(item.created_at) : null
  if (!d || isNaN(d.getTime())) return item?.date || ''
  const s = (Date.now() - d.getTime()) / 1000
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} hours ago`
  if (s < 2592000) return `${Math.round(s / 86400)} days ago`
  return item?.date || d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formDate = (item) => item?.date || timeAgo(item)

// ── Article view ──
const storyBody = computed(() => {
  const item = currentArticle.value
  if (!item) return ''
  if (item.content) return item.content
  const d = item.description || 'Stay tuned for more updates from the Municipality of Baco.'
  return `<p>${d}</p><p>Published by the Municipality of Baco, Oriental Mindoro.</p>`
})

const currentArticleTags = computed(() => {
  const item = currentArticle.value
  if (!item) return []
  return CATEGORY_TAGS[catOf(item)] || [catOf(item)]
})

const relatedArticles = computed(() => {
  const item = currentArticle.value
  if (!item) return []
  const cat = catOf(item)
  return newsItems.value
    .filter((x) => x.id !== item.id)
    .sort((a, b) => (catOf(a) === cat ? -1 : 0) - (catOf(b) === cat ? -1 : 0))
    .slice(0, 3)
})

const isBookmarked = (item) => bookmarks.value.has(item.id)

const openArticle = (item) => {
  currentArticle.value = item
  overlayOpen.value = true
  readingProgress.value = 0
  document.body.style.overflow = 'hidden'
  const pre = new Image()
  pre.onload = () => { if (currentArticle.value === item && pre.naturalWidth > 0 && pre.naturalHeight > 0) articleRatio.value = pre.naturalWidth / pre.naturalHeight }
  pre.src = item.image
  nextTick(() => { if (overlayEl.value) overlayEl.value.scrollTop = 0 })
}

const syncArticleRatio = (e) => {
  const el = e.currentTarget
  if (el && el.naturalWidth > 0 && el.naturalHeight > 0) articleRatio.value = el.naturalWidth / preRatioGuard(el)
}
const preRatioGuard = (el) => el.naturalHeight

const closeArticle = () => {
  overlayOpen.value = false
  readingProgress.value = 0
  document.body.style.overflow = ''
}

const onOverlayScroll = () => {
  const el = overlayEl.value
  if (!el) return
  const max = el.scrollHeight - el.clientHeight
  readingProgress.value = max > 0 ? (el.scrollTop / max) * 100 : 0
}

const handleKey = (e) => { if (e.key === 'Escape' && overlayOpen.value) closeArticle() }

// ── Bookmarks ──
function _loadBookmarks() {
  try { return JSON.parse(localStorage.getItem('baco_news_bookmarks') || '[]') } catch { return [] }
}
function _saveBookmarks() { localStorage.setItem('baco_news_bookmarks', JSON.stringify([...bookmarks.value])) }

const toggleBookmark = () => {
  const item = currentArticle.value
  if (!item) return
  if (bookmarks.value.has(item.id)) { bookmarks.value.delete(item.id); showToast('Bookmark removed') }
  else { bookmarks.value.add(item.id); showToast('Article bookmarked') }
  _saveBookmarks()
}

// ── Share & toast ──
let toastTimer = null
const showToast = (msg) => {
  toastMsg.value = msg
  toastShow.value = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastShow.value = false }, 3000)
}

const pageUrl = (item) => window.location.href

const shareArticle = async () => {
  const url = pageUrl()
  const title = currentArticle.value?.title || 'Baco News & Updates'
  if (navigator.share) {
    try { await navigator.share({ title, url }) } catch {}
  } else {
    await copyLink()
  }
}

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(pageUrl())
    showToast('Link copied to clipboard')
  } catch {
    showToast('Could not copy link')
  }
}

const socialShare = (net) => {
  const url = encodeURIComponent(pageUrl())
  const text = encodeURIComponent(currentArticle.value?.title || 'Baco News')
  const targets = {
    x: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`
  }
  window.open(targets[net] || targets.facebook, '_blank', 'noopener,width=640,height=520')
}

// ── Hero coverflow carousel — the 3 most recent (by announcement date) ──
// Headline only — no body excerpt is mapped here on purpose.
const heroCarousel = computed(() => sortedNews.value.slice(0, 3).map(item => ({
  ...item,
  category: catOf(item),
  categoryColor: '#fff',
})))

const carouselIdx = ref(0)
const carouselTotal = computed(() => heroCarousel.value.length)
const progressBarEl = ref(null)
const CAROUSEL_DURATION = 2500
const CAROUSEL_ANIMATION = 1300
const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
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

const resetCarouselAuto = () => {
  cancelAnimationFrame(carouselRaf)
  carouselProgressStart = Date.now()
  carouselUpdateProgress()
}

const carouselGoTo = (index) => {
  const total = carouselTotal.value
  if (!total || carouselIsAnimating) return
  carouselIsAnimating = true
  carouselIdx.value = (index + total) % total
  resetCarouselAuto()
  setTimeout(() => { carouselIsAnimating = false }, CAROUSEL_ANIMATION)
}

const carouselUpdateProgress = () => {
  if (prefersReducedMotion || carouselTotal.value <= 1) { if (progressBarEl.value) progressBarEl.value.style.width = '0%'; return }
  const elapsed = Date.now() - carouselProgressStart
  const pct = Math.min((elapsed / CAROUSEL_DURATION) * 100, 100)
  if (progressBarEl.value) progressBarEl.value.style.width = pct + '%'
  if (pct >= 100) {
    carouselGoTo(carouselIdx.value + 1)
    return
  }
  carouselRaf = requestAnimationFrame(carouselUpdateProgress)
}

const carouselTouchStart = (e) => { carouselTouchStartX = e.touches[0].clientX }
const carouselTouchEnd = (e) => {
  const diff = carouselTouchStartX - e.changedTouches[0].clientX
  if (Math.abs(diff) > 50) carouselGoTo(carouselIdx.value + (diff > 0 ? 1 : -1))
}

watch(carouselTotal, (n) => { if (carouselIdx.value >= n) carouselIdx.value = 0; resetCarouselAuto() })

onMounted(() => {
  fetchNews()
  window.addEventListener('keydown', handleKey)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKey)
  cancelAnimationFrame(carouselRaf)
  if (progressBarEl.value) progressBarEl.value.style.width = '0%'
  if (overlayOpen.value) document.body.style.overflow = ''
})
</script>

<template>
  <div class="baco-news">

    <!-- ══ BREAKING TICKER ══ -->
    <div class="b-ticker" v-if="newsItems.length">
      <div class="n-wrap">
        <div class="b-ticker-inner">
          <span class="ticker-label">Breaking</span>
          <div class="ticker-content">
            <div class="ticker-scroll">
              <template v-for="copy in 2" :key="copy">
                <span v-for="item in tickerItems" :key="'c' + copy + '-' + item.id" class="ts-it">{{ item.title }}</span>
                <span class="ts-sep">•</span>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ HERO (coverflow — 3 newest, headline only, left navdots kept) ══ -->
    <section class="ns" v-if="carouselTotal > 0">
      <div class="ns__bg-photo" aria-hidden="true"></div>
      <div class="ns__overlay" aria-hidden="true"></div>
      <div class="ns__progress-bar" ref="progressBarEl" aria-hidden="true"></div>

      <div class="ns__navdots" v-if="carouselTotal > 1">
        <button v-for="(item, i) in heroCarousel" :key="'dot-' + i" class="ns__navdot" :class="{ 'is-active': i === carouselIdx }" :data-tip="item.title" :aria-label="`View ${item.title}`" @click="carouselGoTo(i)"></button>
      </div>

      <div class="ns__stage" @touchstart.passive="carouselTouchStart" @touchend.passive="carouselTouchEnd">
        <div class="ns__content">
          <div class="ns__pill">
            <span class="ns__pill-dot"></span>
            <span>{{ heroCarousel[carouselIdx].category }}</span>
          </div>
          <h2 class="ns__name">{{ heroCarousel[carouselIdx].title }}</h2>
          <div class="ns__actions">
            <button class="ns__cta" @click="openArticle(heroCarousel[carouselIdx])">
              <span>Read Article</span>
              <span class="ns__cta-icon">→</span>
            </button>
          </div>
        </div>

        <div class="ns__carousel">
          <article v-for="(item, i) in heroCarousel" :key="item.id || i" class="nc" :class="carouselPosition(i)" @click="openArticle(item)">
            <img :src="item.image" :alt="item.title" loading="lazy" :class="{ 'ph': !hasRealImage(item) }" />
            <div class="nc__scrim" aria-hidden="true"></div>
            <div class="nc__top">
              <span class="nc__badge" :style="{ background: catColor(catOf(item)), color: '#fff' }">{{ catOf(item) }}</span>
            </div>
            <div class="nc__bottom">
              <span class="nc__meta">{{ formDate(item) }} · {{ readTimeFor(item) }}</span>
              <span class="nc__title">{{ item.title }}</span>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- ══ LATEST STORIES ══ -->
    <section class="news-section">
      <div class="n-wrap">

        <!-- Category pills + date filter on ONE line -->
        <div class="category-filter">
          <div class="cf-pills">
            <button class="filter-btn" :class="{ active: filter === 'all' }" @click="setFilter('all')">
              All<span class="fc">{{ newsItems.length }}</span>
            </button>
            <button
              v-for="c in categories"
              :key="c"
              class="filter-btn"
              :class="{ active: filter === c }"
              @click="setFilter(c)"
            >{{ c }}<span class="fc">{{ categoryCounts[c] || 0 }}</span></button>
          </div>
          <select class="date-filter" :value="dateFilter" @change="setDateFilter($event.target.value)" aria-label="Filter by date">
            <option value="all">All Dates</option>
            <option v-for="k in dateOptions" :key="k" :value="k">{{ monthLabel(k) }}</option>
          </select>
        </div>

        <div class="content-layout">
          <div class="main-col">
            <div v-if="loading" class="empty-state">
              <div class="spinner"></div>
              <p>Loading latest news…</p>
            </div>
            <div v-else-if="gridItems.length === 0" class="empty-state">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V4z"/><path d="M4 20a2 2 0 0 1 2-2h16"/></svg>
              <p>No stories match your filters.</p>
              <button class="btn-reset" @click="setFilter('all'); setDateFilter('all')">Clear filters</button>
            </div>
            <div v-else class="news-grid">
              <article
                v-for="(item, i) in gridItems"
                :key="item.id"
                class="news-card"
                :style="{ animationDelay: (i % 6) * 70 + 'ms' }"
                @click="openArticle(item)"
              >
                <div class="news-card-img">
                  <img :src="item.image" :alt="item.title" :class="{ 'ph': !hasRealImage(item) }" />
                  <span class="category-tag" :style="{ background: catColor(catOf(item)) }">{{ catOf(item) }}</span>
                </div>
                <div class="news-card-body">
                  <h3>{{ item.title }}</h3>
                  <div class="card-meta">
                    <div class="author">
                      <span class="author-avatar">{{ authorInitials() }}</span>
                      <span>{{ authorOf() }}</span>
                    </div>
                    <span class="read-time">{{ formDate(item) }}</span>
                  </div>
                </div>
              </article>
            </div>
            <div class="load-more" v-if="hasMore">
              <button @click="loadMore">Load More Stories</button>
            </div>
          </div>

          <aside class="sidebar">
            <div class="sidebar-widget">
              <h3 class="widget-title">Trending Now</h3>
              <div v-for="(t, i) in trending" :key="t.id" class="trending-item" @click="openArticle(t)">
                <span class="trending-num">0{{ i + 1 }}</span>
                <div class="trending-info">
                  <h4>{{ t.title }}</h4>
                  <span>{{ timeAgo(t) }} · {{ catOf(t) }}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>

    <!-- ══ ARTICLE OVERLAY ══ -->
    <div class="reading-progress" :style="{ width: readingProgress + '%' }"></div>
    <div ref="overlayEl" class="article-overlay" :class="{ open: overlayOpen }" @scroll="onOverlayScroll">
      <div class="article-topbar">
        <div class="n-wrap">
          <div class="article-topbar-inner">
            <button class="btn-back" @click="closeArticle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              Back to News
            </button>
            <div class="article-topbar-actions">
              <button class="btn-action" :class="{ active: currentArticle && isBookmarked(currentArticle) }" title="Bookmark" @click="toggleBookmark">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              </button>
              <button class="btn-action" title="Share" @click="shareArticle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <article v-if="currentArticle" class="article-view">

        <!-- Rounded card: hero photo → share buttons (Related Stories stays outside) -->
        <div class="article-card">
          <div class="article-hero" :style="{ aspectRatio: articleRatio }">
            <img :src="currentArticle.image" :alt="currentArticle.title" :class="{ 'ph': !hasRealImage(currentArticle) }" @load="syncArticleRatio" />
            <div class="article-hero-overlay">
              <div class="article-hero-content">
                <span class="category-tag" :style="{ background: catColor(catOf(currentArticle)) }">{{ catOf(currentArticle) }}</span>
                <h1>{{ currentArticle.title }}</h1>
              </div>
            </div>
          </div>

          <div class="article-body-wrap">
            <div class="article-author-bar">
              <div class="article-author-info">
                <div class="article-author-avatar">{{ authorInitials() }}</div>
                <div>
                  <div class="article-author-name">{{ authorOf() }}</div>
                  <div class="article-author-role">{{ authorRole() }}</div>
                </div>
              </div>
              <div class="article-date-info">
                <strong>{{ formDate(currentArticle) }}</strong>
                {{ readTimeFor(currentArticle) }}
              </div>
            </div>

            <div class="article-content" v-html="storyBody"></div>

            <div class="article-tags" v-if="currentArticleTags.length">
              <span v-for="tag in currentArticleTags" :key="tag">{{ tag }}</span>
            </div>

            <div class="article-share">
              <span>Share this article:</span>
              <button class="share-btn" title="Share on X" @click="socialShare('x')"><i class="fa-brands fa-x-twitter"></i></button>
              <button class="share-btn" title="Share on Facebook" @click="socialShare('facebook')"><i class="fa-brands fa-facebook-f"></i></button>
              <button class="share-btn" title="Share on LinkedIn" @click="socialShare('linkedin')"><i class="fa-brands fa-linkedin-in"></i></button>
              <button class="share-btn" title="Copy Link" @click="copyLink"><i class="fa-solid fa-link"></i></button>
            </div>
          </div>
        </div>

        <!-- Related Stories — intentionally OUTSIDE the rounded card -->
        <div class="related-wrap">
          <div class="related-section" v-if="relatedArticles.length">
            <h3>Related Stories</h3>
            <div class="related-grid">
              <div v-for="r in relatedArticles" :key="r.id" class="related-card" @click="openArticle(r)">
                <div class="related-card-img">
                  <img :src="r.image" :alt="r.title" :class="{ 'ph': !hasRealImage(r) }" />
                </div>
                <div class="related-card-body">
                  <span class="rc-cat">{{ catOf(r) }}</span>
                  <h4>{{ r.title }}</h4>
                  <div class="rc-meta">
                    <span>{{ authorOf() }}</span>
                    <span>•</span>
                    <span>{{ readTimeFor(r) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>

    <!-- ══ TOAST ══ -->
    <div class="toast" :class="{ show: toastShow }">{{ toastMsg }}</div>
  </div>
</template>

<!-- Plus Jakarta Sans for headings + design tokens (unchanged) -->
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');

.baco-news {
  /* Mirrors the site-wide tokens declared in App.vue so this page matches every
     other public page (navy #0B198F / red #CE1126 on an ivory-navy surface). */
  --primary: #0B198F;
  --red: #CE1126;
  --accent: #0B198F;
  --accent-light: #3A4FC0;
  --accent-dark: #070f5c;
  --accent-glow: rgba(11, 25, 143, 0.08);
  --accent-gradient: linear-gradient(135deg, #0B198F 0%, #1E3A8A 100%);
  --bg: #F2F5FC;
  --bg-alt: #E8ECF8;
  --card-bg: #ffffff;
  --text: #10152B;
  --text-light: #3E4763;
  --text-lighter: #9AA3BD;
  --border: #DDE1EE;
  --border-light: #EDEFF7;
  --shadow-sm: 0 1px 3px rgba(7, 15, 92, 0.05);
  --shadow: 0 4px 24px rgba(7, 15, 92, 0.07);
  --shadow-lg: 0 12px 40px rgba(7, 15, 92, 0.12);
  --shadow-accent: 0 8px 32px rgba(11, 25, 143, 0.18);
  --radius: 16px;
  --radius-sm: 10px;
  --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>

<style scoped>
.baco-news {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  min-height: 100vh;
  text-align: left;
}

.baco-news h1, .baco-news h2, .baco-news h3, .baco-news h4 {
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: var(--text);
}

.n-wrap { max-width: 1320px; margin: 0 auto; padding: 0 24px; }

/* ── Ticker ── */
.b-ticker { background: var(--primary); color: #fff; padding: 10px 0; overflow: hidden; position: relative; }
.b-ticker::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, rgba(206, 17, 38, 0.1) 0%, transparent 50%, rgba(11, 25, 143, 0.1) 100%);
}
.b-ticker-inner { display: flex; align-items: center; gap: 16px; position: relative; }
.ticker-label {
  background: var(--accent-gradient); padding: 4px 14px; border-radius: 50px;
  font-weight: 700; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1.5px;
  flex-shrink: 0; animation: bacoPulse 2s infinite;
}
@keyframes bacoPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.75; } }
.ticker-content { overflow: hidden; flex: 1; }
.ticker-scroll { display: flex; animation: bacoScroll 35s linear infinite; white-space: nowrap; }
.ticker-scroll:hover { animation-play-state: paused; }
.ts-it { padding-right: 28px; font-size: 0.82rem; opacity: 0.9; cursor: pointer; }
.ts-sep { color: var(--accent-light); font-weight: 700; padding-right: 28px; }
.ticker-scroll span:hover { color: #fff; }
@keyframes bacoScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

/* ── Hero coverflow ── */
.ns { --navy:#0B198F; --red:#CE1126; --ease:cubic-bezier(0.16, 1, 0.3, 1); position: relative; width: 100%; height: 100vh; min-height: 640px; overflow: hidden; background: #f5f7fb; z-index: 10; color: var(--navy); }
.ns__bg-photo { position: absolute; inset: 0; z-index: 0; background: url('/images/img2.jpg') center 35% / cover no-repeat; }
.ns__overlay { position: absolute; inset: 0; z-index: 1; background: linear-gradient(90deg, rgba(4,8,40,0.55) 0%, rgba(4,8,40,0.15) 45%, rgba(4,8,40,0.5) 100%); }
.ns__progress-bar { position: absolute; bottom: 0; left: 0; height: 3px; width: 0%; background: linear-gradient(90deg, var(--navy), var(--red)); z-index: 60; box-shadow: 0 0 10px rgba(206,17,38,0.4); }
.ns__navdots { position: absolute; left: 28px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 16px; z-index: 50; }
.ns__navdot { width: 12px; height: 12px; border-radius: 50%; background: rgba(11,25,143,0.25); cursor: pointer; transition: all 0.3s ease; position: relative; border: none; padding: 0; }
.ns__navdot::after { content: attr(data-tip); position: absolute; left: 24px; top: 50%; transform: translateY(-50%); padding: 6px 12px; background: rgba(11,25,143,0.92); color: white; backdrop-filter: blur(10px); border-radius: 6px; font-size: 11px; font-family: 'Inter', sans-serif; font-weight: 500; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.3s ease; }
.ns__navdot:hover::after { opacity: 1; }
.ns__navdot.is-active { background: var(--red); transform: scale(1.35); box-shadow: 0 0 0 4px rgba(206,17,38,0.15); }
.ns__navdot:hover { background: var(--navy); }
.ns__stage { position: relative; z-index: 10; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; gap: 72px; padding: 70px 40px 90px; }
.ns__content { width: 100%; max-width: 460px; }
.ns__pill { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.14); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.25); border-radius: 50px; padding: 7px 16px; margin-bottom: 22px; font-size: 12px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: white; font-family: 'Inter', sans-serif; }
.ns__pill-dot { width: 8px; height: 8px; background: var(--red); border-radius: 50%; animation: nsPulse 2s infinite; }
@keyframes nsPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.45; transform: scale(1.25); } }
.ns .ns__name { font-family: 'Playfair Display', serif; font-weight: 900; font-size: 32px; letter-spacing: -0.02em; line-height: 1.2; margin-bottom: 26px; color: white; text-shadow: 0 2px 12px rgba(0,0,0,0.45); }
.ns__desc { font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.7; color: rgba(255,255,255,0.9); margin-bottom: 30px; text-shadow: 0 1px 6px rgba(0,0,0,0.35); }
.ns__actions { display: flex; align-items: center; gap: 14px; }
.ns__cta { display: inline-flex; align-items: center; gap: 10px; padding: 13px 26px; background: linear-gradient(135deg, var(--red), #a30e1f); border: none; border-radius: 50px; color: white; font-size: 14px; font-weight: 700; letter-spacing: 0.02em; cursor: pointer; transition: all 0.3s var(--ease); box-shadow: 0 10px 26px rgba(163,14,31,0.35); font-family: 'Inter', sans-serif; }
.ns__cta:hover { transform: translateY(-3px); box-shadow: 0 16px 34px rgba(163,14,31,0.45); }
.ns__cta-icon { width: 26px; height: 26px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 15px; line-height: 1; }
.ns__ghost { display: inline-flex; align-items: center; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: white; text-decoration: none; padding: 13px 20px; border: 1px solid rgba(255,255,255,0.4); border-radius: 50px; backdrop-filter: blur(8px); background: transparent; appearance: none; -webkit-appearance: none; transition: background 0.25s, border-color 0.25s, color 0.25s; }
.ns__ghost:hover { background: white; border-color: white; color: var(--navy); }
.ns__carousel { position: relative; width: 640px; height: 440px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; perspective: 1200px; }
.nc { position: absolute; top: 50%; left: 50%; width: 270px; height: 350px; margin-left: -135px; margin-top: -175px; border-radius: 20px; overflow: hidden; cursor: pointer; background: #ffffff; box-shadow: 0 25px 60px rgba(11,25,143,0.22); transition: all 1.3s var(--ease); opacity: 0; transform: scale(0.5); pointer-events: none; will-change: transform, opacity, filter; border: 1px solid rgba(255,255,255,0.7); }
.nc img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.6s var(--ease); }
.nc:hover img { transform: scale(1.06); }
.nc__scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(8,10,30,0.05) 0%, transparent 32%, rgba(8,10,30,0.18) 58%, rgba(8,10,30,0.72) 100%); z-index: 1; pointer-events: none; }
.nc__top { position: absolute; top: 14px; left: 14px; right: 14px; z-index: 3; display: flex; align-items: flex-start; justify-content: space-between; }
.nc__badge { font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 4px 10px; border-radius: 6px; line-height: 1.5; box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
.nc__bottom { position: absolute; bottom: 16px; left: 16px; right: 16px; z-index: 3; display: flex; flex-direction: column; gap: 6px; }
.nc__meta { font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 500; font-style: italic; color: rgba(255,255,255,0.82); text-shadow: 0 1px 4px rgba(0,0,0,0.4); }
.nc__title { font-family: 'Playfair Display', serif; font-weight: 800; letter-spacing: -0.01em; color: white; font-size: clamp(14px, 1.1vw, 17px); line-height: 1.3; text-shadow: 0 2px 8px rgba(0,0,0,0.45); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.nc.pos-featured { transform: translateX(0) scale(1.06) rotateY(0deg); z-index: 5; opacity: 1; filter: brightness(1) blur(0px); pointer-events: auto; }
.nc.pos-featured .nc__title { font-size: clamp(15px, 1.2vw, 18px); -webkit-line-clamp: 3; }
.nc.pos-left-1 { transform: translateX(-185px) scale(0.68) rotateY(18deg); z-index: 3; opacity: 0.55; filter: brightness(0.72) blur(0.5px); pointer-events: auto; }
.nc.pos-right-1 { transform: translateX(185px) scale(0.68) rotateY(-18deg); z-index: 3; opacity: 0.55; filter: brightness(0.72) blur(0.5px); pointer-events: auto; }
.nc.pos-left-2 { transform: translateX(-330px) scale(0.42) rotateY(26deg); z-index: 1; opacity: 0.22; filter: brightness(0.5) blur(1.5px); }
.nc.pos-right-2 { transform: translateX(330px) scale(0.42) rotateY(-26deg); z-index: 1; opacity: 0.22; filter: brightness(0.5) blur(1.5px); }
.ns__pagination { position: absolute; bottom: 34px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 16px; padding: 11px 22px; backdrop-filter: blur(20px); background: rgba(4,8,40,0.45); border: 1px solid rgba(255,255,255,0.2); border-radius: 50px; z-index: 50; box-shadow: 0 8px 24px rgba(0,0,0,0.25); }
.ns__pagination-dots { display: flex; gap: 8px; align-items: center; }
.ns__pagination-dot { position: relative; width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.35); cursor: pointer; border: none; padding: 0; transition: all 0.4s ease; }
/* Invisible 40px-tall tap area so the 8px dot stays visually unchanged on mobile */
.ns__pagination-dot::after { content: ''; position: absolute; inset: -16px -10px; }
.ns__pagination-dot.is-active { width: 28px; border-radius: 4px; background: var(--red); }
.ns__pagination-dot:hover { background: white; }
.ns__counter { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 700; color: white; }
@media (max-width: 1200px) { .ns__stage { gap: 40px; padding: 60px 24px 90px; } .ns__content { max-width: 340px; } .ns__carousel { width: 480px; } .nc { width: 230px; height: 300px; margin-left: -115px; margin-top: -150px; } .nc.pos-left-1 { transform: translateX(-150px) scale(0.68) rotateY(18deg); } .nc.pos-right-1 { transform: translateX(150px) scale(0.68) rotateY(-18deg); } .nc.pos-left-2, .nc.pos-right-2 { display: none; } }
@media (max-width: 768px) { .ns { height: auto; min-height: 600px; } .ns__stage { flex-direction: column; justify-content: center; gap: 34px; padding: 70px 16px 110px; } .ns__content { display: none; } .ns__navdots { display: none; } .ns__carousel { width: 100%; height: 400px; } .ns__pagination { bottom: 28px; } .nc { width: 210px; height: 280px; margin-left: -105px; margin-top: -140px; } .ns__bg-photo { display: none; } }

/* ── Placeholder (missing image) ── */
img.ph { background: var(--bg-alt); }

/* ── Section header + search ── */
.news-section { padding: 44px 0 60px; }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
.section-header h2 { font-size: 1.5rem; font-weight: 800; display: flex; align-items: center; gap: 12px; margin: 0; }
.section-header h2::before { content: ''; width: 4px; height: 24px; background: var(--accent-gradient); border-radius: 2px; }
.search-box {
  display: flex; align-items: center; gap: 8px; background: var(--card-bg);
  border: 1.5px solid var(--border); border-radius: 50px; padding: 8px 16px;
  color: var(--text-lighter); min-width: 240px; transition: var(--transition);
}
.search-box:focus-within { border-color: var(--accent); box-shadow: var(--shadow-accent); }
.search-box input { flex: 1; border: none; outline: none; background: transparent; font-family: inherit; font-size: 0.84rem; color: var(--text); }
.search-box input::placeholder { color: var(--text-lighter); }
.search-clear { border: none; background: none; color: var(--text-lighter); cursor: pointer; font-size: 0.8rem; padding: 9px 10px; font-family: inherit; }
.search-clear:hover { color: var(--accent); }

/* ── Category filter ── */
.category-filter { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 32px; flex-wrap: wrap; }
.cf-pills { display: flex; gap: 8px; flex-wrap: wrap; }
.date-filter {
  padding: 9px 16px; border-radius: 50px; border: 1.5px solid var(--border);
  background: var(--card-bg); color: var(--text-light); font-size: 0.82rem; font-weight: 600;
  font-family: inherit; cursor: pointer; outline: none; transition: var(--transition);
  appearance: none; -webkit-appearance: none;
}
.date-filter:hover { border-color: var(--accent-light); color: var(--accent); }
.date-filter:focus { border-color: var(--accent); box-shadow: var(--shadow-accent); }
.filter-btn {
  padding: 9px 22px; border-radius: 50px; border: 1.5px solid var(--border);
  background: var(--card-bg); color: var(--text-light); font-size: 0.82rem; font-weight: 600;
  cursor: pointer; transition: var(--transition); font-family: inherit;
}
.filter-btn:hover { border-color: var(--accent-light); color: var(--accent); background: var(--accent-glow); }
.filter-btn.active { background: var(--accent-gradient); color: #fff; border-color: transparent; box-shadow: var(--shadow-accent); }
/* count badge inside filter pills */
.filter-btn .fc {
  margin-left: 7px; font-size: 0.68rem; font-weight: 700; opacity: 0.55;
  background: rgba(0,0,0,0.06); border-radius: 50px; padding: 1px 7px;
}
.filter-btn.active .fc { background: rgba(255,255,255,0.22); opacity: 1; }

/* ── Content layout ── */
.content-layout { display: grid; grid-template-columns: 1fr 360px; gap: 40px; }

/* ── News grid ── */
.news-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.news-card {
  background: var(--card-bg); border-radius: var(--radius); overflow: hidden;
  border: 1px solid var(--border-light); transition: var(--transition); cursor: pointer;
  opacity: 0; transform: translateY(24px); animation: bacoCardIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes bacoCardIn { to { opacity: 1; transform: translateY(0); } }
.news-card:hover { transform: translateY(-6px); box-shadow: var(--shadow-lg); border-color: rgba(11, 25, 143, 0.2); }
.news-card-img { position: relative; aspect-ratio: 4 / 3; overflow: hidden; background: var(--bg-alt); }
.news-card-img img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1); }
.news-card:hover .news-card-img img { transform: scale(1.08); }
.news-card-img .category-tag {
  position: absolute; top: 14px; left: 14px; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px);
  color: #fff; padding: 5px 12px; border-radius: 50px; font-size: 0.65rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.news-card-body { padding: 16px; }
.news-card-body h3 { font-size: 0.9rem; font-weight: 700; line-height: 1.4; margin-bottom: 0; color: var(--text); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.news-card-body p { color: var(--text-light); font-size: 0.83rem; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 18px; }
.card-meta { display: flex; align-items: center; justify-content: space-between; font-size: 0.76rem; color: var(--text-lighter); padding-top: 14px; border-top: 1px solid var(--border-light); }
.card-meta .author { display: flex; align-items: center; gap: 8px; }
.author-avatar { width: 26px; height: 26px; border-radius: 50%; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 0.6rem; font-weight: 700; }
.read-time { display: flex; align-items: center; gap: 4px; }

/* ── Empty / loading ── */
.empty-state { background: var(--card-bg); border: 1px solid var(--border-light); border-radius: var(--radius); padding: 60px 24px; text-align: center; color: var(--text-light); }
.empty-state svg { margin: 0 auto 12px; color: var(--text-lighter); display: block; }
.empty-state p { font-size: 0.9rem; margin-bottom: 14px; }
.spinner { width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--border); border-top-color: var(--accent); margin: 0 auto 14px; animation: bacoSpin 0.8s linear infinite; }
@keyframes bacoSpin { to { transform: rotate(360deg); } }
.btn-reset { padding: 9px 20px; border-radius: 50px; border: 1.5px solid var(--accent); background: transparent; color: var(--accent); font-weight: 600; font-size: 0.82rem; cursor: pointer; font-family: inherit; transition: var(--transition); }
.btn-reset:hover { background: var(--accent-gradient); color: #fff; border-color: transparent; }

/* ── Load more ── */
.load-more { text-align: center; margin-top: 40px; }
.load-more button {
  padding: 14px 48px; border-radius: 50px; border: 2px solid var(--accent); background: transparent;
  color: var(--accent); font-weight: 700; font-size: 0.88rem; cursor: pointer; font-family: inherit; transition: var(--transition);
}
.load-more button:hover { background: var(--accent-gradient); color: #fff; border-color: transparent; box-shadow: var(--shadow-accent); transform: translateY(-2px); }

/* ── Sidebar ── */
.sidebar { display: flex; flex-direction: column; gap: 28px; }
.sidebar-widget { background: var(--card-bg); border-radius: var(--radius); padding: 26px; border: 1px solid var(--border-light); transition: var(--transition); }
.sidebar-widget:hover { box-shadow: var(--shadow); }
.widget-title { font-size: 1.1rem; font-weight: 800; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; color: var(--text); }
.widget-title::before { content: ''; width: 3px; height: 18px; background: var(--accent-gradient); border-radius: 2px; }
.trending-item { display: flex; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--border-light); cursor: pointer; transition: var(--transition); }
.trending-item:last-child { border-bottom: none; padding-bottom: 0; }
.trending-item:first-child { padding-top: 0; }
.trending-item:hover { padding-left: 6px; }
.trending-num { font-size: 1.6rem; font-weight: 800; color: var(--border); line-height: 1; min-width: 32px; transition: var(--transition); font-family: 'Plus Jakarta Sans', sans-serif; }
.trending-item:hover .trending-num { color: var(--accent); }
.trending-info h4 { font-size: 0.85rem; font-weight: 600; line-height: 1.4; margin-bottom: 4px; color: var(--text); }
.trending-info span { font-size: 0.72rem; color: var(--text-lighter); }
.tags-widget { background: var(--accent-gradient); color: #fff; border: none; position: relative; overflow: hidden; }
.tags-widget::before { content: ''; position: absolute; top: -50%; right: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 60%); }
.tags-widget .widget-title { color: #fff; position: relative; }
.tags-widget .widget-title::before { background: rgba(255,255,255,0.5); }
.tags-widget .tags-cloud { position: relative; }
.tags-widget .tag { background: rgba(255,255,255,0.14); border-color: rgba(255,255,255,0.25); color: #fff; backdrop-filter: blur(4px); }
.tags-widget .tag:hover { background: #fff; color: var(--accent-dark); border-color: #fff; transform: translateY(-2px); }
.tags-cloud { display: flex; flex-wrap: wrap; gap: 8px; }
.tag { padding: 7px 16px; border-radius: 50px; border: 1.5px solid var(--border); font-size: 0.75rem; font-weight: 500; color: var(--text-light); cursor: pointer; transition: var(--transition); font-family: inherit; }
.tag:hover { background: var(--accent-glow); color: var(--accent); border-color: var(--accent-light); }

/* ── Toast ── */
.toast {
  position: fixed; bottom: 30px; right: 30px; background: var(--primary); color: #fff;
  padding: 16px 26px; border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: 500;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.3); transform: translateY(120px); opacity: 0;
  transition: var(--transition); z-index: 3000; border-left: 3px solid var(--accent);
}
.toast.show { transform: translateY(0); opacity: 1; }

/* ── Article overlay ── */
.article-overlay {
  position: fixed; inset: 0; z-index: 2500; background: var(--bg); overflow-y: auto;
  transform: translateX(100%); transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}
.article-overlay.open { transform: translateX(0); }
.article-topbar {
  position: sticky; top: 0; z-index: 10; background: rgba(240, 244, 255, 0.92);
  backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); padding: 14px 0;
}
.article-topbar-inner { display: flex; align-items: center; justify-content: space-between; }
.btn-back {
  display: flex; align-items: center; gap: 8px; background: none; border: 1.5px solid var(--border);
  padding: 8px 18px; border-radius: 50px; font-size: 0.82rem; font-weight: 600; color: var(--text);
  cursor: pointer; transition: var(--transition); font-family: inherit;
}
.btn-back:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-glow); }
.article-topbar-actions { display: flex; gap: 8px; }
.btn-action {
  width: 38px; height: 38px; border-radius: 50%; border: 1.5px solid var(--border); background: var(--card-bg);
  display: flex; align-items: center; justify-content: center; cursor: pointer; transition: var(--transition);
  color: var(--text-light); padding: 0;
}
.btn-action:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-glow); }
.btn-action.active { background: var(--accent-gradient); color: #fff; border-color: transparent; }
.article-hero { position: relative; aspect-ratio: 3 / 2; border-radius: var(--radius); overflow: hidden; background: var(--bg-alt); box-shadow: var(--shadow-lg); margin: 24px auto 0; max-width: 960px; }
.article-hero img { width: 100%; height: 100%; object-fit: cover; object-position: center top; }
/* ── Rounded card: hero photo → share buttons (Related Stories stays outside) ── */
.article-card { max-width: 960px; margin: 24px auto 36px; background: var(--card-bg); border: 1px solid var(--border-light); border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow-lg); }
.article-card .article-hero { margin: 0; max-width: none; border-radius: 0; box-shadow: none; }
.related-wrap { max-width: 960px; margin: 0 auto 80px; padding: 0 24px; }
/* Copied/Facebook HTML must render as plain text — kill pasted white backgrounds */
.article-content :deep(*:not(blockquote)) { background-color: transparent !important; background-image: none !important; }
.article-hero-overlay { position: absolute; inset: 0; background: linear-gradient(transparent 40%, rgba(15, 23, 42, 0.85) 100%); display: flex; align-items: flex-end; }
.article-hero-content { padding: 48px; color: #fff; max-width: 900px; }
.article-hero-content .category-tag { background: var(--accent-gradient); padding: 5px 16px; border-radius: 50px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; display: inline-block; margin-bottom: 16px; }
.article-hero-content h1 { font-size: 2.4rem; font-weight: 800; line-height: 1.25; margin-bottom: 16px; color: #fff; }
.article-body-wrap { max-width: 900px; margin: 0 auto; padding: 36px 32px 48px; }
.article-author-bar { display: flex; align-items: center; justify-content: space-between; padding-bottom: 28px; margin-bottom: 36px; border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 16px; }
.article-author-info { display: flex; align-items: center; gap: 14px; }
.article-author-avatar { width: 48px; height: 48px; border-radius: 50%; background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 0.9rem; }
.article-author-name { font-weight: 700; font-size: 0.95rem; color: var(--text); }
.article-author-role { font-size: 0.78rem; color: var(--text-light); }
.article-date-info { font-size: 0.82rem; color: var(--text-light); text-align: right; }
.article-date-info strong { color: var(--text); display: block; }

.article-content { font-size: 1.05rem; line-height: 1.85; color: var(--text); overflow-wrap: anywhere; }
.article-content :deep(p) { margin-bottom: 24px; }
.article-content :deep(h2) { font-size: 1.5rem; font-weight: 800; margin: 40px 0 16px; display: flex; align-items: center; gap: 12px; }
.article-content :deep(h2)::before { content: ''; width: 4px; height: 22px; background: var(--accent-gradient); border-radius: 2px; flex-shrink: 0; }
.article-content :deep(blockquote) { border-left: 4px solid var(--accent); background: var(--accent-glow); padding: 20px 28px; margin: 28px 0; border-radius: 0 var(--radius-sm) var(--radius-sm) 0; font-style: italic; color: var(--accent-dark); font-size: 1.08rem; line-height: 1.7; }
.article-content :deep(ul) { margin: 16px 0 24px 20px; }
.article-content :deep(ol) { margin: 16px 0 24px 20px; }
.article-content :deep(li) { margin-bottom: 10px; padding-left: 8px; }
.article-content :deep(ul li::marker) { color: var(--accent); }
.article-content :deep(strong) { color: var(--text); }
.article-content :deep(a) { color: var(--accent); }
.article-content :deep(img) { max-width: 100%; border-radius: var(--radius); height: auto; }
.article-content :deep(div) { margin: 0; padding: 0; }

.article-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 40px; padding-top: 28px; border-top: 1px solid var(--border); }
.article-tags span { padding: 6px 16px; border-radius: 50px; background: var(--accent-glow); color: var(--accent); font-size: 0.78rem; font-weight: 600; }
.article-share { display: flex; align-items: center; gap: 12px; margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--border); }
.article-share span { font-size: 0.85rem; font-weight: 600; color: var(--text-light); }
.share-btn { width: 40px; height: 40px; border-radius: 50%; border: 1.5px solid var(--border); background: var(--card-bg); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: var(--transition); font-size: 0.85rem; color: var(--text-light); padding: 0; }
.share-btn:hover { background: var(--accent-gradient); color: #fff; border-color: transparent; }

.related-section { margin-top: 48px; padding-top: 36px; border-top: 2px solid var(--border); }
.related-section h3 { font-size: 1.3rem; font-weight: 800; margin-bottom: 24px; display: flex; align-items: center; gap: 12px; color: var(--text); }
.related-section h3::before { content: ''; width: 4px; height: 22px; background: var(--accent-gradient); border-radius: 2px; }
.related-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.related-card { background: var(--card-bg); border-radius: var(--radius); overflow: hidden; border: 1px solid var(--border-light); cursor: pointer; transition: var(--transition); }
.related-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
.related-card-img { aspect-ratio: 4 / 3; overflow: hidden; background: var(--bg-alt); }
.related-card-img img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; }
.related-card:hover .related-card-img img { transform: scale(1.06); }
.related-card-body { padding: 16px; }
.related-card-body h4 { font-size: 0.88rem; font-weight: 700; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; color: var(--text); }
.related-card-body .rc-meta { font-size: 0.72rem; color: var(--text-lighter); margin-top: 8px; display: flex; align-items: center; gap: 8px; }
.related-card-body .rc-cat { color: var(--accent); font-weight: 600; text-transform: uppercase; font-size: 0.65rem; letter-spacing: 0.5px; }

.reading-progress { position: fixed; top: 0; left: 0; height: 3px; z-index: 2600; background: var(--accent-gradient); width: 0%; transition: width 0.1s linear; }

/* ── Responsive ── */
@media (max-width: 1024px) {
  .news-grid { grid-template-columns: repeat(2, 1fr); }
  .content-layout { grid-template-columns: 1fr; }
  .sidebar { display: grid; grid-template-columns: repeat(2, 1fr); }
  .related-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 768px) {
  .news-grid { grid-template-columns: 1fr; }
  .sidebar { grid-template-columns: 1fr; }
  .article-hero-content h1 { font-size: 1.6rem; }
  .article-hero-content { padding: 28px 20px; }
  .article-hero { margin-top: 12px; border-radius: var(--radius-sm); }
  .related-grid { grid-template-columns: 1fr; }
  .date-filter { flex: 1 1 100%; }
}

/* ── Mobile density pass ──
   Image ratios are deliberately untouched (news-card-img 4/3, related-card-img
   4/3, article-hero 3/2, .nc 210x280). Only type scale, box padding and the
   article-hero scrim are tightened so the headline stops burying the photo. */
@media (max-width: 768px) {
  /* Article hero: let the top of the image breathe */
  .article-hero-overlay { background: linear-gradient(transparent 55%, rgba(15, 23, 42, 0.78) 100%); }
  .article-hero-content { padding: 14px 14px 16px; }
  .article-hero-content .category-tag { padding: 3px 10px; font-size: 0.6rem; letter-spacing: 0.6px; margin-bottom: 7px; }
  .article-hero-content h1 { font-size: 1.1rem; line-height: 1.22; margin-bottom: 0; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5); }

  /* Coverflow cards */
  .nc__top { top: 10px; left: 10px; right: 10px; }
  .nc__bottom { bottom: 12px; left: 12px; right: 12px; gap: 4px; }
  .nc__badge { font-size: 9px; padding: 3px 8px; }
  .nc__meta { font-size: 10px; }
  .nc__title { font-size: clamp(12px, 3.4vw, 15px); }
  .nc.pos-featured .nc__title { font-size: clamp(13px, 3.7vw, 16px); }
  .ns__pagination { padding: 8px 16px; gap: 12px; }
  .ns__pagination-dots { gap: 6px; }
  .ns__counter { font-size: 11px; }

  /* Section header + search */
  .section-header { margin-bottom: 16px; gap: 10px; }
  .section-header h2 { font-size: 1.15rem; gap: 8px; }
  .section-header h2::before { height: 18px; }
  .search-box { padding: 7px 14px; }
  .search-box input { font-size: 0.8rem; }

  /* Category filter */
  .category-filter { gap: 6px; margin-bottom: 18px; }
  .filter-btn { padding: 8px 15px; font-size: 0.76rem; }
  .filter-btn .fc { margin-left: 5px; font-size: 0.62rem; padding: 1px 6px; }

  /* News cards */
  .news-grid { gap: 14px; }
  .news-card-img .category-tag { top: 8px; left: 8px; padding: 3px 9px; font-size: 0.58rem; }
  .news-card-body { padding: 14px; }
  .news-card-body h3 { font-size: 0.86rem; margin-bottom: 5px; }
  .news-card-body p { font-size: 0.76rem; margin-bottom: 11px; }
  .card-meta { font-size: 0.7rem; padding-top: 9px; }
  .card-meta .author { gap: 6px; }
  .author-avatar { width: 20px; height: 20px; font-size: 0.52rem; }

  .load-more { margin-top: 24px; }
  .load-more button { padding: 12px 30px; font-size: 0.8rem; }
  .empty-state { padding: 34px 18px; }
  .empty-state p { font-size: 0.82rem; margin-bottom: 10px; }

  /* Sidebar */
  .sidebar { gap: 16px; }
  .sidebar-widget { padding: 16px; }
  .widget-title { font-size: 0.95rem; margin-bottom: 12px; gap: 8px; }
  .widget-title::before { height: 14px; }
  .trending-item { gap: 10px; padding: 10px 0; }
  .trending-num { font-size: 1.15rem; min-width: 22px; }
  .trending-info h4 { font-size: 0.78rem; }
  .trending-info span { font-size: 0.66rem; }
  .tags-cloud { gap: 6px; }
  .tag { padding: 6px 12px; font-size: 0.7rem; }

  /* Article body */
  .article-body-wrap { padding: 24px 16px 52px; }
  .article-author-bar { padding-bottom: 18px; margin-bottom: 20px; gap: 10px; }
  .article-author-info { gap: 10px; }
  .article-author-avatar { width: 38px; height: 38px; font-size: 0.78rem; }
  .article-author-name { font-size: 0.85rem; }
  .article-author-role { font-size: 0.72rem; }
  .article-date-info { font-size: 0.75rem; }
  .article-content { font-size: 0.95rem; line-height: 1.7; }
  .article-content :deep(p) { margin-bottom: 16px; }
  .article-content :deep(h2) { font-size: 1.15rem; margin: 26px 0 10px; gap: 8px; }
  .article-content :deep(h2)::before { height: 16px; }
  .article-content :deep(blockquote) { padding: 14px 16px; margin: 18px 0; font-size: 0.95rem; line-height: 1.6; }
  .article-content :deep(ul), .article-content :deep(ol) { margin: 12px 0 16px 18px; }
  .article-content :deep(li) { margin-bottom: 6px; padding-left: 4px; }
  .article-tags { margin-top: 24px; padding-top: 18px; gap: 6px; }
  .article-tags span { padding: 5px 11px; font-size: 0.7rem; }
  .article-share { gap: 8px; margin-top: 16px; padding-top: 16px; }
  .article-share span { font-size: 0.78rem; }

  /* Related */
  .related-section { margin-top: 28px; padding-top: 22px; }
  .related-section h3 { font-size: 1rem; margin-bottom: 14px; gap: 8px; }
  .related-section h3::before { height: 16px; }
  .related-card-body { padding: 12px; }
  .related-card-body h4 { font-size: 0.8rem; }
  .related-card-body .rc-meta { font-size: 0.66rem; margin-top: 6px; }

  /* Toast */
  .toast { left: 16px; right: 16px; bottom: 16px; padding: 12px 16px; font-size: 0.8rem; }
}
</style>