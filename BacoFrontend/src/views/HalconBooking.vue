<script setup>
import { ref, computed } from 'vue'

// --- MOCK DATABASE (Matches Admin Side) ---
const availableAccommodations = ref([
  { id: 1, name: 'Mayabig Basecamp - Kubo A', type: 'Homestay', capacity: 6, price: 1500 },
  { id: 2, name: 'Mayabig Basecamp - Tent Pitch Area', type: 'Tent Pitch', capacity: 20, price: 200 }
])

// --- FORM STATE ---
const form = ref({
  leadClimber: '',
  contactNumber: '',
  groupSize: 1,
  startDate: '',
  endDate: '',
  selectedAccommodation: null,
  medicalCert: null,
  waiver: null,
  emergencyContact: '',
  specialRequirements: ''
})

const isSubmitting = ref(false)
const submissionSuccess = ref(false)
const formErrors = ref({})
const showErrors = ref(false)

// --- COMPUTED PROPERTIES ---
const totalPrice = computed(() => {
  if (!form.value.selectedAccommodation || !form.value.startDate || !form.value.endDate) return 0
  
  const accommodation = availableAccommodations.value.find(a => a.id === form.value.selectedAccommodation)
  if (!accommodation) return 0
  
  const start = new Date(form.value.startDate)
  const end = new Date(form.value.endDate)
  const nights = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)))
  
  return accommodation.price * nights
})

// --- VALIDATION ---
const validateForm = () => {
  const errors = {}
  
  if (!form.value.leadClimber) errors.leadClimber = 'Lead climber name is required'
  if (!form.value.contactNumber) errors.contactNumber = 'Contact number is required'
  if (!form.value.groupSize || form.value.groupSize < 1) errors.groupSize = 'Group size must be at least 1'
  if (!form.value.startDate) errors.startDate = 'Start date is required'
  if (!form.value.endDate) errors.endDate = 'End date is required'
  if (!form.value.selectedAccommodation) errors.accommodation = 'Please select accommodation'
  if (!form.value.medicalCert) errors.medicalCert = 'Medical certificate is required'
  if (!form.value.waiver) errors.waiver = 'Liability waiver is required'
  
  // Date validation
  if (form.value.startDate && form.value.endDate) {
    const start = new Date(form.value.startDate)
    const end = new Date(form.value.endDate)
    if (end <= start) errors.dateRange = 'End date must be after start date'
  }
  
  formErrors.value = errors
  return Object.keys(errors).length === 0
}

// --- ACTIONS ---
const handleFileUpload = (event, type) => {
  const file = event.target.files[0]
  if (file) {
    form.value[type] = file.name
    // Clear any previous errors for this field
    if (formErrors.value[type]) {
      delete formErrors.value[type]
    }
  }
}

const submitApplication = () => {
  showErrors.value = true
  
  if (!validateForm()) {
    // Scroll to first error
    const firstErrorField = Object.keys(formErrors.value)[0]
    if (firstErrorField) {
      const element = document.querySelector(`[name="${firstErrorField}"]`)
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    return
  }

  isSubmitting.value = true
  
  // Simulate network request
  setTimeout(() => {
    isSubmitting.value = false
    submissionSuccess.value = true
    showErrors.value = false
  }, 2000)
}

const resetForm = () => {
  form.value = {
    leadClimber: '',
    contactNumber: '',
    groupSize: 1,
    startDate: '',
    endDate: '',
    selectedAccommodation: null,
    medicalCert: null,
    waiver: null,
    emergencyContact: '',
    specialRequirements: ''
  }
  formErrors.value = {}
  submissionSuccess.value = false
  showErrors.value = false
}
</script>

<template>
  <div class="booking-matrix">
    
    <div class="booking-header">
      <h1>Mt. Halcon e-Permit Portal</h1>
      <p>Official booking and accommodation system for Mt. Halcon expeditions.</p>
    </div>

    <div v-if="submissionSuccess" class="success-state">
      <div class="success-icon">
        <i class="fa-solid fa-circle-check"></i>
      </div>
      <h2>Application Submitted Successfully</h2>
      <p>Your booking ID is <strong>HLC-26-{{ Math.floor(Math.random() * 1000) }}</strong>.</p>
      <p>Please wait for the Tourism Office to verify your documents. You can check your status using this ID.</p>
      <div class="success-actions">
        <button @click="resetForm" class="reset-btn">Submit Another Application</button>
        <button class="view-status-btn">Check Status</button>
      </div>
    </div>

    <div v-else class="form-container">
      <form @submit.prevent="submitApplication">
        
        <!-- EXPEDITION DETAILS -->
        <div class="form-section">
          <h3><i class="fa-solid fa-mountain"></i> Expedition Details</h3>
          <div class="grid-2">
            <div class="input-group">
              <label>Start Date (Ascent)</label>
              <input 
                type="date" 
                v-model="form.startDate" 
                required
                :min="new Date().toISOString().split('T')[0]"
              />
              <span v-if="formErrors.startDate" class="error-message">{{ formErrors.startDate }}</span>
            </div>
            <div class="input-group">
              <label>End Date (Descent)</label>
              <input 
                type="date" 
                v-model="form.endDate" 
                required
                :min="form.startDate || new Date().toISOString().split('T')[0]"
              />
              <span v-if="formErrors.endDate" class="error-message">{{ formErrors.endDate }}</span>
            </div>
            <div class="input-group">
              <label>Lead Climber Full Name</label>
              <input 
                type="text" 
                v-model="form.leadClimber" 
                placeholder="Juan Dela Cruz" 
                required
              />
              <span v-if="formErrors.leadClimber" class="error-message">{{ formErrors.leadClimber }}</span>
            </div>
            <div class="input-group">
              <label>Contact Number</label>
              <input 
                type="tel" 
                v-model="form.contactNumber" 
                placeholder="09XX-XXX-XXXX" 
                required
                pattern="[0-9]{4}-[0-9]{3}-[0-9]{4}"
              />
              <span v-if="formErrors.contactNumber" class="error-message">{{ formErrors.contactNumber }}</span>
            </div>
            <div class="input-group full-width">
              <label>Total Group Size (Pax)</label>
              <input 
                type="number" 
                v-model="form.groupSize" 
                min="1" 
                max="15" 
                required
              />
              <small>Maximum of 15 climbers per group allowed.</small>
              <span v-if="formErrors.groupSize" class="error-message">{{ formErrors.groupSize }}</span>
            </div>
            <div class="input-group full-width">
              <label>Emergency Contact Number</label>
              <input 
                type="tel" 
                v-model="form.emergencyContact" 
                placeholder="09XX-XXX-XXXX"
                pattern="[0-9]{4}-[0-9]{3}-[0-9]{4}"
              />
              <small>For safety purposes during the expedition.</small>
            </div>
          </div>
        </div>

        <!-- ACCOMMODATION SELECTION -->
        <div class="form-section">
          <h3><i class="fa-solid fa-campground"></i> Pre-Climb Basecamp Accommodation</h3>
          <p class="section-desc">Select a homestay or pitch area at Brgy. Mayabig jump-off point for the night before your climb.</p>
          
          <div class="accommodation-grid">
            <label 
              v-for="unit in availableAccommodations" 
              :key="unit.id" 
              class="accommodation-card"
              :class="{ selected: form.selectedAccommodation === unit.id }"
            >
              <input type="radio" :value="unit.id" v-model="form.selectedAccommodation" name="accommodation" />
              <div class="card-content">
                <span class="unit-name">{{ unit.name }}</span>
                <span class="unit-type">{{ unit.type }} | Max {{ unit.capacity }} Pax</span>
                <span class="unit-price">₱{{ unit.price.toFixed(2) }} / night</span>
              </div>
            </label>
          </div>
          <span v-if="formErrors.accommodation" class="error-message">{{ formErrors.accommodation }}</span>
        </div>

        <!-- DOCUMENTS UPLOAD -->
        <div class="form-section">
          <h3><i class="fa-solid fa-file-shield"></i> Mandatory Requirements</h3>
          <div class="grid-2">
            <div class="upload-box">
              <label>Medical Certificate (PDF/JPG/PNG)</label>
              <input 
                type="file" 
                @change="e => handleFileUpload(e, 'medicalCert')" 
                accept=".pdf,.jpg,.png"
                required
              />
              <span class="file-name" v-if="form.medicalCert">{{ form.medicalCert }}</span>
              <span v-if="formErrors.medicalCert" class="error-message">{{ formErrors.medicalCert }}</span>
            </div>
            <div class="upload-box">
              <label>Signed Liability Waiver (PDF/JPG/PNG)</label>
              <input 
                type="file" 
                @change="e => handleFileUpload(e, 'waiver')" 
                accept=".pdf,.jpg,.png"
                required
              />
              <span class="file-name" v-if="form.waiver">{{ form.waiver }}</span>
              <span v-if="formErrors.waiver" class="error-message">{{ formErrors.waiver }}</span>
            </div>
          </div>
        </div>

        <!-- SPECIAL REQUIREMENTS -->
        <div class="form-section">
          <h3><i class="fa-solid fa-comment-medical"></i> Special Requirements</h3>
          <div class="input-group full-width">
            <textarea 
              v-model="form.specialRequirements"
              placeholder="Any medical conditions, dietary restrictions, or special requests..."
              rows="4"
            ></textarea>
          </div>
        </div>

        <!-- PRICE SUMMARY -->
        <div class="price-summary" v-if="totalPrice > 0">
          <div class="summary-item">
            <span>Accommodation:</span>
            <span class="price">{{ form.selectedAccommodation ? availableAccommodations.find(a => a.id === form.selectedAccommodation)?.name : 'Not selected' }}</span>
          </div>
          <div class="summary-item">
            <span>Nights:</span>
            <span class="price">{{ Math.max(1, Math.ceil((new Date(form.endDate) - new Date(form.startDate)) / (1000 * 60 * 60 * 24))) }} nights</span>
          </div>
          <div class="summary-item total">
            <span>Total:</span>
            <span class="price">₱{{ totalPrice.toFixed(2) }}</span>
          </div>
        </div>

        <!-- SUBMIT BUTTON -->
        <div class="form-actions">
          <button type="submit" class="submit-btn" :disabled="isSubmitting">
            <span v-if="!isSubmitting">Submit Permit Application</span>
            <span v-else><i class="fa-solid fa-spinner fa-spin"></i> Processing...</span>
          </button>
        </div>

      </form>
    </div>

  </div>
</template>

<style scoped>
.booking-matrix {
  font-family: 'Outfit', sans-serif;
  color: #f8fafc;
  min-height: 100vh;
  overflow-x: hidden;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.booking-matrix::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url('/images/cover-tourism-img.jpg');
  background-size: cover;
  background-position: center;
  filter: blur(20px) brightness(0.4);
  transform: scale(1.1);
  z-index: -1;
  pointer-events: none;
}

.booking-header {
  text-align: center;
  margin-bottom: 40px;
  max-width: 800px;
}

.booking-header h1 {
  font-size: 2.5rem;
  color: #f8fafc;
  margin: 0 0 10px 0;
  font-weight: 800;
}

.booking-header p {
  color: #e2e8f0;
  font-size: 1.1rem;
  margin: 0;
}

.form-container, .success-state {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  width: 100%;
  max-width: 800px;
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  padding: 40px;
  border-top: 5px solid #d97706;
}

.success-state {
  text-align: center;
  padding: 60px 40px;
}

.success-icon {
  margin-bottom: 20px;
}

.success-icon i {
  font-size: 4rem;
  color: #16a34a;
}

.success-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: 30px;
}

.reset-btn {
  background: #1e3a8a;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.view-status-btn {
  background: #16a34a;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.form-section {
  margin-bottom: 40px;
}

.form-section h3 {
  font-size: 1.2rem;
  color: #f8fafc;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 10px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.form-section h3 i {
  color: #d97706;
}

.section-desc {
  font-size: 0.9rem;
  color: #e2e8f0;
  margin-top: -10px;
  margin-bottom: 15px;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group.full-width {
  grid-column: 1 / -1;
}

.input-group label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #e2e8f0;
}

.input-group input, .input-group textarea {
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
  background: rgba(255, 255, 255, 0.1);
  color: #f8fafc;
}

.input-group input:focus, .input-group textarea:focus {
  border-color: #3b82f6;
}

.input-group textarea {
  resize: vertical;
  min-height: 100px;
}

.input-group small {
  font-size: 0.8rem;
  color: #94a3b8;
}

.error-message {
  color: #dc2626;
  font-size: 0.8rem;
  margin-top: 5px;
  display: block;
}

/* ACCOMMODATION CARDS */
.accommodation-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-top: 20px;
}

.accommodation-card {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  padding: 15px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(255, 255, 255, 0.1);
}

.accommodation-card:hover {
  border-color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.15);
}

.accommodation-card.selected {
  border-color: #1e3a8a;
  background: rgba(30, 58, 138, 0.2);
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
}

.unit-name {
  font-weight: 700;
  color: #f8fafc;
}

.unit-type {
  font-size: 0.85rem;
  color: #e2e8f0;
}

.unit-price {
  font-weight: 700;
  color: #16a34a;
}

/* UPLOADS */
.upload-box {
  border: 2px dashed rgba(255, 255, 255, 0.3);
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  position: relative;
}

.upload-box label {
  font-weight: 600;
  color: #e2e8f0;
}

.file-name {
  font-size: 0.85rem;
  color: #16a34a;
  font-weight: 600;
}

/* PRICE SUMMARY */
.price-summary {
  background: rgba(255, 255, 255, 0.05);
  padding: 20px;
  border-radius: 8px;
  margin: 20px 0;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.summary-item.total {
  font-weight: 700;
  font-size: 1.1rem;
  color: #1e3a8a;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  padding-top: 10px;
  margin-top: 10px;
}

.price {
  color: #16a34a;
}

/* SUBMIT */
.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 30px;
}

.submit-btn {
  background: #1e3a8a;
  color: white;
  border: none;
  padding: 15px 30px;
  font-size: 1.1rem;
  font-weight: 700;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background: #152c6b;
}

.submit-btn:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .grid-2, .accommodation-grid {
    grid-template-columns: 1fr;
  }
  
  .booking-header h1 {
    font-size: 2rem;
  }
  
  .form-container, .success-state {
    padding: 20px;
  }
}
</style>