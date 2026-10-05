<script setup>
import { ref, computed, onMounted } from 'vue'
import { API as API_BASE } from '@/api'

const API = `${API_BASE}/hotels`

const getAdminToken = () => localStorage.getItem('baco_admin_token')
const authHeaders = (json = true) => {
  const h = { 'Authorization': `Bearer ${getAdminToken()}` }
  if (json) h['Content-Type'] = 'application/json'
  return h
}

const activeTab = ref('hotels')
const searchQuery = ref('')
const filterStatus = ref('all')
const bookingFilter = ref('all')
const loading = ref(false)
const notif = ref(null)
const hotels = ref([])

const showHotelModal = ref(false)
const editingHotel = ref(null)
const hotelForm = ref({ name: '', location: '', type: '', contact: '', email: '', basePrice: '', description: '', amenities: [], mainImage: '', galleryImages: [], available: true })
const hotelErrors = ref({})

const showRoomModal = ref(false)
const roomTargetHotel = ref(null)
const roomList = ref([])
const showRoomForm = ref(false)
const editingRoom = ref(null)
const roomForm = ref({ roomType: '', capacity: 2, pricePerNight: '', totalCount: 1, image: '', description: '', amenities: [], status: 'active' })
const roomErrors = ref({})

const showDeleteModal = ref(false)
const deleteTarget = ref(null)
const deleteType = ref('')
const isSubmitting = ref(false)
const bookings = ref([])

const amenityOptions = ['Pool', 'Restaurant', 'WiFi', 'Parking', 'Breakfast', 'Garden', 'Kayak', 'AC', 'Fan Room', 'Bar', 'Spa', 'Hot Shower']
const roomAmenityOptions = ['WiFi', 'AC', 'Hot Shower', 'TV', 'Mini Bar', 'Balcony', 'King Bed', 'Twin Bed', 'Bathtub', 'City View']
const hotelTypes = ['Beach Resort', 'Inn', 'Pension House', 'Eco Lodge', 'Hotel', 'Hostel', 'Glamping Site', 'Farm Stay', 'Resort']
const barangays = [
  'Brgy. Baco', 'Brgy. Bangkatan', 'Brgy. Bayanan I', 'Brgy. Bayanan II',
  'Brgy. Dulangan I', 'Brgy. Dulangan II', 'Brgy. Mangangan I', 'Brgy. Mangangan II',
  'Brgy. Maribudjoc', 'Brgy. Pambisan Malaki', 'Brgy. Pambisan Munti',
  'Brgy. Parang', 'Brgy. Poblacion I', 'Brgy. Poblacion II', 'Brgy. Poblacion III',
  'Brgy. San Andres', 'Brgy. San Ignacio', 'Brgy. Santa Cruz', 'Brgy. Tabon-Tabon',
  'Brgy. Tagumpay', 'Brgy. Water'
]

const filteredHotels = computed(() => {
  return hotels.value.filter(h => {
    const q = searchQuery.value.toLowerCase()
    const match = h.name.toLowerCase().includes(q) || h.location.toLowerCase().includes(q) || (h.type || '').toLowerCase().includes(q)
    const statusMatch = filterStatus.value === 'all' || (filterStatus.value === 'active' ? h.available : !h.available)
    return match && statusMatch
  })
})
const filteredBookings = computed(() => {
  if (bookingFilter.value === 'all') return bookings.value
  return bookings.value.filter(b => b.status === bookingFilter.value)
})
const stats = computed(() => {
  const totalRoomUnits = hotels.value.reduce((s, h) => s + (h.rooms?.reduce((rs, r) => rs + (r.totalCount || 0), 0) || 0), 0)
  return {
    total: hotels.value.length,
    active: hotels.value.filter(h => h.available).length,
    inactive: hotels.value.filter(h => !h.available).length,
    roomUnits: totalRoomUnits,
    bookings: bookings.value.length,
    activeBookings: bookings.value.filter(b => b.status === 'confirmed').length,
    revenue: bookings.value.filter(b => b.status === 'confirmed').reduce((s, b) => s + (b.total_amount || 0), 0)
  }
})

async function fetchHotels() {
  loading.value = true
  try {
    const res = await fetch(`${API}/admin`, { headers: authHeaders(false) })
    if (!res.ok) { showNotif(`Failed to load hotels (HTTP ${res.status}).`, 'warning'); hotels.value = []; return }
    const data = await res.json()
    hotels.value = Array.isArray(data) ? data : []
  } catch (e) { showNotif('Failed to load hotels.', 'warning'); hotels.value = [] }
  loading.value = false
}
async function fetchBookings() {
  try {
    const res = await fetch(`${API}/admin/bookings`, { headers: authHeaders(false) })
    if (!res.ok) { showNotif(`Failed to load bookings (HTTP ${res.status}).`, 'warning'); bookings.value = []; return }
    const data = await res.json()
    bookings.value = Array.isArray(data) ? data : []
  } catch (e) { showNotif('Failed to load bookings.', 'warning'); bookings.value = [] }
}
async function fetchRooms(hotelId) {
  try {
    const res = await fetch(`${API}/admin/${hotelId}`, { headers: authHeaders(false) })
    if (!res.ok) { showNotif('Failed to load rooms.', 'warning'); roomList.value = []; return }
    const data = await res.json()
    roomList.value = Array.isArray(data.rooms) ? data.rooms : []
  } catch (e) { showNotif('Failed to load rooms.', 'warning'); roomList.value = [] }
}

function openAddHotel() {
  editingHotel.value = null
  hotelForm.value = { name: '', location: '', type: '', contact: '', email: '', basePrice: '', description: '', amenities: [], mainImage: '', galleryImages: [], available: true }
  hotelErrors.value = {}
  showHotelModal.value = true
}
function openEditHotel(hotel) {
  editingHotel.value = hotel
  hotelForm.value = {
    name: hotel.name, location: hotel.location, type: hotel.type || '', contact: hotel.contact || '',
    email: hotel.email || '', basePrice: hotel.basePrice, description: hotel.description || '',
    amenities: [...(hotel.amenities || [])], mainImage: hotel.image || '', galleryImages: [...(hotel.gallery || [])],
    available: hotel.available
  }
  hotelErrors.value = {}
  showHotelModal.value = true
}
function closeHotelModal() { showHotelModal.value = false }
function validateHotel() {
  hotelErrors.value = {}
  const f = hotelForm.value
  if (!f.name.trim()) hotelErrors.value.name = 'Required'
  if (!f.location) hotelErrors.value.location = 'Required'
  if (!f.type) hotelErrors.value.type = 'Required'
  if (!f.contact.trim()) hotelErrors.value.contact = 'Required'
  if (!f.basePrice || +f.basePrice < 1) hotelErrors.value.basePrice = 'Enter a valid price'
  return Object.keys(hotelErrors.value).length === 0
}
function handleMainImage(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => { hotelForm.value.mainImage = ev.target.result }
  reader.readAsDataURL(file)
}
function handleGalleryImages(e) {
  Array.from(e.target.files).forEach(file => {
    const reader = new FileReader()
    reader.onload = (ev) => { hotelForm.value.galleryImages.push(ev.target.result) }
    reader.readAsDataURL(file)
  })
}
function removeGalleryImage(idx) { hotelForm.value.galleryImages.splice(idx, 1) }
async function submitHotel() {
  if (!validateHotel()) return
  isSubmitting.value = true
  try {
    const body = {
      name: hotelForm.value.name.trim(), location: hotelForm.value.location, type: hotelForm.value.type,
      contact: hotelForm.value.contact.trim(), email: hotelForm.value.email.trim(),
      basePrice: +hotelForm.value.basePrice, description: hotelForm.value.description,
      amenities: hotelForm.value.amenities, mainImage: hotelForm.value.mainImage,
      galleryImages: hotelForm.value.galleryImages, available: hotelForm.value.available
    }
    if (editingHotel.value) {
      const res = await fetch(`${API}/admin/${editingHotel.value.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) })
      if (!res.ok) throw new Error('Update failed')
      showNotif('Hotel updated.', 'success')
    } else {
      const res = await fetch(`${API}/admin`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) })
      if (!res.ok) throw new Error('Create failed')
      showNotif('Hotel added.', 'success')
    }
    closeHotelModal()
    await fetchHotels()
  } catch (e) { showNotif('Failed to save hotel.', 'warning') }
  isSubmitting.value = false
}

function openRoomManager(hotel) {
  roomTargetHotel.value = hotel
  showRoomForm.value = false
  editingRoom.value = null
  showRoomModal.value = true
  fetchRooms(hotel.id)
}
function closeRoomModal() { showRoomModal.value = false }
function openAddRoom() {
  editingRoom.value = null
  roomForm.value = { roomType: '', capacity: 2, pricePerNight: '', totalCount: 1, image: '', description: '', amenities: [], status: 'active' }
  roomErrors.value = {}
  showRoomForm.value = true
}
function openEditRoom(room) {
  editingRoom.value = room
  roomForm.value = { roomType: room.name, capacity: room.capacity, pricePerNight: room.price, totalCount: room.totalCount, image: room.image || '', description: room.description || '', amenities: [...(room.amenities || [])], status: room.status }
  roomErrors.value = {}
  showRoomForm.value = true
}
function cancelRoomForm() { showRoomForm.value = false }
function handleRoomImage(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => { roomForm.value.image = ev.target.result }
  reader.readAsDataURL(file)
}
function validateRoom() {
  roomErrors.value = {}
  const f = roomForm.value
  if (!f.roomType.trim()) roomErrors.value.roomType = 'Required'
  if (!f.capacity || f.capacity < 1) roomErrors.value.capacity = 'Min 1'
  if (!f.pricePerNight || +f.pricePerNight < 1) roomErrors.value.pricePerNight = 'Enter a valid price'
  if (!f.totalCount || f.totalCount < 1) roomErrors.value.totalCount = 'Min 1'
  return Object.keys(roomErrors.value).length === 0
}
async function submitRoom() {
  if (!validateRoom()) return
  isSubmitting.value = true
  try {
    const body = {
      roomType: roomForm.value.roomType.trim(), capacity: +roomForm.value.capacity,
      pricePerNight: +roomForm.value.pricePerNight, totalCount: +roomForm.value.totalCount,
      image: roomForm.value.image, description: roomForm.value.description,
      amenities: roomForm.value.amenities, status: roomForm.value.status
    }
    if (editingRoom.value) {
      const res = await fetch(`${API}/admin/rooms/${editingRoom.value.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) })
      if (!res.ok) throw new Error('Update failed')
      showNotif('Room updated.', 'success')
    } else {
      const res = await fetch(`${API}/admin/${roomTargetHotel.value.id}/rooms`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) })
      if (!res.ok) throw new Error('Create failed')
      showNotif('Room added.', 'success')
    }
    cancelRoomForm()
    fetchRooms(roomTargetHotel.value.id)
    fetchHotels()
  } catch (e) { showNotif(e.message || 'Failed to save room.', 'warning') }
  isSubmitting.value = false
}

function confirmDelete(item, type) { deleteTarget.value = item; deleteType.value = type; showDeleteModal.value = true }
function cancelDelete() { showDeleteModal.value = false }
async function executeDelete() {
  isSubmitting.value = true
  try {
    const url = deleteType.value === 'hotel' ? `${API}/admin/${deleteTarget.value.id}` : `${API}/admin/rooms/${deleteTarget.value.id}`
    const res = await fetch(url, { method: 'DELETE', headers: authHeaders(false) })
    const data = await res.json()
    if (!res.ok) { showNotif(data.message, 'warning'); isSubmitting.value = false; cancelDelete(); return }
    showNotif(deleteType.value === 'hotel' ? `"${deleteTarget.value.name}" removed.` : 'Room removed.', 'success')
    if (deleteType.value === 'hotel') fetchHotels()
    else { fetchRooms(roomTargetHotel.value.id); fetchHotels() }
  } catch (e) { showNotif('Delete failed.', 'warning') }
  isSubmitting.value = false
  cancelDelete()
}

async function updateBookingStatus(bookingId, newStatus) {
  try {
    const res = await fetch(`${API}/admin/bookings/${bookingId}/status`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status: newStatus }) })
    if (!res.ok) throw new Error('Update failed')
    showNotif('Status updated.', 'success')
    fetchBookings()
  } catch (e) { showNotif('Failed to update.', 'warning') }
}
function toggleHotelStatus(hotel) {
  const newVal = !hotel.available
  fetch(`${API}/admin/${hotel.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ name: hotel.name, location: hotel.location, type: hotel.type || '', contact: hotel.contact || '', email: hotel.email || '', basePrice: hotel.basePrice, description: hotel.description, amenities: hotel.amenities, mainImage: hotel.image, galleryImages: hotel.gallery, available: newVal }) })
  hotel.available = newVal
  showNotif(`${hotel.name} is now ${newVal ? 'active' : 'inactive'}.`, 'info')
}

function showNotif(message, type = 'info') { notif.value = { message, type }; setTimeout(() => { notif.value = null }, 3500) }
function formatPrice(n) { return 'Ã¢â€šÂ±' + Number(n).toLocaleString() }
function formatDate(d) { return d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Ã¢â‚¬â€' }
function formatStatus(s) { return s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Ã¢â‚¬â€' }

onMounted(() => { fetchHotels(); fetchBookings() })
</script>

<template>
  <div class="hm">
    <Transition name="toast">
      <div v-if="notif" class="toast" :class="notif.type">
        <i class="fa-solid" :class="{ 'fa-circle-check': notif.type === 'success', 'fa-circle-info': notif.type === 'info', 'fa-triangle-exclamation': notif.type === 'warning' }"></i>
        <span>{{ notif.message }}</span>
      </div>
    </Transition>

    <div class="ph">
      <div>
        <h1 class="pt">Hotels <span class="ta">& Accommodations</span></h1>
      </div>
      <button v-if="activeTab === 'hotels'" class="ba" @click="openAddHotel"><i class="fa-solid fa-plus"></i> Add Hotel</button>
    </div>

    <div class="sr">
      <div class="sc"><div class="si navy"><i class="fa-solid fa-hotel"></i></div><div class="sb"><span class="sv">{{ stats.total }}</span><span class="sl">Properties</span></div></div>
      <div class="sc"><div class="si green"><i class="fa-solid fa-circle-check"></i></div><div class="sb"><span class="sv">{{ stats.active }}</span><span class="sl">Active</span></div></div>
      <div class="sc"><div class="si red"><i class="fa-solid fa-circle-pause"></i></div><div class="sb"><span class="sv">{{ stats.inactive }}</span><span class="sl">Inactive</span></div></div>
      <div class="sc"><div class="si gold"><i class="fa-solid fa-bed"></i></div><div class="sb"><span class="sv">{{ stats.roomUnits }}</span><span class="sl">Total Rooms</span></div></div>
      <div class="sc"><div class="si blue"><i class="fa-solid fa-calendar-check"></i></div><div class="sb"><span class="sv">{{ stats.activeBookings }}</span><span class="sl">Active Bookings</span></div></div>
      <div class="sc"><div class="si emerald"><i class="fa-solid fa-peso-sign"></i></div><div class="sb"><span class="sv">{{ formatPrice(stats.revenue) }}</span><span class="sl">Revenue</span></div></div>
    </div>

    <div class="tb">
      <button class="tt" :class="{ active: activeTab === 'hotels' }" @click="activeTab = 'hotels'"><i class="fa-solid fa-hotel"></i> Hotels & Rooms</button>
      <button class="tt" :class="{ active: activeTab === 'bookings' }" @click="activeTab = 'bookings'; fetchBookings()"><i class="fa-solid fa-rectangle-list"></i> Bookings <span v-if="bookings.length" class="tbadge mat-well">{{ bookings.length }}</span></button>
    </div>


    <template v-if="activeTab === 'hotels'">
      <div class="toolbar">
        <div class="sw"><i class="fa-solid fa-magnifying-glass sico"></i><input v-model="searchQuery" type="text" class="sinp" placeholder="Search by name, location, or type" /></div>
        <div class="ft">
          <button v-for="f in ['all', 'active', 'inactive']" :key="f" class="ftab mat-skeuo-sm mat-pressable-sm" :class="{ active: filterStatus === f }" @click="filterStatus = f">{{ f.charAt(0).toUpperCase() + f.slice(1) }}</button>
        </div>
      </div>
      <div class="tw">
        <table class="dt">
          <thead><tr><th>#</th><th>Property</th><th>Location</th><th>Type</th><th>Rooms</th><th>Price Range</th><th>Amenities</th><th>Status</th><th>Added</th><th>Actions</th></tr></thead>
          <tbody>
            <tr v-if="filteredHotels.length === 0"><td colspan="10" class="er"><i class="fa-solid fa-hotel"></i><span>No hotels found.</span></td></tr>
            <tr v-for="(h, i) in filteredHotels" :key="h.id" class="dr">
              <td class="cn">{{ i + 1 }}</td>
              <td>
                <div class="nc">
                  <div class="av" :style="h.image ? { backgroundImage: `url(${h.image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}"><i v-if="!h.image" class="fa-solid fa-hotel"></i></div>
                  <div><div class="nm">{{ h.name }}</div><div class="sbt">{{ h.contact || 'Ã¢â‚¬â€' }}</div></div>
                </div>
              </td>
              <td class="ct">{{ h.location || 'Ã¢â‚¬â€' }}</td>
              <td><span class="tbadge2 mat-well">{{ h.type || 'Ã¢â‚¬â€' }}</span></td>
              <td class="cn">{{ h.rooms?.length || 0 }} <span class="si2">({{ h.rooms?.reduce((s, r) => s + (r.totalCount || 0), 0) || 0 }} units)</span></td>
              <td class="cp"><template v-if="h.rooms?.length">{{ formatPrice(Math.min(...h.rooms.map(r => r.price))) }} Ã¢â‚¬â€œ {{ formatPrice(Math.max(...h.rooms.map(r => r.price))) }}</template><span v-else class="tm">No rooms</span></td>
              <td><div class="al"><span v-for="a in (h.amenities || []).slice(0, 2)" :key="a" class="at">{{ a }}</span><span v-if="(h.amenities || []).length > 2" class="am">+{{ h.amenities.length - 2 }}</span></div></td>
              <td><button class="sp" :class="h.available ? 'active' : 'inactive'" @click="toggleHotelStatus(h)"><span class="sd"></span>{{ h.available ? 'Active' : 'Inactive' }}</button></td>
              <td class="cd">{{ formatDate(h.createdAt) }}</td>
              <td class="ca">
                <button class="ab rooms" @click="openRoomManager(h)" title="Manage Rooms"><i class="fa-solid fa-door-open"></i></button>
                <button class="ab edit" @click="openEditHotel(h)" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="ab delete" @click="confirmDelete(h, 'hotel')" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="tf">Showing <strong>{{ filteredHotels.length }}</strong> of <strong>{{ hotels.length }}</strong> properties</div>
    </template>

    <template v-if="activeTab === 'bookings'">
      <div class="toolbar">
        <div class="ft">
          <button v-for="f in ['all', 'confirmed', 'cancelled', 'completed', 'no_show']" :key="f" class="ftab mat-skeuo-sm mat-pressable-sm" :class="{ active: bookingFilter === f }" @click="bookingFilter = f">{{ f === 'no_show' ? 'No Show' : f.charAt(0).toUpperCase() + f.slice(1) }}</button>
        </div>
      </div>
      <div class="tw">
        <table class="dt">
          <thead><tr><th>Ref#</th><th>Guest</th><th>Hotel</th><th>Room</th><th>Check-in</th><th>Check-out</th><th>Nights</th><th>Amount</th><th>Status</th><th>Booked</th><th>Action</th></tr></thead>
          <tbody>
            <tr v-if="filteredBookings.length === 0"><td colspan="11" class="er"><i class="fa-solid fa-rectangle-list"></i><span>No bookings found.</span></td></tr>
            <tr v-for="b in filteredBookings" :key="b.id" class="dr">
              <td class="cr">{{ b.booking_ref }}</td>
              <td><div class="nm">{{ b.guest_name }}</div><div class="sbt">{{ b.guest_email }}</div></td>
              <td class="ct">{{ b.hotel_name }}</td>
              <td><span class="tbadge2 mat-well">{{ b.room_type }}</span></td>
              <td class="cd">{{ formatDate(b.check_in) }}</td>
              <td class="cd">{{ formatDate(b.check_out) }}</td>
              <td class="cn">{{ b.nights }}</td>
              <td class="cp">{{ formatPrice(b.total_amount) }}</td>
              <td>
                <select class="ss" :value="b.status" @change="updateBookingStatus(b.id, $event.target.value)">
                  <option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="no_show">No Show</option>
                </select>
              </td>
              <td class="cd">{{ formatDate(b.created_at) }}</td>
              <td><span class="sp sm" :class="b.status"><span class="sd"></span>{{ formatStatus(b.status) }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="tf">Showing <strong>{{ filteredBookings.length }}</strong> of <strong>{{ bookings.length }}</strong> bookings</div>
    </template>

    <!-- Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â ADD/EDIT HOTEL MODAL Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â -->
    <Transition name="modal">
      <div v-if="showHotelModal" class="mo" @click.self="closeHotelModal">
        <div class="md">
          <div class="mh">
            <div class="mtw"><div class="mi"><i class="fa-solid fa-hotel"></i></div><div><h2 class="mtl">{{ editingHotel ? 'Edit Hotel' : 'Add New Hotel' }}</h2><p class="msb">{{ editingHotel ? 'Update hotel information' : 'Register a new accommodation' }}</p></div></div>
            <button class="mc" @click="closeHotelModal"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="mb">
            <div class="fr">
              <div class="fg" :class="{ error: hotelErrors.name }"><label>Hotel Name <span class="rq">*</span></label><input v-model="hotelForm.name" type="text" placeholder="e.g. Tamaraw Beach Resort" /><span class="em" v-if="hotelErrors.name">{{ hotelErrors.name }}</span></div>
              <div class="fg" :class="{ error: hotelErrors.type }"><label>Property Type <span class="rq">*</span></label><select v-model="hotelForm.type"><option value="" disabled>Select typeÃ¢â‚¬Â¦</option><option v-for="t in hotelTypes" :key="t" :value="t">{{ t }}</option></select><span class="em" v-if="hotelErrors.type">{{ hotelErrors.type }}</span></div>
            </div>
            <div class="fr">
              <div class="fg" :class="{ error: hotelErrors.location }"><label>Location / Barangay <span class="rq">*</span></label><select v-model="hotelForm.location"><option value="" disabled>SelectÃ¢â‚¬Â¦</option><option v-for="b in barangays" :key="b" :value="b">{{ b }}</option></select><span class="em" v-if="hotelErrors.location">{{ hotelErrors.location }}</span></div>
              <div class="fg" :class="{ error: hotelErrors.basePrice }"><label>Starting Price (Ã¢â€šÂ±/night) <span class="rq">*</span></label><input v-model="hotelForm.basePrice" type="number" min="1" placeholder="e.g. 800" /><span class="em" v-if="hotelErrors.basePrice">{{ hotelErrors.basePrice }}</span></div>
            </div>
            <div class="fr">
              <div class="fg" :class="{ error: hotelErrors.contact }"><label>Contact Number <span class="rq">*</span></label><input v-model="hotelForm.contact" type="text" placeholder="+63 9XX XXX XXXX" /><span class="em" v-if="hotelErrors.contact">{{ hotelErrors.contact }}</span></div>
              <div class="fg"><label>Email Address</label><input v-model="hotelForm.email" type="email" placeholder="hotel@email.com" /></div>
            </div>
            <div class="fg"><label>Description</label><textarea v-model="hotelForm.description" rows="3" placeholder="Short descriptionÃ¢â‚¬Â¦"></textarea></div>
            <div class="fg"><label>Amenities</label><div class="cg"><label v-for="a in amenityOptions" :key="a" class="ci" :class="{ checked: hotelForm.amenities.includes(a) }" @click="hotelForm.amenities.includes(a) ? hotelForm.amenities.splice(hotelForm.amenities.indexOf(a), 1) : hotelForm.amenities.push(a)">{{ a }}</label></div></div>
            <div class="fg"><label>Status</label><div class="rg"><label class="ro" :class="{ selected: hotelForm.available }" @click="hotelForm.available = true"><span class="rd green"></span> Active</label><label class="ro" :class="{ selected: !hotelForm.available }" @click="hotelForm.available = false"><span class="rd red"></span> Inactive</label></div></div>
            <div class="fg"><label>Main Image</label><div class="uz" @click="$refs.mainImgIn.click()"><div v-if="hotelForm.mainImage" class="up"><img :src="hotelForm.mainImage" alt="Preview" /><button class="rp" @click.stop="hotelForm.mainImage = ''"><i class="fa-solid fa-xmark"></i></button></div><div v-else class="uph"><i class="fa-solid fa-cloud-arrow-up"></i><span>Click to upload main image</span></div></div><input ref="mainImgIn" type="file" accept="image/*" class="hi" @change="handleMainImage" /></div>
            <div class="fg"><label>Gallery Images (up to 5)</label><div class="uz gu" @click="$refs.galIn.click()" v-if="hotelForm.galleryImages.length < 5"><i class="fa-solid fa-images"></i><span>Add gallery photo</span></div><input ref="galIn" type="file" accept="image/*" multiple class="hi" @change="handleGalleryImages" /><div v-if="hotelForm.galleryImages.length" class="gp"><div v-for="(img, idx) in hotelForm.galleryImages" :key="idx" class="gt"><img :src="img" alt="Gallery" /><button class="rt" @click="removeGalleryImage(idx)"><i class="fa-solid fa-xmark"></i></button></div></div></div>
          </div>
          <div class="mf"><button class="bc" @click="closeHotelModal">Cancel</button><button class="bs" @click="submitHotel" :disabled="isSubmitting || !hotelForm.mainImage"><span><i class="fa-solid fa-floppy-disk"></i> {{ editingHotel ? 'Update' : 'Save' }} Hotel</span></button></div>
        </div>
      </div>
    </Transition>

    <!-- Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â ROOM MANAGER MODAL Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â -->
    <Transition name="modal">
      <div v-if="showRoomModal" class="mo" @click.self="closeRoomModal">
        <div class="md mdl">
          <div class="mh">
            <div class="mtw"><div class="mi"><i class="fa-solid fa-door-open"></i></div><div><h2 class="mtl">Rooms Ã¢â‚¬â€ {{ roomTargetHotel?.name }}</h2><p class="msb">Manage room types and availability</p></div></div>
            <button class="mc" @click="closeRoomModal"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="mb">
            <div v-if="!showRoomForm">
              <div v-if="roomList.length === 0" class="es"><i class="fa-solid fa-bed"></i><p>No rooms yet. Add your first room type.</p></div>
              <div v-else class="rgg">
                <div v-for="room in roomList" :key="room.id" class="rc">
                  <div class="rci" :style="room.image ? { backgroundImage: `url(${room.image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}"><i v-if="!room.image" class="fa-solid fa-bed rci2"></i><span class="rsb" :class="room.status">{{ room.status }}</span></div>
                  <div class="rcb">
                    <div class="rch"><h4>{{ room.name }}</h4><span class="rp2">{{ formatPrice(room.price) }}<small>/night</small></span></div>
                    <div class="rme"><span><i class="fa-solid fa-user"></i> {{ room.capacity }} guest{{ room.capacity > 1 ? 's' : '' }}</span><span><i class="fa-solid fa-door-open"></i> {{ room.totalCount }} unit{{ room.totalCount > 1 ? 's' : '' }}</span></div>
                    <div v-if="room.amenities?.length" class="ral"><span v-for="a in room.amenities.slice(0, 3)" :key="a" class="at">{{ a }}</span></div>
                    <div class="rac"><button class="ab edit" @click="openEditRoom(room)" style="width:auto;padding:6px 12px;font-size:.78rem"><i class="fa-solid fa-pen"></i> Edit</button><button class="ab delete" @click="confirmDelete(room, 'room')" style="width:auto;padding:6px 12px;font-size:.78rem"><i class="fa-solid fa-trash-can"></i> Delete</button></div>
                  </div>
                </div>
              </div>
              <button class="ba fwm" @click="openAddRoom"><i class="fa-solid fa-plus"></i> Add Room Type</button>
            </div>
            <div v-else>
              <div class="rfh"><h3>{{ editingRoom ? 'Edit Room' : 'Add New Room' }}</h3><button class="bl" @click="cancelRoomForm"><i class="fa-solid fa-arrow-left"></i> Back to list</button></div>
              <div class="fr">
                <div class="fg" :class="{ error: roomErrors.roomType }"><label>Room Type <span class="rq">*</span></label><input v-model="roomForm.roomType" type="text" placeholder="e.g. Standard Room" /><span class="em" v-if="roomErrors.roomType">{{ roomErrors.roomType }}</span></div>
                <div class="fg" :class="{ error: roomErrors.capacity }"><label>Guest Capacity <span class="rq">*</span></label><input v-model="roomForm.capacity" type="number" min="1" placeholder="2" /><span class="em" v-if="roomErrors.capacity">{{ roomErrors.capacity }}</span></div>
              </div>
              <div class="fr">
                <div class="fg" :class="{ error: roomErrors.pricePerNight }"><label>Price per Night (Ã¢â€šÂ±) <span class="rq">*</span></label><input v-model="roomForm.pricePerNight" type="number" min="1" placeholder="e.g. 2500" /><span class="em" v-if="roomErrors.pricePerNight">{{ roomErrors.pricePerNight }}</span></div>
                <div class="fg" :class="{ error: roomErrors.totalCount }"><label>Number of Units <span class="rq">*</span></label><input v-model="roomForm.totalCount" type="number" min="1" placeholder="e.g. 5" /><span class="em" v-if="roomErrors.totalCount">{{ roomErrors.totalCount }}</span></div>
              </div>
              <div class="fg"><label>Description</label><textarea v-model="roomForm.description" rows="2" placeholder="Optional room descriptionÃ¢â‚¬Â¦"></textarea></div>
              <div class="fg"><label>Room Amenities</label><div class="cg"><label v-for="a in roomAmenityOptions" :key="a" class="ci" :class="{ checked: roomForm.amenities.includes(a) }" @click="roomForm.amenities.includes(a) ? roomForm.amenities.splice(roomForm.amenities.indexOf(a), 1) : roomForm.amenities.push(a)">{{ a }}</label></div></div>
              <div class="fg"><label>Status</label><div class="rg"><label class="ro" :class="{ selected: roomForm.status === 'active' }" @click="roomForm.status = 'active'"><span class="rd green"></span> Active</label><label class="ro" :class="{ selected: roomForm.status === 'inactive' }" @click="roomForm.status = 'inactive'"><span class="rd red"></span> Inactive</label></div></div>
              <div class="fg"><label>Room Image</label><div class="uz" @click="$refs.rmIn.click()"><div v-if="roomForm.image" class="up"><img :src="roomForm.image" alt="Preview" /><button class="rp" @click.stop="roomForm.image = ''"><i class="fa-solid fa-xmark"></i></button></div><div v-else class="uph"><i class="fa-solid fa-cloud-arrow-up"></i><span>Click to upload room image</span></div></div><input ref="rmIn" type="file" accept="image/*" class="hi" @change="handleRoomImage" /></div>
              <div class="fab"><button class="bc" @click="cancelRoomForm">Cancel</button><button class="bs" @click="submitRoom" :disabled="isSubmitting"><span><i class="fa-solid fa-floppy-disk"></i> {{ editingRoom ? 'Update' : 'Add' }} Room</span></button></div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â DELETE MODAL Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â -->
    <Transition name="modal">
      <div v-if="showDeleteModal" class="mo" @click.self="cancelDelete">
        <div class="md mds">
          <div class="mh">
            <div class="mtw"><div class="mi danger"><i class="fa-solid fa-trash-can"></i></div><div><h2 class="mtl">Confirm Removal</h2><p class="msb">This action cannot be undone</p></div></div>
            <button class="mc" @click="cancelDelete"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="mb"><p>Are you sure you want to remove <strong>{{ deleteType === 'hotel' ? deleteTarget?.name : deleteTarget?.name + ' room' }}</strong>?</p><p class="dw" v-if="deleteType === 'hotel'">All rooms and booking history will be permanently deleted.</p></div>
          <div class="mf"><button class="bc" @click="cancelDelete">Cancel</button><button class="bd" @click="executeDelete" :disabled="isSubmitting"><span><i class="fa-solid fa-trash-can"></i> Yes, Remove</span></button></div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.hm{font-family:var(--font-body);height:100%;overflow-y:auto;padding:28px 32px 48px;background:var(--bg);position:relative}
.toast{position:fixed;top:24px;right:24px;z-index:9999;display:flex;align-items:center;gap:10px;padding:12px 20px;border-radius:var(--r-md);font-size:.84rem;font-weight:600;box-shadow:var(--shadow-md);background:var(--card-solid);border:1px solid var(--bdr)}
.toast.success{color:var(--ok);border-left:3px solid var(--ok)}
.toast.info{color:var(--tl);border-left:3px solid var(--tl)}
.toast.warning{color:var(--wn);border-left:3px solid var(--wn)}
.toast-enter-active,.toast-leave-active{transition:all .3s ease}
.toast-enter-from,.toast-leave-to{opacity:0;transform:translateY(-12px)}
.ph{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;gap:16px}
.pt{font-family:var(--font-display);font-size:1.75rem;font-weight:700;color:var(--fg);line-height:1.1}
.ta{color:var(--ac);font-style:italic}
.ps{font-size:.82rem;color:var(--mt);margin-top:4px}
.ba{display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,var(--m-accent-hi),var(--m-accent-solid));color:#fff;border:none;border-radius:var(--r-sm);padding:10px 20px;font-family:var(--font-body);font-size:.86rem;font-weight:700;cursor:pointer;transition:all .18s;flex-shrink:0;box-shadow:0 4px 16px var(--acg)}
.ba:hover{transform:translateY(-2px);box-shadow:0 6px 20px var(--acg)}
.ba.fwm{width:100%;justify-content:center;margin-top:16px}
.sr{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;margin-bottom:22px}
.sc{background:var(--card-solid);border-radius:var(--r-md);border:1px solid var(--bdr);padding:16px 18px;display:flex;align-items:center;gap:14px}
.si{width:44px;height:44px;border-radius:var(--r-sm);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.1rem}
.si.navy{background:var(--acs);color:var(--ac)}
.si.green{background:var(--oks);color:var(--ok)}
.si.red{background:var(--dgs);color:var(--dg)}
.si.gold{background:var(--wns);color:var(--wn)}
.si.blue{background:var(--tls);color:var(--tl)}
.si.emerald{background:var(--vis);color:var(--vi)}
.sv{display:block;font-size:1.35rem;font-weight:700;color:var(--fg);line-height:1}
.sl{display:block;font-size:.68rem;color:var(--mt);font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-top:3px}
.tb{display:flex;gap:4px;margin-bottom:18px;background:var(--card-solid);border-radius:var(--r-md);padding:4px;border:1px solid var(--bdr);width:fit-content}
.tt{display:flex;align-items:center;gap:8px;padding:10px 20px;border:none;border-radius:var(--r-sm);font-family:var(--font-body);font-size:.86rem;font-weight:600;cursor:pointer;background:transparent;color:var(--mt);transition:all .15s}
.tt.active{background: var(--m-accent-solid);color: #fff}
.tbadge{background: var(--dg-solid);color: #fff;font-size:.7rem;padding:1px 7px;border-radius:10px;font-weight:700}
.tt:not(.active) .tbadge{background:var(--card3);color:var(--mt)}
.toolbar{display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.sw{position:relative;flex:1;min-width:220px}
.sico{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--mt2);font-size:.85rem;pointer-events:none}
.sinp{width:100%;padding:9px 12px 9px 36px;border:1px solid var(--bdr);border-radius:var(--r-sm);font-family:var(--font-body);font-size:.84rem;color:var(--fg);background:var(--bg2);outline:none;transition:border-color .15s}
.sinp:focus{border-color:var(--ac)}
.sinp::placeholder{color:var(--mt2)}
.ft{display:flex;gap:6px}
.ftab{padding:8px 16px;border-radius:var(--r-sm);font-family:var(--font-body);font-size:.82rem;font-weight:600;cursor:pointer;border:1px solid var(--bdr);background:var(--bg2);color:var(--mt);transition:all .15s}
.ftab:hover{border-color:var(--ac);color:var(--fg)}
.ftab.active{background: var(--m-accent-solid);color: #fff;border-color: var(--m-accent-solid)}
.tw{background:var(--card-solid);border-radius:var(--r-md);border:1px solid var(--bdr);overflow:hidden;overflow-x:auto}
.dt{width:100%;border-collapse:collapse;min-width:1000px}
.dt thead tr{background:var(--bg2);border-bottom:1px solid var(--bdr)}
.dt th{padding:11px 14px;text-align:left;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--mt);white-space:nowrap}
.dt tbody tr{border-bottom:1px solid var(--bdr);transition:background .12s}
.dt tbody tr:last-child{border-bottom:none}
.dt tbody tr:hover{background:var(--card2)}
.dt td{padding:13px 14px;vertical-align:middle}
.cn{color:var(--mt2);font-size:.78rem;font-weight:600;width:40px;text-align:center}
.si2{color:var(--mt2);font-size:.72rem;font-weight:500}
.nc{display:flex;align-items:center;gap:10px}
.av{width:36px;height:36px;border-radius:var(--r-sm);flex-shrink:0;background:var(--bg2);color:var(--mt);display:flex;align-items:center;justify-content:center;font-size:.85rem;overflow:hidden}
.nm{font-size:.88rem;font-weight:700;color:var(--fg)}
.sbt{font-size:.74rem;color:var(--mt);margin-top:1px}
.ct{font-size:.82rem;color:var(--fg2)}
.tbadge2{display:inline-block;padding:3px 10px;border-radius:var(--r-sm);font-size:.72rem;font-weight:700;background:var(--acs);color:var(--ac);white-space:nowrap}
.cp{font-size:.8rem;font-weight:600;color:var(--ok);white-space:nowrap}
.cr{font-family:var(--font-mono);font-size:.78rem;font-weight:700;color:var(--fg)}
.cd{font-size:.78rem;color:var(--mt);white-space:nowrap}
.ca{display:flex;gap:6px}
.tm{color:var(--mt2);font-size:.82rem}
.al{display:flex;flex-wrap:wrap;gap:4px}
.at{display:inline-block;padding:2px 7px;border-radius:var(--r-sm);font-size:.68rem;font-weight:600;background:var(--card3);color:var(--fg2)}
.am{display:inline-block;padding:2px 7px;border-radius:var(--r-sm);font-size:.68rem;font-weight:700;background:var(--bdr);color:var(--mt)}
.sp{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:20px;font-size:.74rem;font-weight:700;text-transform:capitalize;border:none;cursor:pointer;font-family:var(--font-body);transition:all .15s}
.sp.active{background:var(--oks);color:var(--ok)}
.sp.inactive{background:var(--dgs);color:var(--dg)}
.sp.confirmed{background:var(--oks);color:var(--ok)}
.sp.cancelled{background:var(--dgs);color:var(--dg)}
.sp.completed{background:var(--tls);color:var(--tl)}
.sp.no_show{background:var(--wns);color:var(--wn)}
.sp.sm{padding:2px 8px;font-size:.68rem}
.sp:hover{opacity:.8;transform:scale(.97)}
.sd{width:6px;height:6px;border-radius:50%;background:currentColor}
.ss{padding:6px 10px;border:1px solid var(--bdr);border-radius:var(--r-sm);font-family:var(--font-body);font-size:.8rem;font-weight:600;color:var(--fg);background:var(--bg2);cursor:pointer;outline:none}
.ss:focus{border-color:var(--ac)}
.ab{width:32px;height:32px;border-radius:var(--r-sm);border:none;display:flex;align-items:center;justify-content:center;font-size:.82rem;cursor:pointer;transition:all .15s}
.ab.delete{background:var(--dgs);color:var(--dg)}
.ab.delete:hover{background: var(--dg-solid);color: #fff}
.ab.edit{background:var(--tls);color:var(--tl)}
.ab.edit:hover{background:var(--tl);color:var(--fg)}
.ab.rooms{background:var(--wns);color:var(--wn)}
.ab.rooms:hover{background:var(--wn);color:var(--fg)}
.er{text-align:center;padding:48px 0!important;color:var(--mt2)}
.er i{font-size:2rem;display:block;margin-bottom:10px}
.er span{font-size:.88rem}
.tf{padding:10px 16px;font-size:.78rem;color:var(--mt);border-top:1px solid var(--bdr);background:var(--card-solid);border-radius:0 0 var(--r-md) var(--r-md)}
.mo{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px)}
.md{background:var(--card-solid);border:1px solid var(--bdr);border-radius:var(--r-lg);width:100%;max-width:680px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--shadow-lg)}
.mdl{max-width:860px}
.mds{max-width:420px}
.mh{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--bdr);flex-shrink:0}
.mtw{display:flex;align-items:center;gap:14px}
.mi{width:42px;height:42px;border-radius:var(--r-sm);flex-shrink:0;background:var(--acs);color:var(--ac);display:flex;align-items:center;justify-content:center;font-size:1.1rem}
.mi.danger{background:var(--dgs);color:var(--dg)}
.mtl{font-family:var(--font-display);font-size:1.15rem;font-weight:700;color:var(--fg)}
.msb{font-size:.78rem;color:var(--mt);margin-top:2px}
.mc{width:34px;height:34px;border:1px solid var(--bdr);border-radius:var(--r-sm);background:none;color:var(--mt);font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}
.mc:hover{background:var(--dgs);color:var(--dg);border-color:var(--dg)}
.mb{flex:1;overflow-y:auto;padding:22px 24px}
.mb::-webkit-scrollbar{width:4px}
.mb::-webkit-scrollbar-thumb{background:var(--bdr2);border-radius:2px}
.mf{padding:16px 24px;border-top:1px solid var(--bdr);display:flex;justify-content:flex-end;gap:10px;flex-shrink:0}
.fr{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.fg{display:flex;flex-direction:column;gap:5px;margin-bottom:16px}
.fr .fg{margin-bottom:0}
.fg label{font-size:.78rem;font-weight:700;color:var(--fg2);text-transform:uppercase;letter-spacing:.05em}
.rq{color:var(--dg)}
.fg input,.fg select,.fg textarea{width:100%;padding:9px 12px;border:1px solid var(--bdr);border-radius:var(--r-sm);font-family:var(--font-body);font-size:.86rem;color:var(--fg);background:var(--bg2);outline:none;transition:border-color .15s}
.fg input:focus,.fg select:focus,.fg textarea:focus{border-color:var(--ac)}
.fg.error input,.fg.error select{border-color:var(--dg)}
.em{font-size:.74rem;color:var(--dg);font-weight:600}
.rg{display:flex;gap:10px}
.ro{display:flex;align-items:center;gap:8px;padding:8px 14px;border:1px solid var(--bdr);border-radius:var(--r-sm);cursor:pointer;font-size:.84rem;font-weight:600;color:var(--fg2);transition:all .15s}
.ro.selected{border-color:var(--ac);background:var(--acs);color:var(--fg)}
.rd{width:8px;height:8px;border-radius:50%}
.rd.green{background:var(--ok)}
.rd.red{background:var(--dg)}
.cg{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
.ci{display:flex;align-items:center;gap:7px;padding:7px 10px;border:1px solid var(--bdr);border-radius:var(--r-sm);cursor:pointer;font-size:.8rem;font-weight:500;color:var(--fg2);transition:all .14s}
.ci.checked{background:var(--acs);border-color:var(--ac);color:var(--fg);font-weight:700}
.ci:hover{border-color:var(--ac)}
.uz{border:2px dashed var(--bdr2);border-radius:var(--r-sm);padding:24px;text-align:center;cursor:pointer;transition:all .15s;color:var(--mt)}
.uz:hover{border-color:var(--ac);color:var(--fg);background:var(--acs)}
.uz.gu{padding:14px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:.82rem}
.up{position:relative;display:inline-block}
.up img{max-height:140px;border-radius:var(--r-sm);display:block}
.rp{position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;background: var(--dg-solid);color: #fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.7rem}
.uph{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:.82rem}
.uph i{font-size:1.5rem}
.hi{display:none}
.gp{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.gt{position:relative;width:70px;height:70px;border-radius:var(--r-sm);overflow:hidden}
.gt img{width:100%;height:100%;object-fit:cover}
.rt{position:absolute;top:0;right:0;width:20px;height:20px;background:rgba(0,0,0,.6);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.6rem}
.es{text-align:center;padding:40px 0;color:var(--mt2)}
.es i{font-size:2.5rem;display:block;margin-bottom:12px}
.es p{font-size:.88rem}
.rgg{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.rc{border:1px solid var(--bdr);border-radius:var(--r-md);overflow:hidden;background:var(--card-solid);transition:box-shadow .15s}
.rc:hover{box-shadow:var(--shadow-md)}
.rci{height:120px;background:var(--bg2);position:relative;overflow:hidden}
.rci2{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:var(--mt2)}
.rsb{position:absolute;top:8px;right:8px;padding:2px 8px;border-radius:var(--r-sm);font-size:.65rem;font-weight:700;text-transform:uppercase}
.rsb.active{background:var(--oks);color:var(--ok)}
.rsb.inactive{background:var(--dgs);color:var(--dg)}
.rcb{padding:14px}
.rch{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.rch h4{font-size:.92rem;font-weight:700;color:var(--fg)}
.rp2{font-size:1rem;font-weight:800;color:var(--ac)}
.rp2 small{font-size:.7rem;font-weight:600;color:var(--mt)}
.rme{display:flex;gap:14px;font-size:.78rem;color:var(--mt);margin-bottom:8px}
.rme i{margin-right:4px;font-size:.7rem}
.ral{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px}
.rac{display:flex;gap:8px}
.rfh{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid var(--bdr)}
.rfh h3{font-size:1.05rem;font-weight:700;color:var(--fg)}
.bl{color:var(--tl);font-size:.84rem;font-weight:600;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:6px}
.bl:hover{text-decoration:underline}
.fab{display:flex;justify-content:flex-end;gap:10px;padding-top:16px;margin-top:16px;border-top:1px solid var(--bdr)}
.bc{padding:9px 20px;border:1px solid var(--bdr);border-radius:var(--r-sm);background:var(--bg2);color:var(--fg2);font-family:var(--font-body);font-size:.86rem;font-weight:600;cursor:pointer;transition:all .15s}
.bc:hover{border-color:var(--bdr2);color:var(--fg)}
.bs{padding:9px 22px;border:none;border-radius:var(--r-sm);background:linear-gradient(135deg,var(--m-accent-hi),var(--m-accent-solid));color:#fff;font-family:var(--font-body);font-size:.86rem;font-weight:700;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:8px;box-shadow:0 4px 16px var(--acg)}
.bs:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 6px 20px var(--acg)}
.bs:disabled{opacity:.6;cursor:not-allowed}
.bd{padding:9px 22px;border:none;border-radius:var(--r-sm);background: var(--dg-solid);color: #fff;font-family:var(--font-body);font-size:.86rem;font-weight:700;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:8px}
.bd:hover:not(:disabled){filter:brightness(1.1)}
.bd:disabled{opacity:.6;cursor:not-allowed}
.dw{margin-top:10px;font-size:.82rem;color:var(--dg);font-weight:600}
.modal-enter-active{transition:all .25s ease-out}
.modal-leave-active{transition:all .2s ease-in}
.modal-enter-from .md,.modal-leave-to .md{transform:translateY(16px) scale(.98);opacity:0}
.modal-enter-from,.modal-leave-to{background:transparent}
@media(max-width:1024px){.sr{grid-template-columns:repeat(3,1fr)}}
@media(max-width:768px){.hm{padding:16px}.sr{grid-template-columns:repeat(2,1fr)}.fr{grid-template-columns:1fr}.cg{grid-template-columns:repeat(2,1fr)}.rgg{grid-template-columns:1fr}}

</style>