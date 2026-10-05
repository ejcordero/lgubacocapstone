<script setup>
import { ref, computed, nextTick, onMounted } from 'vue';
import { API } from '@/api'

const getToken = () => localStorage.getItem('baco_owner_token');
const auth = (json = true) => {
  const h = { 'Authorization': `Bearer ${getToken()}` };
  if (json) h['Content-Type'] = 'application/json';
  return h;
};

const AMENITIES_LIST = ['WiFi', 'Pool', 'Hot tub', 'Gym', 'Breakfast', 'AC', 'Parking', 'Restaurant', 'Spa', 'Beach access', 'Mountain view', 'Ocean view', 'Fireplace', 'Kitchen', 'Laundry', 'Hot Shower', 'Fan Room', 'Kayak'];
const ROOM_TYPES = ['Standard', 'Deluxe', 'Suite', 'Villa', 'Chalet', 'Cottage'];
const PROPERTY_TYPES = ['Resort', 'Beach Resort', 'Hotel', 'Lodge', 'Inn', 'Hostel', 'Guest House', 'Homestay', 'Transient House', 'Farm Stay', 'Glamping Site', 'Eco Lodge'];

// ── Room Amenities (realistic, grouped by category) ──
// Guests use these to decide — only real, in-room features belong here.
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

// One-tap preset: the basics guests consider non-negotiable
const ESSENTIAL_ROOM_AMENITIES = ['Private Bathroom', 'Hot & Cold Shower', 'Free Toiletries', 'Fresh Towels', 'Free WiFi'];

// ── State ──
const hotel = ref(null);
const loading = ref(true);
const saving = ref(false);
const pageError = ref('');
const ownerMode = ref('dashboard');   // 'dashboard' | 'form'
const editing = ref(false);
const errors = ref({});
const toasts = ref([]);
const form = ref(null);
let original = null;                  // server snapshot for diffing

let keySeq = 0;
const newKey = () => `k${Date.now()}_${keySeq++}`;

// ── Toast ──
function toast(msg, type = 'success') {
  const id = Date.now() + Math.random();
  toasts.value.push({ id, msg, type });
  setTimeout(() => dismissToast(id), 3200);
}
function dismissToast(id) { toasts.value = toasts.value.filter(t => t.id !== id); }

// ── Computed helpers ──
const coverImage = computed(() => hotel.value ? (hotel.value.image || hotel.value.gallery?.[0] || '') : '');
const primaryFee = computed(() => hotel.value?.entranceFees?.[0] || null);
const rulesCount = computed(() => form.value ? form.value.rules.split('\n').filter(s => s.trim()).length : 0);

// ── Fetch ──
async function fetchHotel() {
  loading.value = true; pageError.value = '';
  try {
    const r = await fetch(`${API}/owner/hotel`, { headers: auth(false) });
    if (r.status === 401 || r.status === 403) { window.location.href = '/owner/login'; return; }
    const d = await r.json();
    hotel.value = d.hotel || null;
  } catch {
    pageError.value = 'Failed to load your listing. Check your connection.';
  } finally { loading.value = false; }
}
onMounted(fetchHotel);

// ── Draft building ──
function draftFromHotel(h) {
  return {
    title: h.name || '',
    description: h.description || '',
    location: h.location || '',
    type: h.type || 'Resort',
    contact: h.contact || '',
    email: h.email || '',
    entranceFee: h.entranceFees?.length ? String(h.entranceFees[0].price) : '',
    images: (h.gallery?.length) ? [...h.gallery] : (h.image ? [h.image] : []),
    amenities: [...(h.amenities || [])],
    rules: h.houseRules || '',
    rooms: (h.rooms || []).map(r => ({
      key: 'db' + r.id, id: r.id,
      name: r.name || '', type: r.type || 'Standard',
      price: String(r.price ?? ''), capacity: r.capacity || 2, units: r.totalCount || 1,
      status: r.status || 'active',
      amenities: Array.isArray(r.amenities) ? [...r.amenities] : [],
      images: (r.gallery?.length) ? [...r.gallery] : (r.image ? [r.image] : [])
    }))
  };
}

function startCreate() {
  form.value = { title: '', description: '', location: '', type: 'Resort', contact: '', email: '', entranceFee: '', images: [], amenities: [], rules: '', rooms: [] };
  original = null;
  editing.value = false;
  errors.value = {};
  ownerMode.value = 'form';
}

function startEdit() {
  if (!hotel.value) return;
  form.value = draftFromHotel(hotel.value);
  original = {
    entranceFeeId: hotel.value.entranceFees?.[0]?.id || null,
    rooms: (hotel.value.rooms || []).map(r => ({ id: r.id, name: r.name || 'Room' }))
  };
  editing.value = true;
  errors.value = {};
  ownerMode.value = 'form';
}

function backToDashboard() { ownerMode.value = 'dashboard'; errors.value = {}; }

// ── Validation (Stayly rules) ──
function validateForm() {
  const f = form.value;
  const e = {};
  if (!f.title || f.title.trim().length < 10) e.title = 'Title must be at least 10 characters';
  if (!f.description || f.description.trim().length < 50) e.description = 'Description must be at least 50 characters';
  if (!f.location || f.location.trim().length < 3) e.location = 'Location is required';
  if (!f.entranceFee || isNaN(f.entranceFee) || parseFloat(f.entranceFee) <= 0) e.entranceFee = 'Entrance fee must be greater than 0';
  if (f.images.length === 0) e.images = 'Add at least 1 image';
  if (f.rooms.length === 0) e.rooms = 'Add at least 1 room';
  f.rooms.forEach((r, i) => {
    if (!r.name || r.name.trim().length < 3) e[`room_${i}_name`] = 'Room name required (min 3 chars)';
    if (!r.price || isNaN(r.price) || parseFloat(r.price) <= 0) e[`room_${i}_price`] = 'Price must be > 0';
    if (!r.capacity || parseInt(r.capacity) <= 0) e[`room_${i}_capacity`] = 'Capacity must be > 0';
    if (!r.units || parseInt(r.units) <= 0) e[`room_${i}_units`] = 'Units must be > 0';
    if (r.images.length === 0) e[`room_${i}_images`] = 'Add at least 1 room image';
    if (!r.amenities || r.amenities.length === 0) e[`room_${i}_amenities`] = 'Select at least 1 amenity';
  });
  return e;
}

function clearError(key) { errors.value[key] = ''; }

// ── Room amenity selection ──
function toggleRoomAmenity(roomIdx, amenity) {
  const list = form.value.rooms[roomIdx].amenities;
  const i = list.indexOf(amenity);
  if (i >= 0) list.splice(i, 1);
  else list.push(amenity);
  clearError(`room_${roomIdx}_amenities`);
}
function selectRoomEssentials(roomIdx) {
  const list = form.value.rooms[roomIdx].amenities;
  ESSENTIAL_ROOM_AMENITIES.forEach(a => { if (!list.includes(a)) list.push(a); });
  clearError(`room_${roomIdx}_amenities`);
}
function clearRoomAmenities(roomIdx) {
  const list = form.value.rooms[roomIdx].amenities;
  list.splice(0, list.length);
}

// ── Save orchestration: hotel → entrance fee → rooms diff → refetch ──
async function saveListing() {
  errors.value = validateForm();
  if (Object.values(errors.value).some(v => v)) {
    toast('Please fix validation errors', 'error');
    await nextTick();
    document.querySelector('.stl .error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  saving.value = true;
  const f = form.value;
  const problems = [];
  
  if (!confirm(editing.value
    ? `Are you sure you want to save the changes to "${f.title.trim()}"?`
    : `Submit this listing for LGU verification?`)) return;

  try {
    // 1. Hotel record (basePrice auto-derived from cheapest room)
    const basePrice = f.rooms.length ? Math.min(...f.rooms.map(r => parseFloat(r.price) || 0)) : 0;
    const payload = {
      name: f.title.trim(), description: f.description.trim(), location: f.location.trim(),
      type: f.type, contact: f.contact.trim(), email: f.email.trim(),
      basePrice, amenities: [...f.amenities],
      mainImage: f.images[0] || '',
      galleryImages: [...f.images],
      houseRules: f.rules
    };
    const hotelRes = await fetch(`${API}/owner/hotel`, { method: hotel.value ? 'PUT' : 'POST', headers: auth(), body: JSON.stringify(payload) });
    if (!hotelRes.ok) {
      const d = await hotelRes.json().catch(() => ({}));
      throw new Error(d.message || 'Failed to save listing.');
    }

    // 2. Entrance fee (primary fee)
    try {
      if (original?.entranceFeeId) {
        await fetch(`${API}/owner/hotel/fees/${original.entranceFeeId}`, { method: 'PUT', headers: auth(), body: JSON.stringify({ price: parseFloat(f.entranceFee) }) });
      } else {
        await fetch(`${API}/owner/hotel/fees`, { method: 'POST', headers: auth(), body: JSON.stringify({ name: 'Entrance Fee', price: parseFloat(f.entranceFee) }) });
      }
    } catch { problems.push('Entrance fee could not be saved.'); }

    // 3. Rooms diff — delete removed, update existing, create new
    const draftIds = f.rooms.filter(r => r.id).map(r => r.id);
    for (const orig of (original?.rooms || [])) {
      if (!draftIds.includes(orig.id)) {
        try {
          const r = await fetch(`${API}/owner/hotel/rooms/${orig.id}`, { method: 'DELETE', headers: auth(false) });
          if (!r.ok) { const d = await r.json().catch(() => ({})); problems.push(`"${orig.name}" kept: ${d.message || 'delete failed'}`); }
        } catch { problems.push(`"${orig.name}" could not be deleted.`); }
      }
    }
    for (const r of f.rooms) {
      const body = {
        roomName: r.name.trim(), roomType: r.type,
        capacity: parseInt(r.capacity) || 2,
        pricePerNight: parseFloat(r.price),
        totalCount: parseInt(r.units) || 1,
        amenities: [...r.amenities],
        image: r.images[0] || '',
        galleryImages: [...r.images],
        status: r.status || 'active'
      };
      try {
        const res = await fetch(r.id ? `${API}/owner/hotel/rooms/${r.id}` : `${API}/owner/hotel/rooms`, { method: r.id ? 'PUT' : 'POST', headers: auth(), body: JSON.stringify(body) });
        if (!res.ok) { const d = await res.json().catch(() => ({})); problems.push(`Room "${r.name}": ${d.message || 'save failed'}`); }
      } catch { problems.push(`Room "${r.name}" could not be saved.`); }
    }

    // 4. Refetch canonical state from server, then back to dashboard
    await fetchHotel();
    ownerMode.value = 'dashboard';
    if (problems.length) toast(problems[0] + (problems.length > 1 ? ` (+${problems.length - 1} more)` : ''), 'error');
    else toast(editing.value ? 'Listing updated successfully' : 'Listing submitted! Pending LGU verification.');
  } catch (err) {
    toast(err.message || 'Failed to save listing.', 'error');
  } finally { saving.value = false; }
}

// ── Delete listing ──
async function deleteListing() {
  if (!confirm('Delete this listing? This cannot be undone.')) return;
  saving.value = true;
  try {
    const r = await fetch(`${API}/owner/hotel`, { method: 'DELETE', headers: auth(false) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(d.message || 'Failed to delete listing.', 'error'); return; }
    hotel.value = null;
    toast('Listing deleted');
  } catch { toast('Network error.', 'error'); }
  finally { saving.value = false; }
}

// ── Images ──
function handleImageUpload(ev, roomIdx = null) {
  const file = ev.target.files?.[0];
  ev.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Please choose an image file.', 'error'); return; }
  if (file.size > 2 * 1024 * 1024) { toast('Image must be under 2MB.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    if (roomIdx !== null) { form.value.rooms[roomIdx].images.push(e.target.result); clearError(`room_${roomIdx}_images`); }
    else { form.value.images.push(e.target.result); clearError('images'); }
  };
  reader.readAsDataURL(file);
}
function removeImage(imgIdx, roomIdx = null) {
  if (roomIdx !== null) form.value.rooms[roomIdx].images.splice(imgIdx, 1);
  else form.value.images.splice(imgIdx, 1);
}

// ── Rooms / amenities ──
function addRoom() {
  errors.value = {};
  form.value.rooms.push({ key: newKey(), id: null, name: '', type: 'Standard', price: '', capacity: 2, units: 1, status: 'active', amenities: [], images: [] });
}
function removeRoom(idx) {
  if (!confirm('Remove this room?')) return;
  errors.value = {};
  form.value.rooms.splice(idx, 1);
}
function toggleAmenity(a) {
  const i = form.value.amenities.indexOf(a);
  if (i >= 0) form.value.amenities.splice(i, 1);
  else form.value.amenities.push(a);
}
</script>

<template>
  <div class="dashboard stl">
    <!-- Toasts -->
    <div class="toast-wrap">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type" @click="dismissToast(t.id)">{{ t.msg }}</div>
    </div>

    <!-- ═══ DASHBOARD ═══ -->
    <div v-if="ownerMode === 'dashboard'" class="fade-in">
      <!-- The section scaffolding, the view-all pill and the listing card are
           all the shared vocabulary, so this page is built from the same parts
           as the dashboards. Every field, action and state below is unchanged. -->
      <section class="section-block">
        <div class="section-header">
          <div>
            <h1 class="section-title">Your <span>Listing</span></h1>
            <p class="section-sub" v-if="hotel">{{ hotel.published ? 'Live and visible to tourists' : 'Pending LGU Tourism Office verification' }}</p>
            <p class="section-sub" v-else>Register your one accommodation to start accepting bookings</p>
          </div>
          <button v-if="!hotel && !loading" class="view-all-btn" @click="startCreate">
            <i class="fas fa-plus"></i> New Listing
          </button>
        </div>

        <div v-if="loading" class="state-box"><div class="spinner"></div><p>Loading your listing...</p></div>
        <div v-else-if="pageError" class="err-banner">{{ pageError }}</div>

        <div v-else-if="!hotel" class="state-box">
          <i class="fas fa-hotel"></i>
          <h3>No listing yet</h3>
          <p>Each owner can register <strong>one accommodation</strong>. Create your listing &mdash; it will be reviewed by the LGU Tourism Office before going live.</p>
          <button class="view-all-btn" @click="startCreate">Create listing</button>
        </div>

        <!-- The owner's own listing, in the exact card a traveller sees while
             browsing. The image, the badges, the name, the location, the room
             and amenity counts and the price row are the shared card's. -->
        <div v-else class="hotel-grid">
          <div class="hotel-card">
            <div class="hc-image">
              <img v-if="coverImage" :src="coverImage" :alt="hotel.name" />
              <div v-else class="hc-fallback"><i class="fas fa-image"></i></div>
              <div class="hc-badges">
                <span class="hc-badge stay" :class="hotel.published ? 'stay' : 'tour'">
                  {{ hotel.published ? 'Live' : 'Pending verification' }}
                </span>
                <span v-if="(hotel.rooms || []).length" class="hc-badge tour">Overnight</span>
              </div>
            </div>
            <div class="hc-body">
              <h3 class="hc-name">{{ hotel.name }}</h3>
              <p class="hc-location"><i class="fas fa-map-marker-alt"></i> {{ hotel.location || 'Baco, Oriental Mindoro' }}</p>
              <div class="hc-meta">
                <span v-if="(hotel.rooms || []).length"><i class="fas fa-door-open"></i> {{ (hotel.rooms || []).length }} room{{ (hotel.rooms || []).length !== 1 ? 's' : '' }}</span>
                <span v-if="(hotel.amenities || []).length"><i class="fas fa-star"></i> {{ (hotel.amenities || []).length }} amenities</span>
              </div>
              <div class="hc-footer">
                <div class="hc-price">
                  <span class="price-val" v-if="primaryFee">&#8369;{{ primaryFee.price }}</span>
                  <span class="price-label">{{ primaryFee ? 'per person' : 'No fee set' }}</span>
                </div>
                <div class="lcard-actions">
                  <button class="btn-secondary" @click="startEdit"><i class="fas fa-pen"></i> Edit</button>
                  <button class="btn-danger" @click="deleteListing"><i class="fas fa-trash"></i></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- ═══ CREATE / EDIT FORM ═══ -->
    <div v-else-if="form" class="fade-in">
      <div class="row-between mb-6">
        <div>
          <button class="linklike" @click="backToDashboard">← Back to dashboard</button>
          <h1 class="section-title">{{ editing ? 'Edit' : 'Create New' }} <span>Listing</span></h1>
          <p class="section-sub">Fill in all required information</p>
        </div>
      </div>

      <div class="form-grid">
        <div class="col-main">
          <!-- 1. BASIC INFO -->
          <section class="card mb-6">
            <h2 class="sec-title"><span class="num">1</span> Basic Information</h2>
            <div class="field">
              <label>Title <span class="req">*</span></label>
              <input v-model="form.title" :class="{ error: errors.title }" @input="clearError('title')" placeholder="e.g., Sunset Bay Resort" />
              <div class="error-msg" v-if="errors.title">{{ errors.title }}</div>
            </div>
            <div class="field">
              <label>Description <span class="req">*</span></label>
              <textarea v-model="form.description" rows="4" :class="{ error: errors.description }" @input="clearError('description')" placeholder="Describe your property (min 50 characters)"></textarea>
              <div class="row-between"><div class="error-msg" v-if="errors.description">{{ errors.description }}</div><div class="hint">{{ (form.description || '').length }}/50 min</div></div>
            </div>
            <div class="grid-2">
              <div class="field">
                <label>Location <span class="req">*</span></label>
                <input v-model="form.location" :class="{ error: errors.location }" @input="clearError('location')" placeholder="Barangay, Baco, Oriental Mindoro" />
                <div class="error-msg" v-if="errors.location">{{ errors.location }}</div>
              </div>
              <div class="field">
                <label>Property Type</label>
                <select v-model="form.type"><option v-for="t in PROPERTY_TYPES" :key="t">{{ t }}</option></select>
              </div>
            </div>
            <div class="grid-2">
              <div class="field"><label>Contact Number</label><input v-model="form.contact" placeholder="09XXXXXXXXX" /></div>
              <div class="field"><label>Email</label><input v-model="form.email" type="email" placeholder="Optional" /></div>
            </div>
            <div class="field">
              <label>Entrance Fee per Person (₱) <span class="req">*</span></label>
              <input v-model="form.entranceFee" type="number" min="0" step="0.01" :class="{ error: errors.entranceFee }" @input="clearError('entranceFee')" placeholder="100.00" />
              <div class="error-msg" v-if="errors.entranceFee">{{ errors.entranceFee }}</div>
              <div class="hint" v-if="editing && (hotel?.entranceFees?.length || 0) > 1">You have multiple fee tiers — this edits your primary fee. Manage the rest under Entrance Fees.</div>
            </div>
          </section>

          <!-- 2. IMAGES -->
          <section class="card mb-6">
            <h2 class="sec-title"><span class="num">2</span> Listing Images <span class="req">*</span></h2>
            <div class="error-msg mb-2" v-if="errors.images">{{ errors.images }}</div>
            <div class="img-grid">
              <div v-for="(img, i) in form.images" :key="i" class="img-preview">
                <img :src="img" />
                <button class="remove-btn" @click="removeImage(i)">×</button>
              </div>
              <label class="upload-zone square">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                <span class="hint">Add image</span>
                <input type="file" accept="image/*" class="hidden" @change="handleImageUpload($event)" />
              </label>
            </div>
            <p class="hint">PNG, JPG up to 2MB. Add at least 1 image. The first image is your cover photo.</p>
          </section>

          <!-- 3. ROOMS -->
          <section class="card mb-6">
            <div class="row-between mb-2">
              <h2 class="sec-title"><span class="num">3</span> Rooms <span class="req">*</span></h2>
              <button class="linklike rose" @click="addRoom">+ Add room</button>
            </div>
            <div class="error-msg mb-2" v-if="errors.rooms">{{ errors.rooms }}</div>

            <div v-if="form.rooms.length === 0" class="empty-inline">No rooms added yet. Click "Add room" to get started.</div>

            <div v-for="(r, i) in form.rooms" :key="r.key" class="room-box">
              <div class="row-between mb-3">
                <h3 class="room-title">Room {{ i + 1 }}</h3>
                <button class="linklike danger" @click="removeRoom(i)">Remove</button>
              </div>
              <div class="grid-2 mb-3">
                <div class="field">
                  <label>Room Name <span class="req">*</span></label>
                  <input v-model="r.name" :class="{ error: errors[`room_${i}_name`] }" @input="clearError(`room_${i}_name`)" placeholder="Ocean View Suite" />
                  <div class="error-msg" v-if="errors[`room_${i}_name`]">{{ errors[`room_${i}_name`] }}</div>
                </div>
                <div class="field">
                  <label>Room Type</label>
                  <select v-model="r.type"><option v-for="t in ROOM_TYPES" :key="t">{{ t }}</option></select>
                </div>
              </div>
              <div class="grid-3f mb-3">
                <div class="field">
                  <label>Price per Night (₱) <span class="req">*</span></label>
                  <input v-model="r.price" type="number" min="0" :class="{ error: errors[`room_${i}_price`] }" @input="clearError(`room_${i}_price`)" placeholder="1200" />
                  <div class="error-msg" v-if="errors[`room_${i}_price`]">{{ errors[`room_${i}_price`] }}</div>
                </div>
                <div class="field">
                  <label>Max Capacity <span class="req">*</span></label>
                  <input v-model="r.capacity" type="number" min="1" :class="{ error: errors[`room_${i}_capacity`] }" @input="clearError(`room_${i}_capacity`)" placeholder="2" />
                  <div class="error-msg" v-if="errors[`room_${i}_capacity`]">{{ errors[`room_${i}_capacity`] }}</div>
                </div>
                <div class="field">
                  <label>Total Units</label>
                  <input v-model="r.units" type="number" min="1" :class="{ error: errors[`room_${i}_units`] }" @input="clearError(`room_${i}_units`)" placeholder="1" />
                  <div class="error-msg" v-if="errors[`room_${i}_units`]">{{ errors[`room_${i}_units`] }}</div>
                </div>
              </div>

              <!-- ROOM AMENITIES (grouped chips) -->
              <div class="field mb-3">
                <label>Room Amenities <span class="req">*</span></label>
                <div class="am-quick">
                  <button type="button" class="am-quick-btn" @click="selectRoomEssentials(i)">⚡ Select essentials</button>
                  <button type="button" class="am-quick-btn clear" @click="clearRoomAmenities(i)">Clear all</button>
                  <span class="am-count">{{ r.amenities.length }} selected</span>
                </div>
                <div class="room-amenities">
                  <div v-for="grp in ROOM_AMENITY_GROUPS" :key="grp.category">
                    <div class="am-cat">{{ grp.category }}</div>
                    <div class="chips small">
                      <button v-for="a in grp.items" :key="a" type="button" class="chip mini" :class="{ active: r.amenities.includes(a) }" @click="toggleRoomAmenity(i, a)">{{ a }}</button>
                    </div>
                  </div>
                </div>
                <div class="error-msg" v-if="errors[`room_${i}_amenities`]">{{ errors[`room_${i}_amenities`] }}</div>
                <p class="hint" v-else>Only tick what this room genuinely offers — guests rely on these when booking.</p>
              </div>

              <div class="field">
                <label>Room Images <span class="req">*</span></label>
                <div class="img-grid small">
                  <div v-for="(img, j) in r.images" :key="j" class="img-preview">
                    <img :src="img" />
                    <button class="remove-btn" @click="removeImage(j, i)">×</button>
                  </div>
                  <label class="upload-zone square">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                    <span class="hint">Add</span>
                    <input type="file" accept="image/*" class="hidden" @change="handleImageUpload($event, i)" />
                  </label>
                </div>
                <div class="error-msg" v-if="errors[`room_${i}_images`]">{{ errors[`room_${i}_images`] }}</div>
              </div>
            </div>
          </section>

          <!-- 4. AMENITIES -->
          <section class="card mb-6">
            <h2 class="sec-title"><span class="num">4</span> Amenities</h2>
            <div class="chips">
              <button v-for="a in AMENITIES_LIST" :key="a" type="button" class="chip" :class="{ active: form.amenities.includes(a) }" @click="toggleAmenity(a)">{{ a }}</button>
            </div>
            <p class="hint">Selected: {{ form.amenities.length || 'none' }}</p>
          </section>

          <!-- 5. HOUSE RULES -->
          <section class="card mb-6">
            <h2 class="sec-title"><span class="num">5</span> House Rules</h2>
            <textarea v-model="form.rules" rows="5" placeholder="One rule per line, e.g.&#10;No smoking indoors&#10;Check-in after 2 PM&#10;Quiet hours 10 PM - 7 AM"></textarea>
            <p class="hint">Enter one rule per line</p>
          </section>
        </div>

        <!-- LIVE PREVIEW SIDEBAR -->
        <div class="col-side">
          <div class="card preview">
            <h3 class="preview-title">Live Preview</h3>
            <img v-if="form.images[0]" :src="form.images[0]" class="preview-img" />
            <div v-else class="preview-img placeholder">No image</div>
            <h4 class="preview-name">{{ form.title || 'Untitled' }}</h4>
            <p class="preview-loc">📍 {{ form.location || 'Location' }}</p>
            <div class="preview-rows">
              <div><span>Entrance fee</span><strong>₱{{ form.entranceFee || 0 }}/person</strong></div>
              <div><span>Rooms</span><strong>{{ form.rooms.length }}</strong></div>
              <div><span>Amenities</span><strong>{{ form.amenities.length }}</strong></div>
              <div><span>Rules</span><strong>{{ rulesCount }}</strong></div>
            </div>
            <button class="view-all-btn w-full mt-4" :disabled="saving" @click="saveListing">
              <span v-if="saving">Saving…</span>
              <span v-else>{{ editing ? 'Save Changes' : 'Submit Listing' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stl { --rose: var(--rose, #F20707); --rose-dark: #F20707; background: transparent; border-radius: 18px; padding: 22px 24px 44px; color: var(--fg); font-family: var(--font-body), 'Inter', system-ui, sans-serif; }

/* ── Page title (exact design from EntranceFeeManager) ── */
.section-title { font-family: 'Unbounded', sans-serif; font-size: clamp(26px, 4vw, 40px); font-weight: 800; color: var(--fg); letter-spacing: -0.04em; margin: 0; line-height: 1.15; }
.section-title span { background: linear-gradient(135deg, var(--ac, #F20707), var(--wn, #1F9D55)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }

.fade-in { animation: fadeIn .35s ease both; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

.row-between { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }


.mb-6 { margin-bottom: 22px; } .mb-3 { margin-bottom: 12px; } .mb-2 { margin-bottom: 8px; }
.mt-4 { margin-top: 16px; } .w-full { width: 100%; } .flex-1 { flex: 1; }
.hidden { display: none; }

.linklike { background: none; border: none; color: var(--fg2); font-size: .85rem; font-weight: 600; cursor: pointer; padding: 0; margin-bottom: 6px; }
.linklike:hover { text-decoration: underline; }
.linklike.rose { color: var(--rose); margin-bottom: 0; }
.linklike.danger { color: var(--dg); margin-bottom: 0; }
.req { color: var(--dg); }

.btn-rose {  }
.btn-rose:hover { background: var(--rose-dark); }
.btn-rose:active { transform: scale(.98); }
.btn-rose:disabled { opacity: .5; cursor: not-allowed; transform: none; }
.btn-ghost { border: 1px solid var(--bdr); background: var(--card); border-radius: 10px; padding: 9px 14px; font-size: .85rem; font-weight: 600; cursor: pointer; font-family: inherit; color: var(--fg); transition: all .15s; }
.btn-ghost:hover { background: var(--card2); }
.btn-danger { border: 1px solid var(--dgg); background: var(--card); color: var(--dg); border-radius: 10px; padding: 9px 14px; font-size: .85rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: all .15s; }
.btn-danger:hover { background: var(--dgg); }

.state-box { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 70px 20px; color: var(--mt); }
.spinner { width: 34px; height: 34px; border: 3px solid var(--bdr); border-top-color: var(--rose); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.err-banner { padding: 12px 16px; background: var(--dgg); border: 1px solid var(--dgg); border-radius: 12px; color: var(--dg); font-size: .85rem; font-weight: 600; }

.empty { text-align: center; background: var(--card); border: 2px dashed var(--bdr2); border-radius: 18px; padding: 60px 26px; }
.empty-emoji { font-size: 3.4rem; margin-bottom: 12px; }
.empty h3 { font-family: 'Unbounded', sans-serif; font-size: 1.2rem; font-weight: 700; margin: 0 0 8px; color: var(--fg); }
.empty p { color: var(--mt); font-size: .9rem; max-width: 460px; margin: 0 auto 20px; line-height: 1.6; }

.grid-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.card-hover { transition: transform .25s ease, box-shadow .25s ease; }
.card-hover:hover { transform: translateY(-3px); box-shadow: 0 15px 35px -10px rgba(0,0,0,.15); }
.lcard { background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; overflow: hidden; }
.lcard-img { position: relative; aspect-ratio: 16/10; background: var(--card2); }
.lcard-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.img-fallback { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--mt); }
.status-pill { position: absolute; top: 10px; left: 10px; padding: 4px 10px; border-radius: 999px; font-size: .68rem; font-weight: 700; }
.status-pill.live { background: var(--okg); color: var(--ok); }
.status-pill.pending { background: var(--wng); color: var(--wn); }
.lcard-body { padding: 16px; }
.lcard-title { font-family: 'Unbounded', sans-serif; font-size: 1.02rem; font-weight: 700; margin: 0; color: var(--fg); }
.fee-badge { background: rgba(255,56,92,.12); color: var(--rose-dark); font-size: .7rem; font-weight: 700; padding: 4px 10px; border-radius: 999px; white-space: nowrap; }
.lcard-loc { color: var(--mt); font-size: .82rem; margin: 4px 0 10px; }
.lcard-meta { display: flex; gap: 14px; font-size: .74rem; color: var(--gr-600); margin-bottom: 14px; }
.lcard-actions { display: flex; gap: 8px; }

.form-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; align-items: start; }
.card { background: var(--bb-surface); border: 1px solid var(--bb-border); border-radius: var(--bb-radius-lg); padding: 1.25rem; }
.sec-title { display: flex; align-items: center; gap: 10px; font-size: 1.02rem; font-weight: 700; margin: 0 0 16px; color: var(--fg); }
.num { width: 26px; height: 26px; border-radius: 50%; background: rgba(255,56,92,.12); color: var(--rose-dark); display: inline-flex; align-items: center; justify-content: center; font-size: .78rem; font-weight: 700; flex-shrink: 0; }

.field { margin-bottom: 14px; }
.field label { display: block; font-size: .8rem; font-weight: 600; color: var(--fg2); margin-bottom: 6px; }
.field input, .field select, .field textarea, .stl > .fade-in textarea { width: 100%; border: 1px solid var(--bdr2); border-radius: 10px; padding: 10px 14px; font-size: .9rem; font-family: inherit; color: var(--fg); background: var(--card2); transition: border-color .2s; box-sizing: border-box; }
.field input:focus, .field select:focus, .field textarea:focus { border-color: var(--ac); outline: none; }
.field input.error, .field textarea.error { border-color: var(--dg); }
.error-msg { color: var(--dg); font-size: 12px; margin-top: 4px; }
.hint { color: var(--mt); font-size: 11.5px; }

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.grid-3f { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 14px; }

.img-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 8px; }
.img-preview { position: relative; aspect-ratio: 1/1; border-radius: 10px; overflow: hidden; border: 1px solid var(--bdr); }
.img-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
.remove-btn { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,.7); color: #fff; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px; border: none; line-height: 1; }
.upload-zone { border: 2px dashed var(--bdr2); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer; color: var(--mt); transition: all .2s; aspect-ratio: 1/1; background: var(--card2); }
.upload-zone:hover { border-color: var(--rose); background: rgba(255,56,92,.08); color: var(--rose); }

.room-box { border: 1px solid var(--bdr); border-radius: 12px; padding: 16px; margin-bottom: 12px; background: var(--card2); }
.room-title { font-family: 'Unbounded', sans-serif; font-weight: 700; font-size: .95rem; margin: 0; color: var(--fg); }
.empty-inline { border: 2px dashed var(--bdr2); border-radius: 12px; padding: 30px; text-align: center; color: var(--mt); font-size: .85rem; }

/* ── Room amenity selector ── */
.room-amenities { display: flex; flex-direction: column; gap: 14px; border: 1px solid var(--bdr); border-radius: 12px; padding: 14px; background: var(--card2); max-height: 300px; overflow-y: auto; }
.am-cat { font-size: .68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--mt); margin-bottom: 6px; }
.am-quick { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.am-quick-btn { padding: 5px 12px; border-radius: 8px; border: 1px solid var(--bdr); background: var(--card); color: var(--fg2); font-size: .72rem; font-weight: 700; cursor: pointer; transition: all .15s; font-family: inherit; }
.am-quick-btn:hover { border-color: var(--rose); color: var(--rose); }
.am-quick-btn.clear:hover { border-color: var(--dg); color: var(--dg); }
.am-count { font-size: .72rem; color: var(--mt); font-weight: 600; margin-left: auto; }

.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.chips.small { gap: 6px; }
.chip { padding: 8px 16px; border-radius: 999px; border: 1px solid var(--bdr); background: var(--card); font-size: .82rem; font-weight: 500; cursor: pointer; transition: all .2s; font-family: inherit; color: var(--fg2); }
.chip:hover { background: var(--card2); }
.chip.active { background: var(--ac); color: #fff; border-color: var(--ac); }
.chip.mini { padding: 5px 11px; font-size: .73rem; }

.preview { position: sticky; top: 16px; }
.preview-title { font-family: 'Unbounded', sans-serif; font-weight: 700; margin: 0 0 12px; color: var(--fg); }
.preview-img { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 10px; margin-bottom: 12px; display: block; }
.preview-img.placeholder { background: var(--card2); display: flex; align-items: center; justify-content: center; color: var(--mt); font-size: .8rem; }
.preview-name { font-family: 'Unbounded', sans-serif; font-weight: 700; margin: 0 0 2px; color: var(--fg); }
.preview-loc { color: var(--mt); font-size: .82rem; margin: 0 0 12px; }
.preview-rows { border-top: 1px solid var(--bdr); padding-top: 12px; display: flex; flex-direction: column; gap: 8px; font-size: .85rem; color: var(--fg2); }
.preview-rows > div { display: flex; justify-content: space-between; }
.preview-rows span { color: var(--mt); }
.preview-rows strong { color: var(--fg); }

.toast-wrap { position: fixed; top: 80px; right: 22px; z-index: 999; display: flex; flex-direction: column; gap: 8px; }
.toast { padding: 12px 18px; border-radius: 12px; box-shadow: 0 10px 28px rgba(0,0,0,.18); font-size: .84rem; font-weight: 600; cursor: pointer; animation: slideIn .3s ease both; max-width: 340px; color: #fff; }
@keyframes slideIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
.toast.success { background: var(--ok); color: #fff; }
.toast.error { background: var(--dg); color: #fff; }

@media (max-width: 1024px) {
  .form-grid { grid-template-columns: 1fr; }
  .grid-cards { grid-template-columns: 1fr; }
  .preview { position: static; }
}
@media (max-width: 640px) {
  .grid-2, .grid-3f { grid-template-columns: 1fr; }
  .img-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>