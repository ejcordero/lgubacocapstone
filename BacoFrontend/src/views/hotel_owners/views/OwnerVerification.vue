<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import StatusBadge from '../components/ui/StatusBadge.vue';

// ── Config ──────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:3000/api';
const TOKEN_KEY = 'baco_owner_token';
const DATA_KEY = 'baco_owner_data';

const router = useRouter();

// ── State ───────────────────────────────────────────────────────────
const loading = ref(true);
const loadError = ref('');
const owner = ref(null);
const hotel = ref(null);

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
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
};

// ── Load data ───────────────────────────────────────────────────────
const loadVerification = async () => {
  loading.value = true;
  loadError.value = '';
  try {
    const headers = authHeaders();
    if (!headers) return handleAuthError();

    const [meRes, hotelRes] = await Promise.allSettled([
      fetch(`${API_BASE}/owner/auth/me`, { headers }),
      fetch(`${API_BASE}/owner/hotel`, { headers }),
    ]);

    // Profile is critical — auth errors here end the session
    if (meRes.status === 'fulfilled') {
      if (meRes.value.status === 401 || meRes.value.status === 403) return handleAuthError();
      if (meRes.value.ok) owner.value = await meRes.value.json();
    }
    if (!owner.value) throw new Error('Failed to load your account.');

    // Hotel is optional — fail gracefully
    if (hotelRes.status === 'fulfilled' && hotelRes.value.ok) {
      const d = await hotelRes.value.json();
      hotel.value = d.hotel || null;
    }
  } catch (e) {
    loadError.value = e.message || 'Something went wrong.';
  } finally {
    loading.value = false;
  }
};

// ── Derived data ────────────────────────────────────────────────────
const idFileName = computed(() => {
  if (!owner.value?.validIdUrl) return null;
  return decodeURIComponent(owner.value.validIdUrl.split('/').pop());
});

// Verification steps derived from REAL account state
const verificationSteps = computed(() => {
  const approved = owner.value?.status === 'active';
  const hasId = !!owner.value?.validIdUrl;
  const hasHotel = !!hotel.value;
  const published = !!hotel.value?.published;

  const list = [
    { title: 'Account Created', desc: 'Registration submitted to the LGU', done: true },
    { title: 'LGU Approval', desc: approved ? 'Approved by LGU Baco Tourism Office' : 'Awaiting LGU review', done: approved },
    { title: 'Valid ID on File', desc: hasId ? idFileName.value : 'Upload your government ID in Profile', done: hasId },
    {
      title: hasHotel.value ? 'Accommodation Listed' : 'Create Accommodation',
      desc: hasHotel.value ? hotel.value.name : 'No listing created yet',
      done: hasHotel
    },
    {
      title: 'Published to Tourists',
      desc: published ? 'Live and bookable' : (hasHotel.value ? 'Awaiting LGU publication' : '—'),
      done: published
    },
  ];
  // First uncompleted step pulses as "active"
  const firstOpen = list.findIndex(s => !s.done);
  list.forEach((s, i) => { s.active = i === firstOpen; });
  return list;
});

const progressPercent = computed(() => {
  const done = verificationSteps.value.filter(s => s.done).length;
  return Math.round((done / verificationSteps.value.length) * 100);
});

const nextStepTitle = computed(() =>
  verificationSteps.value.find(s => s.active)?.title || null
);

// Required documents derived from REAL records
const documents = computed(() => {
  const docs = [];

  // 1. Valid Government ID (real file)
  if (owner.value?.validIdUrl) {
    docs.push({
      key: 'id',
      name: idFileName.value,
      meta: `Valid Government ID · on file since ${formatDate(owner.value.createdAt)}`,
      icon: idFileName.value.toLowerCase().endsWith('.pdf') ? 'fa-file-pdf' : 'fa-file-image',
      color: '#B0D91E',
      status: 'verified',
      action: 'view',
      actionLabel: 'View',
    });
  } else {
    docs.push({
      key: 'id',
      name: 'Valid Government ID',
      meta: 'Not uploaded yet',
      icon: 'fa-id-card',
      color: '#F2B807',
      status: 'pending',
      action: 'profile',
      actionLabel: 'Upload',
    });
  }

  // 2. Business Permit (record from registration — no file endpoint exists)
  const permitNo = owner.value?.businessPermitNo;
  docs.push({
    key: 'permit',
    name: 'Business Permit',
    meta: permitNo ? `No. ${permitNo} · on record from your registration` : 'Number not on record — contact the LGU Tourism Office',
    icon: 'fa-file-signature',
    color: permitNo ? '#B0D91E' : '#F2B807',
    status: permitNo ? 'verified' : 'pending',
    action: null,
    actionLabel: '',
  });

  // 3. Accommodation Listing (bookability requirement)
  if (hotel.value) {
    docs.push({
      key: 'listing',
      name: hotel.value.name,
      meta: `Accommodation listing · ${hotel.value.published ? 'published and bookable' : 'awaiting LGU publication'}`,
      icon: 'fa-hotel',
      color: hotel.value.published ? '#B0D91E' : '#F2B807',
      status: hotel.value.published ? 'verified' : 'pending',
      action: 'hotels',
      actionLabel: 'Manage',
    });
  } else {
    docs.push({
      key: 'listing',
      name: 'Accommodation Listing',
      meta: 'Not created yet — required before tourists can book you',
      icon: 'fa-hotel',
      color: '#F2B807',
      status: 'pending',
      action: 'hotels',
      actionLabel: 'Create',
    });
  }

  return docs;
});

// ── Actions ─────────────────────────────────────────────────────────
const handleDocAction = (doc) => {
  if (doc.action === 'view' && owner.value?.validIdUrl) {
    window.open(owner.value.validIdUrl, '_blank', 'noopener');
  } else if (doc.action === 'profile') {
    router.push('/owner/profile');
  } else if (doc.action === 'hotels') {
    router.push('/owner/hotels');
  }
};

onMounted(loadVerification);
</script>

<template>
  <div class="owner-verification">
    <div class="page-title">
      <div>
        <h1>Account <span>Verification</span></h1>
        <p>Track your LGU verification progress and listing requirements.</p>
      </div>
      <StatusBadge v-if="owner" :status="owner.status" size="lg" />
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="state-box">
      <div class="spinner"></div>
      <p>Loading your verification status…</p>
    </div>

    <!-- Error state -->
    <div v-else-if="loadError" class="state-box error">
      <i class="fas fa-triangle-exclamation"></i>
      <p>{{ loadError }}</p>
      <button class="btn-secondary" @click="loadVerification"><i class="fas fa-rotate-right"></i>Retry</button>
    </div>

    <template v-else-if="owner">
      <!-- Progress Bar -->
      <div class="progress-card">
        <div class="progress-header">
          <span class="progress-label">Overall Completion</span>
          <span class="progress-value">{{ progressPercent }}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <p v-if="nextStepTitle" class="progress-hint">
          <i class="fas fa-arrow-right"></i>Next step: <strong>{{ nextStepTitle }}</strong>
        </p>
        <p v-else class="progress-hint complete">
          <i class="fas fa-circle-check"></i>All verification steps complete — your listing is fully verified.
        </p>
      </div>

      <div class="grid-layout">
        <!-- Verification Steps -->
        <div class="card">
          <div class="card-header">
            <h3><i class="fas fa-shield-halved" style="color:#B0D91E"></i>Verification Progress</h3>
          </div>
          <div class="card-body">
            <div class="verification-steps">
              <div v-for="(step, i) in verificationSteps" :key="i" class="v-step" :class="{ done: step.done, active: step.active }">
                <div class="v-line" v-if="i < verificationSteps.length - 1"></div>
                <div class="v-icon">
                  <i v-if="step.done" class="fas fa-check"></i>
                  <i v-else-if="step.active" class="fas fa-spinner"></i>
                  <i v-else class="far fa-circle"></i>
                </div>
                <div class="v-info">
                  <div class="v-title">{{ step.title }}</div>
                  <div class="v-desc">{{ step.desc }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Required Documents -->
        <div class="card">
          <div class="card-header">
            <h3><i class="fas fa-folder-open" style="color:var(--ac)"></i>Requirements</h3>
          </div>
          <div class="card-body">
            <div v-for="doc in documents" :key="doc.key" class="doc-card">
              <div class="doc-icon" :style="{ background: doc.color + '18', color: doc.color }">
                <i class="fas" :class="doc.icon"></i>
              </div>
              <div class="doc-info">
                <div class="doc-name">{{ doc.name }}</div>
                <div class="doc-meta">{{ doc.meta }}</div>
              </div>
              <div class="doc-action">
                <button v-if="doc.action" class="btn-ghost-sm" @click="handleDocAction(doc)">
                  <i class="fas" :class="doc.action === 'view' ? 'fa-eye' : doc.action === 'profile' ? 'fa-upload' : 'fa-arrow-right'"></i>
                  {{ doc.actionLabel }}
                </button>
                <StatusBadge v-else :status="doc.status" size="sm" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="info-box">
        <i class="fas fa-circle-info"></i>
        <div>
          <h4>Need Help?</h4>
          <p>
            Contact the LGU Baco Tourism Office for verification assistance —
            <a href="mailto:lgubacotourism@gmail.com">lgubacotourism@gmail.com</a>
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.owner-verification { animation: fadeIn .5s ease; max-width: 1000px; margin: 0 auto; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

/* Success/danger tokens — hardcoded so theme vars can't turn them red */
.owner-verification { --success: #B0D91E; --success-bg: rgba(16, 185, 129, .12); --danger: #F20707; }

.page-title { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 28px; flex-wrap: wrap; gap: 14px; }
.page-title h1 { font-family: 'Unbounded', sans-serif; font-size: clamp(28px, 5vw, 40px); font-weight: 800; color: var(--fg); letter-spacing: -0.04em; margin: 0; line-height: 1.1; }
.page-title h1 span { background: linear-gradient(135deg, var(--ac), var(--wn)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.page-title p { color: var(--mt); font-size: 14px; margin: 6px 0 0; }

.state-box { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 80px 24px; color: var(--mt); background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; text-align: center; }
.state-box i { font-size: 32px; color: var(--wn); }
.state-box p { margin: 0; font-size: 14px; }
.spinner { width: 36px; height: 36px; border: 3px solid var(--bdr); border-top-color: var(--ac); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.progress-card { background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; padding: 24px; margin-bottom: 24px; }
.progress-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
.progress-label { font-size: 12px; font-weight: 700; color: var(--fg2); text-transform: uppercase; letter-spacing: .5px; }
.progress-value { font-family: 'Unbounded', sans-serif; font-size: 15px; font-weight: 800; color: var(--ac); }
.progress-track { height: 10px; background: var(--bg2); border-radius: 5px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, var(--ac), var(--wn)); border-radius: 5px; transition: width 1s ease; }
.progress-hint { margin-top: 12px; font-size: 12.5px; color: var(--mt); display: flex; align-items: center; gap: 7px; }
.progress-hint i { font-size: 11px; color: var(--ac); }
.progress-hint strong { color: var(--fg); }
.progress-hint.complete { color: var(--success); }
.progress-hint.complete i, .progress-hint.complete strong { color: var(--success); }

.grid-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: stretch; }

.card { background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; }
.card-header { padding: 20px 24px; border-bottom: 1px solid var(--bdr); }
.card-header h3 { font-family: 'Unbounded', sans-serif; font-size: 15px; font-weight: 700; color: var(--fg); margin: 0; display: flex; align-items: center; gap: 10px; }
.card-body { padding: 24px; flex: 1; }

/* Steps — done = green (hardcoded), active = pulsing, pending = neutral outline */
.verification-steps { display: flex; flex-direction: column; position: relative; }
.v-step { display: flex; gap: 16px; padding: 16px 0; position: relative; z-index: 1; }
.v-line { position: absolute; left: 15px; top: 46px; bottom: -16px; width: 2px; background: var(--bdr); z-index: 0; }
.v-step.done .v-line { background: var(--success); }
.v-icon { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 2px solid var(--bdr); background: var(--bg2); color: var(--mt); flex-shrink: 0; transition: all .3s; z-index: 1; }
.v-step.done .v-icon { border-color: var(--success); background: var(--success-bg); color: var(--success); }
.v-step.active .v-icon { border-color: var(--wn); background: var(--wng); color: var(--wn); animation: pulse 2s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 var(--wng); } 50% { box-shadow: 0 0 0 8px transparent; } }
.v-title { font-size: 14px; font-weight: 700; color: var(--fg); margin-bottom: 4px; }
.v-step.active .v-title { color: var(--wn); }
.v-desc { font-size: 12px; color: var(--mt); word-break: break-all; }

/* Documents */
.doc-card { display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--bg2); border-radius: 12px; margin-bottom: 12px; border: 1px solid transparent; transition: all .3s; }
.doc-card:hover { border-color: var(--bdr2); background: var(--card2); }
.doc-card:last-child { margin-bottom: 0; }
.doc-icon { width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
.doc-info { flex: 1; min-width: 0; }
.doc-name { font-size: 14px; font-weight: 700; color: var(--fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.doc-meta { font-size: 12px; color: var(--mt); margin-top: 4px; }
.doc-action { flex-shrink: 0; }

.btn-ghost-sm { background: transparent; color: var(--ac); border: 1px solid var(--bdr); padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all .2s; }
.btn-ghost-sm:hover { background: var(--ac); color: #fff; border-color: var(--ac); }

.info-box { margin-top: 24px; padding: 20px; background: var(--tlg); border: 1px solid rgba(0,229,255,.15); border-radius: 12px; display: flex; align-items: flex-start; gap: 16px; }
.info-box i { color: var(--tl); font-size: 20px; margin-top: 2px; }
.info-box h4 { color: var(--fg); font-size: 14px; margin: 0 0 6px; font-weight: 700; }
.info-box p { color: var(--mt); font-size: 13px; margin: 0; line-height: 1.4; }
.info-box a { color: var(--ac); font-weight: 600; }

@media (max-width: 768px) {
  .grid-layout { grid-template-columns: 1fr; }
  .page-title { flex-direction: column; align-items: flex-start; }
}
</style>