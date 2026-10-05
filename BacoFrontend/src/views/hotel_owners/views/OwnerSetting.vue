<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useTheme } from '../composables/useTheme';
import StatusBadge from '../components/ui/StatusBadge.vue';

// ── Config ──────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:3000/api';
const TOKEN_KEY = 'baco_owner_token';
const DATA_KEY = 'baco_owner_data';
const TIMEOUT_KEY = 'baco_owner_session_timeout'; // minutes, 0 = disabled

const { isDarkMode, toggleTheme } = useTheme();
const router = useRouter();

// ── State ───────────────────────────────────────────────────────────
const loading = ref(true);
const owner = ref(null);

// Toast
const toast = reactive({ show: false, message: '', type: 'success' });
let toastTimer = null;
const showToast = (message, type = 'success') => {
  toast.show = true;
  toast.message = message;
  toast.type = type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.show = false), 3500);
};

// ── Auto-logout (real, working inactivity timer) ────────────────────
const timeoutOptions = [
  { value: 0,  label: 'Disabled' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '60 minutes' },
];

const storedTimeout = Number(localStorage.getItem(TIMEOUT_KEY));
const idleMinutes = ref(timeoutOptions.some(o => o.value === storedTimeout) ? storedTimeout : 30);

let idleTimer = null;
let lastReset = 0;
// mousemove is throttled via lastReset; the rest are low-frequency
const ACTIVITY_EVENTS = ['click', 'keydown', 'scroll', 'touchstart', 'mousemove'];

const onActivity = () => {
  // Throttle: don't churn clearTimeout/setTimeout on every pixel of mouse movement
  if (Date.now() - lastReset < 15000) return;
  lastReset = Date.now();
  resetIdleTimer();
};

const resetIdleTimer = () => {
  if (idleTimer) clearTimeout(idleTimer);
  if (!idleMinutes.value) return; // disabled
  idleTimer = setTimeout(() => performLogout(true), idleMinutes.value * 60 * 1000);
};

const saveTimeoutOption = () => {
  localStorage.setItem(TIMEOUT_KEY, String(idleMinutes.value));
  resetIdleTimer();
  showToast(
    idleMinutes.value
      ? `Auto-logout enabled — you'll be signed out after ${idleMinutes.value} minutes of inactivity.`
      : 'Auto-logout disabled.'
  );
};

const cleanupIdle = () => {
  if (idleTimer) clearTimeout(idleTimer);
  ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, onActivity));
};

// ── Session info (decoded from the JWT — no backend needed) ─────────
const tokenInfo = computed(() => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return {
      issuedAt: payload.iat ? new Date(payload.iat * 1000) : null,
      expiresAt: payload.exp ? new Date(payload.exp * 1000) : null,
      expired: payload.exp ? Date.now() > payload.exp * 1000 : false,
    };
  } catch { return null; }
});

const hoursRemaining = computed(() => {
  if (!tokenInfo.value?.expiresAt) return null;
  return Math.max(0, (tokenInfo.value.expiresAt.getTime() - Date.now()) / 3600000);
});

// ── Logout ──────────────────────────────────────────────────────────
const performLogout = (dueToInactivity = false) => {
  cleanupIdle();
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(DATA_KEY);
  router.push(dueToInactivity ? '/owner/login?reason=timeout' : '/owner/login');
};

// ── Formatters ──────────────────────────────────────────────────────
const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatDateTime = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
};

// ── Derived account info ────────────────────────────────────────────
const ownerRef = computed(() =>
  owner.value ? `#OWN-${String(owner.value.id).padStart(4, '0')}` : '—'
);

// ── Load account ────────────────────────────────────────────────────
const loadAccount = async () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return router.push('/owner/login');
  // Token already expired → end the session immediately
  if (tokenInfo.value?.expired) return performLogout();

  loading.value = true;
  try {
    const res = await fetch(`${API_BASE}/owner/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 401 || res.status === 403) return performLogout();
    if (!res.ok) throw new Error('Failed to load your account.');
    owner.value = await res.json();
  } catch (e) {
    showToast(e.message || 'Something went wrong.', 'error');
  } finally {
    loading.value = false;
  }
};

// ── Lifecycle ───────────────────────────────────────────────────────
onMounted(() => {
  ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
  resetIdleTimer();
  loadAccount();
});

onUnmounted(cleanupIdle);
</script>

<template>
  <div class="owner-settings">
    <div class="page-title">
      <div>
        <h1>Dashboard <span>Settings</span></h1>
        <p>Manage your session, appearance, and account preferences.</p>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="state-box">
      <div class="spinner"></div>
      <p>Loading settings…</p>
    </div>

    <div v-else class="settings-grid">
      <!-- ══════════ Appearance ══════════ -->
      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-palette" style="color:var(--ac)"></i>Appearance</h3>
        </div>
        <div class="card-body">
          <div class="setting-row">
            <div class="setting-info">
              <h5>Dark Mode</h5>
              <p>Switch between light and dark theme across the owner portal</p>
            </div>
            <div class="toggle-switch">
              <input type="checkbox" id="darkMode" class="toggle-input"
                     :checked="isDarkMode" @change="toggleTheme" />
              <label for="darkMode" class="toggle-label"></label>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════════ Session & Security ══════════ -->
      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-shield-alt" style="color:var(--wn)"></i>Session &amp; Security</h3>
        </div>
        <div class="card-body">
          <div class="setting-row">
            <div class="setting-info">
              <h5>Auto-Logout (Inactivity)</h5>
              <p>Sign you out automatically after a period of inactivity — recommended on shared computers</p>
            </div>
            <select v-model.number="idleMinutes" class="timeout-select" @change="saveTimeoutOption" aria-label="Auto-logout duration">
              <option v-for="opt in timeoutOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>

          <div class="divider"></div>

          <div class="session-info">
            <div class="s-row">
              <span class="s-label"><i class="fas fa-user-check"></i>Signed in as</span>
              <span class="s-value">{{ owner?.email || '—' }}</span>
            </div>
            <div class="s-row">
              <span class="s-label"><i class="fas fa-right-to-bracket"></i>Session started</span>
              <span class="s-value">{{ formatDateTime(tokenInfo?.issuedAt) }}</span>
            </div>
            <div class="s-row">
              <span class="s-label"><i class="fas fa-hourglass-half"></i>Session expires</span>
              <span class="s-value" :class="{ warn: tokenInfo && hoursRemaining !== null && hoursRemaining < 2 }">
                {{ formatDateTime(tokenInfo?.expiresAt) }}
                <small v-if="tokenInfo && !tokenInfo.expired && hoursRemaining !== null">
                  ({{ hoursRemaining >= 1 ? Math.round(hoursRemaining) + 'h' : Math.round(hoursRemaining * 60) + 'm' }} left)
                </small>
              </span>
            </div>
            <div class="s-row">
              <span class="s-label"><i class="fas fa-timer"></i>Idle logout</span>
              <span class="s-value" :class="idleMinutes ? 'ok-text' : 'muted'">
                <i class="fas" :class="idleMinutes ? 'fa-circle-check' : 'fa-circle-minus'"></i>
                {{ idleMinutes ? `Active — ${idleMinutes} min, resets on any activity` : 'Disabled' }}
              </span>
            </div>
            <button class="btn-secondary full" @click="performLogout()">
              <i class="fas fa-sign-out-alt"></i>Log Out Now
            </button>
          </div>
        </div>
      </div>

      <!-- ══════════ Account Overview ══════════ -->
      <div class="card">
        <div class="card-header">
          <h3><i class="fas fa-user-circle" style="color:#B0D91E"></i>Account</h3>
          <button class="btn-ghost" @click="router.push('/owner/profile')">
            <i class="fas fa-pen"></i>Edit in Profile
          </button>
        </div>
        <div class="card-body">
          <div class="account-grid">
            <div class="a-row">
              <span class="s-label"><i class="fas fa-id-badge"></i>Owner ID</span>
              <span class="s-value">{{ ownerRef }}</span>
            </div>
            <div class="a-row">
              <span class="s-label"><i class="fas fa-store"></i>Business</span>
              <span class="s-value">{{ owner?.businessName || '—' }}</span>
            </div>
            <div class="a-row">
              <span class="s-label"><i class="fas fa-envelope"></i>Email</span>
              <span class="s-value">{{ owner?.email || '—' }}</span>
            </div>
            <div class="a-row">
              <span class="s-label"><i class="fas fa-phone"></i>Contact</span>
              <span class="s-value">{{ owner?.contactNumber || '—' }}</span>
            </div>
            <div class="a-row">
              <span class="s-label"><i class="fas fa-calendar-day"></i>Member since</span>
              <span class="s-value">{{ formatDate(owner?.createdAt) }}</span>
            </div>
            <div class="a-row">
              <span class="s-label"><i class="fas fa-signal"></i>Status</span>
              <StatusBadge v-if="owner" :status="owner.status" size="sm" />
            </div>
          </div>
          <p class="account-note">
            Name, contact, business details, password, and Valid ID are managed on the
            <router-link to="/owner/profile">Profile</router-link> page.
          </p>
        </div>
      </div>

      <!-- ══════════ LGU-Assisted Actions (replaces fake Danger Zone) ══════════ -->
      <div class="card assist-card">
        <div class="card-header">
          <h3><i class="fas fa-building-columns" style="color:var(--dg)"></i>Requires LGU Assistance</h3>
        </div>
        <div class="card-body">
          <div class="assist-grid">
            <div class="assist-item">
              <div class="assist-icon"><i class="fas fa-envelope"></i></div>
              <div>
                <h5>Change Login Email</h5>
                <p>Your email is your login identity. Contact the Tourism Office to update it with re-verification.</p>
              </div>
            </div>
            <div class="assist-item">
              <div class="assist-icon"><i class="fas fa-user-slash"></i></div>
              <div>
                <h5>Close Account</h5>
                <p>Account closure and data removal are processed by the LGU Baco Tourism Office for record-keeping.</p>
              </div>
            </div>
          </div>
          <a href="mailto:lgubacotourism@gmail.com" class="btn-secondary full">
            <i class="fas fa-envelope-open-text"></i>Contact lgubacotourism@gmail.com
          </a>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <transition name="toast">
      <div v-if="toast.show" class="toast" :class="toast.type">
        <i class="fas" :class="toast.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'"></i>
        {{ toast.message }}
      </div>
    </transition>
  </div>
</template>

<style scoped>
.owner-settings { animation: fadeIn .5s ease; max-width: 1000px; margin: 0 auto; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

/* Success/danger tokens — hardcoded so theme vars can't turn them red */
.owner-settings { --success: #B0D91E; --danger: #F20707; }

.page-title { margin-bottom: 28px; }
.page-title h1 { font-family: 'Unbounded', sans-serif; font-size: clamp(28px, 5vw, 40px); font-weight: 800; color: var(--fg); letter-spacing: -0.04em; margin: 0 0 6px; line-height: 1.1; }
.page-title h1 span { background: linear-gradient(135deg, var(--ac), var(--wn)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.page-title p { color: var(--mt); font-size: 14px; margin: 0; }

.state-box { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 80px 24px; color: var(--mt); background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; text-align: center; }
.state-box p { margin: 0; font-size: 14px; }
.spinner { width: 36px; height: 36px; border: 3px solid var(--bdr); border-top-color: var(--ac); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.settings-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; align-items: stretch; }
.assist-card, .assist-grid + .btn-secondary { grid-column: 1 / -1; }

.card { background: var(--card); border: 1px solid var(--bdr); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; }
.card-header { padding: 20px 24px; border-bottom: 1px solid var(--bdr); display: flex; align-items: center; justify-content: space-between; }
.card-header h3 { font-family: 'Unbounded', sans-serif; font-size: 15px; font-weight: 700; color: var(--fg); margin: 0; display: flex; align-items: center; gap: 10px; }
.card-body { padding: 8px 24px 24px; flex: 1; display: flex; flex-direction: column; }

.setting-row { display: flex; align-items: center; justify-content: space-between; padding: 20px 0; gap: 24px; }
.setting-info { flex: 1; min-width: 0; }
.setting-info h5 { font-size: 14px; font-weight: 700; color: var(--fg); margin: 0 0 6px; }
.setting-info p { font-size: 13px; color: var(--mt); margin: 0; line-height: 1.4; }
.divider { height: 1px; background: var(--bdr); }

/* Timeout selector */
.timeout-select {
  padding: 10px 14px;
  background: var(--bg2);
  border: 1px solid var(--bdr);
  border-radius: 10px;
  color: var(--fg);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  flex-shrink: 0;
  min-width: 150px;
}
.timeout-select:focus { border-color: var(--ac); box-shadow: 0 0 0 3px var(--acs); }

/* Session / account info rows */
.session-info, .account-grid { display: flex; flex-direction: column; }
.session-info .s-row, .account-grid .a-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; padding: 12px 0;
  border-bottom: 1px dashed var(--bdr);
}
.session-info .s-row:last-of-type, .account-grid .a-row:last-child { border-bottom: none; }
.s-label { font-size: 12px; color: var(--mt); font-weight: 600; display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.s-label i { width: 14px; text-align: center; font-size: 11px; opacity: .7; }
.s-value { font-size: 13px; font-weight: 700; color: var(--fg); text-align: right; word-break: break-all; }
.s-value small { font-weight: 600; color: var(--mt); }
.s-value.warn { color: var(--wn); }
.s-value.ok-text { color: var(--success); }
.s-value.muted { color: var(--mt); }

/* Toggle Switch */
.toggle-switch { position: relative; display: inline-block; width: 48px; height: 26px; flex-shrink: 0; }
.toggle-input { opacity: 0; width: 0; height: 0; }
.toggle-label { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--bdr); transition: .3s; border-radius: 26px; }
.toggle-label:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: #fff; transition: .3s; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,.2); }
.toggle-input:checked + .toggle-label { background-color: var(--ac); }
.toggle-input:checked + .toggle-label:before { transform: translateX(22px); }

.account-note { margin-top: 14px; font-size: 12px; color: var(--mt); line-height: 1.5; }
.account-note a { color: var(--ac); font-weight: 700; text-decoration: none; }
.account-note a:hover { text-decoration: underline; }

/* LGU-assist card */
.assist-card { border-color: rgba(255, 23, 68, .25); }
.assist-card .card-header { border-bottom-color: rgba(255, 23, 68, .15); }
.assist-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
.assist-item { display: flex; gap: 14px; padding: 16px; background: var(--bg2); border-radius: 12px; }
.assist-icon {
  width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
  background: rgba(255, 23, 68, .1); color: var(--danger);
  display: flex; align-items: center; justify-content: center; font-size: 15px;
}
.assist-item h5 { font-size: 13.5px; font-weight: 700; color: var(--fg); margin: 0 0 5px; }
.assist-item p { font-size: 12px; color: var(--mt); margin: 0; line-height: 1.5; }

/* Buttons */
.btn-ghost { background: transparent; color: var(--ac); border: none; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; text-decoration: none; }
.btn-ghost:hover { background: var(--acs); }
.btn-secondary { padding: 11px 18px; background: var(--bg2); color: var(--fg2); border: 1px solid var(--bdr); border-radius: 10px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: all .3s; text-decoration: none; }
.btn-secondary:hover { background: var(--card2); transform: translateY(-2px); }
.btn-secondary.full { margin-top: 16px; width: 100%; }
.session-info + .btn-secondary.full { margin-top: auto; }

/* Toast */
.toast { position: fixed; top: 24px; right: 24px; z-index: 10001; display: flex; align-items: center; gap: 10px; padding: 14px 20px; border-radius: 12px; font-size: 13px; font-weight: 600; color: #fff; box-shadow: 0 12px 32px rgba(0,0,0,.25); max-width: 380px; }
.toast.success { background: var(--success); }
.toast.error { background: var(--danger); }
.toast-enter-active, .toast-leave-active { transition: all .3s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(-12px); }

@media (max-width: 768px) {
  .settings-grid { grid-template-columns: 1fr; }
  .assist-grid { grid-template-columns: 1fr; }
  .setting-row { flex-direction: column; align-items: flex-start; gap: 14px; padding: 16px 0; }
  .timeout-select { width: 100%; }
  .session-info .s-row, .account-grid .a-row { flex-direction: column; align-items: flex-start; gap: 4px; }
  .s-value { text-align: left; }
}
</style>