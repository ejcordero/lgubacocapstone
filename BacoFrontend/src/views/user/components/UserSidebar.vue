<template>
  <!-- ═══════════════════════════════════════════════════════ -->
  <!-- DESKTOP SIDEBAR (Hidden on Mobile)                      -->
  <!-- ═══════════════════════════════════════════════════════ -->
  <aside class="eco-sidebar" :class="{ collapsed: isCollapsed }">
    <div class="sb-brand">
      <div class="sb-brand-icon">
        <img src="/images/BACO-TOURISM.png" alt="Baco Tourism" />
      </div>
    </div>

    <nav class="sb-nav">
      <div v-for="(section, si) in navSections" :key="si">
        <div v-if="!isCollapsed" class="sb-section-label">{{ section.label }}</div>
        <router-link
          v-for="item in section.items"
          :key="item.id"
          :to="item.route"
          custom
          v-slot="{ navigate, isActive }"
        >
          <button
            class="sb-link"
            :class="{ active: isActive }"
            :title="item.name"
            @click="navigate"
          >
            <component :is="item.icon" :size="19" class="sb-icon" />
            <span v-if="!isCollapsed" class="sb-link-text">{{ item.name }}</span>
          </button>
        </router-link>
      </div>
    </nav>

    <div class="sb-footer">
      <button class="sb-link theme-toggle" :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'" @click="toggleTheme">
        <Sun :size="19" v-if="isDark" class="sb-icon" />
        <Moon :size="19" v-else class="sb-icon" />
        <span v-if="!isCollapsed" class="sb-link-text">{{ isDark ? 'Light Mode' : 'Dark Mode' }}</span>
      </button>

      <div class="sb-user" v-if="!isCollapsed">
        <div class="sb-avatar">{{ userStore.initials }}</div>
        <div class="sb-user-info">
          <p class="sb-user-name">{{ userStore.displayName }}</p>
          <p class="sb-user-role">{{ userStore.user?.isGoogleUser ? 'Google Account' : 'Tourist' }}</p>
        </div>
        <button class="sb-logout" title="Log out" @click="handleLogout">
          <LogOut :size="17" />
        </button>
      </div>
    </div>
  </aside>

  <!-- ═══════════════════════════════════════════════════════ -->
  <!-- MOBILE DRAWER (Hidden on Desktop)                       -->
  <!-- ═══════════════════════════════════════════════════════ -->
  <transition name="drawer">
    <div v-if="isSidebarOpen" class="mobile-wrap">
      <div class="drawer-backdrop" @click="closeSidebar"></div>
      <div class="drawer-panel">
        <div class="drawer-header">
          <div class="sb-brand">
            <div class="sb-brand-icon">
              <img src="/images/BACO-TOURISM.png" alt="Baco Tourism" />
            </div>
          </div>
          <button class="drawer-close" @click="closeSidebar">
            <X :size="20" />
          </button>
        </div>

        <div class="drawer-nav">
          <div v-for="(section, si) in navSections" :key="si">
            <div class="sb-section-label">{{ section.label }}</div>
            <router-link
              v-for="item in section.items"
              :key="item.id"
              :to="item.route"
              custom
              v-slot="{ navigate, isActive }"
            >
              <button
                class="sb-link"
                :class="{ active: isActive }"
                @click="() => { navigate(); closeSidebar(); }"
              >
                <component :is="item.icon" :size="19" class="sb-icon" />
                <span class="sb-link-text">{{ item.name }}</span>
              </button>
            </router-link>
          </div>
        </div>

        <div class="drawer-footer">
          <button class="drawer-theme" @click="toggleTheme">
            <Sun :size="18" v-if="isDark" />
            <Moon :size="18" v-else />
            <span>{{ isDark ? 'Light Mode' : 'Dark Mode' }}</span>
          </button>
          <button class="drawer-logout" @click="handleLogout">
            <LogOut :size="18" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Mountain, Home, Bed, Calendar, Star, Map as MapIcon,
  Settings, LogOut, X, Sun, Moon
} from 'lucide-vue-next'
import { useUserStore } from '../../../stores/useUserStore'

const router = useRouter()
const userStore = useUserStore()
const isDark = ref(false)

defineProps({
  isSidebarOpen: Boolean,
  isCollapsed: Boolean
})
const emit = defineEmits(['toggle-sidebar', 'toggle-collapse'])
const closeSidebar = () => emit('toggle-sidebar')

// Restore saved theme if nothing has applied it yet
// (harmless no-op if App.vue already sets data-theme before mount)
onMounted(() => {
  const current = document.documentElement.getAttribute('data-theme')
  if (current) {
    isDark.value = current === 'dark'
  } else {
    let saved = 'light'
    try { saved = localStorage.getItem('baco_theme') || 'light' } catch (e) {}
    document.documentElement.setAttribute('data-theme', saved)
    isDark.value = saved === 'dark'
  }
})

const toggleTheme = () => {
  const next = isDark.value ? 'light' : 'dark'
  isDark.value = !isDark.value
  document.documentElement.setAttribute('data-theme', next)
  try { localStorage.setItem('baco_theme', next) } catch (e) {}
}

// Every route here is registered in index.js under /user
const navSections = [
  {
    label: 'Main',
    items: [
      { id: 'dashboard', name: 'Dashboard',   icon: Home,     route: '/user/dashboard' },
      { id: 'stays',     name: 'Stays',       icon: Bed,      route: '/user/hotels' },
      { id: 'bookings',  name: 'My Bookings', icon: Calendar, route: '/user/bookings' },
      { id: 'reviews',   name: 'My Reviews',  icon: Star,     route: '/user/reviews' },
    ]
  },
  {
    label: 'Explore',
    items: [
      { id: 'permit', name: 'Halcon Permit', icon: Mountain, route: '/user/permits' },
      { id: 'map',    name: 'Trail Map',     icon: MapIcon,  route: '/user/map' },
    ]
  },
  {
    label: 'Account',
    items: [
      { id: 'profile', name: 'Profile', icon: Settings, route: '/user/profile' },
    ]
  }
]

const handleLogout = () => {
  userStore.logout()
  router.push('/tourism')
}
</script>

<style scoped>
/* ── DESKTOP SIDEBAR ── */
.eco-sidebar {
  position: fixed;
  left: 14px;
  top: 14px;
  bottom: 14px;
  width: var(--bb-sidebar-w);
  margin-left: 0;
  background: var(--bb-glass-panel);
  border: 1px solid var(--bb-glass-border);
  backdrop-filter: blur(26px) saturate(150%);
  -webkit-backdrop-filter: blur(26px) saturate(150%);
  border-radius: var(--bb-radius-xl);
  box-shadow: var(--bb-glass-lg);
  z-index: var(--bb-z-header);
  display: flex;
  flex-direction: column;
  padding: 14px 10px;
  transition:
    width var(--bb-dur-base) var(--bb-ease),
    background-color var(--bb-dur-base) var(--bb-ease);
  overflow: hidden;
}

.eco-sidebar.collapsed {
  width: var(--bb-sidebar-w-collapsed);
  padding: 16px 12px;
}

/* ── Brand ── */
/* The logo is the only child now, so the row centres it instead of
   left-aligning it against the rail's padding. */
.sb-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 6px 14px;
  flex-shrink: 0;
}

/* BACO-TOURISM.png is a wide lockup (642x283, content ~3.24:1), so the tile
   widens to the artwork's aspect instead of forcing it into a 44px square. */
.sb-brand-icon {
  width: 150px;
  height: auto;
  background: none;
  border: 0;
  padding: 0;
  display: block;
  flex-shrink: 0;
}
.sb-brand-icon img {
  width: 100%;
  height: auto;
  object-fit: contain;
  display: block;
}

.brand-name {
  font-family: var(--bb-font-display);
  font-size: var(--bb-text-lg);
  font-weight: var(--bb-weight-extrabold);
  color: var(--bb-ink);
  letter-spacing: -0.02em;
  line-height: 1.1;
  white-space: nowrap;
}

.brand-sub {
  font-size: var(--bb-text-2xs);
  font-weight: var(--bb-weight-bold);
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--bb-accent-ink);
  margin-top: 3px;
  white-space: nowrap;
}

.eco-sidebar.collapsed .brand-name,
.eco-sidebar.collapsed .brand-sub { display: none; }
.eco-sidebar.collapsed .sb-brand { justify-content: center; padding-left: 0; padding-right: 0; }

/* ── Nav ── */
.sb-nav {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 4px;
  scrollbar-width: thin;
  scrollbar-color: var(--bb-border) transparent;
  padding-top: 4px;
}

.sb-section-label {
  font-size: var(--bb-text-2xs);
  font-weight: var(--bb-weight-bold);
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--bb-text-tertiary);
  padding: 10px 12px 5px;
  white-space: nowrap;
}

.sb-section-label:first-child { padding-top: 4px; }

.sb-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.7rem 0.9rem;
  border: none;
  border-radius: var(--bb-radius-lg);
  background: transparent;
  color: var(--bb-text-secondary);
  cursor: pointer;
  font-family: var(--bb-font-body);
  font-size: var(--bb-text-base);
  font-weight: var(--bb-weight-semibold);
  text-align: left;
  white-space: nowrap;
  transition: all var(--bb-dur-fast) var(--bb-ease);
}

/* The accent rail is gone: the active state now reads as a raised
   soft-UI surface, which is how the reference marks the current
   page. A left bar plus a tint was two signals for one state. */
.sb-link:hover {
  background: var(--bb-glass-bg-deep);
  color: var(--bb-ink);
}

.sb-link.active {
  background: var(--bb-surface);
  color: var(--bb-ink);
  font-weight: var(--bb-weight-bold);
  box-shadow: var(--bb-shadow-xs);
}

.sb-icon { flex-shrink: 0; color: var(--bb-text-tertiary); transition: color var(--bb-dur-fast) var(--bb-ease); }

.sb-link:hover .sb-icon { color: var(--bb-text-secondary); }
.sb-link.active .sb-icon { color: var(--bb-accent-ink); }

.sb-link-text { overflow: hidden; text-overflow: ellipsis; }

.eco-sidebar.collapsed .sb-section-label { display: none; }
.eco-sidebar.collapsed .sb-link { justify-content: center; padding: 0.75rem 0; }
.eco-sidebar.collapsed .sb-link .sb-icon { margin: 0; }
.eco-sidebar.collapsed .sb-link-text { display: none; }

/* ── Footer ── */
.sb-footer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 16px;
  margin-top: auto;
  border-top: 1px solid var(--bb-border);
  flex-shrink: 0;
}

.theme-toggle { color: var(--bb-text-secondary); }
.theme-toggle:hover { background: var(--bb-sun-soft); color: var(--bb-sun); }

.sb-user {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 12px 10px;
  background: var(--bb-nm-base);
  border-radius: var(--bb-radius-lg);
  box-shadow: var(--bb-nm-inset-sm);
}

.sb-avatar {
  width: 38px;
  height: 38px;
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

.sb-user-info { flex: 1; min-width: 0; }
.sb-user-name { font-size: var(--bb-text-sm); font-weight: var(--bb-weight-bold); color: var(--bb-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sb-user-role { font-size: var(--bb-text-2xs); color: var(--bb-text-tertiary); }

.sb-logout {
  width: 32px;
  height: 32px;
  border-radius: var(--bb-radius-sm);
  background: var(--bb-surface);
  color: var(--bb-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--bb-dur-fast) var(--bb-ease);
  box-shadow: var(--bb-shadow-xs);
}

.sb-logout:hover { background: var(--bb-danger-soft); border-color: var(--bb-danger); color: var(--bb-danger); }

/* ── Mobile Drawer ── */
.mobile-wrap { display: none; }

@media (max-width: 1024px) {
  .eco-sidebar { display: none; }

  .mobile-wrap {
    display: block;
    position: fixed;
    inset: 0;
    z-index: var(--bb-z-overlay);
  }

  .drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(24, 39, 32, 0.35);
    z-index: var(--bb-z-overlay);
  }

  .drawer-panel {
    position: fixed;
    top: 0;
    left: 0;
    width: 290px;
    height: 100vh;
    height: 100dvh; /* mobile browser UI-safe height */
    background: var(--bb-glass-drawer);
    border-right: 1px solid var(--bb-glass-border);
    backdrop-filter: blur(26px) saturate(150%);
    -webkit-backdrop-filter: blur(26px) saturate(150%);
    box-shadow: var(--bb-glass-lg);
    z-index: calc(var(--bb-z-overlay) + 1);
    display: flex;
    flex-direction: column;
    padding: 1.25rem;
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .drawer-close {
    background: var(--bb-surface);
    border: 1px solid transparent;
    border-radius: var(--bb-radius-sm);
    width: 36px;
    height: 36px;
    color: var(--bb-text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--bb-shadow-xs);
  }

  .drawer-close:hover { color: var(--bb-ink); border-color: var(--bb-border-strong); }

  .drawer-nav { flex: 1; overflow-y: auto; }

  .drawer-footer {
    border-top: 1px solid var(--bb-border);
    padding-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .drawer-theme {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.8rem 1rem;
    border-radius: var(--bb-radius-lg);
    color: var(--bb-text-secondary);
    background: var(--bb-nm-base);
    border: none;
    cursor: pointer;
    font-family: var(--bb-font-body);
    font-size: var(--bb-text-md);
    font-weight: var(--bb-weight-semibold);
    width: 100%;
    box-shadow: var(--bb-shadow-xs);
    transition: box-shadow var(--bb-dur-fast) var(--bb-ease);
  }

  .drawer-theme:hover { color: var(--bb-sun); }

  .drawer-logout {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.8rem 1rem;
    border-radius: var(--bb-radius-lg);
    color: var(--bb-danger);
    background: var(--bb-danger-soft);
    border: none;
    cursor: pointer;
    font-family: var(--bb-font-body);
    font-size: var(--bb-text-md);
    font-weight: var(--bb-weight-semibold);
    width: 100%;
    transition: all var(--bb-dur-fast) var(--bb-ease);
  }

  .drawer-logout:hover { background: var(--bb-danger); color: #fff; }
}

/* ── Drawer Transitions ── */
.drawer-enter-active,
.drawer-leave-active { transition: opacity 0.25s ease; }
.drawer-enter-active .drawer-panel,
.drawer-leave-active .drawer-panel { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.drawer-enter-from { opacity: 0; }
.drawer-enter-from .drawer-panel { transform: translateX(-100%); }
.drawer-leave-to { opacity: 0; }
.drawer-leave-to .drawer-panel { transform: translateX(-100%); }
</style>
