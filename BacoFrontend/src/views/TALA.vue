<script setup>
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import axios from 'axios'
import Lenis from 'lenis'
import { animate, inView, stagger } from '@motionone/dom'
import * as pdfjsLib from 'pdfjs-dist'
// pdfjs-dist v4.x — if you're on v3.x use: 'pdfjs-dist/build/pdf.worker.min.js?url'
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { API } from '../api'

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfjsWorker

function debounce(func, wait) {
  let timeout
  return function(...args) {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), wait)
  }
}

// motion-one throws "No valid element provided" when a selector matches
// nothing (e.g. hero markup absent/renamed) — this guard keeps the page alive
// and lets the rest of onMounted (data fetching) proceed.
const safeAnimate = (target, keyframes, options) => {
  if (typeof target === 'string' && !document.querySelector(target)) return
  try { return animate(target, keyframes, options) } catch { /* element vanished */ }
}

// ── DATA ──
const reports         = ref([])
const filteredReports = ref([])
const searchQuery     = ref('')
const filters         = ref({ dateRange: 'all', status: 'all', type: 'all' })
const currentPage     = ref(1)
const reportsPerPage  = 10
const totalReports    = ref(0)
const isLoading       = ref(false)
const fetchError      = ref(null)
const activeTab       = ref('Project Reports')

// ── VIEWER ──
const isViewerOpen = ref(false)
const activeReport = ref(null)
const isLoadingPdf = ref(true)
const pdfError      = ref(false)
const pdfErrorMsg   = ref('')
let pdfTimeout      = null

// ── PDF.JS STATE ──
const pdfCanvasWrap   = ref(null)
let renderSession     = 0
let activePdfTask     = null
let pageRenderTasks   = []
let lastRenderedWidth = 0

// ── VERSION HISTORY ──
const versionsList = ref([])
const isLoadingVersions = ref(false)
const viewingVersion = ref(null)
const showHistoryPanel = ref(false)

const fetchVersions = async (projectId) => {
  isLoadingVersions.value = true
  try {
    const res = await axios.get(`${API}/tala/projects/${projectId}/versions`)
    versionsList.value = res.data
  } catch (e) {
    console.error('Failed to fetch versions:', e)
  } finally {
    isLoadingVersions.value = false
  }
}

const toggleHistoryPanel = () => {
  showHistoryPanel.value = !showHistoryPanel.value
}

const switchVersion = (version) => {
  viewDocument(version)
}

// ── SCANNER ──
const isScannerOver    = ref(false)
const scanModalOpen    = ref(false)
const scanDoc          = ref(null)
const scanState        = ref('idle')
const scanResult       = ref(null)
const scanProgress     = ref(0)
const scanStepIndex    = ref(0)
const scanInterval     = ref(null)
const isDraggingDoc    = ref(false)
let scanAbortController = null

const scanSteps = [
  'Computing document hash',
  'Querying blockchain network',
  'Matching chain record',
  'Finalizing verification'
]

// ── DRAG FROM ROW ──
const onRowDragStart = (e, rpt) => {
  isDraggingDoc.value = true
  e.dataTransfer.effectAllowed = 'copy'
  e.dataTransfer.setData('docId', rpt.id)
  scanDoc.value = {
    id:    rpt.id,
    title: rpt.title,
    dept:  rpt.dept || 'Municipal Office',
    date:  rpt.date,
    type:  rpt.formUrl ? rpt.formUrl.split('.').pop().toLowerCase() : 'pdf'
  }
}
const onRowDragEnd = () => { isDraggingDoc.value = false }

// ── DROP ON SCANNER WIDGET ──
const onScannerDragOver = (e) => { e.preventDefault(); isScannerOver.value = true }
const onScannerDragLeave = () => { isScannerOver.value = false }
const onScannerDrop = (e) => {
  e.preventDefault()
  isScannerOver.value = false
  isDraggingDoc.value = false
  if (scanDoc.value) openScanModal(scanDoc.value)
}

// ── OPEN SCAN MODAL ──
const openScanModal = (doc) => {
  scanDoc.value    = doc
  scanState.value  = 'scanning'
  scanResult.value = null
  scanProgress.value   = 0
  scanStepIndex.value  = 0
  scanModalOpen.value  = true
  startScanProgress()
}

const startScanProgress = async () => {
  clearInterval(scanInterval.value)
  scanAbortController = new AbortController()
  const { signal } = scanAbortController

  scanInterval.value = setInterval(() => {
    if (scanProgress.value < 85) {
      scanProgress.value += Math.random() * 4 + 1.5
      scanStepIndex.value = Math.min(Math.floor(scanProgress.value / 25), 3)
    }
  }, 100)

  try {
    const docId = scanDoc.value?.id
    if (!docId) throw new Error('No document ID')

    const res = await axios.get(`${API}/tala/validate/${docId}`, { signal })
    const data = res.data

    clearInterval(scanInterval.value)
    scanProgress.value = 90
    scanStepIndex.value = 3
    await new Promise(r => setTimeout(r, 250))

    scanProgress.value = 100
    scanStepIndex.value = 4
    await new Promise(r => setTimeout(r, 350))

    scanState.value = 'result'
    scanResult.value = {
      verified: data.valid,
      hash: data.hash || '—',
      blockNumber: data.blockNumber != null ? data.blockNumber.toLocaleString() : '—',
      timestamp: data.blockTimestamp ? new Date(data.blockTimestamp).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—',
      checks: [
        { label: 'Document hash',    ok: data.checks?.hashIntegrity ?? false },
        { label: 'Timestamp anchor', ok: data.checks?.chainLinkage  ?? false },
        { label: 'Chain of custody', ok: data.checks?.recordFound   ?? false },
        { label: 'Polygon anchor',   ok: data.checks?.polygonVerified ?? false, isPolygon: true },
      ],
      polygonTxHash: data.polygon?.txHash || null,
      polygonExplorerUrl: data.polygon?.explorerUrl || null,
      ipfsCid: data.ipfsCid || null,
      ipfsUrl: data.ipfsUrl || null
    }
  } catch (err) {
    if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return
    clearInterval(scanInterval.value)
    scanProgress.value = 100
    scanStepIndex.value = 4
    await new Promise(r => setTimeout(r, 300))
    scanState.value = 'result'
    scanResult.value = { verified: false, hash: '—', blockNumber: '—', timestamp: '—', checks: [ { label: 'Document hash', ok: false }, { label: 'Timestamp anchor', ok: false }, { label: 'Chain of custody', ok: false } ] }
  }
}

const closeScanModal = () => {
  scanAbortController?.abort()
  scanAbortController = null
  scanModalOpen.value = false
  clearInterval(scanInterval.value)
  setTimeout(() => { scanState.value = 'idle'; scanResult.value = null; scanProgress.value = 0; scanStepIndex.value = 0 }, 300)
}

// ── VERIFICATION ──
const verification = ref({
  hashStatus: 'Click verify to check document hash',
  timestampStatus: 'Click verify to check timestamp',
  polygonStatus: 'Click verify to check Polygon anchor',
  hashIconClass: '', timestampIconClass: '', polygonIconClass: '',
  hashIcon: 'fa-question', timestampIcon: 'fa-question', polygonIcon: 'fa-question',
  showHash: false, blockHash: '',
  showPolygon: false, polygonTxHash: '', polygonExplorerUrl: '',
  showIpfs: false, ipfsCid: '', ipfsUrl: ''
})

// ── LENIS + MOTION ──
let lenis = null

// ═══════════════════════════════════════════
// PDF.JS RENDERING — no toolbar, canvas-based
// ═══════════════════════════════════════════
const cancelPdfRender = () => {
  renderSession++
  pageRenderTasks.forEach(t => { try { t.cancel() } catch {} })
  pageRenderTasks = []
  if (activePdfTask) {
    try { activePdfTask.destroy() } catch {}
    activePdfTask = null
  }
  if (pdfCanvasWrap.value) pdfCanvasWrap.value.innerHTML = ''
}

const renderPdf = async (url) => {
  const session = ++renderSession

  // tear down anything in-flight from a previous render
  pageRenderTasks.forEach(t => { try { t.cancel() } catch {} })
  pageRenderTasks = []
  if (activePdfTask) { try { activePdfTask.destroy() } catch {} activePdfTask = null }
  const container = pdfCanvasWrap.value
  if (container) container.innerHTML = ''

  try {
    const task = pdfjsLib.getDocument({ url })
    activePdfTask = task
    const pdf = await task.promise
    if (session !== renderSession) return

    await nextTick()
    const wrap = pdfCanvasWrap.value
    if (!wrap) return
    const availW = Math.max(wrap.clientWidth - 48, 320)
    lastRenderedWidth = wrap.clientWidth
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    for (let n = 1; n <= pdf.numPages; n++) {
      if (session !== renderSession) return
      const page = await pdf.getPage(n)
      if (session !== renderSession) return

      const base = page.getViewport({ scale: 1 })
      const scale = availW / base.width
      const viewport = page.getViewport({ scale: scale * dpr })

      const canvas = document.createElement('canvas')
      canvas.className = 'pdf-page-canvas'
      canvas.width  = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      wrap.appendChild(canvas)

      const ctx = canvas.getContext('2d')
      const rt = page.render({ canvasContext: ctx, viewport })
      pageRenderTasks.push(rt)
      await rt.promise

      // reveal content as soon as page 1 is ready — the user can
      // start reading/scrolling while remaining pages render in
      if (n === 1) {
        clearTimeout(pdfTimeout)
        isLoadingPdf.value = false
      }
    }
  } catch (err) {
    if (err?.name === 'RenderingCancelledException' || session !== renderSession) return
    console.error('PDF.js render error:', err)
    isLoadingPdf.value = false
    pdfError.value = true
    pdfErrorMsg.value = 'The document could not be rendered.'
  }
}

const loadPdf = (url) => {
  clearTimeout(pdfTimeout)
  if (!url) {
    isLoadingPdf.value = false
    pdfError.value = true
    pdfErrorMsg.value = 'No file is available for this document.'
    cancelPdfRender()
    return
  }
  isLoadingPdf.value = true
  pdfError.value = false
  pdfErrorMsg.value = ''
  pdfTimeout = setTimeout(() => {
    if (isLoadingPdf.value && !pdfError.value) {
      cancelPdfRender()
      isLoadingPdf.value = false
      pdfError.value = true
      pdfErrorMsg.value = 'Document took too long to load.'
    }
  }, 20000)
  renderPdf(url)
}

// re-fit pages when the window (and thus page width) changes
const onWindowResize = debounce(() => {
  if (!isViewerOpen.value || pdfError.value) return
  if (!viewingVersion.value?.formUrl) return
  const w = pdfCanvasWrap.value?.clientWidth
  if (w && Math.abs(w - lastRenderedWidth) > 40) {
    loadPdf(viewingVersion.value.formUrl)
  }
}, 300)

// ── LIFECYCLE ──
onMounted(async () => {
  lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, wheelMultiplier: 0.9 })
  const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf) }
  requestAnimationFrame(raf)

  watch([isViewerOpen, scanModalOpen], (vals) => {
    vals.some(Boolean) ? lenis.stop() : lenis.start()
  })

  window.addEventListener('resize', onWindowResize)

  // Hero animations — guarded so a missing/renamed element can't crash the mount
  safeAnimate('.hero-eyebrow',  { opacity: [0, 1], transform: ['translateY(24px)', 'translateY(0px)'] }, { duration: 0.7, delay: 0.1, easing: [0.16, 1, 0.3, 1] })
  safeAnimate('.hero-title',    { opacity: [0, 1], transform: ['translateY(32px)', 'translateY(0px)'] }, { duration: 0.8, delay: 0.22, easing: [0.16, 1, 0.3, 1] })
  safeAnimate('.hero-sub',      { opacity: [0, 1], transform: ['translateY(20px)', 'translateY(0px)'] }, { duration: 0.7, delay: 0.34, easing: [0.16, 1, 0.3, 1] })
  safeAnimate('.hero-badges',   { opacity: [0, 1], transform: ['translateY(16px)', 'translateY(0px)'] }, { duration: 0.6, delay: 0.44, easing: [0.16, 1, 0.3, 1] })
  safeAnimate('.hero-stats',    { opacity: [0, 1], transform: ['translateY(16px)', 'translateY(0px)'] }, { duration: 0.6, delay: 0.54, easing: [0.16, 1, 0.3, 1] })
  safeAnimate('.hero-scroll',   { opacity: [0, 1] }, { duration: 0.6, delay: 0.8, easing: 'ease' })

  inView('.tala-sidebar .sidebar-card', ({ target }) => {
    animate(target, { opacity: [0, 1], transform: ['translateX(-28px)', 'translateX(0px)'] }, { duration: 0.6, easing: [0.16, 1, 0.3, 1] })
  }, { margin: '-60px' })
  inView('.scanner-card', ({ target }) => {
    animate(target, { opacity: [0, 1], transform: ['translateX(-28px)', 'translateX(0px)'] }, { duration: 0.6, delay: 0.08, easing: [0.16, 1, 0.3, 1] })
  }, { margin: '-60px' })
  inView('.section-head', ({ target }) => {
    animate(target, { opacity: [0, 1], transform: ['translateY(24px)', 'translateY(0px)'] }, { duration: 0.6, easing: [0.16, 1, 0.3, 1] })
  }, { margin: '-40px' })

  watch(isLoading, async (loading) => {
    if (!loading) {
      await nextTick()
      const rows = document.querySelectorAll('.data-row')
      if (rows.length) {
        animate(rows, { opacity: [0, 1], transform: ['translateX(-12px)', 'translateX(0px)'] }, { duration: 0.38, delay: stagger(0.045), easing: [0.16, 1, 0.3, 1] })
      }
    }
  })

  fetchProjects()
})

watch(isViewerOpen, (isOpen) => {
  if (isOpen) {
    window.addEventListener('keydown', handleGlobalKeydown)
    document.addEventListener('contextmenu', disableContextMenu)
  } else {
    window.removeEventListener('keydown', handleGlobalKeydown)
    document.removeEventListener('contextmenu', disableContextMenu)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  document.removeEventListener('contextmenu', disableContextMenu)
  window.removeEventListener('resize', onWindowResize)
  clearInterval(scanInterval.value)
  scanAbortController?.abort()
  clearTimeout(pdfTimeout)
  cancelPdfRender()
  lenis?.destroy()
})

// ── FETCH ──
const fetchProjects = async () => {
  isLoading.value  = true
  fetchError.value = null
  try {
    const params = new URLSearchParams()
    if (activeTab.value && activeTab.value !== 'all') {
      params.append('type', activeTab.value)
    }
    const res = await axios.get(`${API}/tala/projects?${params.toString()}`)
    reports.value         = res.data
    filteredReports.value = res.data
    totalReports.value    = res.data.length
    currentPage.value     = 1
  } catch (e) {
    fetchError.value = e.code === 'ERR_NETWORK' ? 'Cannot connect to the server.' : `Error: ${e.message}`
  } finally {
    isLoading.value = false
  }
}

// ── FILTERS ──
const applyFilters = debounce(() => {
  let f = reports.value
  if (searchQuery.value)
    f = f.filter(r => r.title.toLowerCase().includes(searchQuery.value.toLowerCase()) || (r.details || r.description || '').toLowerCase().includes(searchQuery.value.toLowerCase()))
  const now = new Date()
  if (filters.value.dateRange === 'thisMonth') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    f = f.filter(r => new Date(r.date) >= start)
  } else if (filters.value.dateRange === 'last3Months') {
    const ago = new Date(now); ago.setMonth(ago.getMonth() - 3)
    f = f.filter(r => new Date(r.date) >= ago)
  }
  filteredReports.value = f
  totalReports.value    = f.length
  currentPage.value     = 1
}, 300)

watch(searchQuery, applyFilters)
watch(filters, applyFilters, { deep: true })
watch(activeTab, fetchProjects)

const paginatedReports = computed(() => {
  const s = (currentPage.value - 1) * reportsPerPage
  return filteredReports.value.slice(s, s + reportsPerPage)
})
const totalPages = computed(() => Math.ceil(filteredReports.value.length / reportsPerPage))

// ── VIEWER ──
const openDocument = (report) => {
  activeReport.value = report
  isViewerOpen.value = true
  showHistoryPanel.value = false
  fetchVersions(report.id)
  viewDocument(report)
}

const viewDocument = (doc) => {
  viewingVersion.value = doc
  resetVerification()
  loadPdf(doc?.formUrl)
}

const closeViewer = () => {
  isViewerOpen.value = false
  activeReport.value = null
  viewingVersion.value = null
  versionsList.value = []
  showHistoryPanel.value = false
  clearTimeout(pdfTimeout)
  cancelPdfRender()
}

// ── SECURITY ──
const handleGlobalKeydown = (e) => {
  if (e.ctrlKey && ['p','s','f'].includes(e.key)) { e.preventDefault(); alert('This action is disabled in the document viewer.') }
  if (e.key === 'PrintScreen') { e.preventDefault(); navigator.clipboard.writeText('Screenshots are disabled.') }
}
const disableContextMenu = (e) => e.preventDefault()

const verifyDocument = async () => {
  const targetId = viewingVersion.value?.id || activeReport.value?.id
  if (!targetId) return

  Object.assign(verification.value, {
    hashStatus: 'Verifying…', hashIconClass: 'loading', hashIcon: 'fa-spinner fa-spin',
    timestampStatus: 'Verifying…', timestampIconClass: 'loading', timestampIcon: 'fa-spinner fa-spin',
    polygonStatus: 'Verifying…', polygonIconClass: 'loading',
    showPolygon: false, polygonTxHash: '', polygonExplorerUrl: '',
    showIpfs: false, ipfsCid: '', ipfsUrl: ''
  })
  try {
    const res = await axios.get(`${API}/tala/validate/${targetId}`)
    if (!res.data.valid) return setVerificationError('Blockchain validation failed')

    setTimeout(() => Object.assign(verification.value, {
      hashIconClass: 'verified', hashIcon: 'fa-check',
      hashStatus: 'Document hash verified successfully'
    }), 500)
    setTimeout(() => Object.assign(verification.value, {
      timestampIconClass: 'verified', timestampIcon: 'fa-check',
      timestampStatus: 'Timestamp confirmed on blockchain'
    }), 1000)
    setTimeout(() => Object.assign(verification.value, {
      showHash: true,
      blockHash: res.data.hash || activeReport.value.block_hash || '—'
    }), 1500)

    // Polygon verification step
    if (res.data.polygon) {
      setTimeout(() => {
        if (res.data.polygon.verified) {
          Object.assign(verification.value, {
            polygonIconClass: 'verified', polygonIcon: 'fa-check',
            polygonStatus: 'Confirmed on Polygon Amoy',
            showPolygon: true,
            polygonTxHash: res.data.polygon.txHash,
            polygonExplorerUrl: res.data.polygon.explorerUrl
          })
        } else {
          Object.assign(verification.value, {
            polygonIconClass: 'error', polygonIcon: 'fa-times',
            polygonStatus: res.data.polygon.error || 'Polygon verification failed',
            showPolygon: true,
            polygonTxHash: res.data.polygon.txHash,
            polygonExplorerUrl: res.data.polygon.explorerUrl
          })
        }
      }, 2000)
    } else {
      setTimeout(() => Object.assign(verification.value, {
        polygonIconClass: '', polygonIcon: 'fa-minus',
        polygonStatus: 'Not anchored on Polygon (local only)'
      }), 2000)
    }

    // IPFS step
    if (res.data.ipfsUrl) {
      setTimeout(() => Object.assign(verification.value, {
        showIpfs: true,
        ipfsCid: res.data.ipfsCid,
        ipfsUrl: res.data.ipfsUrl
      }), 2500)
    }
  } catch { setVerificationError('Error connecting to server') }
}

const setVerificationError = (msg) => Object.assign(verification.value, { hashIconClass: 'error', hashIcon: 'fa-times', hashStatus: msg, timestampIconClass: 'error', timestampIcon: 'fa-times', timestampStatus: msg })
const resetVerification = () => { verification.value = { hashStatus: 'Click verify to check document hash', timestampStatus: 'Click verify to check timestamp', polygonStatus: 'Click verify to check Polygon anchor', hashIconClass: '', timestampIconClass: '', polygonIconClass: '', hashIcon: 'fa-question', timestampIcon: 'fa-question', polygonIcon: 'fa-question', showHash: false, blockHash: '', showPolygon: false, polygonTxHash: '', polygonExplorerUrl: '', showIpfs: false, ipfsCid: '', ipfsUrl: '' } }

// ── MODAL TRANSITION HOOKS ──
const onOverlayEnter = (el, done) => { animate(el, { opacity: [0, 1] }, { duration: 0.22, easing: 'ease' }).finished.then(done) }
const onOverlayLeave = (el, done) => { animate(el, { opacity: [1, 0] }, { duration: 0.18, easing: 'ease' }).finished.then(done) }
const onScanOverlayEnter = (el, done) => {
  animate(el, { opacity: [0, 1] }, { duration: 0.22, easing: 'ease' })
  const card = el.querySelector('.scan-modal')
  if (card) { animate(card, { opacity: [0, 1], transform: ['scale(0.95) translateY(16px)', 'scale(1) translateY(0px)'] }, { duration: 0.36, delay: 0.06, easing: [0.16, 1, 0.3, 1] }).finished.then(done) } else { done() }
}
const onViewerOverlayEnter = (el, done) => {
  animate(el, { opacity: [0, 1] }, { duration: 0.22, easing: 'ease' })
  const card = el.querySelector('.viewer-card')
  if (card) { animate(card, { opacity: [0, 1], transform: ['scale(0.97) translateY(20px)', 'scale(1) translateY(0px)'] }, { duration: 0.4, delay: 0.06, easing: [0.16, 1, 0.3, 1] }).finished.then(done) } else { done() }
}
const onModalLeave = (el, done) => {
  const card = el.querySelector('.scan-modal, .viewer-card')
  if (card) { animate(card, { opacity: [1, 0], transform: ['scale(1) translateY(0px)', 'scale(0.96) translateY(8px)'] }, { duration: 0.18, easing: [0.4, 0, 1, 1] }) }
  animate(el, { opacity: [1, 0] }, { duration: 0.2, easing: 'ease' }).finished.then(done)
}

watch(paginatedReports, async () => {
  await nextTick()
  const rows = document.querySelectorAll('.data-row')
  if (rows.length) { animate(rows, { opacity: [0, 1], transform: ['translateX(-10px)', 'translateX(0px)'] }, { duration: 0.32, delay: stagger(0.035), easing: [0.16, 1, 0.3, 1] }) }
})

// ── HELPERS ──
const docCategories = ['Project Reports', 'Financial Statements', 'Executive Orders', 'Bids and Awards']
const fileTypeClass = (rpt) => { if (!rpt.formUrl) return 'ftype-pdf'; const ext = rpt.formUrl.split('.').pop().toLowerCase(); if (ext === 'pdf') return 'ftype-pdf'; if (['doc','docx'].includes(ext)) return 'ftype-doc'; if (['xls','xlsx'].includes(ext)) return 'ftype-xls'; return 'ftype-pdf' }
const fileTypeLabel = (rpt) => { if (!rpt.formUrl) return 'PDF'; return rpt.formUrl.split('.').pop().toUpperCase() }
const scanDocTypeClass = computed(() => { if (!scanDoc.value) return 'ftype-pdf'; const t = scanDoc.value.type; if (t === 'pdf') return 'ftype-pdf'; if (['doc','docx'].includes(t)) return 'ftype-doc'; if (['xls','xlsx'].includes(t)) return 'ftype-xls'; return 'ftype-pdf' })
const scanDocTypeLabel = computed(() => { if (!scanDoc.value) return 'PDF'; return scanDoc.value.type.toUpperCase() })
</script>

<template>
  <div class="tala-page">
    <section class="tala-hero">
      <div class="hero-bg"></div>
      <div class="hero-grid-overlay"></div>
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <div class="hero-eyebrow"><div class="eyebrow-line"></div><div class="eyebrow-line"></div></div>
        <h1 class="hero-title"><br><em>Transparency</em><span class="period">.</span></h1>
        <p class="hero-sub"></p>
        <div class="hero-badges">
          <span class="badge"><span class="badge-sq"></span> Blockchain Verified</span>
          <span class="badge"><span class="badge-sq"></span> Public Records</span>
        </div>
      </div>
    </section>

    <!-- ══ TOOLBAR — sticky breadcrumb + search ══ -->
    <div class="toolbar-strip">
      <div class="toolbar-inner">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <router-link to="/">Home</router-link>
          <span class="bc-sep">&gt;</span>
          <span aria-current="page">Transparency &amp; Accountability</span>
        </nav>
        <div class="search-wrap">
          <i class="fas fa-search search-ico"></i>
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Search documents..."
            class="search-input"
            aria-label="Search documents"
          />
          <button v-if="searchQuery" class="search-clear" aria-label="Clear search" @click="searchQuery = ''">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>

    <div class="tala-body"><div class="body-inner">
      <aside class="tala-sidebar">
        <div class="sidebar-card">
          <div class="card-head"><i class="fas fa-folder-open"></i><span>Document Categories</span></div>
          <ul class="doc-nav"><li v-for="cat in docCategories" :key="cat" :class="{ active: activeTab === cat }" @click="activeTab = cat"><i class="fas fa-file-alt"></i>{{ cat }}</li></ul>
        </div>
      </aside>

      <main class="tala-main">
        <div class="section-head">
          <div class="section-head-left"><div class="sec-eyebrow"></div><h2>{{ activeTab }}</h2></div>
          <div class="section-head-right">
            <div class="filter-chips"><button v-for="opt in [['all','All'],['thisMonth','This Month'],['last3Months','Last 3 Months']]" :key="opt[0]" class="chip" :class="{ active: filters.dateRange === opt[0] }" @click="filters.dateRange = opt[0]">{{ opt[1] }}</button></div>
          </div>
        </div>

        <div v-if="isLoading" class="state-box loading-box"><i class="fas fa-spinner fa-spin"></i><span>Loading documents...</span></div>
        <div v-else-if="fetchError" class="state-box error-box"><i class="fas fa-exclamation-triangle"></i><div><strong>Failed to load documents</strong><p>{{ fetchError }}</p><button class="btn-retry" @click="fetchProjects"><i class="fas fa-redo"></i> Retry</button></div></div>

        <template v-else>
          <div class="data-panel">
            <div class="panel-header"><span class="panel-title"><i class="fas fa-file-alt"></i></span><span class="panel-count">{{ totalReports }} record{{ totalReports !== 1 ? 's' : '' }}</span></div>
            <table class="data-table">
              <thead><tr><th class="th-grip"></th><th>Document</th><th>Date</th><th></th><th>Action</th></tr></thead>
              <tbody>
                <tr v-for="rpt in paginatedReports" :key="rpt.id" class="data-row" :class="{ 'is-dragging': isDraggingDoc && scanDoc?.id === rpt.id }" draggable="true" @dragstart="onRowDragStart($event, rpt)" @dragend="onRowDragEnd">
                  <td class="td-grip"><div class="grip-dots"><span></span><span></span><span></span><span></span><span></span><span></span></div></td>
                  <td class="td-details">
                    <div class="doc-row-inner">
                      <div class="ftype" :class="fileTypeClass(rpt)">{{ fileTypeLabel(rpt) }}</div>
                      <div><div class="doc-title">{{ rpt.title }} <span v-if="rpt.hasVersions" class="version-badge">v{{ rpt.version_number }}</span></div><div class="doc-dept">{{ rpt.dept || 'Municipal Office' }}</div></div>
                    </div>
                  </td>
                  <td class="td-date">{{ rpt.date }}</td>
                  <td class="td-status"><span class="status-tag" :class="rpt.status || ''">{{ rpt.status || '' }}</span></td>
                  <td class="td-action">
                    <button v-if="rpt.formUrl" class="btn-view" @click="openDocument(rpt)"><i class="fas fa-eye"></i> View</button>
                    <span v-else class="no-file">—</span>
                  </td>
                </tr>
                <tr v-if="paginatedReports.length === 0"><td colspan="5" class="empty-row"><i class="fas fa-folder-open"></i><p>No documents found matching your criteria.</p></td></tr>
              </tbody>
            </table>
          </div>
          <div class="pagination" v-if="totalPages > 1">
            <button @click="currentPage--" :disabled="currentPage === 1"><i class="fas fa-chevron-left"></i> Prev</button>
            <div class="page-nums"><button v-for="p in totalPages" :key="p" :class="{ active: p === currentPage }" @click="currentPage = p">{{ p }}</button></div>
            <button @click="currentPage++" :disabled="currentPage === totalPages">Next <i class="fas fa-chevron-right"></i></button>
          </div>
        </template>
      </main>
    </div></div>

    <!-- VIEWER MODAL -->
    <Transition name="modal-overlay-t" @enter="onViewerOverlayEnter" @leave="onModalLeave">
      <div v-if="isViewerOpen" class="modal-overlay" @contextmenu.prevent>
        <div class="viewer-card">
          <div class="viewer-head">
            <div class="viewer-head-left">
              <i class="fas fa-file-pdf"></i>
              <div>
                <div class="viewer-title">Document Viewer</div>
                <div class="viewer-doc-name">{{ activeReport?.title }} <span v-if="viewingVersion && viewingVersion.id !== activeReport?.id" class="viewing-ver-tag">(Viewing v{{ viewingVersion.version_number }})</span></div>
              </div>
            </div>
            <button class="close-btn" @click="closeViewer"><i class="fas fa-times"></i></button>
          </div>
          <div class="viewer-body">
            <!-- PDF.js canvas rendering — no browser toolbar, works in every browser.
                 data-lenis-prevent lets the mouse wheel scroll natively inside the viewer. -->
            <div class="pdf-area">
              <div ref="pdfCanvasWrap" class="pdf-canvas-wrap" data-lenis-prevent></div>
              <div v-if="isLoadingPdf" class="pdf-loader"><i class="fas fa-spinner fa-spin"></i><span>Loading document...</span></div>
              <div v-if="pdfError" class="pdf-error"><i class="fas fa-exclamation-triangle"></i><div><strong>Document Load Error</strong><p>{{ pdfErrorMsg }}</p><button class="btn-retry" @click="loadPdf(viewingVersion?.formUrl)"><i class="fas fa-redo"></i> Retry</button></div></div>
            </div>

            <div class="viewer-sidebar" data-lenis-prevent>
              <div class="ctrl-section">
                <div class="ctrl-label">Document Actions</div>
                <button class="ctrl-btn verify" @click="verifyDocument"><i class="fas fa-shield-alt"></i> Verify on Blockchain</button>
                <button class="ctrl-btn history" @click="toggleHistoryPanel" :class="{ active: showHistoryPanel }">
                  <i class="fas fa-history"></i> Version History
                  <span v-if="versionsList.length > 1" class="version-count">{{ versionsList.length }}</span>
                </button>
              </div>

              <div class="verify-panel">
                <div class="verify-title"><i class="fas fa-check-circle"></i> Verification Status</div>
                <div class="verify-step" :class="verification.hashIconClass"><i class="fas" :class="verification.hashIcon"></i><div><strong>Document Hash</strong><span>{{ verification.hashStatus }}</span></div></div>
                <div class="verify-step" :class="verification.timestampIconClass"><i class="fas" :class="verification.timestampIcon"></i><div><strong>Timestamp</strong><span>{{ verification.timestampStatus }}</span></div></div>
                <div class="verify-step" :class="verification.polygonIconClass"><i class="fab fa-ethereum"></i><div><strong>Polygon Anchor</strong><span>{{ verification.polygonStatus }}</span></div></div>
                <div v-if="verification.showHash" class="hash-box"><div class="hash-label">Local Block Hash</div><code>{{ verification.blockHash }}</code></div>
                <div v-if="verification.showPolygon && verification.polygonExplorerUrl" class="hash-box polygon-box"><div class="hash-label"><i class="fab fa-ethereum"></i> Polygon Transaction</div><a :href="verification.polygonExplorerUrl" target="_blank" rel="noopener" class="polygon-ext-link">{{ verification.polygonTxHash }}</a></div>
                <div v-if="verification.showIpfs && verification.ipfsUrl" class="hash-box ipfs-box"><div class="hash-label"><i class="fas fa-cloud"></i> IPFS Storage</div><a :href="verification.ipfsUrl" target="_blank" rel="noopener" class="ipfs-ext-link">{{ verification.ipfsCid }}</a></div>
              </div>

              <!-- VERSION HISTORY PANEL (TOGGLED) -->
              <Transition name="slide-down">
                <div v-if="showHistoryPanel && versionsList.length > 0" class="version-panel">
                  <div class="version-panel-header">
                    <div class="ctrl-label">History ({{ versionsList.length }})</div>
                    <button class="close-history-btn" @click="showHistoryPanel = false"><i class="fas fa-times"></i></button>
                  </div>
                  <div v-if="isLoadingVersions" class="ver-loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>
                  <div v-else class="version-list" data-lenis-prevent>
                    <div v-for="ver in versionsList" :key="ver.id" class="version-item" :class="{ active: viewingVersion?.id === ver.id, archived: !ver.is_latest }" @click="switchVersion(ver)">
                      <div class="ver-head">
                        <span class="ver-num">v{{ ver.version_number }}</span>
                        <span v-if="ver.is_latest" class="ver-latest"><i class="fas fa-star"></i> Latest</span>
                        <span v-else class="ver-archived"><i class="fas fa-archive"></i> Archived</span>
                      </div>
                      <div class="ver-date"><i class="fas fa-calendar-alt"></i> {{ new Date(ver.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) }}</div>
                      <div v-if="ver.version_note" class="ver-note"><i class="fas fa-sticky-note"></i> {{ ver.version_note }}</div>
                      <div class="ver-hash-preview"><i class="fas fa-link"></i> {{ ver.block_hash ? ver.block_hash.substring(0, 16) + '...' : 'No hash' }}</div>
                    </div>
                  </div>
                </div>
              </Transition>

            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- SCAN MODAL -->
    <Transition name="modal-overlay-t" @enter="onScanOverlayEnter" @leave="onOverlayLeave">
      <div v-if="scanModalOpen" class="modal-overlay" @click.self="closeScanModal">
        <div class="scan-modal-wrapper"><div class="scan-modal">
          <div class="scan-modal-head" :class="{ 'head-verified': scanState === 'result' && scanResult?.verified, 'head-failed': scanState === 'result' && !scanResult?.verified }">
            <div class="smh-icon"><i v-if="scanState === 'scanning'" class="fas fa-cubes"></i><i v-else-if="scanResult?.verified" class="fas fa-check-circle"></i><i v-else class="fas fa-times-circle"></i></div>
            <div><div class="smh-title"><template v-if="scanState === 'scanning'">Blockchain verification</template><template v-else-if="scanResult?.verified">Document verified</template><template v-else>Verification failed</template></div><div class="smh-sub"><template v-if="scanState === 'scanning'">Checking document integrity…</template><template v-else-if="scanResult?.verified">Authentic · confirmed on chain</template><template v-else>Not found on blockchain</template></div></div>
            <button class="smh-close" @click="closeScanModal"><i class="fas fa-times"></i></button>
          </div>
          <div class="scan-modal-body">
            <div class="scan-doc-card"><div v-if="scanState === 'scanning'" class="scan-beam"></div><div class="ftype" :class="scanDocTypeClass">{{ scanDocTypeLabel }}</div><div class="sdc-info"><div class="sdc-name">{{ scanDoc?.title }}</div><div class="sdc-meta">{{ scanDoc?.dept }} · {{ scanDoc?.date }}</div></div></div>
            <template v-if="scanState === 'scanning'">
              <div class="scan-steps"><div v-for="(step, i) in scanSteps" :key="i" class="scan-step" :class="{ 's-done': i < scanStepIdx, 's-active': i === scanStepIdx, 's-pending': i > scanStepIdx }"><div class="ss-icon"><i v-if="i < scanStepIdx" class="fas fa-check"></i><i v-else-if="i === scanStepIdx" class="fas fa-circle-notch fa-spin"></i><span v-else>·</span></div>{{ step }}</div></div>
              <div class="prog-track"><div class="prog-fill" :style="{ width: Math.min(Math.round(scanProgress), 100) + '%' }"></div></div>
              <div class="prog-label">Verifying on chain…</div>
            </template>
            <template v-if="scanState === 'result' && scanResult">
              <div class="result-banner" :class="scanResult.verified ? 'r-ok' : 'r-fail'"><i :class="scanResult.verified ? 'fas fa-check-circle' : 'fas fa-times-circle'"></i>{{ scanResult.verified ? 'Verified — authentic document' : 'Verification failed' }}<span class="r-time">{{ scanResult.timestamp }}</span></div>
              <div class="check-list"><div v-for="chk in scanResult.checks" :key="chk.label" class="check-item" :class="chk.ok ? 'chk-ok' : 'chk-fail'"><i :class="chk.ok ? 'fas fa-check' : 'fas fa-times'"></i>{{ chk.label }}</div></div>
              <div class="result-meta">
                <div class="rm-row"><span class="rm-label">Block</span><span class="rm-val">#{{ scanResult.blockNumber }}</span></div>
                <div class="rm-row"><span class="rm-label">Hash</span><span class="rm-val mono">{{ scanResult.hash.slice(0, 20) }}…</span></div>
                <div v-if="scanResult.polygonTxHash" class="rm-row"><span class="rm-label"><i class="fab fa-ethereum"></i> Polygon</span><a :href="scanResult.polygonExplorerUrl" target="_blank" rel="noopener" class="rm-val mono polygon-ext-link">{{ scanResult.polygonTxHash.slice(0, 18) }}…</a></div>
                <div v-if="scanResult.ipfsCid" class="rm-row"><span class="rm-label"><i class="fas fa-cloud"></i> IPFS</span><a :href="scanResult.ipfsUrl" target="_blank" rel="noopener" class="rm-val mono ipfs-ext-link">{{ scanResult.ipfsCid.slice(0, 16) }}…</a></div>
              </div>
              <div class="scan-modal-actions"><button class="btn-close-scan" @click="closeScanModal">Close</button></div>
            </template>
          </div>
        </div></div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* same font stack as History.vue */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500;600;700&display=swap');

/* ═══════════════════════════════════════════
   TOKENS — History.vue family + rounded scale
   ═══════════════════════════════════════════ */
.tala-page {
  --white:     #FFFFFF;
  --surface:   #F5F6F8;
  --border:    #E3E5EA;
  --navy:      #000c7b;
  --navy-deep: #07115E;
  --red:       #970718;
  --ink:       #111827;
  --ink-body:  #3D4451;
  --ink-muted: #6B7280;
  --ink-faint: #A0A9B8;
  --gold:      #C9A84C;
  --gutter:    clamp(20px, 5vw, 80px);
  --max-w:     1140px;
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 16px;
  --r-xl: 20px;
  --r-pill: 999px;
  --sh-1: 0 1px 2px rgba(7,17,94,0.05), 0 8px 24px rgba(7,17,94,0.07);
  --sh-2: 0 24px 70px rgba(7,17,94,0.22), 0 8px 24px rgba(7,17,94,0.10);
  --ease: cubic-bezier(0.16, 1, 0.3, 1);

  font-family: 'DM Sans', sans-serif;
  background: var(--white);
  color: var(--ink);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.tala-page *,
.tala-page *::before,
.tala-page *::after { box-sizing: border-box; margin: 0; padding: 0; }

.tala-page ::selection { background: var(--navy); color: #fff; }
.tala-page :focus-visible { outline: 2px solid var(--red); outline-offset: 3px; border-radius: 4px; }

/* ═══════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════ */
.tala-hero {
  position: relative;
  height: 68vh;
  height: 68svh;
  min-height: 460px;
  max-height: 640px;
  overflow: hidden;
  background: var(--navy-deep);
}

.hero-bg {
  position: absolute; inset: 0;
  background: url('/images/hero-imgs.jpg') center 35% / cover no-repeat;
  filter: grayscale(25%) brightness(0.45);
  will-change: transform;
  animation: heroDrift 26s ease-in-out infinite alternate;
}
@keyframes heroDrift {
  from { transform: scale(1.02); }
  to   { transform: scale(1.09); }
}

.tala-hero::after {
  content: '';
  position: absolute; inset: 0; z-index: 3;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
  background-size: 180px;
  pointer-events: none;
  mix-blend-mode: overlay;
}

.hero-grid-overlay { display: none; }

.hero-overlay {
  position: absolute; inset: 0; z-index: 1;
  background:
    linear-gradient(to right,
      rgba(4,10,60,0.97) 0%,
      rgba(7,17,94,0.92) 48%,
      rgba(11,25,143,0.22) 100%),
    linear-gradient(to top, rgba(4,10,60,0.55) 0%, transparent 40%);
}

.hero-content {
  position: relative; z-index: 2;
  width: 100%; max-width: var(--max-w);
  margin: 0 auto;
  padding: 0 var(--gutter);
  height: 100%;
  display: flex; flex-direction: column; justify-content: center;
  text-align: left;
}

.hero-eyebrow, .hero-title, .hero-sub, .hero-badges, .hero-stats, .hero-scroll { opacity: 0; }

.hero-eyebrow {
  display: flex; align-items: center; gap: 10px;
  font-size: 0.62rem; font-weight: 600;
  letter-spacing: 0.26em; text-transform: uppercase;
  color: rgba(255,255,255,0.5);
  margin-bottom: 18px;
}
.eyebrow-line {
  width: 24px; height: 1px;
  background: rgba(255,255,255,0.25);
  flex-shrink: 0;
}

.hero-title br { display: none; }

.hero-title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(2.6rem, 6.5vw, 5rem);
  font-weight: 700;
  color: #F2F1EC;
  line-height: 1.04; letter-spacing: -0.025em;
  margin-bottom: 18px;
  text-wrap: balance;
}
.hero-title em {
  font-family: 'EB Garamond', serif;
  font-style: italic; font-weight: 500;
}
.period { color: #C42B3A; }

.hero-sub { display: none; }

.hero-badges {
  display: flex; gap: 10px; flex-wrap: wrap;
  margin-bottom: 28px;
}
.badge {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 7px 16px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.22);
  border-radius: var(--r-pill);
  font-size: 0.72rem; font-weight: 600; letter-spacing: 0.05em;
  color: rgba(255,255,255,0.72);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
}
.badge-sq {
  width: 6px; height: 6px;
  background: #C42B3A;
  border-radius: 50%; flex-shrink: 0;
  box-shadow: 0 0 8px rgba(196,43,58,0.7);
}

.hero-stats {
  display: flex; align-items: center; gap: 28px;
  padding: 14px 26px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.05);
  border-radius: var(--r-md);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  width: fit-content;
}
.stat { display: flex; flex-direction: column; gap: 3px; }
.stat-num {
  font-family: 'Playfair Display', serif;
  font-size: 1.4rem; font-weight: 700; color: #F2F1EC; line-height: 1;
}
.stat-label {
  font-size: 0.62rem; font-weight: 600; color: rgba(255,255,255,0.42);
  text-transform: uppercase; letter-spacing: 0.14em;
}
.stat-divider {
  width: 1px; height: 34px; flex-shrink: 0;
  background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.2), transparent);
}

/* ═══════════════════════════════════════════
   TOOLBAR — sticky breadcrumb + search
   ═══════════════════════════════════════════ */
.toolbar-strip {
  background: var(--white);
  border-bottom: 1px solid var(--border);
  padding: 20px 0;
  position: sticky;
  top: 108px;
  z-index: 100;
}
.toolbar-inner {
  max-width: 1780px;
  margin: 0 auto;
  padding: 0 clamp(32px, 6vw, 120px);
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px;
}
.breadcrumb {
  display: flex; align-items: center; gap: 9px;
  font-size: 0.8rem; color: var(--ink-faint);
}
.breadcrumb a {
  color: var(--navy); text-decoration: none; font-weight: 600;
  padding: 11px 0; display: inline-block;
  transition: color 0.18s;
}
.breadcrumb a:hover { color: var(--red); }
.bc-sep { font-size: 0.72rem; color: #C6CBD6; }
.breadcrumb > span:last-child { color: var(--navy); font-weight: 600; }

.search-wrap { position: relative; display: flex; align-items: center; }
.search-ico {
  position: absolute; left: 15px; top: 50%; transform: translateY(-50%);
  color: var(--ink-faint); font-size: 0.8rem;
  pointer-events: none;
}
.search-input {
  padding: 14px 42px 14px 44px;
  border: 1px solid var(--border);
  border-radius: var(--r-pill);
  width: 380px;
  font-size: 0.9rem;
  font-family: 'Sora', sans-serif;
  color: var(--ink);
  background: var(--surface);
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
}
.search-input::placeholder { color: var(--ink-faint); }
.search-input:focus {
  outline: none;
  border-color: var(--navy);
  background: var(--white);
  box-shadow: 0 0 0 3px rgba(0,12,123,0.08);
}
.search-clear {
  position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
  border: none; background: transparent; cursor: pointer;
  color: var(--ink-faint); font-size: 0.8rem; padding: 12px;
  transition: color 0.2s;
}
.search-clear:hover { color: var(--red); }

@media (max-width: 1100px) {
  .toolbar-strip { top: 0; }
  .toolbar-inner { flex-wrap: wrap; }
  .search-input { width: 100%; min-width: 220px; }
}

/* ═══════════════════════════════════════════
   BODY LAYOUT
   ═══════════════════════════════════════════ */
.tala-body { padding: clamp(64px, 7vw, 96px) 0 clamp(100px, 11vw, 150px); }
.body-inner {
  max-width: 1780px;
  margin: 0 auto;
  padding: 0 clamp(32px, 6vw, 120px);
  display: grid;
  grid-template-columns: 340px minmax(0, 1fr);
  gap: 56px;
  align-items: start;
}

/* ── SIDEBAR ── */
.tala-sidebar {
  display: flex; flex-direction: column; gap: 24px;
  position: sticky; top: 100px;
}

.sidebar-card {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  overflow: hidden;
  box-shadow: var(--sh-1);
}

.card-head {
  padding: 20px 26px;
  display: flex; align-items: center; gap: 10px;
  font-size: 0.68rem; font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--navy-deep);
  background: linear-gradient(160deg, #FAFBFD, var(--surface));
  border-bottom: 1px solid var(--border);
}
.card-head i { color: var(--red); font-size: 0.8rem; }

.doc-nav { list-style: none; padding: 12px; }
.doc-nav li {
  display: flex; align-items: center; gap: 11px;
  padding: 16px 18px;
  font-size: 0.88rem; font-weight: 500;
  color: var(--ink-muted);
  border-radius: var(--r-sm);
  cursor: pointer;
  position: relative;
  transition: background 0.18s, color 0.18s;
}
.doc-nav li i { color: #A8B3C4; font-size: 0.8rem; width: 16px; text-align: center; transition: color 0.18s; }
.doc-nav li:hover { background: var(--surface); color: var(--navy); }
.doc-nav li:hover i { color: var(--navy); }
.doc-nav li.active {
  background: rgba(0,12,123,0.06);
  color: var(--navy);
  font-weight: 700;
}
.doc-nav li.active i { color: var(--red); }
.doc-nav li.active::before {
  content: '';
  position: absolute; left: 0; top: 50%;
  transform: translateY(-50%);
  width: 3px; height: 60%;
  background: var(--red);
  border-radius: var(--r-pill);
}

/* ── SECTION HEAD ── */
.section-head {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 16px; flex-wrap: wrap;
  margin-bottom: 48px;
}
.section-head h2 {
  font-family: 'Playfair Display', serif;
  font-size: clamp(1.5rem, 2.6vw, 2rem);
  font-weight: 700; color: var(--navy-deep);
  letter-spacing: -0.015em; line-height: 1.15;
}
.sec-eyebrow { display: none; }
.section-head-right { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; flex-shrink: 0; }

.filter-chips {
  display: flex; flex-wrap: wrap; gap: 4px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-pill);
  padding: 4px;
}
.chip {
  padding: 12px 16px;
  background: transparent;
  color: var(--ink-muted);
  border: none; border-radius: var(--r-pill);
  font-size: 0.76rem; font-weight: 600;
  font-family: 'DM Sans', sans-serif;
  cursor: pointer; white-space: nowrap;
  transition: background 0.2s, color 0.2s;
}
.chip:hover { color: var(--navy); }
.chip.active {
  background: var(--navy); color: #fff;
  box-shadow: 0 3px 10px rgba(0,12,123,0.25);
}

/* ── STATE BOXES ── */
.state-box {
  display: flex; align-items: center; gap: 14px;
  padding: 22px 24px;
  font-size: 0.92rem;
  border-radius: var(--r-lg);
  margin-bottom: 16px;
}
.loading-box {
  background: var(--white);
  color: var(--ink-muted);
  border: 1px solid var(--border);
  box-shadow: var(--sh-1);
}
.loading-box i { color: var(--navy); font-size: 1.15rem; }
.error-box {
  background: #FFF5F5;
  color: var(--red);
  border: 1px solid #F5C6C6;
  border-radius: var(--r-lg);
}
.error-box strong { display: block; margin-bottom: 4px; font-size: 0.95rem; }
.error-box p { font-size: 0.86rem; color: var(--ink-muted); margin: 0 0 12px; }
.btn-retry {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 18px;
  background: var(--navy); color: #fff;
  border: none; border-radius: var(--r-pill);
  font-size: 0.8rem; font-weight: 700;
  font-family: 'DM Sans', sans-serif;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s var(--ease);
}
.btn-retry:hover { background: var(--navy-deep); transform: translateY(-1px); }
.btn-retry i { font-size: 0.7rem; }

/* ═══════════════════════════════════════════
   DATA PANEL + TABLE
   ═══════════════════════════════════════════ */
.data-panel {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--r-xl);
  overflow: hidden;
  box-shadow: var(--sh-1);
  margin-bottom: 30px;
}

.panel-header {
  padding: 22px 32px;
  display: flex; align-items: center; justify-content: space-between;
  background: var(--white);
  border-bottom: 1px solid var(--border);
  border-top: 3px solid var(--red);
}
.panel-title {
  display: flex; align-items: center; gap: 9px;
  font-size: 0.72rem; font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--navy-deep);
}
.panel-title i { color: var(--red); font-size: 0.85rem; }
.panel-count {
  font-size: 0.72rem; font-weight: 700;
  color: var(--navy);
  background: rgba(0,12,123,0.06);
  border: 1px solid rgba(0,12,123,0.12);
  padding: 4px 12px;
  border-radius: var(--r-pill);
}

.data-table { width: 100%; border-collapse: collapse; }
.data-table thead tr { background: var(--surface); border-bottom: 1px solid var(--border); }
.data-table th {
  padding: 18px 28px;
  text-align: left;
  font-size: 0.68rem; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--ink-muted);
}
.th-grip { width: 36px; }

.data-row {
  border-bottom: 1px solid var(--surface);
  cursor: grab;
  transition: background 0.15s;
}
.data-row:last-child { border-bottom: none; }
.data-row:hover { background: rgba(0,12,123,0.025); }
.data-row:active { cursor: grabbing; }
.data-row.is-dragging { opacity: 0.35; background: var(--surface); }

.data-table td {
  padding: 20px 28px;
  vertical-align: middle;
  font-size: 0.9rem;
}
.td-grip { width: 36px; }
.grip-dots {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 3px; width: 9px;
}
.grip-dots span { width: 2.5px; height: 2.5px; border-radius: 50%; background: #C6CBD6; display: block; transition: background 0.15s; }
.data-row:hover .grip-dots span { background: var(--navy); }

.ftype {
  display: inline-flex; align-items: center; justify-content: center;
  width: 42px; height: 42px;
  font-size: 0.62rem; font-weight: 700; letter-spacing: 0.05em;
  flex-shrink: 0;
  border-radius: var(--r-sm);
  border: 1px solid;
}
.ftype-pdf { background: #FCEBEB; color: #A32D2D; border-color: #F5C9C9; }
.ftype-doc { background: #E6F1FB; color: #185FA5; border-color: #C2DBF4; }
.ftype-xls { background: #EAF3DE; color: #3B6D11; border-color: #CCE2A6; }

.td-details { border-right: 1px solid var(--surface); }
.doc-row-inner { display: flex; align-items: center; gap: 16px; }
.doc-title {
  font-size: 0.92rem; font-weight: 600; color: var(--navy-deep);
  margin-bottom: 2px; line-height: 1.35;
}
.doc-dept { font-size: 0.74rem; color: var(--ink-faint); }
.version-badge {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(0,12,123,0.07);
  color: var(--navy);
  font-size: 0.62rem; font-weight: 700;
  border: 1px solid rgba(0,12,123,0.18);
  border-radius: var(--r-pill);
  vertical-align: middle;
  margin-left: 6px;
}

.td-date { color: var(--ink-muted); white-space: nowrap; font-size: 0.86rem; }
.td-status { width: 90px; }
.status-tag {
  display: inline-block;
  padding: 4px 11px;
  font-size: 0.62rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
  background: #F0FDF4; color: #15803D;
  border: 1px solid #BBF7D0;
  border-radius: var(--r-pill);
}
.td-action { width: 110px; text-align: right; }
.btn-view {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 16px;
  background: transparent; color: var(--navy);
  border: 1.5px solid var(--navy);
  border-radius: var(--r-pill);
  font-size: 0.78rem; font-weight: 700;
  font-family: 'DM Sans', sans-serif;
  cursor: pointer;
  transition: background 0.2s, color 0.2s, transform 0.2s var(--ease);
}
.btn-view:hover { background: var(--navy); color: #fff; transform: translateY(-1px); }
.btn-view i { font-size: 0.7rem; }
.no-file { color: var(--ink-faint); font-size: 0.86rem; }

.empty-row { text-align: center; padding: 56px 20px !important; color: var(--ink-muted); }
.empty-row i {
  font-size: 1.5rem; display: flex; align-items: center; justify-content: center;
  width: 68px; height: 68px;
  margin: 0 auto 14px;
  color: #C6CEE2;
  background: var(--surface);
  border: 1px dashed rgba(16,21,43,0.18);
  border-radius: 50%;
}
.empty-row p { font-size: 0.9rem; font-family: 'EB Garamond', serif; font-style: italic; }

.pagination {
  display: flex; align-items: center; justify-content: center;
  gap: 12px; padding: 32px 0 10px;
}
.pagination button {
  padding: 9px 16px;
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--r-pill);
  color: var(--ink);
  font-size: 0.8rem; font-weight: 600;
  font-family: 'DM Sans', sans-serif;
  cursor: pointer;
  transition: all 0.2s var(--ease);
}
.pagination button:hover:not(:disabled) {
  border-color: var(--navy); color: var(--navy);
  transform: translateY(-1px);
}
.pagination button:disabled { opacity: 0.35; cursor: not-allowed; }
.page-nums { display: flex; gap: 5px; }
.page-nums button { min-width: 38px; justify-content: center; display: inline-flex; }
.page-nums button.active {
  background: var(--navy); color: #fff; border-color: var(--navy);
  box-shadow: 0 4px 12px rgba(0,12,123,0.25);
}

/* ═══════════════════════════════════════════
   MODAL OVERLAY (shared)
   ═══════════════════════════════════════════ */
.modal-overlay {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(7,17,94,0.72);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  padding: clamp(16px, 3vw, 28px);
}

/* ── VIEWER MODAL — enlarged so content isn't cut ── */
.viewer-card {
  background: var(--white);
  width: 100%; max-width: 1520px; height: 92vh;
  display: flex; flex-direction: column;
  overflow: hidden;
  border-radius: var(--r-xl);
  box-shadow: var(--sh-2);
}
.viewer-head {
  background: var(--navy-deep);
  border-bottom: 3px solid var(--red);
  padding: 15px 22px;
  display: flex; justify-content: space-between; align-items: center;
  flex-shrink: 0;
}
.viewer-head-left { display: flex; align-items: center; gap: 13px; color: #fff; }
.viewer-head-left > i { color: rgba(255,255,255,0.85); font-size: 1.15rem; }
.viewer-title {
  font-size: 0.64rem; font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: rgba(255,255,255,0.55);
}
.viewer-doc-name { font-size: 0.95rem; font-weight: 600; margin-top: 3px; }
.viewing-ver-tag { font-size: 0.76rem; color: var(--gold); font-weight: 500; }
.close-btn {
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.22);
  border-radius: 50%;
  color: #fff; width: 44px; height: 44px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 0.82rem;
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  transition: background 0.2s, transform 0.25s var(--ease);
}
.close-btn:hover { background: var(--red); transform: rotate(90deg); }

.viewer-body { display: flex; flex: 1; overflow: hidden; }

/* ── PDF.JS CANVAS AREA — native mouse-wheel scrolling ── */
.pdf-area { flex: 1; background: #E9EBF0; position: relative; min-width: 0; }
.pdf-canvas-wrap {
  width: 100%; height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;   /* scroll never chains to the page behind */
  padding: 24px;
  display: flex; flex-direction: column; align-items: center; gap: 18px;
  background: #E9EBF0;
  user-select: none; -webkit-user-select: none;
}
.pdf-canvas-wrap canvas {
  display: block;
  width: 100%; height: auto;
  max-width: 100%;                /* fills the full viewer width — no cap */
  flex-shrink: 0;                 /* pages never get vertically squeezed */
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 14px rgba(7,17,94,0.18);
  pointer-events: none;
}
.pdf-loader, .pdf-error {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
  color: var(--ink-muted); font-size: 0.9rem;
  background: var(--surface);
  z-index: 2;
}
.pdf-error { color: var(--red); gap: 8px; text-align: center; padding: 20px; }
.pdf-error strong { font-size: 1.05rem; font-family: 'Playfair Display', serif; }
.pdf-error p { font-size: 0.86rem; margin-bottom: 12px; }

.viewer-sidebar {
  width: 292px;
  background: var(--white);
  border-left: 1px solid var(--border);
  display: flex; flex-direction: column;
  overflow-y: auto; flex-shrink: 0;
  overscroll-behavior: contain;   /* scroll stays inside the sidebar */
}

.ctrl-section {
  padding: 16px;
  display: flex; flex-direction: column; gap: 8px;
  border-bottom: 1px solid var(--border);
}
.ctrl-label {
  font-size: 0.66rem; font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--ink-faint);
  margin-bottom: 4px;
}
.ctrl-btn {
  display: flex; align-items: center; gap: 9px;
  padding: 11px 14px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
  background: var(--white); color: var(--ink);
  font-size: 0.84rem; font-weight: 600;
  font-family: 'DM Sans', sans-serif;
  cursor: pointer; width: 100%; text-align: left;
  transition: all 0.18s;
}
.ctrl-btn:hover { border-color: var(--navy); color: var(--navy); transform: translateY(-1px); }
.ctrl-btn.verify {
  border-color: rgba(201,168,76,0.5);
  color: var(--navy-deep);
  background: rgba(201,168,76,0.08);
}
.ctrl-btn.verify:hover { background: var(--gold); color: #fff; border-color: var(--gold); }
.ctrl-btn.history {
  background: rgba(0,12,123,0.05);
  color: var(--navy);
  border: 1px solid var(--border);
  position: relative;
}
.ctrl-btn.history:hover { background: var(--navy); color: #fff; border-color: var(--navy); }
.ctrl-btn.history.active { background: var(--navy); color: #fff; border-color: var(--gold); }
.version-count {
  background: var(--gold); color: var(--navy-deep);
  font-size: 0.64rem; font-weight: 700;
  padding: 2px 8px; border-radius: var(--r-pill);
  margin-left: auto;
}

.verify-panel { padding: 16px; border-bottom: 1px solid var(--border); }
.verify-title {
  font-size: 0.76rem; font-weight: 700;
  margin-bottom: 13px;
  display: flex; align-items: center; gap: 7px;
  color: var(--ink);
}
.verify-title i { color: #15803D; }
.verify-step {
  display: flex; align-items: flex-start; gap: 10px;
  margin-bottom: 11px; font-size: 0.82rem;
}
.verify-step i { margin-top: 2px; font-size: 0.82rem; color: var(--ink-faint); width: 15px; text-align: center; }
.verify-step.verified i { color: #15803D; }
.verify-step.error i { color: var(--red); }
.verify-step.loading i { color: var(--navy); }
.verify-step strong { display: block; color: var(--ink); font-size: 0.82rem; }
.verify-step span { display: block; color: var(--ink-muted); font-size: 0.76rem; margin-top: 2px; line-height: 1.45; }

.hash-box {
  margin-top: 12px;
  background: var(--surface);
  padding: 11px 13px;
  border: 1px solid var(--border);
  border-radius: var(--r-sm);
}
.hash-label {
  font-size: 0.62rem; font-weight: 700;
  text-transform: uppercase; color: var(--ink-faint);
  letter-spacing: 0.1em; margin-bottom: 5px;
  display: flex; align-items: center; gap: 6px;
}
.hash-box code {
  font-size: 0.72rem; color: var(--navy);
  word-break: break-all; display: block;
  font-family: 'SF Mono', 'Consolas', monospace;
}

/* version history panel */
.version-panel {
  background: var(--surface);
  border-top: 1px solid var(--border);
  display: flex; flex-direction: column; overflow: hidden;
}
.version-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  background: var(--white);
  border-bottom: 1px solid var(--border);
}
.close-history-btn {
  background: none; border: none;
  color: var(--ink-faint); cursor: pointer;
  padding: 15px; font-size: 0.8rem;
  border-radius: 50%;
  transition: color 0.15s, background 0.15s;
}
.close-history-btn:hover { color: var(--red); background: rgba(151,7,24,0.06); }
.ver-loading { padding: 20px; text-align: center; color: var(--ink-muted); font-size: 0.84rem; }
.version-list {
  max-height: 260px; overflow-y: auto;
  overscroll-behavior: contain;
}
.version-item {
  padding: 13px 16px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  background: var(--white);
  transition: background 0.15s;
  border-left: 3px solid transparent;
}
.version-item:last-child { border-bottom: none; }
.version-item:hover { background: rgba(0,12,123,0.03); }
.version-item.active {
  background: rgba(0,12,123,0.06);
  border-left-color: var(--red);
}
.version-item.archived { opacity: 0.72; }
.ver-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.ver-num { font-weight: 700; color: var(--navy); font-size: 0.88rem; }
.ver-latest {
  font-size: 0.64rem; font-weight: 700;
  color: #8A6D1F;
  background: rgba(201,168,76,0.16);
  border: 1px solid rgba(201,168,76,0.3);
  padding: 2px 9px; border-radius: var(--r-pill);
  display: inline-flex; align-items: center; gap: 4px;
}
.ver-latest i { font-size: 0.55rem; }
.ver-archived {
  font-size: 0.64rem; font-weight: 600;
  color: var(--ink-muted);
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 2px 9px; border-radius: var(--r-pill);
  display: inline-flex; align-items: center; gap: 4px;
}
.ver-archived i { font-size: 0.55rem; }
.ver-date {
  font-size: 0.74rem; color: var(--ink-muted);
  margin-bottom: 4px;
  display: flex; align-items: center; gap: 6px;
}
.ver-date i { font-size: 0.66rem; }
.ver-note {
  font-size: 0.78rem; color: var(--ink-body);
  background: rgba(0,12,123,0.04);
  padding: 7px 11px; margin: 7px 0;
  border-left: 3px solid var(--navy);
  border-radius: 0 var(--r-sm) var(--r-sm) 0;
  line-height: 1.45;
  display: flex; align-items: flex-start; gap: 7px;
}
.ver-note i { color: var(--navy); font-size: 0.66rem; margin-top: 2px; }
.ver-hash-preview {
  font-size: 0.68rem; color: var(--ink-faint);
  font-family: 'SF Mono', 'Consolas', monospace;
  display: flex; align-items: center; gap: 6px; margin-top: 4px;
}
.ver-hash-preview i { font-size: 0.6rem; color: var(--navy); }

/* ── SCAN MODAL ── */
.scan-modal-wrapper { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
.scan-modal {
  background: var(--white);
  width: 100%; max-width: 500px;
  overflow: hidden;
  border-radius: var(--r-xl);
  box-shadow: var(--sh-2);
}
.scan-modal-head {
  padding: 20px 22px;
  display: flex; align-items: center; gap: 14px;
  background: var(--navy-deep);
  border-bottom: 3px solid var(--red);
  color: #fff;
}
.scan-modal-head.head-verified { background: #065F46; border-bottom-color: #34D399; }
.scan-modal-head.head-failed { background: #7F1D1D; border-bottom-color: #F87171; }
.smh-icon { font-size: 1.5rem; }
.head-verified .smh-icon { color: #6EE7B7; }
.head-failed .smh-icon { color: #FCA5A5; }
.smh-title {
  font-family: 'Playfair Display', serif;
  font-size: 1.05rem; font-weight: 700;
}
.smh-sub { font-size: 0.76rem; color: rgba(255,255,255,0.62); margin-top: 3px; }
.smh-close {
  margin-left: auto;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.22);
  border-radius: 50%;
  color: #fff; width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: background 0.2s, transform 0.25s var(--ease);
}
.smh-close:hover { background: rgba(255,255,255,0.25); transform: rotate(90deg); }

.scan-modal-body {
  padding: 22px;
  display: flex; flex-direction: column; gap: 16px;
}
.scan-doc-card {
  position: relative;
  padding: 15px 16px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  display: flex; align-items: center; gap: 13px;
  overflow: hidden;
  background: var(--surface);
}
.scan-beam {
  position: absolute; top: 0; left: 0;
  width: 100%; height: 3px;
  background: linear-gradient(90deg, transparent, var(--gold), transparent);
  animation: scanBeam 1.5s ease-in-out infinite;
}
@keyframes scanBeam { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }
.sdc-info { flex: 1; min-width: 0; }
.sdc-name { font-size: 0.92rem; font-weight: 600; color: var(--ink); }
.sdc-meta { font-size: 0.76rem; color: var(--ink-muted); margin-top: 2px; }

.scan-steps { display: flex; flex-direction: column; gap: 9px; }
.scan-step {
  display: flex; align-items: center; gap: 11px;
  font-size: 0.86rem; color: var(--ink-faint);
  padding: 8px 12px;
  border-radius: var(--r-sm);
  transition: background 0.2s;
}
.scan-step.s-done { color: #15803D; background: rgba(21,128,61,0.05); }
.scan-step.s-active { color: var(--navy); font-weight: 700; background: rgba(0,12,123,0.05); }
.ss-icon { width: 20px; text-align: center; font-size: 0.78rem; flex-shrink: 0; }

.prog-track {
  height: 6px;
  background: var(--surface);
  border-radius: var(--r-pill);
  overflow: hidden;
}
.prog-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--navy), var(--gold));
  border-radius: var(--r-pill);
  transition: width 0.12s linear;
}
.prog-label {
  text-align: center;
  font-family: 'EB Garamond', serif; font-style: italic;
  font-size: 0.9rem; color: var(--ink-muted);
  margin-top: 2px;
}

.result-banner {
  display: flex; align-items: center; gap: 10px;
  padding: 15px 17px;
  font-size: 0.92rem; font-weight: 700;
  border-radius: var(--r-md);
}
.result-banner.r-ok { background: #F0FDF4; color: #15803D; border: 1px solid #BBF7D0; }
.result-banner.r-fail { background: #FFF5F5; color: var(--red); border: 1px solid #F5C6C6; }
.r-time { margin-left: auto; font-size: 0.74rem; font-weight: 500; opacity: 0.75; }

.check-list { display: flex; flex-direction: column; gap: 7px; }
.check-item {
  display: flex; align-items: center; gap: 9px;
  font-size: 0.86rem;
  padding: 10px 13px;
  background: var(--surface);
  border-radius: var(--r-sm);
}
.check-item i { width: 16px; text-align: center; }
.check-item.chk-ok { color: #15803D; }
.check-item.chk-fail { color: var(--red); }

.result-meta {
  display: flex; flex-direction: column; gap: 8px;
  padding: 14px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}
.rm-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 0.84rem; gap: 12px;
}
.rm-label {
  color: var(--ink-faint); font-weight: 700;
  text-transform: uppercase; font-size: 0.66rem;
  letter-spacing: 0.1em;
  display: flex; align-items: center; gap: 6px;
}
.rm-val { color: var(--ink); font-weight: 600; text-align: right; }
.rm-val.mono { font-family: 'SF Mono', 'Consolas', monospace; font-size: 0.74rem; }

.scan-modal-actions { display: flex; gap: 10px; margin-top: 6px; }
.btn-close-scan {
  flex: 1;
  display: flex; align-items: center; justify-content: center;
  padding: 13px;
  background: var(--white); color: var(--ink);
  border: 1px solid var(--border); border-radius: var(--r-sm);
  font-size: 0.86rem; font-weight: 600;
  font-family: 'DM Sans', sans-serif;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}
.btn-close-scan:hover { border-color: var(--navy); color: var(--navy); }

/* ── Polygon + IPFS accents ── */
.verify-step .fab.fa-ethereum { width: 15px; text-align: center; margin-top: 2px; font-size: 0.82rem; }
.polygon-box { border-color: rgba(139,92,246,0.28); background: rgba(139,92,246,0.045); }
.polygon-ext-link {
  color: #7C3AED; text-decoration: none;
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 0.72rem; word-break: break-all; display: block;
}
.polygon-ext-link:hover { text-decoration: underline; }
.ipfs-box { border-color: rgba(8,145,178,0.28); background: rgba(8,145,178,0.045); }
.ipfs-ext-link {
  color: #0891B2; text-decoration: none;
  font-family: 'SF Mono', 'Consolas', monospace;
  font-size: 0.72rem; word-break: break-all; display: block;
}
.ipfs-ext-link:hover { text-decoration: underline; }
.check-item.is-polygon i { color: #7C3AED; }
.rm-row .fab.fa-ethereum { font-size: 0.68rem; color: #7C3AED; }
.rm-row .fas.fa-cloud { font-size: 0.68rem; color: #0891B2; }

/* ══ VUE TRANSITIONS ══ */
.modal-overlay-t-enter-active, .modal-overlay-t-leave-active { transition: opacity 0.22s ease; }
.modal-overlay-t-enter-from, .modal-overlay-t-leave-to { opacity: 0; }

.slide-down-enter-active, .slide-down-leave-active { transition: all 0.3s ease; overflow: hidden; max-height: 400px; }
.slide-down-enter-from, .slide-down-leave-to { max-height: 0; opacity: 0; }
.slide-down-enter-to, .slide-down-leave-from { max-height: 400px; opacity: 1; }

/* ═══════════════════════════════════════════
   RESPONSIVE
   ═══════════════════════════════════════════ */
@media (max-width: 1100px) {
  .body-inner { grid-template-columns: 1fr; }
  .tala-sidebar {
    position: static;
    display: grid; grid-template-columns: 1fr;
    gap: 16px;
  }
}

@media (max-width: 900px) {
  .viewer-body { flex-direction: column; }
  .viewer-sidebar {
    width: 100%;
    max-height: 42vh;
    border-left: none;
    border-top: 1px solid var(--border);
  }
  .viewer-card { height: 94vh; }
}

@media (max-width: 640px) {
  .tala-sidebar { grid-template-columns: 1fr; }
  .section-head-right { align-items: flex-start; }
  .data-table th:nth-child(1), .data-table td:nth-child(1),
  .data-table th:nth-child(4), .data-table td:nth-child(4) { display: none; }
  /* The 3 surviving columns need ~361px but only ~296px is available, and
     .data-panel clips the overflow — which cut the per-row "View" button off
     entirely. Stack each row instead so nothing is cropped. */
  .data-table thead { display: none; }
  .data-table, .data-table tbody, .data-table tr, .data-table td { display: block; width: auto; }
  .data-table tr { padding: 4px 0; border-bottom: 1px solid var(--border); }
  .data-table tr:last-child { border-bottom: none; }
  .data-table td { padding: 8px 14px; }
  .td-date { white-space: normal; }
  .td-action { text-align: left; }
  .pagination { flex-wrap: wrap; }
  .pdf-canvas-wrap { padding: 12px; }
}

/* respect users who prefer less motion */
@media (prefers-reduced-motion: reduce) {
  .tala-page *,
  .tala-page *::before,
  .tala-page *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
  .hero-bg { animation: none !important; }
}
</style>  