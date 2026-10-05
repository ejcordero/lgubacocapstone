<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'

const router = useRouter()
const route  = useRoute()

const activeTab    = ref('login')
const isProcessing = ref(false)
const errorMessage = ref('')

const authForm = ref({
  email:           '',
  password:        '',
  fullName:        '',
  confirmPassword: '',
  termsAgreed:     false
})

onMounted(() => {
  const token = localStorage.getItem('baco_user_token')
  if (token) {
    const dest = route.query.redirect || '/tourism'
    router.push(dest)
  }
})

const switchTab = (tab) => {
  activeTab.value    = tab
  errorMessage.value = ''
}

const redirectAfterAuth = () => {
  const dest = route.query.redirect || '/tourism'
  router.push(dest)
}

const executeAuthentication = async () => {
  if (!authForm.value.email || !authForm.value.password) {
    errorMessage.value = 'Email and password are required.'
    return
  }
  isProcessing.value = true
  errorMessage.value = ''
  try {
    const response = await axios.post('http://localhost:3000/api/auth/login', {
      email:    authForm.value.email,
      password: authForm.value.password
    })
    localStorage.setItem('baco_user_token', response.data.token)
    isProcessing.value = false
    redirectAfterAuth()
  } catch (error) {
    isProcessing.value = false
    errorMessage.value = error.response?.data?.message || 'Authentication failed. Please check your credentials.'
  }
}

const executeRegistration = async () => {
  if (authForm.value.password !== authForm.value.confirmPassword) {
    errorMessage.value = 'Passwords do not match.'
    return
  }
  if (!authForm.value.termsAgreed) {
    errorMessage.value = 'You must agree to the terms and conditions.'
    return
  }
  isProcessing.value = true
  errorMessage.value = ''
  try {
    const response = await axios.post('http://localhost:3000/api/auth/register', {
      fullName:    authForm.value.fullName,
      email:       authForm.value.email,
      password:    authForm.value.password,
      termsAgreed: authForm.value.termsAgreed
    })
    localStorage.setItem('baco_user_token', response.data.token)
    isProcessing.value = false
    redirectAfterAuth()
  } catch (error) {
    isProcessing.value = false
    errorMessage.value = error.response?.data?.error || 'Registration failed. Please try again.'
  }
}

const goBack = () => {
  const dest = route.query.redirect || '/tourism'
  router.push(dest)
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-container">

      <!-- Brand Panel -->
      <div class="brand-panel" :class="{ 'brand-right': activeTab === 'signup' }">
        <div class="brand-content">
          <button class="back-btn" @click="goBack">
            <i class="fa-solid fa-arrow-left"></i>
            <span>Back to {{ route.query.redirect === '/tala' ? 'TALA' : 'Tourism' }}</span>
          </button>

          <div class="brand-body">
            <div class="brand-icon">
              <i class="fa-solid fa-compass"></i>
            </div>
            <h1 class="brand-title">Explore<br>Baco</h1>
            <p class="brand-desc">
              Your gateway to Mt. Halcon. Book accommodations, secure permits, and document your journey.
            </p>
          </div>

          <div class="brand-footer">
            <div class="phase-badge">
              <div class="phase-icon">
                <i class="fa-solid fa-map"></i>
              </div>
              <div class="phase-info">
                <p class="phase-label">Current Phase</p>
                <p class="phase-value">Tourism &amp; Trails</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Form Panel -->
      <div class="form-panel" :class="{ 'form-left': activeTab === 'signup' }">

        <!-- Processing Overlay -->
        <transition name="overlay-fade">
          <div v-if="isProcessing" class="processing-overlay" role="status" aria-live="polite">
            <div class="processing-card">
              <span class="processing-spinner"></span>
              <p class="processing-title">
                {{ activeTab === 'login' ? 'Signing you in' : 'Creating your account' }}
              </p>
              <p class="processing-subtitle">This will only take a moment&hellip;</p>
            </div>
          </div>
        </transition>

        <div class="slide-wrapper">

          <!-- LOGIN FORM -->
          <div class="form-box" :class="{ 'slide-out-left': activeTab !== 'login' }">
            <div class="form-header">
              <h2>Welcome back</h2>
              <p>Sign in to continue to your dashboard.</p>
            </div>

            <div v-if="errorMessage && activeTab === 'login'" class="error-alert">
              <i class="fa-solid fa-circle-exclamation"></i>
              <span>{{ errorMessage }}</span>
            </div>

            <form @submit.prevent="executeAuthentication" class="auth-form">
              <div class="field">
                <label class="field-label" for="login-email">Email address</label>
                <div class="input-wrap">
                  <i class="fa-solid fa-envelope input-icon"></i>
                  <input id="login-email" type="email" v-model="authForm.email" placeholder="you@example.com" class="field-input" required />
                </div>
              </div>

              <div class="field">
                <div class="field-label-row">
                  <label class="field-label" for="login-password">Password</label>
                  <a href="#" class="forgot-link">Forgot password?</a>
                </div>
                <div class="input-wrap">
                  <i class="fa-solid fa-lock input-icon"></i>
                  <input id="login-password" type="password" v-model="authForm.password" placeholder="Enter your password" class="field-input" required />
                </div>
              </div>

              <button type="submit" class="submit-btn" :disabled="isProcessing">
                <span v-if="!isProcessing">Sign in <i class="fa-solid fa-arrow-right"></i></span>
                <span v-else><i class="fa-solid fa-spinner fa-spin"></i> Signing in&hellip;</span>
              </button>
            </form>

            <p class="switch-text">
              Don't have an account?
              <button class="switch-link" @click="switchTab('signup')">Sign up</button>
            </p>
          </div>

          <!-- REGISTER FORM -->
          <div class="form-box" :class="{ 'slide-in-right': activeTab !== 'signup', 'form-active': activeTab === 'signup' }">
            <div class="form-header">
              <h2>Create your account</h2>
              <p>Sign up to start planning your climb.</p>
            </div>

            <div v-if="errorMessage && activeTab === 'signup'" class="error-alert">
              <i class="fa-solid fa-circle-exclamation"></i>
              <span>{{ errorMessage }}</span>
            </div>

            <form @submit.prevent="executeRegistration" class="auth-form">
              <div class="field">
                <label class="field-label" for="signup-name">Full name</label>
                <div class="input-wrap">
                  <i class="fa-solid fa-user input-icon"></i>
                  <input id="signup-name" type="text" v-model="authForm.fullName" placeholder="Juan Dela Cruz" class="field-input" required />
                </div>
              </div>

              <div class="field">
                <label class="field-label" for="signup-email">Email address</label>
                <div class="input-wrap">
                  <i class="fa-solid fa-envelope input-icon"></i>
                  <input id="signup-email" type="email" v-model="authForm.email" placeholder="you@example.com" class="field-input" required />
                </div>
              </div>

              <div class="field-row">
                <div class="field">
                  <label class="field-label" for="signup-password">Password</label>
                  <div class="input-wrap">
                    <i class="fa-solid fa-lock input-icon"></i>
                    <input id="signup-password" type="password" v-model="authForm.password" placeholder="Create a password" class="field-input" required />
                  </div>
                </div>

                <div class="field">
                  <label class="field-label" for="signup-confirm">Confirm password</label>
                  <div class="input-wrap">
                    <i class="fa-solid fa-lock input-icon"></i>
                    <input id="signup-confirm" type="password" v-model="authForm.confirmPassword" placeholder="Confirm password" class="field-input" required />
                  </div>
                </div>
              </div>

              <label class="terms-row" for="terms">
                <input type="checkbox" id="terms" v-model="authForm.termsAgreed" />
                <span>I agree to the <a href="#" @click.stop>Terms &amp; Conditions</a></span>
              </label>

              <button type="submit" class="submit-btn" :disabled="isProcessing">
                <span v-if="!isProcessing">Create account <i class="fa-solid fa-arrow-right"></i></span>
                <span v-else><i class="fa-solid fa-spinner fa-spin"></i> Creating account&hellip;</span>
              </button>
            </form>

            <p class="switch-text">
              Already have an account?
              <button class="switch-link" @click="switchTab('login')">Log in</button>
            </p>
          </div>

        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* ================================================
   DESIGN TOKENS
   ================================================ */
.auth-page {
  --navy:        #0B198F;
  --navy-dark:   #08146e;
  --navy-darker: #0a1560;
  --red:         #CE1126;
  --ink:         #0f172a;
  --ink-soft:    #374151;
  --muted:       #64748b;
  --placeholder: #94a3b8;
  --border:      #e2e8f0;
  --border-hover:#cbd5e1;
  --surface:     #f8fafc;
  --page-bg:     #f1f5f9;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;

  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
}

/* ================================================
   PAGE FOUNDATION
   ================================================ */
.auth-page {
  min-height: 100vh;
  width: 100%;
  background: var(--page-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  position: relative;
  overflow-x: hidden;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.auth-page::before {
  content: '';
  position: fixed;
  top: -25%;
  left: -15%;
  width: 55vw;
  height: 55vw;
  border-radius: 50%;
  background: rgba(11, 25, 143, 0.035);
  filter: blur(100px);
  pointer-events: none;
}
.auth-page::after {
  content: '';
  position: fixed;
  bottom: -25%;
  right: -15%;
  width: 50vw;
  height: 50vw;
  border-radius: 50%;
  background: rgba(206, 17, 38, 0.025);
  filter: blur(100px);
  pointer-events: none;
}

/* ================================================
   MAIN CONTAINER — CSS GRID (no overlap bugs)
   ================================================ */
.auth-container {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 960px;
  border-radius: var(--radius-xl);
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr;
  background: #ffffff;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.04),
    0 4px 12px rgba(0, 0, 0, 0.04),
    0 12px 28px rgba(0, 0, 0, 0.06),
    0 28px 56px rgba(0, 0, 0, 0.04);
  animation: containerIn 0.65s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes containerIn {
  from { opacity: 0; transform: translateY(14px) scale(0.985); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

@media (min-width: 768px) {
  .auth-container {
    grid-template-columns: 40% 60%;
    align-items: stretch;
  }
  /* Swap column order for signup without any absolute-positioning side effects */
  .auth-container:has(.brand-right) {
    grid-template-columns: 60% 40%;
  }
  .brand-panel { grid-column: 1; grid-row: 1; }
  .form-panel  { grid-column: 2; grid-row: 1; }
  .brand-right { grid-column: 2; }
  .form-left   { grid-column: 1; }
}

/* ================================================
   BRAND PANEL
   ================================================ */
.brand-panel {
  position: relative;
  background:
    radial-gradient(ellipse at 85% 12%, rgba(206, 17, 38, 0.13) 0%, transparent 45%),
    radial-gradient(ellipse at 15% 85%, rgba(255, 255, 255, 0.04) 0%, transparent 45%),
    linear-gradient(158deg, #0e2498 0%, var(--navy) 35%, var(--navy-dark) 100%);
  color: #ffffff;
  padding: var(--space-8);
  display: flex;
  flex-direction: column;
  z-index: 20;
  transition: grid-column 0.4s ease;
  overflow: hidden;
}

.brand-panel::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
  background-size: 36px 36px;
  pointer-events: none;
}

.brand-content {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--space-8);
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.70);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  padding: 7px 14px;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
  width: fit-content;
  letter-spacing: 0.01em;
}
.back-btn:hover {
  background: rgba(255, 255, 255, 0.11);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.15);
}
.back-btn:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}

.brand-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.brand-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.09);
  border: 1px solid rgba(255, 255, 255, 0.10);
  font-size: 1.15rem;
  margin-bottom: var(--space-5);
  color: #ffffff;
}

.brand-title {
  font-size: 2.25rem;
  font-weight: 700;
  line-height: 1.1;
  margin: 0 0 var(--space-3);
  letter-spacing: -0.03em;
  color: #ffffff;
}

.brand-desc {
  color: rgba(255, 255, 255, 0.60);
  font-size: 0.9rem;
  line-height: 1.7;
  max-width: 280px;
  margin: 0;
  letter-spacing: 0.005em;
}

.brand-footer {
  margin-top: auto;
}

.phase-badge {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: rgba(0, 0, 0, 0.16);
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.phase-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: var(--red);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  flex-shrink: 0;
  color: #ffffff;
}

.phase-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.phase-label {
  font-size: 0.66rem;
  color: rgba(255, 255, 255, 0.45);
  font-weight: 600;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.phase-value {
  font-weight: 700;
  font-size: 0.85rem;
  margin: 0;
  color: #ffffff;
  letter-spacing: 0.01em;
}

/* ================================================
   FORM PANEL
   ================================================ */
.form-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-10) var(--space-8);
  background: #ffffff;
  position: relative;
}

@media (min-width: 768px) {
  .form-panel { border-left: 1px solid #f1f5f9; }
  .form-panel.form-left {
    border-left: none;
    border-right: 1px solid #f1f5f9;
  }
}

/* ================================================
   PROCESSING OVERLAY
   ================================================ */
.processing-overlay {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.processing-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-3);
  padding: var(--space-6);
}

.processing-spinner {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 3px solid rgba(11, 25, 143, 0.15);
  border-top-color: var(--navy);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.processing-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0;
  letter-spacing: -0.01em;
}

.processing-subtitle {
  font-size: 0.8rem;
  color: var(--muted);
  margin: 0;
}

.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.25s ease;
}
.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

/* ================================================
   SLIDE ANIMATION WRAPPER
   Both form-box elements sit in the same grid cell so the
   wrapper always sizes to the taller of the two — no fixed
   min-height guess, and nothing gets clipped or overlaps.
   ================================================ */
.slide-wrapper {
  position: relative;
  width: 100%;
  max-width: 380px;
  display: grid;
}

.form-box {
  grid-column: 1;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition:
    transform 0.45s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    visibility 0.45s;
  will-change: transform, opacity;
}

.form-box:first-child {
  transform: translateX(0);
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  position: relative;
}
.form-box:first-child.slide-out-left {
  transform: translateX(-32px);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  position: absolute;
  inset: 0;
}

.form-box:last-child {
  transform: translateX(32px);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  position: absolute;
  inset: 0;
}
.form-box:last-child.form-active {
  transform: translateX(0);
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  position: relative;
}

/* ================================================
   FORM HEADER
   ================================================ */
.form-header {
  text-align: left;
  margin-bottom: var(--space-8);
}

.form-header h2 {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--ink);
  margin: 0 0 var(--space-1);
  letter-spacing: -0.025em;
}

.form-header p {
  font-size: 0.875rem;
  color: var(--muted);
  margin: 0;
  line-height: 1.5;
}

/* ================================================
   FORM STRUCTURE
   ================================================ */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

@media (max-width: 400px) {
  .field-row {
    grid-template-columns: 1fr;
    gap: var(--space-5);
  }
}

/* ─── Field Group ─────────────────────────────── */
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.field-label-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.field-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ink-soft);
  letter-spacing: 0.01em;
}

/* ─── Input Wrapper ───────────────────────────── */
.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  color: var(--placeholder);
  font-size: 0.82rem;
  pointer-events: none;
  transition: color 0.2s ease;
}

.input-wrap:focus-within .input-icon {
  color: var(--navy);
}

/* ─── Text Input ──────────────────────────────── */
.field-input {
  width: 100%;
  padding: 11px 14px 11px 40px;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--border);
  font-size: 0.875rem;
  font-family: inherit;
  color: #1e293b;
  background: var(--surface);
  box-sizing: border-box;
  transition: all 0.2s ease;
  line-height: 1.5;
}

.field-input::placeholder { color: var(--placeholder); }
.field-input:hover { border-color: var(--border-hover); }
.field-input:focus {
  outline: none;
  border-color: var(--navy);
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(11, 25, 143, 0.08);
}

/* ─── Forgot Password Link ────────────────────── */
.forgot-link {
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--navy);
  text-decoration: none;
  transition: color 0.2s ease;
  white-space: nowrap;
}
.forgot-link:hover { color: var(--red); }

/* ─── Terms Checkbox Row ──────────────────────── */
.terms-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  font-size: 0.78rem;
  color: var(--ink-soft);
  line-height: 1.55;
  cursor: pointer;
  user-select: none;
}

.terms-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  margin: 2px 0 0;
  accent-color: var(--navy);
  flex-shrink: 0;
  cursor: pointer;
}

.terms-row a {
  color: var(--navy);
  font-weight: 600;
  text-decoration: none;
  transition: color 0.2s ease;
}
.terms-row a:hover { color: var(--red); }

/* ================================================
   SUBMIT BUTTON
   ================================================ */
.submit-btn {
  width: 100%;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  border: none;
  font-size: 0.9rem;
  font-weight: 600;
  font-family: inherit;
  color: #ffffff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  background: var(--navy);
  transition: all 0.2s ease;
  margin-top: var(--space-1);
  letter-spacing: 0.01em;
}

.submit-btn:hover:not(:disabled) {
  background: var(--navy-darker);
  box-shadow: 0 4px 14px rgba(11, 25, 143, 0.28);
  transform: translateY(-1px);
}
.submit-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(11, 25, 143, 0.18);
}
.submit-btn:focus-visible {
  outline: 2px solid var(--navy);
  outline-offset: 2px;
}
.submit-btn:disabled {
  background: #94a3b8;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

/* ================================================
   SWITCH TEXT & LINK
   ================================================ */
.switch-text {
  text-align: center;
  font-size: 0.82rem;
  color: var(--muted);
  margin-top: var(--space-6);
}

.switch-link {
  background: none;
  border: none;
  font-family: inherit;
  font-size: inherit;
  font-weight: 600;
  color: var(--navy);
  cursor: pointer;
  margin-left: var(--space-1);
  padding: 0;
  transition: color 0.2s ease;
}
.switch-link:hover { color: var(--red); }

/* ================================================
   ERROR ALERT
   ================================================ */
.error-alert {
  background: #fef2f2;
  color: #b91c1c;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  font-weight: 500;
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  border-left: 3px solid #dc2626;
  margin-bottom: var(--space-5);
  line-height: 1.5;
}

.error-alert i { margin-top: 2px; flex-shrink: 0; }

/* ================================================
   RESPONSIVE — TABLET
   ================================================ */
@media (max-width: 1023px) and (min-width: 768px) {
  .auth-container { max-width: 780px; }
  .brand-panel { padding: var(--space-6); }
  .brand-title { font-size: 1.85rem; }
  .brand-desc { font-size: 0.84rem; max-width: 220px; }
  .slide-wrapper { max-width: 340px; }
  .form-panel { padding: var(--space-8) var(--space-6); }
}

/* ================================================
   RESPONSIVE — MOBILE
   ================================================ */
@media (max-width: 767px) {
  .auth-page { padding: 0; align-items: stretch; }

  .auth-container {
    min-height: 100vh;
    min-height: 100dvh;
    border-radius: 0;
    box-shadow: none;
    animation: none;
    grid-template-rows: auto 1fr;
  }

  .brand-panel {
    padding: var(--space-4) var(--space-5);
    order: 1;
  }
  .form-panel {
    order: 2;
    padding: var(--space-6) var(--space-5) var(--space-8);
  }

  .brand-content { gap: var(--space-3); }

  .back-btn {
    background: none;
    border: none;
    padding: 0;
    margin-bottom: var(--space-2);
    font-size: 0.72rem;
  }
  .back-btn:hover { background: none; border: none; }

  .brand-body {
    flex-direction: row;
    align-items: center;
    gap: var(--space-3);
  }

  .brand-icon {
    width: 32px;
    height: 32px;
    font-size: 0.78rem;
    border-radius: var(--radius-sm);
    margin-bottom: 0;
  }

  .brand-title {
    font-size: 1.1rem;
    margin-bottom: 0;
    line-height: 1.2;
  }
  .brand-title br { display: none; }
  .brand-desc { display: none; }
  .brand-footer { display: none; }

  .slide-wrapper { max-width: 100%; }

  .form-header { margin-bottom: var(--space-6); }
  .form-header h2 { font-size: 1.3rem; }
  .form-header p { font-size: 0.82rem; }

  .auth-form { gap: var(--space-4); }
}

/* ================================================
   RESPONSIVE — SMALL MOBILE
   ================================================ */
@media (max-width: 374px) {
  .brand-panel { padding: var(--space-3) var(--space-4); }
  .form-panel { padding: var(--space-5) var(--space-4) var(--space-6); }
  .brand-title { font-size: 1rem; }
  .form-header h2 { font-size: 1.15rem; }
  .field-input { padding: 10px 12px 10px 38px; font-size: 0.82rem; }
  .submit-btn { padding: 10px 14px; font-size: 0.85rem; }
}

/* ================================================
   ACCESSIBILITY
   ================================================ */
@media (prefers-reduced-motion: reduce) {
  .auth-container,
  .form-box,
  .submit-btn,
  .processing-spinner {
    animation: none !important;
    transition: none !important;
  }
}
</style>