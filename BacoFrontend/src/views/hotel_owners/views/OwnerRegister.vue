<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const API = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';

const step = ref(1);
const loading = ref(false);
const error = ref('');
const submitted = ref(false);
const showPassword = ref(false);

const form = ref({
  firstName: '', middleName: '', lastName: '',
  email: '', contactNumber: '',
  password: '', confirmPassword: '',
  businessName: '', barangay: '', businessAddress: '', businessType: '',
  businessPermitNo: '', businessContact: '', businessEmail: '',
  disclaimer: false
});

const validIdFile = ref(null);
const businessPermitFile = ref(null);
const ownershipProofFile = ref(null);
const fileError = ref('');

const otp = ref('');
const otpSent = ref(false);
const resendIn = ref(0);
let resendTimer = null;

const barangays = ref([]);
const BUSINESS_TYPES = ['Hotel', 'Resort', 'Inn', 'Hostel', 'Guest House', 'Homestay', 'Transient House', 'Other'];

const steps = [
  { n: 1, label: 'Personal Info' },
  { n: 2, label: 'Resort Details' },
  { n: 3, label: 'Verification' }
];

// ── Helpers ──
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const setError = (msg) => { error.value = msg; return false; };

const formatSize = (bytes) => {
  if (bytes > 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
  if (bytes > 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
};

const onFilePick = (e, target, label) => {
  fileError.value = '';
  const file = e.target.files[0];
  if (!file) { target.value = null; return; }
  const okTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  if (!okTypes.includes(file.type)) {
    e.target.value = '';
    fileError.value = `${label}: only PDF, JPG, or PNG files are allowed.`;
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    e.target.value = '';
    fileError.value = `${label}: maximum file size is 5MB.`;
    return;
  }
  target.value = file;
};

const handleValidId = (e) => onFilePick(e, validIdFile, 'Valid ID');
const handleBusinessPermit = (e) => onFilePick(e, businessPermitFile, 'Business Permit');
const handleOwnershipProof = (e) => onFilePick(e, ownershipProofFile, 'Ownership Proof');

// ── Step Validation ──
const validateStep1 = () => {
  const f = form.value;
  if (!f.firstName.trim() || !f.lastName.trim()) return setError('First name and last name are required.');
  if (!validEmail(f.email)) return setError('Please enter a valid email address.');
  if (!f.contactNumber.trim()) return setError('Contact number is required.');
  if (f.password.length < 6) return setError('Password must be at least 6 characters.');
  if (f.password !== f.confirmPassword) return setError('Passwords do not match.');
  if (!validIdFile.value) return setError('Please upload a valid government-issued ID.');
  if (!f.disclaimer) return setError('You must acknowledge the data privacy disclaimer to continue.');
  return true;
};

const validateStep2 = () => {
  const f = form.value;
  if (!f.businessName.trim()) return setError('Resort / business name is required.');
  if (!f.barangay) return setError('Please select the barangay where your property is located.');
  if (!businessPermitFile.value) return setError("Please upload your Business Permit or Mayor's Permit.");
  if (f.businessEmail.trim() && !validEmail(f.businessEmail.trim())) {
    return setError('Business email format is invalid — enter a valid email or leave it blank.');
  }
  return true;
};

// ── Navigation ──
const goNext = () => {
  error.value = '';
  if (step.value === 1 && validateStep1()) step.value = 2;
  else if (step.value === 2 && validateStep2()) goToStep3();
};

const goBack = () => { error.value = ''; step.value--; };

// ── OTP ──
const startResend = () => {
  resendIn.value = 60;
  clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    resendIn.value--;
    if (resendIn.value <= 0) clearInterval(resendTimer);
  }, 1000);
};

const sendOtp = async () => {
  error.value = '';
  loading.value = true;
  try {
    const r = await fetch(`${API}/owner/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.value.email.trim() })
    });
    const d = await r.json();
    if (!r.ok) { error.value = d.message || 'Failed to send verification code.'; return; }
    otpSent.value = true;
    startResend();
  } catch {
    error.value = 'Network error. Please check your connection and try again.';
  } finally {
    loading.value = false;
  }
};

const goToStep3 = async () => {
  step.value = 3;
  await sendOtp();
};

// ── Submit ──
const submitRegistration = async () => {
  error.value = '';
  if (!/^\d{6}$/.test(otp.value.trim())) {
    error.value = 'Enter the 6-digit verification code sent to your email.';
    return;
  }
  loading.value = true;
  try {
    const f = form.value;
    const fd = new FormData();
    fd.append('firstName', f.firstName.trim());
    fd.append('middleName', f.middleName.trim());
    fd.append('lastName', f.lastName.trim());
    fd.append('email', f.email.trim());
    fd.append('contactNumber', f.contactNumber.trim());
    fd.append('password', f.password);
    fd.append('businessName', f.businessName.trim());
    fd.append('barangay', f.barangay);
    fd.append('businessAddress', f.businessAddress.trim());
    fd.append('businessType', f.businessType);
    fd.append('businessPermitNo', f.businessPermitNo.trim());
    fd.append('businessContact', f.businessContact.trim());
    fd.append('businessEmail', f.businessEmail.trim());
    fd.append('otp', otp.value.trim());
    fd.append('validId', validIdFile.value);
    fd.append('businessPermit', businessPermitFile.value);
    if (ownershipProofFile.value) fd.append('ownershipProof', ownershipProofFile.value);

    const r = await fetch(`${API}/owner/auth/register`, { method: 'POST', body: fd });
    const d = await r.json();
    if (r.ok) {
      submitted.value = true;
    } else {
      error.value = d.message || 'Registration failed.';
    }
  } catch {
    error.value = 'Submission failed. Please check your connection and try again.';
  } finally {
    loading.value = false;
  }
};

const goLogin = () => { window.location.href = '/owner/login'; };

onMounted(async () => {
  try {
    const r = await fetch(`${API}/barangays`);
    if (r.ok) barangays.value = await r.json();
  } catch (e) { console.error('Failed to load barangays:', e); }
});

onBeforeUnmount(() => clearInterval(resendTimer));
</script>

<template>
  <div class="register-page">
    <div class="register-bg"></div>
    <div class="register-container">
      <div class="register-header">
        <div class="brand">
          <div class="brand-icon"><i class="fas fa-hotel"></i></div>
          <div>
            <h1>TURISMO</h1>
            <p class="subtitle">Hotel Owner Registration</p>
          </div>
        </div>
        <p class="back-link"><a href="/owner/login">← Back to Login</a></p>
      </div>

      <div class="register-card">
        <!-- ══════════ SUCCESS SCREEN ══════════ -->
        <div v-if="submitted" class="success-panel">
          <div class="success-icon"><i class="fas fa-check"></i></div>
          <h2>Application Submitted!</h2>
          <p class="success-sub">
            Thank you, {{ form.firstName }}. Your registration is now
            <strong>pending review</strong> by the LGU Baco Tourism Office.
          </p>
          <div class="success-steps">
            <div><i class="fas fa-envelope"></i><span>Confirmation sent to <strong>{{ form.email }}</strong></span></div>
            <div><i class="fas fa-search"></i><span>We'll verify your identity and business documents</span></div>
            <div><i class="fas fa-envelope-open-text"></i><span>You'll receive an email once approved</span></div>
          </div>
          <button class="btn-register" @click="goLogin">Go to Login</button>
        </div>

        <!-- ══════════ REGISTRATION WIZARD ══════════ -->
        <template v-else>
          <h2>Create Your Account</h2>
          <p class="desc">Register as a hotel owner in Baco, Oriental Mindoro</p>

          <!-- Steps Header -->
          <div class="steps-header">
            <template v-for="(s, i) in steps" :key="s.n">
              <div class="step-item" :class="{ active: step === s.n, done: step > s.n }">
                <div class="step-circle">
                  <i v-if="step > s.n" class="fas fa-check"></i>
                  <span v-else>{{ s.n }}</span>
                </div>
                <span class="step-label">{{ s.label }}</span>
              </div>
              <div v-if="i < steps.length - 1" class="step-connector" :class="{ filled: step > s.n }"></div>
            </template>
          </div>

          <!-- Error Boxes -->
          <div v-if="error" class="error-box">
            <i class="fas fa-exclamation-circle"></i> {{ error }}
          </div>
          <div v-if="fileError" class="error-box">
            <i class="fas fa-exclamation-circle"></i> {{ fileError }}
          </div>

          <!-- ✅ novalidate: disables native HTML5 validation so hidden
               step controls can't trigger "not focusable" errors.
               All validation is handled by our JS step validators. -->
          <form @submit.prevent="submitRegistration" novalidate>

            <!-- ══════════ STEP 1: PERSONAL INFORMATION ══════════ -->
            <div v-show="step === 1">
              <div class="section-title">Owner Personal Information</div>
              <div class="form-row cols-3">
                <div class="form-group">
                  <label>First Name *</label>
                  <input v-model="form.firstName" type="text" />
                </div>
                <div class="form-group">
                  <label>Middle Name <span class="hint">optional</span></label>
                  <input v-model="form.middleName" type="text" />
                </div>
                <div class="form-group">
                  <label>Last Name *</label>
                  <input v-model="form.lastName" type="text" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Email Address *</label>
                  <input v-model="form.email" type="email" />
                </div>
                <div class="form-group">
                  <label>Contact Number * <span class="hint">09XXXXXXXXX</span></label>
                  <input v-model="form.contactNumber" type="tel" />
                </div>
              </div>

              <div class="section-title">Security</div>
              <div class="form-row">
                <div class="form-group">
                  <label>Password * <span class="hint">min. 6 characters</span></label>
                  <div class="input-wrap">
                    <input v-model="form.password" :type="showPassword ? 'text' : 'password'" />
                    <button type="button" class="toggle-pwd" @click="showPassword = !showPassword">
                      <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
                    </button>
                  </div>
                </div>
                <div class="form-group">
                  <label>Confirm Password *</label>
                  <div class="input-wrap">
                    <input v-model="form.confirmPassword" :type="showPassword ? 'text' : 'password'" />
                    <button type="button" class="toggle-pwd" @click="showPassword = !showPassword">
                      <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
                    </button>
                  </div>
                </div>
              </div>

              <div class="section-title">Proof of Identity</div>
              <div class="form-group full">
                <label>Valid Government ID (PDF, JPG, PNG · Max 5MB) *</label>
                <div class="file-upload compact" :class="{ 'has-file': validIdFile }">
                  <i :class="validIdFile ? 'fas fa-file-check' : 'fas fa-cloud-upload-alt'"></i>
                  <div class="fu-text">
                    <p v-if="!validIdFile">Drag & drop or <span>browse files</span></p>
                    <p v-else class="file-name">{{ validIdFile.name }} <small>({{ formatSize(validIdFile.size) }})</small></p>
                    <p class="fu-hint" v-if="validIdFile">Click to replace</p>
                    <p class="fu-hint" v-else>Driver's License, PhilID, Passport, UMID</p>
                  </div>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" @change="handleValidId" />
                </div>
              </div>

              <div class="disclaimer-box">
                <label class="disclaimer">
                  <input type="checkbox" v-model="form.disclaimer" />
                  <span>
                    <strong>Data Privacy Notice:</strong> All information and documents you provide will be used
                    <em>solely for identity and business verification within the LGU Baco tourism system</em>,
                    handled in accordance with the Data Privacy Act of 2012 (RA 10173). Accessible only to
                    authorized LGU personnel.
                  </span>
                </label>
              </div>

              <button type="button" class="btn-register" @click="goNext">
                <span>Continue to Resort Details</span> <i class="fas fa-arrow-right"></i>
              </button>
            </div>

            <!-- ══════════ STEP 2: RESORT / BUSINESS INFORMATION ══════════ -->
            <div v-show="step === 2">
              <div class="section-title">Resort / Business Information</div>
              <div class="form-group full">
                <label>Resort / Business Name *</label>
                <input v-model="form.businessName" type="text" />
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Barangay *</label>
                  <select v-model="form.barangay">
                    <option value="" disabled>Select barangay...</option>
                    <option v-for="b in barangays" :key="b.id" :value="b.name">{{ b.name }}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label>Accommodation Type</label>
                  <select v-model="form.businessType">
                    <option value="" disabled>Select type...</option>
                    <option v-for="t in BUSINESS_TYPES" :key="t" :value="t">{{ t }}</option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Complete Address <span class="hint">street / sitio</span></label>
                  <input v-model="form.businessAddress" type="text" />
                </div>
                <div class="form-group">
                  <label>Business Permit No. <span class="hint">if already registered</span></label>
                  <input v-model="form.businessPermitNo" type="text" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label>Business Contact No. <span class="hint">guest-facing number</span></label>
                  <input v-model="form.businessContact" type="tel" />
                </div>
                <div class="form-group">
                  <label>Business Email <span class="hint">optional</span></label>
                  <input v-model="form.businessEmail" type="email" />
                </div>
              </div>

              <div class="section-title">Ownership Verification</div>
              <div class="form-group full">
                <label>Business / Mayor's Permit (PDF, JPG, PNG · Max 5MB) *</label>
                <div class="file-upload compact" :class="{ 'has-file': businessPermitFile }">
                  <i :class="businessPermitFile ? 'fas fa-file-check' : 'fas fa-cloud-upload-alt'"></i>
                  <div class="fu-text">
                    <p v-if="!businessPermitFile">Drag & drop or <span>browse files</span></p>
                    <p v-else class="file-name">{{ businessPermitFile.name }} <small>({{ formatSize(businessPermitFile.size) }})</small></p>
                    <p class="fu-hint" v-if="businessPermitFile">Click to replace</p>
                    <p class="fu-hint" v-else>Required for ownership verification</p>
                  </div>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" @change="handleBusinessPermit" />
                </div>
              </div>

              <div class="form-group full">
                <label>Proof of Ownership (Optional)</label>
                <div class="file-upload compact" :class="{ 'has-file': ownershipProofFile }">
                  <i :class="ownershipProofFile ? 'fas fa-file-check' : 'fas fa-cloud-upload-alt'"></i>
                  <div class="fu-text">
                    <p v-if="!ownershipProofFile">Drag & drop or <span>browse files</span></p>
                    <p v-else class="file-name">{{ ownershipProofFile.name }} <small>({{ formatSize(ownershipProofFile.size) }})</small></p>
                    <p class="fu-hint" v-if="ownershipProofFile">Click to replace</p>
                    <p class="fu-hint" v-else>Land Title, Tax Declaration, DTI/SEC, or Lease Contract</p>
                  </div>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" @change="handleOwnershipProof" />
                </div>
              </div>

              <div class="btn-row">
                <button type="button" class="btn-back" @click="goBack">
                  <i class="fas fa-arrow-left"></i> <span>Back</span>
                </button>
                <button type="button" class="btn-register" :disabled="loading" @click="goNext">
                  <span>Continue to Verification</span> <i class="fas fa-arrow-right"></i>
                </button>
              </div>
            </div>

            <!-- ══════════ STEP 3: EMAIL VERIFICATION ══════════ -->
            <div v-show="step === 3">
              <div class="section-title">Email Verification</div>
              <div class="otp-info-box">
                <i class="fas fa-envelope-open-text"></i>
                <div>
                  <p>We sent a 6-digit code to</p>
                  <strong>{{ form.email }}</strong>
                  <p class="otp-expire">Expires in 5 minutes. Check spam folder if missing.</p>
                </div>
              </div>

              <div class="form-group full">
                <label>Verification Code *</label>
                <input
                  v-model="otp"
                  class="otp-input"
                  type="text"
                  inputmode="numeric"
                  maxlength="6"
                  @input="otp = otp.replace(/\D/g, '').slice(0, 6)"
                />
              </div>

              <p class="resend-line">
                <template v-if="resendIn > 0">Resend code in <strong>{{ resendIn }}s</strong></template>
                <template v-else>
                  Didn't receive the code?
                  <button type="button" class="resend-btn" :disabled="loading" @click="sendOtp">Resend Code</button>
                </template>
              </p>

              <div class="btn-row">
                <button type="button" class="btn-back" @click="goBack">
                  <i class="fas fa-arrow-left"></i> <span>Back</span>
                </button>
                <button type="submit" class="btn-register" :disabled="loading">
                  <i v-if="loading" class="fas fa-spinner fa-spin"></i>
                  <template v-else><i class="fas fa-shield-halved"></i> <span>Submit Registration</span></template>
                </button>
              </div>
            </div>
          </form>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; }

/* ══════════════════════════════════════════════════
   LIGHT THEME TOKENS — matches DashboardOverview.vue
   ══════════════════════════════════════════════════ */
.register-page {
  --bg: #F6F7FB;
  --bg2: #F1F3F8;
  --card: #FFFFFF;
  --card2: #FAFBFD;
  --bdr: #E4E7EF;
  --fg: #14161F;
  --fg2: #3A3F4E;
  --mt: #8A90A3;
  --ac: #F20707;
  --acg: rgba(255, 61, 0, .28);
  --acs: rgba(255, 61, 0, .07);
  --tl: #07DBF2;
  --tlt: rgba(0, 151, 178, .07);
  --tlb: rgba(0, 151, 178, .30);
  --ok: #B0D91E;
  --okt: rgba(0, 168, 68, .08);
  --danger: #C70505;

  color-scheme: light;
  min-height: 100vh;
  background: var(--bg);
  padding: 20px 16px;
  position: relative;
  font-family: 'Inter', system-ui, sans-serif;
}

.register-bg {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse 800px 600px at 10% 0%, rgba(255,61,0,.06) 0%, transparent 60%),
    radial-gradient(ellipse 700px 700px at 90% 90%, rgba(0,151,178,.05) 0%, transparent 60%);
  pointer-events: none;
}

.register-container {
  position: relative;
  z-index: 1;
  max-width: 760px;   /* ← was 900px — tighter form width */
  margin: 0 auto;
}

.register-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.brand { display: flex; align-items: center; gap: 10px; }

.brand-icon {
  width: 40px; height: 40px; border-radius: 10px;
  background: var(--eco-mint);
  display: flex; align-items: center; justify-content: center;
  font-size: 17px; color: var(--bb-on-highlight);
  box-shadow: 0 6px 18px var(--acg);
}

.brand h1 {
  font-family: 'Unbounded', sans-serif;
  font-size: 19px; font-weight: 800; color: var(--fg); margin: 0;
  letter-spacing: -0.03em;
}

.subtitle {
  color: var(--mt); font-size: 9px; font-weight: 700;
  letter-spacing: 1.5px; text-transform: uppercase; margin: 1px 0 0;
}

.back-link a { color: var(--ac); text-decoration: none; font-size: 12px; font-weight: 700; }
.back-link a:hover { text-decoration: underline; }

.register-card {
  background: var(--card);
  border: 1px solid var(--bdr);
  border-radius: 16px;
  padding: 26px 28px;   /* ← was 40px */
  box-shadow: 0 8px 32px rgba(20, 22, 31, .05);
}

.register-card h2 {
  font-family: 'Unbounded', sans-serif;
  font-size: 19px; font-weight: 800; color: var(--fg); margin: 0 0 4px;  /* ← was 26px */
  letter-spacing: -0.03em;
}

.desc { color: var(--mt); font-size: 12px; margin: 0 0 14px; }  /* ← was 28px margin */

/* ═══ STEPS HEADER (compact) ═══ */
.steps-header {
  display: flex; align-items: center;
  margin-bottom: 14px; gap: 6px;
}
.step-item { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 64px; }
.step-circle {
  width: 30px; height: 30px; border-radius: 50%;   /* ← was 38px */
  border: 2px solid var(--bdr); background: var(--bg2);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: var(--mt);
  transition: all .3s;
}
.step-item.active .step-circle {
  border-color: var(--ac); color: var(--ac); background: var(--card);
  box-shadow: 0 0 0 3px var(--acs);
}
.step-item.done .step-circle {
  border-color: var(--tl); background: var(--tlt); color: var(--tl);
}
.step-label {
  font-size: 8.5px; font-weight: 700; letter-spacing: .8px;
  text-transform: uppercase; color: var(--mt);
}
.step-item.active .step-label { color: var(--ac); }
.step-item.done .step-label { color: var(--tl); }
.step-connector {
  flex: 1; height: 2px; background: var(--bdr);
  margin-bottom: 16px; border-radius: 1px; transition: background .3s;
}
.step-connector.filled { background: var(--tlb); }

/* ═══ ERROR BOX ═══ */
.error-box {
  display: flex; align-items: center; gap: 8px;
  background: rgba(198, 40, 40, .06);
  border: 1px solid rgba(198, 40, 40, .25);
  color: var(--danger); font-size: 12px; font-weight: 600;
  padding: 9px 12px; border-radius: 9px; margin-bottom: 12px;
}

/* ═══ SECTIONS & GRID (compact rhythm) ═══ */
.section-title {
  font-family: 'Unbounded', sans-serif;
  font-size: 10px; font-weight: 700; color: var(--ac);
  text-transform: uppercase; letter-spacing: 1.2px;
  margin: 14px 0 10px;    /* ← was 24px 0 14px */
  padding-bottom: 5px;
  border-bottom: 1px solid var(--bdr);
}
.section-title:first-of-type { margin-top: 4px; }

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;              /* ← was 14px */
  margin-bottom: 10px;    /* ← was 14px */
}
.form-row.cols-3 { grid-template-columns: repeat(3, 1fr); }

.form-group { margin-bottom: 10px; }   /* ← was 14px */
.form-group.full { grid-column: 1 / -1; }

.form-group label {
  display: block; color: var(--fg2); font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px;
}

.form-group input, .form-group select {
  width: 100%; padding: 9px 12px;   /* ← was 11px 14px */
  background: var(--card); border: 1px solid var(--bdr); border-radius: 9px;
  color: var(--fg); font-size: 12.5px; transition: all .3s; outline: none;
  font-family: inherit;
}
.form-group input::placeholder { color: #B4B9C8; }
.form-group select { cursor: pointer; }
.form-group select option { background: var(--card); color: var(--fg); }
.form-group input:focus, .form-group select:focus {
  border-color: var(--ac);
  box-shadow: 0 0 0 3px var(--acs);
}

.input-wrap { position: relative; }
.input-wrap input { padding-right: 36px; }

.toggle-pwd {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  background: none; border: none; color: var(--mt); cursor: pointer;
  padding: 0;
}
.toggle-pwd:hover { color: var(--ac); }

.fu-hint { color: var(--mt); font-size: 10px; margin: 2px 0 0; }

/* ═══ FILE UPLOAD (horizontal + compact) ═══ */
.file-upload {
  border: 2px dashed var(--bdr); border-radius: 10px;
  padding: 14px 16px;      /* ← was 28px centered */
  cursor: pointer;
  transition: all .3s; position: relative;
  background: var(--card2);
  display: flex; align-items: center; gap: 12px;
}
.file-upload:hover { border-color: var(--ac); background: var(--acs); }
.file-upload.has-file { border-color: var(--tlb); background: var(--tlt); }
.file-upload i { font-size: 20px; color: var(--mt); flex-shrink: 0; }   /* ← was 28px */
.file-upload.has-file i { color: var(--tl); }
.file-upload .fu-text { min-width: 0; }
.file-upload p { color: var(--mt); font-size: 11.5px; margin: 0; }
.file-upload p span { color: var(--ac); font-weight: 700; }
.file-upload .file-name {
  color: var(--fg); font-weight: 600; word-break: break-all;
}
.file-upload .file-name small { color: var(--mt); font-weight: 400; }
.file-upload input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

/* ═══ DISCLAIMER (compact) ═══ */
.disclaimer-box {
  background: var(--tlt);
  border: 1px solid var(--tlb);
  border-radius: 10px; padding: 10px 12px;   /* ← was 16px, margin 20px */
  margin: 12px 0;
}
.disclaimer { display: flex; gap: 10px; cursor: pointer; align-items: flex-start; }
.disclaimer input {
  margin-top: 2px; accent-color: var(--tl);
  width: 15px; height: 15px; flex-shrink: 0; cursor: pointer;
}
.disclaimer span { color: var(--fg2); font-size: 10.5px; line-height: 1.55; }
.disclaimer strong { color: var(--tl); }

/* ═══ OTP (compact) ═══ */
.otp-info-box {
  display: flex; gap: 12px; align-items: flex-start;
  background: var(--tlt);
  border: 1px solid var(--tlb);
  border-radius: 10px; padding: 12px 14px;   /* ← was 18px, margin 22px */
  margin-bottom: 12px;
}
.otp-info-box i { font-size: 18px; color: var(--tl); margin-top: 1px; }
.otp-info-box p { color: var(--mt); font-size: 11.5px; margin: 0; }
.otp-info-box strong { color: var(--fg); font-size: 13.5px; display: block; margin: 1px 0; }
.otp-expire { margin-top: 2px !important; font-size: 10.5px !important; }

.otp-input {
  text-align: center !important;
  font-size: 20px !important;             /* ← was 26px */
  font-weight: 700 !important;
  letter-spacing: 12px !important;        /* ← was 16px */
  font-family: 'Courier New', monospace !important;
  max-width: 260px;
  margin: 0 auto;
  display: block;
}

.resend-line { color: var(--mt); font-size: 11.5px; text-align: center; margin: 2px 0 0; }
.resend-line strong { color: var(--fg); }
.resend-btn {
  background: none; border: none; color: var(--ac);
  font-size: 11.5px; font-weight: 700; cursor: pointer;
  text-decoration: underline; font-family: inherit;
}

/* ═══ BUTTONS (compact) ═══ */
.btn-row { display: flex; gap: 10px; margin-top: 14px; }
.btn-row .btn-register { margin-top: 0; flex: 1; }

.btn-register {
  width: 100%; padding: 11px;   /* ← was 14px, margin 20px */
  background: var(--eco-mint);
  color: var(--bb-on-highlight); border: none; border-radius: 10px;
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .5px; cursor: pointer; margin-top: 14px;
  transition: all .3s;
  box-shadow: 0 6px 18px var(--acg);
  display: flex; align-items: center; justify-content: center; gap: 8px;
  font-family: inherit;
}
.btn-register:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 28px var(--acg); }
.btn-register:disabled { opacity: .7; cursor: not-allowed; }

.btn-back {
  padding: 11px 18px;
  background: var(--card); border: 1px solid var(--bdr);
  color: var(--mt); border-radius: 10px;
  font-size: 12px; font-weight: 700; cursor: pointer;
  transition: all .3s;
  display: flex; align-items: center; gap: 7px;
  font-family: inherit;
}
.btn-back:hover { border-color: var(--mt); color: var(--fg); }

/* ═══ SUCCESS PANEL (compact) ═══ */
.success-panel { text-align: center; padding: 12px 0; }
.success-icon {
  width: 64px; height: 64px; border-radius: 50%;   /* ← was 80px */
  background: var(--okt); border: 2px solid var(--ok);
  display: flex; align-items: center; justify-content: center;
  font-size: 26px; color: var(--ok); margin: 0 auto 16px;
  box-shadow: 0 0 32px rgba(0, 168, 68, .15);
}
.success-panel h2 { margin-bottom: 6px; }
.success-sub { color: var(--mt); font-size: 13px; margin: 0 auto 18px; max-width: 420px; line-height: 1.6; }
.success-sub strong { color: var(--ok); }

.success-steps {
  text-align: left; max-width: 420px; margin: 0 auto 18px;
  display: flex; flex-direction: column; gap: 8px;   /* ← was 12px */
}
.success-steps div {
  display: flex; align-items: center; gap: 10px;
  background: var(--bg2); border: 1px solid var(--bdr);
  border-radius: 9px; padding: 10px 14px;
  color: var(--fg2); font-size: 12px;
}
.success-steps i { color: var(--ac); width: 16px; text-align: center; }
.success-steps strong { color: var(--fg); }

@media (max-width: 640px) {
  .register-card { padding: 20px 16px; }
  .form-row, .form-row.cols-3 { grid-template-columns: 1fr; }
  .step-label { display: none; }
  .otp-input { letter-spacing: 8px !important; }
}
</style>