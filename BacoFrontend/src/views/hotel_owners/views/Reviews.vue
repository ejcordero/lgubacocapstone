<template>
  <div class="rv-root">
    <div class="rv-head">
      <h1>Guest <span>Reviews</span></h1>
      <p v-if="data?.hotel">What guests are saying about <b>{{ data.hotel.name }}</b></p>
      <p v-else>Feedback from guests who completed their stay</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="rv-state"><div class="rv-spinner"></div><p>Loading reviews…</p></div>

    <!-- Error -->
    <div v-else-if="errorMsg" class="rv-state">
      <div class="rv-emoji">⚠️</div>
      <p>{{ errorMsg }}</p>
      <button class="rv-btn solid" @click="loadReviews">Retry</button>
    </div>

    <!-- No accommodation yet -->
    <div v-else-if="!data?.hotel" class="rv-state">
      <div class="rv-emoji">🏨</div>
      <p>Create your accommodation first — reviews will appear here once guests start staying.</p>
      <button class="rv-btn solid" @click="$router.push('/owner/hotels')">Set Up Accommodation</button>
    </div>

    <!-- No reviews yet -->
    <div v-else-if="data.stats.count === 0" class="rv-state">
      <div class="rv-emoji">⭐</div>
      <p>No reviews yet. Guests can review your resort after their stay is marked as <b>Completed</b>.</p>
    </div>

    <!-- Stats + review grid -->
    <template v-else>
      <div class="rv-layout">
        <!-- Summary sidebar -->
        <aside class="rv-summary">
          <div class="avg-box">
            <div class="avg-num">{{ data.stats.avg.toFixed(1) }}</div>
            <div class="avg-stars">
              <span v-for="n in 5" :key="n" class="star big" :class="{ on: n <= Math.round(data.stats.avg) }">
                <svg width="18" height="18" viewBox="0 0 24 24" :fill="n <= Math.round(data.stats.avg) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              </span>
            </div>
            <div class="avg-count">{{ data.stats.count }} review{{ data.stats.count !== 1 ? 's' : '' }}</div>
          </div>
          <div class="dist">
            <button
              v-for="s in starRows" :key="s"
              class="dist-row" :class="{ active: filterStar === s }"
              @click="filterStar = filterStar === s ? null : s"
            >
              <span class="dist-label">{{ s }}★</span>
              <div class="dist-track"><div class="dist-fill" :style="{ width: pct(s) + '%' }"></div></div>
              <span class="dist-count">{{ data.stats.distribution[s] }}</span>
            </button>
          </div>
          <button v-if="filterStar" class="rv-btn ghost w-full" @click="filterStar = null">Clear filter</button>
        </aside>

        <!-- Reviews -->
        <div class="rv-main">
          <div class="rv-toolbar">
            <span class="rv-result">{{ filtered.length }} shown</span>
            <select v-model="sortBy" class="rv-sort">
              <option value="newest">Sort: Newest first</option>
              <option value="oldest">Sort: Oldest first</option>
              <option value="highest">Sort: Highest rated</option>
              <option value="lowest">Sort: Lowest rated</option>
            </select>
          </div>

          <div v-if="filtered.length === 0" class="rv-empty-inline">
            No {{ filterStar }}★ reviews{{ sortBy !== 'newest' ? ' in this order' : '' }}.
          </div>

          <div v-else class="rv-grid">
            <article v-for="r in filtered" :key="r.id" class="rv-card">
              <div class="rc-top">
                <div class="rc-avatar">{{ initials(r.reviewerName) }}</div>
                <div class="rc-who">
                  <h4>{{ r.reviewerName }}</h4>
                  <small>{{ fmtDate(r.createdAt) }}<span v-if="r.edited"> · edited</span></small>
                </div>
                <div class="rc-stars">
                  <span v-for="n in 5" :key="n" class="star" :class="{ on: n <= r.rating }">
                    <svg width="13" height="13" viewBox="0 0 24 24" :fill="n <= r.rating ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  </span>
                </div>
              </div>

              <h5 v-if="r.title" class="rc-title">{{ r.title }}</h5>
              <p class="rc-content">{{ r.content }}</p>

              <div class="rc-foot">
                <span class="rc-stay">
                  {{ r.bookingType === 'entrance' ? '🎟️' : '🛏️' }} {{ r.stayDescription }}
                  <template v-if="r.bookingType === 'accommodation' && r.nights"> · {{ r.nights }}n</template>
                  · {{ fmtShort(r.checkIn) }}
                </span>
                <span class="rc-ref">{{ r.bookingRef }}</span>
              </div>
            </article>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const API_BASE = 'http://localhost:3000/api'
const router = useRouter()

const loading = ref(true)
const errorMsg = ref('')
const data = ref(null)

const filterStar = ref(null)
const sortBy = ref('newest')
const starRows = [5, 4, 3, 2, 1]

// Same token keys the /owner router guard accepts
const getToken = () =>
  localStorage.getItem('baco_owner_token') || localStorage.getItem('ownerToken') || ''

// ── Formatters (timezone-safe, same convention as the rest of the app) ──
function fmtDate(d) { return d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' }
function fmtShort(d) { return d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—' }
function initials(name) {
  return (name || '?').split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

// ── Derived ──
const pct = (s) => {
  const total = data.value?.stats?.count || 0
  return total ? Math.round((data.value.stats.distribution[s] / total) * 100) : 0
}

const filtered = computed(() => {
  let out = [...(data.value?.reviews || [])]
  if (filterStar.value) out = out.filter(r => r.rating === filterStar.value)
  const byDateDesc = (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  if (sortBy.value === 'oldest') out.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  else if (sortBy.value === 'highest') out.sort((a, b) => (b.rating - a.rating) || byDateDesc(a, b))
  else if (sortBy.value === 'lowest') out.sort((a, b) => (a.rating - b.rating) || byDateDesc(a, b))
  else out.sort(byDateDesc)
  return out
})

// ── Data ──
const loadReviews = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await fetch(`${API_BASE}/owner/reviews`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    })
    if (res.status === 401 || res.status === 403) { router.push('/owner/login'); return }
    if (!res.ok) throw new Error('Failed to load reviews.')
    data.value = await res.json()
  } catch (e) {
    errorMsg.value = e.message || 'Something went wrong.'
  } finally {
    loading.value = false
  }
}

onMounted(loadReviews)
</script>

<style scoped>
/* Theme tokens — re-point these to your owner portal variables if you have them */
.rv-root {
  --rv-accent: var(--ac);
  --rv-accent-soft: var(--acs);
  --rv-ink: var(--fg);
  --rv-text: var(--mt);
  --rv-muted: var(--mt);
  --rv-border: var(--bdr);
  --rv-bg: var(--card);
  --rv-bg-subtle: var(--card2);
  --rv-star: #F2B807;
  color: var(--rv-ink);
  font-family: var(--font-body), system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

/* ── Page title (exact design from EntranceFeeManager) ── */
.rv-head h1 { font-family: 'Unbounded', sans-serif; font-size: clamp(26px, 4vw, 40px); font-weight: 800; color: var(--fg); letter-spacing: -0.04em; margin: 0 0 4px; line-height: 1.15; }
.rv-head h1 span { background: linear-gradient(135deg, var(--ac, #F20707), var(--wn, #1F9D55)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.rv-head p { font-size: .85rem; color: var(--rv-text); margin: 0 0 20px; }

/* Layout */
.rv-layout { display: grid; grid-template-columns: 260px 1fr; gap: 20px; align-items: start; }

/* Summary */
.rv-summary {
  background: var(--rv-bg); border: 1px solid var(--rv-border); border-radius: 16px;
  padding: 20px; position: sticky; top: 16px;
  display: flex; flex-direction: column; gap: 16px;
}
.avg-box { text-align: center; border-bottom: 1px solid var(--rv-border); padding-bottom: 16px; }
.avg-num { font-size: 2.6rem; font-weight: 800; line-height: 1; color: var(--rv-ink); }
.avg-stars { display: flex; justify-content: center; gap: 2px; margin-top: 8px; }
.avg-count { font-size: .76rem; color: var(--rv-text); margin-top: 6px; }

.dist { display: flex; flex-direction: column; gap: 6px; }
.dist-row {
  display: flex; align-items: center; gap: 8px;
  background: none; border: 1px solid transparent; border-radius: 8px;
  padding: 4px 8px; cursor: pointer; font-family: inherit; width: 100%;
  transition: all .15s;
}
.dist-row:hover { background: var(--rv-bg-subtle); }
.dist-row.active { border-color: var(--rv-accent); background: var(--rv-accent-soft); }
.dist-label { font-size: .74rem; font-weight: 700; color: var(--rv-star); width: 26px; text-align: right; }
.dist-track { flex: 1; height: 8px; background: var(--rv-bg-subtle); border-radius: 999px; overflow: hidden; }
.dist-fill { height: 100%; background: var(--rv-star); border-radius: 999px; transition: width .4s ease; }
.dist-count { font-size: .72rem; color: var(--rv-muted); width: 24px; text-align: right; }

/* Toolbar */
.rv-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
.rv-result { font-size: .82rem; font-weight: 600; color: var(--rv-text); }
.rv-sort {
  padding: 8px 12px; border: 1px solid var(--rv-border); border-radius: 10px;
  font-size: .8rem; font-family: inherit; color: var(--rv-text); background: var(--rv-bg); cursor: pointer;
}

/* Review card grid — square, rounded */
.rv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px; align-items: start; }

.rv-card {
  display: flex; flex-direction: column; gap: 8px;
  background: var(--rv-bg); border: 1px solid var(--rv-border); border-radius: 14px;
  padding: 16px;
  transition: transform .2s ease, box-shadow .2s ease;
}
.rv-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.08); }

.rc-top { display: flex; align-items: center; gap: 10px; }
.rc-avatar {
  width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, var(--rv-accent), #C70505);
  color: #fff; font-size: .74rem; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
}
.rc-who { flex: 1; min-width: 0; }
.rc-who h4 { font-size: .86rem; font-weight: 700; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rc-who small { font-size: .66rem; color: var(--rv-muted); }
.rc-stars { display: flex; gap: 1px; }

.star { color: var(--rv-border); display: inline-flex; }
.star.on { color: var(--rv-star); }

.rc-title { font-size: .84rem; font-weight: 700; margin: 2px 0 0; }
.rc-content {
  font-size: .8rem; color: var(--rv-text); line-height: 1.6; margin: 0;
  white-space: pre-wrap; word-break: break-word;
  display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden;
}

.rc-foot {
  margin-top: auto; padding-top: 10px; border-top: 1px solid var(--rv-border);
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
}
.rc-stay { font-size: .68rem; color: var(--rv-text); font-weight: 600; }
.rc-ref { font-size: .62rem; color: var(--rv-muted); }

/* Empty inline */
.rv-empty-inline {
  font-size: .82rem; color: var(--rv-muted); padding: 16px 18px;
  border: 1px dashed var(--rv-border); border-radius: 12px; background: var(--rv-bg-subtle);
}

/* States */
.rv-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 70px 20px; color: var(--rv-text); text-align: center; }
.rv-emoji { font-size: 2.6rem; }
.rv-spinner { width: 34px; height: 34px; border: 3px solid var(--rv-border); border-top-color: var(--rv-accent); border-radius: 50%; animation: rvspin .8s linear infinite; }
@keyframes rvspin { to { transform: rotate(360deg); } }

/* Buttons */
.rv-btn { border-radius: 10px; padding: 9px 18px; font-size: .84rem; font-weight: 700; cursor: pointer; font-family: inherit; border: none; transition: all .2s; }
.rv-btn.solid { background: var(--rv-accent); color: #fff; }
.rv-btn.solid:hover { filter: brightness(1.08); }
.rv-btn.ghost { background: var(--rv-bg); border: 1px solid var(--rv-border); color: var(--rv-text); }
.rv-btn.ghost:hover { border-color: var(--rv-accent); color: var(--rv-accent); }
.w-full { width: 100%; }

@media (max-width: 900px) {
  .rv-layout { grid-template-columns: 1fr; }
  .rv-summary { position: static; }
}
</style>