<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
// Lucide icons (weather card)
import {
  Sun, CloudSun, Cloud, CloudRain, CloudLightning,
  Wind, Droplets, Thermometer, Sunrise, Sunset, MapPin
} from 'lucide-vue-next';
// Single source of truth — always ends in /api, reads VITE_API_URL
import StatCard from '../components/ui/StatCard.vue';
import StatusBadge from '../components/ui/StatusBadge.vue';
import { API } from '@/api';

// ── Config ──────────────────────────────────────────────────────────
const TOKEN_KEY = 'baco_owner_token';
const DATA_KEY = 'baco_owner_data';

const router = useRouter();

// ── State ───────────────────────────────────────────────────────────
const loading = ref(true);
const loadError = ref('');
const owner = ref(null);
const hotel = ref(null);
const bookings = ref([]);
const stats = ref(null);
const inquiries = ref([]);

// Time-of-day greeting
const greetingText = ref('Good morning');

// ── Weather state ───────────────────────────────────────────────────
const weather = ref(null);
const weatherLoading = ref(true);
// null = collapsed (default: 7-day view only); a number = that day is expanded
const selectedDayIndex = ref(null);

const weatherIconMap = {
  0: { label: 'Clear', icon: Sun, color: '#FFB300' },
  1: { label: 'Mostly Clear', icon: Sun, color: '#FFB300' },
  2: { label: 'Partly Cloudy', icon: CloudSun, color: '#78909C' },
  3: { label: 'Overcast', icon: Cloud, color: '#90A4AE' },
  45: { label: 'Foggy', icon: Cloud, color: '#90A4AE' },
  48: { label: 'Foggy', icon: Cloud, color: '#90A4AE' },
  51: { label: 'Light Drizzle', icon: CloudRain, color: '#4FC3F7' },
  53: { label: 'Drizzle', icon: CloudRain, color: '#4FC3F7' },
  55: { label: 'Heavy Drizzle', icon: CloudRain, color: '#29B6F6' },
  61: { label: 'Light Rain', icon: CloudRain, color: '#4FC3F7' },
  63: { label: 'Rain', icon: CloudRain, color: '#29B6F6' },
  65: { label: 'Heavy Rain', icon: CloudRain, color: '#0288D1' },
  80: { label: 'Rain Showers', icon: CloudRain, color: '#29B6F6' },
  81: { label: 'Rain Showers', icon: CloudRain, color: '#0288D1' },
  82: { label: 'Heavy Showers', icon: CloudRain, color: '#0277BD' },
  95: { label: 'Thunderstorm', icon: CloudLightning, color: '#7E57C2' },
  96: { label: 'Storm + Hail', icon: CloudLightning, color: '#7E57C2' },
};

const weatherInfo = (code) => weatherIconMap[code] || { label: 'N/A', icon: CloudSun, color: '#78909C' };

const weatherDays = computed(() => {
  if (!weather.value?.daily) return []
  const d = weather.value.daily
  return (d.time || []).map((date, i) => ({
    date,
    day: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
    fullDate: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
    high: d.temperature_2m_max?.[i],
    low: d.temperature_2m_min?.[i],
    apparentMax: d.apparent_temperature_max?.[i],
    apparentMin: d.apparent_temperature_min?.[i],
    code: d.weather_code?.[i],
    pop: d.precipitation_probability_max?.[i],
    rainSum: d.precipitation_sum?.[i],
    rainHours: d.precipitation_hours?.[i],
    windMax: d.wind_speed_10m_max?.[i],
    gustsMax: d.wind_gusts_10m_max?.[i],
    windDir: d.wind_direction_10m_dominant?.[i],
    uvMax: d.uv_index_max?.[i],
    sunrise: d.sunrise?.[i],
    sunset: d.sunset?.[i],
  }))
})

const selectedDay = computed(() => weatherDays.value[selectedDayIndex.value] ?? null)

// Click a day → expand it (details + hourly strip). Click it again → collapse.
const toggleDay = (i) => {
  selectedDayIndex.value = selectedDayIndex.value === i ? null : i
}

// Next 12 hours (rain chance + temperature). Hourly times are Manila
// wall-clock from the API; filtering by "now" assumes a PH-browser clock,
// which is correct for this app's audience. The 1-hour grace window also
// covers cached payloads that are up to 10 minutes old.
const weatherHours = computed(() => {
  if (!weather.value?.hourly) return []
  const h = weather.value.hourly
  const cutoff = Date.now() - 60 * 60 * 1000
  return (h.time || [])
    .map((t, i) => ({
      time: t,
      label: new Date(t).toLocaleTimeString('en-US', { hour: 'numeric' }),
      pop: h.precipitation_probability?.[i] ?? 0,
      temp: Math.round(h.temperature_2m?.[i] ?? 0),
    }))
    .filter(hr => new Date(hr.time).getTime() >= cutoff)
    .slice(0, 12)
})

const currentWeather = computed(() => {
  if (!weather.value?.current) return null
  const c = weather.value.current
  const info = weatherInfo(c.weather_code)
  return { ...c, label: info.label, icon: info.icon, color: info.color }
})

const fetchWeather = async () => {
  weatherLoading.value = true
  try {
    const res = await fetch(`${API}/weather`)
    if (res.ok) weather.value = await res.json()
  } catch { /* non-critical */ }
  finally { weatherLoading.value = false }
}

// ── Weather formatting helpers ──────────────────────────────────────
// fmtNum renders a dash for missing API fields instead of "NaN".
const fmtNum = (v) => (v == null ? '—' : Math.round(Number(v)))

// Convert degrees → 16-point compass (Open-Meteo sends degrees from North)
const windCompass = (deg) => {
  if (deg == null) return '—'
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return dirs[Math.round(Number(deg) / 22.5) % 16]
}

// UV Index levels per WHO scale (Open-Meteo uv_index_max, unitless)
const uvInfo = (uv) => {
  if (uv == null) return { label: 'N/A', color: '#90A4AE' }
  const v = Number(uv)
  if (v < 3)  return { label: 'Low',       color: '#4CAF50' }
  if (v < 6)  return { label: 'Moderate',  color: '#FFB300' }
  if (v < 8)  return { label: 'High',      color: '#FB8C00' }
  if (v < 11) return { label: 'Very High', color: '#E53935' }
  return { label: 'Extreme', color: '#8E24AA' }
}

// Open-Meteo sunrise/sunset are Manila wall-clock ISO strings
// ("2026-09-21T05:36") — show the clock time directly.
const fmtSun = (iso) => {
  if (!iso) return '—'
  const t = String(iso).split('T')[1] || ''
  const [h, m] = t.split(':').map(Number)
  if (isNaN(h)) return '—'
  const ap = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m ?? 0).padStart(2, '0')} ${ap}`
}

// ── Auth helpers ────────────────────────────────────────────────────
const authHeaders = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
};

const handleAuthError = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(DATA_KEY);
  router.push('/owner/login');
};

// ── Formatters ──────────────────────────────────────────────────────
const formatDate = (d) => {
  if (!d) return '—';
  // Date-only strings ("2026-01-05") are parsed as UTC by default, which can
  // render the previous day west of PH. Pin to local midnight before formatting.
  return new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
};

const timeAgo = (d) => {
  if (!d) return '';
  const diffSec = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(d);
};

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH');

const pesoShort = (n) => {
  n = Number(n || 0);
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(n);
};

// ── Load dashboard data ─────────────────────────────────────────────
const loadDashboard = async () => {
  loading.value = true;
  loadError.value = '';
  try {
    const headers = authHeaders();
    if (!headers) return handleAuthError();

    const [meRes, bookingsRes, hotelRes, inquiriesRes] = await Promise.allSettled([
      fetch(`${API}/owner/auth/me`, { headers }),
      fetch(`${API}/owner/bookings`, { headers }),
      fetch(`${API}/owner/hotel`, { headers }),
      fetch(`${API}/owner/inquiries`, { headers }),
    ]);

    // Profile is critical — auth errors here end the session
    if (meRes.status === 'fulfilled') {
      if (meRes.value.status === 401 || meRes.value.status === 403) return handleAuthError();
      if (meRes.value.ok) owner.value = await meRes.value.json();
    }
    if (!owner.value) throw new Error('Failed to load your account.');

    // Non-critical data — fail gracefully to zeros/empties
    if (bookingsRes.status === 'fulfilled' && bookingsRes.value.ok) {
      const d = await bookingsRes.value.json();
      bookings.value = d.bookings || [];
      stats.value = d.stats || null;
    }
    if (hotelRes.status === 'fulfilled' && hotelRes.value.ok) {
      const d = await hotelRes.value.json();
      hotel.value = d.hotel || null;
    }
    if (inquiriesRes.status === 'fulfilled' && inquiriesRes.value.ok) {
      inquiries.value = await inquiriesRes.value.json();
    }

    syncOwnerData();
  } catch (e) {
    loadError.value = e.message || 'Something went wrong.';
  } finally {
    loading.value = false;
  }
};

// Keeps the sidebar identity in sync
const syncOwnerData = () => {
  if (!owner.value) return;
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify({
      firstName: owner.value.firstName,
      lastName: owner.value.lastName,
      businessName: owner.value.businessName
    }));
    window.dispatchEvent(new Event('baco-owner-updated'));
  } catch (e) { /* non-critical */ }
};

// ── Derived data ────────────────────────────────────────────────────
const firstName = computed(() => owner.value?.firstName || owner.value?.businessName || 'Owner');

const initials = computed(() => {
  const f = (owner.value?.firstName || '').charAt(0);
  const l = (owner.value?.lastName || '').charAt(0);
  return `${f}${l}`.toUpperCase() || 'OW';
});

const ownerRef = computed(() =>
  owner.value ? `#OWN-${String(owner.value.id).padStart(4, '0')}` : '—'
);

const roomUnits = computed(() =>
  hotel.value ? (hotel.value.rooms || []).reduce((sum, r) => sum + (r.totalCount || 0), 0) : 0
);

// ══════════════════════════════════════════════════════════════════════════
// HOTEL OPERATIONS
//
// Every figure here is arithmetic a front desk already does by hand at the
// start of a shift, computed from the bookings and room inventory the API
// already returns. Nothing is invented and no new endpoint is needed.
//
// bookingType matters more than it looks. Entrance tickets are not stays, so
// counting them as occupied rooms would overstate occupancy, and folding
// their revenue into ADR would overstate the room rate.
// ══════════════════════════════════════════════════════════════════════════

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// The stay has to actually occupy a room: an accommodation, not an entrance
// ticket, and still open. checkOut is EXCLUSIVE, which is how a hotel night
// works -- a guest departing today has freed the room for tonight, so they are
// not counted in-house.
const inHouseBookings = computed(() => {
  const t = todayISO();
  return bookings.value.filter(b =>
    b.status === 'confirmed' &&
    b.bookingType === 'accommodation' &&
    b.checkIn <= t && b.checkOut > t
  );
});

const occupiedRooms = computed(() => inHouseBookings.value.length);
const roomsFree = computed(() => Math.max(0, roomUnits.value - occupiedRooms.value));

const occupancyPct = computed(() =>
  roomUnits.value > 0 ? Math.round((occupiedRooms.value / roomUnits.value) * 100) : 0
);

// Confirmed bookings whose check-in or check-out falls on today's date.
const confirmedOn = (field) => {
  const t = todayISO();
  return bookings.value.filter(b => b.status === 'confirmed' && b[field] === t);
};
const todaysArrivals = computed(() => confirmedOn('checkIn'));
const todaysDepartures = computed(() => confirmedOn('checkOut'));
const pendingBookings = computed(() => bookings.value.filter(b => b.status === 'pending'));
const paxOf = (list) => list.reduce((s, b) => s + (b.pax || 0), 0);
const arrivalsPax = computed(() => paxOf(todaysArrivals.value));
const departuresPax = computed(() => paxOf(todaysDepartures.value));

// ADR and RevPAR are accommodation-only. ADR is revenue per room-night SOLD;
// RevPAR is that same revenue over rooms AVAILABLE. The gap between the two
// is the pricing decision, so they are not interchangeable and are shown
// separately.
const countsTowardRevenue = (b, type) =>
  b.bookingType === type && (b.status === 'confirmed' || b.status === 'completed');

const accommodationRevenue = computed(() =>
  bookings.value.filter(b => countsTowardRevenue(b, 'accommodation')).reduce((s, b) => s + (b.totalAmount || 0), 0)
);
const entranceRevenue = computed(() =>
  bookings.value.filter(b => countsTowardRevenue(b, 'entrance')).reduce((s, b) => s + (b.totalAmount || 0), 0)
);
const roomNightsSold = computed(() =>
  bookings.value.filter(b => countsTowardRevenue(b, 'accommodation')).reduce((s, b) => s + (b.nights || 0), 0)
);
const adr = computed(() =>
  roomNightsSold.value > 0 ? accommodationRevenue.value / roomNightsSold.value : 0
);
const revpar = computed(() =>
  roomUnits.value > 0 ? accommodationRevenue.value / roomUnits.value : 0
);

// Room inventory, per room type, straight from the hotel record.
const roomBoard = computed(() =>
  (hotel.value?.rooms || []).map(r => ({
    id: r.id,
    name: r.name || r.type,
    type: r.type,
    total: r.totalCount || 0,
    price: r.price || 0,
    capacity: r.capacity || 0
  }))
);

// The hero photograph. The property's own image is the meaningful one -- an
// owner recognises their own building, and it is already attached to the
// listing. The tourism cover stands in before a listing exists, and the
// onerror handler covers a filename that has since been deleted, so the hero
// degrades to the cover rather than to a grey rectangle.
const FALLBACK_HERO = '/images/cover-tourism-img.jpg';
const heroImage = computed(() => hotel.value?.image || FALLBACK_HERO);
const heroBroken = ref(false);

// If the hotel image changes (new upload), un-latch the broken-image flag so
// the new src gets a chance instead of staying pinned to the fallback.
watch(heroImage, () => { heroBroken.value = false; });

// Revenue mix as a share of the combined total. Guarded against a zero
// denominator, which is the real state for a brand new listing and would
// otherwise render NaN% across the bar.
const mixTotal = computed(() => accommodationRevenue.value + entranceRevenue.value);
const mixPct = (which) => {
  const v = which === 'accom' ? accommodationRevenue.value : entranceRevenue.value;
  return mixTotal.value > 0 ? Math.round((v / mixTotal.value) * 100) : 0;
};

// A short label so a manifest row is scannable: what the guest booked.
const stayLabel = (b) => (b.bookingType === 'accommodation' ? b.roomName : b.feeName) || '\u2014';
const stayKind = (b) => (b.bookingType === 'accommodation' ? 'Stay' : 'Entrance');

const hasHotel = computed(() => !!hotel.value);
const isPublished = computed(() => !!hotel.value?.published);

const statCards = computed(() => [
  { label: 'Room Units', value: roomUnits.value, icon: 'fa-door-open', color: '#07DBF2',
    change: hasHotel.value ? `${(hotel.value.rooms || []).length} room type${(hotel.value.rooms || []).length === 1 ? '' : 's'}` : 'No listing yet', up: true },
  { label: 'Total Bookings', value: stats.value?.total ?? 0, icon: 'fa-calendar-check', color: '#B0D91E',
    change: `${stats.value?.pending ?? 0} pending · ${stats.value?.confirmed ?? 0} confirmed`, up: true },
  { label: 'Total Revenue', value: pesoShort(stats.value?.revenue), prefix: '₱', icon: 'fa-peso-sign', color: '#F2B807',
    change: `${stats.value?.entrance ?? 0} entrance · ${stats.value?.accommodation ?? 0} stays`, up: true },
  { label: "Today's Visitors", value: stats.value?.todayVisitors ?? 0, icon: 'fa-users', color: '#D9B384',
    change: `${stats.value?.todayArrivals ?? 0} arrivals · ${stats.value?.todayDepartures ?? 0} departures`, up: true },
  { label: 'Review Rating', value: hotel.value?.avgRating ?? '—', icon: 'fa-star', color: '#D9B384',
    suffix: hotel.value?.avgRating != null ? '★' : '',
    change: hotel.value?.avgRating != null ? `${hotel.value.reviewCount} review${hotel.value.reviewCount === 1 ? '' : 's'} · live` : 'No reviews yet', up: true },
]);

// Verification steps derived from REAL account state
const verificationSteps = computed(() => {
  const hasId = !!owner.value?.validIdUrl;
  const approved = owner.value?.status === 'active';
  const steps = [
    { title: 'Account Created', desc: 'Registration completed', done: true },
    { title: 'LGU Approval', desc: approved ? 'Approved by LGU Baco Tourism Office' : 'Awaiting verification', done: approved },
    { title: 'Valid ID on File', desc: hasId ? 'Government ID uploaded' : 'Upload your ID in Profile', done: hasId },
    { title: hasHotel.value ? 'Accommodation Listed' : 'Create Accommodation', desc: hasHotel.value ? hotel.value.name : 'No listing created yet', done: hasHotel.value },
    { title: 'Published to Tourists', desc: isPublished.value ? 'Live and bookable' : (hasHotel.value ? 'Awaiting LGU publication' : '—'), done: isPublished.value },
  ];
  const firstOpen = steps.findIndex(s => !s.done);
  steps.forEach((s, i) => { s.active = i === firstOpen; });
  return steps;
});

// Recent activity built from real bookings + new inquiries
const activities = computed(() => {
  const items = [];
  const statusMap = {
    pending:   { icon: 'fa-calendar-plus',  color: '#F2B807', verb: 'New booking received' },
    confirmed: { icon: 'fa-circle-check',   color: '#B0D91E', verb: 'Booking confirmed' },
    completed: { icon: 'fa-flag-checkered', color: '#07DBF2', verb: 'Stay completed' },
    cancelled: { icon: 'fa-ban',            color: '#D9B384', verb: 'Booking cancelled' },
    rejected:  { icon: 'fa-circle-xmark',   color: '#F20707', verb: 'Booking declined' },
    no_show:   { icon: 'fa-user-slash',     color: '#D9B384', verb: 'Marked as no-show' },
  };
  for (const b of bookings.value.slice(0, 10)) {
    const m = statusMap[b.status] || statusMap.pending;
    const kind = b.bookingType === 'entrance' ? 'Entrance' : 'Stay';
    items.push({
      icon: m.icon, color: m.color,
      title: `${m.verb} — ${b.id}`,
      desc: `${kind} · ${b.guestName}${b.totalAmount ? ` · ${peso(b.totalAmount)}` : ''}`,
      time: timeAgo(b.createdAt),
      ts: new Date(b.createdAt).getTime() || 0,
    });
  }
  for (const q of inquiries.value) {
    if (q.status !== 'new') continue;
    items.push({
      icon: 'fa-comment-dots', color: '#07DBF2',
      title: `New inquiry from ${q.name}`,
      desc: (q.message || '').slice(0, 70),
      time: timeAgo(q.created_at),
      ts: new Date(q.created_at).getTime() || 0,
    });
  }
  return items.sort((a, b) => b.ts - a.ts).slice(0, 6);
});

// Quick actions (dock) — unique destinations only, no sidebar duplicates
const quickActions = [
  { icon: 'fa-user-edit',      label: 'Edit Profile', desc: 'Your details and permit', route: '/owner/profile' },
  { icon: 'fa-hotel',          label: 'My Resort',    desc: 'Listing and photos',      route: '/owner/hotels' },
  { icon: 'fa-door-open',      label: 'Room Types',   desc: 'Rates and availability',  route: '/owner/rooms' },
  { icon: 'fa-calendar-check', label: 'Bookings',     desc: 'Arrivals and departures', route: '/owner/bookings' },
  { icon: 'fa-ticket',         label: 'Fees',         desc: 'Entrance pricing',        route: '/owner/entrance-fees' },
  { icon: 'fa-chart-line',     label: 'Revenue',      desc: 'Performance over time',   route: '/owner/revenue' },
  { icon: 'fa-star',           label: 'Reviews',      desc: 'What guests said',        route: '/owner/oreviews' },
  { icon: 'fa-comment-dots',   label: 'Inquiries',    desc: 'Enquiries from travellers', route: '/owner/inquiries' },
];

// ── Actions ─────────────────────────────────────────────────────────
const viewId = () => {
  if (owner.value?.validIdUrl) window.open(owner.value.validIdUrl, '_blank', 'noopener');
};

const exportCsv = () => {
  if (bookings.value.length === 0) return;
  const rows = [['Ref', 'Type', 'Guest', 'Email', 'Contact', 'Check-in', 'Check-out', 'Nights', 'Pax', 'Amount', 'Status', 'Payment', 'Created']];
  for (const b of bookings.value) {
    rows.push([
      b.id, b.bookingType, b.guestName, b.guestEmail, b.guestContact,
      b.checkIn, b.checkOut, b.nights, b.pax, b.totalAmount,
      b.status, b.paymentStatus, b.createdAt ? new Date(b.createdAt).toISOString() : '',
    ]);
  }
  // Prefix formula-triggering cells (=, +, -, @) so spreadsheet apps treat
  // them as text — quoting alone does not stop CSV formula injection.
  const csvSafe = (v) => (typeof v === 'string' && /^[=+@-]/.test(v) ? `'${v}` : v);
  const csv = rows.map(r => r.map(v => `"${String(csvSafe(v) ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `baco-owner-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

// ── Init: set greeting, then load data ──────────────────────────────
onMounted(() => {
  const h = new Date().getHours();
  if (h >= 12 && h < 17) greetingText.value = 'Good afternoon';
  else if (h >= 17) greetingText.value = 'Good evening';
  fetchWeather();
  loadDashboard();
});
</script>

<template>
  <div class="dashboard">
    <!-- Loading state -->
    <div v-if="loading" class="state-box">
      <div class="spinner"></div>
      <p>Loading your dashboard…</p>
    </div>

    <!-- Error state -->
    <div v-else-if="loadError" class="state-box error">
      <i class="fas fa-triangle-exclamation"></i>
      <p>{{ loadError }}</p>
      <button class="btn-secondary" @click="loadDashboard"><i class="fas fa-rotate-right"></i>Retry</button>
    </div>

    <template v-else>
      <!-- Page title -->
      <div class="page-title">
        <div>
          <h1>{{ greetingText }}, <span>{{ firstName }}</span></h1>
          <p>Here is what is happening with your property today.</p>
        </div>
        <div class="title-actions">
          <button class="btn-secondary" :disabled="bookings.length === 0" @click="exportCsv">
            <i class="fas fa-download"></i>Export
          </button>
        </div>
      </div>

      <!-- HERO
           Deliberately NOT using the global photo-hero utility classes: this
           hero owns every rule it needs (see the PHOTO HERO style section),
           so no outside stylesheet can crop or resize the photograph. -->
      <section class="hero-banner">
        <img
          class="hero-img"
          :alt="hasHotel ? hotel.name : 'Baco, Oriental Mindoro'"
          @error="heroBroken = true"
          :src="heroBroken ? FALLBACK_HERO : heroImage"
        />
        <div class="hero-scrim"></div>

        <div class="hero-content">
          <div class="hero-eyebrow">
            {{ (hasHotel && hotel.location) || 'Baco, Oriental Mindoro' }}
          </div>
          <h1 class="hero-heading">
            {{ hasHotel ? hotel.name : (owner.businessName || 'Your Property') }}
          </h1>
          <p class="hero-sub">
            <template v-if="hasHotel">
              {{ isPublished ? 'Live and bookable' : 'Awaiting LGU publication' }}
            </template>
            <template v-else>No accommodation listing yet</template>
          </p>

          <!-- Occupancy on the hero: it is the one figure that decides what the
               rest of the shift looks like, so it belongs on the photograph. -->
          <div class="hero-occ">
            <div class="hero-occ-val">{{ occupancyPct }}<span class="pct">%</span></div>
            <div class="hero-occ-meta">
              <div class="hero-occ-label">Occupancy tonight</div>
              <div class="hero-occ-sub">
                {{ occupiedRooms }} of {{ roomUnits }} rooms
                <span v-if="roomUnits > 0">&middot; {{ roomsFree }} free</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- WEATHER — sits right after the hero -->
      <section class="section-block">
        <div class="section-header">
          <div>
            <h2 class="section-title">Weather in Baco</h2>
            <p class="section-sub">Conditions on the ground today</p>
          </div>
        </div>
        <div class="weather-card">
          <div v-if="weatherLoading" class="weather-loading">
            <div class="wl-spinner"></div>
            <p>Checking the weather in Baco…</p>
          </div>

          <div v-else-if="currentWeather" class="weather-body">
            <div class="weather-main-row">
              <div class="weather-now">
                <div class="wrn-icon" :style="{ color: currentWeather.color, background: currentWeather.color + '1a' }">
                  <component :is="currentWeather.icon" :size="34" />
                </div>
                <div class="wrn-info">
                  <div class="wrn-temp">{{ fmtNum(currentWeather.temperature_2m) }}<sup>°</sup>C</div>
                  <div class="wrn-label">{{ currentWeather.label }}</div>
                  <div class="wrn-loc"><MapPin :size="11" /> Baco, Oriental Mindoro</div>
                </div>
                <div class="wrn-metrics">
                  <div class="wrn-metric"><Thermometer :size="14" /> <span>Feels like {{ fmtNum(currentWeather.apparent_temperature) }}°</span></div>
                  <div class="wrn-metric"><Droplets :size="14" /> <span>Humidity {{ fmtNum(currentWeather.relative_humidity_2m) }}%</span></div>
                  <div class="wrn-metric"><Wind :size="14" /> <span>Wind {{ fmtNum(currentWeather.wind_speed_10m) }} km/h</span></div>
                </div>
              </div>

              <div class="weather-days">
                <div
                  v-for="(day, i) in weatherDays"
                  :key="day.date"
                  class="wday"
                  :class="{ 'wday-active': selectedDayIndex === i }"
                  @click="toggleDay(i)"
                >
                  <div class="wday-name">{{ i === 0 ? 'Today' : day.day }}</div>
                  <component :is="weatherInfo(day.code).icon" :size="20" :style="{ color: weatherInfo(day.code).color }" />
                  <div class="wday-pops" v-if="day.pop != null"><CloudRain :size="10" /> {{ day.pop }}%</div>
                  <div class="wday-temps"><span class="wday-high">{{ fmtNum(day.high) }}°</span><span class="wday-low">{{ fmtNum(day.low) }}°</span></div>
                </div>
              </div>
            </div>

            <div class="wd-hint" v-if="selectedDayIndex === null">Tap any day for full details</div>

            <!-- SELECTED DAY DETAILS -->
            <div class="wday-detail" v-if="selectedDay">
              <div class="wd-head">
                <component :is="weatherInfo(selectedDay.code).icon" :size="28" :style="{ color: weatherInfo(selectedDay.code).color }" />
                <div class="wd-head-info">
                  <div class="wd-title">{{ selectedDay.fullDate }}</div>
                  <div class="wd-cond">{{ weatherInfo(selectedDay.code).label }}</div>
                </div>
                <div class="wd-hilo">
                  <span class="wday-high">{{ fmtNum(selectedDay.high) }}°</span>
                  <span class="wd-hilo-sep">/</span>
                  <span class="wday-low">{{ fmtNum(selectedDay.low) }}°</span>
                </div>
              </div>

              <div class="wd-grid">
                <div class="wd-chip">
                  <div class="wdc-label"><Thermometer :size="11" /> Feels Like</div>
                  <div class="wdc-val">{{ fmtNum(selectedDay.apparentMax) }}° / {{ fmtNum(selectedDay.apparentMin) }}°</div>
                </div>
                <div class="wd-chip">
                  <div class="wdc-label"><CloudRain :size="11" /> Rain Chance</div>
                  <div class="wdc-val">{{ selectedDay.pop != null ? selectedDay.pop + '%' : '—' }}</div>
                </div>
                <div class="wd-chip">
                  <div class="wdc-label"><Droplets :size="11" /> Rain Amount</div>
                  <div class="wdc-val">{{ selectedDay.rainSum != null ? selectedDay.rainSum + ' mm' : '—' }}</div>
                </div>
                <div class="wd-chip">
                  <div class="wdc-label"><CloudRain :size="11" /> Rain Hours</div>
                  <div class="wdc-val">{{ selectedDay.rainHours != null ? selectedDay.rainHours + ' h' : '—' }}</div>
                </div>
                <div class="wd-chip">
                  <div class="wdc-label"><Wind :size="11" /> Wind Max</div>
                  <div class="wdc-val">{{ fmtNum(selectedDay.windMax) }} km/h</div>
                </div>
                <div class="wd-chip">
                  <div class="wdc-label"><Wind :size="11" /> Gusts Up To</div>
                  <div class="wdc-val">{{ fmtNum(selectedDay.gustsMax) }} km/h</div>
                </div>
                <div class="wd-chip">
                  <div class="wdc-label"><Wind :size="11" /> Wind Direction</div>
                  <div class="wdc-val">{{ windCompass(selectedDay.windDir) }}</div>
                </div>
                <div class="wd-chip">
                  <div class="wdc-label"><Sun :size="11" /> UV Index</div>
                  <div class="wdc-val" :style="{ color: uvInfo(selectedDay.uvMax).color }">
                    {{ fmtNum(selectedDay.uvMax) }} · {{ uvInfo(selectedDay.uvMax).label }}
                  </div>
                </div>
                <div class="wd-chip">
                  <div class="wdc-label"><Sunrise :size="11" /> Sunrise</div>
                  <div class="wdc-val">{{ fmtSun(selectedDay.sunrise) }}</div>
                </div>
                <div class="wd-chip">
                  <div class="wdc-label"><Sunset :size="11" /> Sunset</div>
                  <div class="wdc-val">{{ fmtSun(selectedDay.sunset) }}</div>
                </div>
              </div>
            </div>

            <!-- Next 12 hours — revealed on click -->
            <div class="weather-hours" v-if="selectedDay && weatherHours.length">
              <div class="wh-heading">Rain Chance · Next 12 Hours</div>
              <div class="wh-strip">
                <div v-for="hr in weatherHours" :key="hr.time" class="whour" :class="{ 'whour-wet': hr.pop >= 50 }">
                  <span class="wh-time">{{ hr.label }}</span>
                  <span class="wh-pop"><Droplets :size="10" /> {{ hr.pop }}%</span>
                  <span class="wh-temp">{{ hr.temp }}°</span>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="weather-fallback">
            <CloudSun :size="26" />
            <p>Weather data is temporarily unavailable.</p>
          </div>
        </div>
      </section>

      <!-- AT A GLANCE -->
      <section class="section-block">
        <div class="section-header">
          <div>
            <h2 class="section-title">At a Glance</h2>
            <p class="section-sub">The five figures that summarise your property</p>
          </div>
        </div>
        <div class="stats-grid">
          <StatCard v-for="(stat, i) in statCards" :key="i" v-bind="stat" />
        </div>
      </section>

      <!-- QUICK ACTIONS -->
      <section class="section-block">
        <div class="section-header">
          <div>
            <h2 class="section-title">Quick Actions</h2>
            <p class="section-sub">Jump to what you need</p>
          </div>
        </div>
        <div class="actions-grid">
          <button v-for="a in quickActions" :key="a.label" class="flat action-card" @click="router.push(a.route)">
            <i :class="'fas ' + a.icon"></i>
            <span class="ac-label">{{ a.label }}</span>
            <span class="ac-desc">{{ a.desc }}</span>
          </button>
        </div>
      </section>


  
    </template>
  </div>
</template>

<style scoped>
/* ═══════════ PAGE WRAPPER ═══════════
   This page OWNS its box. dashboard-vocabulary.css bleeds .dashboard out by
   --bb-gutter and pads it back — a calculation that assumes the shell's
   padding always equals --bb-gutter. OwnerLayout uses hardcoded gutters
   (28px → 16px → 12px) and reserves space for the fixed bottom nav, so that
   bleed mismatched the shell and let content overhang the viewport on small
   screens. margin: 0 + a fixed self-owned padding removes the assumption
   entirely, the same way HotelManager's .stl does. Scoped specificity
   (.dashboard[data-v-…]) beats the global rule — no !important needed. */
.dashboard {
  margin: 0;
  padding: 22px 24px 44px;
  animation: fadeIn .5s ease;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  box-sizing: border-box;
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

.state-box { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 90px 24px; color: var(--mt); background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; text-align: center; }
.state-box i { font-size: 32px; color: var(--wn); }
.state-box p { margin: 0; font-size: 14px; }
.spinner { width: 36px; height: 36px; border: 3px solid var(--bdr); border-top-color: var(--ac); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.page-title { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 28px; flex-wrap: wrap; gap: 14px; }
.page-title h1 { font-family: 'Unbounded', sans-serif; font-size: clamp(26px, 4vw, 40px); font-weight: 800; color: var(--fg); letter-spacing: -0.04em; margin: 0; line-height: 1.15; }
.page-title h1 span { background: linear-gradient(135deg, var(--ac), var(--wn)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.page-title p { color: var(--mt); font-size: 13px; margin: 6px 0 0; }

.title-actions { display: flex; gap: 8px; }
.btn-secondary { padding: 10px 18px; background: var(--bg2); color: var(--fg2); border: 1px solid var(--bdr); border-radius: 11px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: all .3s; }
.btn-secondary:hover:not(:disabled) { background: var(--card2); transform: translateY(-2px); }
.btn-secondary:disabled { opacity: .5; cursor: not-allowed; }

/* ═══════════ WEATHER IN BACO ═══════════ */
.weather-card { border-radius: 16px; overflow: hidden; border: 1px solid var(--bdr); background: var(--card); margin-bottom: 28px; }
.weather-body { display: flex; flex-direction: column; gap: 0.9rem; background: linear-gradient(135deg, rgba(0,229,255,0.05), rgba(0,255,148,0.04)), var(--card); padding: 1.25rem 1.5rem; }
.weather-main-row { display: flex; align-items: stretch; gap: 1.25rem; flex-wrap: wrap; }
.weather-now { flex: 1; min-width: 260px; display: flex; align-items: center; gap: 1rem; }
.wrn-icon { width: 64px; height: 64px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.wrn-info { display: flex; flex-direction: column; }
.wrn-temp { font-family: var(--bb-font-display); font-size: 2.1rem; font-weight: 800; color: var(--fg); letter-spacing: -0.03em; line-height: 1; }
.wrn-temp sup { font-size: 1.1rem; }
.wrn-label { font-size: 0.9rem; font-weight: 700; color: var(--fg); margin-top: 2px; }
.wrn-loc { display: flex; align-items: center; gap: 3px; font-size: 0.72rem; color: var(--mt); margin-top: 2px; }
.wrn-metrics { display: flex; flex-direction: column; gap: 0.45rem; margin-left: auto; justify-content: center; }
.wrn-metric { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--fg); background: var(--bg2); border: 1px solid var(--bdr); border-radius: 10px; padding: 0.4rem 0.75rem; white-space: nowrap; }
.weather-days { display: flex; gap: 0.5rem; 
align-items: stretch; flex-wrap: wrap; min-width: 120px; max-width: 100%; }
.wday { flex: 1; min-width: 64px; max-width: 100px; display: flex; 
flex-direction: column; align-items: center; gap: 4px; padding: 0.5rem 0.4rem; border-radius: 10px; background: 
var(--bg2); border: 1px solid var(--bdr); text-align: center; cursor: pointer; transition: all 0.18s ease; 
user-select: none; }
.wday:hover { border-color: var(--ac); background: var(--card2); }
.wday-active { background: var(--acs); border-color: var(--ac); }
.wday-name { font-size: 0.7rem; font-weight: 800; color: var(--fg); text-transform: uppercase; letter-spacing: 0.5px; }
.wday-pops { display: flex; align-items: center; gap: 2px; font-size: 0.65rem; color: var(--bb-info, #29B6F6); font-weight: 700; }
.wday-temps { display: flex; gap: 4px; font-size: 0.78rem; }
.wday-high { font-weight: 800; color: var(--fg); }
.wday-low { font-weight: 400; color: var(--mt); }
.wd-hint { font-size: 0.68rem; font-weight: 600; color: var(--mt); text-align: center; letter-spacing: 0.02em; }
.wday-detail { border: 1px solid var(--bdr); border-radius: 12px; background: var(--bg2); padding: 1rem 1.15rem; display: flex; flex-direction: column; gap: 0.85rem; }
.wd-head { display: flex; align-items: center; gap: 0.85rem; }
.wd-head-info { flex: 1; min-width: 0; }
.wd-title { font-family: var(--bb-font-display); font-size: 0.95rem; font-weight: 800; color: var(--fg); letter-spacing: -0.01em; }
.wd-cond { font-size: 0.78rem; color: var(--mt); font-weight: 600; }
.wd-hilo { display: flex; align-items: baseline; gap: 5px; font-size: 1.15rem; font-family: var(--bb-font-display); font-weight: 800; color: var(--fg); }
.wd-hilo .wday-low { font-size: 0.95rem; font-weight: 500; }
.wd-hilo-sep { color: var(--mt); font-weight: 400; }
.wd-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 140px), 1fr)); gap: 0.5rem; max-width: 100%; }
.wd-chip { display: flex; flex-direction: column; gap: 3px; padding: 0.55rem 0.7rem; border-radius: 10px; background: var(--card2, var(--bg2)); border: 1px solid var(--bdr); }
.wdc-label { display: flex; align-items: center; gap: 4px; font-size: 0.6rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--mt); }
.wdc-val { font-size: 0.85rem; font-weight: 800; color: var(--fg); line-height: 1.2; }
.weather-hours { display: flex; flex-direction: column; gap: 0.4rem; padding-top: 0.75rem; border-top: 1px dashed var(--bdr); }
.wh-heading { font-size: 0.6rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mt); }
.wh-strip { display: flex; gap: 0.4rem; 
overflow-x: auto; padding-bottom: 2px; -webkit-overflow-scrolling: touch; scrollbar-width: none; max-width: 100%; }
.wh-strip::-webkit-scrollbar { display: none; }
.whour { flex: 1; min-width: 56px; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0.5rem 0.35rem; border-radius: 8px; background: var(--bg2); border: 1px solid var(--bdr); text-align: center; }
.whour-wet { background: rgba(33,150,243,0.12); border-color: rgba(33,150,243,0.35); }
.wh-time { font-size: 0.62rem; font-weight: 700; color: var(--mt); text-transform: uppercase; }
.wh-pop { display: flex; align-items: center; gap: 2px; font-size: 0.66rem; font-weight: 700; color: var(--mt); }
.whour-wet .wh-pop { color: var(--bb-info, #29B6F6); }
.wh-temp { font-size: 0.78rem; font-weight: 800; color: var(--fg); }
.weather-loading, .weather-fallback { display: flex; align-items: center; justify-content: center; gap: 0.75rem; padding: 2rem; color: var(--mt); font-size: 0.85rem; background: var(--card); }
.wl-spinner { width: 22px; height: 22px; border: 2px solid var(--bdr); border-top-color: var(--ac); border-radius: 50%; animation: spin .8s linear infinite; }

@media (max-width: 1024px) {
  .weather-now { flex-direction: column; align-items: flex-start; }
  .wrn-metrics { flex-direction: row; flex-wrap: wrap; margin-left: 0; }
}

/* ═══════════ PHOTO HERO — FULLY SELF-OWNED ═══════════
   The template no longer carries the global photo-hero utility classes, so
   these are the only rules that apply to the hero at any width. Nothing
   outside this file can crop, pin or resize the photograph.
   Desktop (≥1025px): cover-crop banner, window height scales with the
   viewport so the framing stays proportionate on every screen.
   Mobile (≤1024px): the app's own mobile regime (drawer + bottom nav switch
   at 1024 in OwnerLayout) — the photo becomes flow content: full width,
   natural ratio, the WHOLE image visible, caption beneath it. */
.hero-banner {
  position: relative;
  overflow: hidden;
  min-height: clamp(220px, 26vw, 340px);
  display: flex;
  align-items: flex-end;
  background: var(--card);
  border-radius: var(--bb-radius-xl, 16px);
  margin-bottom: 22px;
  box-shadow: 0 8px 30px -12px rgb(24 39 32 / 0.28);
}
html[data-theme='dark'] .hero-banner { box-shadow: 0 8px 30px -12px rgb(0 0 0 / 0.6); }
.hero-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.hero-scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgb(0 0 0 / 0.10) 0%, rgb(0 0 0 / 0.30) 55%, rgb(0 0 0 / 0.62) 100%); }
.hero-content { position: relative; z-index: 1; width: 100%; padding: clamp(1.1rem, 2.4vw, 1.6rem); color: #fff; }
.hero-eyebrow { font-size: 0.68rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: rgb(255 255 255 / 0.85); text-shadow: 0 1px 3px rgb(0 0 0 / 0.4); }
.hero-heading { font-family: var(--bb-font-display, 'Plus Jakarta Sans', sans-serif); font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; color: #fff; margin: 0.25rem 0 0.35rem; text-shadow: 0 1px 12px rgb(0 0 0 / 0.35); }
.hero-sub { color: rgb(255 255 255 / 0.9); font-size: var(--bb-text-sm, 0.8125rem); margin: 0; max-width: 46ch; }
.hero-occ { display: flex; align-items: center; gap: 12px; margin-top: 14px; padding: 10px 14px; width: fit-content; max-width: 100%; border-radius: var(--bb-radius-lg, 12px); background-color: rgb(255 255 255 / 0.14); backdrop-filter: blur(14px) saturate(150%); -webkit-backdrop-filter: blur(14px) saturate(150%); border: 1px solid rgb(255 255 255 / 0.22); }
.hero-occ-val { font-family: var(--bb-font-display, 'Plus Jakarta Sans', sans-serif); font-size: 30px; font-weight: 800; line-height: 1; color: #fff; }
.hero-occ-val .pct { font-size: 16px; opacity: 0.75; margin-left: 1px; }
.hero-occ-label { font-size: var(--bb-text-2xs, 0.6875rem); font-weight: 800; letter-spacing: var(--bb-track-wide, 0.08em); text-transform: uppercase; color: rgb(255 255 255 / 0.92); }
.hero-occ-sub { font-size: var(--bb-text-xs, 0.75rem); color: rgb(255 255 255 / 0.75); margin-top: 2px; }

@media (prefers-reduced-transparency: reduce) {
  .hero-occ { background-color: rgb(10 15 12 / 0.82); backdrop-filter: none; -webkit-backdrop-filter: none; }
}

/* ── MOBILE HERO (≤1024 — the app's own mobile breakpoint) ── */
@media (max-width: 1024px) {
  .hero-banner { display: block; min-height: 0; }
  .hero-img {
    position: static;
    width: 100%;
    height: auto;
    /* Cap by pixels AND viewport height, so a portrait photo or a short
       landscape phone can never push the photo past the screen. */
    max-height: min(320px, 60vh);
    object-fit: contain;
    background: var(--bg2);   /* letterbox fill, if any */
  }
  .hero-scrim { display: none; }

  /* Caption sits on the surface now — theme ink replaces white-on-photo */
  .hero-content { padding: 1rem 1.1rem 1.1rem; color: var(--fg); }
  .hero-eyebrow { color: var(--mt); text-shadow: none; }
  .hero-heading { color: var(--fg); text-shadow: none; }
  .hero-sub { color: var(--mt); text-shadow: none; }

  /* The glass occupancy chip was translucent-white over a photograph; on the
     surface it needs the panel treatment to stay legible. */
  .hero-occ { width: 100%; background: var(--bg2); border-color: var(--bdr); backdrop-filter: none; -webkit-backdrop-filter: none; }
  .hero-occ-val { font-size: 26px; color: var(--fg); }
  .hero-occ-label { color: var(--mt); }
  .hero-occ-sub { color: var(--mt); }
}

/* ═══════════ RESTORED CARDS ═══════════ */
.stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; max-width: 100%; }
.account-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; max-width: 100%; }
@media (max-width: 1280px) {
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 1024px) {
  .account-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .stats-grid { grid-template-columns: 1fr; }
}

.profile-summary { display: flex; gap: 1.125rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
.avatar { width: 60px; height: 60px; border-radius: var(--bb-radius-lg); background: linear-gradient(135deg, var(--eco-mint), var(--color-cyan)); display: flex; align-items: center; justify-content: center; font-family: var(--bb-font-display); font-size: 1.25rem; font-weight: 800; color: var(--eco-deepest); flex-shrink: 0; }
.profile-info { min-width: 0; }
.profile-info h2 { font-family: var(--bb-font-display); font-size: var(--bb-text-lg); font-weight: var(--bb-weight-extrabold); color: var(--bb-ink); margin: 0 0 2px; }
.business { color: var(--bb-info); font-size: var(--bb-text-sm); font-weight: 600; margin-bottom: 3px; }
.email { color: var(--bb-text-tertiary); font-size: var(--bb-text-xs); display: flex; align-items: center; gap: 5px; }

.details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 0.625rem; max-width: 100%; }
.detail { padding: 0.8rem; background: var(--bb-bg-subtle); border-radius: var(--bb-radius-md); }
.detail .label { font-size: var(--bb-text-2xs); color: var(--bb-text-tertiary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; display: flex; align-items: center; gap: 4px; }
.detail .value { font-size: var(--bb-text-sm); font-weight: var(--bb-weight-bold); color: var(--bb-ink); word-break: break-all; }

.verification { display: flex; flex-direction: column; }
.v-step { display: flex; gap: 0.75rem; padding: 0.75rem 0; position: relative; }
.v-step:not(:last-child)::after { content: ''; position: absolute; left: 15px; top: 40px; bottom: -2px; width: 2px; background: var(--bb-border); }
.v-step.done:not(:last-child)::after { background: var(--bb-success); }
.v-icon { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: var(--bb-text-xs); border: 2px solid var(--bb-border); background: var(--bb-bg-subtle); color: var(--bb-text-tertiary); position: relative; z-index: 1; flex-shrink: 0; }
.v-step.done .v-icon { border-color: var(--bb-success); background: var(--bb-success-soft); color: var(--bb-success); }
.v-step.active .v-icon { border-color: var(--bb-warning); background: var(--bb-warning-soft); color: var(--bb-warning); animation: vPulse 2s ease-in-out infinite; }
@keyframes vPulse { 0%, 100% { box-shadow: 0 0 0 0 var(--bb-warning-soft); } 50% { box-shadow: 0 0 0 8px transparent; } }
.v-info { min-width: 0; }
.v-title { font-size: var(--bb-text-sm); font-weight: 700; color: var(--bb-ink); margin-bottom: 2px; }
.v-step.active .v-title { color: var(--bb-warning); }
.v-desc { font-size: var(--bb-text-xs); color: var(--bb-text-tertiary); }

.doc-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-radius: var(--bb-radius-md); background: var(--bb-bg-subtle); border: 1px solid transparent; transition: border-color var(--bb-dur-fast) var(--bb-ease); }
.doc-item.clickable { cursor: pointer; }
.doc-item.clickable:hover { border-color: var(--line-strong); }
.doc-icon { width: 40px; height: 40px; border-radius: var(--bb-radius-sm); display: flex; align-items: center; justify-content: center; font-size: var(--bb-text-md); flex-shrink: 0; }
.doc-info { flex: 1; min-width: 0; }
.doc-name { font-size: var(--bb-text-sm); font-weight: 700; color: var(--bb-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.doc-meta { font-size: var(--bb-text-2xs); color: var(--bb-text-tertiary); margin-top: 2px; }
.doc-action { width: 30px; height: 30px; border-radius: var(--bb-radius-sm); background: transparent; border: 1px solid var(--bb-border); color: var(--bb-text-tertiary); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: var(--bb-text-xs); flex-shrink: 0; transition: all var(--bb-dur-fast) var(--bb-ease); }
.doc-action:hover { border-color: var(--bb-info); color: var(--bb-info); background: var(--bb-info-soft); }

.timeline { display: flex; flex-direction: column; gap: 0.75rem; }
.timeline-item { display: flex; gap: 0.75rem; align-items: flex-start; }
.t-icon { width: 32px; height: 32px; border-radius: var(--bb-radius-sm); display: flex; align-items: center; justify-content: center; font-size: var(--bb-text-xs); border: 1px solid transparent; flex-shrink: 0; }
.t-info { min-width: 0; }
.t-title { font-size: var(--bb-text-sm); font-weight: 700; color: var(--bb-ink); }
.t-desc { font-size: var(--bb-text-xs); color: var(--bb-text-tertiary); margin-top: 2px; }
.t-time { font-size: var(--bb-text-2xs); color: var(--bb-text-tertiary); margin-top: 2px; opacity: 0.8; }

/* ═══════════ OPERATIONS SECTIONS ═══════════
   All grids reflow continuously (auto-fit + minmax) instead of snapping at
   fixed breakpoints — 3→2→1 and 2→1 happen at whatever width the cards
   actually stop fitting. */
.rates-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; max-width: 100%; }
@media (max-width: 1280px) {
  .rates-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .rates-grid { grid-template-columns: 1fr; }
}
.rate-card { padding: 1.15rem; display: flex; flex-direction: column; gap: 0.2rem; }
.rate-label { font-size: var(--bb-text-xs); font-weight: var(--bb-weight-extrabold); letter-spacing: 0.06em; text-transform: uppercase; color: var(--bb-text-secondary); display: flex; flex-direction: column; gap: 1px; }
.rate-label span { font-size: var(--bb-text-2xs); font-weight: 500; letter-spacing: 0; text-transform: none; color: var(--bb-text-tertiary); }
.rate-val { font-family: var(--bb-font-display); font-size: var(--bb-text-2xl); font-weight: var(--bb-weight-extrabold); color: var(--bb-ink); letter-spacing: -0.02em; line-height: 1.1; margin-top: 2px; }
.rate-sub { font-size: var(--bb-text-xs); color: var(--bb-text-tertiary); }

.movements-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; max-width: 100%; }
@media (max-width: 1024px) {
  .movements-grid { grid-template-columns: 1fr; }
}
.panel { padding: 1.15rem; display: flex; flex-direction: column; border-radius: var(--bb-radius-lg); }
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.9rem; }
.panel-head h3 { display: flex; align-items: center; gap: 0.5rem; font-family: var(--bb-font-display); font-size: var(--bb-text-md); font-weight: var(--bb-weight-extrabold); color: var(--bb-ink); margin: 0; }
.ops-count { font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-extrabold); color: var(--bb-text-secondary); background: var(--bb-bg-subtle); border: 1px solid var(--bb-border); padding: 3px 9px; border-radius: var(--bb-radius-full); flex-shrink: 0; }

.ops-list { display: flex; flex-direction: column; gap: 0.4rem; max-height: 20rem; overflow-y: auto; }
.ops-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.7rem; background: var(--bb-bg-subtle); border: 1px solid transparent; border-radius: var(--bb-radius-md); transition: border-color var(--bb-dur-fast) var(--bb-ease); }
.ops-row:hover { border-color: var(--line-strong); background: var(--card2); }
.ops-row-time { font-family: var(--bb-font-mono); font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-bold); color: var(--bb-text-tertiary); flex-shrink: 0; min-width: 3.6rem; }
.ops-row-main { flex: 1; min-width: 0; }
.ops-row-title { font-size: var(--bb-text-sm); font-weight: var(--bb-weight-bold); color: var(--bb-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ops-row-meta { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; font-size: var(--bb-text-2xs); color: var(--bb-text-tertiary); margin-top: 2px; }
.ops-kind { font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-extrabold); letter-spacing: 0.05em; text-transform: uppercase; padding: 1px 5px; border-radius: 4px; }
.ops-kind.accommodation { background: var(--bb-info-soft); color: var(--bb-info); }
.ops-kind.entrance { background: var(--bb-highlight-soft); color: var(--bb-warning); }
.ops-row-amt { font-size: var(--bb-text-xs); font-weight: var(--bb-weight-extrabold); color: var(--bb-ink); flex-shrink: 0; }

.empty-state { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 1.75rem 0.75rem; color: var(--bb-text-tertiary); font-size: var(--bb-text-sm); text-align: center; }
.empty-state i { font-size: 1.375rem; opacity: 0.6; color: var(--mt2); }

.ops-rooms { display: flex; flex-direction: column; gap: 0.5rem; }
.ops-room { display: flex; align-items: center; justify-content: space-between; gap: 0.875rem; padding: 0.7rem 0.75rem; background: var(--bb-bg-subtle); border-radius: var(--bb-radius-md); }
.ops-room-info { min-width: 0; }
.ops-room-name { font-size: var(--bb-text-sm); font-weight: var(--bb-weight-bold); color: var(--bb-ink); }
.ops-room-meta { font-size: var(--bb-text-2xs); color: var(--bb-text-tertiary); margin-top: 2px; }
.ops-room-units { display: flex; gap: 3px; flex-shrink: 0; }
.ops-room-units .unit { width: 8px; height: 16px; border-radius: 3px; background: var(--eco-mint); opacity: 0.85; border: 1px solid var(--bdr2); }
.ops-room-none { font-size: var(--bb-text-2xs); color: var(--bb-text-tertiary); }

.ops-mix { display: flex; flex-direction: column; gap: 1.125rem; }
.mix-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.75rem; }
.mix-name { display: inline-flex; align-items: center; gap: 0.4rem; font-size: var(--bb-text-xs); font-weight: 600; color: var(--bb-ink); }
.mix-name .dot { width: 7px; height: 7px; border-radius: 50%; }
.dot-accom { background: var(--eco-mint); }
.dot-ent { background: var(--bb-info); }
.mix-amt { font-family: var(--bb-font-display); font-size: var(--bb-text-sm); font-weight: var(--bb-weight-extrabold); color: var(--bb-ink); }
.mix-bar { height: 7px; background: var(--bb-bg-subtle); border-radius: 4px; overflow: hidden; margin: 0.5rem 0 0.375rem; }
.mix-fill { height: 100%; border-radius: 4px; transition: width var(--bb-dur-base) var(--bb-ease); }
.mix-fill-accom { background: var(--eco-mint); }
.mix-fill-ent { background: var(--bb-info); }
.mix-sub { font-size: var(--bb-text-2xs); color: var(--bb-text-tertiary); }

@media (max-width: 640px) {
  .dashboard { padding: 16px 14px 32px; }

  .weather-body { padding: 1rem; }
  .weather-now { min-width: 0; }
  .wday { min-width: 60px; }
  .wd-grid { grid-template-columns: repeat(2, 1fr); }
  .timeline-item, .doc-item { flex-wrap: wrap; }
  .ops-row { flex-wrap: wrap; }
  .ops-row-amt { width: 100%; text-align: right; }
  .ops-list { max-height: none; }
}
@media (max-width: 480px) {
  .weather-days { flex-wrap: nowrap; overflow-x: auto; min-width: 0; }
  .wday { min-width: 68px; }
  .wh-strip { gap: 0.3rem; }
  .whour { min-width: 52px; }
  .wday-detail { padding: 0.85rem; }
}
</style>