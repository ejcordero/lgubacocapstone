<script setup>
import { ref, watch, computed } from 'vue'
import UserTable from './components/UserTable.vue'
import TalaDashboard from './components/TalaDashboard.vue'
import DocumentRequests from './components/DocumentRequests.vue'
import DashboardOverview from './components/DashboardOverview.vue'
import HalconManager from './components/HalconManager.vue'
import BookingMonitor from './components/BookingMonitor.vue'
import AdminHotel from './components/AdminHotel.vue'
import BarangayManager from './components/BarangayManager.vue'
import HistoryManager from './components/HistoryManager.vue'
import NewsUpdatesManager from './components/NewsUpdatesManager.vue'
import CharterManager from './components/CharterManager.vue'
import TourismDestination from './components/TourismDestination.vue'
import ResortsManager from './components/ResortsManager.vue'
import OfficialsManager from './components/OfficialsManager.vue'
import SchoolsManager from './components/SchoolsManager.vue'
import AdminOffices from './components/AdminOffices.vue' 
// CHANGED: MHO page content editor â€” replaces the old health-services preview + dock
import MHOAdmin from './components/MHOAdmin.vue'
import { API } from '@/api'

const props = defineProps(['mode'])
const emit = defineEmits(['change-mode'])

const authHeaders = () => {
  const token = localStorage.getItem('baco_admin_token')
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

// â”€â”€ Content History State â”€â”€
const historyData = ref([])
const historyLoading = ref(false)
const expandedSections = ref({})
const expandedEntries = ref({})

// CHANGED: 'health_services' section replaced with 'mho' â€” the MHO page content
// endpoints in web.js log under section 'mho' (mho_page_info / mho_services)
const historySections = [
  { id: 'mho',             label: 'MHO Page Content',      icon: 'fa-heart-pulse' },
  { id: 'news',            label: 'News & Updates',        icon: 'fa-newspaper' },
  { id: 'barangays',       label: 'Barangays',             icon: 'fa-map' },
  { id: 'municipality',    label: 'Municipality Page',     icon: 'fa-map-location-dot' },
  { id: 'history',         label: 'History Page',          icon: 'fa-landmark' },
  { id: 'charter',         label: "Citizen's Charter",     icon: 'fa-file-pdf' },
  { id: 'tourism',         label: 'Tourism Destinations',  icon: 'fa-umbrella-beach' },
  { id: 'officials',       label: 'Elected Officials',     icon: 'fa-landmark' },
  { id: 'schools',         label: 'Schools Directory',     icon: 'fa-graduation-cap' },
  { id: 'tala',            label: 'TALA Documents',        icon: 'fa-file-invoice-dollar' },
  { id: 'hotels',          label: 'Hotels & Rooms',        icon: 'fa-hotel' },
  { id: 'home_sections',   label: 'Home Page Sections',    icon: 'fa-home' },
]

const sectionChangeCounts = computed(() => {
  const counts = {}
  for (const s of historySections) counts[s.id] = 0
  for (const entry of historyData.value) {
    if (counts[entry.section] !== undefined) counts[entry.section]++
  }
  return counts
})

const fetchHistory = async () => {
  historyLoading.value = true
  const start = Date.now()
  try {
    const res = await fetch(`${API}/admin/content-history`, {
      headers: authHeaders()
    })
    historyData.value = await res.json()
  } catch (e) { console.error('History fetch error:', e) }
  const elapsed = Date.now() - start
  if (elapsed < 500) await new Promise(r => setTimeout(r, 500 - elapsed))
  historyLoading.value = false
}

const toggleSection = (sectionId) => { expandedSections.value[sectionId] = !expandedSections.value[sectionId] }
const toggleEntry = (entryId) => { expandedEntries.value[entryId] = !expandedEntries.value[entryId] }
const isSectionExpanded = (sectionId) => !!expandedSections.value[sectionId]
const isEntryExpanded = (entryId) => !!expandedEntries.value[entryId]
const getEntriesForSection = (sectionId) => historyData.value.filter(e => e.section === sectionId)

const actionBadgeClass = (action) => {
  if (action === 'create') return 'badge-create'
  if (action === 'delete') return 'badge-delete'
  return 'badge-update'
}
const actionLabel = (action) => {
  if (action === 'create') return 'Created'
  if (action === 'delete') return 'Deleted'
  return 'Updated'
}
const formatFullDate = (dateStr) => new Date(dateStr).toLocaleString('en-PH', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
})

const handleDashboardNavigation = (targetMode) => { emit('change-mode', targetMode) }

watch(() => props.mode, (newMode) => {
  // CHANGED: 'mho' case removed â€” MHOAdmin fetches its own data on mount
  if (newMode === 'content') fetchHistory()
}, { immediate: true })
</script>

<template>
  <div class="visual-dashboard">
    <div class="canvas-wrapper">
      <div class="content-area">
        <!-- â”€â”€ DASHBOARD OVERVIEW â”€â”€ -->
        <DashboardOverview v-if="mode === 'home'" @change-mode="handleDashboardNavigation" />

        <!-- â”€â”€ CONTENT CHANGE HISTORY (Visual Editor) â”€â”€ -->
        <div v-else-if="mode === 'content'" class="history-viewer">
          <div class="history-header">
            <div>
              <h2>Content Change History</h2>
              <p class="history-subtitle">Track all modifications made across the system</p>
            </div>
            <button class="refresh-btn mat-skeuo-sm mat-pressable-sm" @click="fetchHistory" :disabled="historyLoading">
              <i class="fas fa-arrows-rotate" :class="{ spinning: historyLoading }"></i>
              {{ historyLoading ? 'Refreshingâ€¦' : 'Refresh' }}
            </button>
          </div>

          <div class="history-sections">
            <div
              v-for="section in historySections"
              :key="section.id"
              class="history-section"
              :class="{ expanded: isSectionExpanded(section.id) }"
            >
              <div class="section-header" @click="toggleSection(section.id)">
                <div class="section-header-left">
                  <span class="section-icon"><i class="fa-solid" :class="section.icon"></i></span>
                  <span class="section-label">{{ section.label }}</span>
                </div>
                <div class="section-header-right">
                  <span v-if="sectionChangeCounts[section.id] > 0" class="change-count">{{ sectionChangeCounts[section.id] }}</span>
                  <span v-else class="change-count zero">0</span>
                  <i class="fa-solid section-chevron" :class="isSectionExpanded(section.id) ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
                </div>
              </div>

              <transition name="slide">
                <div v-if="isSectionExpanded(section.id)" class="section-body">
                  <div v-if="getEntriesForSection(section.id).length === 0" class="section-empty">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                    <p>No changes recorded for this section yet.</p>
                  </div>
                  <div v-else class="timeline">
                    <div
                      v-for="entry in getEntriesForSection(section.id)"
                      :key="entry.id"
                      class="timeline-entry"
                      :class="{ expanded: isEntryExpanded(entry.id) }"
                    >
                      <div class="timeline-dot-row">
                        <div class="timeline-dot" :class="actionBadgeClass(entry.action)">
                          <i v-if="entry.action === 'create'" class="fa-solid fa-plus"></i>
                          <i v-else-if="entry.action === 'delete'" class="fa-solid fa-trash"></i>
                          <i v-else class="fa-solid fa-pen"></i>
                        </div>
                        <div class="timeline-line"></div>
                      </div>
                      <div class="timeline-content" @click="entry.changes ? toggleEntry(entry.id) : null">
                        <div class="entry-top">
                          <span class="action-badge mat-well" :class="actionBadgeClass(entry.action)">{{ actionLabel(entry.action) }}</span>
                          <span class="entry-title">{{ entry.entity_title || 'Untitled' }}</span>
                        </div>
                        <div class="entry-meta">
                          <span class="entry-by"><i class="fa-solid fa-user"></i> {{ entry.changed_by_name }}</span>
                          <span class="entry-sep">Â·</span>
                          <span class="entry-time" :title="formatFullDate(entry.created_at)">{{ entry.timeAgo }}</span>
                          <span v-if="entry.changes" class="entry-fields-hint">
                            <i class="fa-solid fa-list-check"></i>
                            {{ Object.keys(entry.changes).length }} field(s)
                          </span>
                          <i v-if="entry.changes" class="fa-solid entry-expand-icon" :class="isEntryExpanded(entry.id) ? 'fa-chevron-up' : 'fa-chevron-down'"></i>
                        </div>

                        <transition name="slide">
                          <div v-if="entry.changes && isEntryExpanded(entry.id)" class="entry-diff" @click.stop>
                            <div class="diff-title">Field Changes</div>
                            <div v-for="(diff, field) in entry.changes" :key="field" class="diff-field">
                              <div class="diff-field-name">{{ field }}</div>
                              <div v-if="diff.old" class="diff-old">
                                <span class="diff-label">Old:</span>
                                <span class="diff-value">{{ diff.old }}</span>
                              </div>
                              <div v-if="diff.new" class="diff-new">
                                <span class="diff-label">New:</span>
                                <span class="diff-value">{{ diff.new }}</span>
                              </div>
                            </div>
                          </div>
                        </transition>
                      </div>
                    </div>
                  </div>
                </div>
              </transition>
            </div>
          </div>

          <div v-if="historyData.length === 0" class="history-empty-overall">
            <i class="fa-solid fa-clock-rotate-left"></i>
            <h3>No Change History Yet</h3>
            <p>Changes made to content across the system will appear here as an audit trail.</p>
          </div>
        </div>

        <!-- â”€â”€ MHO PAGE CONTENT EDITOR â”€â”€ -->
        <div v-else-if="mode === 'mho'" style="height:100%;width:100%;"><MHOAdmin /></div>

        <!-- â”€â”€ DELEGATED COMPONENTS â”€â”€ -->
        <div v-else-if="mode === 'barangays'"  style="height:100%;width:100%;"><BarangayManager /></div>
        <div v-else-if="mode === 'history'"    style="height:100%;width:100%;"><HistoryManager /></div>
        <div v-else-if="mode === 'charter'"    style="height:100%;width:100%;"><CharterManager /></div>
        <div v-else-if="mode === 'tala'"       style="height:100%;width:100%;"><TalaDashboard /></div>
        <div v-else-if="mode === 'documents'"  style="height:100%;width:100%;"><DocumentRequests /></div>
        <div v-else-if="mode === 'users'"      style="height:100%;width:100%;"><UserTable /></div>
        <div v-else-if="mode === 'halcon'"     style="height:100%;width:100%;"><HalconManager /></div>
        <div v-else-if="mode === 'bookings'"   style="height:100%;width:100%;"><BookingMonitor /></div>
        <div v-else-if="mode === 'hotels'"     style="height:100%;width:100%;"><AdminHotel /></div>
        <div v-else-if="mode === 'tourism'"    style="height:100%;width:100%;"><TourismDestination /></div>
        <div v-else-if="mode === 'resorts'"    style="height:100%;width:100%;"><ResortsManager /></div>
        <div v-else-if="mode === 'officials'"  style="height:100%;width:100%;"><OfficialsManager /></div>
        <div v-else-if="mode === 'schools'"    style="height:100%;width:100%;"><SchoolsManager /></div>
        <div v-else-if="mode === 'offices'"    style="height:100%;width:100%;"><AdminOffices /></div>
        <div v-else-if="mode === 'news'"       style="height:100%;width:100%;"><NewsUpdatesManager /></div>

        <!-- â”€â”€ EMPTY STATE â”€â”€ -->
        <div v-else class="empty-placeholder">
          <i class="fas fa-bolt"></i>
          <h3>Select a module from the sidebar</h3>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; }

/* â”€â”€ LAYOUT â”€â”€ */
.visual-dashboard { display: flex; width: 100%; height: 100%; overflow: hidden; font-family: var(--font-body); position: relative; }
/* The ambience washes live on .admin-layout, but this wrapper is an opaque
   --bg fill sitting between that and the content, so it was burying them.
   Without them here the glass in the sidebar and top bar has only a flat
   colour behind it to blur, which is exactly the case where glassmorphism
   stops reading as glass and just looks like a grey box. */
.canvas-wrapper {
  flex: 1; min-width: 0;
  background-color: var(--bg);
  background-image: var(--m-ambience);
  background-attachment: fixed;
  display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.content-area { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; scroll-behavior: smooth; }

/* â”€â”€ HISTORY VIEWER â”€â”€ */
.history-viewer { padding: 32px; max-width: 860px; width: 100%; margin: 0 auto; }
.history-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 28px; }
.history-header h2 { font-family: var(--font-display); font-size: 1.5rem; color: var(--fg); margin: 0 0 4px; }
.history-subtitle { font-size: 0.84rem; color: var(--mt); margin: 0; }
.refresh-btn { display: flex; align-items: center; gap: 7px; background: var(--bg2); border: 1px solid var(--bdr); padding: 9px 16px; border-radius: var(--r-sm); font-size: 0.78rem; font-weight: 600; color: var(--fg2); cursor: pointer; font-family: var(--font-body); transition: all 0.18s; flex-shrink: 0; }
.refresh-btn:hover { border-color: var(--ac); color: var(--fg); }
.refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.spinning { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.history-empty-overall { text-align: center; padding: 80px 32px; color: var(--mt); }
.history-empty-overall i { font-size: 3rem; margin-bottom: 16px; opacity: 0.4; color: var(--wn); display: block; }
.history-empty-overall h3 { font-family: var(--font-display); font-size: 1.2rem; color: var(--fg); margin: 0 0 8px; }
.history-empty-overall p { font-size: 0.84rem; margin: 0; }
/* â”€â”€ SECTIONS ACCORDION â”€â”€ */
.history-sections { display: flex; flex-direction: column; gap: 6px; }
.history-section { background: var(--card-solid); border: 1px solid var(--bdr); border-radius: var(--r-sm); overflow: hidden; transition: all 0.18s; }
.history-section.expanded { box-shadow: var(--shadow-md); border-color: var(--bdr2); }
.section-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; cursor: pointer; user-select: none; transition: background 0.12s; }
.section-header:hover { background: var(--card2); }
.section-header-left { display: flex; align-items: center; gap: 12px; }
.section-icon { width: 32px; height: 32px; border-radius: var(--r-sm); background: var(--bg3); display: flex; align-items: center; justify-content: center; color: var(--mt); font-size: 0.85rem; flex-shrink: 0; transition: all 0.18s; }
.history-section.expanded .section-icon { background: var(--acs); color: var(--ac); }
.section-label { font-weight: 600; font-size: 0.88rem; color: var(--fg); }
.section-header-right { display: flex; align-items: center; gap: 10px; }
.change-count { font-size: 0.7rem; font-weight: 700; background: var(--m-accent-solid); color: white; padding: 2px 9px; border-radius: 10px; min-width: 24px; text-align: center; }
.change-count.zero { background: var(--card3); color: var(--mt); }
.section-chevron { font-size: 0.7rem; color: var(--mt); transition: transform 0.2s; }

/* â”€â”€ SECTION BODY â”€â”€ */
.section-body { border-top: 1px solid var(--bdr); }
.section-empty { text-align: center; padding: 32px; color: var(--mt2); }
.section-empty i { font-size: 1.3rem; margin-bottom: 8px; display: block; opacity: 0.3; }
.section-empty p { font-size: 0.8rem; margin: 0; }

/* â”€â”€ TIMELINE â”€â”€ */
.timeline { padding: 16px 18px; }
.timeline-entry { display: flex; gap: 0; position: relative; }
.timeline-entry:not(:last-child) { margin-bottom: 0; }
.timeline-dot-row { display: flex; flex-direction: column; align-items: center; width: 28px; flex-shrink: 0; }
.timeline-dot { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.58rem; color: white; flex-shrink: 0; z-index: 1; border: 2px solid var(--card-solid); box-shadow: 0 0 0 1px var(--bdr); }
.timeline-dot.badge-create { background: var(--ok); color: var(--fg); }
.timeline-dot.badge-update { background: var(--tl); color: var(--fg); }
.timeline-dot.badge-delete { background: var(--dg); }
.timeline-line { width: 2px; flex: 1; background: var(--bdr); margin: 2px 0; min-height: 8px; }
.timeline-entry:last-child .timeline-line { display: none; }
.timeline-content { flex: 1; padding-bottom: 18px; padding-left: 12px; cursor: default; min-width: 0; }
.timeline-entry.expanded .timeline-content { padding-bottom: 22px; }
.entry-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
.action-badge { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 2px 7px; border-radius: var(--r-sm); }
.action-badge.badge-create { background: var(--oks); color: var(--ok); }
.action-badge.badge-update { background: var(--tls); color: var(--tl); }
.action-badge.badge-delete { background: var(--dgs); color: var(--dg); }
.entry-title { font-weight: 600; font-size: 0.84rem; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.entry-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 0.72rem; color: var(--mt); }
.entry-meta i { font-size: 0.65rem; }
.entry-sep { color: var(--bdr2); }
.entry-fields-hint { color: var(--fg2); font-style: italic; }
.entry-expand-icon { font-size: 0.6rem; color: var(--mt2); margin-left: auto; }

/* â”€â”€ DIFF VIEW â”€â”€ */
.entry-diff { margin-top: 10px; background: var(--bg2); border: 1px solid var(--bdr); border-radius: var(--r-sm); padding: 12px 14px; }
.diff-title { font-size: 0.64rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--mt); margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid var(--bdr); }
.diff-field { margin-bottom: 10px; }
.diff-field:last-child { margin-bottom: 0; }
.diff-field-name { font-size: 0.72rem; font-weight: 700; color: var(--fg); margin-bottom: 4px; text-transform: capitalize; }
.diff-old, .diff-new { display: flex; gap: 8px; font-size: 0.78rem; line-height: 1.5; padding: 4px 0; }
.diff-label { font-weight: 700; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; flex-shrink: 0; width: 32px; }
.diff-old .diff-label { color: var(--dg); }
.diff-new .diff-label { color: var(--ok); }
.diff-value { color: var(--fg2); word-break: break-word; }
.diff-old .diff-value { background: var(--dgs); padding: 2px 6px; border-radius: var(--r-sm); text-decoration: line-through; opacity: 0.7; }
.diff-new .diff-value { background: var(--oks); padding: 2px 6px; border-radius: var(--r-sm); }

/* â”€â”€ SLIDE TRANSITION â”€â”€ */
.slide-enter-active, .slide-leave-active { transition: all 0.25s ease; overflow: hidden; }
.slide-enter-from, .slide-leave-to { opacity: 0; max-height: 0; }
.slide-enter-to, .slide-leave-from { opacity: 1; max-height: 2000px; }

/* â”€â”€ EMPTY STATE â”€â”€ */
.empty-placeholder { padding: 64px; text-align: center; color: var(--mt); display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; }
.empty-placeholder i { font-size: 2.5rem; margin-bottom: 16px; opacity: 0.4; color: var(--wn); }
.empty-placeholder h3 { font-family: var(--font-display); font-size: 1.2rem; color: var(--fg); margin: 0 0 8px; }
.empty-placeholder p { font-size: 0.84rem; margin: 0; }

/* CHANGED: removed the AdminDock / health-editor CSS and the module/preview CSS â€”
   the dock was only used by the old health-services editor, and the preview grid
   by the old MHO page. MHOAdmin.vue brings its own styles. */

/* â”€â”€ RESPONSIVE (canvas) â”€â”€ */
@media (max-width: 768px) {
  .history-viewer { padding: 20px 16px; }
  .history-header { flex-direction: column; align-items: flex-start; gap: 12px; }
}

</style>