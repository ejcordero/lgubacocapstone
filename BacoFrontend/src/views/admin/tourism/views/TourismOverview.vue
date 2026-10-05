<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import TourismPanel from '../components/ui/TourismPanel.vue'
import TourismStatCard from '../components/ui/TourismStatCard.vue'
import {
  fetchDestinations, fetchAnalytics, fetchArrivals
} from '../composables/useTourismApi.js'

const router = useRouter()

const loading = ref(true)
const error = ref('')

const destinations = ref([])
const analytics = ref({ quarters: [], total: 0 })
const arrivals = ref({ period: null, summary: null, attractions: [], backgrounds: {} })

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    /* Three independent reads, all in parallel. None of them depends on
       another, so serialising them would only make the console slower. */
    const [dests, stats, arr] = await Promise.all([
      fetchDestinations(),
      fetchAnalytics(),
      fetchArrivals({})
    ])
    destinations.value = dests || []
    analytics.value = stats || { quarters: [], total: 0 }
    arrivals.value = arr || { period: null, summary: null, attractions: [], backgrounds: {} }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
onMounted(load)

/* ── Read-outs, all derived from real published data ── */
const stats = computed(() => {
  const list = destinations.value
  const withArrivals = list.filter((d) => Number(d.total_arrivals) > 0).length
  const published = list.filter((d) => (d.status || '').toLowerCase() === 'published').length
  return {
    destinations: list.length,
    published,
    draft: list.length - published,
    withArrivals,
    activities: list.reduce((n, d) => n + (d.activities || []).length, 0)
  }
})

const quarters = computed(() => analytics.value.quarters || [])
const peakQuarter = computed(() => {
  if (quarters.value.length === 0) return null
  return quarters.value.reduce((best, q) => (q.visitors > best.visitors ? q : best))
})

/* Bar heights are relative to the busiest quarter, so the chart shape is
   readable regardless of absolute volume. `min-height` keeps a zero quarter
   visible as a baseline rather than vanishing. */
const bars = computed(() => {
  const max = Math.max(1, ...quarters.value.map((q) => q.visitors))
  return quarters.value.map((q) => ({
    ...q,
    pct: Math.round((q.visitors / max) * 100)
  }))
})

const arrivalsLabel = computed(() => {
  const p = arrivals.value.period
  if (!p) return ''
  const now = new Date()
  const curQ = Math.floor(now.getMonth() / 3) + 1
  return p.year === now.getFullYear() && p.quarter === curQ
    ? `Current quarter (Q${p.quarter} ${p.year})`
    : `Q${p.quarter} ${p.year}`
})

const topAttractions = computed(() =>
  (arrivals.value.attractions || []).slice().sort((a, b) => b.visitors - a.visitors).slice(0, 5)
)
const attractionMax = computed(() =>
  Math.max(1, ...topAttractions.value.map((a) => a.visitors))
)

const gaps = computed(() => {
  const out = []
  if (stats.value.destinations === 0) {
    out.push({
      tone: 'danger', icon: 'fa-circle-exclamation',
      title: 'No destinations listed',
      note: 'The public Tourism page has nothing to show in its grid.',
      action: 'Add one', to: '/tourism-admin/destinations'
    })
  }
  if (stats.value.draft > 0) {
    out.push({
      tone: 'warn', icon: 'fa-pen-ruler',
      title: `${stats.value.draft} destination${stats.value.draft === 1 ? '' : 's'} not published`,
      note: 'Drafts are hidden from the public page until they go live.',
      action: 'Review', to: '/tourism-admin/destinations'
    })
  }
  if (!arrivals.value.summary) {
    out.push({
      tone: 'warn', icon: 'fa-chart-simple',
      title: 'No arrivals data',
      note: 'The public arrivals section stays hidden until a quarter is published.',
      action: 'Publish', to: '/tourism-admin/arrivals'
    })
  }
  return out
})
</script>

<template>
  <div class="tourism-admin__page">
    <header>
      <h1 class="tourism-admin__title">Tourism Dashboard</h1>
      <p class="tourism-admin__subtitle">What the Tourism Office page is publishing right now.</p>
    </header>

    <div v-if="error" class="tr-toast tr-toast--danger">
      <i class="fa-solid fa-circle-exclamation"></i>{{ error }}
      <button type="button" @click="load">Retry</button>
    </div>

    <div class="tr-stats">
      <TourismStatCard
        label="Destinations" :value="stats.destinations" icon="fa-umbrella-beach" tone="accent"
        :hint="`${stats.published} published · ${stats.draft} draft`"
      />
      <TourismStatCard
        label="Activities" :value="stats.activities" icon="fa-person-hiking" tone="info"
        hint="Photos across all destinations"
      />
      <TourismStatCard
        label="8-Quarter Visitors" :value="Number(analytics.total || 0).toLocaleString()"
        icon="fa-users" tone="ok"
        :hint="peakQuarter ? `Peak ${peakQuarter.label}` : 'Bookings and permits'"
      />
      <TourismStatCard
        label="Arrivals" :value="arrivals.summary ? Number(arrivals.summary.totalArrivals).toLocaleString() : 'None'"
        icon="fa-plane-arrival" :tone="arrivals.summary ? 'ok' : 'warn'"
        :hint="arrivalsLabel || 'Not published'"
      />
    </div>

    <div class="tr-split">
      <TourismPanel
        title="Visitor trend"
        subtitle="Confirmed hotel bookings plus Mt. Halcon permits, by quarter"
        icon="fa-chart-column"
      >
        <p v-if="loading" class="tr-muted">Loading…</p>
        <p v-else-if="bars.length === 0" class="tr-muted">No visitor data yet.</p>
        <div v-else class="tr-bars">
          <div v-for="q in bars" :key="q.key" class="tr-bars__col">
            <span class="tr-bars__val">{{ q.visitors.toLocaleString() }}</span>
            <div class="tr-bars__track">
              <div class="tr-bars__fill" :style="{ height: Math.max(q.pct, 2) + '%' }"></div>
            </div>
            <span class="tr-bars__lbl">{{ q.label }}</span>
          </div>
        </div>
      </TourismPanel>

      <TourismPanel
        title="Top attractions"
        :subtitle="arrivalsLabel || 'Published quarter'"
        icon="fa-ranking-star"
      >
        <p v-if="loading" class="tr-muted">Loading…</p>
        <p v-else-if="topAttractions.length === 0" class="tr-muted">
          No attractions recorded for this quarter.
        </p>
        <ol v-else class="tr-ranks">
          <li v-for="(a, i) in topAttractions" :key="a.name">
            <span class="tr-ranks__idx">{{ i + 1 }}</span>
            <span class="tr-ranks__name">{{ a.name }}</span>
            <span class="tr-ranks__track">
              <span class="tr-ranks__fill" :style="{ width: Math.round((a.visitors / attractionMax) * 100) + '%' }"></span>
            </span>
            <span class="tr-ranks__val">{{ a.visitors.toLocaleString() }}</span>
          </li>
        </ol>
      </TourismPanel>
    </div>

    <TourismPanel
      v-if="gaps.length"
      title="Editorial checklist"
      subtitle="Gaps on the live page"
      icon="fa-list-check"
    >
      <ul class="tr-gaps">
        <li v-for="(g, i) in gaps" :key="i" :data-tone="g.tone">
          <i class="fa-solid" :class="g.icon"></i>
          <div class="tr-gaps__text">
            <strong>{{ g.title }}</strong>
            <span>{{ g.note }}</span>
          </div>
          <button type="button" @click="router.push(g.to)">{{ g.action }}</button>
        </li>
      </ul>
    </TourismPanel>
  </div>
</template>

<style scoped>
.tr-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(215px, 1fr));
  gap: 16px;
}
.tr-split {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 16px;
  align-items: start;
}

.tr-muted { color: var(--tr-muted); font-size: 0.85rem; margin: 0; }

.tr-toast {
  display: flex; align-items: center; gap: 11px;
  padding: 13px 16px;
  border-radius: var(--tr-radius);
  font-size: 0.85rem;
  font-weight: 500;
}
.tr-toast--danger { background: var(--tr-danger-soft); border: 1px solid var(--tr-danger); }
.tr-toast button {
  margin-left: auto; border: none; background: none; color: inherit;
  font-family: inherit; font-size: 0.82rem; font-weight: 700;
  text-decoration: underline; cursor: pointer;
}

/* ── Bar chart (CSS only, no chart library) ── */
.tr-bars {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 210px;
  padding-top: 18px;
}
.tr-bars__col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  height: 100%;
}
.tr-bars__val {
  font-size: 0.68rem;
  font-weight: 650;
  color: var(--tr-fg-2);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.tr-bars__track {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  background: var(--tr-bg-raised);
  border-radius: var(--tr-radius-sm);
  overflow: hidden;
}
.tr-bars__fill {
  width: 100%;
  background: linear-gradient(180deg, var(--tr-accent) 0%, var(--tr-accent-solid) 100%);
  border-radius: var(--tr-radius-sm) var(--tr-radius-sm) 0 0;
  transition: height 0.4s var(--tr-ease);
}
.tr-bars__lbl {
  font-size: 0.68rem;
  color: var(--tr-muted);
  white-space: nowrap;
}

/* ── Rankings ── */
.tr-ranks { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.tr-ranks li {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) 90px auto;
  align-items: center;
  gap: 12px;
}
.tr-ranks__idx {
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: var(--tr-surface-3);
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--tr-muted);
}
.tr-ranks li:nth-child(1) .tr-ranks__idx { background: var(--tr-accent); color: #fff; }
.tr-ranks__name {
  font-size: 0.85rem;
  font-weight: 550;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tr-ranks__track {
  height: 6px;
  background: var(--tr-bg-raised);
  border-radius: 3px;
  overflow: hidden;
}
.tr-ranks__fill {
  display: block;
  height: 100%;
  background: var(--tr-accent);
  border-radius: 3px;
  transition: width 0.4s var(--tr-ease);
}
.tr-ranks__val {
  font-size: 0.78rem;
  font-weight: 650;
  color: var(--tr-fg-2);
  font-variant-numeric: tabular-nums;
}

/* ── Gaps ── */
.tr-gaps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.tr-gaps li {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 14px 15px;
  border-radius: var(--tr-radius);
  background: var(--tr-surface-2);
  border: 1px solid var(--tr-border);
}
.tr-gaps li > i { font-size: 0.95rem; flex-shrink: 0; }
.tr-gaps li[data-tone='warn']   > i { color: var(--tr-warn); }
.tr-gaps li[data-tone='danger'] > i { color: var(--tr-danger); }
.tr-gaps__text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.tr-gaps__text strong { font-size: 0.85rem; font-weight: 650; }
.tr-gaps__text span   { font-size: 0.78rem; color: var(--tr-muted); }
.tr-gaps li button {
  flex-shrink: 0;
  padding: 7px 13px;
  border-radius: var(--tr-radius-sm);
  border: 1px solid var(--tr-border-2);
  background: transparent;
  color: var(--tr-fg-2);
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s var(--tr-ease);
}
.tr-gaps li button:hover { color: var(--tr-fg); border-color: var(--tr-border-3); background: var(--tr-surface-3); }

@media (max-width: 620px) {
  .tr-ranks li { grid-template-columns: 22px minmax(0, 1fr) auto; }
  .tr-ranks__track { display: none; }
}
</style>