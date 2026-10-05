<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  activeMode: { type: String, default: 'home' },
  isCollapsed: { type: Boolean, default: false },
  mobileOpen: { type: Boolean, default: false }
})
const emit = defineEmits(['switch-mode'])
const router = useRouter()

const currentUserRole = ref('main_controller')
const roleDefinitions = {
  main_controller: 'Super Admin',
  mho_admin:       'MHO Officer',
  tourism_admin:   'Tourism Officer',
  bplo_admin:      'BPLO Officer',
  mdrrmo_admin:    'MDRRMO Officer'
}
const knownRoles = Object.keys(roleDefinitions)

const baseMenuGroups = [
  {
    title: 'Overview',
    items: [
      {
        id: 'home',
        label: 'Dashboard',
        icon: 'fa-chart-pie',
        allowedRoles: ['main_controller', 'mho_admin', 'tourism_admin', 'bplo_admin']
      }
    ]
  },
  {
    title: 'Content Management',
    items: [
      { id: 'news',      label: 'News & Updates',      icon: 'fa-newspaper',           allowedRoles: ['main_controller', 'tourism_admin', 'mho_admin'] },
      { id: 'barangays', label: 'Barangays',           icon: 'fa-map',                 allowedRoles: ['main_controller'] },
      { id: 'history',   label: 'History',             icon: 'fa-landmark',            allowedRoles: ['main_controller', 'tourism_admin'] }, 
      { id: 'charter',   label: "Citizen's Charter",   icon: 'fa-file-pdf',            allowedRoles: ['main_controller'] },
      { id: 'tourism',   label: 'Tourism',             icon: 'fa-umbrella-beach',      allowedRoles: ['main_controller', 'tourism_admin'] },
      { id: 'mho', label: 'Health (MHO)', icon: 'fa-heart-pulse', allowedRoles: ['main_controller', 'mho_admin'] },
      { id: 'tala',      label: 'TALA',                icon: 'fa-file-invoice-dollar', allowedRoles: ['main_controller'] },
      { id: 'officials', label: 'Officials',        icon: 'fa-user-tie',        allowedRoles: ['main_controller', 'tourism_admin'] },
      { id: 'schools',   label: 'Schools',          icon: 'fa-graduation-cap',  allowedRoles: ['main_controller', 'tourism_admin'] },
      { id: 'offices',   label: 'Offices',          icon: 'fa-building-columns', allowedRoles: ['main_controller', 'tourism_admin'] }
    ]
  },
  {
    title: 'Operations',
    items: [
      { id: 'resorts',  label: 'Resorts Manager',       icon: 'fa-water',               allowedRoles: ['main_controller', 'tourism_admin'] },
      { id: 'hotels',   label: 'LGU Hotels',          icon: 'fa-hotel',               allowedRoles: ['main_controller', 'tourism_admin'] },
      { id: 'halcon',   label: 'Mt. Halcon Bookings', icon: 'fa-mountain',            allowedRoles: ['main_controller', 'tourism_admin'] },
      { id: 'bookings', label: 'Booking Monitor',     icon: 'fa-binoculars',          allowedRoles: ['main_controller', 'tourism_admin'] },
      { id: 'users',    label: 'User Management',     icon: 'fa-users',               allowedRoles: ['main_controller'] },
      { id: 'content',   label: 'System Logs',     icon: 'fa-pen-nib',             allowedRoles: ['main_controller'] }
    ]
  }
]

onMounted(() => {
  const storedRole = localStorage.getItem('baco_admin_role')
  const storedToken = localStorage.getItem('baco_admin_token')
  if (storedRole && storedToken) {
    currentUserRole.value = knownRoles.includes(storedRole) ? storedRole : 'main_controller'
  } else {
    localStorage.removeItem('baco_admin_token')
    localStorage.removeItem('baco_admin_role')
    localStorage.removeItem('baco_admin_data')
    router.replace('/admin/login')
  }
})

const menuRole = computed(() => {
  const r = currentUserRole.value
  return knownRoles.includes(r) && r !== 'mdrrmo_admin' ? r : 'main_controller'
})

const filteredMenuGroups = computed(() => {
  return baseMenuGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => item.allowedRoles.includes(menuRole.value))
    }))
    .filter(group => group.items.length > 0)
})

const displayRoleName = computed(() => roleDefinitions[currentUserRole.value] || 'Unauthorized User')
const selectMode = (id) => emit('switch-mode', id)
const executeLogout = () => {
  localStorage.removeItem('baco_admin_token')
  localStorage.removeItem('baco_admin_role')
  localStorage.removeItem('baco_admin_data')
  router.replace('/admin/login')
}
</script>

<template>
  <aside class="admin-sidebar mat-glass" :class="{ collapsed: isCollapsed, 'mobile-open': mobileOpen }">
    <div class="sidebar-header">
      <div class="logo-icon"><img src="/images/BACO-SEAL.png" alt="Baco Seal" /></div>
      <div class="logo-text">
        <span class="subtitle">Municipality of Baco</span>
      </div>
    </div>

    <nav class="sidebar-menu">
      <div v-for="(group, index) in filteredMenuGroups" :key="index" class="menu-group">
        <div class="group-title">{{ group.title }}</div>
        <div
          v-for="item in group.items"
          :key="item.id"
          class="menu-item"
          :class="{ active: activeMode === item.id }"
          @click="selectMode(item.id)"
          :title="isCollapsed ? item.label : ''"
        >
          <span class="menu-icon"><i class="fa-solid" :class="item.icon"></i></span>
          <span class="menu-label">{{ item.label }}</span>
          <span class="active-dot" v-if="activeMode === item.id"></span>
        </div>
      </div>
    </nav>

    <div class="sidebar-footer">
      <div class="user-avatar"><i class="fa-solid fa-user-shield"></i></div>
      <div class="user-info">
        <span class="user-name"></span>
        <span class="user-role">{{ displayRoleName }}</span>
      </div>
      <button class="logout-btn mat-skeuo-sm mat-pressable-sm" title="Logout" @click="executeLogout">
        <i class="fa-solid fa-right-from-bracket"></i>
        <span class="logout-text">Logout</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* The sidebar is the shell's largest piece of floating chrome, so it is the
   clearest candidate for GLASS. It is opaque --card-solid today, and the
   layout's ambience washes sit directly behind it, so a translucent fill has
   real structure to blur rather than a flat colour. */
.admin-sidebar {
  width: 256px; height: 100vh;
  background-image: var(--m-glass);
  backdrop-filter: blur(22px) saturate(160%);
  -webkit-backdrop-filter: blur(22px) saturate(160%);
  box-shadow: var(--m-glass-shadow);
  display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden; transition: width 0.28s var(--ease), background-color 0.3s ease; border-right: 1px solid var(--m-glass-edge); font-family: var(--font-body); position: relative; z-index: 200; }
.admin-sidebar.collapsed { width: 64px; }

.sidebar-header {
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 15px;
  gap: 12px;
  border-bottom: 1px solid var(--bdr);
  flex-shrink: 0;
  background: var(--card3);
  overflow: hidden;
}
[data-admin-theme="dark"] .sidebar-header {
  background: rgba(0, 0, 0, 0.3);
}

/* The seal is a circular mark on a square PNG, so the wrapper only clips it.
   No mat-skeuo plate: the previous bolt badge was moulded, an image is not. */
.logo-icon { width: 42px; height: 42px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.logo-icon img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 50%; }

/* The collapsed rail is 64px wide with 15px of padding either side, which
   leaves 34px — too narrow for the full-size seal. Drop the padding and centre
   the mark instead, so it scales down rather than getting clipped. */
.admin-sidebar.collapsed .sidebar-header { padding: 0; justify-content: center; gap: 0; }
.admin-sidebar.collapsed .logo-icon { width: 40px; height: 40px; }

.logo-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
  transition: opacity 0.2s, width 0.28s;
}
.admin-sidebar.collapsed .logo-text { opacity: 0; width: 0; pointer-events: none; }

.title {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--fg);
}
.period { color: var(--ac); }
/* This is now the only text in the header, so it can carry the weight the
   "Admin." wordmark used to. Wraps to two lines rather than clipping: the
   sidebar gives roughly 170px for it, which 20 uppercase characters will not
   fit on one line at a readable size. */
.subtitle {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  line-height: 1.25;
  text-transform: uppercase;
  color: var(--mt);
  white-space: normal;
}

.sidebar-menu {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 14px 8px;
}
.sidebar-menu::-webkit-scrollbar { width: 3px; }
.sidebar-menu::-webkit-scrollbar-thumb { background: var(--bdr); border-radius: 2px; }

.menu-group { margin-bottom: 20px; }
.group-title {
  font-size: 0.58rem;
  text-transform: uppercase;
  color: var(--mt2);
  font-weight: 800;
  letter-spacing: 0.16em;
  padding: 0 10px;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  transition: opacity 0.2s;
}
.admin-sidebar.collapsed .group-title { opacity: 0; height: 0; margin: 0; padding: 0; overflow: hidden; }

/* The nav list gets the material on interaction rather than all at once.
   Raising all twenty items at rest reads as noise, so the metaphor is:
   hover LIFTS the key, and the active item sits PRESSED IN, because a chosen
   key is the one that has been pushed down. That also means the current
   section is the single most prominent thing in the rail, which is the job
   the left border indicator used to be doing on its own. */
.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px;
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s,
              box-shadow 0.2s var(--ease), transform 0.2s var(--ease);
  margin-bottom: 2px;
  position: relative;
  color: var(--mt);
  border-left: 2px solid transparent;
  overflow: hidden;
}
.menu-item:hover {
  background-image: var(--m-skeuo-face);
  border-color: var(--m-skeuo-edge);
  border-left-color: transparent;
  box-shadow: var(--m-skeuo-shadow-sm);
  color: var(--fg);
}
.menu-item:active {
  box-shadow: var(--m-skeuo-pressed);
  transform: scale(0.985);
}
.menu-item.active {
  background-image: var(--m-skeuo-face-hi);
  box-shadow: var(--m-well-shadow);
  color: var(--ac);
  border-left-color: var(--ac);
}

.menu-icon {
  width: 20px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
}
.menu-item.active .menu-icon { color: var(--ac); }

.admin-sidebar.collapsed .menu-item { justify-content: center; padding: 10px 0; }
.admin-sidebar.collapsed .menu-item .menu-icon { width: auto; font-size: 1rem; }

.menu-label {
  font-size: 0.84rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: opacity 0.2s, width 0.28s;
}
.admin-sidebar.collapsed .menu-label { opacity: 0; width: 0; overflow: hidden; }

.active-dot {
  position: absolute;
  right: 8px; top: 50%;
  transform: translateY(-50%);
  width: 5px; height: 5px;
  border-radius: 50%;
  background: var(--ac);
  box-shadow: 0 0 6px var(--acg);
  flex-shrink: 0;
}
.admin-sidebar:not(.collapsed) .active-dot { display: none; }

.sidebar-footer {
  height: 64px;
  border-top: 1px solid var(--bdr);
  display: flex;
  align-items: center;
  padding: 0 8px;
  gap: 10px;
  background: var(--card3);
  flex-shrink: 0;
  overflow: hidden;
}
[data-admin-theme="dark"] .sidebar-footer {
  background: rgba(0, 0, 0, 0.3);
}

.user-avatar {
  width: 34px; height: 34px;
  flex-shrink: 0;
  background: var(--acs);
  border: 1px solid var(--ac);
  border-radius: var(--r-sm);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.95rem;
  color: var(--ac);
}

.user-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  transition: opacity 0.2s, width 0.28s;
}
.admin-sidebar.collapsed .user-info { opacity: 0; width: 0; pointer-events: none; }

.user-name {
  display: block;
  color: var(--fg);
  font-weight: 700;
  font-size: 0.78rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.user-role {
  display: block;
  color: var(--ac);
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logout-btn { cursor: pointer; padding: 8px; border-radius: var(--r-sm); display: flex; align-items: center; gap: 8px; flex-shrink: 0; font-family: var(--font-body); font-size: 0.85rem; }
.logout-btn:hover {
  color: var(--dg);
  background-image: var(--m-skeuo-face);
  border-color: var(--m-skeuo-edge);
  box-shadow: var(--m-skeuo-shadow-sm);
}
.logout-btn:active { box-shadow: var(--m-skeuo-pressed); }

.logout-text {
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  transition: opacity 0.2s, width 0.28s;
}
.admin-sidebar.collapsed .logout-text { opacity: 0; width: 0; overflow: hidden; }

/* ── Mobile: full-width overlay drawer ── */
@media (max-width: 768px) {
  .admin-sidebar {
    position: fixed;
    left: 0; top: 0; bottom: 0;
    width: min(280px, 82vw);
    transform: translateX(-110%);
    transition: transform 0.3s var(--ease), background-color 0.3s ease;
    box-shadow: 0 0 48px rgba(0, 0, 0, 0.5);
  }
  .admin-sidebar.mobile-open { transform: translateX(0); }
  .admin-sidebar.collapsed { width: min(280px, 82vw); }
  .admin-sidebar.collapsed .logo-text,
  .admin-sidebar.collapsed .menu-label,
  .admin-sidebar.collapsed .user-info,
  .admin-sidebar.collapsed .logout-text,
  .admin-sidebar.collapsed .group-title {
    opacity: 1; width: auto; height: auto; overflow: visible; pointer-events: auto;
  }
  .admin-sidebar.collapsed .group-title { padding: 0 10px; margin-bottom: 4px; }
  .admin-sidebar.collapsed .menu-item { justify-content: flex-start; padding: 10px; gap: 10px; }
  .admin-sidebar.collapsed .menu-icon { width: 20px; font-size: 0.95rem; }
}
</style>