<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route  = useRoute()
const router = useRouter()

const hotelName = computed(() => route.query.name || 'Hotel Reservation Form')

// ── Form state ──
const form = ref({
  firstName:       '',
  lastName:        '',
  streetAddress:   '',
  city:            '',
  state:           '',
  zip:             '',
  email:           '',
  phone:           '',
  arrivalDate:     '',
  arrivalTime:     '',
  departureDate:   '',
  departureTime:   '',
  specialRequests: '',
  paymentMethod:   '',
})

const formErrors   = ref({})
const showErrors   = ref(false)
const isSubmitting = ref(false)
const isSuccess    = ref(false)
const bookingRef   = ref('')

const validate = () => {
  const e = {}
  if (!form.value.firstName)     e.firstName     = 'Required'
  if (!form.value.lastName)      e.lastName      = 'Required'
  if (!form.value.streetAddress) e.streetAddress = 'Required'
  if (!form.value.city)          e.city          = 'Required'
  if (!form.value.email)         e.email         = 'Required'
  if (!form.value.phone)         e.phone         = 'Required'
  if (!form.value.arrivalDate)   e.arrivalDate   = 'Required'
  if (!form.value.departureDate) e.departureDate = 'Required'
  if (!form.value.paymentMethod) e.paymentMethod = 'Required'
  formErrors.value = e
  return !Object.keys(e).length
}

const submit = () => {
  showErrors.value = true
  if (!validate()) return
  isSubmitting.value = true
  setTimeout(() => {
    isSubmitting.value = false
    isSuccess.value    = true
    bookingRef.value   = `BCO-${Date.now().toString().slice(-6)}`
  }, 1800)
}

const reset = () => {
  form.value = {
    firstName:'', lastName:'', streetAddress:'', city:'', state:'', zip:'',
    email:'', phone:'', arrivalDate:'', arrivalTime:'', departureDate:'',
    departureTime:'', specialRequests:'', paymentMethod:'',
  }
  formErrors.value = {}
  showErrors.value = false
  isSuccess.value  = false
  bookingRef.value = ''
}

// ── Tile grid mouse effect ──
const gridContainer = ref(null)
let tiles = []
let cols  = 0
let rows  = 0
const TILE_SIZE = 80

const createGrid = () => {
  if (!gridContainer.value) return
  gridContainer.value.innerHTML = ''
  tiles = []
  cols  = Math.ceil(window.innerWidth  / TILE_SIZE)
  rows  = Math.ceil(window.innerHeight / TILE_SIZE)
  gridContainer.value.style.gridTemplateColumns = `repeat(${cols}, 1fr)`
  gridContainer.value.style.gridTemplateRows    = `repeat(${rows}, 1fr)`
  for (let i = 0; i < cols * rows; i++) {
    const tile = document.createElement('div')
    tile.className = 'glass-tile'
    gridContainer.value.appendChild(tile)
    tiles.push(tile)
  }
}

const applyEffect = (tile, intensity) => {
  tile.style.backdropFilter = `blur(${Math.round(intensity * 40)}px)`
  tile.style.background     = `rgba(255,255,255,${intensity * 0.22})`
  clearTimeout(tile._timer)
  tile._timer = setTimeout(() => {
    tile.style.backdropFilter = 'blur(0px)'
    tile.style.background     = 'rgba(255,255,255,0)'
  }, 800 + Math.random() * 400)
}

const onMouseMove = (e) => {
  const gx = Math.floor(e.clientX / TILE_SIZE)
  const gy = Math.floor(e.clientY / TILE_SIZE)
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const tx = gx + dx, ty = gy + dy
      if (tx >= 0 && tx < cols && ty >= 0 && ty < rows) {
        const tile      = tiles[ty * cols + tx]
        const intensity = Math.max(0, 1 - Math.sqrt(dx*dx + dy*dy) / 2.5)
        if (tile && intensity > 0) applyEffect(tile, intensity)
      }
    }
  }
}

// ── Lenis smooth scroll ──
let lenis = null
let rafId = null

const initLenis = () => {
  if (!window.Lenis) return
  lenis = new window.Lenis({ duration: 1.2, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) })
  const tick = (time) => { lenis.raf(time); rafId = requestAnimationFrame(tick) }
  rafId = requestAnimationFrame(tick)
}

// ── Fade-up observer ──
let fadeObserver = null
const initFadeObserver = () => {
  fadeObserver = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('is-visible') })
  }, { threshold: 0.1 })
  document.querySelectorAll('.fade-up').forEach(el => fadeObserver.observe(el))
}

onMounted(() => {
  createGrid()
  window.addEventListener('resize',    createGrid)
  window.addEventListener('mousemove', onMouseMove)

  if (window.Lenis) {
    initLenis()
  } else {
    const s = document.createElement('script')
    s.src    = 'https://unpkg.com/@studio-freight/lenis@1.0.33/dist/lenis.min.js'
    s.onload = initLenis
    document.head.appendChild(s)
  }

  setTimeout(initFadeObserver, 80)
})

onUnmounted(() => {
  window.removeEventListener('resize',    createGrid)
  window.removeEventListener('mousemove', onMouseMove)
  if (rafId)        cancelAnimationFrame(rafId)
  if (lenis)        lenis.destroy()
  if (fadeObserver) fadeObserver.disconnect()
})
</script>

<template>
  <div class="booking-root">

    <!-- Fixed background — exact src from HTML prototype -->
    <div class="fixed-bg">
      <img
        src="/images/MT-img.jpg"
        alt="Lush green mountain landscape"
      />
    </div>

    <!-- Reactive tile grid -->
    <div id="tileGrid" ref="gridContainer"></div>

    <!-- Neo-glass panel -->
    <div class="neo-glass-panel">
      <div class="panel-inner">

        <!-- Back -->
        <button class="back-btn" @click="router.back()">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 12H5M5 12l7-7M5 12l7 7"/>
          </svg>
          Back
        </button>

        <!-- ── SUCCESS ── -->
        <div v-if="isSuccess" class="success-block fade-up is-visible">
          <div class="success-ring">✓</div>
          <h2>Reservation Submitted!</h2>
          <p>
            Your booking reference is <strong>{{ bookingRef }}</strong>.<br/>
            The hotel will contact you within 24 hours to confirm your reservation.
          </p>
          <div class="success-btns">
            <button class="neo-glass-button" @click="reset">Submit Another</button>
            <button class="ghost-btn" @click="router.push('/tourism')">Back to Tourism</button>
          </div>
        </div>

        <!-- ── FORM ── -->
        <template v-else>

          <div class="form-header fade-up">
            <h2>{{ hotelName }}</h2>
            <p>Complete the form below. Verification is required upon arrival.</p>
          </div>

          <form class="booking-form" @submit.prevent="submit">

            <!-- First / Last name -->
            <div class="grid-2 fade-up">
              <div>
                <label>First Name</label>
                <input type="text" v-model="form.firstName" placeholder="Juan" />
                <span class="err" v-if="showErrors && formErrors.firstName">{{ formErrors.firstName }}</span>
              </div>
              <div>
                <label>Last Name</label>
                <input type="text" v-model="form.lastName" placeholder="Dela Cruz" />
                <span class="err" v-if="showErrors && formErrors.lastName">{{ formErrors.lastName }}</span>
              </div>
            </div>

            <!-- Address -->
            <div class="fade-up">
              <label>Address</label>
              <div class="addr-grid">
                <input type="text" v-model="form.streetAddress" placeholder="Street Address" class="full" />
                <input type="text" v-model="form.city"          placeholder="City" />
                <div class="sz-row">
                  <input type="text" v-model="form.state" placeholder="Province" />
                  <input type="text" v-model="form.zip"   placeholder="Zip" />
                </div>
              </div>
              <span class="err" v-if="showErrors && formErrors.streetAddress">{{ formErrors.streetAddress }}</span>
              <span class="err" v-if="showErrors && formErrors.city">{{ formErrors.city }}</span>
            </div>

            <!-- Email / Phone / Arrival / Departure -->
            <div class="grid-4 fade-up">
              <div class="span-2">
                <label>Email</label>
                <input type="email" v-model="form.email" placeholder="juan@email.com" />
                <span class="err" v-if="showErrors && formErrors.email">{{ formErrors.email }}</span>
              </div>
              <div class="span-2">
                <label>Phone</label>
                <input type="tel" v-model="form.phone" placeholder="09XX-XXX-XXXX" />
                <span class="err" v-if="showErrors && formErrors.phone">{{ formErrors.phone }}</span>
              </div>
              <div class="span-2">
                <label>Arrival</label>
                <div class="dt-row">
                  <input type="date" v-model="form.arrivalDate" />
                  <input type="time" v-model="form.arrivalTime" class="t-input" />
                </div>
                <span class="err" v-if="showErrors && formErrors.arrivalDate">{{ formErrors.arrivalDate }}</span>
              </div>
              <div class="span-2">
                <label>Departure</label>
                <div class="dt-row">
                  <input type="date" v-model="form.departureDate" />
                  <input type="time" v-model="form.departureTime" class="t-input" />
                </div>
                <span class="err" v-if="showErrors && formErrors.departureDate">{{ formErrors.departureDate }}</span>
              </div>
            </div>

            <!-- Special requests + payment + submit -->
            <div class="bottom-row fade-up">
              <div>
                <label>Special Requests</label>
                <textarea v-model="form.specialRequests" rows="4" placeholder="Type here..."></textarea>
              </div>
              <div class="right-col">
                <div>
                  <label>Payment Method</label>
                  <div class="pay-row">
                    <label v-for="m in ['GCash', 'Cash on Arrival', 'Bank Transfer', 'PayMaya']" :key="m"
                      class="pay-opt" :class="{ active: form.paymentMethod === m }">
                      <input type="radio" :value="m" v-model="form.paymentMethod" name="payment" />
                      <span>{{ m }}</span>
                    </label>
                  </div>
                  <span class="err" v-if="showErrors && formErrors.paymentMethod">{{ formErrors.paymentMethod }}</span>
                </div>
                <div class="submit-row">
                  <button type="submit" class="neo-glass-button" :disabled="isSubmitting">
                    <span>{{ isSubmitting ? 'Processing...' : 'Submit Request' }}</span>
                    <svg v-if="!isSubmitting" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7-7 7M5 12h14"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

          </form>
        </template>

      </div>
    </div>

  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Caveat:wght@700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.booking-root {
  font-family: 'Space Grotesk', sans-serif;
  color: #ffffff;
  min-height: 100vh;
  overflow-x: hidden;
  position: relative;
  isolation: isolate;
}

/* ── FIXED BG ── */
.fixed-bg { position: fixed; inset: 0; z-index: 0; }
.fixed-bg img { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }

/* ── TILE GRID ── */
#tileGrid { display: grid; position: fixed; inset: 0; z-index: 1; pointer-events: none; }
:global(.glass-tile) {
  border: 0.5px solid rgba(255,255,255,0.02);
  transition:
    backdrop-filter 1.2s cubic-bezier(0.22, 1, 0.36, 1),
    background      1.2s cubic-bezier(0.22, 1, 0.36, 1);
  backdrop-filter: blur(0px);
  background: rgba(255,255,255,0);
  will-change: backdrop-filter, background;
}

/* ── NEO GLASS PANEL ── */
.neo-glass-panel {
  position: relative; z-index: 2;
  min-height: 100vh;
  background: transparent;
  border-left:  1px solid rgba(255,255,255,0.1);
  border-right: 1px solid rgba(255,255,255,0.1);
  display: flex; justify-content: center;
  padding: 24px 48px 80px;
}
.panel-inner { width: 100%; max-width: 896px; padding-top: 32px; }

/* ── BACK BTN ── */
.back-btn {
  display: inline-flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.7); padding: 8px 18px; border-radius: 30px;
  font-family: inherit; font-size: 0.85rem; font-weight: 600;
  cursor: pointer; transition: all 0.2s; margin-bottom: 40px;
}
.back-btn:hover { background: rgba(255,255,255,0.16); color: white; }

/* ── HEADER ── */
.form-header { margin-bottom: 48px; }
.form-header h2 {
  font-size: clamp(2rem, 5vw, 3.2rem); font-weight: 700;
  letter-spacing: -0.02em; color: #fff;
  text-shadow: 0 2px 8px rgba(0,0,0,1); margin-bottom: 12px;
}
.form-header p {
  font-size: 1.1rem; font-weight: 500; max-width: 560px;
  color: rgba(255,255,255,0.95); text-shadow: 0 2px 8px rgba(0,0,0,1);
}

/* ── FORM ── */
.booking-form { display: flex; flex-direction: column; gap: 32px; }

/* ── INPUTS — exact match to prototype ── */
input[type="text"],
input[type="email"],
input[type="tel"],
input[type="date"],
input[type="time"],
textarea {
  width: 100%;
  border: 1.5px solid rgba(255,255,255,0.4);
  background: rgba(0,0,0,0.5);
  padding: 0.85rem 1.25rem;
  color: #fff;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.97rem; font-weight: 500; letter-spacing: 0.02em;
  transition: all 0.3s ease; outline: none;
}
input:focus, textarea:focus {
  background: rgba(0,0,0,0.7);
  border-color: #fff;
  box-shadow: 0 0 0 2px rgba(255,255,255,0.1);
}
input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.6); }
input[type="date"]::-webkit-calendar-picker-indicator,
input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.6; cursor: pointer; }
textarea { resize: none; }

label {
  display: block; font-size: 0.95rem; font-weight: 600;
  color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,1);
  letter-spacing: 0.01em; margin-bottom: 10px;
}

/* ── GRIDS ── */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; }
.span-2 { grid-column: span 2; }

/* ── ADDRESS ── */
.addr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.addr-grid .full { grid-column: span 2; }
.sz-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

/* ── DATE-TIME ── */
.dt-row { display: flex; gap: 8px; }
.dt-row input[type="date"] { flex: 1; }
.t-input { width: 120px; flex-shrink: 0; text-align: center; }

/* ── BOTTOM ROW ── */
.bottom-row { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; padding-top: 24px; }
.right-col { display: flex; flex-direction: column; justify-content: space-between; }

/* ── PAYMENT — exact from prototype ── */
.pay-row { display: flex; flex-wrap: wrap; gap: 12px; }
.pay-opt {
  display: flex; align-items: center; gap: 12px;
  background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
  padding: 10px 20px; cursor: pointer;
  font-size: 0.95rem; font-weight: 700; color: rgba(255,255,255,0.85);
  text-shadow: 0 2px 8px rgba(0,0,0,0.8); transition: background 0.2s;
}
.pay-opt:hover  { background: rgba(255,255,255,0.2); }
.pay-opt.active { background: rgba(255,255,255,0.25); border-color: rgba(255,255,255,0.65); }
.pay-opt input[type="radio"] { display: none; }

/* ── SUBMIT ── */
.submit-row { display: flex; justify-content: flex-end; margin-top: 48px; }
.neo-glass-button {
  background: #fff; color: #000; border: none;
  padding: 16px 48px;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.85rem; font-weight: 900;
  text-transform: uppercase; letter-spacing: 0.2em;
  display: inline-flex; align-items: center; gap: 16px;
  cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.4);
  transition: all 0.3s ease;
}
.neo-glass-button:hover:not(:disabled) { transform: translateY(-2px); background: #f0f0f0; box-shadow: 0 10px 20px rgba(0,0,0,0.5); }
.neo-glass-button:disabled { opacity: 0.55; cursor: not-allowed; }

/* ── ERROR ── */
.err { color: #f87171; font-size: 0.76rem; margin-top: 5px; display: block; }

/* ── SUCCESS ── */
.success-block {
  display: flex; flex-direction: column; align-items: center;
  text-align: center; gap: 22px; padding: 80px 40px;
}
.success-ring {
  width: 80px; height: 80px; border: 2px solid white; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 2rem; color: white;
}
.success-block h2 { font-size: 2.4rem; font-weight: 700; color: white; text-shadow: 0 2px 8px rgba(0,0,0,1); }
.success-block p  { font-size: 1rem; color: rgba(255,255,255,0.85); text-shadow: 0 2px 8px rgba(0,0,0,1); max-width: 420px; line-height: 1.7; }
.success-block strong { color: white; }
.success-btns { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }
.ghost-btn {
  background: transparent; color: rgba(255,255,255,0.7);
  border: 1px solid rgba(255,255,255,0.3); padding: 14px 32px;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.85rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.12em; cursor: pointer; transition: all 0.2s;
}
.ghost-btn:hover { background: rgba(255,255,255,0.08); color: white; }

/* ── FADE-UP ── */
.fade-up { opacity: 0; transform: translateY(20px); transition: opacity 0.8s ease, transform 0.8s ease; }
.fade-up.is-visible { opacity: 1; transform: translateY(0); }

/* ── RESPONSIVE ── */
@media (max-width: 768px) {
  .neo-glass-panel { padding: 16px 20px 60px; }
  .grid-2     { grid-template-columns: 1fr; gap: 20px; }
  .grid-4     { grid-template-columns: 1fr 1fr; }
  .bottom-row { grid-template-columns: 1fr; gap: 28px; }
  .addr-grid  { grid-template-columns: 1fr; }
  .addr-grid .full { grid-column: span 1; }
  .submit-row { justify-content: stretch; }
  .neo-glass-button { width: 100%; justify-content: center; }
}
@media (max-width: 480px) {
  .grid-4 { grid-template-columns: 1fr; }
  .span-2 { grid-column: span 1; }
  .dt-row { flex-direction: column; }
  .t-input { width: 100%; }
  .pay-row { flex-direction: column; }
}
</style>