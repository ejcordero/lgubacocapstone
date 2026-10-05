<template>
  <div class="dashboard-content">
    <template v-if="userStore.user">

      <!-- ═══════════ HERO — a PLACE, not a dashboard ═══════════
           Travel interfaces are carried by imagery. The previous hero was
           a flat gradient with three counters, which is why the page read
           as an admin panel. This leads with the destination itself. -->
      <section class="hero-banner photo-hero">
        <img
          class="photo-hero-img"
          :src="heroImage"
          :alt="heroDestination?.name || 'Baco, Oriental Mindoro'"
        />
        <div class="photo-scrim"></div>

        <div class="hero-content">
          <div class="hero-eyebrow photo-eyebrow">{{ heroDestination?.location || 'Baco · Oriental Mindoro' }}</div>
          <h1 class="hero-heading">
            <template v-if="heroDestination">{{ heroDestination.name }}</template>
            <template v-else>Welcome back, {{ displayName }}</template>
          </h1>
          <p class="hero-sub">
            {{ heroDestination?.description
              || 'Discover resorts, book your stay, and explore the beauty of Baco, Oriental Mindoro.' }}
          </p>

          <div class="hero-actions">
            <button class="btn-lime" @click="navigateToHotels">
              Explore stays <ArrowRight :size="15" />
            </button>
            <button class="btn-glass" @click="navigateToMap">
              Trail map <MapPin :size="15" />
            </button>
          </div>
        </div>

        <div class="hero-stats">
          <div class="hero-stat">
            <div class="hs-val">{{ hotelCount }}</div>
            <div class="hs-label">Stays</div>
          </div>
          <div class="hero-stat">
            <div class="hs-val">{{ destinations.length }}</div>
            <div class="hs-label">Destinations</div>
          </div>
          <div class="hero-stat">
            <div class="hs-val">{{ myBookings.length }}</div>
            <div class="hs-label">Your bookings</div>
          </div>
        </div>
      </section>

      <!-- ═══════════ WEATHER IN BACO ═══════════ -->
      <section class="section-block">
        <div class="weather-card flat rounded-[var(--bb-radius-lg)] overflow-hidden">
          <div v-if="weatherLoading" class="weather-loading flat">
            <div class="wl-spinner"></div>
            <p>Checking the weather in Baco…</p>
          </div>

          <div v-else-if="currentWeather" class="weather-body">
            <div class="weather-main-row">
              <div class="weather-now">
                <div class="wrn-icon skeuo-well grid place-items-center shrink-0" :style="{ color: currentWeather.color }">
                  <component :is="currentWeather.icon" :size="34" />
                </div>
                <div class="wrn-info">
                  <div class="wrn-temp">{{ Math.round(currentWeather.temperature_2m) }}<sup>°</sup>C</div>
                  <div class="wrn-label">{{ currentWeather.label }}</div>
                  <div class="wrn-loc"><MapPin :size="11" /> Baco, Oriental Mindoro</div>
                </div>
                <div class="wrn-metrics glass rounded-[var(--bb-radius-lg)] px-2 py-1.5">
                  <div class="wrn-metric skeuo-sm"><Thermometer :size="14" /> <span>Feels like {{ Math.round(currentWeather.apparent_temperature) }}°</span></div>
                  <div class="wrn-metric skeuo-sm"><Droplets :size="14" /> <span>Humidity {{ currentWeather.relative_humidity_2m }}%</span></div>
                  <div class="wrn-metric skeuo-sm"><Wind :size="14" /> <span>Wind {{ Math.round(currentWeather.wind_speed_10m) }} km/h</span></div>
                </div>
              </div>

              <div class="weather-days">
                <button
                  v-for="(day, i) in weatherDays"
                  :key="day.date"
                  class="wday skeuo rounded-[var(--bb-radius-md)] flex flex-col items-center cursor-pointer active:[box-shadow:var(--shadow-skeuo-pressed)]"
                  :class="{ 'wday-active': selectedDayIndex === i }"
                  @click="toggleDay(i)"
                >
                  <div class="wday-name">{{ i === 0 ? 'Today' : day.day }}</div>
                  <component :is="weatherInfo(day.code).icon" :size="20" :style="{ color: weatherInfo(day.code).color }" />
                  <div class="wday-pops" v-if="day.pop != null"><CloudRain :size="10" /> {{ day.pop }}%</div>
                  <div class="wday-temps"><span class="wday-high">{{ Math.round(day.high) }}°</span><span class="wday-low">{{ Math.round(day.low) }}°</span></div>
                </button>
              </div>
            </div>

            <!-- Tap hint — only while no day is selected (delete this line if unwanted) -->
            <div class="wd-hint text-amber-ink" v-if="selectedDayIndex === null">Tap any day for full details</div>

            <!-- ── SELECTED DAY DETAILS (revealed on click) ── -->
            <div class="wday-detail" v-if="selectedDay">
              <div class="wd-head">
                <component :is="weatherInfo(selectedDay.code).icon" :size="28" :style="{ color: weatherInfo(selectedDay.code).color }" />
                <div class="wd-head-info">
                  <div class="wd-title">{{ selectedDay.fullDate }}</div>
                  <div class="wd-cond">{{ weatherInfo(selectedDay.code).label }}</div>
                </div>
                <div class="wd-hilo">
                  <span class="wday-high">{{ Math.round(selectedDay.high) }}°</span>
                  <span class="wd-hilo-sep">/</span>
                  <span class="wday-low">{{ Math.round(selectedDay.low) }}°</span>
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

            <!-- Next 12 hours — also revealed on click, same design as before -->
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

          <div v-else class="weather-fallback panel-flat text-ink-2">
            <CloudSun :size="26" class="text-cyan-ink" />
            <p>Weather data is temporarily unavailable.</p>
          </div>
        </div>
      </section>

      <!-- ═══════════ DESTINATIONS ═══════════
           This row used to be four stat cards: "12 Hotels Available",
           "3 Upcoming Stays", permit status, "Nov–Feb". Numbers are not
           places, and that is most of why the page read as a dashboard.
           It is now the travel content itself — the destinations, with
           photographs. Booking and permit state still matter, so they are
           kept below as a single compact strip rather than four boxes. -->
      <section class="section-block" v-if="destinations.length">
        <div class="section-header">
          <div>
            <h2 class="section-title">Where to go</h2>
            <p class="section-sub">The places worth leaving home for</p>
          </div>
        </div>

        <div class="dest-grid">
          <article
            v-for="d in destinations"
            :key="d.id"
            class="photo-card dest-card" :class="{ 'dest-card-active': activeDestinationId === d.id }"
            @click="showDestination(d)"
          >
            <div class="photo-frame dest-card-frame">
              <img
                v-if="d.image"
                class="photo-hero-img"
                :src="d.image"
                :alt="d.name"
                loading="lazy"
              />
              <div v-else class="dest-card-blank" aria-hidden="true">
                <Mountain :size="28" />
              </div>
              <span v-if="activityLabel(d)" class="dest-card-type photo-eyebrow">{{ activityLabel(d) }}</span>
            </div>
            <div class="dest-card-body">
              <h3 class="dest-card-name">{{ d.name }}</h3>
              <p v-if="d.location" class="dest-card-region">
                <MapPin :size="12" /> {{ d.location }}
              </p>
              <p v-if="d.description" class="dest-card-tagline">
                {{ d.description.slice(0, 110) }}
              </p>
            </div>
          </article>
        </div>
      </section>

      <!-- ═══════════ YOUR TRIP AT A GLANCE ═══════════
           The old stat cards, compressed into one row. This is genuinely
           account state, so it stays — but it no longer leads the page. -->
      <section class="section-block">
        <div class="trip-strip flat">
          <button class="trip-item" @click="navigateToHotels">
            <span class="trip-icon ti-hotels"><Bed :size="17" /></span>
            <span class="trip-text">
              <b>{{ hotelCount }}</b>
              <span>Stays available</span>
            </span>
          </button>
          <button class="trip-item" @click="navigateToHotels">
            <span class="trip-icon ti-stays"><Calendar :size="17" /></span>
            <span class="trip-text">
              <b>{{ myBookings.length }}</b>
              <span>Your bookings</span>
            </span>
          </button>
          <button class="trip-item" @click="navigateToPermit">
            <span class="trip-icon ti-permit"><FileText :size="17" /></span>
            <span class="trip-text">
              <b>{{ latestPermit ? latestPermit.status : 'None' }}</b>
              <span>Halcon permit</span>
            </span>
          </button>
          <div class="trip-item trip-item--static">
            <span class="trip-icon ti-trail"><Sun :size="17" /></span>
            <span class="trip-text">
              <b>Nov – Feb</b>
              <span>Best trek season</span>
            </span>
          </div>
        </div>
      </section>

      <!-- ═══════════ FEATURED HOTELS ═══════════ -->
      <section class="section-block">
        <div class="section-header">
          <div>
            <h2 class="section-title">Discover Baco's Resorts</h2>
            <p class="section-sub">Handpicked stays for your next adventure</p>
          </div>
          <button class="view-all-btn" @click="navigateToHotels">
            Explore All <ArrowRight :size="14" />
          </button>
        </div>

        <div v-if="featuredHotels.length === 0" class="section-empty">
          <Building :size="32" />
          <p>No resorts available yet. Check back soon.</p>
        </div>
        <div v-else class="hotel-grid">
          <div
            v-for="hotel in featuredHotels"
            :key="hotel.id"
            class="hotel-card"
            @click="navigateToHotels"
          >
            <div class="hc-image">
              <img
                v-if="hotel.image || (hotel.gallery && hotel.gallery[0])"
                :src="hotel.image || hotel.gallery[0]"
                :alt="hotel.name"
                loading="lazy"
              />
              <div v-else class="hc-fallback"><ImageIcon :size="24" /></div>
              <div class="hc-badges">
                <span v-if="(hotel.entranceFees || []).length" class="hc-badge tour">Day Tour</span>
                <span v-if="hotel.hasRooms" class="hc-badge stay">Overnight</span>
              </div>
            </div>
            <div class="hc-body">
              <h3 class="hc-name">{{ hotel.name }}</h3>
              <p class="hc-location"><MapPin :size="12" /> {{ hotel.location || 'Baco, Oriental Mindoro' }}</p>
              <div class="hc-meta">
                <span v-if="(hotel.rooms || []).length"><Home :size="12" /> {{ (hotel.rooms || []).length }} room{{ (hotel.rooms || []).length !== 1 ? 's' : '' }}</span>
                <span v-if="(hotel.amenities || []).length"><Star :size="12" /> {{ (hotel.amenities || []).length }} amenit{{ (hotel.amenities || []).length !== 1 ? 'ies' : 'y' }}</span>
              </div>
              <div class="hc-footer">
                <div class="hc-price">
                  <span class="price-val">{{ peso(cardPrice(hotel)) }}</span>
                  <span class="price-label">{{ cardPriceLabel(hotel) }}</span>
                </div>
                <span class="hc-view-btn">View <ArrowRight :size="12" /></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════════ YOUR UPCOMING STAYS ═══════════ -->
      <section v-if="myBookings.length > 0" class="section-block">
        <div class="section-header">
          <div>
            <h2 class="section-title">Your Upcoming Stays</h2>
            <p class="section-sub">Manage your reservations</p>
          </div>
        </div>
        <div class="stays-list">
          <div v-for="bk in myBookings.slice(0, 3)" :key="bk.id" class="stay-card">
            <div class="sc-thumb">
              <img v-if="bk.hotel?.image" :src="bk.hotel.image" :alt="bk.hotel?.name" />
              <div v-else class="sc-fallback"><Bed :size="18" /></div>
            </div>
            <div class="sc-info">
              <h4 class="sc-name">{{ bk.hotel?.name || 'Resort' }}</h4>
              <p class="sc-dates">{{ formatDate(bk.checkIn || bk.details?.checkIn) }} <template v-if="bk.checkOut || bk.details?.checkOut"> → {{ formatDate(bk.checkOut || bk.details?.checkOut) }}</template></p>
              <p class="sc-type">{{ bk.bookingType === 'entrance' ? '🎟️ Day Tour' : '🛏️ Overnight Stay' }}</p>
            </div>
            <div class="sc-right">
              <span :class="['status-badge', statusClass(bk.status)]">{{ prettyStatus(bk.status) }}</span>
              <span class="sc-price">{{ peso(bk.totalPrice) }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════════ QUICK ACTIONS ═══════════ -->
      <section class="section-block">
        <div class="section-header">
          <div>
            <h2 class="section-title">Quick Actions</h2>
            <p class="section-sub">Jump to what you need</p>
          </div>
        </div>
        <div class="actions-grid">
          <button class="action-card glass-panel ac-book" @click="navigateToHotels">
            <Bed :size="24" />
            <span class="ac-label">Book a Stay</span>
            <span class="ac-desc">Browse resorts & reserve</span>
            <ArrowRight :size="14" class="ac-arrow" />
          </button>
          <button class="action-card glass-panel ac-permit" @click="navigateToPermit">
            <Mountain :size="24" />
            <span class="ac-label">Apply for Permit</span>
            <span class="ac-desc">Mt. Halcon trekking permit</span>
            <ArrowRight :size="14" class="ac-arrow" />
          </button>
          <button class="action-card glass-panel ac-map" @click="navigateToMap">
            <MapIcon :size="24" />
            <span class="ac-label">Trail Map</span>
            <span class="ac-desc">Explore trails & routes</span>
            <ArrowRight :size="14" class="ac-arrow" />
          </button>
          <button class="action-card glass-panel ac-explore" @click="navigateToHotels">
            <Compass :size="24" />
            <span class="ac-label">Explore Hotels</span>
            <span class="ac-desc">Find your perfect stay</span>
            <ArrowRight :size="14" class="ac-arrow" />
          </button>
        </div>
      </section>

      <!-- ═══════════ ACTIVITY FEED ═══════════ -->
      <section v-if="recentActivity.length > 0" class="section-block">
        <div class="section-header">
          <div>
            <h2 class="section-title">Recent Activity</h2>
            <p class="section-sub">Your latest updates</p>
          </div>
        </div>
        <div class="activity-timeline">
          <div v-for="(activity, index) in recentActivity" :key="index" class="timeline-item">
            <div class="tl-dot" :style="{ background: activity.color + '18', color: activity.color, borderColor: activity.color + '40' }">
              <component :is="activity.icon" :size="14" />
            </div>
            <div class="tl-info">
              <p class="tl-title">{{ activity.title }}</p>
              <p class="tl-time">{{ activity.date }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════════ TRAIL TIP ═══════════ -->
      <section class="section-block">
        <div class="tip-banner">
          <div class="tip-icon-wrap"><Sun :size="20" /></div>
          <div class="tip-content">
            <h3>Trail Tip: Best Season for Mt. Halcon</h3>
            <p>The dry season from <strong>November to February</strong> is the safest window for trekking. Submit your permit at least 3 days before your planned trek date.</p>
          </div>
          <button class="tip-btn" @click="navigateToMap">
            Check Conditions <ArrowRight :size="14" />
          </button>
        </div>
      </section>

    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Mountain, Bed, CheckCircle, Sun, ArrowRight,
  Calendar, FileText, Building, MapPin, Home, Star, ImageIcon,
  Map as MapIcon, Compass, CloudSun, Wind, Droplets, Thermometer,
  CloudRain, CloudLightning, Snowflake, Cloud, Sunrise, Sunset
} from 'lucide-vue-next'
import { useBookingStore } from '../../stores/useBookingStore'
import { usePermitStore } from '../../stores/usePermitStore'
import { useUserStore } from '../../stores/useUserStore'
import { API } from '../../api'

const router = useRouter()
const bookingStore = useBookingStore()
const permitStore = usePermitStore()
const userStore = useUserStore()

// ── Weather state ─────────────────────────────────────────────────
const weather = ref(null)
const weatherLoading = ref(true)
// null = collapsed (default: 7-day view only); a number = that day is expanded
const selectedDayIndex = ref(null)

const weatherIconMap = {
  0: { label: 'Clear', icon: Sun, color: 'var(--bb-sun)' },
  1: { label: 'Mostly Clear', icon: Sun, color: 'var(--bb-sun)' },
  2: { label: 'Partly Cloudy', icon: CloudSun, color: 'var(--bb-text-tertiary)' },
  3: { label: 'Overcast', icon: Cloud, color: 'var(--bb-text-tertiary)' },
  45: { label: 'Foggy', icon: Cloud, color: 'var(--bb-text-tertiary)' },
  48: { label: 'Foggy', icon: Cloud, color: 'var(--bb-text-tertiary)' },
  51: { label: 'Light Drizzle', icon: CloudRain, color: 'var(--bb-info)' },
  53: { label: 'Drizzle', icon: CloudRain, color: 'var(--bb-info)' },
  55: { label: 'Heavy Drizzle', icon: CloudRain, color: 'var(--bb-info)' },
  61: { label: 'Light Rain', icon: CloudRain, color: 'var(--bb-info)' },
  63: { label: 'Rain', icon: CloudRain, color: 'var(--bb-info)' },
  65: { label: 'Heavy Rain', icon: CloudRain, color: 'var(--bb-info)' },
  80: { label: 'Rain Showers', icon: CloudRain, color: 'var(--bb-info)' },
  81: { label: 'Rain Showers', icon: CloudRain, color: 'var(--bb-info)' },
  82: { label: 'Heavy Showers', icon: CloudRain, color: 'var(--bb-info)' },
  95: { label: 'Thunderstorm', icon: CloudLightning, color: 'var(--bb-danger)' },
  96: { label: 'Storm + Hail', icon: CloudLightning, color: 'var(--bb-danger)' },
  71: { label: 'Light Snow', icon: Snowflake, color: 'var(--bb-info)' },
  73: { label: 'Snow', icon: Snowflake, color: 'var(--bb-info)' },
  75: { label: 'Heavy Snow', icon: Snowflake, color: 'var(--bb-info)' },
}

const weatherInfo = (code) => weatherIconMap[code] || { label: 'N/A', icon: CloudSun, color: 'var(--bb-text-tertiary)' }

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

/* ── Destinations ──────────────────────────────────────────────────
   The dashboard previously showed counters because it had no place
   content. Destinations are the travel content, so they are fetched
   here and drive the hero and the destination showcase. */
const destinations = ref([])

/* Image manifest slot 1 — the dashboard hero.
   cover-tourism-img.jpg is 1280x561 at 171 KB, which suits a wide hero and
   is 21x lighter than the MT-img.jpg it replaces. */
const heroFallbackImage = '/images/cover-tourism-img.jpg'

const fetchDestinations = async () => {
  try {
    const res = await fetch(`${API}/destinations`)
    if (res.ok) {
      const rows = await res.json()
      destinations.value = Array.isArray(rows) ? rows : []
    }
  } catch { /* non-critical — the hero falls back */ }
}

/* Which destination the hero is currently showing, or null when none has
   been chosen. Null is the DEFAULT rather than auto-picking one, so the
   page opens on the tourism cover instead of an arbitrary destination's
   name sitting under an unrelated photograph. */
const activeDestinationId = ref(null)

const heroDestination = computed(() => {
  if (activeDestinationId.value == null) return null
  return destinations.value.find(d => d?.id === activeDestinationId.value) || null
})

/* The selected destination's own photograph, else the tourism cover. */
const heroImage = computed(() => heroDestination.value?.image || heroFallbackImage)

/* Clicking a destination card promotes it to the hero. Clicking the
   active one again returns the hero to the cover. */
const showDestination = (d) => {
  if (d?.id == null) return
  activeDestinationId.value = activeDestinationId.value === d.id ? null : d.id
}

/* `activities` is an array of { id, name, image } objects - the admin
   DestinationGrid stores it that way - so interpolating the field
   directly renders the object as JSON. Join the names instead.

   Tolerates the three shapes this field has been seen in: an array of
   objects, an array of plain strings, and a JSON string. */
const activityLabel = (d) => {
  const a = d?.activities
  if (!a) return ''
  let list = a
  if (typeof a === 'string') {
    try { list = JSON.parse(a) } catch { return a }   // not JSON: use as-is
  }
  if (!Array.isArray(list)) return ''
  const names = list
    .map(x => (typeof x === 'string' ? x : x?.name))
    .filter(Boolean)
  return names.join(' · ')
}

// ── Weather formatting helpers ────────────────────────────────────
const fmtNum = (v) => (v == null ? '—' : Math.round(Number(v)))

// Convert degrees → 16-point compass (Open-Meteo sends degrees from North)
const windCompass = (deg) => {
  if (deg == null) return '—'
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return dirs[Math.round(Number(deg) / 22.5) % 16]
}

// UV Index levels per WHO scale (Open-Meteo uv_index_max, unitless)
const uvInfo = (uv) => {
  if (uv == null) return { label: 'N/A', color: 'var(--bb-text-tertiary)' }
  const v = Number(uv)
  if (v < 3)  return { label: 'Low',       color: 'var(--bb-success)' }
  if (v < 6)  return { label: 'Moderate',  color: 'var(--bb-sun)' }
  if (v < 8)  return { label: 'High',      color: 'var(--bb-warning)' }
  if (v < 11) return { label: 'Very High', color: 'var(--bb-danger)' }
  return { label: 'Extreme', color: 'var(--bb-danger)' }
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

const myPermits = computed(() => Array.isArray(permitStore.myPermits) ? permitStore.myPermits : [])
const myBookings = computed(() => Array.isArray(bookingStore.myBookings) ? bookingStore.myBookings : [])
const allHotels = computed(() => Array.isArray(bookingStore.hotels) ? bookingStore.hotels : [])

const displayName = computed(() => {
  if (!userStore.user?.firstName) return 'Explorer'
  return userStore.user.firstName
})

const latestPermit = computed(() => myPermits.value[0] ?? null)
const hotelCount = computed(() => allHotels.value.length)
const permitCount = computed(() => myPermits.value.length)

const featuredHotels = computed(() => allHotels.value.slice(0, 6))

const recentActivity = computed(() => {
  const items = []
  if (Array.isArray(myPermits.value)) {
    myPermits.value.forEach(p => {
      items.push({
        icon: CheckCircle,
        title: `Permit ${p.status ?? 'Submitted'}`,
        date: p.submitDate ?? 'Recently',
        color: p.status === 'Approved' ? 'var(--bb-success)' : p.status === 'Rejected' ? 'var(--bb-danger)' : 'var(--bb-warning)'
      })
    })
  }
  if (Array.isArray(myBookings.value)) {
    myBookings.value.forEach(b => {
      items.push({
        icon: Bed,
        title: `Booking at ${b.hotel?.name || 'a resort'}`,
        date: b.checkIn || b.details?.checkIn || 'Recently',
        color: b.status === 'confirmed' ? 'var(--bb-success)' : b.status === 'rejected' ? 'var(--bb-danger)' : 'var(--bb-neutral)'
      })
    })
  }
  return items.slice(0, 5)
})

function cardPrice(h) {
  const f = (h.entranceFees || []).map(x => Number(x.price))
  const r = (h.rooms || []).map(x => Number(x.price))
  if (f.length) return Math.min(...f)
  if (r.length) return Math.min(...r)
  return Number(h.basePrice || 0)
}

function cardPriceLabel(h) {
  if ((h.entranceFees || []).length) return '/person'
  if (h.hasRooms) return '/night'
  return 'starting'
}

const peso = (n) => '₱' + Number(n || 0).toLocaleString()

function formatDate(d) {
  if (!d) return '—'
  return new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusClass(s) {
  return { pending: 'badge-warning', confirmed: 'badge-success', completed: 'badge-info', rejected: 'badge-danger', cancelled: 'badge-danger', no_show: 'badge-neutral' }[s] || 'badge-neutral'
}

function prettyStatus(s) {
  return { pending: 'Pending', confirmed: 'Approved', completed: 'Completed', rejected: 'Rejected', cancelled: 'Cancelled', no_show: 'No show' }[s] || s
}

const navigateToPermit = () => router.push('/user/permits')
const navigateToHotels = () => router.push('/user/hotels')
const navigateToMap = () => router.push('/user/map')

onMounted(async () => {
  fetchWeather()
  fetchDestinations()
  try {
    await bookingStore.fetchHotels()
  } finally {}
  if (userStore.token) {
    await bookingStore.fetchMyBookings(userStore.token)
  }
})
</script>

<style scoped>
/* ════════════════════════════════════════════════════════════
   The eco ramp + --bb-* tokens now live on :root in UserLayout.vue
   (shared by every screen in the user app). Only page-specific
   layout lives here.
   ════════════════════════════════════════════════════════════ */
.dashboard-content {
  /* Bleed past .page-content's padding so the canvas fills the viewport.
     Uses the shell gutter token so the dashboard sits on the same rhythm
     as every other page — it previously hardcoded the old 1.5rem/2.5rem
     spacing, which the compact pass had already retired elsewhere. */
  --gut: var(--bb-gutter);
  margin: calc(-1 * var(--bb-gutter)) calc(-1 * var(--gut)) -1.5rem;
  padding: var(--bb-gutter) var(--gut) 1.5rem;
  min-height: 100%;

  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  font-family: var(--bb-font-body);
  color: var(--bb-ink);
  background: linear-gradient(160deg, var(--bb-surface), var(--bb-bg-subtle));
  animation: fadeInUp .5s ease both;
}

/* Sections keep the old 1440px measure now that the wrapper bleeds */
.dashboard-content > * {
  max-width: 1440px;
  width: 100%;
  margin-inline: auto;
}

:root[data-theme="dark"] .dashboard-content {
  background: linear-gradient(160deg, var(--bb-surface), var(--bb-bg));
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Flat card surface — the frosted recipe is gone by design */
/* FLAT card. This class is used by panels inside the scrolling page, so it
   deliberately has NO backdrop-filter: anything that scrolls relative to the
   backdrop re-blurs every frame. Depth comes from a white fill, a hairline
   and one soft lift. Real glass is reserved for the fixed chrome
   (sidebar / header / dock), which is the only place it pays for itself. */
.panel-flat {
  background: var(--bb-surface);
  border: 1px solid var(--bb-border);
  box-shadow: var(--bb-shadow-sm);
}

/* ═══════════ HERO BANNER ═══════════ */
/* ═══════════ HERO — photographic ═══════════
   The photo, its scrim and the overflow clip come from the photo-hero
   utilities in the template. What stays here is the caption's type and
   the two buttons, which have no utility equivalent.

   Type on the hero is WHITE over the scrim, never --bb-ink: the scrim's
   job is to guarantee that contrast regardless of what the photograph
   underneath happens to be. */
.hero-banner {
  border-radius: var(--bb-radius-xl);
  min-height: 300px;
  display: flex;
  align-items: flex-end;
  box-shadow: var(--bb-shadow-lg);
}

.hero-content {
  position: relative;
  z-index: 2;
  width: 100%;
  padding: clamp(1.25rem, 3vw, 2.25rem);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}

.hero-eyebrow {
  color: rgb(255 255 255 / 0.82);
  text-shadow: 0 1px 3px rgb(0 0 0 / 0.4);
}

.hero-heading {
  font-family: var(--bb-font-display);
  font-size: clamp(var(--bb-text-2xl), 4.2vw, var(--bb-text-4xl));
  font-weight: var(--bb-weight-extrabold);
  color: #fff;
  letter-spacing: -0.02em;
  margin: 0;
  line-height: 1.08;
  text-shadow: 0 2px 12px rgb(0 0 0 / 0.35);
  max-width: 18ch;
}

.hero-sub {
  color: rgb(255 255 255 / 0.9);
  font-size: var(--bb-text-md);
  margin: 0;
  max-width: 52ch;
  line-height: 1.55;
  text-shadow: 0 1px 6px rgb(0 0 0 / 0.4);
}

.hero-actions {
  display: flex;
  gap: 0.625rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
}

/* Lime carries dark ink (10.66:1); the glass button sits on the
   photograph so it needs a light fill with a visible edge. */
.btn-lime {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 1.15rem;
  border: none;
  border-radius: var(--bb-radius-pill);
  background: var(--bb-accent);
  color: var(--bb-on-accent);
  font-family: var(--bb-font-body);
  font-size: var(--bb-text-sm);
  font-weight: var(--bb-weight-bold);
  cursor: pointer;
  transition: transform 0.2s var(--bb-ease);
}
.btn-lime:hover { transform: translateY(-2px); }

.btn-glass {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 1.15rem;
  border-radius: var(--bb-radius-pill);
  background: rgb(255 255 255 / 0.16);
  border: 1px solid rgb(255 255 255 / 0.4);
  color: #fff;
  font-family: var(--bb-font-body);
  font-size: var(--bb-text-sm);
  font-weight: var(--bb-weight-bold);
  cursor: pointer;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: background 0.2s var(--bb-ease), transform 0.2s var(--bb-ease);
}
.btn-glass:hover { background: rgb(255 255 255 / 0.26); transform: translateY(-2px); }

/* Stats sit on the photograph, so they are translucent chips rather than
   opaque cards — an opaque white box here would break the image. */
.hero-stats {
  position: absolute;
  z-index: 2;
  top: clamp(1rem, 2vw, 1.5rem);
  right: clamp(1rem, 2vw, 1.5rem);
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.hero-stat {
  text-align: center;
  padding: 0.5rem 0.9rem;
  border-radius: var(--bb-radius-md);
  background: rgb(255 255 255 / 0.14);
  border: 1px solid rgb(255 255 255 / 0.28);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.hs-val {
  font-family: var(--bb-font-display);
  font-size: var(--bb-text-xl);
  font-weight: var(--bb-weight-extrabold);
  color: #fff;
  letter-spacing: -0.02em;
  line-height: 1;
}

.hs-label {
  font-size: var(--bb-text-2xs);
  color: rgb(255 255 255 / 0.85);
  text-transform: uppercase;
  letter-spacing: var(--bb-track-wide);
  font-weight: var(--bb-weight-bold);
  margin-top: 3px;
  white-space: nowrap;
}

/* ═══════════ WEATHER IN BACO ═══════════ */
/* Weather card is MINIMAL FLAT, supplied by the `flat` utility in the
   template. Only the overflow clip is kept here — it has no utility. */
.weather-card {
    overflow: hidden;
  }


/* .weather-card supplies the glass now, so its children must not
   stack a second fill and border on top of it. */
.weather-card > .glass,
.weather-card > .weather-body {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}

.weather-body {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  background: var(--bb-glass-bg);
  box-shadow: var(--bb-glass-shadow);
  padding: 0.9rem 1.1rem;
}

.weather-main-row {
  display: flex;
  align-items: stretch;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.weather-now {
  flex: 1;
  min-width: 260px;
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* Icon well is a MOULDED recess (skeuo-well in the template).
   Only the fixed footprint and the icon size live here. */
.wrn-icon {
    width: 64px;
    height: 64px;
    border-radius: var(--bb-radius-lg);
  }
  .wrn-icon > svg { width: 34px; height: 34px; }


.wrn-info {
  display: flex;
  flex-direction: column;
}

.wrn-temp {
  font-family: var(--bb-font-display);
  font-size: var(--bb-text-4xl);
  font-weight: var(--bb-weight-extrabold);
  color: var(--bb-ink);
  letter-spacing: -0.03em;
  line-height: 1;
}

.wrn-temp sup { font-size: var(--bb-text-xl); }

.wrn-label {
  font-size: var(--bb-text-base);
  font-weight: var(--bb-weight-bold);
  color: var(--bb-ink);
  margin-top: 2px;
}

.wrn-loc {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: var(--bb-text-xs);
  color: var(--muted);
  margin-top: 2px;
}

.wrn-metrics {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-left: auto;
  justify-content: center;
}


/* Metric pill is a MOULDED key (skeuo-sm in the template). */
.wrn-metric {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--bb-text-sm);
    color: var(--bb-ink);
    border-radius: var(--bb-radius-sm);
    padding: 0.4rem 0.75rem;
    white-space: nowrap;
  }


.weather-days {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
  flex-wrap: wrap;
  min-width: 120px;
}

/* A day key is the clearest SKEUOMORPHIC case in the app: it is
   pressable, so it gets the moulded treatment (skeuo utility + the
   active: pressed state in the template). Only the flex geometry,
   the minimum width and the state rules stay here — the face, border
   and shadow all come from the utility, because scoped CSS at 0,2,0
   would otherwise beat a Tailwind utility at 0,1,0. */
.wday {
  flex: 1;
  min-width: 74px;
  gap: 4px;
  padding: 0.65rem 0.5rem;
  text-align: center;
  transition: all 0.18s ease;
  user-select: none;
}

.wday:hover {
  background-image: var(--gradient-skeuo-face-hi);
}

/* Selected day — Travelio's active-tab treatment: mint on deep text */
.wday-active {
  background-image: none;
  background-color: var(--bb-accent);
  border-color: var(--bb-accent);
  box-shadow: var(--shadow-skeuo-pressed);
}

.wday-active .wday-name,
.wday-active .wday-high,
.wday-active .wday-low,
.wday-active .wh-time,
.wday-active .wh-pop,
.wday-active .wh-temp {
  color: var(--bb-on-accent);
}

.wday-name {
  font-size: var(--bb-text-2xs);
  font-weight: var(--bb-weight-extrabold);
  color: var(--bb-ink);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.wday-pops {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: var(--bb-text-2xs);
  color: var(--bb-info);
  font-weight: var(--bb-weight-bold);
}

.wday-temps {
  display: flex;
  gap: 4px;
  font-size: var(--bb-text-xs);
}

.wday-high { font-weight: var(--bb-weight-extrabold); color: var(--bb-ink); }
.wday-low { font-weight: var(--bb-weight-regular); color: var(--muted); }

/* ── Tap hint (default state only) ── */
.wd-hint {
  font-size: var(--bb-text-2xs);
  font-weight: var(--bb-weight-semibold);
  color: var(--muted);
  text-align: center;
  letter-spacing: 0.02em;
}

/* ── Selected day detail panel ── */
.wday-detail {
  border: 1px solid var(--line);
  border-radius: var(--bb-radius-md);
  background: var(--tint);
  padding: 1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.wd-head {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.wd-head-info { flex: 1; min-width: 0; }

.wd-title {
  font-family: var(--bb-font-display);
  font-size: var(--bb-text-md);
  font-weight: var(--bb-weight-extrabold);
  color: var(--bb-ink);
  letter-spacing: -0.01em;
}

.wd-cond {
  font-size: var(--bb-text-xs);
  color: var(--muted);
  font-weight: var(--bb-weight-semibold);
}

.wd-hilo {
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-size: var(--bb-text-xl);
  font-family: var(--bb-font-display);
  font-weight: var(--bb-weight-extrabold);
  color: var(--bb-ink);
}

.wd-hilo .wday-low { font-size: var(--bb-text-md); font-weight: var(--bb-weight-medium); }
.wd-hilo-sep { color: var(--muted); font-weight: var(--bb-weight-regular); }

.wd-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.5rem;
}

.wd-chip {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 0.55rem 0.7rem;
  border-radius: var(--bb-radius-sm);
  background: var(--bb-surface);
  border: 1px solid var(--line);
}

.wdc-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--bb-text-2xs);
  font-weight: var(--bb-weight-extrabold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

.wdc-val {
  font-size: var(--bb-text-base);
  font-weight: var(--bb-weight-extrabold);
  color: var(--bb-ink);
  line-height: 1.2;
}

/* ── Next 12 hours strip ── */
.weather-hours {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--line);
}

.wh-heading {
  font-size: var(--bb-text-2xs);
  font-weight: var(--bb-weight-extrabold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.wh-strip {
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  padding-bottom: 2px;
}

.whour {
  flex: 1;
  min-width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0.5rem 0.35rem;
  border-radius: var(--bb-radius-sm);
  background: var(--tint);
  border: 1px solid var(--line);
  text-align: center;
}

.whour-wet {
  background: var(--bb-info-soft);
  border-color: var(--line-strong);
}

.wh-time {
  font-size: var(--bb-text-2xs);
  font-weight: var(--bb-weight-bold);
  color: var(--muted);
  text-transform: uppercase;
}

.wh-pop {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: var(--bb-text-2xs);
  font-weight: var(--bb-weight-bold);
  color: var(--muted);
}

.whour-wet .wh-pop { color: var(--bb-info); }

.wh-temp {
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-extrabold);
  color: var(--bb-ink);
}

.weather-loading,
.weather-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
  color: var(--muted);
  font-size: var(--bb-text-base);
  border-radius: var(--bb-radius-lg);
}

.wl-spinner {
  width: 22px;
  height: 22px;
  border: 2px solid var(--bb-glass-border);
  border-top-color: var(--bb-accent);
  border-radius: 50%;
  animation: spin .8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ═══════════ DESTINATION CARDS ═══════════
   The photo, the frame and the card shell come from the photo-card /
   photo-frame utilities. What stays here is the caption type and the
   type badge, which have no utility equivalent. */
.dest-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 1rem;
}

.dest-card { cursor: pointer; }
.dest-card:hover { transform: translateY(-4px); box-shadow: var(--bb-shadow-lg); }
.dest-card:hover .photo-hero-img { transform: scale(1.06); }

/* The card whose photograph is currently in the hero. The lime ring is the
   brand accent at full strength, used nowhere else on the page - it is the
   only element that needs to say 'this one is showing above'. */
.dest-card-active {
  border-color: var(--bb-accent);
  box-shadow: 0 0 0 2px var(--bb-accent), var(--bb-shadow-lg);
}

.dest-card-frame { aspect-ratio: 3 / 2; }

/* A destination with no photograph still needs to occupy its slot
   gracefully rather than collapsing. */
.dest-card-blank {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--bb-bg-subtle), var(--bb-accent-soft));
  color: var(--bb-text-tertiary);
}

.dest-card-type {
  position: absolute;
  top: 0.625rem;
  left: 0.625rem;
  z-index: 1;
  padding: 0.3rem 0.55rem;
  border-radius: var(--bb-radius-pill);
  /* The glass token, not a literal white. This chip's TEXT is var(--bb-ink),
     which flips to a light value in dark mode -- so a hardcoded white
     background put light text on a white chip and made the label disappear.
     --color-glass-strong already resolves per theme, so the pair stays
     legible in both. */
  background: var(--color-glass-strong, rgb(255 255 255 / 0.9));
  color: var(--bb-ink);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.dest-card-body {
  padding: 0.75rem 0.85rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}

.dest-card-name {
  font-family: var(--bb-font-display);
  font-size: var(--bb-text-lg);
  font-weight: var(--bb-weight-bold);
  color: var(--bb-ink);
  margin: 0;
  line-height: 1.2;
}

.dest-card-region {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--bb-text-xs);
  color: var(--bb-text-tertiary);
  margin: 0;
}

.dest-card-tagline {
  font-size: var(--bb-text-sm);
  color: var(--bb-text-secondary);
  line-height: 1.5;
  margin: 4px 0 0;
}

/* ═══════════ TRIP STRIP ═══════════
   The account state that used to be four stat cards, now one compact
   row so it informs rather than leads. */
.trip-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.25rem;
  padding: 0.5rem;
  border-radius: var(--bb-radius-lg);
}

.trip-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.7rem;
  border: none;
  background: transparent;
  border-radius: var(--bb-radius-md);
  text-align: left;
  cursor: pointer;
  font-family: var(--bb-font-body);
  transition: background var(--bb-dur-fast) var(--bb-ease);
}
.trip-item:hover { background: var(--bb-bg-subtle); }
.trip-item--static { cursor: default; }
.trip-item--static:hover { background: transparent; }

.trip-icon {
  width: 34px;
  height: 34px;
  border-radius: var(--bb-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ti-hotels { background: var(--bb-accent-soft);  color: var(--bb-accent-ink); }
.ti-stays  { background: var(--bb-success-soft); color: var(--bb-success); }
.ti-permit { background: var(--bb-warning-soft); color: var(--bb-warning); }
.ti-trail  { background: var(--bb-info-soft);    color: var(--bb-info); }

.trip-text { display: flex; flex-direction: column; min-width: 0; }
.trip-text b {
  font-size: var(--bb-text-base);
  font-weight: var(--bb-weight-bold);
  color: var(--bb-ink);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.trip-text span {
  font-size: var(--bb-text-2xs);
  color: var(--bb-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}


/* ═══════════ SECTION BLOCKS ═══════════ */
.section-block {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
  padding: 0 0.25rem;
}

.section-title {
  font-family: var(--bb-font-display);
  font-size: var(--bb-text-2xl);
  font-weight: var(--bb-weight-extrabold);
  color: var(--bb-ink);
  letter-spacing: -0.02em;
  margin: 0;
  line-height: 1.1;
}

.section-sub {
  font-size: var(--bb-text-sm);
  color: var(--bb-text-secondary);
  margin: 4px 0 0;
}

.view-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--eco-mint);
  color: var(--bb-on-highlight);
  -webkit-text-fill-color: var(--bb-on-highlight);
  border: none;
  border-radius: var(--bb-radius-full);
  padding: 0.55rem 1.15rem;
  font-family: var(--bb-font-body);
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-extrabold);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--bb-dur-fast) var(--bb-ease);
  box-shadow: var(--mint-shadow);
}

.view-all-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--mint-shadow-lg);
}

.section-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 2rem;
  color: var(--bb-text-secondary);
  font-size: var(--bb-text-base);
}

.section-empty svg { color: var(--bb-text-tertiary); }

/* ═══════════ HOTEL GRID ═══════════ */
.hotel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
}

.hotel-card {
  background: var(--bb-surface);
  border: 1px solid var(--line);
  border-radius: var(--bb-radius-lg);
  overflow: hidden;
  cursor: pointer;
  box-shadow: var(--bb-shadow-md);
  transition: all var(--bb-dur-base) var(--bb-ease);
}

.hotel-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--bb-shadow-lg);
  border-color: var(--line-strong);
}

.hc-image {
  position: relative;
  aspect-ratio: 16/10;
  background: var(--bb-bg-subtle);
  overflow: hidden;
}

.hc-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.5s var(--bb-ease);
}

.hotel-card:hover .hc-image img {
  transform: scale(1.06);
}

.hc-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--bb-text-tertiary);
}

.hc-badges {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 6px;
}

.hc-badge {
  padding: 4px 10px;
  border-radius: var(--bb-radius-full);
  font-size: var(--bb-text-2xs);
  font-weight: var(--bb-weight-extrabold);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* Travelio pill-lime, plus a deep pill for the alternate variant */
.hc-badge.tour {
  background: var(--eco-mint);
  color: var(--bb-on-highlight);
  -webkit-text-fill-color: var(--bb-on-highlight);
}

.hc-badge.stay {
  background: var(--eco-deepest);
  color: var(--eco-pale);
  -webkit-text-fill-color: var(--eco-pale);
}

.hc-body {
  padding: 1rem 1.15rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.hc-name {
  font-family: var(--bb-font-display);
  font-size: var(--bb-text-lg);
  font-weight: var(--bb-weight-bold);
  color: var(--bb-ink);
  margin: 0;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.hc-location {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--bb-text-xs);
  color: var(--bb-text-secondary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hc-meta {
  display: flex;
  gap: 12px;
  font-size: var(--bb-text-2xs);
  color: var(--bb-text-secondary);
  margin: 0.2rem 0 0;
}

.hc-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hc-footer {
  margin-top: 0.65rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--bb-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hc-price { display: flex; align-items: baseline; gap: 4px; }

.price-val {
  font-family: var(--bb-font-display);
  font-size: var(--bb-text-lg);
  font-weight: var(--bb-weight-extrabold);
  color: var(--bb-ink);
}

.price-label {
  font-size: var(--bb-text-2xs);
  color: var(--bb-text-secondary);
}

.hc-view-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--eco-mint);
  color: var(--bb-on-highlight);
  -webkit-text-fill-color: var(--bb-on-highlight);
  border-radius: var(--bb-radius-full);
  padding: 0.35rem 0.85rem;
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-extrabold);
  box-shadow: var(--mint-shadow);
  transition: transform var(--bb-dur-fast) var(--bb-ease);
}

.hotel-card:hover .hc-view-btn {
  transform: translateY(-1px);
}

/* ═══════════ UPCOMING STAYS ═══════════ */
.stays-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.stay-card {
  background: var(--bb-surface);
  border: 1px solid var(--line);
  border-radius: var(--bb-radius-md);
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: var(--bb-shadow-md);
  transition: all var(--bb-dur-base) var(--bb-ease);
}

.stay-card:hover {
  border-color: var(--line-strong);
  box-shadow: var(--bb-shadow-lg);
}

.sc-thumb {
  width: 56px;
  height: 56px;
  border-radius: var(--bb-radius-sm);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bb-bg-subtle);
}

.sc-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sc-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--bb-text-tertiary);
}

.sc-info { flex: 1; min-width: 0; }

.sc-name {
  font-size: var(--bb-text-md);
  font-weight: var(--bb-weight-bold);
  color: var(--bb-ink);
  margin: 0 0 3px;
}

.sc-dates {
  font-size: var(--bb-text-xs);
  color: var(--bb-text-secondary);
  margin: 0 0 2px;
}

.sc-type {
  font-size: var(--bb-text-xs);
  color: var(--bb-text-tertiary);
  margin: 0;
}

.sc-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
}

.status-badge {
  padding: 3px 10px;
  border-radius: var(--bb-radius-full);
  font-size: var(--bb-text-2xs);
  font-weight: var(--bb-weight-bold);
  white-space: nowrap;
}

.badge-success { background: var(--bb-success-soft); color: var(--bb-success); }
.badge-warning { background: var(--bb-warning-soft); color: var(--bb-warning); }
.badge-info    { background: var(--bb-info-soft);    color: var(--bb-info); }
.badge-danger  { background: var(--bb-danger-soft);  color: var(--bb-danger); }
.badge-neutral { background: var(--bb-neutral-soft); color: var(--bb-neutral); }

.sc-price {
  font-family: var(--bb-font-display);
  font-size: var(--bb-text-lg);
  font-weight: var(--bb-weight-extrabold);
  color: var(--bb-accent-ink);
}

/* ═══════════ QUICK ACTIONS ═══════════ */
.actions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

      /* Glass fill/border/blur from .glass-panel, defined at the end of this
         file's <style> block. */

.action-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  padding: 1.15rem;
  cursor: pointer;
  font-family: var(--bb-font-body);
  text-align: left;
  color: var(--bb-ink);
  overflow: hidden;
  box-shadow: var(--bb-shadow-md);
  transition: all var(--bb-dur-base) var(--bb-ease);
}

.action-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--bb-shadow-lg);
  border-color: var(--line-strong);
}

/* Soft square icon tile — the Travelio menu treatment */
.action-card > svg:first-child {
  width: 44px;
  height: 44px;
  padding: 11px;
  border-radius: 14px;
  background: var(--tint);
  color: var(--bb-text-tertiary);
  margin-bottom: 0.35rem;
  transition: all var(--bb-dur-base) var(--bb-ease);
}

.action-card:hover > svg:first-child {
  background: var(--eco-mint);
  color: var(--eco-deepest);
}

.ac-permit > svg:first-child { background: var(--bb-warning-soft); color: var(--bb-warning); }
.ac-map    > svg:first-child { background: var(--bb-info-soft);    color: var(--bb-info); }
.ac-explore > svg:first-child { background: var(--bb-success-soft); color: var(--bb-success); }

.ac-label {
  font-size: var(--bb-text-md);
  font-weight: var(--bb-weight-extrabold);
  line-height: 1.2;
  color: var(--bb-ink);
}

.ac-desc {
  font-size: var(--bb-text-xs);
  color: var(--bb-text-secondary);
  line-height: 1.4;
}

.ac-arrow {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  color: var(--faint);
  opacity: 0.6;
  transition: all var(--bb-dur-fast) var(--bb-ease);
}

.action-card:hover .ac-arrow {
  color: var(--bb-text-tertiary);
  opacity: 1;
  transform: translateX(3px);
}

/* ═══════════ ACTIVITY TIMELINE ═══════════ */
.activity-timeline {
  margin-left: 0.5rem;
  background: var(--bb-glass-bg);
  border: 1px solid var(--line);
  border-left: 3px solid var(--eco-mint);
  border-radius: var(--bb-radius-lg);
  padding: 1.5rem 0 1.5rem 2rem;
  box-shadow: var(--bb-glass-shadow);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.timeline-item {
  padding-left: 1.4rem;
  position: relative;
}

.tl-dot {
  position: absolute;
  left: -18px;
  top: 0.1rem;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--bb-surface);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tl-title {
  font-size: var(--bb-text-base);
  font-weight: var(--bb-weight-semibold);
  color: var(--bb-ink);
  margin: 0;
}

.tl-time {
  font-size: var(--bb-text-xs);
  color: var(--bb-text-secondary);
  margin: 2px 0 0;
}

/* ═══════════ TRAIL TIP ═══════════ */
.tip-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--bb-highlight-soft);
  border: 1px solid var(--bb-highlight);
  border-radius: var(--bb-radius-lg);
  padding: 0.9rem 1.1rem;
  box-shadow: var(--bb-glass-shadow);
}

.tip-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: var(--bb-radius-full);
  background: var(--eco-mint);
  color: var(--eco-deepest);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tip-content {
  flex: 1;
}

.tip-content h3 {
  font-family: var(--bb-font-display);
  font-size: var(--bb-text-md);
  font-weight: var(--bb-weight-extrabold);
  color: var(--bb-ink);
  margin: 0 0 4px;
}

.tip-content p {
  font-size: var(--bb-text-sm);
  color: var(--bb-text-secondary);
  margin: 0;
  line-height: 1.5;
}

.tip-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--eco-deepest);
  color: var(--eco-pale);
  -webkit-text-fill-color: var(--eco-pale);
  border: none;
  border-radius: var(--bb-radius-full);
  padding: 0.55rem 1.1rem;
  font-family: var(--bb-font-body);
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-extrabold);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all var(--bb-dur-fast) var(--bb-ease);
  box-shadow: var(--bb-shadow-lg);
}

.tip-btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--bb-shadow-lg);
}

/* ═══════════ RESPONSIVE ═══════════ */
@media (max-width: 1024px) {
  /* re-bleed to match .page-content's tighter padding + bottom dock */
  .dashboard-content {
    margin: -1.25rem -1.25rem calc(-1 * (var(--bb-dock-h) + 32px + env(safe-area-inset-bottom, 0px)));
    padding: 1.25rem 1.25rem calc(var(--bb-dock-h) + 32px + env(safe-area-inset-bottom, 0px));
  }
  .dest-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .trip-strip { grid-template-columns: repeat(2, 1fr); }
  .actions-grid { grid-template-columns: repeat(2, 1fr); }
  .hero-stats { justify-content: flex-start; }
  .weather-now { flex-direction: column; align-items: flex-start; }
  .wrn-metrics { flex-direction: row; flex-wrap: wrap; margin-left: 0; }
}

@media (max-width: 640px) {
  .dest-grid { grid-template-columns: 1fr; }
  .trip-strip { grid-template-columns: 1fr; }
  .actions-grid { grid-template-columns: 1fr; }
  .hotel-grid { grid-template-columns: 1fr; }
 /* ── HERO: stack instead of crop ── (same rationale as owner dashboard) */
.hero-banner {
  min-height: 0;
  height: auto;
  display: block;
}
.hero-banner .photo-hero-img {
  position: static;
  display: block;
  width: 100%;
  height: auto;
  max-height: 300px;
  object-fit: contain;
  background: var(--bb-bg-subtle);
}
.hero-banner .photo-scrim { display: none; }

.hero-content { padding: 1rem 1.1rem 0.5rem; }
.hero-heading { color: var(--bb-ink); text-shadow: none; }
.hero-sub { color: var(--bb-text-secondary); text-shadow: none; }
.hero-eyebrow.photo-eyebrow { color: var(--bb-text-tertiary); text-shadow: none; }

/* Glass-on-photo pieces restyled for the surface */
.btn-glass {
  background: var(--bb-bg-subtle);
  border-color: var(--bb-border);
  color: var(--bb-ink);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.btn-glass:hover { background: var(--card2, var(--bb-bg-subtle)); }

.hero-stats {
  position: static;
  justify-content: flex-start;
  margin-top: 0.25rem;
  padding: 0 1.1rem 1.25rem;
}
.hero-stat {
  background: var(--bb-bg-subtle);
  border-color: var(--bb-border);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.hs-val { color: var(--bb-ink); }
.hs-label { color: var(--bb-text-tertiary); }
  .section-header { flex-direction: column; align-items: flex-start; }
  .view-all-btn { width: 100%; justify-content: center; }
  .tip-banner { flex-direction: column; text-align: center; }
  .tip-btn { width: 100%; justify-content: center; }
  .stay-card { flex-wrap: wrap; }
  .sc-right { align-items: flex-start; }
  .weather-body { padding: 1rem; }
  .weather-now { min-width: 0; }
}

@media (max-width: 480px) {
  .dashboard-content {
    margin: -0.875rem -0.875rem calc(-1 * (var(--bb-dock-h) + 28px + env(safe-area-inset-bottom, 0px)));
    padding: 0.875rem 0.875rem calc(var(--bb-dock-h) + 28px + env(safe-area-inset-bottom, 0px));
  }
  /* 240px left almost nothing for the photograph once the cover is
     cropped to a narrow box and the caption takes the lower third.
     300px gives the image room to be the subject. */
  .hero-banner { min-height: 300px; }
  .hero-heading { max-width: 100%; }
  .hero-stat { padding: 0.4rem 0.6rem; }
  .hs-val { font-size: var(--bb-text-base); }
  .dest-card-body { padding: 0.6rem 0.7rem 0.75rem; }
  .dest-card-name { font-size: var(--bb-text-base); }
  .dest-card-tagline { display: none; }
  .action-card { padding: 1rem; }
  .ac-label { font-size: var(--bb-text-base); }
  .hc-body { padding: 0.75rem 0.9rem 0.9rem; }
  .hc-meta { gap: 8px; }
  .stay-card { padding: 0.875rem; gap: 0.75rem; }
  .sc-thumb { width: 48px; height: 48px; }
  .tip-banner { padding: 1rem; }
  .view-all-btn { padding: 0.5rem 1rem; }
  .timeline-item { padding-left: 0.75rem; }
  .tl-dot { width: 24px; height: 24px; left: -16px; }
  /* The weather widget's own small-screen rules live in the dedicated
     WEATHER — SMALL SCREENS section below, so they stay in one place. */
  .wh-strip { gap: 0.3rem; }
}

/* ═══════════ WEATHER — SMALL SCREENS ═══════════
   The widget carries the most content on the dashboard: a 3-metric block,
   a 7-day strip and 10 detail chips. On a phone that all competes for the
   same ~330px, so each tier shrinks the fixed-size furniture and lets the
   day strip scroll rather than wrapping into 3 ragged rows.

   Declared after the general breakpoints so it wins on equal specificity. */
@media (max-width: 640px) {
  .weather-body { padding: 0.875rem; }
  .weather-main-row { gap: 0.875rem; }

  /* "Now" block: the 64px tile and 36px temperature were sized for desktop */
  .wrn-icon { width: 48px; height: 48px; border-radius: var(--bb-radius-md); }
  .wrn-icon > svg { width: 24px; height: 24px; }
  .wrn-temp { font-size: var(--bb-text-3xl); }
  .wrn-metrics { gap: 0.35rem; width: 100%; }
  .wrn-metric {
    padding: 0.3rem 0.5rem;
    font-size: var(--bb-text-2xs);
    gap: 0.3rem;
  }
  .wrn-metric svg { width: 11px; height: 11px; }

  /* 7 days never fit at this width — scroll them instead of wrapping */
  .weather-days {
    flex-wrap: nowrap;
    overflow-x: auto;
    min-width: 0;
    width: 100%;
    padding-bottom: 2px;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .weather-days::-webkit-scrollbar { display: none; }
  .wday { flex: 0 0 auto; min-width: 62px; padding: 0.5rem 0.4rem; }

  /* 10 chips at 2-up is still 5 rows; tighten rather than stack deeper */
  .wd-grid { gap: 0.35rem; }
  .wd-chip { padding: 0.45rem 0.5rem; gap: 2px; }
  .wday-detail { padding: 0.75rem; }
  .wd-hint { font-size: var(--bb-text-2xs); }
}

@media (max-width: 480px) {
  /* Stack the tile beside a smaller reading rather than letting the
     temperature dominate a phone screen */
  .wrn-icon { width: 40px; height: 40px; border-radius: var(--bb-radius-sm); }
  .wrn-icon > svg { width: 20px; height: 20px; }
  .wrn-temp { font-size: var(--bb-text-2xl); }
  .wrn-label { font-size: var(--bb-text-sm); }
  .wrn-loc { font-size: var(--bb-text-2xs); }

  /* Three metrics across is tighter than three stacked pills */
  .wrn-metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.25rem;
  }
  .wrn-metric {
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 0.35rem 0.15rem;
    text-align: center;
  }
  .wrn-metric span { font-size: var(--bb-text-2xs); line-height: 1.2; }

  .wday { min-width: 58px; padding: 0.45rem 0.3rem; gap: 3px; }
  .wday > svg { width: 17px; height: 17px; }
  .wd-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .whour { min-width: 48px; padding: 0.4rem 0.25rem; }
  .wh-time, .wh-temp { font-size: var(--bb-text-2xs); }
}

@media (max-width: 380px) {
  /* Below this the 3-up metrics truncate ("Feels like 31°" does not fit),
     so drop to a single wrapped row of small pills instead. The detail
     chips stay 2-up even here — one column would mean a 10-row scroll. */
  .wrn-metrics { grid-template-columns: 1fr; gap: 0.2rem; }
  .wrn-metric { flex-direction: row; justify-content: flex-start; text-align: left; padding: 0.3rem 0.45rem; }
  .wday { min-width: 54px; }
  .wd-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

/* Content glass: panels that scroll with the page. Scoped here because the
   stat/action cards that consume it are declared in this file. */
.glass-panel {
  background: var(--bb-surface);
  border: 1px solid var(--bb-border);
  border-radius: var(--bb-radius-lg);
  box-shadow: var(--bb-shadow-sm);
}

/* Users who ask for reduced transparency get solid panels instead.
   The shell chrome handles its own surfaces in UserLayout.vue (unscoped,
   since it must also reach .eco-sidebar / .header-glass). This block
   covers only the dashboard's own panels, and drops the backdrop-filter
   on the tip banner's decorative child as well. */
@media (prefers-reduced-transparency: reduce) {
  .hero-banner,
  .weather-card,
  .trip-item,
  .action-card,
  .tip-banner {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    background: var(--bb-surface) !important;
  }
  .tip-banner { background: var(--bb-bg-subtle) !important; }
  .tip-banner::before { display: none !important; }
}
</style>
