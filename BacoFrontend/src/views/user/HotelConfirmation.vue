<template>
  <div class="cw">
    <div class="cc">
      <div class="tb2"></div>
      <div class="si2"><CheckCircle size="40" /></div>
      <h2 class="ct2">Booking Confirmed!</h2>
      <p class="csu">Your reservation at <strong>{{ latestBooking?.hotel?.name }}</strong> is set. You will pay upon arrival.</p>

      <div class="nt">
        <Bell size="20" class="ni" />
        <div><p class="ntt">SMS & Email Sent</p><p class="ntd">We've sent your booking reference to {{ latestBooking?.details?.email }}.</p></div>
      </div>

      <div class="sc2">
        <div class="scl">
          <div class="sch"><h3 class="sct2">Reservation Summary</h3><span class="badge by">Pay on Arrival</span></div>
          <div class="sg">
            <span class="lb">Reference No.</span><span class="vl">{{ latestBooking?.id }}</span>
            <span class="lb">Guest Name</span><span class="vl">{{ latestBooking?.details?.fullName }}</span>
            <span class="lb">Room</span><span class="vl">{{ latestBooking?.room?.name }}</span>
            <span class="lb">Check-in</span><span class="vl">{{ latestBooking?.details?.checkIn }}</span>
            <span class="lb">Check-out</span><span class="vl">{{ latestBooking?.details?.checkOut }}</span>
            <span class="lb">Nights</span><span class="vl">{{ nightCount }}</span>
            <span class="lb tl2">Total Amount</span><span class="vl tv2">₱{{ latestBooking?.totalPrice?.toLocaleString() }}</span>
          </div>
        </div>
        <div class="qs">
          <p class="ql">Check-in QR</p>
          <div class="qb"><QrCode size="100" class="qi" /></div>
          <p class="qh2">Show at reception</p>
        </div>
      </div>

      <div class="acts">
        <button class="ob"><Download size="18" /> Download</button>
        <button @click="goToDashboard" class="pb2">Back to Dashboard</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBookingStore } from '../../stores/useBookingStore'
import { CheckCircle, Bell, Download, QrCode } from 'lucide-vue-next'

const router = useRouter()
const store = useBookingStore()

const latestBooking = computed(() => store.myBookings[0] ?? null)

const nightCount = computed(() => {
  const b = latestBooking.value
  if (!b?.details?.checkIn || !b?.details?.checkOut) return b?.nights || 1
  const diff = new Date(b.details.checkOut) - new Date(b.details.checkIn)
  return Math.max(1, Math.round(diff / 86400000))
})

function goToDashboard() {
  store.resetFlow()
  router.push('/user/dashboard')
}
</script>

<style scoped>
*{box-sizing:border-box;margin:0;padding:0}
.cw{max-width:48rem;margin:0 auto;padding:1.5rem 0;font-family:var(--bb-font-body);color:var(--bb-ink)}
.cc{background:var(--bb-surface);border:1px solid var(--bb-border);border-radius:var(--bb-radius-lg);padding:1.75rem;position:relative;overflow:hidden;box-shadow:var(--bb-shadow-md);text-align:center}
.tb2{position:absolute;top:0;left:0;width:100%;height:.5rem;background:linear-gradient(to right,var(--bb-accent),var(--bb-sun))}
.si2{width:5rem;height:5rem;border-radius:50%;background:var(--bb-success-soft);color:var(--bb-success);display:flex;align-items:center;justify-content:center;margin:1rem auto 1.25rem}
.ct2{font-size: var(--bb-text-2xl);font-weight: var(--bb-weight-extrabold);color:var(--bb-ink);margin-bottom:.5rem}
.csu{font-size: var(--bb-text-base);color:var(--bb-text-secondary);margin-bottom:1.5rem;line-height:1.6}
.nt{display:flex;align-items:flex-start;gap:.75rem;background:var(--bb-info-soft);border:1px solid var(--bb-info);border-radius:.875rem;padding:1rem 1.25rem;text-align:left;max-width:400px;margin:0 auto 1.5rem}
.ni{color:var(--bb-info);flex-shrink:0;margin-top:2px}
.ntt{font-size: var(--bb-text-base);font-weight: var(--bb-weight-bold);color:var(--bb-ink);margin-bottom:.2rem}
.ntd{font-size: var(--bb-text-xs);color:var(--bb-text-secondary)}
.sc2{background:var(--bb-glass-bg);border:1px solid var(--bb-glass-border);border-radius:var(--bb-radius-xl);padding:1.5rem;display:flex;gap:2rem;text-align:left;margin-bottom:1.5rem}
.scl{flex:1}
.sch{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;padding-bottom:.75rem;border-bottom:1px solid var(--bb-border)}
.sct2{font-size: var(--bb-text-md);font-weight: var(--bb-weight-bold);color:var(--bb-ink)}
.sg{display:grid;grid-template-columns:auto 1fr;gap:.625rem;font-size: var(--bb-text-base)}
.lb{color:var(--bb-text-secondary)}
.vl{font-weight: var(--bb-weight-bold);color:var(--bb-ink)}
.tl2{color:var(--bb-accent-ink);font-weight: var(--bb-weight-bold);padding-top:.625rem;border-top:1px solid var(--bb-border);margin-top:.25rem}
.tv2{font-size: var(--bb-text-xl);color:var(--bb-accent-ink);font-weight: var(--bb-weight-extrabold);padding-top:.625rem;border-top:1px solid var(--bb-border);margin-top:.25rem}
.qs{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.5rem}
.ql{font-size: var(--bb-text-2xs);font-weight: var(--bb-weight-bold);text-transform:uppercase;letter-spacing:.06em;color:var(--bb-text-secondary)}
.qb{background:var(--bb-bg-subtle);padding:.75rem;border-radius:.875rem;border:1px solid var(--bb-border)}
.qi{color:var(--bb-accent-ink)}
.qh2{font-size: var(--bb-text-xs);color:var(--bb-text-tertiary)}
.badge{padding:.25rem .75rem;border-radius:var(--bb-radius-pill);font-size: var(--bb-text-xs);font-weight: var(--bb-weight-bold)}
.by{background:var(--bb-warning-soft);color:var(--bb-warning)}
.acts{display:flex;justify-content:center;gap:1rem;flex-wrap:wrap}
.ob{display:inline-flex;align-items:center;gap:.5rem;padding:.875rem 1.75rem;border:2px solid var(--bb-border-strong);background:var(--bb-glass-bg-strong);color:var(--bb-ink);font-family:var(--bb-font-body);font-weight: var(--bb-weight-bold);font-size: var(--bb-text-md);border-radius:var(--bb-radius-md);cursor:pointer;transition:all .2s}
.ob:hover{background:var(--bb-accent-soft);color:var(--bb-accent-ink)}
.pb2{display:inline-flex;align-items:center;gap:.5rem;padding:.875rem 1.75rem;background:var(--bb-accent);color:var(--bb-on-accent);font-family:var(--bb-font-body);font-weight: var(--bb-weight-bold);font-size: var(--bb-text-md);border:none;border-radius:var(--bb-radius-md);cursor:pointer;transition:all .2s;box-shadow:var(--bb-shadow-md)}
.pb2:hover{transform:translateY(-2px);box-shadow:var(--bb-shadow-lg);background:var(--bb-accent-hover)}
@media(max-width:640px){.cw{padding:1rem 0}.cc{padding:1.25rem 1rem}.si2{width:3.5rem;height:3.5rem}.ct2{font-size: var(--bb-text-xl)}.csu{font-size: var(--bb-text-base)}.nt{padding:.875rem 1rem}.sc2{flex-direction:column;padding:1.25rem}.qs{order:-1;margin-bottom:.25rem}.sg{grid-template-columns:1fr;font-size: var(--bb-text-sm)}.acts{flex-direction:column;gap:.625rem}.ob,.pb2{width:100%;justify-content:center;padding:.75rem 1.25rem;font-size: var(--bb-text-base)}}
</style>
