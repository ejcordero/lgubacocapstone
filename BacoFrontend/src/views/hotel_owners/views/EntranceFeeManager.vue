<script setup>
import { ref, onMounted } from 'vue';
import { API } from '@/api'

const getToken = () => localStorage.getItem('baco_owner_token');

const fees = ref([]);
const hasHotel = ref(false);
const loading = ref(true);
const saving = ref(false);
const pageError = ref('');
const modalError = ref('');

const showAddModal = ref(false);
const showEditModal = ref(false);
const newFee = ref({ name: '', price: 0, description: '' });
const editFee = ref(null);

const PRESET_NAMES = ['Day Tour — Adult', 'Day Tour — Child', 'Overnight Entrance', 'Cottage Rental (per table)', 'Floating Cottage Rental'];

const fetchFees = async () => {
  loading.value = true;
  pageError.value = '';
  try {
    const r = await fetch(`${API}/owner/hotel`, { headers: { 'Authorization': `Bearer ${getToken()}` } });
    if (r.status === 401 || r.status === 403) { window.location.href = '/owner/login'; return; }
    const d = await r.json();
    hasHotel.value = !!d.hotel;
    fees.value = d.hotel ? (d.hotel.entranceFees || []) : [];
  } catch { pageError.value = 'Failed to load entrance fees.'; }
  finally { loading.value = false; }
};
onMounted(fetchFees);

const openAdd = () => { newFee.value = { name: '', price: 0, description: '' }; modalError.value = ''; showAddModal.value = true; };
const openEdit = (f) => { editFee.value = { ...f }; modalError.value = ''; showEditModal.value = true; };

const saveFee = async () => {
  modalError.value = '';
  if (!newFee.value.name.trim()) { modalError.value = 'Fee name is required.'; return; }
  if (!newFee.value.price || Number(newFee.value.price) <= 0) { modalError.value = 'Price must be greater than 0.'; return; }
  saving.value = true;
  try {
    const r = await fetch(`${API}/owner/hotel/fees`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(newFee.value)
    });
    const d = await r.json();
    if (r.ok) { fees.value.push(d.fee); showAddModal.value = false; }
    else modalError.value = d.message || 'Failed to add fee.';
  } catch { modalError.value = 'Network error.'; }
  finally { saving.value = false; }
};

const saveEdit = async () => {
  modalError.value = '';
  if (!editFee.value.name.trim()) { modalError.value = 'Fee name is required.'; return; }
  saving.value = true;
  try {
    const r = await fetch(`${API}/owner/hotel/fees/${editFee.value.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(editFee.value)
    });
    const d = await r.json();
    if (r.ok) {
      const i = fees.value.findIndex(f => f.id === d.fee.id);
      if (i !== -1) fees.value[i] = d.fee;
      showEditModal.value = false;
    } else modalError.value = d.message || 'Failed to update fee.';
  } catch { modalError.value = 'Network error.'; }
  finally { saving.value = false; }
};

const deleteFee = async (f) => {
  if (!confirm(`Delete entrance fee "${f.name}"?`)) return;
  saving.value = true;
  try {
    const r = await fetch(`${API}/owner/hotel/fees/${f.id}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const d = await r.json();
    if (r.ok) fees.value = fees.value.filter(x => x.id !== f.id);
    else alert(d.message || 'Failed to delete.');
  } catch { alert('Network error.'); }
  finally { saving.value = false; }
};
</script>

<template>
  <div class="fee-manager">
    <div class="page-title">
      <div>
        <h1>Entrance <span>Fees</span></h1>
        <p>These are the rates visitors pay per head — the primary bookable option on your resort page.</p>
      </div>
      <button v-if="hasHotel" class="btn-primary" @click="openAdd"><i class="fas fa-plus"></i>Add Fee Type</button>
    </div>

    <div v-if="loading" class="state-box"><div class="spinner"></div><p>Loading fees...</p></div>
    <div v-else-if="pageError" class="error-alert"><i class="fas fa-exclamation-circle"></i> {{ pageError }}</div>

    <div v-else-if="!hasHotel" class="empty-state">
      <div class="empty-icon"><i class="fas fa-hotel"></i></div>
      <h2>No Accommodation Yet</h2>
      <p>Register your accommodation first in <strong>My Accommodation</strong>, then set your entrance fees here.</p>
    </div>

    <template v-else>
      <div class="info-banner">
        <i class="fas fa-info-circle"></i>
        Visitors book entrance by choosing a fee type, a visit date, and the number of guests.
        Add at least one fee (e.g., <strong>Day Tour — Adult</strong>) so your resort is bookable.
      </div>

      <div v-if="fees.length" class="fee-grid">
        <div v-for="f in fees" :key="f.id" class="fee-card" :class="{ inactive: f.status === 'inactive' }">
          <div class="fee-top">
            <span class="fee-name">{{ f.name }}</span>
            <span class="fee-status" :class="f.status">{{ f.status === 'active' ? 'Active' : 'Hidden' }}</span>
          </div>
          <div class="fee-price">₱{{ Number(f.price).toLocaleString() }}<small> / head</small></div>
          <p class="fee-desc">{{ f.description || 'No description.' }}</p>
          <div class="fee-actions">
            <button class="btn-secondary" @click="openEdit(f)"><i class="fas fa-pen"></i>Edit</button>
            <button class="btn-delete" :disabled="saving" @click="deleteFee(f)"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state small">
        <div class="empty-icon"><i class="fas fa-ticket"></i></div>
        <h2>No Entrance Fees Yet</h2>
        <p>Add your first entrance fee type so visitors can book a day tour or visit.</p>
        <button class="btn-primary" @click="openAdd"><i class="fas fa-plus"></i>Add Fee Type</button>
      </div>
    </template>

    <!-- ADD / EDIT MODALS -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal-content">
        <div class="modal-header"><h3>Add Entrance Fee</h3>
          <button class="close-btn" @click="showAddModal = false"><i class="fas fa-times"></i></button></div>
        <div class="modal-body">
          <div v-if="modalError" class="error-alert"><i class="fas fa-exclamation-circle"></i> {{ modalError }}</div>
          <div class="form-group"><label>Fee Name *</label><input v-model="newFee.name" type="text" list="preset-names" placeholder="e.g. Day Tour — Adult" />
            <datalist id="preset-names"><option v-for="p in PRESET_NAMES" :key="p" :value="p" /></datalist></div>
          <div class="form-group"><label>Price per Head (₱) *</label><input v-model="newFee.price" type="number" min="1" /></div>
          <div class="form-group"><label>Description</label><input v-model="newFee.description" type="text" placeholder="e.g. Access to pools and beach area, 8AM–5PM" /></div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="showAddModal = false">Cancel</button>
          <button class="btn-primary" :disabled="saving" @click="saveFee"><i v-if="saving" class="fas fa-spinner fa-spin"></i><template v-else><i class="fas fa-save"></i>Save</template></button>
        </div>
      </div>
    </div>

    <div v-if="showEditModal && editFee" class="modal-overlay" @click.self="showEditModal = false">
      <div class="modal-content">
        <div class="modal-header"><h3>Edit Entrance Fee</h3>
          <button class="close-btn" @click="showEditModal = false"><i class="fas fa-times"></i></button></div>
        <div class="modal-body">
          <div v-if="modalError" class="error-alert"><i class="fas fa-exclamation-circle"></i> {{ modalError }}</div>
          <div class="form-group"><label>Fee Name *</label><input v-model="editFee.name" type="text" /></div>
          <div class="form-group"><label>Price per Head (₱) *</label><input v-model="editFee.price" type="number" min="1" /></div>
          <div class="form-group"><label>Description</label><input v-model="editFee.description" type="text" /></div>
          <div class="form-group"><label>Status</label>
            <select v-model="editFee.status">
              <option value="active">Active — bookable</option>
              <option value="inactive">Hidden</option>
            </select></div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="showEditModal = false">Cancel</button>
          <button class="btn-primary" :disabled="saving" @click="saveEdit"><i v-if="saving" class="fas fa-spinner fa-spin"></i><template v-else><i class="fas fa-save"></i>Update</template></button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fee-manager { animation: fadeIn .5s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
.page-title { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; flex-wrap: wrap; gap: 14px; }
.page-title h1 { font-family: 'Unbounded', sans-serif; font-size: clamp(26px, 4vw, 40px); font-weight: 800; color: var(--fg); letter-spacing: -0.04em; margin: 0; }
.page-title h1 span { background: linear-gradient(135deg, var(--ac), var(--wn)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.page-title p { color: var(--mt); font-size: 13px; margin: 6px 0 0; }
.btn-primary { padding: 10px 18px; background: var(--eco-mint); color: var(--bb-on-highlight); border: none; border-radius: 11px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: all .3s; box-shadow: 0 8px 24px var(--acg); }
.btn-primary:hover { transform: translateY(-2px); }
.btn-primary:disabled { opacity: .7; cursor: not-allowed; }
.btn-secondary { padding: 9px 16px; background: var(--bg2); color: var(--fg2); border: 1px solid var(--bdr); border-radius: 10px; font-size: 11px; font-weight: 700; text-transform: uppercase; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
.btn-delete { padding: 9px 13px; background: transparent; color: #C70505; border: 1px solid rgba(198,40,40,.35); border-radius: 10px; cursor: pointer; }
.btn-delete:hover { background: #C70505; color: #fff; }
.info-banner { display: flex; align-items: center; gap: 10px; background: var(--tlg); border: 1px solid var(--tl); color: var(--tl); font-size: 12.5px; padding: 12px 16px; border-radius: 12px; margin-bottom: 20px; }
.error-alert { padding: 11px 14px; background: rgba(198,40,40,.06); border: 1px solid rgba(198,40,40,.25); border-radius: 10px; color: #C70505; font-size: 12px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.state-box { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 70px 20px; color: var(--mt); }
.spinner { width: 36px; height: 36px; border: 3px solid var(--bdr); border-top-color: var(--ac); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.empty-state { text-align: center; background: var(--card); border: 1px dashed var(--bdr); border-radius: 20px; padding: 60px 30px; }
.empty-state.small { padding: 40px 24px; }
.empty-icon { width: 72px; height: 72px; border-radius: 18px; background: linear-gradient(135deg, var(--acs), transparent); color: var(--ac); display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 18px; }
.empty-state h2 { font-family: 'Unbounded', sans-serif; font-size: 18px; font-weight: 800; color: var(--fg); margin: 0 0 8px; }
.empty-state p { color: var(--mt); font-size: 13px; margin: 0 auto 18px; max-width: 400px; }
.fee-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
.fee-card { background: var(--card); border: 1px solid var(--bdr); border-radius: 14px; padding: 18px; transition: all .25s; }
.fee-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(20,22,31,.08); }
.fee-card.inactive { opacity: .55; }
.fee-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; }
.fee-name { font-weight: 700; color: var(--fg); font-size: 14px; }
.fee-status { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; padding: 3px 8px; border-radius: 6px; }
.fee-status.active { background: var(--okg); color: var(--ok); }
.fee-status.inactive { background: var(--bg2); color: var(--mt); }
.fee-price { font-family: 'Unbounded', sans-serif; font-size: 22px; font-weight: 800; color: var(--ac); margin-bottom: 6px; }
.fee-price small { font-family: 'Inter', sans-serif; font-size: 11px; color: var(--mt); font-weight: 600; }
.fee-desc { color: var(--mt); font-size: 12px; line-height: 1.5; margin: 0 0 14px; min-height: 34px; }
.fee-actions { display: flex; justify-content: space-between; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; }
.modal-content { background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; width: 90%; max-width: 440px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.5); }
.modal-header { padding: 18px 20px; border-bottom: 1px solid var(--bdr); display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { font-family: 'Unbounded', sans-serif; font-size: 16px; font-weight: 700; color: var(--fg); margin: 0; }
.close-btn { background: transparent; border: none; color: var(--mt); font-size: 16px; cursor: pointer; }
.modal-body { padding: 20px; }
.modal-footer { padding: 18px 20px; border-top: 1px solid var(--bdr); display: flex; justify-content: flex-end; gap: 10px; }
.form-group { margin-bottom: 14px; }
.form-group label { display: block; color: var(--fg2); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
.form-group input, .form-group select { width: 100%; padding: 11px 14px; background: var(--bg2); border: 1px solid var(--bdr); border-radius: 10px; color: var(--fg); font-size: 13px; outline: none; box-sizing: border-box; font-family: inherit; }
.form-group input:focus, .form-group select:focus { border-color: var(--ac); box-shadow: 0 0 0 3px var(--acs); }
</style>