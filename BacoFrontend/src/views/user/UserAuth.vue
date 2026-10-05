<script setup>
import './style/index.css'
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Mail, Lock, User, ArrowRight, ArrowLeft, Map as MapIcon, Compass, Phone, ShieldCheck, KeyRound } from 'lucide-vue-next'
import { useUserStore } from '../../stores/useUserStore'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const GOOGLE_CLIENT_ID = '576649425113-1l4pc8nap6cb3v4a76sbelhl1te59sio.apps.googleusercontent.com'

// ── Step State: 0 = login, 1 = register, 2 = verify OTP, 3 = set password (Google) ──
const currentStep = ref(0)
const errorMessage = ref('')

// ── Form ──
const form = ref({
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
})

// ── Set Password form (step 3) ──
const setPasswordForm = ref({
  password: '',
  confirmPassword: '',
})

// ── OTP ──
const otpDigits = ref(['', '', '', '', '', ''])
const otpInputRefs = ref([])
const otpCooldown = ref(0)
let otpTimer = null

// ── Slide class for each form wrapper ──
const slideClass = (stepIndex) => {
  if (stepIndex === currentStep.value) return 'slide-in-active'
  if (stepIndex < currentStep.value) return 'slide-out-left'
  return 'slide-out-right'
}

// ── Navigation ──
const goStep = (step) => {
  currentStep.value = step
  errorMessage.value = ''
}

const goBack = () => {
  if (currentStep.value === 3) {
    userStore.logout()
    goStep(0)
  } else if (currentStep.value === 2) {
    goStep(1)
  } else if (currentStep.value === 1) {
    goStep(0)
  }
}

// ── Check existing session ──
onMounted(async () => {
  if (userStore.token && userStore.user) {
    postAuthRedirect()
    return
  }
  if (userStore.token) {
    await userStore.fetchUser()
    if (userStore.user) {
      postAuthRedirect()
      return
    }
  }
  initGoogleButton()
})

onUnmounted(() => {
  if (otpTimer) clearInterval(otpTimer)
})

// ── Google Button (programmatic) ──
const initGoogleButton = () => {
  if (document.getElementById('gsi-script')) return
  const script = document.createElement('script')
  script.id = 'gsi-script'
  script.src = 'https://accounts.google.com/gsi/client'
  script.async = true
  script.defer = true
  script.onload = () => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      })
      const container = document.getElementById('googleSignInBtn')
      if (container) {
        container.innerHTML = ''
        window.google.accounts.id.renderButton(container, {
  theme: 'outline',
  size: 'large',
  text: 'signin_with',
  shape: 'rectangular',
  logo_alignment: 'left',
})
      }
    }
  }
  document.head.appendChild(script)
}

const handleGoogleCredential = async (response) => {
  errorMessage.value = ''
  const result = await userStore.loginWithGoogle(response.credential)
  if (result.success) {
    if (result.needsPassword) {
      setPasswordForm.value = { password: '', confirmPassword: '' }
      goStep(3)
    } else {
      postAuthRedirect()
    }
  } else {
    errorMessage.value = result.message
  }
}

// ── LOGIN ──
const login = async () => {
  if (!form.value.email || !form.value.password) {
    errorMessage.value = 'Email and password are required.'
    return
  }
  errorMessage.value = ''
  const result = await userStore.loginWithEmail(form.value.email, form.value.password)
  if (result.success) {
    postAuthRedirect()
  } else {
    errorMessage.value = result.message
  }
}

// ── REGISTER — sends OTP then goes to verify step ──
const initiateRegister = async () => {
  if (!form.value.firstName || !form.value.lastName || !form.value.email || !form.value.password) {
    errorMessage.value = 'Name, Email, and Password are required.'
    return
  }
  if (form.value.password !== form.value.confirmPassword) {
    errorMessage.value = 'Passwords do not match.'
    return
  }
  if (form.value.password.length < 6) {
    errorMessage.value = 'Password must be at least 6 characters.'
    return
  }

  errorMessage.value = ''
  const result = await userStore.sendOtp(form.value.email)
  if (result.success) {
    otpDigits.value = ['', '', '', '', '', '']
    goStep(2)
    startOtpCooldown()
    await nextTick()
    otpInputRefs.value[0]?.focus()
  } else {
    errorMessage.value = result.message
  }
}

// ── VERIFY OTP & COMPLETE REGISTRATION ──
const otpCode = computed(() => otpDigits.value.join(''))

const verifyAndRegister = async () => {
  if (otpCode.value.length !== 6) {
    errorMessage.value = 'Please enter the complete 6-digit code.'
    return
  }

  errorMessage.value = ''
  const result = await userStore.register({
    firstName: form.value.firstName,
    middleName: form.value.middleName,
    lastName: form.value.lastName,
    email: form.value.email,
    phone: form.value.phone,
    password: form.value.password,
    otp: otpCode.value,
  })

  if (result.success) {
    postAuthRedirect()
  } else {
    errorMessage.value = result.message
    if (result.message.includes('code') || result.message.includes('OTP')) {
      otpDigits.value = ['', '', '', '', '', '']
      await nextTick()
      otpInputRefs.value[0]?.focus()
    }
  }
}

// ── SET PASSWORD (for Google users, step 3) ──
const handleSetPassword = async () => {
  if (!setPasswordForm.value.password || !setPasswordForm.value.confirmPassword) {
    errorMessage.value = 'Please fill in both password fields.'
    return
  }
  if (setPasswordForm.value.password !== setPasswordForm.value.confirmPassword) {
    errorMessage.value = 'Passwords do not match.'
    return
  }
  if (setPasswordForm.value.password.length < 6) {
    errorMessage.value = 'Password must be at least 6 characters.'
    return
  }

  errorMessage.value = ''
  const result = await userStore.setPassword(setPasswordForm.value.password)
  if (result.success) {
    postAuthRedirect()
  } else {
    errorMessage.value = result.message
  }
}

const skipSetPassword = () => {
  postAuthRedirect()
}

// ── OTP Input Handlers ──
const handleOtpInput = (index, event) => {
  const val = event.target.value.replace(/[^0-9]/g, '')
  otpDigits.value[index] = val.slice(-1)
  if (val && index < 5) {
    otpInputRefs.value[index + 1]?.focus()
  }
  if (otpCode.value.length === 6) {
    verifyAndRegister()
  }
}

const handleOtpKeydown = (index, event) => {
  if (event.key === 'Backspace' && !otpDigits.value[index] && index > 0) {
    otpInputRefs.value[index - 1]?.focus()
  }
}

const handleOtpPaste = (event) => {
  event.preventDefault()
  const pasted = (event.clipboardData.getData('text') || '').replace(/[^0-9]/g, '').slice(0, 6)
  for (let i = 0; i < pasted.length; i++) {
    otpDigits.value[i] = pasted[i]
  }
  const nextIndex = Math.min(pasted.length, 5)
  otpInputRefs.value[nextIndex]?.focus()
  if (pasted.length === 6) {
    verifyAndRegister()
  }
}

const startOtpCooldown = () => {
  if (otpTimer) clearInterval(otpTimer)
  otpCooldown.value = 60
  otpTimer = setInterval(() => {
    otpCooldown.value--
    if (otpCooldown.value <= 0) clearInterval(otpTimer)
  }, 1000)
}

const resendOtp = async () => {
  if (otpCooldown.value > 0) return
  const result = await userStore.sendOtp(form.value.email)
  if (result.success) {
    otpDigits.value = ['', '', '', '', '', '']
    startOtpCooldown()
    await nextTick()
    otpInputRefs.value[0]?.focus()
    errorMessage.value = ''
  } else {
    errorMessage.value = result.message
  }
}

// ── Redirect helper: honor ?redirect= query param from Tourism / other pages,
//    otherwise go to the user dashboard ──
const postAuthRedirect = () => {
  const dest = route.query.redirect
  if (dest && typeof dest === 'string' && !dest.startsWith('/auth')) {
    router.push(dest)
  } else {
    router.push('/user/dashboard')
  }
}

// ── Branding panel: shifted only on register / verify ──
const brandingShifted = computed(() => currentStep.value === 1 || currentStep.value === 2)
const formsShifted = computed(() => currentStep.value === 1 || currentStep.value === 2)
</script>
<template>
  <!-- .ua-root / .ol-root are unique to these two pages. Every rule in
       style/userAuth.css is namespaced under .ua-root, so nothing here can
       style another page and nothing there can reach in. -->
  <div class="ua-root ua-page">
    <div class="ua-blob ua-blob-1"></div>
    <div class="ua-blob ua-blob-2"></div>
    <div class="ua-grain"></div>

    <div class="ua-card">

      <!-- ═══ LEFT: photo showcase ═══ -->
      <div class="ua-showcase" :class="{ 'is-shift': brandingShifted }">
        <img class="ua-photo" src="/images/MT-img.jpg" alt="Mt. Halcon, Baco" />

        <div class="ua-sc-top">
          <span class="ua-compass"><img src="/images/BACO-TOURISM.png" alt="Baco Tourism" /></span>
        </div>

        <div class="ua-sc-bottom">
          <span class="ua-tag">Oriental Mindoro</span>
          <h1 class="ua-showcase-title">Explore <em>Baco.</em></h1>
          <p class="ua-showcase-sub">
            Beaches, forests, and the majestic Mt. Halcon &mdash; one portal for
            permits, guided trails, and stays across all 27 barangays.
          </p>
          <div class="ua-trail-row">
            <span class="ua-trail">Halcon Traverse</span>
            <span class="ua-trail">Kambal Bato Falls</span>
            <span class="ua-trail">Dulangan Ridge</span>
          </div>
          <div class="ua-office">
            <span class="ua-office-icon"><img src="/images/BACO-SEAL.png" alt="Baco Seal" /></span>
            <div>
              <span>Municipal Tourism Office</span>
              <b>Basecamp Baco</b>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ RIGHT: forms ═══ -->
      <div class="ua-forms" :class="{ 'is-shift': formsShifted }">
        <div class="ua-slider">

          <!-- ─── 0 · LOGIN ─── -->
          <div class="ua-step" :class="slideClass(0)">
            <div class="ua-step-card">
              <h2 class="ua-title">Welcome <em>back</em></h2>
              <p class="ua-sub">Access your dashboard to continue your adventure.</p>

              <form class="ua-form" @submit.prevent="login">
                <div class="ua-field">
                  <label for="ua-email">Email address</label>
                  <div class="ua-icon"><Mail :size="16" /></div>
                  <input id="ua-email" v-model="form.email" type="email" class="ua-input" autocomplete="email" />
                </div>

                <div class="ua-field">
                  <label for="ua-password">Password</label>
                  <div class="ua-icon"><Lock :size="16" /></div>
                  <input id="ua-password" v-model="form.password" type="password" class="ua-input" autocomplete="current-password" />
                </div>

                <div class="ua-forgot">
                  <a href="#">Forgot password?</a>
                </div>

                <button type="submit" class="ua-btn" :disabled="userStore.isLoading">
                  <span v-if="!userStore.isLoading">Sign in</span>
                  <svg v-else class="ua-spin" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="4" opacity=".25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <ArrowRight :size="17" stroke-width="2.5" />
                </button>
              </form>

              <div class="ua-divider">or</div>
              <div id="googleSignInBtn" class="ua-google-slot"></div>

              <p class="ua-footer">
                Don't have an account?
                <button type="button" class="ua-toggle" @click="goStep(1)">Sign up</button>
              </p>
            </div>
          </div>

          <!-- ─── 1 · REGISTER ─── -->
          <div class="ua-step" :class="slideClass(1)">
            <div class="ua-step-card">
              <h2 class="ua-title">Start your <em>journey</em></h2>
              <p class="ua-sub">Create a Basecamp account to book trails, permits and stays.</p>

              <form class="ua-form" @submit.prevent="initiateRegister">
                <div class="ua-name-row">
                  <div class="ua-field">
                    <label for="ua-r-first">First name</label>
                    <div class="ua-icon"><User :size="16" /></div>
                    <input id="ua-r-first" v-model="form.firstName" type="text" class="ua-input" autocomplete="given-name" required />
                  </div>
                  <div class="ua-field">
                    <label for="ua-r-middle">Middle <span class="ua-opt">(optional)</span></label>
                    <input id="ua-r-middle" v-model="form.middleName" type="text" class="ua-input" autocomplete="additional-name" />
                  </div>
                  <div class="ua-field">
                    <label for="ua-r-last">Last name</label>
                    <input id="ua-r-last" v-model="form.lastName" type="text" class="ua-input" autocomplete="family-name" required />
                  </div>
                </div>

                <div class="ua-field">
                  <label for="ua-r-email">Email address</label>
                  <div class="ua-icon"><Mail :size="16" /></div>
                  <input id="ua-r-email" v-model="form.email" type="email" class="ua-input" autocomplete="email" required />
                </div>

                <div class="ua-field">
                  <label for="ua-r-phone">Phone <span class="ua-opt">(optional)</span></label>
                  <div class="ua-icon"><Phone :size="16" /></div>
                  <input id="ua-r-phone" v-model="form.phone" type="tel" class="ua-input" autocomplete="tel" />
                </div>

                <div class="ua-field">
                  <label for="ua-r-pass">Password</label>
                  <div class="ua-icon"><Lock :size="16" /></div>
                  <input id="ua-r-pass" v-model="form.password" type="password" class="ua-input" autocomplete="new-password" required />
                </div>

                <div class="ua-field">
                  <label for="ua-r-pass2">Confirm password</label>
                  <div class="ua-icon"><Lock :size="16" /></div>
                  <input id="ua-r-pass2" v-model="form.confirmPassword" type="password" class="ua-input" autocomplete="new-password" required />
                </div>

                <button type="submit" class="ua-btn" :disabled="userStore.isLoading">
                  <span v-if="!userStore.isLoading">Create account</span>
                  <svg v-else class="ua-spin" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="4" opacity=".25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <ArrowRight :size="17" stroke-width="2.5" />
                </button>
              </form>

              <p class="ua-footer">
                Already have an account?
                <button type="button" class="ua-toggle" @click="goStep(0)">Sign in</button>
              </p>
            </div>
          </div>

          <!-- ─── 2 · VERIFY OTP ─── -->
          <div class="ua-step" :class="slideClass(2)">
            <div class="ua-step-card ua-verify">
              <div class="ua-verify-icon"><ShieldCheck :size="30" /></div>
              <h2 class="ua-title">Verify your email</h2>
              <p class="ua-verify-text">
                We sent a 6-digit code to<br />
                <strong>{{ form.email }}</strong>
              </p>

              <div class="ua-otp-row" @paste="handleOtpPaste">
                <input
                  v-for="(_, i) in 6"
                  :key="i"
                  :ref="el => { if (el) otpInputRefs[i] = el }"
                  type="text"
                  inputmode="numeric"
                  maxlength="1"
                  class="ua-otp"
                  :aria-label="`Digit ${i + 1}`"
                  :value="otpDigits[i]"
                  @input="handleOtpInput(i, $event)"
                  @keydown="handleOtpKeydown(i, $event)"
                  :disabled="userStore.isLoading"
                />
              </div>

              <button
                type="button"
                class="ua-btn"
                :disabled="otpCode.length !== 6 || userStore.isLoading"
                @click="verifyAndRegister"
              >
                <span v-if="!userStore.isLoading">Verify &amp; create account</span>
                <svg v-else class="ua-spin" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="4" opacity=".25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <ArrowRight :size="17" stroke-width="2.5" />
              </button>

              <div class="ua-resend">
                <span v-if="otpCooldown > 0">Resend code in {{ otpCooldown }}s</span>
                <button v-else type="button" @click="resendOtp">Didn't receive it? Resend code</button>
              </div>

              <button type="button" class="ua-back" @click="goBack">
                <ArrowLeft :size="15" /> Back to registration
              </button>
            </div>
          </div>

          <!-- ─── 3 · SET PASSWORD (Google users) ─── -->
          <div class="ua-step" :class="slideClass(3)">
            <div class="ua-step-card ua-verify">
              <div class="ua-verify-icon ua-verify-icon--warn"><KeyRound :size="30" /></div>
              <h2 class="ua-title">Create a password</h2>
              <p class="ua-verify-text">
                Set a password so you can sign in<br />
                manually without Google next time.
              </p>

              <form class="ua-form ua-form--narrow" @submit.prevent="handleSetPassword">
                <div class="ua-field">
                  <label for="ua-sp-pass">New password</label>
                  <div class="ua-icon"><Lock :size="16" /></div>
                  <input id="ua-sp-pass" v-model="setPasswordForm.password" type="password" class="ua-input" autocomplete="new-password" required />
                </div>
                <div class="ua-field">
                  <label for="ua-sp-pass2">Confirm password</label>
                  <div class="ua-icon"><Lock :size="16" /></div>
                  <input id="ua-sp-pass2" v-model="setPasswordForm.confirmPassword" type="password" class="ua-input" autocomplete="new-password" required />
                </div>

                <button type="submit" class="ua-btn" :disabled="userStore.isLoading">
                  <span v-if="!userStore.isLoading">Save &amp; continue</span>
                  <svg v-else class="ua-spin" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="4" opacity=".25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <ArrowRight :size="17" stroke-width="2.5" />
                </button>
              </form>

              <button type="button" class="ua-skip" @click="skipSetPassword">
                Skip for now &mdash; go to dashboard
              </button>

              <button type="button" class="ua-back" @click="goBack">
                <ArrowLeft :size="15" /> Back to login
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>

    <Transition name="ua-toast">
      <div v-if="errorMessage" class="ua-toast">
        <span>{{ errorMessage }}</span>
        <button aria-label="Dismiss" @click="errorMessage = ''">&times;</button>
      </div>
    </Transition>
  </div>
</template>
