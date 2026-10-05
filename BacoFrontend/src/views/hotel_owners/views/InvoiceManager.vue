<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { API } from '@/api'

const router = useRouter()

// Same auth + base as BookingManager / GuestDirectory / RevenueAnalytics
const getOwnerToken = () =>
  localStorage.getItem('baco_owner_token') ||
  localStorage.getItem('ownerToken') ||
  localStorage.getItem('owner_token') ||
  ''

// ── State ──
const bookings = ref([])
const hotelInfo = ref(null) // enriched resort details for invoice headers
const loading = ref(false)
const busyId = ref(null)
const toastMsg = ref('')
const toastType = ref('ok')
let toastTimer = null

const searchQuery = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const perPage = 6

const showDetailModal = ref(false)
const selectedInvoice = ref(null)

function showToast(msg, type = 'ok') {
  toastMsg.value = msg
  toastType.value = type
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 3500)
}

// ── Date helpers ──
function localTodayStr() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}
const todayStr = localTodayStr()

function fmtDate(d) {
  if (!d) return '—'
  return new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ── Formatting ──
const peso = (n) => '₱' + Number(n || 0).toLocaleString()
const peso2 = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const idTypeLabel = (v) => ({ philid: 'PhilID / National ID', passport: 'Passport', drivers: "Driver's License" }[v] || v || '—')
const typeLabel = (b) => b.bookingType === 'entrance' ? 'Day Tour' : 'Overnight'
function productLabel(b) {
  if (b.bookingType === 'entrance') return b.feeName || 'Entrance'
  return [b.roomName, b.feeName].filter(Boolean).join(' + ') || 'Stay'
}

// ── Manual archive overrides ──
// Shares the SAME localStorage key as BookingManager, so an archive/restore
// decision made on the Kanban also applies here (one lifecycle per booking).
// To give this page independent archive state, change just this key string.
//   'archived'   → force into the Archive even if the month hasn't ended
//   'unarchived' → keep in the active list even though the month has passed
// Bookings with no override follow the automatic month-end rule.
const OVERRIDES_KEY = 'stayhub.ownerArchiveOverrides'
const overrides = ref({})
try { overrides.value = JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}') } catch (e) { overrides.value = {} }
const saveOverrides = () => { try { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides.value)) } catch (e) {} }

function startOfCurrentMonth() {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), 1)
}
// An invoice is archived when: manually archived, OR (no override) its entire
// stay belongs to a passed month — final day (check-out; visit day for day
// tours) before the 1st of the current month. 'unarchived' suppresses the
// automatic rule until the user archives it again.
const isArchived = (b) => {
  const ov = overrides.value[b.id]
  if (ov === 'archived') return true
  if (ov === 'unarchived') return false
  const co = String(b.checkOut || b.checkIn || '').slice(0, 10)
  if (!co) return false
  return new Date(co + 'T00:00:00') < startOfCurrentMonth()
}
// Archive grouping anchor: the month the stay started
const monthKeyOf = (b) => String(b.checkIn || '').slice(0, 7)

// Only settled invoices (Paid or Void) can be manually archived —
// Unpaid/Overdue still represent money owed, and Pending has no invoice due yet.
const canArchive = (v) => ['paid', 'void'].includes(v.invStatus)

// ── Invoice status derivation ──
// paid    → guest has paid (recorded by owner)
// void    → booking rejected / cancelled / no-show
// pending → booking still awaiting owner approval (no invoice due yet)
// overdue → stay already ended but never paid
// unpaid  → approved and payable (current or upcoming stay)
const INV_META = {
  paid:    { label: 'Paid',    cls: 'in-paid' },
  unpaid:  { label: 'Unpaid',  cls: 'in-unpaid' },
  overdue: { label: 'Overdue', cls: 'in-overdue' },
  pending: { label: 'Pending', cls: 'in-pending' },
  void:    { label: 'Void',    cls: 'in-void' }
}
const invLabel = (s) => INV_META[s]?.label || s
const invCls = (s) => INV_META[s]?.cls || 'in-void'

// ── Derive invoices from real bookings ──
// VAT treatment: booking totals are VAT-INCLUSIVE (guests pay exactly total_amount),
// so Net = total / 1.12 and VAT = total − Net. Totals always match bookings/analytics.
const invoices = computed(() => bookings.value.map(b => {
  const total = Number(b.totalAmount || 0)
  const net = Math.round((total / 1.12) * 100) / 100
  const vat = Math.round((total - net) * 100) / 100
  const year = b.createdAt ? new Date(b.createdAt).getFullYear() : new Date().getFullYear()
  let invStatus
  if (b.paymentStatus === 'paid') invStatus = 'paid'
  else if (['rejected', 'cancelled', 'no_show'].includes(b.status)) invStatus = 'void'
  else if (b.status === 'pending') invStatus = 'pending'
  else if (String(b.checkOut).slice(0, 10) < todayStr) invStatus = 'overdue'
  else invStatus = 'unpaid'
  return {
    ...b,
    invoiceNo: `INV-${year}-${String(b.dbId).padStart(4, '0')}`,
    total, net, vat, invStatus,
    canPay: ['confirmed', 'completed'].includes(b.status)
  }
}))

// ── Line items (real prices from the booking) ──
function lineItems(b) {
  const items = []
  if (b.entranceFeeId && b.feePrice != null) {
    items.push({ desc: `Entrance — ${b.feeName || 'Entrance Fee'}`, qty: b.pax, unitLabel: '/guest', unit: b.feePrice, amount: b.feePrice * b.pax })
  }
  if (b.roomId && b.pricePerNight > 0) {
    items.push({ desc: b.roomName || 'Room', qty: b.nights, unitLabel: '/night', unit: b.pricePerNight, amount: b.pricePerNight * b.nights })
  }
  if (!items.length) {
    items.push({ desc: productLabel(b) || 'Booking', qty: 1, unitLabel: '', unit: b.totalAmount, amount: b.totalAmount })
  }
  return items
}

// ── Stats ──
// Deliberately computed from ALL invoices (archived included) — billed /
// collected / outstanding are financial facts that don't depend on which
// list an invoice is displayed in. Archived Overdue money still counts here.
const billable = computed(() => invoices.value.filter(i => ['confirmed', 'completed'].includes(i.status)))
const billedTotal = computed(() => billable.value.reduce((s, i) => s + i.total, 0))
const collectedTotal = computed(() => billable.value.filter(i => i.paymentStatus === 'paid').reduce((s, i) => s + i.total, 0))
const outstandingTotal = computed(() => Math.max(0, billedTotal.value - collectedTotal.value))
const overdueInvoices = computed(() => invoices.value.filter(i => i.invStatus === 'overdue'))
const overdueTotal = computed(() => overdueInvoices.value.reduce((s, i) => s + i.total, 0))

// ── Archive split + filtering ──
const activeView = ref('current') // 'current' | 'archive'
const liveInvoices = computed(() => invoices.value.filter(v => !isArchived(v)))
const archivedInvoices = computed(() => invoices.value.filter(isArchived))

const applyFilters = (list) => {
  const q = searchQuery.value.trim().toLowerCase()
  return list.filter(v => {
    const matchesSearch = !q ||
      v.invoiceNo.toLowerCase().includes(q) ||
      v.id.toLowerCase().includes(q) ||
      (v.guestName || '').toLowerCase().includes(q) ||
      (v.guestEmail || '').toLowerCase().includes(q)
    const matchesStatus = !statusFilter.value || v.invStatus === statusFilter.value
    return matchesSearch && matchesStatus
  })
}

const filteredCurrent = computed(() => applyFilters(liveInvoices.value))

const archiveMonth = ref('all')
// Archive pool after search/status filters (before the month filter) —
// also drives the month chips so they always reflect findable invoices
const archiveBase = computed(() => applyFilters(archivedInvoices.value))
const filteredArchive = computed(() => {
  if (archiveMonth.value === 'all') return archiveBase.value
  return archiveBase.value.filter(v => monthKeyOf(v) === archiveMonth.value)
})

// One chip per month that has archived invoices, newest first
const archiveMonths = computed(() => {
  const map = new Map()
  for (const v of archiveBase.value) {
    const k = monthKeyOf(v)
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

// The table/cards render whichever view is active — everything downstream
// (pagination, CSV export) works off this single view-aware list.
const filteredInvoices = computed(() =>
  activeView.value === 'archive' ? filteredArchive.value : filteredCurrent.value
)

const totalPages = computed(() => Math.max(1, Math.ceil(filteredInvoices.value.length / perPage)))
const paginatedInvoices = computed(() => {
  const start = (currentPage.value - 1) * perPage
  return filteredInvoices.value.slice(start, start + perPage)
})
watch([searchQuery, statusFilter, activeView], () => { currentPage.value = 1 })

// ── Data loading ──
async function loadData() {
  loading.value = true
  try {
    const res = await fetch(`${API}/owner/bookings`, {
      headers: { Authorization: `Bearer ${getOwnerToken()}` }
    })
    if (res.status === 401 || res.status === 403) { router.push('/owner/login'); return }
    const data = await res.json()
    bookings.value = data.bookings || []
    if (!hotelInfo.value) hotelInfo.value = data.hotel || null
  } catch (e) {
    showToast('Could not load invoices. Is the server running?', 'err')
  } finally {
    loading.value = false
  }
}

// Enrich with the resort's contact details for invoice headers (optional — fails silently)
async function loadHotelInfo() {
  try {
    const res = await fetch(`${API}/owner/hotel`, {
      headers: { Authorization: `Bearer ${getOwnerToken()}` }
    })
    if (res.ok) {
      const data = await res.json()
      if (data?.hotel) hotelInfo.value = { ...data.hotel, name: data.hotel.name }
    }
  } catch (e) { /* header falls back to the basic name */ }
}

onMounted(() => {
  loadData(); loadHotelInfo()
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

// ── Card context menu (⋮) ──
// Action is derived from archive state: un-archived rows offer "Move to
// Archive" (enabled only for Paid/Void), archived rows offer "Restore".
const menu = ref(null) // { booking, action: 'archive' | 'unarchive', x, y, flip }
const toggleMenu = (v, e) => {
  const action = isArchived(v) ? 'unarchive' : 'archive'
  if (menu.value && menu.value.booking?.id === v.id) { closeMenu(); return }
  const r = e.currentTarget.getBoundingClientRect()
  // Flip above the button when there isn't room below (disabled variant is taller)
  const estH = action === 'archive' && !canArchive(v) ? 96 : 56
  let y = r.bottom + 6
  let flip = false
  if (y + estH > window.innerHeight - 8) { y = r.top - 6; flip = true }
  menu.value = { booking: v, action, x: r.right, y, flip }
}
const closeMenu = () => { menu.value = null }

const archiveInvoice = (v) => {
  overrides.value[v.id] = 'archived'
  saveOverrides()
  archiveMonth.value = 'all' // so it's visible right away in the Archive
  closeMenu()
  showToast(`${v.invoiceNo} moved to your Archive.`)
}
const restoreInvoice = (v) => {
  overrides.value[v.id] = 'unarchived'
  saveOverrides()
  closeMenu()
  showToast(`${v.invoiceNo} restored — it's back in the active list.`)
}

// Close the menu on outside click / Escape / scroll / resize — it's
// fixed-positioned, so it must not follow scrolled content.
const onDocClick = (e) => {
  if (!menu.value) return
  const t = e.target
  if (t.closest && (t.closest('.ctx-menu') || t.closest('.menu-btn') || t.closest('.inv-menu'))) return
  closeMenu()
}
const onKeydown = (e) => { if (e.key === 'Escape') closeMenu() }
const onDismissUi = () => { if (menu.value) closeMenu() }

watch(activeView, () => closeMenu())

// ── Payment recording ──
async function markPayment(inv, paymentStatus) {
  if (busyId.value) return
  busyId.value = inv.id
  try {
    const res = await fetch(`${API}/owner/bookings/${encodeURIComponent(inv.id)}/payment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getOwnerToken()}` },
      body: JSON.stringify({ paymentStatus })
    })
    if (res.status === 401 || res.status === 403) { router.push('/owner/login'); return }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || 'Failed to update payment.')
    showToast(data.message || `Marked ${paymentStatus}.`)
    await loadData()
    if (selectedInvoice.value?.id === inv.id) {
      const fresh = invoices.value.find(i => i.id === inv.id)
      if (fresh) selectedInvoice.value = fresh
    }
  } catch (e) {
    showToast(e.message, 'err')
  } finally {
    busyId.value = null
  }
}

// ── Detail modal ──
function openDetail(inv) {
  selectedInvoice.value = inv
  showDetailModal.value = true
}
function closeDetail() {
  showDetailModal.value = false
  selectedInvoice.value = null
}

// ── EXPORT: per-invoice PDF ──
// jsPDF's built-in fonts cannot render '₱', so amounts use "PHP " in PDFs.
function downloadInvoicePDF(inv) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const money = (n) => `PHP ${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const h = hotelInfo.value

  // Header — resort info (left) / INVOICE label (right)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(17, 24, 39)
  doc.text(h?.name || 'Resort', 40, 56)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(107, 114, 128)
  doc.text('Municipality of Baco, Oriental Mindoro', 40, 72)
  if (h?.location) doc.text(String(h.location), 40, 85)
  if (h?.contact) doc.text(`Contact: ${h.contact}`, 40, 98)
  if (h?.email) doc.text(`Email: ${h.email}`, 40, 111)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(24); doc.setTextColor(255, 61, 0)
  doc.text('INVOICE', 555, 56, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(55, 65, 81)
  doc.text(`No.:  ${inv.invoiceNo}`, 555, 74, { align: 'right' })
  doc.text(`Issued:  ${fmtDate(inv.createdAt)}`, 555, 88, { align: 'right' })

  // Bill To
  let y = 150
  doc.setDrawColor(229, 231, 235); doc.line(40, y - 14, 555, y - 14)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(107, 114, 128)
  doc.text('BILL TO', 40, y)
  doc.setFontSize(11); doc.setTextColor(17, 24, 39)
  doc.text(inv.guestName || 'Guest', 40, y + 16)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(55, 65, 81)
  if (inv.guestEmail) doc.text(inv.guestEmail, 40, y + 31)
  if (inv.guestContact) doc.text(inv.guestContact, 40, y + 44)
  if (inv.guestIdType) doc.text(`Valid ID: ${idTypeLabel(inv.guestIdType)}`, 40, y + 57)

  // Booking reference (right column)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(107, 114, 128)
  doc.text('BOOKING', 340, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(55, 65, 81)
  doc.text(`Ref: ${inv.id}`, 340, y + 16)
  doc.text(`${typeLabel(inv)} · ${inv.pax} guest(s)`, 340, y + 31)
  doc.text(`${fmtDate(inv.checkIn)} → ${fmtDate(inv.checkOut)}${inv.bookingType === 'accommodation' ? ` (${inv.nights} night(s))` : ''}`, 340, y + 44)

  // Line items
  const items = lineItems(inv)
  autoTable(doc, {
    startY: y + 78,
    head: [['Description', 'Qty', 'Unit Price', 'Amount']],
    body: items.map(it => [
      it.desc,
      String(it.qty) + (it.unitLabel ? ` ${it.unitLabel.replace('/', '')}` : ''),
      money(it.unit),
      money(it.amount)
    ]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 6, textColor: [55, 65, 81] },
    headStyles: { fillColor: [17, 24, 39], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: { 1: { halign: 'center', cellWidth: 70 }, 2: { halign: 'right', cellWidth: 90 }, 3: { halign: 'right', cellWidth: 100 } },
    margin: { left: 40, right: 40 }
  })

  // Totals
  let ty = doc.lastAutoTable.finalY + 18
  const row = (label, value, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 11 : 9.5)
    doc.setTextColor(bold ? 17 : 75, bold ? 24 : 85, bold ? 39 : 99)
    doc.text(label, 415, ty)
    doc.text(value, 555, ty, { align: 'right' })
    ty += bold ? 20 : 16
  }
  row('Net of VAT (12%):', money(inv.net))
  row('VAT (12% inclusive):', money(inv.vat))
  doc.setDrawColor(17, 24, 39); doc.line(405, ty - 8, 555, ty - 8)
  row('TOTAL DUE:', money(inv.total), true)
  row('Payment Status:', inv.paymentStatus === 'paid' ? 'PAID' : 'UNPAYED — collect on arrival'.replace('UNPAYED', 'UNPAID'))

  // Footer note
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(150, 155, 165)
  doc.text('Payment is collected on arrival — Cash, GCash, or Card. Please present this invoice and a valid ID at the resort front desk.', 40, doc.internal.pageSize.getHeight() - 46)
  doc.text(`Generated ${new Date().toLocaleString('en-PH')} · Municipality of Baco, Oriental Mindoro`, 40, doc.internal.pageSize.getHeight() - 32)

  doc.save(`${inv.invoiceNo}.pdf`)
  showToast(`${inv.invoiceNo}.pdf downloaded.`)
}

// ── EXPORT: CSV of the ACTIVE VIEW's (filtered) invoices ──
function csvCell(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
function exportCSV() {
  const rows = filteredInvoices.value
  if (!rows.length) return
  const head = ['Invoice No', 'Booking Ref', 'Guest', 'Email', 'Contact', 'ID Type', 'Type', 'Room/Fee', 'Check-in', 'Check-out', 'Nights', 'Pax', 'Net of VAT (PHP)', 'VAT 12% (PHP)', 'Total (PHP)', 'Payment', 'Booking Status', 'Invoice Status', 'Issued']
  const body = rows.map(v => [
    v.invoiceNo, v.id, v.guestName, v.guestEmail, v.guestContact, idTypeLabel(v.guestIdType),
    typeLabel(v), productLabel(v), v.checkIn, v.checkOut, v.nights, v.pax,
    v.net.toFixed(2), v.vat.toFixed(2), v.total.toFixed(2),
    v.paymentStatus, v.status, invLabel(v.invStatus), fmtDateTime(v.createdAt)
  ])
  const csv = '\uFEFF' + [head, ...body].map(r => r.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `baco-invoices-${activeView.value}-${todayStr}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
  showToast('Invoices CSV downloaded.')
}

const getInitials = (name) => (name || '?').split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase()
</script>

<template>
  <div class="invoice-manager">
    <div class="page-title">
      <div>
        <h1>Invoice <span>Management</span></h1>
        <p>Billing documents generated from your real bookings.</p>
      </div>
      <div class="title-actions">
        <button class="btn-secondary" :disabled="loading || filteredInvoices.length === 0" @click="exportCSV"><i class="fas fa-file-csv"></i>Export CSV</button>
        <button class="btn-secondary" :disabled="loading" @click="loadData"><i class="fas fa-rotate-right"></i>Refresh</button>
      </div>
    </div>

    <!-- ═══ SUMMARY CARDS ═══ -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(0,255,148,.12); color: #B0D91E"><i class="fas fa-file-invoice-dollar"></i></div>
        <div class="stat-info">
          <div class="stat-value">{{ peso(billedTotal) }}</div>
          <div class="stat-label">Total Billed (Approved + Completed)</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(34,197,94,.12); color: #B0D91E"><i class="fas fa-money-bill-wave"></i></div>
        <div class="stat-info">
          <div class="stat-value">{{ peso(collectedTotal) }}</div>
          <div class="stat-label">Collected (Marked Paid)</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(245,158,11,.12); color: #F2B807"><i class="fas fa-hourglass-half"></i></div>
        <div class="stat-info">
          <div class="stat-value">{{ peso(outstandingTotal) }}</div>
          <div class="stat-label">Outstanding Balance</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(239,68,68,.12); color: #F20707"><i class="fas fa-exclamation-circle"></i></div>
        <div class="stat-info">
          <div class="stat-value">{{ overdueInvoices.length }}</div>
          <div class="stat-label">Overdue · {{ peso(overdueTotal) }}</div>
        </div>
      </div>
    </div>

    <!-- ═══ FILTERS + VIEW TOGGLE ═══ -->
    <div class="filters">
      <div class="search-wrap">
        <i class="fas fa-search"></i>
        <input v-model="searchQuery" type="text" placeholder="Search invoice #, booking ref, guest…" />
      </div>
      <select v-model="statusFilter">
        <option value="">All Status</option>
        <option value="paid">Paid</option>
        <option value="unpaid">Unpaid</option>
        <option value="overdue">Overdue</option>
        <option value="pending">Pending Approval</option>
        <option value="void">Void</option>
      </select>
      <div class="view-toggle">
        <button :class="{ active: activeView === 'current' }" @click="activeView = 'current'"><i class="fas fa-file-invoice"></i><span>Invoices</span></button>
        <button :class="{ active: activeView === 'archive' }" @click="activeView = 'archive'"><i class="fas fa-archive"></i><span>Archive ({{ archivedInvoices.length }})</span></button>
      </div>
    </div>

    <div v-if="loading" class="state-box"><div class="spinner"></div><p>Loading invoices…</p></div>

    <template v-else>
      <!-- Archive header + month filter (only in the Archive view) -->
      <div v-if="activeView === 'archive'" class="archive-head">
        <h3><i class="fas fa-archive"></i> Archived Invoices</h3>
        <p>Invoices from months that have passed — plus anything you archived yourself. Restore anytime from the ⋮ menu.</p>
      </div>
      <div v-if="activeView === 'archive' && archiveMonths.length" class="archive-months">
        <button class="chip" :class="{ active: archiveMonth === 'all' }" @click="archiveMonth = 'all'">
          All Months ({{ archiveBase.length }})
        </button>
        <button v-for="m in archiveMonths" :key="m.key" class="chip"
                :class="{ active: archiveMonth === m.key }"
                @click="archiveMonth = archiveMonth === m.key ? 'all' : m.key">
          {{ m.label }} ({{ m.count }})
        </button>
      </div>

      <!-- Desktop table -->
      <div class="table-wrap desktop-view">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th><th>Booking</th><th>Guest</th><th>Net of VAT</th><th>VAT (12%)</th>
              <th>Total</th><th>Issued</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in paginatedInvoices" :key="v.invoiceNo" @click="openDetail(v)">
              <td class="id-cell">{{ v.invoiceNo }}</td>
              <td class="mono">{{ v.id }}</td>
              <td class="guest-cell">{{ v.guestName }}</td>
              <td>{{ peso2(v.net) }}</td>
              <td>{{ peso2(v.vat) }}</td>
              <td class="total">{{ peso2(v.total) }}</td>
              <td>{{ fmtDate(v.createdAt) }}</td>
              <td><span class="inv-pill" :class="invCls(v.invStatus)">{{ invLabel(v.invStatus) }}</span></td>
              <td class="row-actions">
                <button class="action-btn" title="Download PDF" @click.stop="downloadInvoicePDF(v)"><i class="fas fa-file-pdf"></i></button>
                <button class="action-btn" title="View" @click.stop="openDetail(v)"><i class="fas fa-eye"></i></button>
                <button class="action-btn menu-btn" :class="{ active: menu?.booking?.id === v.id }" title="Options" @click.stop="toggleMenu(v, $event)"><i class="fas fa-ellipsis-v"></i></button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="paginatedInvoices.length === 0" class="empty-state">
          <i class="fas" :class="activeView === 'archive' ? 'fa-archive' : 'fa-file-invoice'"></i>
          <template v-if="activeView === 'archive'">
            <h3 v-if="archivedInvoices.length === 0">Nothing archived yet</h3>
            <h3 v-else>No invoices in {{ activeArchiveMonthLabel }}</h3>
            <p v-if="archivedInvoices.length === 0">Invoices move here automatically once their month ends — or archive them yourself from the ⋮ menu.</p>
            <p v-else>No archived invoices match the current filters.</p>
            <div v-if="archivedInvoices.length > 0" class="empty-actions">
              <button v-if="archiveMonth !== 'all'" class="btn-secondary" @click="archiveMonth = 'all'">Show All Months</button>
              <button v-if="searchQuery || statusFilter" class="btn-secondary" @click="searchQuery = ''; statusFilter = ''">Clear Filters</button>
            </div>
          </template>
          <template v-else>
            <h3>No invoices found</h3>
            <p v-if="invoices.length === 0">Invoices are generated automatically from bookings.</p>
            <p v-else-if="archivedInvoices.length > 0 && !searchQuery && !statusFilter">Past months are in the Archive.</p>
            <p v-else>Try adjusting your filters.</p>
            <div class="empty-actions">
              <button v-if="archivedInvoices.length > 0" class="btn-secondary" @click="activeView = 'archive'"><i class="fas fa-archive"></i>Open Archive ({{ archivedInvoices.length }})</button>
              <button v-if="searchQuery || statusFilter" class="btn-secondary" @click="searchQuery = ''; statusFilter = ''">Clear Filters</button>
            </div>
          </template>
        </div>
      </div>

      <!-- Mobile cards -->
      <div class="mobile-cards">
        <div v-for="v in paginatedInvoices" :key="v.invoiceNo" class="invoice-card" @click="openDetail(v)">
          <div class="ic-top">
            <div class="ic-guest">
              <div class="ic-avatar">{{ getInitials(v.guestName) }}</div>
              <div>
                <div class="ic-name">{{ v.guestName }}</div>
                <div class="ic-no">{{ v.invoiceNo }}</div>
              </div>
            </div>
            <div class="ic-right">
              <span class="inv-pill" :class="invCls(v.invStatus)">{{ invLabel(v.invStatus) }}</span>
              <button class="inv-menu" :class="{ active: menu?.booking?.id === v.id }" aria-label="Invoice options" @click.stop="toggleMenu(v, $event)"><i class="fas fa-ellipsis-v"></i></button>
            </div>
          </div>
          <div class="ic-mid">
            <span class="mono">{{ v.id }}</span> · {{ typeLabel(v) }} · {{ fmtDate(v.checkIn) }}
          </div>
          <div class="ic-bottom">
            <div class="ic-dates">{{ fmtDate(v.checkIn) }} → {{ fmtDate(v.checkOut) }}</div>
            <div class="ic-total">{{ peso2(v.total) }}</div>
          </div>
          <div class="ic-actions">
            <button class="btn-secondary sm" @click.stop="downloadInvoicePDF(v)"><i class="fas fa-file-pdf"></i>PDF</button>
            <button class="btn-secondary sm" @click.stop="openDetail(v)"><i class="fas fa-eye"></i>View</button>
          </div>
        </div>
        <div v-if="paginatedInvoices.length === 0" class="empty-state">
          <i class="fas" :class="activeView === 'archive' ? 'fa-archive' : 'fa-file-invoice'"></i>
          <template v-if="activeView === 'archive'">
            <h3 v-if="archivedInvoices.length === 0">Nothing archived yet</h3>
            <h3 v-else>No invoices here</h3>
            <p v-if="archivedInvoices.length === 0">Invoices move here once their month ends.</p>
            <p v-else>No archived invoices match the current filters.</p>
            <div v-if="archivedInvoices.length > 0" class="empty-actions">
              <button v-if="archiveMonth !== 'all'" class="btn-secondary" @click="archiveMonth = 'all'">Show All Months</button>
              <button v-if="searchQuery || statusFilter" class="btn-secondary" @click="searchQuery = ''; statusFilter = ''">Clear Filters</button>
            </div>
          </template>
          <template v-else>
            <h3>No invoices found</h3>
            <div class="empty-actions">
              <button v-if="archivedInvoices.length > 0" class="btn-secondary" @click="activeView = 'archive'"><i class="fas fa-archive"></i>Open Archive</button>
              <button v-if="searchQuery || statusFilter" class="btn-secondary" @click="searchQuery = ''; statusFilter = ''">Clear Filters</button>
            </div>
          </template>
        </div>
      </div>

      <div class="pagination" v-if="totalPages > 1">
        <button :disabled="currentPage === 1" @click="currentPage--"><i class="fas fa-chevron-left"></i></button>
        <button v-for="p in totalPages" :key="p" :class="{ active: p === currentPage }" @click="currentPage = p">{{ p }}</button>
        <button :disabled="currentPage === totalPages" @click="currentPage++"><i class="fas fa-chevron-right"></i></button>
      </div>
    </template>

    <!-- ═══ INVOICE DETAIL MODAL ═══ -->
    <div v-if="showDetailModal && selectedInvoice" class="modal-overlay" @click.self="closeDetail">
      <div class="modal-content detail-modal">
        <div class="modal-header">
          <h3>Invoice {{ selectedInvoice.invoiceNo }}</h3>
          <button class="close-btn" @click="closeDetail"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div class="detail-header">
            <div>
              <h2>{{ selectedInvoice.guestName }}</h2>
              <p class="detail-sub">Booking {{ selectedInvoice.id }} · Issued {{ fmtDate(selectedInvoice.createdAt) }}</p>
            </div>
            <span class="inv-pill" :class="invCls(selectedInvoice.invStatus)">{{ invLabel(selectedInvoice.invStatus) }}</span>
          </div>

          <div class="detail-grid">
            <div class="detail-item"><span class="detail-label">Type</span><span class="detail-value">{{ typeLabel(selectedInvoice) }}</span></div>
            <div class="detail-item"><span class="detail-label">Room / Fee</span><span class="detail-value">{{ productLabel(selectedInvoice) }}</span></div>
            <div class="detail-item"><span class="detail-label">Check-in</span><span class="detail-value">{{ fmtDate(selectedInvoice.checkIn) }}</span></div>
            <div class="detail-item"><span class="detail-label">Check-out</span><span class="detail-value">{{ fmtDate(selectedInvoice.checkOut) }}</span></div>
            <div class="detail-item"><span class="detail-label">Guests</span><span class="detail-value">{{ selectedInvoice.pax }} ({{ selectedInvoice.adults }} adult{{ selectedInvoice.adults > 1 ? 's' : '' }}{{ selectedInvoice.children ? `, ${selectedInvoice.children} child${selectedInvoice.children > 1 ? 'ren' : ''}` : '' }})</span></div>
            <div class="detail-item"><span class="detail-label">Valid ID</span><span class="detail-value">{{ idTypeLabel(selectedInvoice.guestIdType) }}</span></div>
          </div>

          <div class="contact-section">
            <h4>Bill To</h4>
            <p v-if="selectedInvoice.guestEmail"><i class="fas fa-envelope"></i> {{ selectedInvoice.guestEmail }}</p>
            <p v-if="selectedInvoice.guestContact"><i class="fas fa-phone"></i> {{ selectedInvoice.guestContact }}</p>
          </div>

          <!-- Line items -->
          <div class="items-table">
            <div class="items-head"><span>Description</span><span>Qty</span><span>Unit</span><span>Amount</span></div>
            <div v-for="(it, i) in lineItems(selectedInvoice)" :key="i" class="items-row">
              <span class="it-desc">{{ it.desc }}</span>
              <span class="it-qty">{{ it.qty }}{{ it.unitLabel ? ` ${it.unitLabel.replace('/', '')}` : '' }}</span>
              <span class="it-unit">{{ peso2(it.unit) }}</span>
              <span class="it-amt">{{ peso2(it.amount) }}</span>
            </div>
          </div>

          <!-- Totals (VAT-inclusive breakdown) -->
          <div class="totals-block">
            <div class="t-row"><span>Net of VAT (12%)</span><b>{{ peso2(selectedInvoice.net) }}</b></div>
            <div class="t-row"><span>VAT (12% inclusive)</span><b>{{ peso2(selectedInvoice.vat) }}</b></div>
            <div class="t-row grand"><span>Total</span><b>{{ peso2(selectedInvoice.total) }}</b></div>
          </div>

          <div v-if="selectedInvoice.specialRequests" class="notes-section">
            <h4>Special Requests</h4>
            <p>{{ selectedInvoice.specialRequests }}</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeDetail">Close</button>
          <button class="btn-secondary" @click="downloadInvoicePDF(selectedInvoice)"><i class="fas fa-file-pdf"></i>Download PDF</button>
          <template v-if="selectedInvoice.canPay">
            <button v-if="selectedInvoice.paymentStatus !== 'paid'" class="btn-primary" :disabled="busyId === selectedInvoice.id" @click="markPayment(selectedInvoice, 'paid')"><i class="fas fa-check"></i>Mark as Paid</button>
            <button v-else class="btn-danger" :disabled="busyId === selectedInvoice.id" @click="markPayment(selectedInvoice, 'unpaid')"><i class="fas fa-rotate-left"></i>Undo Payment</button>
          </template>
        </div>
      </div>
    </div>

    <!-- ═══ ⋮ CONTEXT MENU (active list: archive · Archive: restore) ═══ -->
    <transition name="ctxfade">
      <div v-if="menu" class="ctx-menu" role="menu"
           :style="{ left: menu.x + 'px', top: menu.y + 'px', transform: menu.flip ? 'translateX(-100%) translateY(-100%)' : 'translateX(-100%)' }">
        <template v-if="menu.action === 'archive'">
          <button v-if="canArchive(menu.booking)" class="ctx-item" role="menuitem" @click="archiveInvoice(menu.booking)">
            <i class="fas fa-archive"></i>
            <span class="ctx-txt">Move to Archive<small>Removes it from the active list.</small></span>
          </button>
          <div v-else class="ctx-disabled">
            <i class="fas fa-archive"></i>
            <span class="ctx-txt">Move to Archive<small>Only Paid or Void invoices can be archived.</small></span>
          </div>
        </template>
        <button v-else class="ctx-item" role="menuitem" @click="restoreInvoice(menu.booking)">
          <i class="fas fa-box-open"></i>
          <span class="ctx-txt">Restore to Active List<small>Back in the current invoices.</small></span>
        </button>
      </div>
    </transition>

    <!-- Toast -->
    <div v-if="toastMsg" class="toast" :class="toastType">{{ toastMsg }}</div>
  </div>
</template>

<style scoped>
.invoice-manager { animation: fadeIn .5s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

.page-title { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 28px; flex-wrap: wrap; gap: 14px; }
.page-title h1 { font-family: 'Unbounded', sans-serif; font-size: clamp(28px, 5vw, 48px); font-weight: 800; color: var(--fg); letter-spacing: -0.04em; margin: 0; line-height: .95; }
.page-title h1 span { background: linear-gradient(135deg, var(--ac), var(--wn)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.page-title p { color: var(--mt); font-size: 13px; margin: 6px 0 0; }
.title-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.btn-secondary { padding: 10px 16px; background: var(--bg2); color: var(--fg2); border: 1px solid var(--bdr); border-radius: 11px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: all .3s; }
.btn-secondary:hover:not(:disabled) { background: var(--card2); transform: translateY(-2px); }
.btn-secondary:disabled { opacity: .5; cursor: not-allowed; }
.btn-secondary.sm { padding: 8px 12px; font-size: 10px; border-radius: 9px; }
.btn-primary { padding: 10px 18px; background: linear-gradient(135deg, #B0D91E, #B0D91E); color: #fff; border: none; border-radius: 11px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: all .3s; }
.btn-primary:hover:not(:disabled) { transform: translateY(-2px); }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.btn-danger { padding: 10px 18px; background: linear-gradient(135deg, #F20707, #F20707); color: #fff; border: none; border-radius: 11px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: all .3s; }
.btn-danger:hover:not(:disabled) { transform: translateY(-2px); }
.btn-danger:disabled { opacity: .5; cursor: not-allowed; }

/* Stats */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
.stat-card { background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; padding: 18px; display: flex; align-items: center; gap: 14px; }
.stat-icon { width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
.stat-info { flex: 1; min-width: 0; }
.stat-value { font-family: 'Unbounded', sans-serif; font-size: 18px; font-weight: 800; color: var(--fg); line-height: 1.1; word-break: break-all; }
.stat-label { font-size: 10px; color: var(--mt); text-transform: uppercase; letter-spacing: .5px; font-weight: 700; margin-top: 5px; }

/* Filters + view toggle */
.filters { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
.search-wrap { position: relative; flex: 1; min-width: 220px; }
.search-wrap i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--mt); font-size: 12px; }
.search-wrap input, .filters select { padding: 10px 14px; background: var(--bg2); border: 1px solid var(--bdr); border-radius: 10px; color: var(--fg); font-size: 13px; outline: none; transition: all .3s; }
.search-wrap input { width: 100%; padding-left: 40px; }
.filters select { min-width: 160px; }
.search-wrap input:focus, .filters select:focus { border-color: var(--ac); box-shadow: 0 0 0 3px var(--acs); }
.view-toggle { display: flex; gap: 4px; background: var(--bg2); border: 1px solid var(--bdr); border-radius: 10px; padding: 4px; margin-left: auto; }
.view-toggle button { background: transparent; border: none; color: var(--mt); padding: 9px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all .25s; font-family: inherit; white-space: nowrap; }
.view-toggle button.active { background: var(--ac); color: #fff; box-shadow: 0 4px 12px var(--acg); }
.view-toggle button:hover:not(.active) { color: var(--fg); background: var(--card2); }

/* ═══ Archive ═══ */
.archive-head { margin-bottom: 12px; }
.archive-head h3 { font-family: 'Unbounded', sans-serif; font-size: 15px; font-weight: 700; color: var(--fg); margin: 0 0 4px; }
.archive-head h3 i { font-size: 12px; color: var(--ac); margin-right: 6px; }
.archive-head p { color: var(--mt); font-size: 12px; margin: 0; }
.archive-months { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
.chip { padding: 8px 14px; border-radius: 999px; border: 1px solid var(--bdr); background: var(--bg2); font-size: 12px; font-weight: 700; cursor: pointer; color: var(--mt); transition: all .2s; white-space: nowrap; font-family: inherit; }
.chip:hover { color: var(--fg); border-color: var(--ac); }
.chip.active { background: var(--ac); color: #fff; border-color: var(--ac); }

/* Invoice status pills */
.inv-pill { display: inline-block; padding: 4px 11px; border-radius: 999px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; white-space: nowrap; }
.in-paid { background: var(--okg); color: var(--ok); border: 1px solid var(--ok); }
.in-unpaid { background: var(--tlg); color: var(--tl); border: 1px solid var(--tl); }
.in-overdue { background: var(--dgg); color: var(--dg); border: 1px solid var(--dg); }
.in-pending { background: var(--wng); color: var(--wn); border: 1px solid var(--wn); }
.in-void { background: var(--bg2); color: var(--mt); border: 1px solid var(--bdr); }

/* Table */
.table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid var(--bdr); background: var(--card); }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
thead { background: var(--bg2); }
th { padding: 12px 16px; text-align: left; font-family: 'Unbounded', sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--mt); border-bottom: 1px solid var(--bdr); white-space: nowrap; }
td { padding: 12px 16px; border-bottom: 1px solid var(--bdr); color: var(--fg2); white-space: nowrap; }
tr:last-child td { border-bottom: none; }
tbody tr { transition: background .2s; cursor: pointer; }
tbody tr:hover { background: var(--acs); }
.id-cell, .guest-cell { font-weight: 700; color: var(--fg); }
.mono { font-family: monospace; letter-spacing: .3px; }
.total { font-weight: 700; color: var(--ok); }
.row-actions { white-space: nowrap; }
.action-btn { background: transparent; color: var(--ac); border: none; padding: 6px 8px; border-radius: 8px; cursor: pointer; font-size: 11px; }
.action-btn:hover { background: var(--acs); }
.action-btn.menu-btn { color: var(--mt); }
.action-btn.menu-btn:hover, .action-btn.menu-btn.active { background: var(--acs); color: var(--ac); }

/* Mobile cards */
.mobile-cards { display: none; flex-direction: column; gap: 12px; }
.invoice-card { background: var(--card); border: 1px solid var(--bdr); border-radius: 14px; padding: 16px; cursor: pointer; transition: all .25s; }
.invoice-card:hover { border-color: var(--ac); }
.ic-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.ic-guest { display: flex; gap: 10px; align-items: center; }
.ic-avatar { width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, var(--ac), var(--wn)); display: flex; align-items: center; justify-content: center; font-family: 'Unbounded', sans-serif; font-weight: 800; font-size: 12px; color: #fff; }
.ic-name { font-family: 'Unbounded', sans-serif; font-size: 13px; font-weight: 700; color: var(--fg); }
.ic-no { font-size: 10px; color: var(--mt); font-family: monospace; margin-top: 2px; }
.ic-right { display: flex; align-items: center; gap: 6px; }
.inv-menu { width: 28px; height: 28px; border: none; background: transparent; border-radius: 8px; color: var(--mt); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; transition: all .2s; }
.inv-menu:hover, .inv-menu.active { background: var(--acs); color: var(--ac); }
.ic-mid { font-size: 11px; color: var(--mt); margin-bottom: 10px; }
.ic-bottom { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.ic-dates { font-size: 12px; color: var(--fg2); font-weight: 600; }
.ic-total { font-family: 'Unbounded', sans-serif; font-size: 15px; font-weight: 800; color: var(--ok); }
.ic-actions { display: flex; gap: 8px; }

/* States */
.state-box { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 20px; color: var(--mt); text-align: center; }
.spinner { width: 34px; height: 34px; border: 3px solid var(--bdr); border-top-color: var(--ac); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.empty-state { text-align: center; padding: 50px 20px; color: var(--mt); }
.empty-state i { font-size: 44px; margin-bottom: 14px; opacity: .3; }
.empty-state h3 { font-family: 'Unbounded', sans-serif; color: var(--fg); margin: 0 0 6px; }
.empty-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 10px; }

.pagination { display: flex; align-items: center; gap: 4px; justify-content: center; margin-top: 18px; }
.pagination button { width: 34px; height: 34px; border-radius: 8px; background: var(--card); border: 1px solid var(--bdr); color: var(--fg2); font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .2s; }
.pagination button:hover:not(:disabled) { border-color: var(--ac); color: var(--ac); }
.pagination button.active { background: var(--ac); border-color: var(--ac); color: #fff; }
.pagination button:disabled { opacity: .4; cursor: not-allowed; }

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

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; animation: fadeIn .2s ease; }
.modal-content { background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; width: 90%; max-width: 580px; box-shadow: 0 20px 60px rgba(0,0,0,.5); animation: slideUp .3s cubic-bezier(.22,1,.36,1); max-height: 90vh; overflow-y: auto; }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.modal-header { padding: 20px; border-bottom: 1px solid var(--bdr); display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { font-family: 'Unbounded', sans-serif; font-size: 16px; font-weight: 700; color: var(--fg); margin: 0; }
.close-btn { background: transparent; border: none; color: var(--mt); font-size: 16px; cursor: pointer; padding: 4px; }
.close-btn:hover { color: var(--dg); }
.modal-body { padding: 20px; }
.modal-footer { padding: 20px; border-top: 1px solid var(--bdr); display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
.detail-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; padding-bottom: 16px; border-bottom: 1px solid var(--bdr); gap: 10px; }
.detail-header h2 { font-family: 'Unbounded', sans-serif; font-size: 18px; font-weight: 800; color: var(--fg); margin: 0 0 4px; }
.detail-sub { color: var(--mt); font-size: 12px; margin: 0; }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
.detail-item { display: flex; flex-direction: column; gap: 4px; }
.detail-label { font-size: 10px; color: var(--mt); text-transform: uppercase; letter-spacing: .5px; font-weight: 700; }
.detail-value { font-size: 13px; font-weight: 600; color: var(--fg); }
.contact-section, .notes-section { background: var(--bg2); padding: 14px; border-radius: 10px; margin-bottom: 14px; border: 1px solid var(--bdr); }
.contact-section h4, .notes-section h4 { font-family: 'Unbounded', sans-serif; font-size: 11px; font-weight: 700; color: var(--fg); margin: 0 0 8px; text-transform: uppercase; letter-spacing: .5px; }
.contact-section p, .notes-section p { font-size: 13px; color: var(--fg2); margin: 4px 0; }
.contact-section p i { width: 16px; color: var(--mt); }

/* Line items */
.items-table { border: 1px solid var(--bdr); border-radius: 10px; overflow: hidden; margin-bottom: 14px; }
.items-head, .items-row { display: grid; grid-template-columns: 1fr 60px 100px 110px; gap: 8px; padding: 10px 14px; align-items: center; }
.items-head { background: var(--bg2); font-family: 'Unbounded', sans-serif; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--mt); }
.items-row { border-top: 1px solid var(--bdr); font-size: 12px; color: var(--fg2); }
.it-desc { font-weight: 600; color: var(--fg); }
.it-qty { text-align: center; }
.it-unit, .it-amt { text-align: right; }
.it-amt { font-weight: 700; color: var(--fg); }

/* Totals */
.totals-block { background: var(--bg2); border: 1px solid var(--bdr); border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; }
.t-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--fg2); padding: 4px 0; }
.t-row.grand { border-top: 1px solid var(--bdr); margin-top: 6px; padding-top: 10px; font-size: 15px; color: var(--fg); }
.t-row.grand b { font-family: 'Unbounded', sans-serif; color: var(--ok); }

/* Toast */
.toast { position: fixed; bottom: 24px; right: 24px; z-index: 200; padding: 13px 20px; border-radius: 12px; font-size: 13px; font-weight: 700; color: #fff; box-shadow: 0 12px 32px rgba(0,0,0,.35); animation: slideUp .25s ease; max-width: 340px; }
.toast.ok { background: #B0D91E; }
.toast.err { background: #F20707; }

@media (max-width: 1200px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 900px) {
  .desktop-view { display: none; }
  .mobile-cards { display: flex; }
  .detail-grid { grid-template-columns: 1fr; }
  .modal-footer { flex-direction: column-reverse; gap: 8px; }
  .modal-footer button { width: 100%; justify-content: center; }
  .view-toggle { margin-left: 0; width: 100%; }
  .view-toggle button { flex: 1; justify-content: center; }
}
@media (max-width: 640px) {
  .stats-grid { grid-template-columns: 1fr; }
  .archive-months { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 2px; }
  .archive-months::-webkit-scrollbar { display: none; }
  .ctx-menu { min-width: 200px; }
}
</style>