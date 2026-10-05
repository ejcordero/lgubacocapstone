<template>
  <div class="halcon-tracker-content">
    <button @click="goBack" class="back-link">
      <ArrowLeft size="16" />
      Back to Permits
    </button>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <Loader2 size="32" class="spin" />
      <p>Loading permit details...</p>
    </div>

    <!-- Not Found -->
    <div v-else-if="!permit" class="empty-state">
      <AlertCircle size="48" class="empty-icon" />
      <h3>Permit not found</h3>
      <p>This permit may not exist or you don't have access to it.</p>
    </div>

    <!-- Permit Detail -->
    <template v-else>
      <!-- Header -->
      <div class="tracker-header">
        <div class="header-left">
          <div class="header-eyebrow">
            <Mountain size="16" />
            Mt. Halcon Permit
          </div>
          <h2 class="section-title">{{ permit.permit_id }}</h2>
        </div>
        <span :class="['status-badge', statusClass]">{{ permit.status }}</span>
      </div>

      <!-- Payment success message -->
      <div v-if="paymentSuccess" class="payment-success-banner">
        <CheckCircle size="20" />
        <div>
          <p class="banner-title">Payment Received!</p>
          <p class="banner-desc">Your GCash payment has been confirmed. Your permit is now being processed.</p>
        </div>
      </div>

      <!-- Payment cancelled message -->
      <div v-if="paymentCancelled" class="payment-cancel-banner">
        <XCircle size="20" />
        <div>
          <p class="banner-title">Payment Cancelled</p>
          <p class="banner-desc">Your GCash payment was not completed. You can retry below.</p>
        </div>
      </div>

      <!-- Rejection reason -->
      <div v-if="permit.status === 'Rejected' && permit.remarks" class="rejection-banner">
        <AlertTriangle size="20" />
        <div>
          <p class="banner-title">Rejection Reason</p>
          <p class="banner-desc">{{ permit.remarks }}</p>
        </div>
      </div>

      <div class="tracker-grid">
        <!-- Left Column: Details -->
        <div class="details-col">
          <!-- Trek Info -->
          <div class="info-card">
            <h3 class="card-heading">
              <Calendar size="16" />
              Trek Information
            </h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Trek Date</span>
                <span class="info-value">{{ formatDate(permit.trek_date) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Duration</span>
                <span class="info-value">{{ permit.duration }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Trail</span>
                <span class="info-value">{{ permit.trail }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Group Size</span>
                <span class="info-value">{{ permit.group_size }} persons</span>
              </div>
              <div class="info-item">
                <span class="info-label">Submitted</span>
                <span class="info-value">{{ formatDateTime(permit.created_at) }}</span>
              </div>
            </div>
          </div>

          <!-- Members -->
          <div class="info-card">
            <h3 class="card-heading">
              <Users size="16" />
              Group Members
            </h3>
            <div class="members-table-wrap">
              <table class="members-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Age</th>
                    <th>Contact</th>
                    <th>Emergency</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(m, i) in permit.members" :key="i">
                    <td><span class="member-num">{{ i === 0 ? '★' : i + 1 }}</span></td>
                    <td class="member-name">{{ m.name }}</td>
                    <td>{{ m.age }}</td>
                    <td>{{ m.contact }}</td>
                    <td>{{ m.emergency }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Documents -->
          <div class="info-card">
            <h3 class="card-heading">
              <FileText size="16" />
              Uploaded Documents
            </h3>
            <div v-if="permit.documents && permit.documents.length > 0" class="docs-list">
              <a
                v-for="doc in permit.documents"
                :key="doc.id"
                :href="doc.url"
                target="_blank"
                class="doc-link"
              >
                <FileText size="16" />
                <div>
                  <p class="doc-name">{{ doc.original_name }}</p>
                  <p class="doc-type">{{ formatDocType(doc.doc_type) }} — Uploaded {{ formatDate(doc.uploaded_at) }}</p>
                </div>
                <Download size="14" class="doc-download" />
              </a>
            </div>
            <p v-else class="no-docs">No documents uploaded.</p>
          </div>
        </div>

        <!-- Right Column: Status & Payment -->
        <div class="status-col">
          <!-- Payment Info -->
          <div class="info-card">
            <h3 class="card-heading">
              <CreditCard size="16" />
              Payment
            </h3>
            <div class="payment-info">
              <div class="payment-line">
                <span>Method</span>
                <span class="payment-method-badge">
                  <template v-if="permit.payment_method === 'gcash'">
                    <span class="gcash-dot"></span> GCash
                  </template>
                  <template v-else>
                    <Banknote size="14" /> On-site
                  </template>
                </span>
              </div>
              <div class="payment-line">
                <span>Total</span>
                <span class="payment-amount">₱{{ Number(permit.total_fee).toLocaleString() }}</span>
              </div>
              <div class="payment-line">
                <span>Status</span>
                <span :class="['payment-status', payStatusClass]">
                  {{ payStatusLabel }}
                </span>
              </div>
              <div v-if="permit.payment_reference" class="payment-line">
                <span>Reference</span>
                <span class="payment-ref">{{ permit.payment_reference }}</span>
              </div>

              <!-- GCash Pay / Retry button -->
              <button
                v-if="permit.payment_method === 'gcash' && permit.payment_status !== 'paid' && (permit.status === 'Pending' || permit.status === 'Rejected')"
                class="gcash-pay-btn"
                :disabled="checkingPayment"
                @click="retryGcash"
              >
                <Loader2 v-if="checkingPayment" size="16" class="spin" />
                <template v-else>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                    <rect width="24" height="24" rx="4" fill="white"/>
                    <path d="M7 8h3.5c1.4 0 2.5.8 2.5 2s-1.1 2-2.5 2H7V8zm0 4h3.5c1.6 0 3 .9 3 2.5S12.1 17 10.5 17H7v-5zm4.5 0H13" stroke="#0054A6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  {{ permit.payment_status === 'failed' ? 'Retry GCash Payment' : 'Pay with GCash' }}
                </template>
              </button>
            </div>
          </div>

          <!-- Status Timeline -->
          <div class="info-card">
            <h3 class="card-heading">
              <Clock size="16" />
              Status Timeline
            </h3>
            <div class="timeline">
              <div
                v-for="(event, i) in permit.history"
                :key="i"
                class="timeline-item"
              >
                <div class="timeline-dot-wrap">
                  <div :class="['timeline-dot', i === permit.history.length - 1 ? 'active' : '']"></div>
                  <div v-if="i < permit.history.length - 1" class="timeline-line"></div>
                </div>
                <div class="timeline-content">
                  <p class="timeline-action">{{ event.action }}</p>
                  <p class="timeline-date">{{ event.date }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div v-if="canEdit || canCancel" class="action-buttons">
            <button
              v-if="canEdit"
              @click="editPermit"
              class="action-btn edit-btn"
            >
              <Pencil size="16" />
              {{ permit.status === 'Rejected' ? 'Edit & Resubmit' : 'Edit Application' }}
            </button>
            <button
              v-if="canCancel"
              @click="cancelPermit"
              class="action-btn cancel-btn"
            >
              <XCircle size="16" />
              Cancel Application
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePermitStore } from '../../stores/usePermitStore'
import { API as API_ROOT } from '../../api'
import {
  Mountain, ArrowLeft, Calendar, Users, FileText, Download,
  CreditCard, Banknote, Clock, Pencil, XCircle, CheckCircle,
  AlertCircle, AlertTriangle, Loader2
} from 'lucide-vue-next'

const props = defineProps({ id: String })
const router = useRouter()
const route = useRoute()
const store = usePermitStore()

// Normalized backend root from src/api.js (already ends with /api)
const API = API_ROOT + '/halcon'

const permit = computed(() => store.selectedPermit)
const loading = computed(() => store.loading)
const checkingPayment = ref(false)

const paymentSuccess = ref(false)
const paymentCancelled = ref(false)

const canEdit = computed(() => permit.value && ['Pending', 'Rejected'].includes(permit.value.status))
const canCancel = computed(() => permit.value && permit.value.status === 'Pending')

const statusClass = computed(() => {
  const map = { Approved: 'green', Pending: 'yellow', 'Under Review': 'blue', Rejected: 'red', Cancelled: 'gray' }
  return map[permit.value?.status] || 'yellow'
})

const payStatusClass = computed(() => {
  const map = { paid: 'paid', pending: 'pending', unpaid: 'unpaid', failed: 'failed' }
  return map[permit.value?.payment_status] || 'unpaid'
})

const payStatusLabel = computed(() => {
  const map = { paid: 'Paid', pending: 'Awaiting Payment', unpaid: 'Unpaid', failed: 'Failed' }
  return map[permit.value?.payment_status] || 'Unpaid'
})

onMounted(async () => {
  // Check URL params for payment result
  if (route.query.payment === 'success') paymentSuccess.value = true
  if (route.query.payment === 'cancelled') paymentCancelled.value = true

  // Load permit data safely
  const code = props.id
  if (code && code !== 'undefined') {
    const data = await store.fetchPermitByCode(code)
    if (data && data.payment_method === 'gcash' && data.payment_status !== 'paid') {
      await checkPaymentStatus()
    }
  }
})

onUnmounted(() => {
  store.resetFlow()
})

async function checkPaymentStatus() {
  if (!permit.value) return
  checkingPayment.value = true
  try {
    const token = localStorage.getItem('baco_user_token')
    if (!token) return

    const res = await fetch(`${API}/permits/${permit.value.id}/payment-status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()
    if (data.paymentStatus === 'paid') {
      paymentSuccess.value = true
      paymentCancelled.value = false
      // Refresh permit data
      await store.fetchPermitByCode(props.id)
    }
  } catch (e) {
    console.error('Check payment error:', e)
  } finally {
    checkingPayment.value = false
  }
}

function retryGcash() {
  // For now, re-check status or redirect to a new checkout
  // The simplest approach: try to use existing checkout URL
  // But PayMongo sessions expire, so we need to create a new one
  // This is handled by editing the permit, which creates a new checkout
  // So let's just navigate to edit
  editPermit()
}

function editPermit() {
  if (!permit.value) return
  router.push('/user/permits/' + permit.value.id + '/edit')
}

async function cancelPermit() {
  if (!confirm('Are you sure you want to cancel this permit application? This action cannot be undone.')) return
  if (!permit.value) return
  
  try {
    const token = localStorage.getItem('baco_user_token')
    if (!token) return

    const res = await fetch(`${API}/permits/${permit.value.id}/cancel`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await res.json()
    if (res.ok) {
      await store.fetchPermitByCode(props.id)
    } else {
      alert(data.message)
    }
  } catch (e) {
    alert('Failed to cancel permit.')
  }
}

function goBack() {
  router.push('/user/permits')
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatDateTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDocType(type) {
  return type === 'valid_ids' ? 'Valid IDs' : 'Medical Certificates'
}
</script>

<style scoped>
.halcon-tracker-content {
  max-width: 1500px;
  margin: 0 auto;
  padding: 2rem;
  font-family: var(--bb-font-body);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--bb-ink);
  font-size: var(--bb-text-base);
  font-weight: var(--bb-weight-semibold);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
}
.back-link:hover { gap: 0.625rem; }

.loading-state {
  text-align: center;
  padding: 4rem;
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
.empty-icon { display: block; margin: 0 auto; }

/* Header */
.tracker-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
}
.header-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--rust);
  margin-bottom: 0.375rem;
}
.section-title { font-size: var(--bb-text-2xl); font-weight: var(--bb-weight-extrabold); color: var(--bb-ink); margin: 0; }

.status-badge {
  padding: 0.375rem 1rem;
  border-radius: var(--radius-pill);
  font-size: var(--bb-text-sm);
  font-weight: var(--bb-weight-bold);
}
.status-badge.green { background: var(--bb-success-soft); color: var(--bb-success); }
.status-badge.yellow { background: var(--bb-warning-soft); color: var(--bb-warning); }
.status-badge.blue { background: var(--bb-info-soft); color: var(--bb-info); }
.status-badge.red { background: var(--bb-danger-soft); color: var(--bb-danger); }
.status-badge.gray { background: var(--sand-2); color: var(--muted); }

/* Banners */
.payment-success-banner, .payment-cancel-banner, .rejection-banner {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-radius: var(--radius-md);
}
.payment-success-banner { background: var(--bb-success-soft); border: 1px solid var(--bb-success); color: var(--bb-success); }
.payment-cancel-banner { background: var(--bb-danger-soft); border: 1px solid var(--bb-danger); color: var(--bb-danger); }
.rejection-banner { background: var(--bb-warning-soft); border: 1px solid var(--bb-warning); color: var(--bb-warning); }
.banner-title { font-size: var(--bb-text-base); font-weight: var(--bb-weight-bold); margin: 0 0 0.125rem; }
.banner-desc { font-size: var(--bb-text-sm); margin: 0; }

/* Grid */
.tracker-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 1.5rem;
}
.details-col, .status-col {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* Info Cards */
.info-card {
  background: var(--bb-surface);
  border-radius: 1.25rem;
  padding: 1.5rem;
  border: 1px solid var(--bb-border);
  box-shadow: var(--bb-shadow-md);
}
.card-heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--bb-text-md);
  font-weight: var(--bb-weight-bold);
  color: var(--bb-ink);
  margin: 0 0 1rem;
}

.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.info-item { display: flex; flex-direction: column; gap: 0.2rem; }
.info-label { font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-semibold); color: var(--bb-text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; }
.info-value { font-size: var(--bb-text-base); font-weight: var(--bb-weight-semibold); color: var(--bb-ink); }

/* Members Table */
.members-table-wrap { overflow-x: auto; }
.members-table { width: 100%; border-collapse: collapse; font-size: var(--bb-text-sm); }
.members-table th {
  text-align: left;
  padding: 0.5rem 0.625rem;
  font-size: var(--bb-text-2xs);
  font-weight: var(--bb-weight-bold);
  color: var(--bb-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border);
}
.members-table td {
  padding: 0.625rem;
  border-bottom: 1px solid var(--sand-2);
  color: var(--bb-text-secondary);
}
.member-num { color: var(--bb-ink); font-weight: var(--bb-weight-bold); }
.member-name { font-weight: var(--bb-weight-semibold); color: var(--bb-ink); }

/* Documents */
.docs-list { display: flex; flex-direction: column; gap: 0.625rem; }
.doc-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--sand);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: inherit;
  transition: all 0.2s;
}
.doc-link:hover { border-color: var(--bb-accent); background: var(--bb-accent-soft); }
.doc-name { font-size: var(--bb-text-sm); font-weight: var(--bb-weight-semibold); color: var(--bb-ink); margin: 0; }
.doc-type { font-size: var(--bb-text-2xs); color: var(--bb-text-tertiary); margin: 0; }
.doc-download { color: var(--bb-ink); margin-left: auto; flex-shrink: 0; }
.no-docs { font-size: var(--bb-text-sm); color: var(--bb-text-tertiary); }

/* Payment */
.payment-info { display: flex; flex-direction: column; gap: 0.75rem; }
.payment-line { display: flex; justify-content: space-between; align-items: center; font-size: var(--bb-text-base); }
.payment-method-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-weight: var(--bb-weight-bold);
  color: var(--bb-text-secondary);
}
.gcash-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--bb-accent);
}
.payment-amount { font-size: var(--bb-text-xl); font-weight: var(--bb-weight-extrabold); color: var(--rust); }
.payment-status {
  padding: 0.2rem 0.625rem;
  border-radius: var(--radius-pill);
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-bold);
}
.payment-status.paid { background: var(--bb-success-soft); color: var(--bb-success); }
.payment-status.pending { background: var(--bb-warning-soft); color: var(--bb-warning); }
.payment-status.unpaid { background: var(--sand-2); color: var(--muted); }
.payment-status.failed { background: var(--bb-danger-soft); color: var(--bb-danger); }
.payment-ref { font-size: var(--bb-text-2xs); color: var(--muted); font-family: var(--bb-font-mono); }

.gcash-pay-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.75rem;
  background: var(--bb-accent);
  color: var(--bb-on-accent);
  border: none;
  border-radius: var(--radius-sm);
  font-family: var(--bb-font-body);
  font-size: var(--bb-text-base);
  font-weight: var(--bb-weight-bold);
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 0.5rem;
}
.gcash-pay-btn:hover:not(:disabled) { background: var(--bb-accent-hover); }
.gcash-pay-btn:disabled { opacity: 0.7; cursor: not-allowed; }

/* Timeline */
.timeline { display: flex; flex-direction: column; }
.timeline-item { display: flex; gap: 0.75rem; }
.timeline-dot-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}
.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--bb-border-strong);
  flex-shrink: 0;
}
.timeline-dot.active { background: var(--bb-accent); box-shadow: 0 0 0 3px var(--bb-accent-soft); }
.timeline-line { width: 2px; flex: 1; background: var(--bb-border); min-height: 20px; }
.timeline-content { padding-bottom: 1rem; }
.timeline-action { font-size: var(--bb-text-sm); font-weight: var(--bb-weight-semibold); color: var(--bb-ink); margin: 0 0 0.125rem; }
.timeline-date { font-size: var(--bb-text-2xs); color: var(--bb-text-tertiary); margin: 0; }

/* Action Buttons */
.action-buttons { display: flex; flex-direction: column; gap: 0.75rem; }
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.875rem;
  border-radius: var(--radius-md);
  font-family: var(--bb-font-body);
  font-size: var(--bb-text-base);
  font-weight: var(--bb-weight-bold);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}
.edit-btn {
  background: var(--bb-deep);
  color: var(--bb-on-deep);
  box-shadow: var(--bb-shadow-md);
}
.edit-btn:hover { background: var(--bb-accent-hover); transform: translateY(-1px); }
.cancel-btn {
  background: var(--bb-surface);
  color: var(--bb-danger);
  border: 2px solid var(--bb-danger) !important;
}
.cancel-btn:hover { background: var(--bb-danger-soft); }

@media (max-width: 768px) {
  .halcon-tracker-content { padding: 1rem; }
  .tracker-grid { grid-template-columns: 1fr; }
  .info-grid { grid-template-columns: 1fr; }
}

@media (max-width: 480px) {
  .halcon-tracker-content { padding: 0.75rem; }
  .tracker-header { flex-direction: column; }
  .info-card { padding: 1rem; border-radius: 1rem; }
  .action-btn { padding: 0.75rem; font-size: var(--bb-text-sm); }
  .gcash-pay-btn { font-size: var(--bb-text-sm); }
  .payment-line { flex-direction: column; align-items: flex-start; gap: 0.25rem; }
  .payment-success-banner, .payment-cancel-banner, .rejection-banner { padding: 0.875rem 1rem; }
  .doc-link { padding: 0.625rem 0.75rem; }
}
</style>
