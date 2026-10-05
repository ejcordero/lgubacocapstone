<template>
  <div class="user-profile-content">
    <!-- Loading -->
    <div v-if="!userStore.user && userStore.isLoading" class="loading-state">
      <svg class="animate-spin h-8 w-8" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Loading profile...</span>
    </div>

    <template v-else-if="userStore.user">
      <div class="profile-header-section">
        <div class="flex-between">
          <div>
            <h2 class="profile-title">Profile & Settings</h2>
            <p class="profile-subtitle">Manage your personal information, security, and activity.</p>
          </div>
        </div>
      </div>

      <!-- ═══════════ CONTINUOUS SCROLL, DIVIDED BY DROPDOWNS ═══════════
           The three settings areas used to be clickable tabs. On a phone
           that hid two thirds of the page until you guessed which tab
           held it. Everything now lives in one continuous scroll, and each
           area is divided by a collapsible header rather than a tab.
           Personal starts open because it is the section people arrive
           to change; the rest start closed. -->
      <div class="settings-layout">

        <!-- ── PERSONAL ── -->
        <section
          class="settings-section"
          :class="{ 'is-open': openSections.includes('personal') }"
          aria-labelledby="sec-personal"
        >
          <button
            type="button"
            class="settings-section-head"
            :aria-expanded="openSections.includes('personal')"
            aria-controls="panel-personal"
            @click="toggleSection('personal')"
          >
            <span class="settings-section-icon"><User size="18" /></span>
            <span class="settings-section-text">
              <span id="sec-personal" class="settings-section-title">Personal</span>
              <span class="settings-section-sub">Your name, email and avatar</span>
            </span>
            <ChevronDown class="settings-section-chevron" :size="18" />
          </button>

          <div v-show="openSections.includes('personal')" id="panel-personal" class="settings-section-body">
          <div class="personal-info-grid">

          <div class="profile-summary-card">
            <div class="avatar-large">{{ userStore.initials }}</div>
            <h3 class="user-display-name">{{ userStore.user.fullName }}</h3>
            <p class="user-display-role">{{ userStore.user.isGoogleUser ? 'Google Account' : 'Tourist Account' }}</p>
            <p class="joined-date">Joined {{ formattedJoinDate }}</p>
          </div>

          <div class="details-form-card">
            <h3 class="card-heading">Personal Details</h3>
            <div class="form-grid">
              <div class="input-group">
                <label>Full Name</label>
                <div class="input-wrapper">
                  <User size="16" />
                  <input type="text" v-model="profileForm.fullName" />
                </div>
              </div>
              <div class="input-group">
                <label>Email Address</label>
                <div class="input-wrapper">
                  <Mail size="16" />
                  <input type="email" v-model="profileForm.email" />
                </div>
              </div>
              <div class="input-group">
                <label>Contact Number</label>
                <div class="input-wrapper">
                  <Smartphone size="16" />
                  <input type="tel" v-model="profileForm.contact" />
                </div>
              </div>
              <div class="input-group full-width">
                <label>Home Address</label>
                <div class="input-wrapper align-start">
                  <MapPin size="16" class="mt-sm" />
                  <textarea v-model="profileForm.address" rows="3"></textarea>
                </div>
              </div>
            </div>
            <div class="actions-right">
              <button class="save-btn" @click="saveProfile">Save Changes</button>
            </div>
          </div>
        </div>
          </div>
        </section>

        <!-- ── SECURITY ── -->
        <section
          class="settings-section"
          :class="{ 'is-open': openSections.includes('security') }"
          aria-labelledby="sec-security"
        >
          <button
            type="button"
            class="settings-section-head"
            :aria-expanded="openSections.includes('security')"
            aria-controls="panel-security"
            @click="toggleSection('security')"
          >
            <span class="settings-section-icon"><Shield size="18" /></span>
            <span class="settings-section-text">
              <span id="sec-security" class="settings-section-title">Security &amp; Account</span>
              <span class="settings-section-sub">Password, alerts and login history</span>
            </span>
            <ChevronDown class="settings-section-chevron" :size="18" />
          </button>

          <div v-show="openSections.includes('security')" id="panel-security" class="settings-section-body">
          <div class="security-grid">
          <div class="security-left">
            <div class="security-card" v-if="!userStore.user.isGoogleUser">
              <h3 class="card-heading-icon"><Lock size="18"/> Change Password</h3>
              <div class="security-inputs">
                <input type="password" placeholder="Current Password" class="soft-input" />
                <input type="password" placeholder="New Password" class="soft-input" />
                <input type="password" placeholder="Confirm New Password" class="soft-input" />
                <button class="dark-btn-full">Update Password</button>
              </div>
            </div>
            <div class="security-card" v-else>
              <h3 class="card-heading-icon"><Lock size="18"/> Password</h3>
              <p class="google-note">You signed in with Google. Password management is handled through your Google account settings.</p>
            </div>

            <div class="security-card mt-breath">
              <h3 class="card-heading-icon"><Bell size="18"/> Notification Preferences</h3>
              <div class="checkbox-group">
                <div class="check-item">
                  <div class="check-text">
                    <p class="check-label">Email Notifications</p>
                    <p class="check-sub">Booking receipts and permit approvals.</p>
                  </div>
                  <input type="checkbox" checked />
                </div>
                <div class="check-item">
                  <div class="check-text">
                    <p class="check-label">SMS Alerts</p>
                    <p class="check-sub">Urgent updates and weather advisories.</p>
                  </div>
                  <input type="checkbox" checked />
                </div>
              </div>
            </div>
          </div>

          <div class="security-right">
            <div class="security-card">
              <h3 class="card-heading-icon"><History size="18"/> Login History</h3>
              <div class="history-list">
                <div class="history-item">
                  <div class="history-info">
                    <p class="device-text">Current Session</p>
                    <p class="location-text">Active now</p>
                  </div>
                  <span class="status-badge green">Active</span>
                </div>
              </div>
            </div>

            <div class="danger-card mt-breath">
              <h3 class="danger-heading"><AlertTriangle size="18"/> Danger Zone</h3>
              <p class="danger-text">Once you delete your account, there is no going back. Please be certain.</p>
              <button class="delete-btn" @click="handleLogout"><Trash2 size="16"/> Logout</button>
            </div>
          </div>
        </div>
          </div>
        </section>

        <!-- ── ACTIVITY ── -->
        <section
          class="settings-section"
          :class="{ 'is-open': openSections.includes('activity') }"
          aria-labelledby="sec-activity"
        >
          <button
            type="button"
            class="settings-section-head"
            :aria-expanded="openSections.includes('activity')"
            aria-controls="panel-activity"
            @click="toggleSection('activity')"
          >
            <span class="settings-section-icon"><History size="18" /></span>
            <span class="settings-section-text">
              <span id="sec-activity" class="settings-section-title">My Activity</span>
              <span class="settings-section-sub">Permits and bookings</span>
            </span>
            <ChevronDown class="settings-section-chevron" :size="18" />
          </button>

          <div v-show="openSections.includes('activity')" id="panel-activity" class="settings-section-body">
          <div class="activity-layout">
            <div class="activity-section">
              <h3 class="card-heading-icon"><Mountain size="20"/> Permit History</h3>
              <div class="history-card-item" v-if="myPermits.length > 0" v-for="p in myPermits" :key="p.id">
                <div class="permit-info">
                  <p class="permit-id">{{ p.id }}</p>
                  <p class="permit-details">{{ p.title || 'Permit' }} &bull; {{ p.date }}</p>
                  <span class="status-badge green">{{ p.status || 'Submitted' }}</span>
                </div>
              </div>
              <div v-else class="empty-state-sm">
                <p>No permit history found.</p>
              </div>
            </div>

            <div class="activity-section">
              <h3 class="card-heading-icon"><Bed size="20"/> Booking History</h3>
              <div v-if="myBookings.length === 0" class="empty-state-sm">
                <p>No booking history found.</p>
              </div>
            </div>
          </div>
          </div>
        </section>

      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../../stores/useUserStore'
import { usePermitStore } from '../../stores/usePermitStore'
import { useBookingStore } from '../../stores/useBookingStore'
import {
  User, Shield, History, Mail, Smartphone, MapPin,
  Lock, Bell, AlertTriangle, Trash2, Mountain, Bed, ChevronDown
} from 'lucide-vue-next'

const router = useRouter()
const userStore = useUserStore()
const permitStore = usePermitStore()
const bookingStore = useBookingStore()

const profileForm = ref({
  fullName: '',
  email: '',
  contact: '',
  address: '',
})

const myPermits = computed(() => permitStore.myPermits)
const myBookings = computed(() => bookingStore.myBookings)

/* ── Accordion state ──
   One continuous page, divided by collapsible sections rather than tabs.
   Personal starts open because it is what people arrive to change; the
   rest start closed so the page reads as three clear dividers instead of
   one wall of controls.

   Multiple sections may be open at once - this is not a tab, so opening
   Security must not silently collapse Personal. */
const openSections = ref(['personal'])

const toggleSection = (key) => {
  openSections.value = openSections.value.includes(key)
    ? openSections.value.filter(k => k !== key)
    : [...openSections.value, key]
}

const formattedJoinDate = computed(() => {
  if (!userStore.user?.createdAt) return ''
  return new Date(userStore.user.createdAt).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric'
  })
})

// Populate form when user data is available
watch(() => userStore.user, (u) => {
  if (u) {
    profileForm.value = {
      fullName: u.fullName || '',
      email: u.email || '',
      contact: u.phone || '',
      address: '',
    }
  }
}, { immediate: true })

const saveProfile = () => { console.log('Saved', profileForm.value) }
const handleLogout = () => {
  userStore.logout()
  router.push('/auth')
}
</script>

<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 2rem;
  color: var(--muted);
}

.user-profile-content {
  padding: 0.5rem 0;
  max-width: 1600px;
  margin: 0 auto;
}

/* Header & Tabs */
.profile-title { font-size: var(--bb-text-3xl); font-weight: var(--bb-weight-extrabold); color: var(--bb-ink); margin-bottom: 0.5rem; }
.profile-subtitle { color: var(--muted); font-size: var(--bb-text-lg); }

/* ----------- SETTINGS � CONTINUOUS SCROLL, DIVIDED BY ACCORDIONS -----------
   One page, three collapsible sections. The left-rail grid that used to
   hold the tab buttons is gone, so .settings-layout is a plain block and
   the sections stack the full width of the page. */
/* margin-inline: auto, not just max-width. The parent is a centred 1600px
   column, so a 1100px child with no auto margins sits hard against its left
   edge and reads as off-centre against the header above it on any wide
   screen. The cap and the centring have to arrive together. */
.settings-layout {
  margin: 1.5rem auto 0;
  max-width: 1100px;
  width: 100%;
}

.settings-section + .settings-section {
  margin-top: 0.75rem;
}

/* The trigger is a full-width button, so it needs an explicit reset �
   a bare <button> brings UA border, background and font. */
.settings-section-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 1rem 1.1rem;
  border: 1px solid var(--bb-border);
  border-radius: var(--bb-radius-lg);
  background: var(--bb-surface);
  color: var(--bb-ink);
  font-family: var(--bb-font-body);
  text-align: left;
  cursor: pointer;
  transition: background var(--bb-dur-fast) var(--bb-ease),
    border-color var(--bb-dur-fast) var(--bb-ease);
}
.settings-section-head:hover {
  background: var(--bb-bg-subtle);
  border-color: var(--bb-border-strong);
}
.settings-section-head:focus-visible {
  outline: 2px solid var(--bb-accent);
  outline-offset: 2px;
}

.settings-section-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--bb-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--bb-accent-soft);
  color: var(--bb-accent-ink);
}
.settings-section-icon svg { width: 18px; height: 18px; }

.settings-section-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.settings-section-title {
  font-family: var(--bb-font-display);
  font-size: var(--bb-text-lg);
  font-weight: var(--bb-weight-bold);
  color: var(--bb-ink);
  line-height: 1.25;
}

.settings-section-sub {
  font-size: var(--bb-text-sm);
  color: var(--bb-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Rotates to point down when open. Animating transform only, so the
   chevron turns without triggering layout. */
.settings-section-chevron {
  flex-shrink: 0;
  color: var(--bb-text-tertiary);
  transition: transform var(--bb-dur-base) var(--bb-ease);
}
.is-open .settings-section-chevron { transform: rotate(180deg); }
.is-open .settings-section-head {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-color: transparent;
  background: transparent;
}

/* The panel is a sibling of the trigger, not a child, so it gets its own
   border and the pair reads as one control split in half. */
.settings-section-body {
  padding: 0.25rem 0;
}
.is-open .settings-section-body {
  border: 1px solid var(--bb-border);
  border-top: none;
  border-radius: 0 0 var(--bb-radius-lg) var(--bb-radius-lg);
  background: var(--bb-surface);
  padding: 1.1rem;
  margin-top: -0.75rem;
}

/* Card Base */
.profile-summary-card,
.details-form-card,
.security-card,
.danger-card,
.activity-section {
  background: var(--bb-surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 1.75rem;
  box-shadow: var(--bb-shadow-xs);
}

.mt-breath { margin-top: 1.5rem; }

/* Personal Info Tab */
.personal-info-grid {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 1.5rem;
}

.avatar-large {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: var(--border);
  margin: 0 auto 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--bb-text-4xl);
  font-weight: var(--bb-weight-extrabold);
  color: var(--muted-2);
  border: 5px solid var(--bb-surface);
  outline: 1px solid var(--border);
}

.user-display-name { font-size: var(--bb-text-3xl); font-weight: var(--bb-weight-extrabold); color: var(--bb-ink); text-align: center; }
.user-display-role { text-align: center; color: var(--muted); font-size: var(--bb-text-lg); margin: 0.5rem 0 1.25rem; }
.joined-date { text-align: center; font-size: var(--bb-text-base); color: var(--muted-2); }

.card-heading { font-size: var(--bb-text-xl); font-weight: var(--bb-weight-extrabold); color: var(--bb-ink); margin-bottom: 1.25rem; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
.full-width { grid-column: span 2; }

.input-group label {
  display: block;
  font-size: var(--bb-text-base);
  font-weight: var(--bb-weight-bold);
  color: var(--bb-ink);
  margin-bottom: 0.75rem;
}

.input-wrapper {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--sand);
  border: 1px solid var(--border-soft);
  padding: 1rem 1.25rem;
  border-radius: 14px;
  color: var(--bb-ink);
}

.input-wrapper input,
.input-wrapper textarea {
  border: none;
  background: transparent;
  width: 100%;
  outline: none;
  font-family: inherit;
  font-size: var(--bb-text-lg);
  color: var(--ink);
}

.actions-right { display: flex; justify-content: flex-end; margin-top: 2rem; }
.save-btn {
  background: var(--bb-accent);
  color: var(--bb-on-accent);
  border: none;
  padding: 1rem 2.5rem;
  border-radius: 14px;
  font-weight: var(--bb-weight-bold);
  cursor: pointer;
}

/* Security Tab */
.security-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.card-heading-icon {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: var(--bb-text-lg);
  font-weight: var(--bb-weight-extrabold);
  color: var(--bb-ink);
  margin-bottom: 1.25rem;
}

.google-note {
  font-size: var(--bb-text-base);
  color: var(--muted);
  line-height: 1.6;
}

.soft-input {
  width: 100%;
  padding: 1rem 1.25rem;
  border-radius: 14px;
  border: 1px solid var(--border-soft);
  background: var(--sand);
  margin-bottom: 1.25rem;
}

.dark-btn-full {
  width: 100%;
  background: var(--bb-accent);
  color: var(--bb-on-accent);
  border: none;
  padding: 1rem;
  border-radius: 14px;
  font-weight: var(--bb-weight-bold);
  cursor: pointer;
  margin-top: 0.5rem;
}

.check-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.75rem;
}

.check-label { font-weight: var(--bb-weight-bold); color: var(--bb-ink); font-size: var(--bb-text-lg); }
.check-sub { font-size: var(--bb-text-base); color: var(--muted); margin-top: 0.25rem; }

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem 0;
  border-bottom: 1px solid var(--border-soft);
}

.device-text { font-weight: var(--bb-weight-bold); color: var(--ink); font-size: var(--bb-text-lg); }
.location-text { font-size: var(--bb-text-base); color: var(--muted); margin-top: 0.25rem; }

.status-badge.green {
  background: var(--bb-success-soft);
  color: var(--bb-success);
  padding: 0.35rem 1rem;
  border-radius: 8px;
  font-size: var(--bb-text-sm);
  font-weight: var(--bb-weight-bold);
}

.danger-card { border: 1px solid var(--bb-danger-soft); }
.danger-heading { color: var(--rust); display: flex; align-items: center; gap: 0.75rem; font-weight: var(--bb-weight-extrabold); font-size: var(--bb-text-xl); }
.danger-text { font-size: var(--bb-text-md); color: var(--muted); margin: 1.5rem 0; line-height: 1.5; }

.delete-btn {
  width: 100%;
  background: transparent;
  border: 1.5px solid var(--rust);
  color: var(--rust);
  padding: 1rem;
  border-radius: 14px;
  font-weight: var(--bb-weight-bold);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

/* Activity Tab */
.history-card-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--sand);
  padding: 2rem;
  border-radius: 20px;
  border: 1px solid var(--border-soft);
  margin-bottom: 1rem;
}

.permit-id { font-weight: var(--bb-weight-extrabold); font-size: var(--bb-text-xl); color: var(--bb-ink); margin-bottom: 0.5rem; }
.permit-details { font-size: var(--bb-text-md); color: var(--muted); margin-bottom: 1rem; }

.empty-state-sm {
  padding: 2rem;
  text-align: center;
  color: var(--muted-2);
  font-size: var(--bb-text-md);
}

/* The sections are accordions, so there is no rail to collapse. The only
   thing that changes on narrow screens is the internal card grids and the
   padding, which the 640px block below handles. */
@media (max-width: 1100px) {
  /* The 1100px column only reaches its cap once the viewport can afford it.
     Below that it needs the page gutter, or the cards run to the very edge
     of the screen while the dashboard beside them keeps its inset. */
  .settings-layout { padding-inline: 0.5rem; }
}

@media (max-width: 900px) {
  .user-profile-content { padding: 0.5rem 0; }
  /* All three grids collapse together. .form-grid was breaking at 640px while
     .security-grid broke at 900px, so between those two widths the form was
     still two columns while everything around it had gone to one. */
  .personal-info-grid,
  .security-grid,
  .form-grid { grid-template-columns: 1fr; gap: 1.25rem; }
  .settings-layout { margin-top: 1rem; }
}

@media (max-width: 640px) {
  .profile-title { font-size: var(--bb-text-2xl); }

  .profile-summary-card,
  .details-form-card,
  .security-card,
  .danger-card,
  .activity-section { padding: 1.25rem; }

  /* The accordion trigger needs a smaller footprint on a phone */
  .settings-section-head { padding: 0.85rem 0.9rem; gap: 0.6rem; }
  .settings-section-icon { width: 32px; height: 32px; }
  .settings-section-title { font-size: var(--bb-text-base); }
  .settings-section-sub { font-size: var(--bb-text-xs); }
  .is-open .settings-section-body { padding: 0.9rem; }

  .avatar-large { width: 100px; height: 100px; font-size: var(--bb-text-3xl); }
  .user-display-name { font-size: var(--bb-text-2xl); }

  .form-grid { grid-template-columns: 1fr; }
  .full-width { grid-column: span 1; }

  .check-item { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
  .history-item { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
  .history-card-item { flex-direction: column; align-items: flex-start; padding: 1.25rem; }

  .actions-right { justify-content: stretch; }
  .save-btn { width: 100%; }
}

@media (max-width: 480px) {
  .profile-summary-card,
  .details-form-card,
  .security-card,
  .danger-card,
  .activity-section { padding: 1rem; border-radius: 16px; }

  .avatar-large { width: 88px; height: 88px; font-size: var(--bb-text-2xl); border-width: 4px; }
  .user-display-name { font-size: var(--bb-text-xl); }
  .user-display-role { font-size: var(--bb-text-base); margin-bottom: 1rem; }

  .card-heading { margin-bottom: 1rem; }
  .input-wrapper { padding: 0.75rem 0.875rem; }
  .soft-input { padding: 0.75rem 0.875rem; }
  .save-btn, .dark-btn-full, .delete-btn { padding: 0.85rem; font-size: var(--bb-text-base); }
  .danger-text { font-size: var(--bb-text-base); margin: 1.25rem 0; }
}
</style>
