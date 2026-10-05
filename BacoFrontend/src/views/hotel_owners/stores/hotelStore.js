import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useHotelStore = defineStore('hotel', () => {
  // State
  const hotels = ref([]);
  const currentHotel = ref(null);
  const loading = ref(false);
  const error = ref(null);

  // Hardcoded hotels data
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

  // Initialize with mock data
  hotels.value = [...MOCK_HOTELS];

  // Getters
  const activeHotels = computed(() => hotels.value.filter(h => h.available === 1));
  const hotelCount = computed(() => hotels.value.length);
  const totalRooms = computed(() => {
    // This would normally come from rooms store
    return hotels.value.reduce((sum, h) => sum + (h.rooms || 0), 0);
  });

  const getHotelById = (id) => {
    return hotels.value.find(h => h.id === id);
  };

  const searchHotels = (query) => {
    if (!query) return hotels.value;
    const lowerQuery = query.toLowerCase();
    return hotels.value.filter(h => 
      h.name.toLowerCase().includes(lowerQuery) ||
      h.location.toLowerCase().includes(lowerQuery) ||
      h.type.toLowerCase().includes(lowerQuery)
    );
  };

  // Actions
  const fetchHotels = async () => {
    loading.value = true;
    error.value = null;

    await new Promise(resolve => setTimeout(resolve, 500));

    loading.value = false;
    return { success: true, hotels: hotels.value };
  };

  const fetchHotel = async (id) => {
    loading.value = true;
    error.value = null;

    await new Promise(resolve => setTimeout(resolve, 300));

    const hotel = hotels.value.find(h => h.id === id);
    
    loading.value = false;
    if (hotel) {
      currentHotel.value = hotel;
      return { success: true, hotel };
    } else {
      return { success: false, error: 'Hotel not found' };
    }
  };

  const addHotel = async (hotelData) => {
    loading.value = true;
    error.value = null;

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

  const updateHotel = async (id, updates) => {
    loading.value = true;
    error.value = null;

    await new Promise(resolve => setTimeout(resolve, 800));

    const index = hotels.value.findIndex(h => h.id === id);
    
    if (index !== -1) {
      hotels.value[index] = { ...hotels.value[index], ...updates };
      if (currentHotel.value?.id === id) {
        currentHotel.value = hotels.value[index];
      }
      loading.value = false;
      return { success: true, hotel: hotels.value[index], message: 'Hotel updated successfully' };
    } else {
      loading.value = false;
      return { success: false, error: 'Hotel not found' };
    }
  };

  const deleteHotel = async (id) => {
    loading.value = true;
    error.value = null;

    await new Promise(resolve => setTimeout(resolve, 600));

    const index = hotels.value.findIndex(h => h.id === id);
    
    if (index !== -1) {
      hotels.value.splice(index, 1);
      if (currentHotel.value?.id === id) {
        currentHotel.value = null;
      }
      loading.value = false;
      return { success: true, message: 'Hotel deleted successfully' };
    } else {
      loading.value = false;
      return { success: false, error: 'Hotel not found' };
    }
  };

  const setCurrentHotel = (hotel) => {
    currentHotel.value = hotel;
  };

  const clearCurrentHotel = () => {
    currentHotel.value = null;
  };

  return {
    // State
    hotels,
    currentHotel,
    loading,
    error,
    // Getters
    activeHotels,
    hotelCount,
    totalRooms,
    getHotelById,
    searchHotels,
    // Actions
    fetchHotels,
    fetchHotel,
    addHotel,
    updateHotel,
    deleteHotel,
    setCurrentHotel,
    clearCurrentHotel
  };
});