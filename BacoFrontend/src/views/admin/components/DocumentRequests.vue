<script setup>
import { ref, computed } from 'vue'

const selectedType = ref('All')
const searchQuery = ref('')

const documents = ref([
  { id: 'DOC-2026-001', citizen: 'Juan Dela Cruz', type: 'Barangay Clearance', date: 'Feb 06, 2026', status: 'Pending' },
  { id: 'DOC-2026-002', citizen: 'Maria Santos', type: 'Business Permit', date: 'Feb 05, 2026', status: 'Released' },
  { id: 'DOC-2026-003', citizen: 'Pedro Penduko', type: 'Health Certificate', date: 'Feb 04, 2026', status: 'Rejected' },
  { id: 'DOC-2026-004', citizen: 'Ana Reyes', type: 'Indigency', date: 'Feb 04, 2026', status: 'Released' },
  { id: 'DOC-2026-005', citizen: 'Jose Rizal', type: 'Business Permit', date: 'Jan 30, 2026', status: 'Released' },
])

const filteredDocs = computed(() =>
  documents.value.filter(doc => {
    const matchType = selectedType.value === 'All' || doc.type === selectedType.value
    const matchSearch = doc.citizen.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                        doc.id.toLowerCase().includes(searchQuery.value.toLowerCase())
    return matchType && matchSearch
  })
)

const getStatusClass = (status) => {
  if (status === 'Pending')  return 'status-pending'
  if (status === 'Released') return 'status-success'
  if (status === 'Rejected') return 'status-error'
  return ''
}
</script>

<template>
  <div class="doc-panel">
    <!-- HEADER -->
    <div class="panel-header">
      <div class="header-left">
        <div class="header-eyebrow">
          <span class="eyebrow-line"></span>
          Civil Registry
        </div>
        <h2>Document Library</h2>
        <p>Registry of all requested and issued municipal documents.</p>
      </div>
      <button class="add-btn mat-skeuo-filled mat-pressable-filled">
        <i class="fas fa-plus"></i> New Request
      </button>
    </div>

    <!-- TOOLBAR -->
    <div class="filter-bar">
      <div class="filter-group">
        <label>Filter Type</label>
        <select v-model="selectedType" class="filter-select">
          <option value="All">All Documents</option>
          <option value="Barangay Clearance">Barangay Clearance</option>
          <option value="Business Permit">Business Permit</option>
          <option value="Health Certificate">Health Certificate</option>
          <option value="Indigency">Certificate of Indigency</option>
        </select>
      </div>
      <div class="search-wrap">
        <i class="fas fa-search"></i>
        <input v-model="searchQuery" type="text" placeholder="Search Control No. or Name..." />
      </div>
    </div>

    <!-- TABLE -->
    <div class="data-panel">
      <div class="panel-bar">
        <span class="bar-title">
          <i class="fas fa-file-alt"></i>
          Document Records
        </span>
        <span class="bar-count">{{ filteredDocs.length }} record{{ filteredDocs.length !== 1 ? 's' : '' }}</span>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>Control No.</th>
            <th>Citizen Name</th>
            <th>Document Type</th>
            <th>Date Requested</th>
            <th>Status</th>
            <th class="td-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="doc in filteredDocs" :key="doc.id" class="data-row">
            <td class="td-control">{{ doc.id }}</td>
            <td>
              <div class="citizen-cell">
                <div class="citizen-avatar">{{ doc.citizen.charAt(0) }}</div>
                <span class="citizen-name">{{ doc.citizen }}</span>
              </div>
            </td>
            <td>
              <span class="doc-tag mat-well">{{ doc.type }}</span>
            </td>
            <td class="td-date">{{ doc.date }}</td>
            <td>
              <span class="status-pill mat-well" :class="getStatusClass(doc.status)">
                <span class="status-dot"></span>
                {{ doc.status }}
              </span>
            </td>
            <td class="td-right">
              <button class="action-btn mat-skeuo-sm mat-pressable-sm" title="View PDF"><i class="fas fa-file-pdf"></i></button>
              <button class="action-btn mat-skeuo-sm mat-pressable-sm" title="Print"><i class="fas fa-print"></i></button>
            </td>
          </tr>
          <tr v-if="filteredDocs.length === 0">
            <td colspan="6" class="empty-row">
              <i class="fas fa-folder-open"></i>
              <p>No documents found matching your criteria.</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.doc-panel {
  padding: 32px; background: var(--bg);
  min-height: 100%; font-family: var(--font-body); overflow-y: auto;
}
/* Header */
.panel-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 24px; gap: 16px; flex-wrap: wrap;
}
.header-eyebrow {
  display: flex; align-items: center; gap: 8px;
  font-size: 0.62rem; font-weight: 700; letter-spacing: 0.2em;
  text-transform: uppercase; color: var(--ac); margin-bottom: 5px;
}
.eyebrow-line { width: 20px; height: 2px; background: var(--ac); border-radius: 1px; }
.header-left h2 {
  font-family: var(--font-display);
  font-size: 1.6rem; font-weight: 700; color: var(--fg); margin: 0 0 5px;
}
.header-left p { font-size: 0.82rem; color: var(--mt); margin: 0; }
.add-btn {
  display: flex; align-items: center; gap: 7px;
  background: linear-gradient(135deg, var(--m-accent-hi), var(--m-accent-solid)); color: white; border: none;
  padding: 10px 18px; border-radius: var(--r-sm);
  font-size: 0.78rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  cursor: pointer; font-family: var(--font-body); transition: all 0.18s; white-space: nowrap; flex-shrink: 0;
  box-shadow: 0 4px 16px var(--acg);
}
.add-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px var(--acg); }
/* Filter Bar */
.filter-bar {
  background: var(--card-solid); padding: 13px 16px; border-radius: var(--r-md);
  display: flex; gap: 16px; align-items: center; justify-content: space-between;
  margin-bottom: 16px; border: 1px solid var(--bdr); flex-wrap: wrap;
}
.filter-group { display: flex; align-items: center; gap: 10px; }
.filter-group label {
  font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--fg2); white-space: nowrap;
}
.filter-select {
  padding: 8px 12px; border: 1px solid var(--bdr); border-radius: var(--r-sm);
  font-size: 0.82rem; color: var(--fg); background: var(--bg2); font-family: var(--font-body);
  outline: none; cursor: pointer;
}
.filter-select:focus { border-color: var(--ac); }
.search-wrap {
  display: flex; align-items: center;
  background: var(--bg2); border: 1px solid var(--bdr);
  border-radius: var(--r-sm); padding: 0 12px; min-width: 280px;
}
.search-wrap i { color: var(--mt); font-size: 0.8rem; }
.search-wrap input {
  border: none; background: transparent; padding: 9px 8px; width: 100%;
  outline: none; font-size: 0.84rem; color: var(--fg); font-family: var(--font-body);
}
.search-wrap input::placeholder { color: var(--mt2); }
/* Data Panel */
.data-panel { background: var(--card-solid); border-radius: var(--r-md); overflow: hidden; border: 1px solid var(--bdr); }
.panel-bar {
  background: var(--bg2); padding: 13px 20px;
  display: flex; justify-content: space-between; align-items: center;
  border-bottom: 1px solid var(--bdr);
}
.bar-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg);
}
.bar-title i { color: var(--ac); }
.bar-count { font-size: 0.7rem; color: var(--mt); }
.data-table { width: 100%; border-collapse: collapse; }
.data-table thead tr { background: var(--bg3); border-bottom: 1px solid var(--bdr); }
.data-table th {
  padding: 11px 16px; text-align: left;
  font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--mt);
}
.data-row { border-bottom: 1px solid var(--bdr); transition: background 0.15s; }
.data-row:last-child { border-bottom: none; }
.data-row:hover { background: var(--card2); }
.data-table td { padding: 13px 16px; vertical-align: middle; font-size: 0.84rem; color: var(--fg2); }
.td-control { font-family: var(--font-mono); font-size: 0.78rem; color: var(--mt); font-weight: 600; }
.citizen-cell { display: flex; align-items: center; gap: 10px; }
.citizen-avatar {
  width: 30px; height: 30px; border-radius: var(--r-sm); flex-shrink: 0;
  background: var(--acs); color: var(--ac);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7rem; font-weight: 800;
}
.citizen-name { font-weight: 600; color: var(--fg); }
.doc-tag {
  display: inline-block; background: var(--acs); color: var(--ac);
  padding: 3px 8px; border-radius: var(--r-sm); font-size: 0.75rem; font-weight: 600;
}
.td-date { color: var(--mt); font-size: 0.82rem; white-space: nowrap; }
.status-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 10px; border-radius: var(--r-sm);
  font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
}
.status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.status-pending  { background: var(--wns); color: var(--wn); }
.status-pending .status-dot  { background: var(--wn); }
.status-success  { background: var(--oks); color: var(--ok); }
.status-success .status-dot  { background: var(--ok); }
.status-error    { background: var(--dgs); color: var(--dg); }
.status-error .status-dot    { background: var(--dg); }
.td-right { text-align: right; }
.action-btn {
  background: none; border: 1px solid var(--bdr); cursor: pointer;
  padding: 6px 9px; border-radius: var(--r-sm); color: var(--mt);
  font-size: 0.8rem; transition: all 0.18s;
}
.action-btn + .action-btn { margin-left: 4px; }
.action-btn:hover { background: var(--m-accent-solid); color: white; border-color: var(--m-accent-solid); }
.empty-row { text-align: center; padding: 48px 20px !important; color: var(--mt); }
.empty-row i { font-size: 1.8rem; display: block; margin-bottom: 10px; opacity: 0.4; }
.empty-row p { font-size: 0.84rem; }
@media (max-width: 768px) {
  .doc-panel { padding: 20px 16px; }
  .filter-bar { flex-direction: column; align-items: stretch; }
  .search-wrap { min-width: unset; }
  .data-table th:nth-child(4), .data-table td:nth-child(4) { display: none; }
}

</style>