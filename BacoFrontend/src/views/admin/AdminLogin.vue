<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Mail, Lock, User, ArrowRight, Shield, Upload, Eye, EyeOff, CheckCircle2, FileText, Building2, ChevronRight } from 'lucide-vue-next'

const router = useRouter()

// â”€â”€ State â”€â”€
const activeTab = ref('login')
const regStep = ref(1)
const isProcessing = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// â”€â”€ Login â”€â”€
const loginForm = ref({ email: '', password: '' })
const showLoginPw = ref(false)

// â”€â”€ Register â”€â”€
const registerForm = ref({
  firstName: '', middleName: '', lastName: '',
  email: '', password: '', confirmPassword: '',
  department: '', position: '', employeeId: '',
  contactNumber: '', role: ''
})
const showRegPw = ref(false)
const showRegConfirmPw = ref(false)
const validIdFile = ref(null)
const validIdPreview = ref(null)

// â”€â”€ OTP State â”€â”€
const otpDigits = ref(['', '', '', '', '', ''])
const otpInputRefs = ref([])
const otpVerified = ref(false)
const otpCooldown = ref(0)
let otpTimer = null

const ADMIN_ROLES = [
  { value: 'main_controller', label: 'Super Admin', desc: 'Full system access and oversight.' },
  { value: 'tourism_admin', label: 'Tourism Officer', desc: 'Manage destinations and resorts.' },
  { value: 'mho_admin', label: 'MHO Officer', desc: 'Manage health services and records.' },
  { value: 'bplo_admin', label: 'BPLO Officer', desc: 'Business permits and licensing.' },
  { value: 'mdrrmo_admin', label: 'MDRRMO', desc: 'Disaster risk reduction management.' }
]

// â”€â”€ Tab Switch â”€â”€
const switchTab = (tab) => {
  activeTab.value = tab
  errorMessage.value = ''
  successMessage.value = ''
  if (tab === 'signup') {
    regStep.value = 1
    resetRegForm()
  }
}

const resetRegForm = () => {
  registerForm.value = {
    firstName: '', middleName: '', lastName: '', email: '',
    password: '', confirmPassword: '', department: '', position: '',
    employeeId: '', contactNumber: '', role: ''
  }
  validIdFile.value = null
  validIdPreview.value = null
  otpVerified.value = false
  otpDigits.value = ['', '', '', '', '', '']
}

// â”€â”€ Valid ID Upload â”€â”€
const handleIdUpload = (event) => {
  const file = event.target.files[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    errorMessage.value = 'File size must be less than 5MB.'
    return
  }
  validIdFile.value = file
  const reader = new FileReader()
  reader.onload = (e) => { validIdPreview.value = e.target.result }
  reader.readAsDataURL(file)
}

// â”€â”€ OTP Logic â”€â”€
const handleOtpInput = (index, event) => {
  const val = event.target.value.replace(/[^0-9]/g, '')
  otpDigits.value[index] = val
  if (val && index < 5) otpInputRefs.value[index + 1]?.focus()
  if (otpDigits.value.every(d => d !== '')) verifyOtp()
}

const handleOtpKeydown = (index, event) => {
  if (event.key === 'Backspace' && !otpDigits.value[index] && index > 0) {
    otpInputRefs.value[index - 1]?.focus()
  }
}

const handleOtpPaste = (e) => {
  e.preventDefault()
  const p = (e.clipboardData.getData('text') || '').replace(/[^0-9]/g, '').slice(0, 6)
  for (let i = 0; i < p.length; i++) otpDigits.value[i] = p[i]
  otpInputRefs.value[Math.min(p.length, 5)]?.focus()
  if (p.length === 6) verifyOtp()
}

const startOtpCooldown = () => {
  if (otpTimer) clearInterval(otpTimer)
  otpCooldown.value = 60
  otpTimer = setInterval(() => {
    otpCooldown.value--
    if (otpCooldown.value <= 0) clearInterval(otpTimer)
  }, 1000)
}

const executeLogin = async () => {
  if (!loginForm.value.email || !loginForm.value.password) {
    errorMessage.value = 'Please enter your email and password.'
    return
  }
  isProcessing.value = true
  errorMessage.value = ''
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:3000/api'}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm.value)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Login failed')
    localStorage.setItem('baco_admin_token', data.token)
    localStorage.setItem('baco_admin_role', data.admin.role)            // â† was data.role
    localStorage.setItem('baco_admin_data', JSON.stringify(data.admin)) // â† was data.user
    // Officers with their own console land in it directly; everyone else (and
    // the super admin, who can reach both) goes to the main admin as before.
    const ROLE_CONSOLES = { mho_admin: '/mho-admin', tourism_admin: '/tourism-admin' }
    router.replace(ROLE_CONSOLES[data.admin.role] || '/admin')
  } catch (err) {
    errorMessage.value = err.message
  } finally {
    isProcessing.value = false
  }
}

const sendOtp = async () => {
  if (!registerForm.value.email) {
    errorMessage.value = 'Please enter your email address.'
    return
  }
  isProcessing.value = true
  errorMessage.value = ''
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:3000/api'}/admin/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: registerForm.value.email })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Failed to send OTP')
    successMessage.value = 'OTP sent to your email.'
    startOtpCooldown()
  } catch (err) {
    errorMessage.value = err.message
  } finally {
    isProcessing.value = false
  }
}

const verifyOtp = async () => {
  const code = otpDigits.value.join('')
  if (code.length !== 6) return
  isProcessing.value = true
  errorMessage.value = ''
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:3000/api'}/admin/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: registerForm.value.email, otp: code })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Invalid OTP')
    otpVerified.value = true
    successMessage.value = 'Email verified successfully.'
  } catch (err) {
    errorMessage.value = err.message
    otpDigits.value = ['', '', '', '', '', '']
  } finally {
    isProcessing.value = false
  }
}

const executeRegister = async () => {
  const f = registerForm.value
  if (!f.firstName || !f.lastName || !f.email || !f.password || !f.role) {
    errorMessage.value = 'Please fill in all required fields.'
    return
  }
  if (f.password !== f.confirmPassword) {
    errorMessage.value = 'Passwords do not match.'
    return
  }
  if (!validIdFile.value) {
    errorMessage.value = 'Please upload your Valid ID.'
    return
  }
  isProcessing.value = true
  errorMessage.value = ''
  try {
    const formData = new FormData()
    Object.keys(f).forEach(key => { if (f[key]) formData.append(key, f[key]) })
    formData.append('validId', validIdFile.value)
    
    const res = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:3000/api'}/admin/auth/register`, {
      method: 'POST',
      body: formData
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Registration failed')
    
    successMessage.value = 'Registration submitted! Awaiting Super Admin approval.'
    setTimeout(() => {
      switchTab('login')
      successMessage.value = ''
    }, 2500)
  } catch (err) {
    errorMessage.value = err.message
  } finally {
    isProcessing.value = false
  }
}

// This page mounts outside AdminLayout, so nothing has set the theme attribute
// for it. It holds its own copy and applies it on mount, otherwise a user who
// chose dark lands on a light login screen.
const theme = ref(localStorage.getItem('admin_theme') === 'light' ? 'light' : 'dark')
const loginPageRef = ref(null)

onMounted(() => {
  loginPageRef.value?.setAttribute('data-admin-theme', theme.value)
  if (localStorage.getItem('baco_admin_token')) router.replace('/admin')
})

onUnmounted(() => {
  if (otpTimer) clearInterval(otpTimer)
})
</script>

<template>
  <div class="login-page admin-login" ref="loginPageRef" :data-admin-theme="theme">
    <!-- Page background. Blurred, so the card is the subject and the photograph
         is context. It has to be a real element rather than a background-image
         on .admin-login: filter: blur() does not apply to a background layer. -->
    <div class="admin-bg" aria-hidden="true">
      <img class="admin-bg-photo" src="/images/hero-imgs.jpg" alt="" />
      <div class="admin-bg-scrim"></div>
    </div>

    <div class="auth-card">
      <!-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• -->
      <!-- BRAND PANEL (LEFT)                      -->
      <!-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• -->
      <div class="brand-panel">
        <div class="brand-content">
          <div class="brand-logo">
            <div class="logo-icon"><img src="/images/BACO-SEAL.png" alt="Baco Seal" /></div>
            <div class="logo-text">
              <span class="logo-title">Admin<span class="logo-dot">.</span></span>
              <span class="logo-sub">Municipality of Baco</span>
            </div>
          </div>

          <h2 class="brand-headline">Municipal Operations <br/><span>Command Center</span></h2>
          <p class="brand-desc">Manage tourism, health services, civil registry, and blockchain transparency securely.</p>

          <div class="brand-features">
            <div class="feature-card">
              <div class="fc-icon"><Shield size="16" /></div>
              <div class="fc-text">
                <strong>Role-Based Access</strong>
                <span>Strict permissions for LGU officers.</span>
              </div>
            </div>
            <div class="feature-card">
              <div class="fc-icon"><FileText size="16" /></div>
              <div class="fc-text">
                <strong>Audit Trails</strong>
                <span>Every content change is logged.</span>
              </div>
            </div>
            <div class="feature-card">
              <div class="fc-icon"><Building2 size="16" /></div>
              <div class="fc-text">
                <strong>TALA Blockchain</strong>
                <span>Tamper-proof public records.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• -->
      <!-- FORM PANEL (RIGHT)                      -->
      <!-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• -->
      <div class="form-panel">
        <!-- Tab Switcher -->
        <div class="tab-switcher">
          <div class="slider" :class="{ right: activeTab === 'signup' }"></div>
          <button class="tab-btn mat-skeuo-sm mat-pressable-sm" :class="{ active: activeTab === 'login' }" @click="switchTab('login')">Sign In</button>
          <button class="tab-btn mat-skeuo-sm mat-pressable-sm" :class="{ active: activeTab === 'signup' }" @click="switchTab('signup')">Register</button>
        </div>

        <!-- Messages -->
        <Transition name="fade">
          <div v-if="errorMessage" class="msg error-msg">
            <i class="fas fa-circle-exclamation"></i> {{ errorMessage }}
          </div>
        </Transition>
        <Transition name="fade">
          <div v-if="successMessage" class="msg success-msg">
            <i class="fas fa-circle-check"></i> {{ successMessage }}
          </div>
        </Transition>

        <!-- â•â•â• LOGIN FORM â•â•â• -->
        <div v-if="activeTab === 'login'" class="login-container">
          <h3 class="form-title">Welcome back</h3>
          <p class="form-sub">Enter your credentials to access the dashboard.</p>
          
          <form @submit.prevent="executeLogin" class="auth-form">
            <div class="form-group">
              <label>Email Address</label>
              <div class="input-wrap">
                <Mail size="16" class="input-icon" />
                <input v-model="loginForm.email" type="email" class="form-input" required />
              </div>
            </div>

            <div class="form-group">
              <label>Password</label>
              <div class="input-wrap">
                <Lock size="16" class="input-icon" />
                <input v-model="loginForm.password" :type="showLoginPw ? 'text' : 'password'" class="form-input" required />
                <button type="button" class="pw-toggle" @click="showLoginPw = !showLoginPw">
                  <EyeOff v-if="showLoginPw" size="14" />
                  <Eye v-else size="14" />
                </button>
              </div>
            </div>

            <button type="submit" class="primary-btn mat-skeuo-filled mat-pressable-filled" :disabled="isProcessing">
              <span v-if="!isProcessing">Sign In</span>
              <span v-else class="btn-loading mat-skeuo-sm mat-pressable-sm"><span class="dot-pulse"></span> Signing in...</span>
              <ArrowRight size="16" v-if="!isProcessing" />
            </button>
          </form>
        </div>

        <!-- â•â•â• REGISTER FORM â•â•â• -->
        <div v-if="activeTab === 'signup'" class="reg-container">
          <!-- Progress Steps -->
          <div class="progress-steps">
            <div :class="['progress-step', { active: regStep >= 1, done: regStep > 1 }]">
              <div class="step-circle">
                <CheckCircle2 v-if="regStep > 1" size="14" />
                <span v-else>1</span>
              </div>
              <span class="step-label">Verify Email</span>
            </div>
            <div class="progress-line" :class="{ filled: regStep > 1 }"></div>
            <div :class="['progress-step', { active: regStep >= 2 }]">
              <div class="step-circle">2</div>
              <span class="step-label">Details</span>
            </div>
          </div>

          <!-- Step 1: Verify Email -->
          <form v-if="regStep === 1" @submit.prevent="sendOtp" class="auth-form">
            <h3 class="form-title">Verify your email</h3>
            <p class="form-sub">We'll send a 6-digit code to your LGU email address.</p>
            
            <div class="form-group">
              <label>Work Email</label>
              <div class="input-wrap">
                <Mail size="16" class="input-icon" />
                <input v-model="registerForm.email" type="email" class="form-input" required />
              </div>
            </div>

            <div v-if="otpCooldown > 0 || otpVerified" class="otp-group">
              <label>Enter 6-digit Code</label>
              <div class="otp-inputs" @paste="handleOtpPaste">
                <input 
                  v-for="(_, i) in 6" :key="i"
                  :ref="el => { if (el) otpInputRefs[i] = el }"
                  type="text" inputmode="numeric" maxlength="1"
                  class="otp-box" :value="otpDigits[i]"
                  @input="handleOtpInput(i, $event)"
                  @keydown="handleOtpKeydown(i, $event)"
                  :disabled="isProcessing || otpVerified"
                  :class="{ filled: otpDigits[i], verified: otpVerified }"
                />
              </div>
              <p v-if="otpVerified" class="otp-success"><CheckCircle2 size="14" /> Email verified â€” you may proceed</p>
            </div>

            <button v-if="!otpVerified" type="submit" class="primary-btn mat-skeuo-filled mat-pressable-filled" :disabled="isProcessing || otpCooldown > 0">
              <span v-if="isProcessing" class="btn-loading mat-skeuo-sm mat-pressable-sm"><span class="dot-pulse"></span> Sending...</span>
              <span v-else-if="otpCooldown > 0">Resend in {{ otpCooldown }}s</span>
              <span v-else>Send OTP Code</span>
              <ArrowRight size="16" v-if="!isProcessing && otpCooldown === 0" />
            </button>

            <button v-if="otpVerified" type="button" class="primary-btn mat-skeuo-filled mat-pressable-filled" @click="regStep = 2">
              Continue to Form <ChevronRight size="16" />
            </button>
          </form>

          <!-- Step 2: Complete Registration -->
          <form v-if="regStep === 2" @submit.prevent="executeRegister" class="auth-form">
            <h3 class="form-title">Complete your profile</h3>
            <p class="form-sub">Provide your details to request admin access.</p>

            <div class="form-row">
              <div class="form-group">
                <label>First Name *</label>
                <input v-model="registerForm.firstName" type="text" class="form-input" required />
              </div>
              <div class="form-group">
                <label>Last Name *</label>
                <input v-model="registerForm.lastName" type="text" class="form-input" required />
              </div>
            </div>

            <div class="form-group">
              <label>Select Role *</label>
              <div class="role-grid">
                <div 
                  v-for="r in ADMIN_ROLES" :key="r.value" 
                  class="role-card" 
                  :class="{ selected: registerForm.role === r.value }"
                  @click="registerForm.role = r.value"
                >
                  <div class="rc-radio"><div class="rc-dot" v-if="registerForm.role === r.value"></div></div>
                  <div class="rc-info">
                    <strong>{{ r.label }}</strong>
                    <span>{{ r.desc }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Department</label>
                <input v-model="registerForm.department" type="text" class="form-input" />
              </div>
              <div class="form-group">
                <label>Position</label>
                <input v-model="registerForm.position" type="text" class="form-input" />
              </div>
            </div>

            <div class="form-group">
              <label>Upload Valid ID * <span class="hint">(Max 5MB)</span></label>
              <div class="file-upload-wrap" @click="$refs.idInput.click()">
                <input ref="idInput" type="file" accept="image/*,.pdf" class="hidden-file" @change="handleIdUpload" />
                <div v-if="!validIdPreview" class="file-placeholder">
                  <Upload size="20" />
                  <span>Click to upload ID</span>
                </div>
                <img v-else :src="validIdPreview" class="file-preview" alt="ID Preview" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Password *</label>
                <div class="input-wrap">
                  <Lock size="16" class="input-icon" />
                  <input v-model="registerForm.password" :type="showRegPw ? 'text' : 'password'" class="form-input" required />
                  <button type="button" class="pw-toggle" @click="showRegPw = !showRegPw">
                    <EyeOff v-if="showRegPw" size="14" /><Eye v-else size="14" />
                  </button>
                </div>
              </div>
              <div class="form-group">
                <label>Confirm Password *</label>
                <div class="input-wrap">
                  <Lock size="16" class="input-icon" />
                  <input v-model="registerForm.confirmPassword" :type="showRegConfirmPw ? 'text' : 'password'" class="form-input" required />
                  <button type="button" class="pw-toggle" @click="showRegConfirmPw = !showRegConfirmPw">
                    <EyeOff v-if="showRegConfirmPw" size="14" /><Eye v-else size="14" />
                  </button>
                </div>
              </div>
            </div>

            <div class="form-actions">
              <button type="button" class="back-btn mat-skeuo-sm mat-pressable-sm" @click="regStep = 1">
                <ChevronRight size="16" style="transform:rotate(180deg)" /> Back
              </button>
              <button type="submit" class="primary-btn mat-skeuo-filled mat-pressable-filled" :disabled="isProcessing">
                <span v-if="!isProcessing">Submit Registration</span>
                <span v-else class="btn-loading mat-skeuo-sm mat-pressable-sm"><span class="dot-pulse"></span> Submitting...</span>
                <ArrowRight size="16" v-if="!isProcessing" />
              </button>
            </div>
          </form>
        </div>

        <!-- Return link -->
        <a href="/" class="return-link">
          <i class="fas fa-arrow-left"></i> Return to Public Website
        </a>
      </div>
    </div>
  </div>
</template>

