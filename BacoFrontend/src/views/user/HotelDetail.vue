<template>
  <div class="cw">
    <div v-if="!selectedHotel" class="eg">
      <p>No hotel selected.</p>
      <button @click="router.push('/user/hotels')" class="bl">← Back to Hotels</button>
    </div>

    <template v-else>
      <button @click="router.push('/user/hotels')" class="bl">← Back to Search</button>

      <div class="ld">
        <div class="dm">
          <div class="gy">
            <div class="gm">
              <img :src="gallery[0]" alt="Main" />
              <div v-if="avgRating" class="rb"><Star size="16" class="sti" /> {{ avgRating }} <span class="rb-cnt">{{ reviewCount }}</span></div>
            </div>
            <div class="gs">
              <img v-if="gallery[1]" :src="gallery[1]" alt="Gallery 1" />
              <div v-if="gallery[2]" class="gm2">
                <img :src="gallery[2]" alt="Gallery 2" />
              </div>
            </div>
          </div>

          <div class="ic">
            <h1 class="ht">{{ selectedHotel.name }}</h1>
            <p class="loc"><MapPin size="16" /> {{ selectedHotel.location }}</p>
            <div class="ib">
              <h3 class="sh">About this place</h3>
              <p class="tm">{{ selectedHotel.description }}</p>
            </div>
            <div v-if="selectedHotel.amenities?.length" class="ib">
              <h3 class="sh">What this place offers</h3>
              <div class="ag">
                <div v-for="(am, i) in selectedHotel.amenities" :key="i" class="ar"><CheckSquare size="18" class="ai" /><span>{{ am }}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div class="ds">
          <div class="sc">
            <h3 class="sh">Select a Room</h3>
            <div v-if="!selectedHotel.rooms?.length" class="nor">No rooms available yet.</div>
            <div v-else class="rl">
              <div v-for="rt in selectedHotel.rooms" :key="rt.id" class="rc">
                <img :src="rt.image || 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=300&q=80'" :alt="rt.name" class="ri" />
                <div class="rb2">
                  <div class="rh">
                    <h4 class="rn">{{ rt.name }}</h4>
                    <span class="rpr">₱{{ rt.price.toLocaleString() }}</span>
                  </div>
                  <p class="rcap"><Users size="12" /> Up to {{ rt.capacity }} Guests · {{ rt.totalCount }} unit{{ rt.totalCount > 1 ? 's' : '' }}</p>
                  <div v-if="rt.amenities?.length" class="ram">
                    <span v-for="a in rt.amenities.slice(0, 3)" :key="a" class="rat">{{ a }}</span>
                  </div>
                  <button @click="handleBookRoom(rt)" class="bb">Select & Book</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

        <section class="rv">
          <div class="rv-head">
            <div class="rv-title">
              <h2 class="sh2">Comments &amp; Ratings</h2>
              <div class="rv-summary">
                <span v-if="avgRating" class="rv-avg"><Star size="18" class="sti" /> {{ avgRating }}</span>
                <span class="rv-count">{{ reviewCount }} review{{ reviewCount === 1 ? '' : 's' }}</span>
              </div>
            </div>
            <button class="wb" @click="goReview">{{ isLoggedIn ? 'Rate this resort' : 'Log in to review' }}</button>
          </div>

          <div v-if="reviewsLoading" class="nor">Loading comments…</div>
          <div v-else-if="reviewsError" class="nor">{{ reviewsError }}</div>
          <div v-else-if="reviews.length === 0" class="nor">No comments yet — be the first to review this destination.</div>
          <div v-else class="rvl">
            <div v-for="r in reviews" :key="r.id" class="rvc">
              <div class="rva">{{ reviewerInitials(r.reviewer_name) }}</div>
              <div class="rvbody">
                <div class="rvmeta">
                  <span class="rvname">{{ r.reviewer_name }}</span>
                  <span class="rvstars"><Star v-for="n in r.rating" :key="n" size="13" class="sti" /></span>
                  <span class="rvdate">{{ fmtDate(r.created_at) }}</span>
                </div>
                <h5 v-if="r.title" class="rvtitle">{{ r.title }}</h5>
                <p class="rvcontent">{{ r.content }}</p>
              </div>
            </div>
          </div>
        </section>
      </template>
    </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBookingStore } from '../../stores/useBookingStore'
import { useUserStore } from '../../stores/useUserStore'
import { Star, MapPin, CheckSquare, Users } from 'lucide-vue-next'

const API = 'http://localhost:3000/api'

const router = useRouter()
const store = useBookingStore()
const userStore = useUserStore()

const selectedHotel = computed(() => store.selectedHotel)

const gallery = computed(() => {
  if (!selectedHotel.value) return []
  const g = selectedHotel.value.gallery || []
  if (g.length === 0 && selectedHotel.value.image) return [selectedHotel.value.image]
  return g
})

// ── Comments & Ratings ──
const reviews = ref([])
const reviewsLoading = ref(false)
const reviewsError = ref('')

const avgRating = computed(() => selectedHotel.value?.avgRating ?? null)
const reviewCount = computed(() => selectedHotel.value?.reviewCount ?? 0)
const isLoggedIn = computed(() => !!userStore.token)

function reviewerInitials(name) {
  if (!name) return '?'
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(String(d).slice(0, 10)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

async function fetchReviews() {
  const id = selectedHotel.value?.id
  if (!id) return
  reviewsLoading.value = true
  reviewsError.value = ''
  try {
    const res = await fetch(`${API}/hotels/${id}/reviews`)
    if (!res.ok) throw new Error('Failed to load comments.')
    const data = await res.json()
    reviews.value = Array.isArray(data) ? data : []
  } catch (e) {
    reviewsError.value = e.message
  } finally {
    reviewsLoading.value = false
  }
}

function goReview() {
  const id = selectedHotel.value?.id
  if (!id) return
  if (userStore.token) {
    router.push(`/user/reviews?hotel=${id}`)
  } else {
    router.push(`/auth?redirect=${encodeURIComponent(`/user/hotels/${id}`)}`)
  }
}

onMounted(fetchReviews)

function handleBookRoom(room) {
  store.selectRoom(room.id)
  router.push(`/user/hotels/${selectedHotel.value.id}/book`)
}
</script>

<style scoped>
*{box-sizing:border-box;margin:0;padding:0}
.cw{max-width:1152px;margin:0 auto;display:flex;flex-direction:column;gap:1.5rem;font-family:var(--bb-font-body);color:var(--bb-ink)}
.bl{color:var(--bb-text-secondary);font-weight: var(--bb-weight-semibold);font-size: var(--bb-text-base);background:none;border:none;cursor:pointer;padding:0;font-family:var(--bb-font-body)}
.bl:hover{text-decoration:underline;color:var(--bb-accent-ink)}
.eg{text-align:center;padding:3rem;color:var(--bb-text-secondary);display:flex;flex-direction:column;align-items:center;gap:1rem}
.ld{display:flex;gap:2rem;align-items:flex-start}
.dm{flex:2;display:flex;flex-direction:column;gap:1.5rem}
.ds{flex:1}
.gy{display:flex;flex-direction:column;gap:.75rem}
.gm{width:100%;height:400px;border-radius:var(--bb-radius-xl);overflow:hidden;position:relative}
.gm img{width:100%;height:100%;object-fit:cover}
.gs{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}
.gs>img{width:100%;height:12rem;border-radius:var(--bb-radius-xl);object-fit:cover}
.gm2{height:12rem;border-radius:var(--bb-radius-xl);overflow:hidden}
.gm2 img{width:100%;height:100%;object-fit:cover}
.rb{position:absolute;top:.75rem;right:.75rem;background:var(--bb-glass-bg-deep);backdrop-filter:blur(8px) saturate(150%);border:1px solid var(--bb-glass-border);padding:.3rem .875rem;border-radius:var(--bb-radius-pill);display:flex;align-items:center;gap:.375rem;font-size: var(--bb-text-base);font-weight: var(--bb-weight-bold);color:var(--bb-ink)}
.sti{color:var(--bb-sun);fill:var(--bb-sun)}
.rb-cnt{font-weight: var(--bb-weight-regular);font-size: var(--bb-text-xs);color:var(--bb-text-secondary)}
.ic{background:var(--bb-surface);border:1px solid var(--bb-border);border-radius:var(--bb-radius-lg);padding:1.1rem;box-shadow:var(--bb-shadow-sm)}
.ht{font-size: var(--bb-text-3xl);font-weight: var(--bb-weight-extrabold);color:var(--bb-ink);margin-bottom:.375rem}
.loc{display:flex;align-items:center;gap:.375rem;font-size: var(--bb-text-base);color:var(--bb-text-secondary);margin-bottom:1.5rem}
.ib{margin-bottom:1.5rem}
.ib:last-child{margin-bottom:0}
.sh{font-size: var(--bb-text-lg);font-weight: var(--bb-weight-bold);color:var(--bb-ink);margin-bottom:.875rem}
.tm{color:var(--bb-text-secondary);font-size: var(--bb-text-base);line-height:1.6}
.ag{display:grid;grid-template-columns:repeat(2,1fr);gap:.625rem}
.ar{display:flex;align-items:center;gap:.5rem;font-size: var(--bb-text-base);color:var(--bb-text-secondary)}
.ai{color:var(--bb-accent-ink);flex-shrink:0}
.sc{background:var(--bb-surface);border:1px solid var(--bb-border);border-radius:var(--bb-radius-lg);padding:1rem;border-top:3px solid var(--bb-accent);box-shadow:var(--bb-shadow-sm);position:sticky;top:1rem}
.nor{text-align:center;padding:2rem;color:var(--bb-text-tertiary);font-size: var(--bb-text-base)}
.rl{display:flex;flex-direction:column;gap:1rem;margin-top:1rem}
.rc{border:1px solid var(--bb-border);border-radius:var(--bb-radius-md);overflow:hidden;background:var(--bb-surface);transition:border-color .2s}
.rc:hover{border-color:var(--bb-accent)}
.ri{width:100%;height:8rem;object-fit:cover}
.rb2{padding:.875rem}
.rh{display:flex;justify-content:space-between;align-items:center;margin-bottom:.375rem}
.rn{font-size: var(--bb-text-base);font-weight: var(--bb-weight-bold);color:var(--bb-ink)}
.rpr{font-size: var(--bb-text-lg);font-weight: var(--bb-weight-extrabold);color:var(--bb-accent-ink)}
.rcap{display:flex;align-items:center;gap:.375rem;font-size: var(--bb-text-xs);color:var(--bb-text-secondary);margin-bottom:.5rem}
.ram{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:.75rem}
.rat{font-size: var(--bb-text-2xs);font-weight: var(--bb-weight-bold);text-transform:uppercase;background:var(--bb-accent-soft);color:var(--bb-accent-ink);padding:2px 6px;border-radius:3px}
.bb{width:100%;padding:.6rem 1rem;background:var(--bb-accent);color:var(--bb-on-accent);font-family:var(--bb-font-body);font-weight: var(--bb-weight-bold);font-size: var(--bb-text-base);border:none;border-radius:.75rem;cursor:pointer;transition:all .2s;box-shadow:var(--bb-shadow-md)}
.bb:hover{background:var(--bb-accent-hover);transform:translateY(-1px);box-shadow:var(--bb-shadow-md)}
.rv{background:var(--bb-surface);border:1px solid var(--bb-border);border-radius:var(--bb-radius-lg);padding:1.1rem;box-shadow:var(--bb-shadow-sm)}
.rv-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1.25rem}
.sh2{font-size: var(--bb-text-xl);font-weight: var(--bb-weight-extrabold);color:var(--bb-ink);margin:0 0 .375rem}
.rv-summary{display:flex;align-items:center;gap:.625rem}
.rv-avg{display:flex;align-items:center;gap:.375rem;font-size: var(--bb-text-xl);font-weight: var(--bb-weight-extrabold);color:var(--bb-ink)}
.rv-count{font-size: var(--bb-text-base);color:var(--bb-text-secondary)}
.wb{padding:.6rem 1.25rem;background:var(--bb-accent);color:var(--bb-on-accent);font-family:var(--bb-font-body);font-weight: var(--bb-weight-bold);font-size: var(--bb-text-base);border:none;border-radius:.75rem;cursor:pointer;transition:all .2s;box-shadow:var(--bb-shadow-md)}
.wb:hover{background:var(--bb-accent-hover);transform:translateY(-1px)}
.rvl{display:flex;flex-direction:column;gap:1rem}
.rvc{display:flex;gap:.875rem;padding:1rem;border:1px solid var(--bb-glass-border);border-radius:var(--bb-radius-lg);background:var(--bb-glass-bg)}
.rva{width:2.5rem;height:2.5rem;border-radius:50%;background:var(--bb-accent-soft);color:var(--bb-accent-ink);display:flex;align-items:center;justify-content:center;font-weight: var(--bb-weight-extrabold);font-size: var(--bb-text-md);flex-shrink:0}
.rvbody{flex:1;min-width:0}
.rvmeta{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.375rem}
.rvname{font-size: var(--bb-text-base);font-weight: var(--bb-weight-bold);color:var(--bb-ink)}
.rvstars{display:inline-flex;align-items:center;gap:1px}
.rvdate{font-size: var(--bb-text-xs);color:var(--bb-text-tertiary)}
.rvtitle{font-size: var(--bb-text-base);font-weight: var(--bb-weight-bold);color:var(--bb-ink);margin:0 0 .25rem}
.rvcontent{font-size: var(--bb-text-base);color:var(--bb-text-secondary);line-height:1.6;margin:0;white-space:pre-wrap;word-break:break-word}
@media(max-width:1024px){.ld{flex-direction:column}.sc{position:static}}
@media(max-width:768px){.ag{grid-template-columns:1fr}.gm{height:240px}.gs>img,.gm2{height:9rem}}
@media(max-width:480px){.cw{gap:0.875rem}.ld{gap:1rem}.ic{padding:1rem}.sc{padding:0.875rem}.gm{height:180px}.gs>img,.gm2{height:6.5rem}.ht{font-size: var(--bb-text-2xl)}.ib{margin-bottom:1rem}.bb{padding:.55rem .875rem}.rv{padding:1rem}.rv-head{flex-direction:column}.wb{width:100%}}
</style>
