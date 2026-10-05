<template>
    <div class="sb-root">
      <div class="fade-in">
        <div class="page-head">
          <h1>My Reviews</h1>
          <p>Rate the resorts you've stayed at — your reviews help fellow travelers.</p>
        </div>
  
        <div v-if="notice.text" class="error-banner" :class="notice.type">{{ notice.text }}</div>
  
        <!-- Loading -->
        <div v-if="loading" class="state-box"><div class="spinner"></div><p>Loading your reviews…</p></div>
  
        <!-- Login gate -->
        <div v-else-if="!userStore.token" class="state-box">
          <div class="state-emoji">🔒</div>
          <p>Please log in to manage your reviews.</p>
          <button class="btn-rose" @click="router.push('/auth')">Log In</button>
        </div>
  
        <div v-else class="rev-grid">
          <!-- LEFT: sections sit directly on the page — no wrapper boxes -->
          <div class="rev-main">
            <!-- Awaiting review -->
            <section class="rsec">
              <h3 class="sec-h">Awaiting your review <span class="count-badge">{{ eligible.length }}</span></h3>
              <div v-if="eligible.length === 0" class="empty-inline">
                No completed stays waiting for a review. Reviews unlock after the resort marks your stay as <b>Completed</b>.
              </div>
              <div v-else class="pend-grid">
                <div
                  v-for="b in eligible"
                  :key="b.id"
                  class="pend-card"
                  :class="{ selected: form.bookingRef === b.id }"
                  @click="startNewReview(b)"
                >
                  <div class="pend-img">
                    <img v-if="b.hotel?.image" :src="b.hotel.image" :alt="b.hotel?.name" loading="lazy" />
                    <div v-else class="pimg-fallback">🏨</div>
                    <span class="pend-cta">Review →</span>
                  </div>
                  <div class="pend-body">
                    <h4>{{ b.hotel?.name }}</h4>
                    <p>{{ fmtShort(b.details?.checkIn) }} → {{ fmtShort(b.details?.checkOut) }}</p>
                    <p class="ref">Ref {{ b.id }}</p>
                  </div>
                </div>
              </div>
            </section>
  
            <!-- Written reviews -->
            <section class="rsec">
              <h3 class="sec-h">My reviews <span class="count-badge">{{ myReviews.length }}</span></h3>
              <div v-if="myReviews.length === 0" class="empty-inline">
                You haven't written any reviews yet.
              </div>
              <div v-else class="rev-cards">
                <div v-for="r in myReviews" :key="r.id" class="rev-card" :class="{ editing: editingId === r.id }">
                  <div class="rc-head">
                    <img v-if="r.hotelImage" :src="r.hotelImage" class="pthumb" loading="lazy" />
                    <div v-else class="pthumb fallback">🏨</div>
                    <div class="rc-meta">
                      <h4>{{ r.hotel_name }}</h4>
                      <div class="w-stars">
                        <span v-for="n in 5" :key="n" class="star" :class="{ on: n <= r.rating }">
                          <svg width="13" height="13" viewBox="0 0 24 24" :fill="n <= r.rating ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        </span>
                        <small>{{ fmtDate(r.edited_at || r.created_at) }}<span v-if="r.edited_at"> · edited</span></small>
                      </div>
                    </div>
                  </div>
                  <h5 v-if="r.title" class="w-title">{{ r.title }}</h5>
                  <p class="w-content">{{ r.content }}</p>
                  <div class="w-actions">
                    <!-- Edit available ONCE — hidden once edited_at is set -->
                    <button v-if="!r.edited_at" class="btn-ghost sm" :disabled="busy" @click="startEditReview(r)">Edit</button>
                    <span v-else class="edited-pill">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>
                      Edited
                    </span>
                    <button class="btn-ghost sm danger" :disabled="busy" @click="deleteReview(r)">Delete</button>
                  </div>
                </div>
              </div>
            </section>
          </div>
  
          <!-- RIGHT: review form (the only card container on the page) -->
          <div class="rev-side">
            <div class="card form-card">
              <h3 class="sec-h">{{ editingId ? 'Edit your review' : 'Write a review' }}</h3>
  
              <div v-if="!editingId && !form.bookingRef" class="empty-inline form-empty">
                Select a completed stay on the left to write a review.
              </div>
              <template v-else>
                <p class="form-target">
                  {{ editingId ? editingHotelName : formTarget?.hotel?.name }}
                  <small v-if="!editingId"> · Ref {{ form.bookingRef }}</small>
                </p>
  
                <!-- Star picker -->
                <div class="star-picker">
                  <button v-for="n in 5" :key="n" type="button" class="star-btn"
                          :class="{ on: n <= (hoverRating || form.rating) }"
                          @click="form.rating = n" @mouseenter="hoverRating = n" @mouseleave="hoverRating = 0"
                          :aria-label="n + ' star' + (n > 1 ? 's' : '')">
                    <svg width="26" height="26" viewBox="0 0 24 24" :fill="n <= (hoverRating || form.rating) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  </button>
                  <span class="star-label">{{ ratingLabel }}</span>
                </div>
  
                <div class="field">
                  <label>Title <small>(optional)</small></label>
                  <input v-model="form.title" class="inp" maxlength="150" placeholder="Sum up your stay in a few words" />
                </div>
                <div class="field">
                  <label>Your review</label>
                  <textarea v-model="form.content" class="inp ta" rows="5" maxlength="2000"
                            placeholder="What did you enjoy? How was the service, cleanliness, the view?"></textarea>
                  <div class="char-count" :class="{ limit: form.content.length >= 2000 }">{{ form.content.length }}/2000</div>
                </div>
  
                <button class="btn-rose w-full" :disabled="!formReady || busy" @click="submitReview">
                  <span v-if="busy">{{ editingId ? 'Saving…' : 'Posting…' }}</span>
                  <span v-else>{{ editingId ? 'Save Changes' : 'Post Review' }}</span>
                </button>
                <button v-if="editingId" class="btn-ghost w-full mt-sm" :disabled="busy" @click="resetForm">Cancel Edit</button>
                <p v-if="editingId" class="hint center">You can edit this review only once — make it count!</p>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, reactive, computed, onMounted } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { useUserStore } from '../../stores/useUserStore'
  
  const API_BASE = 'http://localhost:3000/api'
  const router = useRouter()
  const route = useRoute()
  const userStore = useUserStore()
  
  const loading = ref(true)
  const busy = ref(false)
  const bookings = ref([])     // completed stays
  const myReviews = ref([])
  
  const editingId = ref(null)
  const editingHotelName = ref('')
  const hoverRating = ref(0)
  
  const form = reactive({ bookingRef: '', rating: 0, title: '', content: '' })
  
  const notice = ref({ text: '', type: 'ok' })
  let noticeTimer = null
  const showNotice = (text, type = 'ok') => {
    notice.value = { text, type }
    clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => (notice.value = { text: '', type: 'ok' }), 5000)
  }
  
  // ── Formatters ──
  function fmtDate(d) { return d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' }
  function fmtShort(d) { return d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—' }
  
  // ── Derived ──
  const eligible = computed(() => bookings.value.filter(b => b.status === 'completed' && !b.hasReview))
  const formTarget = computed(() => eligible.value.find(b => b.id === form.bookingRef) || null)
  
  const ratingLabel = computed(() =>
    ['Rate your stay', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][form.rating] || ''
  )
  
  const formReady = computed(() =>
    form.rating >= 1 && form.content.trim().length >= 10
  )
  
  // ── Form actions ──
  function startNewReview(b) {
    editingId.value = null
    editingHotelName.value = ''
    form.bookingRef = b.id
    form.rating = 0
    form.title = ''
    form.content = ''
    hoverRating.value = 0
  }
  
  function startEditReview(r) {
    // Defense-in-depth: server also rejects (PUT /hotels/reviews/:id)
    if (r.edited_at) { showNotice('Each review can only be edited once.', 'bad'); return }
    editingId.value = r.id
    editingHotelName.value = r.hotel_name
    form.bookingRef = r.booking_ref
    form.rating = r.rating
    form.title = r.title || ''
    form.content = r.content || ''
    hoverRating.value = 0
  }
  
  function resetForm() {
    editingId.value = null
    editingHotelName.value = ''
    form.bookingRef = ''
    form.rating = 0
    form.title = ''
    form.content = ''
  }
  
  // ── Data ──
  const authHeaders = () => ({ Authorization: `Bearer ${userStore.token}` })
  
  const loadAll = async () => {
    loading.value = true
    try {
      const [bkRes, rvRes] = await Promise.allSettled([
        fetch(`${API_BASE}/hotels/my-bookings`, { headers: authHeaders() }),
        fetch(`${API_BASE}/hotels/my-reviews`, { headers: authHeaders() }),
      ])
      if (bkRes.status === 'fulfilled') {
        if (bkRes.value.status === 401 || bkRes.value.status === 403) { router.push('/auth'); return }
        if (bkRes.value.ok) bookings.value = await bkRes.value.json()
      }
      if (rvRes.status === 'fulfilled' && rvRes.value.ok) myReviews.value = await rvRes.value.json()
  
      // Deep link: /user/reviews?booking=BCO-XXXX
      const bookingRef = route.query.booking
      if (bookingRef && !editingId.value) {
        const match = bookings.value.find(b => b.id === bookingRef && b.status === 'completed' && !b.hasReview)
        if (match) startNewReview(match)
      }
      // Deep link: /user/reviews?hotel=ID — preselect the eligible completed stay for this resort
      const qHotel = route.query.hotel ? Number(route.query.hotel) : null
      if (!bookingRef && qHotel && !editingId.value) {
        const match = bookings.value.find(b => Number(b.hotel?.id) === qHotel && b.status === 'completed' && !b.hasReview)
        if (match) {
          startNewReview(match)
        } else {
          showNotice('No completed stay for this resort yet. Reviews unlock after your stay is marked Completed.', 'bad')
        }
      }
    } finally {
      loading.value = false
    }
  }
  
  const submitReview = async () => {
    busy.value = true
    try {
      const payload = { rating: form.rating, title: form.title, content: form.content }
      const url = editingId.value
        ? `${API_BASE}/hotels/reviews/${editingId.value}`
        : `${API_BASE}/hotels/bookings/${form.bookingRef}/review`
      const res = await fetch(url, {
        method: editingId.value ? 'PUT' : 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401 || res.status === 403) {
        // 403 on PUT = already edited once (server-side rule)
        if (editingId.value && res.status === 403) { showNotice(data.message || 'Each review can only be edited once.', 'bad'); resetForm(); await loadAll(); return }
        router.push('/auth'); return
      }
      if (!res.ok) { showNotice(data.message || 'Failed to save review.', 'bad'); return }
  
      showNotice(data.message || 'Review saved.', 'ok')
      resetForm()
      await loadAll()
    } catch (e) {
      showNotice(e.message || 'Something went wrong.', 'bad')
    } finally {
      busy.value = false
    }
  }
  
  const deleteReview = async (r) => {
    if (!window.confirm(`Delete your review for ${r.hotel_name}? You can write a new one afterwards.`)) return
    busy.value = true
    try {
      const res = await fetch(`${API_BASE}/hotels/reviews/${r.id}`, { method: 'DELETE', headers: authHeaders() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { showNotice(data.message || 'Failed to delete review.', 'bad'); return }
      if (editingId.value === r.id) resetForm()
      showNotice(data.message || 'Review deleted.', 'ok')
      await loadAll()
    } catch (e) {
      showNotice(e.message || 'Something went wrong.', 'bad')
    } finally {
      busy.value = false
    }
  }
  
  onMounted(() => {
    if (!userStore.token) { router.push('/auth'); return }
    loadAll()
  })
  </script>
  
  <style scoped>
  .sb-root { color: var(--bb-ink); font-family: var(--bb-font-body); }
  .fade-in { animation: fadeIn .35s ease both; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  
  .page-head h1 { font-size: var(--bb-text-2xl); font-weight: var(--bb-weight-extrabold); margin: 0 0 4px; color: var(--bb-ink); }
  .page-head p { font-size: var(--bb-text-base); color: var(--bb-text-secondary); margin: 0 0 18px; }
  
  /* Layout — lists directly on page (no wrapper boxes), sticky form right */
  .rev-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; align-items: start; }
  .rev-side { position: sticky; top: 16px; }
  
  /* Sections — just a heading + grid, zero box padding */
  .rsec { margin-bottom: 30px; }
  .sec-h { font-size: var(--bb-text-md); font-weight: var(--bb-weight-bold); margin: 0 0 14px; display: flex; align-items: center; gap: 8px; color: var(--bb-ink); }
  .count-badge { font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-extrabold); color: var(--bb-accent-ink); background: var(--bb-accent-soft); padding: 2px 9px; border-radius: 999px; }
  
  /* Empty states hug their content — dashed, not a big glass box */
  .empty-inline {
    font-size: var(--bb-text-sm); color: var(--bb-text-tertiary); line-height: 1.6;
    padding: 16px 18px;
    border: 1px dashed var(--bb-border-strong);
    border-radius: 12px;
    background: var(--bb-glass-bg);
  }
  .empty-inline.form-empty { border-style: solid; background: transparent; }
  
  /* Notice */
  .error-banner { border-radius: 12px; padding: 11px 14px; font-size: var(--bb-text-sm); font-weight: var(--bb-weight-semibold); margin-bottom: 14px; }
  .error-banner.ok { background: var(--bb-success-soft); border: 1px solid var(--bb-success); color: var(--bb-success); }
  .error-banner.bad { background: var(--bb-danger-soft); border: 1px solid var(--bb-danger); color: var(--bb-danger); }
  
  /* States */
  .state-box { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 20px; color: var(--bb-text-secondary); text-align: center; }
  .state-emoji { font-size: var(--bb-text-4xl); }
  .spinner { width: 34px; height: 34px; border: 3px solid var(--bb-border); border-top-color: var(--bb-accent); border-radius: 50%; animation: spin .8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  
  /* ── Pending review cards ── */
  .pend-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(185px, 1fr)); gap: 12px; align-items: start; }
  
  .pend-card {
    display: flex; flex-direction: column;
    border: 2px solid var(--bb-glass-border);
    border-radius: 14px; overflow: hidden;
    background: var(--bb-glass-bg);
    cursor: pointer; transition: all .2s;
  }
  .pend-card:hover { border-color: var(--bb-border-strong); transform: translateY(-2px); }
  .pend-card.selected {
    border-color: var(--bb-accent);
    box-shadow: 0 0 0 3px var(--bb-accent-soft);
  }
  
  .pend-img { position: relative; aspect-ratio: 16/10; background: var(--bb-bg-subtle); }
  .pend-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .pimg-fallback { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: var(--bb-text-3xl); }
  
  .pend-cta {
    position: absolute; bottom: 8px; right: 8px;
    background: var(--bb-accent); color: var(--bb-on-accent);
    font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-extrabold);
    padding: 4px 10px; border-radius: 999px;
    box-shadow: 0 4px 12px rgba(0,0,0,.18);
  }
  
  .pend-body { padding: 10px 12px 12px; }
  .pend-body h4 {
    font-size: var(--bb-text-sm); font-weight: var(--bb-weight-bold); margin: 0 0 3px; color: var(--bb-ink);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .pend-body p { font-size: var(--bb-text-2xs); color: var(--bb-text-secondary); margin: 0; }
  .pend-body .ref { font-size: var(--bb-text-2xs); color: var(--bb-text-tertiary); margin-top: 2px; }
  
  /* ── Written review cards ── */
  .rev-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(235px, 1fr)); gap: 14px; align-items: start; }
  
  .rev-card {
    display: flex; flex-direction: column; gap: 8px;
    padding: 14px;
    border: 1px solid var(--bb-glass-border);
    border-radius: 14px;
    background: var(--bb-glass-bg);
    transition: border-color .2s, box-shadow .2s;
  }
  .rev-card.editing { border-color: var(--bb-accent); box-shadow: 0 0 0 3px var(--bb-accent-soft); }
  
  .rc-head { display: flex; align-items: center; gap: 10px; }
  .pthumb { width: 42px; height: 42px; border-radius: 10px; object-fit: cover; flex-shrink: 0; }
  .pthumb.fallback { display: flex; align-items: center; justify-content: center; background: var(--bb-bg-subtle); font-size: var(--bb-text-xl); }
  .rc-meta { flex: 1; min-width: 0; }
  .rc-meta h4 {
    font-size: var(--bb-text-sm); font-weight: var(--bb-weight-bold); margin: 0 0 3px; color: var(--bb-ink);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .w-stars { display: flex; align-items: center; gap: 2px; flex-wrap: wrap; }
  .w-stars small { margin-left: 6px; font-size: var(--bb-text-2xs); color: var(--bb-text-tertiary); }
  .star { color: var(--bb-border-strong); display: inline-flex; }
  .star.on { color: var(--bb-sun); }
  
  .w-title { font-size: var(--bb-text-sm); font-weight: var(--bb-weight-bold); color: var(--bb-ink); margin: 2px 0 0; }
  .w-content {
    font-size: var(--bb-text-sm); color: var(--bb-text-secondary); line-height: 1.6; margin: 0;
    white-space: pre-wrap; word-break: break-word;
    display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden;
  }
  
  .w-actions { display: flex; gap: 7px; align-items: center; }
  
  .edited-pill {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: var(--bb-text-2xs); font-weight: var(--bb-weight-bold); color: var(--bb-text-tertiary);
    background: var(--bb-neutral-soft); padding: 5px 11px; border-radius: 999px;
  }
  
  /* ── Form card (the only glass container) ── */
  .card { background: var(--bb-glass-bg-strong); border: 1px solid var(--bb-glass-border); border-radius: var(--bb-radius-lg); padding: 18px 20px;   box-shadow: var(--bb-glass-shadow); }
  .form-card { display: flex; flex-direction: column; }
  .form-target { font-size: var(--bb-text-sm); font-weight: var(--bb-weight-bold); color: var(--bb-accent-ink); margin: 0 0 14px; }
  .form-target small { color: var(--bb-text-tertiary); font-weight: var(--bb-weight-medium); }
  
  .star-picker { display: flex; align-items: center; gap: 5px; margin-bottom: 16px; }
  .star-btn { background: none; border: none; cursor: pointer; padding: 2px; color: var(--bb-border-strong); transition: color .15s, transform .15s; display: inline-flex; }
  .star-btn:hover { transform: scale(1.12); }
  .star-btn.on { color: var(--bb-sun); }
  .star-label { margin-left: 8px; font-size: var(--bb-text-xs); font-weight: var(--bb-weight-bold); color: var(--bb-text-secondary); min-width: 90px; }
  
  .field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
  .field label { font-size: var(--bb-text-xs); font-weight: var(--bb-weight-semibold); color: var(--bb-text-secondary); }
  .field label small { font-weight: var(--bb-weight-regular); color: var(--bb-text-tertiary); }
  .inp { width: 100%; padding: 10px 12px; border: 1px solid var(--bb-border-strong); border-radius: 10px; font-size: var(--bb-text-base); font-family: inherit; color: var(--bb-ink); background: var(--bb-glass-bg-strong); box-sizing: border-box; transition: border-color .2s; }
  .inp:focus { border-color: var(--bb-accent); outline: none; box-shadow: 0 0 0 3px var(--bb-accent-soft); }
  .inp.ta { resize: vertical; line-height: 1.6; }
  .char-count { text-align: right; font-size: var(--bb-text-2xs); color: var(--bb-text-tertiary); margin-top: 3px; }
  .char-count.limit { color: var(--bb-danger); font-weight: var(--bb-weight-bold); }
  .hint.center { text-align: center; color: var(--bb-text-tertiary); font-size: var(--bb-text-xs); margin: 10px 0 0; }
  
  .btn-rose { background: var(--bb-accent); color: var(--bb-on-accent); font-weight: var(--bb-weight-semibold); padding: 10px 22px; border-radius: 12px; border: none; cursor: pointer; font-size: var(--bb-text-base); font-family: inherit; transition: all .2s; }
  .btn-rose:hover:not(:disabled) { background: var(--bb-accent-hover); }
  .btn-rose:disabled { opacity: .5; cursor: not-allowed; }
  .btn-ghost { border: 1px solid var(--bb-border-strong); background: var(--bb-glass-bg-strong); border-radius: 10px; padding: 9px 16px; font-size: var(--bb-text-base); font-weight: var(--bb-weight-semibold); cursor: pointer; font-family: inherit; color: var(--bb-text-secondary); transition: all .2s; }
  .btn-ghost:hover:not(:disabled) { background: var(--bb-accent-soft); color: var(--bb-accent-ink); }
  .btn-ghost:disabled { opacity: .5; cursor: not-allowed; }
  .btn-ghost.sm { padding: 6px 12px; font-size: var(--bb-text-xs); }
  .btn-ghost.danger:hover { background: var(--bb-danger-soft); color: var(--bb-danger); border-color: var(--bb-danger); }
  .w-full { width: 100%; }
  .mt-sm { margin-top: 10px; }
  
  @media (max-width: 1024px) {
    .rev-grid { grid-template-columns: 1fr; }
    .rev-side { position: static; }
  }
  </style>