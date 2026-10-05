import { ref, computed } from 'vue';

export function useOwnerAnalytics() {
  const loading = ref(false);
  const error = ref(null);

  // Hardcoded analytics data
  const getDashboardStats = async () => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 600));

    const stats = {
      totalHotels: 3,
      totalRooms: 74,
      activeBookings: 128,
      monthlyRevenue: 485000,
      avgRating: 4.8,
      occupancyRate: 78.5
    };

    loading.value = false;
    return { success: true, stats };
  };

  // Get revenue data
  const getRevenueData = async () => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 700));

    const revenueData = {
      totalYTD: 2847000,
      monthly: [
        { month: 'Jan', revenue: 320000 },
        { month: 'Feb', revenue: 380000 },
        { month: 'Mar', revenue: 410000 },
        { month: 'Apr', revenue: 390000 },
        { month: 'May', revenue: 450000 },
        { month: 'Jun', revenue: 520000 },
        { month: 'Jul', revenue: 480000 },
        { month: 'Aug', revenue: 510000 },
        { month: 'Sep', revenue: 470000 },
        { month: 'Oct', revenue: 540000 },
        { month: 'Nov', revenue: 490000 },
        { month: 'Dec', revenue: 485000 }
      ],
      byHotel: [
        { hotel: 'Coral Bay Resort', revenue: 1245000 },
        { hotel: 'Mountain View Lodge', revenue: 828000 },
        { hotel: 'Sunset Paradise Inn', revenue: 774000 }
      ]
    };

    loading.value = false;
    return { success: true, data: revenueData };
  };

  // Get booking sources
  const getBookingSources = async () => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    const sources = {
      direct: 42,
      online: 35,
      agency: 15,
      walkin: 8
    };

    loading.value = false;
    return { success: true, sources };
  };

  // Get occupancy data
  const getOccupancyData = async () => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 600));

    const occupancy = {
      current: 78.5,
      byHotel: [
        { hotel: 'Coral Bay Resort', occupancy: 85 },
        { hotel: 'Mountain View Lodge', occupancy: 72 },
        { hotel: 'Sunset Paradise Inn', occupancy: 68 }
      ],
      trend: [
        { month: 'Jan', rate: 65 },
        { month: 'Feb', rate: 68 },
        { month: 'Mar', rate: 72 },
        { month: 'Apr', rate: 70 },
        { month: 'May', rate: 75 },
        { month: 'Jun', rate: 80 },
        { month: 'Jul', rate: 78 },
        { month: 'Aug', rate: 78.5 }
      ]
    };

    loading.value = false;
    return { success: true, data: occupancy };
  };

  // Get performance metrics
  const getPerformanceMetrics = async () => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 550));

    const metrics = {
      avgBookingValue: 8325,
      totalInvoices: 342,
      avgStayDuration: 3.2,
      cancellationRate: 8.5,
      repeatGuestRate: 42
    };

    loading.value = false;
    return { success: true, metrics };
  };

  // Get comparison data (month over month)
  const getComparisonData = async () => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 650));

    const comparison = {
      revenue: { current: 485000, previous: 448000, change: 8.2 },
      bookings: { current: 128, previous: 114, change: 12.5 },
      occupancy: { current: 78.5, previous: 75.3, change: 3.2 },
      avgRating: { current: 4.8, previous: 4.5, change: 0.3 }
    };

    loading.value = false;
    return { success: true, comparison };
  };

  // Get top performing hotels
  const getTopHotels = async () => {
    loading.value = true;
    error.value = null;

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    const topHotels = [
      { name: 'Coral Bay Resort', revenue: 1245000, bookings: 156, rating: 4.9 },
      { name: 'Sunset Paradise Inn', revenue: 774000, bookings: 98, rating: 4.7 },
      { name: 'Mountain View Lodge', revenue: 828000, bookings: 87, rating: 4.6 }
    ];

    loading.value = false;
    return { success: true, hotels: topHotels };
  };

  return {
    loading,
    error,
    getDashboardStats,
    getRevenueData,
    getBookingSources,
    getOccupancyData,
    getPerformanceMetrics,
    getComparisonData,
    getTopHotels
  };
}