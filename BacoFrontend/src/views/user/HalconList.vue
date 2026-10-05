<template>
  <div class="halcon-list-content">
    <!-- Header -->
    <div class="list-header">
      <div class="header-content">
        <h2 class="section-title">My Permits</h2>
        <p class="section-subtitle">Manage your Mt. Halcon climbing permits.</p>
      </div>
      <button v-if="statusChecked && halconEnabled" @click="navigateToApply" class="clay-btn">
        <Plus size="20" />
        New Application
      </button>
    </div>

    <!-- ═══ AVAILABILITY NOTICE (admin toggle is OFF) ═══ -->
    <div v-if="statusChecked && !halconEnabled" class="hg-notice">
      <div class="hg-icon">
        <Mountain size="30" />
      </div>
      <div class="hg-notice-body">
        <h3>Coming Soon</h3>
        <p>The Mt. Halcon E-Permit System is <strong>not yet available</strong>. New applications are currently closed.</p>
        <p>
          For inquiries and permit reservations, please email
          <a
            href="https://mail.google.com/mail/?view=cm&fs=1&to=lgubacotourism@gmail.com&su=Mt.%20Halcon%20Permit%20Inquiry"
            target="_blank"
            rel="noopener noreferrer"
            class="hg-email"
          >lgubacotourism@gmail.com</a>
        </p>
        <p v-if="myPermits.length > 0" class="hg-track-note">
          <Calendar size="13" />
          You can still view and track your existing permits below.
        </p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="loading-state">
      <Loader2 size="28" class="spin" />
      <p>Loading permits...</p>
    </div>

    <!-- Empty State (system closed — no Apply button) -->
    <div v-else-if="myPermits.length === 0 && statusChecked && !halconEnabled" class="empty-state">
      <Mountain size="48" class="empty-icon" />
      <h3>No permit applications yet</h3>
      <p>New applications will open once the Mt. Halcon E-Permit System becomes available.</p>
    </div>

    <!-- Empty State (system open) -->
    <div v-else-if="myPermits.length === 0" class="empty-state">
      <Mountain size="48" class="empty-icon" />
      <h3>No permit applications yet</h3>
      <p>Start by submitting your first climbing permit application.</p>
      <button @click="navigateToApply" class="clay-btn outline">Apply Now</button>
    </div>

    <!-- Permits List -->
    <div v-else class="permits-list">
      <div
        v-for="permit in myPermits"
        :key="permit.id"
        class="permit-card"
        @click="navigateToTracker(permit)"
      >
        <div class="card-left">
          <div :class="['icon-box', statusColor(permit.status)]">
            <Mountain size="28" />
          </div>
          <div>
            <h3 class="permit-id">{{ permit.permit_id }}</h3>
            <p class="permit-meta">
              <Calendar size="14" />
              Trek Date: <span class="fw-bold">{{ formatDate(permit.trek_date) }}</span>
            </p>
            <p class="permit-submitted">
              Submitted on {{ formatDateTime(permit.created_at) }}
            </p>
            <div class="permit-tags">
              <span class="tag trail-tag">{{ permit.trail }}</span>
              <span class="tag pax-tag">{{ permit.group_size }} Pax</span>
              <span v-if="permit.payment_method === 'gcash'" class="tag gcash-tag">
                GCash {{ permit.payment_status === 'paid' ? '✓' : '' }}
              </span>
            </div>
          </div>
        </div>
        <div class="permit-card-right">
          <div class="text-right">
            <span :class="['badge', badgeClass(permit.status)]">
              {{ permit.status }}
            </span>
            <p class="fee-text">₱{{ Number(permit.total_fee).toLocaleString() }}</p>
          </div>
          <ChevronRight class="chevron desktop-only" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePermitStore } from '../../stores/usePermitStore'
import { API } from '../../api'
import { Mountain, Plus, Calendar, ChevronRight, Loader2 } from 'lucide-vue-next'

const router = useRouter()
const store = usePermitStore()

const myPermits = computed(() => store.myPermits)

// ── Availability gate (admin toggle) ──
const API_BASE = API
const halconEnabled = ref(true)   // fail-open for viewing; the backend POST gate still fails closed
const statusChecked = ref(false)

async function fetchAvailability() {
  try {
    const r = await fetch(`${API_BASE}/halcon/status`)
    if (r.ok) halconEnabled.value = !!(await r.json()).bookingEnabled
  } catch {}
  statusChecked.value = true
}

onMounted(() => {
  store.resetFlow()
  store.fetchPermits()
  fetchAvailability()
})

const navigateToApply = () => {
  store.goToStep('apply')
  router.push('/user/permits/apply')
}

const navigateToTracker = (permit) => {
  store.goToStep('tracker')
  router.push('/user/permits/' + permit.permit_id)
}

function statusColor(status) {
  const map = { Approved: 'green', Pending: 'yellow', 'Under Review': 'blue', Rejected: 'red', Cancelled: 'gray' }
  return map[status] || 'yellow'
}

function badgeClass(status) {
  const map = { Approved: 'badge-green', Pending: 'badge-yellow', 'Under Review': 'badge-blue', Rejected: 'badge-red', Cancelled: 'badge-gray' }
  return map[status] || 'badge-yellow'
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatDateTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<style scoped>
.halcon-list-content {
  max-width: 1500px;
  margin: 0 auto;
  padding: 2rem;
  font-family: var(--bb-font-body);
}

.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}
.header-content { display: flex; flex-direction: column; gap: 0.25rem; }
.section-title { font-size: var(--bb-text-2xl); font-weight: var(--bb-weight-extrabold); color: var(--bb-ink); margin: 0; }
.section-subtitle { font-size: var(--bb-text-base); color: var(--muted); margin: 0; }

.clay-btn {
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-md);
  font-weight: var(--bb-weight-bold);
  font-family: var(--bb-font-body);
  font-size: var(--bb-text-md);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--bb-accent);
  color: var(--bb-on-accent);
  box-shadow: var(--bb-shadow-md);
}
.clay-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--bb-shadow-lg);
  background: var(--bb-accent-hover);
}
.clay-btn.outline {
  background: transparent;
  color: var(--bb-ink);
  border: 2px solid var(--navy);
  box-shadow: none;
  margin-top: 1rem;
}
.clay-btn.outline:hover { background: var(--bb-accent-soft); box-shadow: none; }

/* ── AVAILABILITY NOTICE ── */
.hg-notice {
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  background: var(--bb-warning-soft);
  border: 1px solid rgba(229, 173, 82, 0.45);
  border-radius: var(--radius-lg);
  padding: 1.5rem 1.75rem;
  margin-bottom: 1.5rem;
}
.hg-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--bb-warning-soft);
  color: var(--bb-warning);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.hg-notice-body { flex: 1; min-width: 0; }
.hg-notice-body h3 {
  font-size: var(--bb-text-lg);
  font-weight: var(--bb-weight-extrabold);
  color: var(--bb-warning);
  margin: 0 0 0.375rem;
}
.hg-notice-body p {
  font-size: var(--bb-text-base);
  color: var(--bb-warning);
  margin: 0 0 0.3rem;
  line-height: 1.55;
}
.hg-notice-body strong { font-weight: var(--bb-weight-extrabold); }
.hg-email {
  font-weight: var(--bb-weight-bold);
  color: var(--bb-info);
  text-decoration: underline;
  white-space: nowrap;
}
.hg-email:hover { color: var(--bb-accent-hover); }
.hg-track-note {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.5rem !important;
  font-size: var(--bb-text-xs) !important;
  color: var(--bb-warning) !important;
  font-weight: var(--bb-weight-semibold);
}
.hg-track-note svg { flex-shrink: 0; }

@media (max-width: 640px) {
  .hg-notice { flex-direction: column; align-items: center; text-align: center; padding: 1.5rem 1.25rem; }
}

.loading-state {
  text-align: center;
  padding: 1.75rem;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.empty-state {
  text-align: center;
  padding: 1.75rem;
  background: var(--bb-surface);
  border-radius: var(--radius-lg);
  border: 2px dashed var(--bb-border-strong);
  color: var(--bb-text-tertiary);
}
.empty-state h3 { font-size: var(--bb-text-xl); font-weight: var(--bb-weight-bold); color: var(--bb-text-secondary); margin: 0.75rem 0 0.25rem; }
.empty-state p { margin: 0; }
.empty-icon { color: var(--bb-border-strong); display: block; margin: 0 auto; }

.permits-list { display: flex; flex-direction: column; gap: 1rem; }

.permit-card {
  padding: 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bb-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--bb-shadow-sm); border: 1px solid var(--border);
  transition: transform 0.2s;
  cursor: pointer;
  gap: 1rem;
}
.permit-card:hover { transform: translateY(-2px); }

.card-left { display: flex; align-items: center; gap: 1rem; flex: 1; }
.icon-box { padding: 0.75rem; border-radius: var(--radius-md); flex-shrink: 0; }
.icon-box.green { background: var(--bb-success-soft); color: var(--bb-success); }
.icon-box.yellow { background: var(--bb-warning-soft); color: var(--bb-warning); }
.icon-box.blue { background: var(--bb-info-soft); color: var(--bb-info); }
.icon-box.red { background: var(--bb-danger-soft); color: var(--bb-danger); }
.icon-box.gray { background: var(--sand-2); color: var(--muted); }

.permit-id { font-size: var(--bb-text-lg); font-weight: var(--bb-weight-bold); color: var(--bb-ink); margin: 0 0 0.25rem; }
.permit-meta { display: flex; align-items: center; gap: 0.375rem; font-size: var(--bb-text-base); color: var(--muted); margin: 0 0 0.2rem; }
.permit-submitted { font-size: var(--bb-text-xs); color: var(--bb-text-tertiary); margin: 0 0 0.5rem; }
.fw-bold { font-weight: var(--bb-weight-bold); }

.permit-tags { display: flex; gap: 0.375rem; flex-wrap: wrap; }
.tag { font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-bold); padding: 0.15rem 0.5rem; border-radius: var(--radius-pill); }
.trail-tag { background: var(--bb-info-soft); color: var(--bb-info); }
.pax-tag { background: var(--sand-2); color: var(--bb-text-secondary); }
.gcash-tag { background: var(--bb-info-soft); color: var(--bb-info); }

.permit-card-right {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding-left: 1.5rem;
  border-left: 1px solid var(--border);
  flex-shrink: 0;
}
.text-right { text-align: right; }
.fee-text { font-size: var(--bb-text-base); font-weight: var(--bb-weight-bold); color: var(--bb-text-secondary); margin: 0.25rem 0 0; }
.chevron { color: var(--bb-text-tertiary); }

.badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: var(--radius-pill); font-size: var(--bb-text-xs); font-weight: var(--bb-weight-bold); }
.badge-green { background: var(--bb-success-soft); color: var(--bb-success); }
.badge-yellow { background: var(--bb-warning-soft); color: var(--bb-warning); }
.badge-blue { background: var(--bb-info-soft); color: var(--bb-info); }
.badge-red { background: var(--bb-danger-soft); color: var(--bb-danger); }
.badge-gray { background: var(--sand-2); color: var(--muted); }

@media (max-width: 768px) {
  .halcon-list-content { padding: 1rem; }
  .permit-card { flex-direction: column; align-items: flex-start; }
  .permit-card-right { padding-left: 0; border-left: none; width: 100%; justify-content: space-between; }
  .desktop-only { display: none; }
}

@media (max-width: 480px) {
  .halcon-list-content { padding: 0.75rem; }
  .list-header { flex-direction: column; align-items: stretch; gap: 0.75rem; }
  .section-title { font-size: var(--bb-text-2xl); }
  .clay-btn { width: 100%; padding: 0.625rem 1rem; font-size: var(--bb-text-base); }
  .hg-notice { padding: 1rem; gap: 0.75rem; }
  .hg-icon { width: 42px; height: 42px; }
  .hg-email { overflow-wrap: anywhere; }
  .permit-card { padding: 1rem; }
  .icon-box { padding: 0.6rem; }
  .permit-meta { flex-wrap: wrap; }
  .permit-submitted { line-height: 1.4; }
}
</style>