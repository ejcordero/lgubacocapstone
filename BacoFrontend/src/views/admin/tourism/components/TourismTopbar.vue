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
  'tourism-admin-dashboard':    'Dashboard',
  'tourism-admin-destinations': 'Destinations',
  'tourism-admin-arrivals':     'Arrivals'
}

const current = computed(() => LABELS[route.name] || props.title || 'Tourism Console')
</script>

<template>
  <header class="tr-top">
    <div class="tr-top__left">
      <button
        class="tr-top__toggle"
        type="button"
        title="Toggle sidebar"
        @click="emit('toggle-sidebar')"
      >
        <img src="/images/BACO-TOURISM.png" alt="Toggle sidebar" class="tr-top__toggle-logo" />
      </button>
      <div class="tr-top__crumbs">
        <span class="tr-top__root">Tourism Console</span>
        <i class="fa-solid fa-chevron-right tr-top__sep"></i>
        <span class="tr-top__current">{{ current }}</span>
      </div>
    </div>

    <div class="tr-top__right">
      <button
        class="tr-top__theme"
        type="button"
        :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
        @click="emit('toggle-theme')"
      >
        <i class="fa-solid" :class="isDark ? 'fa-sun' : 'fa-moon'"></i>
      </button>
      <a class="tr-top__ghost" href="/tourism" target="_blank" rel="noopener">
        <i class="fa-solid fa-arrow-up-right-from-square"></i>
        <span>View public page</span>
      </a>
    </div>
  </header>
</template>

<style scoped>
.tr-top {
  height: 62px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 24px;
  background: var(--tr-glass);
  backdrop-filter: blur(22px) saturate(160%);
  -webkit-backdrop-filter: blur(22px) saturate(160%);
  border-bottom: 1px solid var(--tr-glass-edge);
  box-shadow: var(--tr-glass-shadow);
  z-index: 150;
}
.tr-top__left  { display: flex; align-items: center; gap: 12px; min-width: 0; }
.tr-top__right { display: flex; align-items: center; gap: 10px; }

.tr-top__toggle {
  width: 104px; height: 72px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--tr-radius-sm);
  background: transparent;
  color: var(--tr-fg-2);
  font-size: 0.95rem;
  cursor: pointer;
  box-shadow: none;
  transition: transform 0.2s var(--tr-ease), color 0.2s var(--tr-ease);
}
.tr-top__toggle:hover  { transform: translateY(-2px); color: var(--tr-fg); }
.tr-top__toggle:active { transform: translateY(0); box-shadow: none; }
.tr-top__toggle-logo { width: 100%; height: 100%; object-fit: contain; display: block; }

.tr-top__theme {
  /* Same moulded key as MhoTopbar's .mho-top__toggle. `.tr-top__toggle` is
     already taken by the hamburger in this component, hence the separate name
     for the same visual treatment. */
  width: 38px; height: 38px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--tr-radius-sm);
  background: var(--tr-key-face);
  color: var(--tr-fg-2);
  font-size: 0.95rem;
  cursor: pointer;
  box-shadow: var(--tr-key-shadow);
  transition: transform 0.2s var(--tr-ease), color 0.2s var(--tr-ease);
}
.tr-top__theme:hover  { transform: translateY(-2px); color: var(--tr-fg); }
.tr-top__theme:active { transform: translateY(0); box-shadow: var(--tr-key-pressed); }

.tr-top__crumbs { display: flex; align-items: center; gap: 9px; min-width: 0; }
.tr-top__root    { font-size: 0.8rem; font-weight: 500; color: var(--tr-muted); white-space: nowrap; }
.tr-top__sep     { font-size: 0.5rem; color: var(--tr-muted-2); }
.tr-top__current {
  font-size: 0.83rem;
  font-weight: 700;
  color: var(--tr-fg);
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tr-top__ghost {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 14px;
  border-radius: var(--tr-radius-sm);
  border: 1px solid var(--tr-border);
  background: transparent;
  color: var(--tr-fg-2);
  font-size: 0.8rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s var(--tr-ease);
}
.tr-top__ghost:hover {
  color: var(--tr-fg);
  border-color: var(--tr-border-2);
  background: var(--tr-surface-2);
}

@media (max-width: 720px) {
  .tr-top { padding: 0 14px; }
  .tr-top__crumbs { display: none; }
  .tr-top__ghost span { display: none; }
  .tr-top__ghost { padding: 0 11px; }
  .tr-top__toggle { width: 170px; height: 92px; }
}
</style>