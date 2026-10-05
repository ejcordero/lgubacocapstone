import { ref, computed } from 'vue';

// Hardcoded rooms data (replace with API call later)
const MOCK_ROOMS = [
  { id: 1, hotel_id: 1, room_type: 'Deluxe Suite', capacity: 2, price_per_night: 6500.00, total_count: 12, image: 'https://picsum.photos/seed/deluxesuite/400/250', description: 'Spacious suite with ocean view', amenities: JSON.stringify(['WiFi', 'AC', 'TV', 'Mini Bar', 'Sea View']), status: 'active', created_at: '2024-08-20T10:00:00' },
  { id: 2, hotel_id: 1, room_type: 'Premium Villa', capacity: 4, price_per_night: 12000.00, total_count: 8, image: 'https://picsum.photos/seed/premiumvilla/400/250', description: 'Luxury villa with private pool', amenities: JSON.stringify(['WiFi', 'AC', 'TV', 'Kitchen', 'Pool', 'Sea View']), status: 'active', created_at: '2024-08-20T10:00:00' },
  { id: 3, hotel_id: 1, room_type: 'Beachfront Suite', capacity: 2, price_per_night: 9500.00, total_count: 10, image: 'https://picsum.photos/seed/beachfront/400/250', description: 'Direct beach access suite', amenities: JSON.stringify(['WiFi', 'AC', 'TV', 'Balcony', 'Beach']), status: 'active', created_at: '2024-08-20T10:00:00' },
  { id: 4, hotel_id: 1, room_type: 'Garden Suite', capacity: 3, price_per_night: 7500.00, total_count: 10, image: 'https://picsum.photos/seed/gardensuite/400/250', description: 'Peaceful garden view suite', amenities: JSON.stringify(['WiFi', 'AC', 'TV', 'Garden View', 'Bathtub']), status: 'active', created_at: '2024-08-20T10:00:00' },
  { id: 5, hotel_id: 1, room_type: 'Honeymoon Suite', capacity: 2, price_per_night: 15000.00, total_count: 8, image: 'https://picsum.photos/seed/honeymoon/400/250', description: 'Romantic suite for couples', amenities: JSON.stringify(['WiFi', 'AC', 'Jacuzzi', 'Sea View']), status: 'active', created_at: '2024-08-20T10:00:00' },
  { id: 6, hotel_id: 2, room_type: 'Standard Room', capacity: 2, price_per_night: 3200.00, total_count: 12, image: 'https://picsum.photos/seed/standard/400/250', description: 'Comfortable standard room', amenities: JSON.stringify(['WiFi', 'AC', 'TV']), status: 'active', created_at: '2024-09-15T14:30:00' },
  { id: 7, hotel_id: 2, room_type: 'Deluxe Room', capacity: 2, price_per_night: 4200.00, total_count: 8, image: 'https://picsum.photos/seed/deluxe/400/250', description: 'Upgraded room with mountain view', amenities: JSON.stringify(['WiFi', 'AC', 'TV', 'Mountain View']), status: 'active', created_at: '2024-09-15T14:30:00' },
  { id: 8, hotel_id: 2, room_type: 'Budget Room', capacity: 1, price_per_night: 1800.00, total_count: 4, image: 'https://picsum.photos/seed/budget/400/250', description: 'Affordable budget option', amenities: JSON.stringify(['WiFi', 'Fan']), status: 'inactive', created_at: '2024-09-15T14:30:00' },
  { id: 9, hotel_id: 3, room_type: 'Family Room', capacity: 4, price_per_night: 5500.00, total_count: 6, image: 'https://picsum.photos/seed/family/400/250', description: 'Spacious room for families', amenities: JSON.stringify(['WiFi', 'AC', 'TV', 'Kitchenette']), status: 'active', created_at: '2024-10-05T09:15:00' },
  { id: 10, hotel_id: 3, room_type: 'Twin Room', capacity: 2, price_per_night: 3800.00, total_count: 5, image: 'https://picsum.photos/seed/twin/400/250', description: 'Room with twin beds', amenities: JSON.stringify(['WiFi', 'AC', 'TV']), status: 'active', created_at: '2024-10-05T09:15:00' },
  { id: 11, hotel_id: 3, room_type: 'Suite', capacity: 2, price_per_night: 4800.00, total_count: 3, image: 'https://picsum.photos/seed/suite/400/250', description: 'Premium suite with sunset view', amenities: JSON.stringify(['WiFi', 'AC', 'TV', 'Bathtub', 'Sunset View']), status: 'active', created_at: '2024-10-05T09:15:00' },
  { id: 12, hotel_id: 3, room_type: 'Standard Room', capacity: 2, price_per_night: 2800.00, total_count: 2, image: 'https://picsum.photos/seed/standard2/400/250', description: 'Basic standard room', amenities: JSON.stringify(['WiFi', 'AC', 'TV']), status: 'active', created_at: '2024-10-05T09:15:00' }
];

export function useOwnerRooms() {
  const rooms = ref([...MOCK_ROOMS]);
  const loading = ref(false);
  const error = ref(null);

  // Get all rooms
  const getRooms = async () => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    loading.value = false;
    return { success: true, rooms: rooms.value };
  };

  // Get rooms by hotel
  const getRoomsByHotel = async (hotelId) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 400));

    const hotelRooms = rooms.value.filter(r => r.hotel_id === hotelId);
    
    loading.value = false;
    return { success: true, rooms: hotelRooms };
  };

  // Get single room
  const getRoom = async (id) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300));

    const room = rooms.value.find(r => r.id === id);
    
    loading.value = false;
    if (room) {
      return { success: true, room };
    } else {
      return { success: false, error: 'Room not found' };
    }
  };

  // Add new room
  const addRoom = async (roomData) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));

    const newRoom = {
      id: rooms.value.length + 1,
      ...roomData,
      status: 'active',
      created_at: new Date().toISOString()
    };

    rooms.value.push(newRoom);
    
    loading.value = false;
    return { success: true, room: newRoom, message: 'Room added successfully' };
  };

  // Update room
  const updateRoom = async (id, updates) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 600));

    const index = rooms.value.findIndex(r => r.id === id);
    
    if (index !== -1) {
      rooms.value[index] = { ...rooms.value[index], ...updates };
      loading.value = false;
      return { success: true, room: rooms.value[index], message: 'Room updated successfully' };
    } else {
      loading.value = false;
      return { success: false, error: 'Room not found' };
    }
  };

  // Delete room
  const deleteRoom = async (id) => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    const index = rooms.value.findIndex(r => r.id === id);
    
    if (index !== -1) {
      rooms.value.splice(index, 1);
      loading.value = false;
      return { success: true, message: 'Room deleted successfully' };
    } else {
      loading.value = false;
      return { success: false, error: 'Room not found' };
    }
  };

  // Get room availability
  const getRoomAvailability = (roomId) => {
    const room = rooms.value.find(r => r.id === roomId);
    if (!room) return null;

    // In real app, this would check bookings
    return {
      total: room.total_count,
      available: Math.floor(room.total_count * 0.7),
      occupied: Math.floor(room.total_count * 0.3)
    };
  };

  // Filter rooms
  const filterRooms = (filters) => {
    return rooms.value.filter(room => {
      if (filters.hotel_id && room.hotel_id !== filters.hotel_id) return false;
      if (filters.status && room.status !== filters.status) return false;
      if (filters.search) {
        const search = filters.search.toLowerCase();
        if (!room.room_type.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  };

  return {
    rooms,
    loading,
    error,
    getRooms,
    getRoomsByHotel,
    getRoom,
    addRoom,
    updateRoom,
    deleteRoom,
    getRoomAvailability,
    filterRooms
  };
}