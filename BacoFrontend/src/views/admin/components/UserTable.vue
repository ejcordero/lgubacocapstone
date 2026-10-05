<script setup>
import { ref, computed, onMounted } from 'vue'
import { Eye, Edit, Trash2, Check, X, UserPlus, FileText, Power, Hotel } from 'lucide-vue-next'
import { API } from '@/api'

const activeTab = ref('citizens')
const isLoading = ref(false)
const searchQuery = ref('')
const filterRole = ref('All')
const filterType = ref('All')
const filterCompletedStatus = ref('All')
const filterOwnerStatus = ref('All')

const staffUsers = ref([])
const citizenUsers = ref([])
const ownerUsers = ref([])
const adminRegistrations = ref([])
const ownerRegistrations = ref([])

const pendingRegistrations = computed(() =>
  [...adminRegistrations.value, ...ownerRegistrations.value].filter(r => r.status === 'pending')
)
const completedRegistrations = computed(() =>
  [...adminRegistrations.value, ...ownerRegistrations.value].filter(r => r.status !== 'pending')
)

const showAddStaffModal = ref(false)
const showEditStaffModal = ref(false)
const showViewRegistrationModal = ref(false)
const showRejectModal = ref(false)
const showViewOwnerModal = ref(false)

const newStaff = ref({
  firstName: '', middleName: '', lastName: '',
  email: '', password: '', department: '',
  position: '', employeeId: '', contactNumber: '',
  role: ''
})
const editStaff = ref({
  id: null, firstName: '', middleName: '', lastName: '',
  email: '', department: '', position: '',
  employeeId: '', contactNumber: '', role: '', status: 'active'
})
const selectedRegistration = ref(null)
const selectedOwner = ref(null)
const selectedCitizen = ref(null)
const showViewCitizenModal = ref(false)
const rejectionReason = ref('')
const validIdFile = ref(null)
const editValidIdFile = ref(null)

const ADMIN_ROLES = [
  { value: 'main_controller', label: 'Super Admin' },
  { value: 'mho_admin', label: 'MHO Officer' },
  { value: 'tourism_admin', label: 'Tourism Officer' },
  { value: 'bplo_admin', label: 'BPLO Officer' },
  { value: 'mdrrmo_admin', label: 'MDRRMO Officer' }
]

const getAdminToken = () => localStorage.getItem('baco_admin_token')
const getAdminRole = () => localStorage.getItem('baco_admin_role')

const fetchStaff = async () => {
  try {
    const response = await fetch(`${API}/admin/staff`, { headers: { 'Authorization': `Bearer ${getAdminToken()}` } })
    if (response.ok) staffUsers.value = await response.json()
  } catch (err) { console.error('Failed to fetch staff:', err) }
}
const fetchCitizens = async () => {
  try {
    const response = await fetch(`${API}/admin/citizens`, { headers: { 'Authorization': `Bearer ${getAdminToken()}` } })
    if (response.ok) citizenUsers.value = await response.json()
  } catch (err) { console.error('Failed to fetch citizens:', err) }
}
const fetchOwners = async () => {
  try {
    const response = await fetch(`${API}/admin/owners`, { headers: { 'Authorization': `Bearer ${getAdminToken()}` } })
    if (response.ok) ownerUsers.value = await response.json()
  } catch (err) { console.error('Failed to fetch owners:', err) }
}
const fetchRegistrations = async () => {
  // SECURITY: registration requests (admin + owner) are Super-Admin-only.
  // Other roles skip the API calls entirely Ã¢â‚¬â€ no data ever reaches them.
  if (getAdminRole() !== 'main_controller') {
    adminRegistrations.value = []
    ownerRegistrations.value = []
    return
  }
  const headers = { 'Authorization': `Bearer ${getAdminToken()}` }
  try {
    const [aRes, oRes] = await Promise.all([
      fetch(`${API}/admin/registrations`, { headers }),
      fetch(`${API}/admin/owner-registrations`, { headers })
    ])
    adminRegistrations.value = aRes.ok ? (await aRes.json()).map(r => ({ ...r, type: 'admin' })) : []
    ownerRegistrations.value = oRes.ok ? (await oRes.json()).map(r => ({ ...r, type: 'owner' })) : []
  } catch (err) { console.error('Failed to fetch registrations:', err) }
}
const fetchAllData = async () => {
  isLoading.value = true
  await Promise.all([fetchStaff(), fetchCitizens(), fetchOwners(), fetchRegistrations()])
  isLoading.value = false
}
onMounted(fetchAllData)

const filteredList = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (activeTab.value === 'staff') {
    return staffUsers.value.filter(u => {
      const nameMatch = (u.firstName || '').toLowerCase().includes(q) || (u.lastName || '').toLowerCase().includes(q)
      const roleMatch = filterRole.value === 'All' || u.role === filterRole.value
      return nameMatch && roleMatch
    })
  }
  if (activeTab.value === 'owners') {
    let list = ownerUsers.value
    if (filterOwnerStatus.value !== 'All') list = list.filter(o => o.status === filterOwnerStatus.value)
    return list.filter(o =>
      (o.firstName || '').toLowerCase().includes(q) ||
      (o.lastName || '').toLowerCase().includes(q) ||
      (o.email || '').toLowerCase().includes(q) ||
      (o.businessName || '').toLowerCase().includes(q)
    )
  }
  if (activeTab.value === 'pending') {
    let list = pendingRegistrations.value
    if (filterType.value !== 'All') list = list.filter(r => r.type === filterType.value)
    return list.filter(u =>
      (u.firstName || '').toLowerCase().includes(q) ||
      (u.lastName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.businessName || '').toLowerCase().includes(q)
    )
  }
  if (activeTab.value === 'completed') {
    let list = completedRegistrations.value
    if (filterType.value !== 'All') list = list.filter(r => r.type === filterType.value)
    if (filterCompletedStatus.value !== 'All') list = list.filter(r => r.status === filterCompletedStatus.value)
    return list.filter(u =>
      (u.firstName || '').toLowerCase().includes(q) ||
      (u.lastName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.businessName || '').toLowerCase().includes(q)
    )
  }
  return citizenUsers.value.filter(u =>
    (u.firstName || '').toLowerCase().includes(q) ||
    (u.lastName || '').toLowerCase().includes(q) ||
    (u.username || '').toLowerCase().includes(q)
  )
})

const pendingCount = computed(() => pendingRegistrations.value.length)
const completedCount = computed(() => completedRegistrations.value.length)
const ownersCount = computed(() => ownerUsers.value.length)
const emptyColspan = computed(() => {
  if (activeTab.value === 'owners') return 7
  if (activeTab.value === 'pending' || activeTab.value === 'completed') return 6
  return 5
})

const getFullName = (user) => user.middleName
  ? `${user.firstName} ${user.middleName} ${user.lastName}`
  : `${user.firstName} ${user.lastName}`
const getInitials = (user) =>
  `${(user.firstName || '?').charAt(0)}${(user.lastName || '').charAt(0)}`.toUpperCase()
const formatDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Ã¢â‚¬â€'
const formatDateTime = (d) => d ? new Date(d).toLocaleString(undefined, {
  year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
}) : 'Ã¢â‚¬â€'
const getTypeLabel = (t) => t === 'owner' ? 'Owner' : 'Admin'
const isPdf = (url) => url ? url.toLowerCase().includes('.pdf') : false
const getStatusLabel = (status) => {
  if (status === 'approved') return 'Approved'
  if (status === 'rejected') return 'Rejected'
  return status
}
const getStatusClass = (status) => {
  if (status === 'approved') return 'approved'
  if (status === 'rejected') return 'rejected'
  return ''
}
const hotelsSummary = (owner) => {
  if (!owner.hotels || owner.hotels.length === 0) return 'No listings yet'
  const first = owner.hotels[0].name
  const extra = owner.hotels.length - 1
  return extra > 0 ? `${first} +${extra} more` : first
}
const ownerDocs = computed(() => {
  const r = selectedRegistration.value
  if (!r || r.type !== 'owner') return []
  return [
    { label: 'Valid ID', url: r.validIdUrl },
    { label: 'Business Permit', url: r.businessPermitUrl },
    { label: 'Proof of Ownership', url: r.ownershipProofUrl }
  ].filter(d => d.url)
})

const openAddStaffModal = () => {
  newStaff.value = {
    firstName: '', middleName: '', lastName: '',
    email: '', password: '', department: '',
    position: '', employeeId: '', contactNumber: '',
    role: ''
  }
  validIdFile.value = null
  showAddStaffModal.value = true
}
const handleAddStaffIdUpload = (event) => {
  const file = event.target.files[0]
  if (file) validIdFile.value = file
}
const saveStaff = async () => {
  const s = newStaff.value
  if (!s.firstName || !s.lastName || !s.email || !s.password || !s.role) {
    alert('First name, last name, email, password, and role are required.')
    return
  }
  isLoading.value = true
  try {
    const formData = new FormData()
    Object.keys(s).forEach(key => { if (s[key]) formData.append(key, s[key]) })
    if (validIdFile.value) formData.append('validId', validIdFile.value)
    const response = await fetch(`${API}/admin/staff`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getAdminToken()}` },
      body: formData
    })
    const data = await response.json()
    if (response.ok) { alert(data.message); showAddStaffModal.value = false; await fetchStaff() }
    else { alert(data.message) }
  } catch (err) { alert('Failed to add staff.') }
  isLoading.value = false
}
const openEditStaffModal = (staff) => {
  editStaff.value = { ...staff }
  editValidIdFile.value = null
  showEditStaffModal.value = true
}
const handleEditStaffIdUpload = (event) => {
  const file = event.target.files[0]
  if (file) editValidIdFile.value = file
}
const updateStaff = async () => {
  const s = editStaff.value
  if (!s.firstName || !s.lastName || !s.email || !s.role) {
    alert('First name, last name, email, and role are required.')
    return
  }
  isLoading.value = true
  try {
    const formData = new FormData()
    formData.append('firstName', s.firstName)
    formData.append('middleName', s.middleName || '')
    formData.append('lastName', s.lastName)
    formData.append('email', s.email)
    formData.append('department', s.department || '')
    formData.append('position', s.position || '')
    formData.append('employeeId', s.employeeId || '')
    formData.append('contactNumber', s.contactNumber || '')
    formData.append('role', s.role)
    formData.append('status', s.status)
    if (editValidIdFile.value) formData.append('validId', editValidIdFile.value)
    const response = await fetch(`${API}/admin/staff/${s.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${getAdminToken()}` },
      body: formData
    })
    const data = await response.json()
    if (response.ok) { alert(data.message); showEditStaffModal.value = false; await fetchStaff() }
    else { alert(data.message) }
  } catch (err) { alert('Failed to update staff.') }
  isLoading.value = false
}
const deleteStaff = async (id) => {
  if (!confirm('Are you sure you want to delete this staff? This action cannot be undone.')) return
  isLoading.value = true
  try {
    const response = await fetch(`${API}/admin/staff/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getAdminToken()}` }
    })
    const data = await response.json()
    if (response.ok) { alert(data.message); await fetchStaff() }
    else { alert(data.message) }
  } catch (err) { alert('Failed to delete staff.') }
  isLoading.value = false
}

const viewOwner = (owner) => {
  selectedOwner.value = owner
  showViewOwnerModal.value = true
}
const viewCitizen = (citizen) => {
  selectedCitizen.value = citizen
  showViewCitizenModal.value = true
}
const toggleOwnerStatus = async (owner) => {
  const newStatus = owner.status === 'active' ? 'inactive' : 'active'
  const action = newStatus === 'active' ? 'activate' : 'deactivate'
  if (!confirm(`Are you sure you want to ${action} this owner account? ${newStatus === 'inactive' ? 'They will no longer be able to log in.' : ''}`)) return
  isLoading.value = true
  try {
    const response = await fetch(`${API}/admin/owners/${owner.id}/status`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${getAdminToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    })
    const data = await response.json()
    if (response.ok) { alert(data.message); await fetchOwners() }
    else { alert(data.message) }
  } catch (err) { alert('Failed to update owner status.') }
  isLoading.value = false
}
const deleteOwner = async (owner) => {
  if (!confirm(`Delete owner account for "${owner.businessName}"? Their login will be removed and their resort listings will be unlinked. This cannot be undone.`)) return
  isLoading.value = true
  try {
    const response = await fetch(`${API}/admin/owners/${owner.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getAdminToken()}` }
    })
    const data = await response.json()
    if (response.ok) { alert(data.message); showViewOwnerModal.value = false; await fetchOwners() }
    else { alert(data.message) }
  } catch (err) { alert('Failed to delete owner.') }
  isLoading.value = false
}

const viewRegistration = (reg) => {
  selectedRegistration.value = reg
  showViewRegistrationModal.value = true
}
const approveRegistration = async (reg) => {
  const label = reg.type === 'owner' ? 'owner' : 'admin'
  const extra = reg.type === 'owner' ? ' An owner account and resort record will be created.' : ''
  if (!confirm(`Are you sure you want to approve this ${label} registration?${extra}`)) return
  isLoading.value = true
  try {
    const endpoint = reg.type === 'owner'
      ? `${API}/admin/owner-registrations/${reg.id}/approve`
      : `${API}/admin/registrations/${reg.id}/approve`
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${getAdminToken()}` }
    })
    const data = await response.json()
    if (response.ok) {
      alert(data.message)
      showViewRegistrationModal.value = false
      await Promise.all([fetchRegistrations(), fetchOwners()])
    } else { alert(data.message) }
  } catch (err) { alert('Failed to approve registration.') }
  isLoading.value = false
}
const openRejectModal = (reg) => {
  selectedRegistration.value = reg
  rejectionReason.value = ''
  showRejectModal.value = true
}
const rejectRegistration = async () => {
  if (!rejectionReason.value.trim()) { alert('Please provide a reason for rejection.'); return }
  const reg = selectedRegistration.value
  isLoading.value = true
  try {
    const endpoint = reg.type === 'owner'
      ? `${API}/admin/owner-registrations/${reg.id}/reject`
      : `${API}/admin/registrations/${reg.id}/reject`
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${getAdminToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectionReason.value })
    })
    const data = await response.json()
    if (response.ok) {
      alert(data.message)
      showRejectModal.value = false
      showViewRegistrationModal.value = false
      await fetchRegistrations()
    } else { alert(data.message) }
  } catch (err) { alert('Failed to reject registration.') }
  isLoading.value = false
}
</script>

<template>
  <div class="user-panel">

    <!-- Loading Overlay -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
    </div>

    <div class="panel-header">
      <div class="header-left">
        <div class="header-eyebrow"><span class="eyebrow-line"></span> System Access</div>
        <h2>User Management</h2>
        <p>Manage administrators, citizens, hotel owners, and registrations.</p>
      </div>
      <button class="add-btn mat-skeuo-filled mat-pressable-filled" v-if="activeTab === 'staff' && getAdminRole() === 'main_controller'" @click="openAddStaffModal">
        <UserPlus size="16" /> Add Admin
      </button>
    </div>

    <div class="tabs-bar">
      <button class="tab-btn mat-skeuo-sm mat-pressable-sm" :class="{ active: activeTab === 'citizens' }" @click="activeTab = 'citizens'">
        <i class="fas fa-users"></i> Citizens
      </button>
      <button class="tab-btn mat-skeuo-sm mat-pressable-sm" :class="{ active: activeTab === 'staff' }" @click="activeTab = 'staff'">
        <i class="fas fa-user-shield"></i> Staffs
      </button>
      <button class="tab-btn owners-tab mat-skeuo-sm mat-pressable-sm" :class="{ active: activeTab === 'owners' }" @click="activeTab = 'owners'">
        <i class="fas fa-hotel"></i> Owners
        <span class="owners-count">{{ ownersCount }}</span>
      </button>
      <!-- Pending & Completed: Super Admin only -->
      <button v-if="getAdminRole() === 'main_controller'" class="tab-btn pending-tab mat-skeuo-sm mat-pressable-sm" :class="{ active: activeTab === 'pending' }" @click="activeTab = 'pending'">
        <i class="fas fa-clock"></i> Pending
        <span v-if="pendingCount > 0" class="pending-badge mat-well">{{ pendingCount }}</span>
      </button>
      <button v-if="getAdminRole() === 'main_controller'" class="tab-btn completed-tab mat-skeuo-sm mat-pressable-sm" :class="{ active: activeTab === 'completed' }" @click="activeTab = 'completed'">
        <i class="fas fa-check-circle"></i> Completed
        <span class="completed-count">{{ completedCount }}</span>
      </button>
    </div>

    <div class="filter-bar">
      <div class="search-wrap">
        <i class="fas fa-search"></i>
        <input v-model="searchQuery" type="text" :placeholder="activeTab === 'staff' ? 'Search staff name...' : activeTab === 'owners' ? 'Search owner or business name...' : activeTab === 'pending' ? 'Search pending registrations...' : activeTab === 'completed' ? 'Search completed registrations...' : 'Search name or username...'" />
      </div>
      <select v-if="activeTab === 'staff'" v-model="filterRole" class="filter-select">
        <option value="All">All Roles</option>
        <option v-for="r in ADMIN_ROLES" :key="r.value" :value="r.value">{{ r.label }}</option>
      </select>
      <select v-if="activeTab === 'owners'" v-model="filterOwnerStatus" class="filter-select">
        <option value="All">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <select v-if="activeTab === 'pending' || activeTab === 'completed'" v-model="filterType" class="filter-select">
        <option value="All">All Types</option>
        <option value="admin">Admin Registrations</option>
        <option value="owner">Owner Registrations</option>
      </select>
      <select v-if="activeTab === 'completed'" v-model="filterCompletedStatus" class="filter-select">
        <option value="All">All Status</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
    </div>

    <div class="data-panel">
      <div class="panel-bar">
        <span class="bar-title">
          <i class="fas fa-users"></i>
          {{ activeTab === 'staff' ? 'Staff Directory' : activeTab === 'owners' ? 'Hotel Owner Accounts' : activeTab === 'pending' ? 'Pending Registrations' : activeTab === 'completed' ? 'Completed Registrations' : 'Registered Citizens' }}
        </span>
        <span class="bar-count">{{ filteredList.length }} record{{ filteredList.length !== 1 ? 's' : '' }}</span>
      </div>

      <table class="data-table">
        <thead>
          <tr v-if="activeTab === 'staff'">
            <th>Employee</th><th>Role</th><th>Contact</th><th>Status</th><th class="td-right">Actions</th>
          </tr>
          <tr v-else-if="activeTab === 'owners'">
            <th>Owner</th><th>Business</th><th>Listings</th><th>Contact</th><th>Status</th><th>Registered</th><th class="td-right">Actions</th>
          </tr>
          <tr v-else-if="activeTab === 'pending'">
            <th>Applicant</th><th>Type</th><th>Role / Business</th><th>Documents</th><th>Submitted</th><th class="td-right">Actions</th>
          </tr>
          <tr v-else-if="activeTab === 'completed'">
            <th>Applicant</th><th>Type</th><th>Role / Business</th><th>Status</th><th>Reviewed On</th><th class="td-right">Actions</th>
          </tr>
          <tr v-else>
            <th>User Profile</th><th>Username</th><th>Email</th><th>Date Joined</th><th class="td-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in filteredList" :key="activeTab === 'owners' ? 'owner-' + item.id : (item.type || '') + '-' + item.id" class="data-row">
            <template v-if="activeTab === 'staff'">
              <td>
                <div class="user-profile">
                  <div class="avatar-circle">{{ getInitials(item) }}</div>
                  <div class="user-info">
                    <span class="uname">{{ getFullName(item) }}</span>
                    <span class="usub">{{ item.email }}</span>
                    <span class="usub" v-if="item.employeeId">ID: {{ item.employeeId }}</span>
                  </div>
                </div>
              </td>
              <td><span class="role-tag mat-well" :class="item.role">{{ item.roleLabel }}</span></td>
              <td class="td-gray">{{ item.contactNumber || '-' }}</td>
              <td><span class="status-badge mat-well" :class="item.status">{{ item.status }}</span></td>
              <td class="td-right">
                <button class="action-btn mat-skeuo-sm mat-pressable-sm" title="Edit" @click="openEditStaffModal(item)"><Edit size="14" /></button>
                <button v-if="getAdminRole() === 'main_controller'" class="action-btn danger mat-skeuo-sm mat-pressable-sm" title="Delete" @click="deleteStaff(item.id)"><Trash2 size="14" /></button>
              </td>
            </template>

            <template v-else-if="activeTab === 'owners'">
              <td>
                <div class="user-profile">
                  <div class="avatar-circle owner-avatar">{{ getInitials(item) }}</div>
                  <div class="user-info">
                    <span class="uname">{{ getFullName(item) }}</span>
                    <span class="usub">{{ item.email }}</span>
                  </div>
                </div>
              </td>
              <td>
                <span class="uname business-name">{{ item.businessName }}</span>
                <span class="usub" v-if="item.businessPermitNo">Permit: {{ item.businessPermitNo }}</span>
              </td>
              <td>
                <span class="listings-info" :class="{ 'no-listings': (item.hotels || []).length === 0 }">
                  <Hotel size="13" /> {{ hotelsSummary(item) }}
                </span>
              </td>
              <td class="td-gray">{{ item.contactNumber || '-' }}</td>
              <td><span class="status-badge mat-well" :class="item.status">{{ item.status }}</span></td>
              <td><span class="date-text">{{ formatDate(item.createdAt) }}</span></td>
              <td class="td-right">
                <button class="action-btn mat-skeuo-sm mat-pressable-sm" title="View Details" @click="viewOwner(item)"><Eye size="14" /></button>
                <button class="action-btn mat-skeuo-sm mat-pressable-sm" :class="{ warn: item.status === 'active' }" :title="item.status === 'active' ? 'Deactivate' : 'Activate'" @click="toggleOwnerStatus(item)"><Power size="14" /></button>
                <button v-if="getAdminRole() === 'main_controller'" class="action-btn danger mat-skeuo-sm mat-pressable-sm" title="Delete" @click="deleteOwner(item)"><Trash2 size="14" /></button>
              </td>
            </template>

            <template v-else-if="activeTab === 'pending'">
              <td>
                <div class="user-profile">
                  <div class="avatar-circle pending">{{ getInitials(item) }}</div>
                  <div class="user-info">
                    <span class="uname">{{ getFullName(item) }}</span>
                    <span class="usub">{{ item.email }}</span>
                    <span class="usub owner-sub" v-if="item.type === 'owner'"><i class="fas fa-hotel"></i> {{ item.businessName }}</span>
                  </div>
                </div>
              </td>
              <td>
                <span class="type-tag mat-well" :class="item.type">
                  <i :class="item.type === 'owner' ? 'fas fa-hotel' : 'fas fa-user-shield'"></i>
                  {{ getTypeLabel(item.type) }}
                </span>
              </td>
              <td>
                <span v-if="item.type === 'admin'" class="role-tag mat-well" :class="item.requestedRole">{{ item.roleLabel }}</span>
                <span v-else class="role-tag owner_type mat-well">{{ item.businessType || 'Accommodation' }}</span>
              </td>
              <td>
                <button class="view-id-btn mat-skeuo-sm mat-pressable-sm" @click="viewRegistration(item)">
                  <FileText size="14" /> {{ item.type === 'owner' ? 'Review' : 'View ID' }}
                </button>
              </td>
              <td><span class="date-text">{{ formatDate(item.createdAt) }}</span></td>
              <td class="td-right">
                <button class="action-btn approve mat-skeuo-sm mat-pressable-sm" title="Approve" @click="approveRegistration(item)"><Check size="14" /></button>
                <button class="action-btn reject mat-skeuo-sm mat-pressable-sm" title="Reject" @click="openRejectModal(item)"><X size="14" /></button>
              </td>
            </template>

            <template v-else-if="activeTab === 'completed'">
              <td>
                <div class="user-profile">
                  <div class="avatar-circle" :class="getStatusClass(item.status)">
                    <Check v-if="item.status === 'approved'" size="14" />
                    <X v-else size="14" />
                  </div>
                  <div class="user-info">
                    <span class="uname">{{ getFullName(item) }}</span>
                    <span class="usub">{{ item.email }}</span>
                    <span class="usub owner-sub" v-if="item.type === 'owner'"><i class="fas fa-hotel"></i> {{ item.businessName }}</span>
                  </div>
                </div>
              </td>
              <td>
                <span class="type-tag mat-well" :class="item.type">
                  <i :class="item.type === 'owner' ? 'fas fa-hotel' : 'fas fa-user-shield'"></i>
                  {{ getTypeLabel(item.type) }}
                </span>
              </td>
              <td>
                <span v-if="item.type === 'admin'" class="role-tag mat-well" :class="item.requestedRole">{{ item.roleLabel }}</span>
                <span v-else class="role-tag owner_type mat-well">{{ item.businessType || 'Accommodation' }}</span>
              </td>
              <td><span class="status-badge mat-well" :class="getStatusClass(item.status)">{{ getStatusLabel(item.status) }}</span></td>
              <td><span class="date-text">{{ formatDateTime(item.reviewedAt) }}</span></td>
              <td class="td-right">
                <button class="view-id-btn mat-skeuo-sm mat-pressable-sm" title="View Details" @click="viewRegistration(item)"><Eye size="14" /> View</button>
              </td>
            </template>

            <template v-else>
              <td>
                <div class="user-profile">
                  <div class="avatar-circle citizen">{{ getInitials(item) }}</div>
                  <span class="uname">{{ getFullName(item) }}</span>
                </div>
              </td>
              <td class="td-gray mono">@{{ item.username }}</td>
              <td class="td-gray">{{ item.email }}</td>
              <td><span class="date-text">{{ formatDate(item.createdAt) }}</span></td>
              <td class="td-right">
                <button class="action-btn mat-skeuo-sm mat-pressable-sm" title="View Profile" @click="viewCitizen(item)"><Eye size="14" /></button>
              </td>
            </template>
          </tr>
          <tr v-if="filteredList.length === 0">
            <td :colspan="emptyColspan" class="empty-row">
              <i :class="activeTab === 'owners' ? 'fas fa-hotel' : 'fas fa-users'"></i>
              <p>{{ activeTab === 'pending' ? 'No pending registrations.' : activeTab === 'completed' ? 'No completed registrations.' : activeTab === 'owners' ? 'No approved owner accounts yet. Approvals from the Pending tab will appear here.' : 'No records found.' }}</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- VIEW OWNER MODAL -->
    <Transition name="fade">
      <div v-if="showViewOwnerModal && selectedOwner" class="modal-overlay" @click.self="showViewOwnerModal = false">
        <div class="modal-card wide mat-glass-strong">
          <div class="modal-head">
            <div class="modal-head-left">
              <Hotel size="16" />
              <span>Owner Details</span>
              <span class="status-badge head-badge mat-well" :class="selectedOwner.status">{{ selectedOwner.status }}</span>
            </div>
            <button class="close-btn mat-skeuo-sm mat-pressable-sm" @click="showViewOwnerModal = false"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="registration-details">
              <div class="detail-section">
                <h4>Owner Information</h4>
                <div class="detail-grid">
                  <div class="detail-item"><label>Full Name</label><span>{{ getFullName(selectedOwner) }}</span></div>
                  <div class="detail-item"><label>Email</label><span>{{ selectedOwner.email }}</span></div>
                  <div class="detail-item"><label>Contact Number</label><span>{{ selectedOwner.contactNumber || 'Ã¢â‚¬â€' }}</span></div>
                  <div class="detail-item"><label>Registered On</label><span>{{ formatDateTime(selectedOwner.createdAt) }}</span></div>
                </div>
              </div>
              <div class="detail-section">
                <h4><i class="fas fa-hotel owner-icon"></i> Business Information</h4>
                <div class="detail-grid">
                  <div class="detail-item highlight-item owner-highlight"><label>Business Name</label><span class="owner-name">{{ selectedOwner.businessName }}</span></div>
                  <div class="detail-item"><label>Business Permit No.</label><span>{{ selectedOwner.businessPermitNo || 'Ã¢â‚¬â€' }}</span></div>
                </div>
              </div>
              <div class="detail-section">
                <h4>Resort Listings ({{ (selectedOwner.hotels || []).length }})</h4>
                <div v-if="(selectedOwner.hotels || []).length > 0" class="owner-hotels-list">
                  <div v-for="h in selectedOwner.hotels" :key="h.id" class="owner-hotel-item">
                    <div class="oh-info">
                      <span class="oh-name">{{ h.name }}</span>
                      <span class="oh-loc">{{ h.location || 'Ã¢â‚¬â€' }}</span>
                    </div>
                    <span class="status-badge mat-well" :class="h.published ? 'approved' : 'draft-badge'">{{ h.published ? 'Published' : 'Unpublished' }}</span>
                  </div>
                </div>
                <p v-else class="doc-missing"><i class="fas fa-info-circle"></i> This owner has no resort listings yet.</p>
              </div>
              <div class="detail-section" v-if="selectedOwner.validIdUrl">
                <h4>Valid ID on File</h4>
                <a v-if="isPdf(selectedOwner.validIdUrl)" :href="selectedOwner.validIdUrl" target="_blank" class="pdf-link">
                  <i class="fas fa-file-pdf"></i> Open Valid ID (PDF)
                </a>
                <div v-else class="id-preview-container"><img :src="selectedOwner.validIdUrl" alt="Valid ID" class="valid-id-img" /></div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel mat-skeuo-sm mat-pressable-danger" @click="showViewOwnerModal = false">Close</button>
            <button class="btn-save mat-skeuo-filled mat-pressable-filled" @click="toggleOwnerStatus(selectedOwner)">
              <Power size="14" /> {{ selectedOwner.status === 'active' ? 'Deactivate Account' : 'Activate Account' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- VIEW CITIZEN MODAL -->
    <Transition name="fade">
      <div v-if="showViewCitizenModal && selectedCitizen" class="modal-overlay" @click.self="showViewCitizenModal = false">
        <div class="modal-card mat-glass-strong">
          <div class="modal-head">
            <div class="modal-head-left">
              <i class="fas fa-user"></i>
              <span>Citizen Profile</span>
              <span class="status-badge head-badge mat-well" :class="selectedCitizen.isVerified ? 'approved' : 'inactive'">{{ selectedCitizen.isVerified ? 'Verified' : 'Unverified' }}</span>
            </div>
            <button class="close-btn mat-skeuo-sm mat-pressable-sm" @click="showViewCitizenModal = false"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="registration-details">
              <div class="detail-section">
                <h4>Personal Information</h4>
                <div class="detail-grid">
                  <div class="detail-item"><label>Full Name</label><span>{{ getFullName(selectedCitizen) }}</span></div>
                  <div class="detail-item"><label>Username</label><span class="mono">@{{ selectedCitizen.username }}</span></div>
                  <div class="detail-item"><label>Email</label><span>{{ selectedCitizen.email }}</span></div>
                  <div class="detail-item"><label>Contact Number</label><span>{{ selectedCitizen.phone || 'Ã¢â‚¬â€' }}</span></div>
                </div>
              </div>
              <div class="detail-section">
                <h4>Account</h4>
                <div class="detail-grid">
                  <div class="detail-item"><label>Verification</label><span>{{ selectedCitizen.isVerified ? 'Verified' : 'Unverified' }}</span></div>
                  <div class="detail-item"><label>Date Joined</label><span>{{ formatDateTime(selectedCitizen.createdAt) }}</span></div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel mat-skeuo-sm mat-pressable-danger" @click="showViewCitizenModal = false">Close</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ADD STAFF MODAL -->
    <Transition name="fade">
      <div v-if="showAddStaffModal" class="modal-overlay" @click.self="showAddStaffModal = false">
        <div class="modal-card mat-glass-strong">
          <div class="modal-head">
            <div class="modal-head-left"><UserPlus size="16" /><span>Add New Admin</span></div>
            <button class="close-btn mat-skeuo-sm mat-pressable-sm" @click="showAddStaffModal = false"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-group"><label>First Name *</label><input v-model="newStaff.firstName" type="text" /></div>
              <div class="form-group"><label>Middle Name</label><input v-model="newStaff.middleName" type="text" /></div>
              <div class="form-group"><label>Last Name *</label><input v-model="newStaff.lastName" type="text" /></div>
              <div class="form-group"><label>Email *</label><input v-model="newStaff.email" type="email" /></div>
              <div class="form-group"><label>Password *</label><input v-model="newStaff.password" type="password" /></div>
              <div class="form-group"><label>Employee ID</label><input v-model="newStaff.employeeId" type="text" /></div>
              <div class="form-group"><label>Department</label><input v-model="newStaff.department" type="text" /></div>
              <div class="form-group"><label>Position</label><input v-model="newStaff.position" type="text" /></div>
              <div class="form-group"><label>Contact Number</label><input v-model="newStaff.contactNumber" type="text" /></div>
              <div class="form-group highlight-group">
                <label>Role *</label>
                <select v-model="newStaff.role">
                  <option value="" disabled>Select Role...</option>
                  <option v-for="r in ADMIN_ROLES" :key="r.value" :value="r.value">{{ r.label }}</option>
                </select>
              </div>
              <div class="form-group full-w">
                <label>Valid ID (Optional for direct add)</label>
                <input type="file" accept=".jpg,.jpeg,.png" @change="handleAddStaffIdUpload" />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel mat-skeuo-sm mat-pressable-danger" @click="showAddStaffModal = false">Cancel</button>
            <button class="btn-save mat-skeuo-filled mat-pressable-filled" @click="saveStaff" :disabled="isLoading"><Check size="14" /> Save Admin</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- EDIT STAFF MODAL -->
    <Transition name="fade">
      <div v-if="showEditStaffModal" class="modal-overlay" @click.self="showEditStaffModal = false">
        <div class="modal-card mat-glass-strong">
          <div class="modal-head">
            <div class="modal-head-left"><Edit size="16" /><span>Edit Admin</span></div>
            <button class="close-btn mat-skeuo-sm mat-pressable-sm" @click="showEditStaffModal = false"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-group"><label>First Name *</label><input v-model="editStaff.firstName" type="text" /></div>
              <div class="form-group"><label>Middle Name</label><input v-model="editStaff.middleName" type="text" /></div>
              <div class="form-group"><label>Last Name *</label><input v-model="editStaff.lastName" type="text" /></div>
              <div class="form-group"><label>Email *</label><input v-model="editStaff.email" type="email" /></div>
              <div class="form-group"><label>Employee ID</label><input v-model="editStaff.employeeId" type="text" /></div>
              <div class="form-group"><label>Department</label><input v-model="editStaff.department" type="text" /></div>
              <div class="form-group"><label>Position</label><input v-model="editStaff.position" type="text" /></div>
              <div class="form-group"><label>Contact Number</label><input v-model="editStaff.contactNumber" type="text" /></div>
              <div class="form-group highlight-group">
                <label>Role *</label>
                <select v-model="editStaff.role">
                  <option v-for="r in ADMIN_ROLES" :key="r.value" :value="r.value">{{ r.label }}</option>
                </select>
              </div>
              <div class="form-group"><label>Status</label>
                <select v-model="editStaff.status"><option value="active">Active</option><option value="inactive">Inactive</option></select>
              </div>
              <div class="form-group full-w">
                <label>Update Valid ID</label>
                <input type="file" accept=".jpg,.jpeg,.png" @change="handleEditStaffIdUpload" />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel mat-skeuo-sm mat-pressable-danger" @click="showEditStaffModal = false">Cancel</button>
            <button class="btn-save mat-skeuo-filled mat-pressable-filled" @click="updateStaff" :disabled="isLoading"><Check size="14" /> Update Admin</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- VIEW REGISTRATION MODAL -->
    <Transition name="fade">
      <div v-if="showViewRegistrationModal && selectedRegistration" class="modal-overlay" @click.self="showViewRegistrationModal = false">
        <div class="modal-card wide mat-glass-strong">
          <div class="modal-head">
            <div class="modal-head-left">
              <FileText size="16" />
              <span>{{ selectedRegistration.type === 'owner' ? 'Owner Registration Details' : 'Admin Registration Details' }}</span>
              <span class="type-tag head-type mat-well" :class="selectedRegistration.type">{{ getTypeLabel(selectedRegistration.type) }}</span>
            </div>
            <button class="close-btn mat-skeuo-sm mat-pressable-sm" @click="showViewRegistrationModal = false"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <div class="registration-details">
              <div class="detail-section">
                <h4>Personal Information</h4>
                <div class="detail-grid">
                  <div class="detail-item"><label>Full Name</label><span>{{ getFullName(selectedRegistration) }}</span></div>
                  <div class="detail-item"><label>Email</label><span>{{ selectedRegistration.email }}</span></div>
                  <div class="detail-item" v-if="selectedRegistration.contactNumber"><label>Contact Number</label><span>{{ selectedRegistration.contactNumber }}</span></div>
                  <div class="detail-item" v-if="selectedRegistration.type === 'admin' && selectedRegistration.employeeId"><label>Employee ID</label><span>{{ selectedRegistration.employeeId }}</span></div>
                </div>
              </div>
              <div class="detail-section" v-if="selectedRegistration.type === 'owner'">
                <h4><i class="fas fa-hotel owner-icon"></i> Business Details</h4>
                <div class="detail-grid">
                  <div class="detail-item highlight-item owner-highlight"><label>Business Name</label><span class="owner-name">{{ selectedRegistration.businessName }}</span></div>
                  <div class="detail-item"><label>Barangay</label><span>{{ selectedRegistration.barangay || 'Ã¢â‚¬â€' }}</span></div>
                  <div class="detail-item"><label>Complete Address</label><span>{{ selectedRegistration.address || 'Ã¢â‚¬â€' }}</span></div>
                  <div class="detail-item"><label>Accommodation Type</label><span>{{ selectedRegistration.businessType || 'Ã¢â‚¬â€' }}</span></div>
                  <div class="detail-item"><label>Business Permit No.</label><span>{{ selectedRegistration.businessPermitNo || 'Ã¢â‚¬â€' }}</span></div>
                  <div class="detail-item"><label>Business Contact</label><span>{{ selectedRegistration.businessContact || 'Ã¢â‚¬â€' }}</span></div>
                  <div class="detail-item" v-if="selectedRegistration.businessEmail"><label>Business Email</label><span>{{ selectedRegistration.businessEmail }}</span></div>
                </div>
              </div>
              <div class="detail-section" v-if="selectedRegistration.type === 'admin'">
                <h4>Position Details</h4>
                <div class="detail-grid">
                  <div class="detail-item"><label>Department</label><span>{{ selectedRegistration.department || '-' }}</span></div>
                  <div class="detail-item"><label>Position</label><span>{{ selectedRegistration.position || '-' }}</span></div>
                  <div class="detail-item highlight-item"><label>Requested Role</label><span class="role-tag mat-well" :class="selectedRegistration.requestedRole">{{ selectedRegistration.roleLabel }}</span></div>
                </div>
              </div>
              <div class="detail-section" v-if="selectedRegistration.type === 'owner'">
                <h4>Submitted Documents</h4>
                <template v-if="ownerDocs.length > 0">
                  <div v-for="doc in ownerDocs" :key="doc.label" class="doc-block">
                    <div class="doc-label"><i class="fas fa-paperclip"></i> {{ doc.label }}</div>
                    <div v-if="!isPdf(doc.url)" class="doc-preview"><img :src="doc.url" :alt="doc.label" class="valid-id-img" /></div>
                    <a v-else :href="doc.url" target="_blank" class="pdf-link"><i class="fas fa-file-pdf"></i> Open {{ doc.label }} (PDF)</a>
                  </div>
                </template>
                <p v-else class="doc-missing"><i class="fas fa-info-circle"></i> Documents were deleted (this registration was rejected).</p>
              </div>
              <div class="detail-section" v-if="selectedRegistration.type === 'admin' && selectedRegistration.validIdUrl">
                <h4>Valid ID</h4>
                <a v-if="isPdf(selectedRegistration.validIdUrl)" :href="selectedRegistration.validIdUrl" target="_blank" class="pdf-link">
                  <i class="fas fa-file-pdf"></i> Open Valid ID (PDF)
                </a>
                <div v-else class="id-preview-container"><img :src="selectedRegistration.validIdUrl" alt="Valid ID" class="valid-id-img" /></div>
              </div>
              <div class="detail-section">
                <h4>Submission Info</h4>
                <div class="detail-grid">
                  <div class="detail-item"><label>Submitted On</label><span>{{ formatDateTime(selectedRegistration.createdAt) }}</span></div>
                </div>
              </div>
              <div class="detail-section" v-if="selectedRegistration.status !== 'pending'">
                <h4>Review Result</h4>
                <div class="detail-grid">
                  <div class="detail-item highlight-item" :class="'detail-' + selectedRegistration.status">
                    <label>Status</label>
                    <span class="status-badge mat-well" :class="getStatusClass(selectedRegistration.status)">{{ getStatusLabel(selectedRegistration.status) }}</span>
                  </div>
                  <div class="detail-item" v-if="selectedRegistration.reviewedAt"><label>Reviewed On</label><span>{{ formatDateTime(selectedRegistration.reviewedAt) }}</span></div>
                  <div class="detail-item" v-if="selectedRegistration.rejectionReason">
                    <label v-if="selectedRegistration.status === 'rejected'">Rejection Reason</label>
                    <label v-else>Review Note</label>
                    <span class="rejection-text mat-skeuo-sm mat-pressable-danger">{{ selectedRegistration.rejectionReason }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer" v-if="selectedRegistration.status === 'pending'">
            <button class="btn-reject mat-skeuo-sm mat-pressable-danger" @click="openRejectModal(selectedRegistration)"><X size="14" /> Reject</button>
            <button class="btn-approve mat-skeuo-filled mat-pressable-filled" @click="approveRegistration(selectedRegistration)">
              <Check size="14" /> {{ selectedRegistration.type === 'owner' ? 'Approve Owner' : 'Approve Registration' }}
            </button>
          </div>
          <div class="modal-footer" v-else>
            <button class="btn-cancel mat-skeuo-sm mat-pressable-danger" @click="showViewRegistrationModal = false">Close</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- REJECT MODAL -->
    <Transition name="fade">
      <div v-if="showRejectModal" class="modal-overlay" @click.self="showRejectModal = false">
        <div class="modal-card small mat-glass-strong">
          <div class="modal-head reject-head">
            <div class="modal-head-left"><X size="16" /><span>Reject {{ selectedRegistration?.type === 'owner' ? 'Owner' : 'Admin' }} Registration</span></div>
            <button class="close-btn mat-skeuo-sm mat-pressable-sm" @click="showRejectModal = false"><i class="fas fa-times"></i></button>
          </div>
          <div class="modal-body">
            <p class="reject-text mat-skeuo-sm mat-pressable-danger">Are you sure you want to reject this registration? Please provide a reason. The applicant will be notified by email.</p>
            <textarea v-model="rejectionReason" class="reject-textarea mat-skeuo-sm mat-pressable-danger" placeholder="Enter reason for rejection..." rows="4"></textarea>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel mat-skeuo-sm mat-pressable-danger" @click="showRejectModal = false">Cancel</button>
            <button class="btn-reject-confirm mat-skeuo-sm mat-pressable-danger" @click="rejectRegistration" :disabled="isLoading"><X size="14" /> Confirm Rejection</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; }
.user-panel { padding: 32px; background: var(--bg); min-height: 100%; font-family: var(--font-body); position: relative; }

.loading-overlay { position: fixed; inset: 0; background: var(--bg); z-index: 3000; display: flex; align-items: center; justify-content: center; }
.spinner { width: 40px; height: 40px; border: 4px solid var(--bdr); border-top-color: var(--ac); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.panel-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
.header-eyebrow { display: flex; align-items: center; gap: 8px; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--ac); margin-bottom: 5px; }
.eyebrow-line { width: 20px; height: 2px; background: var(--ac); border-radius: 1px; }
.header-left h2 { font-family: var(--font-display); font-size: 1.6rem; font-weight: 700; color: var(--fg); margin: 0 0 5px; }
.header-left p { font-size: 0.82rem; color: var(--mt); margin: 0; }
.add-btn { display: flex; align-items: center; gap: 7px; padding: 10px 18px; border-radius: var(--r-sm); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; font-family: var(--font-body); white-space: nowrap; flex-shrink: 0; }
.add-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px var(--acg); }
.tabs-bar { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 2px solid var(--bdr); }
.tab-btn { padding: 11px 20px; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; font-family: var(--font-body); display: flex; align-items: center; gap: 8px; position: relative; }
.tab-btn i { font-size: 0.85rem; }
.tab-btn:hover { color: var(--fg); }
.tab-btn.active { color: var(--fg); border-bottom-color: var(--ac); }
.pending-tab.active { border-bottom-color: var(--wn); }
.pending-badge { position: absolute; top: 4px; right: 4px; font-size: 0.6rem; font-weight: 700; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
.completed-tab.active { border-bottom-color: var(--ok); }
.completed-count { background: var(--card3); color: var(--mt); font-size: 0.6rem; font-weight: 700; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
.owners-tab.active { border-bottom-color: var(--ac); }
.owners-count { background: var(--acs); color: var(--ac); font-size: 0.6rem; font-weight: 700; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
.owners-tab.active .owners-count { background: var(--m-accent-solid); color: white; }
.filter-bar { background: var(--card-solid); padding: 13px 16px; border-radius: var(--r-md); display: flex; gap: 12px; margin-bottom: 16px; border: 1px solid var(--bdr); flex-wrap: wrap; }
.search-wrap { flex: 1; display: flex; align-items: center; background: var(--bg2); border: 1px solid var(--bdr); border-radius: var(--r-sm); padding: 0 12px; min-width: 200px; }
.search-wrap i { color: var(--mt); font-size: 0.8rem; }
.search-wrap input { border: none; background: transparent; padding: 9px 8px; width: 100%; outline: none; font-size: 0.84rem; color: var(--fg); font-family: var(--font-body); }
.search-wrap input::placeholder { color: var(--mt2); }
.filter-select { padding: 9px 12px; border: 1px solid var(--bdr); border-radius: var(--r-sm); font-size: 0.82rem; color: var(--fg); background: var(--bg2); font-family: var(--font-body); cursor: pointer; }
.filter-select:focus { outline: none; border-color: var(--ac); }
.data-panel { background: var(--card-solid); border-radius: var(--r-md); overflow: hidden; box-shadow: var(--shadow-sm); border: 1px solid var(--bdr); }
.panel-bar { background: var(--bg2); padding: 13px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--bdr); }
.bar-title { display: flex; align-items: center; gap: 8px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg); }
.bar-title i { color: var(--ac); }
.bar-count { font-size: 0.7rem; color: var(--mt); }
.data-table { width: 100%; border-collapse: collapse; }
.data-table thead tr { background: var(--bg3); border-bottom: 1px solid var(--bdr); }
.data-table th { padding: 11px 16px; text-align: left; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--mt); }
.data-row { border-bottom: 1px solid var(--bdr); transition: background 0.15s; }
.data-row:last-child { border-bottom: none; }
.data-row:hover { background: var(--card2); }
.data-table td { padding: 13px 16px; vertical-align: middle; font-size: 0.84rem; }
.user-profile { display: flex; align-items: center; gap: 11px; }
.avatar-circle { width: 36px; height: 36px; border-radius: var(--r-sm); flex-shrink: 0; background: linear-gradient(135deg, var(--m-accent-hi), var(--wn-solid)); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.04em; }
.avatar-circle.citizen { background: var(--acs); color: var(--ac); }
.avatar-circle.pending { background: var(--wns); color: var(--wn); }
.avatar-circle.approved { background: var(--oks); color: var(--ok); }
.avatar-circle.rejected { background: var(--dgs); color: var(--dg); }
.avatar-circle.owner-avatar { background: var(--vis); color: var(--vi); }
.user-info { display: flex; flex-direction: column; }
.uname { font-weight: 600; color: var(--fg); font-size: 0.88rem; }
.usub { font-size: 0.72rem; color: var(--mt); }
.business-name { display: block; }
.owner-sub { color: var(--ac); font-weight: 600; }
.owner-sub i { font-size: 0.68rem; margin-right: 2px; }
.listings-info { display: inline-flex; align-items: center; gap: 6px; font-size: 0.78rem; font-weight: 600; color: var(--fg); }
.listings-info.no-listings { color: var(--mt); font-weight: 400; font-style: italic; }
.type-tag { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; font-size: 0.68rem; font-weight: 700; border-radius: var(--r-sm); text-transform: uppercase; letter-spacing: 0.05em; }
.type-tag.admin { background: var(--tls); color: var(--tl); }
.type-tag.owner { background: var(--acs); color: var(--ac); border: 1px solid transparent; }
.type-tag.head-type { margin-left: 10px; }
.role-tag { display: inline-block; padding: 4px 10px; font-size: 0.7rem; font-weight: 700; border-radius: var(--r-sm); width: fit-content; }
.role-tag.main_controller { background: var(--wns); color: var(--wn); }
.role-tag.mho_admin { background: var(--tls); color: var(--tl); }
.role-tag.tourism_admin { background: var(--oks); color: var(--ok); }
.role-tag.bplo_admin { background: var(--vis); color: var(--vi); }
.role-tag.mdrrmo_admin { background: var(--dgs); color: var(--dg); }
.role-tag.owner_type { background: var(--acs); color: var(--ac); }
.status-badge { display: inline-block; padding: 4px 10px; font-size: 0.7rem; font-weight: 700; border-radius: var(--r-sm); text-transform: capitalize; }
.status-badge.active { background: var(--oks); color: var(--ok); }
.status-badge.inactive { background: var(--dgs); color: var(--dg); }
.status-badge.approved { background: var(--oks); color: var(--ok); }
.status-badge.rejected { background: var(--dgs); color: var(--dg); }
.status-badge.draft-badge { background: var(--card3); color: var(--mt); }
.status-badge.head-badge { margin-left: 10px; }
.td-gray { color: var(--mt); font-size: 0.82rem; }
.mono { font-family: var(--font-mono); }
.date-text { font-size: 0.78rem; color: var(--mt); }
.td-right { text-align: right; }
.view-id-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: var(--r-sm); font-size: 0.75rem; font-weight: 600; cursor: pointer; font-family: var(--font-body); }
.view-id-btn:hover { background: var(--card3); border-color: var(--bdr2); color: var(--fg); }
.action-btn { cursor: pointer; padding: 6px 9px; border-radius: var(--r-sm); font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px; }
.action-btn + .action-btn { margin-left: 4px; }
.action-btn:first-child { margin-left: 0; }
.action-btn:hover { background: var(--m-accent-solid); color: white; border-color: var(--m-accent-solid); }
.action-btn.danger:hover { background: var(--dg-solid); border-color: var(--dg-solid); color: white; }
.action-btn.approve:hover { background: var(--ok); border-color: var(--ok); color: var(--fg); }
.action-btn.reject:hover { background: var(--dg-solid); border-color: var(--dg-solid); color: white; }
.action-btn.warn:hover { background: var(--wn); border-color: var(--wn); color: var(--fg); }
.empty-row { text-align: center; padding: 48px 20px !important; color: var(--mt); }
.empty-row i { font-size: 1.8rem; display: block; margin-bottom: 10px; opacity: 0.4; }
.empty-row p { font-size: 0.84rem; }
.modal-overlay { position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(3px); }
.modal-card { width: 100%; max-width: 580px; border-radius: var(--r-lg); overflow: hidden; max-height: 90vh; display: flex; flex-direction: column; }
.modal-card.wide { max-width: 700px; }
.modal-card.small { max-width: 450px; }
.modal-head { background: var(--bg2); padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--ac); flex-shrink: 0; }
.modal-head.reject-head { border-bottom-color: var(--dg); }
.modal-head-left { display: flex; align-items: center; gap: 9px; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg); }
.close-btn { width: 32px; height: 32px; border-radius: var(--r-sm); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.82rem; }
.close-btn:hover { background: var(--dgs); color: var(--dg); border-color: var(--dg); }
.modal-body { padding: 22px 20px; overflow-y: auto; flex: 1; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 13px; }
.form-group { display: flex; flex-direction: column; gap: 5px; }
.form-group.full-w { grid-column: span 2; }
.form-group label { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--mt); }
.form-group input, .form-group select { padding: 9px 12px; border: 1px solid var(--bdr); border-radius: var(--r-sm); font-size: 0.84rem; color: var(--fg); font-family: var(--font-body); background: var(--bg2); }
.form-group input:focus, .form-group select:focus { outline: none; border-color: var(--ac); background: var(--bg3); }
.highlight-group { background: var(--wns); padding: 12px; border-left: 3px solid var(--wn); border-radius: 0 var(--r-sm) var(--r-sm) 0; }
.highlight-group label { color: var(--wn); }
.modal-footer { padding: 16px 20px; border-top: 1px solid var(--bdr); display: flex; justify-content: flex-end; gap: 10px; background: var(--bg2); flex-shrink: 0; }
.btn-cancel { padding: 9px 18px; border-radius: var(--r-sm); cursor: pointer; font-size: 0.8rem; font-weight: 600; font-family: var(--font-body); }
.btn-cancel:hover { border-color: var(--bdr2); color: var(--fg); }
.btn-save { display: flex; align-items: center; gap: 7px; padding: 9px 18px; border-radius: var(--r-sm); cursor: pointer; font-size: 0.8rem; font-weight: 700; font-family: var(--font-body); }
.btn-save:hover { transform: translateY(-1px); box-shadow: 0 6px 20px var(--acg); }
.btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-approve { display: flex; align-items: center; gap: 7px; padding: 9px 18px; border-radius: var(--r-sm); cursor: pointer; font-size: 0.8rem; font-weight: 700; font-family: var(--font-body); }
.btn-approve:hover { filter: brightness(1.1); }
.btn-reject { display: flex; align-items: center; gap: 7px; padding: 9px 18px; border-radius: var(--r-sm); cursor: pointer; font-size: 0.8rem; font-weight: 700; font-family: var(--font-body); }
.btn-reject:hover { background: var(--dg-solid); color: white; }
.btn-reject-confirm { display: flex; align-items: center; gap: 7px; padding: 9px 18px; border-radius: var(--r-sm); cursor: pointer; font-size: 0.8rem; font-weight: 700; font-family: var(--font-body); }
.btn-reject-confirm:hover { filter: brightness(1.1); }
.btn-reject-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
.registration-details { display: flex; flex-direction: column; gap: 20px; }
.detail-section h4 { font-size: 0.82rem; font-weight: 700; color: var(--fg); padding-bottom: 8px; border-bottom: 1px solid var(--bdr); margin-bottom: 12px; }
.detail-section h4 .owner-icon { color: var(--ac); margin-right: 4px; }
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.detail-item { display: flex; flex-direction: column; gap: 4px; }
.detail-item label { font-size: 0.68rem; font-weight: 600; color: var(--mt); text-transform: uppercase; letter-spacing: 0.05em; }
.detail-item span { font-size: 0.88rem; color: var(--fg); font-weight: 500; }
.highlight-item { background: var(--wns); padding: 8px; border-radius: var(--r-sm); }
.owner-highlight { background: var(--acs); border-left: 3px solid var(--ac); }
.owner-name { color: var(--ac) !important; font-weight: 700 !important; }
.owner-hotels-list { display: flex; flex-direction: column; gap: 8px; }
.owner-hotel-item { display: flex; justify-content: space-between; align-items: center; background: var(--bg2); border: 1px solid var(--bdr); border-radius: var(--r-sm); padding: 10px 14px; }
.oh-info { display: flex; flex-direction: column; gap: 2px; }
.oh-name { font-size: 0.85rem; font-weight: 600; color: var(--fg); }
.oh-loc { font-size: 0.72rem; color: var(--mt); }
.doc-block { margin-bottom: 14px; }
.doc-label { font-size: 0.72rem; font-weight: 700; color: var(--fg2); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
.doc-label i { color: var(--mt); margin-right: 4px; }
.doc-preview { background: var(--bg2); border: 1px solid var(--bdr); border-radius: var(--r-sm); padding: 12px; text-align: center; }
.doc-missing { display: flex; align-items: center; gap: 8px; background: var(--bg2); border: 1px dashed var(--bdr); padding: 12px; border-radius: var(--r-sm); color: var(--mt); font-size: 0.8rem; }
.pdf-link { display: inline-flex; align-items: center; gap: 8px; background: var(--dgs); color: var(--dg); border: 1px solid var(--dgg); padding: 9px 14px; border-radius: var(--r-sm); font-size: 0.8rem; font-weight: 600; text-decoration: none; transition: all 0.18s; }
.pdf-link:hover { background: var(--dg-solid); color: white; }
.id-preview-container { background: var(--bg2); border: 1px solid var(--bdr); border-radius: var(--r-sm); padding: 16px; text-align: center; }
.valid-id-img { max-width: 100%; max-height: 250px; object-fit: contain; border-radius: var(--r-sm); cursor: zoom-in; }
.rejection-text { padding: 10px 14px; border-radius: var(--r-sm); font-size: 0.82rem; line-height: 1.5; }
.reject-text { font-size: 0.85rem; margin-bottom: 12px; line-height: 1.5; }
.reject-textarea { width: 100%; padding: 12px; border-radius: var(--r-sm); font-size: 0.88rem; font-family: var(--font-body); resize: vertical; }
.reject-textarea:focus { outline: none; border-color: var(--dg); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.22s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@media (max-width: 768px) {
  .user-panel { padding: 20px 16px; }
  .form-grid { grid-template-columns: 1fr; }
  .form-group.full-w { grid-column: span 1; }
  .detail-grid { grid-template-columns: 1fr; }
}

</style>