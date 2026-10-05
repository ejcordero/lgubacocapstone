<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { API } from '@/api'

const router = useRouter()

// Real login saves the JWT under 'baco_owner_token' (see router guard in index.js)
const getOwnerToken = () =>
  localStorage.getItem('baco_owner_token') ||
  localStorage.getItem('ownerToken') ||
  localStorage.getItem('owner_token') ||
  ''

// ── State ──
const bookings = ref([])
const stats = ref({ total: 0, pending: 0, confirmed: 0, completed: 0, revenue: 0, todayArrivals: 0, todayDepartures: 0, inHouse: 0 })
const hotelName = ref('')
const loading = ref(false)

const searchQuery = ref('')
const statusFilter = ref('')
const typeFilter = ref('')
const currentPage = ref(1)
const perPage = 6
const activeView = ref('kanban') // 'list' | 'calendar' | 'kanban' | 'archive' — kanban is the default

const showDetailModal = ref(false)
const selectedBooking = ref(null)
const busyId = ref(null)
const toastMsg = ref('')
const toastType = ref('ok')
let toastTimer = null

// ── Status metadata ──
const STATUS_META = {
  pending:   { label: 'Pending',   cls: 'st-pending' },
  confirmed: { label: 'Approved',  cls: 'st-confirmed' },
  completed: { label: 'Completed', cls: 'st-completed' },
  rejected:  { label: 'Rejected',  cls: 'st-rejected' },
  cancelled: { label: 'Cancelled', cls: 'st-rejected' },
  no_show:   { label: 'No Show',   cls: 'st-muted' }
}
const statusLabel = (s) => STATUS_META[s]?.label || s || '—'
const statusCls = (s) => STATUS_META[s]?.cls || 'st-muted'
function statusColor(s) {
  return { pending: '#F2B807', confirmed: '#B0D91E', completed: '#07DBF2', rejected: '#F20707', cancelled: '#F20707', no_show: '#9ca3af' }[s] || '#9ca3af'
}

// ── Helpers ──
const peso = (n) => '₱' + Number(n || 0).toLocaleString()
function fmtDate(d) {
  if (!d) return '—'
  return new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function getInitials(name) {
  return (name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase()
}
const typeLabel = (b) => b.bookingType === 'entrance' ? 'Day Tour' : 'Overnight'
function productLabel(b) {
  if (b.bookingType === 'entrance') return b.feeName || 'Entrance'
  return [b.roomName, b.feeName].filter(Boolean).join(' + ') || 'Stay'
}

// ── Manual archive overrides ──
// The backend has no archive flag, so manual archive/unarchive choices are
// persisted per-browser in localStorage, keyed by booking reference.
// (Separate key from the citizen portal so the two boards don't cross-talk.)
//   'archived'   → force into the Archive even if the month hasn't ended
//   'unarchived' → keep on Kanban/Calendar even though the month has passed
// Bookings with no override follow the automatic month-end rule.
const OVERRIDES_KEY = 'stayhub.ownerArchiveOverrides'
const overrides = ref({})
try { overrides.value = JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}') } catch (e) { overrides.value = {} }
const saveOverrides = () => { try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides.value)) } catch (e) {} }

function startOfCurrentMonth() {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), 1)
}
// A booking is archived when: manually archived, OR (no override) its entire
// stay belongs to a passed month — final day (check-out; visit day for day
// tours, since the backend sets checkOut = visitDate) before the 1st of the
// current month. 'unarchived' suppresses the automatic rule until the user
// archives it again.
const isArchived = (b) => {
  const ov = overrides.value[b.id]
  if (ov === 'archived') return true
  if (ov === 'unarchived') return false
  const co = String(b.checkOut || b.checkIn || '').slice(0, 10)
  if (!co) return false
  return new Date(co + 'T00:00:00') < startOfCurrentMonth()
}
// Archive grouping anchor: the month the booking started
const monthKeyOf = (b) => String(b.checkIn || '').slice(0, 7)

// "Closed" = rejected / cancelled / no_show (same set as the Closed column).
// Only Completed + Closed bookings can be manually archived; Pending and
// Approved show a disabled item explaining why. Any archived booking can be
// restored to the Kanban and Calendar from the Archive view.
const ARCHIVEABLE_STATUSES = ['completed', 'rejected', 'cancelled', 'no_show']
const canArchive = (b) => ARCHIVEABLE_STATUSES.includes(b.status)

// ── Data loading ──
async function loadBookings() {
  loading.value = true
  try {
    const res = await fetch(`${API}/owner/bookings`, {
      headers: { Authorization: `Bearer ${getOwnerToken()}` }
    })
    if (res.status === 401 || res.status === 403) { router.push('/owner/login'); return }
    const data = await res.json()
    bookings.value = data.bookings || []
    stats.value = data.stats || stats.value
    hotelName.value = data.hotel?.name || ''
  } catch (e) {
    showToast('Could not load bookings. Is the server running?', 'err')
  } finally {
    loading.value = false
  }
}
onMounted(() => {
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

// ── Filtering ──
// filteredBookings = ALL bookings after search/status/type filters — used by
// the List view and the Calendar. (List deliberately keeps archived bookings,
// tagged with an "Archived" badge, so the "Review Now" alert can always
// surface a past pending booking that the Kanban no longer shows.)
const filteredBookings = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return bookings.value.filter(b => {
    const matchesSearch = !q ||
      b.id.toLowerCase().includes(q) ||
      (b.guestName || '').toLowerCase().includes(q) ||
      (b.guestEmail || '').toLowerCase().includes(q)
    const matchesStatus = !statusFilter.value || b.status === statusFilter.value
    const matchesType = !typeFilter.value || b.bookingType === typeFilter.value
    return matchesSearch && matchesStatus && matchesType
  })
})
// Kanban — active (non-archived) bookings only
const kanbanBookings = computed(() => filteredBookings.value.filter(b => !isArchived(b)))
const archivedBookings = computed(() => bookings.value.filter(isArchived))

const currentViewEmpty = computed(() => {
  if (activeView.value === 'archive') return false // Archive handles its own empty state
  if (activeView.value === 'kanban') return kanbanBookings.value.length === 0
  return filteredBookings.value.length === 0 // List + Calendar share the full filtered set
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredBookings.value.length / perPage)))
const paginatedBookings = computed(() => {
  const start = (currentPage.value - 1) * perPage
  return filteredBookings.value.slice(start, start + perPage)
})
watch([searchQuery, statusFilter, typeFilter], () => { currentPage.value = 1 })

function filterPending() {
  statusFilter.value = 'pending'
  typeFilter.value = ''
  activeView.value = 'list'
}

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
      // uses the FULL filtered list (archived included) so navigating back to
      // a past month still shows what happened there
      bookings: filteredBookings.value.filter(b => b.checkIn <= key && b.checkOut >= key)
    })
  }
  return cells
})

// ── Kanban ──
const kanbanColumns = [
  { key: 'pending',   label: 'Pending Approval',     labelShort: 'Pending',                        match: ['pending'],                           color: '#F2B807' },
  { key: 'confirmed', label: 'Approved / Upcoming',  labelShort: 'Approved',                       match: ['confirmed'],                         color: '#B0D91E' },
  { key: 'completed', label: 'Completed',            labelShort: 'Completed',                      match: ['completed'],                         color: '#07DBF2' },
  { key: 'closed',    label: 'Rejected / Cancelled', labelShort: 'Closed',                         match: ['rejected', 'cancelled', 'no_show'],  color: '#F20707' }
]
const colBookings = (col) => kanbanBookings.value.filter(b => col.match.includes(b.status))

// ── Archive ──
const archiveMonth = ref('all')

// Archive pool after search/status/type filters (before the month filter) —
// also drives the month chips so they always reflect findable bookings
const archiveBase = computed(() => filteredBookings.value.filter(isArchived))

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
const menu = ref(null) // { booking, action: 'archive' | 'unarchive', x, y, flip }
const toggleMenu = (b, action, e) => {
  if (menu.value && menu.value.booking?.id === b.id && menu.value.action === action) { closeMenu(); return }
  const r = e.currentTarget.getBoundingClientRect()
  // Flip above the button when there isn't room below (disabled variant is taller)
  const estH = action === 'archive' && !canArchive(b) ? 96 : 56
  let y = r.bottom + 6
  let flip = false
  if (y + estH > window.innerHeight - 8) { y = r.top - 6; flip = true }
  menu.value = { booking: b, action, x: r.right, y, flip }
}
const closeMenu = () => { menu.value = null }

const archiveBooking = (b) => {
  overrides.value[b.id] = 'archived'
  saveOverrides()
  archiveMonth.value = 'all' // so it's visible right away in the Archive
  closeMenu()
  showToast(`Booking ${b.id} moved to your Archive.`)
}
const unarchiveBooking = (b) => {
  overrides.value[b.id] = 'unarchived'
  saveOverrides()
  closeMenu()
  showToast(`Booking ${b.id} restored — it's back on the Kanban and Calendar.`)
}

// Close the menu on outside click / Escape / scroll / resize — it's
// fixed-positioned, so it must not follow scrolled content.
const onDocClick = (e) => {
  if (!menu.value) return
  const t = e.target
  if (t.closest && (t.closest('.ctx-menu') || t.closest('.k-menu'))) return
  closeMenu()
}
const onKeydown = (e) => { if (e.key === 'Escape') closeMenu() }
const onDismissUi = () => { if (menu.value) closeMenu() }

watch(activeView, () => closeMenu())

// ── Detail modal ──
function openDetail(b) {
  selectedBooking.value = b
  showDetailModal.value = true
}
function closeDetail() {
  showDetailModal.value = false
  selectedBooking.value = null
}

// ── Status updates (approve / reject / complete / cancel / no-show) ──
async function updateStatus(b, newStatus) {
  if (busyId.value) return
  busyId.value = b.id
  try {
    const res = await fetch(`${API}/owner/bookings/${encodeURIComponent(b.id)}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getOwnerToken()}` },
      body: JSON.stringify({ status: newStatus })
    })
    if (res.status === 401 || res.status === 403) { router.push('/owner/login'); return }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || 'Failed to update booking.')
    showToast(data.message || `Booking ${newStatus}.`)
    closeDetail()
    await loadBookings()
  } catch (e) {
    showToast(e.message, 'err')
  } finally {
    busyId.value = null
  }
}

function showToast(msg, type = 'ok') {
  toastMsg.value = msg
  toastType.value = type
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 3500)
}
</script>

<template>
  <div class="booking-monitor">
    <div class="page-title">
      <div>
        <h1>Booking <span>Management</span></h1>
        <p>{{ hotelName ? `Reservations for ${hotelName}.` : 'Track and manage guest reservations.' }}</p>
      </div>
      <button class="btn-secondary" :disabled="loading" @click="loadBookings">
        <i class="fas fa-rotate-right"></i><span class="btn-text">Refresh</span>
      </button>
    </div>

    <!-- ═══ DAILY BRIEFING (server-computed) ═══ -->
    <div class="briefing">
      <div class="briefing-card pending clickable" @click="filterPending">
        <div class="briefing-icon"><i class="fas fa-hourglass-half"></i></div>
        <div class="briefing-info">
          <div class="briefing-value">{{ stats.pending }}</div>
          <div class="briefing-label">Pending Approval</div>
        </div>
      </div>
      <div class="briefing-card arrivals">
        <div class="briefing-icon"><i class="fas fa-plane-arrival"></i></div>
        <div class="briefing-info">
          <div class="briefing-value">{{ stats.todayArrivals }}</div>
          <div class="briefing-label">Arrivals Today</div>
        </div>
      </div>
      <div class="briefing-card departures">
        <div class="briefing-icon"><i class="fas fa-plane-departure"></i></div>
        <div class="briefing-info">
          <div class="briefing-value">{{ stats.todayDepartures }}</div>
          <div class="briefing-label">Departures Today</div>
        </div>
      </div>
      <div class="briefing-card in-house">
        <div class="briefing-icon"><i class="fas fa-bed"></i></div>
        <div class="briefing-info">
          <div class="briefing-value">{{ stats.inHouse }}</div>
          <div class="briefing-label">Currently In-House</div>
        </div>
      </div>
      <div class="briefing-card revenue">
        <div class="briefing-icon"><i class="fas fa-peso-sign"></i></div>
        <div class="briefing-info">
          <div class="briefing-value">₱{{ Number(stats.revenue || 0).toLocaleString() }}</div>
          <div class="briefing-label">Revenue (Approved + Completed)</div>
        </div>
      </div>
    </div>

    <div v-if="stats.pending > 0" class="alert-banner">
      <i class="fas fa-exclamation-triangle"></i>
      <span><strong>{{ stats.pending }} booking(s)</strong> awaiting your approval.</span>
      <button class="alert-btn" @click="filterPending">Review Now</button>
    </div>

    <!-- ═══ FILTERS & VIEW TOGGLE ═══ -->
    <div class="controls-bar">
      <div class="filters">
        <div class="search-wrap">
          <i class="fas fa-search"></i>
          <input v-model="searchQuery" type="text" placeholder="Search ref, guest name, or email…" />
        </div>
        <select v-model="statusFilter">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Approved</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No Show</option>
        </select>
        <select v-model="typeFilter">
          <option value="">All Types</option>
          <option value="entrance">Day Tour</option>
          <option value="accommodation">Overnight</option>
        </select>
      </div>
      <div class="view-toggle">
        <button :class="{ active: activeView === 'list' }" @click="activeView = 'list'"><i class="fas fa-list"></i><span>List</span></button>
        <button :class="{ active: activeView === 'kanban' }" @click="activeView = 'kanban'"><i class="fas fa-columns"></i><span>Kanban</span></button>
        <button :class="{ active: activeView === 'calendar' }" @click="activeView = 'calendar'"><i class="fas fa-calendar-alt"></i><span>Calendar</span></button>
        <button :class="{ active: activeView === 'archive' }" @click="activeView = 'archive'"><i class="fas fa-archive"></i><span>Archive</span></button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="state-box"><div class="spinner"></div><p>Loading bookings…</p></div>

    <!-- ═══ VIEW: ARCHIVE (past months + manually archived) ═══ -->
    <div v-else-if="activeView === 'archive'" class="archive-view">
      <div class="archive-head">
        <h3><i class="fas fa-archive"></i> Archive</h3>
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
          <div class="k-card-top">
            <div class="k-avatar">{{ getInitials(b.guestName) }}</div>
            <div class="k-info">
              <div class="k-name">{{ b.guestName }}</div>
              <div class="k-id">{{ b.id }}</div>
            </div>
            <button class="k-menu" :class="{ active: menu?.booking?.id === b.id }"
                    aria-label="Booking options" @click.stop="toggleMenu(b, 'unarchive', $event)">
              <i class="fas fa-ellipsis-v"></i>
            </button>
          </div>
          <div class="k-hotel">
            <span class="type-badge" :class="b.bookingType === 'entrance' ? 'ent' : 'stay'">{{ typeLabel(b) }}</span>
            {{ productLabel(b) }}
          </div>
          <div class="k-dates">
            <span>{{ fmtDate(b.checkIn) }}</span>
            <i class="fas fa-arrow-right"></i>
            <span>{{ fmtDate(b.checkOut) }}</span>
          </div>
          <div class="k-bottom">
            <div class="k-amount">{{ peso(b.totalAmount) }}</div>
            <span class="status-pill" :class="statusCls(b.status)">{{ statusLabel(b.status) }}</span>
          </div>
        </div>
      </div>

      <!-- Archive empty state -->
      <div v-else class="empty-state archive-empty">
        <i class="fas fa-archive"></i>
        <template v-if="archivedBookings.length === 0">
          <h3>Nothing archived yet</h3>
          <p>Bookings move here automatically once their month ends — or archive them yourself from the Kanban (⋮).</p>
        </template>
        <template v-else>
          <h3>No bookings here</h3>
          <p>No archived bookings match the current view.</p>
          <div class="empty-actions">
            <button v-if="archiveMonth !== 'all'" class="btn-secondary" @click="archiveMonth = 'all'">Show All Months</button>
            <button v-if="searchQuery || statusFilter || typeFilter" class="btn-secondary" @click="searchQuery = ''; statusFilter = ''; typeFilter = ''">Clear Filters</button>
          </div>
        </template>
      </div>
    </div>

    <!-- Empty (List / Kanban / Calendar) -->
    <div v-else-if="currentViewEmpty" class="empty-state boxed">
      <i class="fas fa-calendar-times"></i>
      <h3>No bookings found</h3>
      <p v-if="archivedBookings.length > 0">All matching bookings are in the Archive.</p>
      <p v-else-if="!searchQuery && !statusFilter && !typeFilter">No reservations yet.</p>
      <p v-else>Try adjusting your filters.</p>
      <div class="empty-actions">
        <button v-if="archivedBookings.length > 0" class="btn-primary" @click="activeView = 'archive'"><i class="fas fa-archive"></i> Open Archive ({{ archivedBookings.length }})</button>
        <button v-if="searchQuery || statusFilter || typeFilter" class="btn-secondary" @click="searchQuery = ''; statusFilter = ''; typeFilter = ''">Clear Filters</button>
      </div>
    </div>

    <!-- ═══ VIEW: LIST (paginated) ═══ -->
    <div v-else-if="activeView === 'list'">
      <div class="table-wrap desktop-view">
        <table>
          <thead>
            <tr>
              <th>Ref</th><th>Guest</th><th>Type</th><th>Room / Fee</th>
              <th>Check-in</th><th>Check-out</th><th>Pax</th><th>Amount</th><th>Payment</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in paginatedBookings" :key="b.id" @click="openDetail(b)">
              <td class="id-cell">{{ b.id }}</td>
              <td class="guest-cell">{{ b.guestName }}</td>
              <td><span class="type-badge" :class="b.bookingType === 'entrance' ? 'ent' : 'stay'">{{ typeLabel(b) }}</span></td>
              <td>{{ productLabel(b) }}</td>
              <td>{{ fmtDate(b.checkIn) }}</td>
              <td>{{ fmtDate(b.checkOut) }}</td>
              <td class="num">{{ b.pax }}</td>
              <td class="amount">{{ peso(b.totalAmount) }}</td>
              <td><span class="pay-pill" :class="b.paymentStatus === 'paid' ? 'paid' : 'unpaid'">{{ b.paymentStatus }}</span></td>
              <td>
                <span class="status-pill" :class="statusCls(b.status)">{{ statusLabel(b.status) }}</span>
                <span v-if="isArchived(b)" class="arch-tag" title="This booking is in the Archive"><i class="fas fa-archive"></i>Archived</span>
              </td>
              <td><button class="action-btn" @click.stop="openDetail(b)"><i class="fas fa-eye"></i></button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mobile-cards">
        <div v-for="b in paginatedBookings" :key="b.id" class="booking-card" @click="openDetail(b)">
          <div class="card-top">
            <div class="card-guest">
              <div class="guest-avatar">{{ getInitials(b.guestName) }}</div>
              <div class="guest-info">
                <div class="guest-name">{{ b.guestName }}</div>
                <div class="guest-id">{{ b.id }}</div>
              </div>
            </div>
            <span class="status-pill" :class="statusCls(b.status)">{{ statusLabel(b.status) }}</span>
            <span v-if="isArchived(b)" class="arch-tag"><i class="fas fa-archive"></i>Archived</span>
          </div>
          <div class="card-hotel">
            <span class="type-badge" :class="b.bookingType === 'entrance' ? 'ent' : 'stay'">{{ typeLabel(b) }}</span>
            <span>{{ productLabel(b) }}</span>
          </div>
          <div class="card-dates">
            <div class="date-item">
              <span class="date-label">{{ b.bookingType === 'entrance' ? 'Visit' : 'Check-in' }}</span>
              <span class="date-value">{{ fmtDate(b.checkIn) }}</span>
            </div>
            <div class="date-arrow"><i class="fas fa-arrow-right"></i></div>
            <div class="date-item">
              <span class="date-label">{{ b.bookingType === 'entrance' ? 'Day Tour' : 'Check-out' }}</span>
              <span class="date-value">{{ fmtDate(b.checkOut) }}</span>
            </div>
          </div>
          <div class="card-bottom">
            <div class="card-room"><i class="fas fa-users"></i> {{ b.pax }} guest{{ b.pax > 1 ? 's' : '' }}</div>
            <div class="card-amount">{{ peso(b.totalAmount) }}</div>
          </div>
        </div>
      </div>

      <div class="pagination" v-if="totalPages > 1">
        <button :disabled="currentPage === 1" @click="currentPage--"><i class="fas fa-chevron-left"></i></button>
        <button v-for="p in totalPages" :key="p" :class="{ active: p === currentPage }" @click="currentPage = p">{{ p }}</button>
        <button :disabled="currentPage === totalPages" @click="currentPage++"><i class="fas fa-chevron-right"></i></button>
      </div>
    </div>

    <!-- ═══ VIEW: MONTH CALENDAR ═══ -->
    <div v-else-if="activeView === 'calendar'" class="calendar-view">
      <div class="cal-legend">
        <span class="legend-item"><span class="dot" style="background:#B0D91E"></span> Approved / Upcoming</span>
        <span class="legend-item"><span class="dot" style="background:#F2B807"></span> Pending</span>
        <span class="legend-item"><span class="dot" style="background:#07DBF2"></span> Completed</span>
        <span class="legend-item"><span class="dot" style="background:#F20707"></span> Rejected / Cancelled</span>
        <span class="legend-item"><span class="dot" style="background:#9ca3af"></span> No Show</span>
      </div>

      <div class="cal-toolbar">
        <button class="cal-nav" @click="shiftMonth(-1)"><i class="fas fa-chevron-left"></i></button>
        <h3 class="cal-title">{{ calMonthLabel }}</h3>
        <div class="cal-right">
          <button class="cal-nav" @click="goToday">Today</button>
          <button class="cal-nav" @click="shiftMonth(1)"><i class="fas fa-chevron-right"></i></button>
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
                 :title="`${b.guestName} — ${statusLabel(b.status)}`"
                 @click="openDetail(b)">
              <span class="cal-ev-name">{{ b.guestName }}</span>
            </div>
            <span v-if="cell.bookings.length > 3" class="cal-more">+{{ cell.bookings.length - 3 }} more</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ VIEW: KANBAN (default) ═══ -->
    <div v-else-if="activeView === 'kanban'" class="kanban-view">
      <div class="kanban-board">
        <div class="kanban-column" v-for="col in kanbanColumns" :key="col.key">
          <div class="kanban-header" :style="{ borderTopColor: col.color }">
            <h4><span class="kh-full">{{ col.label }}</span><span class="kh-short">{{ col.labelShort }}</span></h4>
            <span class="kanban-count">{{ colBookings(col).length }}</span>
          </div>
          <div class="kanban-cards">
            <div v-for="b in colBookings(col)" :key="b.id" class="kanban-card" @click="openDetail(b)">
              <div class="k-card-top">
                <div class="k-avatar">{{ getInitials(b.guestName) }}</div>
                <div class="k-info">
                  <div class="k-name">{{ b.guestName }}</div>
                  <div class="k-id">{{ b.id }}</div>
                </div>
                <button class="k-menu" :class="{ active: menu?.booking?.id === b.id }"
                        aria-label="Booking options" @click.stop="toggleMenu(b, 'archive', $event)">
                  <i class="fas fa-ellipsis-v"></i>
                </button>
              </div>
              <div class="k-hotel">
                <span class="type-badge" :class="b.bookingType === 'entrance' ? 'ent' : 'stay'">{{ typeLabel(b) }}</span>
                {{ productLabel(b) }}
              </div>
              <div class="k-dates">
                <span>{{ fmtDate(b.checkIn) }}</span>
                <i class="fas fa-arrow-right"></i>
                <span>{{ fmtDate(b.checkOut) }}</span>
              </div>
              <div class="k-bottom">
                <div class="k-amount">{{ peso(b.totalAmount) }}</div>
                <div class="k-actions">
                  <template v-if="b.status === 'pending'">
                    <button class="k-btn approve" :disabled="busyId === b.id" @click.stop="updateStatus(b, 'confirmed')" title="Approve"><i class="fas fa-check"></i></button>
                    <button class="k-btn reject" :disabled="busyId === b.id" @click.stop="updateStatus(b, 'rejected')" title="Reject"><i class="fas fa-times"></i></button>
                  </template>
                  <template v-else-if="b.status === 'confirmed'">
                    <button class="k-btn complete" :disabled="busyId === b.id" @click.stop="updateStatus(b, 'completed')" title="Mark completed"><i class="fas fa-flag-checkered"></i></button>
                    <button class="k-btn noshow" :disabled="busyId === b.id" @click.stop="updateStatus(b, 'no_show')" title="No-show"><i class="fas fa-user-slash"></i></button>
                    <button class="k-btn reject" :disabled="busyId === b.id" @click.stop="updateStatus(b, 'cancelled')" title="Cancel"><i class="fas fa-ban"></i></button>
                  </template>
                </div>
              </div>
            </div>
            <div v-if="colBookings(col).length === 0" class="kanban-empty">
              <i class="fas fa-inbox"></i>
              <p>No bookings</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ DETAIL MODAL ═══ -->
    <div v-if="showDetailModal && selectedBooking" class="modal-overlay" @click.self="closeDetail">
      <div class="modal-content detail-modal">
        <div class="modal-header">
          <h3>Booking Details</h3>
          <button class="close-btn" @click="closeDetail"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div class="detail-header">
            <div>
              <h2>{{ selectedBooking.id }}</h2>
              <p class="detail-sub">Booked by {{ selectedBooking.guestName }} · {{ fmtDateTime(selectedBooking.createdAt) }}</p>
            </div>
            <span class="status-pill" :class="statusCls(selectedBooking.status)">{{ statusLabel(selectedBooking.status) }}</span>
          </div>

          <div class="detail-grid">
            <div class="detail-item"><span class="detail-label">Type</span><span class="detail-value">{{ typeLabel(selectedBooking) }}</span></div>
            <div class="detail-item"><span class="detail-label">Room / Fee</span><span class="detail-value">{{ productLabel(selectedBooking) }}</span></div>
            <div class="detail-item"><span class="detail-label">Check-in</span><span class="detail-value">{{ fmtDate(selectedBooking.checkIn) }}</span></div>
            <div class="detail-item"><span class="detail-label">Check-out</span><span class="detail-value">{{ fmtDate(selectedBooking.checkOut) }}</span></div>
            <div class="detail-item"><span class="detail-label">Guests</span><span class="detail-value">{{ selectedBooking.pax }} ({{ selectedBooking.adults }} adult{{ selectedBooking.adults > 1 ? 's' : '' }}{{ selectedBooking.children ? `, ${selectedBooking.children} child${selectedBooking.children > 1 ? 'ren' : ''}` : '' }})</span></div>
            <div class="detail-item"><span class="detail-label">Nights</span><span class="detail-value">{{ selectedBooking.nights }}</span></div>
            <div class="detail-item"><span class="detail-label">Total Amount</span><span class="detail-value highlight">{{ peso(selectedBooking.totalAmount) }}</span></div>
            <div class="detail-item">
              <span class="detail-label">Payment</span>
              <span class="detail-value"><span class="pay-pill" :class="selectedBooking.paymentStatus === 'paid' ? 'paid' : 'unpaid'">{{ selectedBooking.paymentStatus }}</span> · {{ (selectedBooking.paymentMethod || '').replace('_',' ') }}</span>
            </div>
          </div>

          <div class="contact-section">
            <h4>Guest Contact</h4>
            <p v-if="selectedBooking.guestEmail"><i class="fas fa-envelope"></i> {{ selectedBooking.guestEmail }}</p>
            <p v-if="selectedBooking.guestContact"><i class="fas fa-phone"></i> {{ selectedBooking.guestContact }}</p>
            <p v-if="selectedBooking.guestIdType"><i class="fas fa-id-card"></i> {{ { philid: 'PhilID / National ID', passport: 'Passport', drivers: "Driver's License" }[selectedBooking.guestIdType] || selectedBooking.guestIdType }}</p>
          </div>

          <div v-if="selectedBooking.specialRequests" class="notes-section">
            <h4>Special Requests</h4>
            <p>{{ selectedBooking.specialRequests }}</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeDetail">Close</button>
          <template v-if="selectedBooking.status === 'pending'">
            <button class="btn-danger" :disabled="busyId === selectedBooking.id" @click="updateStatus(selectedBooking, 'rejected')"><i class="fas fa-times"></i> Reject</button>
            <button class="btn-primary" :disabled="busyId === selectedBooking.id" @click="updateStatus(selectedBooking, 'confirmed')"><i class="fas fa-check"></i> Approve</button>
          </template>
          <template v-else-if="selectedBooking.status === 'confirmed'">
            <button class="btn-danger" :disabled="busyId === selectedBooking.id" @click="updateStatus(selectedBooking, 'cancelled')"><i class="fas fa-ban"></i> Cancel</button>
            <button class="btn-primary" :disabled="busyId === selectedBooking.id" @click="updateStatus(selectedBooking, 'completed')"><i class="fas fa-flag-checkered"></i> Mark Completed</button>
          </template>
        </div>
      </div>
    </div>

    <!-- ═══ ⋮ CONTEXT MENU (Kanban: archive · Archive: restore) ═══ -->
    <transition name="ctxfade">
      <div v-if="menu" class="ctx-menu" role="menu"
           :style="{ left: menu.x + 'px', top: menu.y + 'px', transform: menu.flip ? 'translateX(-100%) translateY(-100%)' : 'translateX(-100%)' }">
        <template v-if="menu.action === 'archive'">
          <button v-if="canArchive(menu.booking)" class="ctx-item" role="menuitem" @click="archiveBooking(menu.booking)">
            <i class="fas fa-archive"></i>
            <span class="ctx-txt">Move to Archive<small>Removes it from this board.</small></span>
          </button>
          <div v-else class="ctx-disabled">
            <i class="fas fa-archive"></i>
            <span class="ctx-txt">Move to Archive<small>Only Completed or Closed bookings can be archived.</small></span>
          </div>
        </template>
        <button v-else class="ctx-item" role="menuitem" @click="unarchiveBooking(menu.booking)">
          <i class="fas fa-box-open"></i>
          <span class="ctx-txt">Restore to Kanban<small>Back on the board and calendar.</small></span>
        </button>
      </div>
    </transition>

    <!-- Toast -->
    <div v-if="toastMsg" class="toast" :class="toastType">{{ toastMsg }}</div>
  </div>
</template>

<style scoped>
.booking-monitor { animation: fadeIn .5s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

.page-title { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 28px; flex-wrap: wrap; gap: 14px; }
.page-title h1 { font-family: 'Unbounded', sans-serif; font-size: clamp(28px, 5vw, 48px); font-weight: 800; color: var(--fg); letter-spacing: -0.04em; margin: 0; line-height: .95; }
.page-title h1 span { background: linear-gradient(135deg, var(--ac), var(--wn)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.page-title p { color: var(--mt); font-size: 13px; margin: 6px 0 0; }

.btn-primary { padding: 10px 18px; background: linear-gradient(135deg, #B0D91E, #B0D91E); color: #fff; border: none; border-radius: 11px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: all .3s; }
.btn-primary:hover:not(:disabled) { transform: translateY(-2px); }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.btn-secondary { padding: 10px 18px; background: var(--bg2); color: var(--fg2); border: 1px solid var(--bdr); border-radius: 11px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: all .3s; }
.btn-secondary:hover:not(:disabled) { background: var(--card2); }
.btn-secondary:disabled { opacity: .5; cursor: not-allowed; }
.btn-danger { padding: 10px 18px; background: linear-gradient(135deg, #F20707, #F20707); color: #fff; border: none; border-radius: 11px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: all .3s; }
.btn-danger:hover:not(:disabled) { transform: translateY(-2px); }
.btn-danger:disabled { opacity: .5; cursor: not-allowed; }

/* Briefing */
.briefing { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px; }
.briefing-card { background: var(--card); border: 1px solid var(--bdr); border-radius: 14px; padding: 16px; display: flex; align-items: center; gap: 14px; transition: all .3s; }
.briefing-card.clickable { cursor: pointer; }
.briefing-card.clickable:hover { transform: translateY(-2px); border-color: var(--ac); }
.briefing-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #fff; flex-shrink: 0; }
.arrivals .briefing-icon { background: linear-gradient(135deg, #07DBF2, #07DBF2); }
.departures .briefing-icon { background: var(--eco-mint); }
.in-house .briefing-icon { background: linear-gradient(135deg, #D9B384, #6B5433); }
.pending .briefing-icon { background: linear-gradient(135deg, #F2B807, #7A5300); }
.revenue .briefing-icon { background: linear-gradient(135deg, #B0D91E, #B0D91E); }
.briefing-info { flex: 1; min-width: 0; }
.briefing-value { font-family: 'Unbounded', sans-serif; font-size: 22px; font-weight: 800; color: var(--fg); line-height: 1; }
.briefing-label { font-size: 10px; color: var(--mt); text-transform: uppercase; letter-spacing: .5px; font-weight: 700; margin-top: 4px; }

.alert-banner { background: linear-gradient(135deg, rgba(245,158,11,.12), rgba(239,68,68,.08)); border: 1px solid rgba(245,158,11,.3); border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.alert-banner i { color: #F2B807; font-size: 18px; }
.alert-banner span { flex: 1; font-size: 13px; color: var(--fg2); }
.alert-banner strong { color: var(--fg); }
.alert-btn { background: #F2B807; color: #fff; border: none; padding: 8px 14px; border-radius: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; cursor: pointer; transition: all .3s; }
.alert-btn:hover { background: #7A5300; transform: translateY(-1px); }

/* Controls */
.controls-bar { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 20px; flex-wrap: wrap; }
.filters { display: flex; gap: 10px; flex-wrap: wrap; flex: 1; }
.search-wrap { position: relative; flex: 1; min-width: 220px; }
.search-wrap i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--mt); font-size: 12px; }
.search-wrap input, .filters select {
  padding: 10px 14px;
  background: var(--bg2);
  border: 1px solid var(--bdr);
  border-radius: 10px;
  color: var(--fg);
  font-size: 13px;
  outline: none;
  transition: all .3s;
}

/* ── Dropdown fix: render native popup in dark mode ── */
.filters select {
  color-scheme: dark;              /* makes the OS dropdown dark + hover highlight visible */
  cursor: pointer;
  appearance: none;                /* remove native arrow so we can draw our own */
  -webkit-appearance: none;
  padding-right: 36px;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
}

.filters select option {
  background: var(--bg2, #161a24); /* fallback in case the var doesn't reach the popup */
  color: var(--fg, #e5e7eb);
}

.filters select option:hover,
.filters select option:focus,
.filters select option:checked {
  background: var(--ac, #B0D91E);
  color: #ffffff;
}

.filters select:focus {
  border-color: var(--ac);
  box-shadow: 0 0 0 3px var(--acs);
}
.search-wrap input { width: 100%; padding-left: 40px; }
.filters select { min-width: 140px; }
.search-wrap input:focus, .filters select:focus { border-color: var(--ac); box-shadow: 0 0 0 3px var(--acs); }
.view-toggle { display: flex; gap: 4px; background: var(--bg2); border: 1px solid var(--bdr); border-radius: 10px; padding: 4px; }
.view-toggle button { background: transparent; border: none; color: var(--mt); padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all .25s; }
.view-toggle button.active { background: var(--ac); color: #fff; box-shadow: 0 4px 12px var(--acg); }
.view-toggle button:hover:not(.active) { color: var(--fg); background: var(--card2); }

/* Status / type / pay pills */
.status-pill { display: inline-block; padding: 4px 11px; border-radius: 999px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; white-space: nowrap; }
.st-pending { background: var(--wng); color: var(--wn); border: 1px solid var(--wn); }
.st-confirmed { background: var(--okg); color: var(--ok); border: 1px solid var(--ok); }
.st-completed { background: var(--tlg); color: var(--tl); border: 1px solid var(--tl); }
.st-rejected { background: var(--dgg); color: var(--dg); border: 1px solid var(--dg); }
.st-muted { background: var(--bg2); color: var(--mt); border: 1px solid var(--bdr); }
.type-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
.type-badge.ent { background: var(--rose-dark); color: var(--rose); }
.type-badge.stay { background: rgba(255,255,255,.08); color: var(--fg2); border: 1px solid var(--bdr); }
.pay-pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
.pay-pill.paid { background: var(--okg); color: var(--ok); }
.pay-pill.unpaid { background: var(--bg2); color: var(--mt); }

/* Archived tag (List view) */
.arch-tag { display: inline-block; margin-left: 6px; padding: 2px 8px; border-radius: 999px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; background: var(--bg2); color: var(--mt); border: 1px dashed var(--bdr); white-space: nowrap; }
.arch-tag i { margin-right: 3px; font-size: 8px; }

/* States */
.state-box { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 20px; color: var(--mt); text-align: center; }
.spinner { width: 34px; height: 34px; border: 3px solid var(--bdr); border-top-color: var(--ac); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.empty-state { text-align: center; padding: 60px 20px; color: var(--mt); }
.empty-state.boxed { background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; }
.empty-state i { font-size: 48px; margin-bottom: 16px; opacity: .3; }
.empty-state h3 { font-family: 'Unbounded', sans-serif; color: var(--fg); margin: 0 0 6px; }
.empty-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }

/* List view (table on desktop, cards on mobile) + pagination */
.table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid var(--bdr); background: var(--card); }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
thead { background: var(--bg2); }
th { padding: 12px 16px; text-align: left; font-family: 'Unbounded', sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--mt); border-bottom: 1px solid var(--bdr); white-space: nowrap; }
td { padding: 12px 16px; border-bottom: 1px solid var(--bdr); color: var(--fg2); white-space: nowrap; }
tr:last-child td { border-bottom: none; }
tbody tr { transition: background .2s; cursor: pointer; }
tbody tr:hover { background: var(--acs); }
.id-cell, .guest-cell { font-weight: 700; color: var(--fg); }
.amount, .num { font-weight: 700; color: var(--fg); }
.action-btn { background: transparent; color: var(--ac); border: none; padding: 6px 10px; border-radius: 8px; cursor: pointer; font-size: 11px; }
.action-btn:hover { background: var(--acs); }

.mobile-cards { display: none; flex-direction: column; gap: 12px; }
.booking-card { background: var(--card); border: 1px solid var(--bdr); border-radius: 14px; padding: 16px; cursor: pointer; transition: all .25s; }
.booking-card:active { transform: scale(.98); }
.booking-card:hover { border-color: var(--ac); }
.card-top { display: flex; align-items: center; gap: 8px; }
.card-guest { display: flex; gap: 12px; align-items: center; flex: 1; min-width: 0; }
.guest-avatar { width: 42px; height: 42px; border-radius: 10px; background: linear-gradient(135deg, var(--ac), var(--wn)); display: flex; align-items: center; justify-content: center; font-family: 'Unbounded', sans-serif; font-weight: 800; font-size: 13px; color: #fff; flex-shrink: 0; }
.guest-info { flex: 1; min-width: 0; }
.guest-name { font-family: 'Unbounded', sans-serif; font-size: 14px; font-weight: 700; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.guest-id { font-size: 11px; color: var(--mt); font-family: monospace; letter-spacing: .5px; margin-top: 2px; }
.card-hotel { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--fg2); padding: 10px 12px; background: var(--bg2); border-radius: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.card-dates { display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--bg2); border-radius: 10px; margin-bottom: 12px; }
.date-item { flex: 1; text-align: center; }
.date-label { display: block; font-size: 10px; color: var(--mt); text-transform: uppercase; letter-spacing: .5px; font-weight: 700; margin-bottom: 4px; }
.date-value { display: block; font-family: 'Unbounded', sans-serif; font-size: 13px; font-weight: 700; color: var(--fg); }
.date-arrow { color: var(--ac); font-size: 14px; padding: 0 12px; }
.card-bottom { display: flex; justify-content: space-between; align-items: center; }
.card-room { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--mt); font-weight: 600; }
.card-amount { font-family: 'Unbounded', sans-serif; font-size: 15px; font-weight: 800; color: var(--ok); }

.pagination { display: flex; align-items: center; gap: 4px; justify-content: center; margin-top: 18px; }
.pagination button { width: 34px; height: 34px; border-radius: 8px; background: var(--card); border: 1px solid var(--bdr); color: var(--fg2); font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .2s; }
.pagination button:hover:not(:disabled) { border-color: var(--ac); color: var(--ac); }
.pagination button.active { background: var(--ac); border-color: var(--ac); color: #fff; }
.pagination button:disabled { opacity: .4; cursor: not-allowed; }

/* Month calendar */
.calendar-view { background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; padding: 20px; }
.cal-legend { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: var(--fg2); text-transform: uppercase; letter-spacing: .4px; }
.legend-item .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.cal-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.cal-title { font-family: 'Unbounded', sans-serif; font-size: 16px; font-weight: 700; color: var(--fg); margin: 0; }
.cal-right { display: flex; gap: 6px; }
.cal-nav { background: var(--bg2); border: 1px solid var(--bdr); color: var(--fg); min-width: 36px; height: 36px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; padding: 0 10px; transition: all .2s; font-family: inherit; }
.cal-nav:hover { background: var(--ac); border-color: var(--ac); color: #fff; }
.cal-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 4px; }
.cal-wd { text-align: center; font-size: 11px; font-weight: 700; color: var(--mt); text-transform: uppercase; padding: 8px 0; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: var(--bdr); border: 1px solid var(--bdr); border-radius: 12px; overflow: hidden; }
.cal-cell { background: var(--card); min-height: 100px; padding: 6px; display: flex; flex-direction: column; }
.cal-cell.out { background: var(--bg2); opacity: .45; }
.cal-cell.today { background: var(--acs); }
.cal-cell.today .cal-num { color: var(--ac); font-weight: 800; }
.cal-num { font-size: 12px; font-weight: 600; color: var(--fg2); margin-bottom: 6px; padding: 0 4px; }
.cal-events { flex: 1; display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
.cal-ev { font-size: 10px; padding: 3px 6px; border-radius: 4px; cursor: pointer; background: var(--bg2); border-left: 3px solid; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: all .2s; }
.cal-ev:hover { transform: translateX(2px); filter: brightness(1.15); }
.cal-ev-name { display: block; overflow: hidden; text-overflow: ellipsis; }
.cal-more { font-size: 9px; color: var(--mt); font-weight: 700; padding-left: 4px; }

/* Kanban */
.kanban-view { overflow-x: auto; padding-bottom: 10px; }
.kanban-board { display: flex; gap: 14px; min-width: 900px; }
.kanban-column { flex: 1; min-width: 240px; background: var(--bg2); border: 1px solid var(--bdr); border-radius: 14px; display: flex; flex-direction: column; max-height: 70vh; }
.kanban-header { padding: 14px 16px; border-top: 4px solid; border-bottom: 1px solid var(--bdr); display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.kanban-header h4 { font-family: 'Unbounded', sans-serif; font-size: 12px; font-weight: 700; color: var(--fg); margin: 0; }
.kh-short { display: none; }
.kanban-count { background: var(--card); color: var(--fg2); font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 10px; border: 1px solid var(--bdr); }
.kanban-cards { padding: 12px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 10px; }
.kanban-card { background: var(--card); border: 1px solid var(--bdr); border-radius: 12px; padding: 12px; cursor: pointer; transition: all .25s; }
.kanban-card:hover { border-color: var(--ac); transform: translateY(-2px); }
.k-card-top { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
.k-avatar { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, var(--ac), var(--wn)); display: flex; align-items: center; justify-content: center; font-family: 'Unbounded', sans-serif; font-weight: 800; font-size: 12px; color: #fff; flex-shrink: 0; }
.k-info { flex: 1; min-width: 0; }
.k-name { font-size: 13px; font-weight: 700; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.k-id { font-size: 10px; color: var(--mt); font-family: monospace; letter-spacing: .5px; }

/* ⋮ menu button on cards */
.k-menu { flex-shrink: 0; width: 26px; height: 26px; border: none; background: transparent; border-radius: 8px; color: var(--mt); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; transition: all .2s; padding: 0; }
.k-menu:hover, .k-menu.active { background: var(--acs); color: var(--ac); }

.k-hotel { font-size: 12px; color: var(--fg2); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.k-dates { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--mt); margin-bottom: 10px; padding: 6px 8px; background: var(--bg2); border-radius: 6px; flex-wrap: wrap; }
.k-dates i { font-size: 9px; color: var(--ac); }
.k-bottom { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
.k-amount { font-family: 'Unbounded', sans-serif; font-size: 13px; font-weight: 700; color: var(--ok); }
.k-actions { display: flex; gap: 4px; }
.k-btn { width: 28px; height: 28px; border-radius: 8px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #fff; transition: all .2s; }
.k-btn:disabled { opacity: .5; cursor: not-allowed; }
.k-btn.approve { background: #B0D91E; }
.k-btn.reject { background: #F20707; }
.k-btn.complete { background: #07DBF2; }
.k-btn.noshow { background: #9ca3af; }
.k-btn:hover:not(:disabled) { transform: scale(1.1); }
.kanban-empty { text-align: center; padding: 20px 10px; color: var(--mt); }
.kanban-empty i { font-size: 24px; opacity: .3; margin-bottom: 6px; }
.kanban-empty p { font-size: 11px; margin: 0; }

/* ═══ Context menu (⋮) ═══ */
.ctx-menu { position: fixed; background: var(--card); border: 1px solid var(--bdr); border-radius: 12px; box-shadow: 0 16px 40px rgba(0,0,0,.45); padding: 6px; min-width: 230px; z-index: 300; }
.ctx-item { display: flex; align-items: flex-start; gap: 9px; width: 100%; text-align: left; background: transparent; border: none; border-radius: 8px; padding: 9px 10px; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 700; color: var(--fg); transition: all .15s; }
.ctx-item:hover { background: var(--acs); color: var(--ac); }
.ctx-item > i { margin-top: 2px; width: 14px; text-align: center; font-size: 12px; }
.ctx-item .ctx-txt { display: flex; flex-direction: column; gap: 1px; }
.ctx-item .ctx-txt small { font-size: 10px; font-weight: 600; color: var(--mt); }
.ctx-item:hover .ctx-txt small { color: var(--ac); }
.ctx-disabled { display: flex; align-items: flex-start; gap: 9px; padding: 9px 10px; opacity: .55; cursor: not-allowed; font-size: 12px; font-weight: 700; color: var(--fg2); }
.ctx-disabled > i { margin-top: 2px; width: 14px; text-align: center; font-size: 12px; }
.ctx-disabled .ctx-txt { display: flex; flex-direction: column; gap: 1px; }
.ctx-disabled .ctx-txt small { font-size: 10px; font-weight: 600; color: var(--mt); }
.ctxfade-enter-active, .ctxfade-leave-active { transition: opacity .15s ease; }
.ctxfade-enter-from, .ctxfade-leave-to { opacity: 0; }

/* ═══ Archive ═══ */
.archive-view { background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; padding: 20px; }
.archive-head { margin-bottom: 14px; }
.archive-head h3 { font-family: 'Unbounded', sans-serif; font-size: 16px; font-weight: 700; color: var(--fg); margin: 0 0 4px; }
.archive-head h3 i { font-size: 13px; color: var(--ac); margin-right: 6px; }
.archive-head p { color: var(--mt); font-size: 12px; margin: 0; }
.archive-months { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
.chip { padding: 8px 14px; border-radius: 999px; border: 1px solid var(--bdr); background: var(--bg2); font-size: 12px; font-weight: 700; cursor: pointer; color: var(--mt); transition: all .2s; white-space: nowrap; font-family: inherit; }
.chip:hover { color: var(--fg); border-color: var(--ac); }
.chip.active { background: var(--ac); color: #fff; border-color: var(--ac); }
.archive-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.archive-grid .kanban-card { background: var(--bg2); }
.archive-empty { padding: 40px 20px; }
.archive-empty i { font-size: 40px; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; animation: fadeIn .2s ease; }
.modal-content { background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; width: 90%; max-width: 550px; box-shadow: 0 20px 60px rgba(0,0,0,.5); animation: slideUp .3s cubic-bezier(.22,1,.36,1); max-height: 90vh; overflow-y: auto; }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.modal-header { padding: 20px; border-bottom: 1px solid var(--bdr); display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { font-family: 'Unbounded', sans-serif; font-size: 18px; font-weight: 700; color: var(--fg); margin: 0; }
.close-btn { background: transparent; border: none; color: var(--mt); font-size: 16px; cursor: pointer; padding: 4px; }
.close-btn:hover { color: var(--dg); }
.modal-body { padding: 20px; }
.modal-footer { padding: 20px; border-top: 1px solid var(--bdr); display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
.detail-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--bdr); gap: 10px; }
.detail-header h2 { font-family: 'Unbounded', sans-serif; font-size: 18px; font-weight: 800; color: var(--fg); margin: 0 0 4px; }
.detail-sub { color: var(--mt); font-size: 12px; margin: 0; }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.detail-item { display: flex; flex-direction: column; gap: 4px; }
.detail-label { font-size: 10px; color: var(--mt); text-transform: uppercase; letter-spacing: .5px; font-weight: 700; }
.detail-value { font-size: 13px; font-weight: 600; color: var(--fg); }
.detail-value.highlight { color: var(--ok); font-family: 'Unbounded', sans-serif; font-size: 15px; }
.notes-section, .contact-section { background: var(--bg2); padding: 14px; border-radius: 10px; margin-bottom: 12px; border: 1px solid var(--bdr); }
.notes-section h4, .contact-section h4 { font-family: 'Unbounded', sans-serif; font-size: 11px; font-weight: 700; color: var(--fg); margin: 0 0 8px; text-transform: uppercase; letter-spacing: .5px; }
.notes-section p, .contact-section p { font-size: 13px; color: var(--fg2); margin: 4px 0; line-height: 1.5; }
.contact-section p i { width: 16px; color: var(--mt); }

/* Toast */
.toast { position: fixed; bottom: 24px; right: 24px; z-index: 200; padding: 13px 20px; border-radius: 12px; font-size: 13px; font-weight: 700; color: #fff; box-shadow: 0 12px 32px rgba(0,0,0,.35); animation: slideUp .25s ease; max-width: 340px; }
.toast.ok { background: #B0D91E; }
.toast.err { background: #F20707; }

/* Responsive */
@media (max-width: 1100px) {
  .briefing { grid-template-columns: repeat(3, 1fr); }
  .kanban-board { min-width: 700px; }
}
@media (max-width: 900px) {
  .desktop-view { display: none; }
  .mobile-cards { display: flex; }
  .briefing { grid-template-columns: repeat(2, 1fr); }
  .controls-bar { flex-direction: column; align-items: stretch; }
  .filters { flex-direction: column; }
  .search-wrap, .filters select { width: 100%; min-width: 100%; }
  .view-toggle { justify-content: center; }
  .view-toggle button { flex: 1; justify-content: center; }
  .view-toggle button span { display: none; }
  .btn-text { display: none; }
  .detail-grid { grid-template-columns: 1fr; }
  .modal-footer { flex-direction: column-reverse; gap: 8px; }
  .modal-footer button { width: 100%; justify-content: center; }
  .cal-cell { min-height: 64px; }
  .cal-ev { width: 8px; height: 8px; padding: 0; border-radius: 50%; border-left: none; background: var(--st, var(--mt)); margin: 2px auto 0; }
  .cal-ev-name { display: none; }
  .kh-full { display: none; }
  .kh-short { display: inline; }
}
/* Mobile: stack kanban columns vertically instead of horizontal scroll */
@media (max-width: 700px) {
  .kanban-view { overflow-x: visible; padding-bottom: 0; }
  .kanban-board { flex-direction: column; min-width: 0; }
  .kanban-column { min-width: 0; max-height: none; }
  .kanban-cards { max-height: 320px; }
  .empty-state.boxed { padding: 40px 16px; }
  .archive-view { padding: 16px; }
  .archive-months { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 2px; }
  .archive-months::-webkit-scrollbar { display: none; }
  .archive-grid { grid-template-columns: 1fr; }
  .ctx-menu { min-width: 200px; }
}
@media (max-width: 600px) {
  .briefing { grid-template-columns: 1fr 1fr; }
  .briefing-card.revenue { grid-column: 1 / -1; }
  .page-title h1 { font-size: 26px; }
}
</style>