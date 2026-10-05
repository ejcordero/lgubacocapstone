<template>
  <div class="bfc">
    <div v-if="!selectedHotel || !selectedRoom" class="eg">
      <p>No room selected.</p>
      <button @click="router.push('/user/hotels')" class="bl">← Back to Hotels</button>
    </div>
    <template v-else>
      <button @click="goBack" class="bl">← Back to Room Selection</button>
      <div class="fc">
        <div class="fhd">
          <img :src="selectedHotel.image || 'https://via.placeholder.com/200x140'" :alt="selectedHotel.name" class="fth" />
          <div class="fhinf">
            <p class="rey">Room Selected</p>
            <h2 class="rt2">{{ selectedRoom.name }}</h2>
            <p class="hns">{{ selectedHotel.name }}</p>
            <p class="ppn">₱{{ selectedRoom.price.toLocaleString() }} / night</p>
          </div>
        </div>
        <div v-if="errorMsg" class="err-banner"><i class="fa-solid fa-circle-exclamation"></i> {{ errorMsg }}</div>
        <form @submit.prevent="handleSubmit" class="fl">
          <div class="fs">
            <h3 class="sh">📅 Stay Details</h3>
            <div class="fb g2">
              <div class="fg">
                <label for="checkIn">Check-in Date</label>
                <input id="checkIn" name="checkIn" type="date" v-model="formData.checkIn" required class="fi" :min="minDate" @change="onDateChange" />
              </div>
              <div class="fg">
                <label for="checkOut">Check-out Date</label>
                <input id="checkOut" name="checkOut" type="date" v-model="formData.checkOut" required class="fi" :min="formData.checkIn || minDate" @change="onDateChange" />
              </div>
              <div class="fg">
                <label for="adults">Adults</label>
                <select id="adults" name="adults" v-model="formData.adults" class="fi">
                  <option v-for="n in 5" :key="n" :value="n">{{ n }} Adult{{ n > 1 ? 's' : '' }}</option>
                </select>
              </div>
              <div class="fg">
                <label for="children">Children</label>
                <select id="children" name="children" v-model="formData.children" class="fi">
                  <option v-for="n in 5" :key="n - 1" :value="n - 1">{{ n - 1 }} Child{{ n - 1 !== 1 ? 'ren' : '' }}</option>
                </select>
              </div>
              <div class="fg cs2">
                <label for="requests">Special Requests / Notes</label>
                <textarea id="requests" name="requests" v-model="formData.requests" rows="2" placeholder="e.g. late check-in, extra pillows..." class="fi"></textarea>
              </div>
            </div>
          </div>
          <div class="fs">
            <h3 class="sh">👤 Guest Details</h3>
            <div class="fb g2">
              <div class="fg">
                <label for="fullName">Full Name</label>
                <input id="fullName" name="fullName" type="text" v-model="formData.fullName" required class="fi" placeholder="Juan Dela Cruz" />
              </div>
              <div class="fg">
                <label for="contact">Contact Number</label>
                <input id="contact" name="contact" type="tel" v-model="formData.contact" required class="fi" placeholder="09xxxxxxxxx" />
              </div>
              <div class="fg">
                <label for="email">Email Address</label>
                <input id="email" name="email" type="email" v-model="formData.email" required class="fi" placeholder="juan@email.com" />
              </div>
              <div class="fg">
                <label for="idType">Valid ID Type</label>
                <select id="idType" name="idType" v-model="formData.idType" required class="fi">
                  <option value="philid">PhilID / National ID</option>
                  <option value="passport">Passport</option>
                  <option value="drivers">Driver's License</option>
                </select>
              </div>
            </div>
          </div>
          <div class="fs">
            <h3 class="sh">💳 Payment & Summary</h3>
            <div class="pl">
              <div class="pll">
                <div class="pmc"><div class="cm">✓</div><h4>Pay on Arrival</h4><p>Pay via Cash, GCash, or Card directly at the accommodation.</p></div>
                <div v-if="availInfo" class="avail-info" :class="availInfo.available > 0 ? 'ok' : 'no'">
                  <i :class="availInfo.available > 0 ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-xmark'"></i>
                  {{ availInfo.available > 0 ? `${availInfo.available} unit${availInfo.available > 1 ? 's' : ''} available` : 'Fully booked for selected dates' }}
                </div>
                <div class="wb">
                  <input type="checkbox" v-model="formData.termsAccepted" id="terms" name="terms" />
                  <label for="terms">I agree to the <span class="lt2">Hotel Terms & Conditions</span> and acknowledge the cancellation policy.</label>
                </div>
              </div>
              <div class="smb">
                <h4 class="smt">Booking Summary</h4>
                <div class="sml"><span>Room ({{ selectedRoom.name }})</span><span>₱{{ selectedRoom.price.toLocaleString() }}</span></div>
                <div class="sml"><span>Nights</span><span>{{ nightCount }}</span></div>
                <div class="sml"><span>Environmental Fee</span><span>Included</span></div>
                <div class="smt2"><span>Total</span><span class="ta2">₱{{ totalPrice.toLocaleString() }}</span></div>
              </div>
            </div>
          </div>
          <div class="fa2">
            <button type="button" @click="goBack" class="cb">Cancel</button>
            <button type="submit" :disabled="!formData.termsAccepted || checking || availInfo.available <= 0" class="sbtn">
              <span v-if="checking"><i class="fa-solid fa-spinner fa-spin"></i> Booking…</span>
              <span v-else>Confirm & Reserve</span>
            </button>
          </div>
        </form>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBookingStore } from '../../stores/useBookingStore'
import { useUserStore } from '../../stores/useUserStore'

const router = useRouter()
const store = useBookingStore()
const userStore = useUserStore()

const selectedHotel = computed(() => store.selectedHotel)
const selectedRoom = computed(() => store.selectedRoom)
const minDate = computed(() => new Date().toISOString().split('T')[0])
const errorMsg = ref('')
const checking = ref(false)
const availInfo = ref(null)
const formData = ref({
  checkIn: '', checkOut: '', adults: 1, children: 0, requests: '',
  fullName: '', contact: '', email: '', idType: 'philid', termsAccepted: false
})

const nightCount = computed(() => {
  if (!formData.value.checkIn || !formData.value.checkOut) return 1
  const diff = new Date(formData.value.checkOut) - new Date(formData.value.checkIn)
  return Math.max(1, Math.round(diff / 86400000))
})
const totalPrice = computed(() => {
  if (!selectedRoom.value) return 0
  return selectedRoom.value.price * nightCount.value
})

async function checkAvail() {
  if (!selectedRoom.value || !formData.value.checkIn || !formData.value.checkOut) {
    availInfo.value = null
    return
  }
  availInfo.value = await store.checkAvailability(selectedRoom.value.id, formData.value.checkIn, formData.value.checkOut)
}
function onDateChange() { checkAvail() }
watch(selectedRoom, () => { if (selectedRoom.value) checkAvail() })

function goBack() {
  router.push(`/user/hotels/${selectedHotel.value?.id}`)
}

async function handleSubmit() {
  errorMsg.value = ''
  if (!selectedRoom.value || !selectedHotel.value) return
  if (!formData.value.checkIn || !formData.value.checkOut) { errorMsg.value = 'Please select check-in and check-out dates.'; return }
  checking.value = true
  try {
    await store.submitBooking(userStore.token, {
      hotelId: selectedHotel.value.id,
      roomId: selectedRoom.value.id,
      guestName: formData.value.fullName,
      guestEmail: formData.value.email,
      guestContact: formData.value.contact,
      guestIdType: formData.value.idType,
      checkIn: formData.value.checkIn,
      checkOut: formData.value.checkOut,
      adults: formData.value.adults,
      children: formData.value.children,
      specialRequests: formData.value.requests,
      paymentMethod: 'on_arrival'
    })
    router.push('/user/hotels/confirmation')
  } catch (e) {
    errorMsg.value = e.message || 'Booking failed. Please try again.'
  }
  checking.value = false
}

onMounted(() => {
  if (userStore.user) {
    const u = userStore.user
    formData.value.fullName = u.fullName || ''
    formData.value.email = u.email || ''
    formData.value.contact = u.phone || ''
  }
})
</script>

<style scoped>
* { box-sizing: border-box; margin: 0; padding: 0; }
.bfc { max-width: 1152px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem; font-family: var(--bb-font-body); }
.bl { color: var(--bb-text-secondary, #6E7376); font-weight: var(--bb-weight-semibold); font-size: var(--bb-text-base); background: none; border: none; cursor: pointer; padding: 0; font-family: inherit; width: fit-content; transition: color var(--bb-dur-fast, .15s); }
.bl:hover { color: var(--bb-accent, #C0392B); }
.eg { text-align: center; padding: 3rem; color: var(--bb-text-secondary, #6E7376); display: flex; flex-direction: column; align-items: center; gap: 1rem; }

.fc { background: var(--bb-surface, #fff); border-radius: var(--bb-radius-xl, 28px); padding: 1.75rem; border: 1px solid var(--bb-border, #EBEBE4); box-shadow: var(--bb-shadow-xs); }
.err-banner { display: flex; align-items: center; gap: .75rem; background: var(--bb-danger-soft, #FBEAE8); border: 1px solid var(--bb-danger, #C0392B); border-radius: var(--bb-radius-md, 14px); padding: .875rem 1.25rem; color: var(--bb-danger, #C0392B); font-size: var(--bb-text-base); font-weight: var(--bb-weight-semibold); }

/* Room header */
.fhd { display: flex; gap: 1.5rem; padding-bottom: 1.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--bb-border, #EBEBE4); align-items: center; }
.fth { width: 11rem; height: 7.5rem; border-radius: var(--bb-radius-md, 14px); object-fit: cover; flex-shrink: 0; box-shadow: var(--bb-shadow-sm); }
.fhinf { flex: 1; }
.rey { font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-bold); text-transform: uppercase; letter-spacing: .08em; color: var(--bb-accent, #C0392B); margin-bottom: .25rem; }
.rt2 { font-family: var(--bb-font-display); font-size: var(--bb-text-2xl); font-weight: var(--bb-weight-bold); color: var(--bb-ink, #1A1D1F); margin-bottom: .2rem; letter-spacing: -0.01em; }
.hns { font-size: var(--bb-text-base); color: var(--bb-text-secondary, #6E7376); font-weight: var(--bb-weight-semibold); margin-bottom: .375rem; }
.ppn { font-size: var(--bb-text-lg); font-weight: var(--bb-weight-extrabold); color: var(--bb-accent, #C0392B); }

/* Form */
.fl { display: flex; flex-direction: column; gap: 2rem; }
.fs { display: flex; flex-direction: column; gap: .875rem; }
.sh { font-size: var(--bb-text-lg); font-weight: var(--bb-weight-bold); color: var(--bb-ink, #1A1D1F); }
.fb { background: var(--bb-bg-subtle, #F3F3EF); padding: 1.25rem; border-radius: var(--bb-radius-md, 14px); border: 1px solid var(--bb-border, #EBEBE4); }
.g2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
.cs2 { grid-column: span 2; }
.fg { display: flex; flex-direction: column; gap: .4rem; }
.fg label { font-size: var(--bb-text-xs); font-weight: var(--bb-weight-semibold); color: var(--bb-text-secondary, #6E7376); letter-spacing: .02em; }
.fi { width: 100%; padding: .65rem .875rem; background: var(--bb-surface, #fff); border: 1.5px solid var(--bb-border, #EBEBE4); border-radius: var(--bb-radius-sm, 10px); font-family: inherit; font-size: var(--bb-text-base); color: var(--bb-ink, #1A1D1F); outline: none; transition: border-color .2s, box-shadow .2s; resize: vertical; }
.fi:focus { border-color: var(--bb-accent, #C0392B); box-shadow: var(--bb-ring, 0 0 0 3px rgba(224,83,61,.15)); }

/* Payment & summary */
.pl { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start; }
.pll { display: flex; flex-direction: column; gap: 1rem; }
.pmc { background: var(--bb-bg-subtle, #F3F3EF); border: 2px solid var(--bb-accent, #C0392B); border-radius: var(--bb-radius-md, 14px); padding: 1.25rem; position: relative; }
.cm { position: absolute; top: .875rem; right: .875rem; width: 24px; height: 24px; background: var(--bb-accent, #C0392B); color: var(--bb-on-accent, #fff); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: var(--bb-text-xs); font-weight: var(--bb-weight-bold); }
.pmc h4 { font-weight: var(--bb-weight-bold); color: var(--bb-ink, #1A1D1F); margin-bottom: .375rem; }
.pmc p { font-size: var(--bb-text-base); color: var(--bb-text-secondary, #6E7376); }
.avail-info { display: flex; align-items: center; gap: .5rem; padding: .75rem 1rem; border-radius: var(--bb-radius-sm, 10px); font-size: var(--bb-text-sm); font-weight: var(--bb-weight-semibold); }
.avail-info.ok { background: var(--bb-success-soft, #E4F2EB); color: var(--bb-success, #1A7A3A); border: 1px solid var(--bb-success, #1A7A3A); }
.avail-info.no { background: var(--bb-danger-soft, #FBEAE8); color: var(--bb-danger, #C0392B); border: 1px solid var(--bb-danger, #C0392B); }
.wb { display: flex; align-items: flex-start; gap: .75rem; background: var(--bb-warning-soft, #FBF3E0); border: 1px solid var(--bb-warning, #A16207); border-radius: var(--bb-radius-md, 14px); padding: 1rem 1.25rem; }
.wb input[type="checkbox"] { margin-top: 2px; accent-color: var(--bb-accent, #C0392B); width: 16px; height: 16px; flex-shrink: 0; }
.wb label { font-size: var(--bb-text-base); color: var(--bb-ink, #1A1D1F); line-height: 1.5; }
.lt2 { color: var(--bb-accent, #C0392B); font-weight: var(--bb-weight-bold); text-decoration: underline; cursor: pointer; }

.smb { background: var(--bb-bg-subtle, #F3F3EF); border: 1px solid var(--bb-border, #EBEBE4); border-radius: var(--bb-radius-md, 14px); padding: 1.25rem; display: flex; flex-direction: column; gap: .625rem; position: sticky; top: 1.5rem; }
.smt { font-size: var(--bb-text-base); font-weight: var(--bb-weight-bold); color: var(--bb-ink, #1A1D1F); padding-bottom: .625rem; border-bottom: 1px solid var(--bb-border, #EBEBE4); margin-bottom: .25rem; }
.sml { display: flex; justify-content: space-between; font-size: var(--bb-text-base); color: var(--bb-text-secondary, #6E7376); }
.smt2 { display: flex; justify-content: space-between; align-items: center; padding-top: .625rem; border-top: 1px solid var(--bb-border, #EBEBE4); font-weight: var(--bb-weight-bold); color: var(--bb-ink, #1A1D1F); }
.ta2 { font-size: var(--bb-text-2xl); color: var(--bb-accent, #C0392B); font-weight: var(--bb-weight-extrabold); }

/* Actions */
.fa2 { display: flex; justify-content: flex-end; gap: 1rem; padding-top: 1rem; border-top: 1px solid var(--bb-border, #EBEBE4); }
.cb { padding: .75rem 1.5rem; color: var(--bb-text-secondary, #6E7376); font-family: inherit; font-weight: var(--bb-weight-bold); background: none; border: 1px solid var(--bb-border, #EBEBE4); border-radius: var(--bb-radius-sm, 10px); cursor: pointer; transition: all .2s; }
.cb:hover { background: var(--bb-bg-subtle, #F3F3EF); color: var(--bb-ink, #1A1D1F); }
.sbtn { padding: .875rem 2rem; background: var(--bb-accent, #C0392B); color: var(--bb-on-accent, #fff); font-family: inherit; font-weight: var(--bb-weight-bold); font-size: var(--bb-text-lg); border: none; border-radius: var(--bb-radius-sm, 10px); cursor: pointer; transition: all .2s; box-shadow: var(--bb-shadow-md); display: flex; align-items: center; gap: 8px; }
.sbtn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: var(--bb-shadow-lg); background: var(--bb-accent-hover, #C8432E); }
.sbtn:disabled { opacity: .5; cursor: not-allowed; box-shadow: none; transform: none; }

@media (max-width: 768px) {
  .fc { padding: 1.25rem; }
  .fhd { flex-direction: column; }
  .fth { width: 100%; height: 12rem; }
  .g2 { grid-template-columns: 1fr; }
  .cs2 { grid-column: span 1; }
  .pl { grid-template-columns: 1fr; }
  .smb { position: static; }
  .fa2 { flex-direction: column; }
  .sbtn, .cb { width: 100%; text-align: center; justify-content: center; }
}
</style>