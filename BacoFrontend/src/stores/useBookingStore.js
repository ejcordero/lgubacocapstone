import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { API } from '../api'

// ⚠️ Store id is 'userBooking' — deliberately different from the owner-side
// mock store (bookingstore.js, id 'booking') so they never collide in Pinia.
export const useBookingStore = defineStore('userBooking', () => {
  const hotels = ref([])
  const myBookings = ref([])
  const selectedHotel = ref(null)
  const selectedRoomId = ref(null)
  const lastBooking = ref(null)   // response of the last successful booking (confirmation page)
  const step = ref('browse')
  const loading = ref(false)
  const availabilityCache = ref({})

  const selectedRoom = computed(() => {
    if (!selectedHotel.value || !selectedRoomId.value) return null
    return selectedHotel.value.rooms?.find(r => r.id === selectedRoomId.value) ?? null
  })

  async function fetchHotels() {
    loading.value = true
    try {
      const res = await fetch(`${API}/hotels/public`)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data = await res.json()
      hotels.value = Array.isArray(data) ? data : []
    } catch (e) {
      console.error('Fetch hotels error:', e.message)
      hotels.value = []
    } finally {
      loading.value = false
    }
  }

  async function fetchMyBookings(token) {
    if (!token) return
    try {
      const res = await fetch(`${API}/hotels/my-bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const data = await res.json()
      myBookings.value = Array.isArray(data) ? data : []
    } catch (e) {
      console.error('Fetch bookings error:', e.message)
      myBookings.value = []
    }
  }

  // Refresh-safety: if the user lands directly on a detail/booking page
  // (F5 or shared link), resolve the resort by id.
  async function ensureHotel(id) {
    const numId = Number(id)
    // 1) Already selected?
    if (selectedHotel.value && Number(selectedHotel.value.id) === numId) {
      return selectedHotel.value
    }
    // 2) Already in the browsed list? (avoids an extra network call)
    const fromList = hotels.value.find(h => Number(h.id) === numId)
    if (fromList) {
      selectedHotel.value = fromList
      return fromList
    }
    // 3) Fresh fetch (page refresh / direct link)
    try {
      const res = await fetch(`${API}/hotels/public/${id}`)
      if (!res.ok) throw new Error('Resort not found')
      const hotel = await res.json()
      selectedHotel.value = hotel
      return hotel
    } catch (e) {
      console.error('ensureHotel error:', e.message)
      return null
    }
  }

  async function checkAvailability(roomId, checkIn, checkOut) {
    const key = `${roomId}-${checkIn}-${checkOut}`
    if (availabilityCache.value[key]) return availabilityCache.value[key]
    try {
      const res = await fetch(`${API}/hotels/check-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, checkIn, checkOut })
      })
      if (!res.ok) return { available: 0, total: 0, booked: 0 }
      const data = await res.json()
      availabilityCache.value[key] = data
      return data
    } catch (e) {
      console.error('checkAvailability error:', e.message)
      return { available: 0, total: 0, booked: 0 }
    }
  }

  function selectHotel(hotel) {
    selectedHotel.value = hotel
    selectedRoomId.value = null
    availabilityCache.value = {}
    step.value = 'detail'
  }

  function selectRoom(roomId) {
    selectedRoomId.value = roomId
    availabilityCache.value = {}   // new room → dates' cached counts no longer apply
    step.value = 'form'
  }

  async function submitBooking(token, bookingData) {
    let res, data
    try {
      res = await fetch(`${API}/hotels/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(bookingData)
      })
      data = await res.json()
    } catch (e) {
      // Network failure OR non-JSON response (e.g., 500 HTML error page)
      throw new Error('Cannot reach the server. Please try again.')
    }
    if (!res.ok) {
      const err = new Error(data.message || 'Booking failed')
      err.status = res.status
      throw err
    }
    lastBooking.value = data              // persist for the confirmation page
    myBookings.value.unshift(data)        // POST /book returns the same shape as my-bookings items
    availabilityCache.value = {}          // cached counts are stale after a new booking
    step.value = 'confirmation'
    return data
  }

  function resetFlow() {
    selectedHotel.value = null
    selectedRoomId.value = null
    lastBooking.value = null
    availabilityCache.value = {}
    step.value = 'browse'
  }

  return {
    hotels,
    myBookings,
    selectedHotel,
    selectedRoomId,
    selectedRoom,
    lastBooking,
    step,
    loading,
    availabilityCache,
    fetchHotels,
    fetchMyBookings,
    ensureHotel,
    checkAvailability,
    selectHotel,
    selectRoom,
    submitBooking,
    resetFlow
  }
})