<script setup>
import { ref, reactive, computed } from 'vue'
import { GoogleMap, Marker, Autocomplete } from 'vue3-google-map'

defineProps({ items: Array })
const emit = defineEmits(['save', 'deleted'])

// ⚠️ SECURITY WARNING: Never share your API key publicly in a real production app.
// Restrict it in Google Cloud Console -> APIs & Services -> Credentials to only your domain.
const API_KEY = 'AIzaSyDA78r68DJDmSsAIYjF4Of9p--sq_An3h4'

const getBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.readAsDataURL(file)
  reader.onload = () => resolve(reader.result)
  reader.onerror = error => reject(error)
})

const handleDelete = async (id) => {
  if (!confirm('Are you sure you want to delete this destination?')) return
  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:3000/api'}/destinations/${id}`, { method: 'DELETE' })
    const result = await response.json()
    if (response.ok) { alert(result.message || 'Deleted successfully!'); emit('deleted') }
    else alert(result.error || 'Error deleting destination')
  } catch (error) { console.error(error); alert('An error occurred while deleting.') }
}

const isModalOpen = ref(false)
const isEditing = ref(false)
const getDefaultItem = () => ({ 
  id: 'new', name: '', location: '', image: '', status: 'Active', description: '', contact: '', activities: [], 
  lat: null, lng: null 
})
const formData = reactive(getDefaultItem())

// Map State
const autocompleteRef = ref(null)
const center = ref({ lat: 13.35, lng: 121.10 }) // Default: Baco, Oriental Mindoro

// Helper to compute center based on form data or default
const mapCenter = computed(() => {
  if (formData.lat && formData.lng) {
    return { lat: formData.lat, lng: formData.lng }
  }
  return { lat: 13.35, lng: 121.10 }
})

const openAddModal = () => { 
  Object.assign(formData, getDefaultItem()); 
  // Reset map center to default when adding new
  center.value = { lat: 13.35, lng: 121.10 }; 
  isEditing.value = false; 
  isModalOpen.value = true;
}

const openEditModal = (item) => { 
  Object.assign(formData, JSON.parse(JSON.stringify(item))); 
  isEditing.value = true; 
  isModalOpen.value = true;
  // Set map center to existing location
  if (item.lat && item.lng) {
    center.value = { lat: item.lat, lng: item.lng };
  } else {
    center.value = { lat: 13.35, lng: 121.10 };
  }
}

// --- Google Maps Logic ---

// 1. Handle Search (Autocomplete)
const onPlaceChanged = () => {
  const place = autocompleteRef.value.getPlace();
  if (!place.geometry || !place.geometry.location) return;

  const lat = place.geometry.location.lat();
  const lng = place.geometry.location.lng();

  // Update Form Data
  formData.lat = lat;
  formData.lng = lng;

  // Move Map View
  center.value = { lat, lng };
}

// 2. Handle Dragging the Pin
const handleMarkerDrag = (e) => {
  const lat = e.latLng.lat();
  const lng = e.latLng.lng();
  
  formData.lat = lat;
  formData.lng = lng;
  
  // Optional: Pan map to new marker position
  // center.value = { lat, lng }; 
}

// --- End Google Maps Logic ---

const addActivity = () => formData.activities.push({ name: '', image: '' })
const removeActivity = (index) => formData.activities.splice(index, 1)

const handleMainImageUpload = async (event) => {
  const file = event.target.files[0]
  if (file) formData.image = await getBase64(file)
}
const handleActivityImageUpload = async (event, index) => {
  const file = event.target.files[0]
  if (file) formData.activities[index].image = await getBase64(file)
}

const handleSave = async () => {
  if (!formData.name) return alert("Name is required")
  try {
    const url = isEditing.value ? `${import.meta.env.VITE_API_BASE || 'http://localhost:3000/api'}/destinations/${formData.id}` : `${import.meta.env.VITE_API_BASE || 'http://localhost:3000/api'}/destinations`
    const method = isEditing.value ? 'PUT' : 'POST'
    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
    const result = await response.json()
    if (response.ok) { alert(result.message || 'Saved successfully!'); isModalOpen.value = false; emit('save') }
    else alert(result.error || 'Error saving destination')
  } catch (error) { console.error(error); alert('An error occurred while saving.') }
}
</script>

<template>
  <div class="grid-container">

    <!-- HEADER -->
    <div class="grid-header">
      <div class="header-left">
        <div class="header-eyebrow">
          <span class="eyebrow-line"></span>
          Tourism Directory
        </div>
        <h2>Tourism Destinations</h2>
        <p>Manage resorts, natural attractions, and historical sites.</p>
      </div>
      <button class="add-btn mat-skeuo-filled mat-pressable-filled" @click="openAddModal">
        <i class="fas fa-plus"></i> Add Destination
      </button>
    </div>

    <!-- CARDS -->
    <div class="cards-wrapper">
      <div v-for="item in items" :key="item.id" class="destination-card">
        <div class="card-img" :style="{ backgroundImage: `url(${item.image})` }">
          <span class="status-badge mat-well" :class="item.status?.toLowerCase()">{{ item.status }}</span>
          <div class="card-actions-overlay">
            <button class="overlay-btn edit" @click.stop="openEditModal(item)">
              <i class="fas fa-pen"></i>
            </button>
            <button class="overlay-btn delete" @click="handleDelete(item.id)">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="card-info" @click.stop="openEditModal(item)">
          <h3>{{ item.name }}</h3>
          <div class="card-meta">
            <span class="card-location"><i class="fas fa-location-dot"></i> {{ item.location }}</span>
            <span v-if="item.description" class="card-desc">{{ item.description }}</span>
          </div>
        </div>
      </div>

      <div v-if="!items || items.length === 0" class="empty-state">
        <i class="fas fa-umbrella-beach"></i>
        <p>No destinations added yet.</p>
        <button class="add-btn-inline mat-skeuo-filled mat-pressable-filled" @click="openAddModal">Add First Destination</button>
      </div>
    </div>
  </div>

  <!-- MODAL -->
  <Transition name="fade">
    <div v-if="isModalOpen" class="modal-overlay" @click.self="isModalOpen = false">
      <div class="modal-card mat-glass-strong">

        <div class="modal-head">
          <div class="modal-head-left">
            <i class="fas fa-umbrella-beach"></i>
            <span>{{ isEditing ? 'Edit Destination' : 'Add New Destination' }}</span>
          </div>
          <button class="close-btn mat-skeuo-sm mat-pressable-sm" @click="isModalOpen = false"><i class="fas fa-times"></i></button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>Destination Name</label>
            <input type="text" v-model="formData.name" placeholder="e.g. Infinity Farm" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Location (Text)</label>
              <input type="text" v-model="formData.location" placeholder="e.g. Brgy. Mangangan I" />
            </div>
            <div class="form-group">
              <label>Status</label>
              <select v-model="formData.status">
                <option value="Active">Active</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>

          <!-- GOOGLE MAP SECTION -->
          <div class="form-group">
            <label>Pin Location</label>
            
  <Autocomplete ref="autocompleteRef" @place_changed="onPlaceChanged">
    <template #default="{ slotProps }">
      <input
        ref="slotProps.input"
        type="text"
        class="map-search-input"
        placeholder="Search (e.g. Mayabig Basecamp, Mt. Halcon)..."
      />
    </template>
  </Autocomplete>

            <!-- Google Map Display -->
            <GoogleMap
              :api-key="API_KEY"
              style="width: 100%; height: 300px; margin-top: 10px;"
              :center="mapCenter"
              :zoom="15"
            >
              <Marker 
                :options="{ 
                  position: mapCenter, 
                  draggable: true,
                  title: 'Drag me to adjust location'
                }" 
                @dragend="handleMarkerDrag" 
              />
            </GoogleMap>
            
            <small class="coords-display" v-if="formData.lat && formData.lng">
              Coordinates: {{ formData.lat.toFixed(6) }}, {{ formData.lng.toFixed(6) }}
            </small>
            <small class="coords-display" v-else style="color: #ef4444;">
              Please search or drag the marker to set location.
            </small>
          </div>

          <div class="form-group">
            <label>Destination Image</label>
            <input type="file" accept="image/*" @change="handleMainImageUpload" />
            <div class="img-preview" v-if="formData.image" :style="{ backgroundImage: `url(${formData.image})` }"></div>
          </div>
          <div class="form-group">
            <label>Contact Number</label>
            <input type="text" v-model="formData.contact" placeholder="0912-345-6789" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="formData.description" rows="3" placeholder="A serene and historic destination..."></textarea>
          </div>

          <!-- ACTIVITIES -->
          <div class="activities-section">
            <div class="activities-header">
              <label>Key Features / Activities</label>
              <button type="button" class="btn-small mat-skeuo-sm mat-pressable-sm" @click="addActivity">+ Add Activity</button>
            </div>
            <div v-if="formData.activities.length === 0" class="activities-empty">No activities added yet.</div>
            <div v-for="(act, index) in formData.activities" :key="index" class="activity-row">
              <div class="activity-inputs">
                <input type="text" v-model="act.name" placeholder="Activity Name (e.g. Swimming)" />
                <input type="file" accept="image/*" @change="(e) => handleActivityImageUpload(e, index)" />
              </div>
              <button class="btn-remove mat-skeuo-sm mat-pressable-danger" @click="removeActivity(index)"><i class="fas fa-trash"></i></button>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel mat-skeuo-sm mat-pressable-danger" @click="isModalOpen = false">Cancel</button>
          <button class="btn-save mat-skeuo-filled mat-pressable-filled" @click="handleSave">
            <i class="fas fa-check"></i>
            {{ isEditing ? 'Update Destination' : 'Create Destination' }}
          </button>
        </div>

      </div>
    </div>
  </Transition>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@300;400;500;600;700&display=swap');
*, *::before, *::after { box-sizing: border-box; }

.grid-container {
  padding: 32px; background: var(--card2);
  min-height: 100%; font-family: 'Inter', sans-serif;
}

/* HEADER */
.grid-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  margin-bottom: 28px; gap: 16px; flex-wrap: wrap;
}
.header-eyebrow {
  display: flex; align-items: center; gap: 8px;
  font-size: 0.62rem; font-weight: 700; letter-spacing: 0.2em;
  text-transform: uppercase; color: #c0392b; margin-bottom: 5px;
}
.eyebrow-line { width: 20px; height: 2px; background: #c0392b; border-radius: 1px; }
.header-left h2 {
  font-family: 'Playfair Display', serif;
  font-size: 1.6rem; font-weight: 700; color: var(--fg); margin: 0 0 5px;
}
.header-left p { font-size: 0.82rem; color: #8896a7; margin: 0; }

.add-btn { display: flex; align-items: center; gap: 7px; padding: 10px 18px; border-radius: 3px; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; font-family: 'Inter', sans-serif; white-space: nowrap; flex-shrink: 0; }
.add-btn:hover { background: var(--fg2); }

/* CARDS */
.cards-wrapper { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }

.destination-card {
  background: white; border-radius: 3px; overflow: hidden;
  cursor: pointer; transition: all 0.18s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  border: 1px solid var(--bdr);
}
.destination-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.1); border-color: var(--fg); }

.card-img {
  position: relative; height: 180px;
  background-size: cover; background-position: center;
  background-color: var(--card2);
}
.status-badge { position: absolute; top: 10px; right: 10px; font-size: 0.62rem; padding: 3px 8px; border-radius: 2px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
.status-badge.active { background: #15803d; }
.status-badge.closed { background: #c0392b; }

.card-actions-overlay {
  position: absolute; inset: 0;
  background: rgba(11,29,53,0.6);
  display: flex; align-items: center; justify-content: center; gap: 12px;
  opacity: 0; transition: opacity 0.2s;
}
.destination-card:hover .card-actions-overlay { opacity: 1; }
.overlay-btn {
  width: 38px; height: 38px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.3);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 0.85rem; transition: all 0.18s; color: white; background: rgba(255,255,255,0.1);
}
.overlay-btn.edit:hover { background: var(--fg); border-color: #c9a84c; color: #c9a84c; }
.overlay-btn.delete:hover { background: #c0392b; border-color: #c0392b; }

.card-info { padding: 16px; }
.card-info h3 { margin: 0 0 8px; font-size: 0.95rem; font-weight: 700; color: var(--fg); }
.card-meta { display: flex; flex-direction: column; gap: 4px; }
.card-location { font-size: 0.78rem; color: #c0392b; font-weight: 600; }
.card-location i { margin-right: 4px; }
.card-desc {
  font-size: 0.78rem; color: #8896a7;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
}

.empty-state { grid-column: 1/-1; text-align: center; padding: 56px 20px; color: #8896a7; }
.empty-state i { font-size: 2.5rem; display: block; margin-bottom: 12px; opacity: 0.3; }
.empty-state p { font-size: 0.88rem; margin-bottom: 16px; }
.add-btn-inline { display: inline-flex; align-items: center; gap: 7px; padding: 10px 20px; border-radius: 3px; font-size: 0.78rem; font-weight: 700; cursor: pointer; font-family: 'Inter', sans-serif; }

/* MODAL */
.modal-overlay {
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(0,0,0,0.75);
  display: flex; justify-content: center; align-items: center;
  padding: 20px;
}
.modal-card { width: 100%; max-width: 680px; border-radius: 3px; overflow: hidden; display: flex; flex-direction: column; max-height: 90vh; }
.modal-head {
  background: var(--fg); padding: 15px 20px;
  display: flex; justify-content: space-between; align-items: center;
  border-bottom: 2px solid #c9a84c; flex-shrink: 0;
}
.modal-head-left {
  display: flex; align-items: center; gap: 9px;
  font-size: 0.72rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: white;
}
.modal-head-left i { color: #c9a84c; }
.close-btn { width: 30px; height: 30px; border-radius: 2px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.82rem; }
.close-btn:hover { background: rgba(192,57,43,0.3); color: white; }

.modal-body { padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
.form-group { display: flex; flex-direction: column; gap: 5px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 13px; }
.form-group label {
  font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #4a5568;
}
.form-group input, .form-group textarea, .form-group select, .map-search-input {
  padding: 9px 12px; border: 1px solid var(--bdr); border-radius: 3px;
  font-size: 0.84rem; color: var(--fg); font-family: 'Inter', sans-serif; background: var(--card2);
  width: 100%; box-sizing: border-box;
}
.form-group input:focus, .form-group textarea:focus, .form-group select:focus, .map-search-input:focus {
  outline: none; border-color: var(--fg); background: white;
}
.form-group textarea { resize: vertical; }
.img-preview { height: 90px; margin-top: 8px; border-radius: 3px; background-size: cover; background-position: center; border: 1px solid var(--bdr); }

/* GOOGLE MAP STYLES */
.google-map-wrapper { margin-top: 5px; }
.coords-display {
  display: block; margin-top: 5px; color: var(--fg); font-weight: 600; font-size: 0.75rem;
}

/* ACTIVITIES */
.activities-section {
  border: 1px solid var(--bdr); border-radius: 3px; padding: 14px; background: var(--card-solid);
}
.activities-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.activities-header label {
  font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #4a5568;
}
.btn-small { padding: 4px 10px; border-radius: 2px; font-size: 0.75rem; cursor: pointer; font-weight: 700; font-family: 'Inter', sans-serif; }
.btn-small:hover { background: var(--fg); color: white; }
.activities-empty { text-align: center; color: #8896a7; font-size: 0.82rem; padding: 8px 0; }
.activity-row { display: flex; gap: 10px; margin-bottom: 8px; align-items: flex-start; }
.activity-inputs { flex: 1; display: flex; flex-direction: column; gap: 5px; }
.btn-remove { width: 34px; height: 34px; border-radius: 3px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; }
.btn-remove:hover { background: var(--dg-soft); }

.modal-footer {
  padding: 16px 20px; border-top: 1px solid var(--bdr);
  display: flex; justify-content: flex-end; gap: 10px; background: var(--card-solid); flex-shrink: 0;
}
.btn-cancel { padding: 9px 18px; border-radius: 3px; cursor: pointer; font-size: 0.8rem; font-weight: 600; font-family: 'Inter', sans-serif; }
.btn-save { display: flex; align-items: center; gap: 7px; padding: 9px 18px; border-radius: 3px; cursor: pointer; font-size: 0.8rem; font-weight: 700; font-family: 'Inter', sans-serif; }
.btn-save:hover { background: var(--fg2); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.22s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@media (max-width: 768px) {
  .grid-container { padding: 20px 16px; }
  .form-row { grid-template-columns: 1fr; }
  .cards-wrapper { grid-template-columns: 1fr; }
}

</style>