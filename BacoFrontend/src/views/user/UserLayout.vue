<template>
  <div class="app-shell">
    <!-- ═══ Ambience layer (what the glass blurs) ═══
         Three blurred colour blobs + a mountain silhouette. Static is
         deliberate: an animated backdrop forces backdrop-filter to
         re-blur every frame. Frozen = blurred once, then cached.
         Cheaper than a photo, and no external image request. -->
    <div class="ambience" aria-hidden="true">
      <div class="amb-blob amb-blob--1"></div>
      <div class="amb-blob amb-blob--2"></div>
      <div class="amb-blob amb-blob--3"></div>
      <svg class="amb-ridge" viewBox="0 0 1440 300" preserveAspectRatio="none">
        <polygon points="0,300 0,190 220,90 420,200 640,80 880,210 1100,120 1440,200 1440,300" fill="var(--amb-ridge-1)" />
        <polygon points="0,300 0,240 260,160 520,250 760,150 1040,250 1280,180 1440,240 1440,300" fill="var(--amb-ridge-2)" />
      </svg>
    </div>

    <UserSidebar
      :isSidebarOpen="isSidebarOpen"
      :isCollapsed="isCollapsed"
      @toggle-sidebar="toggleSidebar"
      @toggle-collapse="toggleCollapse"
    />

    <div class="main-wrap" :class="{ 'main-squeezed': isCollapsed }">
      <UserHeader
        :page-title="pageTitle"
        :show-mobile-menu="true"
        @toggle-sidebar="toggleSidebar"
      />

      <main class="page-content">
        <!-- Guard loading -->
        <div v-if="isGuardLoading" class="guard-loading">
          <svg class="animate-spin h-8 w-8" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Securing session...</span>
        </div>

        <!-- Actual content -->
        <router-view v-else v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" v-if="Component" :key="$route.fullPath" />
          </transition>
        </router-view>
      </main>
    </div>

    <!-- ═══ Mobile / Tablet Bottom Dock (icon-only) ═══ -->
    <nav class="mobile-dock" aria-label="Primary navigation">
      <button
        v-for="item in dockItems"
        :key="item.id"
        :class="['dock-tab', { active: isDockActive(item.route) }]"
        :aria-label="item.label"
        @click="router.push(item.route)"
      >
        <component :is="item.icon" :size="22" />
      </button>
    </nav>
  </div>
</template>

<script setup>
import './style/index.css'
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Home, Bed, Mountain, Map as MapIcon, User } from 'lucide-vue-next'
import UserSidebar from './components/UserSidebar.vue'
import UserHeader from './components/UserHeader.vue'
import { useUserStore } from '../../stores/useUserStore'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const isSidebarOpen = ref(false)
const isCollapsed = ref(false)
const isGuardLoading = ref(true)

const toggleSidebar = () => { isSidebarOpen.value = !isSidebarOpen.value }
const toggleCollapse = () => { isCollapsed.value = !isCollapsed.value }

/* ── Theme (auto + manual, persisted) ── */
const theme = ref('light')

const applyTheme = (t) => {
  theme.value = t
  document.documentElement.setAttribute('data-theme', t)
  try { localStorage.setItem('baco_theme', t) } catch (e) {}
}

/* ── Page title derived from route ── */
const pageTitles = {
  '/user/dashboard': 'Dashboard',
  '/user/hotels': 'Stays',
  '/user/permits': 'Halcon Permit',
  '/user/map': 'Trail Map',
  '/user/profile': 'Profile'
}
const pageTitle = computed(() => {
  const entry = Object.entries(pageTitles).find(([path]) => route.path.startsWith(path))
  return entry ? entry[1] : 'Basecamp Baco'
})

/* ── Bottom dock nav ── */
const dockItems = [
  { id: 'home',    label: 'Home',    icon: Home,    route: '/user/dashboard' },
  { id: 'stays',   label: 'Stays',   icon: Bed,     route: '/user/hotels' },
  { id: 'permit',  label: 'Permit',  icon: Mountain, route: '/user/permits' },
  { id: 'map',     label: 'Map',     icon: MapIcon, route: '/user/map' },
  { id: 'profile', label: 'Profile', icon: User,    route: '/user/profile' },
]
const isDockActive = (r) => route.path === r || route.path.startsWith(r + '/')

/* ── Auth guard ── */
const ensureAuth = async () => {
  if (userStore.token && !userStore.user) {
    const ok = await userStore.fetchUser()
    if (!ok) {
      userStore.logout()
      router.replace('/auth?redirect=' + encodeURIComponent(route.fullPath))
      return
    }
  }
  if (!userStore.token || !userStore.user) {
    router.replace('/auth?redirect=' + encodeURIComponent(route.fullPath))
    return
  }
  isGuardLoading.value = false
}

onMounted(() => {
  let saved = null
  try { saved = localStorage.getItem('baco_theme') } catch (e) {}
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
  applyTheme(saved || (prefersDark ? 'dark' : 'light'))
  ensureAuth()
})
</script>

<style>

/* ══ DARK MODE ══
   Only semantic values flip. The soft-UI pair is re-derived for the dark
   canvas — neumorphism needs the shadow colour to sit just off the
   surface, which inverts to a dark shadow plus a light one. */
</style>

<style scoped>
.app-shell {
  min-height: 100vh;
  height: 100vh;
  width: 100%;
  position: relative;
  overflow: hidden;
  display: flex;
  color: var(--bb-ink);
  font-family: var(--bb-font-body);
  background: var(--bb-bg);
  transition: background-color var(--bb-dur-base) var(--bb-ease);
}

/* ════════════════════════════════════════════════════════════
   GLASS. Reserved for position:fixed / sticky chrome only.
   Anything that scrolls relative to the backdrop re-blurs every
   frame, so scrolling content stays flat and opaque. Blur steps
   up with elevation: chrome 24-26px, overlays 30px.

   The four glass surfaces are .eco-sidebar / .drawer-panel
   (UserSidebar), .header-glass (UserHeader) and .mobile-dock
   (below) — each already declares its own filter.
   ════════════════════════════════════════════════════════════ */

/* Accessibility: honour users who ask for less transparency.
   Needs to be unscoped to reach the sidebar/header class names,
   hence the separate block at the end of this file. */

/* ═══ MAIN WRAP ═══ */
.main-wrap {
  flex: 1;
  margin-left: calc(var(--bb-sidebar-w) + var(--bb-shell-gap));
  min-width: 0;
  max-width: calc(var(--bb-content-max) + var(--bb-sidebar-w) + var(--bb-shell-gap));
  height: 100vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  transition: margin-left var(--bb-dur-base) var(--bb-ease);
}

.main-wrap.main-squeezed {
  margin-left: calc(var(--bb-sidebar-w-collapsed) + var(--bb-shell-gap));
}

.page-content {
  flex: 1;
  padding: var(--bb-gutter) var(--bb-gutter) 1.5rem;
  position: relative;
  z-index: 1;
  overflow-y: auto;
}

.guard-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  height: 60vh;
  color: var(--bb-text-secondary);
  font-size: var(--bb-text-md);
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.fade-enter-from { opacity: 0; transform: translateY(6px); }
.fade-leave-to { opacity: 0; }

/* ═══ Bottom Dock — hidden on desktop ═══ */
.mobile-dock { display: none; }

/* ═══ RESPONSIVE ═══ */
@media (max-width: 1024px) {
  .main-wrap { margin-left: 0; }

  .page-content {
    height: calc(100vh - var(--bb-header-h) - var(--bb-dock-h) - 24px - env(safe-area-inset-bottom, 0px));
    padding: 1.25rem 1.25rem calc(var(--bb-dock-h) + 32px + env(safe-area-inset-bottom, 0px));
  }

  .amb-blob { opacity: calc(var(--amb-blob-opacity) * 0.6); }

  .mobile-dock {
    display: flex;
    align-items: center;
    justify-content: space-around;
    gap: 4px;
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    height: var(--bb-dock-h);
    padding: 8px;
    background: var(--bb-glass-bg-strong);
    border: 1px solid var(--bb-glass-border);
      backdrop-filter: blur(var(--bb-glass-blur)) saturate(var(--bb-glass-sat));
    border-radius: var(--bb-radius-xl);
    box-shadow: var(--bb-glass-lg);
    z-index: var(--bb-z-dock);
  }

  .dock-tab {
    flex: 1;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--bb-text-tertiary);
    border-radius: var(--bb-radius-full);
    cursor: pointer;
    transition:
      color var(--bb-dur-base) var(--bb-ease),
      background var(--bb-dur-base) var(--bb-ease),
      transform var(--bb-dur-fast) var(--bb-ease-spring);
  }
  .dock-tab:active { transform: scale(0.88); }
  .dock-tab.active {
    color: var(--bb-accent-ink);
    background: var(--bb-accent-soft);
  }

  /* Blobs shrink on small screens: at 540px they swallow the viewport
     and the ridge has no room left to read. */
  .amb-blob--1 { width: 320px; height: 320px; }
  .amb-blob--2 { width: 280px; height: 280px; }
  .amb-blob--3 { width: 240px; height: 240px; }
  .amb-ridge { height: 20vh; }
}

@media (max-width: 480px) {
  .page-content {
    padding: 0.875rem 0.875rem calc(var(--bb-dock-h) + 28px + env(safe-area-inset-bottom, 0px));
  }
}
/* ════════════════════════════════════════════════════════════
   AMBIENCE — what the glass actually blurs.

   Three solid-colour blobs plus a two-layer ridge silhouette.
   Static by design: an animated backdrop forces every
   backdrop-filter above it to re-blur each frame. Frozen blurs
   once, then stays cached.

   This replaced a full-bleed photo with a luminosity blend. The
   blobs composite far cheaper, need no network request, and —
   because there is no photo tinting them — the glass above reads
   clean instead of picking up a colour cast.
   ════════════════════════════════════════════════════════════ */
.ambience {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  background: var(--bb-bg);
}

.amb-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(var(--amb-blob));
  opacity: var(--amb-blob-opacity);
}

.amb-blob--1 {
  width: 540px;
  height: 540px;
  background: var(--amb-blob-1);
  top: -180px;
  right: -140px;
}

.amb-blob--2 {
  width: 460px;
  height: 460px;
  background: var(--amb-blob-2);
  bottom: -160px;
  left: 20%;
}

.amb-blob--3 {
  width: 400px;
  height: 400px;
  background: var(--amb-blob-3);
  top: 36%;
  left: -160px;
}

/* Ridge sits at the very bottom, behind everything, at low contrast */
.amb-ridge {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: var(--amb-ridge);
  opacity: 0.3;
}

/* Data saver / metered connection: drop the ambience entirely and keep
   the flat canvas. Glass still reads correctly against a flat fill. */
@media (prefers-reduced-data: reduce) {
  .amb-blob,
  .amb-ridge { display: none; }
}

/* Respect reduced-motion for anything decorative. */
@media (prefers-reduced-motion: reduce) {
  .ambience,
  .amb-blob,
  .amb-ridge {
    animation: none !important;
    transition: none !important;
  }
}
</style>
<!-- Unscoped on purpose: .eco-sidebar / .drawer-panel / .header-glass live in
     UserSidebar.vue and UserHeader.vue, which a scoped block cannot reach. -->
<style>
/* Users who ask for reduced transparency get SOLID panels, not just an
   un-blurred translucent one. Killing backdrop-filter alone would leave a
   60%-alpha surface sitting on the ambience, which lowers contrast rather
   than raising it — so the background is forced alongside the filter. */
@media (prefers-reduced-transparency: reduce) {
  .eco-sidebar,
  .drawer-panel,
  .header-glass,
  .mobile-dock,
  .hero-banner,
  .weather-card,
  .stat-card,
  .action-card,
  .tip-banner,
  .glass {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    background: var(--bb-surface) !important;
  }
  .ambience { display: none; }
}
</style>
