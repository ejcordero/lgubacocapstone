<template>
  <div class="sb-root">
    <div class="fade-in">
      <div class="page-head">
        <h1>My Bookings</h1>
        <p>Track reservations, cancel upcoming visits, and review completed stays.</p>
      </div>

      <div class="error-banner" v-if="notice.text" :class="notice.type">{{ notice.text }}</div>

      <!-- Toolbar -->
      <div class="toolbar">
        <div class="search-wrap">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input v-model="searchQuery" type="text" placeholder="Search by resort or reference…" />
        </div>
        <div class="filter-chips">
          <button class="chip" :class="{ active: filterStatus === 'all' }" @click="filterStatus = 'all'">All ({{ bookings.length }})</button>
          <button class="chip" :class="{ active: filterStatus === 'pending' }" @click="filterStatus = 'pending'">Pending ({{ counts.pending }})</button>
          <button class="chip" :class="{ active: filterStatus === 'confirmed' }" @click="filterStatus = 'confirmed'">Approved ({{ counts.confirmed }})</button>
          <button class="chip" :class="{ active: filterStatus === 'completed' }" @click="filterStatus = 'completed'">Completed ({{ counts.completed }})</button>
          <button class="chip" :class="{ active: filterStatus === 'cancelled' }" @click="filterStatus = 'cancelled'">Cancelled ({{ counts.cancelled }})</button>
        </div>
      </div>

      <!-- View toggle (Kanban is default) -->
      <div class="view-row">
        <div class="view-toggle">
          <button :class="{ active: activeView === 'kanban' }" @click="activeView = 'kanban'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="5" height="18" rx="1.5"/><rect x="10" y="3" width="5" height="12" rx="1.5"/><rect x="17" y="3" width="4" height="15" rx="1.5"/></svg>
            <span>Kanban</span>
          </button>
          <button :class="{ active: activeView === 'calendar' }" @click="activeView = 'calendar'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>Calendar</span>
          </button>
          <button :class="{ active: activeView === 'archive' }" @click="activeView = 'archive'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="4" rx="1"/><path d="M4 8v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>
            <span>Archive</span>
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="state-box"><div class="spinner"></div><p>Loading your bookings…</p></div>

      <!-- Login gate -->
      <div v-else-if="!userStore.token" class="state-box">
        <div class="state-emoji">🔒</div>
        <p>Please log in to view your bookings.</p>
        <button class="btn-rose" @click="router.push('/auth')">Log In</button>
      </div>

      <!-- ═══ VIEW 3: ARCHIVE (past months + manually archived) ═══ -->
      <div v-else-if="activeView === 'archive'" class="archive-view">
        <div class="archive-head">
          <h3>Archive</h3>
          <p>Bookings from months that have passed — plus anything you archive yourself. Restore anytime.</p>
        </div>

        <!-- Month filter: one chip per month with archived bookings -->
        <div class="archive-months">
          <button class="chip" :class="{ active: archiveMonth === 'all' }" @click="archiveMonth = 'all'">
            All Months ({{ archiveBase.length }})
          </button>
          <button v-for="m in archiveMonths" :key="m.key" class="chip"
                  :class="{ active: archiveMonth === m.key }"
                  @click="archiveMonth = archiveMonth === m.key ? 'all' : m.key">
            {{ m.label }} ({{ m.count }})
          </button>
        </div>

        <div v-if="filteredArchive.length" class="archive-grid">
          <div v-for="b in filteredArchive" :key="b.id" class="kanban-card" @click="openDetail(b)">
            <div class="kc-top">
              <img v-if="b.hotel?.image" :src="b.hotel.image" :alt="b.hotel?.name" class="kc-thumb" loading="lazy" />
              <div v-else class="kc-thumb fallback">🏨</div>
              <div class="kc-info">
                <div class="kc-name">{{ b.hotel?.name || 'Resort' }}</div>
                <div class="kc-ref">{{ b.id }}</div>
              </div>
              <button class="kc-menu" :class="{ active: menu?.booking?.id === b.id }"
                      aria-label="Booking options" @click.stop="toggleMenu(b, 'unarchive', $event)">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
              </button>
            </div>
            <div class="kc-mid">
              <span class="btype" :class="b.bookingType === 'entrance' ? 'ent' : 'stay'">{{ b.bookingType === 'entrance' ? '🎟️ Day Tour' : '🛏️ Stay' }}</span>
              <span class="kc-product">{{ productLabel(b) }}</span>
              <span class="status-pill" :class="statusClass(b.status)">{{ prettyStatus(b.status) }}</span>
            </div>
            <div class="kc-dates">
              <span>{{ fmtShort(b.details?.checkIn) }}</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              <span>{{ fmtShort(b.details?.checkOut) }}</span>
              <span class="kc-pax">👤 {{ b.pax || 1 }}</span>
            </div>
            <div class="kc-bottom">
              <span class="kc-price">{{ peso(b.totalPrice) }}</span>
              <div class="kc-actions">
                <button v-if="canCancel(b)" class="btn-ghost sm" @click.stop="askCancel(b)">Cancel</button>
                <button v-if="canReview(b)" class="btn-rose sm" @click.stop="goReview(b)">★ Review</button>
                <span v-if="b.hasReview" class="reviewed-pill">★</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Archive empty state -->
        <div v-else class="state-box">
          <div class="state-emoji">📦</div>
          <p v-if="archiveBase.length === 0">Nothing archived yet — bookings move here when their month ends, or when you archive them from the Kanban.</p>
          <p v-else>No bookings in {{ activeArchiveMonthLabel }}.</p>
          <button v-if="archiveMonth !== 'all'" class="btn-ghost" @click="archiveMonth = 'all'">Show all months</button>
        </div>
      </div>

      <!-- Empty (Kanban / Calendar) -->
      <div v-else-if="(activeView === 'kanban' && filteredBookings.length === 0) || (activeView === 'calendar' && calendarBookings.length === 0)" class="state-box">
        <div class="state-emoji">🗓️</div>
        <p v-if="searchQuery || filterStatus !== 'all'">No bookings match this filter.</p>
        <p v-else-if="archivedBookings.length > 0">No active bookings — everything from past months is in the Archive.</p>
        <p v-else>You haven't booked anything yet — explore the resorts!</p>
        <button v-if="searchQuery || filterStatus !== 'all'" class="btn-ghost" @click="searchQuery = ''; filterStatus = 'all'">Clear filters</button>
        <button v-if="archivedBookings.length > 0" class="btn-rose" @click="activeView = 'archive'">Open Archive ({{ archivedBookings.length }})</button>
        <button v-if="!searchQuery && filterStatus === 'all' && archivedBookings.length === 0" class="btn-rose" @click="router.push('/user/hotels')">Browse Resorts</button>
      </div>

      <!-- ═══ VIEW 1: KANBAN (default) ═══ -->
      <div v-else-if="activeView === 'kanban'" class="kanban-view">
        <div class="kanban-board">
          <div class="kanban-column" v-for="col in kanbanColumns" :key="col.key">
            <div class="kanban-header" :style="{ borderTopColor: col.color }">
              <h4>{{ col.label }}</h4>
              <span class="kanban-count">{{ colBookings(col).length }}</span>
            </div>
            <div class="kanban-cards">
              <div v-for="b in colBookings(col)" :key="b.id" class="kanban-card" @click="openDetail(b)">
                <div class="kc-top">
                  <img v-if="b.hotel?.image" :src="b.hotel.image" :alt="b.hotel?.name" class="kc-thumb" loading="lazy" />
                  <div v-else class="kc-thumb fallback">🏨</div>
                  <div class="kc-info">
                    <div class="kc-name">{{ b.hotel?.name || 'Resort' }}</div>
                    <div class="kc-ref">{{ b.id }}</div>
                  </div>
                  <button class="kc-menu" :class="{ active: menu?.booking?.id === b.id }"
                          aria-label="Booking options" @click.stop="toggleMenu(b, 'archive', $event)">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                  </button>
                </div>
                <div class="kc-mid">
                  <span class="btype" :class="b.bookingType === 'entrance' ? 'ent' : 'stay'">{{ b.bookingType === 'entrance' ? '🎟️ Day Tour' : '🛏️ Stay' }}</span>
                  <span class="kc-product">{{ productLabel(b) }}</span>
                  <span class="status-pill" :class="statusClass(b.status)">{{ prettyStatus(b.status) }}</span>
                </div>
                <div class="kc-dates">
                  <span>{{ fmtShort(b.details?.checkIn) }}</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                  <span>{{ fmtShort(b.details?.checkOut) }}</span>
                  <span class="kc-pax">👤 {{ b.pax || 1 }}</span>
                </div>
                <div class="kc-bottom">
                  <span class="kc-price">{{ peso(b.totalPrice) }}</span>
                  <div class="kc-actions">
                    <button v-if="canCancel(b)" class="btn-ghost sm" @click.stop="askCancel(b)">Cancel</button>
                    <button v-if="canReview(b)" class="btn-rose sm" @click.stop="goReview(b)">★ Review</button>
                    <span v-if="b.hasReview" class="reviewed-pill">★</span>
                  </div>
                </div>
              </div>
              <div v-if="colBookings(col).length === 0" class="kanban-empty">
                <span>📭</span>
                <p>No bookings</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ VIEW 2: MONTH CALENDAR ═══ -->
      <div v-else-if="activeView === 'calendar'" class="calendar-view">
        <div class="cal-legend">
        <span class="legend-item"><span class="legend-dot" style="background:var(--bb-success)"></span> Approved</span>
        <span class="legend-item"><span class="legend-dot" style="background:var(--bb-warning)"></span> Pending</span>
        <span class="legend-item"><span class="legend-dot" style="background:var(--bb-info)"></span> Completed</span>
        <span class="legend-item"><span class="legend-dot" style="background:var(--bb-danger)"></span> Rejected / Cancelled</span>
        <span class="legend-item"><span class="legend-dot" style="background:var(--bb-neutral)"></span> No Show</span>

        </div>

        <div class="cal-toolbar">
          <button class="btn-ghost cal-nav" @click="shiftMonth(-1)">‹</button>
          <h3 class="cal-title">{{ calMonthLabel }}</h3>
          <div class="cal-right">
            <button class="btn-ghost cal-nav" @click="goToday">Today</button>
            <button class="btn-ghost cal-nav" @click="shiftMonth(1)">›</button>
          </div>
        </div>

        <div class="cal-weekdays">
          <div v-for="d in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="d" class="cal-wd">{{ d }}</div>
        </div>

        <div class="cal-grid">
          <div v-for="cell in calendarCells" :key="cell.key"
               class="cal-cell" :class="{ out: !cell.inMonth, today: cell.isToday }">
            <span class="cal-num">{{ cell.day }}</span>
            <div class="cal-events">
              <div v-for="b in cell.bookings.slice(0, 3)" :key="b.id" class="cal-ev"
                   :style="{ borderLeftColor: statusColor(b.status), '--st': statusColor(b.status) }"
                   :title="`${b.hotel?.name || b.id} — ${prettyStatus(b.status)}`"
                   @click="openDetail(b)">
                <span class="cal-ev-name">{{ b.hotel?.name || b.id }}</span>
              </div>
              <span v-if="cell.bookings.length > 3" class="cal-more">+{{ cell.bookings.length - 3 }} more</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ DETAIL MODAL ═══ -->
    <transition name="modal">
      <div v-if="showDetail && selectedBooking" class="modal-overlay" @click.self="closeDetail">
        <div class="modal-card detail-card">
          <div class="detail-head">
            <div>
              <h3>{{ selectedBooking.hotel?.name || 'Resort' }}</h3>
              <p class="detail-ref">Ref: <b>{{ selectedBooking.id }}</b> · booked {{ fmtDate(selectedBooking.createdAt) }}</p>
            </div>
            <span class="status-pill" :class="statusClass(selectedBooking.status)">{{ prettyStatus(selectedBooking.status) }}</span>
          </div>

          <div class="detail-grid">
            <div class="d-item"><span class="d-label">Type</span><span class="d-value">{{ selectedBooking.bookingType === 'entrance' ? 'Entrance / Day Tour' : 'Accommodation' }}</span></div>
            <div class="d-item"><span class="d-label">Room / Fee</span><span class="d-value">{{ productLabel(selectedBooking) }}</span></div>
            <div class="d-item"><span class="d-label">{{ selectedBooking.bookingType === 'entrance' ? 'Visit Date' : 'Check-in' }}</span><span class="d-value">{{ fmtDate(selectedBooking.details?.checkIn) }}</span></div>
            <div class="d-item"><span class="d-label">{{ selectedBooking.bookingType === 'entrance' ? 'Day Tour' : 'Check-out' }}</span><span class="d-value">{{ fmtDate(selectedBooking.details?.checkOut) }}</span></div>
            <div class="d-item"><span class="d-label">Guests</span><span class="d-value">{{ selectedBooking.pax || 1 }}</span></div>
            <div class="d-item"><span class="d-label">Nights</span><span class="d-value">{{ selectedBooking.nights || 0 }}</span></div>
            <div class="d-item"><span class="d-label">Total</span><span class="d-value d-price">{{ peso(selectedBooking.totalPrice) }}</span></div>
            <div class="d-item"><span class="d-label">Payment</span><span class="d-value">{{ prettyPay(selectedBooking.paymentStatus) }}</span></div>
          </div>

          <div class="detail-contact">
            <p v-if="selectedBooking.details?.fullName">👤 {{ selectedBooking.details.fullName }}</p>
            <p v-if="selectedBooking.details?.email">✉️ {{ selectedBooking.details.email }}</p>
            <p v-if="selectedBooking.details?.contact">📞 {{ selectedBooking.details.contact }}</p>
          </div>

          <div class="modal-actions detail-actions">
            <span v-if="selectedBooking.hasReview" class="reviewed-pill">★ Reviewed</span>
            <button class="btn-ghost" @click="closeDetail">Close</button>
            <button v-if="canCancel(selectedBooking)" class="btn-danger" :disabled="cancelBusy" @click="askCancel(selectedBooking)">Cancel Booking</button>
            <button v-if="canReview(selectedBooking)" class="btn-rose" @click="goReview(selectedBooking)">★ Write Review</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Cancel confirmation modal -->
    <transition name="modal">
      <div v-if="confirmCancel" class="modal-overlay" @click.self="confirmCancel = null">
        <div class="modal-card">
          <div class="modal-emoji">⚠️</div>
          <h3>Cancel this booking?</h3>
          <p class="modal-msg">
            <b>{{ confirmCancel.id }}</b> at {{ confirmCancel.hotel?.name }}<br />
            {{ typeLine(confirmCancel) }}
          </p>
          <p class="modal-note">Your slot will be released immediately. This cannot be undone.</p>
          <div class="modal-actions">
            <button class="btn-ghost" :disabled="cancelBusy" @click="confirmCancel = null">Keep Booking</button>
            <button class="btn-danger" :disabled="cancelBusy" @click="doCancel">
              <span v-if="cancelBusy">Cancelling…</span><span v-else>Yes, Cancel Booking</span>
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- ═══ ⋮ CONTEXT MENU (Kanban: archive · Archive: restore) ═══ -->
    <transition name="ctxfade">
      <div v-if="menu" class="ctx-menu" role="menu"
           :style="{ left: menu.x + 'px', top: menu.y + 'px', transform: menu.flip ? 'translateX(-100%) translateY(-100%)' : 'translateX(-100%)' }">
        <template v-if="menu.action === 'archive'">
          <button v-if="canArchive(menu.booking)" class="ctx-item" role="menuitem" @click="archiveBooking(menu.booking)">
            <span class="ctx-ico">📦</span>
            <span class="ctx-txt">Move to Archive<small>Removes it from this board.</small></span>
          </button>
          <div v-else class="ctx-disabled">
            <span class="ctx-ico">📦</span>
            <span class="ctx-txt">Move to Archive<small>Only Completed or Closed bookings can be archived.</small></span>
          </div>
        </template>
        <button v-else class="ctx-item" role="menuitem" @click="unarchiveBooking(menu.booking)">
          <span class="ctx-ico">📤</span>
          <span class="ctx-txt">Restore to Kanban<small>Back on the board and calendar.</small></span>
        </button>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../../stores/useUserStore'
import { API as API_BASE } from '@/api'


const router = useRouter()
const userStore = useUserStore()

const loading = ref(true)
const bookings = ref([])
const searchQuery = ref('')
const filterStatus = ref('all')

// Views — Kanban (default), Calendar, Archive
const activeView = ref('kanban')

// Detail modal
const showDetail = ref(false)
const selectedBooking = ref(null)

// Cancel flow
const confirmCancel = ref(null)
const cancelBusy = ref(false)

// Inline notice banner
const notice = ref({ text: '', type: 'ok' })
let noticeTimer = null
const showNotice = (text, type = 'ok') => {
  notice.value = { text, type }
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = { text: '', type: 'ok' }), 5000)
}

// ── Formatters ──
const peso = (n) => '₱' + Number(n || 0).toLocaleString()
function fmtDate(d) { return d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' }
// Adds the year when the date isn't in the current year — so archived
// bookings from previous months/years read unambiguously ("Sep 7, 2026")
function fmtShort(d) {
  if (!d) return '—'
  const dt = new Date(String(d).slice(0, 10) + 'T00:00:00')
  const opts = { month: 'short', day: 'numeric' }
  if (dt.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric'
  return dt.toLocaleDateString('en-US', opts)
}

function statusClass(s) {
  return { pending: 'warn', confirmed: 'ok', completed: 'done', rejected: 'bad', cancelled: 'bad', no_show: 'muted' }[s] || 'muted'
}
function prettyStatus(s) {
  return { pending: 'Pending', confirmed: 'Approved', completed: 'Completed', rejected: 'Rejected', cancelled: 'Cancelled', no_show: 'No show' }[s] || s
}
function prettyPay(s) { return { unpaid: 'Unpaid', paid: 'Paid' }[s] || s }
// Status colours are CSS custom properties, not hex literals, so they
// re-resolve when [data-theme] flips. These feed inline style="" bindings,
// where a var() reference still works.
const STATUS_COLORS = {
  pending:   'var(--bb-warning)',
  confirmed: 'var(--bb-success)',
  completed: 'var(--bb-info)',
  rejected:  'var(--bb-danger)',
  cancelled: 'var(--bb-danger)',
  no_show:   'var(--bb-neutral)'
}
function statusColor(s) { return STATUS_COLORS[s] || 'var(--bb-neutral)' }
function productLabel(b) {
  if (b.bookingType === 'entrance') return b.entranceFee?.name || 'Entrance'
  return b.room?.name || 'Stay'
}

const canCancel = (b) => ['pending', 'confirmed'].includes(b.status)
const canReview = (b) => b.status === 'completed' && !b.hasReview

function typeLine(b) {
  if (b.bookingType === 'entrance') {
    return `🎟️ ${b.entranceFee?.name || 'Entrance'} · ${b.pax || 1} guest${(b.pax || 1) > 1 ? 's' : ''} · ${fmtDate(b.details?.checkIn)}`
  }
  const parts = [`🛏️ ${b.room?.name || 'Stay'}`]
  if (b.nights) parts.push(`${b.nights} night${b.nights > 1 ? 's' : ''}`)
  parts.push(`${fmtShort(b.details?.checkIn)} → ${fmtShort(b.details?.checkOut)}`)
  parts.push(`${b.pax || 1} guest${(b.pax || 1) > 1 ? 's' : ''}`)
  return parts.join(' · ')
}

// ── Manual archive overrides ──
// The backend has no archive flag, so manual archive/unarchive choices are
// persisted per-browser in localStorage, keyed by booking reference.
//   'archived'   → force into the Archive even if the month hasn't ended
//   'unarchived' → keep on Kanban/Calendar even though the month has passed
// Bookings with no override follow the automatic month-end rule.
const OVERRIDES_KEY = 'stayhub.bookingArchiveOverrides'
const overrides = ref({})
try { overrides.value = JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}') } catch (e) { overrides.value = {} }
const saveOverrides = () => { try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides.value)) } catch (e) {} }

function startOfCurrentMonth() {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), 1)
}
// A booking is archived when: manually archived, OR (no override) its entire
// stay belongs to a passed month — final day (check-out; visit day for day
// tours) before the 1st of the current month. 'unarchived' suppresses the
// automatic rule until the user archives it again.
const isArchived = (b) => {
  const ov = overrides.value[b.id]
  if (ov === 'archived') return true
  if (ov === 'unarchived') return false
  const co = String(b.details?.checkOut || b.details?.checkIn || '').slice(0, 10)
  if (!co) return false
  return new Date(co + 'T00:00:00') < startOfCurrentMonth()
}
// Archive grouping anchor: the month the booking started
const monthKeyOf = (b) => String(b.details?.checkIn || '').slice(0, 7)

const liveBookings = computed(() => bookings.value.filter(b => !isArchived(b)))
const archivedBookings = computed(() => bookings.value.filter(isArchived))

// ── Filtering (search + status chips, applied within each view's scope) ──
const applyCommonFilters = (list) => {
  let out = list
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    out = out.filter(b =>
      (b.hotel?.name || '').toLowerCase().includes(q) ||
      (b.id || '').toLowerCase().includes(q)
    )
  }
  if (filterStatus.value === 'cancelled') out = out.filter(b => ['cancelled', 'rejected', 'no_show'].includes(b.status))
  else if (filterStatus.value !== 'all') out = out.filter(b => b.status === filterStatus.value)
  return out
}

// Kanban — active bookings only (archived ones excluded)
const filteredBookings = computed(() => applyCommonFilters(liveBookings.value))
// Calendar — ALL bookings, so navigating back to a past month still shows
// what happened there (the archive split only empties the Kanban board)
const calendarBookings = computed(() => applyCommonFilters(bookings.value))

const counts = computed(() => ({
  pending: bookings.value.filter(b => b.status === 'pending').length,
  confirmed: bookings.value.filter(b => b.status === 'confirmed').length,
  completed: bookings.value.filter(b => b.status === 'completed').length,
  cancelled: bookings.value.filter(b => ['cancelled', 'rejected', 'no_show'].includes(b.status)).length,
}))

// ── Kanban ──
const kanbanColumns = [
  { key: 'pending',   label: 'Pending',   match: ['pending'],                        color: 'var(--bb-warning)' },
  { key: 'approved',  label: 'Approved',  match: ['confirmed'],                      color: 'var(--bb-success)' },
  { key: 'completed', label: 'Completed', match: ['completed'],                      color: 'var(--bb-info)' },
  { key: 'closed',    label: 'Closed',    match: ['rejected', 'cancelled', 'no_show'], color: 'var(--bb-danger)' }
]
const colBookings = (col) => filteredBookings.value.filter(b => col.match.includes(b.status))

// ── Archive ──
const archiveMonth = ref('all')

// Archive pool after search/status filters (before the month filter) —
// also drives the month chips so they always reflect findable bookings
const archiveBase = computed(() => applyCommonFilters(archivedBookings.value))

const filteredArchive = computed(() => {
  if (archiveMonth.value === 'all') return archiveBase.value
  return archiveBase.value.filter(b => monthKeyOf(b) === archiveMonth.value)
})

// One chip per month that has archived bookings, newest first
const archiveMonths = computed(() => {
  const map = new Map()
  for (const b of archiveBase.value) {
    const k = monthKeyOf(b)
    if (!k) continue
    map.set(k, (map.get(k) || 0) + 1)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, count]) => ({
      key,
      count,
      label: new Date(key + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }))
})

const activeArchiveMonthLabel = computed(() =>
  archiveMonths.value.find(m => m.key === archiveMonth.value)?.label || 'this month'
)

// ── Card context menu (⋮) ──
// "Closed" = rejected / cancelled / no_show (same set as the Closed column).
// Only Completed + Closed bookings can be manually archived; Pending and
// Approved show a disabled item explaining why. Any archived booking can be
// restored to the Kanban and Calendar from the Archive view.
const ARCHIVEABLE_STATUSES = ['completed', 'rejected', 'cancelled', 'no_show']
const canArchive = (b) => ARCHIVEABLE_STATUSES.includes(b.status)

const menu = ref(null) // { booking, action: 'archive' | 'unarchive', x, y, flip }
const toggleMenu = (b, action, e) => {
  if (menu.value && menu.value.booking?.id === b.id && menu.value.action === action) { closeMenu(); return }
  const r = e.currentTarget.getBoundingClientRect()
  // Flip above the button when there isn't room below (disabled variant is taller)
  const estH = action === 'archive' && !canArchive(b) ? 96 : 52
  let y = r.bottom + 6
  let flip = false
  if (y + estH > window.innerHeight - 8) { y = r.top - 6; flip = true }
  menu.value = { booking: b, action, x: r.right, y, flip }
}
const closeMenu = () => { menu.value = null }

const archiveBooking = (b) => {
  overrides.value[b.id] = 'archived'
  saveOverrides()
  archiveMonth.value = 'all' // so it's visible right away when they open the Archive
  closeMenu()
  showNotice(`Booking ${b.id} moved to your Archive.`, 'ok')
}
const unarchiveBooking = (b) => {
  overrides.value[b.id] = 'unarchived'
  saveOverrides()
  closeMenu()
  showNotice(`Booking ${b.id} restored — it's back on the Kanban and Calendar.`, 'ok')
}

// Close the menu on outside click / Escape / scroll / resize — it's
// fixed-positioned, so it must not follow scrolled content.
const onDocClick = (e) => {
  if (!menu.value) return
  const t = e.target
  if (t.closest && (t.closest('.ctx-menu') || t.closest('.kc-menu'))) return
  closeMenu()
}
const onKeydown = (e) => { if (e.key === 'Escape') closeMenu() }
const onDismissUi = () => { if (menu.value) closeMenu() }

// ── Built-in month calendar ──
const calCursor = ref(new Date())

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const calToday = dateKey(new Date())

const calMonthLabel = computed(() =>
  calCursor.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
)

function shiftMonth(offset) {
  const d = new Date(calCursor.value)
  d.setDate(1) // avoid the 29–31 → next-month overflow bug
  d.setMonth(d.getMonth() + offset)
  calCursor.value = d
}
function goToday() { calCursor.value = new Date() }

const calendarCells = computed(() => {
  const y = calCursor.value.getFullYear()
  const m = calCursor.value.getMonth()
  const firstDow = new Date(y, m, 1).getDay()
  const start = new Date(y, m, 1 - firstDow)
  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const key = dateKey(d)
    cells.push({
      key,
      day: d.getDate(),
      inMonth: d.getMonth() === m,
      isToday: key === calToday,
      bookings: calendarBookings.value.filter(b => {
        const ci = String(b.details?.checkIn || '').slice(0, 10)
        const co = String(b.details?.checkOut || '').slice(0, 10)
        return ci && co && ci <= key && co >= key
      })
    })
  }
  return cells
})

// ── Data ──
const loadBookings = async () => {
  loading.value = true
  try {
    const res = await fetch(`${API_BASE}/hotels/my-bookings`, {
      headers: { Authorization: `Bearer ${userStore.token}` }
    })
    if (res.status === 401 || res.status === 403) { router.push('/auth'); return }
    if (!res.ok) throw new Error('Failed to load bookings.')
    const data = await res.json()
    bookings.value = Array.isArray(data) ? data : []
  } catch (e) {
    showNotice(e.message || 'Something went wrong.', 'bad')
  } finally {
    loading.value = false
  }
}

// ── Detail modal ──
const openDetail = (b) => { selectedBooking.value = b; showDetail.value = true }
const closeDetail = () => { showDetail.value = false; selectedBooking.value = null }

// ── Cancel ──
const askCancel = (b) => { closeDetail(); confirmCancel.value = b }

const doCancel = async () => {
  if (!confirmCancel.value) return
  cancelBusy.value = true
  try {
    const res = await fetch(`${API_BASE}/hotels/bookings/${confirmCancel.value.id}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${userStore.token}` }
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { showNotice(data.message || 'Failed to cancel booking.', 'bad'); return }
    confirmCancel.value = null
    showNotice(data.message || 'Booking cancelled.', 'ok')
    await loadBookings()
  } catch (e) {
    showNotice(e.message || 'Failed to cancel booking.', 'bad')
  } finally {
    cancelBusy.value = false
  }
}

// ── Review deep-link ──
const goReview = (b) => router.push({ path: '/user/reviews', query: { booking: b.id } })

watch(activeView, () => closeMenu())

onMounted(() => {
  if (!userStore.token) { router.push('/auth'); return }
  loadBookings()
  document.addEventListener('click', onDocClick, true)
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('scroll', onDismissUi, { capture: true, passive: true })
  window.addEventListener('resize', onDismissUi)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick, true)
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('scroll', onDismissUi, true)
  window.removeEventListener('resize', onDismissUi)
})
</script>

<style scoped>
.sb-root { color: var(--bb-ink); font-family: var(--bb-font-body); }
.fade-in { animation: fadeIn .35s ease both; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

.page-head h1 { font-size: var(--bb-text-2xl); font-weight: var(--bb-weight-extrabold); margin: 0 0 4px; color: var(--bb-ink); }
.page-head p { font-size: var(--bb-text-base); color: var(--bb-text-secondary); margin: 0 0 18px; }

/* Buttons */
.btn-rose { background: var(--bb-accent); color: var(--bb-on-accent); font-weight: var(--bb-weight-semibold); padding: 10px 22px; border-radius: 12px; border: none; cursor: pointer; font-size: var(--bb-text-base); font-family: inherit; transition: all .2s; }
.btn-rose:hover { background: var(--bb-accent-hover); }
.btn-rose:disabled { opacity: .5; cursor: not-allowed; }
.btn-rose.sm { padding: 7px 14px; font-size: var(--bb-text-xs); }
.btn-ghost { border: 1px solid var(--bb-border-strong); background: var(--bb-glass-bg-strong); border-radius: 10px; padding: 9px 16px; font-size: var(--bb-text-base); font-weight: var(--bb-weight-semibold); cursor: pointer; font-family: inherit; color: var(--bb-text-secondary); transition: all .2s; }
.btn-ghost:hover { background: var(--bb-accent-soft); color: var(--bb-accent-ink); }
.btn-ghost.sm { padding: 7px 14px; font-size: var(--bb-text-xs); }
.btn-danger { background: var(--bb-danger-solid); color: var(--bb-on-danger-solid); border: none; border-radius: 10px; padding: 9px 16px; font-size: var(--bb-text-sm); font-weight: var(--bb-weight-bold); cursor: pointer; font-family: inherit; transition: all .2s; }
.btn-danger:hover { filter: brightness(1.08); }
.btn-danger:disabled, .btn-ghost:disabled { opacity: .55; cursor: not-allowed; }

/* Toolbar */
.toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.search-wrap { position: relative; flex: 1; min-width: 220px; }
.search-wrap svg { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--bb-text-tertiary); pointer-events: none; }
.search-wrap input { width: 100%; padding: 10px 14px 10px 36px; border: 1px solid var(--bb-glass-border); border-radius: 999px; font-size: var(--bb-text-base); font-family: inherit; background: var(--bb-glass-bg-strong); box-sizing: border-box; color: var(--bb-ink); transition: border-color .2s, box-shadow .2s; }
.search-wrap input:focus { border-color: var(--bb-accent); outline: none; box-shadow: 0 0 0 3px var(--bb-accent-soft); }
.filter-chips { display: flex; gap: 6px; }
.chip { padding: 8px 16px; border-radius: 999px; border: 1px solid var(--bb-glass-border); background: var(--bb-glass-bg-strong); font-size: var(--bb-text-sm); font-weight: var(--bb-weight-semibold); cursor: pointer; font-family: inherit; color: var(--bb-text-secondary); transition: all .2s; white-space: nowrap; }
.chip:hover { background: var(--bb-accent-soft); color: var(--bb-ink); }
.chip.active { background: var(--bb-accent); color: var(--bb-on-accent); border-color: var(--bb-accent); }

/* View toggle */
.view-row { display: flex; justify-content: flex-end; margin-bottom: 14px; }
.view-toggle { display: inline-flex; gap: 4px; background: var(--bb-glass-bg-strong); border: 1px solid var(--bb-glass-border); border-radius: 12px; padding: 4px; }
.view-toggle button { display: inline-flex; align-items: center; gap: 6px; background: transparent; border: none; color: var(--bb-text-secondary); padding: 8px 16px; border-radius: 9px; font-size: var(--bb-text-sm); font-weight: var(--bb-weight-bold); cursor: pointer; font-family: inherit; transition: all .2s; }
.view-toggle button.active { background: var(--bb-accent); color: var(--bb-on-accent); }
.view-toggle button:hover:not(.active) { color: var(--bb-ink); background: var(--bb-accent-soft); }

/* Notice */
.error-banner { border-radius: 12px; padding: 11px 14px; font-size: var(--bb-text-sm); font-weight: var(--bb-weight-semibold); margin-bottom: 14px; }
.error-banner.ok { background: var(--bb-success-soft); border: 1px solid var(--bb-success); color: var(--bb-success); }
.error-banner.bad { background: var(--bb-danger-soft); border: 1px solid var(--bb-danger); color: var(--bb-danger); }

/* States */
.state-box { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 20px; color: var(--bb-text-secondary); text-align: center; }
.state-emoji { font-size: var(--bb-text-4xl); }
.spinner { width: 34px; height: 34px; border: 3px solid var(--bb-border); border-top-color: var(--bb-accent); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Status / type pills (shared) */
.status-pill { padding: 2px 9px; border-radius: 999px; font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-bold); white-space: nowrap; }
.status-pill.ok { background: var(--bb-success-soft); color: var(--bb-success); }
.status-pill.warn { background: var(--bb-warning-soft); color: var(--bb-warning); }
.status-pill.done { background: var(--bb-info-soft); color: var(--bb-info); }
.status-pill.bad { background: var(--bb-danger-soft); color: var(--bb-danger); }
.status-pill.muted { background: var(--bb-neutral-soft); color: var(--bb-text-tertiary); }
.btype { padding: 2px 8px; border-radius: 999px; font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-extrabold); text-transform: uppercase; letter-spacing: .04em; white-space: nowrap; }
.btype.ent { background: var(--bb-accent-soft); color: var(--bb-accent-ink); }
.btype.stay { background: var(--bb-neutral-soft); color: var(--bb-text-secondary); }
.reviewed-pill { display: inline-flex; align-items: center; gap: 5px; font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-bold); color: var(--bb-success); background: var(--bb-success-soft); padding: 4px 10px; border-radius: 999px; white-space: nowrap; }

/* ═══ Kanban ═══ */
.kanban-view { overflow-x: auto; padding-bottom: 8px; }
.kanban-board { display: flex; gap: 12px; min-width: 880px; }
.kanban-column { flex: 1; min-width: 205px; background: var(--bb-glass-bg-strong); border: 1px solid var(--bb-glass-border); border-radius: var(--bb-radius-lg); display: flex; flex-direction: column; max-height: 72vh;   }
.kanban-header { padding: 11px 13px; border-top: 4px solid; border-bottom: 1px solid var(--bb-glass-border); display: flex; justify-content: space-between; align-items: center; }
.kanban-header h4 { margin: 0; font-size: var(--bb-text-xs); font-weight: var(--bb-weight-extrabold); color: var(--bb-ink); letter-spacing: .02em; }
.kanban-count { font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-extrabold); padding: 2px 9px; border-radius: 999px; background: var(--bb-neutral-soft); color: var(--bb-text-secondary); }
.kanban-cards { padding: 10px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 10px; }
.kanban-card { background: var(--bb-glass-bg-strong); border: 1px solid var(--bb-glass-border); border-radius: 14px; padding: 12px; cursor: pointer; transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
.kanban-card:hover { border-color: var(--bb-accent); transform: translateY(-2px); box-shadow: var(--bb-glass-shadow); }
.kanban-card:active { transform: scale(.98); }
.kc-top { display: flex; gap: 10px; align-items: center; margin-bottom: 9px; }
.kc-thumb { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; flex-shrink: 0; }
.kc-thumb.fallback { display: flex; align-items: center; justify-content: center; background: var(--bb-bg-subtle); font-size: var(--bb-text-xl); }
.kc-info { flex: 1; min-width: 0; }
.kc-name { font-size: var(--bb-text-sm); font-weight: var(--bb-weight-bold); color: var(--bb-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kc-ref { font-size: var(--bb-text-2xs); color: var(--bb-text-tertiary); font-family: var(--bb-font-mono); letter-spacing: .04em; margin-top: 1px; }

/* ⋮ menu button on cards */
.kc-menu { flex-shrink: 0; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border: none; background: transparent; border-radius: 8px; color: var(--bb-text-tertiary); cursor: pointer; padding: 0; transition: background .15s, color .15s; }
.kc-menu:hover, .kc-menu.active { background: var(--bb-accent-soft); color: var(--bb-accent-ink); }

.kc-mid { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 9px; }
.kc-product { font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-semibold); color: var(--bb-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; }
.kc-dates { display: flex; align-items: center; gap: 7px; font-size: var(--bb-text-xs); font-weight: var(--bb-weight-semibold); color: var(--bb-text-secondary); background: var(--bb-bg-subtle); border-radius: 8px; padding: 6px 9px; margin-bottom: 9px; }
.kc-dates svg { color: var(--bb-accent-ink); flex-shrink: 0; }
.kc-pax { margin-left: auto; font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-bold); color: var(--bb-text-tertiary); }
.kc-bottom { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.kc-price { font-size: var(--bb-text-base); font-weight: var(--bb-weight-extrabold); color: var(--bb-accent-ink); }
.kc-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.kanban-empty { text-align: center; padding: 22px 10px; color: var(--bb-text-tertiary); }
.kanban-empty span { font-size: var(--bb-text-2xl); display: block; margin-bottom: 6px; opacity: .55; }
.kanban-empty p { margin: 0; font-size: var(--bb-text-xs); font-weight: var(--bb-weight-semibold); }

/* ═══ Context menu (⋮) ═══ */
.ctx-menu { position: fixed; background: var(--bb-glass-bg-strong); border: 1px solid var(--bb-glass-border); border-radius: 12px; box-shadow: var(--bb-glass-lg); padding: 6px; min-width: 230px; z-index: calc(var(--bb-z-overlay, 900) + 30); }
.ctx-item { display: flex; align-items: flex-start; gap: 9px; width: 100%; text-align: left; background: transparent; border: none; border-radius: 8px; padding: 9px 10px; cursor: pointer; font-family: inherit; font-size: var(--bb-text-sm); font-weight: var(--bb-weight-semibold); color: var(--bb-ink); transition: background .15s, color .15s; }
.ctx-item:hover { background: var(--bb-accent-soft); color: var(--bb-accent-ink); }
.ctx-item .ctx-txt small { color: var(--bb-text-tertiary); }
.ctx-item:hover .ctx-txt small { color: var(--bb-accent-ink); }
.ctx-disabled { display: flex; align-items: flex-start; gap: 9px; padding: 9px 10px; opacity: .6; cursor: not-allowed; font-size: var(--bb-text-sm); font-weight: var(--bb-weight-semibold); color: var(--bb-text-secondary); }
.ctx-ico { font-size: 15px; line-height: 1.2; flex-shrink: 0; }
.ctx-txt { display: flex; flex-direction: column; gap: 1px; }
.ctx-txt small { font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-semibold); }
.ctxfade-enter-active, .ctxfade-leave-active { transition: opacity .15s ease; }
.ctxfade-enter-from, .ctxfade-leave-to { opacity: 0; }

/* ═══ Calendar ═══ */
.calendar-view { background: var(--bb-glass-bg-strong); border: 1px solid var(--bb-glass-border); border-radius: var(--bb-radius-lg); padding: 16px;   }
.cal-legend { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 12px; }
.legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-bold); color: var(--bb-text-secondary); text-transform: uppercase; letter-spacing: .03em; }
.legend-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.cal-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 10px; }
.cal-title { margin: 0; font-size: var(--bb-text-lg); font-weight: var(--bb-weight-extrabold); color: var(--bb-ink); }
.cal-right { display: flex; gap: 6px; }
.cal-nav { padding: 7px 12px; font-size: var(--bb-text-sm); }
.cal-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 4px; }
.cal-wd { text-align: center; font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-extrabold); color: var(--bb-text-tertiary); text-transform: uppercase; letter-spacing: .05em; padding: 6px 0; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: var(--bb-glass-border); border: 1px solid var(--bb-glass-border); border-radius: 12px; overflow: hidden; }
.cal-cell { background: var(--bb-bg-subtle); min-height: 92px; padding: 5px; display: flex; flex-direction: column; }
.cal-cell.out { opacity: .45; }
.cal-cell.today { background: var(--bb-accent-soft); }
.cal-cell.today .cal-num { color: var(--bb-accent-ink); font-weight: var(--bb-weight-extrabold); }
.cal-num { font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-bold); color: var(--bb-text-secondary); margin-bottom: 4px; padding: 0 3px; }
.cal-events { flex: 1; display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
.cal-ev { font-size: var(--bb-text-2xs); padding: 3px 6px; border-radius: 6px; background: var(--bb-glass-bg-strong); border-left: 3px solid; cursor: pointer; transition: filter .15s; }
.cal-ev:hover { filter: brightness(.95); }
.cal-ev-name { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--bb-ink); font-weight: var(--bb-weight-semibold); }
.cal-more { font-size: var(--bb-text-2xs); color: var(--bb-text-tertiary); font-weight: var(--bb-weight-bold); padding-left: 4px; }

/* ═══ Archive ═══ */
.archive-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 10px; margin-bottom: 12px; }
.archive-head h3 { margin: 0 0 2px; font-size: var(--bb-text-lg); font-weight: var(--bb-weight-extrabold); color: var(--bb-ink); }
.archive-head p { margin: 0; font-size: var(--bb-text-xs); color: var(--bb-text-tertiary); }
.archive-months { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
.archive-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }

/* ═══ Detail modal ═══ */
.modal-overlay { position: fixed; inset: 0; background: rgba(10, 31, 6, 0.55); backdrop-filter: blur(6px); z-index: calc(var(--bb-z-overlay, 900) + 10); display: flex; align-items: center; justify-content: center; padding: 20px; }
.modal-card { background: var(--bb-glass-bg-strong);   border: 1px solid var(--bb-glass-border); border-radius: var(--bb-radius-lg); padding: 26px; max-width: 400px; width: 100%; text-align: center; box-shadow: var(--bb-glass-lg); max-height: 90vh; overflow-y: auto; }
.detail-card { max-width: 470px; text-align: left; }
.modal-emoji { font-size: var(--bb-text-3xl); margin-bottom: 8px; }
.modal-card h3 { font-size: var(--bb-text-xl); font-weight: var(--bb-weight-extrabold); margin: 0 0 10px; color: var(--bb-ink); }
.modal-msg { font-size: var(--bb-text-base); color: var(--bb-text-secondary); margin: 0 0 6px; line-height: 1.6; }
.modal-note { font-size: var(--bb-text-xs); color: var(--bb-danger); font-weight: var(--bb-weight-semibold); margin: 0 0 18px; }
.modal-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.detail-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--bb-glass-border); }
.detail-head h3 { margin: 0 0 4px; font-size: var(--bb-text-lg); font-weight: var(--bb-weight-extrabold); color: var(--bb-ink); }
.detail-ref { margin: 0; font-size: var(--bb-text-xs); color: var(--bb-text-tertiary); }
.detail-ref b { color: var(--bb-text-secondary); }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
.d-item { display: flex; flex-direction: column; gap: 2px; }
.d-label { font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-extrabold); text-transform: uppercase; letter-spacing: .05em; color: var(--bb-text-tertiary); }
.d-value { font-size: var(--bb-text-sm); font-weight: var(--bb-weight-semibold); color: var(--bb-ink); }
.d-price { color: var(--bb-accent-ink); font-weight: var(--bb-weight-extrabold); }
.detail-contact { background: var(--bb-bg-subtle); border: 1px solid var(--bb-glass-border); border-radius: 10px; padding: 10px 12px; margin-bottom: 16px; }
.detail-contact p { margin: 3px 0; font-size: var(--bb-text-xs); color: var(--bb-text-secondary); }
.detail-actions { justify-content: flex-end; }

.modal-enter-active, .modal-leave-active { transition: opacity .22s ease; }
.modal-enter-active .modal-card, .modal-leave-active .modal-card { transition: transform .22s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .modal-card, .modal-leave-to .modal-card { transform: scale(.95) translateY(8px); }

/* ── Responsive ── */
@media (max-width: 720px) {
  .kanban-view { overflow-x: visible; padding-bottom: 0; }
  .kanban-board { flex-direction: column; min-width: 0; }
  .kanban-column { min-width: 0; max-height: none; }
  .kanban-cards { max-height: 340px; }
  .view-row { justify-content: stretch; }
  .view-toggle { display: flex; width: 100%; }
  .view-toggle button { flex: 1; justify-content: center; }
}
@media (max-width: 640px) {
  .filter-chips { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; max-width: 100%; }
  .filter-chips::-webkit-scrollbar { display: none; }
  .chip { white-space: nowrap; }
  .archive-months { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; max-width: 100%; padding-bottom: 2px; }
  .archive-months::-webkit-scrollbar { display: none; }
  .archive-grid { grid-template-columns: 1fr; }
  .cal-cell { min-height: 52px; padding: 3px; }
  .cal-ev { width: 8px; height: 8px; padding: 0; border-radius: 50%; border-left: none; margin: 2px auto 0; background: var(--st, var(--bb-text-tertiary)); }
  .cal-ev-name { display: none; }
  .cal-more { padding-left: 0; text-align: center; display: block; }
  .cal-legend { gap: 10px; }
  .detail-actions button, .detail-actions .reviewed-pill { flex: 1; justify-content: center; text-align: center; }
  .modal-actions button { flex: 1; }
  .ctx-menu { min-width: 200px; }
}
</style>