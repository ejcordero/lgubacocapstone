import { ref, computed } from 'vue'
import { useBookingStore } from '../stores/useBookingStore'

export function useHotelBooking() {
  const store = useBookingStore()

  const searchQuery = ref('')

  const formData = ref({
    checkIn: '',
    checkOut: '',
    adults: 1,
    children: 0,
    requests: '',
    fullName: '',
    contact: '',
    email: '',
    idType: 'philid',
    termsAccepted: false,
  })

  const filteredHotels = computed(() => {
    const q = searchQuery.value.toLowerCase()
    return store.hotels.filter(h =>
      h.name.toLowerCase().includes(q) ||
      h.location.toLowerCase().includes(q)
    )
  })

  const nightCount = computed(() => {
    if (!formData.value.checkIn || !formData.value.checkOut) return 1
    const diff = new Date(formData.value.checkOut) - new Date(formData.value.checkIn)
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)))
  })

  const totalPrice = computed(() => {
    if (!store.selectedRoom) return 0
    return store.selectedRoom.price * nightCount.value
  })

  const minDate = computed(() => new Date().toISOString().split('T')[0])

  const isFormValid = computed(() => {
    const f = formData.value
    return f.checkIn && f.checkOut && f.fullName && f.contact && f.email && f.termsAccepted
  })

  function prefillFromUser(user) {
    if (!user) return
    formData.value.fullName = user.fullName ?? ''
    formData.value.contact = user.contact ?? ''
    formData.value.email = user.email ?? ''
  }

  function submitBooking() {
    const booking = {
      id: `BCO-${Date.now().toString().slice(-5)}`,
      hotel: store.selectedHotel,
      room: store.selectedRoom,
      details: { ...formData.value },
      totalPrice: totalPrice.value,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    }
    store.addBooking(booking)
  }

  function resetForm() {
    formData.value = {
      checkIn: '',
      checkOut: '',
      adults: 1,
      children: 0,
      requests: '',
      fullName: '',
      contact: '',
      email: '',
      idType: 'philid',
      termsAccepted: false,
    }
  }

  return {
    // Store passthrough
    hotels: computed(() => store.hotels),
    myBookings: computed(() => store.myBookings),
    selectedHotel: computed(() => store.selectedHotel),
    selectedRoom: computed(() => store.selectedRoom),
    step: computed(() => store.step),

    // Local state
    formData,
    searchQuery,

    // Derived
    filteredHotels,
    nightCount,
    totalPrice,
    minDate,
    isFormValid,

    // Actions
    selectHotel: store.selectHotel,
    selectRoom: store.selectRoom,
    goToStep: store.goToStep,
    resetFlow: store.resetFlow,
    prefillFromUser,
    submitBooking,
    resetForm,
  }
}