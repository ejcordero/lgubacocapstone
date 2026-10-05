<script setup>
import { ref, computed } from 'vue'

defineProps({
  title: { type: String, default: 'BPLO Online' }
})

const searchQuery    = ref('')
const selectedFilter = ref('all')
const selectedStatus = ref('all')
const mobileMenuOpen = ref(false)

const bploConfig = {
  subtitle: 'Streamlined business permit processing for the Municipality of Baco, Oriental Mindoro.',
  requirements: [
    'Barangay Business Clearance',
    'DTI / SEC / CDA Registration',
    'Community Tax Certificate',
    'Sanitary Permit (from MHO)',
    'Fire Safety Inspection Certificate',
  ],
}

const menuItems = [
  { label: 'Permit Records',       active: true  },
  { label: 'Apply for New Business', active: false },
  { label: 'Renew Business Permit', active: false },
  { label: 'Retire Business',       active: false },
  { label: 'Downloadable Forms',    active: false },
]

const businessPermits = ref([
  { id: 1, businessName: 'Baco Fresh Market',       owner: 'Juan dela Cruz',  type: 'Retail',         status: 'Approved', dateApplied: '2024-01-15', expirationDate: '2025-01-14', permitNumber: 'BPLO-2024-001' },
  { id: 2, businessName: 'Baco Tourist Inn',        owner: 'Maria Santos',    type: 'Accommodation',  status: 'Pending',  dateApplied: '2024-01-20', expirationDate: '2025-01-19', permitNumber: 'BPLO-2024-002' },
  { id: 3, businessName: 'Baco Food Corner',        owner: 'Pedro Reyes',     type: 'Food Service',   status: 'Approved', dateApplied: '2024-01-10', expirationDate: '2025-01-09', permitNumber: 'BPLO-2024-003' },
  { id: 4, businessName: 'Baco Transport Services', owner: 'Antonio Lim',     type: 'Transportation', status: 'Rejected', dateApplied: '2024-01-18', expirationDate: '2025-01-17', permitNumber: 'BPLO-2024-004' },
  { id: 5, businessName: 'Baco Souvenir Shop',      owner: 'Linda Garcia',    type: 'Retail',         status: 'Approved', dateApplied: '2024-01-12', expirationDate: '2025-01-11', permitNumber: 'BPLO-2024-005' },
  { id: 6, businessName: 'Baco Hardware Store',     owner: 'Roberto Cruz',    type: 'Retail',         status: 'Pending',  dateApplied: '2024-02-01', expirationDate: '2025-01-31', permitNumber: 'BPLO-2024-006' },
])

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''

const filteredPermits = computed(() =>
  businessPermits.value.filter(p => {
    const q = searchQuery.value.toLowerCase()
    const matchQ = !q || p.businessName.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q) || p.permitNumber.toLowerCase().includes(q)
    const matchT = selectedFilter.value === 'all' || p.type === selectedFilter.value
    const matchS = selectedStatus.value === 'all' || p.status === selectedStatus.value
    return matchQ && matchT && matchS
  })
)

const statusClass = (s) => ({ Approved: 'tag-green', Pending: 'tag-amber', Rejected: 'tag-red' }[s] || 'tag-gray')
const statusIcon  = (s) => ({ Approved: 'fa-circle-check', Pending: 'fa-clock', Rejected: 'fa-circle-xmark' }[s] || 'fa-circle')

const stats = computed(() => ({
  total:    businessPermits.value.length,
  approved: businessPermits.value.filter(p => p.status === 'Approved').length,
  pending:  businessPermits.value.filter(p => p.status === 'Pending').length,
  rejected: businessPermits.value.filter(p => p.status === 'Rejected').length,
}))
</script>

<template>
  <div class="bplo-page">

    <!-- ── HERO ── -->
    <section class="bplo-hero">
      <div class="hero-bg"></div>
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <div class="hero-eyebrow">
          <span class="eyebrow-line"></span>
          Online Services
        </div>
        <h1 class="hero-title">BPLO Online<span class="period">.</span></h1>
        <p class="hero-sub">{{ bploConfig.subtitle }}</p>
        <div class="hero-stats">
          <div class="hstat"><span class="hstat-num">{{ stats.total }}</span><span class="hstat-lbl">Total Permits</span></div>
          <div class="hstat-div"></div>
          <div class="hstat"><span class="hstat-num" style="color:#4ade80">{{ stats.approved }}</span><span class="hstat-lbl">Approved</span></div>
          <div class="hstat-div"></div>
          <div class="hstat"><span class="hstat-num" style="color:#fbbf24">{{ stats.pending }}</span><span class="hstat-lbl">Pending</span></div>
          <div class="hstat-div"></div>
          <div class="hstat"><span class="hstat-num" style="color:#f87171">{{ stats.rejected }}</span><span class="hstat-lbl">Rejected</span></div>
        </div>
      </div>
    </section>

    <!-- ── BREADCRUMB ── -->
    <div class="breadcrumb-strip">
      <div class="bc-inner">
        <a href="/">Home</a><i class="fas fa-chevron-right"></i>
        <a href="/services">e-Services</a><i class="fas fa-chevron-right"></i>
        <span>BPLO Online</span>
      </div>
      <div class="bc-actions">
        <a href="#" class="bc-btn"><i class="fas fa-download"></i> Download Form</a>
        <a href="#" class="bc-btn primary"><i class="fas fa-arrow-right-to-bracket"></i> Apply Online</a>
      </div>
    </div>

    <!-- ── BODY ── -->
    <div class="page-body">
      <div class="body-inner">

        <!-- ── MOBILE SIDEBAR TOGGLE ── -->
        <button class="mobile-sidebar-toggle" @click="mobileMenuOpen = !mobileMenuOpen">
          <i class="fas" :class="mobileMenuOpen ? 'fa-times' : 'fa-bars'"></i>
          <span>{{ mobileMenuOpen ? 'Close Menu' : 'BPLO Services Menu' }}</span>
          <i class="fas fa-chevron-down toggle-arr" :class="{ open: mobileMenuOpen }"></i>
        </button>

        <!-- ── SIDEBAR ── -->
        <aside class="bplo-sidebar" :class="{ 'mobile-open': mobileMenuOpen }">

          <!-- Nav -->
          <div class="sidebar-card">
            <div class="card-head"><i class="fas fa-cogs"></i><span>BPLO Services</span></div>
            <ul class="side-nav">
              <li v-for="item in menuItems" :key="item.label" :class="{ active: item.active }">
                <i class="fas fa-angle-right"></i>
                {{ item.label }}
              </li>
            </ul>
          </div>

          <!-- Requirements -->
          <div class="sidebar-card">
            <div class="card-head req-head"><i class="fas fa-list-check"></i><span>Key Requirements</span></div>
            <ul class="req-list">
              <li v-for="req in bploConfig.requirements" :key="req">
                <i class="fas fa-circle-check"></i>
                <span>{{ req }}</span>
              </li>
            </ul>
          </div>

          <!-- Office hours -->
          <div class="hours-card">
            <div class="hours-icon"><i class="fas fa-building-columns"></i></div>
            <h3>BPLO Office Hours</h3>
            <div class="hours-list">
              <div class="hours-row"><span>Monday – Friday</span><strong>8:00 AM – 5:00 PM</strong></div>
              <div class="hours-row"><span>Saturday</span><strong>8:00 AM – 12:00 PM</strong></div>
              <div class="hours-row closed"><span>Sunday</span><strong>Closed</strong></div>
            </div>
            <div class="hours-hotline"><i class="fas fa-phone"></i> +63 912 345 6789</div>
          </div>

        </aside>

        <!-- ── MAIN ── -->
        <main class="bplo-main">

          <!-- Section head -->
          <div class="section-head">
            <div>
              <div class="sh-eyebrow">Business Permits & Licensing</div>
              <h2>Permit Records Directory</h2>
              <p>Official record of business permits processed by the Municipality of Baco.</p>
            </div>
          </div>

          <!-- Stats strip -->
          <div class="stats-strip">
            <div class="stat-box"><div class="stat-num">{{ stats.total }}</div><div class="stat-lbl">Total Permits</div></div>
            <div class="stat-box green"><div class="stat-num">{{ stats.approved }}</div><div class="stat-lbl">Approved</div></div>
            <div class="stat-box amber"><div class="stat-num">{{ stats.pending }}</div><div class="stat-lbl">Pending</div></div>
            <div class="stat-box red"><div class="stat-num">{{ stats.rejected }}</div><div class="stat-lbl">Rejected</div></div>
          </div>

          <!-- Filters -->
          <div class="filters-bar">
            <div class="search-wrap">
              <i class="fas fa-search"></i>
              <input v-model="searchQuery" type="text" placeholder="Search by name, owner, or permit number..." class="search-input" />
            </div>
            <div class="filter-selects">
              <select v-model="selectedFilter" class="f-select">
                <option value="all">All Types</option>
                <option value="Retail">Retail</option>
                <option value="Accommodation">Accommodation</option>
                <option value="Food Service">Food Service</option>
                <option value="Transportation">Transportation</option>
              </select>
              <select v-model="selectedStatus" class="f-select">
                <option value="all">All Status</option>
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          <!-- ── DESKTOP TABLE ── -->
          <div class="data-panel desktop-only">
            <div class="panel-head">
              <span class="panel-title"><i class="fas fa-table"></i> Permits Directory</span>
              <span class="panel-count">{{ filteredPermits.length }} record{{ filteredPermits.length !== 1 ? 's' : '' }}</span>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Permit No.</th>
                  <th>Business / Owner</th>
                  <th>Type</th>
                  <th>Date Applied</th>
                  <th>Expiration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in filteredPermits" :key="p.id" class="data-row">
                  <td class="td-permit">{{ p.permitNumber }}</td>
                  <td>
                    <div class="biz-name">{{ p.businessName }}</div>
                    <div class="biz-owner">{{ p.owner }}</div>
                  </td>
                  <td class="td-type">{{ p.type }}</td>
                  <td class="td-date">{{ formatDate(p.dateApplied) }}</td>
                  <td class="td-date">{{ formatDate(p.expirationDate) }}</td>
                  <td>
                    <span class="status-tag" :class="statusClass(p.status)">
                      <i class="fas" :class="statusIcon(p.status)"></i>
                      {{ p.status }}
                    </span>
                  </td>
                </tr>
                <tr v-if="filteredPermits.length === 0">
                  <td colspan="6" class="empty-row">
                    <i class="fas fa-magnifying-glass"></i>
                    <p>No permits found matching your criteria.</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- ── MOBILE CARDS ── -->
          <div class="mobile-cards mobile-only">
            <div class="panel-head">
              <span class="panel-title"><i class="fas fa-id-card"></i> Permits Directory</span>
              <span class="panel-count">{{ filteredPermits.length }} record{{ filteredPermits.length !== 1 ? 's' : '' }}</span>
            </div>
            <div v-for="p in filteredPermits" :key="p.id" class="permit-card">
              <div class="pc-top">
                <div class="pc-permit">{{ p.permitNumber }}</div>
                <span class="status-tag" :class="statusClass(p.status)">
                  <i class="fas" :class="statusIcon(p.status)"></i>
                  {{ p.status }}
                </span>
              </div>
              <div class="pc-name">{{ p.businessName }}</div>
              <div class="pc-owner"><i class="fas fa-user"></i> {{ p.owner }}</div>
              <div class="pc-meta">
                <span><i class="fas fa-tag"></i> {{ p.type }}</span>
                <span><i class="fas fa-calendar-plus"></i> {{ formatDate(p.dateApplied) }}</span>
                <span><i class="fas fa-calendar-xmark"></i> {{ formatDate(p.expirationDate) }}</span>
              </div>
            </div>
            <div v-if="filteredPermits.length === 0" class="empty-row">
              <i class="fas fa-magnifying-glass"></i>
              <p>No permits found.</p>
            </div>
          </div>

          <!-- Action buttons -->
          <div class="action-row">
            <a href="#" class="act-btn outline"><i class="fas fa-download"></i> Download Application Form</a>
            <a href="#" class="act-btn primary"><i class="fas fa-arrow-right-to-bracket"></i> Submit Online (e-BPLO)</a>
          </div>

        </main>
      </div>
    </div>

  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@300;400;500;600;700&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.bplo-page { font-family: 'Inter', sans-serif; background: #f5f6f8; color: #0f1923; min-height: 100vh; }

/* ══ HERO ══ */
.bplo-hero { position: relative; height: 400px; overflow: hidden; background: #0b1d35; }
.hero-bg { position: absolute; inset: 0; background: url('/images/hero-imgs.jpg') center/cover no-repeat; opacity: 0.22; filter: grayscale(40%); }
.hero-overlay { position: absolute; inset: 0; background: linear-gradient(135deg, rgba(11,29,53,0.97) 0%, rgba(11,29,53,0.78) 55%, rgba(192,57,43,0.22) 100%); }
.hero-content { position: relative; z-index: 2; height: 100%; max-width: 1240px; margin: 0 auto; padding: 0 24px; display: flex; flex-direction: column; justify-content: center; }
.hero-eyebrow { display: flex; align-items: center; gap: 10px; font-size: 0.66rem; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(255,255,255,0.45); margin-bottom: 12px; }
.eyebrow-line { width: 28px; height: 2px; background: #c0392b; border-radius: 1px; flex-shrink: 0; }
.hero-title { font-family: 'Playfair Display', serif; font-size: clamp(2.4rem, 6vw, 4.2rem); font-weight: 700; color: white; line-height: 1; margin-bottom: 12px; }
.period { color: #c9a84c; }
.hero-sub { font-size: 0.92rem; color: rgba(255,255,255,0.55); line-height: 1.7; max-width: 500px; font-weight: 300; margin-bottom: 28px; }
.hero-stats { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.hstat { display: flex; flex-direction: column; }
.hstat-num { font-family: 'Playfair Display', serif; font-size: 1.5rem; font-weight: 700; color: white; line-height: 1; }
.hstat-lbl { font-size: 0.62rem; color: rgba(255,255,255,0.42); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 2px; }
.hstat-div { width: 1px; height: 32px; background: rgba(255,255,255,0.15); }

/* ══ BREADCRUMB ══ */
.breadcrumb-strip { background: white; border-bottom: 1px solid #dde2ea; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.bc-inner { display: flex; align-items: center; gap: 8px; font-size: 0.77rem; color: #8896a7; flex-wrap: wrap; }
.bc-inner a { color: #0b1d35; text-decoration: none; font-weight: 500; padding: 11px 0; display: inline-block; transition: color 0.2s; }
.bc-inner a:hover { color: #c0392b; }
.bc-inner i { font-size: 0.56rem; }
.bc-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.bc-btn { display: inline-flex; align-items: center; gap: 6px; padding: 11px 14px; background: white; border: 1px solid #dde2ea; border-radius: 3px; font-size: 0.76rem; font-weight: 600; color: #0b1d35; cursor: pointer; text-decoration: none; font-family: 'Inter', sans-serif; transition: background 0.18s; white-space: nowrap; }
.bc-btn:hover { background: #f5f6f8; }
.bc-btn.primary { background: #c0392b; color: white; border-color: #c0392b; }
.bc-btn.primary:hover { background: #a93226; }
.bc-btn i { font-size: 0.7rem; }

/* ══ PAGE BODY ══ */
.page-body { padding: 32px 24px 64px; }
.body-inner { max-width: 1240px; margin: 0 auto; display: grid; grid-template-columns: 268px 1fr; gap: 24px; align-items: start; }

/* ══ MOBILE SIDEBAR TOGGLE — hidden on desktop ══ */
.mobile-sidebar-toggle { display: none; }

/* ══ SIDEBAR ══ */
.bplo-sidebar { display: flex; flex-direction: column; gap: 18px; position: sticky; top: 120px; }
.sidebar-card { background: white; border-radius: 3px; overflow: hidden; border-top: 3px solid #0b1d35; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
.card-head { background: #0b1d35; padding: 12px 16px; display: flex; align-items: center; gap: 9px; font-size: 0.73rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.88); }
.card-head i { color: rgba(255,255,255,0.5); font-size: 0.78rem; }
.req-head { background: #c9a84c; }
.req-head i { color: rgba(255,255,255,0.7); }

.side-nav { list-style: none; }
.side-nav li { display: flex; align-items: center; gap: 9px; padding: 11px 16px; font-size: 0.83rem; color: #4a5568; border-bottom: 1px solid #f0f2f5; cursor: pointer; border-left: 3px solid transparent; transition: all 0.18s; }
.side-nav li:last-child { border-bottom: none; }
.side-nav li i { color: #dde2ea; font-size: 0.7rem; }
.side-nav li:hover { background: #f5f6f8; color: #0b1d35; border-left-color: #dde2ea; }
.side-nav li.active { background: #0b1d35; color: white; font-weight: 600; border-left-color: #c0392b; }
.side-nav li.active i { color: #c9a84c; }

.req-list { list-style: none; padding: 4px 0; }
.req-list li { display: flex; align-items: flex-start; gap: 10px; padding: 10px 16px; border-bottom: 1px solid #f0f2f5; font-size: 0.82rem; color: #4a5568; line-height: 1.55; }
.req-list li:last-child { border-bottom: none; }
.req-list li i { color: #15803d; font-size: 0.78rem; margin-top: 2px; flex-shrink: 0; }

.hours-card { background: #0b1d35; border-radius: 3px; padding: 20px 18px; box-shadow: 0 1px 6px rgba(0,0,0,0.12); }
.hours-icon { width: 40px; height: 40px; background: rgba(201,168,76,0.15); border: 1px solid rgba(201,168,76,0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #c9a84c; font-size: 1rem; margin-bottom: 12px; }
.hours-card h3 { font-family: 'Playfair Display', serif; font-size: 0.95rem; font-weight: 700; color: white; margin-bottom: 14px; }
.hours-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.hours-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; color: rgba(255,255,255,0.55); }
.hours-row strong { color: white; font-weight: 600; }
.hours-row.closed strong { color: rgba(255,255,255,0.35); }
.hours-hotline { display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: #c9a84c; font-weight: 600; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); }

/* ══ MAIN ══ */
.bplo-main { display: flex; flex-direction: column; gap: 20px; }
.section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.sh-eyebrow { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #c0392b; margin-bottom: 5px; }
.section-head h2 { font-family: 'Playfair Display', serif; font-size: 1.7rem; font-weight: 700; color: #0b1d35; margin-bottom: 5px; }
.section-head p { font-size: 0.83rem; color: #4a5568; }

/* Stats strip */
.stats-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.stat-box { background: white; border-radius: 3px; padding: 16px; border-top: 3px solid #dde2ea; box-shadow: 0 1px 4px rgba(0,0,0,0.05); text-align: center; }
.stat-box.green { border-top-color: #15803d; }
.stat-box.amber { border-top-color: #d97706; }
.stat-box.red   { border-top-color: #c0392b; }
.stat-num { font-family: 'Playfair Display', serif; font-size: 1.8rem; font-weight: 700; color: #0b1d35; line-height: 1; margin-bottom: 4px; }
.stat-box.green .stat-num { color: #15803d; }
.stat-box.amber .stat-num { color: #d97706; }
.stat-box.red   .stat-num { color: #c0392b; }
.stat-lbl { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #8896a7; }

/* Filters */
.filters-bar { background: white; border: 1px solid #dde2ea; border-radius: 3px; padding: 14px 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
.search-wrap { position: relative; flex: 1; min-width: 200px; }
.search-wrap i { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); color: #8896a7; font-size: 0.78rem; }
.search-input { width: 100%; padding: 9px 12px 9px 32px; border: 1px solid #dde2ea; border-radius: 3px; font-size: 0.83rem; font-family: 'Inter', sans-serif; color: #0f1923; transition: border-color 0.2s; }
.search-input:focus { outline: none; border-color: #0b1d35; }
.filter-selects { display: flex; gap: 10px; flex-wrap: wrap; }
.f-select { padding: 9px 12px; border: 1px solid #dde2ea; border-radius: 3px; font-size: 0.83rem; font-family: 'Inter', sans-serif; color: #0f1923; background: white; cursor: pointer; min-width: 140px; }
.f-select:focus { outline: none; border-color: #0b1d35; }

/* ══ DATA PANEL — desktop table ══ */
.data-panel { background: white; border-radius: 3px; overflow: hidden; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
.panel-head { background: #0b1d35; padding: 13px 18px; display: flex; align-items: center; justify-content: space-between; }
.panel-title { display: flex; align-items: center; gap: 8px; font-size: 0.73rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: white; }
.panel-title i { color: #c9a84c; }
.panel-count { font-size: 0.7rem; color: rgba(255,255,255,0.45); }

.data-table { width: 100%; border-collapse: collapse; }
.data-table thead tr { background: #f5f6f8; border-bottom: 2px solid #dde2ea; }
.data-table th { padding: 10px 16px; text-align: left; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #4a5568; white-space: nowrap; }
.data-row { border-bottom: 1px solid #f0f2f5; transition: background 0.14s; }
.data-row:last-child { border-bottom: none; }
.data-row:hover { background: #fafbfc; }
.data-table td { padding: 14px 16px; font-size: 0.84rem; color: #4a5568; vertical-align: middle; }
.td-permit { font-family: monospace; font-size: 0.78rem; font-weight: 700; color: #0b1d35; white-space: nowrap; }
.biz-name { font-size: 0.88rem; font-weight: 700; color: #0b1d35; }
.biz-owner { font-size: 0.76rem; color: #8896a7; margin-top: 2px; }
.td-type { white-space: nowrap; }
.td-date { white-space: nowrap; font-size: 0.78rem; color: #8896a7; }

.empty-row { text-align: center; padding: 48px 20px !important; color: #8896a7; }
.empty-row i { font-size: 1.6rem; display: block; margin-bottom: 10px; opacity: 0.4; }
.empty-row p { font-size: 0.85rem; }

/* Status tags */
.status-tag { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 2px; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
.tag-green  { background: #dcfce7; color: #15803d; }
.tag-amber  { background: #fef9c3; color: #92400e; }
.tag-red    { background: #fee2e2; color: #b91c1c; }
.tag-gray   { background: #f1f5f9; color: #475569; }
.status-tag i { font-size: 0.66rem; }

/* ══ MOBILE CARDS ══ */
.mobile-cards { background: white; border-radius: 3px; overflow: hidden; box-shadow: 0 1px 6px rgba(0,0,0,0.06); }
.permit-card { padding: 16px; border-bottom: 1px solid #f0f2f5; }
.permit-card:last-child { border-bottom: none; }
.pc-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.pc-permit { font-family: monospace; font-size: 0.76rem; font-weight: 700; color: #4a5568; }
.pc-name { font-size: 0.92rem; font-weight: 700; color: #0b1d35; margin-bottom: 4px; }
.pc-owner { font-size: 0.78rem; color: #8896a7; margin-bottom: 10px; }
.pc-owner i { margin-right: 5px; font-size: 0.7rem; }
.pc-meta { display: flex; flex-wrap: wrap; gap: 10px; }
.pc-meta span { font-size: 0.75rem; color: #8896a7; display: flex; align-items: center; gap: 5px; }
.pc-meta i { color: #0b1d35; font-size: 0.68rem; }

/* Show/hide based on screen */
.desktop-only { display: block; }
.mobile-only  { display: none; }

/* Action row */
.action-row { display: flex; gap: 12px; flex-wrap: wrap; }
.act-btn { display: inline-flex; align-items: center; gap: 7px; padding: 11px 22px; border-radius: 3px; font-size: 0.82rem; font-weight: 700; cursor: pointer; text-decoration: none; font-family: 'Inter', sans-serif; transition: background 0.18s, transform 0.1s; white-space: nowrap; }
.act-btn:hover { transform: translateY(-1px); }
.act-btn.outline { background: white; color: #0b1d35; border: 1.5px solid #0b1d35; }
.act-btn.outline:hover { background: #f5f6f8; }
.act-btn.primary { background: #c0392b; color: white; border: 1.5px solid #c0392b; }
.act-btn.primary:hover { background: #a93226; }
.act-btn i { font-size: 0.78rem; }

/* ══════════════════════════════════
   RESPONSIVE
══════════════════════════════════ */

/* Tablet: 900px–1024px */
@media (max-width: 1024px) {
  .body-inner { grid-template-columns: 240px 1fr; gap: 18px; }
  .stats-strip { grid-template-columns: repeat(2, 1fr); }
}

/* Mobile: ≤900px — sidebar collapses into toggle */
@media (max-width: 900px) {
  .body-inner {
    grid-template-columns: 1fr;
    /* sidebar comes first in DOM but we visually move it below toggle */
  }

  /* Show the mobile toggle button */
  .mobile-sidebar-toggle {
    display: flex; align-items: center; gap: 10px;
    width: 100%; padding: 12px 16px;
    background: #0b1d35; color: white;
    border: none; border-radius: 3px;
    font-size: 0.82rem; font-weight: 600;
    font-family: 'Inter', sans-serif;
    cursor: pointer; margin-bottom: 4px;
    /* Manually order it before sidebar in visual layout */
    order: -1;
  }
  .mobile-sidebar-toggle i:first-child { font-size: 0.9rem; color: #c9a84c; }
  .mobile-sidebar-toggle span { flex: 1; text-align: left; }
  .toggle-arr { font-size: 0.68rem; color: rgba(255,255,255,0.5); transition: transform 0.25s; }
  .toggle-arr.open { transform: rotate(180deg); }

  /* Sidebar hidden by default on mobile */
  .bplo-sidebar {
    position: static;
    overflow: hidden;
    max-height: 0;
    opacity: 0;
    transition: max-height 0.35s ease, opacity 0.25s ease;
    margin-bottom: 0;
    pointer-events: none;
  }
  .bplo-sidebar.mobile-open {
    max-height: 2000px;
    opacity: 1;
    pointer-events: all;
    margin-bottom: 8px;
  }

  /* Re-order the grid items */
  .mobile-sidebar-toggle { order: 1; }
  .bplo-sidebar           { order: 2; }
  .bplo-main              { order: 3; }

  .stats-strip { grid-template-columns: repeat(2, 1fr); }
}

/* Small mobile: ≤600px */
@media (max-width: 600px) {
  .bplo-hero { height: 360px; }
  .hero-content { padding: 0 16px; }
  .hero-stats { gap: 12px; }
  .hstat-div { height: 24px; }

  .breadcrumb-strip { padding: 10px 16px; flex-direction: column; align-items: flex-start; }
  .bc-actions { width: 100%; }
  .bc-btn { flex: 1; justify-content: center; }

  .page-body { padding: 20px 16px 48px; }

  .stats-strip { grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .stat-num { font-size: 1.4rem; }

  .filters-bar { flex-direction: column; align-items: stretch; }
  .search-wrap { min-width: unset; }
  .filter-selects { flex-direction: column; }
  .f-select { min-width: unset; width: 100%; }

  /* Switch to card view on mobile */
  .desktop-only { display: none; }
  .mobile-only  { display: block; }

  .action-row { flex-direction: column; }
  .act-btn { width: 100%; justify-content: center; }

  .section-head h2 { font-size: 1.4rem; }
}

/* Very small: ≤400px */
@media (max-width: 400px) {
  .bplo-hero { height: 320px; }
  .hero-title { font-size: 2rem; }
  .hero-stats { flex-wrap: wrap; gap: 10px; }
  .hstat-div { display: none; }
  .stats-strip { grid-template-columns: repeat(2, 1fr); }
}
</style>