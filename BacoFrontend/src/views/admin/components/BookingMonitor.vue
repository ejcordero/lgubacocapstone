<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import Chart from 'chart.js/auto'
import { API } from '@/api'

const getToken = () => localStorage.getItem('baco_admin_token') || localStorage.getItem('admin_token') || localStorage.getItem('token')
const authHeaders = () => ({ 'Authorization': `Bearer ${getToken()}` })

const loading = ref(true)
const activeTab = ref('overview')
const dateFrom = ref('')
const dateTo = ref('')

const reportSummary = ref(null)
const hotelBookings = ref([])
const halconPermits = ref([])
const dashboardCounts = ref(null)
const userRegistrationTrend = ref([])
const citizenData = ref([])

// ==================== DARK-THEME CHART PALETTE ====================
const CHART = {
  grid: 'rgba(255, 255, 255, 0.06)',
  tick: 'var(--bdr2)',
  tickMuted: '#7c7c8f',
  legend: 'var(--bdr2)',
  tooltipBg: 'var(--fg)',
  tooltipBorder: 'var(--fg2)',
  tooltipTitle: 'var(--card2)',
  tooltipBody: 'var(--bdr2)',
  font: 'Inter',
  surface: 'var(--fg)'
}

// ==================== CHART REFS ====================
const permitStatusCanvas = ref(null)
const bookingStatusCanvas = ref(null)
const revenueCanvas = ref(null)
const monthlyCanvas = ref(null)
const userTrendCanvas = ref(null)

let charts = {}

// ==================== FETCH ====================
const fetchAllData = async () => {
  loading.value = true
  try {
    const [summaryRes, bookingsRes, permitsRes, statsRes, citizensRes] = await Promise.allSettled([
      fetch(`${API}/reports/summary`, { headers: authHeaders() }).then(r => r.json()),
      fetch(`${API}/hotels/admin/bookings`, { headers: authHeaders() }).then(r => r.json()),
      fetch(`${API}/halcon/admin/permits`, { headers: authHeaders() }).then(r => r.json()),
      fetch(`${API}/dashboard/stats`, { headers: authHeaders() }).then(r => r.json()),
      fetch(`${API}/admin/citizens`, { headers: authHeaders() }).then(r => r.json()),
    ])
    reportSummary.value = summaryRes.status === 'fulfilled' ? summaryRes.value : null
    hotelBookings.value = bookingsRes.status === 'fulfilled' ? bookingsRes.value : []
    halconPermits.value = permitsRes.status === 'fulfilled' ? permitsRes.value : []
    dashboardCounts.value = statsRes.status === 'fulfilled' ? statsRes.value : null
    if (citizensRes.status === 'fulfilled') {
      citizenData.value = citizensRes.value
      computeUserTrend(citizensRes.value)
    }
  } catch (err) {
    console.error('Reports fetch error:', err)
  } finally {
    loading.value = false
  }
}

const computeUserTrend = (citizens) => {
  if (!citizens || !citizens.length) {
    userRegistrationTrend.value = []
    return
  }
  const monthly = {}
  citizens.forEach(c => {
    if (!c.created_at) return
    const month = new Date(c.created_at).toISOString().slice(0, 7)
    monthly[month] = (monthly[month] || 0) + 1
  })
  userRegistrationTrend.value = Object.entries(monthly)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
}

// ==================== COMPUTED ====================
const totalHotelRevenue = computed(() => Number(reportSummary.value?.hotelRevenue?.confirmed_revenue) || 0)
const totalHalconRevenue = computed(() => Number(reportSummary.value?.halconRevenue?.paid_revenue) || 0)
const totalRevenue = computed(() => totalHotelRevenue.value + totalHalconRevenue.value)

const statCards = computed(() => [
  {
    label: 'Total Revenue', value: totalRevenue.value, icon: 'fa-coins', color: '#00e68a', bg: 'rgba(0,230,138,0.12)',
    sub: `Hotels â‚±${totalHotelRevenue.value.toLocaleString()} Â· Permits â‚±${totalHalconRevenue.value.toLocaleString()}`
  },
  {
    label: 'Hotel Bookings', value: Number(reportSummary.value?.hotelRevenue?.confirmed_count) || 0, icon: 'fa-bed', color: '#4d9fff', bg: 'rgba(77,159,255,0.12)',
    sub: `${Number(reportSummary.value?.hotelRevenue?.completed_count) || 0} completed Â· ${Number(reportSummary.value?.hotelRevenue?.cancelled_count) || 0} cancelled`
  },
  {
    label: 'Halcon Permits', value: Number(reportSummary.value?.halconRevenue?.approved_count) || 0, icon: 'fa-mountain', color: '#b388ff', bg: 'rgba(179,136,255,0.12)',
    sub: `${Number(reportSummary.value?.halconRevenue?.total_climbers) || 0} total climbers`
  },
  {
    label: 'Registered Citizens', value: dashboardCounts.value?.citizens || 0, icon: 'fa-users', color: '#00e5ff', bg: 'rgba(0,229,255,0.12)',
    sub: 'Across all services'
  },
  {
    label: 'Pending Permits', value: Number(reportSummary.value?.halconRevenue?.pending_count) || 0, icon: 'fa-clock', color: 'var(--wn)', bg: 'rgba(255,214,0,0.10)',
    sub: 'Awaiting review'
  },
  {
    label: 'Destinations', value: dashboardCounts.value?.destinations || 0, icon: 'fa-map-location-dot', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',
    sub: `${dashboardCounts.value?.news || 0} news articles Â· ${dashboardCounts.value?.healthServices || 0} health services`
  },
])

const monthlyData = computed(() => {
  const map = {}
  const hotels = reportSummary.value?.monthlyHotels || []
  const permits = reportSummary.value?.monthlyPermits || []
  hotels.forEach(m => {
    if (!map[m.month]) map[m.month] = { hotelBookings: 0, hotelRevenue: 0, halconPermits: 0, halconRevenue: 0 }
    map[m.month].hotelBookings = m.count
    map[m.month].hotelRevenue = Number(m.revenue) || 0
  })
  permits.forEach(m => {
    if (!map[m.month]) map[m.month] = { hotelBookings: 0, hotelRevenue: 0, halconPermits: 0, halconRevenue: 0 }
    map[m.month].halconPermits = m.count
    map[m.month].halconRevenue = Number(m.revenue) || 0
  })
  return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
})

const trailData = computed(() => (reportSummary.value?.trailStats) || [])
const maxTrailCount = computed(() => Math.max(...trailData.value.map(t => t.count), 1))
const roomData = computed(() => (reportSummary.value?.roomPopularity) || [])

const filteredBookings = computed(() => {
  let list = hotelBookings.value
  if (dateFrom.value) list = list.filter(b => b.created_at >= dateFrom.value)
  if (dateTo.value) list = list.filter(b => b.created_at <= dateTo.value + ' 23:59:59')
  return list
})
const filteredPermits = computed(() => {
  let list = halconPermits.value
  if (dateFrom.value) list = list.filter(p => p.created_at >= dateFrom.value)
  if (dateTo.value) list = list.filter(p => p.created_at <= dateTo.value + ' 23:59:59')
  return list
})

// ==================== HELPERS ====================
const fmt = (val) => 'â‚±' + Number(val || 0).toLocaleString()
const fmtMonth = (ym) => {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'
const fmtDateFull = (d) => d ? new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-'

const statusStyle = {
  confirmed: { bg: 'rgba(0,230,138,0.12)', color: '#00e68a', label: 'Confirmed' },
  completed: { bg: 'rgba(77,159,255,0.12)', color: '#4d9fff', label: 'Completed' },
  cancelled: { bg: 'rgba(255,59,92,0.12)', color: '#ff3b5c', label: 'Cancelled' },
  no_show:   { bg: 'rgba(255,255,255,0.06)', color: 'var(--bdr2)', label: 'No Show' },
  Pending:   { bg: 'rgba(255,214,0,0.10)', color: 'var(--wn)', label: 'Pending' },
  'Under Review': { bg: 'rgba(0,229,255,0.10)', color: '#00e5ff', label: 'Under Review' },
  Approved:  { bg: 'rgba(0,230,138,0.12)', color: '#00e68a', label: 'Approved' },
  Rejected:  { bg: 'rgba(255,59,92,0.12)', color: '#ff3b5c', label: 'Rejected' },
}

// ==================== CHART INITIALIZATION ====================
const destroyCharts = () => {
  Object.values(charts).forEach(chart => {
    if (chart) chart.destroy()
  })
  charts = {}
}

const initCharts = () => {
  destroyCharts()
  if (activeTab.value !== 'overview') return
  nextTick(() => {
    initPermitStatusChart()
    initBookingStatusChart()
    initRevenueChart()
    initMonthlyChart()
    initUserTrendChart()
  })
}

const initPermitStatusChart = () => {
  const canvas = permitStatusCanvas.value
  if (!canvas || !reportSummary.value?.halconRevenue) return
  const data = reportSummary.value.halconRevenue
  charts.permitStatus = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Approved', 'Pending', 'Rejected'],
      datasets: [{
        data: [
          Number(data.approved_count) || 0,
          Number(data.pending_count) || 0,
          Number(data.rejected_count) || 0
        ],
        backgroundColor: ['#00e68a', 'var(--wn)', '#ff3b5c'],
        borderColor: CHART.surface,
        borderWidth: 2,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: CHART.legend,
            padding: 16,
            usePointStyle: true,
            font: { size: 12, family: CHART.font }
          }
        },
        tooltip: {
          backgroundColor: CHART.tooltipBg,
          borderColor: CHART.tooltipBorder,
          borderWidth: 1,
          titleColor: CHART.tooltipTitle,
          bodyColor: CHART.tooltipBody,
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed} permits`
          }
        }
      }
    }
  })
}

const initBookingStatusChart = () => {
  const canvas = bookingStatusCanvas.value
  if (!canvas || !reportSummary.value?.hotelRevenue) return
  const data = reportSummary.value.hotelRevenue
  charts.bookingStatus = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Confirmed', 'Completed', 'Cancelled'],
      datasets: [{
        data: [
          Number(data.confirmed_count) || 0,
          Number(data.completed_count) || 0,
          Number(data.cancelled_count) || 0
        ],
        backgroundColor: ['#4d9fff', '#00e5ff', '#ff3b5c'],
        borderColor: CHART.surface,
        borderWidth: 2,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: CHART.legend,
            padding: 16,
            usePointStyle: true,
            font: { size: 12, family: CHART.font }
          }
        },
        tooltip: {
          backgroundColor: CHART.tooltipBg,
          borderColor: CHART.tooltipBorder,
          borderWidth: 1,
          titleColor: CHART.tooltipTitle,
          bodyColor: CHART.tooltipBody,
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed} bookings`
          }
        }
      }
    }
  })
}

const initRevenueChart = () => {
  const canvas = revenueCanvas.value
  if (!canvas) return
  charts.revenue = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Hotel Bookings', 'Halcon Permits'],
      datasets: [{
        label: 'Revenue (â‚±)',
        data: [totalHotelRevenue.value, totalHalconRevenue.value],
        backgroundColor: ['rgba(77, 159, 255, 0.85)', 'rgba(179, 136, 255, 0.85)'],
        borderColor: ['#4d9fff', '#b388ff'],
        borderWidth: 2,
        borderRadius: 8,
        barThickness: 60
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: CHART.tooltipBg,
          borderColor: CHART.tooltipBorder,
          borderWidth: 1,
          titleColor: CHART.tooltipTitle,
          bodyColor: CHART.tooltipBody,
          padding: 10,
          callbacks: {
            label: (ctx) => `â‚±${Number(ctx.parsed.y).toLocaleString()}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: CHART.tick,
            callback: (val) => 'â‚±' + (val / 1000).toFixed(0) + 'K',
            font: { size: 11, family: CHART.font }
          },
          grid: { color: CHART.grid }
        },
        x: {
          grid: { display: false },
          ticks: { color: CHART.tick, font: { size: 12, weight: '600', family: CHART.font } }
        }
      }
    }
  })
}

const initMonthlyChart = () => {
  const canvas = monthlyCanvas.value
  if (!canvas || monthlyData.value.length === 0) return
  const labels = monthlyData.value.map(([month]) => fmtMonth(month))
  const bookingData = monthlyData.value.map(([, v]) => v.hotelBookings)
  const revenueData = monthlyData.value.map(([, v]) => v.hotelRevenue)
  charts.monthlyBookings = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Bookings',
          data: bookingData,
          backgroundColor: 'rgba(77, 159, 255, 0.7)',
          borderColor: '#4d9fff',
          borderWidth: 1,
          yAxisID: 'y',
          borderRadius: 4,
          order: 2
        },
        {
          label: 'Revenue (â‚±)',
          data: revenueData,
          type: 'line',
          borderColor: 'var(--wn)',
          backgroundColor: 'rgba(255, 214, 0, 0.08)',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: 'var(--wn)',
          pointBorderColor: CHART.surface,
          fill: true,
          tension: 0.3,
          yAxisID: 'y1',
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: CHART.legend,
            padding: 16,
            usePointStyle: true,
            font: { size: 12, family: CHART.font }
          }
        },
        tooltip: {
          backgroundColor: CHART.tooltipBg,
          borderColor: CHART.tooltipBorder,
          borderWidth: 1,
          titleColor: CHART.tooltipTitle,
          bodyColor: CHART.tooltipBody,
          padding: 10
        }
      },
      scales: {
        y: {
          type: 'linear',
          position: 'left',
          beginAtZero: true,
          title: { display: true, text: 'Bookings', color: CHART.tickMuted, font: { size: 11, family: CHART.font } },
          grid: { color: CHART.grid },
          ticks: { color: CHART.tick, stepSize: 1, font: { size: 11, family: CHART.font } }
        },
        y1: {
          type: 'linear',
          position: 'right',
          beginAtZero: true,
          title: { display: true, text: 'Revenue (â‚±)', color: CHART.tickMuted, font: { size: 11, family: CHART.font } },
          grid: { drawOnChartArea: false },
          ticks: {
            color: CHART.tick,
            callback: (val) => 'â‚±' + (val / 1000).toFixed(0) + 'K',
            font: { size: 11, family: CHART.font }
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: CHART.tick, font: { size: 11, family: CHART.font } }
        }
      }
    }
  })
}

const initUserTrendChart = () => {
  const canvas = userTrendCanvas.value
  if (!canvas || userRegistrationTrend.value.length === 0) return
  const labels = userRegistrationTrend.value.map(([month]) => fmtMonth(month))
  const data = userRegistrationTrend.value.map(([, count]) => count)
  charts.userTrend = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'New Registrations',
        data,
        borderColor: '#00e5ff',
        backgroundColor: 'rgba(0, 229, 255, 0.1)',
        borderWidth: 2,
        pointRadius: 5,
        pointBackgroundColor: '#00e5ff',
        pointBorderColor: CHART.surface,
        pointBorderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: CHART.tooltipBg,
          borderColor: CHART.tooltipBorder,
          borderWidth: 1,
          titleColor: CHART.tooltipTitle,
          bodyColor: CHART.tooltipBody,
          padding: 10
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: CHART.tick, stepSize: 1, font: { size: 11, family: CHART.font } },
          grid: { color: CHART.grid }
        },
        x: {
          grid: { display: false },
          ticks: { color: CHART.tick, font: { size: 11, family: CHART.font } }
        }
      }
    }
  })
}

watch(activeTab, () => {
  if (!loading.value) initCharts()
})
watch(loading, (newVal) => {
  if (!newVal) nextTick(() => initCharts())
})

onBeforeUnmount(() => {
  destroyCharts()
})

// ==================== CSV EXPORT ====================
const downloadCSV = (rows, filename, columns) => {
  if (!rows.length) return alert('No data to export for the selected period.')
  const header = columns.map(c => `"${c.label}"`).join(',')
  const lines = rows.map(row => columns.map(c => {
    let v = row[c.key] ?? ''
    v = String(v).replace(/"/g, '""')
    return `"${v}"`
  }).join(','))
  const csv = [header, ...lines].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const exportBookings = () => downloadCSV(filteredBookings.value, 'hotel_bookings_report', [
  { key: 'booking_ref', label: 'Booking Ref' },
  { key: 'hotel_name', label: 'Hotel' },
  { key: 'room_type', label: 'Room Type' },
  { key: 'guest_name', label: 'Guest Name' },
  { key: 'guest_email', label: 'Email' },
  { key: 'guest_contact', label: 'Contact' },
  { key: 'check_in', label: 'Check-in' },
  { key: 'check_out', label: 'Check-out' },
  { key: 'nights', label: 'Nights' },
  { key: 'total_amount', label: 'Amount (â‚±)' },
  { key: 'status', label: 'Status' },
  { key: 'payment_status', label: 'Payment' },
  { key: 'created_at', label: 'Booked On' },
])

const exportPermits = () => downloadCSV(filteredPermits.value, 'halcon_permits_report', [
  { key: 'permit_id', label: 'Permit ID' },
  { key: 'applicant_name', label: 'Applicant' },
  { key: 'trek_date', label: 'Trek Date' },
  { key: 'duration', label: 'Duration' },
  { key: 'group_size', label: 'Group Size' },
  { key: 'trail', label: 'Trail' },
  { key: 'total_fee', label: 'Fee (â‚±)' },
  { key: 'payment_method', label: 'Payment' },
  { key: 'payment_status', label: 'Payment Status' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Applied On' },
])

const exportSummary = () => {
  const rows = [{
    metric: 'Total Hotel Revenue', value: totalHotelRevenue.value, source: 'Confirmed bookings'
  }, {
    metric: 'Total Halcon Revenue', value: totalHalconRevenue.value, source: 'Paid permits'
  }, {
    metric: 'Combined Revenue', value: totalRevenue.value, source: 'All sources'
  }, {
    metric: 'Confirmed Bookings', value: Number(reportSummary.value?.hotelRevenue?.confirmed_count) || 0, source: 'Hotel system'
  }, {
    metric: 'Approved Permits', value: Number(reportSummary.value?.halconRevenue?.approved_count) || 0, source: 'Halcon system'
  }, {
    metric: 'Total Climbers', value: Number(reportSummary.value?.halconRevenue?.total_climbers) || 0, source: 'Halcon permits'
  }, {
    metric: 'Registered Citizens', value: dashboardCounts.value?.citizens || 0, source: 'User system'
  }, {
    metric: 'Active Destinations', value: dashboardCounts.value?.destinations || 0, source: 'Tourism module'
  }]
  downloadCSV(rows, 'municipality_summary_report', [
    { key: 'metric', label: 'Metric' },
    { key: 'value', label: 'Value' },
    { key: 'source', label: 'Source' },
  ])
}

// ==================== PRINT FUNCTIONALITY ====================
const printReport = () => {
  if (activeTab.value === 'bookings') {
    printTable('Hotel Bookings Report', filteredBookings.value, [
      { key: 'booking_ref', label: 'Booking Ref' },
      { key: 'hotel_name', label: 'Hotel' },
      { key: 'room_type', label: 'Room Type' },
      { key: 'guest_name', label: 'Guest Name' },
      { key: 'guest_email', label: 'Email' },
      { key: 'guest_contact', label: 'Contact' },
      { key: 'check_in', label: 'Check-in' },
      { key: 'check_out', label: 'Check-out' },
      { key: 'nights', label: 'Nights' },
      { key: 'total_amount', label: 'Amount (â‚±)' },
      { key: 'status', label: 'Status' },
      { key: 'payment_status', label: 'Payment' },
      { key: 'created_at', label: 'Booked On' },
    ])
  } else if (activeTab.value === 'permits') {
    printTable('Halcon Permits Report', filteredPermits.value, [
      { key: 'permit_id', label: 'Permit ID' },
      { key: 'applicant_name', label: 'Applicant' },
      { key: 'trek_date', label: 'Trek Date' },
      { key: 'duration', label: 'Duration' },
      { key: 'group_size', label: 'Group Size' },
      { key: 'trail', label: 'Trail' },
      { key: 'total_fee', label: 'Fee (â‚±)' },
      { key: 'payment_method', label: 'Payment' },
      { key: 'payment_status', label: 'Payment Status' },
      { key: 'status', label: 'Status' },
      { key: 'created_at', label: 'Applied On' },
    ])
  } else {
    printOverviewReport()
  }
}

const printTable = (title, data, columns) => {
  if (!data.length) {
    alert('No data to print for the selected period.')
    return
  }
  const printWindow = window.open('', '_blank', 'width=900,height=700')
  const periodText = (dateFrom.value || dateTo.value)
    ? `Period: ${dateFrom.value || 'All'} to ${dateTo.value || 'All'}`
    : ''
  const totalText = title.includes('Hotel')
    ? `Total Revenue: ${fmt(data.reduce((s, b) => s + Number(b.total_amount), 0))}`
    : `Total Fee: ${fmt(data.reduce((s, p) => s + Number(p.total_fee), 0))}`

  const html = `
<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; padding: 24px; color: var(--fg); }
.header { margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 16px; }
h1 { font-size: 20px; color: var(--fg); margin-bottom: 4px; }
.subtitle { color: #64748b; font-size: 13px; margin-bottom: 8px; }
.period { color: #475569; font-size: 12px; font-style: italic; }
table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 16px; }
th, td { border: 1px solid var(--bdr); padding: 10px 12px; text-align: left; }
th { background: var(--card2); font-weight: 700; color: var(--fg2); text-transform: uppercase; letter-spacing: 0.5px; font-size: 10px; }
tr:nth-child(even) { background: var(--card-solid); }
.amount { text-align: right; font-family: monospace; }
.footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--bdr); display: flex; justify-content: space-between; font-size: 12px; color: #64748b; }
.total { font-weight: 700; color: var(--fg); }
@media print { body { padding: 12px; } }
</style>
</head>
<body>
<div class="header">
<h1>${title}</h1>
<div class="subtitle">Municipality of Baco, Oriental Mindoro</div>
<div class="period">${periodText}</div>
</div>
<table>
<thead>
<tr>${columns.map(c => `<th>${c.label}</th>`).join('')}</tr>
</thead>
<tbody>
${data.map(row => `<tr>${columns.map(c => {
const val = row[c.key] ?? ''
const isAmount = c.key.includes('amount') || c.key.includes('fee')
return `<td class="${isAmount ? 'amount' : ''}">${isAmount ? 'â‚±' + Number(val || 0).toLocaleString() : val}</td>`
}).join('')}</tr>`).join('')}
</tbody>
</table>
<div class="footer">
<span>Total records: ${data.length}</span>
<span class="total">${totalText}</span>
</div>
<script>window.onload = function() { window.print(); }<\/script>
</body>
</html>
`
  printWindow.document.write(html)
  printWindow.document.close()
}

const printOverviewReport = () => {
  const printWindow = window.open('', '_blank', 'width=1000,height=800')
  const periodText = (dateFrom.value || dateTo.value)
    ? `Period: ${dateFrom.value || 'All'} to ${dateTo.value || 'All'}`
    : 'All time'

  const hr = reportSummary.value?.hotelRevenue || {}
  const pr = reportSummary.value?.halconRevenue || {}
  const dc = dashboardCounts.value || {}

  const table = (title, head, rows) => `
<div class="section">
<h2>${title}</h2>
<table>
<thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead>
<tbody>${rows.map(r => `<tr>${r.map(c => `<td${typeof c === 'string' && c.startsWith('â‚±') ? ' class="amount"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody>
</table>
</div>`

  const summaryRows = [
    ['Total Hotel Revenue', fmt(hr.confirmed_revenue), 'Confirmed hotel bookings'],
    ['Total Halcon Revenue', fmt(pr.paid_revenue), 'Paid trekking permits'],
    ['Combined Revenue', fmt(totalRevenue.value), 'All sources'],
    ['Confirmed Hotel Bookings', Number(hr.confirmed_count) || 0],
    ['Completed / Cancelled Bookings', `${Number(hr.completed_count) || 0} / ${Number(hr.cancelled_count) || 0}`],
    ['Approved Halcon Permits', Number(pr.approved_count) || 0],
    ['Pending / Rejected Permits', `${Number(pr.pending_count) || 0} / ${Number(pr.rejected_count) || 0}`],
    ['Total Climbers', Number(pr.total_climbers) || 0],
    ['Registered Citizens', dc.citizens || 0],
    ['Active Destinations', dc.destinations || 0],
  ]

  const trendRows = userRegistrationTrend.value.length
    ? userRegistrationTrend.value.map(([m, c]) => [fmtMonth(m), c])
    : [['No data', '-']]

  const monthlyRows = monthlyData.value.length
    ? monthlyData.value.map(([m, d]) => [fmtMonth(m), Number(d.hotelBookings) || 0, fmt(d.hotelRevenue), Number(d.halconPermits) || 0, fmt(d.halconRevenue)])
    : [['No data', '-', '-', '-', '-']]

  const trailRows = trailData.value.length
    ? trailData.value.map(t => [t.trail, Number(t.count) || 0, Number(t.climbers) || 0, fmt(t.revenue)])
    : [['No data', '-', '-', '-']]

  const roomRows = roomData.value.length
    ? roomData.value.map(r => [`${r.hotel_name} Â· ${r.room_type}`, Number(r.bookings) || 0, fmt(r.revenue), (Number(r.avg_stay) || 0).toFixed(1) + ' nights'])
    : [['No data', '-', '-', '-']]

  const html = `
<!DOCTYPE html>
<html>
<head>
<title>Municipality Analytics Report</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; padding: 24px; color: var(--fg); }
.header { margin-bottom: 24px; border-bottom: 3px solid #2563eb; padding-bottom: 16px; }
h1 { font-size: 22px; color: var(--fg); margin-bottom: 4px; }
.subtitle { color: #64748b; font-size: 13px; }
.period { color: #475569; font-size: 12px; font-style: italic; margin-top: 6px; }
.generated { color: #94a3b8; font-size: 11px; margin-top: 8px; }
.section { margin-bottom: 28px; }
.section h2 { font-size: 14px; color: var(--fg); margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid var(--bdr); }
table { width: 100%; border-collapse: collapse; font-size: 11px; }
th, td { border: 1px solid var(--bdr); padding: 8px 10px; text-align: left; }
th { background: var(--card2); font-weight: 700; color: var(--fg2); text-transform: uppercase; letter-spacing: 0.4px; font-size: 9px; }
tr:nth-child(even) { background: var(--card-solid); }
.amount { text-align: right; font-family: monospace; }
.footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--bdr); text-align: center; font-size: 11px; color: #94a3b8; }
@media print { body { padding: 12px; } .section { page-break-inside: avoid; } }
</style>
</head>
<body>
<div class="header">
<h1>Municipality of Baco - Analytics Report</h1>
<div class="subtitle">Data-driven insights from municipal operations</div>
<div class="period">${periodText}</div>
<div class="generated">Generated: ${new Date().toLocaleString('en-PH', { dateStyle: 'full', timeStyle: 'short' })}</div>
</div>
${table('Executive Summary', ['Metric', 'Value'], summaryRows)}
${table('User Registration Trend', ['Month', 'New Citizens'], trendRows)}
${table('Monthly Bookings & Revenue', ['Month', 'Hotel Bookings', 'Hotel Revenue', 'Halcon Permits', 'Halcon Revenue'], monthlyRows)}
${table('Halcon Trail Popularity', ['Trail', 'Permits', 'Climbers', 'Revenue'], trailRows)}
${table('Room Popularity', ['Hotel / Room', 'Bookings', 'Revenue', 'Avg Stay'], roomRows)}
<div class="footer">
Municipality of Baco, Oriental Mindoro - Official Analytics Report
</div>
<script>window.onload = function() { window.print(); }<\/script>
</body>
</html>
`
  printWindow.document.write(html)
  printWindow.document.close()
}

const clearDates = () => { dateFrom.value = ''; dateTo.value = '' }

onMounted(() => fetchAllData())
</script>

<template>
  <div class="reports-page">
      <!-- HEADER -->
      <div class="page-header">
        <div class="header-left">
          <div class="header-eyebrow"><span class="eyebrow-dot"></span> Analytics</div>
          <h1 class="header-title">Reports & Analytics</h1>
          <p class="header-sub">Data-driven insights from municipal operations, tourism, and permit systems.</p>
        </div>
        <div class="header-actions">
          <button class="btn-export-header mat-skeuo-sm mat-pressable-sm" @click="exportSummary"><i class="fas fa-file-csv"></i> Export Summary</button>
          <button class="btn-print mat-skeuo-sm mat-pressable-sm" @click="printReport"><i class="fas fa-print"></i> Print Report</button>
        </div>
      </div>

      <!-- DATE FILTER -->
      <div class="date-bar">
        <div class="date-bar-label"><i class="fas fa-calendar-days"></i> Filter Period</div>
        <input type="date" v-model="dateFrom" class="date-input" />
        <span class="date-sep">to</span>
        <input type="date" v-model="dateTo" class="date-input" />
        <button v-if="dateFrom || dateTo" class="btn-clear mat-skeuo-sm mat-pressable-danger" @click="clearDates"><i class="fas fa-times"></i> Clear</button>
      </div>

      <!-- STAT CARDS -->
      <div class="stat-grid">
        <div v-for="s in statCards" :key="s.label" class="s-card">
          <div class="s-icon" :style="{ background: s.bg, color: s.color }"><i class="fas" :class="s.icon"></i></div>
          <div class="s-body">
            <div class="s-value">{{ typeof s.value === 'number' ? s.value.toLocaleString() : s.value }}</div>
            <div class="s-label">{{ s.label }}</div>
            <div class="s-sub">{{ s.sub }}</div>
          </div>
        </div>
      </div>

      <!-- TABS -->
      <div class="tab-bar mat-skeuo-sm mat-pressable-sm">
        <button class="tab mat-skeuo-sm mat-pressable-sm" :class="{ active: activeTab === 'overview' }" @click="activeTab = 'overview'">
          <i class="fas fa-chart-pie"></i> Overview
        </button>
        <button class="tab mat-skeuo-sm mat-pressable-sm" :class="{ active: activeTab === 'bookings' }" @click="activeTab = 'bookings'">
          <i class="fas fa-bed"></i> Hotel Bookings
        </button>
        <button class="tab mat-skeuo-sm mat-pressable-sm" :class="{ active: activeTab === 'permits' }" @click="activeTab = 'permits'">
          <i class="fas fa-mountain"></i> Halcon Permits
        </button>
      </div>

      <!-- ==================== OVERVIEW TAB ==================== -->
      <div v-if="activeTab === 'overview'" class="tab-content mat-skeuo-sm mat-pressable-sm">
        <div class="charts-row">
          <div class="chart-card">
            <div class="chart-card-head"><i class="fas fa-coins"></i> Revenue by Source</div>
            <div class="chart-container" style="height: 250px;">
              <canvas ref="revenueCanvas"></canvas>
            </div>
          </div>
          <div class="chart-card">
            <div class="chart-card-head"><i class="fas fa-user-plus"></i> User Registration Trend</div>
            <div class="chart-container" style="height: 250px;">
              <canvas ref="userTrendCanvas"></canvas>
              <div v-if="userRegistrationTrend.length === 0" class="chart-empty">
                <i class="fas fa-chart-line"></i>
                <span>No registration data available</span>
              </div>
            </div>
          </div>
        </div>

        <div class="charts-row">
          <div class="chart-card">
            <div class="chart-card-head"><i class="fas fa-mountain"></i> Permit Status</div>
            <div class="chart-container" style="height: 280px;">
              <canvas ref="permitStatusCanvas"></canvas>
            </div>
          </div>
          <div class="chart-card">
            <div class="chart-card-head"><i class="fas fa-bed"></i> Booking Status</div>
            <div class="chart-container" style="height: 280px;">
              <canvas ref="bookingStatusCanvas"></canvas>
            </div>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-card-head"><i class="fas fa-chart-bar"></i> Monthly Bookings & Revenue Trend</div>
          <div class="chart-container" style="height: 300px;">
            <canvas ref="monthlyCanvas"></canvas>
            <div v-if="monthlyData.length === 0" class="chart-empty">
              <i class="fas fa-chart-bar"></i>
              <span>No monthly data available</span>
            </div>
          </div>
        </div>

        <div class="two-col">
          <div class="card">
            <div class="card-head"><i class="fas fa-route"></i> Halcon Trail Popularity</div>
            <div class="trail-list">
              <div v-for="t in trailData" :key="t.trail" class="trail-item">
                <div class="trail-info">
                  <div class="trail-name">{{ t.trail }}</div>
                  <div class="trail-meta">{{ t.count }} permits Â· {{ t.climbers }} climbers Â· {{ fmt(t.revenue) }}</div>
                </div>
                <div class="trail-bar-track"><div class="trail-bar-fill" :style="{ width: (t.count / maxTrailCount * 100) + '%' }"></div></div>
              </div>
              <div v-if="trailData.length === 0" class="empty-chart">No permit data.</div>
            </div>
          </div>

          <div class="card" v-if="roomData.length > 0">
            <div class="card-head"><i class="fas fa-door-open"></i> Top Rooms by Bookings</div>
            <div class="room-list">
              <div v-for="(r, i) in roomData" :key="i" class="room-item">
                <div class="room-rank">{{ i + 1 }}</div>
                <div class="room-info">
                  <div class="room-name">{{ r.room_type }}</div>
                  <div class="room-hotel">{{ r.hotel_name }}</div>
                </div>
                <div class="room-stats">
                  <div class="room-stat-val">{{ r.bookings }} <small>bookings</small></div>
                  <div class="room-stat-val">{{ fmt(r.revenue) }}</div>
                </div>
                <div class="room-bar-track"><div class="room-bar-fill" :style="{ width: (r.bookings / (roomData[0]?.bookings || 1) * 100) + '%' }"></div></div>
              </div>
            </div>
          </div>
          <div v-else class="card">
            <div class="card-head"><i class="fas fa-door-open"></i> Top Rooms by Bookings</div>
            <div class="empty-chart">No room data.</div>
          </div>
        </div>
      </div>

      <!-- ==================== BOOKINGS TAB ==================== -->
      <div v-else-if="activeTab === 'bookings'" class="tab-content mat-skeuo-sm mat-pressable-sm">
        <div class="table-card">
          <div class="table-top">
            <div class="table-title"><i class="fas fa-bed"></i> Hotel Booking Records</div>
            <button class="btn-export mat-skeuo-sm mat-pressable-sm" @click="exportBookings"><i class="fas fa-file-csv"></i> Export CSV</button>
          </div>
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Ref</th><th>Hotel</th><th>Room</th><th>Guest</th><th>Check-in</th><th>Check-out</th><th>Nights</th><th>Amount</th><th>Status</th><th>Payment</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="b in filteredBookings" :key="b.id">
                  <td class="mono">{{ b.booking_ref }}</td>
                  <td>{{ b.hotel_name }}</td>
                  <td>{{ b.room_type }}</td>
                  <td>
                    <div>{{ b.guest_name }}</div>
                    <div class="sub-text">{{ b.guest_email }}</div>
                  </td>
                  <td class="date-cell">{{ fmtDate(b.check_in) }}</td>
                  <td class="date-cell">{{ fmtDate(b.check_out) }}</td>
                  <td class="center">{{ b.nights }}</td>
                  <td class="mono amount">{{ fmt(b.total_amount) }}</td>
                  <td><span class="st-badge mat-well" :style="{ background: (statusStyle[b.status] || statusStyle.confirmed).bg, color: (statusStyle[b.status] || statusStyle.confirmed).color }">{{ (statusStyle[b.status] || statusStyle.confirmed).label }}</span></td>
                  <td><span class="pay-badge" :class="b.payment_status === 'paid' ? 'pay-paid' : 'pay-unpaid'">{{ b.payment_status }}</span></td>
                </tr>
                <tr v-if="filteredBookings.length === 0">
                  <td colspan="10" class="empty-cell">No hotel bookings in selected period.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="table-footer">
            <span>{{ filteredBookings.length }} records</span>
            <span>Total: <strong>{{ fmt(filteredBookings.reduce((s, b) => s + Number(b.total_amount), 0)) }}</strong></span>
          </div>
        </div>
      </div>

      <!-- ==================== PERMITS TAB ==================== -->
      <div v-else-if="activeTab === 'permits'" class="tab-content mat-skeuo-sm mat-pressable-sm">
        <div class="table-card">
          <div class="table-top">
            <div class="table-title"><i class="fas fa-mountain"></i> Halcon Permit Records</div>
            <button class="btn-export mat-skeuo-sm mat-pressable-sm" @click="exportPermits"><i class="fas fa-file-csv"></i> Export CSV</button>
          </div>
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Permit ID</th><th>Applicant</th><th>Trek Date</th><th>Duration</th><th>Group</th><th>Trail</th><th>Fee</th><th>Payment</th><th>Status</th><th>Applied</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in filteredPermits" :key="p.id">
                  <td class="mono">{{ p.permit_id }}</td>
                  <td>{{ p.applicant_name || 'Unknown' }}</td>
                  <td class="date-cell">{{ fmtDate(p.trek_date) }}</td>
                  <td>{{ p.duration }}</td>
                  <td class="center">{{ p.group_size }}</td>
                  <td>{{ p.trail }}</td>
                  <td class="mono amount">{{ fmt(p.total_fee) }}</td>
                  <td><span class="pay-badge" :class="p.payment_status === 'paid' ? 'pay-paid' : 'pay-unpaid'">{{ p.payment_status }}</span></td>
                  <td><span class="st-badge mat-well" :style="{ background: (statusStyle[p.status] || statusStyle.Pending).bg, color: (statusStyle[p.status] || statusStyle.Pending).color }">{{ (statusStyle[p.status] || statusStyle.Pending).label }}</span></td>
                  <td class="date-cell">{{ fmtDateFull(p.created_at) }}</td>
                </tr>
                <tr v-if="filteredPermits.length === 0">
                  <td colspan="10" class="empty-cell">No halcon permits in selected period.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="table-footer">
            <span>{{ filteredPermits.length }} records</span>
            <span>Total: <strong>{{ fmt(filteredPermits.reduce((s, p) => s + Number(p.total_fee), 0)) }}</strong> Â· {{ Number(reportSummary.value?.halconRevenue?.total_climbers) || 0 }} climbers</span>
          </div>
        </div>
      </div>
  </div>
</template>

<style scoped>
*,*::before,*::after{box-sizing:border-box}
.reports-page{font-family:var(--font-body);background:var(--bg);min-height:100%;padding:32px;display:flex;flex-direction:column;gap:24px;overflow-y:auto}
.reports-page::-webkit-scrollbar{width:5px}
.reports-page::-webkit-scrollbar-track{background:transparent}
.reports-page::-webkit-scrollbar-thumb{background:var(--bdr2);border-radius:3px}
.page-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
.header-eyebrow{display:flex;align-items:center;gap:7px;font-size:0.65rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:var(--ac);margin-bottom:6px}
.eyebrow-dot{width:6px;height:6px;border-radius:50%;background:var(--ac)}
.header-title{font-family:var(--font-display);font-size:1.75rem;font-weight:800;color:var(--fg);margin:0 0 4px}
.header-sub{font-size:0.8rem;color:var(--mt);margin:0}
.header-actions{display:flex;gap:10px}
.btn-print{ display:flex; align-items:center; gap:8px; padding:10px 18px; border-radius:var(--r-sm); font-family:var(--font-body); font-size:0.8rem; font-weight:600; cursor:pointer; }.btn-print:hover{background:var(--card3);border-color:var(--ac);transform:translateY(-2px)}
.btn-export-header{ display:flex; align-items:center; gap:8px; padding:10px 18px; border-radius:var(--r-sm); font-family:var(--font-body); font-size:0.8rem; font-weight:700; cursor:pointer; }
.btn-export-header:hover{transform:translateY(-2px);box-shadow:0 6px 20px var(--acg)}
.date-bar{display:flex;align-items:center;gap:12px;background:var(--card-solid);padding:14px 20px;border-radius:var(--r-md);box-shadow:var(--shadow-sm);flex-wrap:wrap;border:1px solid var(--bdr)}
.date-bar-label{display:flex;align-items:center;gap:8px;font-size:0.78rem;font-weight:600;color:var(--fg2)}
.date-bar-label i{color:var(--ac)}
.date-input{padding:8px 12px;border:1.5px solid var(--bdr);border-radius:var(--r-sm);font-family:var(--font-body);font-size:0.82rem;color:var(--fg);background:var(--bg2)}
.date-input:focus{outline:none;border-color:var(--ac)}
.date-sep{color:var(--mt2);font-size:0.82rem}
.btn-clear{ display:flex; align-items:center; gap:6px; padding:8px 14px; border-radius:var(--r-sm); font-family:var(--font-body); font-size:0.78rem; cursor:pointer; }
.btn-clear:hover{background:var(--dgs);border-color:var(--dg);color:var(--dg)}
.stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.s-card{background:var(--card-solid);border-radius:var(--r-md);padding:20px;display:flex;align-items:flex-start;gap:14px;box-shadow:var(--shadow-sm);transition:all 0.2s var(--ease);border:1px solid var(--bdr)}
.s-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-md);border-color:var(--bdr2)}
.s-icon{width:44px;height:44px;border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0}
.s-value{font-size:1.4rem;font-weight:800;color:var(--fg);line-height:1}
.s-label{font-size:0.72rem;color:var(--fg2);font-weight:500;margin-top:2px}
.s-sub{font-size:0.68rem;color:var(--mt);margin-top:4px;line-height:1.4}
.tab-bar{ display:flex; gap:4px; padding:6px; border-radius:var(--r-md); }
.tab{ flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:11px 16px; border-radius:var(--r-sm); font-family:var(--font-body); font-size:0.82rem; font-weight:600; cursor:pointer; }
.tab:hover{background:var(--bg2);color:var(--fg)}
.tab.active{background:linear-gradient(135deg,var(--m-accent-hi),var(--m-accent-solid));color:#fff;box-shadow:0 4px 12px var(--acg)}
.tab-content{ display:flex; flex-direction:column; gap:20px; }
.charts-row{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.chart-card{background:var(--card-solid);border-radius:var(--r-md);box-shadow:var(--shadow-sm);overflow:hidden;border:1px solid var(--bdr)}
.chart-card-head{padding:16px 20px;font-size:0.82rem;font-weight:700;color:var(--fg);border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:8px}
.chart-card-head i{color:var(--ac);font-size:0.85rem}
.chart-container{padding:16px 20px;position:relative}
.chart-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--mt);gap:8px}
.chart-empty i{font-size:2rem;opacity:0.4}
.chart-empty span{font-size:0.82rem}
.card{background:var(--card-solid);border-radius:var(--r-md);box-shadow:var(--shadow-sm);overflow:hidden;border:1px solid var(--bdr)}
.card-head{padding:16px 20px;font-size:0.82rem;font-weight:700;color:var(--fg);border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:8px}
.card-head i{color:var(--ac);font-size:0.85rem}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.trail-list{padding:8px 20px 16px;display:flex;flex-direction:column;gap:10px}
.trail-item{display:flex;align-items:center;gap:12px}
.trail-info{flex:1;min-width:0}
.trail-name{font-size:0.82rem;font-weight:600;color:var(--fg)}
.trail-meta{font-size:0.68rem;color:var(--mt)}
.trail-bar-track{width:120px;height:8px;background:var(--bg3);border-radius:4px;overflow:hidden;flex-shrink:0}
.trail-bar-fill{height:100%;background:linear-gradient(to right,var(--vi),#d4b8ff);border-radius:4px;transition:width 0.6s ease}
.empty-chart{padding:24px;text-align:center;color:var(--mt);font-size:0.8rem}
.room-list{padding:8px 20px 16px;display:flex;flex-direction:column;gap:8px}
.room-item{display:flex;align-items:center;gap:12px}
.room-rank{width:28px;height:28px;border-radius:var(--r-sm);background:var(--bg3);color:var(--fg2);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;flex-shrink:0}
.room-info{flex:1;min-width:0}
.room-name{font-size:0.82rem;font-weight:600;color:var(--fg)}
.room-hotel{font-size:0.68rem;color:var(--mt)}
.room-stats{display:flex;gap:14px;flex-shrink:0}
.room-stat-val{font-family:var(--font-mono);font-size:0.72rem;font-weight:600;color:var(--fg);text-align:right;white-space:nowrap}
.room-stat-val small{font-family:var(--font-body);font-weight:400;color:var(--mt)}
.room-bar-track{width:100px;height:8px;background:var(--bg3);border-radius:4px;overflow:hidden;flex-shrink:0}
.room-bar-fill{height:100%;background:linear-gradient(to right,#4d9fff,#8fc2ff);border-radius:4px;transition:width 0.6s ease}
.btn-export{ display:flex; align-items:center; gap:8px; padding:10px 18px; border-radius:var(--r-sm); font-family:var(--font-body); font-size:0.78rem; font-weight:700; cursor:pointer; }
.btn-export:hover{transform:translateY(-2px);box-shadow:0 6px 20px var(--acg)}
.table-card{background:var(--card-solid);border-radius:var(--r-md);box-shadow:var(--shadow-sm);overflow:hidden;border:1px solid var(--bdr)}
.table-top{padding:14px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--bdr)}
.table-title{display:flex;align-items:center;gap:8px;font-size:0.82rem;font-weight:700;color:var(--fg)}
.table-title i{color:var(--ac)}
.table-scroll{overflow-x:auto;max-height:60vh}
.data-table{width:100%;border-collapse:collapse}
.data-table thead tr{background:var(--bg3);border-bottom:2px solid var(--bdr);position:sticky;top:0;z-index:2}
.data-table th{padding:10px 14px;text-align:left;font-size:0.62rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--mt);white-space:nowrap}
.data-table td{padding:11px 14px;font-size:0.8rem;color:var(--fg2);border-bottom:1px solid var(--bdr);white-space:nowrap;vertical-align:middle}
.data-table tr:hover td{background:var(--card2)}
.mono{font-family:var(--font-mono);font-size:0.78rem}
.amount{font-family:var(--font-mono);font-weight:600;color:var(--fg)}
.center{text-align:center}
.date-cell{font-size:0.78rem;color:var(--fg2)}
.sub-text{font-size:0.68rem;color:var(--mt)}
.st-badge,.pay-badge{display:inline-block;padding:3px 10px;border-radius:var(--r-sm);font-size:0.68rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase}
.pay-paid{background:var(--oks);color:var(--ok)}
.pay-unpaid{background:var(--wns);color:var(--wn)}
.empty-cell{text-align:center;padding:48px 20px!important;color:var(--mt);font-size:0.84rem}
.table-footer{padding:12px 20px;border-top:1px solid var(--bdr);display:flex;justify-content:space-between;font-size:0.75rem;color:var(--mt)}
.table-footer strong{color:var(--fg)}
@media (max-width:1100px){.stat-grid{grid-template-columns:repeat(2,1fr)}}
@media (max-width:768px){
.reports-page{padding:20px 16px}
.stat-grid{grid-template-columns:1fr}
.charts-row{grid-template-columns:1fr}
.two-col{grid-template-columns:1fr}
.trail-bar-track{width:80px}
.room-bar-track{width:60px}
.room-stats{flex-direction:column;gap:4px}
.header-actions{flex-direction:column;width:100%}
.header-actions button{width:100%;justify-content:center}
}

</style>