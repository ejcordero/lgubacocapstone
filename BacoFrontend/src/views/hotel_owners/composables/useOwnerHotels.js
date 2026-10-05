import { ref, computed } from 'vue';

// Hardcoded hotels data (replace with API call later)
const MOCK_HOTELS = [
  {
    id: 1,
    owner_id: 42,
    name: 'Coral Bay Resort',
    location: 'Brgy. San Juan, Puerto Galera',
    base_price: 5500.00,
    rating: 4.9,
    available: 1,
    image: 'https://picsum.photos/seed/coralbay22/400/250',
    description: 'Luxury beachfront resort with stunning ocean views and world-class amenities',
    contact: '+63 917 123 4567',
    email: 'info@coralbay.ph',
    type: 'Resort',
    amenities: JSON.stringify(['WiFi', 'Pool', 'Restaurant', 'Beach Access', 'Spa', 'Gym']),
    gallery: JSON.stringify(['img1.jpg', 'img2.jpg', 'img3.jpg']),
    room_types: JSON.stringify(['Deluxe Suite', 'Premium Villa', 'Standard Room', 'Honeymoon Suite']),
    created_at: '2024-08-20T10:00:00'
  },
  {
    id: 2,
    owner_id: 42,
    name: 'Mountain View Lodge',
    location: 'Sitio Mangyan, Baco, Oriental Mindoro',
    base_price: 3200.00,
    rating: 4.6,
    available: 1,
    image: 'https://picsum.photos/seed/mtnview33/400/250',
    description: 'Cozy mountain lodge perfect for nature lovers and adventure seekers',
    contact: '+63 918 234 5678',
    email: 'info@mountainview.ph',
    type: 'Lodge',
    amenities: JSON.stringify(['WiFi', 'Restaurant', 'Mountain View', 'Hiking Trails', 'Campfire Area']),
    gallery: JSON.stringify(['img1.jpg', 'img2.jpg']),
    room_types: JSON.stringify(['Standard Room', 'Deluxe Room', 'Budget Room']),
    created_at: '2024-09-15T14:30:00'
  },
  {
    id: 3,
    owner_id: 42,
    name: 'Sunset Paradise Inn',
    location: 'Poblacion, Calapan City',
    base_price: 2800.00,
    rating: 4.7,
    available: 1,
    image: 'https://picsum.photos/seed/sunsetinn44/400/250',
    description: 'Charming inn in the heart of the city with breathtaking sunset views',
    contact: '+63 919 345 6789',
    email: 'info@sunsetparadise.ph',
    type: 'Inn',
    amenities: JSON.stringify(['WiFi', 'Restaurant', 'Parking', 'Rooftop Bar', 'City View']),
    gallery: JSON.stringify(['img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg']),
    room_types: JSON.stringify(['Family Room', 'Twin Room', 'Suite', 'Standard Room']),
    created_at: '2024-10-05T09:15:00'
  }
];

export function useOwnerHotels() {
  const hotels = ref([...MOCK_HOTELS]);
  const loading = ref(false);
  const error = ref(null);

  // Get all hotels for the owner
  const getHotels = async () => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    loading.value = false;
    return { success: true, hotels: hotels.value };
  };

  // Get single hotel
  const getHotel = async (id) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300));

    const hotel = hotels.value.find(h => h.id === id);
    
    loading.value = false;
    if (hotel) {
      return { success: true, hotel };
    } else {
      return { success: false, error: 'Hotel not found' };
    }
  };

  // Add new hotel
  const addHotel = async (hotelData) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    const newHotel = {
      id: hotels.value.length + 1,
      owner_id: 42,
      ...hotelData,
      rating: 0,
      available: 1,
      created_at: new Date().toISOString()
    };

    hotels.value.push(newHotel);
    
    loading.value = false;
    return { success: true, hotel: newHotel, message: 'Hotel added successfully' };
  };

  // Update hotel
  const updateHotel = async (id, updates) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));

    const index = hotels.value.findIndex(h => h.id === id);
    
    if (index !== -1) {
      hotels.value[index] = { ...hotels.value[index], ...updates };
      loading.value = false;
      return { success: true, hotel: hotels.value[index], message: 'Hotel updated successfully' };
    } else {
      loading.value = false;
      return { success: false, error: 'Hotel not found' };
    }
  };

  // Delete hotel
  const deleteHotel = async (id) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 600));

    const index = hotels.value.findIndex(h => h.id === id);
    
    if (index !== -1) {
      hotels.value.splice(index, 1);
      loading.value = false;
      return { success: true, message: 'Hotel deleted successfully' };
    } else {
      loading.value = false;
      return { success: false, error: 'Hotel not found' };
    }
  };

  // Get hotel stats
  const getHotelStats = (hotelId) => {
    const hotel = hotels.value.find(h => h.id === hotelId);
    if (!hotel) return null;

    // In real app, this would fetch from backend
    return {
      totalRooms: 48,
      totalBookings: 67,
      revenue: '₱245K',
      occupancyRate: 78
    };
  };

  // Filter hotels
  const filteredHotels = computed(() => {
    return hotels.value;
  });

  // Search hotels
  const searchHotels = (query) => {
    return hotels.value.filter(h => 
      h.name.toLowerCase().includes(query.toLowerCase()) ||
      h.location.toLowerCase().includes(query.toLowerCase())
    );
  };

  return {
    hotels,
    loading,
    error,
    filteredHotels,
    getHotels,
    getHotel,
    addHotel,
    updateHotel,
    deleteHotel,
    getHotelStats,
    searchHotels
  };
}