<template>
  <div class="sb-root">

    <!-- ══════════════════ STEP 1 · BROWSE ══════════════════ -->
    <template v-if="step === 'browse'">
      <div class="fade-in">
        <!-- Toolbar -->
        <div class="toolbar">
          <div class="search-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            <input v-model="searchQuery" type="text" placeholder="Search resorts, barangays…" />
          </div>
          <div class="filter-chips">
            <button class="chip" :class="{ active: filterType === '' }" @click="filterType = ''">All</button>
            <button class="chip" :class="{ active: filterType === 'daytour' }" @click="filterType = 'daytour'">Day Tours</button>
            <button class="chip" :class="{ active: filterType === 'overnight' }" @click="filterType = 'overnight'">Overnight</button>
          </div>
          <select v-model="sortBy" class="sort-select">
            <option value="featured">Sort: Featured</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
          </select>
        </div>

        <h2 class="count-line">{{ filteredHotels.length }} propert{{ filteredHotels.length === 1 ? 'y' : 'ies' }} available</h2>

        <!-- Loading / Empty -->
        <div v-if="loading" class="state-box"><div class="spinner"></div><p>Loading resorts…</p></div>
        <div v-else-if="filteredHotels.length === 0" class="state-box">
          <div class="state-emoji">🏨</div>
          <p v-if="searchQuery">No resorts match "{{ searchQuery }}".</p>
          <p v-else>No resorts are published yet — check back soon.</p>
          <button v-if="searchQuery" class="btn-ghost" @click="searchQuery = ''">Clear search</button>
        </div>

        <!-- Listing grid -->
        <div v-else class="grid-cards">
          <div v-for="h in filteredHotels" :key="h.id" class="gcard card-hover" @click="openDetail(h)">
            <div class="gcard-img">
              <img v-if="h.image || (h.gallery && h.gallery[0])" :src="h.image || h.gallery[0]" :alt="h.name" loading="lazy" />
              <div v-else class="img-fallback">No image</div>
              <div class="badge-row">
                <span v-if="(h.entranceFees || []).length" class="bpill tour">🎟️ Day Tour</span>
                <span v-if="h.hasRooms" class="bpill stay">🛏️ Overnight</span>
              </div>
              <div v-if="h.avgRating" class="gcard-rating">★ {{ h.avgRating }} <span class="gr-count">({{ h.reviewCount }})</span></div>
            </div>
            <div class="gcard-body">
              <div class="gcard-top">
                <h3>{{ h.name }}</h3>
              </div>
              <p class="gcard-loc">📍 {{ h.location || 'Baco, Oriental Mindoro' }}</p>
              <div class="gcard-meta">
                <span>🏠 {{ (h.rooms || []).length }} room{{ (h.rooms || []).length !== 1 ? 's' : '' }}</span>
                <span>✨ {{ (h.amenities || []).length }} amenities</span>
              </div>
              <div class="gcard-price">
                <div>
                  <span class="price">{{ peso(cardPrice(h)) }}</span>
                  <span class="per">{{ cardPriceLabel(h) }}</span>
                </div>
                <button class="btn-rose sm" @click.stop="openDetail(h)">View</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ══════════════════ STEP 2 · DETAIL ══════════════════ -->
    <template v-else-if="step === 'detail' && selectedHotel">
      <div class="fade-in">
        <div class="crumb-row">
          <button class="linklike" @click="backToBrowse">← Back to listings</button>
        </div>

        <div class="detail-grid">
          <div class="detail-main">
            <div class="detail-cover">
              <img v-if="coverImg" :src="coverImg" :alt="selectedHotel.name" />
              <div v-else class="img-fallback tall">No image</div>
              <button v-if="coverImg" class="cover-expand" @click="openLightbox(galleryThumbs, Math.max(0, galleryThumbs.indexOf(coverImg)), selectedHotel.name)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                <span>View photos</span>
              </button>
            </div>
            <div v-if="galleryThumbs.length > 1" class="thumb-row">
              <img v-for="(g, i) in galleryThumbs" :key="i" :src="g" class="thumb" :class="{ active: coverImg === g }" @click="coverImg = g" />
            </div>

            <h1 class="detail-title">{{ selectedHotel.name }}</h1>
            <p class="detail-loc">📍 {{ selectedHotel.location || 'Baco, Oriental Mindoro' }}</p>
            <p class="detail-desc">{{ selectedHotel.description || 'No description yet.' }}</p>

            <div v-if="(selectedHotel.amenities || []).length" class="detail-section">
              <h3>Amenities</h3>
              <div class="amenity-grid">
                <div v-for="(a, i) in selectedHotel.amenities" :key="i" class="amenity">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="stroke:var(--bb-success)" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg>
                  {{ a }}
                </div>
              </div>
            </div>

            <div v-if="houseRules.length" class="detail-section">
              <h3>House Rules</h3>
              <ul class="rules-list">
                <li v-for="(r, i) in houseRules" :key="i"><span class="dot">•</span>{{ r }}</li>
              </ul>
            </div>

            <div v-if="(selectedHotel.rooms || []).length" class="detail-section">
              <h3>Available Rooms ({{ selectedHotel.rooms.length }})</h3>
              <div class="room-grid">
                <div v-for="r in selectedHotel.rooms" :key="r.id" class="droom">
                  <div v-if="roomImages(r).length" class="droom-img zoomable" role="button" tabindex="0"
                    :aria-label="`View photos of ${r.name}`"
                    @click="openLightbox(roomImages(r), 0, r.name)"
                    @keydown.enter="openLightbox(roomImages(r), 0, r.name)"
                    @keydown.space.prevent="openLightbox(roomImages(r), 0, r.name)">
                    <img :src="roomImages(r)[0]" :alt="r.name" loading="lazy" />
                    <span class="zoom-hint"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></span>
                  </div>
                  <div v-else class="droom-img">
                    <div class="img-fallback">No image</div>
                  </div>
                  <div class="droom-body">
                    <div class="droom-top">
                      <h4>{{ r.name }}</h4>
                      <span class="rtype">{{ r.type || 'Room' }}</span>
                    </div>
                    <div class="droom-bottom">
                      <span>👥 Up to {{ r.capacity }} guests</span>
                      <span class="droom-price">{{ peso(r.price) }}<small>/night</small></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Comments & Ratings -->
            <section class="detail-section rv">
              <div class="rv-head">
                <div>
                  <h3 class="sec-h">Comments &amp; Ratings</h3>
                  <div class="rv-summary">
                    <span v-if="selectedHotel.avgRating" class="rv-avg">★ {{ selectedHotel.avgRating }}</span>
                    <span class="rv-count">{{ selectedHotel.reviewCount || 0 }} review{{ (selectedHotel.reviewCount || 0) === 1 ? '' : 's' }}</span>
                  </div>
                </div>
                <button class="btn-rose sm" @click="goWriteReview">{{ userStore.token ? 'Rate this resort' : 'Log in to review' }}</button>
              </div>

              <div v-if="reviewsLoading" class="hint gap">Loading comments…</div>
              <div v-else-if="reviewsError" class="hint gap">{{ reviewsError }}</div>
              <div v-else-if="reviews.length === 0" class="hint gap">No comments yet — be the first to review this destination.</div>
              <div v-else class="rvl">
                <div v-for="r in reviews" :key="r.id" class="rvc">
                  <div class="rva">{{ reviewerInitials(r.reviewer_name) }}</div>
                  <div class="rvbody">
                    <div class="rvmeta">
                      <span class="rvname">{{ r.reviewer_name }}</span>
                      <span class="rvstars">{{ '★'.repeat(r.rating) }}</span>
                      <span class="rvdate">{{ fmtDate(r.created_at) }}</span>
                    </div>
                    <h5 v-if="r.title" class="rvtitle">{{ r.title }}</h5>
                    <p class="rvcontent">{{ r.content }}</p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <!-- Booking card -->
          <div class="detail-side">
            <div class="card book-card">
              <h3>Book your visit</h3>
              <p class="book-sub">Choose your booking type:</p>

              <div v-if="!hasFees && !hasRooms" class="notice">
                This resort hasn't published any rates yet. Please contact them directly to book.
              </div>

              <template v-else>
                <button class="opt full" :class="{ sel: bookingType === 'entrance', dis: !hasFees }" :disabled="!hasFees" @click="selectBookingType('entrance')">
                  <span class="opt-emoji">🎟️</span>
                  <span class="opt-text"><b>Entrance Only</b><small>Day visit, no overnight stay</small></span>
                </button>
                <button class="opt full" :class="{ sel: bookingType === 'accommodation', dis: !hasRooms }" :disabled="!hasRooms" @click="selectBookingType('accommodation')">
                  <span class="opt-emoji">🛏️</span>
                  <span class="opt-text"><b>Entrance + Accommodation</b><small>{{ hasRooms ? 'Overnight stay with room selection' : 'No rooms available' }}</small></span>
                </button>

                <button class="btn-rose w-full mt" @click="startBooking">Continue</button>

                <div class="book-foot">
                  <div v-if="minFeePrice !== null"><span>Entrance fee</span><b>{{ peso(minFeePrice) }}/person</b></div>
                  <div v-if="minRoomPrice !== null"><span>Rooms from</span><b>{{ peso(minRoomPrice) }}/night</b></div>
                </div>
              </template>

              <!-- ✉️ NEW: Message the resort (always available — even when no rates are published) -->
              <div class="book-msg">
                <button class="msg-resort" @click="openResortChat">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <span>{{ userStore.token ? 'Message the resort' : 'Log in to message the resort' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ══════════════════ STEP 3 · BOOKING FORM ══════════════════ -->
    <template v-else-if="step === 'booking' && selectedHotel">
      <div class="fade-in">
        <div class="crumb-row">
          <button class="linklike" @click="step = 'detail'">← Back to details</button>
          <span class="step-pill">Step 1 of 2 · Details</span>
        </div>

        <div class="detail-grid">
          <div class="detail-main">
            <h1 class="detail-title sm">{{ bookingType === 'entrance' ? 'Entrance Booking' : 'Accommodation Booking' }}</h1>
            <p class="detail-loc">{{ selectedHotel.name }} · {{ selectedHotel.location }}</p>

            <div v-if="errorMsg" class="error-banner">{{ errorMsg }}</div>

            <!-- Trip details -->
            <div class="card sec">
              <h3 class="sec-h">Your trip</h3>
              <div class="grid-2">
                <template v-if="bookingType === 'entrance'">
                  <div class="field">
                    <label>Visit Date</label>
                    <input type="date" v-model="form.visitDate" :min="minDate" class="inp" />
                  </div>
                </template>
                <template v-else>
                  <div class="field">
                    <label>Check-in</label>
                    <input type="date" v-model="form.checkIn" :min="minDate" class="inp" />
                  </div>
                  <div class="field">
                    <label>Check-out</label>
                    <input type="date" v-model="form.checkOut" :min="form.checkIn || minDate" class="inp" />
                  </div>
                </template>
              </div>
              <div class="grid-2 mt-sm">
                <div class="field">
                  <label>Adults</label>
                  <select v-model="form.adults" class="inp">
                    <option v-for="n in 10" :key="n" :value="n">{{ n }}</option>
                  </select>
                </div>
                <div class="field">
                  <label>Children</label>
                  <select v-model="form.children" class="inp">
                    <option v-for="n in 7" :key="n" :value="n - 1">{{ n - 1 }}</option>
                  </select>
                </div>
              </div>
              <p v-if="bookingType === 'accommodation'" class="hint">Entrance passes cover your arrival day ({{ form.checkIn || 'select check-in' }}).</p>
            </div>

            <!-- Entrance fee selection -->
            <div v-if="hasFees" class="card sec">
              <h3 class="sec-h">Entrance Fee <span class="req-badge">Required</span></h3>
              <div class="opt-list">
                <label v-for="f in fees" :key="f.id" class="opt" :class="{ sel: selectedFeeId === f.id }">
                  <input type="radio" :value="f.id" v-model="selectedFeeId" name="fee" />
                  <span class="opt-text"><b>{{ f.name }}</b><small v-if="f.description">{{ f.description }}</small></span>
                  <span class="opt-price">{{ peso(f.price) }}<small>/head</small></span>
                </label>
              </div>
            </div>
            <div v-else-if="bookingType === 'entrance'" class="notice">No entrance rates published — choose "Entrance + Accommodation" instead.</div>

            <!-- Room selection -->
            <div v-if="bookingType === 'accommodation'" class="card sec">
              <h3 class="sec-h">Select a room</h3>
              <div v-if="!rooms.length" class="notice">No rooms available.</div>
              <div v-else class="opt-list">
                <label v-for="r in rooms" :key="r.id" class="opt roomy" :class="{ sel: selectedRoomId === r.id }">
                  <input type="radio" :value="r.id" v-model="selectedRoomId" name="room" />
                  <img v-if="r.image || (r.gallery && r.gallery[0])" :src="r.image || r.gallery[0]" class="opt-thumb" @click.stop.prevent="openLightbox(roomImages(r), 0, r.name)" />
                  <span class="opt-text"><b>{{ r.name }}</b><small>{{ r.type || 'Room' }} · Up to {{ r.capacity }} guests{{ r.totalCount ? ` · ${r.totalCount} unit${r.totalCount > 1 ? 's' : ''}` : '' }}</small></span>
                  <span class="opt-price">{{ peso(r.price) }}<small>/night</small></span>
                </label>
              </div>
              <div v-if="availInfo" class="avail" :class="availInfo.available > 0 ? 'ok' : 'no'">
                {{ availInfo.available > 0 ? `${availInfo.available} unit${availInfo.available > 1 ? 's' : ''} available for your dates` : 'Fully booked for the selected dates — try different dates.' }}
              </div>
            </div>

            <!-- Guest info -->
            <div class="card sec">
              <h3 class="sec-h">Your information</h3>
              <div class="grid-2">
                <div class="field"><label>Full Name</label><input v-model="form.name" class="inp" placeholder="Juan Dela Cruz" /></div>
                <div class="field"><label>Contact Number</label><input v-model="form.phone" class="inp" placeholder="09XXXXXXXXX" /></div>
                <div class="field"><label>Email</label><input v-model="form.email" type="email" class="inp" placeholder="juan@email.com" /></div>
                <div class="field">
                  <label>Valid ID Type</label>
                  <select v-model="form.idType" class="inp">
                    <option value="philid">PhilID / National ID</option>
                    <option value="passport">Passport</option>
                    <option value="drivers">Driver's License</option>
                  </select>
                </div>
                <div class="field full-w"><label>Special Requests</label><input v-model="form.requests" class="inp" placeholder="e.g. late check-in, cottage preference…" /></div>
              </div>
            </div>
          </div>

          <!-- Price summary -->
          <div class="detail-side">
            <div class="card summary sticky">
              <h3>Price details</h3>
              <div class="sum-rows">
                <div class="sum-row" v-if="selectedFeeObj">
                  <span>Entrance — {{ selectedFeeObj.name }} × {{ pax }} guest{{ pax > 1 ? 's' : '' }}</span>
                  <b>{{ peso(entranceTotal) }}</b>
                </div>
                <div class="sum-row" v-else><span>Entrance</span><span>—</span></div>
                <div class="sum-row" v-if="bookingType === 'accommodation' && selectedRoomObj">
                  <span>{{ selectedRoomObj.name }} × {{ nights }} night{{ nights > 1 ? 's' : '' }}</span>
                  <b>{{ peso(stayTotal) }}</b>
                </div>
              </div>
              <div class="sum-total"><span>Total</span><b>{{ peso(total) }}</b></div>
              <p class="hint center">Pay at the resort — Cash, GCash, or Card.</p>
              <button class="btn-rose w-full mt" :disabled="!canProceed" @click="goReview">
                {{ bookingType === 'accommodation' && !selectedRoomId ? 'Select a room' : 'Continue to review' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ══════════════════ STEP 4 · REVIEW & CONFIRM ══════════════════ -->
    <template v-else-if="step === 'review' && selectedHotel">
      <div class="fade-in">
        <div class="crumb-row">
          <button class="linklike" @click="step = 'booking'">← Back</button>
          <span class="step-pill">Step 2 of 2 · Confirm</span>
        </div>

        <div class="detail-grid">
          <div class="detail-main">
            <h1 class="detail-title sm">Confirm and reserve</h1>

            <div v-if="errorMsg" class="error-banner">{{ errorMsg }}</div>

            <div class="card sec">
              <h3 class="sec-h">Payment method</h3>
              <p class="hint" style="margin-bottom:10px">No online payment is collected here — you pay when you arrive at the resort.</p>
              <div class="pay-tiles">
                <div class="pay-tile"><span class="pt-emoji">💵</span><b>Cash</b><small>On arrival</small></div>
                <div class="pay-tile"><span class="pt-emoji">📱</span><b>GCash</b><small>On arrival</small></div>
                <div class="pay-tile"><span class="pt-emoji">💳</span><b>Card</b><small>On arrival</small></div>
              </div>
            </div>

            <div class="card sec">
              <h3 class="sec-h">Cancellation & terms</h3>
              <p class="hint">Free cancellation up to 48 hours before your visit — coordinate directly with the resort. Your slot is reserved once the resort confirms your request.</p>
              <div class="terms">
                <input type="checkbox" v-model="form.terms" id="sb-terms" />
                <label for="sb-terms">I agree to the <b>Resort Terms & Conditions</b> and the cancellation policy.</label>
              </div>
            </div>
          </div>
          <div class="detail-side">
            <div class="card summary sticky">
              <div class="rev-head">
                <img v-if="selectedHotel.image || (selectedHotel.gallery && selectedHotel.gallery[0])" :src="selectedHotel.image || selectedHotel.gallery[0]" class="rev-thumb" />
                <div>
                  <div class="rev-eyebrow">{{ selectedHotel.name }}</div>
                  <div class="rev-loc">{{ selectedHotel.location }}</div>
                  <div class="rev-type">{{ bookingType === 'entrance' ? '🎟️ Entrance Only' : '🛏️ ' + (selectedRoomObj ? selectedRoomObj.name : 'Stay') }}</div>
                </div>
              </div>
              <div class="sum-rows">
                <div class="sum-row"><span>Dates</span><b>{{ dateRangeLabel }}</b></div>
                <div class="sum-row"><span>Guests</span><b>{{ pax }}</b></div>
                <div class="sum-row" v-if="selectedFeeObj"><span>Entrance × {{ pax }}</span><b>{{ peso(entranceTotal) }}</b></div>
                <div class="sum-row" v-if="bookingType === 'accommodation' && selectedRoomObj"><span>Room ({{ nights }}n)</span><b>{{ peso(stayTotal) }}</b></div>
              </div>
              <div class="sum-total"><span>Total</span><b>{{ peso(total) }}</b></div>
              <button class="btn-rose w-full mt" :disabled="!canConfirm || submitting" @click="confirmBooking">
                <span v-if="submitting">Sending…</span><span v-else>Send reservation request</span>
              </button>
              <p class="hint center">You won't be charged — the resort will review and confirm your booking.</p>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Fallback -->
    <div v-else class="state-box">
      <div class="state-emoji">🏝️</div>
      <p>This listing is no longer available.</p>
      <button class="btn-ghost" @click="backToBrowse">Back to listings</button>
    </div>

    <!-- ══════════════════ IMAGE LIGHTBOX ══════════════════ -->
    <Teleport to="body">
      <Transition name="lb">
        <div v-if="lightboxOpen" class="lb-backdrop" @click.self="closeLightbox">
          <div class="lb-modal" role="dialog" aria-modal="true" :aria-label="lightboxTitle || 'Photo viewer'">
            <button ref="lbCloseBtn" class="lb-close" @click="closeLightbox" aria-label="Close photos">✕</button>
            <div v-if="lightboxTitle" class="lb-title">{{ lightboxTitle }}</div>
            <div class="lb-frame" @touchstart.passive="lbTouchStart" @touchend.passive="lbTouchEnd">
              <button v-if="lightboxImages.length > 1" class="lb-arrow left" @click="prevImg" aria-label="Previous photo">‹</button>
              <div class="lb-track" :style="{ transform: `translateX(-${lightboxIndex * 100}%)` }">
                <img v-for="(img, i) in lightboxImages" :key="i" :src="img" :alt="`${lightboxTitle} — photo ${i + 1}`" draggable="false" />
              </div>
              <button v-if="lightboxImages.length > 1" class="lb-arrow right" @click="nextImg" aria-label="Next photo">›</button>
              <div v-if="lightboxImages.length > 1" class="lb-counter">{{ lightboxIndex + 1 }} / {{ lightboxImages.length }}</div>
              <div v-if="lightboxImages.length > 1" class="lb-dots">
                <button v-for="(img, i) in lightboxImages" :key="'d' + i" class="lb-dot" :class="{ on: i === lightboxIndex }" @click="lightboxIndex = i" :aria-label="`Photo ${i + 1}`"></button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useBookingStore } from '../../stores/useBookingStore'
import { useUserStore } from '../../stores/useUserStore'
import { API } from '../../api'

const router = useRouter()
const route = useRoute()
const store = useBookingStore()
const userStore = useUserStore()

// ── Flow state ──
const step = ref('browse')
const selectedId = ref(null)
const bookingType = ref('entrance')
const selectedFeeId = ref(null)
const selectedRoomId = ref(null)
const coverImg = ref('')
const submitting = ref(false)
const errorMsg = ref('')
const availInfo = ref(null)

const form = ref({
  visitDate: '', checkIn: '', checkOut: '',
  adults: 2, children: 0,
  name: '', email: '', phone: '', idType: 'philid',
  requests: '', terms: false
})

// ── Browse state ──
const searchQuery = ref(route.query.q || '')
const filterType = ref('')
const sortBy = ref('featured')

const hotels = computed(() => Array.isArray(store.hotels) ? store.hotels : [])
const loading = computed(() => store.loading)

const selectedHotel = computed(() => hotels.value.find(h => h.id === selectedId.value) || null)
const fees = computed(() => selectedHotel.value?.entranceFees || [])
const rooms = computed(() => selectedHotel.value?.rooms || [])
const hasFees = computed(() => fees.value.length > 0)
const hasRooms = computed(() => rooms.value.length > 0)

// ── Comments & Ratings ──
const reviews = ref([])
const reviewsLoading = ref(false)
const reviewsError = ref('')

function reviewerInitials(name) {
  if (!name) return '?'
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
function fmtDate(d) {
  if (!d) return ''
  return new Date(String(d).slice(0, 10)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
async function fetchHotelReviews() {
  const h = selectedHotel.value
  if (!h) return
  reviewsLoading.value = true
  reviewsError.value = ''
  try {
    const res = await fetch(`${API}/hotels/${h.id}/reviews`)
    if (!res.ok) throw new Error('Failed to load comments.')
    const data = await res.json()
    reviews.value = Array.isArray(data) ? data : []
  } catch (e) {
    reviewsError.value = e.message
  } finally {
    reviewsLoading.value = false
  }
}
function goWriteReview() {
  const h = selectedHotel.value
  if (!h) return
  if (userStore.token) router.push(`/user/reviews?hotel=${h.id}`)
  else router.push('/auth?redirect=' + encodeURIComponent('/user/hotels'))
}
watch(selectedId, (id) => { if (id) fetchHotelReviews() })

// ══════════ NEW: Message the resort ══════════
// Ensures a conversation exists, then opens the header's Messages popup
// (UserMessages.vue) and jumps straight into this resort's thread —
// without modifying UserHeader.vue or UserMessages.vue's template.
const MESSAGES_API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

async function openResortChat() {
  if (!userStore.token) { router.push('/auth?redirect=' + encodeURIComponent('/user/hotels')); return }
  const h = selectedHotel.value
  if (!h) return
  try {
    const res = await fetch(`${MESSAGES_API}/hotels/${h.id}/conversations`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + userStore.token }
    })
    if (!res.ok) throw new Error('Could not open the conversation.')
    const data = await res.json()
    const convId = data.conversation.id

    const popupOpen = !!document.querySelector('.msg-pop')
    if (!popupOpen) {
      // Popup closed → stash the target conversation id, then click the
      // header's envelope button. UserMessages reads the stash on mount
      // and opens the thread automatically.
      sessionStorage.setItem('baco_pending_chat', String(convId))
      document.querySelector('.hb-env')?.click()
    } else {
      // Popup already open → tell it directly via a window event
      window.dispatchEvent(new CustomEvent('baco:select-chat', { detail: { conversationId: convId } }))
    }
  } catch (e) {
    // Fallback: still open the inbox so the user isn't left hanging
    if (!document.querySelector('.msg-pop')) document.querySelector('.hb-env')?.click()
  }
}
// ══════════ END NEW ══════════

const houseRules = computed(() => (selectedHotel.value?.houseRules || '').split('\n').map(s => s.trim()).filter(Boolean))
const galleryThumbs = computed(() => {
  const g = selectedHotel.value?.gallery || []
  return g.length ? g : (selectedHotel.value?.image ? [selectedHotel.value.image] : [])
})

const minFeePrice = computed(() => fees.value.length ? Math.min(...fees.value.map(f => Number(f.price))) : null)
const minRoomPrice = computed(() => rooms.value.length ? Math.min(...rooms.value.map(r => Number(r.price))) : null)

const filteredHotels = computed(() => {
  let out = hotels.value.filter(h =>
    h.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    (h.location || '').toLowerCase().includes(searchQuery.value.toLowerCase())
  )
  if (filterType.value === 'daytour') out = out.filter(h => (h.entranceFees || []).length > 0)
  else if (filterType.value === 'overnight') out = out.filter(h => !!h.hasRooms)
  if (sortBy.value !== 'featured') {
    const dir = sortBy.value === 'price-asc' ? 1 : -1
    out = [...out].sort((a, b) => (cardPrice(a) - cardPrice(b)) * dir)
  }
  return out
})

// ── Pricing (mirrors backend: fee × pax + room × nights) ──
const selectedFeeObj = computed(() => fees.value.find(f => f.id === selectedFeeId.value) || null)
const selectedRoomObj = computed(() => rooms.value.find(r => r.id === selectedRoomId.value) || null)
const pax = computed(() => Math.max(1, (parseInt(form.value.adults) || 1) + (parseInt(form.value.children) || 0)))
const nights = computed(() => {
  if (!form.value.checkIn || !form.value.checkOut) return 0
  return Math.max(0, Math.round((new Date(form.value.checkOut) - new Date(form.value.checkIn)) / 86400000))
})
const entranceTotal = computed(() => selectedFeeObj.value ? Number(selectedFeeObj.value.price) * pax.value : 0)
const stayTotal = computed(() => (bookingType.value === 'accommodation' && selectedRoomObj.value && nights.value > 0)
  ? Number(selectedRoomObj.value.price) * nights.value : 0)
const total = computed(() => entranceTotal.value + stayTotal.value)

// ── Timezone-safe "today" (local time, not UTC) ──
function localTodayStr() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}
const minDate = computed(() => localTodayStr())

const dateRangeLabel = computed(() => {
  if (bookingType.value === 'entrance') return form.value.visitDate ? fmtLong(form.value.visitDate) : '—'
  if (!form.value.checkIn || !form.value.checkOut) return '—'
  return `${fmtShort(form.value.checkIn)} – ${fmtShort(form.value.checkOut)}`
})

// ── Helpers ──
const peso = (n) => '₱' + Number(n || 0).toLocaleString()
function fmtShort(d) { return new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
function fmtLong(d) { return new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
function isPast(d) { return new Date(d + 'T00:00:00') < (() => { const t = new Date(); t.setHours(0, 0, 0, 0); return t })() }

function cardPrice(h) {
  const f = (h.entranceFees || []).map(x => Number(x.price))
  const r = (h.rooms || []).map(x => Number(x.price))
  if (f.length) return Math.min(...f)
  if (r.length) return Math.min(...r)
  return Number(h.basePrice || 0)
}
function cardPriceLabel(h) {
  if ((h.entranceFees || []).length) return 'per person entrance'
  if (h.hasRooms) return '/ night'
  return 'starting rate'
}

// ── Step navigation ──
function scrollTop() { nextTick(() => window.scrollTo({ top: 0, behavior: 'smooth' })) }

function openDetail(h) {
  selectedId.value = h.id
  coverImg.value = h.image || (h.gallery && h.gallery[0]) || ''
  bookingType.value = hasFees.value ? 'entrance' : (hasRooms.value ? 'accommodation' : 'entrance')
  selectedFeeId.value = hasFees.value ? fees.value[0].id : null
  selectedRoomId.value = hasRooms.value ? rooms.value[0].id : null
  errorMsg.value = ''; availInfo.value = null
  form.value.visitDate = ''; form.value.checkIn = ''; form.value.checkOut = ''
  form.value.requests = ''; form.value.terms = false
  if (userStore.user) {
    form.value.name = userStore.user.fullName || ''
    form.value.email = userStore.user.email || ''
    form.value.phone = userStore.user.phone || ''
  }
  step.value = 'detail'
  scrollTop()
}
function backToBrowse() { step.value = 'browse'; selectedId.value = null; scrollTop() }

function selectBookingType(t) {
  bookingType.value = t
  errorMsg.value = ''
  if (t === 'accommodation' && !selectedRoomId.value && rooms.value.length) selectedRoomId.value = rooms.value[0].id
}
function startBooking() {
  errorMsg.value = ''; availInfo.value = null
  step.value = 'booking'
  scrollTop()
}

// ── Availability (accommodation only) ──
async function checkAvail() {
  if (bookingType.value !== 'accommodation' || !selectedRoomId.value || !form.value.checkIn || !form.value.checkOut || nights.value < 1) {
    availInfo.value = null
    return
  }
  availInfo.value = await store.checkAvailability(selectedRoomId.value, form.value.checkIn, form.value.checkOut)
}
watch([selectedRoomId, () => form.value.checkIn, () => form.value.checkOut], () => { if (step.value === 'booking') checkAvail() })
watch(step, (s) => { if (s === 'booking' && bookingType.value === 'accommodation') checkAvail() })

// ── Gate conditions ──
const canProceed = computed(() => {
  const f = form.value
  if (bookingType.value === 'entrance') {
    return hasFees.value && !!selectedFeeId.value && !!f.visitDate && !isPast(f.visitDate)
  }
  if (!selectedRoomId.value || nights.value < 1) return false
  if (hasFees.value && !selectedFeeId.value) return false
  if (isPast(f.checkIn)) return false
  return !availInfo.value || availInfo.value.available > 0
})
const canConfirm = computed(() => {
  const f = form.value
  return f.terms && f.name.trim() && f.email.trim() && f.phone.trim() && canProceed.value
})

function goReview() {
  errorMsg.value = ''
  const f = form.value
  if (!f.name.trim() || !f.email.trim() || !f.phone.trim()) { errorMsg.value = 'Please complete your name, contact number, and email.'; return }
  if (bookingType.value === 'entrance') {
    if (!selectedFeeId.value) { errorMsg.value = 'Please choose an entrance fee type.'; return }
    if (!f.visitDate) { errorMsg.value = 'Please select your visit date.'; return }
    if (isPast(f.visitDate)) { errorMsg.value = 'Visit date cannot be in the past.'; return }
  } else {
    if (!selectedRoomId.value) { errorMsg.value = 'Please choose a room type.'; return }
    if (!f.checkIn || !f.checkOut) { errorMsg.value = 'Please select check-in and check-out dates.'; return }
    if (nights.value < 1) { errorMsg.value = 'Check-out must be after check-in.'; return }
    if (hasFees.value && !selectedFeeId.value) { errorMsg.value = 'Please choose an entrance fee type (included with your stay).'; return }
    if (availInfo.value && availInfo.value.available <= 0) { errorMsg.value = 'That room is fully booked for the selected dates.'; return }
  }
  step.value = 'review'
  scrollTop()
}

// ── Submit → POST /hotels/book via store ──
async function confirmBooking() {
  errorMsg.value = ''
  if (!userStore.token) { router.push('/auth'); return }
  const f = form.value
  const base = {
    hotelId: selectedHotel.value.id,
    adults: f.adults, children: f.children,
    guestName: f.name, guestEmail: f.email, guestContact: f.phone,
    guestIdType: f.idType, specialRequests: f.requests,
    paymentMethod: 'on_arrival'
  }
  const payload = bookingType.value === 'entrance'
    ? { ...base, bookingType: 'entrance', entranceFeeId: selectedFeeId.value, visitDate: f.visitDate }
    : { ...base, bookingType: 'accommodation', entranceFeeId: selectedFeeId.value || null, roomId: selectedRoomId.value, checkIn: f.checkIn, checkOut: f.checkOut }

  submitting.value = true
  try {
    await store.submitBooking(userStore.token, payload)
    step.value = 'browse'; selectedId.value = null
    router.push('/user/hotels/confirmation')
  } catch (e) {
    errorMsg.value = e.message || 'Booking failed. Please try again.'
  }
  submitting.value = false
}

// ── Image lightbox ──
const lightboxOpen = ref(false)
const lightboxImages = ref([])
const lightboxIndex = ref(0)
const lightboxTitle = ref('')
const lbCloseBtn = ref(null)

function roomImages(r) {
  const out = []
  if (r?.image) out.push(r.image)
  if (Array.isArray(r?.gallery)) out.push(...r.gallery.filter(Boolean))
  return [...new Set(out)] // dedupe image + gallery[0]
}

function openLightbox(images, index = 0, title = '') {
  if (!images || !images.length) return
  lightboxImages.value = images
  lightboxIndex.value = Math.max(0, Math.min(index, images.length - 1))
  lightboxTitle.value = title
  lightboxOpen.value = true
  document.body.style.overflow = 'hidden'
  nextTick(() => lbCloseBtn.value?.focus())
}
function closeLightbox() {
  lightboxOpen.value = false
  document.body.style.overflow = ''
}
function nextImg() { if (lightboxImages.value.length) lightboxIndex.value = (lightboxIndex.value + 1) % lightboxImages.value.length }
function prevImg() { if (lightboxImages.value.length) lightboxIndex.value = (lightboxIndex.value - 1 + lightboxImages.value.length) % lightboxImages.value.length }

function onLbKey(e) {
  if (e.key === 'Escape') closeLightbox()
  else if (e.key === 'ArrowRight') nextImg()
  else if (e.key === 'ArrowLeft') prevImg()
}
watch(lightboxOpen, (open) => {
  if (open) window.addEventListener('keydown', onLbKey)
  else window.removeEventListener('keydown', onLbKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onLbKey)
  document.body.style.overflow = ''
})

// Touch swipe
let lbTouchX = 0
function lbTouchStart(e) { lbTouchX = e.changedTouches[0].clientX }
function lbTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - lbTouchX
  if (Math.abs(dx) > 40) (dx < 0 ? nextImg() : prevImg())
}

// ── Init ──
onMounted(async () => {
  await store.fetchHotels()
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════
   PAGE SHELL — the big rounded "background panel"
   Tune the whole look from these knobs:
   ═══════════════════════════════════════════════ */
   .sb-root {
  --rose: var(--bb-accent);
  --rose-dark: var(--bb-accent-hover);
  --line: var(--bb-border);

  /* 🔘 roundness knobs */
  --shell-radius: 18px;                /* page panel corners  */
  --shell-pad: clamp(12px, 2vw, 20px); /* space inside panel  */
  --shell-gap: 10px;                   /* space around panel  */
  --card-r: 12px;                      /* big cards / cover   */
  --ctl-r: 8px;                        /* inputs & selects    */

  /* 🟢 green-tint knobs — 0% = original neutral glass look */
  --tint-shell: 6%;   /* outer page panel                      */
  --tint-card: 11%;   /* big cards: listings, info, summary…   */
  --tint-soft: 7%;    /* inner: options, chips, tiles, inputs  */

  /* Resolved surfaces (neutral fallbacks; greened via @supports below).
     Every element below consumes ONLY these 5 vars — change them here once. */
  --bg-shell: var(--bb-glass-bg-strong);
  --bg-card: var(--bb-glass-bg-strong);
  --bg-soft: var(--bb-glass-bg);
  --bd-tint: var(--bb-glass-border);
  --bd-tint-strong: var(--bb-border-strong);

  position: relative;
  background: var(--bg-shell);
  border: 1px solid var(--bd-tint);
  border-radius: var(--shell-radius);
  padding: var(--shell-pad);
  margin: var(--shell-gap);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .06), var(--bb-glass-shadow);
  color: var(--bb-ink);
  font-family: var(--bb-font-body);
  -webkit-font-smoothing: antialiased;
}
/* Green-tint every surface, derived from YOUR --bb-accent token.
   @supports keeps older browsers on the neutral fallback above. */
@supports (background: color-mix(in srgb, red, blue)) {
  .sb-root {
    --bg-shell:       color-mix(in srgb, var(--bb-accent) var(--tint-shell), var(--bb-glass-bg-strong));
    --bg-card:        color-mix(in srgb, var(--bb-accent) var(--tint-card),  var(--bb-glass-bg-strong));
    --bg-soft:        color-mix(in srgb, var(--bb-accent) var(--tint-soft),  var(--bb-glass-bg));
    --bd-tint:        color-mix(in srgb, var(--bb-accent) 18%, var(--bb-glass-border));
    --bd-tint-strong: color-mix(in srgb, var(--bb-accent) 28%, var(--bb-border-strong));
  }
}

.sb-root, .sb-root * { box-sizing: border-box; }
.sb-root button, .sb-root input, .sb-root select { font-family: inherit; }
/* NOTE: no overflow:hidden here on purpose — it would break the sticky summary card. */

.fade-in { animation: fadeIn .4s cubic-bezier(.22,.61,.36,1) both; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* ══════════ Buttons (pill) ══════════ */
.btn-rose {
  background: var(--rose); color: var(--bb-on-accent); font-weight: var(--bb-weight-bold);
  padding: 11px 26px; border-radius: 999px; border: none; cursor: pointer;
  font-size: var(--bb-text-base);
  box-shadow: 0 6px 16px -8px rgba(0,0,0,.4);
  transition: background .2s, transform .15s ease, box-shadow .2s, opacity .2s;
}
.btn-rose:hover:not(:disabled) { background: var(--rose-dark); transform: translateY(-1px); box-shadow: 0 10px 22px -8px rgba(0,0,0,.45); }
.btn-rose:active:not(:disabled) { transform: translateY(0) scale(.98); }
.btn-rose:disabled { opacity: .45; cursor: not-allowed; box-shadow: none; }
.btn-rose.sm { padding: 8px 20px; font-size: var(--bb-text-sm); }

.btn-ghost {
  border: 1px solid var(--bd-tint-strong);
  background: var(--bb-surface);
  border-radius: 999px; padding: 10px 22px; font-size: var(--bb-text-base); font-weight: var(--bb-weight-semibold);
  cursor: pointer; color: var(--bb-text-secondary);
  transition: background .2s, color .2s, transform .15s;
}
.btn-ghost:hover { background: var(--bb-accent-soft); color: var(--bb-accent-ink); transform: translateY(-1px); }

.linklike {
  background: none; border: none; color: var(--bb-text-secondary);
  font-size: var(--bb-text-base); font-weight: var(--bb-weight-semibold); cursor: pointer;
  padding: 0; margin-bottom: 0;
  transition: color .2s;
}
.linklike:hover { color: var(--bb-accent-ink); text-decoration: underline; }

.w-full { width: 100%; }
.mt { margin-top: 14px; }
.mt-sm { margin-top: 4px; }

.crumb-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.step-pill {
  font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-extrabold); text-transform: uppercase; letter-spacing: .07em;
  color: var(--bb-accent-ink); background: var(--bb-accent-soft);
  padding: 5px 14px; border-radius: 999px; white-space: nowrap;
}

.sb-root button:focus-visible,
.sb-root input:focus-visible,
.sb-root select:focus-visible { outline: 2px solid var(--bb-accent); outline-offset: 2px; }

/* ══════════ Toolbar ══════════ */
.toolbar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 14px 16px; margin-bottom: 18px;
  background: var(--bb-bg-subtle);
  border: 1px solid var(--bd-tint);
  border-radius: 20px;
  box-shadow: var(--bb-glass-shadow);
}
.search-wrap { position: relative; flex: 1; min-width: 220px; }
.search-wrap svg { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--bb-text-tertiary); pointer-events: none; transition: color .2s; }
.search-wrap input {
  width: 100%; padding: 11px 16px 11px 38px;
  border: 1px solid var(--bd-tint); border-radius: 999px;
  font-size: var(--bb-text-base);
  background: var(--bb-surface); color: var(--bb-ink);
  transition: border-color .2s, box-shadow .2s, background .2s;
}
.search-wrap input::placeholder { color: var(--bb-text-tertiary); }
.search-wrap input:focus { border-color: var(--bb-accent); outline: none; box-shadow: 0 0 0 3px var(--bb-accent-soft); }
.search-wrap:focus-within svg { color: var(--bb-accent-ink); }

.filter-chips { display: flex; gap: 6px; }
.chip {
  padding: 9px 18px; border-radius: 999px;
  border: 1px solid var(--bd-tint); background: var(--bb-surface);
  font-size: var(--bb-text-sm); font-weight: var(--bb-weight-semibold); cursor: pointer;
  color: var(--bb-text-secondary);
  transition: all .2s;
}
.chip:hover { background: var(--bb-accent-soft); color: var(--bb-ink); transform: translateY(-1px); }
.chip.active {
  background: var(--bb-accent); color: var(--bb-on-accent); border-color: var(--bb-accent);
  box-shadow: 0 4px 12px -4px rgba(0,0,0,.35);
}
.sort-select {
  padding: 10px 14px; border: 1px solid var(--bd-tint); border-radius: var(--ctl-r);
  background: var(--bb-surface); font-size: var(--bb-text-sm);
  color: var(--bb-text-secondary); cursor: pointer;
  transition: border-color .2s;
}
.sort-select:hover { border-color: var(--bd-tint-strong); }
.sort-select:focus { border-color: var(--bb-accent); outline: none; box-shadow: 0 0 0 3px var(--bb-accent-soft); }

.count-line {
  display: flex; align-items: center; gap: 9px;
  font-size: var(--bb-text-lg); font-weight: var(--bb-weight-bold); margin: 2px 0 16px; color: var(--bb-text-secondary);
}
.count-line::before {
  content: ''; width: 8px; height: 8px; border-radius: 50%;
  background: var(--bb-accent); box-shadow: 0 0 0 3px var(--bb-accent-soft);
  flex-shrink: 0;
}

/* ══════════ Cards grid ══════════ */
.grid-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.gcard {
  animation: cardIn .5s ease backwards;
  background: var(--bb-surface);
  border: 1px solid var(--bd-tint);
  border-radius: var(--card-r);
  overflow: hidden; cursor: pointer; display: flex; flex-direction: column;
  box-shadow: var(--bb-glass-shadow);
  transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
}
@keyframes cardIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
.grid-cards .gcard:nth-child(1) { animation-delay: .02s; }
.grid-cards .gcard:nth-child(2) { animation-delay: .06s; }
.grid-cards .gcard:nth-child(3) { animation-delay: .1s; }
.grid-cards .gcard:nth-child(4) { animation-delay: .14s; }
.grid-cards .gcard:nth-child(5) { animation-delay: .18s; }
.grid-cards .gcard:nth-child(6) { animation-delay: .22s; }
.grid-cards .gcard:nth-child(7) { animation-delay: .26s; }
.grid-cards .gcard:nth-child(8) { animation-delay: .3s; }
.grid-cards .gcard:nth-child(n+9) { animation-delay: .34s; }

.card-hover:hover { transform: translateY(-5px); box-shadow: var(--bb-glass-lg); border-color: var(--bd-tint-strong); }

.gcard-img { position: relative; aspect-ratio: 16/10; background: var(--bb-bg-subtle); overflow: hidden; }
.gcard-img::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(0,0,0,.08) 0%, transparent 35%, rgba(0,0,0,.32) 100%);
  pointer-events: none;
}
.gcard-img img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .5s cubic-bezier(.22,.61,.36,1); }
.gcard:hover .gcard-img img { transform: scale(1.06); }
.img-fallback { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--bb-text-tertiary); font-size: var(--bb-text-base); }
.img-fallback.tall { min-height: 280px; }

.badge-row { position: absolute; top: 10px; left: 10px; display: flex; gap: 5px; z-index: 2; }
/* Mint pill on deep text — the Travelio badge treatment */
.bpill {
  padding: 4px 10px; border-radius: 999px; font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-extrabold);
  color: var(--eco-deep); -webkit-text-fill-color: var(--eco-deep);
  box-shadow: 0 2px 8px rgba(0,0,0,.18);
}
.bpill.tour { background: var(--eco-mint); }
.bpill.stay { background: var(--eco-deepest); color: var(--eco-pale); -webkit-text-fill-color: var(--eco-pale); }

.gcard-rating {
  position: absolute; top: 10px; right: 10px; z-index: 2;
  display: flex; align-items: baseline; gap: 4px;
  /* Denser scrim instead of blur(6px): this badge repeats once per card
     in a scrolling grid, so a blur here is paid N times every frame. */
  background: rgba(0,0,0,.66);
  color: #fff; padding: 4px 10px; border-radius: 999px;
  font-size: var(--bb-text-xs); font-weight: var(--bb-weight-extrabold); white-space: nowrap;
}
.gr-count { font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-semibold); opacity: .85; }

.gcard-body { padding: 14px 16px 16px; display: flex; flex-direction: column; flex: 1; }
.gcard-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.gcard-top h3 {
  font-size: var(--bb-text-lg); font-weight: var(--bb-weight-extrabold); margin: 0 0 4px; line-height: 1.35;
  color: var(--bb-ink);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.gcard-loc { color: var(--bb-text-secondary); font-size: var(--bb-text-xs); margin: 0 0 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gcard-meta { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 8px; }
.gcard-meta span {
  font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-semibold); color: var(--bb-text-secondary);
  background: var(--bb-bg-subtle); border: 1px solid var(--bd-tint);
  padding: 3px 9px; border-radius: 999px; white-space: nowrap;
}
.gcard-price {
  margin-top: auto; padding-top: 12px; border-top: 1px solid var(--bd-tint);
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
}
.gcard-price .price { font-size: var(--bb-text-xl); font-weight: var(--bb-weight-extrabold); color: var(--bb-accent-ink); letter-spacing: var(--bb-track-tight); }
.gcard-price .per { font-size: var(--bb-text-xs); color: var(--bb-text-tertiary); margin-left: 4px; }

/* ══════════ States ══════════ */
.state-box {
  display: flex; flex-direction: column; align-items: center; gap: 14px;
  padding: 60px 20px; color: var(--bb-text-secondary); text-align: center;
  background: var(--bb-bg-subtle); border: 1px dashed var(--bd-tint);
  border-radius: var(--card-r);
}
.state-emoji {
  width: 84px; height: 84px; border-radius: 50%;
  background: var(--bb-accent-soft);
  display: grid; place-items: center; font-size: var(--bb-text-4xl);
}
.spinner {
  width: 36px; height: 36px;
  border: 3px solid var(--bd-tint); border-top-color: var(--bb-accent);
  border-radius: 50%; animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ══════════ Detail layout ══════════ */
.detail-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 28px; align-items: start; }
.detail-cover {
  position: relative; border-radius: var(--card-r); overflow: hidden;
  aspect-ratio: 16/8; background: var(--bb-bg-subtle); margin-bottom: 12px;
  box-shadow: var(--bb-glass-shadow);
}
.detail-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.detail-cover::after {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(180deg, transparent 55%, rgba(0,0,0,.2) 100%);
  border-radius: inherit;
}
.cover-expand {
  position: absolute; right: 12px; bottom: 12px; z-index: 2;
  display: inline-flex; align-items: center; gap: 6px;
  border: none; cursor: pointer;
  background: rgba(0,0,0,.55); color: #fff;
  font-size: var(--bb-text-xs); font-weight: var(--bb-weight-bold);
  padding: 8px 15px; border-radius: 999px;
  transition: background .2s, transform .15s;
}
.cover-expand:hover { background: var(--bb-accent); transform: translateY(-1px); }

.thumb-row { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
.thumb {
  width: 76px; height: 56px; object-fit: cover; border-radius: 12px;
  cursor: pointer; border: 2px solid transparent; opacity: .75; flex-shrink: 0;
  transition: opacity .2s, border-color .2s, transform .2s;
}
.thumb:hover { opacity: 1; transform: translateY(-2px); }
.thumb.active { border-color: var(--bb-accent); opacity: 1; }

.detail-title { font-size: var(--bb-text-3xl); font-weight: var(--bb-weight-extrabold); margin: 14px 0 6px; color: var(--bb-ink); letter-spacing: -.02em; line-height: 1.2; }
.detail-title.sm { font-size: var(--bb-text-2xl); margin-top: 4px; }
.detail-loc { color: var(--bb-text-secondary); font-size: var(--bb-text-base); font-weight: var(--bb-weight-medium); margin: 0 0 14px; }
.detail-desc { color: var(--bb-text-secondary); line-height: 1.75; font-size: var(--bb-text-md); margin: 0 0 10px; max-width: 65ch; }

.detail-section { border-top: 1px solid var(--bd-tint); padding: 20px 0; }
.detail-section h3 {
  font-size: var(--bb-text-lg); font-weight: var(--bb-weight-extrabold); margin: 0 0 14px; color: var(--bb-ink);
  display: flex; align-items: center; gap: 10px; letter-spacing: var(--bb-track-tight);
}
.detail-section h3::before {
  content: ''; width: 4px; height: 17px; border-radius: 99px; flex-shrink: 0;
  background: linear-gradient(180deg, var(--bb-accent), var(--bb-accent-soft));
}

/* ── Amenities — darker chip, clearly visible border ── */
.amenity-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; }
.amenity {
  display: flex; align-items: center; gap: 9px; font-size: var(--bb-text-base); color: var(--bb-text-secondary);
  background: var(--bb-bg-subtle);
  border: 1.5px solid var(--bd-tint-strong);
  border-radius: 14px;
  padding: 9px 12px;
  transition: border-color .2s, background .2s, transform .15s;
}
.amenity:hover { border-color: var(--bb-accent); transform: translateY(-1px); }
.amenity svg { flex-shrink: 0; }

/* ── House Rules — same visible chip treatment on each rule ── */
.rules-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.rules-list li {
  display: flex; gap: 10px; font-size: var(--bb-text-base); color: var(--bb-text-secondary); line-height: 1.5;
  background: var(--bb-bg-subtle);
  border: 1.5px solid var(--bd-tint-strong);
  border-radius: 14px;
  padding: 9px 13px;
  transition: border-color .2s, background .2s;
}
.rules-list li:hover { border-color: var(--bb-accent); }
.rules-list .dot { color: var(--bb-accent-ink); font-weight: var(--bb-weight-extrabold); }

.room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(235px, 1fr)); gap: 14px; }
.droom {
  border: 1px solid var(--bd-tint); border-radius: 18px;
  overflow: hidden; background: var(--bb-surface);
  box-shadow: var(--bb-glass-shadow);
  transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
}
.droom:hover { transform: translateY(-3px); box-shadow: var(--bb-glass-lg); border-color: var(--bd-tint-strong); }
.droom-img { position: relative; aspect-ratio: 16/9; background: var(--bb-bg-subtle); overflow: hidden; }
.droom-img img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .45s; }
.droom:hover .droom-img img { transform: scale(1.05); }
.droom-img.zoomable { cursor: zoom-in; }
.droom-img.zoomable:focus-visible { outline: 2px solid var(--bb-accent); outline-offset: 2px; }
.zoom-hint {
  position: absolute; right: 8px; bottom: 8px; z-index: 2;
  width: 27px; height: 27px; border-radius: 999px;
  background: rgba(0,0,0,.55); color: #fff;
  display: grid; place-items: center;
  opacity: 0; transform: translateY(4px);
  transition: opacity .2s, transform .2s;
  pointer-events: none;
}
.droom:hover .zoom-hint, .droom-img.zoomable:focus-visible .zoom-hint { opacity: 1; transform: translateY(0); }
.droom-body { padding: 13px 15px; }
.droom-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 7px; }
.droom-top h4 { font-size: var(--bb-text-md); font-weight: var(--bb-weight-bold); margin: 0; color: var(--bb-ink); }
.rtype {
  font-size: var(--bb-text-2xs); background: var(--bb-bg-subtle); border: 1px solid var(--bd-tint); padding: 3px 9px;
  border-radius: 999px; color: var(--bb-text-secondary); font-weight: var(--bb-weight-bold); white-space: nowrap;
}
.droom-bottom { display: flex; justify-content: space-between; align-items: baseline; font-size: var(--bb-text-xs); color: var(--bb-text-secondary); }
.droom-price { font-size: var(--bb-text-lg); font-weight: var(--bb-weight-extrabold); color: var(--bb-accent-ink); }
.droom-price small { font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-medium); color: var(--bb-text-tertiary); }

/* ══════════ Cards & options ══════════ */
.card {
  background: var(--bb-surface);
  border: 1px solid var(--bd-tint);
  border-radius: var(--card-r); padding: 14px 16px;
  box-shadow: var(--bb-glass-shadow);
}
.detail-side .card { margin-bottom: 14px; }
.sticky { position: sticky; top: 20px; }

.book-card, .summary { position: relative; overflow: hidden; }
.book-card::before, .summary::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, var(--bb-accent), var(--bb-accent-soft) 70%, transparent);
}
.book-card h3, .summary h3 {
  font-size: var(--bb-text-xl); font-weight: var(--bb-weight-extrabold); margin: 2px 0 6px; color: var(--bb-ink);
  display: flex; align-items: center; gap: 10px; letter-spacing: var(--bb-track-tight);
}
.book-card h3::before, .summary h3::before {
  content: ''; width: 4px; height: 17px; border-radius: 99px; flex-shrink: 0;
  background: linear-gradient(180deg, var(--bb-accent), var(--bb-accent-soft));
}
.book-sub { font-size: var(--bb-text-sm); color: var(--bb-text-secondary); margin: 0 0 14px; }
.book-foot {
  border-top: 1px solid var(--bd-tint); margin-top: 16px; padding-top: 13px;
  display: flex; flex-direction: column; gap: 7px; font-size: var(--bb-text-sm);
}
.book-foot > div { display: flex; justify-content: space-between; }
.book-foot span { color: var(--bb-text-secondary); }
.book-foot b { font-weight: var(--bb-weight-bold); color: var(--bb-ink); }
.sec { margin-bottom: 18px; }
.sec-h {
  font-size: var(--bb-text-lg); font-weight: var(--bb-weight-extrabold); margin: 0 0 14px;
  display: flex; align-items: center; gap: 10px; color: var(--bb-ink); letter-spacing: var(--bb-track-tight);
}
.sec-h::before {
  content: ''; width: 4px; height: 16px; border-radius: 99px; flex-shrink: 0;
  background: linear-gradient(180deg, var(--bb-accent), var(--bb-accent-soft));
}
.req-badge {
  font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-extrabold); text-transform: uppercase; letter-spacing: .06em;
  color: var(--bb-accent-ink); background: var(--bb-accent-soft);
  padding: 3px 9px; border-radius: 999px;
}

.opt {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 15px; border-radius: 16px;
  background: var(--bb-bg-subtle); border: 2px solid var(--bd-tint);
  cursor: pointer; margin-bottom: 8px;
  transition: border-color .2s, background .2s, transform .15s, box-shadow .2s;
}
.opt:hover:not(.dis) { border-color: var(--bd-tint-strong); transform: translateY(-1px); }
.opt.sel {
  border-color: var(--bb-accent); background: var(--bb-accent-soft);
  box-shadow: 0 4px 14px -6px rgba(0,0,0,.18);
}
.opt.dis { opacity: .5; cursor: not-allowed; }
.opt.full { width: 100%; text-align: left; margin-bottom: 10px; position: relative; }
.opt.full.sel::after {
  content: '✓'; position: absolute; top: 50%; right: 14px; transform: translateY(-50%);
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--bb-accent); color: var(--bb-on-accent);
  display: grid; place-items: center;
  font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-extrabold);
  box-shadow: 0 2px 8px rgba(0,0,0,.25);
}
.opt input { accent-color: var(--bb-accent); width: 16px; height: 16px; flex-shrink: 0; cursor: pointer; }
.opt-emoji { font-size: var(--bb-text-2xl); flex-shrink: 0; }
.opt-text { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.opt-text b { font-size: var(--bb-text-base); color: var(--bb-ink); }
.opt-text small { font-size: var(--bb-text-2xs); color: var(--bb-text-secondary); }
.opt-price { font-weight: var(--bb-weight-extrabold); font-size: var(--bb-text-base); color: var(--bb-accent-ink); white-space: nowrap; }
.opt-price small { font-weight: var(--bb-weight-semibold); color: var(--bb-text-secondary); font-size: var(--bb-text-2xs); }
.opt-thumb { width: 54px; height: 46px; border-radius: 10px; object-fit: cover; flex-shrink: 0; cursor: zoom-in; }
.opt-list { display: flex; flex-direction: column; }

/* ══════════ Forms ══════════ */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.full-w { grid-column: span 2; }
.field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.field label { font-size: var(--bb-text-xs); font-weight: var(--bb-weight-bold); color: var(--bb-text-secondary); text-transform: uppercase; letter-spacing: var(--bb-track-wide); }
.inp {
  width: 100%; padding: 11px 14px; min-height: 42px;
  border: 1px solid var(--bd-tint-strong); border-radius: var(--ctl-r);
  font-size: var(--bb-text-base); color: var(--bb-ink);
  background: var(--bb-surface);
  transition: border-color .2s, box-shadow .2s;
}
.inp::placeholder { color: var(--bb-text-tertiary); }
.inp:hover { border-color: var(--bb-accent); }
.inp:focus { border-color: var(--bb-accent); outline: none; box-shadow: 0 0 0 3px var(--bb-accent-soft); }
.hint { color: var(--bb-text-secondary); font-size: var(--bb-text-xs); margin: 6px 0 0; line-height: 1.5; }
.hint.center { text-align: center; }
.hint.gap { padding: 14px 0 4px; font-size: var(--bb-text-base); }

/* ══════════ Comments & Ratings ══════════ */
.rv-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
.rv-summary { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
.rv-avg {
  font-size: var(--bb-text-lg); font-weight: var(--bb-weight-extrabold); color: var(--bb-ink);
  background: var(--bb-accent-soft); padding: 3px 12px; border-radius: 999px;
}
.rv-count { font-size: var(--bb-text-xs); color: var(--bb-text-secondary); }
.rvl { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
.rvc {
  display: flex; gap: 13px; padding: 15px;
  border: 1px solid var(--bd-tint); border-radius: 16px;
  background: var(--bb-surface);
  transition: border-color .2s, box-shadow .2s;
}
.rvc:hover { border-color: var(--bd-tint-strong); box-shadow: var(--bb-glass-shadow); }
.rva {
  width: 42px; height: 42px; border-radius: 50%;
  background: var(--bb-accent-soft); color: var(--bb-accent-ink);
  display: flex; align-items: center; justify-content: center;
  font-weight: var(--bb-weight-extrabold); font-size: var(--bb-text-sm); flex-shrink: 0;
  box-shadow: 0 0 0 2px var(--bg-card), 0 0 0 3.5px var(--bb-accent-soft);
}
.rvbody { flex: 1; min-width: 0; }
.rvmeta { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; margin-bottom: 5px; }
.rvname { font-size: var(--bb-text-base); font-weight: var(--bb-weight-bold); color: var(--bb-ink); }
.rvstars { display: inline-flex; color: var(--bb-sun); font-size: var(--bb-text-sm); letter-spacing: 2px; }
.rvdate { font-size: var(--bb-text-2xs); color: var(--bb-text-tertiary); }
.rvtitle { font-size: var(--bb-text-base); font-weight: var(--bb-weight-bold); color: var(--bb-ink); margin: 0 0 4px; }
.rvcontent { font-size: var(--bb-text-sm); color: var(--bb-text-secondary); line-height: 1.65; margin: 0; white-space: pre-wrap; word-break: break-word; }

/* ══════════ NEW: Message the resort ══════════ */
.book-msg { border-top: 1px solid var(--bd-tint); margin-top: 14px; padding-top: 13px; }
.msg-resort {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 9px;
  padding: 11px 16px; border-radius: 999px;
  background: var(--bb-bg-subtle); border: 1.5px solid var(--bd-tint-strong);
  color: var(--bb-text-secondary); font-size: var(--bb-text-base); font-weight: var(--bb-weight-bold);
  cursor: pointer; transition: all .2s;
}
.msg-resort:hover {
  border-color: var(--bb-accent); color: var(--bb-accent-ink);
  background: var(--bb-accent-soft); transform: translateY(-1px);
}
.msg-resort svg { flex-shrink: 0; }

/* ══════════ Notices ══════════ */
.notice {
  background: var(--bb-warning-soft); border: 1px solid var(--bb-warning);
  border-left: 4px solid var(--bb-warning);
  color: var(--bb-warning); border-radius: 14px;
  padding: 11px 14px; font-size: var(--bb-text-sm); font-weight: var(--bb-weight-semibold); margin-bottom: 10px; line-height: 1.5;
}
.error-banner {
  background: var(--bb-danger-soft); border: 1px solid var(--bb-danger);
  border-left: 4px solid var(--bb-danger);
  color: var(--bb-danger); border-radius: 14px;
  padding: 12px 15px; font-size: var(--bb-text-sm); font-weight: var(--bb-weight-semibold); margin-bottom: 14px; line-height: 1.5;
}
.avail { margin-top: 12px; padding: 10px 14px; border-radius: 12px; font-size: var(--bb-text-sm); font-weight: var(--bb-weight-semibold); }
.avail.ok { background: var(--bb-success-soft); color: var(--bb-success); border: 1px solid var(--bb-success); border-left-width: 4px; }
.avail.no { background: var(--bb-danger-soft); color: var(--bb-danger); border: 1px solid var(--bb-danger); border-left-width: 4px; }

/* ══════════ Summary ══════════ */
.sum-rows {
  display: flex; flex-direction: column; gap: 9px; font-size: var(--bb-text-base);
  padding: 13px 0; border-top: 1px solid var(--bd-tint); margin-top: 12px;
}
.sum-row { display: flex; justify-content: space-between; gap: 10px; }
.sum-row span { color: var(--bb-text-secondary); }
.sum-row b { color: var(--bb-ink); }
.sum-total {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: var(--bb-text-xl); font-weight: var(--bb-weight-extrabold);
  border-top: 1px solid var(--bd-tint); padding-top: 13px; margin-top: 4px; color: var(--bb-ink);
}
.sum-total b { color: var(--bb-accent-ink); font-size: var(--bb-text-2xl); letter-spacing: var(--bb-track-tight); }

/* ══════════ Review step ══════════ */
.pay-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.pay-tile {
  border: 2px solid var(--bd-tint); border-radius: 16px;
  padding: 16px 10px 13px; text-align: center;
  display: flex; flex-direction: column; gap: 5px; align-items: center;
  background: var(--bb-bg-subtle);
  transition: transform .2s, border-color .2s, box-shadow .2s;
}
.pay-tile:hover { transform: translateY(-2px); border-color: var(--bd-tint-strong); box-shadow: var(--bb-glass-shadow); }
.pay-tile b { font-size: var(--bb-text-sm); color: var(--bb-ink); }
.pay-tile small { font-size: var(--bb-text-2xs); color: var(--bb-text-secondary); }
.pt-emoji {
  width: 44px; height: 44px; border-radius: 14px;
  background: var(--bb-accent-soft);
  display: grid; place-items: center; font-size: var(--bb-text-xl);
}
.terms {
  display: flex; align-items: flex-start; gap: 11px;
  background: var(--bb-warning-soft); border: 1px solid var(--bb-warning);
  border-left: 4px solid var(--bb-warning);
  border-radius: 14px; padding: 13px 15px; margin-top: 14px;
}
.terms input { margin-top: 3px; accent-color: var(--bb-accent); width: 16px; height: 16px; flex-shrink: 0; cursor: pointer; }
.terms label { font-size: var(--bb-text-xs); color: var(--bb-text-secondary); line-height: 1.55; cursor: pointer; }
.terms label b { color: var(--bb-ink); }
.rev-head { display: flex; gap: 13px; margin-bottom: 8px; align-items: center; }
.rev-thumb { width: 64px; height: 64px; border-radius: 16px; object-fit: cover; flex-shrink: 0; box-shadow: 0 4px 12px -4px rgba(0,0,0,.3); }
.rev-eyebrow {
  font-size: var(--bb-text-xs); font-weight: var(--bb-weight-extrabold); text-transform: uppercase; letter-spacing: var(--bb-track-wide);
  color: var(--bb-accent-ink);
}
.rev-loc { font-size: var(--bb-text-sm); font-weight: var(--bb-weight-semibold); color: var(--bb-ink); }
.rev-type { font-size: var(--bb-text-xs); color: var(--bb-text-secondary); margin-top: 3px; }

/* ══════════ Image lightbox ══════════ */
/* The lightbox is teleported to <body>, which puts it OUTSIDE .app-shell
   and therefore outside the portal's font-family. Without this it falls
   through to the global `:root { font-family: system-ui }` and the title
   renders in a different typeface from the rest of the stays page. */
.lb-backdrop {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,.66);
  display: grid; place-items: center; padding: 20px;
  /* Teleported to <body>, so it sits outside .app-shell and outside the
     portal's font-family. Without this the lightbox title falls through to
     the global `:root { font-family: system-ui }` and renders in a
     different typeface from the rest of the stays page. */
  font-family: var(--bb-font-body);
  -webkit-font-smoothing: antialiased;
}
.lb-modal {
  --lb-size: 280px; /* ≈ 2.9 inches — bump to 300px+ if you want it bigger */
  width: min(var(--lb-size), calc(100vw - 40px));
  background: var(--bb-surface);
  border: 1px solid var(--bd-tint);
  border-radius: 24px; padding: 10px 10px 8px;
  box-shadow: var(--bb-glass-lg), 0 30px 60px -18px rgba(0,0,0,.55);
  position: relative;
}
.lb-close {
  position: absolute; top: -11px; right: -11px; z-index: 3;
  width: 28px; height: 28px; border-radius: 50%; border: none; cursor: pointer;
  background: var(--bb-accent); color: var(--bb-on-accent);
  font-size: var(--bb-text-xs); font-weight: var(--bb-weight-extrabold);
  display: grid; place-items: center;
  box-shadow: 0 4px 12px rgba(0,0,0,.35);
  transition: transform .15s, background .2s;
}
.lb-close:hover { background: var(--bb-accent-hover); transform: scale(1.08); }
.lb-title {
  font-size: var(--bb-text-sm); font-weight: var(--bb-weight-bold); color: var(--bb-ink);
  padding: 3px 4px 9px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lb-frame {
  position: relative; aspect-ratio: 1/1; border-radius: 16px; overflow: hidden;
  background: var(--bb-bg-subtle); touch-action: pan-y;
}
.lb-track { display: flex; height: 100%; transition: transform .35s cubic-bezier(.22,.61,.36,1); }
.lb-track img { width: 100%; height: 100%; flex: 0 0 100%; object-fit: cover; display: block; user-select: none; -webkit-user-drag: none; }
.lb-arrow {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 2;
  width: 30px; height: 30px; border-radius: 50%; border: none; cursor: pointer;
  background: rgba(0,0,0,.45); color: #fff;
  font-size: var(--bb-text-xl); line-height: 0; padding-bottom: 2px;
  display: grid; place-items: center;
  transition: background .2s, transform .15s;
}
.lb-arrow:hover { background: var(--bb-accent); transform: translateY(-50%) scale(1.1); }
.lb-arrow.left { left: 8px; }
.lb-arrow.right { right: 8px; }
.lb-counter {
  position: absolute; top: 8px; right: 8px; z-index: 2;
  font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-extrabold); color: #fff; letter-spacing: var(--bb-track-tight);
  background: rgba(0,0,0,.5); backdrop-filter: blur(4px);
  padding: 3px 9px; border-radius: 999px;
}
.lb-dots { position: absolute; bottom: 9px; left: 0; right: 0; z-index: 2; display: flex; justify-content: center; gap: 5px; }
.lb-dot {
  width: 6px; height: 6px; border-radius: 50%; border: none; padding: 0; cursor: pointer;
  background: rgba(255,255,255,.45);
  transition: background .2s, transform .2s;
}
.lb-dot.on { background: #fff; transform: scale(1.35); }

.lb-enter-active, .lb-leave-active { transition: opacity .22s ease; }
.lb-enter-active .lb-modal, .lb-leave-active .lb-modal { transition: transform .28s cubic-bezier(.22,.61,.36,1), opacity .22s ease; }
.lb-enter-from, .lb-leave-to { opacity: 0; }
.lb-enter-from .lb-modal, .lb-leave-to .lb-modal { transform: scale(.86) translateY(12px); }

/* ══════════ Green-tint overrides (modern browsers) ══════════ */
@supports (background: color-mix(in srgb, red, blue)) {
  /* Amenities & House Rules — deeper tint + clearly visible dark green border */
  .amenity, .rules-list li {
    background: color-mix(in srgb, var(--bb-accent) 13%, var(--bg-soft));
    border-color: color-mix(in srgb, var(--bb-accent) 45%, var(--bb-glass-border));
  }
  .amenity:hover, .rules-list li:hover {
    background: color-mix(in srgb, var(--bb-accent) 18%, var(--bg-soft));
    border-color: var(--bb-accent);
  }
}

/* ══════════ Responsive ══════════ */
@media (max-width: 1024px) {
  .detail-grid { grid-template-columns: 1fr; gap: 22px; }
  .sticky { position: static; }
  .detail-side { order: 2; }
}

@media (max-width: 640px) {
  .sb-root { --shell-radius: 14px; --shell-gap: 8px; --card-r: 11px; }
  .toolbar { padding: 12px; }
  .search-wrap { flex: 1 1 100%; min-width: 0; }
  .filter-chips { flex: 1; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; max-width: 100%; }
  .filter-chips::-webkit-scrollbar { display: none; }
  .chip { white-space: nowrap; }
  .sort-select { flex: 1; min-width: 0; }
  .count-line { font-size: var(--bb-text-md); margin-bottom: 14px; }
  .grid-cards { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
  .gcard-rating { padding: 3px 8px; font-size: var(--bb-text-2xs); }
  .bpill { font-size: var(--bb-text-2xs); padding: 3px 8px; }
  .gcard-meta span { font-size: var(--bb-text-2xs); padding: 2px 7px; }
  .thumb-row { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 4px; }
  .thumb-row::-webkit-scrollbar { display: none; }
  .thumb { width: 66px; height: 48px; }
  .detail-title { font-size: var(--bb-text-2xl); }
  .detail-cover { aspect-ratio: 16/10; }
  .rv-head { flex-direction: column; align-items: stretch; }
  .rv-head .btn-rose { width: 100%; }
  .grid-2 { grid-template-columns: 1fr; gap: 0; }
  .full-w { grid-column: span 1; }
  .pay-tiles { grid-template-columns: 1fr; }
  .card { padding: 16px 14px; }
  .crumb-row .step-pill { display: none; }
}

@media (max-width: 480px) {
  .sb-root { --shell-radius: 12px; --shell-gap: 6px; }
  .grid-cards { grid-template-columns: 1fr; }
  .gcard-body { padding: 12px 14px 14px; }
  .gcard-meta { gap: 5px; }
  .gcard-price .price { font-size: var(--bb-text-lg); }
  .opt { padding: 11px 12px; }
  .opt-thumb { width: 46px; height: 40px; }
  .opt.full.sel::after { right: 10px; width: 20px; height: 20px; }
  .card { padding: 14px 13px; }
  .pay-tile { padding: 13px 8px 11px; }
  .btn-rose { padding: 11px 20px; font-size: var(--bb-text-base); }
  .book-foot { font-size: var(--bb-text-xs); }
  .sum-total { font-size: var(--bb-text-lg); }
  .detail-title.sm { font-size: var(--bb-text-xl); }
  .rvc { padding: 12px; gap: 10px; }
  .rva { width: 36px; height: 36px; font-size: var(--bb-text-xs); }
}

/* ══════════ Reduced motion ══════════ */
@media (prefers-reduced-motion: reduce) {
  .fade-in, .gcard { animation: none !important; }
  .lb-track, .lb-enter-active .lb-modal, .lb-leave-active .lb-modal { transition: none !important; }
  .gcard-img img, .card-hover, .droom, .opt, .btn-rose, .btn-ghost, .chip,
  .thumb, .amenity, .rules-list li, .pay-tile, .rvc { transition: none !important; }
}
</style>
