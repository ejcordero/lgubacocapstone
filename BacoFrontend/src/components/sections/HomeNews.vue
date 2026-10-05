<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

const newsItems = ref([])

// ══════════════════════════════════════════════════════════════════
// ARTICLE OVERLAY — ported from News.vue
// Replaces the .story-modal this file used to carry (which was a copy of
// LandingPage.vue's, not News.vue's). Same helpers, same behaviour: the
// slideshow / filmstrip / lightbox are gone, since News.vue's overlay has no
// equivalent. Class names are left unprefixed to match the source, except
// .hnw for the container, which News.vue calls .n-wrap.
// ══════════════════════════════════════════════════════════════════
const overlayOpen = ref(false)
const currentArticle = ref(null)
const readingProgress = ref(0)
const articleRatio = ref(1.5)
const overlayEl = ref(null)
const bookmarks = ref(new Set(_loadBookmarks()))

// ── Author (site-wide constants, same as News.vue) ──
const AUTHOR_NAME = 'Baco Information Office'
const AUTHOR_INITIALS = 'BCO'
const AUTHOR_ROLE = 'Municipal Information Office'
const authorOf = () => AUTHOR_NAME
const authorInitials = () => AUTHOR_INITIALS
const authorRole = () => AUTHOR_ROLE

const hasRealImage = (item) => !!item?.image && !item.image.includes('via.placeholder.com')

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

const storyBody = computed(() => {
  const item = currentArticle.value
  if (!item) return ''
  if (item.content) return item.content
  const d = item.description || 'Stay tuned for more updates from the Municipality of Baco.'
  return `<p>${d}</p><p>Published by the Municipality of Baco, Oriental Mindoro.</p>`
})

// News.vue keys its tag chips off the article's real DB category. HomeNews
// overwrites .category with its own display label, so the DB value is kept
// separately by fetchNews as .dbCategory.
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

const currentArticleTags = computed(() => {
  const item = currentArticle.value
  if (!item) return []
  const cat = item.dbCategory || item.category
  return CATEGORY_TAGS[cat] || [item.category || 'News & Updates']
})

const relatedArticles = computed(() => {
  const item = currentArticle.value
  if (!item) return []
  const cat = item.dbCategory || item.category
  return newsItems.value
    .filter((x) => x.id !== item.id)
    .sort((a, b) => {
      const ma = (a.dbCategory || a.category) === cat ? -1 : 0
      const mb = (b.dbCategory || b.category) === cat ? -1 : 0
      return ma - mb
    })
    .slice(0, 3)
})

// ── Open / close ──
const openArticle = (item) => {
  currentArticle.value = item
  overlayOpen.value = true
  readingProgress.value = 0
  document.body.style.overflow = 'hidden'
  // Match the hero to the photo's real ratio once it has decoded, so the
  // title band never crops more of the image than it has to.
  const pre = new Image()
  pre.onload = () => {
    if (currentArticle.value === item && pre.naturalWidth > 0 && pre.naturalHeight > 0) {
      articleRatio.value = pre.naturalWidth / pre.naturalHeight
    }
  }
  pre.src = item.image
  nextTick(() => { if (overlayEl.value) overlayEl.value.scrollTop = 0 })
}

const closeArticle = () => {
  overlayOpen.value = false
  readingProgress.value = 0
  document.body.style.overflow = ''
}

const syncArticleRatio = (e) => {
  const el = e.currentTarget
  if (el && el.naturalWidth > 0 && el.naturalHeight > 0) articleRatio.value = el.naturalWidth / el.naturalHeight
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

const isBookmarked = (item) => bookmarks.value.has(item.id)

const toggleBookmark = () => {
  const item = currentArticle.value
  if (!item) return
  if (bookmarks.value.has(item.id)) { bookmarks.value.delete(item.id); showToast('Bookmark removed') }
  else { bookmarks.value.add(item.id); showToast('Article bookmarked') }
  _saveBookmarks()
}

// ── Share & toast ──
const toastMsg = ref('')
const toastShow = ref(false)
let toastTimer = null

const showToast = (msg) => {
  toastMsg.value = msg
  toastShow.value = true
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastShow.value = false }, 3000)
}

const pageUrl = () => window.location.href

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

const CATEGORIES = [
  { label: 'Culture & Heritage', color: '#0B198F', bg: 'rgba(11,25,143,0.09)' },
  { label: 'Health',             color: '#0d7a3e', bg: 'rgba(16,130,68,0.09)' },
  { label: 'Public Safety',      color: '#CE1126', bg: 'rgba(206,17,38,0.09)' },
  { label: 'Environment',        color: '#1b7a3d', bg: 'rgba(27,122,61,0.09)' },
  { label: 'Tourism',            color: '#C98A2B', bg: 'rgba(201,138,43,0.09)' },
  { label: 'Bulletin',           color: '#3D6BD6', bg: 'rgba(61,107,214,0.09)' },
]

const stripHtml = (html) => (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

const readTimeFor = (item) => {
  const words = `${stripHtml(item.content)} ${item.title || ''}`.trim().split(/\s+/).filter(Boolean).length
  return `${Math.max(1, Math.ceil(words / 200))} min read`
}

const fetchNews = async () => {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:3000/api'}/news`)
    if (res.ok) {
      const raw = await res.json()
      newsItems.value = raw.map((item, i) => {
        const cat = CATEGORIES[i % CATEGORIES.length]
        const excerpt = stripHtml(item.content).slice(0, 220)
        return {
          ...item,
          title: item.title || 'Untitled announcement',
          // The real DB category, kept because .category is about to be
          // replaced with this section's own display label. The article
          // overlay's tag chips are keyed off this.
          dbCategory: item.category,
          category: cat.label,
          categoryColor: cat.color,
          categoryBg: cat.bg,
          excerpt: excerpt || (item.description || ''),
          image: item.image,
          readTime: readTimeFor(item),
          featured: i === 0
        }
      })
    }
  } catch (e) {
    console.error('Error fetching news:', e)
  }
}

// ══════════════════════════════════════════════════════════════════
// HERO COVERFLOW — design ported from News.vue's hero
// Prefixed hnh-/hnc- because .ns is already this section's root, and the
// neighbouring page components use the unprefixed .nc names.
// ══════════════════════════════════════════════════════════════════
const heroItems = computed(() => newsItems.value.slice(0, 8))
const heroIdx = ref(0)
const heroTotal = computed(() => heroItems.value.length)
const heroProgressEl = ref(null)

const HERO_DURATION = 2500
const HERO_ANIMATION = 1300
const prefersReducedMotion = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches

let heroRaf = null
let heroProgressStart = 0
let heroAnimating = false
let heroTouchStartX = 0

// Maps an item's offset from the active index onto a coverflow position class.
const heroPosition = (i) => {
  const total = heroTotal.value
  if (!total) return ''
  let offset = i - heroIdx.value
  if (offset > Math.floor(total / 2)) offset -= total
  if (offset < -Math.floor(total / 2)) offset += total
  if (offset === 0) return 'is-featured'
  if (offset === -1) return 'is-left-1'
  if (offset === -2) return 'is-left-2'
  if (offset === 1) return 'is-right-1'
  if (offset === 2) return 'is-right-2'
  return ''
}

const heroUpdateProgress = () => {
  if (prefersReducedMotion || heroTotal.value <= 1) {
    if (heroProgressEl.value) heroProgressEl.value.style.width = '0%'
    return
  }
  const elapsed = Date.now() - heroProgressStart
  const pct = Math.min((elapsed / HERO_DURATION) * 100, 100)
  if (heroProgressEl.value) heroProgressEl.value.style.width = pct + '%'
  if (pct >= 100) { heroGoTo(heroIdx.value + 1); return }
  heroRaf = requestAnimationFrame(heroUpdateProgress)
}

const heroResetAuto = () => {
  cancelAnimationFrame(heroRaf)
  heroProgressStart = Date.now()
  heroUpdateProgress()
}

const heroGoTo = (index) => {
  const total = heroTotal.value
  if (!total || heroAnimating) return
  heroAnimating = true
  heroIdx.value = (index + total) % total
  heroResetAuto()
  setTimeout(() => { heroAnimating = false }, HERO_ANIMATION)
}

const heroNext = () => heroGoTo(heroIdx.value + 1)

const heroTouchStart = (e) => { heroTouchStartX = e.touches[0].clientX }
const heroTouchEnd = (e) => {
  const diff = heroTouchStartX - e.changedTouches[0].clientX
  if (Math.abs(diff) > 50) heroGoTo(heroIdx.value + (diff > 0 ? 1 : -1))
}

// Keeps the index valid when the fetch lands (or shrinks) after mount.
watch(heroTotal, (n) => {
  if (heroIdx.value >= n) heroIdx.value = 0
  heroResetAuto()
})

onMounted(async () => {
  await fetchNews()
  heroResetAuto()
  window.addEventListener('keydown', handleKey)
})

onUnmounted(() => {
  cancelAnimationFrame(heroRaf)
  clearTimeout(toastTimer)
  window.removeEventListener('keydown', handleKey)
  if (overlayOpen.value) document.body.style.overflow = 'auto'
})
</script>

<template>
  <section id="news" class="ns">

    <!-- ══════════ HERO (coverflow) — design from News.vue ══════════ -->
    <div class="hnh" v-if="heroTotal > 0">
      <div class="hnh__bg" aria-hidden="true"></div>
      <div class="hnh__overlay" aria-hidden="true"></div>
      <div class="hnh__progress" ref="heroProgressEl" aria-hidden="true"></div>

      <div class="hnh__navdots" v-if="heroTotal > 1">
        <button
          v-for="(item, i) in heroItems" :key="'dot-' + i"
          class="hnh__navdot" :class="{ 'is-active': i === heroIdx }"
          :data-tip="item.title" :aria-label="`View ${item.title}`"
          @click="heroGoTo(i)"
        ></button>
      </div>

      <div class="hnh__stage" @touchstart.passive="heroTouchStart" @touchend.passive="heroTouchEnd">
        <div class="hnh__content">
          <div class="hnh__pill">
            <span class="hnh__pill-dot"></span>
            <span>{{ heroItems[heroIdx].category }}</span>
          </div>
          <h2 class="hnh__name">{{ heroItems[heroIdx].title }}</h2>
          <p class="hnh__desc">{{ (heroItems[heroIdx].excerpt || '').slice(0, 170) }}</p>
          <div class="hnh__actions">
            <button class="hnh__cta" @click="openArticle(heroItems[heroIdx])">
              <span>Read Article</span>
              <span class="hnh__cta-icon">&rarr;</span>
            </button>
            <button class="hnh__ghost" @click="heroNext">Next Story</button>
          </div>
        </div>

        <div class="hnh__carousel">
          <article
            v-for="(item, i) in heroItems" :key="item.id || i"
            class="hnc" :class="heroPosition(i)"
            @click="openArticle(item)"
          >
            <img :src="item.image" :alt="item.title" loading="lazy" />
            <div class="hnc__scrim" aria-hidden="true"></div>
            <div class="hnc__top">
              <span class="hnc__badge" :style="{ background: item.categoryColor, color: '#fff' }">{{ item.category }}</span>
            </div>
            <div class="hnc__bottom">
              <span class="hnc__meta">{{ item.date }} &middot; {{ item.readTime }}</span>
              <span class="hnc__title">{{ item.title }}</span>
            </div>
          </article>
        </div>
      </div>

      <div class="hnh__pagination" v-if="heroTotal > 1">
        <div class="hnh__pagination-dots">
          <button
            v-for="(item, i) in heroItems" :key="'pg-' + i"
            class="hnh__pagination-dot" :class="{ 'is-active': i === heroIdx }"
            :aria-label="`Go to ${item.title}`" @click="heroGoTo(i)"
          ></button>
        </div>
        <span class="hnh__counter">{{ String(heroIdx + 1).padStart(2, '0') }} / {{ String(heroTotal).padStart(2, '0') }}</span>
      </div>
    </div>

    <!-- No published articles yet: keep the section's height so the layout
         below doesn't jump once the first story lands. -->
    <div class="hnh hnh--empty" v-else>
      <div class="hnh__bg" aria-hidden="true"></div>
      <div class="hnh__overlay" aria-hidden="true"></div>
      <div class="hnh-empty">
        <i class="fas fa-newspaper" aria-hidden="true"></i>
        <h2 class="hnh__name">No announcements yet</h2>
        <p class="hnh__desc">Check back soon for the latest news from the Municipality of Baco.</p>
      </div>
    </div>

    <Teleport to="body">
    <!-- ══ ARTICLE OVERLAY — from News.vue ══ -->
    <div class="reading-progress" :style="{ width: readingProgress + '%' }"></div>
    <div ref="overlayEl" class="article-overlay" :class="{ open: overlayOpen }" @scroll="onOverlayScroll">
      <div class="article-topbar">
        <div class="hnw">
          <div class="article-topbar-inner">
            <button class="btn-back" @click="closeArticle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              Back
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
        <div class="article-hero" :style="{ aspectRatio: articleRatio }">
          <img :src="currentArticle.image" :alt="currentArticle.title" :class="{ 'ph': !hasRealImage(currentArticle) }" @load="syncArticleRatio" />
          <div class="article-hero-overlay">
            <div class="article-hero-content">
              <span class="category-tag">{{ currentArticle.category }}</span>
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

          <div class="related-section" v-if="relatedArticles.length">
            <h3>Related Stories</h3>
            <div class="related-grid">
              <div v-for="r in relatedArticles" :key="r.id" class="related-card" @click="openArticle(r)">
                <div class="related-card-img">
                  <img :src="r.image" :alt="r.title" :class="{ 'ph': !hasRealImage(r) }" />
                </div>
                <div class="related-card-body">
                  <span class="rc-cat">{{ r.category }}</span>
                  <h4>{{ r.title }}</h4>
                  <div class="rc-meta">
                    <span>{{ authorOf() }}</span>
                    <span>&bull;</span>
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
    </Teleport>
  </section>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=Inter:wght@300;400;500;600&display=swap');
@import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css');

.ns {
  --navy:  #0B198F;
  --red:   #CE1126;
  --ease:  cubic-bezier(0.16, 1, 0.3, 1);

  position: relative;
  background: #f5f7fb;
  padding: 0;
  overflow: hidden;
  z-index: 10;
}

/* ── Responsive ── */
/* ── Hero (coverflow) — ported from News.vue ── */
/* Height is trimmed from News.vue's 100vh: this block sits mid-page, so a
   full-viewport jump would swallow the rest of the home page. */
.hnh {
  --hnh-navy: #0B198F;
  --hnh-red: #CE1126;
  position: relative;
  width: 100%;
  height: 82vh;
  min-height: 600px;
  max-height: 860px;
  overflow: hidden;
  background: #f5f7fb;
  color: #fff;
}
.hnh__bg { position: absolute; inset: 0; z-index: 0; background: url('/images/img2.jpg') center 35% / cover no-repeat; }
.hnh__overlay { position: absolute; inset: 0; z-index: 1; background: linear-gradient(90deg, rgba(4,8,40,0.55) 0%, rgba(4,8,40,0.15) 45%, rgba(4,8,40,0.5) 100%); }
.hnh__progress { position: absolute; bottom: 0; left: 0; height: 3px; width: 0%; background: linear-gradient(90deg, var(--hnh-navy), var(--hnh-red)); z-index: 60; box-shadow: 0 0 10px rgba(206,17,38,0.4); }

.hnh__navdots { position: absolute; left: 28px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 16px; z-index: 50; }
.hnh__navdot { width: 12px; height: 12px; border-radius: 50%; background: rgba(255,255,255,0.3); cursor: pointer; transition: all 0.3s ease; position: relative; border: none; padding: 0; }
.hnh__navdot::after { content: attr(data-tip); position: absolute; left: 24px; top: 50%; transform: translateY(-50%); padding: 6px 12px; background: rgba(11,25,143,0.92); color: #fff; backdrop-filter: blur(10px); border-radius: 6px; font-size: 11px; font-family: 'Inter', sans-serif; font-weight: 500; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.3s ease; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
.hnh__navdot:hover::after { opacity: 1; }
.hnh__navdot:hover { background: var(--hnh-navy); }
.hnh__navdot.is-active { background: var(--hnh-red); transform: scale(1.35); box-shadow: 0 0 0 4px rgba(206,17,38,0.15); }

.hnh__stage { position: relative; z-index: 10; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; gap: 72px; padding: 70px 40px 90px; }
.hnh__content { width: 100%; max-width: 460px; }
.hnh__pill { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.14); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.25); border-radius: 50px; padding: 7px 16px; margin-bottom: 22px; font-size: 12px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #fff; font-family: 'Inter', sans-serif; }
.hnh__pill-dot { width: 8px; height: 8px; background: var(--hnh-red); border-radius: 50%; animation: hnhPulse 2s infinite; }
@keyframes hnhPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.45; transform: scale(1.25); } }

.hnh__name { font-family: 'Playfair Display', serif; font-weight: 900; font-size: clamp(26px, 2.4vw, 32px); letter-spacing: -0.02em; line-height: 1.2; height: 3.6em; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin: 0 0 16px; color: #fff; text-shadow: 0 2px 12px rgba(0,0,0,0.45); }
.hnh__desc { font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.7; color: rgba(255,255,255,0.9); margin: 0 0 30px; text-shadow: 0 1px 6px rgba(0,0,0,0.35); }
.hnh__actions { display: flex; align-items: center; gap: 14px; }
.hnh__cta { display: inline-flex; align-items: center; gap: 10px; padding: 13px 26px; background: linear-gradient(135deg, var(--hnh-red), #a30e1f); border: none; border-radius: 50px; color: #fff; font-size: 14px; font-weight: 700; letter-spacing: 0.02em; cursor: pointer; transition: all 0.3s var(--ease); box-shadow: 0 10px 26px rgba(163,14,31,0.35); font-family: 'Inter', sans-serif; }
.hnh__cta:hover { transform: translateY(-3px); box-shadow: 0 16px 34px rgba(163,14,31,0.45); }
.hnh__cta-icon { width: 26px; height: 26px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 15px; line-height: 1; }
.hnh__ghost { display: inline-flex; align-items: center; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; color: #fff; text-decoration: none; padding: 13px 20px; border: 1px solid rgba(255,255,255,0.4); border-radius: 50px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); background: transparent; appearance: none; -webkit-appearance: none; transition: background 0.25s, border-color 0.25s, color 0.25s; }
.hnh__ghost:hover { background: #fff; border-color: #fff; color: var(--hnh-navy); }

.hnh__carousel { position: relative; width: 640px; height: 440px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; perspective: 1200px; }
.hnc { position: absolute; top: 50%; left: 50%; width: 270px; height: 350px; margin-left: -135px; margin-top: -175px; border-radius: 20px; overflow: hidden; cursor: pointer; background: #fff; box-shadow: 0 25px 60px rgba(11,25,143,0.22); transition: all 1.3s var(--ease); opacity: 0; transform: scale(0.5); pointer-events: none; will-change: transform, opacity, filter; border: 1px solid rgba(255,255,255,0.7); }
.hnc img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.6s var(--ease); }
.hnc:hover img { transform: scale(1.06); }
.hnc__scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(8,10,30,0.05) 0%, transparent 32%, rgba(8,10,30,0.18) 58%, rgba(8,10,30,0.72) 100%); z-index: 1; pointer-events: none; }
.hnc__top { position: absolute; top: 14px; left: 14px; right: 14px; z-index: 3; display: flex; align-items: flex-start; justify-content: space-between; }
.hnc__badge { font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 4px 10px; border-radius: 6px; line-height: 1.5; box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
.hnc__bottom { position: absolute; bottom: 16px; left: 16px; right: 16px; z-index: 3; display: flex; flex-direction: column; gap: 6px; }
.hnc__meta { font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 500; font-style: italic; color: rgba(255,255,255,0.82); text-shadow: 0 1px 4px rgba(0,0,0,0.4); }
.hnc__title { font-family: 'Playfair Display', serif; font-weight: 800; letter-spacing: -0.01em; color: #fff; font-size: clamp(14px, 1.1vw, 17px); line-height: 1.3; text-shadow: 0 2px 8px rgba(0,0,0,0.45); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.hnc.is-featured { transform: translateX(0) scale(1.06) rotateY(0deg); z-index: 5; opacity: 1; filter: brightness(1) blur(0px); pointer-events: auto; }
.hnc.is-featured .hnc__title { font-size: clamp(15px, 1.2vw, 18px); -webkit-line-clamp: 3; }
.hnc.is-left-1 { transform: translateX(-185px) scale(0.68) rotateY(18deg); z-index: 3; opacity: 0.55; filter: brightness(0.72) blur(0.5px); pointer-events: auto; }
.hnc.is-right-1 { transform: translateX(185px) scale(0.68) rotateY(-18deg); z-index: 3; opacity: 0.55; filter: brightness(0.72) blur(0.5px); pointer-events: auto; }
.hnc.is-left-2 { transform: translateX(-330px) scale(0.42) rotateY(26deg); z-index: 1; opacity: 0.22; filter: brightness(0.5) blur(1.5px); }
.hnc.is-right-2 { transform: translateX(330px) scale(0.42) rotateY(-26deg); z-index: 1; opacity: 0.22; filter: brightness(0.5) blur(1.5px); }

.hnh__pagination { position: absolute; bottom: 34px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 16px; padding: 11px 22px; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); background: rgba(4,8,40,0.45); border: 1px solid rgba(255,255,255,0.2); border-radius: 50px; z-index: 50; box-shadow: 0 8px 24px rgba(0,0,0,0.25); }
.hnh__pagination-dots { display: flex; gap: 8px; align-items: center; }
.hnh__pagination-dot { position: relative; width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.35); cursor: pointer; border: none; padding: 0; transition: all 0.4s ease; }
/* Invisible 40px-tall tap area so the 8px dot stays visually unchanged on mobile */
.hnh__pagination-dot::after { content: ''; position: absolute; inset: -16px -10px; }
.hnh__pagination-dot.is-active { width: 28px; border-radius: 4px; background: var(--hnh-red); }
.hnh__pagination-dot:hover { background: #fff; }
.hnh__counter { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 700; color: #fff; }

.hnh-empty {
  position: relative;
  z-index: 10;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-align: center;
  padding: 40px 24px;
}
.hnh-empty i { font-size: 2.2rem; color: rgba(255,255,255,0.35); margin-bottom: 10px; }
.hnh-empty .hnh__name { height: auto; margin-bottom: 10px; }
.hnh-empty .hnh__desc { margin-bottom: 0; }

@media (max-width: 1200px) {
  .hnh__stage { gap: 40px; padding: 60px 24px 90px; }
  .hnh__content { max-width: 340px; }
  .hnh__carousel { width: 480px; }
  .hnc { width: 230px; height: 300px; margin-left: -115px; margin-top: -150px; }
  .hnc.is-left-1 { transform: translateX(-150px) scale(0.68) rotateY(18deg); }
  .hnc.is-right-1 { transform: translateX(150px) scale(0.68) rotateY(-18deg); }
  .hnc.is-left-2, .hnc.is-right-2 { display: none; }
}
@media (max-width: 768px) {
  .hnh { height: auto; min-height: 600px; }
  .hnh__stage { flex-direction: column; justify-content: center; gap: 34px; padding: 70px 16px 110px; }
  .hnh__content { display: none; }
  .hnh__navdots { display: none; }
  .hnh__carousel { width: 100%; height: 400px; }
  .hnh__pagination { bottom: 28px; }
  .hnc { width: 210px; height: 280px; margin-left: -105px; margin-top: -140px; }
  .hnh__bg { display: none; }
}


/* ══════════════════════════════════════════════════════════════════
   ARTICLE OVERLAY — from News.vue
   Values are inlined rather than using News.vue's --accent / --bg custom
   properties, because those are declared on .baco-news and this file's root
   is .ns. Only .hnw keeps a renamed class; everything else matches News.vue
   so the two stay easy to diff.
   ══════════════════════════════════════════════════════════════════ */
.hnw { max-width: 1320px; margin: 0 auto; padding: 0 24px; }

.article-overlay {
  position: fixed; inset: 0; z-index: 2500; background: #F2F5FC; overflow-y: auto;
  transform: translateX(100%); transition: transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: 'Inter', system-ui, sans-serif; color: #10152B; line-height: 1.6;
}
.article-overlay.open { transform: translateX(0); }
.article-topbar {
  position: sticky; top: 0; z-index: 10; background: rgba(240, 244, 255, 0.92);
  backdrop-filter: blur(20px); border-bottom: 1px solid #DDE1EE; padding: 14px 0;
}
.article-topbar-inner { display: flex; align-items: center; justify-content: space-between; }
.btn-back {
  display: flex; align-items: center; gap: 8px; background: none; border: 1.5px solid #DDE1EE;
  padding: 8px 18px; border-radius: 50px; font-size: 0.82rem; font-weight: 600; color: #10152B;
  cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); font-family: inherit;
}
.btn-back:hover { border-color: #0B198F; color: #0B198F; background: rgba(11, 25, 143, 0.08); }
.article-topbar-actions { display: flex; gap: 8px; }
.btn-action {
  width: 38px; height: 38px; border-radius: 50%; border: 1.5px solid #DDE1EE; background: #ffffff;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  color: #3E4763; padding: 0;
}
.btn-action:hover { border-color: #0B198F; color: #0B198F; background: rgba(11, 25, 143, 0.08); }
.btn-action.active { background: linear-gradient(135deg, #0B198F 0%, #1E3A8A 100%); color: #fff; border-color: transparent; }

.article-hero {
  position: relative; aspect-ratio: 3 / 2; border-radius: 16px; overflow: hidden;
  background: #E8ECF8; box-shadow: 0 12px 40px rgba(7, 15, 92, 0.12);
  margin: 24px auto 0; max-width: 960px;
}
.article-hero img { width: 100%; height: 100%; object-fit: cover; object-position: center top; }
.article-hero img.ph { background: #E8ECF8; }
.article-hero-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(transparent 40%, rgba(15, 23, 42, 0.85) 100%);
  display: flex; align-items: flex-end;
}
.article-hero-content { padding: 48px; color: #fff; max-width: 900px; }
.article-hero-content .category-tag {
  background: linear-gradient(135deg, #0B198F 0%, #1E3A8A 100%); padding: 5px 16px; border-radius: 50px;
  font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
  display: inline-block; margin-bottom: 16px;
}
.article-hero-content h1 { font-size: 2.4rem; font-weight: 800; line-height: 1.25; margin-bottom: 16px; color: #fff; }

.article-body-wrap { max-width: 900px; margin: 0 auto; padding: 40px 24px 80px; }
.article-author-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 28px; margin-bottom: 36px; border-bottom: 1px solid #DDE1EE;
  flex-wrap: wrap; gap: 16px;
}
.article-author-info { display: flex; align-items: center; gap: 14px; }
.article-author-avatar {
  width: 48px; height: 48px; border-radius: 50%;
  background: linear-gradient(135deg, #0B198F 0%, #1E3A8A 100%);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 700; font-size: 0.9rem;
}
.article-author-name { font-weight: 700; font-size: 0.95rem; color: #10152B; }
.article-author-role { font-size: 0.78rem; color: #3E4763; }
.article-date-info { font-size: 0.82rem; color: #3E4763; text-align: right; }
.article-date-info strong { color: #10152B; display: block; }

.article-content { font-size: 1.05rem; line-height: 1.85; color: #10152B; overflow-wrap: anywhere; }
.article-content :deep(p) { margin-bottom: 24px; }
.article-content :deep(h2) { font-size: 1.5rem; font-weight: 800; margin: 40px 0 16px; display: flex; align-items: center; gap: 12px; }
.article-content :deep(h2)::before { content: ''; width: 4px; height: 22px; background: linear-gradient(135deg, #0B198F 0%, #1E3A8A 100%); border-radius: 2px; flex-shrink: 0; }
.article-content :deep(blockquote) {
  border-left: 4px solid #0B198F; background: rgba(11, 25, 143, 0.08);
  padding: 20px 28px; margin: 28px 0; border-radius: 0 10px 10px 0;
  font-style: italic; color: #070f5c; font-size: 1.08rem; line-height: 1.7;
}
.article-content :deep(ul), .article-content :deep(ol) { margin: 16px 0 24px 20px; }
.article-content :deep(li) { margin-bottom: 10px; padding-left: 8px; }
.article-content :deep(ul li::marker) { color: #0B198F; }
.article-content :deep(strong) { color: #10152B; }
.article-content :deep(a) { color: #0B198F; }
.article-content :deep(img) { max-width: 100%; border-radius: 16px; height: auto; }
.article-content :deep(div) { margin: 0; padding: 0; }

.article-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 40px; padding-top: 28px; border-top: 1px solid #DDE1EE; }
.article-tags span { padding: 6px 16px; border-radius: 50px; background: rgba(11, 25, 143, 0.08); color: #0B198F; font-size: 0.78rem; font-weight: 600; }
.article-share { display: flex; align-items: center; gap: 12px; margin-top: 24px; padding-top: 24px; border-top: 1px solid #DDE1EE; }
.article-share span { font-size: 0.85rem; font-weight: 600; color: #3E4763; }
.share-btn {
  width: 40px; height: 40px; border-radius: 50%; border: 1.5px solid #DDE1EE; background: #ffffff;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 0.85rem; color: #3E4763; padding: 0;
}
.share-btn:hover { background: linear-gradient(135deg, #0B198F 0%, #1E3A8A 100%); color: #fff; border-color: transparent; }

.related-section { margin-top: 48px; padding-top: 36px; border-top: 2px solid #DDE1EE; }
.related-section h3 { font-size: 1.3rem; font-weight: 800; margin-bottom: 24px; display: flex; align-items: center; gap: 12px; color: #10152B; }
.related-section h3::before { content: ''; width: 4px; height: 22px; background: linear-gradient(135deg, #0B198F 0%, #1E3A8A 100%); border-radius: 2px; }
.related-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.related-card {
  background: #ffffff; border-radius: 16px; overflow: hidden;
  border: 1px solid #EDEFF7; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.related-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(7, 15, 92, 0.12); }
.related-card-img { aspect-ratio: 4 / 3; overflow: hidden; background: #E8ECF8; }
.related-card-img img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; }
.related-card:hover .related-card-img img { transform: scale(1.06); }
.related-card-body { padding: 16px; }
.related-card-body h4 {
  font-size: 0.88rem; font-weight: 700; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; color: #10152B;
}
.related-card-body .rc-meta { font-size: 0.72rem; color: #9AA3BD; margin-top: 8px; display: flex; align-items: center; gap: 8px; }
.related-card-body .rc-cat { color: #0B198F; font-weight: 600; text-transform: uppercase; font-size: 0.65rem; letter-spacing: 0.5px; }

.reading-progress {
  position: fixed; top: 0; left: 0; height: 3px; z-index: 2600;
  background: linear-gradient(135deg, #0B198F 0%, #1E3A8A 100%);
  width: 0%; transition: width 0.1s linear;
}

/* Toast */
.toast {
  position: fixed; bottom: 30px; right: 30px; background: #0B198F; color: #fff;
  padding: 16px 26px; border-radius: 10px; font-size: 0.85rem; font-weight: 500;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.3); transform: translateY(120px); opacity: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 3000; border-left: 3px solid #0B198F;
}
.toast.show { transform: translateY(0); opacity: 1; }

@media (max-width: 1024px) {
  .related-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 768px) {
  .article-hero-content h1 { font-size: 1.6rem; }
  .article-hero-content { padding: 28px 20px; }
  .article-hero { margin-top: 12px; border-radius: 10px; }
  .related-grid { grid-template-columns: 1fr; }
  .article-body-wrap { padding: 24px 16px 52px; }
  .article-author-bar { padding-bottom: 18px; margin-bottom: 20px; gap: 10px; }
  .article-author-info { gap: 10px; }
  .article-author-avatar { width: 38px; height: 38px; font-size: 0.78rem; }
  .article-author-name { font-size: 0.85rem; }
  .article-author-role { font-size: 0.72rem; }
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
  .related-section { margin-top: 28px; padding-top: 22px; }
  .related-section h3 { font-size: 1rem; margin-bottom: 14px; gap: 8px; }
  .related-section h3::before { height: 16px; }
  .related-card-body { padding: 12px; }
  .related-card-body h4 { font-size: 0.8rem; }
  .related-card-body .rc-meta { font-size: 0.66rem; margin-top: 6px; }
  .toast { left: 16px; right: 16px; bottom: 16px; padding: 12px 16px; font-size: 0.8rem; }
}
/* Tighter hero type on small phones, matching News.vue. */
@media (max-width: 480px) {
  .article-hero-overlay { background: linear-gradient(transparent 55%, rgba(15, 23, 42, 0.78) 100%); }
  .article-hero-content { padding: 14px 14px 16px; }
  .article-hero-content .category-tag { padding: 3px 10px; font-size: 0.6rem; letter-spacing: 0.6px; margin-bottom: 7px; }
  .article-hero-content h1 { font-size: 1.1rem; line-height: 1.22; margin-bottom: 0; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5); }
}
</style>
