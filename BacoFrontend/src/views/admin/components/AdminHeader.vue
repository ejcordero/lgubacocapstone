<script setup>
import { computed, ref, onMounted } from 'vue'

const props = defineProps({
  isCollapsed: Boolean,
  currentMode: String
})

const emit = defineEmits(['toggle-sidebar', 'save'])

const pageTitle = computed(() => {
  const titles = {
    home: 'Dashboard Overview',
    content: 'Visual Website Editor',
    news: 'News & Updates Manager',
    tala: 'TALA Transparency Ledger',
    documents: 'Civil Registry & Documents',
    tourism: 'Tourism Directory',
    mho: 'Municipal Health Office',
    users: 'User Management'
  }
  return titles[props.currentMode] || 'Admin Panel'
})

// â”€â”€ Theme Toggle (admin-scoped â€” never touches the public data-theme) â”€â”€
const adminHeaderRef = ref(null)
const isDark = ref(localStorage.getItem('admin_theme') !== 'light')

onMounted(() => {
  const theme = localStorage.getItem('admin_theme') === 'light' ? 'light' : 'dark'
  isDark.value = theme === 'dark'
  adminHeaderRef.value?.setAttribute('data-admin-theme', theme)
})

const toggleTheme = () => {
  isDark.value = !isDark.value
  const theme = isDark.value ? 'dark' : 'light'
  adminHeaderRef.value?.setAttribute('data-admin-theme', theme)
  localStorage.setItem('admin_theme', theme)
}
</script>

<template>
  <header class="admin-header" ref="adminHeaderRef" data-admin-theme="dark">
    <div class="header-left">
      <button class="toggle-btn" @click="$emit('toggle-sidebar')" title="Toggle Sidebar">
        <i class="fa-solid" :class="isCollapsed ? 'fa-indent' : 'fa-outdent'"></i>
      </button>
      <div class="breadcrumb">
        <span class="path">Admin</span>
        <i class="fas fa-chevron-right sep-icon"></i>
        <span class="current">{{ pageTitle }}</span>
      </div>
    </div>

    <div class="header-right">
      <button
        v-if="currentMode === 'content' || currentMode === 'news'"
        class="save-btn"
        @click="$emit('save')"
      >
        <i class="fa-solid fa-cloud-arrow-up"></i>
        <span>Save Changes</span>
      </button>
      <div class="divider"></div>

      <!-- â•â•â• THEME TOGGLE â•â•â• -->
      <button
        class="icon-btn theme-toggle"
        @click="toggleTheme"
        :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
      >
        <i class="fa-solid" :class="isDark ? 'fa-sun' : 'fa-moon'"></i>
      </button>

      <button class="icon-btn" title="Notifications">
        <i class="fa-regular fa-bell"></i>
        <span class="notif-badge">3</span>
      </button>
      <button class="icon-btn" title="Settings">
        <i class="fa-solid fa-gear"></i>
      </button>
    </div>
  </header>
</template>

<style scoped>
/* Floating chrome -> GLASS. Same pre-existing flaw as the top bar and the
   toasts: a backdrop-filter over an opaque --card blurs nothing. */
.admin-header {
  height: var(--header-h);
  background-image: var(--m-glass);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border-bottom: 1px solid var(--m-glass-edge);
  box-shadow: var(--m-glass-shadow);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;
  font-family: var(--font-body);
}
.header-left { display: flex; align-items: center; gap: 10px; }
.toggle-btn {
  background-image: var(--m-skeuo-face);
  border: 1px solid var(--m-skeuo-edge);
  box-shadow: var(--m-skeuo-shadow);
  font-size: 1rem; color: var(--fg2);
  cursor: pointer; border-radius: var(--r-sm);
  display: flex; align-items: center; justify-content: center;
  width: 38px; height: 38px;
  transition: all 0.2s var(--ease);
}
.toggle-btn:hover {
  background-image: var(--m-skeuo-face-hi);
  color: var(--fg); border-color: var(--bdr2); transform: translateY(-2px);
}
.toggle-btn:active { transform: translateY(0) scale(0.96); box-shadow: var(--m-skeuo-pressed); }
.breadcrumb { display: flex; align-items: center; gap: 7px; font-size: 0.82rem; }
.path { color: var(--mt); font-weight: 500; }
.sep-icon { font-size: 0.55rem; color: var(--mt2); }
.current { color: var(--fg); font-weight: 700; letter-spacing: 0.02em; }
.header-right { display: flex; align-items: center; gap: 10px; }
/* Filled key. The fill is --m-accent-solid rather than --ac: white on the
   --ac blue is only 3.68:1, which fails 4.5:1 for body text. --m-accent-solid
   holds the same hue and reaches 4.88:1. */
.save-btn {
  display: flex; align-items: center; gap: 7px;
  background-image: linear-gradient(135deg, var(--m-accent-hi), var(--m-accent-solid));
  color: white;
  border: 1px solid var(--m-accent-edge);
  padding: 9px 18px; border-radius: var(--r-sm);
  font-size: 0.78rem; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase;
  cursor: pointer; font-family: var(--font-body);
  transition: all 0.2s var(--ease);
  box-shadow: var(--m-accent-shadow);
}
.save-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 22px var(--acg); }
.save-btn:active { transform: translateY(0) scale(0.98); box-shadow: var(--m-skeuo-pressed); }
.divider { width: 1px; height: 24px; background: var(--bdr); margin: 0; }
.icon-btn {
  background-image: var(--m-skeuo-face);
  border: 1px solid var(--m-skeuo-edge);
  box-shadow: var(--m-skeuo-shadow);
  font-size: 1rem; color: var(--fg2);
  cursor: pointer; border-radius: var(--r-sm);
  position: relative; transition: all 0.2s var(--ease);
  display: flex; align-items: center; justify-content: center;
  width: 38px; height: 38px;
}
.icon-btn:hover {
  background-image: var(--m-skeuo-face-hi);
  color: var(--fg); border-color: var(--bdr2); transform: translateY(-2px);
}
.icon-btn:active { transform: translateY(0) scale(0.96); box-shadow: var(--m-skeuo-pressed); }
/* â•â•â• Theme Toggle micro-interaction â•â•â• */
.theme-toggle i {
  transition: transform 0.4s var(--ease);
}
.theme-toggle:hover i {
  transform: rotate(-20deg) scale(1.12);
}
.notif-badge {
  position: absolute; top: -3px; right: -3px;
  background: var(--m-accent-solid); color: white;
  font-size: 0.55rem; font-weight: 800;
  min-width: 15px; height: 15px; padding: 0 3px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid var(--bg);
}
</style>