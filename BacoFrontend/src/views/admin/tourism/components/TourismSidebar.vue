<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getAdmin, getRole, logout, goToLogin } from '../composables/useTourismAdminAuth.js'

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
      { to: '/tourism-admin',              label: 'Dashboard',    icon: 'fa-chart-pie',        exact: true },
      { to: '/tourism-admin/destinations', label: 'Destinations', icon: 'fa-umbrella-beach' },
      { to: '/tourism-admin/arrivals',     label: 'Arrivals',     icon: 'fa-chart-simple' }
    ]
  }
]

const admin = ref(null)
const role = ref('')

const ROLE_LABELS = {
  tourism_admin: 'Tourism Officer',
  main_controller: 'Super Admin'
}

const roleLabel = computed(() => ROLE_LABELS[role.value] || 'Unauthorized')
const displayName = computed(() => admin.value?.full_name || admin.value?.name || admin.value?.email || 'Tourism Officer')

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
   item's "/tourism-admin". Match either, or Dashboard can never light up. */
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
    class="tr-side"
    :class="{ 'is-collapsed': collapsed, 'is-mobile-open': mobileOpen }"
  >
    <!-- BRAND — same structure as MhoSidebar: a logo plate plus the
         "Municipality of Baco" subtitle. Only the artwork differs.
         BACO-TOURISM.png is a 2.27:1 lockup (642x283), so the plate is sized
         to the artwork's aspect rather than forced square — a 42px square
         would shrink the wordmark to an unreadable smudge. -->
    <div class="tr-side__brand">
      <div class="tr-side__seal"><img src="/images/BACO-SEAL.png" alt="Baco Seal" /></div>
      <div v-if="!collapsed" class="tr-side__brand-text">
        <span class="tr-side__sub">Municipality of Baco</span>
      </div>
      <button
        v-if="!collapsed"
        class="tr-side__collapse"
        type="button"
        title="Collapse sidebar"
        @click="emit('toggle-collapse')"
      >
        <i class="fa-solid fa-outdent"></i>
      </button>
    </div>

    <!-- NAV -->
    <nav class="tr-side__nav">
      <div v-for="group in NAV" :key="group.title" class="tr-side__group">
        <div v-if="!collapsed" class="tr-side__group-title">{{ group.title }}</div>
        <button
          v-for="item in group.items"
          :key="item.to"
          type="button"
          class="tr-side__item"
          :class="{ 'is-active': isActive(item) }"
          :title="collapsed ? item.label : ''"
          @click="go(item)"
        >
          <span class="tr-side__item-icon"><i class="fa-solid" :class="item.icon"></i></span>
          <span v-if="!collapsed" class="tr-side__item-label">{{ item.label }}</span>
        </button>
      </div>
    </nav>

    <!-- IDENTITY -->
    <div class="tr-side__foot">
      <div class="tr-side__user">
        <div class="tr-side__avatar">{{ initials }}</div>
        <div v-if="!collapsed" class="tr-side__user-text">
          <strong>{{ displayName }}</strong>
          <span>{{ roleLabel }}</span>
        </div>
      </div>
      <button
        v-if="!collapsed"
        class="tr-side__logout"
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
/* Identical to MhoSidebar.vue's block, token-for-token, with `mho` remapped to
   `tr`. Keeping the two files textually parallel is deliberate: when one
   changes, the diff on the other is the whole story. The ONLY intentional
   divergence is the seal plate below — BACO-TOURISM.png is a 2.27:1 lockup, so
   it cannot use MHO's 42x42 square without becoming unreadable. */
.tr-side {
  width: 264px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--tr-glass);
  backdrop-filter: blur(22px) saturate(160%);
  -webkit-backdrop-filter: blur(22px) saturate(160%);
  border-right: 1px solid var(--tr-glass-edge);
  box-shadow: var(--tr-glass-shadow);
  z-index: 200;
  transition: width 0.28s var(--tr-ease);
}
.tr-side.is-collapsed { width: 76px; }

/* ── Brand ── */
.tr-side__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 16px;
  border-bottom: 1px solid var(--tr-border);
  min-height: 74px;
}
/* MHO's plate, widened to the tourism lockup's aspect. Same moulded face,
   border and shadow — only the box changes shape. */
.tr-side__seal {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  overflow: hidden;
  padding: 0;
}
.tr-side__seal img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.tr-side__brand-text { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
.tr-side__sub {
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--tr-muted);
}
.tr-side__collapse {
  margin-left: auto;
  width: 30px; height: 30px;
  border: none;
  border-radius: var(--tr-radius-sm);
  background: transparent;
  color: var(--tr-muted);
  cursor: pointer;
  transition: all 0.2s var(--tr-ease);
  flex-shrink: 0;
}
.tr-side__collapse:hover { color: var(--tr-fg); background: var(--tr-surface-3); }

/* ── Nav ── */
.tr-side__nav { flex: 1; overflow-y: auto; padding: 14px 10px; }
.tr-side__group + .tr-side__group { margin-top: 18px; }
.tr-side__group-title {
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--tr-muted-2);
  padding: 0 10px 8px;
}
.tr-side__item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  margin-bottom: 3px;
  border: none;
  border-radius: var(--tr-radius);
  background: transparent;
  color: var(--tr-fg-2);
  font-family: inherit;
  font-size: 0.87rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s var(--tr-ease);
  position: relative;
}
.tr-side__item:hover { background: var(--tr-surface-2); color: var(--tr-fg); }
.tr-side__item.is-active {
  background: var(--tr-accent-soft);
  color: var(--tr-fg);
  font-weight: 600;
}
/* Left rail marker — reads as "you are here" even when the fill is subtle. */
.tr-side__item.is-active::before {
  content: '';
  position: absolute;
  left: -10px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 22px;
  border-radius: 0 3px 3px 0;
  background: var(--tr-accent);
}
.tr-side__item-icon { width: 18px; text-align: center; flex-shrink: 0; font-size: 0.95rem; }
.tr-side__item.is-active .tr-side__item-icon { color: var(--tr-accent); }
.tr-side__item-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── Identity ── */
.tr-side__foot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 14px;
  border-top: 1px solid var(--tr-border);
}
.tr-side__user { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
.tr-side__avatar {
  width: 34px; height: 34px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--tr-surface-3);
  border: 1px solid var(--tr-border-2);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--tr-fg-2);
}
.tr-side__user-text { display: flex; flex-direction: column; line-height: 1.3; min-width: 0; }
.tr-side__user-text strong {
  font-size: 0.8rem; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tr-side__user-text span { font-size: 0.7rem; color: var(--tr-muted); }
.tr-side__logout {
  width: 32px; height: 32px;
  border: none;
  border-radius: var(--tr-radius-sm);
  background: transparent;
  color: var(--tr-muted);
  cursor: pointer;
  transition: all 0.2s var(--tr-ease);
  flex-shrink: 0;
}
.tr-side__logout:hover { color: var(--tr-danger); background: var(--tr-danger-soft); }

@media (max-width: 860px) {
  .tr-side {
    position: fixed;
    inset: 0 auto 0 0;
    transform: translateX(-100%);
    transition: transform 0.28s var(--tr-ease);
  }
  .tr-side.is-mobile-open { transform: translateX(0); }
  .tr-side.is-collapsed { width: 264px; }
  .tr-side.is-collapsed .tr-side__brand-text,
  .tr-side.is-collapsed .tr-side__group-title,
  .tr-side.is-collapsed .tr-side__item-label,
  .tr-side.is-collapsed .tr-side__user-text { display: block; }
}
</style>
