<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAdmin, getRole, logout, goToLogin } from '../composables/useMhoAdminAuth.js'

defineProps({
  collapsed: { type: Boolean, default: false },
  mobileOpen: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle-collapse', 'close-mobile'])

const route = useRoute()
const router = useRouter()

const NAV = [
  {
    title: 'Overview',
    items: [
      { to: '/mho-admin',             label: 'Dashboard',    icon: 'fa-chart-pie',        exact: true },
      { to: '/mho-admin/services',    label: 'Services',     icon: 'fa-kit-medical' },
      { to: '/mho-admin/content',     label: 'Page Content', icon: 'fa-file-lines' },
      { to: '/mho-admin/announcement',label: 'Announcement', icon: 'fa-bullhorn' }
    ]
  }
]

const admin = ref(null)
const role = ref('')

const ROLE_LABELS = {
  mho_admin: 'MHO Officer',
  main_controller: 'Super Admin'
}

const roleLabel = computed(() => ROLE_LABELS[role.value] || 'Unauthorized')
const displayName = computed(() => admin.value?.full_name || admin.value?.name || admin.value?.email || 'MHO Officer')

const initials = computed(() =>
  displayName.value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0].toUpperCase())
    .join('')
)

onMounted(() => {
  role.value = getRole()
  admin.value = getAdmin()
  // Second line of defence. The router guard already ran, but this component
  // is also reachable if the layout is ever mounted directly.
  if (!getRole() || !localStorage.getItem('baco_admin_token')) {
    goToLogin()
  }
})

/* The root "/" entry redirects to /dashboard, so route.path never equals the
   item's "/mho-admin". Match either, or the Dashboard row can never light up. */
const isActive = (item) =>
  item.exact
    ? route.path === item.to || route.path === `${item.to}/dashboard`
    : route.path.startsWith(item.to)

const go = (item) => {
  router.push(item.to)
  emit('close-mobile')
}

const signOut = () => logout()
</script>

<template>
  <aside
    class="mho-side mat-glass"
    :class="{ 'is-collapsed': collapsed, 'is-mobile-open': mobileOpen }"
  >
    <!-- BRAND — mirrors the native admin sidebar's `.sidebar-header`
         exactly: seal plate plus the "Municipality of Baco" subtitle. The
         admin carries no title line here, so neither does this. -->
    <div class="mho-side__brand">
      <div class="mho-side__seal"><img src="/images/BACO-SEAL.png" alt="Baco Seal" /></div>
      <div v-if="!collapsed" class="mho-side__brand-text">
        <span class="mho-side__sub">Municipality of Baco</span>
      </div>
      <button
        v-if="!collapsed"
        class="mho-side__collapse mat-skeuo-sm mat-pressable-sm"
        type="button"
        title="Collapse sidebar"
        @click="emit('toggle-collapse')"
      >
        <i class="fa-solid fa-outdent"></i>
      </button>
    </div>

    <!-- NAV -->
    <nav class="mho-side__nav">
      <div v-for="group in NAV" :key="group.title" class="mho-side__group">
        <div v-if="!collapsed" class="mho-side__group-title">{{ group.title }}</div>
        <button
          v-for="item in group.items"
          :key="item.to"
          type="button"
          class="mho-side__item"
          :class="{ 'is-active': isActive(item) }"
          :title="collapsed ? item.label : ''"
          @click="go(item)"
        >
          <span class="mho-side__item-icon"><i class="fa-solid" :class="item.icon"></i></span>
          <span v-if="!collapsed" class="mho-side__item-label">{{ item.label }}</span>
        </button>
      </div>
    </nav>

    <!-- IDENTITY -->
    <div class="mho-side__foot">
      <div class="mho-side__user">
        <div class="mho-side__avatar">{{ initials }}</div>
        <div v-if="!collapsed" class="mho-side__user-text">
          <strong>{{ displayName }}</strong>
          <span>{{ roleLabel }}</span>
        </div>
      </div>
      <button
        v-if="!collapsed"
        class="mho-side__logout"
        type="button"
        title="Sign out"
        @click="signOut"
      >
        <i class="fa-solid fa-right-from-bracket"></i>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.mho-side {
  width: 264px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--mho-glass);
  backdrop-filter: blur(22px) saturate(160%);
  -webkit-backdrop-filter: blur(22px) saturate(160%);
  border-right: 1px solid var(--mho-glass-edge);
  box-shadow: var(--mho-glass-shadow);
  z-index: 200;
  transition: width 0.28s var(--mho-ease);
}
.mho-side.is-collapsed { width: 76px; }

/* ── Brand ── */
.mho-side__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 16px;
  border-bottom: 1px solid var(--mho-border);
  min-height: 74px;
}
.mho-side__seal {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--mho-key-face);
  border: 1px solid var(--mho-border);
  box-shadow: var(--mho-key-shadow);
  overflow: hidden;
}
.mho-side__seal img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.mho-side__brand-text { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
.mho-side__sub {
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--mho-muted);
}
.mho-side__collapse {
  margin-left: auto;
  width: 30px; height: 30px;
  border: none;
  border-radius: var(--mho-radius-sm);
  background: transparent;
  color: var(--mho-muted);
  cursor: pointer;
  transition: all 0.2s var(--mho-ease);
  flex-shrink: 0;
}
.mho-side__collapse:hover { color: var(--mho-fg); background: var(--mho-surface-3); }

/* ── Nav ── */
.mho-side__nav { flex: 1; overflow-y: auto; padding: 14px 10px; }
.mho-side__group + .mho-side__group { margin-top: 18px; }
.mho-side__group-title {
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--mho-muted-2);
  padding: 0 10px 8px;
}
.mho-side__item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin-bottom: 3px;
  border: none;
  border-radius: var(--mho-radius);
  background: transparent;
  color: var(--mho-fg-2);
  font-family: inherit;
  font-size: 0.87rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s var(--mho-ease);
  position: relative;
}
.mho-side__item:hover { background: var(--mho-surface-2); color: var(--mho-fg); }
.mho-side__item.is-active {
  background: var(--mho-accent-soft);
  color: var(--mho-fg);
  font-weight: 600;
}
/* Left rail marker — reads as "you are here" even when the fill is subtle. */
.mho-side__item.is-active::before {
  content: '';
  position: absolute;
  left: -10px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 22px;
  border-radius: 0 3px 3px 0;
  background: var(--mho-accent);
}
.mho-side__item-icon { width: 18px; text-align: center; flex-shrink: 0; font-size: 0.95rem; }
.mho-side__item.is-active .mho-side__item-icon { color: var(--mho-accent); }
.mho-side__item-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── Identity ── */
.mho-side__foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 14px;
  border-top: 1px solid var(--mho-border);
}
.mho-side__user { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
.mho-side__avatar {
  width: 34px; height: 34px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--mho-surface-3);
  border: 1px solid var(--mho-border-2);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--mho-fg-2);
}
.mho-side__user-text { display: flex; flex-direction: column; line-height: 1.3; min-width: 0; }
.mho-side__user-text strong {
  font-size: 0.8rem; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.mho-side__user-text span { font-size: 0.7rem; color: var(--mho-muted); }
.mho-side__logout {
  width: 32px; height: 32px;
  border: none;
  border-radius: var(--mho-radius-sm);
  background: transparent;
  color: var(--mho-muted);
  cursor: pointer;
  transition: all 0.2s var(--mho-ease);
  flex-shrink: 0;
}
.mho-side__logout:hover { color: var(--mho-danger); background: var(--mho-danger-soft); }

@media (max-width: 860px) {
  .mho-side {
    position: fixed;
    inset: 0 auto 0 0;
    transform: translateX(-100%);
    transition: transform 0.28s var(--mho-ease);
  }
  .mho-side.is-mobile-open { transform: translateX(0); }
  .mho-side.is-collapsed { width: 264px; }
  .mho-side.is-collapsed .mho-side__brand-text,
  .mho-side.is-collapsed .mho-side__group-title,
  .mho-side.is-collapsed .mho-side__item-label,
  .mho-side.is-collapsed .mho-side__user-text { display: block; }
}
</style>