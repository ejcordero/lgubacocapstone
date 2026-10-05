<script setup>
import { ref, computed, onMounted } from 'vue'
// Ã¢Å¡Â Ã¯Â¸Â Adjust depth to THIS file's folder:
//   src/views/HalconManager.vue        Ã¢â€ â€™ '../api'
//   src/views/admin/HalconManager.vue  Ã¢â€ â€™ '../../api'
import { API } from '../../../api'

// Ã¢â€â‚¬Ã¢â€â‚¬ State Ã¢â€â‚¬Ã¢â€â‚¬
const permits = ref([])
const loading = ref(false)
const searchQuery = ref('')
const filterStatus = ref('All')

// Ã¢â€â‚¬Ã¢â€â‚¬ Detail Modal Ã¢â€â‚¬Ã¢â€â‚¬
const showDetailModal = ref(false)
const selectedPermit = ref(null)
const detailLoading = ref(false)

// Ã¢â€â‚¬Ã¢â€â‚¬ Status Update Ã¢â€â‚¬Ã¢â€â‚¬
const newStatus = ref('')
const rejectionRemarks = ref('')
const updatingStatus = ref(false)
const statusSuccess = ref('')
const statusError = ref('')

// Ã¢â€â‚¬Ã¢â€â‚¬ PDF Viewer Ã¢â€â‚¬Ã¢â€â‚¬
const showPdfModal = ref(false)
const pdfUrl = ref('')
const pdfName = ref('')

// Ã¢â€â‚¬Ã¢â€â‚¬ Admin auth (all /admin/* routes require this) Ã¢â€â‚¬Ã¢â€â‚¬
const getAdminToken = () => localStorage.getItem('baco_admin_token') || ''
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getAdminToken()}`
})

// Ã¢â€â‚¬Ã¢â€â‚¬ Public Availability Toggle Ã¢â€â‚¬Ã¢â€â‚¬
const bookingEnabled = ref(false)
const toggling = ref(false)
const showConfirmModal = ref(false)
const pendingEnabled = ref(false)
const availError = ref('')

async function fetchAvailability() {
  try {
    const res = await fetch(`${API}/halcon/status`)
    if (!res.ok) return
    const d = await res.json()
    bookingEnabled.value = !!d.bookingEnabled
  } catch (e) { /* leave default off */ }
}

function askToggle() {
  availError.value = ''
  pendingEnabled.value = !bookingEnabled.value
  showConfirmModal.value = true
}
function cancelToggle() {
  showConfirmModal.value = false
  pendingEnabled.value = false
}
async function confirmToggle() {
  toggling.value = true
  availError.value = ''
  try {
    const res = await fetch(`${API}/halcon/admin/availability`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ enabled: pendingEnabled.value })
    })
    const d = await res.json()
    if (!res.ok) { availError.value = d.message || 'Failed to update availability.'; return }
    bookingEnabled.value = !!d.bookingEnabled
    showConfirmModal.value = false
  } catch (e) {
    availError.value = 'Network error.'
  } finally {
    toggling.value = false
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Computed Ã¢â€â‚¬Ã¢â€â‚¬
const filteredPermits = computed(() => {
  const q = searchQuery.value.toLowerCase()
  return permits.value.filter(p => {
    const nameMatch = (p.applicant_name || '').toLowerCase().includes(q) ||
                      (p.permit_id || '').toLowerCase().includes(q)
    const statusMatch = filterStatus.value === 'All' || p.status === filterStatus.value
    return nameMatch && statusMatch
  })
})

// Ã¢â€â‚¬Ã¢â€â‚¬ Fetch Ã¢â€â‚¬Ã¢â€â‚¬
async function fetchPermits() {
  loading.value = true
  try {
    const res = await fetch(`${API}/halcon/admin/permits`, { headers: authHeaders() })
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
    const data = await res.json()
    permits.value = Array.isArray(data) ? data : []   // never let a 401 body become "the list"
  } catch (e) {
    console.error('Fetch error:', e)
    permits.value = []
  } finally {
    loading.value = false
  }
}

async function fetchPermitFull(id) {
  detailLoading.value = true
  try {
    const res = await fetch(`${API}/halcon/admin/permits/${id}/full`, { headers: authHeaders() })
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
    const data = await res.json()
    selectedPermit.value = data
    newStatus.value = data.status
    rejectionRemarks.value = data.remarks || ''
    showDetailModal.value = true
  } catch (e) {
    console.error('Fetch detail error:', e)
  } finally {
    detailLoading.value = false
  }
}

function refreshAfterUpdate() {
  showDetailModal.value = false
  selectedPermit.value = null
  fetchPermits()
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Modal Handlers Ã¢â€â‚¬Ã¢â€â‚¬
function openDetail(permit) {
  fetchPermitFull(permit.id)
}
function closeDetail() {
  showDetailModal.value = false
  selectedPermit.value = null
  statusSuccess.value = ''
  statusError.value = ''
}
function viewPdf(url, name) {
  if (!url) return
  pdfUrl.value = url
  pdfName.value = name || 'Document'
  showPdfModal.value = true
}
function closePdf() {
  showPdfModal.value = false
  pdfUrl.value = ''
  pdfName.value = ''
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Status Update Ã¢â€â‚¬Ã¢â€â‚¬
async function updateStatus() {
  if (!newStatus.value) {
    statusError.value = 'Please select a status.'
    return
  }
  if (newStatus.value === 'Rejected' && !rejectionRemarks.value.trim()) {
    statusError.value = 'Please provide rejection remarks.'
    return
  }
  updatingStatus.value = true
  statusError.value = ''
  statusSuccess.value = ''
  try {
    const res = await fetch(`${API}/halcon/admin/permits/${selectedPermit.value.id}/status`, {
      method: 'PUT',
      headers: authHeaders(),                       // Ã¢â€ Â was missing entirely
      body: JSON.stringify({
        status: newStatus.value,
        remarks: rejectionRemarks.value
      })
    })
    const data = await res.json()
    if (!res.ok) {
      statusError.value = data.message || 'Update failed.'
      return
    }
    statusSuccess.value = data.message
    selectedPermit.value.status = newStatus.value
    if (newStatus.value === 'Rejected') {
      selectedPermit.value.remarks = rejectionRemarks.value
    }
    setTimeout(() => refreshAfterUpdate(), 1200)
  } catch (e) {
    statusError.value = 'Failed to update status.'
  } finally {
    updatingStatus.value = false
  }
}

const statusOptions = ['Pending', 'Under Review', 'Approved', 'Rejected', 'Cancelled']
function watchStatusChange() {
  if (newStatus.value !== 'Rejected') {
    rejectionRemarks.value = ''
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Helpers Ã¢â€â‚¬Ã¢â€â‚¬
function formatDate(str) {
  if (!str) return 'Ã¢â‚¬â€'
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatCurrency(num) {
  return 'Ã¢â€šÂ±' + Number(num || 0).toLocaleString()
}
function getStatusClass(status) {
  const map = {
    'Pending': 'status-pending',
    'Under Review': 'status-review',
    'Approved': 'status-approved',
    'Rejected': 'status-rejected',
    'Cancelled': 'status-cancelled'
  }
  return map[status] || 'status-pending'
}
function getPayStatusClass(status) {
  const map = { paid: 'pay-paid', pending: 'pay-pending', unpaid: 'pay-unpaid', failed: 'pay-failed' }
  return map[status] || 'pay-unpaid'
}
function getPayStatusLabel(status) {
  const map = { paid: 'Paid', pending: 'Awaiting', unpaid: 'Unpaid', failed: 'Failed' }
  return map[status] || 'Unpaid'
}
function getDocCount(permit) {
  return permit.documents ? permit.documents.length : 0
}

onMounted(() => {
  fetchPermits()
  fetchAvailability()
})
</script>

<template>
  <div class="halcon-panel">
    <!-- HEADER -->
    <div class="panel-header">
      <div class="header-left">
        <div class="header-eyebrow">
          <span class="eyebrow-line"></span>
          Tourism Operations
        </div>
        <h2>Mt. Halcon Permit</h2>
        <p>Review permit applications and manage approval status.</p>
      </div>
      <div class="header-actions">
        <div class="avail-widget" :class="{ on: bookingEnabled }">
          <div class="avail-text">
            <span class="avail-label">Public Availability</span>
            <span class="avail-state">{{ bookingEnabled ? 'Available' : 'Not Yet Available' }}</span>
          </div>
          <button class="switch" :class="{ on: bookingEnabled }" @click="askToggle" :disabled="toggling"
            :title="bookingEnabled ? 'Click to disable public booking' : 'Click to make available'">
            <span class="knob"></span>
          </button>
        </div>
        <button class="refresh-btn mat-skeuo-sm mat-pressable-sm" @click="fetchPermits" :disabled="loading">
          <i class="fas fa-sync-alt"></i>
          Refresh
        </button>
      </div>
    </div>

    <!-- FILTER BAR -->
    <div class="filter-bar">
      <div class="search-wrap">
        <i class="fas fa-search"></i>
        <input v-model="searchQuery" type="text" placeholder="Search permit ID or applicant name..." />
      </div>
      <select v-model="filterStatus" class="filter-select">
        <option value="All">All Statuses</option>
        <option value="Pending">Pending</option>
        <option value="Under Review">Under Review</option>
        <option value="Approved">Approved</option>
        <option value="Rejected">Rejected</option>
        <option value="Cancelled">Cancelled</option>
      </select>
    </div>

    <!-- TABLE -->
    <div class="data-panel">
      <div class="panel-bar">
        <span class="bar-title">
          <i class="fas fa-person-hiking"></i>
          Expedition Permits
        </span>
        <span class="bar-count">{{ filteredPermits.length }} record(s)</span>
      </div>

      <div v-if="filteredPermits.length === 0" class="empty-row-full">
        <i class="fas fa-person-hiking"></i>
        <p>No permit applications found.</p>
      </div>

      <div v-else class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Permit ID</th>
              <th>Applicant</th>
              <th>Trek Date</th>
              <th>Pax</th>
              <th>Trail</th>
              <th>Payment</th>
              <th>Status</th>
              <th class="th-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in filteredPermits" :key="p.id" class="data-row">
              <td class="td-mono">{{ p.permit_id }}</td>
              <td>
                <div class="applicant-cell">
                  <span class="applicant-name">{{ p.applicant_name }}</span>
                  <span class="applicant-contact">{{ p.applicant_phone || 'Ã¢â‚¬â€' }}</span>
                </div>
              </td>
              <td class="td-date">{{ formatDate(p.trek_date) }}</td>
              <td>
                <span class="pax-badge mat-well">{{ p.group_size }}</span>
              </td>
              <td class="td-trail">{{ p.trail }}</td>
              <td>
                <span :class="['pay-badge', getPayStatusClass(p.payment_status)]">
                  {{ p.payment_method === 'gcash' ? 'GCash' : 'On-site' }}
                </span>
              </td>
              <td>
                <span :class="['status-pill', getStatusClass(p.status)]">
                  {{ p.status }}
                </span>
              </td>
              <td class="td-right">
                <button class="action-btn mat-skeuo-sm mat-pressable-sm" title="View Details" @click="openDetail(p)">
                  <i class="fas fa-eye"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ===================== DETAIL MODAL ===================== -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showDetailModal" class="modal-overlay" @click.self="closeDetail">
          <div class="modal-container detail-modal mat-glass-strong" @click.stop>
            <div class="modal-header">
              <div>
                <span class="modal-id mat-glass-strong">{{ selectedPermit?.permit_id }}</span>
                <span :class="['status-pill header-status', getStatusClass(selectedPermit?.status)]">
                  {{ selectedPermit?.status }}
                </span>
              </div>
              <button class="modal-close" @click="closeDetail">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <div class="modal-body">
              <!-- Applicant Info -->
              <div class="detail-section">
                <h4 class="section-title">
                  <i class="fas fa-user"></i> Applicant Information
                </h4>
                <div class="info-grid-2">
                  <div class="info-item">
                    <span class="info-label">Name</span>
                    <span class="info-value">{{ selectedPermit?.applicant?.applicant_name || 'Ã¢â‚¬â€' }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Email</span>
                    <span class="info-value">{{ selectedPermit?.applicant?.email || 'Ã¢â‚¬â€' }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Contact</span>
                    <span class="info-value">{{ selectedPermit?.applicant?.phone || 'Ã¢â‚¬â€' }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Submitted</span>
                    <span class="info-value">{{ formatDate(selectedPermit?.created_at) }}</span>
                  </div>
                </div>
              </div>

              <!-- Trek Info -->
              <div class="detail-section">
                <h4 class="section-title">
                  <i class="fas fa-mountain"></i> Trek Details
                </h4>
                <div class="info-grid-3">
                  <div class="info-item">
                    <span class="info-label">Trek Date</span>
                    <span class="info-value">{{ formatDate(selectedPermit?.trek_date) }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Duration</span>
                    <span class="info-value">{{ selectedPermit?.duration }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Group Size</span>
                    <span class="info-value">{{ selectedPermit?.group_size }} persons</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Trail</span>
                    <span class="info-value">{{ selectedPermit?.trail }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Total Fee</span>
                    <span class="info-value fee-value">{{ formatCurrency(selectedPermit?.total_fee) }}</span>
                  </div>
                </div>
              </div>

              <!-- Payment Info -->
              <div class="detail-section">
                <h4 class="section-title">
                  <i class="fas fa-credit-card"></i> Payment
                </h4>
                <div class="info-grid-2">
                  <div class="info-item">
                    <span class="info-label">Method</span>
                    <span class="info-value">
                      <span class="pay-method-badge mat-well">
                        {{ selectedPermit?.payment_method === 'gcash' ? 'Ã°Å¸â€™Â³ GCash' : 'Ã°Å¸â€™Âµ On-site' }}
                      </span>
                    </span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Amount</span>
                    <span class="info-value fee-value">{{ formatCurrency(selectedPermit?.total_fee) }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Payment Status</span>
                    <span :class="['status-pill', 'pay-' + selectedPermit?.payment_status]">
                      {{ getPayStatusLabel(selectedPermit?.payment_status) }}
                    </span>
                  </div>
                  <div v-if="selectedPermit?.payment_reference" class="info-item">
                    <span class="info-label">Reference</span>
                    <span class="info-value mono">{{ selectedPermit?.payment_reference }}</span>
                  </div>
                </div>
              </div>

              <!-- Rejection Note (display only) -->
              <div v-if="selectedPermit?.status === 'Rejected' && selectedPermit?.remarks" class="rejection-display mat-skeuo-sm mat-pressable-danger">
                <div class="rejection-header mat-skeuo-sm mat-pressable-danger">
                  <i class="fas fa-exclamation-triangle"></i>
                  Rejection Note
                </div>
                <p class="rejection-text mat-skeuo-sm mat-pressable-danger">{{ selectedPermit.remarks }}</p>
              </div>

              <!-- Group Members -->
              <div class="detail-section">
                <h4 class="section-title">
                  <i class="fas fa-users"></i>
                  Group Members
                  <span class="section-count">{{ selectedPermit?.members?.length || 0 }}</span>
                </h4>
                <div v-if="selectedPermit?.members?.length > 0" class="members-scroll">
                  <table class="mini-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Age</th>
                        <th>Contact</th>
                        <th>Emergency</th>
                        <th>Medical</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(m, i) in selectedPermit.members" :key="m.id">
                        <td class="td-center">{{ i === 0 ? 'Ã¢Ëœâ€¦' : i + 1 }}</td>
                        <td>{{ m.name }}</td>
                        <td class="td-center">{{ m.age }}</td>
                        <td>{{ m.contact }}</td>
                        <td>{{ m.emergency_contact }}</td>
                        <td>{{ m.medical_condition || 'None' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else class="empty-note">No member data available.</div>
              </div>

              <!-- Documents -->
              <div class="detail-section">
                <h4 class="section-title">
                  <i class="fas fa-file-pdf"></i>
                  Uploaded Documents
                  <span class="section-count">{{ getDocCount(selectedPermit) }}</span>
                </h4>
                <div v-if="getDocCount(selectedPermit) > 0" class="docs-grid">
                  <div
                    v-for="doc in selectedPermit.documents"
                    :key="doc.id"
                    class="doc-card"
                  >
                    <div class="doc-icon-wrap">
                      <i class="fas fa-file-pdf"></i>
                    </div>
                    <div class="doc-info">
                      <p class="doc-name">{{ doc.original_name }}</p>
                      <p class="doc-type">{{ doc.doc_type === 'valid_ids' ? 'Valid IDs' : 'Medical Certificates' }}</p>
                    </div>
                    <button class="doc-view-btn mat-skeuo-sm mat-pressable-sm" @click="viewPdf(doc.url, doc.original_name)">
                      <i class="fas fa-external-link-alt"></i>
                      View PDF
                    </button>
                  </div>
                </div>
                <div v-else class="empty-note">No documents uploaded.</div>
              </div>

              <!-- Status Timeline -->
              <div class="detail-section">
                <h4 class="section-title">
                  <i class="fas fa-history"></i>
                  Status Timeline
                  <span class="section-count">{{ selectedPermit?.history?.length || 0 }}</span>
                </h4>
                <div v-if="selectedPermit?.history?.length > 0" class="timeline">
                  <div
                    v-for="(h, i) in selectedPermit.history"
                    :key="i"
                    class="timeline-item"
                  >
                    <div class="tl-dot" :class="{ active: i === selectedPermit.history.length - 1 }"></div>
                    <div v-if="i < selectedPermit.history.length - 1" class="tl-line"></div>
                    <div class="tl-content">
                      <p class="tl-action">{{ h.action }}</p>
                      <p class="tl-meta">{{ h.date }} Ã‚Â· {{ h.performed_by }}</p>
                    </div>
                  </div>
                </div>
                <div v-else class="empty-note">No history recorded.</div>
              </div>

              <!-- Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ ADMIN STATUS UPDATE Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ -->
              <div class="admin-action-section">
                <h4 class="section-title red">
                  <i class="fas fa-shield-alt"></i>
                  Admin Actions
                </h4>

                <div v-if="statusSuccess" class="toast success-toast">
                  <i class="fas fa-check-circle"></i>
                  {{ statusSuccess }}
                </div>

                <div v-if="statusError" class="toast error-toast">
                  <i class="fas fa-exclamation-circle"></i>
                  {{ statusError }}
                </div>

                <div class="status-form">
                  <div class="status-row">
                    <div class="status-field">
                      <label>Current Status</label>
                      <span :class="['status-pill', 'lg', getStatusClass(selectedPermit?.status)]">
                        {{ selectedPermit?.status }}
                      </span>
                    </div>
                    <div class="status-field">
                      <label>Change To</label>
                      <select v-model="newStatus" @change="watchStatusChange" class="status-select">
                        <option value="">Ã¢â‚¬â€ Select Ã¢â‚¬â€</option>
                        <option v-for="s in statusOptions" :key="s" :value="s" :disabled="s === selectedPermit?.status">
                          {{ s }}
                        </option>
                      </select>
                    </div>
                  </div>

                  <div v-if="newStatus === 'Rejected'" class="remarks-field">
                    <label>Rejection Remarks</label>
                    <textarea
                      v-model="rejectionRemarks"
                      placeholder="Explain why this application is being rejected. The applicant will see this message."
                      rows="3"
                      class="remarks-input"
                    ></textarea>
                  </div>

                  <button
                    class="update-status-btn mat-skeuo-sm mat-pressable-sm"
                    :disabled="!newStatus || updatingStatus"
                    @click="updateStatus"
                  >
                    <i class="fas fa-save"></i>
                    Update Status
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ===================== PDF VIEWER MODAL ===================== -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showPdfModal" class="pdf-overlay" @click.self="closePdf">
          <div class="pdf-modal mat-glass-strong" @click.stop>
            <div class="pdf-header">
              <div class="pdf-title">
                <i class="fas fa-file-pdf"></i>
                {{ pdfName }}
              </div>
              <button class="pdf-close mat-skeuo-sm mat-pressable-sm" @click="closePdf">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <iframe
              :src="pdfUrl"
              class="pdf-frame"
              title="PDF Viewer"
            ></iframe>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ===================== AVAILABILITY CONFIRM MODAL ===================== -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showConfirmModal" class="modal-overlay" @click.self="cancelToggle">
          <div class="confirm-box mat-skeuo-filled mat-pressable-filled" @click.stop>
            <div class="confirm-icon mat-skeuo-filled mat-pressable-filled" :class="pendingEnabled ? 'green' : 'red'">
              <i :class="pendingEnabled ? 'fas fa-circle-check' : 'fas fa-triangle-exclamation'"></i>
            </div>
            <h3>{{ pendingEnabled ? 'Make Halcon booking available?' : 'Disable Halcon booking?' }}</h3>
            <p v-if="pendingEnabled">
              Are you sure you want to make this page available to the public?
              Tourists will immediately be able to submit Mt. Halcon permit applications.
            </p>
            <p v-else>
              Are you sure? The public Mt. Halcon page will show a "Coming Soon" notice
              and new permit applications will be blocked.
            </p>
            <div v-if="availError" class="toast error-toast"><i class="fas fa-exclamation-circle"></i> {{ availError }}</div>
            <div class="confirm-actions mat-skeuo-filled mat-pressable-filled">
              <button class="cbtn cancel mat-skeuo-sm mat-pressable-sm" @click="cancelToggle" :disabled="toggling">Cancel</button>
              <button class="cbtn confirm mat-skeuo-sm mat-pressable-sm" :class="pendingEnabled ? 'green' : 'red'" :disabled="toggling" @click="confirmToggle">
                {{ pendingEnabled ? 'Yes, make it available' : 'Yes, disable it' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; }

.halcon-panel {
  padding: 32px;
  background: var(--bg);
  min-height: 100%;
  font-family: var(--font-body);
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ HEADER Ã¢â€â‚¬Ã¢â€â‚¬ */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  gap: 16px;
  flex-wrap: wrap;
}
.header-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ac);
  margin-bottom: 5px;
}
.eyebrow-line {
  width: 20px;
  height: 2px;
  background: var(--ac);
  border-radius: 1px;
}
.header-left h2 {
  font-family: var(--font-display);
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--fg);
  margin: 0 0 5px;
}
.header-left p {
  font-size: 0.82rem;
  color: var(--mt);
  margin: 0;
}
.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.refresh-btn { display: flex; align-items: center; gap: 7px; padding: 10px 18px; border-radius: var(--r-sm); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; font-family: var(--font-body); }
.refresh-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px var(--acg); }
.refresh-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

/* Ã¢â€â‚¬Ã¢â€â‚¬ AVAILABILITY TOGGLE Ã¢â€â‚¬Ã¢â€â‚¬ */
.avail-widget {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--card-solid);
  border: 1px solid var(--bdr);
  border-radius: var(--r-sm);
  padding: 9px 14px;
}
.avail-text { display: flex; flex-direction: column; gap: 2px; }
.avail-label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--mt);
}
.avail-state { font-size: 0.78rem; font-weight: 700; color: var(--dg); }
.avail-widget.on .avail-state { color: var(--ok); }
.switch {
  width: 46px;
  height: 24px;
  border-radius: 12px;
  background: var(--bdr2);
  border: none;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
}
.switch.on { background: var(--ok); }
.switch:disabled { opacity: 0.6; cursor: wait; }
.knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: left 0.2s;
}
.switch.on .knob { left: 25px; }

/* Ã¢â€â‚¬Ã¢â€â‚¬ CONFIRM BOX Ã¢â€â‚¬Ã¢â€â‚¬ */
.confirm-box { border-radius: var(--r-lg); width: 100%; max-width: 430px; padding: 28px; text-align: center; }
.confirm-icon { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; margin: 0 auto 14px; }
.confirm-icon.green { background: var(--oks); color: var(--ok); }
.confirm-icon.red { background: var(--dgs); color: var(--dg); }
.confirm-box h3 {
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--fg);
  margin: 0 0 8px;
}
.confirm-box p {
  font-size: 0.85rem;
  color: var(--fg2);
  line-height: 1.6;
  margin: 0 0 18px;
}
.confirm-actions { display: flex; gap: 10px; justify-content: center; }
.cbtn { padding: 10px 18px; border-radius: var(--r-sm); font-family: var(--font-body); font-size: 0.82rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.cbtn.cancel:hover:not(:disabled) { border-color: var(--bdr2); color: var(--fg); }
.cbtn.confirm { border: none; color: white; }
.cbtn.confirm.green { background: var(--ok); color: var(--fg); }
.cbtn.confirm.green:hover:not(:disabled) { filter: brightness(1.1); }
.cbtn.confirm.red { background: var(--dg); }
.cbtn.confirm.red:hover:not(:disabled) { filter: brightness(1.1); }
.cbtn:disabled { opacity: 0.6; cursor: not-allowed; }

/* Ã¢â€â‚¬Ã¢â€â‚¬ FILTER BAR Ã¢â€â‚¬Ã¢â€â‚¬ */
.filter-bar {
  background: var(--card-solid);
  padding: 13px 16px;
  border-radius: var(--r-md);
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  border: 1px solid var(--bdr);
}
.search-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--bg2);
  border: 1px solid var(--bdr);
  border-radius: var(--r-sm);
  padding: 0 12px;
}
.search-wrap i { color: var(--mt); font-size: 0.8rem; }
.search-wrap input {
  border: none;
  background: transparent;
  padding: 9px 8px;
  width: 100%;
  outline: none;
  font-size: 0.84rem;
  color: var(--fg);
  font-family: var(--font-body);
}
.search-wrap input::placeholder { color: var(--mt2); }
.filter-select {
  padding: 9px 12px;
  border: 1px solid var(--bdr);
  border-radius: var(--r-sm);
  font-size: 0.82rem;
  color: var(--fg);
  background: var(--bg2);
  font-family: var(--font-body);
}
.filter-select:focus { outline: none; border-color: var(--ac); }

/* Ã¢â€â‚¬Ã¢â€â‚¬ DATA PANEL Ã¢â€â‚¬Ã¢â€â‚¬ */
.data-panel {
  background: var(--card-solid);
  border-radius: var(--r-md);
  overflow: hidden;
  border: 1px solid var(--bdr);
}
.panel-bar {
  background: var(--bg2);
  padding: 13px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--bdr);
}
.bar-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fg);
}
.bar-title i { color: var(--ac); }
.bar-count {
  font-size: 0.7rem;
  color: var(--mt);
}
.empty-row-full {
  text-align: center;
  padding: 48px 20px;
  color: var(--mt);
}
.empty-row-full i { font-size: 1.8rem; display: block; margin-bottom: 10px; opacity: 0.4; }
.empty-row-full p { font-size: 0.84rem; margin: 0; }
.table-scroll { overflow-x: auto; }

/* Ã¢â€â‚¬Ã¢â€â‚¬ TABLE Ã¢â€â‚¬Ã¢â€â‚¬ */
.data-table {
  width: 100%;
  border-collapse: collapse;
}
.data-table thead tr {
  background: var(--bg3);
  border-bottom: 1px solid var(--bdr);
}
.data-table th {
  padding: 11px 14px;
  text-align: left;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--mt);
  white-space: nowrap;
}
.data-table td {
  padding: 12px 14px;
  vertical-align: middle;
  font-size: 0.84rem;
  border-bottom: 1px solid var(--bdr);
  color: var(--fg2);
}
.data-row { transition: background 0.15s; }
.data-row:hover { background: var(--card2); }
.td-mono {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 0.82rem;
  color: var(--fg);
}
.td-date { white-space: nowrap; }
.td-trail { text-transform: capitalize; color: var(--fg2); }
.th-right, .td-right { text-align: right; }
.applicant-cell { display: flex; flex-direction: column; gap: 2px; }
.applicant-name { font-weight: 600; color: var(--fg); }
.applicant-contact { font-size: 0.73rem; color: var(--mt); }
.pax-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 0.72rem; padding: 3px 9px; border-radius: var(--r-sm); font-weight: 700; }
.pay-badge,
.status-pill { display: inline-block; padding: 3px 10px; border-radius: var(--r-sm); font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; }
.status-pill.status-pending { background: var(--wns); color: var(--wn); }
.status-pill.status-review { background: var(--tls); color: var(--tl); }
.status-pill.status-approved { background: var(--oks); color: var(--ok); }
.status-pill.status-rejected { background: var(--dgs); color: var(--dg); }
.status-pill.status-cancelled { background: var(--card3); color: var(--mt); }
.status-pill.lg { font-size: 0.78rem; padding: 5px 14px; }
.status-pill.pay-paid { background: var(--oks); color: var(--ok); }
.status-pill.pay-pending { background: var(--wns); color: var(--wn); }
.status-pill.pay-unpaid { background: var(--card3); color: var(--mt); }
.status-pill.pay-failed { background: var(--dgs); color: var(--dg); }
.pay-badge.pay-paid { background: var(--oks); color: var(--ok); }
.pay-badge.pay-pending { background: var(--wns); color: var(--wn); }
.pay-badge.pay-unpaid { background: var(--card3); color: var(--mt); }
.pay-badge.pay-failed { background: var(--dgs); color: var(--dg); }
.action-btn { cursor: pointer; padding: 6px 10px; border-radius: var(--r-sm); font-size: 0.85rem; }
.action-btn:hover { background: var(--m-accent-solid); color: white; border-color: var(--m-accent-solid); }

/* Ã¢â€â‚¬Ã¢â€â‚¬ MODALS Ã¢â€â‚¬Ã¢â€â‚¬ */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
  padding: 20px;
  backdrop-filter: blur(3px);
}
.modal-container {
  background: var(--card-solid);
  border: 1px solid var(--bdr);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-lg);
  width: 95%;
  max-width: 820px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.detail-modal { max-height: 85vh; }
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--bdr);
  background: var(--bg2);
  flex-shrink: 0;
}
.modal-id { font-family: var(--font-mono); font-size: 1rem; font-weight: 700; margin-right: 10px; }
.header-status { font-size: 0.72rem; }
.modal-close {
  width: 32px;
  height: 32px;
  border-radius: var(--r-sm);
  background: none;
  border: 1px solid var(--bdr);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mt);
  font-size: 1rem;
  transition: all 0.15s;
}
.modal-close:hover { background: var(--card3); color: var(--fg); }
.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ DETAIL SECTIONS Ã¢â€â‚¬Ã¢â€â‚¬ */
.detail-section {
  margin-bottom: 20px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--bdr);
}
.detail-section:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--fg);
  margin: 0 0 8px;
}
.section-title i { color: var(--ac); }
.section-count {
  background: var(--card3);
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
  color: var(--mt);
}
.info-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.info-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.info-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--mt);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.info-value {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--fg);
}
.info-value.mono {
  font-family: var(--font-mono);
  font-weight: 700;
}
.fee-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--ac);
}
.pay-method-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: var(--r-sm); font-size: 0.78rem; font-weight: 700; }

/* Ã¢â€â‚¬Ã¢â€â‚¬ REJECTION DISPLAY Ã¢â€â‚¬Ã¢â€â‚¬ */
.rejection-display { border-radius: var(--r-md); padding: 14px 16px; margin-bottom: 20px; }
.rejection-header { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; font-weight: 700; margin-bottom: 4px; }
.rejection-text { font-size: 0.85rem; line-height: 1.5; margin: 0; white-space: pre-wrap; word-break: break-word; }

/* Ã¢â€â‚¬Ã¢â€â‚¬ MEMBERS TABLE Ã¢â€â‚¬Ã¢â€â‚¬ */
.members-scroll {
  max-height: 250px;
  overflow-y: auto;
  border: 1px solid var(--bdr);
  border-radius: var(--r-md);
}
.mini-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}
.mini-table th {
  background: var(--bg3);
  padding: 8px 10px;
  text-align: left;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--mt);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 1px solid var(--bdr);
  position: sticky;
  top: 0;
  z-index: 1;
}
.mini-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--bdr);
  color: var(--fg2);
}
.td-center { text-align: center; }

/* Ã¢â€â‚¬Ã¢â€â‚¬ DOCUMENTS GRID Ã¢â€â‚¬Ã¢â€â‚¬ */
.docs-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}
.doc-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: var(--bg2);
  border: 1px solid var(--bdr);
  border-radius: var(--r-md);
  transition: border-color 0.2s;
}
.doc-card:hover { border-color: var(--ac); }
.doc-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: var(--r-sm);
  background: var(--dgs);
  color: var(--dg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.doc-info { flex: 1; min-width: 0; }
.doc-name {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.doc-type {
  font-size: 0.7rem;
  color: var(--mt);
}
.doc-view-btn { display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: var(--r-sm); font-size: 0.7rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
.doc-view-btn:hover { background: var(--ac2); }
.empty-note {
  text-align: center;
  color: var(--mt2);
  font-size: 0.84rem;
  padding: 20px 0;
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ TIMELINE Ã¢â€â‚¬Ã¢â€â‚¬ */
.timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-left: 12px;
}
.timeline-item {
  display: flex;
  gap: 0;
  position: relative;
  padding-bottom: 16px;
}
.tl-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--bdr2);
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}
.tl-dot.active {
  background: var(--ac);
  box-shadow: 0 0 0 4px var(--acs);
}
.tl-line {
  position: absolute;
  left: 5px;
  top: 12px;
  width: 2px;
  height: calc(100% + 16px);
  background: var(--bdr);
  z-index: 0;
}
.tl-content {
  padding-left: 24px;
}
.tl-action {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--fg);
  margin: 0 0 2px;
}
.tl-meta {
  font-size: 0.7rem;
  color: var(--mt);
  margin: 0;
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ ADMIN ACTION SECTION Ã¢â€â‚¬Ã¢â€â‚¬ */
.admin-action-section {
  background: var(--bg2);
  border: 1px solid var(--bdr);
  border-radius: var(--r-md);
  padding: 18px;
}
.section-title.red {
  color: var(--dg);
}
.section-title.red i { color: var(--dg); }
.status-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.status-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}
.status-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.status-field label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--mt);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.status-select {
  width: 100%;
  padding: 9px 12px;
  border: 1.5px solid var(--bdr);
  border-radius: var(--r-sm);
  font-size: 0.88rem;
  color: var(--fg);
  font-family: var(--font-body);
  background: var(--bg3);
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s;
}
.status-select:focus { border-color: var(--ac); }
.remarks-field label {
  margin-top: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--mt);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.remarks-input {
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid var(--dgg);
  border-radius: var(--r-sm);
  font-family: var(--font-body);
  font-size: 0.85rem;
  color: var(--fg);
  resize: vertical;
  outline: none;
  transition: border-color 0.15s;
  background: var(--bg3);
}
.remarks-input:focus { border-color: var(--dg); }
.update-status-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 10px 18px; border-radius: var(--r-sm); font-family: var(--font-body); font-size: 0.82rem; font-weight: 700; cursor: pointer; }
.update-status-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px var(--acg);
}
.update-status-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--r-sm);
  font-size: 0.82rem;
  font-weight: 600;
  margin-top: 8px;
}
.toast.success-toast {
  background: var(--oks);
  color: var(--ok);
  border: 1px solid var(--okg);
}
.toast.error-toast {
  background: var(--dgs);
  color: var(--dg);
  border: 1px solid var(--dgg);
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ PDF VIEWER Ã¢â€â‚¬Ã¢â€â‚¬ */
.pdf-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
  backdrop-filter: blur(3px);
}
.pdf-modal { width: 95%; max-width: 900px; height: 85vh; display: flex; flex-direction: column; border-radius: var(--r-md); overflow: hidden; }
.pdf-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--bdr);
  flex-shrink: 0;
}
.pdf-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pdf-title i { color: var(--dg); flex-shrink: 0; }
.pdf-close { width: 32px; height: 32px; border-radius: var(--r-sm); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1rem; }
.pdf-close:hover { background: var(--card3); color: var(--fg); }
.pdf-frame {
  flex: 1;
  border: none;
  width: 100%;
  min-height: 0;
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ TRANSITIONS Ã¢â€â‚¬Ã¢â€â‚¬ */
.modal-enter-active { animation: modal-in 0.25s ease-out; }
.modal-leave-active { animation: modal-out 0.15s ease-in; }
.pdf-overlay-enter-active { animation: overlay-in 0.15s ease-out; }
.pdf-overlay-leave-active { animation: overlay-out 0.1s ease-in; }

@keyframes modal-in {
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes modal-out {
  from { opacity: 1; transform: scale(1) translateY(0); }
  to { opacity: 0; transform: scale(0.95) translateY(10px); }
}
@keyframes overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes overlay-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

/* Ã¢â€â‚¬Ã¢â€â‚¬ RESPONSIVE Ã¢â€â‚¬Ã¢â€â‚¬ */
@media (max-width: 768px) {
  .halcon-panel { padding: 16px; }
  .panel-header { flex-direction: column; gap: 12px; }
  .filter-bar { flex-direction: column; }
  .search-wrap { width: 100%; }
  .filter-select { width: 100%; }
  .info-grid-2,
  .info-grid-3 { grid-template-columns: 1fr; }
  .modal-container { width: 98%; max-height: 95vh; }
  .docs-grid { grid-template-columns: 1fr; }
  .status-row { flex-direction: column; align-items: stretch; }
  .status-field { width: 100%; }
}

</style>