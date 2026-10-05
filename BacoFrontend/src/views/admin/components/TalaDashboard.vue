<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { API } from '@/api'

const searchQuery = ref('')
const ledger = ref([])
const isModalOpen = ref(false)
const form = ref({
  date: '',
  title: '',
  details: '',
  file: null,
  fileName: '',
  documentType: 'Project Reports',
  isVersionMode: false,
  parentProjectId: null,
  versionNote: ''
})

// Ã¢â€â‚¬Ã¢â€â‚¬ Conflict State Ã¢â€â‚¬Ã¢â€â‚¬
const conflictModal = ref(false)
const conflictData = ref(null)

// Ã¢â€â‚¬Ã¢â€â‚¬ History State Ã¢â€â‚¬Ã¢â€â‚¬
const isHistoryModalOpen = ref(false)
const historyVersions = ref([])
const isLoadingHistory = ref(false)
const historyRecordTitle = ref('')

// Ã¢â€â‚¬Ã¢â€â‚¬ Validation State Ã¢â€â‚¬Ã¢â€â‚¬
const validationState = ref('idle')   // idle | scanning | result
const validationResult = ref(null)
const scanProgress = ref(0)
const scanStepIdx = ref(0)
let scanInterval = null
let scanAbort = null
const scanSteps = [
  'Extracting text content from PDF',
  'Scanning for government document markers',
  'Verifying municipality identifiers',
  'Computing authenticity score'
]

// Ã¢â€â‚¬Ã¢â€â‚¬ Blockchain Chain Verification State Ã¢â€â‚¬Ã¢â€â‚¬
const isChainModalOpen = ref(false)
const chainVerifyState = ref('idle') // idle | verifying | result
const chainResult = ref(null)
const chainBlocks = ref([])
const chainProgress = ref(0)
const chainStepText = ref('')
let chainInterval = null
let chainAbort = null

const canSubmit = computed(() =>
  validationState.value === 'result' && validationResult.value?.passed
)
const scoreColor = computed(() => {
  if (!validationResult.value) return '#8896a7'
  const p = validationResult.value.percentage
  if (p >= 70) return '#15803d'
  if (p >= 40) return '#c9a84c'
  return '#c0392b'
})
const foundCount = computed(() =>
  validationResult.value?.keywords?.filter(k => k.found).length || 0
)
const totalKeywords = computed(() =>
  validationResult.value?.keywords?.length || 0
)

onMounted(() => fetchProjects())

const fetchProjects = async () => {
  try {
    const res = await axios.get(`${API}/tala/projects`)
    ledger.value = res.data.map(p => ({
      id: p.id,
      date: p.date,
      project: p.title,
      allocation: p.description,
      documentType: p.document_type || 'Project Reports',
      hash: p.block_hash ? p.block_hash.substring(0, 10) + '...' : 'Pending',
      fullHash: p.block_hash || '',
      status: p.polygon_tx_hash ? 'On-Chain' : (p.block_hash ? 'Verified' : 'Pending'),
      hasVersions: p.hasVersions || false,
      versionNumber: p.version_number || 1,
      ipfsCid: p.ipfs_cid || '',
      polygonTxHash: p.polygon_tx_hash || '',
      polygonBlockNumber: p.polygon_block_number || null,
      polygonExplorerUrl: p.polygon_tx_hash
        ? `https://amoy.polygonscan.com/tx/${p.polygon_tx_hash}`
        : '',
      ipfsUrl: p.ipfs_cid
        ? `https://gateway.pinata.cloud/ipfs/${p.ipfs_cid}`
        : ''
    }))
  } catch (e) { console.error(e) }
}

const filteredLedger = computed(() =>
  ledger.value.filter(r =>
    r.project.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    r.hash.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
)

const handleFileChange = (e) => {
  const f = e.target.files[0]
  if (f) {
    form.value.file = f
    form.value.fileName = f.name
    validationState.value = 'idle'
    validationResult.value = null
  }
}

const openModal = (record = null) => {
  const todayDate = new Date().toISOString().split('T')[0]
  form.value = {
    date: record ? todayDate : '',
    title: record ? record.project : '',
    details: record ? record.allocation : '',
    file: null,
    fileName: '',
    documentType: record ? record.documentType : 'Project Reports',
    isVersionMode: !!record,
    parentProjectId: record ? record.id : null,
    versionNote: ''
  }
  validationState.value = 'idle'
  validationResult.value = null
  scanProgress.value = 0
  scanStepIdx.value = 0
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
  clearInterval(scanInterval)
  scanAbort?.abort()
  setTimeout(() => {
    validationState.value = 'idle'
    validationResult.value = null
  }, 300)
}

// Ã¢â€â‚¬Ã¢â€â‚¬ History Modal Logic Ã¢â€â‚¬Ã¢â€â‚¬
const openHistoryModal = async (record) => {
  if (!record.hasVersions) return;
  historyRecordTitle.value = record.project;
  isLoadingHistory.value = true;
  isHistoryModalOpen.value = true;
  historyVersions.value = [];
  try {
    const res = await axios.get(`${API}/tala/projects/${record.id}/versions`);
    historyVersions.value = res.data;
  } catch (e) {
    console.error(e);
    alert('Failed to fetch version history.');
  } finally {
    isLoadingHistory.value = false;
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Scan / Validate Ã¢â€â‚¬Ã¢â€â‚¬
const scanDocument = async () => {
  if (!form.value.file) return alert('Please select a PDF file first.')
  validationState.value = 'scanning'
  scanProgress.value = 0
  scanStepIdx.value = 0
  validationResult.value = null
  scanAbort = new AbortController()
  scanInterval = setInterval(() => {
    if (scanProgress.value < 85) {
      scanProgress.value += Math.random() * 4 + 1.5
      scanStepIdx.value = Math.min(Math.floor(scanProgress.value / 25), 3)
    }
  }, 100)
  try {
    const fd = new FormData()
    fd.append('document', form.value.file)
    const res = await axios.post(`${API}/tala/validate-pdf`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal: scanAbort.signal
    })
    const data = res.data
    clearInterval(scanInterval)
    scanProgress.value = 90
    scanStepIdx.value = 3
    await new Promise(r => setTimeout(r, 200))
    scanProgress.value = 100
    scanStepIdx.value = 4
    await new Promise(r => setTimeout(r, 300))
    validationState.value = 'result'
    validationResult.value = data
  } catch (err) {
    if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return
    clearInterval(scanInterval)
    scanProgress.value = 100
    scanStepIdx.value = 4
    validationState.value = 'result'
    validationResult.value = {
      passed: false, score: 0, maxScore: 0, percentage: 0,
      keywords: [], pageCount: 0, textPreview: '',
      errors: [err.response?.data?.error || err.message || 'Validation request failed']
    }
  }
}

const submitProject = async () => {
  if (!form.value.title || !form.value.file) return alert('Please fill required fields')
  if (!canSubmit.value) return alert('Document must pass validation first')
  const formData = new FormData()
  formData.append('title', form.value.title)
  formData.append('details', form.value.details)
  formData.append('date', form.value.isVersionMode ? '' : form.value.date)
  formData.append('projectForm', form.value.file)
  formData.append('documentType', form.value.documentType)
  formData.append('skipValidation', 'false')
  if (form.value.isVersionMode) {
    formData.append('parentProjectId', form.value.parentProjectId)
    formData.append('versionNote', form.value.versionNote)
  }
  try {
    const res = await axios.post(`${API}/tala/projects`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    const isVersion = res.data.isVersion
    const verNum = res.data.versionNumber
    alert(`Ã¢Å“â€¦ ${isVersion ? `Version ${verNum} added to Blockchain!` : 'Document validated and added to Blockchain!'}`)
    closeModal()
    fetchProjects()
  } catch (e) {
    const msg = e.response?.data
    if (e.response?.status === 409 && msg?.conflict) {
      conflictData.value = msg.existingProject
      conflictModal.value = true
      return
    }
    if (msg?.validation) {
      validationState.value = 'result'
      validationResult.value = msg.validation
      alert('Ã¢ÂÅ’ ' + (msg.message || 'Document validation failed on server.'))
    } else {
      alert('Error: ' + (msg?.error || e.message))
    }
  }
}

const resolveConflict = (action) => {
  conflictModal.value = false
  if (action === 'version') {
    form.value.isVersionMode = true
    form.value.parentProjectId = conflictData.value.id
    form.value.versionNote = ''
  }
}

const copyHash = (hash) => {
  navigator.clipboard.writeText(hash)
  alert('Hash copied!')
}

const resetValidation = () => {
  validationState.value = 'idle'
  validationResult.value = null
  scanProgress.value = 0
  scanStepIdx.value = 0
  form.value.file = null
  form.value.fileName = ''
  const inp = document.querySelector('.file-input-wrap input[type="file"]')
  if (inp) inp.value = ''
}

const docTypeBadgeClass = (type) => {
  switch (type) {
    case 'Financial Statements': return 'type-financial'
    case 'Executive Orders': return 'type-executive'
    case 'Bids and Awards': return 'type-bids'
    default: return 'type-project'
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Blockchain Chain Verification Ã¢â€â‚¬Ã¢â€â‚¬
const openChainModal = () => {
  isChainModalOpen.value = true
  chainVerifyState.value = 'idle'
  chainResult.value = null
  chainBlocks.value = []
  chainProgress.value = 0
  chainStepText.value = ''
}
const closeChainModal = () => {
  chainAbort?.abort()
  chainAbort = null
  clearInterval(chainInterval)
  isChainModalOpen.value = false
  setTimeout(() => {
    chainVerifyState.value = 'idle'
    chainResult.value = null
    chainBlocks.value = []
    chainProgress.value = 0
  }, 300)
}
const verifyBlockchain = async () => {
  chainVerifyState.value = 'verifying'
  chainProgress.value = 0
  chainResult.value = null
  chainBlocks.value = []
  chainAbort = new AbortController()
  chainInterval = setInterval(() => {
    if (chainProgress.value < 88) {
      chainProgress.value += Math.random() * 1.8 + 0.4
      const blockNum = Math.floor(chainProgress.value * 0.8) + 1
      chainStepText.value = `Validating Block #${blockNum}...`
    }
  }, 120)
  try {
    const res = await axios.get(`${API}/tala/verify-chain-process`, {
      signal: chainAbort.signal
    })
    const data = res.data
    clearInterval(chainInterval)
    chainProgress.value = 100
    chainStepText.value = 'Validation complete'
    await new Promise(r => setTimeout(r, 350))
    chainVerifyState.value = 'result'
    chainResult.value = {
      isValid: data.isValid,
      blockCount: data.blockCount,
      failedAt: data.failedAt,
      totalTime: data.totalTime
    }
    chainBlocks.value = data.process || []
  } catch (err) {
    if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return
    clearInterval(chainInterval)
    chainVerifyState.value = 'result'
    chainResult.value = { isValid: false, blockCount: 0, failedAt: null, totalTime: 0, error: err.message }
    chainBlocks.value = []
  }
}
</script>

<template>
  <div class="tala-panel">
    <!-- HEADER -->
    <div class="panel-header">
      <div class="header-left">
        <div class="header-eyebrow">
          <span class="eyebrow-line"></span>
          Transparency Ledger
        </div>
        <h2>TALA Documents</h2>
        <p>Blockchain-secured official municipal records with government document authentication.</p>
      </div>
      <button class="add-btn mat-skeuo-filled mat-pressable-filled" @click="openModal()">
        <i class="fas fa-plus"></i> New Record
      </button>
      <button class="chain-verify-btn mat-skeuo-sm mat-pressable-sm" @click="openChainModal">
        <i class="fas fa-cubes"></i> Verify Blockchain
      </button>
    </div>

    <!-- TOOLBAR -->
    <div class="toolbar">
      <div class="stats">
        <div class="stat-chip mat-well"><i class="fas fa-cubes"></i><span class="val">{{ ledger.length }}</span><span class="lbl">Total Records</span></div>
        <div class="stat-chip on-chain-stat mat-well"><i class="fab fa-ethereum"></i><span class="val">{{ ledger.filter(r => r.status === 'On-Chain').length }}</span><span class="lbl">On-Chain</span></div>
        <div class="stat-chip verified mat-well"><i class="fas fa-shield-halved"></i><span class="val">{{ ledger.filter(r => r.status === 'Verified').length }}</span><span class="lbl">Verified</span></div>
        <div class="stat-chip pending mat-well"><i class="fas fa-clock"></i><span class="val">{{ ledger.filter(r => r.status === 'Pending').length }}</span><span class="lbl">Pending</span></div>
      </div>
      <div class="search-box">
        <i class="fas fa-search"></i>
        <input v-model="searchQuery" type="text" placeholder="Search project or hash..." />
      </div>
    </div>

    <!-- TABLE -->
    <div class="data-panel">
      <div class="panel-bar">
        <span class="bar-title"><i class="fas fa-link"></i> Blockchain Ledger</span>
        <span class="bar-count">{{ filteredLedger.length }} record{{ filteredLedger.length !== 1 ? 's' : '' }}</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Date Recorded</th><th>Project / Allocation</th><th>Document Type</th><th>Blockchain Hash</th><th>Integrity</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in filteredLedger" :key="record.id" class="data-row">
            <td class="td-date">{{ record.date }}</td>
            <td class="td-project">
              <span class="project-name-text">{{ record.project }}</span>
              <span v-if="record.hasVersions" class="ver-badge mat-well">v{{ record.versionNumber }}</span>
            </td>
            <td>
              <span class="doc-type-badge mat-well" :class="docTypeBadgeClass(record.documentType)">{{ record.documentType }}</span>
            </td>
            <td>
              <div class="hash-tag mat-well" @click="copyHash(record.fullHash || record.hash)" title="Click to copy local hash">
                <i class="fas fa-link"></i> {{ record.hash }}
              </div>
              <a v-if="record.polygonExplorerUrl" :href="record.polygonExplorerUrl" target="_blank" rel="noopener" class="polygon-badge mat-well" title="View transaction on Polygon Explorer">
                <i class="fab fa-ethereum"></i> Polygon
              </a>
            </td>
            <td>
              <span class="status-badge mat-well" :class="record.status === 'On-Chain' ? 'on-chain' : (record.status === 'Verified' ? 'verified' : 'pending')">
                <i class="fas" :class="record.status === 'On-Chain' ? 'fa-cubes' : (record.status === 'Verified' ? 'fa-shield-halved' : 'fa-clock')"></i>
                {{ record.status }}
              </span>
            </td>
            <td class="td-action">
              <button v-if="record.hasVersions" class="btn-history mat-skeuo-sm mat-pressable-sm" @click="openHistoryModal(record)" title="View previous versions">
                <i class="fas fa-history"></i> History
              </button>
              <button class="btn-add-version mat-skeuo-filled mat-pressable-filled" @click="openModal(record)" title="Upload new version of this document">
                <i class="fas fa-code-branch"></i> New Version
              </button>
            </td>
          </tr>
          <tr v-if="filteredLedger.length === 0">
            <td colspan="6" class="empty-row">
              <i class="fas fa-folder-open"></i>
              <p>No records found.</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â ADD / VALIDATE MODAL Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â -->
    <Transition name="fade">
      <div v-if="isModalOpen" class="modal-overlay" @click.self="closeModal">
        <div class="modal-card mat-glass-strong">
          <div class="modal-head">
            <div class="modal-head-left">
              <i class="fas" :class="form.isVersionMode ? 'fa-code-branch' : 'fa-file-shield'"></i>
              <span>{{ form.isVersionMode ? 'Upload New Document Version' : 'Add Government Document' }}</span>
            </div>
            <button class="close-btn mat-skeuo-sm mat-pressable-sm" @click="closeModal"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div v-if="form.isVersionMode" class="version-context-banner">
              <i class="fas fa-info-circle"></i>
              <div>
                <strong>Creating a new version for:</strong> {{ form.title }}
                <p class="ver-banner-sub">The date is locked to today ({{ form.date }}). The previous version will be archived and remain verifiable on the blockchain.</p>
              </div>
            </div>
            <div class="form-grid">
              <div class="form-group"><label>Date</label><input type="date" v-model="form.date" :disabled="form.isVersionMode" class="disabled-look" /></div>
              <div class="form-group"><label>Project Title</label><input type="text" v-model="form.title" placeholder="e.g. Road Construction Phase II" :disabled="form.isVersionMode" class="disabled-look" /></div>
            </div>
            <div class="form-group">
              <label>Document Type</label>
              <select v-model="form.documentType" class="form-select" :disabled="form.isVersionMode" style="opacity: 0.6; cursor: not-allowed;">
                <option value="Project Reports">Project Reports</option>
                <option value="Financial Statements">Financial Statements</option>
                <option value="Executive Orders">Executive Orders</option>
                <option value="Bids and Awards">Bids and Awards</option>
              </select>
            </div>
            <div class="form-group">
              <label>Description / Allocation</label>
              <textarea v-model="form.details" placeholder="Project details and budget allocation..." rows="3"></textarea>
            </div>
            <div v-if="form.isVersionMode" class="form-group">
              <label>Version Note <span style="color:#dc2626">*</span></label>
              <textarea v-model="form.versionNote" placeholder="e.g., Updated budget amounts from 500k to 750k" rows="2" class="ver-note-area"></textarea>
            </div>
            <div class="form-group">
              <label>Government Document (PDF)</label>
              <div class="file-input-wrap" :class="{ 'has-file': form.fileName }">
                <div class="file-drop-zone" v-if="!form.fileName">
                  <i class="fas fa-cloud-arrow-up"></i>
                  <span>Select a PDF document</span>
                  <span class="file-hint">Only PDF files are accepted</span>
                </div>
                <div class="file-selected" v-else>
                  <i class="fas fa-file-pdf"></i>
                  <span>{{ form.fileName }}</span>
                  <button class="file-remove mat-skeuo-sm mat-pressable-danger" @click="resetValidation" type="button"><i class="fas fa-times"></i></button>
                </div>
                <input type="file" @change="handleFileChange" accept=".pdf" />
              </div>
            </div>
            <button class="scan-btn mat-skeuo-sm mat-pressable-sm" :disabled="!form.file || validationState === 'scanning'" @click="scanDocument">
              <i class="fas fa-fingerprint"></i>
              Scan & Validate Document
            </button>
            <div v-if="validationState === 'result' && validationResult" class="val-result-box">
              <div class="val-banner" :class="validationResult.passed ? 'v-pass' : 'v-fail'">
                <div class="val-banner-icon"><i :class="validationResult.passed ? 'fas fa-shield-check' : 'fas fa-triangle-exclamation'"></i></div>
                <div class="val-banner-text">
                  <strong>{{ validationResult.passed ? 'Authentic Government Document' : 'Validation Failed' }}</strong>
                  <span v-if="validationResult.passed">This document meets the authenticity requirements and can be added to the blockchain.</span>
                  <span v-else>This document does not contain the required government identifiers for Municipality of Baco.</span>
                </div>
              </div>
              <div class="score-row">
                <div class="score-circle" :style="{ '--score-pct': validationResult.percentage, '--score-color': scoreColor }">
                  <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--bdr2)" stroke-width="8" /><circle cx="60" cy="60" r="52" fill="none" :stroke="scoreColor" stroke-width="8" stroke-linecap="square" :stroke-dasharray="(validationResult.percentage / 100) * 326.73 + ' 326.73'" class="score-arc" /></svg>
                  <div class="score-inner"><div class="score-num" :style="{ color: scoreColor }">{{ validationResult.percentage }}%</div><div class="score-label">Score</div></div>
                </div>
                <div class="score-meta">
                  <div class="sm-item"><span class="sm-val">{{ foundCount }}</span><span class="sm-lbl">of {{ totalKeywords }} keywords found</span></div>
                  <div class="sm-item"><span class="sm-val">{{ validationResult.score }}</span><span class="sm-lbl">of {{ validationResult.maxScore }} points</span></div>
                  <div class="sm-item" v-if="validationResult.pageCount"><span class="sm-val">{{ validationResult.pageCount }}</span><span class="sm-lbl">pages scanned</span></div>
                  <div class="sm-item"><span class="sm-val" :style="{ color: scoreColor }">{{ validationResult.passed ? 'PASS' : 'FAIL' }}</span><span class="sm-lbl">threshold: {{ 40 }} pts</span></div>
                </div>
              </div>
              <div class="kw-section">
                <div class="kw-title"><i class="fas fa-magnifying-glass-chart"></i> Keyword Analysis</div>
                <div class="kw-grid">
                  <div v-for="kw in validationResult.keywords" :key="kw.keyword" class="kw-chip mat-well" :class="kw.found ? 'kw-found' : 'kw-miss'">
                    <i :class="kw.found ? 'fas fa-check' : 'fas fa-xmark'"></i>
                    <div class="kw-info"><span class="kw-name">{{ kw.keyword }}</span><span class="kw-label">{{ kw.label }}</span></div>
                    <span v-if="kw.required" class="kw-req">Required</span><span class="kw-pts">+{{ kw.weight }}</span>
                  </div>
                </div>
              </div>
              <div v-if="validationResult.errors.length" class="val-errors"><div v-for="err in validationResult.errors" :key="err" class="val-err-line"><i class="fas fa-circle-exclamation"></i> {{ err }}</div></div>
              <div v-if="validationResult.textPreview" class="text-preview-section">
                <div class="tp-title" @click="$refs.tpContent.classList.toggle('tp-collapsed')"><i class="fas fa-file-lines"></i> Extracted Text Preview<i class="fas fa-chevron-down tp-toggle"></i></div>
                <div ref="tpContent" class="tp-content tp-collapsed"><pre>{{ validationResult.textPreview }}Ã¢â‚¬Â¦</pre></div>
              </div>
              <div class="val-actions">
                <button v-if="!validationResult.passed" class="va-btn va-retry mat-skeuo-sm mat-pressable-sm" @click="resetValidation"><i class="fas fa-arrow-rotate-left"></i> Choose Different Document</button>
                <button v-if="canSubmit" class="va-btn va-submit mat-skeuo-filled mat-pressable-filled" @click="submitProject"><i class="fas fa-cubes"></i> {{ form.isVersionMode ? 'Add Version to Blockchain' : 'Add to Blockchain' }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â VERSION HISTORY MODAL Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â -->
    <Transition name="fade">
      <div v-if="isHistoryModalOpen" class="modal-overlay" @click.self="isHistoryModalOpen = false">
        <div class="modal-card history-card mat-glass-strong">
          <div class="modal-head history-head">
            <div class="modal-head-left">
              <i class="fas fa-history"></i>
              <span>Document History</span>
            </div>
            <button class="close-btn mat-skeuo-sm mat-pressable-sm" @click="isHistoryModalOpen = false"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body" style="padding: 0;">
            <div class="history-title-bar">
              <strong>{{ historyRecordTitle }}</strong>
              <span class="ver-count-badge mat-well">{{ historyVersions.length }} Version{{ historyVersions.length !== 1 ? 's' : '' }}</span>
            </div>
            <div v-if="historyVersions.length === 0" class="state-empty">No history found.</div>
            <div v-else class="history-list">
              <div v-for="ver in historyVersions" :key="ver.id" class="history-item" :class="{ 'is-latest': ver.is_latest }">
                <div class="hi-top">
                  <div class="hi-version-info">
                    <span class="hi-ver-num">Version {{ ver.version_number }}</span>
                    <span v-if="ver.is_latest" class="hi-latest-badge mat-well"><i class="fas fa-check-circle"></i> Live on Public Site</span>
                    <span v-else class="hi-archived-badge mat-well"><i class="fas fa-archive"></i> Archived</span>
                  </div>
                  <a v-if="ver.formUrl" :href="ver.formUrl" target="_blank" class="hi-view-btn mat-skeuo-sm mat-pressable-sm">
                    <i class="fas fa-external-link-alt"></i> View File
                  </a>
                </div>
                <div class="hi-details">
                  <div class="hi-detail"><i class="fas fa-calendar-alt"></i> {{ new Date(ver.created_at).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }) }}</div>
                  <div v-if="ver.version_note" class="hi-detail note"><i class="fas fa-sticky-note"></i> {{ ver.version_note }}</div>
                  <div class="hi-detail hash"><i class="fas fa-link"></i> {{ ver.block_hash ? ver.block_hash.substring(0, 20) + '...' : 'No hash' }}</div>
                  <div v-if="ver.polygon_tx_hash" class="hi-detail polygon-detail">
                    <i class="fab fa-ethereum"></i>
                    <a :href="`https://amoy.polygonscan.com/tx/${ver.polygon_tx_hash}`" target="_blank" rel="noopener" class="hi-ext-link">
                      {{ ver.polygon_tx_hash.substring(0, 20) }}...
                    </a>
                  </div>
                  <div v-if="ver.ipfs_cid" class="hi-detail ipfs-detail">
                    <i class="fas fa-cloud"></i>
                    <a :href="`https://gateway.pinata.cloud/ipfs/${ver.ipfs_cid}`" target="_blank" rel="noopener" class="hi-ext-link">
                      IPFS: {{ ver.ipfs_cid.substring(0, 16) }}...
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â CONFLICT RESOLUTION MODAL Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â -->
    <Transition name="fade">
      <div v-if="conflictModal" class="modal-overlay" @click.self="conflictModal = false">
        <div class="modal-card conflict-card mat-glass-strong">
          <div class="modal-head conflict-head">
            <div class="modal-head-left"><i class="fas fa-triangle-exclamation"></i><span>Possible Duplicate Detected</span></div>
          </div>
          <div class="modal-body">
            <div class="conflict-warning-box">
              <p>A document titled <strong>"{{ form.title }}"</strong> already exists on the blockchain (Currently at v{{ conflictData?.currentVersion }}).</p>
              <p class="conflict-sub">Are you uploading an updated version of this document (e.g., with revised amounts), or is this a completely different document that just happens to share the same title?</p>
            </div>
            <div class="conflict-actions">
              <button class="conflict-btn yes-version mat-skeuo-sm mat-pressable-sm" @click="resolveConflict('version')">
                <i class="fas fa-code-branch"></i>
                <div><strong>Yes, it's a New Version</strong><span class="conflict-hint">Archives the old file, links them together</span></div>
              </button>
              <button class="conflict-btn no-duplicate mat-skeuo-sm mat-pressable-sm" @click="resolveConflict('different')">
                <i class="fas fa-pen"></i>
                <div><strong>No, it's a Different Document</strong><span class="conflict-hint">Please change the title above to proceed</span></div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â BLOCKCHAIN VERIFICATION MODAL Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â -->
    <Transition name="fade">
      <div v-if="isChainModalOpen" class="modal-overlay" @click.self="closeChainModal">
        <div class="modal-card chain-modal mat-glass-strong">
          <div class="modal-head chain-head">
            <div class="modal-head-left">
              <i class="fas fa-cubes"></i>
              <span>Blockchain Verification</span>
            </div>
            <button class="close-btn mat-skeuo-sm mat-pressable-sm" @click="closeChainModal"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body chain-body">
            <!-- IDLE STATE -->
            <div v-if="chainVerifyState === 'idle'" class="chain-idle">
              <div class="chain-idle-icon"><i class="fas fa-cubes"></i></div>
              <h3>Verify Entire Blockchain</h3>
              <p>This will validate every block's hash integrity and chain linkage. The process will be logged in the server terminal.</p>
              <button class="chain-start-btn mat-skeuo-sm mat-pressable-sm" @click="verifyBlockchain">
                <i class="fas fa-play"></i> Start Verification
              </button>
            </div>
            <!-- RESULT STATE -->
            <template v-if="chainVerifyState === 'result' && chainResult">
              <div class="chain-summary" :class="chainResult.isValid ? 'cs-valid' : 'cs-invalid'">
                <div class="cs-icon"><i :class="chainResult.isValid ? 'fas fa-shield-check' : 'fas fa-triangle-exclamation'"></i></div>
                <div class="cs-text">
                  <strong>{{ chainResult.isValid ? 'Blockchain Integrity Verified' : 'Blockchain Validation Failed' }}</strong>
                  <span>{{ chainResult.isValid
                    ? `All ${chainResult.blockCount} blocks passed integrity checks.`
                    : (chainResult.failedAt
                      ? `Chain broken at Block #${chainResult.failedAt.blockIndex}: ${chainResult.failedAt.reason}`
                      : (chainResult.error || 'Unknown error'))
                  }}</span>
                </div>
                <div class="cs-meta">
                  <div class="cs-meta-item"><span class="csm-val">{{ chainResult.blockCount }}</span><span class="csm-lbl">Blocks</span></div>
                  <div class="cs-meta-item"><span class="csm-val">{{ chainResult.totalTime }}ms</span><span class="csm-lbl">Time</span></div>
                </div>
              </div>
              <div v-if="chainResult.error" class="val-errors">
                <div class="val-err-line"><i class="fas fa-circle-exclamation"></i> {{ chainResult.error }}</div>
              </div>
              <div v-if="chainBlocks.length > 0" class="chain-blocks-section">
                <div class="chain-blocks-title"><i class="fas fa-link"></i> Mined Blocks</div>
                <div class="chain-blocks-list">
                  <div v-for="blk in chainBlocks" :key="blk.blockIndex" class="chain-block-item" :class="{ 'blk-failed': blk.failed, 'blk-info': blk.step === 'info' }">
                    <template v-if="blk.step === 'info'">
                      <div class="blk-info-msg"><i class="fas fa-info-circle"></i> {{ blk.message }}</div>
                    </template>
                    <template v-else>
                      <div class="blk-header">
                        <div class="blk-num-wrap">
                          <span class="blk-num">#{{ blk.blockIndex }}</span>
                          <span v-if="blk.failed" class="blk-failed-tag mat-well"><i class="fas fa-times-circle"></i> Failed</span>
                          <span v-else class="blk-ok-tag mat-well"><i class="fas fa-check-circle"></i> Verified</span>
                        </div>
                        <span class="blk-time">{{ blk.minedAt }}</span>
                      </div>
                      <div v-if="blk.blockData" class="blk-data">
                        <span class="blk-project"><i class="fas fa-file-alt"></i> {{ blk.blockData.title || 'Untitled' }}</span>
                        <span v-if="blk.blockData.versionNumber" class="blk-ver">v{{ blk.blockData.versionNumber }}</span>
                      </div>
                      <div class="blk-checks">
                        <div v-for="chk in blk.checks" :key="chk.type" class="blk-check" :class="chk.status === 'pass' ? 'bc-pass' : 'bc-fail'">
                          <i :class="chk.status === 'pass' ? 'fas fa-check' : 'fas fa-times'"></i>
                          <div class="bc-info">
                            <span class="bc-label">{{ chk.label }}</span>
                            <span class="bc-detail">{{ chk.detail }}</span>
                          </div>
                          <span v-if="chk.timeMs" class="bc-time">{{ chk.timeMs }}ms</span>
                        </div>
                      </div>
                      <div class="blk-hashes">
                        <div class="blk-hash-row"><span class="bhr-label">Hash</span><code class="bhr-val">{{ blk.hash }}</code></div>
                        <div class="blk-hash-row"><span class="bhr-label">Prev</span><code class="bhr-val">{{ blk.previousHash }}</code></div>
                        <div class="blk-hash-row"><span class="bhr-label">Nonce</span><code class="bhr-val nonce-val">{{ blk.nonce }}</code></div>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
              <div class="chain-actions">
                <button class="va-btn va-retry mat-skeuo-sm mat-pressable-sm" @click="closeChainModal"><i class="fas fa-times"></i> Close</button>
                <button class="va-btn va-submit mat-skeuo-filled mat-pressable-filled" @click="verifyBlockchain"><i class="fas fa-redo"></i> Re-verify</button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
*,*::before,*::after{box-sizing:border-box}
.tala-panel{padding:32px;background:var(--bg);min-height:100%;font-family:var(--font-body);overflow-y:auto}
.panel-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;gap:16px;flex-wrap:wrap}
.header-eyebrow{display:flex;align-items:center;gap:8px;font-size:.62rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--ac);margin-bottom:5px}
.eyebrow-line{width:20px;height:2px;background:var(--ac);border-radius:1px}
.header-left h2{font-family:var(--font-display);font-size:1.6rem;font-weight:700;color:var(--fg);margin:0 0 5px}
.header-left p{font-size:.82rem;color:var(--mt);margin:0}
.add-btn{ display:flex; align-items:center; gap:7px; padding:10px 18px; border-radius:var(--r-sm); font-size:.78rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; font-family:var(--font-body); white-space:nowrap; flex-shrink:0; }
.add-btn:hover{transform:translateY(-2px);box-shadow:0 6px 20px var(--acg)}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;gap:16px;flex-wrap:wrap}
.stats{display:flex;gap:10px;flex-wrap:wrap}
.stat-chip{ display:flex; align-items:center; gap:8px; padding:8px 14px; border-radius:var(--r-sm); font-size:.78rem; }
.stat-chip i{color:var(--mt);font-size:.8rem}
.stat-chip .val{font-weight:800;color:var(--fg)}
.stat-chip .lbl{color:var(--mt);font-weight:500}
.stat-chip.verified i,.stat-chip.verified .val{color:var(--ok)}
.stat-chip.pending i,.stat-chip.pending .val{color:var(--wn)}
.search-box{display:flex;align-items:center;background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r-sm);padding:0 12px;min-width:260px}
.search-box i{color:var(--mt);font-size:.82rem}
.search-box input{border:none;outline:none;padding:9px 10px;width:100%;font-size:.84rem;color:var(--fg);font-family:var(--font-body);background:transparent}
.search-box input::placeholder{color:var(--mt2)}
.data-panel{background:var(--card-solid);border-radius:var(--r-md);overflow:hidden;border:1px solid var(--bdr)}
.panel-bar{background:var(--bg2);padding:13px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--bdr)}
.bar-title{display:flex;align-items:center;gap:8px;font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--fg)}
.bar-title i{color:var(--ac)}
.bar-count{font-size:.7rem;color:var(--mt)}
.data-table{width:100%;border-collapse:collapse}
.data-table thead tr{background:var(--bg3);border-bottom:1px solid var(--bdr)}
.data-table th{padding:11px 16px;text-align:left;font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--mt)}
.data-row{border-bottom:1px solid var(--bdr);transition:background .15s}
.data-row:last-child{border-bottom:none}
.data-row:hover{background:var(--card2)}
.data-table td{padding:14px 16px;vertical-align:middle;font-size:.84rem}
.td-date{color:var(--mt);white-space:nowrap}
.td-project{font-weight:600;color:var(--fg)}
.td-action{width:180px;text-align:right;display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}
.doc-type-badge{ display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:var(--r-sm); font-size:.68rem; font-weight:600; text-transform:uppercase; letter-spacing:.04em; white-space:nowrap; }
.type-project{background:var(--tls);color:var(--tl)}
.type-financial{background:var(--oks);color:var(--ok)}
.type-executive{background:var(--wns);color:var(--wn)}
.type-bids{background:var(--vis);color:var(--vi)}
.hash-tag{ display:inline-flex; align-items:center; gap:6px; font-family:var(--font-mono); font-size:.78rem; padding:4px 10px; border-radius:var(--r-sm); cursor:pointer; }
.hash-tag:hover{background: var(--m-accent-solid);color: #fff}
.status-badge{ display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:var(--r-sm); font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; }
.status-badge.verified{background:var(--oks);color:var(--ok)}
.status-badge.pending{background:var(--wns);color:var(--wn)}
.empty-row{text-align:center;padding:48px 20px!important;color:var(--mt)}
.empty-row i{font-size:1.8rem;display:block;margin-bottom:10px;opacity:.4}
.empty-row p{font-size:.84rem}
.ver-badge{ display:inline-block; padding:1px 6px; font-size:.6rem; font-weight:700; margin-left:8px; vertical-align:middle; font-family:var(--font-body); }
.btn-add-version{ display:inline-flex; align-items:center; gap:5px; padding:6px 10px; font-size:.7rem; font-weight:600; cursor:pointer; font-family:var(--font-body); border-radius:var(--r-sm); }
.btn-add-version:hover{background: var(--m-accent-solid);color: #fff;border-color: var(--m-accent-solid)}
.btn-history{ display:inline-flex; align-items:center; gap:5px; padding:6px 10px; font-size:.7rem; font-weight:600; cursor:pointer; font-family:var(--font-body); border-radius:var(--r-sm); }
.btn-history:hover{border-color:var(--bdr2);color:var(--fg);background:var(--card3)}
/* Ã¢â€â‚¬Ã¢â€â‚¬ Modals Base Ã¢â€â‚¬Ã¢â€â‚¬ */
.modal-overlay{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(3px)}
.modal-card{ width:100%; max-width:600px; border-radius:var(--r-lg); overflow:hidden; max-height:90vh; display:flex; flex-direction:column; }
.modal-head{background:var(--bg2);padding:15px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid var(--ac);flex-shrink:0}
.modal-head-left{display:flex;align-items:center;gap:9px;font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--fg)}
.modal-head-left i{color:var(--ac);font-size:.9rem}
.close-btn{ width:32px; height:32px; border-radius:var(--r-sm); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:.82rem; }
.close-btn:hover{background:var(--dgs);color:var(--dg);border-color:var(--dg)}
.modal-body{padding:22px 20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;flex:1}
/* Ã¢â€â‚¬Ã¢â€â‚¬ History Modal Specifics Ã¢â€â‚¬Ã¢â€â‚¬ */
.history-card{max-width:650px}
.history-head{background:var(--bg2)!important;border-bottom-color:var(--bdr2)!important}
.history-title-bar{padding:16px 20px;background:var(--bg2);border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between;color:var(--fg)}
.ver-count-badge{ font-size:.7rem; font-weight:600; padding:3px 10px; border-radius:12px; }
.state-empty{padding:40px;text-align:center;color:var(--mt)}
.history-list{padding:12px 20px 20px 20px;display:flex;flex-direction:column;gap:12px;max-height:60vh;overflow-y:auto}
.history-item{border:1px solid var(--bdr);border-radius:var(--r-sm);padding:16px;transition:all .2s;background:var(--bg2)}
.history-item.is-latest{border-color:var(--ok);background:var(--oks)}
.history-item:hover{box-shadow:var(--shadow-sm)}
.hi-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.hi-version-info{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.hi-ver-num{font-weight:700;color:var(--fg);font-size:.9rem}
.hi-latest-badge{ display:inline-flex; align-items:center; gap:4px; font-size:.68rem; font-weight:600; padding:3px 10px; border-radius:12px; }
.hi-archived-badge{ display:inline-flex; align-items:center; gap:4px; font-size:.68rem; font-weight:500; padding:3px 10px; border-radius:12px; }
.hi-view-btn{ display:inline-flex; align-items:center; gap:6px; padding:6px 14px; border-radius:var(--r-sm); font-size:.72rem; font-weight:600; text-decoration:none; cursor:pointer; }
.hi-view-btn:hover{background:var(--ac2)}
.hi-details{display:flex;flex-direction:column;gap:6px}
.hi-detail{display:flex;align-items:center;gap:8px;font-size:.78rem;color:var(--mt)}
.hi-detail i{width:14px;text-align:center;color:var(--mt2)}
.hi-detail.hash{font-family:var(--font-mono);font-size:.72rem;color:var(--mt);background:var(--bg3);padding:4px 8px;border-radius:var(--r-sm);word-break:break-all}
.hi-detail.note{color:var(--tl);background:var(--tls);padding:6px 8px;border-radius:var(--r-sm);font-style:italic}
/* Ã¢â€â‚¬Ã¢â€â‚¬ Form Elements Ã¢â€â‚¬Ã¢â€â‚¬ */
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.form-group{display:flex;flex-direction:column;gap:5px}
.form-group label{font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--mt)}
.form-group input,.form-group textarea,.form-select{padding:10px 12px;border:1px solid var(--bdr);border-radius:var(--r-sm);font-size:.84rem;color:var(--fg);font-family:var(--font-body);background:var(--bg2);transition:border-color .2s,background .2s;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23c9c9d4' d='M6 8L1 3h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px}
.form-group input:focus,.form-group textarea:focus,.form-select:focus{outline:none;border-color:var(--ac);background:var(--bg3)}
.form-group textarea{resize:vertical}
.version-context-banner{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;background:var(--tls);border:1px solid var(--tl);border-radius:var(--r-sm);font-size:.84rem;color:var(--tl);line-height:1.5}
.version-context-banner i{margin-top:2px;font-size:1.1rem}
.version-context-banner strong{color:var(--tl)}
.ver-banner-sub{margin:4px 0 0;font-size:.78rem;color:var(--mt)}
.disabled-look:disabled{background:var(--bg3)!important;color:var(--mt2)!important;cursor:not-allowed;border-color:var(--bdr)!important}
.ver-note-area{border:1.5px dashed var(--tl)!important;background:var(--bg2)!important}
.ver-note-area:focus{outline:none;border-color:var(--tl)!important;box-shadow:0 0 0 3px var(--tls)}
.file-input-wrap{position:relative;border:1.5px dashed var(--bdr2);border-radius:var(--r-sm);background:var(--bg2);transition:all .2s;cursor:pointer}
.file-input-wrap:hover{border-color:var(--ac);background:var(--acs)}
.file-input-wrap.has-file{border-color:var(--ok);background:var(--oks);border-style:solid}
.file-input-wrap input[type="file"]{position:absolute;inset:0;opacity:0;cursor:pointer}
.file-drop-zone{display:flex;flex-direction:column;align-items:center;gap:6px;padding:24px 16px;text-align:center}
.file-drop-zone i{font-size:1.6rem;color:var(--mt)}
.file-drop-zone span{font-size:.84rem;color:var(--fg2);font-weight:500}
.file-hint{font-size:.72rem!important;color:var(--mt2)!important;font-weight:400!important}
.file-selected{display:flex;align-items:center;gap:10px;padding:14px 16px}
.file-selected>i{font-size:1.3rem;color:var(--ok)}
.file-selected>span{flex:1;font-size:.84rem;font-weight:500;color:var(--fg)}
.file-remove{ width:26px; height:26px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:.72rem; }
.file-remove:hover{background: var(--dg-solid);color: #fff;border-color: var(--dg-solid)}
.scan-btn{ display:flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:12px; border-radius:var(--r-sm); font-size:.82rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; font-family:var(--font-body); }
.scan-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 6px 20px var(--acg)}
.scan-btn:disabled{opacity:.5;cursor:not-allowed}
.val-result-box{display:flex;flex-direction:column;gap:14px;animation:valFadeIn .4s ease both}
@keyframes valFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.val-banner{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-radius:var(--r-sm);border:1px solid}
.v-pass{background:var(--oks);border-color:var(--okg)}
.v-fail{background:var(--dgs);border-color:var(--dgg)}
.val-banner-icon{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0}
.v-pass .val-banner-icon{background:var(--okg);color:var(--ok)}
.v-fail .val-banner-icon{background:var(--dgg);color:var(--dg)}
.val-banner-text{flex:1}
.val-banner-text strong{display:block;font-size:.88rem;margin-bottom:3px}
.v-pass .val-banner-text strong{color:var(--ok)}
.v-fail .val-banner-text strong{color:var(--dg)}
.val-banner-text span{font-size:.78rem;color:var(--fg2);line-height:1.5}
.score-row{display:flex;align-items:center;gap:20px;padding:4px 0}
.score-circle{position:relative;width:100px;height:100px;flex-shrink:0}
.score-circle svg{width:100%;height:100%;transform:rotate(-90deg)}
.score-arc{transition:stroke-dasharray .8s cubic-bezier(.16,1,.3,1)}
.score-inner{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.score-num{font-size:1.3rem;font-weight:800;line-height:1}
.score-label{font-size:.58rem;color:var(--mt);text-transform:uppercase;letter-spacing:.1em;margin-top:2px}
.score-meta{display:flex;flex-direction:column;gap:5px}
.sm-item{display:flex;align-items:baseline;gap:6px}
.sm-val{font-size:.9rem;font-weight:700;color:var(--fg)}
.sm-lbl{font-size:.72rem;color:var(--mt)}
.kw-section{border:1px solid var(--bdr);border-radius:var(--r-sm);overflow:hidden}
.kw-title{display:flex;align-items:center;gap:7px;padding:10px 14px;background:var(--bg2);border-bottom:1px solid var(--bdr);font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--fg2)}
.kw-title i{color:var(--ac)}
.kw-grid{display:flex;flex-direction:column}
.kw-chip{ display:flex; align-items:center; gap:8px; padding:8px 14px; border-bottom:1px solid var(--bdr); font-size:.78rem; }
.kw-chip:last-child{border-bottom:none}
.kw-chip>i{font-size:.72rem;flex-shrink:0}
.kw-found{background:var(--oks)}
.kw-found>i{color:var(--ok)}
.kw-miss{background:var(--dgs)}
.kw-miss>i{color:var(--dg)}
.kw-info{flex:1;min-width:0}
.kw-name{display:block;font-weight:600;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kw-label{display:block;font-size:.66rem;color:var(--mt)}
.kw-req{font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:2px 6px;background:var(--wns);color:var(--wn);border:1px solid var(--wng);white-space:nowrap}
.kw-pts{font-size:.68rem;font-weight:600;color:var(--mt);white-space:nowrap}
.kw-found .kw-pts{color:var(--ok)}
.val-errors{display:flex;flex-direction:column;gap:5px}
.val-err-line{display:flex;align-items:center;gap:7px;padding:8px 12px;background:var(--dgs);border:1px solid var(--dgg);font-size:.78rem;color:var(--dg)}
.val-err-line i{flex-shrink:0}
.text-preview-section{border:1px solid var(--bdr);border-radius:var(--r-sm);overflow:hidden}
.tp-title{display:flex;align-items:center;gap:7px;padding:10px 14px;background:var(--bg2);border-bottom:1px solid var(--bdr);font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--fg2);cursor:pointer;user-select:none}
.tp-title i:first-child{color:var(--ac)}
.tp-toggle{margin-left:auto;color:var(--mt);font-size:.68rem;transition:transform .2s}
.tp-content{max-height:200px;overflow-y:auto;transition:max-height .3s ease}
.tp-content.tp-collapsed{max-height:0;overflow:hidden}
.tp-content pre{padding:12px 14px;font-size:.72rem;color:var(--fg2);font-family:var(--font-mono);line-height:1.6;white-space:pre-wrap;word-break:break-word;margin:0}
.val-actions{display:flex;gap:10px}
.va-btn{ flex:1; display:flex; align-items:center; justify-content:center; gap:7px; padding:12px; border-radius:var(--r-sm); font-size:.82rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; font-family:var(--font-body); }
.va-retry{background:var(--bg2);color:var(--fg2);border:1.5px solid var(--bdr)}
.va-retry:hover{border-color:var(--bdr2);color:var(--fg)}
.va-submit:hover{filter:brightness(1.1)}
.conflict-card{max-width:520px}
.conflict-head{background:var(--bg2)!important;border-bottom-color:var(--wn)!important}
.conflict-head .modal-head-left i{color:var(--wn)!important}
.conflict-warning-box{background:var(--wns);border:1px solid var(--wng);padding:18px;margin-bottom:20px;font-size:.88rem;color:var(--wn2);line-height:1.6;border-radius:var(--r-sm)}
.conflict-warning-box strong{color:var(--wn)}
.conflict-sub{margin-top:10px;font-size:.84rem;color:var(--fg2)}
.conflict-actions{display:flex;flex-direction:column;gap:10px}
.conflict-btn{ display:flex; align-items:center; gap:14px; padding:16px; cursor:pointer; font-family:var(--font-body); text-align:left; border-radius:var(--r-sm); }
.conflict-btn:hover{border-color:var(--ac);background:var(--acs)}
.conflict-btn i{font-size:1.2rem;flex-shrink:0}
.yes-version{border-color:var(--ac);background:var(--acs)}
.yes-version i{color:var(--ac)}
.no-duplicate i{color:var(--mt)}
.conflict-btn strong{display:block;font-size:.88rem;color:var(--fg);margin-bottom:2px}
.conflict-hint{display:block;font-size:.7rem;color:var(--mt);margin-top:2px}
.fade-enter-active,.fade-leave-active{transition:opacity .22s ease}
.fade-enter-from,.fade-leave-to{opacity:0}
/* Ã¢â€â‚¬Ã¢â€â‚¬ Chain Verify Button Ã¢â€â‚¬Ã¢â€â‚¬ */
.chain-verify-btn{ display:flex; align-items:center; gap:7px; padding:10px 18px; border-radius:var(--r-sm); font-size:.78rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; font-family:var(--font-body); white-space:nowrap; flex-shrink:0; }
.chain-verify-btn:hover{background:var(--wn);color:var(--fg)}
/* Ã¢â€â‚¬Ã¢â€â‚¬ Chain Modal Ã¢â€â‚¬Ã¢â€â‚¬ */
.chain-modal{ max-width:720px; }
.chain-head{background:linear-gradient(135deg,var(--bg2),var(--bg3))!important;border-bottom-color:var(--wn)!important}
.chain-body{padding:0!important}
.chain-idle{display:flex;flex-direction:column;align-items:center;gap:16px;padding:48px 32px;text-align:center}
.chain-idle-icon{width:72px;height:72px;background:var(--bg2);border:2px solid var(--bdr);display:flex;align-items:center;justify-content:center;font-size:1.8rem;color:var(--wn)}
.chain-idle h3{font-family:var(--font-display);font-size:1.3rem;color:var(--fg);margin:0}
.chain-idle p{font-size:.84rem;color:var(--mt);max-width:400px;line-height:1.6;margin:0}
.chain-start-btn{ display:inline-flex; align-items:center; gap:8px; padding:12px 28px; border-radius:var(--r-md); font-size:.82rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; cursor:pointer; font-family:var(--font-body); margin-top:8px; }
.chain-start-btn:hover{transform:translateY(-2px);box-shadow:0 6px 20px var(--acg)}
.chain-summary{display:flex;align-items:flex-start;gap:16px;padding:20px;border:1px solid}
.cs-valid{background:var(--oks);border-color:var(--okg)}
.cs-invalid{background:var(--dgs);border-color:var(--dgg)}
.cs-icon{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0}
.cs-valid .cs-icon{background:var(--okg);color:var(--ok)}
.cs-invalid .cs-icon{background:var(--dgg);color:var(--dg)}
.cs-text{flex:1}
.cs-text strong{display:block;font-size:1rem;margin-bottom:4px}
.cs-valid .cs-text strong{color:var(--ok)}
.cs-invalid .cs-text strong{color:var(--dg)}
.cs-text span{font-size:.82rem;color:var(--fg2);line-height:1.5}
.cs-meta{display:flex;gap:16px;flex-shrink:0}
.cs-meta-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 14px;background:var(--bg2);border-radius:var(--r-sm)}
.csm-val{font-size:1rem;font-weight:800;color:var(--fg);font-variant-numeric:tabular-nums}
.csm-lbl{font-size:.6rem;color:var(--mt);text-transform:uppercase;letter-spacing:.08em}
.chain-blocks-section{border-top:1px solid var(--bdr)}
.chain-blocks-title{display:flex;align-items:center;gap:8px;padding:12px 20px;background:var(--bg2);border-bottom:1px solid var(--bdr);font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--fg2);position:sticky;top:0;z-index:1}
.chain-blocks-title i{color:var(--wn)}
.chain-blocks-list{max-height:45vh;overflow-y:auto}
.chain-block-item{border-bottom:1px solid var(--bdr)}
.chain-block-item:last-child{border-bottom:none}
.chain-block-item.blk-failed{background:var(--dgs)}
.blk-info-msg{display:flex;align-items:center;gap:10px;padding:20px;font-size:.88rem;color:var(--mt)}
.blk-header{display:flex;justify-content:space-between;align-items:center;padding:12px 20px;background:var(--bg2);border-bottom:1px solid var(--bdr)}
.blk-num-wrap{display:flex;align-items:center;gap:10px}
.blk-num{font-size:.9rem;font-weight:800;color:var(--fg);font-variant-numeric:tabular-nums}
.blk-failed-tag{ display:inline-flex; align-items:center; gap:4px; font-size:.65rem; font-weight:700; padding:2px 8px; border-radius:10px; }
.blk-ok-tag{ display:inline-flex; align-items:center; gap:4px; font-size:.65rem; font-weight:600; padding:2px 8px; border-radius:10px; }
.blk-time{font-size:.72rem;color:var(--mt)}
.blk-data{display:flex;align-items:center;gap:10px;padding:10px 20px;border-bottom:1px solid var(--bdr)}
.blk-project{font-size:.82rem;font-weight:600;color:var(--fg);display:flex;align-items:center;gap:6px}
.blk-project i{color:var(--mt);font-size:.72rem}
.blk-ver{font-size:.6rem;font-weight:700;color:var(--tl);background:var(--tls);padding:1px 6px;border:1px solid transparent}
.blk-checks{padding:8px 20px;display:flex;flex-direction:column;gap:4px}
.blk-check{display:flex;align-items:flex-start;gap:8px;padding:6px 10px;border-radius:var(--r-sm);font-size:.76rem}
.bc-pass{background:var(--oks)}
.bc-pass>i{color:var(--ok)}
.bc-fail{background:var(--dgs)}
.bc-fail>i{color:var(--dg)}
.bc-info{flex:1}
.bc-label{display:block;font-weight:700;color:var(--fg);font-size:.74rem}
.bc-detail{display:block;font-size:.7rem;color:var(--mt);margin-top:1px;word-break:break-word}
.bc-time{font-size:.65rem;color:var(--mt2);font-variant-numeric:tabular-nums;flex-shrink:0;margin-top:2px}
.blk-hashes{padding:8px 20px 14px;display:flex;flex-direction:column;gap:3px}
.blk-hash-row{display:flex;align-items:baseline;gap:8px}
.bhr-label{font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--mt2);width:42px;flex-shrink:0}
.bhr-val{font-family:var(--font-mono);font-size:.68rem;color:var(--mt);word-break:break-all;line-height:1.5}
.nonce-val{color:var(--wn);font-weight:700}
.chain-actions{display:flex;gap:10px;padding:16px 20px;border-top:1px solid var(--bdr);background:var(--bg2)}
@media(max-width:768px){
.tala-panel{padding:20px 16px}
.toolbar{flex-direction:column;align-items:stretch}
.search-box{min-width:unset}
.data-table th:nth-child(4),.data-table td:nth-child(4),.data-table th:nth-child(6),.data-table td:nth-child(6){display:none}
.form-grid{grid-template-columns:1fr}
.score-row{flex-direction:column;align-items:flex-start}
.modal-card{max-height:95vh}
.val-actions{flex-direction:column}
.td-action{width:100%;justify-content:center}
.chain-summary{flex-direction:column}
.cs-meta{align-self:flex-start}
.blk-header{flex-direction:column;align-items:flex-start;gap:4px}
.chain-actions{flex-direction:column}
}
/* Ã¢â€â‚¬Ã¢â€â‚¬ Polygon + IPFS Badges Ã¢â€â‚¬Ã¢â€â‚¬ */
.polygon-badge{ display:inline-flex; align-items:center; gap:4px; padding:3px 8px; margin-top:5px; font-size:.6rem; font-weight:700; text-decoration:none; border-radius:var(--r-sm); letter-spacing:.04em; text-transform:uppercase; }
.polygon-badge:hover{opacity:.85}
.polygon-badge i{font-size:.66rem}
.status-badge.on-chain{background:var(--vis);color:var(--vi);border:1px solid transparent}
.stat-chip.on-chain-stat i,.stat-chip.on-chain-stat .val{color:var(--vi)}
.hi-detail.polygon-detail i{color:#8247e5}
.hi-detail.ipfs-detail i{color:var(--tl)}
.hi-ext-link{color:var(--vi);text-decoration:none;font-family:var(--font-mono);font-size:.7rem;word-break:break-all}
.hi-detail.ipfs-detail .hi-ext-link{color:var(--tl)}
.hi-ext-link:hover{text-decoration:underline}

</style>