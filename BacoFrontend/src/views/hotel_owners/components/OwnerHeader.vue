<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import OwnerMessages from './OwnerMessages.vue';
import { useTheme } from '../composables/useTheme';

const props = defineProps({
  owner: { type: Object, default: null },
  // Mirrors the drawer's state so the trigger can carry aria-expanded.
  open: { type: Boolean, default: false }
});

const emit = defineEmits(['toggle-sidebar']);

// ─── Theme Toggle Logic (single source of truth) ─────────────
const { isDarkMode, toggleTheme, initTheme } = useTheme();
initTheme();

// ─── API + owner token (the key your real login flow saves) ──
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const getOwnerToken = () =>
  localStorage.getItem('baco_owner_token') || localStorage.getItem('ownerToken') || '';

// ─── Notifications ───────────────────────────────────────────
const notifications = ref([
  { icon: 'fa-calendar-plus', color: '#F20707', title: 'New booking at Coral Bay Resort', time: '2 min ago', unread: true },
  { icon: 'fa-star', color: '#F2B807', title: '5-star review from Anna Cruz', time: '28 min ago', unread: true },
  { icon: 'fa-credit-card', color: '#B0D91E', title: 'Payment of ₱12,500 confirmed', time: '1 hour ago', unread: true },
  { icon: 'fa-landmark', color: '#D9B384', title: 'LGU verification in progress', time: '3 hours ago', unread: false },
  { icon: 'fa-exclamation-circle', color: '#F20707', title: 'Room 301 maintenance overdue', time: 'Yesterday', unread: false }
]);

const showNotif = ref(false);
const searchQuery = ref('');
const unreadCount = ref(3);

// ─── Messages Popup + LIVE unread badge ─────────────────────
const showMsg = ref(false);
const msgBadge = ref(0);          // was hardcoded 3 — now real
let badgeTimer = null;

async function fetchUnread() {
  if (showMsg.value) return;      // popup open — badge already zeroed
  try {
    const res = await fetch(`${API}/owner/messages/unread-count`, {
      headers: { Authorization: 'Bearer ' + getOwnerToken() }
    });
    if (!res.ok) return;
    const data = await res.json();
    msgBadge.value = Number(data.unread) || 0;
  } catch { /* keep last known count */ }
}

const toggleMsg = () => {
  showNotif.value = false;          // only one dropdown at a time
  showMsg.value = !showMsg.value;
  if (showMsg.value) msgBadge.value = 0;
};

// Re-sync when the popup closes (threads opened inside were marked read)
watch(showMsg, (open, wasOpen) => { if (wasOpen && !open) fetchUnread(); });

const toggleNotif = () => {
  showMsg.value = false;
  showNotif.value = !showNotif.value;
};

const markAllRead = () => {
  notifications.value.forEach(n => n.unread = false);
  unreadCount.value = 0;
};

// ─── Click-outside: close the notifications panel ────────────
const onDocMousedown = (e) => {
  if (showNotif.value && !e.target.closest('.notif-panel') && !e.target.closest('.hb-bell')) {
    showNotif.value = false;
  }
};

onMounted(() => {
  document.addEventListener('mousedown', onDocMousedown);
  fetchUnread();
  badgeTimer = setInterval(fetchUnread, 30000);
});
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMousedown);
  if (badgeTimer) clearInterval(badgeTimer);
});
</script>

<template>
  <header class="hd">
    <!-- Drawer trigger. OwnerLayout binds @toggle-sidebar and OwnerSidebar
         reads the `open` prop, but nothing emitted this event until now, so the
         whole off-canvas drawer was unreachable and 8 of the 11 owner pages had
         no mobile route at all. Hidden above 1024px, where the sidebar is
         permanently docked. -->
    <button
      class="hb hb-burger"
      type="button"
      aria-label="Open navigation menu"
      aria-controls="owner-sidebar"
      :aria-expanded="String(open)"
      @click="emit('toggle-sidebar')"
    >
      <img src="/images/BACO-TOURISM.png" alt="Open navigation menu" class="hb-burger-logo" />
    </button>

    <div class="hs">
      <i class="fas fa-search"></i>
      <input v-model="searchQuery" type="text" placeholder="Search hotels, bookings, guests..." />
      <span class="sk">Ctrl+K</span>
    </div>

    <div class="ha">
      <!-- Theme Toggle Button -->
      <button class="hb" @click="toggleTheme" :title="isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'">
        <i :class="isDarkMode ? 'fas fa-moon' : 'fas fa-sun'"></i>
      </button>

      <button class="hb hb-bell" @click="toggleNotif">
        <i class="fas fa-bell"></i>
        <span v-if="unreadCount > 0" class="dt">{{ unreadCount }}</span>
      </button>

      <!-- Messages: wrapper anchors the popup to the button itself,
           so the caret always aligns with the envelope. -->
      <div class="msg-wrap">
        <button
          class="hb hb-env"
          :class="{ 'is-open': showMsg }"
          @click="toggleMsg"
          title="Messages"
        >
          <i class="fas fa-envelope"></i>
          <span v-if="msgBadge > 0" class="dt">{{ msgBadge }}</span>
        </button>

        <!-- Messages Popup (iMessage style) -->
        <OwnerMessages v-if="showMsg" @close="showMsg = false" />
      </div>

      <button class="hb">
        <i class="fas fa-expand"></i>
      </button>

      <div class="profile-mini">
        <div class="av">{{ owner?.first_name?.[0] || 'M' }}{{ owner?.last_name?.[0] || 'R' }}</div>
      </div>
    </div>

    <!-- Notification Dropdown -->
    <div v-if="showNotif" class="notif-panel">
      <div class="np-h">
        <h3>Notifications</h3>
        <button class="mark-all" @click="markAllRead">Mark all read</button>
      </div>
      <div class="np-b">
        <div
          v-for="(n, i) in notifications"
          :key="i"
          class="np-i"
          :class="{ unread: n.unread }"
        >
          <div class="np-ic" :style="{ background: n.color + '18', color: n.color }">
            <i :class="'fas ' + n.icon"></i>
          </div>
          <div class="np-tx">
            <p>{{ n.title }}</p>
            <time>{{ n.time }}</time>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.hd {
  position: sticky;
  top: 0;
  z-index: 40;
  padding: 14px 24px;
  background: var(--card, rgba(5,5,7,.85));
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-bottom: 1px solid var(--bdr, #25252E);
  display: flex;
  align-items: center;
  gap: 14px;
}

.hs {
  flex: 1;
  max-width: 400px;
  position: relative;
}

@media (max-width: 768px) {
  .hs { display: none; }
}

.hs i {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--mt, #7A7A8A);
  font-size: 12px;
}

.hs input {
  width: 100%;
  padding: 10px 60px 10px 40px;
  background: var(--bg2, #111118);
  border: 1px solid var(--bdr, #25252E);
  border-radius: 10px;
  color: var(--fg, #fff);
  font-size: 13px;
  outline: none;
  transition: all .3s;
}

.hs input::placeholder { color: var(--mt, #7A7A8A); }
.hs input:focus {
  border-color: var(--ac, #F20707);
  box-shadow: 0 0 0 3px var(--acs, rgba(255,61,0,.15));
}

.sk {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 9px;
  padding: 3px 6px;
  border-radius: 5px;
  background: var(--bg, #050507);
  border: 1px solid var(--bdr, #25252E);
  color: var(--mt, #7A7A8A);
  font-weight: 700;
}

.ha {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.hb {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--bg2, #111118);
  border: 1px solid var(--bdr, #25252E);
  color: var(--fg2, #E0E0E8);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all .25s;
  position: relative;
}
/* Drawer trigger — desktop docks the sidebar, so it has no job above 1024px. */
.hb-burger { display: none; flex-shrink: 0; padding: 4px; width: 72px; height: 56px; border-radius: 14px; background: transparent; border-color: transparent; }
.hb-burger:hover { background: transparent; border-color: transparent; transform: none; box-shadow: none; }
.hb-burger-logo { width: 100%; height: 100%; object-fit: contain; display: block; }
@media (max-width: 1024px) {
  .hb-burger { display: flex; }
}

.hb:hover {
  background: var(--card2, #18181F);
  border-color: var(--bdr2, #35353F);
  color: var(--fg, #fff);
  transform: translateY(-2px);
}

.hb:active { transform: translateY(0) scale(.95); }

/* Anchor for the messages popup — relative to the envelope button */
.msg-wrap { position: relative; display: flex; }

/* Envelope active state while the popup is open */
.hb.hb-env.is-open {
  color: var(--ac, #F20707);
  border-color: var(--ac, #F20707);
}

.dt {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--ac, #F20707);
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--bg, #050507);
  animation: dp 2s infinite;
}

@keyframes dp {
  0%, 100% { box-shadow: 0 0 0 0 var(--acg, rgba(255,61,0,.5)); }
  50% { box-shadow: 0 0 0 6px transparent; }
}

.profile-mini {
  margin-left: 6px;
  padding-left: 12px;
  border-left: 1px solid var(--bdr, #25252E);
}

.av {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--ac, #F20707), var(--wn, #F2B807));
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Unbounded', sans-serif;
  font-weight: 700;
  font-size: 13px;
  color: #fff;
  cursor: pointer;
  transition: transform .3s;
}

.av:hover { transform: scale(1.05); }

/* Notification Panel */
.notif-panel {
  position: absolute;
  top: 70px;
  right: 24px;
  width: 360px;
  max-width: 90vw;
  background: var(--card, #111118);
  border: 1px solid var(--bdr, #25252E);
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0,0,0,.5);
  z-index: 100;
  overflow: hidden;
  animation: slideDown .3s cubic-bezier(.22,1,.36,1);
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.np-h {
  padding: 16px;
  border-bottom: 1px solid var(--bdr, #25252E);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.np-h h3 {
  font-family: 'Unbounded', sans-serif;
  font-size: 14px;
  font-weight: 700;
  color: var(--fg, #fff);
  margin: 0;
}

.mark-all {
  background: none;
  border: none;
  color: var(--ac, #F20707);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all .2s;
}

.mark-all:hover { background: var(--acs, rgba(255,61,0,.1)); }

.np-b {
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
}

.np-i {
  display: flex;
  gap: 10px;
  padding: 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all .2s;
  margin-bottom: 2px;
}

.np-i:hover { background: var(--card2, #18181F); }
.np-i.unread { background: var(--acs, rgba(255,61,0,.06)); }

.np-ic {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}

.np-tx { flex: 1; }
.np-tx p { font-size: 12.5px; font-weight: 600; color: var(--fg, #fff); margin: 0 0 2px; line-height: 1.4; }
.np-tx time { font-size: 10.5px; color: var(--mt, #7A7A8A); }
</style>