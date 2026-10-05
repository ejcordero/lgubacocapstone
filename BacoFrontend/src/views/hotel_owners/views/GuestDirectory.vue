<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { API } from '@/api'

const router = useRouter()

// Real login saves the JWT under 'baco_owner_token' (see router guard in index.js)
const getOwnerToken = () =>
  localStorage.getItem('baco_owner_token') ||
  localStorage.getItem('ownerToken') ||
  localStorage.getItem('owner_token') ||
  ''


const guests = ref([])
const loading = ref(false)
const searchQuery = ref('')
const currentPage = ref(1)
const perPage = 6

const showDetailModal = ref(false)
const selectedGuest = ref(null)

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

const peso = (n) => '₱' + Number(n || 0).toLocaleString()
function fmtDate(d) {
  if (!d) return '—'
  return new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function getInitials(name) {
  return (name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase()
}
const typeLabel = (b) => b.bookingType === 'entrance' ? 'Day Tour' : 'Overnight'
function productLabel(b) {
  if (b.bookingType === 'entrance') return b.feeName || 'Entrance'
  return [b.roomName, b.feeName].filter(Boolean).join(' + ') || 'Stay'
}

async function loadGuests() {
  loading.value = true
  try {
    const res = await fetch(`${API}/owner/guests`, {
      headers: { Authorization: `Bearer ${getOwnerToken()}` }
    })
    if (res.status === 401 || res.status === 403) { router.push('/owner/login'); return }
    const data = await res.json()
    guests.value = data.guests || []
  } catch (e) {
    guests.value = []
  } finally {
    loading.value = false
  }
}
onMounted(loadGuests)

const filteredGuests = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return guests.value
  return guests.value.filter(g =>
    (g.name || '').toLowerCase().includes(q) ||
    (g.email || '').toLowerCase().includes(q) ||
    (g.contact || '').includes(q)
  )
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredGuests.value.length / perPage)))
const paginatedGuests = computed(() => {
  const start = (currentPage.value - 1) * perPage
  return filteredGuests.value.slice(start, start + perPage)
})
watch(searchQuery, () => { currentPage.value = 1 })

const openDetailModal = (guest) => {
  selectedGuest.value = guest
  showDetailModal.value = true
}
const closeDetailModal = () => {
  showDetailModal.value = false
  selectedGuest.value = null
}
</script>

<template>
  <div class="guest-directory">
    <div class="page-title">
      <div>
        <h1>Guest <span>Directory</span></h1>
        <p>Guests built from your real booking records.</p>
      </div>
      <button class="btn-secondary" :disabled="loading" @click="loadGuests">
        <i class="fas fa-rotate-right"></i>Refresh
      </button>
    </div>

    <div class="filters">
      <div class="search-wrap">
        <i class="fas fa-search"></i>
        <input v-model="searchQuery" type="text" placeholder="Search by name, email, or phone…" />
      </div>
    </div>

    <div v-if="loading" class="state-box"><div class="spinner"></div><p>Loading guests…</p></div>

    <template v-else>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Guest</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Bookings</th>
              <th>Total Spent</th>
              <th>Last Visit</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in paginatedGuests" :key="g.email" @click="openDetailModal(g)">
              <td class="guest-cell">
                <div class="guest-avatar">{{ getInitials(g.name) }}</div>
                {{ g.name }}
              </td>
              <td>{{ g.email }}</td>
              <td>{{ g.contact || '—' }}</td>
              <td class="num">
                {{ g.totalBookings }}
                <span v-if="g.pendingCount > 0" class="pending-chip">{{ g.pendingCount }} pending</span>
              </td>
              <td class="spent">₱{{ Number(g.totalSpent || 0).toLocaleString() }}</td>
              <td>{{ fmtDate(g.lastVisit) }}</td>
              <td>
                <button class="action-btn" @click.stop="openDetailModal(g)" title="View Details">
                  <i class="fas fa-eye"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="paginatedGuests.length === 0" class="empty-state">
          <i class="fas fa-users"></i>
          <h3>No guests yet</h3>
          <p>Guests appear here automatically once bookings come in.</p>
        </div>
      </div>

      <div class="pagination" v-if="totalPages > 1">
        <button :disabled="currentPage === 1" @click="currentPage--"><i class="fas fa-chevron-left"></i></button>
        <button v-for="p in totalPages" :key="p" :class="{ active: p === currentPage }" @click="currentPage = p">{{ p }}</button>
        <button :disabled="currentPage === totalPages" @click="currentPage++"><i class="fas fa-chevron-right"></i></button>
      </div>
    </template>

    <!-- Guest Detail Modal -->
    <div v-if="showDetailModal && selectedGuest" class="modal-overlay" @click.self="closeDetailModal">
      <div class="modal-content detail-modal">
        <div class="modal-header">
          <h3>Guest Profile</h3>
          <button class="close-btn" @click="closeDetailModal"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div class="guest-profile-header">
            <div class="guest-avatar large">{{ getInitials(selectedGuest.name) }}</div>
            <div class="guest-profile-info">
              <h2>{{ selectedGuest.name }}</h2>
              <p class="guest-email">{{ selectedGuest.email }}</p>
            </div>
          </div>

          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label"><i class="fas fa-phone"></i> Phone</span>
              <span class="detail-value">{{ selectedGuest.contact || '—' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label"><i class="fas fa-id-card"></i> ID Type</span>
              <span class="detail-value">{{ { philid: 'PhilID / National ID', passport: 'Passport', drivers: "Driver's License" }[selectedGuest.idType] || selectedGuest.idType || '—' }}</span>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-box">
              <span class="stat-label">Total Bookings</span>
              <span class="stat-value">{{ selectedGuest.totalBookings }}</span>
            </div>
            <div class="stat-box">
              <span class="stat-label">Total Spent</span>
              <span class="stat-value highlight">₱{{ Number(selectedGuest.totalSpent || 0).toLocaleString() }}</span>
            </div>
            <div class="stat-box">
              <span class="stat-label">Upcoming</span>
              <span class="stat-value">{{ selectedGuest.upcomingCount }}</span>
            </div>
          </div>

          <div class="history-section">
            <h4>Booking History</h4>
            <div v-if="selectedGuest.bookings.length === 0" class="history-empty">No bookings recorded.</div>
            <div v-for="b in selectedGuest.bookings" :key="b.id" class="h-row">
              <div class="h-main">
                <span class="h-ref">{{ b.id }}</span>
                <span class="h-type" :class="b.bookingType === 'entrance' ? 'ent' : 'stay'">{{ typeLabel(b) }}</span>
              </div>
              <div class="h-mid">{{ productLabel(b) }} · {{ fmtDate(b.checkIn) }} → {{ fmtDate(b.checkOut) }}</div>
              <div class="h-right">
                <span class="h-amount">{{ peso(b.totalAmount) }}</span>
                <span class="status-pill" :class="statusCls(b.status)">{{ statusLabel(b.status) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeDetailModal">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.guest-directory { animation: fadeIn .5s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

.page-title { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 28px; flex-wrap: wrap; gap: 14px; }
.page-title h1 { font-family: 'Unbounded', sans-serif; font-size: clamp(28px, 5vw, 48px); font-weight: 800; color: var(--fg); letter-spacing: -0.04em; margin: 0; line-height: .95; }
.page-title h1 span { background: linear-gradient(135deg, var(--ac), var(--wn)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.page-title p { color: var(--mt); font-size: 13px; margin: 6px 0 0; }

.btn-secondary { padding: 10px 18px; background: var(--bg2); color: var(--fg2); border: 1px solid var(--bdr); border-radius: 11px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: all .3s; }
.btn-secondary:hover:not(:disabled) { background: var(--card2); transform: translateY(-2px); }
.btn-secondary:disabled { opacity: .5; cursor: not-allowed; }

.filters { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
.search-wrap { position: relative; flex: 1; min-width: 220px; }
.search-wrap i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--mt); font-size: 12px; }
.search-wrap input { width: 100%; padding: 10px 14px 10px 40px; background: var(--bg2); border: 1px solid var(--bdr); border-radius: 10px; color: var(--fg); font-size: 13px; outline: none; transition: all .3s; }
.search-wrap input:focus { border-color: var(--ac); box-shadow: 0 0 0 3px var(--acs); }

.table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid var(--bdr); background: var(--card); }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
thead { background: var(--bg2); }
th { padding: 12px 16px; text-align: left; font-family: 'Unbounded', sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--mt); border-bottom: 1px solid var(--bdr); white-space: nowrap; }
td { padding: 12px 16px; border-bottom: 1px solid var(--bdr); color: var(--fg2); white-space: nowrap; }
tr:last-child td { border-bottom: none; }
tbody tr { transition: background .2s; cursor: pointer; }
tbody tr:hover { background: var(--acs); }

.guest-cell { display: flex; align-items: center; gap: 10px; font-weight: 700; color: var(--fg); }
.guest-avatar { width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg, var(--ac), var(--wn)); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: #fff; flex-shrink: 0; }
.num { font-weight: 700; color: var(--fg); }
.spent { font-weight: 700; color: var(--ok); }
.pending-chip { display: inline-block; margin-left: 6px; padding: 2px 7px; border-radius: 999px; font-size: 9px; font-weight: 800; text-transform: uppercase; background: var(--wng); color: var(--wn); border: 1px solid var(--wn); }

.action-btn { background: transparent; color: var(--ac); border: none; padding: 6px 10px; border-radius: 8px; cursor: pointer; font-size: 11px; }
.action-btn:hover { background: var(--acs); }

.state-box { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 20px; color: var(--mt); text-align: center; }
.spinner { width: 34px; height: 34px; border: 3px solid var(--bdr); border-top-color: var(--ac); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.empty-state { text-align: center; padding: 50px 20px; color: var(--mt); }
.empty-state i { font-size: 44px; margin-bottom: 14px; opacity: .3; }
.empty-state h3 { font-family: 'Unbounded', sans-serif; color: var(--fg); margin: 0 0 6px; }

.pagination { display: flex; align-items: center; gap: 4px; justify-content: center; margin-top: 18px; }
.pagination button { width: 34px; height: 34px; border-radius: 8px; background: var(--card); border: 1px solid var(--bdr); color: var(--fg2); font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .2s; }
.pagination button:hover:not(:disabled) { border-color: var(--ac); color: var(--ac); }
.pagination button.active { background: var(--ac); border-color: var(--ac); color: #fff; }
.pagination button:disabled { opacity: .4; cursor: not-allowed; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; animation: fadeIn .2s ease; }
.modal-content { background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; width: 90%; max-width: 550px; box-shadow: 0 20px 60px rgba(0,0,0,.5); animation: slideUp .3s cubic-bezier(.22,1,.36,1); max-height: 90vh; overflow-y: auto; }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.modal-header { padding: 20px; border-bottom: 1px solid var(--bdr); display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { font-family: 'Unbounded', sans-serif; font-size: 18px; font-weight: 700; color: var(--fg); margin: 0; }
.close-btn { background: transparent; border: none; color: var(--mt); font-size: 16px; cursor: pointer; padding: 4px; }
.close-btn:hover { color: var(--dg); }
.modal-body { padding: 20px; }
.modal-footer { padding: 20px; border-top: 1px solid var(--bdr); display: flex; justify-content: flex-end; }

.guest-profile-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--bdr); }
.guest-avatar.large { width: 56px; height: 56px; border-radius: 14px; font-size: 18px; }
.guest-profile-info h2 { font-family: 'Unbounded', sans-serif; font-size: 20px; font-weight: 800; color: var(--fg); margin: 0 0 6px; }
.guest-email { font-size: 12px; color: var(--mt); margin: 0; }

.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
.detail-item { display: flex; flex-direction: column; gap: 4px; }
.detail-label { font-size: 10px; color: var(--mt); text-transform: uppercase; letter-spacing: .5px; font-weight: 700; display: flex; align-items: center; gap: 6px; }
.detail-label i { color: var(--ac); font-size: 11px; width: 14px; text-align: center; }
.detail-value { font-size: 13px; font-weight: 600; color: var(--fg); word-break: break-word; }

.stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
.stat-box { background: var(--bg2); padding: 14px; border-radius: 10px; text-align: center; border: 1px solid var(--bdr); }
.stat-label { display: block; font-size: 10px; color: var(--mt); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; font-weight: 700; }
.stat-value { display: block; font-family: 'Unbounded', sans-serif; font-size: 16px; font-weight: 700; color: var(--fg); }
.stat-value.highlight { color: var(--ok); font-size: 17px; }

.history-section h4 { font-family: 'Unbounded', sans-serif; font-size: 11px; font-weight: 700; color: var(--fg); margin: 0 0 12px; text-transform: uppercase; letter-spacing: .5px; }
.history-empty { color: var(--mt); font-size: 12px; padding: 14px; background: var(--bg2); border-radius: 10px; }
.h-row { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; background: var(--bg2); border: 1px solid var(--bdr); border-radius: 10px; margin-bottom: 8px; }
.h-main { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.h-ref { font-family: monospace; font-size: 11px; font-weight: 700; color: var(--fg); letter-spacing: .5px; }
.h-type { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 9px; font-weight: 800; text-transform: uppercase; }
.h-type.ent { background: var(--rose-dark); color: var(--rose); }
.h-type.stay { background: rgba(255,255,255,.08); color: var(--fg2); border: 1px solid var(--bdr); }
.h-mid { font-size: 12px; color: var(--fg2); }
.h-right { display: flex; justify-content: space-between; align-items: center; }
.h-amount { font-family: 'Unbounded', sans-serif; font-size: 13px; font-weight: 700; color: var(--ok); }

.status-pill { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; white-space: nowrap; }
.st-pending { background: var(--wng); color: var(--wn); border: 1px solid var(--wn); }
.st-confirmed { background: var(--okg); color: var(--ok); border: 1px solid var(--ok); }
.st-completed { background: var(--tlg); color: var(--tl); border: 1px solid var(--tl); }
.st-rejected { background: var(--dgg); color: var(--dg); border: 1px solid var(--dg); }
.st-muted { background: var(--bg2); color: var(--mt); border: 1px solid var(--bdr); }

@media (max-width: 700px) {
  .detail-grid, .stats-grid { grid-template-columns: 1fr; }
}
</style>