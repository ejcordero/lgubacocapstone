<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps({
  title: { type: String, default: '' },
  isDark: { type: Boolean, default: true }
})
const emit = defineEmits(['toggle-sidebar', 'toggle-theme'])
const route = useRoute()

// Breadcrumb labels keyed by the route's own name, so the header can never
// drift out of sync with the route table.
const LABELS = {
  'mho-admin-dashboard':    'Dashboard',
  'mho-admin-services':    'Services',
  'mho-admin-content':     'Page Content',
  'mho-admin-announcement': 'Announcement'
}

const current = computed(() => LABELS[route.name] || props.title || 'MHO Console')
</script>

<template>
  <header class="mho-top">
    <div class="mho-top__left">
      <button
        class="mho-top__toggle mho-top__toggle--logo"
        type="button"
        title="Toggle sidebar"
        @click="emit('toggle-sidebar')"
      >
        <img src="/images/RURAL-HEALTH.png" alt="Toggle sidebar" class="mho-top__toggle-logo" />
      </button>
      <div class="mho-top__crumbs">
        <span class="mho-top__root">MHO Console</span>
        <i class="fa-solid fa-chevron-right mho-top__sep"></i>
        <span class="mho-top__current">{{ current }}</span>
      </div>
    </div>

    <div class="mho-top__right">
      <button
        class="mho-top__toggle mat-glass"
        type="button"
        :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
        @click="$emit('toggle-theme')"
      >
        <i class="fa-solid" :class="isDark ? 'fa-sun' : 'fa-moon'"></i>
      </button>
      <a class="mho-top__ghost" href="/mho" target="_blank" rel="noopener">
        <i class="fa-solid fa-arrow-up-right-from-square"></i>
        <span>View public page</span>
      </a>
    </div>
  </header>
</template>

<style scoped>
.mho-top {
  height: 62px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 24px;
  background: var(--mho-glass);
  backdrop-filter: blur(22px) saturate(160%);
  -webkit-backdrop-filter: blur(22px) saturate(160%);
  border-bottom: none;
  box-shadow: none;
  z-index: 150;
}
.mho-top__left  { display: flex; align-items: center; gap: 12px; min-width: 0; }
.mho-top__right { display: flex; align-items: center; gap: 10px; }

.mho-top__toggle {
  width: 38px; height: 38px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--mho-radius-sm);
  background: var(--mho-key-face);
  color: var(--mho-fg-2);
  font-size: 0.95rem;
  cursor: pointer;
  box-shadow: var(--mho-key-shadow);
  transition: transform 0.2s var(--mho-ease), color 0.2s var(--mho-ease);
}
.mho-top__toggle:hover  { transform: translateY(-2px); color: var(--mho-fg); }
.mho-top__toggle:active { transform: translateY(0); box-shadow: var(--mho-key-pressed); }
.mho-top__toggle--logo { width: 220px; height: 112px; padding: 0; background: transparent; box-shadow: none; overflow: hidden; border-radius: var(--mho-radius-sm); }
.mho-top__toggle-logo { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }

.mho-top__crumbs { display: flex; align-items: center; gap: 9px; min-width: 0; }
.mho-top__root    { font-size: 0.8rem; font-weight: 500; color: var(--mho-muted); white-space: nowrap; }
.mho-top__sep     { font-size: 0.5rem; color: var(--mho-muted-2); }
.mho-top__current {
  font-size: 0.83rem;
  font-weight: 700;
  color: var(--mho-fg);
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mho-top__ghost {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 14px;
  border-radius: var(--mho-radius-sm);
  border: 1px solid var(--mho-border);
  background: transparent;
  color: var(--mho-fg-2);
  font-size: 0.8rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s var(--mho-ease);
}
.mho-top__ghost:hover {
  color: var(--mho-fg);
  border-color: var(--mho-border-2);
  background: var(--mho-surface-2);
}

@media (max-width: 720px) {
  .mho-top { padding: 0 14px; }
  .mho-top__crumbs { display: none; }
  .mho-top__ghost span { display: none; }
  .mho-top__ghost { padding: 0 11px; }
}
</style>