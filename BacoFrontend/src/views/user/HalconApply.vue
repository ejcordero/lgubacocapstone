<template>
  <div class="halcon-apply-content">
    <button @click="goBack" class="back-link">
      <ArrowLeft size="16" />
      Back to Permits
    </button>

    <div class="page-header">
      <div class="header-eyebrow">
        <Mountain size="16" />
        Mt. Halcon Permit Application
      </div>
      <h2 class="section-title">{{ isEditMode ? 'Edit Application' : 'New Application' }}</h2>
      <p class="section-subtitle">
        {{ isEditMode ? 'Update your permit details and resubmit.' : 'Complete all sections below to submit your group\'s climbing permit.' }}
      </p>
    </div>

    <!-- ═══ AVAILABILITY GATE: Coming Soon (new applications only) ═══ -->
    <div v-if="statusChecked && !isEditMode && !halconEnabled" class="hg-closed">
      <div class="hg-icon">
        <Mountain size="32" />
      </div>
      <h2>Coming Soon</h2>
      <p>The Mt. Halcon Permit System is not yet accepting applications.</p>
      <p class="hg-contact">
        For inquiries and permit reservations, please email
        <a href="https://mail.google.com/mail/?view=cm&fs=1&to=lgubacotourism@gmail.com&su=Mt.%20Halcon%20Permit%20Inquiry"
           target="_blank" rel="noopener noreferrer" class="hg-email">lgubacotourism@gmail.com</a>
      </p>
      <button @click="goBack" class="back-link hg-back">
        <ArrowLeft size="16" /> Back to Permits
      </button>
    </div>

    <!-- ═══ AVAILABILITY GATE: checking status ═══ -->
    <div v-else-if="!statusChecked && !isEditMode" class="loading-state">
      <Loader2 size="32" class="spin" />
      <p>Checking availability...</p>
    </div>

    <template v-else>
      <div v-if="editLoading" class="loading-state">
        <Loader2 size="32" class="spin" />
        <p>Loading application data...</p>
      </div>

      <template v-else>
        <div class="step-bar">
          <div v-for="(step, i) in steps" :key="i" :class="['step-item', { active: currentStep === i, done: currentStep > i }]">
            <div class="step-dot">
              <CheckCircle v-if="currentStep > i" size="14" />
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span class="step-label">{{ step }}</span>
          </div>
        </div>

        <form @submit.prevent="handleSubmit" class="form-wrapper">

          <!-- SECTION 1: Trek Details -->
          <div :class="['form-section', { visible: currentStep >= 0 }]">
            <div class="section-label">
              <div class="section-num">01</div>
              <div>
                <h3 class="section-heading">Trek Details</h3>
                <p class="section-desc">Set your schedule and trail preferences.</p>
              </div>
            </div>
            <div class="fields-grid two-col">
              <div class="field-group">
                <label>Preferred Trek Date</label>
                <input type="date" v-model="permitForm.trekDate" :min="minTrekDate" required class="field-input" />
              </div>
              <div class="field-group">
                <label>Duration</label>
                <select v-model="permitForm.days" class="field-input">
                  <option>Day Hike</option>
                  <option>2 Days, 1 Night</option>
                  <option>3 Days, 2 Nights</option>
                </select>
              </div>
              <div class="field-group">
                <label>Group Size</label>
                <select v-model.number="permitForm.groupSize" class="field-input">
                  <option v-for="n in 15" :key="n" :value="n">{{ n }} {{ n === 1 ? 'Person' : 'Persons' }}</option>
                </select>
              </div>
              <div class="field-group">
                <label>Entry Point / Trail</label>
                <select v-model="permitForm.trail" class="field-input">
                  <option>Lantuyan Trail</option>
                  <option>Aplaya Trail</option>
                </select>
              </div>
            </div>
          </div>

          <div class="section-divider"></div>

          <!-- SECTION 2: Group Roster -->
          <div :class="['form-section', { visible: currentStep >= 1 }]">
            <div class="section-label">
              <div class="section-num">02</div>
              <div>
                <h3 class="section-heading">Group Roster</h3>
                <p class="section-desc">Provide details for each member of your group.</p>
              </div>
            </div>
            <div class="roster-list">
              <div v-for="(member, index) in permitForm.members" :key="member.id" class="roster-card">
                <div class="roster-badge">
                  {{ index === 0 ? '★ Team Leader' : `Member ${index + 1}` }}
                </div>
                <div class="fields-grid three-col">
                  <div class="field-group">
                    <label>Full Name</label>
                    <input type="text" v-model="member.name" required class="field-input sm" placeholder="Juan Dela Cruz" />
                  </div>
                  <div class="field-group">
                    <label>Age</label>
                    <input type="number" v-model.number="member.age" required class="field-input sm" placeholder="25" min="18" />
                  </div>
                  <div class="field-group">
                    <label>Contact No.</label>
                    <input type="text" v-model="member.contact" required class="field-input sm" placeholder="09xxxxxxxxx" />
                  </div>
                  <div class="field-group span-2">
                    <label>Emergency Contact</label>
                    <input type="text" v-model="member.emergency" required class="field-input sm" placeholder="Name — 09xxxxxxxxx" />
                  </div>
                  <div class="field-group">
                    <label>Medical Conditions</label>
                    <input type="text" v-model="member.medCondition" class="field-input sm" placeholder="None" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="section-divider"></div>

          <!-- SECTION 3: Upload Requirements (PDF ONLY) -->
          <div :class="['form-section', { visible: currentStep >= 2 }]">
            <div class="section-label">
              <div class="section-num">03</div>
              <div>
                <h3 class="section-heading">Upload Requirements</h3>
                <p class="section-desc">Upload PDF files only. Combine all member documents into single PDFs.</p>
              </div>
            </div>
            <div class="upload-grid">
              <!-- Valid IDs -->
              <div :class="['upload-box', hasIdsDoc ? 'uploaded' : '']">
                <div class="upload-icon">
                  <CheckSquare v-if="hasIdsDoc" size="28" class="icon-green" />
                  <FileText v-else size="28" />
                </div>
                <h4>Valid IDs</h4>
                <p class="upload-filename" v-if="displayIdsName">{{ displayIdsName }}</p>
                <p v-else>Combine all member IDs into one PDF file.</p>
                <input
                  type="file"
                  ref="idsInputRef"
                  accept=".pdf,application/pdf"
                  @change="handleIdsFile"
                  class="hidden-input"
                />
                <span class="upload-chip" @click.stop="triggerIdsUpload">
                  <Loader2 v-if="uploading && !displayIdsName" size="13" class="spin" />
                  <Upload v-else size="13" />
                  {{ uploading && !displayIdsName ? 'Uploading...' : (hasIdsDoc ? 'Replace PDF' : 'Upload PDF') }}
                </span>
                <button
                  v-if="hasIdsDoc && !permitForm.existingIdsDoc"
                  type="button"
                  class="remove-doc-btn"
                  @click.stop="removeIds"
                >
                  <X size="12" /> Remove
                </button>
              </div>

              <!-- Medical Certificates -->
              <div :class="['upload-box', hasMedDoc ? 'uploaded' : '']">
                <div class="upload-icon">
                  <CheckSquare v-if="hasMedDoc" size="28" class="icon-green" />
                  <AlertCircle v-else size="28" class="icon-yellow" />
                </div>
                <h4>Medical Certificates</h4>
                <p class="upload-filename" v-if="displayMedName">{{ displayMedName }}</p>
                <p v-else>Fit-to-climb certificates for all members.</p>
                <input
                  type="file"
                  ref="medInputRef"
                  accept=".pdf,application/pdf"
                  @change="handleMedicalFile"
                  class="hidden-input"
                />
                <span class="upload-chip" @click.stop="triggerMedUpload">
                  <Loader2 v-if="uploading && !displayMedName" size="13" class="spin" />
                  <Upload v-else size="13" />
                  {{ uploading && !displayMedName ? 'Uploading...' : (hasMedDoc ? 'Replace PDF' : 'Upload PDF') }}
                </span>
                <button
                  v-if="hasMedDoc && !permitForm.existingMedicalDoc"
                  type="button"
                  class="remove-doc-btn"
                  @click.stop="removeMedical"
                >
                  <X size="12" /> Remove
                </button>
              </div>
            </div>

            <div class="pdf-notice">
              <AlertTriangle size="14" />
              Only PDF files are accepted. Maximum file size is 10MB.
            </div>

            <div class="waiver-box">
              <input type="checkbox" v-model="permitForm.waiver" id="waiver" required />
              <label for="waiver">
                I agree to the
                <span class="link-text">Assumption of Risk and Liability Waiver</span>
                on behalf of my entire group.
              </label>
            </div>
          </div>

          <div class="section-divider"></div>

          <!-- SECTION 4: Payment -->
          <div :class="['form-section', { visible: currentStep >= 3 }]">
            <div class="section-label">
              <div class="section-num">04</div>
              <div>
                <h3 class="section-heading">Payment Details</h3>
                <p class="section-desc">Choose your payment method and review the fee summary.</p>
              </div>
            </div>

            <!-- Payment Method Selection -->
            <div class="payment-method-selector">
              <label
                :class="['method-option', { selected: permitForm.paymentMethod === 'onsite' }]"
                @click="permitForm.paymentMethod = 'onsite'"
              >
                <div class="method-radio">
                  <div class="radio-inner" v-if="permitForm.paymentMethod === 'onsite'"></div>
                </div>
                <Banknote size="22" />
                <div>
                  <p class="method-title">Pay On-site</p>
                  <p class="method-desc">Cash payment at the jump-off point before trek.</p>
                </div>
              </label>
              <label
                :class="['method-option', { selected: permitForm.paymentMethod === 'gcash' }]"
                @click="permitForm.paymentMethod = 'gcash'"
              >
                <div class="method-radio">
                  <div class="radio-inner" v-if="permitForm.paymentMethod === 'gcash'"></div>
                </div>
                <div class="gcash-icon-wrap">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                    <rect width="24" height="24" rx="4" fill="#0054A6"/>
                    <path d="M7 8h3.5c1.4 0 2.5.8 2.5 2s-1.1 2-2.5 2H7V8zm0 4h3.5c1.6 0 3 .9 3 2.5S12.1 17 10.5 17H7v-5zm4.5 0H13" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p class="method-title">GCash</p>
                  <p class="method-desc">Pay online via GCash powered by PayMongo.</p>
                </div>
              </label>
            </div>

            <div class="payment-row">
              <div class="fee-summary">
                <div class="fee-line">
                  <span class="fee-label">Climbing Fee</span>
                  <span class="fee-val">₱1,000 × {{ permitForm.groupSize }} pax</span>
                </div>
                <div class="fee-line">
                  <span class="fee-label">Environmental Fee</span>
                  <span class="fee-val">Included</span>
                </div>
                <div class="fee-total">
                  <span>Total Amount</span>
                  <span class="fee-total-amount">₱{{ totalFee.toLocaleString() }}</span>
                </div>

                <div v-if="permitForm.paymentMethod === 'gcash'" class="gcash-note">
                  <ShieldCheck size="16" class="icon-blue" />
                  <p>You will be redirected to a secure payment page after submission.</p>
                </div>
              </div>

              <button
                type="submit"
                class="submit-btn"
                :disabled="submitting || !isFormValid"
              >
                <Loader2 v-if="submitting" size="18" class="spin" />
                <Send v-else size="18" />
                {{ submitting ? 'Submitting...' : (isEditMode ? 'Update Application' : 'Submit Application') }}
              </button>
            </div>
          </div>

        </form>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePermitStore } from '../../stores/usePermitStore'
import { API } from '../../api'
import { useHalconPermit } from '../../composables/useHalconPermit'
import {
  Mountain, ArrowLeft, CheckCircle, AlertCircle,
  CheckSquare, FileText, Upload, Send, X,
  Loader2, AlertTriangle, Banknote, ShieldCheck
} from 'lucide-vue-next'

const props = defineProps({ id: String })
const router = useRouter()
const route = useRoute()
const store = usePermitStore()

const editId = computed(() => props.id ? Number(props.id) : null)
const {
  isEditMode, permitForm, totalFee, minTrekDate, isFormValid,
  uploading, submitting, handleIdsFile, handleMedicalFile,
  submitApplication, loadPermitForEdit, resetForm,
} = useHalconPermit(editId)

const currentStep = ref(0)
const editLoading = ref(false)
const steps = ['Trek Details', 'Group Roster', 'Requirements', 'Payment']

// File input refs
const idsInputRef = ref(null)
const medInputRef = ref(null)

// ── Availability gate (admin toggle) ──
const API_BASE = API
const halconEnabled = ref(true)   // default true so edit/resubmit flows aren't blocked on a failed status check
const statusChecked = ref(false)

// Computed document display states
const hasIdsDoc = computed(() => permitForm.value.idsFile || permitForm.value.existingIdsDoc)
const hasMedDoc = computed(() => permitForm.value.medicalFile || permitForm.value.existingMedicalDoc)
const displayIdsName = computed(() => permitForm.value.idsFileName || permitForm.value.existingIdsDoc?.original_name || '')
const displayMedName = computed(() => permitForm.value.medicalFileName || permitForm.value.existingMedicalDoc?.original_name || '')

function triggerIdsUpload() {
  idsInputRef.value?.click()
}
function triggerMedUpload() {
  medInputRef.value?.click()
}
function removeIds() {
  permitForm.value.idsFile = null
  permitForm.value.idsFileName = null
  if (idsInputRef.value) idsInputRef.value.value = ''
}
function removeMedical() {
  permitForm.value.medicalFile = null
  permitForm.value.medicalFileName = null
  if (medInputRef.value) medInputRef.value.value = ''
}

onMounted(async () => {
  // ── Availability check FIRST (new applications only) ──
  // Editing an existing application is always allowed so rejected users
  // can still fix and resubmit even while the system is disabled.
  if (!editId.value) {
    try {
      const r = await fetch(`${API_BASE}/halcon/status`)
      if (r.ok) halconEnabled.value = !!(await r.json()).bookingEnabled
    } catch {}
    statusChecked.value = true
    if (!halconEnabled.value) return   // don't init the form if closed
  } else {
    statusChecked.value = true
  }

  if (editId.value) {
    editLoading.value = true
    try {
      const data = await store.fetchPermitById(editId.value)
      if (data) {
        await loadPermitForEdit(data)
      } else {
        router.push('/user/permits')
      }
    } catch (e) {
      console.error(e)
      router.push('/user/permits')
    } finally {
      editLoading.value = false
    }
  } else {
    resetForm()
  }
  currentStep.value = 0
})

const goBack = () => {
  store.goToStep('list')
  router.push('/user/permits')
}

const handleSubmit = async () => {
  try {
    const result = await submitApplication()

    if (result.checkoutUrl) {
      // Redirect to GCash payment
      window.open(result.checkoutUrl, '_blank')
    }

    // Navigate to tracker
    router.push('/user/permits/' + result.permitId)
  } catch (e) {
    alert(e.message)
  }
}
</script>

<style scoped>
.halcon-apply-content {
  max-width: 820px;
  margin: 0 auto;
  padding: 2rem;
  font-family: var(--bb-font-body);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.hidden-input { display: none; }

.loading-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--bb-ink);
  font-size: var(--bb-text-base);
  font-weight: var(--bb-weight-semibold);
  font-family: inherit;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: gap 0.2s;
}
.back-link:hover { gap: 0.625rem; }

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
.section-title {
  font-size: var(--bb-text-3xl);
  font-weight: var(--bb-weight-extrabold);
  color: var(--bb-ink);
  margin: 0 0 0.25rem;
}
.section-subtitle {
  font-size: var(--bb-text-base);
  color: var(--muted);
  margin: 0;
}

/* ── AVAILABILITY GATE (Coming Soon) ── */
.hg-closed {
  max-width: 520px;
  margin: 2rem auto;
  text-align: center;
  background: var(--bb-surface);
  border: 1px solid var(--border);
  border-radius: 1.5rem;
  padding: 3.5rem 2rem;
  box-shadow: var(--bb-shadow-md);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.hg-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--bb-accent-soft);
  color: var(--bb-success);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
}
.hg-closed h2 {
  font-size: var(--bb-text-2xl);
  font-weight: var(--bb-weight-extrabold);
  color: var(--bb-ink);
  margin: 0 0 0.5rem;
}
.hg-closed p {
  font-size: var(--bb-text-base);
  color: var(--bb-text-secondary);
  margin: 0 0 0.35rem;
}
.hg-contact { margin-top: 0.9rem; }
.hg-email {
  font-weight: var(--bb-weight-bold);
  color: var(--bb-accent-ink);
  text-decoration: underline;
}
.hg-email:hover { color: var(--bb-accent-hover); }
.hg-back { margin-top: 1.25rem; }

.step-bar {
  display: flex;
  align-items: center;
  background: var(--bb-surface);
  border-radius: var(--radius-md);
  padding: 1rem 1.5rem;
  box-shadow: var(--bb-shadow-md);
  border: 1px solid var(--bb-border);
  overflow-x: auto;
}
.step-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: fit-content;
  position: relative;
}
.step-item:not(:last-child)::after {
  content: '';
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: calc(100% - 130px);
  height: 2px;
  background: var(--border);
  left: 130px;
}
.step-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--sand-2);
  color: var(--bb-text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-bold);
  flex-shrink: 0;
  transition: all 0.3s;
  border: 2px solid var(--border);
}
.step-item.active .step-dot {
  background: var(--bb-accent);
  color: var(--bb-on-accent);
  border-color: var(--bb-accent);
  box-shadow: 0 0 0 4px var(--bb-accent-soft);
}
.step-item.done .step-dot {
  background: var(--bb-success-soft);
  color: var(--bb-success);
  border-color: var(--bb-success);
}
.step-label {
  font-size: var(--bb-text-sm);
  font-weight: var(--bb-weight-semibold);
  color: var(--bb-text-tertiary);
  white-space: nowrap;
  transition: color 0.3s;
}
.step-item.active .step-label { color: var(--bb-ink); }
.step-item.done .step-label { color: var(--bb-success); }

.form-wrapper {
  background: var(--bb-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--bb-border);
  box-shadow: var(--bb-shadow-md);
  overflow: hidden;
}
.form-section { padding: 2rem; }
.section-divider {
  height: 1px;
  background: linear-gradient(to right, transparent, var(--border), transparent);
  margin: 0 2rem;
}

.section-label {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.section-num {
  font-size: var(--bb-text-2xs);
  font-weight: var(--bb-weight-extrabold);
  color: var(--bb-ink);
  background: var(--bb-bg-subtle);
  padding: 0.3rem 0.5rem;
  border-radius: 0.375rem;
  letter-spacing: 0.05em;
  flex-shrink: 0;
  margin-top: 2px;
}
.section-heading {
  font-size: var(--bb-text-xl);
  font-weight: var(--bb-weight-bold);
  color: var(--bb-ink);
  margin: 0 0 0.2rem;
}
.section-desc {
  font-size: var(--bb-text-sm);
  color: var(--bb-text-tertiary);
  margin: 0;
}

.fields-grid { display: grid; gap: 1rem; }
.two-col { grid-template-columns: repeat(2, 1fr); }
.three-col { grid-template-columns: repeat(3, 1fr); }
.span-2 { grid-column: span 2; }

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.field-group label {
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-semibold);
  color: var(--muted);
  letter-spacing: 0.02em;
}
.field-input {
  width: 100%;
  padding: 0.65rem 0.875rem;
  background: var(--sand);
  border: 1.5px solid var(--border);
  border-radius: 0.625rem;
  font-family: var(--bb-font-body);
  font-size: var(--bb-text-base);
  color: var(--bb-ink);
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.field-input:focus {
  border-color: var(--bb-accent);
  box-shadow: var(--bb-ring);
  background: var(--bb-surface);
}
.field-input.sm {
  padding: 0.55rem 0.75rem;
  font-size: var(--bb-text-sm);
}

.roster-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.roster-card {
  background: var(--sand);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  position: relative;
  padding-top: 1.75rem;
}
.roster-badge {
  position: absolute;
  top: -0.65rem;
  left: 1rem;
  background: var(--bb-accent);
  color: var(--bb-on-accent);
  font-size: var(--bb-text-2xs);
  font-weight: var(--bb-weight-bold);
  padding: 0.2rem 0.75rem;
  border-radius: var(--radius-pill);
  letter-spacing: 0.04em;
}

/* Upload Section */
.upload-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 0.75rem;
}
.upload-box {
  background: var(--sand);
  border: 2px dashed var(--bb-border-strong);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  position: relative;
}
.upload-box:hover {
  border-color: var(--bb-accent);
  background: var(--bb-accent-soft);
}
.upload-box.uploaded {
  border-color: var(--bb-success);
  background: var(--bb-success-soft);
  border-style: solid;
}
.upload-icon { color: var(--bb-text-tertiary); margin-bottom: 0.25rem; }
.icon-green { color: var(--bb-success); }
.icon-yellow { color: var(--bb-sun); }
.icon-blue { color: var(--bb-ink); }

.upload-box h4 { font-size: var(--bb-text-base); font-weight: var(--bb-weight-bold); color: var(--bb-text-secondary); margin: 0; }
.upload-box p { font-size: var(--bb-text-xs); color: var(--bb-text-tertiary); margin: 0; max-width: 220px; }
.upload-filename {
  font-size: var(--bb-text-2xs) !important;
  color: var(--bb-success) !important;
  font-weight: var(--bb-weight-semibold) !important;
  word-break: break-all;
  max-width: 200px;
}

.upload-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: var(--bb-text-2xs);
  font-weight: var(--bb-weight-bold);
  color: var(--bb-ink);
  background: var(--bb-bg-subtle);
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-pill);
  margin-top: 0.25rem;
  cursor: pointer;
  transition: background 0.2s;
}
.upload-chip:hover { background: var(--bb-border-strong); }

.remove-doc-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: var(--bb-text-2xs);
  font-weight: var(--bb-weight-semibold);
  color: var(--bb-danger);
  background: rgba(220,38,38,0.08);
  border: none;
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-pill);
  cursor: pointer;
  margin-top: 0.25rem;
  font-family: inherit;
  transition: background 0.2s;
}
.remove-doc-btn:hover { background: rgba(220,38,38,0.15); }

.pdf-notice {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--bb-text-xs);
  color: var(--bb-warning);
  background: var(--bb-warning-soft);
  border: 1px solid var(--bb-warning);
  border-radius: 0.625rem;
  padding: 0.625rem 1rem;
  margin-bottom: 1.25rem;
}

.waiver-box {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  background: var(--bb-warning-soft);
  border: 1px solid var(--bb-warning);
  border-radius: 0.875rem;
  padding: 1rem 1.25rem;
}
.waiver-box input[type="checkbox"] {
  margin-top: 2px;
  accent-color: var(--bb-ink);
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.waiver-box label { font-size: var(--bb-text-base); color: var(--bb-text-secondary); line-height: 1.5; }
.link-text {
  color: var(--bb-ink);
  font-weight: var(--bb-weight-bold);
  text-decoration: underline;
  cursor: pointer;
}

/* Payment Method Selector */
.payment-method-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.method-option {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1rem 1.25rem;
  border: 2px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bb-surface);
}
.method-option:hover { border-color: var(--bb-info); }
.method-option.selected {
  border-color: var(--bb-accent);
  background: var(--bb-accent-soft);
  box-shadow: var(--bb-ring);
}
.method-radio {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--bb-border-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: border-color 0.2s;
}
.method-option.selected .method-radio { border-color: var(--bb-accent); }
.radio-inner {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--bb-accent);
}
.method-title { font-size: var(--bb-text-base); font-weight: var(--bb-weight-bold); color: var(--bb-ink); margin: 0 0 0.125rem; }
.method-desc { font-size: var(--bb-text-xs); color: var(--muted); margin: 0; }
.gcash-icon-wrap { flex-shrink: 0; }

.gcash-note {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bb-info-soft);
  border: 1px solid var(--bb-info);
  border-radius: 0.625rem;
  padding: 0.625rem 0.875rem;
  margin-top: 0.5rem;
}
.gcash-note p { font-size: var(--bb-text-xs); color: var(--bb-info); margin: 0; }

.payment-row {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
  flex-wrap: wrap;
}
.fee-summary {
  flex: 1;
  min-width: 260px;
  background: var(--sand);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}
.fee-line { display: flex; justify-content: space-between; font-size: var(--bb-text-base); }
.fee-label { color: var(--muted); }
.fee-val { font-weight: var(--bb-weight-semibold); color: var(--bb-text-secondary); }
.fee-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.625rem;
  border-top: 1px solid var(--border);
  font-weight: var(--bb-weight-bold);
  color: var(--bb-ink);
}
.fee-total-amount { font-size: var(--bb-text-2xl); color: var(--rust); }

.submit-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  padding: 1rem 2rem;
  background: var(--bb-accent);
  color: var(--bb-on-accent);
  font-family: var(--bb-font-body);
  font-weight: var(--bb-weight-bold);
  font-size: var(--bb-text-lg);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: var(--bb-shadow-md);
  align-self: flex-end;
}
.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--bb-shadow-lg);
  background: var(--bb-accent-hover);
}
.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .halcon-apply-content { padding: 1rem; }
  .two-col, .three-col { grid-template-columns: 1fr; }
  .span-2 { grid-column: span 1; }
  .upload-grid { grid-template-columns: 1fr; }
  .payment-method-selector { grid-template-columns: 1fr; }
  .step-label { display: none; }
  .payment-row { flex-direction: column; }
  .submit-btn { width: 100%; justify-content: center; }
}

@media (max-width: 480px) {
  .form-section { padding: 1rem; }
  .section-divider { margin: 0 1rem; }
  .step-bar { padding: 0.625rem 0.75rem; }
  .field-input { padding: 0.55rem 0.75rem; }
  .roster-card { padding: 1rem; padding-top: 1.5rem; }
  .upload-box { padding: 1rem; }
  .method-option { padding: 0.75rem 0.875rem; gap: 0.625rem; }
  .fee-summary { padding: 1rem; }
  .waiver-box { padding: 0.875rem 1rem; }
  .submit-btn { font-size: var(--bb-text-base); padding: 0.8rem 1rem; }
}
</style>