<script setup>
defineProps({
  title: String,
  isOpen: Boolean
})
defineEmits(['close'])
</script>

<template>
  <div class="admin-dock" :class="{ open: isOpen }">
    <div class="dock-header">
      <div class="dock-title-wrap">
        <i class="fas fa-pen-nib title-icon"></i>
        <h3>{{ title }}</h3>
      </div>
      <button class="close-btn" @click="$emit('close')">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="dock-content">
      <slot></slot>
    </div>
  </div>
</template>

<style scoped>
/* A slide-over panel floating above the workspace -> GLASS, strong variant.
   It sits over content, so the translucency is doing real work here: the
   page stays legible through it. */
.admin-dock {
  position: fixed;
  top: 0; left: 0; bottom: 0;
  width: 380px;
  background-image: var(--m-glass-strong);
  backdrop-filter: blur(34px) saturate(165%);
  -webkit-backdrop-filter: blur(34px) saturate(165%);
  border-right: 1px solid var(--m-glass-edge);
  z-index: 900;
  box-shadow: var(--m-glass-shadow-lg);
  transform: translateX(-100%);
  transition: transform 0.3s var(--ease-bounce);
  display: flex; flex-direction: column;
  font-family: var(--font-body);
}
.admin-dock.open { transform: translateX(0); }
.dock-header {
  padding: 0 20px;
  height: var(--header-h);
  border-bottom: 1px solid var(--m-glass-edge);
  display: flex; justify-content: space-between; align-items: center;
  flex-shrink: 0;
}
.dock-title-wrap { display: flex; align-items: center; gap: 10px; }
.title-icon { color: var(--ac); font-size: 0.85rem; }
.dock-header h3 {
  margin: 0; font-size: 0.75rem; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--fg);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 260px;
}
/* Pressable -> SKEUO. The hover state keeps the danger tint but gains the
   moulded face, so it still reads as a physical key while being destructive. */
.close-btn {
  background-image: var(--m-skeuo-face);
  border: 1px solid var(--m-skeuo-edge);
  box-shadow: var(--m-skeuo-shadow-sm);
  color: var(--fg2);
  width: 32px; height: 32px; border-radius: var(--r-sm);
  cursor: pointer; font-size: 0.82rem;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.18s; flex-shrink: 0;
}
.close-btn:hover { background-color: var(--dgs); color: var(--dg); border-color: var(--dg); }
.close-btn:active { box-shadow: var(--m-skeuo-pressed); }
.dock-content {
  flex: 1; overflow-y: auto;
  padding: 24px;
  display: flex; flex-direction: column; gap: 20px;
}
.dock-content::-webkit-scrollbar { width: 4px; }
.dock-content::-webkit-scrollbar-track { background: transparent; }
.dock-content::-webkit-scrollbar-thumb { background: var(--bdr2); border-radius: 2px; }
.dock-content::-webkit-scrollbar-thumb:hover { background: var(--bdr3); }
.dock-content > * { animation: fadeIn 0.25s ease; }
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (max-width: 768px) {
  .admin-dock { width: 100%; border-radius: 0; }
  .dock-content { padding: 20px; }
}
</style>