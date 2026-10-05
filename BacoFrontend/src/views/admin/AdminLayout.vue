<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AdminDashboard from './AdminDashboard.vue'
import AdminHotel from './components/AdminHotel.vue'
import ResortsManager from './components/ResortsManager.vue'
import AdminSidebar from './components/AdminSidebar.vue'

const router = useRouter()
const currentMode = ref('home')
const isSidebarCollapsed = ref(false)
const sidebarMobileOpen = ref(false)
const notifications = ref([])
const isDark = ref(localStorage.getItem('admin_theme') !== 'light')
const adminLayoutRef = ref(null)
const workspaceRef = ref(null)

const modeLabels = {
  home: 'Dashboard', content: 'Visual Editor', news: 'News & Updates',
  tala: 'TALA Ledger', bplo: 'BPLO Permits', tourism: 'Tourism',
  halcon: 'Mt. Halcon Bookings', mho: 'Health (MHO)', users: 'User Management',
  documents: 'Documents', barangays: 'Barangays', charter: "Citizen's Charter",
  resorts: 'Owner Resorts', hotels: 'LGU Hotels', bookings: 'Booking Monitor',
  history: 'History'    
}
const currentLabel = computed(() => modeLabels[currentMode.value] || 'Dashboard')

onMounted(async () => {
  const storedTheme = localStorage.getItem('admin_theme')
  const theme = storedTheme === 'light' ? 'light' : 'dark'
  isDark.value = theme === 'dark'
  adminLayoutRef.value?.setAttribute('data-admin-theme', theme)
  // Mirror onto the document root as well. The login page renders outside
  // .admin-layout, so without this it would never see the dark tokens and
  // would stay light for a user who chose dark.
  document.documentElement.setAttribute('data-admin-theme', theme)
  const token = localStorage.getItem('baco_admin_token')
  if (!token) return
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE || 'http://localhost:3000/api'}/admin/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('baco_admin_token')
      localStorage.removeItem('baco_admin_role')
      localStorage.removeItem('baco_admin_data')
      router.replace('/admin/login')
    }
  } catch (e) { /* network error â€” leave the user in place */ }
})

const handleModeSwitch = (mode) => {
  if (mode === currentMode.value) return
  sidebarMobileOpen.value = false
  workspaceRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
  currentMode.value = mode
}
const toggleSidebar = () => {
  if (window.matchMedia('(max-width: 768px)').matches) sidebarMobileOpen.value = !sidebarMobileOpen.value
  else isSidebarCollapsed.value = !isSidebarCollapsed.value
}
const toggleTheme = () => {
  isDark.value = !isDark.value
  const theme = isDark.value ? 'dark' : 'light'
  adminLayoutRef.value?.setAttribute('data-admin-theme', theme)
  document.documentElement.setAttribute('data-admin-theme', theme)
  localStorage.setItem('admin_theme', theme)
}
const showNotification = (message, type = 'info') => {
  const id = Date.now()
  notifications.value.push({ id, message, type })
  setTimeout(() => { notifications.value = notifications.value.filter(n => n.id !== id) }, 3000)
}
</script>

<template>
  <div class="admin-layout" ref="adminLayoutRef" data-admin-theme="dark">
    <!-- SIDEBAR -->
    <AdminSidebar
      :active-mode="currentMode"
      :is-collapsed="isSidebarCollapsed"
      :mobile-open="sidebarMobileOpen"
      @switch-mode="handleModeSwitch"
    />
    <div v-if="sidebarMobileOpen" class="sidebar-backdrop" @click="sidebarMobileOpen = false"></div>

    <!-- MAIN COLUMN -->
    <div class="main-column">
      <!-- TOP BAR -->
      <header class="top-bar mat-glass">
        <div class="top-bar-left">
          <button class="toggle-btn mat-skeuo-sm mat-pressable-sm" @click="toggleSidebar" :title="isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'">
            <i class="fa-solid" :class="isSidebarCollapsed ? 'fa-bars' : 'fa-outdent'"></i>
          </button>
          <div class="breadcrumb">
            <span class="bc-root">Admin</span>
            <i class="fa-solid fa-chevron-right bc-sep"></i>
            <span class="bc-current">{{ currentLabel }}</span>
          </div>
        </div>
        <div class="top-bar-right">
          <button class="icon-btn mat-skeuo-sm mat-pressable-sm" :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'" @click="toggleTheme">
            <i class="fa-solid" :class="isDark ? 'fa-sun' : 'fa-moon'"></i>
          </button>
          <button class="icon-btn mat-skeuo-sm mat-pressable-sm" title="Notifications">
            <i class="fa-regular fa-bell"></i>
            <span class="badge mat-well">3</span>
          </button>
          <button class="icon-btn mat-skeuo-sm mat-pressable-sm" title="Settings">
            <i class="fa-solid fa-gear"></i>
          </button>
        </div>
      </header>

      <!-- WORKSPACE -->
      <main class="workspace" ref="workspaceRef">
        <div class="workspace-content" :key="currentMode">
          <AdminHotel v-if="currentMode === 'hotels'" />
          <ResortsManager v-else-if="currentMode === 'resorts'" />
          <AdminDashboard v-else :mode="currentMode" @change-mode="handleModeSwitch" />
        </div>
      </main>
    </div>

    <!-- NOTIFICATIONS -->
    <div class="notif-stack">
      <TransitionGroup name="slide-notif">
        <div v-for="n in notifications" :key="n.id" class="notif-item mat-glass-strong" :class="n.type">
          <i class="fa-solid" :class="{ 'fa-circle-check': n.type==='success', 'fa-circle-info': n.type==='info', 'fa-triangle-exclamation': n.type==='warning' }"></i>
          <span>{{ n.message }}</span>
          <button @click="notifications = notifications.filter(x => x.id !== n.id)">âœ•</button>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<!-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     DESIGN TOKENS (global, non-scoped)
     Dark-first glass theme. Embedded here so no
     extra file is needed. Later batches reuse these.
     â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• -->
<style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');



/* Light theme (admin-scoped via toggle) */


/* â”€â”€ Admin-wide polish â”€â”€ */
::selection { background: var(--acs2); color: var(--fg); }

button:focus-visible,
a:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid var(--ac);
  outline-offset: 2px;
}

input::placeholder,
textarea::placeholder {
  opacity: 0.72;
  color: var(--mt);
}

table {
  font-variant-numeric: tabular-nums;
}

code, pre, .mono {
  font-family: var(--font-mono);
}
</style>

<style scoped>
.admin-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: var(--bg);
  /* The ambience washes. Glass needs something behind it to blur; on a flat
     canvas a translucent panel just reads as a grey box. Fixed so it does
     not scroll away under long content. */
  background-image: var(--m-ambience);
  background-attachment: fixed;
  color: var(--fg);
  font-family: var(--font-body);
}

.main-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

/* â”€â”€ Top bar (glass) â”€â”€ */
/* Floating chrome -> GLASS. It already carried a backdrop-filter, but the
   background was the opaque --card, so the blur was blurring nothing and the
   bar read as flat. Now the fill is genuinely translucent. */
.top-bar {
  height: var(--header-h);
  flex-shrink: 0;
  position: relative;
  background-image: var(--m-glass);
  backdrop-filter: blur(22px) saturate(160%);
  -webkit-backdrop-filter: blur(22px) saturate(160%);
  box-shadow: var(--m-glass-shadow);
  z-index: 20; border-bottom: 1px solid var(--m-glass-edge); display: flex; align-items: center; justify-content: space-between; padding: 0 24px; gap: 14px; z-index: 100; }

.top-bar-left { display: flex; align-items: center; gap: 10px; }
.top-bar-right { display: flex; align-items: center; gap: 10px; }

/* Pressable -> SKEUO. Four parts, not one: top specular, bottom shade,
   contact shadow, cast shadow. */
.toggle-btn { width: 40px; height: 40px; border-radius: var(--r-sm); font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.25s var(--ease); flex-shrink: 0; }
/* Hover raises the key; the lifted face gets the brighter mould gradient. */
.toggle-btn:hover { transform: translateY(-2px); }
/* Pressed: the specular collapses and the contact shadow moves inside, which
   is what sells "down" rather than "moved". */
.toggle-btn:active {  }

.breadcrumb { display: flex; align-items: center; gap: 8px; }
.bc-root { font-size: 0.82rem; font-weight: 500; color: var(--mt); }
.bc-sep { font-size: 0.55rem; color: var(--mt2); }
.bc-current {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--fg);
  letter-spacing: 0.02em;
}

.icon-btn { width: 40px; height: 40px; border-radius: var(--r-sm); font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; position: relative; transition: all 0.25s var(--ease); }
.icon-btn:hover { transform: translateY(-2px); }
.icon-btn:active {  }

.badge {
  position: absolute;
  top: -4px; right: -4px;
  min-width: 18px; height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--m-accent-solid);
  color: #fff;
  font-size: 0.55rem;
  font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid var(--bg);
  box-shadow: 0 0 0 0 var(--acg);
  animation: badge-pulse 2s infinite;
}
@keyframes badge-pulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--acg); }
  50% { box-shadow: 0 0 0 6px transparent; }
}

/* â”€â”€ Workspace â”€â”€ */
.workspace {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  /* Opaque base so content never sits directly on the layout's own washes,
     with the ambience repeated on top so glass panels INSIDE the scrolling
     area have something local to blur. Fixed, so it holds still while the
     content scrolls under it. */
  background-color: var(--bg);
  background-image: var(--m-ambience);
  background-attachment: fixed;
}

/* â”€â”€ Mode loading / transition â”€â”€ */
.workspace-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Scoped scrollbars */
.admin-layout ::-webkit-scrollbar { width: 5px; height: 5px; }
.admin-layout ::-webkit-scrollbar-track { background: transparent; }
.admin-layout ::-webkit-scrollbar-thumb { background: var(--bdr2); border-radius: 3px; }
.admin-layout ::-webkit-scrollbar-thumb:hover { background: var(--bdr3); }

/* â”€â”€ Notifications â”€â”€ */
.notif-stack {
  position: fixed;
  bottom: 24px; right: 24px;
  z-index: 9999;
  display: flex; flex-direction: column; gap: 10px;
}
/* Floating chrome -> GLASS. Same pre-existing flaw as the top bar: a
   backdrop-filter over an opaque --card blurs nothing. */
.notif-item { display: flex; align-items: center; gap: 12px; padding: 13px 18px; border-radius: var(--r-md); font-size: 0.85rem; font-weight: 600; min-width: 280px; max-width: 380px; }
.notif-item i { font-size: 1.05rem; flex-shrink: 0; }
.notif-item.success { border-left: 3px solid var(--ok); }
.notif-item.success i { color: var(--ok); }
.notif-item.info { border-left: 3px solid var(--tl); }
.notif-item.info i { color: var(--tl); }
.notif-item.warning { border-left: 3px solid var(--wn); }
.notif-item.warning i { color: var(--wn); }
.notif-item button {
  margin-left: auto;
  background: none; border: none;
  color: var(--mt);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
  font-size: 0.8rem;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.notif-item button:hover { color: var(--fg); background: var(--card3); }

.slide-notif-enter-active { transition: all 0.35s var(--ease-bounce); }
.slide-notif-leave-active { transition: all 0.25s ease; }
.slide-notif-enter-from, .slide-notif-leave-to { opacity: 0; transform: translateX(40px); }
.slide-notif-move { transition: transform 0.3s var(--ease); }

/* â”€â”€ Responsive â”€â”€ */
@media (max-width: 1024px) {
  .top-bar { padding: 0 16px; }
  .breadcrumb { display: none; }
}
@media (max-width: 768px) {
  .admin-layout { overflow-x: hidden; }
  .top-bar { padding: 0 12px; }
  .toggle-btn, .icon-btn { width: 36px; height: 36px; }
  .badge { display: none; }
}
@media (max-width: 480px) {
  .top-bar-left, .top-bar-right { gap: 6px; }
}

/* Mobile sidebar backdrop */
.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  z-index: 190;
}
@media (min-width: 769px) {
  .sidebar-backdrop { display: none; }
}
</style>