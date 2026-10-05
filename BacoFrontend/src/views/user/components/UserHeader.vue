<template>
  <header class="eco-header">
    <div class="header-glass"></div>

    <div class="header-inner">
      <div class="header-left">
        <button class="mobile-menu" @click="$emit('toggle-sidebar')">
          <img src="/images/BACO-TOURISM.png" alt="Open navigation menu" class="mobile-menu-logo" />
        </button>
        <div class="header-title-block">
          <p class="eyebrow">Baco Tourism</p>
          <h1 class="page-title">{{ pageTitle }}</h1>
        </div>
      </div>

      <div class="header-right">
        <div class="header-search" v-if="!isMobile">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input type="text" placeholder="Search resorts, permits…" />
        </div>

        <button class="icon-btn notification-btn">
          <Bell :size="19" :stroke-width="2.5" />
          <span class="notification-badge"></span>
        </button>

        <!-- Messages: wrapper anchors the popup to the button itself,
             so the caret always aligns with the envelope regardless of
             how wide the profile text beside it is. -->
        <div class="msg-wrap">
          <button
            class="icon-btn hb-env"
            :class="{ 'is-open': showMsg }"
            @click="toggleMsg"
            title="Messages"
          >
            <Mail :size="19" :stroke-width="2.5" />
            <span v-if="msgBadge > 0" class="msg-badge">{{ msgBadge }}</span>
          </button>

          <!-- Messages Popup -->
          <UserMessages v-if="showMsg" @close="showMsg = false" />
        </div>

        <router-link to="/user/profile" class="user-profile">
          <div class="user-avatar">{{ userStore.initials }}</div>
          <div class="user-info">
            <p class="user-name">{{ userStore.displayName }}</p>
            <p class="user-role">{{ userStore.user?.isGoogleUser ? 'Google Account' : 'Tourist' }}</p>
          </div>
        </router-link>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { Bell, Mail } from 'lucide-vue-next'
import { useUserStore } from '../../../stores/useUserStore'
import UserMessages from './UserMessages.vue'

defineProps({
  showMobileMenu: { type: Boolean, default: true },
  pageTitle: { type: String, default: 'Dashboard' }
})
defineEmits(['toggle-sidebar'])

const userStore = useUserStore()
const isMobile = ref(false)

// ─── Messages Popup + LIVE unread badge ──────────────────────
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const showMsg = ref(false)
const msgBadge = ref(0)          // was hardcoded 3 — now real
let badgeTimer = null

async function fetchUnread() {
  if (showMsg.value) return       // popup open — badge was zeroed on open
  if (!userStore.token) { msgBadge.value = 0; return }
  try {
    const res = await fetch(`${API}/messages/unread-count`, {
      headers: { Authorization: 'Bearer ' + userStore.token }
    })
    if (!res.ok) return
    const data = await res.json()
    msgBadge.value = Number(data.unread) || 0
  } catch { /* keep last known count */ }
}

const toggleMsg = () => {
  showMsg.value = !showMsg.value
  if (showMsg.value) msgBadge.value = 0   // original "opening = viewed" behavior
}

// When the popup closes, chats opened inside it were marked read → re-sync
watch(showMsg, (open, wasOpen) => { if (wasOpen && !open) fetchUnread() })

const checkMobile = () => { isMobile.value = window.innerWidth <= 1024 }
onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  fetchUnread()
  badgeTimer = setInterval(fetchUnread, 30000)   // new messages → badge within 30s
})
onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  if (badgeTimer) clearInterval(badgeTimer)
})
</script>

<style scoped>
.eco-header {
  position: sticky;
  top: 0;
  z-index: var(--bb-z-header);
  height: var(--bb-header-h);
  flex-shrink: 0;
  padding: 10px 12px 0;
}

.header-glass {
  position: absolute;
  inset: 0;
  top: 12px;
  border-radius: var(--bb-radius-lg);
  background: var(--bb-glass-bar);
  border: 1px solid var(--bb-glass-border);
  backdrop-filter: blur(24px) saturate(150%);
  -webkit-backdrop-filter: blur(24px) saturate(150%);
  box-shadow: var(--bb-glass-shadow);
}

.header-inner {
  position: relative;
  z-index: 1;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 1rem;
}

/* ── Left ── */
.header-left { display: flex; align-items: center; gap: 0.9rem; }

.mobile-menu {
  display: none;
  width: 72px;
  height: 56px;
  padding: 4px;
  border-radius: var(--bb-radius-sm);
  background: transparent;
  border: 0;
  color: var(--bb-ink);
  cursor: pointer;
  align-items: center;
  justify-content: center;
  box-shadow: none;
}

.mobile-menu-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.eyebrow {
  font-size: var(--bb-text-2xs);
  font-weight: var(--bb-weight-bold);
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--bb-accent-ink);
  margin-bottom: 0;
}

.page-title {
  font-family: var(--bb-font-display);
  font-size: var(--bb-text-xl);
  font-weight: var(--bb-weight-extrabold);
  color: var(--bb-ink);
  letter-spacing: -0.02em;
  line-height: 1.1;
  margin: 0;
}

/* ── Right ── */
.header-right { display: flex; align-items: center; gap: 0.75rem; }

/* Search is an INSET soft-UI well, not a bordered pill. A well reads as
   "type here" without needing a border, which is what keeps the topbar
   quiet. Focus adds a lime ring rather than a border-colour change. */
.header-search {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.55rem 1rem;
  background: var(--bb-nm-base);
  border-radius: var(--bb-radius-pill);
  color: var(--bb-text-tertiary);
  width: 230px;
  box-shadow: var(--bb-nm-inset);
  transition: box-shadow var(--bb-dur-fast) var(--bb-ease);
}

.header-search:focus-within {
  box-shadow: var(--bb-nm-inset), var(--bb-ring);
}

.header-search input {
  flex: 1;
  border: none;
  background: transparent;
  font-family: var(--bb-font-body);
  font-size: var(--bb-text-sm);
  color: var(--bb-ink);
  outline: none;
}

.header-search input::placeholder { color: var(--bb-text-tertiary); }

.icon-btn {
  position: relative;
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: var(--bb-radius-sm);
  border: 1px solid var(--bb-border);
  background: var(--bb-surface);
  color: var(--bb-ink);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--bb-shadow-xs);
  transition: all var(--bb-dur-fast) var(--bb-ease);
}

.icon-btn:hover {
  color: var(--bb-accent-ink);
  transform: translateY(-2px);
}

/* Anchor for the messages popup — relative to the envelope button */
.msg-wrap { position: relative; display: flex; }

/* Envelope active state while the popup is open: inset, not outlined —
   the well reads as pressed rather than selected. */
.icon-btn.hb-env.is-open {
  color: var(--bb-accent-ink);
  box-shadow: var(--bb-nm-inset-sm);
}

.notification-badge {
  position: absolute;
  top: 9px;
  right: 10px;
  width: 8px;
  height: 8px;
  background: var(--bb-sun);
  border-radius: 50%;
  border: 2px solid var(--bb-surface);
}

/* Numeric badge for unread messages */
.msg-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--bb-danger);
  color: #fff;
  font-size: var(--bb-text-2xs);
  font-weight: var(--bb-weight-extrabold);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--bb-surface);
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 4px 12px 4px 4px;
  border-radius: var(--bb-radius-pill);
  background: var(--bb-surface);
  border: 1px solid var(--bb-border);
  text-decoration: none;
  box-shadow: var(--bb-shadow-xs);
  transition: transform var(--bb-dur-fast) var(--bb-ease);
}

.user-profile:hover { transform: translateY(-2px); }

.user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--bb-accent);
  color: var(--bb-on-accent);
  font-size: var(--bb-text-xs);
  font-weight: var(--bb-weight-extrabold);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-info { text-align: left; }
.user-name { font-size: var(--bb-text-sm); font-weight: var(--bb-weight-bold); color: var(--bb-ink); line-height: 1.2; }
.user-role { font-size: var(--bb-text-2xs); color: var(--bb-text-tertiary); }

/* ── Responsive ── */
@media (max-width: 1024px) {
  .eco-header { padding: 10px 12px 0; }
  .header-glass { top: 10px; }
  .mobile-menu { display: flex; }
  .eyebrow { display: none; }
  .page-title { font-size: var(--bb-text-xl); }
  .user-info { display: none; }
  .user-profile { border-left: none; padding-left: 0; }
}

/* Tighten on very narrow screens so the right-side controls
   (notification, messages, profile) never get clipped. */
@media (max-width: 480px) {
  .eco-header { padding: 8px 8px 0; }
  .header-glass { top: 8px; }
  .header-inner { height: 58px; padding: 0 0.75rem; gap: 0.5rem; }
  .header-left { gap: 0.5rem; }
  .header-right { gap: 0.4rem; }
  .icon-btn { width: 36px; height: 36px; }
  .user-avatar { width: 34px; height: 34px; }
  .page-title { font-size: var(--bb-text-lg); }
  .notification-badge { top: 8px; right: 9px; }
  .msg-badge { border-width: 1.5px; }
}
</style>
