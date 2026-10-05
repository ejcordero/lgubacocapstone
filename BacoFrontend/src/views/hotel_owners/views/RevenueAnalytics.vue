<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import Chart from 'chart.js/auto'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { API } from '@/api'

const router = useRouter()

// Same auth + base as BookingManager / GuestDirectory
const getOwnerToken = () =>
  localStorage.getItem('baco_owner_token') ||
  localStorage.getItem('ownerToken') ||
  localStorage.getItem('owner_token') ||
  ''

// ── State ──
const bookings = ref([])
const hotelName = ref('')
const loading = ref(false)
const toastMsg = ref('')
const toastType = ref('ok')
let toastTimer = null

function showToast(msg, type = 'ok') {
  toastMsg.value = msg
  toastType.value = type
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 3500)
}

async function loadData() {
  loading.value = true
  try {
    const res = await fetch(`${API}/owner/bookings`, {
      headers: { Authorization: `Bearer ${getOwnerToken()}` }
    })
    if (res.status === 401 || res.status === 403) { router.push('/owner/login'); return }
    const data = await res.json()
    bookings.value = data.bookings || []
    hotelName.value = data.hotel?.name || ''
  } catch (e) {
    showToast('Could not load analytics. Is the server running?', 'err')
  } finally {
    loading.value = false
  }
}

// ── Date helpers (timezone-safe) ──
function localTodayStr() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}
function addDaysStr(dateStr, n) {
  const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const todayStr = localTodayStr()

// ── Core aggregations ──
const paidBookings = computed(() => bookings.value.filter(b => ['confirmed', 'completed'].includes(b.status)))
const totalRevenue = computed(() => paidBookings.value.reduce((s, b) => s + Number(b.totalAmount || 0), 0))
const totalBookings = computed(() => bookings.value.length)
const avgBookingValue = computed(() => paidBookings.value.length ? Math.round(totalRevenue.value / paidBookings.value.length) : 0)
const pendingCount = computed(() => bookings.value.filter(b => b.status === 'pending').length)
const totalVisitors = computed(() => paidBookings.value.reduce((s, b) => s + Number(b.pax || 0), 0))
const avgGroupSize = computed(() => paidBookings.value.length ? (totalVisitors.value / paidBookings.value.length).toFixed(1) : '0')

const decidedCount = computed(() => bookings.value.filter(b => b.status !== 'pending').length)
const approvalRate = computed(() => {
  if (!decidedCount.value) return 0
  const approved = bookings.value.filter(b => ['confirmed', 'completed'].includes(b.status)).length
  return Math.round((approved / decidedCount.value) * 100)
})
const lostCount = computed(() => bookings.value.filter(b => ['rejected', 'cancelled', 'no_show'].includes(b.status)).length)

// Avg lead time: days between booking date and check-in
function leadDays(b) {
  if (!b.createdAt || !b.checkIn) return null
  const ci = new Date(String(b.checkIn).slice(0, 10) + 'T00:00:00')
  const cr = new Date(b.createdAt)
  if (isNaN(ci.getTime()) || isNaN(cr.getTime())) return null
  return Math.max(0, Math.round((ci - cr) / 86400000))
}
const avgLeadTime = computed(() => {
  const vals = paidBookings.value.map(leadDays).filter(v => v !== null)
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
})

// Month-over-month revenue growth (last month vs the one before)
const mohLabel = computed(() => {
  const v = monthlySeries.value.revenue
  const last = v[11] || 0, prev = v[10] || 0
  if (prev === 0) return last > 0 ? 'New revenue this month' : 'No revenue yet'
  const pctv = Math.round(((last - prev) / prev) * 100)
  return `${pctv >= 0 ? '+' : ''}${pctv}% vs last month`
})

// Last 12 months: revenue + booking count + visitors (grouped by check-in month)
const monthlySeries = computed(() => {
  const now = new Date()
  const labels = [], keys = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    labels.push(d.toLocaleDateString('en-US', { month: 'short' }))
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const revenue = [], counts = [], visitors = []
  for (const k of keys) {
    const month = paidBookings.value.filter(b => (b.checkIn || '').slice(0, 7) === k)
    revenue.push(month.reduce((s, b) => s + Number(b.totalAmount || 0), 0))
    counts.push(month.length)
    visitors.push(month.reduce((s, b) => s + Number(b.pax || 0), 0))
  }
  return { labels, revenue, counts, visitors }
})

// Status breakdown
const STATUS_ORDER = [
  { key: 'pending',   label: 'Pending',   color: '#F2B807' },
  { key: 'confirmed', label: 'Approved',  color: '#B0D91E' },
  { key: 'completed', label: 'Completed', color: '#07DBF2' },
  { key: 'rejected',  label: 'Rejected',  color: '#F20707' },
  { key: 'cancelled', label: 'Cancelled', color: '#F20707' },
  { key: 'no_show',   label: 'No Show',   color: '#9ca3af' }
]
const statusRows = computed(() =>
  STATUS_ORDER
    .map(s => ({ ...s, count: bookings.value.filter(b => b.status === s.key).length }))
    .filter(s => s.count > 0)
)

// Booking mix
const mixCounts = computed(() => {
  const ent = bookings.value.filter(b => b.bookingType === 'entrance').length
  const stay = bookings.value.filter(b => b.bookingType === 'accommodation').length
  return { ent, stay, total: ent + stay }
})

// Stay duration distribution (accommodation only)
const durationSeries = computed(() => {
  const buckets = [0, 0, 0, 0, 0] // 1,2,3,4,5+
  for (const b of bookings.value) {
    if (b.bookingType !== 'accommodation') continue
    const n = Math.max(1, Number(b.nights) || 1)
    buckets[Math.min(n, 5) - 1]++
  }
  return buckets
})

// Check-in day of week (approved + completed)
const dowSeries = computed(() => {
  const counts = [0, 0, 0, 0, 0, 0, 0] // Sun..Sat
  for (const b of paidBookings.value) {
    const d = new Date(String(b.checkIn).slice(0, 10) + 'T00:00:00')
    if (!isNaN(d.getTime())) counts[d.getDay()]++
  }
  return counts
})
const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Top guests by revenue (with counts)
const topGuests = computed(() => {
  const map = {}
  for (const b of paidBookings.value) {
    const key = (b.guestEmail || b.guestName || 'unknown').toLowerCase()
    if (!map[key]) map[key] = { name: b.guestName || 'Unknown', amount: 0, count: 0 }
    map[key].amount += Number(b.totalAmount || 0)
    map[key].count += 1
  }
  return Object.values(map).sort((a, b) => b.amount - a.amount).slice(0, 5)
})
const hasGuestData = computed(() => topGuests.value.length > 0)

// Next 30 days forecast (confirmed only)
const upcoming = computed(() => {
  const end = addDaysStr(todayStr, 30)
  return bookings.value
    .filter(b => b.status === 'confirmed' && b.checkIn >= todayStr && b.checkIn <= end)
    .sort((a, b) => (a.checkIn < b.checkIn ? -1 : 1))
})
const upcomingRevenue = computed(() => upcoming.value.reduce((s, b) => s + Number(b.totalAmount || 0), 0))

// ── Detailed ledger filters ──
const detailStatus = ref('')
const detailType = ref('')
const detailSearch = ref('')
const detailRows = computed(() => {
  const q = detailSearch.value.trim().toLowerCase()
  return bookings.value.filter(b => {
    if (detailStatus.value && b.status !== detailStatus.value) return false
    if (detailType.value && b.bookingType !== detailType.value) return false
    if (q) {
      const hit = (b.id || '').toLowerCase().includes(q) ||
        (b.guestName || '').toLowerCase().includes(q) ||
        (b.guestEmail || '').toLowerCase().includes(q)
      if (!hit) return false
    }
    return true
  })
})

// ── Formatting ──
const peso = (n) => '₱' + Number(n || 0).toLocaleString()
const compactPeso = (n) => {
  n = Number(n || 0)
  if (n >= 1000000) return '₱' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return '₱' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k'
  return '₱' + Math.round(n)
}
const trunc = (s) => (s || '').length > 14 ? s.slice(0, 13) + '…' : s
const pct = (part, total) => total > 0 ? Math.round((part / total) * 100) : 0
function fmtDate(d) {
  if (!d) return '—'
  return new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function fmtDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
const typeLabel = (b) => b.bookingType === 'entrance' ? 'Day Tour' : 'Overnight'
const typeCls = (b) => b.bookingType === 'entrance' ? 'ent' : 'stay'
function productLabel(b) {
  if (b.bookingType === 'entrance') return b.feeName || 'Entrance'
  return [b.roomName, b.feeName].filter(Boolean).join(' + ') || 'Stay'
}
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
const idTypeLabel = (v) => ({ philid: 'PhilID / National ID', passport: 'Passport', drivers: "Driver's License" }[v] || v || '—')

// ── Chart.js ──
// Tick sizing adapts to the viewport so 12-month labels stay readable on phones.
const isNarrow = () => window.innerWidth < 640
const tickSize = () => (isNarrow() ? 9 : 11)

const revenueCanvas = ref(null)
const statusCanvas = ref(null)
const mixCanvas = ref(null)
const durationCanvas = ref(null)
const dowCanvas = ref(null)
const guestsCanvas = ref(null)
let charts = []

const CHART_TEXT = '#9ca3af'
const CHART_GRID = 'rgba(148,163,184,.12)'

function destroyCharts() {
  charts.forEach(c => c.destroy())
  charts = []
}

function buildCharts() {
  destroyCharts()
  const mk = (canvas, cfg) => { if (canvas.value) charts.push(new Chart(canvas.value, cfg)) }

  // 1 — Monthly Revenue + Bookings (combo)
  mk(revenueCanvas, {
    type: 'bar',
    data: {
      labels: monthlySeries.value.labels,
      datasets: [
        {
          label: 'Revenue', type: 'bar', data: monthlySeries.value.revenue, yAxisID: 'y', order: 2,
          backgroundColor: 'rgba(255,61,0,.7)', hoverBackgroundColor: '#F20707',
          borderRadius: 6, maxBarThickness: 38
        },
        {
          label: 'Bookings', type: 'line', data: monthlySeries.value.counts, yAxisID: 'y1', order: 1,
          borderColor: '#07DBF2', backgroundColor: '#07DBF2',
          tension: .35, borderWidth: 2, pointRadius: isNarrow() ? 2 : 3, fill: false
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: CHART_TEXT, boxWidth: 12, font: { size: tickSize() } } },
        tooltip: {
          backgroundColor: '#1f2937',
          callbacks: {
            label: (ctx) => ctx.dataset.type === 'bar'
              ? ` Revenue: ${peso(ctx.parsed.y)}`
              : ` Bookings: ${ctx.parsed.y}`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: CHART_TEXT, font: { size: tickSize() }, autoSkip: true, maxRotation: isNarrow() ? 45 : 0 } },
        y: { beginAtZero: true, grid: { color: CHART_GRID }, ticks: { color: CHART_TEXT, font: { size: tickSize() }, callback: (v) => compactPeso(v) } },
        y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: CHART_TEXT, font: { size: tickSize() }, precision: 0 } }
      }
    }
  })

  // 2 — Status breakdown (doughnut)
  if (statusRows.value.length) {
    mk(statusCanvas, {
      type: 'doughnut',
      data: {
        labels: statusRows.value.map(s => s.label),
        datasets: [{ data: statusRows.value.map(s => s.count), backgroundColor: statusRows.value.map(s => s.color), borderWidth: 0, hoverOffset: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1f2937', callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} (${pct(ctx.parsed, totalBookings.value)}%)` } } }
      }
    })
  }

  // 3 — Booking mix (doughnut)
  if (mixCounts.value.total > 0) {
    mk(mixCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Day Tours', 'Overnight'],
        datasets: [{ data: [mixCounts.value.ent, mixCounts.value.stay], backgroundColor: ['#F20707', '#07DBF2'], borderWidth: 0, hoverOffset: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1f2937', callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} (${pct(ctx.parsed, mixCounts.value.total)}%)` } } }
      }
    })
  }

  // 4 — Stay duration (bar)
  mk(durationCanvas, {
    type: 'bar',
    data: {
      labels: ['1 night', '2 nights', '3 nights', '4 nights', '5+ nights'],
      datasets: [{ data: durationSeries.value, backgroundColor: 'rgba(179,136,255,.75)', hoverBackgroundColor: '#D9B384', borderRadius: 6, maxBarThickness: 42 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1f2937', callbacks: { label: (ctx) => ` ${ctx.parsed.y} booking(s)` } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: CHART_TEXT, font: { size: tickSize() }, autoSkip: false, maxRotation: isNarrow() ? 40 : 0 } },
        y: { beginAtZero: true, grid: { color: CHART_GRID }, ticks: { color: CHART_TEXT, font: { size: tickSize() }, precision: 0 } }
      }
    }
  })

  // 5 — Check-in day of week (bar)
  mk(dowCanvas, {
    type: 'bar',
    data: {
      labels: dowLabels,
      datasets: [{ data: dowSeries.value, backgroundColor: 'rgba(0,255,148,.7)', hoverBackgroundColor: '#B0D91E', borderRadius: 6, maxBarThickness: 42 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1f2937', callbacks: { label: (ctx) => ` ${ctx.parsed.y} arrival(s)` } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: CHART_TEXT, font: { size: tickSize() } } },
        y: { beginAtZero: true, grid: { color: CHART_GRID }, ticks: { color: CHART_TEXT, font: { size: tickSize() }, precision: 0 } }
      }
    }
  })

  // 6 — Top guests (horizontal bar)
  if (hasGuestData.value) {
    mk(guestsCanvas, {
      type: 'bar',
      data: {
        labels: topGuests.value.map(g => trunc(g.name)),
        datasets: [{ data: topGuests.value.map(g => g.amount), backgroundColor: 'rgba(255,214,0,.75)', hoverBackgroundColor: '#F2B807', borderRadius: 6, maxBarThickness: 26 }]
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1f2937', callbacks: { label: (ctx) => ` Spent: ${peso(ctx.parsed.x)} · ${topGuests.value[ctx.dataIndex].count} booking(s)` } } },
        scales: {
          x: { beginAtZero: true, grid: { color: CHART_GRID }, ticks: { color: CHART_TEXT, font: { size: tickSize() }, callback: (v) => compactPeso(v) } },
          y: { grid: { display: false }, ticks: { color: CHART_TEXT, font: { size: tickSize() } } }
        }
      }
    })
  }
}

// Rebuild charts only when the viewport crosses the mobile breakpoint
// (rotation / window resize) so tick sizing matches the new layout.
let resizeTimer = null
let lastW = typeof window !== 'undefined' ? window.innerWidth : 0
const onResize = () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    const crossed = (lastW < 640) !== (window.innerWidth < 640)
    lastW = window.innerWidth
    if (crossed && bookings.value.length) buildCharts()
  }, 250)
}

async function refresh() {
  await loadData()
  await nextTick()
  buildCharts()
}
onMounted(() => {
  refresh()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  destroyCharts()
  clearTimeout(resizeTimer)
  window.removeEventListener('resize', onResize)
})

// ── EXPORT: CSV (opens in Excel; UTF-8 BOM keeps ₱ readable) ──
function csvCell(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
function exportCSV() {
  if (!bookings.value.length) return
  const head = ['Ref', 'Booked At', 'Guest', 'Email', 'Contact', 'ID Type', 'Type', 'Room/Fee', 'Check-in', 'Check-out', 'Nights', 'Pax', 'Adults', 'Children', 'Amount (PHP)', 'Payment Status', 'Payment Method', 'Status', 'Special Requests']
  const rows = bookings.value.map(b => [
    b.id, fmtDateTime(b.createdAt), b.guestName, b.guestEmail, b.guestContact,
    idTypeLabel(b.guestIdType), typeLabel(b), productLabel(b),
    b.checkIn, b.checkOut, b.nights, b.pax, b.adults, b.children,
    Number(b.totalAmount || 0).toFixed(2), b.paymentStatus, (b.paymentMethod || '').replace('_', ' '),
    statusLabel(b.status), b.specialRequests || ''
  ])
  const csv = '\uFEFF' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `baco-bookings-${todayStr}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
  showToast('Bookings CSV downloaded.')
}

// ── EXPORT: PDF report ──
// NOTE: jsPDF's built-in fonts can't render '₱' (not in WinAnsi), so amounts use "PHP " prefix in the PDF.
function exportPDF() {
  if (!bookings.value.length) return
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageH = doc.internal.pageSize.getHeight()
  const generated = new Date().toLocaleString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const money = (n) => `PHP ${Number(n || 0).toLocaleString()}`

  // Header
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(17, 24, 39)
  doc.text('Revenue & Performance Report', 40, 54)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(107, 114, 128)
  doc.text(`${hotelName.value || 'Resort'} — Municipality of Baco, Oriental Mindoro`, 40, 72)
  doc.text(`Generated ${generated}  ·  Revenue counts approved + completed bookings`, 40, 88)

  let y = 112
  const ensure = (need) => { if (y > pageH - need) { doc.addPage(); y = 50 } }
  const section = (title) => { ensure(140); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(17, 24, 39); doc.text(title, 40, y); y += 8 }

  const tableOpts = (extra = {}) => ({
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 5, textColor: [55, 65, 81] },
    headStyles: { fillColor: [17, 24, 39], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 40, right: 40 },
    ...extra
  })

  // 1 — Key metrics
  section('Key Metrics')
  autoTable(doc, tableOpts({
    startY: y,
    head: [['Metric', 'Value', 'Metric', 'Value']],
    body: [
      ['Total Revenue', money(totalRevenue.value), 'Total Bookings', String(totalBookings.value)],
      ['Avg. Booking Value', money(avgBookingValue.value), 'Pending Requests', String(pendingCount.value)],
      ['Total Visitors', String(totalVisitors.value), 'Avg. Group Size', `${avgGroupSize.value} guests`],
      ['Approval Rate', `${approvalRate.value}%`, 'Declined / Lost', String(lostCount.value)],
      ['Avg. Lead Time', `${avgLeadTime.value} days`, 'Upcoming (30d)', `${upcoming.value.length} bookings · ${money(upcomingRevenue.value)}`]
    ],
    columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 130, fontStyle: 'bold' }, 2: { cellWidth: 130 }, 3: { cellWidth: 130, fontStyle: 'bold' } }
  }))
  y = doc.lastAutoTable.finalY + 22

  // 2 — Monthly performance
  section('Monthly Performance (last 12 months, by check-in month)')
  autoTable(doc, tableOpts({
    startY: y,
    head: [['Month', 'Bookings', 'Visitors', 'Revenue']],
    body: monthlySeries.value.labels.map((l, i) => [l, String(monthlySeries.value.counts[i]), String(monthlySeries.value.visitors[i]), money(monthlySeries.value.revenue[i])])
  }))
  y = doc.lastAutoTable.finalY + 22

  // 3 — Status breakdown
  section('Booking Status Breakdown')
  autoTable(doc, tableOpts({
    startY: y,
    head: [['Status', 'Count', 'Share']],
    body: statusRows.value.map(s => [s.label, String(s.count), `${pct(s.count, totalBookings.value)}%`])
  }))
  y = doc.lastAutoTable.finalY + 22

  // 4 — Top guests
  if (hasGuestData.value) {
    section('Top Guests by Revenue')
    autoTable(doc, tableOpts({
      startY: y,
      head: [['Guest', 'Bookings', 'Total Spent']],
      body: topGuests.value.map(g => [g.name, String(g.count), money(g.amount)])
    }))
    y = doc.lastAutoTable.finalY + 22
  }

  // 5 — Upcoming 30 days
  if (upcoming.value.length) {
    section('Upcoming Bookings (next 30 days)')
    autoTable(doc, tableOpts({
      startY: y,
      head: [['Ref', 'Guest', 'Check-in', 'Type', 'Pax', 'Amount']],
      body: upcoming.value.map(b => [b.id, b.guestName, fmtDate(b.checkIn), typeLabel(b), String(b.pax), money(b.totalAmount)]),
      columnStyles: { 0: { cellWidth: 110 }, 5: { halign: 'right' } }
    }))
    y = doc.lastAutoTable.finalY + 22
  }

  // Footers on every page
  const pages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150)
    doc.text(`Baco LGU Tourism — Owner Report  ·  Page ${i} of ${pages}`, 40, pageH - 18)
  }

  doc.save(`baco-revenue-report-${todayStr}.pdf`)
  showToast('PDF report downloaded.')
}
</script>

<template>
  <div class="revenue-analytics">
    <div class="page-title">
      <div>
        <h1>Revenue <span>Analytics</span></h1>
        <p>{{ hotelName ? `Financial performance for ${hotelName}.` : 'Financial performance overview.' }}</p>
      </div>
      <div class="title-actions">
        <button class="btn-secondary" :disabled="loading || totalBookings === 0" @click="exportPDF"><i class="fas fa-file-pdf"></i>PDF</button>
        <button class="btn-secondary" :disabled="loading || totalBookings === 0" @click="exportCSV"><i class="fas fa-file-csv"></i>CSV</button>
        <button class="btn-secondary" :disabled="loading" @click="refresh"><i class="fas fa-rotate-right"></i>Refresh</button>
      </div>
    </div>

    <div v-if="loading" class="state-box"><div class="spinner"></div><p>Loading analytics…</p></div>

    <template v-else>
      <!-- ═══ STAT CARDS ═══ -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon" style="background: rgba(0,255,148,.12); color: #B0D91E"><i class="fas fa-peso-sign"></i></div>
          <div class="stat-info">
            <div class="stat-value">{{ peso(totalRevenue) }}</div>
            <div class="stat-label">Total Revenue (Approved + Completed)</div>
            <div class="stat-sub" :class="{ pos: mohLabel.startsWith('+') }">{{ mohLabel }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background: rgba(255,61,0,.12); color: #F20707"><i class="fas fa-receipt"></i></div>
          <div class="stat-info">
            <div class="stat-value">{{ totalBookings.toLocaleString() }}</div>
            <div class="stat-label">Total Bookings</div>
            <div class="stat-sub">{{ mixCounts.ent }} day tours · {{ mixCounts.stay }} overnight</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background: rgba(255,214,0,.12); color: #F2B807"><i class="fas fa-hand-holding-usd"></i></div>
          <div class="stat-info">
            <div class="stat-value">{{ peso(avgBookingValue) }}</div>
            <div class="stat-label">Avg. Booking Value</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background: rgba(245,158,11,.12); color: #F2B807"><i class="fas fa-hourglass-half"></i></div>
          <div class="stat-info">
            <div class="stat-value">{{ pendingCount }}</div>
            <div class="stat-label">Pending Requests</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background: rgba(0,229,255,.12); color: #07DBF2"><i class="fas fa-users"></i></div>
          <div class="stat-info">
            <div class="stat-value">{{ totalVisitors.toLocaleString() }}</div>
            <div class="stat-label">Total Visitors (Approved + Completed)</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background: rgba(179,136,255,.12); color: #D9B384"><i class="fas fa-user-friends"></i></div>
          <div class="stat-info">
            <div class="stat-value">{{ avgGroupSize }}</div>
            <div class="stat-label">Avg. Group Size</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background: rgba(34,197,94,.12); color: #B0D91E"><i class="fas fa-check-double"></i></div>
          <div class="stat-info">
            <div class="stat-value">{{ approvalRate }}%</div>
            <div class="stat-label">Approval Rate (of decided bookings)</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon" style="background: rgba(59,130,246,.12); color: #07DBF2"><i class="fas fa-calendar-week"></i></div>
          <div class="stat-info">
            <div class="stat-value">{{ avgLeadTime }} days</div>
            <div class="stat-label">Avg. Lead Time (booking → check-in)</div>
          </div>
        </div>
      </div>

      <div v-if="totalBookings === 0" class="empty-state">
        <i class="fas fa-chart-line"></i>
        <h3>No data yet</h3>
        <p>Analytics appear automatically once bookings come in.</p>
      </div>

      <template v-else>
        <!-- ═══ MONTHLY REVENUE + BOOKINGS ═══ -->
        <div class="card mb">
          <div class="card-header"><h3><i class="fas fa-chart-area" style="color:#F20707"></i>Monthly Revenue & Bookings (last 12 months)</h3></div>
          <div class="card-body"><div class="chart-box tall"><canvas ref="revenueCanvas"></canvas></div></div>
        </div>

        <!-- ═══ STATUS + MIX DONUTS ═══ -->
        <div class="charts-grid mb">
          <div class="card">
            <div class="card-header"><h3><i class="fas fa-tasks" style="color:#B0D91E"></i>Booking Status Breakdown</h3></div>
            <div class="card-body">
              <div class="donut-wrap"><canvas ref="statusCanvas"></canvas></div>
              <div class="legend">
                <div v-for="s in statusRows" :key="s.key" class="legend-item">
                  <span class="legend-dot" :style="{ background: s.color }"></span>
                  <span class="legend-label">{{ s.label }}</span>
                  <span class="legend-value">{{ s.count }} · {{ pct(s.count, totalBookings) }}%</span>
                </div>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h3><i class="fas fa-chart-pie" style="color:#07DBF2"></i>Booking Mix</h3></div>
            <div class="card-body">
              <div class="donut-wrap"><canvas ref="mixCanvas"></canvas></div>
              <div class="legend">
                <div class="legend-item">
                  <span class="legend-dot" style="background:#F20707"></span>
                  <span class="legend-label">Day Tours</span>
                  <span class="legend-value">{{ mixCounts.ent }} · {{ pct(mixCounts.ent, mixCounts.total) }}%</span>
                </div>
                <div class="legend-item">
                  <span class="legend-dot" style="background:#07DBF2"></span>
                  <span class="legend-label">Overnight</span>
                  <span class="legend-value">{{ mixCounts.stay }} · {{ pct(mixCounts.stay, mixCounts.total) }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ DURATION + DAY OF WEEK ═══ -->
        <div class="charts-grid mb">
          <div class="card">
            <div class="card-header"><h3><i class="fas fa-moon" style="color:#D9B384"></i>Stay Duration (Overnight Stays)</h3></div>
            <div class="card-body"><div class="chart-box mid"><canvas ref="durationCanvas"></canvas></div></div>
          </div>
          <div class="card">
            <div class="card-header"><h3><i class="fas fa-calendar-day" style="color:#B0D91E"></i>Arrivals by Day of Week</h3></div>
            <div class="card-body"><div class="chart-box mid"><canvas ref="dowCanvas"></canvas></div></div>
          </div>
        </div>

        <!-- ═══ TOP GUESTS ═══ -->
        <div class="card mb">
          <div class="card-header"><h3><i class="fas fa-chart-bar" style="color:#F2B807"></i>Top Guests by Revenue</h3></div>
          <div class="card-body">
            <div v-if="!hasGuestData" class="mini-empty">No approved or completed bookings yet.</div>
            <div v-else class="chart-box short"><canvas ref="guestsCanvas"></canvas></div>
          </div>
        </div>

        <!-- ═══ UPCOMING 30 DAYS ═══ -->
        <div class="card mb">
          <div class="card-header">
            <h3><i class="fas fa-forward" style="color:#07DBF2"></i>Next 30 Days</h3>
            <span class="header-note">{{ upcoming.length }} booking(s) · {{ peso(upcomingRevenue) }} expected</span>
          </div>
          <div class="card-body">
            <div v-if="upcoming.length === 0" class="mini-empty">No approved bookings arriving in the next 30 days.</div>
            <template v-else>
              <!-- Desktop table -->
              <div class="table-wrap flat tbl-desktop">
                <table>
                  <thead><tr><th>Ref</th><th>Guest</th><th>Check-in</th><th>Type</th><th>Pax</th><th>Amount</th></tr></thead>
                  <tbody>
                    <tr v-for="b in upcoming" :key="b.id">
                      <td class="mono">{{ b.id }}</td>
                      <td>{{ b.guestName }}</td>
                      <td>{{ fmtDate(b.checkIn) }}</td>
                      <td>{{ typeLabel(b) }}</td>
                      <td class="num">{{ b.pax }}</td>
                      <td class="amount">{{ peso(b.totalAmount) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <!-- Mobile cards -->
              <div class="mb-list">
                <div v-for="b in upcoming" :key="b.id" class="mb-card">
                  <div class="mb-top">
                    <span class="mono">{{ b.id }}</span>
                    <span class="mb-amount">{{ peso(b.totalAmount) }}</span>
                  </div>
                  <div class="mb-name">{{ b.guestName }}</div>
                  <div class="mb-meta">
                    <span class="type-badge" :class="typeCls(b)">{{ typeLabel(b) }}</span>
                    <span><i class="fas fa-calendar-day"></i> {{ fmtDate(b.checkIn) }}</span>
                    <span><i class="fas fa-users"></i> {{ b.pax }} pax</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- ═══ DETAILED BOOKINGS LEDGER ═══ -->
        <div class="card">
          <div class="card-header">
            <h3><i class="fas fa-list" style="color:#F20707"></i>Bookings Ledger</h3>
            <span class="header-note">{{ detailRows.length }} of {{ totalBookings }} booking(s)</span>
          </div>
          <div class="card-body">
            <div class="ledger-filters">
              <div class="search-wrap">
                <i class="fas fa-search"></i>
                <input v-model="detailSearch" type="text" placeholder="Search ref, guest, email…" />
              </div>
              <select v-model="detailStatus">
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Approved</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
              <select v-model="detailType">
                <option value="">All Types</option>
                <option value="entrance">Day Tour</option>
                <option value="accommodation">Overnight</option>
              </select>
            </div>

            <div v-if="detailRows.length === 0" class="mini-empty">No bookings match the filters.</div>
            <template v-else>
              <!-- Desktop table -->
              <div class="table-wrap flat tbl-desktop">
                <table>
                  <thead>
                    <tr>
                      <th>Ref</th><th>Guest</th><th>Type</th><th>Room / Fee</th><th>Check-in</th>
                      <th>Check-out</th><th>Pax</th><th>Amount</th><th>Payment</th><th>Status</th><th>Booked</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="b in detailRows" :key="b.id">
                      <td class="mono">{{ b.id }}</td>
                      <td>{{ b.guestName }}</td>
                      <td>{{ typeLabel(b) }}</td>
                      <td>{{ productLabel(b) }}</td>
                      <td>{{ fmtDate(b.checkIn) }}</td>
                      <td>{{ fmtDate(b.checkOut) }}</td>
                      <td class="num">{{ b.pax }}</td>
                      <td class="amount">{{ peso(b.totalAmount) }}</td>
                      <td><span class="pay-pill" :class="b.paymentStatus === 'paid' ? 'paid' : 'unpaid'">{{ b.paymentStatus }}</span></td>
                      <td><span class="status-pill" :class="statusCls(b.status)">{{ statusLabel(b.status) }}</span></td>
                      <td class="dim">{{ fmtDateTime(b.createdAt) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <!-- Mobile cards -->
              <div class="mb-list">
                <div v-for="b in detailRows" :key="b.id" class="mb-card">
                  <div class="mb-top">
                    <span class="mono">{{ b.id }}</span>
                    <span class="mb-amount">{{ peso(b.totalAmount) }}</span>
                  </div>
                  <div class="mb-name">{{ b.guestName }}</div>
                  <div class="mb-meta">
                    <span class="type-badge" :class="typeCls(b)">{{ typeLabel(b) }}</span>
                    <span>{{ productLabel(b) }}</span>
                  </div>
                  <div class="mb-dates">
                    <span><i class="fas fa-calendar-day"></i> {{ fmtDate(b.checkIn) }}</span>
                    <i class="fas fa-arrow-right"></i>
                    <span>{{ fmtDate(b.checkOut) }}</span>
                    <span class="mb-pax"><i class="fas fa-users"></i> {{ b.pax }}</span>
                  </div>
                  <div class="mb-pills">
                    <span class="pay-pill" :class="b.paymentStatus === 'paid' ? 'paid' : 'unpaid'">{{ b.paymentStatus }}</span>
                    <span class="status-pill" :class="statusCls(b.status)">{{ statusLabel(b.status) }}</span>
                    <span class="mb-booked">Booked {{ fmtDateTime(b.createdAt) }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </template>
    </template>

    <!-- Toast -->
    <div v-if="toastMsg" class="toast" :class="toastType">{{ toastMsg }}</div>
  </div>
</template>

<style scoped>
.revenue-analytics { animation: fadeIn .5s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

.page-title { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 28px; flex-wrap: wrap; gap: 14px; }
.page-title h1 { font-family: 'Unbounded', sans-serif; font-size: clamp(28px, 5vw, 48px); font-weight: 800; color: var(--fg); letter-spacing: -0.04em; margin: 0; line-height: .95; }
.page-title h1 span { background: linear-gradient(135deg, var(--ac), var(--wn)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.page-title p { color: var(--mt); font-size: 13px; margin: 6px 0 0; }
.title-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.btn-secondary { padding: 10px 16px; background: var(--bg2); color: var(--fg2); border: 1px solid var(--bdr); border-radius: 11px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: all .3s; }
.btn-secondary:hover:not(:disabled) { background: var(--card2); transform: translateY(-2px); }
.btn-secondary:disabled { opacity: .5; cursor: not-allowed; }

/* Stat cards */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
.stat-card { background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; padding: 18px; display: flex; align-items: center; gap: 14px; }
.stat-icon { width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
.stat-info { flex: 1; min-width: 0; }
.stat-value { font-family: 'Unbounded', sans-serif; font-size: 18px; font-weight: 800; color: var(--fg); line-height: 1.1; word-break: break-all; }
.stat-label { font-size: 10px; color: var(--mt); text-transform: uppercase; letter-spacing: .5px; font-weight: 700; margin-top: 5px; }
.stat-sub { font-size: 10px; color: var(--mt); margin-top: 3px; }
.stat-sub.pos { color: var(--ok); font-weight: 700; }

/* Cards & charts */
.mb { margin-bottom: 20px; }
.charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.card { background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; overflow: hidden; }
.card-header { padding: 18px 20px; border-bottom: 1px solid var(--bdr); display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.card-header h3 { font-family: 'Unbounded', sans-serif; font-size: 14px; font-weight: 700; color: var(--fg); margin: 0; display: flex; align-items: center; gap: 7px; }
.card-header h3 i { font-size: 13px; }
.header-note { font-size: 11px; color: var(--mt); font-weight: 700; white-space: nowrap; }
.card-body { padding: 20px; }

.chart-box { position: relative; width: 100%; }
.chart-box.tall { height: 300px; }
.chart-box.mid { height: 240px; }
.chart-box.short { height: 240px; }

.donut-wrap { position: relative; width: 190px; height: 190px; margin: 0 auto 16px; }

.legend { display: flex; flex-direction: column; gap: 8px; }
.legend-item { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.legend-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.legend-label { flex: 1; color: var(--fg2); }
.legend-value { font-weight: 700; color: var(--fg); }

/* Tables */
.table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid var(--bdr); }
.table-wrap.flat { border: 1px solid var(--bdr); }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
thead { background: var(--bg2); }
th { padding: 10px 14px; text-align: left; font-family: 'Unbounded', sans-serif; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--mt); border-bottom: 1px solid var(--bdr); white-space: nowrap; }
td { padding: 10px 14px; border-bottom: 1px solid var(--bdr); color: var(--fg2); white-space: nowrap; }
tr:last-child td { border-bottom: none; }
.mono { font-family: monospace; letter-spacing: .3px; color: var(--fg); font-weight: 700; }
.num { font-weight: 700; color: var(--fg); }
.amount { font-weight: 700; color: var(--ok); }
.dim { color: var(--mt); font-size: 11px; }

/* ── Mobile booking cards (table replacement) ── */
.mb-list { display: none; flex-direction: column; gap: 10px; }
.mb-card { background: var(--bg2); border: 1px solid var(--bdr); border-radius: 12px; padding: 13px 14px; display: flex; flex-direction: column; gap: 8px; }
.mb-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.mb-top .mono { font-size: 11px; }
.mb-name { font-size: 13px; font-weight: 700; color: var(--fg); }
.mb-amount { font-family: 'Unbounded', sans-serif; font-size: 13px; font-weight: 800; color: var(--ok); white-space: nowrap; }
.mb-meta { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; font-size: 11px; color: var(--fg2); }
.mb-meta i, .mb-dates i { font-size: 9px; color: var(--ac); width: 13px; text-align: center; }
.mb-dates { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 11px; color: var(--fg2); background: var(--card); border: 1px solid var(--bdr); border-radius: 8px; padding: 7px 10px; }
.mb-pax { margin-left: auto; font-weight: 700; color: var(--fg); }
.mb-pills { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.mb-booked { font-size: 9.5px; color: var(--mt); margin-left: auto; }
.type-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
.type-badge.ent { background: var(--rose-dark, rgba(255,61,0,.15)); color: var(--rose, #F20707); }
.type-badge.stay { background: rgba(255,255,255,.06); color: var(--fg2); border: 1px solid var(--bdr); }

/* Ledger filters */
.ledger-filters { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.search-wrap { position: relative; flex: 1; min-width: 200px; }
.search-wrap i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--mt); font-size: 12px; }
.search-wrap input, .ledger-filters select { padding: 9px 13px; background: var(--bg2); border: 1px solid var(--bdr); border-radius: 10px; color: var(--fg); font-size: 12px; outline: none; transition: all .3s; }
.search-wrap input { width: 100%; padding-left: 38px; }
.ledger-filters select { min-width: 130px; }
.search-wrap input:focus, .ledger-filters select:focus { border-color: var(--ac); box-shadow: 0 0 0 3px var(--acs); }

/* ── Dropdown fix (same as BookingManager): render native popup dark ── */
.ledger-filters select {
  color-scheme: dark;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  padding-right: 34px;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 11px center;
}
.ledger-filters select option {
  background: var(--bg2, #161a24);
  color: var(--fg, #e5e7eb);
}
.ledger-filters select option:hover,
.ledger-filters select option:focus,
.ledger-filters select option:checked {
  background: var(--ac, #F20707);
  color: #ffffff;
}

/* Pills */
.status-pill { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; }
.st-pending { background: var(--wng); color: var(--wn); border: 1px solid var(--wn); }
.st-confirmed { background: var(--okg); color: var(--ok); border: 1px solid var(--ok); }
.st-completed { background: var(--tlg); color: var(--tl); border: 1px solid var(--tl); }
.st-rejected { background: var(--dgg); color: var(--dg); border: 1px solid var(--dg); }
.st-muted { background: var(--bg2); color: var(--mt); border: 1px solid var(--bdr); }
.pay-pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
.pay-pill.paid { background: var(--okg); color: var(--ok); }
.pay-pill.unpaid { background: var(--bg2); color: var(--mt); }

/* States */
.state-box { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 20px; color: var(--mt); text-align: center; }
.spinner { width: 34px; height: 34px; border: 3px solid var(--bdr); border-top-color: var(--ac); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.empty-state { text-align: center; padding: 60px 20px; color: var(--mt); margin-bottom: 20px; }
.empty-state i { font-size: 48px; margin-bottom: 16px; opacity: .3; }
.empty-state h3 { font-family: 'Unbounded', sans-serif; color: var(--fg); margin: 0 0 6px; }
.mini-empty { text-align: center; color: var(--mt); font-size: 12px; padding: 26px 10px; }

/* Toast */
.toast { position: fixed; bottom: 24px; right: 24px; z-index: 200; padding: 13px 20px; border-radius: 12px; font-size: 13px; font-weight: 700; color: #fff; box-shadow: 0 12px 32px rgba(0,0,0,.35); animation: slideUp .25s ease; max-width: 340px; }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.toast.ok { background: #B0D91E; }
.toast.err { background: #F20707; }

/* ═══ RESPONSIVE ═══ */
@media (max-width: 1200px) {
  .charts-grid { grid-template-columns: 1fr; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}

/* Tables → stacked cards; card headers wrap instead of overflowing */
@media (max-width: 768px) {
  .tbl-desktop { display: none; }
  .mb-list { display: flex; }
  .card-header { flex-wrap: wrap; }
  .header-note { white-space: normal; }
}

@media (max-width: 640px) {
  .title-actions { width: 100%; }
  .title-actions .btn-secondary { flex: 1; justify-content: center; padding: 10px 8px; }
  .card-body { padding: 14px; }
  /* Compact 2-up stat cards */
  .stats-grid { gap: 10px; }
  .stat-card { padding: 12px; gap: 10px; border-radius: 13px; }
  .stat-icon { width: 36px; height: 36px; border-radius: 10px; font-size: 14px; }
  .stat-value { font-size: 14px; }
  .stat-label { font-size: 8.5px; letter-spacing: .3px; }
  .stat-sub { font-size: 9px; }
  /* Slimmer charts + donut */
  .chart-box.tall { height: 230px; }
  .chart-box.mid, .chart-box.short { height: 200px; }
  .donut-wrap { width: 160px; height: 160px; }
  /* Filters go full width */
  .search-wrap { min-width: 0; }
  .ledger-filters select { width: 100%; min-width: 0; }
  /* Toast spans the screen */
  .toast { left: 16px; right: 16px; bottom: 16px; max-width: none; text-align: center; }
}

@media (max-width: 380px) {
  .stats-grid { grid-template-columns: 1fr; }
}
</style>