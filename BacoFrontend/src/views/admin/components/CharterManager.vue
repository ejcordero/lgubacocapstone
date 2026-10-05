<script setup>
import { ref, onMounted } from 'vue'
import { handleAdminAuthError } from '../../../utils/adminAuth'
import { API } from '@/api'

const logChange = async (section, entityId, entityTitle, action, changes) => {
  const token = localStorage.getItem('baco_admin_token')
  if (!token) return
  try {
    await fetch(`${API}/admin/content-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ section, entityId: String(entityId || ''), entityTitle, action, changes })
    })
  } catch (e) { console.error('Log error:', e) }
}

const API_BASE = API
const charterData = ref(null)
const loading = ref(true)
const error = ref(null)
const uploading = ref(false)
const successMsg = ref('')
const errorMsg = ref('')
const selectedFile = ref(null)
const fileInput = ref(null)
const getToken = () => localStorage.getItem('baco_admin_token') || ''

const fetchCharter = async () => {
  loading.value = true; error.value = null
  try {
    const token = getToken(); const headers = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(`${API_BASE}/admin/citizens-charter`, { headers })
    if (!res.ok) {
      if (handleAdminAuthError(res)) return
      throw new Error('Failed to fetch charter info')
    }
    const data = await res.json()
    charterData.value = data.exists ? data : null
  } catch (err) { console.error('Failed to fetch charter:', err); error.value = 'Failed to load charter information.' }
  finally { loading.value = false }
}

const onFileChange = (e) => {
  const file = e.target.files?.[0]; if (!file) return
  if (file.type !== 'application/pdf') { errorMsg.value = 'Only PDF files are allowed.'; return }
  if (file.size > 50 * 1024 * 1024) { errorMsg.value = 'File size must be less than 50MB.'; return }
  selectedFile.value = file; errorMsg.value = ''
}

const formatFileSize = (bytes) => {
  if (!bytes) return ''
  const sizes = ['Bytes', 'KB', 'MB', 'GB']; const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i]
}

const uploadCharter = async () => {
  if (!selectedFile.value) { errorMsg.value = 'Please select a PDF file first.'; return }
  const token = getToken()
  if (!token) { errorMsg.value = 'Authentication required. Please log in.'; return }
  uploading.value = true; errorMsg.value = ''; successMsg.value = ''
  const previousFileName = charterData.value?.originalName || null
  const previousFileSize = charterData.value?.fileSize || null
  const fd = new FormData(); fd.append('charterPdf', selectedFile.value)
  try {
    const res = await fetch(`${API_BASE}/admin/citizens-charter`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd })
    const data = await res.json()
    if (!res.ok) {
      if (handleAdminAuthError(res)) return
      throw new Error(data.error || 'Upload failed')
    }
    const isReplacement = !!previousFileName
    if (isReplacement) { await logChange('charter', data.id, data.originalName || 'Citizens Charter', 'update', { file: { old: previousFileName, new: data.originalName }, size: { old: formatFileSize(previousFileSize), new: formatFileSize(data.fileSize) } }) }
    else { await logChange('charter', data.id, data.originalName || 'Citizens Charter', 'create', { file: { new: data.originalName }, size: { new: formatFileSize(data.fileSize) } }) }
    successMsg.value = 'Citizens Charter uploaded successfully!'; selectedFile.value = null
    if (fileInput.value) fileInput.value.value = ''; await fetchCharter(); setTimeout(() => { successMsg.value = '' }, 4000)
  } catch (err) { errorMsg.value = err.message || 'Failed to upload charter.' }
  finally { uploading.value = false }
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
onMounted(() => { fetchCharter() })
</script>

<template>
  <div class="charter-manager">
    <div class="mod-header">
      <div class="mh-left">
        <i class="fas fa-file-pdf"></i>
        <div><h2>Citizen's Charter</h2><p>Upload or replace the municipality's Citizens Charter PDF document</p></div>
      </div>
    </div>
    <div v-if="error" class="state-box error"><i class="fas fa-exclamation-triangle"></i><p>{{ error }}</p><button @click="fetchCharter" class="retry-btn mat-skeuo-sm mat-pressable-sm"><i class="fas fa-rotate-right"></i> Retry</button></div>
    <div v-else class="charter-content">
      <div class="charter-toasts">
        <Transition name="msg"><div v-if="successMsg" class="toast success"><i class="fas fa-circle-check"></i> {{ successMsg }}</div></Transition>
        <Transition name="msg"><div v-if="errorMsg" class="toast error"><i class="fas fa-circle-exclamation"></i> {{ errorMsg }}</div></Transition>
      </div>
      <div class="current-charter-card">
        <div class="card-header">
          <div class="ch-icon"><i class="fas fa-file-pdf"></i></div>
          <div class="ch-info">
            <h3>{{ charterData ? 'Current Citizens Charter' : 'No Charter Uploaded' }}</h3>
            <p v-if="!charterData">Upload a PDF document to make the Citizens Charter available to the public.</p>
          </div>
        </div>
        <div v-if="charterData" class="card-details">
          <div class="detail-row"><span class="detail-label">File Name</span><span class="detail-value">{{ charterData.originalName }}</span></div>
          <div class="detail-row"><span class="detail-label">File Size</span><span class="detail-value">{{ formatFileSize(charterData.fileSize) }}</span></div>
          <div class="detail-row"><span class="detail-label">Uploaded At</span><span class="detail-value">{{ formatDate(charterData.uploadedAt) }}</span></div>
          <div class="detail-row"><span class="detail-label">Last Updated</span><span class="detail-value">{{ formatDate(charterData.updatedAt) }}</span></div>
        </div>
      </div>
      <div class="upload-section">
        <div class="upload-header">
          <i class="fas fa-cloud-arrow-up"></i>
          <div><h3>{{ charterData ? 'Replace Citizens Charter' : 'Upload Citizens Charter' }}</h3><p>{{ charterData ? 'Uploading a new file will replace the current charter.' : 'Select a PDF file to upload as the Citizens Charter.' }}</p></div>
        </div>
        <div class="upload-area" :class="{ 'has-file': selectedFile }" @click="fileInput?.click()">
          <input ref="fileInput" type="file" accept=".pdf,application/pdf" class="hidden-input" @change="onFileChange" />
          <template v-if="!selectedFile">
            <div class="upload-icon"><i class="fas fa-file-pdf"></i></div>
            <p class="upload-text">Click to select PDF file</p>
            <p class="upload-hint">PDF only Â· Maximum 50MB</p>
          </template>
          <template v-else>
            <div class="selected-file">
              <div class="sf-icon"><i class="fas fa-file-pdf"></i></div>
              <div class="sf-info"><span class="sf-name">{{ selectedFile.name }}</span><span class="sf-size">{{ formatFileSize(selectedFile.size) }}</span></div>
              <button class="sf-remove mat-skeuo-sm mat-pressable-danger" @click.stop="selectedFile = null; if(fileInput) fileInput.value = ''"><i class="fas fa-xmark"></i></button>
            </div>
          </template>
        </div>
        <div class="upload-actions">
          <button class="upload-btn mat-skeuo-sm mat-pressable-sm" :disabled="!selectedFile || uploading" @click="uploadCharter">
            <i class="fas fa-upload"></i>
            {{ charterData ? 'Replace Charter' : 'Upload Charter' }}
          </button>
        </div>
      </div>
      <div class="warning-note"><i class="fas fa-info-circle"></i><p>The Citizens Charter will be publicly visible on the municipality website. Ensure the document is complete and accurate before uploading.</p></div>
    </div>
  </div>
</template>

<style scoped>
.charter-manager { padding: 32px 28px; font-family: var(--font-body); background: var(--bg); min-height: 100%; }
.mod-header { display: flex; justify-content: space-between; align-items: flex-start; margin: 0 auto 24px; width: 100%; max-width: 1240px; }
.mh-left { display: flex; align-items: center; gap: 14px; }
.mh-left > i { font-size: 1.8rem; color: var(--ac); }
.mh-left h2 { margin: 0; font-family: var(--font-display); font-size: 1.4rem; color: var(--fg); font-weight: 700; }
.mh-left p { margin: 3px 0 0; font-size: 0.82rem; color: var(--mt); }
.state-box { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; color: var(--mt); background: var(--card-solid); border: 1px solid var(--bdr); border-radius: var(--r-md); }
.state-box i { font-size: 2.2rem; margin-bottom: 14px; }
.state-box.error i { color: var(--dg); }
.state-box p { font-size: 0.88rem; margin: 0; }
.retry-btn { margin-top: 14px; padding: 9px 20px; border-radius: var(--r-sm); font-family: var(--font-body); font-size: 0.82rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 7px; }
.retry-btn:hover { background: var(--ac2); transform: translateY(-2px); }
.toast { padding: 12px 16px; display: flex; align-items: center; gap: 10px; font-size: 0.85rem; font-weight: 500; border-radius: var(--r-sm); }
.toast.success { background: var(--oks); color: var(--ok); border: 1px solid var(--okg); }
.toast.error { background: var(--dgs); color: var(--dg); border: 1px solid var(--dgg); }
.charter-content { width: 100%; max-width: 1240px; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); gap: 20px; align-items: start; }
.charter-toasts { grid-column: 1 / -1; display: flex; flex-direction: column; gap: 10px; }
.current-charter-card { background: var(--card-solid); border: 1px solid var(--bdr); border-radius: var(--r-md); overflow: hidden; }
.card-header { display: flex; align-items: center; gap: 16px; padding: 18px 24px; background: var(--bg2); border-bottom: 1px solid var(--bdr); }
.ch-icon { width: 48px; height: 48px; border-radius: var(--r-sm); background: var(--acs); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ch-icon i { font-size: 1.3rem; color: var(--ac); }
.ch-info h3 { margin: 0 0 4px; font-size: 1rem; font-weight: 700; color: var(--fg); }
.ch-info p { margin: 0; font-size: 0.84rem; color: var(--mt); }
.card-details { padding: 20px 24px; }
.detail-row { display: flex; justify-content: space-between; align-items: baseline; gap: 18px; padding: 11px 0; border-bottom: 1px solid var(--bdr); }
.detail-row:last-child { border-bottom: none; padding-bottom: 0; }
.detail-row:first-child { padding-top: 0; }
.detail-label { font-size: 0.82rem; font-weight: 600; color: var(--mt); flex-shrink: 0; }
.detail-value { font-size: 0.85rem; color: var(--fg); text-align: right; overflow-wrap: anywhere; }
.upload-section { background: var(--card-solid); border: 1px solid var(--bdr); border-radius: var(--r-md); overflow: hidden; }
.upload-header { display: flex; align-items: center; gap: 14px; padding: 18px 24px; background: var(--bg2); border-bottom: 1px solid var(--bdr); }
.upload-header > i { font-size: 1.2rem; color: var(--ac); }
.upload-header h3 { margin: 0 0 2px; font-size: 0.92rem; font-weight: 700; color: var(--fg); }
.upload-header p { margin: 0; font-size: 0.78rem; color: var(--mt); }
.upload-area { padding: 40px 24px; text-align: center; cursor: pointer; transition: all 0.2s; border: 2px dashed var(--bdr2); margin: 20px; border-radius: var(--r-md); position: relative; }
.upload-area:hover { border-color: var(--ac); background: var(--acs); }
.upload-area.has-file { border-color: var(--ok); border-style: solid; background: var(--oks); }
.hidden-input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.upload-icon { width: 64px; height: 64px; border-radius: 50%; background: var(--bg2); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
.upload-icon i { font-size: 1.6rem; color: var(--mt); }
.upload-text { margin: 0 0 6px; font-size: 0.92rem; font-weight: 600; color: var(--fg); }
.upload-hint { margin: 0; font-size: 0.78rem; color: var(--mt); }
.selected-file { display: flex; align-items: center; gap: 14px; text-align: left; }
.sf-icon { width: 44px; height: 44px; border-radius: var(--r-sm); background: var(--ok); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.sf-icon i { font-size: 1.1rem; color: white; }
.sf-info { flex: 1; min-width: 0; }
.sf-name { display: block; font-weight: 600; font-size: 0.88rem; color: var(--fg); word-break: break-all; }
.sf-size { font-size: 0.78rem; color: var(--mt); }
.sf-remove { width: 32px; height: 32px; border-radius: var(--r-sm); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; flex-shrink: 0; }
.sf-remove:hover { background: var(--dg-solid); color: white; }
.upload-actions { padding: 0 20px 20px; display: flex; justify-content: flex-end; }
.upload-btn { display: inline-flex; align-items: center; gap: 8px; padding: 11px 28px; border-radius: var(--r-sm); font-family: var(--font-body); font-size: 0.85rem; font-weight: 700; cursor: pointer; }
.upload-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px var(--acg); }
.upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.warning-note { display: flex; align-items: flex-start; gap: 12px; padding: 16px 20px; background: var(--wns); border: 1px solid var(--wng); border-radius: var(--r-md); grid-column: 1 / -1; }
.warning-note i { color: var(--wn); font-size: 1rem; margin-top: 2px; flex-shrink: 0; }
.warning-note p { margin: 0; font-size: 0.82rem; color: var(--wn2); line-height: 1.6; }
.msg-enter-active, .msg-leave-active { transition: all 0.22s ease; }
.msg-enter-from, .msg-leave-to { opacity: 0; transform: translateY(-6px); }
@media (max-width: 900px) {
  .charter-content { grid-template-columns: 1fr; }
  .warning-note { grid-column: auto; }
}
@media (max-width: 640px) {
  .charter-manager { padding: 16px; }
  .mod-header, .charter-content { max-width: 100%; }
  .card-header { flex-direction: column; text-align: center; }
  .upload-area { padding: 28px 16px; margin: 14px; }
  .selected-file { flex-direction: column; text-align: center; }
  .upload-actions { padding: 0 14px 16px; }
  .upload-btn { width: 100%; justify-content: center; }
}

</style>