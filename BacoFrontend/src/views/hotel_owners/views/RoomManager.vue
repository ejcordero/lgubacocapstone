<script setup>
import { ref, computed, onMounted } from 'vue';
import RoomCard from '../components/ui/RoomCard.vue';
import StatusBadge from '../components/ui/StatusBadge.vue';
import { API } from '@/api'

const getToken = () => localStorage.getItem('baco_owner_token');

// ── Room Amenities (realistic, grouped by category) ──
const ROOM_AMENITY_GROUPS = [
  { category: 'Climate Control', items: ['Air Conditioning', 'Electric Fan'] },
  { category: 'Bathroom', items: ['Private Bathroom', 'Hot & Cold Shower', 'Free Toiletries', 'Fresh Towels', 'Hair Dryer', 'Slippers'] },
  { category: 'Connectivity & Entertainment', items: ['Free WiFi', 'Smart TV', 'Cable TV'] },
  { category: 'Food & Drinks', items: ['Electric Kettle', 'Free Coffee & Tea', 'Free Bottled Water', 'Mini Refrigerator', 'Dining Utensils'] },
  { category: 'Furnishings', items: ['Wardrobe / Closet', 'Work Desk', 'Sofa', 'Extra Bed Available'] },
  { category: 'Views & Outdoor', items: ['Balcony / Terrace', 'Sea View', 'Mountain View', 'Garden View'] },
  { category: 'Safety & Security', items: ['Smoke Detector', 'Fire Extinguisher', 'First Aid Kit', 'Safe / Lockbox'] },
  { category: 'Housekeeping & Services', items: ['Daily Housekeeping', 'Room Service', '24/7 Front Desk', 'Laundry Service'] }
];
const ESSENTIAL_ROOM_AMENITIES = ['Private Bathroom', 'Hot & Cold Shower', 'Free Toiletries', 'Fresh Towels', 'Free WiFi'];

// ── State ──
const hotel = ref(null);            // owner's accommodation (needed for rooms)
const loading = ref(true);
const saving = ref(false);
const pageError = ref('');
const modalError = ref('');

const searchQuery = ref('');
const statusFilter = ref('');

const showAddModal = ref(false);
const showDetailModal = ref(false);
const showEditModal = ref(false);

const selectedRoom = ref(null);

const newRoom = ref({ roomType: '', capacity: 2, pricePerNight: 0, totalCount: 1, status: 'active', description: '', amenities: [] });
const editRoom = ref(null);

// Gallery of the room currently being added/edited.
// Holds a MIX of: new base64 data URLs + existing server image URLs (preserved on edit).
const gallery = ref([]);

// ── Fetch owner's hotel (contains rooms) ──
const fetchHotel = async () => {
  loading.value = true;
  pageError.value = '';
  try {
    const r = await fetch(`${API}/owner/hotel`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (r.status === 401 || r.status === 403) { window.location.href = '/owner/login'; return; }
    const d = await r.json();
    hotel.value = d.hotel;
  } catch {
    pageError.value = 'Failed to load your rooms. Check your connection.';
  } finally {
    loading.value = false;
  }
};

onMounted(fetchHotel);

// ── Rooms mapped to RoomCard shape ──
const rooms = computed(() => {
  if (!hotel.value) return [];
  return (hotel.value.rooms || []).map(r => ({
    id: r.id,
    hotel: hotel.value.name,
    name: r.name,
    type: r.type || r.name,           // FIXED: prefer the real room_type over the display name
    capacity: r.capacity,
    price: r.price,
    status: r.status,                 // 'active' | 'inactive'
    amenities: Array.isArray(r.amenities) ? r.amenities : [],
    description: r.description,
    image: r.image || '',
    gallery: Array.isArray(r.gallery) ? r.gallery : [],
    totalCount: r.totalCount
  }));
});

const filteredRooms = computed(() => {
  return rooms.value.filter(r => {
    const q = searchQuery.value.toLowerCase();
    const matchesSearch = r.name.toLowerCase().includes(q);
    const matchesStatus = !statusFilter.value || r.status === statusFilter.value;
    return matchesSearch && matchesStatus;
  });
});

// ── Gallery upload (multi-select) ──
const handleImageUpload = (event) => {
  const files = Array.from(event.target.files || []);
  event.target.value = '';
  if (!files.length) return;
  for (const file of files) {
    if (!file.type.startsWith('image/')) { modalError.value = 'Please choose image files only.'; continue; }
    if (file.size > 3 * 1024 * 1024) { modalError.value = 'Each image must be under 3MB.'; continue; }
    const reader = new FileReader();
    reader.onload = (e) => {
      gallery.value.push(e.target.result);
      if (modalError.value.startsWith('Each image')) modalError.value = '';
    };
    reader.readAsDataURL(file);
  }
};
const removeImage = (idx) => gallery.value.splice(idx, 1);
const setCoverImage = (idx) => {
  if (idx === 0) return;
  const [img] = gallery.value.splice(idx, 1);
  gallery.value.unshift(img);
};

// ── Amenity chip selection ──
const toggleAmenityIn = (list, amenity) => {
  const i = list.indexOf(amenity);
  if (i >= 0) list.splice(i, 1);
  else list.push(amenity);
};
const selectEssentials = (list) => {
  ESSENTIAL_ROOM_AMENITIES.forEach(a => { if (!list.includes(a)) list.push(a); });
};
const clearAmenities = (list) => list.splice(0, list.length);

// ── Add ──
const openAddModal = () => {
  newRoom.value = { roomType: '', capacity: 2, pricePerNight: 0, totalCount: 1, status: 'active', description: '', amenities: [] };
  gallery.value = [];
  modalError.value = '';
  showAddModal.value = true;
};
const closeAddModal = () => { showAddModal.value = false; };

const saveRoom = async () => {
  modalError.value = '';
  if (!newRoom.value.roomType.trim()) { modalError.value = 'Room type / name is required.'; return; }
  if (!newRoom.value.pricePerNight || Number(newRoom.value.pricePerNight) <= 0) { modalError.value = 'Price per night must be greater than 0.'; return; }
  if (gallery.value.length === 0) { modalError.value = 'Please add at least 1 room photo.'; return; }
  if (newRoom.value.amenities.length === 0) { modalError.value = 'Select at least 1 amenity so guests know what is included.'; return; }

  saving.value = true;
  try {
    const r = await fetch(`${API}/owner/hotel/rooms`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomType: newRoom.value.roomType.trim(),
        capacity: Number(newRoom.value.capacity) || 2,
        pricePerNight: Number(newRoom.value.pricePerNight),
        totalCount: Number(newRoom.value.totalCount) || 1,
        status: newRoom.value.status,
        description: newRoom.value.description.trim(),
        amenities: [...newRoom.value.amenities],
        image: gallery.value[0] || '',
        galleryImages: [...gallery.value]
      })
    });
    const d = await r.json();
    if (r.ok) {
      hotel.value.rooms.push(d.room);
      showAddModal.value = false;
    } else {
      modalError.value = d.message || 'Failed to add room.';
    }
  } catch {
    modalError.value = 'Network error. Please try again.';
  } finally {
    saving.value = false;
  }
};

// ── Detail ──
const openDetailModal = (room) => { selectedRoom.value = room; showDetailModal.value = true; };
const closeDetailModal = () => { showDetailModal.value = false; };

// ── Edit ──
const openEditModal = (room) => {
  editRoom.value = {
    id: room.id,
    roomType: room.name,
    capacity: room.capacity,
    pricePerNight: room.price,
    totalCount: room.totalCount || 1,
    status: room.status,
    description: room.description || '',
    amenities: [...(room.amenities || [])]
  };
  // Preload existing photos (server URLs) so untouched photos are preserved on save
  gallery.value = (room.gallery?.length ? [...room.gallery] : (room.image ? [room.image] : []));
  modalError.value = '';
  showEditModal.value = true;
  showDetailModal.value = false;
};
const closeEditModal = () => { showEditModal.value = false; editRoom.value = null; };

const saveEdit = async () => {
  modalError.value = '';
  if (!editRoom.value.roomType.trim()) { modalError.value = 'Room type / name is required.'; return; }
  if (gallery.value.length === 0) { modalError.value = 'Please keep at least 1 room photo.'; return; }
  if (editRoom.value.amenities.length === 0) { modalError.value = 'Select at least 1 amenity so guests know what is included.'; return; }
  if (!confirm(`Are you sure you want to update the room "${editRoom.value.roomType.trim()}"?`)) return;

  saving.value = true;
  try {
    const r = await fetch(`${API}/owner/hotel/rooms/${editRoom.value.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomType: editRoom.value.roomType.trim(),
        capacity: Number(editRoom.value.capacity) || 2,
        pricePerNight: Number(editRoom.value.pricePerNight),
        totalCount: Number(editRoom.value.totalCount) || 1,
        status: editRoom.value.status,
        description: editRoom.value.description.trim(),
        amenities: [...editRoom.value.amenities],
        image: gallery.value[0] || '',
        galleryImages: [...gallery.value]   // server URLs (kept) + base64 (new) — backend handles both
      })
    });
    const d = await r.json();
    if (r.ok) {
      const idx = hotel.value.rooms.findIndex(r => r.id === d.room.id);
      if (idx !== -1) hotel.value.rooms[idx] = d.room;
      showEditModal.value = false;
    } else {
      modalError.value = d.message || 'Failed to update room.';
    }
  } catch {
    modalError.value = 'Network error. Please try again.';
  } finally {
    saving.value = false;
  }
};

// ── Delete ──
const deleteRoom = async (room) => {
  if (!confirm(`Delete room "${room.name}"? This cannot be undone.`)) return;
  saving.value = true;
  try {
    const r = await fetch(`${API}/owner/hotel/rooms/${room.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const d = await r.json();
    if (r.ok) {
      hotel.value.rooms = hotel.value.rooms.filter(r => r.id !== room.id);
      showDetailModal.value = false;
    } else {
      alert(d.message || 'Failed to delete room.');
    }
  } catch {
    alert('Network error.');
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="room-manager">
    <div class="page-title">
      <div>
        <h1>Room <span>Types</span></h1>
        <p v-if="hotel">Manage the bookable room types for <strong>{{ hotel.name }}</strong>.</p>
      </div>
      <button v-if="hotel" class="btn-primary" @click="openAddModal"><i class="fas fa-plus"></i>Add Room Type</button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="state-box"><div class="spinner"></div><p>Loading rooms...</p></div>

    <div v-else-if="pageError" class="error-alert"><i class="fas fa-exclamation-circle"></i> {{ pageError }}</div>

    <!-- ═══ NO ACCOMMODATION YET ═══ -->
    <div v-else-if="!hotel" class="empty-state">
      <div class="empty-icon"><i class="fas fa-door-closed"></i></div>
      <h2>No Accommodation Yet</h2>
      <p>You need to register your accommodation first before adding room types. Head over to <strong>My Accommodation</strong> to get started.</p>
    </div>

    <!-- ═══ ROOMS ═══ -->
    <template v-else>
      <div class="filters">
        <div class="search-wrap">
          <i class="fas fa-search"></i>
          <input v-model="searchQuery" type="text" placeholder="Search room types..." />
        </div>
        <select v-model="statusFilter">
          <option value="">All Status</option>
          <option value="active">Active (Bookable)</option>
          <option value="inactive">Inactive (Hidden)</option>
        </select>
      </div>

      <div v-if="filteredRooms.length" class="room-grid">
        <RoomCard v-for="room in filteredRooms" :key="room.id" :room="room" @view="openDetailModal" />
      </div>
      <div v-else class="empty-state small">
        <div class="empty-icon"><i class="fas fa-bed"></i></div>
        <h2>No Room Types Yet</h2>
        <p>Add your first room type — this is what tourists will see and book inside your listing.</p>
        <button class="btn-primary" @click="openAddModal"><i class="fas fa-plus"></i>Add Room Type</button>
      </div>
    </template>

    <!-- 1. ADD ROOM MODAL -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="closeAddModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Add Room Type</h3>
          <button class="close-btn" @click="closeAddModal"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div v-if="modalError" class="error-alert"><i class="fas fa-exclamation-circle"></i> {{ modalError }}</div>

          <!-- Gallery upload (multiple) -->
          <div class="form-group">
            <label>Room Photos <span class="req">*</span> <span class="label-hint">(first photo = cover)</span></label>
            <div v-if="gallery.length === 0" class="image-upload-area">
              <input type="file" id="add-room-img" accept="image/*" multiple @change="handleImageUpload" hidden />
              <label for="add-room-img" class="upload-label">
                <i class="fas fa-cloud-upload-alt"></i>
                <span>Click to upload photos</span>
                <small>You can select multiple images (JPG/PNG, max 3MB each)</small>
              </label>
            </div>
            <div v-else class="gallery-grid">
              <div v-for="(img, gi) in gallery" :key="gi" class="gallery-item">
                <img :src="img" alt="Room photo" />
                <span v-if="gi === 0" class="cover-badge">COVER</span>
                <button v-else type="button" class="cover-btn" title="Set as cover" @click="setCoverImage(gi)"><i class="fas fa-star"></i></button>
                <button type="button" class="remove-img-btn" @click="removeImage(gi)"><i class="fas fa-times"></i></button>
              </div>
              <label class="gallery-add">
                <i class="fas fa-plus"></i>
                <span>Add photo</span>
                <input type="file" accept="image/*" multiple class="hidden-input" @change="handleImageUpload" />
              </label>
            </div>
          </div>

          <div class="form-group"><label>Room Type / Name *</label><input v-model="newRoom.roomType" type="text" placeholder="e.g. Deluxe Suite, Family Room" /></div>
          <div class="form-row">
            <div class="form-group"><label>Capacity (Guests)</label><input v-model="newRoom.capacity" type="number" min="1" /></div>
            <div class="form-group"><label>Price / Night (₱) *</label><input v-model="newRoom.pricePerNight" type="number" min="0" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Total Units</label><input v-model="newRoom.totalCount" type="number" min="1" />
              <p class="input-hint">How many rooms of this type you have</p>
            </div>
            <div class="form-group"><label>Status</label>
              <select v-model="newRoom.status">
                <option value="active">Active — bookable</option>
                <option value="inactive">Inactive — hidden</option>
              </select>
            </div>
          </div>

          <!-- Amenity chips -->
          <div class="form-group">
            <label>Room Amenities <span class="req">*</span></label>
            <div class="am-quick">
              <button type="button" class="am-quick-btn" @click="selectEssentials(newRoom.amenities)">⚡ Select essentials</button>
              <button type="button" class="am-quick-btn clear" @click="clearAmenities(newRoom.amenities)">Clear all</button>
              <span class="am-count">{{ newRoom.amenities.length }} selected</span>
            </div>
            <div class="am-groups">
              <div v-for="grp in ROOM_AMENITY_GROUPS" :key="grp.category">
                <div class="am-cat">{{ grp.category }}</div>
                <div class="am-chips">
                  <button v-for="a in grp.items" :key="a" type="button" class="am-chip" :class="{ active: newRoom.amenities.includes(a) }" @click="toggleAmenityIn(newRoom.amenities, a)">{{ a }}</button>
                </div>
              </div>
            </div>
            <p class="input-hint">Only select amenities this room genuinely offers — guests rely on these when booking.</p>
          </div>

          <div class="form-group"><label>Description</label><textarea v-model="newRoom.description" rows="3" placeholder="Brief description"></textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeAddModal">Cancel</button>
          <button class="btn-primary" :disabled="saving" @click="saveRoom">
            <i v-if="saving" class="fas fa-spinner fa-spin"></i>
            <template v-else><i class="fas fa-save"></i>Save Room</template>
          </button>
        </div>
      </div>
    </div>

    <!-- 2. VIEW DETAILS MODAL -->
    <div v-if="showDetailModal && selectedRoom" class="modal-overlay" @click.self="closeDetailModal">
      <div class="modal-content detail-modal">
        <div class="modal-header">
          <h3>Room Details</h3>
          <button class="close-btn" @click="closeDetailModal"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div class="detail-image" :style="selectedRoom.image ? { backgroundImage: `url(${selectedRoom.image})` } : {}">
            <StatusBadge :status="selectedRoom.status" class="detail-badge" />
            <span v-if="selectedRoom.gallery?.length > 1" class="photo-count"><i class="fas fa-camera"></i> {{ selectedRoom.gallery.length }} photos</span>
          </div>

          <!-- Photo thumbnails — click to swap the main image -->
          <div v-if="selectedRoom.gallery?.length > 1" class="gallery-strip">
            <img v-for="(g, gi) in selectedRoom.gallery" :key="gi" :src="g"
                 :class="{ active: selectedRoom.image === g }"
                 @click="selectedRoom.image = g" alt="Thumbnail" />
          </div>

          <div class="detail-header">
            <h2>{{ selectedRoom.name }}</h2>
          </div>
          <p class="detail-sub">{{ selectedRoom.hotel }}</p>
          <p class="detail-desc">{{ selectedRoom.description || 'No description.' }}</p>

          <div class="detail-stats">
            <div class="stat-box"><span class="stat-label">Capacity</span><span class="stat-value">{{ selectedRoom.capacity }} Guests</span></div>
            <div class="stat-box"><span class="stat-label">Price / Night</span><span class="stat-value">₱{{ Number(selectedRoom.price).toLocaleString() }}</span></div>
            <div class="stat-box"><span class="stat-label">Total Units</span><span class="stat-value">{{ selectedRoom.totalCount }}</span></div>
          </div>

          <div v-if="selectedRoom.amenities && selectedRoom.amenities.length" class="amenities-section">
            <h4>Amenities ({{ selectedRoom.amenities.length }})</h4>
            <div class="amenities-list">
              <span v-for="(amenity, i) in selectedRoom.amenities" :key="i" class="amenity-tag">
                <i class="fas fa-check-circle"></i> {{ amenity }}
              </span>
            </div>
          </div>
          <div v-else class="amenities-section">
            <p class="input-hint">No amenities listed for this room yet — click Edit Room to add them.</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-delete" :disabled="saving" @click="deleteRoom(selectedRoom)"><i class="fas fa-trash"></i>Delete</button>
          <button class="btn-primary" @click="openEditModal(selectedRoom)"><i class="fas fa-pen"></i>Edit Room</button>
        </div>
      </div>
    </div>

    <!-- 3. EDIT ROOM MODAL -->
    <div v-if="showEditModal && editRoom" class="modal-overlay" @click.self="closeEditModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Edit Room Type</h3>
          <button class="close-btn" @click="closeEditModal"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div v-if="modalError" class="error-alert"><i class="fas fa-exclamation-circle"></i> {{ modalError }}</div>

          <!-- Gallery upload (existing photos preloaded, add/remove/cover) -->
          <div class="form-group">
            <label>Room Photos <span class="req">*</span> <span class="label-hint">(first photo = cover)</span></label>
            <div v-if="gallery.length === 0" class="image-upload-area">
              <input type="file" id="edit-room-img" accept="image/*" multiple @change="handleImageUpload" hidden />
              <label for="edit-room-img" class="upload-label">
                <i class="fas fa-cloud-upload-alt"></i>
                <span>Click to upload photos</span>
                <small>You can select multiple images (JPG/PNG, max 3MB each)</small>
              </label>
            </div>
            <div v-else class="gallery-grid">
              <div v-for="(img, gi) in gallery" :key="gi" class="gallery-item">
                <img :src="img" alt="Room photo" />
                <span v-if="gi === 0" class="cover-badge">COVER</span>
                <button v-else type="button" class="cover-btn" title="Set as cover" @click="setCoverImage(gi)"><i class="fas fa-star"></i></button>
                <button type="button" class="remove-img-btn" @click="removeImage(gi)"><i class="fas fa-times"></i></button>
              </div>
              <label class="gallery-add">
                <i class="fas fa-plus"></i>
                <span>Add photo</span>
                <input type="file" accept="image/*" multiple class="hidden-input" @change="handleImageUpload" />
              </label>
            </div>
          </div>

          <div class="form-group"><label>Room Type / Name *</label><input v-model="editRoom.roomType" type="text" /></div>
          <div class="form-row">
            <div class="form-group"><label>Capacity (Guests)</label><input v-model="editRoom.capacity" type="number" min="1" /></div>
            <div class="form-group"><label>Price / Night (₱)</label><input v-model="editRoom.pricePerNight" type="number" min="0" /></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Total Units</label><input v-model="editRoom.totalCount" type="number" min="1" /></div>
            <div class="form-group"><label>Status</label>
              <select v-model="editRoom.status">
                <option value="active">Active — bookable</option>
                <option value="inactive">Inactive — hidden</option>
              </select>
            </div>
          </div>

          <!-- Amenity chips -->
          <div class="form-group">
            <label>Room Amenities <span class="req">*</span></label>
            <div class="am-quick">
              <button type="button" class="am-quick-btn" @click="selectEssentials(editRoom.amenities)">⚡ Select essentials</button>
              <button type="button" class="am-quick-btn clear" @click="clearAmenities(editRoom.amenities)">Clear all</button>
              <span class="am-count">{{ editRoom.amenities.length }} selected</span>
            </div>
            <div class="am-groups">
              <div v-for="grp in ROOM_AMENITY_GROUPS" :key="grp.category">
                <div class="am-cat">{{ grp.category }}</div>
                <div class="am-chips">
                  <button v-for="a in grp.items" :key="a" type="button" class="am-chip" :class="{ active: editRoom.amenities.includes(a) }" @click="toggleAmenityIn(editRoom.amenities, a)">{{ a }}</button>
                </div>
              </div>
            </div>
            <p class="input-hint">Only select amenities this room genuinely offers — guests rely on these when booking.</p>
          </div>

          <div class="form-group"><label>Description</label><textarea v-model="editRoom.description" rows="3"></textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeEditModal">Cancel</button>
          <button class="btn-primary" :disabled="saving" @click="saveEdit">
            <i v-if="saving" class="fas fa-spinner fa-spin"></i>
            <template v-else><i class="fas fa-save"></i>Update Room</template>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.room-manager { animation: fadeIn .5s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

.page-title { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 28px; flex-wrap: wrap; gap: 14px; }
.page-title h1 { font-family: 'Unbounded', sans-serif; font-size: clamp(28px, 5vw, 48px); font-weight: 800; color: var(--fg); letter-spacing: -0.04em; margin: 0; line-height: .95; }
.page-title h1 span { background: linear-gradient(135deg, var(--ac), var(--wn)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.page-title p { color: var(--mt); font-size: 13px; margin: 6px 0 0; }
.page-title p strong { color: var(--fg); }

.btn-primary { padding: 10px 18px; background: var(--eco-mint); color: var(--bb-on-highlight); border: none; border-radius: 11px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: all .3s; box-shadow: 0 8px 24px var(--acg); }
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 36px var(--acg); }
.btn-primary:disabled { opacity: .7; cursor: not-allowed; }
.btn-secondary { padding: 10px 18px; background: var(--bg2); color: var(--fg2); border: 1px solid var(--bdr); border-radius: 11px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; cursor: pointer; transition: all .3s; }
.btn-secondary:hover { background: var(--card2); }
.btn-delete { padding: 10px 18px; background: transparent; color: #C70505; border: 1px solid rgba(198,40,40,.35); border-radius: 11px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: all .3s; margin-right: auto; }
.btn-delete:hover { background: #C70505; color: #fff; }
.btn-delete:disabled { opacity: .6; cursor: not-allowed; }

.filters { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
.search-wrap { position: relative; flex: 1; min-width: 220px; }
.search-wrap i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--mt); font-size: 12px; }
.search-wrap input, .filters select { padding: 10px 14px; background: var(--bg2); border: 1px solid var(--bdr); border-radius: 10px; color: var(--fg); font-size: 13px; outline: none; transition: all .3s; }
.search-wrap input { width: 100%; padding-left: 40px; }
.filters select { min-width: 180px; }
.search-wrap input:focus, .filters select:focus { border-color: var(--ac); box-shadow: 0 0 0 3px var(--acs); }

.room-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }

/* States */
.state-box { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 80px 20px; color: var(--mt); }
.spinner { width: 36px; height: 36px; border: 3px solid var(--bdr); border-top-color: var(--ac); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.empty-state { text-align: center; background: var(--card); border: 1px dashed var(--bdr); border-radius: 20px; padding: 70px 30px; }
.empty-state.small { padding: 50px 24px; }
.empty-icon { width: 76px; height: 76px; border-radius: 20px; background: linear-gradient(135deg, var(--acs), transparent); color: var(--ac); display: flex; align-items: center; justify-content: center; font-size: 30px; margin: 0 auto 20px; }
.empty-state h2 { font-family: 'Unbounded', sans-serif; font-size: 20px; font-weight: 800; color: var(--fg); margin: 0 0 10px; }
.empty-state p { color: var(--mt); font-size: 13.5px; line-height: 1.7; max-width: 440px; margin: 0 auto 22px; }
.empty-state strong { color: var(--fg); }

.error-alert { padding: 11px 14px; background: rgba(198, 40, 40, .06); border: 1px solid rgba(198, 40, 40, .25); border-radius: 10px; color: #C70505; font-size: 12px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }

/* Modal Styles */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; animation: fadeIn .2s ease; }
.modal-content { background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; width: 90%; max-width: 500px; box-shadow: 0 20px 60px rgba(0,0,0,.5); animation: slideUp .3s cubic-bezier(.22,1,.36,1); max-height: 90vh; overflow-y: auto; }
.detail-modal { max-width: 550px; }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.modal-header { padding: 20px; border-bottom: 1px solid var(--bdr); display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { font-family: 'Unbounded', sans-serif; font-size: 18px; font-weight: 700; color: var(--fg); margin: 0; }
.close-btn { background: transparent; border: none; color: var(--mt); font-size: 16px; cursor: pointer; padding: 4px; }
.close-btn:hover { color: var(--dg, #C70505); }
.modal-body { padding: 20px; }
.form-group { margin-bottom: 14px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.form-group label { display: block; color: var(--fg2); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
.form-group input, .form-group select, .form-group textarea { width: 100%; padding: 11px 14px; background: var(--bg2); border: 1px solid var(--bdr); border-radius: 10px; color: var(--fg); font-size: 13px; outline: none; transition: all .3s; box-sizing: border-box; font-family: inherit; }
.form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: var(--ac); box-shadow: 0 0 0 3px var(--acs); }
.modal-footer { padding: 20px; border-top: 1px solid var(--bdr); display: flex; justify-content: flex-end; gap: 10px; }
.input-hint { color: var(--mt); font-size: 10.5px; margin: 4px 0 0; }
.req { color: #C70505; }
.label-hint { color: var(--mt); text-transform: none; letter-spacing: 0; font-weight: 600; }

/* ── Gallery upload (multi-photo) ── */
.image-upload-area { border: 2px dashed var(--bdr); border-radius: 12px; padding: 30px 20px; text-align: center; transition: all .3s; background: var(--bg2); }
.image-upload-area:hover { border-color: var(--ac); background: var(--acs); }
.upload-label { cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--fg2); font-weight: 600; font-size: 13px; }
.upload-label i { font-size: 28px; color: var(--ac); margin-bottom: 4px; }
.upload-label small { color: var(--mt); font-size: 10.5px; font-weight: 500; }
.gallery-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.gallery-item { position: relative; aspect-ratio: 1 / 1; border-radius: 10px; overflow: hidden; border: 1px solid var(--bdr); background: var(--bg2); }
.gallery-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cover-badge { position: absolute; top: 6px; left: 6px; background: var(--eco-mint); color: var(--bb-on-highlight); font-size: 8.5px; font-weight: 800; letter-spacing: .8px; padding: 3px 8px; border-radius: 999px; }
.cover-btn { position: absolute; bottom: 6px; left: 6px; width: 24px; height: 24px; border-radius: 50%; border: none; background: rgba(0,0,0,.65); color: #F2B807; cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center; transition: background .2s; }
.cover-btn:hover { background: rgba(0,0,0,.9); }
.gallery-item .remove-img-btn { top: 6px; right: 6px; width: 24px; height: 24px; font-size: 10px; }
.gallery-add { aspect-ratio: 1 / 1; border: 2px dashed var(--bdr); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: var(--mt); cursor: pointer; font-size: 11px; font-weight: 700; transition: all .2s; background: var(--bg2); }
.gallery-add:hover { border-color: var(--ac); color: var(--ac); background: var(--acs); }
.gallery-add i { font-size: 18px; }
.hidden-input { display: none; }

/* ── Amenity chip groups ── */
.am-quick { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.am-quick-btn { padding: 6px 12px; border-radius: 8px; border: 1px solid var(--bdr); background: var(--bg2); color: var(--fg2); font-size: 11px; font-weight: 700; cursor: pointer; transition: all .2s; }
.am-quick-btn:hover { border-color: var(--ac); color: var(--ac); }
.am-quick-btn.clear:hover { border-color: #C70505; color: #C70505; }
.am-count { font-size: 11px; color: var(--mt); font-weight: 600; margin-left: auto; }
.am-groups { display: flex; flex-direction: column; gap: 14px; max-height: 280px; overflow-y: auto; padding: 14px; border: 1px solid var(--bdr); border-radius: 12px; background: var(--bg2); }
.am-cat { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .8px; color: var(--mt); margin-bottom: 7px; }
.am-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.am-chip { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--bdr); background: var(--card, #fff); color: var(--fg2); font-size: 11.5px; font-weight: 600; cursor: pointer; transition: all .15s; }
.am-chip:hover { border-color: var(--ac); color: var(--ac); }
.am-chip.active { background: var(--eco-mint); border-color: transparent; color: var(--bb-on-highlight); }

/* Detail modal: photo thumbnails + counter */
.photo-count { position: absolute; bottom: 12px; right: 12px; background: rgba(0,0,0,.65); color: #fff; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; backdrop-filter: blur(4px); }
.gallery-strip { display: flex; gap: 8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 4px; }
.gallery-strip img { width: 64px; height: 64px; object-fit: cover; border-radius: 8px; border: 2px solid transparent; cursor: pointer; flex-shrink: 0; transition: all .2s; }
.gallery-strip img:hover { opacity: .85; }
.gallery-strip img.active { border-color: var(--ac); }

/* Detail Modal */
.detail-image { height: 200px; background-size: cover; background-position: center; border-radius: 12px; position: relative; margin-bottom: 16px; background-color: var(--bg2); }
.detail-badge { position: absolute; top: 12px; right: 12px; }
.detail-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
.detail-header h2 { font-family: 'Unbounded', sans-serif; font-size: 20px; font-weight: 800; color: var(--fg); margin: 0; }
.detail-sub { color: var(--mt); font-size: 13px; margin: 0 0 12px; font-weight: 600; }
.detail-desc { color: var(--fg2); font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
.detail-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
.stat-box { background: var(--bg2); padding: 12px; border-radius: 10px; text-align: center; border: 1px solid var(--bdr); }
.stat-label { display: block; font-size: 10px; color: var(--mt); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
.stat-value { display: block; font-family: 'Unbounded', sans-serif; font-size: 15px; font-weight: 700; color: var(--fg); }

.amenities-section h4 { font-family: 'Unbounded', sans-serif; font-size: 12px; font-weight: 700; color: var(--fg); margin: 0 0 10px; text-transform: uppercase; letter-spacing: .5px; }
.amenities-list { display: flex; flex-wrap: wrap; gap: 8px; }
.amenity-tag { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--bg2); border: 1px solid var(--bdr); border-radius: 20px; font-size: 12px; color: var(--fg2); font-weight: 600; }
.amenity-tag i { color: var(--ok, #B0D91E); font-size: 11px; }

@media (max-width: 640px) {
  .form-row { grid-template-columns: 1fr; }
  .detail-stats { grid-template-columns: 1fr; }
  .gallery-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>