import { ref, computed } from 'vue';

// Hardcoded bookings data (replace with API call later)
const MOCK_BOOKINGS = [
  { id: 1, booking_ref: 'BK-2025-0128', hotel_id: 1, room_id: 1, user_id: 1, guest_name: 'Anna Cruz', guest_email: 'anna.cruz@email.com', guest_contact: '+63 918 234 5678', guest_id_type: 'passport', check_in: '2025-01-20', check_out: '2025-01-23', adults: 2, children: 0, nights: 3, price_per_night: 6500.00, total_amount: 19500.00, special_requests: 'Early check-in requested', status: 'confirmed', payment_method: 'gcash', payment_status: 'paid', created_at: '2025-01-18T14:30:00' },
  { id: 2, booking_ref: 'BK-2025-0127', hotel_id: 2, room_id: 6, user_id: 2, guest_name: 'Juan Dela Cruz', guest_email: 'juan.dc@email.com', guest_contact: '+63 919 345 6789', guest_id_type: 'drivers_license', check_in: '2025-01-19', check_out: '2025-01-21', adults: 2, children: 0, nights: 2, price_per_night: 3200.00, total_amount: 6400.00, special_requests: null, status: 'checked_in', payment_method: 'on_arrival', payment_status: 'paid', created_at: '2025-01-17T10:15:00' },
  { id: 3, booking_ref: 'BK-2025-0126', hotel_id: 1, room_id: 2, user_id: 3, guest_name: 'Maria Santos', guest_email: 'maria.s@email.com', guest_contact: '+63 920 456 7890', guest_id_type: 'passport', check_in: '2025-01-22', check_out: '2025-01-26', adults: 4, children: 2, nights: 4, price_per_night: 12000.00, total_amount: 48000.00, special_requests: 'Connecting rooms if available', status: 'confirmed', payment_method: 'gcash', payment_status: 'paid', created_at: '2025-01-16T16:45:00' },
  { id: 4, booking_ref: 'BK-2025-0125', hotel_id: 3, room_id: 9, user_id: 4, guest_name: 'Pedro Reyes', guest_email: 'pedro.r@email.com', guest_contact: '+63 921 567 8901', guest_id_type: 'passport', check_in: '2025-01-18', check_out: '2025-01-20', adults: 4, children: 0, nights: 2, price_per_night: 5500.00, total_amount: 11000.00, special_requests: null, status: 'completed', payment_method: 'on_arrival', payment_status: 'paid', created_at: '2025-01-15T09:20:00' },
  { id: 5, booking_ref: 'BK-2025-0124', hotel_id: 1, room_id: 3, user_id: 5, guest_name: 'Sofia Garcia', guest_email: 'sofia.g@email.com', guest_contact: '+63 922 678 9012', guest_id_type: 'passport', check_in: '2025-01-25', check_out: '2025-01-28', adults: 2, children: 0, nights: 3, price_per_night: 9500.00, total_amount: 28500.00, special_requests: 'Late checkout', status: 'confirmed', payment_method: 'gcash', payment_status: 'paid', created_at: '2025-01-14T11:30:00' },
  { id: 6, booking_ref: 'BK-2025-0123', hotel_id: 2, room_id: 7, user_id: 6, guest_name: 'Ricardo Lim', guest_email: 'ricardo.l@email.com', guest_contact: '+63 923 789 0123', guest_id_type: 'drivers_license', check_in: '2025-01-15', check_out: '2025-01-17', adults: 2, children: 0, nights: 2, price_per_night: 4200.00, total_amount: 8400.00, special_requests: null, status: 'completed', payment_method: 'on_arrival', payment_status: 'paid', created_at: '2025-01-13T13:45:00' },
  { id: 7, booking_ref: 'BK-2025-0122', hotel_id: 3, room_id: 10, user_id: 7, guest_name: 'Isabella Torres', guest_email: 'isabella.t@email.com', guest_contact: '+63 924 890 1234', guest_id_type: 'passport', check_in: '2025-01-21', check_out: '2025-01-23', adults: 2, children: 0, nights: 2, price_per_night: 3800.00, total_amount: 7600.00, special_requests: 'High floor preferred', status: 'pending', payment_method: 'on_arrival', payment_status: 'unpaid', created_at: '2025-01-12T15:20:00' },
  { id: 8, booking_ref: 'BK-2025-0121', hotel_id: 1, room_id: 4, user_id: 8, guest_name: 'Miguel Angeles', guest_email: 'miguel.a@email.com', guest_contact: '+63 925 901 2345', guest_id_type: 'passport', check_in: '2025-01-16', check_out: '2025-01-19', adults: 3, children: 0, nights: 3, price_per_night: 7500.00, total_amount: 22500.00, special_requests: null, status: 'completed', payment_method: 'gcash', payment_status: 'paid', created_at: '2025-01-11T10:10:00' },
  { id: 9, booking_ref: 'BK-2025-0120', hotel_id: 2, room_id: 8, user_id: 9, guest_name: 'Carmen Navarro', guest_email: 'carmen.n@email.com', guest_contact: '+63 926 012 3456', guest_id_type: 'drivers_license', check_in: '2025-01-24', check_out: '2025-01-25', adults: 1, children: 0, nights: 1, price_per_night: 1800.00, total_amount: 1800.00, special_requests: null, status: 'cancelled', payment_method: 'on_arrival', payment_status: 'unpaid', created_at: '2025-01-10T14:30:00' },
  { id: 10, booking_ref: 'BK-2025-0119', hotel_id: 1, room_id: 5, user_id: 10, guest_name: 'Diego Ramos', guest_email: 'diego.r@email.com', guest_contact: '+63 927 123 4567', guest_id_type: 'passport', check_in: '2025-01-28', check_out: '2025-02-01', adults: 2, children: 0, nights: 4, price_per_night: 15000.00, total_amount: 60000.00, special_requests: 'Anniversary celebration', status: 'confirmed', payment_method: 'gcash', payment_status: 'paid', created_at: '2025-01-09T16:15:00' },
  { id: 11, booking_ref: 'BK-2025-0118', hotel_id: 3, room_id: 11, user_id: 1, guest_name: 'Lucia Fernandez', guest_email: 'lucia.f@email.com', guest_contact: '+63 928 234 5678', guest_id_type: 'passport', check_in: '2025-01-17', check_out: '2025-01-19', adults: 2, children: 0, nights: 2, price_per_night: 4800.00, total_amount: 9600.00, special_requests: null, status: 'completed', payment_method: 'on_arrival', payment_status: 'paid', created_at: '2025-01-08T09:45:00' },
  { id: 12, booking_ref: 'BK-2025-0117', hotel_id: 1, room_id: 1, user_id: 2, guest_name: 'Andres Villanueva', guest_email: 'andres.v@email.com', guest_contact: '+63 929 345 6789', guest_id_type: 'passport', check_in: '2025-01-30', check_out: '2025-02-02', adults: 2, children: 0, nights: 3, price_per_night: 6500.00, total_amount: 19500.00, special_requests: 'Quiet room', status: 'pending', payment_method: 'on_arrival', payment_status: 'unpaid', created_at: '2025-01-07T11:20:00' }
];

export function useOwnerBookings() {
  const bookings = ref([...MOCK_BOOKINGS]);
  const loading = ref(false);
  const error = ref(null);

  // Get all bookings
  const getBookings = async () => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    loading.value = false;
    return { success: true, bookings: bookings.value };
  };

  // Get bookings by hotel
  const getBookingsByHotel = async (hotelId) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 400));

    const hotelBookings = bookings.value.filter(b => b.hotel_id === hotelId);
    
    loading.value = false;
    return { success: true, bookings: hotelBookings };
  };

  // Get single booking
  const getBooking = async (id) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300));

    const booking = bookings.value.find(b => b.id === id);
    
    loading.value = false;
    if (booking) {
      return { success: true, booking };
    } else {
      return { success: false, error: 'Booking not found' };
    }
  };

  // Update booking status
  const updateBookingStatus = async (id, status) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 600));

    const index = bookings.value.findIndex(b => b.id === id);
    
    if (index !== -1) {
      bookings.value[index].status = status;
      loading.value = false;
      return { success: true, booking: bookings.value[index], message: 'Booking status updated' };
    } else {
      loading.value = false;
      return { success: false, error: 'Booking not found' };
    }
  };

  // Update payment status
  const updatePaymentStatus = async (id, paymentStatus) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    const index = bookings.value.findIndex(b => b.id === id);
    
    if (index !== -1) {
      bookings.value[index].payment_status = paymentStatus;
      loading.value = false;
      return { success: true, booking: bookings.value[index], message: 'Payment status updated' };
    } else {
      loading.value = false;
      return { success: false, error: 'Booking not found' };
    }
  };

  // Cancel booking
  const cancelBooking = async (id) => {
    return updateBookingStatus(id, 'cancelled');
  };

  // Get booking stats
  const getBookingStats = () => {
    const stats = {
      total: bookings.value.length,
      confirmed: bookings.value.filter(b => b.status === 'confirmed').length,
      pending: bookings.value.filter(b => b.status === 'pending').length,
      checked_in: bookings.value.filter(b => b.status === 'checked_in').length,
      completed: bookings.value.filter(b => b.status === 'completed').length,
      cancelled: bookings.value.filter(b => b.status === 'cancelled').length,
      totalRevenue: bookings.value
        .filter(b => b.payment_status === 'paid')
        .reduce((sum, b) => sum + b.total_amount, 0)
    };
    return stats;
  };

  // Filter bookings
  const filterBookings = (filters) => {
    return bookings.value.filter(booking => {
      if (filters.hotel_id && booking.hotel_id !== filters.hotel_id) return false;
      if (filters.status && booking.status !== filters.status) return false;
      if (filters.payment_status && booking.payment_status !== filters.payment_status) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (!booking.booking_ref.toLowerCase().includes(search) &&
            !booking.guest_name.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  };

  // Get upcoming bookings
  const getUpcomingBookings = () => {
    const today = new Date();
    return bookings.value.filter(b => {
      const checkIn = new Date(b.check_in);
      return checkIn >= today && (b.status === 'confirmed' || b.status === 'pending');
    });
  };

  return {
    bookings,
    loading,
    error,
    getBookings,
    getBookingsByHotel,
    getBooking,
    updateBookingStatus,
    updatePaymentStatus,
    cancelBooking,
    getBookingStats,
    filterBookings,
    getUpcomingBookings
  };
}