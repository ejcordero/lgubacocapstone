<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { API } from '@/api'

const emit = defineEmits(['change-mode'])
const loading = ref(true)
const error = ref(null)
const lastUpdated = ref(null)
const spinning = ref(false)
const actFilter = ref('all')
const clock = ref('')

const stats = ref([
  { title: 'Registered Citizens', value: 0, icon: 'fa-users', color: 'accent', mode: 'users' },
  { title: 'Tourist Destinations', value: 0, icon: 'fa-map-location-dot', color: 'teal', mode: 'tourism' },
  { title: 'News Articles', value: 0, icon: 'fa-newspaper', color: 'amber', mode: 'news' },
  { title: 'TALA Projects', value: 0, icon: 'fa-coins', color: 'violet', mode: 'tala' }
])
const secondaryStats = ref([
  { title: 'Hotel Bookings', value: 0, icon: 'fa-bed', color: 'teal', mode: 'bookings' },
  { title: 'Halcon Permits', value: 0, icon: 'fa-mountain', color: 'accent', mode: 'halcon' },
  { title: 'Barangays', value: 0, icon: 'fa-map', color: 'amber', mode: 'barangays' },
  { title: 'Health Services', value: 0, icon: 'fa-heart-pulse', color: 'danger', mode: 'mho' }
])
const recentActivity = ref([])
const quickActions = ref([
  { title: 'Post News', sub: 'Publish an announcement to the portal', icon: 'fa-bullhorn', color: 'accent', mode: 'news' },
  { title: 'Manage Hotels', sub: 'Reviews, rates and availability', icon: 'fa-hotel', color: 'teal', mode: 'hotels' },
  { title: 'View Permits', sub: 'Halcon permits awaiting action', icon: 'fa-file-signature', color: 'amber', mode: 'halcon' },
  { title: 'Manage Users', sub: 'Accounts, roles and access', icon: 'fa-user-gear', color: 'violet', mode: 'users' }
])

const getToken = () => localStorage.getItem('baco_admin_token') || localStorage.getItem('admin_token') || localStorage.getItem('token')

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return 'Unknown'
  const diff = Date.now() - new Date(dateStr)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(diff / 86400000)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const syncLabel = computed(() => (lastUpdated.value ? formatRelativeTime(lastUpdated.value.toISOString()) : 'never'))

// The four additional metrics are shown as proportional bars. Scaling against
// the largest of the four keeps the bars meaningful without inventing a target:
// there is no real denominator for "hotel bookings" in the dashboard payload.
const secondaryMax = computed(() => Math.max(1, ...secondaryStats.value.map(s => s.value)))
const secondaryWithPct = computed(() =>
  secondaryStats.value.map(s => ({ ...s, pct: Math.round((s.value / secondaryMax.value) * 100) }))
)

// Status is carried as free text at the tail of the action string, so the pill
// is read off it rather than stored separately.
const statusPill = (action) => {
  const a = (action || '').toLowerCase()
  if (a.includes('publish')) return { cls: 'published', label: 'Live' }
  if (a.includes('cancel')) return { cls: 'cancelled', label: 'Cancelled' }
  if (a.includes('reject') || a.includes('declin')) return { cls: 'rejected', label: 'Rejected' }
  if (a.includes('pending') || a.includes('await')) return { cls: 'pending', label: 'Pending' }
  if (a.includes('approve') || a.includes('confirm')) return { cls: 'published', label: 'Approved' }
  return { cls: 'progress', label: 'In progress' }
}

const actType = (item) => {
  if (item.mode === 'bookings') return 'bookings'
  if (item.mode === 'halcon') return 'permits'
  if (item.mode === 'news') return 'news'
  return 'other'
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'permits', label: 'Permits' },
  { key: 'news', label: 'News' }
]

const filteredActivity = computed(() =>
  actFilter.value === 'all' ? recentActivity.value : recentActivity.value.filter(i => actType(i) === actFilter.value))

const visibleCount = computed(() => filteredActivity.value.length)

let clockTimer = null
const tickClock = () => {
  clock.value = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) + ' PHT'
}

const fetchDashboardData = async () => {
  loading.value = true
  error.value = null
  spinning.value = true
  try {
    const token = getToken()
    const headers = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const countsRes = await fetch(`${API}/dashboard/stats`, { headers })
    if (!countsRes.ok) throw new Error('Failed to load stats')
    const counts = await countsRes.json()
    stats.value[0].value = counts.citizens || 0; stats.value[1].value = counts.destinations || 0
    stats.value[2].value = counts.news || 0; stats.value[3].value = counts.projects || 0
    secondaryStats.value[0].value = counts.bookings || 0; secondaryStats.value[1].value = counts.permits || 0
    secondaryStats.value[2].value = counts.barangays || 0; secondaryStats.value[3].value = counts.healthServices || 0
    const [newsRes, bookingsRes, permitsRes] = await Promise.allSettled([
      fetch(`${API}/news`).then(r => r.json()),
      fetch(`${API}/hotels/admin/bookings`, { headers }).then(r => r.json()),
      fetch(`${API}/halcon/admin/permits`, { headers }).then(r => r.json())
    ])
    const getVal = (result, fallback = []) => result.status === 'fulfilled' ? result.value : fallback
    const activities = []
    getVal(newsRes).slice(0, 3).forEach(n => activities.push({ id: 'news-' + n.id, user: 'Admin', action: `Published: "${(n.title || '').substring(0, 38)}"`, time: n.created_at, icon: 'fa-newspaper', mode: 'news' }))
    getVal(bookingsRes).slice(0, 2).forEach(b => activities.push({ id: 'booking-' + b.id, user: b.registered_name || b.guest_name || 'Guest', action: `Booked ${b.hotel_name || 'hotel'} — ${b.status}`, time: b.created_at, icon: 'fa-bed', mode: 'bookings' }))
    getVal(permitsRes).slice(0, 2).forEach(p => activities.push({ id: 'permit-' + p.id, user: p.applicant_name || 'Applicant', action: `Permit ${p.permit_id} — ${p.status}`, time: p.created_at, icon: 'fa-mountain', mode: 'halcon' }))
    recentActivity.value = activities.sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8)
    lastUpdated.value = new Date()
  } catch (err) {
    console.error('Dashboard error:', err)
    error.value = 'Failed to load dashboard data.'
  } finally {
    loading.value = false
    setTimeout(() => { spinning.value = false }, 800)
  }
}
const handleStatClick = (mode) => emit('change-mode', mode)
const handleActivityClick = (activity) => { if (activity.mode) emit('change-mode', activity.mode) }
const handleQuickAction = (action) => emit('change-mode', action.mode)
const setFilter = (f) => { actFilter.value = f }

onMounted(() => {
  tickClock()
  clockTimer = setInterval(tickClock, 15000)
  fetchDashboardData()
})
onUnmounted(() => { if (clockTimer) clearInterval(clockTimer) })
</script>

<template>
  <div class="dashboard-overview">
    <div v-if="error" class="error-state">
      <i class="fas fa-exclamation-triangle"></i>
      <p>{{ error }}</p>
      <button @click="fetchDashboardData" class="retry-btn"><i class="fas fa-rotate-right"></i> Retry</button>
    </div>

    <template v-else>
      <!-- Hero: the municipal hall photo under a glass scrim -->
      <header class="hero">
        <button @click="fetchDashboardData" class="refresh" :class="{ spin: spinning }" title="Refresh data" aria-label="Refresh">
          <i class="fas fa-rotate-right"></i>
        </button>
        <div class="wm" aria-hidden="true"><i class="fas fa-city"></i></div>
        <div class="eyebrow">Dashboard overview</div>
        <h1>Municipality of <em>Baco</em></h1>
        <p>Real-time overview of municipal operations and services.</p>
        <div class="hero-meta">
          <span class="dot" aria-hidden="true"></span> Systems operational
          <span aria-hidden="true">·</span> Last synced <b>{{ syncLabel }}</b>
          <span aria-hidden="true">·</span> <span>{{ clock }}</span>
        </div>
      </header>

      <!-- ============ two-column body ============ -->
      <div class="cols">
        <!-- LEFT -->
        <div class="col">
          <section class="stats">
            <button v-for="(stat, index) in stats" :key="'primary-' + index" class="stat mat-glass" :class="'c-' + stat.color" @click="handleStatClick(stat.mode)">
              <div class="stat-top">
                <span class="ico"><i class="fa-solid" :class="stat.icon"></i></span>
                <span class="arr"><i class="fas fa-arrow-right"></i></span>
              </div>
              <div class="num">{{ stat.value.toLocaleString() }}</div>
              <div class="lbl">{{ stat.title }}</div>
            </button>
          </section>

          <section class="panel mat-glass">
            <div class="panel-head">
              <h2><i class="fas fa-bolt"></i> Quick actions</h2>
            </div>
            <div class="qa-grid">
              <button v-for="(action, index) in quickActions" :key="'qa-' + index" class="qa" :class="'c-' + action.color" @click="handleQuickAction(action)">
                <span class="ico"><i class="fa-solid" :class="action.icon"></i></span>
                <span class="qa-text">
                  <b>{{ action.title }}</b>
                  <span>{{ action.sub }}</span>
                </span>
                <span class="go"><i class="fas fa-arrow-up-right-diagonal"></i></span>
              </button>
            </div>
            <div class="panel-foot">
              <span class="dot" aria-hidden="true"></span>
              <span>Updated {{ syncLabel }}</span>
            </div>
          </section>
        </div>

        <!-- RIGHT -->
        <div class="col">
          <div class="section-label"><b>Additional metrics</b></div>

          <section class="panel mat-glass">
            <div class="panel-head">
              <h2><i class="fas fa-gauge-high"></i> At a glance</h2>
            </div>
            <div class="mini-list">
              <button v-for="(stat, index) in secondaryWithPct" :key="'secondary-' + index" class="mini" :class="'c-' + stat.color" @click="handleStatClick(stat.mode)">
                <span class="ico"><i class="fa-solid" :class="stat.icon"></i></span>
                <span class="val">{{ stat.value.toLocaleString() }}</span>
                <span class="lbl">{{ stat.title }}</span>
                <span class="bar"><i :style="{ width: stat.pct + '%' }"></i></span>
                <span class="pct">{{ stat.pct }}%</span>
              </button>
            </div>
          </section>

          <section class="panel mat-glass">
            <div class="panel-head">
              <h2><i class="fas fa-clock-rotate-left"></i> Recent activity</h2>
              <div class="right">
                <span class="act-count">{{ visibleCount }} item{{ visibleCount !== 1 ? 's' : '' }}</span>
                <div class="chips">
                  <button v-for="f in FILTERS" :key="f.key" :class="{ on: actFilter === f.key }" @click="setFilter(f.key)">{{ f.label }}</button>
                </div>
              </div>
            </div>
            <div class="feed">
              <div v-for="item in filteredActivity" :key="item.id" class="act" @click="handleActivityClick(item)">
                <span class="ico" :class="'c-' + (item.mode === 'bookings' ? 'teal' : item.mode === 'halcon' ? 'amber' : 'accent')">
                  <i class="fa-solid" :class="item.icon"></i>
                </span>
                <div class="body">
                  <b>{{ item.user }}</b>
                  <p>{{ item.action }}</p>
                </div>
                <div class="side">
                  <time>{{ formatRelativeTime(item.time) }}</time>
                  <span class="pill" :class="statusPill(item.action).cls">{{ statusPill(item.action).label }}</span>
                </div>
              </div>
              <div v-if="filteredActivity.length === 0" class="empty">
                <i class="fas fa-inbox"></i>
                <p>No {{ actFilter === 'all' ? '' : actFilter + ' ' }}activity yet.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard-overview {
  padding: 26px clamp(14px, 2vw, 30px) 40px;
  width: 100%;
  font-family: var(--font-body);
  color: var(--fg);
}

.error-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; text-align: center; }
.error-state p { color: var(--mt); font-size: 0.9rem; }
.error-state i { font-size: 2.5rem; color: var(--dg); margin-bottom: 16px; }
.retry-btn { margin-top: 16px; padding: 10px 24px; border-radius: 13px; cursor: pointer; font-family: var(--font-body); font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 8px; background: var(--fg); color: var(--bg); border: none; }
.retry-btn:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }

/* Per-card accent. One token drives the rail, the icon wash and the arrow. */
.c-accent { --c: var(--ac); }
.c-teal   { --c: var(--te); }
.c-amber  { --c: var(--wn); }
.c-violet { --c: var(--vi); }
.c-danger { --c: var(--dg); }

/* ---------- hero ----------
   The municipal hall photo sits under a translucent scrim rather than being
   the panel background outright. The photo is left at full strength and carries
   no white wash, so the scrim is DARK and the type is light. A dark scrim
   costs less of the picture than a light one: a white veil at the opacity
   needed for ink text erases the building, whereas this only deepens it. */
.hero {
  position: relative;
  overflow: hidden;
  border-radius: var(--r-xl);
  padding: 30px 34px;
  margin-bottom: 18px;
  isolation: isolate;
  /* Theme-independent on purpose. A photo hero reads the same in both modes,
     and letting it flip with the canvas would put a dark band in a light page
     and a washed one in a dark page. */
  --hero-ink: #FFFFFF;
  --hero-ink-2: rgba(255, 255, 255, 0.82);
  --hero-ink-3: rgba(255, 255, 255, 0.68);
  --hero-edge: rgba(255, 255, 255, 0.16);
}
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -2;
  background-image: url('/images/img1.jpg');
  background-size: cover;
  /* The photo is 2.19:1 and the hero band is nearer 6:1, so cover crops to a
     horizontal slice. 34% lands the MUNICIPAL HALL signplate near the middle
     of that slice rather than cutting it off. */
  background-position: center 34%;
}
.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  /* Weighted to the left where the type sits, thinning to the right so the
     flagpole and sky stay photographic. 0.74 over the brightest part of this
     photo still lands near #4A4A4A, which is 7.6:1 against white. */
  background: linear-gradient(105deg,
    rgba(8, 10, 14, 0.74) 0%,
    rgba(8, 10, 14, 0.66) 40%,
    rgba(8, 10, 14, 0.34) 74%,
    rgba(8, 10, 14, 0.16) 100%);
  box-shadow: inset 0 0 0 1px var(--hero-edge);
  border-radius: inherit;
}
.hero > * { position: relative; z-index: 1; }
.hero .wm {
  position: absolute;
  right: 96px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.09);
  pointer-events: none;
}
.hero .wm i { font-size: 6.5rem; line-height: 1; }
.eyebrow { display: flex; align-items: center; gap: 10px; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--hero-ink-2); }
.eyebrow::before { content: ''; width: 22px; height: 2px; background: #7FB0FF; border-radius: 2px; }
.hero h1 { font-family: var(--font-display); font-size: clamp(1.75rem, 3.2vw, 2.6rem); font-weight: 600; letter-spacing: -0.02em; margin: 8px 0 6px; color: var(--hero-ink); line-height: 1.1; }
.hero h1 em { font-style: normal; color: #A9C8FF; }
.hero p { color: var(--hero-ink-2); font-size: 0.9rem; margin: 0; }
/* Dark glass, not the page's light glass -- a pale button on a dark scrim is
   the one element that would still read as a white overlay. */
.refresh { position: absolute; top: 22px; right: 22px; width: 42px; height: 42px; border-radius: 13px; display: grid; place-items: center; background: rgba(255, 255, 255, 0.14); border: 1px solid rgba(255, 255, 255, 0.22); color: var(--hero-ink); cursor: pointer; transition: transform 0.2s, background 0.2s; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
.refresh:hover { transform: translateY(-2px); background: rgba(255, 255, 255, 0.24); }
.refresh.spin i { animation: spin 0.8s var(--ease); }
@keyframes spin { to { transform: rotate(360deg); } }
.hero-meta { margin-top: 16px; display: flex; align-items: center; gap: 9px; font-size: 0.78rem; color: var(--hero-ink-3); flex-wrap: wrap; }
/* The hero dot gets a light halo rather than the page's sage wash, which would
   be invisible against the dark scrim. The panel foot keeps the token. */
.hero-meta .dot { width: 7px; height: 7px; border-radius: 50%; background: #6EE7A8; box-shadow: 0 0 0 3px rgba(110, 231, 168, 0.22); animation: pulse 2s infinite; }
.panel-foot .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 0 3px var(--okg); animation: pulse 2s infinite; }
@keyframes pulse { 50% { box-shadow: 0 0 0 6px transparent; } }
.hero-meta b { color: var(--hero-ink-2); font-weight: 600; }

/* ---------- two-column body ---------- */
.cols { display: grid; grid-template-columns: 1.55fr 1fr; gap: 18px; align-items: start; }
.col { display: flex; flex-direction: column; gap: 18px; min-width: 0; }

.section-label { display: flex; align-items: center; gap: 12px; margin: 2px 4px -6px; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--mt2); }
.section-label::after { content: ''; flex: 1; height: 1px; background: var(--bdr); }
.section-label b { color: var(--mt); }

/* ---------- primary stats: 2x2 ---------- */
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.stat {
  position: relative;
  overflow: hidden;
  border-radius: var(--r-lg);
  padding: 20px;
  text-align: left;
  cursor: pointer;
  border: 1px solid var(--m-glass-edge);
  transition: transform 0.18s var(--ease), box-shadow 0.2s;
  font-family: var(--font-body);
}
.stat::before { content: ''; position: absolute; left: 0; top: 14px; bottom: 14px; width: 3.5px; border-radius: 4px; background: var(--c); }
.stat:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
.stat-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
.stat .ico, .qa .ico, .mini .ico, .act .ico { display: grid; place-items: center; background: color-mix(in srgb, var(--c) 13%, var(--card-solid)); color: var(--c); flex: 0 0 auto; }
.stat .ico { width: 44px; height: 44px; border-radius: 13px; font-size: 1.05rem; }
.stat .arr { color: var(--mt2); transition: all 0.2s; }
.stat:hover .arr { color: var(--c); transform: translateX(3px); }
.stat .num { font-family: var(--font-display); font-size: 2.25rem; font-weight: 600; letter-spacing: -0.02em; line-height: 1; color: var(--fg); }
.stat .lbl { font-size: 0.82rem; color: var(--mt); margin-top: 6px; font-weight: 500; }

/* ---------- panels ---------- */
.panel { border-radius: var(--r-lg); overflow: hidden; border: 1px solid var(--m-glass-edge); }
.panel-head { display: flex; align-items: center; gap: 11px; padding: 15px 20px; background: var(--card2); border-bottom: 1px solid var(--bdr); flex-wrap: wrap; }
.panel-head h2 { margin: 0; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; display: flex; align-items: center; gap: 9px; color: var(--fg); }
.panel-head h2 i { color: var(--ac); font-size: 0.8rem; }
.panel-head .right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.panel-foot { padding: 11px 20px; border-top: 1px solid var(--bdr); font-size: 0.75rem; color: var(--mt2); display: flex; align-items: center; gap: 8px; }
.panel-foot .dot { width: 6px; height: 6px; }

/* ---------- quick actions ---------- */
.qa-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 18px 20px; }
.qa { display: flex; align-items: center; gap: 14px; padding: 17px 18px; border-radius: 16px; background: var(--card2); border: 1px solid var(--bdr); cursor: pointer; text-align: left; font-family: var(--font-body); transition: all 0.18s; }
.qa:hover { background: var(--card-solid); transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: color-mix(in srgb, var(--c) 30%, var(--bdr)); }
.qa .ico { width: 44px; height: 44px; border-radius: 13px; font-size: 1rem; transition: transform 0.2s; }
.qa:hover .ico { transform: scale(1.06); }
.qa-text { min-width: 0; }
.qa-text b { display: block; font-size: 0.9rem; font-weight: 600; letter-spacing: -0.01em; color: var(--fg); }
.qa-text span { font-size: 0.75rem; color: var(--mt); margin-top: 2px; display: block; }
.qa .go { margin-left: auto; color: var(--mt2); flex: 0 0 auto; font-size: 0.8rem; }
.qa:hover .go { color: var(--c); }

/* ---------- additional metrics: stacked rows ---------- */
.mini-list { display: flex; flex-direction: column; padding: 8px 10px; }
.mini { display: flex; align-items: center; gap: 13px; padding: 13px 12px; border: none; border-bottom: 1px solid var(--bdr); border-radius: 12px; background: none; cursor: pointer; text-align: left; font-family: var(--font-body); transition: background 0.15s; width: 100%; }
.mini:last-child { border-bottom: none; }
.mini:hover { background: var(--card2); }
.mini .ico { width: 38px; height: 38px; border-radius: 11px; font-size: 0.9rem; }
.mini .val { font-family: var(--font-display); font-size: 1.4rem; font-weight: 600; line-height: 1; flex: 0 0 44px; text-align: right; color: var(--fg); }
.mini .lbl { font-size: 0.82rem; color: var(--fg2); font-weight: 500; }
.mini .bar { margin-left: auto; width: 72px; height: 5px; border-radius: 5px; background: var(--card3); overflow: hidden; flex: 0 0 auto; }
.mini .bar i { display: block; height: 100%; border-radius: 5px; background: var(--c); width: 0; transition: width 0.9s cubic-bezier(0.2, 0.8, 0.3, 1); }
.mini .pct { font-size: 0.7rem; font-weight: 600; color: var(--mt2); flex: 0 0 34px; text-align: right; }

/* ---------- activity feed ---------- */
.chips { display: inline-flex; background: var(--card3); border-radius: 10px; padding: 3px; gap: 2px; }
.chips button { font-size: 0.7rem; font-weight: 600; color: var(--mt); padding: 5px 10px; border-radius: 8px; cursor: pointer; border: none; background: none; font-family: var(--font-body); transition: all 0.2s; }
.chips button.on { background: var(--card-solid); color: var(--fg); box-shadow: var(--shadow-sm); }
.act-count { font-size: 0.72rem; color: var(--mt2); }
.feed { max-height: 520px; overflow-y: auto; }
.feed::-webkit-scrollbar { width: 8px; }
.feed::-webkit-scrollbar-thumb { background: var(--bdr3); border-radius: 8px; border: 2px solid transparent; background-clip: content-box; }
.act { display: flex; align-items: flex-start; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--bdr); cursor: pointer; transition: background 0.15s; animation: pop 0.3s ease; }
.act:last-child { border-bottom: none; }
.act:hover { background: var(--card2); }
@keyframes pop { from { opacity: 0; transform: translateY(-6px); } }
.act .ico { width: 34px; height: 34px; border-radius: 10px; font-size: 0.8rem; margin-top: 2px; }
.act .body { flex: 1; min-width: 0; }
.act .body b { display: block; font-size: 0.85rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--fg); }
.act .body p { font-size: 0.78rem; color: var(--mt); margin: 2px 0 0; line-height: 1.45; }
.act .side { flex: 0 0 auto; text-align: right; }
.act .side time { display: block; font-size: 0.7rem; color: var(--mt2); white-space: nowrap; }
.pill { display: inline-block; font-size: 0.65rem; font-weight: 600; padding: 3px 9px; border-radius: var(--r-pill); margin-top: 6px; }
.pill.pending { background: var(--wng); color: var(--wn); }
.pill.published { background: var(--okg); color: var(--ok); }
.pill.rejected { background: var(--dgg); color: var(--dg); }
.pill.cancelled { background: var(--card3); color: var(--mt); }
.pill.progress { background: var(--acs); color: var(--ac-ink); }
.empty { padding: 40px 20px; text-align: center; color: var(--mt2); font-size: 0.8rem; }
.empty i { font-size: 1.6rem; margin-bottom: 8px; opacity: 0.5; display: block; }

/* ---------- responsive ----------
   The split holds to 1020px of *content* width, which is why the sidebar being
   open at 1280 still gets two columns: the workspace, not the window, is what
   the media query measures. */
@media (max-width: 1020px) {
  .cols { grid-template-columns: 1fr; }
  .feed { max-height: 380px; }
}
@media (max-width: 620px) {
  .stats, .qa-grid { grid-template-columns: 1fr; }
  .hero { padding: 24px 20px; }
  .hero .wm { display: none; }
  .hero .num, .stat .num { font-size: 1.9rem; }
}
</style>
